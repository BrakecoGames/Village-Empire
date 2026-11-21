// Nieuwe bewoners (Blender): close-ups van uiterlijk, animaties en easter eggs, plus prestatiemetingen.
//   set SHOTS_DIR=fase-c&& npm run characters
// Beelden: tests/screenshots/characters/<SHOTS_DIR>/
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { trackErrors, checkErrors, openGame, SHOT_DIR } = require('./helpers');

const OUT = path.join(SHOT_DIR, 'characters', process.env.SHOTS_DIR || 'huidig');

async function setup(page) {
  // OLD_SETTLERS=1: settler.glb blokkeren → oude (procedurele) bewoners, voor een eerlijke vergelijking
  if (process.env.OLD_SETTLERS) await page.route(/settler\.glb/, r => r.abort());
  await page.addInitScript(() => {
    let s = 1;
    window.__seedRng = v => { s = v; };
    Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  });
  await openGame(page);
  await page.evaluate(() => { window.__seedRng(1234567); window.VE.newGame(); document.getElementById('hud').style.visibility = 'hidden'; window.VE.ui.toast = () => {}; });
  await page.waitForFunction(() => window.VE.playing === true);
  // vrije, verkende plek zoeken en de simulatie bevriezen
  return page.evaluate(() => {
    const VE = window.VE, g = VE.game, w = g.world, N = VE.N, hq = g.hq;
    g.speed = 0;
    const free = (x, z) => { for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const i = Math.floor(x + dx), j = Math.floor(z + dz); if (!w.inb(i, j)) return false; const k = j * N + i; if (w.tree[k] || w.rock[k] || w.bld[k] || w.type[k] !== 0) return false; } return true; };
    let tx = hq.cx + 3, tz = hq.cz + 3;
    search: for (let r = 3; r < 16; r++) for (let a = 0; a < 24; a++) { const x = hq.cx + Math.cos(a / 24 * 6.283) * r, z = hq.cz + Math.sin(a / 24 * 6.283) * r; if (free(x, z)) { tx = x; tz = z; break search; } }
    w.reveal(tx, tz, 8); w.updateFog();
    window.__spot = { x: tx, z: tz };
    return { src: VE.settlerSource, renderer: g.sr.constructor.name };
  });
}

