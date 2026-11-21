// Showcase: elk gebouwtype in de echte game, voor voor/na-vergelijking van de stijl-uitrol.
//   set SHOTS_DIR=voor&& npm run showcase     → tests/screenshots/showcase/voor/
//   set SHOTS_DIR=na&& npm run showcase       → tests/screenshots/showcase/na/
// Per gebouw een close-up (desktop) plus een dorpsoverzicht (desktop + mobiel) en metingen.
const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { trackErrors, checkErrors, openGame, SHOT_DIR } = require('./helpers');

const OUT = path.join(SHOT_DIR, 'showcase', process.env.SHOTS_DIR || 'huidig');
const TYPES = ['house', 'woodcutter', 'forester', 'quarry', 'sawmill', 'farm', 'windmill', 'bakery', 'fisher',
  'market', 'tower', 'vineyard', 'winery', 'tavern', 'warehouse', 'monument'];

async function frameStats(page, seconds) {
  return page.evaluate(sec => new Promise(res => {
    const R = window.VE.view.renderer, times = [];
    let last = 0; const t0 = performance.now();
    const f = now => { if (last) times.push(now - last); last = now; if (now - t0 < sec * 1000) requestAnimationFrame(f); else {
      times.sort((a, b) => a - b);
      res({ frames: times.length, avgMs: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1),
        calls: R.info.render.calls, triangles: R.info.render.triangles, geometries: R.info.memory.geometries });
    } };
    requestAnimationFrame(f);
  }), seconds);
}

test('@visual showcase: alle gebouwen', async ({ page }, info) => {
  test.setTimeout(400_000);
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    let s = 1;
    window.__seedRng = v => { s = v; };
    Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  });
  await openGame(page);
  await page.evaluate(() => { window.__seedRng(1234567); window.VE.newGame(); });
  await page.waitForFunction(() => window.VE.playing === true);
  const placed = await page.evaluate(types => {
    const VE = window.VE, g = VE.game, hq = g.hq, w = g.world;
    VE.ui.toast = () => {};
    g.rank = 4; g.gold = 1e6;                                        // alles ontgrendeld
    w.setTerritory([{ x: hq.cx, z: hq.cz, r: 16 }]);                 // ruimte om te bouwen
    const out = {};
    for (const t of types) {
      let done = false;
      for (let r = 2; r < 15 && !done; r++) for (let j = hq.j - r; j <= hq.j + r && !done; j++) for (let i = hq.i - r; i <= hq.i + r && !done; i++) {
        if (Math.max(Math.abs(i - hq.i), Math.abs(j - hq.j)) !== r || (i + j) % 2) continue;
        if (g.canPlace(t, i, j).ok) { const b = g.placeBuilding(t, i, j, true); out[t] = { id: b.id, cx: b.cx, cz: b.cz, size: b.size }; done = true; }
      }
    }
    for (const n of ['hq', 'yard']) { const b = g.buildings.find(b => b.type === n); out[n] = { id: b.id, cx: b.cx, cz: b.cz, size: b.size }; }
    w.reveal(hq.cx, hq.cz, 20); w.updateFog();
    g.speed = 0;
    document.getElementById('hud').style.visibility = 'hidden';
    return out;
  }, TYPES);
  fs.mkdirSync(OUT, { recursive: true });
  const shoot = async name => {
    await page.waitForTimeout(1500);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: path.join(OUT, `${info.project.name}-${name}.png`) });
  };
  const metrics = { placed: Object.keys(placed), src: await page.evaluate(() => Object.assign({}, window.VE.modelSource)) };
  // overzicht
  await page.evaluate(() => { const c = window.VE.view.cam, hq = window.VE.game.hq; c.tx = hq.cx; c.tz = hq.cz + 1; c.tdist = c.dist = 24; c.tyaw = c.yaw = Math.PI / 4; });
  await shoot('0-overzicht');
  metrics.overzicht = await frameStats(page, 2);
  if (info.project.name === 'desktop') {
    for (const [t, b] of Object.entries(placed)) {
      for (const lvl of (t === 'hq' || t === 'yard') ? [1] : [1, 3]) {
        await page.evaluate(({ id, lvl }) => { const g = window.VE.game, b = g.bmap[id]; if (b.level !== lvl) { b.level = lvl; g.makeMesh(b); } }, { id: b.id, lvl });
        await page.evaluate(b => { const c = window.VE.view.cam; c.tx = b.cx; c.tz = b.cz + 0.15; c.tdist = c.dist = b.size > 1 ? 6 : 3.6; c.tyaw = c.yaw = Math.PI / 4 - 0.35; }, b);
        await shoot(`${t}-l${lvl}`);
      }
    }
  }
  fs.writeFileSync(path.join(OUT, `${info.project.name}-metingen.json`), JSON.stringify(metrics, null, 2));
  const unknown = checkErrors(errors, info);
  if (unknown.length) throw new Error(unknown.join('\n'));
});
