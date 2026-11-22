// Natuur- en besturingsverbeteringen: camera, wandelpaden, ondergrondse ertsen, rook, vogels en vlinders.
// `VOOR=1 npx playwright test tests/verbeteringen.spec.js -g opname` legt de uitgangssituatie vast (screenshots voor-*).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { trackErrors, openGame, startNewVillage, shot } = require('./helpers');

const checkErrors = (errors) => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);
const PRE = process.env.VOOR ? 'voor' : 'na';

/* Druk dorp: rang Town, veel bewoners, een paar werkplaatsen; dan een tijd laten lopen zodat er paden ontstaan */
async function busyVillage(page, seconds) {
  return page.evaluate(sec => {
    const VE = window.VE, g = VE.game, w = g.world, N = VE.N;
    g.rank = 3; w.owned.fill(1); w.explored.fill(1); w.fogDirty = true; w.recolor();
    Object.assign(g.stock, { plank: 400, stone: 400, ironbar: 30, bread: 40, log: 40 });
    const place = (t, near, r) => {
      let best = null, bd = 1e9;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        if (!g.canPlace(t, i, j).ok) continue;
        const d = Math.hypot(i - near[0], j - near[1]);
        if (d > r) continue;
        if (d < bd && d > 2) { bd = d; best = [i, j]; }
      }
      return best ? g.placeBuilding(t, best[0], best[1], true) : null;
    };
    const hq = [g.hq.cx, g.hq.cz];
    place('woodcutter', [hq[0] - 6, hq[1] - 3], 7);
    place('sawmill', [hq[0] + 4, hq[1] + 3], 7);
    place('quarry', [hq[0] + 5, hq[1] - 4], 8);
    place('bakery', [hq[0] - 3, hq[1] + 5], 7);
    place('smelter', [hq[0] + 6, hq[1] + 1], 8);
    for (let n = 0; n < 4; n++) place('house', [hq[0] + (n % 2 ? 5 : -5), hq[1] + (n < 2 ? -6 : 6)], 6);
    for (let n = 0; n < 30; n++) g.spawnSettler();
    const t0 = performance.now();
    for (let t = 0; t < sec; t += 0.05) g.update(0.05);
    const simMs = (performance.now() - t0) / (sec / 0.05);
    let road1 = 0, road2 = 0; for (let k = 0; k < N * N; k++) { if (w.road[k] === 1) road1++; else if (w.road[k] === 2) road2++; }
    document.querySelectorAll('.toast').forEach(t => t.remove());
    document.getElementById('questPanel').style.display = 'none';
    return { road1, road2, simMs, pop: g.settlers.length };
  }, seconds);
}
async function look(page, x, z, dist, yaw, pitch) {
  await page.evaluate(({ x, z, dist, yaw, pitch }) => {
    const c = window.VE.view.cam;
    c.tx = x; c.tz = z; c.tdist = c.dist = dist;
    if (yaw !== undefined) c.tyaw = c.yaw = yaw;
    if (pitch !== undefined) c.pitch = pitch;
    if (window.VE.natureForceSync) window.VE.natureForceSync();
  }, { x, z, dist, yaw, pitch });
  await page.waitForTimeout(1200);
}
async function perf(page) {
  return page.evaluate(async () => {
    const VE = window.VE, R = VE.view.renderer;
    const ft = []; let last = performance.now();
    await new Promise(res => { let n = 0; const f = () => { const t = performance.now(); ft.push(t - last); last = t; if (++n < 90) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    ft.sort((a, b) => a - b);
    R.info.autoReset = false; R.info.reset(); R.render(VE.view.scene, VE.view.camera);
    const out = { calls: R.info.render.calls, tris: R.info.render.triangles, frameMedian: +ft[45].toFixed(1), frameP95: +ft[85].toFixed(1) };
    R.info.autoReset = true;
    return out;
  });
}

test.describe('camera', () => {
  test('links en rechts slepen verplaatsen, middelste knop draait, klikken selecteert en bouwt', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'muis: desktop');
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await page.evaluate(() => { document.querySelectorAll('.toast').forEach(t => t.remove()); window.__ctx = 0; window.addEventListener('contextmenu', e => { if (!e.defaultPrevented) window.__ctx++; }); });
    const cam = () => page.evaluate(() => { const c = window.VE.view.cam; return { tx: c.tx, tz: c.tz, yaw: c.tyaw, dist: c.tdist }; });
    const ground = (x, y) => page.evaluate(({ x, y }) => { const v = new THREE.Vector3(); const c = window.VE.view.cam; return c.groundAt(x, y, v, c.ty) ? [v.x, v.z] : null; }, { x, y });
    const W = 1920, H = 1080;
    // 1. links slepen: het vastgepakte punt blijft onder de muis, de draaiing verandert niet
    const c0 = await cam();
    const g0 = await ground(900, 500);
    await page.mouse.move(900, 500); await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(900 + i * 25, 500 + i * 12);
    const g1 = await ground(1200, 644);
    await page.mouse.up();
    const c1 = await cam();
    expect(Math.hypot(g1[0] - g0[0], g1[1] - g0[1]), 'grond blijft onder de muis').toBeLessThan(0.25);
    expect(Math.hypot(c1.tx - c0.tx, c1.tz - c0.tz)).toBeGreaterThan(2);
    expect(c1.yaw).toBeCloseTo(c0.yaw, 5);
    expect(await page.evaluate(() => !!window.VE.ui.sel), 'slepen selecteert niets').toBe(false);
    // 2. rechts slepen: verschuift net als links (grond blijft onder de muis), geen contextmenu, geen selectie
    const gr0 = await ground(900, 500);
    await page.mouse.move(900, 500); await page.mouse.down({ button: 'right' });
    for (let i = 1; i <= 10; i++) await page.mouse.move(900 - i * 22, 500 - i * 10);
    const gr1 = await ground(680, 400);
    await page.mouse.up({ button: 'right' });
    const c1b = await cam();
    expect(Math.hypot(gr1[0] - gr0[0], gr1[1] - gr0[1]), 'rechts: grond blijft onder de muis').toBeLessThan(0.25);
    expect(Math.hypot(c1b.tx - c1.tx, c1b.tz - c1.tz), 'rechts: verschoven').toBeGreaterThan(2);
    expect(c1b.yaw).toBeCloseTo(c1.yaw, 5);
    expect(await page.evaluate(() => window.__ctx)).toBe(0);
    expect(await page.evaluate(() => !!window.VE.ui.sel), 'rechts slepen selecteert niets').toBe(false);
    // middelste knop: draaien rond het doel
    await page.mouse.move(900, 500); await page.mouse.down({ button: 'middle' });
    for (let i = 1; i <= 10; i++) await page.mouse.move(900 + i * 20, 500);
    await page.mouse.up({ button: 'middle' });
    const c2 = await cam();
    expect(Math.abs(c2.yaw - c1b.yaw), 'gedraaid').toBeGreaterThan(0.5);
    expect(Math.hypot(c2.tx - c1b.tx, c2.tz - c1b.tz), 'doel blijft staan').toBeLessThan(0.01);
    // 3. muiswiel zoomt
    await page.mouse.move(900, 500); await page.mouse.wheel(0, 400); await page.waitForTimeout(100);
    expect((await cam()).dist).toBeGreaterThan(c2.dist);
    // 4. kort klikken selecteert het dorpshuis
    await page.evaluate(() => { const c = window.VE.view.cam, h = window.VE.game.hq; c.tx = h.cx; c.tz = h.cz; c.tdist = c.dist = 17; c.update(0); });
    await page.waitForTimeout(300);
    const hqPx = await page.evaluate(() => { const h = window.VE.game.hq, v = new THREE.Vector3(h.cx, h.y + 0.4, h.cz).project(window.VE.view.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; });
    await page.mouse.click(hqPx[0], hqPx[1]);
    expect(await page.evaluate(() => window.VE.ui.sel && window.VE.ui.sel.type)).toBe('hq');
    await page.keyboard.press('Escape');
    // 5. bouwmodus: slepen bouwt niets, klikken wel
    const n0 = await page.evaluate(() => { window.VE.ui.setTool('house'); window.VE.game.stock.plank = 99; return window.VE.game.buildings.length; });
    const spot = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, cam = VE.view.camera;
      for (let r = 2; r < 8; r++) for (let a = 0; a < 16; a++) {
        const i = Math.round(g.hq.cx + Math.cos(a) * r), j = Math.round(g.hq.cz + Math.sin(a) * r);
        if (!g.canPlace('house', i, j).ok) continue;
        const v = new THREE.Vector3(i + 0.5, g.world.heightAt(i + 0.5, j + 0.5), j + 0.5).project(cam);
        const x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
        if (x > 100 && y > 120 && x < innerWidth - 200 && y < innerHeight - 260 && document.elementFromPoint(x, y) === VE.view.renderer.domElement) return [x, y];
      }
      return null;
    });
    expect(spot).not.toBeNull();
    await page.mouse.move(spot[0], spot[1]); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(spot[0] + i * 15, spot[1]);
    await page.mouse.up();
    expect(await page.evaluate(() => window.VE.game.buildings.length), 'slepen bouwt niet').toBe(n0);
    const spot2 = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, cam = VE.view.camera;
      for (let r = 2; r < 8; r++) for (let a = 0; a < 16; a++) {
        const i = Math.round(g.hq.cx + Math.cos(a) * r), j = Math.round(g.hq.cz + Math.sin(a) * r);
        if (!g.canPlace('house', i, j).ok) continue;
        const v = new THREE.Vector3(i + 0.5, g.world.heightAt(i + 0.5, j + 0.5), j + 0.5).project(cam);
        const x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
        if (x > 100 && y > 120 && x < innerWidth - 200 && y < innerHeight - 260 && document.elementFromPoint(x, y) === VE.view.renderer.domElement) return [x, y];
      }
      return null;
    });
    await page.mouse.click(spot2[0], spot2[1]);
    expect(await page.evaluate(() => window.VE.game.buildings.length), 'klikken bouwt').toBe(n0 + 1);
    await page.keyboard.press('Escape');
    // 6. slepen boven de bouwbalk verplaatst de camera niet
    const c3 = await cam();
    const bar = await page.locator('#cards').boundingBox();
    await page.mouse.move(bar.x + 30, bar.y + 20); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(bar.x + 30 + i * 20, bar.y + 20 - i * 15);
    await page.mouse.up();
    const c4 = await cam();
    expect(Math.hypot(c4.tx - c3.tx, c4.tz - c3.tz)).toBeLessThan(0.01);
    // 7. niet buiten de wereld
    await page.mouse.move(300, 300); await page.mouse.down();
    for (let i = 1; i <= 30; i++) await page.mouse.move(300 + i * 50, 300 + i * 25);
    await page.mouse.up();
    const c5 = await cam();
    expect(c5.tx).toBeGreaterThanOrEqual(1); expect(c5.tx).toBeLessThanOrEqual(63);
    expect(c5.tz).toBeGreaterThanOrEqual(1); expect(c5.tz).toBeLessThanOrEqual(63);
    expect(checkErrors(errors)).toEqual([]);
  });

  test('aanraken: één vinger verplaatst, tik selecteert', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'touch: mobiel');
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const r = await page.evaluate(async () => {
      const VE = window.VE, el = VE.view.renderer.domElement, c = VE.view.cam;
      const ev = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, button: 0, buttons: 1, bubbles: true }));
      el.setPointerCapture = () => {};
      const t0 = [c.tx, c.tz];
      ev('pointerdown', 190, 420);
      for (let i = 1; i <= 10; i++) { ev('pointermove', 190 + i * 8, 420 + i * 10); await new Promise(r => setTimeout(r, 10)); }
      ev('pointerup', 270, 520);
      const t1 = [c.tx, c.tz];
      return { moved: Math.hypot(t1[0] - t0[0], t1[1] - t0[1]), yaw: c.tyaw, sel: !!VE.ui.sel };
    });
    expect(r.moved).toBeGreaterThan(1);
    expect(r.sel).toBe(false);
    expect(checkErrors(errors)).toEqual([]);
  });
});

