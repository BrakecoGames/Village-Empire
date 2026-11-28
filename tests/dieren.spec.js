// Landdieren (konijn, ree, hert, wild zwijn, vos): nieuwe Blender-modellen met knieën, oren en staart, alle clips,
// gedrag (grazen in stapjes, groepsalarm, schriksprong, liggen), botsingen (stammen, elkaar, gebouwen), contact met
// de grond op hellingen, variatie, prestaties (ver weg minder vaak bijwerken) en ingezoomde foto's per clip.
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage, shot } = require('./helpers');
const show = require('./dieren-show');

const errs = errors => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);
const LAND = ['rabbit', 'roe', 'deer', 'boar', 'fox'];

test('landdieren: modellen, clips, gedrag, botsingen, helling en prestaties', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = trackErrors(page);
  await openGame(page);
  await startNewVillage(page);
  await page.evaluate(() => window.VE.glbAllReady);
  const r = await page.evaluate(LAND => {
    const VE = window.VE, g = VE.game, W = g.wild, w = g.world, N = VE.N;
    w.explored.fill(1); w.fogDirty = true;
    const out = { src: VE.animalSource, model: {}, N };
    for (const k of LAND) {
      const A = VE.animalAssets[k];
      let tris = 0; for (const p of A.parts) tris += p.geo.attributes.position.count / 3 * p.nodes.length;
      out.model[k] = { clips: Object.keys(A.clips), nodes: A.nodes.map(n => n.name), tris: Math.round(tris) };
    }
    // simulatie: alle landdieren 'in beeld' (volledige update), rendering met de echte camera
    const land = a => LAND.indexOf(a.key) >= 0;
    let samples = 0, inTrunk = 0, overlap = 0, bad = 0, under = 0, tilted = 0, tiltErr = 0, tiltN = 0, grazeSteps = 0, nan = 0;
    const clips = {}, states = {};
    let ms = 0, steps = 0;
    for (let t = 0; t < 240; t += 0.05) {
      g.arriveT = 1e9;
      for (const a of W.list) if (land(a)) a.vis = true;
      const t0 = performance.now(); g.update(0.05); ms += performance.now() - t0; steps++;
      g.wr.render(W, null, 0.05);                                    // zonder camera: alle dieren tekenen (houding en helling)
      if (steps % 4) continue;
      const L = W.list.filter(a => !a.dead && land(a));
      for (const a of L) {
        samples++;
        if (!isFinite(a.x + a.z + (a.tp || 0) + (a.tr || 0))) { nan++; continue; }
        if (!W.passXZ(a.x, a.z) && a.state !== 'held') bad++;
        clips[a._clip] = (clips[a._clip] || 0) + 1; states[a.state] = (states[a.state] || 0) + 1;
        if (a.after === 'eat') grazeSteps++;
        const R = a.sp.R * a.sp.size * a.sc;
        const i0 = Math.floor(a.x), j0 = Math.floor(a.z);
        for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
          const tr = w.inb(i, j) && w.tree[j * N + i]; if (!tr || tr.dead || tr.growth < 0.25) continue;
          if (Math.hypot(a.x - tr.x, a.z - tr.z) < (R + 0.07 * (tr.sc || 1)) * 0.6) inTrunk++;
        }
        for (const o of L) if (o.id > a.id && Math.hypot(a.x - o.x, a.z - o.z) < (R + o.sp.R * o.sp.size * o.sc) * 0.5) overlap++;
        // helling: lijf volgt de grond (voor/achter), poten niet onder de grond
        if (a.tp !== undefined && a._clip !== 'jump') {
          const sc = a.sc * a.sp.size, Lh = a.sp.len * sc, s = Math.sin(a.rot), c = Math.cos(a.rot);
          const want = -Math.atan2(w.heightAt(a.x + s * Lh, a.z + c * Lh) - w.heightAt(a.x - s * Lh, a.z - c * Lh), 2 * Lh);
          if (Math.abs(want) > 0.06) { tiltN++; tiltErr += Math.abs(Math.max(-0.5, Math.min(0.5, want)) - a.tp); if (Math.abs(a.tp) > 0.04) tilted++; }
        }
      }
    }
    Object.assign(out, { samples, inTrunk, overlap, bad, under, nan, grazeSteps, clips, states, tiltN, tilted, tiltErr: tiltErr / Math.max(1, tiltN), msPerStep: ms / steps });
    // variatie
    const L = W.list.filter(a => !a.dead && land(a));
    out.looks = new Set(L.map(a => a.look ? a.look.map(v => v.toFixed(3)).join() : '')).size;
    out.scMin = Math.min(...L.map(a => a.sc)); out.scMax = Math.max(...L.map(a => a.sc));
    out.n = L.length; out.stags = { roe: L.filter(a => a.key === 'roe' && a.stag).length, deer: L.filter(a => a.key === 'deer' && a.stag).length };
    // groepsalarm: een groep herten schrikt, de rest volgt binnen een seconde; dieren vlakbij reageren
    const herds = {}; for (const a of L) if (a.herd) (herds[a.herd] = herds[a.herd] || []).push(a);
    const herd = Object.values(herds).filter(h => h.length >= 2).sort((x, y) => y.length - x.length)[0];
    if (herd) {
      const lead = herd[0];
      for (const a of herd) { a.state = 'eat'; a.t = 50; a.x = lead.x + (a.x - lead.x) * 0.2; a.z = lead.z + (a.z - lead.z) * 0.2; }
      W.scare(lead, lead.x + 1, lead.z);
      out.leap = lead.leapT > 0;
      for (let i = 0; i < 25; i++) { for (const a of herd) a.vis = true; g.update(0.05); }
      out.herd = herd.length; out.herdFled = herd.filter(a => a.state === 'flee' || a.state === 'alert').length;
    }
    // ver weg en buiten beeld: minder vaak bijwerken (elke 1,5 s), dichtbij buiten beeld elke 0,5 s
    const think0 = W.think, calls = new Map();
    W.think = function (a, dt) { calls.set(a, (calls.get(a) || 0) + 1); return think0.call(this, a, dt); };
    const C = g.hq ? [g.hq.cx, g.hq.cz] : [N / 2, N / 2]; W.camX = C[0]; W.camZ = C[1];
    const tick = () => { for (const a of W.list) a.vis = false; g.update(0.05); };
    for (let i = 0; i < 120; i++) { tick(); }
    W.think = think0;
    let farC = 0, farN = 0, nearC = 0, nearN = 0;
    for (const a of W.list) {
      if (a.dead || a.sp.fly || a.key === 'squirrel') continue;
      const d = Math.hypot(a.x - C[0], a.z - C[1]), c = calls.get(a) || 0;
      if (d > 45) { farC += c; farN++; } else if (d < 35) { nearC += c; nearN++; }
    }
    out.farRate = farC / Math.max(1, farN) / 6; out.nearRate = nearC / Math.max(1, nearN) / 6; out.farN = farN;
    return out;
  }, LAND);
  console.log('dieren', JSON.stringify(r));
  expect(r.src).toBe('glb');
  for (const k of LAND) {
    const m = r.model[k];
    for (const c of ['idle', 'walk', 'run', 'eat', 'alert', 'rest', 'jump']) expect(m.clips, k + ' clip ' + c).toContain(c);
    for (const n of ['shinFL', 'shinFR', 'shinBL', 'shinBR', 'earL', 'earR', 'tail1']) expect(m.nodes, k + ' node ' + n).toContain(n);
    expect(m.tris, k + ' driehoeken').toBeGreaterThan(600);
    expect(m.tris, k + ' driehoeken').toBeLessThan(2200);
  }
  expect(r.nan).toBe(0);
  expect(r.bad, 'nooit in water, op bergen of in gebouwen').toBe(0);
  expect(r.inTrunk / r.samples, 'niet door boomstammen').toBeLessThan(0.002);
  expect(r.overlap / r.samples, 'niet door elkaar').toBeLessThan(0.003);
  for (const c of ['idle', 'walk', 'eat', 'rest', 'alert']) expect(r.clips[c] || 0, 'clip ' + c).toBeGreaterThan(0);
  expect(r.grazeSteps, 'grazen in kleine stapjes').toBeGreaterThan(0);
  expect(r.tiltN, 'dieren op een helling').toBeGreaterThan(20);
  expect(r.tilted / r.tiltN, 'lijf kantelt mee met de helling').toBeGreaterThan(0.8);
  expect(r.tiltErr, 'kanteling volgt de grond').toBeLessThan(0.08);
  expect(r.looks, 'vachtvariatie').toBeGreaterThan(r.n * 0.8);
  expect(r.scMin).toBeGreaterThanOrEqual(0.85); expect(r.scMax).toBeLessThanOrEqual(1.15);
  expect(r.scMax - r.scMin).toBeGreaterThan(0.15);
  expect(r.stags.roe + r.stags.deer, 'bokken/herten met gewei').toBeGreaterThan(0);
  expect(r.herd, 'groep gevonden').toBeGreaterThan(1);
  expect(r.leap, 'schriksprong bij vluchten uit stilstand').toBe(true);
  expect(r.herdFled, 'de hele groep reageert').toBe(r.herd);
  expect(r.farN).toBeGreaterThan(5);
  // sinds de vaste ticks (fase 1): elk dier elke tick, los van de camera (deterministisch, nodig voor online spelen)
  expect(r.farRate, 'ver weg: elke tick').toBeGreaterThan(15);
  expect(r.nearRate, 'dichtbij: elke tick').toBeGreaterThan(15);
  expect(r.msPerStep).toBeLessThan(12);
  expect(errs(errors)).toEqual([]);
});

