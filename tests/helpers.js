// Gedeelde hulpfuncties voor de Village Empire-tests.
const fs = require('fs');
const path = require('path');

const SAVE_KEY = 'village_empire_save_v1';
const SHOT_DIR = path.join(__dirname, 'screenshots');

/** Verzamelt JS-fouten, console-errors en mislukte requests van een pagina. */
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push({ kind: 'pageerror', text: String(e && e.stack || e) }));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const loc = (m.location() && m.location().url) || '';
    if (loc.includes('crazygames.com')) return; // bewust geblokkeerd, zie isolate()
    errors.push({ kind: 'console', text: m.text() + (loc ? ' @ ' + loc : '') });
  });
  page.on('requestfailed', r => {
    const u = r.url();
    if (u.includes('crazygames.com')) return; // bewust geblokkeerd, zie isolate()
    errors.push({ kind: 'requestfailed', text: u + ' — ' + (r.failure() && r.failure().errorText) });
  });
  return errors;
}

/**
 * Aparte testomgeving: blokkeer de CrazyGames-SDK zodat de game nooit naar een
 * externe (cloud)opslag schrijft. Opslag valt terug op localStorage van het
 * tijdelijke, lege testprofiel van Playwright.
 */
async function isolate(page) {
  await page.route(/crazygames\.com/, route => route.abort());
}

/** Opent de game en wacht tot het hoofdmenu klaar is. */
async function openGame(page) {
  await isolate(page);
  await page.goto('/index.html');
  // Bewaking: we draaien altijd op de lokale testserver, nooit op een productie-origin.
  const origin = new URL(page.url()).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error('Test draait niet op de lokale testserver: ' + origin);
  await page.locator('#menuBtns').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(() => window.VE && window.VE.game && window.VE.ui);
}

/** Start een nieuw dorp vanuit het hoofdmenu. */
async function startNewVillage(page) {
  await page.locator('#btnNew').click();
  // Single Player: standaard 'None' (vreedzaam dorp) → Start
  await page.locator('#spStart').click();
  await page.locator('#hud').waitFor({ state: 'visible' });
  await page.waitForFunction(() => window.VE.playing === true);
  // camera-animatie laten uitlopen
  await page.waitForTimeout(2500);
}

async function shot(page, project, name) {
  const dir = path.join(SHOT_DIR, project);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, name + '.png') });
}

/**
 * Zoekt tegels waar `type` geplaatst mag worden én die op het scherm zichtbaar
 * zijn (niet onder HUD-elementen). Geeft schermcoördinaten terug, dichtst bij
 * het midden eerst.
 */
async function findPlaceSpots(page, type, max = 8) {
  return page.evaluate(({ type, max }) => {
    const VE = window.VE, g = VE.game, w = g.world, cam = VE.view.camera, N = VE.N;
    const canvas = VE.view.renderer.domElement;
    const W = window.innerWidth, H = window.innerHeight;
    const size = VE.DEFS[type].size || 1;
    const out = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (!g.canPlace(type, i, j).ok) continue;
      const x = i + size / 2, z = j + size / 2;
      const v = new THREE.Vector3(x, w.heightAt(x, z), z).project(cam);
      if (v.z > 1) continue;
      const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H;
      if (sx < 20 || sy < 20 || sx > W - 20 || sy > H - 20) continue;
      if (document.elementFromPoint(sx, sy) !== canvas) continue;
      const p = VE.ui.pick(sx, sy);
      const pi = size > 1 ? Math.round(p.x - 1) : p.i, pj = size > 1 ? Math.round(p.z - 1) : p.j;
      if (pi !== i || pj !== j) continue;
      out.push({ i, j, x: sx, y: sy, d: Math.hypot(sx - W / 2, sy - H / 2) });
    }
    out.sort((a, b) => a.d - b.d);
    return out.slice(0, max);
  }, { type, max });
}

/**
 * Splitst fouten in onbekend (laat test falen) en bekend (known-issues.js).
 * Bekende fouten worden als annotatie aan het testrapport toegevoegd.
 */
