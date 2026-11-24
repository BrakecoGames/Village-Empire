// Eekhoorns: nieuw Blender-model, klimmen langs het echte stamoppervlak (kop omhoog / kop omlaag), takken,
// sprongen, gedrag op de grond, geen botsingen (stam, grond, gebouwen) en prestaties.
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage, shot } = require('./helpers');

const errs = errors => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);

test('eekhoorns: model, klimmen zonder door de stam te gaan, takken, sprongen en gedrag', async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await openGame(page);
  await startNewVillage(page);
  await page.evaluate(() => Promise.all([window.VE.glbAllReady, window.VE.Squirrel.ready]));
  const r = await page.evaluate(() => {
    const VE = window.VE, g = VE.game, W = g.wild, w = g.world, N = VE.N;
    w.explored.fill(1); w.fogDirty = true;
    // model: driehoeken per eekhoorn (poten links + rechts)
    const A = VE.animalAssets && VE.animalAssets.squirrel;
    let tris = 0; if (A) for (const p of A.parts) tris += p.geo.attributes.position.count / 3 * p.nodes.length;
    const clipsInModel = A ? Object.keys(A.clips).sort() : [];
    const sqs = W.list.filter(a => a.key === 'squirrel');
    const modes = {}, clips = {};
    let samples = 0, inTrunk = 0, minClear = 9, under = 0, inBuilding = 0, jumps = 0, headUp = 0, headDown = 0, wrongHead = 0, nan = 0;
    let ms = 0;
    for (let t = 0; t < 300; t += 0.05) {
      g.arriveT = 1e9;
      for (const a of sqs) a.vis = true;                       // volledige update, alsof ze allemaal in beeld zijn
      const t0 = performance.now(); g.update(0.05); ms += performance.now() - t0;
      for (const a of sqs) {
        if (a.dead || !a.sq) continue;
        samples++;
        if (!isFinite(a.wx + a.wy + a.wz)) { nan++; continue; }
        const S = a.sq;
        modes[S.mode] = (modes[S.mode] || 0) + 1; clips[a.clipWant] = (clips[a.clipWant] || 0) + 1;
        if (S.mode === 'jump' && S.J && S.J.p < 0.06) jumps++;
        if (a.wy < w.heightAt(a.wx, a.wz) - 0.01) under++;
        if (S.mode === 'ground' && !W.passXZ(a.x, a.z)) inBuilding++;
        // kop omhoog bij klimmen, kop omlaag bij afdalen: lokale z-as (kop) van de eekhoorn
        if (S.mode === 'trunk' && a.tq) {
          const fz = new THREE.Vector3(0, 0, 1).applyQuaternion(a.tq);
          if (S.dir > 0) { if (fz.y > 0.5) headUp++; else wrongHead++; } else { if (fz.y < -0.5) headDown++; else wrongHead++; }
        }
        const i0 = Math.floor(a.wx), j0 = Math.floor(a.wz);
        for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
          const tr = w.inb(i, j) && w.tree[j * N + i]; if (!tr || tr.dead) continue;
          const c = VE.Squirrel.trunkClearance(tr, w, a.wx, a.wy, a.wz);
          if (c < minClear) minClear = c;
          if (c < -0.008) inTrunk++;
        }
      }
    }
    return { n: sqs.length, tris: Math.round(tris), clipsInModel, modes, clips, samples, inTrunk, minClear, under, inBuilding, jumps, headUp, headDown, wrongHead, nan, msPerStep: ms / 6000, src: VE.animalSource };
  });
  console.log('eekhoorns', JSON.stringify(r));
  expect(r.src).toBe('glb');
  expect(r.tris).toBeGreaterThanOrEqual(500);
  expect(r.tris).toBeLessThanOrEqual(1200);
  for (const c of ['climb', 'descend', 'jump', 'perch', 'forage', 'sit', 'walk', 'run', 'idle']) expect(r.clipsInModel).toContain(c);
  expect(r.nan).toBe(0);
  // gedrag: alles komt voor
  for (const m of ['ground', 'trunk', 'cling', 'branch', 'perch', 'jump']) expect(r.modes[m] || 0).toBeGreaterThan(0);
  for (const c of ['climb', 'descend', 'walk', 'forage', 'sit', 'perch', 'jump']) expect(r.clips[c] || 0).toBeGreaterThan(0);
  expect(r.jumps).toBeGreaterThan(5);
  // kop omhoog naar boven, kop omlaag naar beneden
  expect(r.headUp).toBeGreaterThan(0);
  expect(r.headDown).toBeGreaterThan(0);
  expect(r.wrongHead).toBe(0);
  // botsingen: nooit (merkbaar) in een stam, onder de grond of in een gebouw
  expect(r.inTrunk / r.samples).toBeLessThan(0.001);
  expect(r.minClear).toBeGreaterThan(-0.012);
  expect(r.under).toBe(0);
  expect(r.inBuilding).toBe(0);
  expect(r.msPerStep).toBeLessThan(8);
  // screenshot: een eekhoorn tegen de stam
  await page.evaluate(async () => {
    const VE = window.VE, g = VE.game, W = g.wild, a = W.list.find(x => x.key === 'squirrel' && !x.dead);
    for (const o of W.list) if (o !== a) o.dead = true;
    if (a.sq.mode === 'ground' && !VE.Squirrel.toTree(W, a, 'spawn')) return;
    // een loofboom (bij een spar verdwijnt hij tussen de naalden)
    const leafy = g.nature.trees.filter(t => !t.dead && t.growth >= 1 && /oak$|birch|beech$/.test(t.sp || ''));
    if (leafy.length) a.sq.t = leafy.reduce((b, t) => ((t.x - a.wx) ** 2 + (t.z - a.wz) ** 2 < (b.x - a.wx) ** 2 + (b.z - a.wz) ** 2 ? t : b));
    const t = a.sq.t; a.sq.mode = 'cling'; a.sq.wait = 1e9; a.sq.d = 0.25; a.sq.dir = 1;
    for (const o of g.nature.trees) if (o !== t && !o.dead && (o.x - t.x) ** 2 + (o.z - t.z) ** 2 < 6) g.nature.removeTree(o);
    for (let i = 0; i < 6; i++) { g.arriveT = 1e9; a.vis = true; g.update(0.05); }
    const c = VE.view.cam; c.tx = a.wx; c.tz = a.wz; c.ty = a.wy; c.tdist = c.dist = 1.0; c.pitch = 0.15; c.tyaw = c.yaw = a.sq.th + Math.PI / 2 - 0.4;
    document.getElementById('hud').style.visibility = 'hidden';
  });
  await page.waitForTimeout(1200);
  await shot(page, info.project.name, 'eekhoorn-klimt');
  expect(errs(errors)).toEqual([]);
});