/* zet n bewoners naast elkaar (gezicht naar de camera) met de opgegeven toestanden */
async function lineup(page, poses, opts) {
  await page.evaluate(({ poses, opts }) => {
    const VE = window.VE, g = VE.game, c = VE.view.cam, sp = window.__spot;
    const yaw = Math.PI / 4;
    c.tx = sp.x; c.tz = sp.z; c.tdist = c.dist = opts.dist || 2.6; c.tyaw = c.yaw = yaw; c.pitch = opts.pitch || 0.5;
    const px = Math.cos(yaw), pz = -Math.sin(yaw);
    g.settlers.forEach((s, i) => {
      if (i >= poses.length) { s.hidden = true; return; }
      const k = i - (poses.length - 1) / 2, p = poses[i];
      Object.assign(s, { hidden: false, moving: false, act: null, tool: null, carry: null, mode: 'idle', role: 'carrier', path: null, _eggForce: null, _blend: 0 }, p);
      if (p.id !== undefined) { s.id = p.id; s._look = null; }
      s.x = sp.x + px * k * (opts.gap || 0.36); s.z = sp.z + pz * k * (opts.gap || 0.36); s.y = g.world.heightAt(s.x, s.z); s.rot = yaw + (p.turn || 0);
    });
  }, { poses, opts });
  await page.waitForTimeout(1800);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

test('@visual bewoners: uiterlijk, animaties, easter eggs', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'close-ups op desktop');
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  const st = await setup(page);
  expect(st.src).toBe('glb');
  expect(st.renderer).toBe('SettlerRenderGLB');
  fs.mkdirSync(OUT, { recursive: true });
  const shot = async name => page.screenshot({ path: path.join(OUT, `${name}.png`) });

  // 1. verschillende beroepen en uiterlijken (stilstaand, idle)
  await lineup(page, [
    { id: 3, mode: 'work', role: 'woodcutter', tool: 'axe' },
    { id: 8, mode: 'work', role: 'farmer', tool: 'scythe' },
    { id: 21, mode: 'work', role: 'baker' },
    { id: 5, mode: 'idle' },
    { id: 14, mode: 'work', role: 'mason', tool: 'pick' },
    { id: 30, mode: 'work', role: 'forester', tool: 'spade' },
    { id: 41, mode: 'work', role: 'fisher', tool: 'rod' },
  ], { dist: 2.7 });
  await shot('1-beroepen');
  await lineup(page, [
    { id: 52, mode: 'work', role: 'miller' }, { id: 63, mode: 'work', role: 'vintner', tool: 'sickle' },
    { id: 74, mode: 'work', role: 'merchant' }, { id: 85, mode: 'work', role: 'innkeeper' },
    { id: 96, mode: 'build', tool: 'hammer' }, { id: 107, mode: 'work', role: 'sawyer' }, { id: 118, mode: 'work', role: 'guard' },
  ], { dist: 2.7 });
  await shot('2-beroepen');
  // 2. variatie: zelfde beroep (drager), verschillende gezichten/kapsels/baarden/bouw
  await lineup(page, [11, 12, 13, 16, 17, 19, 23, 24].map(id => ({ id, mode: 'idle' })), { dist: 2.7, gap: 0.32 });
  await shot('3-variatie');

  // 3. animaties (bevroren op een karakteristiek moment)
  await lineup(page, [
    { id: 3, moving: true, wp: 0.6 },
    { id: 4, moving: true, wp: 3.8, carry: 'log' },
    { id: 5, mode: 'work', role: 'woodcutter', tool: 'axe', act: 'chop', ap: 0.45 },
    { id: 6, mode: 'work', role: 'mason', tool: 'pick', act: 'pick', ap: 0.33 },
    { id: 7, mode: 'build', tool: 'hammer', act: 'hammer', ap: 0.26 },
    { id: 8, mode: 'work', role: 'farmer', tool: 'scythe', act: 'harvest', ap: 0.6 },
    { id: 9, mode: 'work', role: 'forester', tool: 'spade', act: 'dig', ap: 0.6 },
  ], { dist: 2.8 });
  await page.evaluate(() => { window.VE.uTime.value = 1000; });
  await shot('4-animaties-werk');
  // idle-varianten: zwaaien, juichen, hoed rechtzetten (tijd zo kiezen dat de clip loopt)
  await page.evaluate(() => {
    const r = window.VE.game.sr; const orig = r.choose.bind(r);
    window.__forceClip = { 1: ['wave', 0.3], 2: ['cheer', 0.4], 3: ['idle_hat', 0.85], 4: ['idle', 1.0], 5: ['carry_idle', 0.5], 6: ['sow', 0.55], 7: ['fish', 2.6] };
    r.choose = (s, T) => window.__forceClip[s.__slot] || orig(s, T);
  });
  await lineup(page, [
    { id: 31, __slot: 1 }, { id: 32, __slot: 2 }, { id: 33, __slot: 3 }, { id: 34, __slot: 4 },
    { id: 35, __slot: 5, carry: 'plank' }, { id: 36, __slot: 6, mode: 'work', role: 'farmer' }, { id: 37, __slot: 7, mode: 'work', role: 'fisher', tool: 'rod' },
  ], { dist: 2.8 });
  await shot('5-animaties-gebaren');
  await page.evaluate(() => { window.__forceClip = {}; });

  // 4. easter eggs
  const eggs = [['duck', 'carrier'], ['bigmustache', 'woodcutter'], ['carrot', 'farmer'], ['monocle', 'merchant'], ['toque', 'baker'], ['tilt', 'mason'], ['bee', 'carrier'], ['frog', 'carrier']];
  await lineup(page, eggs.map(([e, role], i) => ({ id: 200 + i, mode: 'work', role, _eggForce: e })), { dist: 2.7, gap: 0.32 });
  await shot('6-easter-eggs-a');
  const eggs2 = [['nest', 'carrier'], ['socks', 'carrier'], ['teddy', 'carrier'], ['logo', 'carrier'], ['nightcap', 'carrier'], ['braid', 'carrier'], ['leek', 'farmer'], ['eyepatch', 'fisher']];
  await lineup(page, eggs2.map(([e, role], i) => ({ id: 220 + i, mode: 'work', role, _eggForce: e })), { dist: 2.7, gap: 0.32 });
  await shot('7-easter-eggs-b');
  // van achteren (rugzak met prei, paardenstaart, nachtmuts)
  await lineup(page, eggs2.map(([e, role], i) => ({ id: 220 + i, mode: 'work', role, _eggForce: e, turn: Math.PI })), { dist: 2.7, gap: 0.32 });
  await shot('8-achterkant');
  const unknown = checkErrors(errors, info);
  expect(unknown, unknown.join('\n')).toEqual([]);
});