test.describe('paden, rook, vogels: logica', () => {
  test('wandelpaden: alleen echte beweging telt, vijf stadia, langzaam herstel, gras terug, opslaan', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'logica: alleen desktop');
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, P = w.paths, N = VE.N, S = VE.PATHS.stage;
      const out = {};
      // vrije grastegel
      let k = -1;
      for (let rr = 4; rr < 12 && k < 0; rr++) for (let i = g.hq.i - rr; i <= g.hq.i + rr && k < 0; i++) { const q = (g.hq.j + rr) * N + i; if (g.freeTile(q) && w.type[q] === 0 && !w.road[q]) k = q; }
      const x = k % N + 0.5, z = ((k / N) | 0) + 0.5;
      // 1. stilstaan of een piepklein stapje: geen slijtage
      const s = g.settlers[0]; s.path = null; s.x = x; s.z = z; s.mode = 'idle';
      for (let t = 0; t < 30; t += 0.05) { s.path = null; g.moveSettler && 0; }
      out.idleWear = P.tileValue(k);
      // 2. één keer erlangs lopen: nog niets zichtbaars (stadium 0 of hooguit platgelopen gras)
      P.walk(x - 0.4, z, 0.2, 1); P.walk(x, z, 0.2, 1); P.walk(x + 0.4, z, 0.2, 1);
      out.oneWalk = P.stageOf(P.tileValue(k));
      // 3. stadia bij steeds meer passages
      const stages = [];
      for (let n = 1; n <= 120; n++) { g.tread(k); if ([5, 15, 30, 50, 100].includes(n)) stages.push(P.stageOf(P.tileValue(k))); }
      out.stages = stages; out.road = w.road[k]; out.trample = w.veg ? w.veg.tr[k] : 1;
      // 4. opslaan en laden
      const save = JSON.parse(JSON.stringify(g.serialize()));
      const g2 = new VE.Game(VE.view.scene); g2.init(save);
      out.afterLoad = g2.world.paths.stageOf(g2.world.paths.tileValue(k)); out.loadRoad = g2.world.road[k];
      g2.dispose();
      // 5. herstel: na 5 minuten nog zichtbaar, na een half uur weer gras (en het gras komt terug)
      for (let n = 0; n < 60; n++) g.wearDecay();
      out.after5min = P.stageOf(P.tileValue(k));
      for (let n = 0; n < 660; n++) g.wearDecay();
      out.after60min = P.stageOf(P.tileValue(k)); out.trampleAfter = w.veg ? w.veg.tr[k] : 0; out.roadAfter = w.road[k];
      out.saveSize = JSON.stringify(save.trail).length;
      return out;
    });
    console.log('paden:', JSON.stringify(r));
    expect(r.idleWear).toBe(0);
    expect(r.oneWalk).toBeLessThanOrEqual(1);
    expect(r.stages).toEqual([0, 1, 2, 3, 4]);
    expect(r.road).toBe(2);
    expect(r.trample, 'gras platgetrapt').toBeGreaterThan(0.9);
    expect(r.afterLoad).toBe(4);
    expect(r.loadRoad).toBe(2);
    expect(r.after5min, 'herstelt langzaam').toBeGreaterThanOrEqual(2);
    expect(r.after60min).toBe(0);
    expect(r.roadAfter).toBe(0);
    expect(r.trampleAfter, 'gras groeit terug').toBe(0);
    expect(r.saveSize).toBeLessThan(2000);
    expect(checkErrors(errors)).toEqual([]);
  });

  test('rook: één draw call, rook per soort gebouw en activiteit', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'logica: alleen desktop');
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, N = VE.N;
      g.rank = 3; w.owned.fill(1); Object.assign(g.stock, { plank: 99, stone: 99 });
      let sm = null;
      for (let rr = 3; rr < 12 && !sm; rr++) for (let a = 0; a < 16 && !sm; a++) { const i = Math.round(g.hq.cx + Math.cos(a) * rr), j = Math.round(g.hq.cz + Math.sin(a) * rr); if (g.canPlace('smelter', i, j).ok) sm = g.placeBuilding('smelter', i, j, true); }
      const kinds = {}; const h = e => { kinds[e.kind] = (kinds[e.kind] || 0) + 1; };
      VE.bus.on('smoke', h);
      for (let t = 0; t < 20; t += 0.05) g.update(0.05);                 // smelterij zonder erts: rustig
      const idle = Object.assign({}, kinds); for (const k in kinds) kinds[k] = 0;
      sm.working = true; sm.wt = 999; sm.wt0 = 999;
      for (let t = 0; t < 20; t += 0.05) g.update(0.05);                 // smelterij aan het werk: dik
      const work = Object.assign({}, kinds);
      let smokeMeshes = 0; g.root.traverse(o => { if (o.name === 'smoke') smokeMeshes++; });
      return { idle, work, smokeMeshes, n: g.fx.smoke.list.length };
    });
    console.log('rook:', JSON.stringify(r));
    expect(r.smokeMeshes, 'alle rook in één mesh').toBe(1);
    expect(r.idle.home).toBeGreaterThan(0);
    expect(r.idle.smoulder || 0).toBeLessThan(r.work.heavy);
    expect(r.work.heavy).toBeGreaterThan(50);
    expect(checkErrors(errors)).toEqual([]);
  });

  test('vogels vliegen boven alles langs en landen; vlinders bij bloemen, niet bij drukte', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'logica: alleen desktop');
    test.setTimeout(120_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await page.waitForTimeout(1000);
    const r = await page.evaluate(async () => {
      const VE = window.VE, g = VE.game, w = g.world, wl = g.wild, N = VE.N;
      let flySamples = 0, tooLow = 0, perched = 0, landed = 0, flights = 0;
      const was = {};
      for (let t = 0; t < 240; t += 0.05) {
        g.update(0.05);
        if (Math.round(t * 20) % 10 === 0) for (const a of wl.list) {
          if (a.dead || !a.sp.fly) continue;
          if (a.state === 'fly') {
            flySamples++;
            const d = Math.hypot(a.tx - a.x, a.tz - a.z);
            // onderweg (niet vlak bij de landingsplek): nooit lager dan de veilige hoogte (bomen, daken, berg)
            const fromStart = Math.hypot(a.x - (a.ox || a.x), a.z - (a.oz || a.z));
            if (d > 1.9 && fromStart > 1.0 && a.y > 0.05 && a.alt < wl.clearance(a.x, a.z, 0) - 0.2) tooLow++;
            if (was[a.id] !== 'fly') flights++;
          } else if (was[a.id] === 'fly') { landed++; if (a.perch) perched++; }
          was[a.id] = a.state;
        }
      }
      // vlinders: bij bloemen, en weinig in de drukte rond gebouwen
      const B = g.fx.butterflies, busy = wl.busy;
      for (let i = 0; i < 1200; i++) g.fx.update(0.05, i * 0.05);
      let nearFlowers = 0, inBusy = 0, sitting = 0;
      for (const b of B.list) {
        const i0 = Math.floor(b.x), j0 = Math.floor(b.z); let f = false;
        for (let dj = -3; dj <= 3 && !f; dj++) for (let di = -3; di <= 3 && !f; di++) if (w.inb(i0 + di, j0 + dj) && w.decoF[(j0 + dj) * N + i0 + di]) f = true;
        if (f) nearFlowers++;
        if (busy[j0 * N + i0] > 0.9) inBusy++;
        if (b.state === 'sit' || b.sits) sitting++;
      }
      const species = new Set(wl.list.filter(a => !a.dead && a.sp.fly).map(a => a.key));
      return { flySamples, tooLow, perched, landed, flights, nB: B.list.length, nearFlowers, inBusy, sitting, species: [...species], geo: !!VE.butterflyGeo };
    });
    console.log('vogels/vlinders:', JSON.stringify(r));
    expect(r.species.sort()).toEqual(['bird', 'blackbird', 'tit']);
    expect(r.flights).toBeGreaterThan(5);
    expect(r.landed).toBeGreaterThan(3);
    expect(r.tooLow, 'nooit door bomen, daken of bergen').toBe(0);
    expect(r.geo).toBe(true);
    expect(r.nearFlowers / r.nB).toBeGreaterThan(0.8);
    expect(r.inBusy).toBeLessThanOrEqual(2);
    expect(r.sitting, 'vlinders landen op bloemen').toBeGreaterThan(r.nB * 0.5);
    expect(checkErrors(errors)).toEqual([]);
  });
});