test('landdieren: ingezoomde foto\'s per clip (model en animatie)', async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await openGame(page);
  await startNewVillage(page);
  await page.evaluate(() => window.VE.glbAllReady);
  const mob = info.project.name === 'mobile';
  const run = (state, opts) => page.evaluate(`(${show.toString()})(${JSON.stringify(state)}, ${JSON.stringify(opts)})`);
  const all = { keys: ['rabbit', 'fox', 'roe', 'boar', 'deer'], gap: mob ? 0.32 : 0.5, dist: mob ? 3.6 : 2.3, pitch: 0.25, yaw: 0.3, ty: 0.08 };
  for (const [state, extra] of [['idle', {}], ['walk', {}], ['flee', {}], ['eat', {}], ['alert', {}], ['rest', { pitch: 0.35 }], ['jump', { p: 0.4 }]]) {
    await run(state, Object.assign({}, all, extra));
    if (state === 'flee' || state === 'walk') await page.evaluate(() => { for (const a of window.VE.game.wild.list) a.spd = 1e-5; });
    await page.waitForTimeout(900);
    // de clip die echt getoond wordt
    const clips = await page.evaluate(() => window.VE.game.wild.list.map(a => a._clip));
    const want = { idle: 'idle', walk: 'walk', flee: 'run', eat: 'eat', alert: 'alert', rest: 'rest', jump: 'jump' }[state];
    expect(clips.every(c => c === want), state + ': ' + clips.join()).toBe(true);
    await shot(page, info.project.name, 'dieren-' + state);
  }
  // per soort van dichtbij (zijaanzicht, beweging over twee momenten: poten wisselen echt)
  for (const k of ['rabbit', 'fox', 'roe', 'boar', 'deer']) {
    const big = k === 'deer' || k === 'roe';
    await run('walk', { keys: [k], dist: (k === 'deer' ? 1.7 : big ? 1.35 : 0.8) * (mob ? 1.7 : 1), pitch: 0.12, yaw: 0.35, ty: k === 'deer' ? 0.3 : big ? 0.22 : 0.07 });
    await page.evaluate(() => { for (const a of window.VE.game.wild.list) a.spd = 1e-5; });
    await page.waitForTimeout(700);
    const p1 = await page.evaluate(() => { const a = window.VE.game.wild.list[0]; return Array.from(a._pose); });
    await shot(page, info.project.name, 'dier-' + k);
    await page.waitForTimeout(300);
    const p2 = await page.evaluate(() => { const a = window.VE.game.wild.list[0]; return Array.from(a._pose); });
    let diff = 0; for (let i = 0; i < p1.length; i++) diff += Math.abs(p1[i] - p2[i]);
    expect(diff, k + ' beweegt (poten/kop/staart)').toBeGreaterThan(0.05);
  }
  expect(errs(errors)).toEqual([]);
});