function checkErrors(errors, info) {
  const known = process.env.STRICT ? [] : require('./known-issues');
  const unknown = [], seen = new Set();
  for (const e of errors) {
    const k = known.find(x => x.match.test(e.text));
    if (k) seen.add(k.id); else unknown.push(e);
  }
  for (const id of seen) {
    const k = known.find(x => x.id === id);
    info.annotations.push({ type: 'known-issue', description: `${k.id}: ${k.title}` });
  }
  // dubbele meldingen (bijv. elke frame) samenvoegen
  const uniq = [...new Map(unknown.map(e => [e.kind + e.text.split('\n')[0], e])).values()];
  return uniq.map(e => `[${e.kind}] ${e.text}`);
}

/**
 * Klikt een element in de bouwbalk. De game vervangt #tabs/#cards via innerHTML
 * zodra de voorraad verandert, dus een klik kan "verloren" gaan; probeer opnieuw
 * tot de verwachte toestand bereikt is.
 */
async function clickUntil(page, selector, check) {
  const { expect } = require('@playwright/test');
  await expect(async () => {
    await page.locator(selector).click({ timeout: 2000 });
    expect(await check()).toBeTruthy();
  }).toPass({ timeout: 15_000, intervals: [100, 250, 500] });
}

/** Meet HUD-elementen die buiten beeld vallen of elkaar overlappen (visuele audit). */
async function layoutAudit(page) {
  return page.evaluate(() => {
    const W = window.innerWidth, H = window.innerHeight;
    const ids = ['topbar', 'rankBox', 'resBar', 'goldBox', 'sideBtns', 'questPanel', 'buildBar', 'toolRow', 'tabs', 'cards', 'toolHint', 'infoPanel'];
    const rects = {};
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.classList.contains('hidden')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      rects[id] = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
        scrollW: el.scrollWidth, clientW: el.clientWidth };
    }
    const issues = [];
    for (const [id, r] of Object.entries(rects)) {
      if (r.x < 0 || r.y < 0 || r.x + r.w > W + 1 || r.y + r.h > H + 1) issues.push(`#${id} valt (deels) buiten beeld (${r.x},${r.y} ${r.w}×${r.h})`);
    }
    const top = ['topbar', 'sideBtns', 'questPanel', 'buildBar', 'infoPanel', 'toolHint'].filter(k => rects[k]);
    for (let a = 0; a < top.length; a++) for (let b = a + 1; b < top.length; b++) {
      const A = rects[top[a]], B = rects[top[b]];
      const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x), oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
      if (ox > 4 && oy > 4) issues.push(`#${top[a]} overlapt #${top[b]} (${ox}×${oy}px)`);
    }
    const doc = document.documentElement;
    if (doc.scrollWidth > W + 1) issues.push(`Pagina scrollt horizontaal (${doc.scrollWidth}px > ${W}px)`);
    // kleine tikdoelen (mobiel < 40px)
    const small = [];
    document.querySelectorAll('#hud button').forEach(b => {
      const r = b.getBoundingClientRect();
      if (r.width && r.height && (r.width < 40 || r.height < 40) && r.bottom > 0 && r.top < H) small.push((b.id || b.className || b.textContent.trim().slice(0, 12)) + ` ${Math.round(r.width)}×${Math.round(r.height)}`);
    });
    const textCut = [];
    document.querySelectorAll('#hud .card .c-name, #hud .tab, #hud .tool small').forEach(el => { if (el.scrollWidth > el.clientWidth + 1) textCut.push(el.textContent.trim()); });
    return { viewport: { W, H }, rects, issues, smallTapTargets: small, truncatedText: textCut };
  });
}

/** Telefoon: de bouwbalk is ingeklapt; open de gebouwkaartjes (categorie aantikken). Op desktop: niets. */
async function showCards(page) {
  const collapsed = await page.evaluate(() => document.getElementById('buildBar').classList.contains('collapsed'));
  if (collapsed) { await page.locator('.tab.on').click(); await page.locator('#cards').waitFor({ state: 'visible' }); }
}

module.exports = { showCards, SAVE_KEY, SHOT_DIR, trackErrors, checkErrors, clickUntil, isolate, openGame, startNewVillage, shot, findPlaceSpots, layoutAudit };