test.describe('vogels en vlinders', () => {
  test('close-up: vlinders (vliegend en op een bloem) en zangvogels (fladderen, zweven, op de grond)', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'beeld: desktop');
    await openGame(page);
    await startNewVillage(page);
    const c = await page.evaluate(async () => {
      const VE = window.VE, g = VE.game, w = g.world, wl = g.wild;
      document.querySelectorAll('.toast').forEach(t => t.remove()); document.getElementById('questPanel').style.display = 'none';
      await new Promise(r => setTimeout(r, 500));
      g.speed = 0;
      const x0 = g.hq.cx - 2.5, z0 = g.hq.cz + 4.2;
      for (const t of g.nature.trees) if (!t.dead && Math.abs(t.x - x0 - 1.5) < 4 && Math.abs(t.z - z0) < 3) g.nature.removeTree(t);
      for (const a of wl.list) if (Math.hypot(a.x - x0, a.z - z0) < 6) a.dead = true;
      // vlinders: drie vliegend, drie op een bloem
      const B = g.fx.butterflies;
      B.list.slice(0, 6).forEach((b, i) => {
        b.x = x0 + i * 0.32; b.z = z0 - 0.4; b.tx = b.x + 10; b.tz = b.z; b.hx = b.x; b.hz = b.z;
        b.state = i < 3 ? 'fly' : 'sit'; b.y = i < 3 ? 0.45 : 0.13; b.t = 999; b.sp = 0; b.by = 0.45; b.h = 0.6 + i; b.sc = 1.9;
      });
      // vogels: fladderend, zwevend, op de grond (elk van de drie soorten)
      ['bird', 'tit', 'blackbird'].forEach((k, i) => {
        const fl = wl.add(VE.SPECIES[k], x0 + i * 0.7, z0 + 0.5, 0, false);
        fl.state = 'fly'; fl.glide = i === 1; fl.y = 0.55; fl.alt = w.heightAt(fl.x, fl.z) + 0.55; fl.tx = fl.x + 30; fl.tz = fl.z; fl.fh = fl.rot = 1.2; fl.bank = i === 2 ? 0.35 : 0; fl.spd = 0; fl.t = 999; fl.glideT = 999;
        const gr = wl.add(VE.SPECIES[k], x0 + i * 0.7 + 0.3, z0 + 1.0, 0, false);
        gr.state = i === 0 ? 'idle' : 'walk'; gr.t = 999; gr.rot = 0.7; gr.spd = 0.3;
      });
      return [x0 + 0.9, z0 + 0.3];
    });
    await look(page, c[0], c[1], 3.4, 0.2, 0.42);
    await shot(page, info.project.name, PRE + '-vogels-vlinders-closeup');
  });
});