test('@visual bewoners: prestaties met 25, 50 en 100 bewoners', async ({ page }, info) => {
  test.setTimeout(300_000);
  const errors = trackErrors(page);
  await setup(page);
  fs.mkdirSync(OUT, { recursive: true });
  const res = {};
  for (const n of [25, 50, 100]) {
    res[n] = await page.evaluate(n => new Promise(done => {
      const VE = window.VE, g = VE.game, sp = window.__spot, c = VE.view.cam, R = VE.view.renderer;
      while (g.settlers.length < n) g.spawnSettler();
      // iedereen zichtbaar, gemengd: lopen, dragen, werken, stilstaan — in een veld van ~6×6 tegels
      const acts = [['chop', 'axe', 'woodcutter'], ['pick', 'pick', 'mason'], ['hammer', 'hammer', null], ['harvest', 'scythe', 'farmer']];
      g.settlers.forEach((s, i) => {
        if (i >= n) { s.hidden = true; return; }
        const kind = i % 4;
        Object.assign(s, { hidden: false, path: null, act: null, tool: null, carry: null, moving: false, mode: 'idle', role: 'carrier' });
        if (kind === 1) { s.moving = true; }
        if (kind === 2) { s.moving = true; s.carry = VE.RES_ORDER[i % 3]; }
        if (kind === 3) { const a = acts[i % 4]; s.mode = a[2] ? 'work' : 'build'; s.role = a[2] || 'carrier'; s.act = a[0]; s.tool = a[1]; }
        s.x = sp.x - 3 + (i % 10) * 0.6; s.z = sp.z - 3 + Math.floor(i / 10) * 0.6; s.y = g.world.heightAt(s.x, s.z);
      });
      c.tx = sp.x; c.tz = sp.z; c.tdist = c.dist = 14;
      // animatie laten doorlopen zonder simulatie: wp/ap zelf ophogen
      g.speed = 0;
      const ms = [], cpu = [];
      let last = 0, frames = 0;
      const tick = t => {
        for (const s of g.settlers) { if (s.moving) s.wp += 0.18; if (s.act) s.ap += 0.016; }
        const a = performance.now(); g.sr.render(g.settlers); cpu.push(performance.now() - a);
        if (last) ms.push(t - last); last = t;
        if (++frames < 40) requestAnimationFrame(tick);
        else {
          ms.sort((x, y) => x - y); cpu.sort((x, y) => x - y);
          const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
          const st = g.sr.stats || {};                     // de oude renderer heeft geen statistiek
          done({ renderer: g.sr.constructor.name, settlers: st.settlers, instances: st.instances, meshesDrawn: st.drawn,
            frameAvgMs: +avg(ms).toFixed(1), settlerCpuMs: +avg(cpu).toFixed(2), settlerCpuP95: +cpu[Math.floor(cpu.length * 0.95)].toFixed(2),
            drawCalls: R.info.render.calls, triangles: R.info.render.triangles });
        }
      };
      requestAnimationFrame(tick);
    }), n);
    await page.screenshot({ path: path.join(OUT, `perf-${n}-${info.project.name}.png`) });
  }
  fs.writeFileSync(path.join(OUT, `prestaties-${info.project.name}.json`), JSON.stringify(res, null, 2));
  console.log(info.project.name, JSON.stringify(res));
  // in vergelijkingsmodus is de geblokkeerde settler.glb-request verwacht
  const unknown = checkErrors(process.env.OLD_SETTLERS ? errors.filter(e => !/settler.glb|Failed to load resource/.test(e.text)) : errors, info);
  expect(unknown, unknown.join('\n')).toEqual([]);
});