test.describe('verbeteringen', () => {
  test('opname: screenshots en prestaties (voor/na)', async ({ page }, info) => {
    test.setTimeout(300_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const sim = await busyVillage(page, 420);
    const P = info.project.name;
    const hq = await page.evaluate(() => [window.VE.game.hq.cx, window.VE.game.hq.cz]);
    await look(page, hq[0], hq[1] + 1, 17, Math.PI / 4, 0.9);
    const m = await perf(page);
    await shot(page, P, PRE + '-dorp');
    await look(page, hq[0] + 1, hq[1] + 2, 8, Math.PI / 4, 0.8);
    await shot(page, P, PRE + '-paden');
    const sm = await page.evaluate(() => { const b = window.VE.game.buildings.find(b => b.type === 'smelter' || b.type === 'house'); return b ? [b.cx, b.cz] : null; });
    if (sm) { await look(page, sm[0], sm[1], 5, 0.6, 0.55); await shot(page, P, PRE + '-rook'); }
    await look(page, hq[0] - 6, hq[1] - 4, 11, 1.2, 0.5);
    await shot(page, P, PRE + '-vogels-vlinders');
    const dep = await page.evaluate(() => { const d = (window.VE.game.world.deposits || [])[0]; return d ? [d.x, d.z] : null; });
    if (dep) { await look(page, dep[0], dep[1] + 1, 8, Math.PI / 4, 0.8); await shot(page, P, PRE + '-berg'); }
    const data = Object.assign({ project: P, fase: PRE }, sim, m);
    console.log('meting:', JSON.stringify(data));
    const f = path.join(__dirname, 'screenshots', 'metingen.json');
    let all = {}; try { all = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { /* nieuw */ }
    all[PRE + '-' + P] = data; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(all, null, 2));
    expect(checkErrors(errors)).toEqual([]);
  });
});
