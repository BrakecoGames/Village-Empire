// Eilandwereld (generator 3) en Fog of War: eiland rondom in zee, vulkaan in het midden, afwisselende kust
// (stranden, kliffen, rotspilaren, baaien voor latere havens), eerlijke startplekken voor drie spelers, oude saves
// ongewijzigd. Mist: horizontale laag die alles verbergt (canyon, brug, rivieren, grondstoffen, bomen), alleen
// de vulkaantop steekt erboven uit, zachte wolkenbank bij het ontdekte land. Foto's uit meerdere hoeken en zoomniveaus.
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage, shot } = require('./helpers');

const errs = errors => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);

test.describe('Eiland en mist', () => {
  test('eiland: zee rondom, kust, vulkaan in het midden, eerlijke starts, oude saves', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, N = VE.N, F = w.features.volcano, I = w.island;
      const out = { gen: w.gen, N, island: !!I };
      let border = 0, land = 0, sea = 0, beach = 0, cliff = 0, stacks = 0;
      for (let k = 0; k < N * N; k++) {
        const t = w.type[k], i = k % N, j = (k / N) | 0;
        if ((i === 0 || j === 0 || i === N - 1 || j === N - 1) && t !== 1) border++;
        if (w.sea[k]) sea++; else if (t !== 1) land++;
        if (t === 3) beach++;
        if (t === 4 && w.volc[k] === 5) cliff++;
        if (t === 2 && w.volc[k] === 5) stacks++;
      }
      Object.assign(out, { border, landFrac: land / (N * N), seaFrac: sea / (N * N), beach, cliff, stacks });
      out.volcCenter = Math.hypot(F.x - N / 2, F.z - N / 2);
      // per start: land rondom, afstand tot de kust (zee), baai bereikbaar
      const coastD = s => { let best = 1e9; for (let k = 0; k < N * N; k++) if (w.sea[k]) best = Math.min(best, Math.hypot(k % N + 0.5 - s.i - 1, ((k / N) | 0) + 0.5 - s.j - 1)); return best; };
      out.starts = w.starts.map((s, n) => {
        let landN = 0; for (let j = s.j - 30; j <= s.j + 30; j++) for (let i = s.i - 30; i <= s.i + 30; i++) if (w.inb(i, j) && Math.hypot(i - s.i, j - s.j) <= 30 && w.type[j * N + i] !== 1) landN++;
        const hb = I.harbors[n];
        return { land: landN, coast: Math.round(coastD(s)), harbor: hb ? +Math.hypot(hb.bx - s.i - 1, hb.bz - s.j - 1).toFixed(1) : -1, toBay: hb ? Math.round(Math.hypot(hb.x - hb.bx, hb.z - hb.bz)) : 99, volc: Math.round(Math.hypot(F.x - s.i - 1, F.z - s.j - 1)) };
      });
      // de eigen baai is te voet bereikbaar vanaf het dorpshuis
      const hb0 = I.harbors[0]; out.harborPath = !!g.pf.find(g.hq.doorK, hb0.j * N + hb0.i);
      // zwavel blijft rond de vulkaan, onder de mist
      const S = w.deposits.filter(d => d.type === 6);
      out.sulfur = S.length; out.sulfurBelow = Math.max(...S.map(d => w.heightAt(d.x, d.z))) < w.fogTop - 0.6;
      let peak = 0; for (const v of w.H) peak = Math.max(peak, v);
      out.peak = peak; out.fogTop = w.fogTop;
      // niets anders dan de vulkaantop boven de mist
      let above = 0; for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) if (Math.hypot(x - F.x, z - F.z) > F.r * 0.6 && w.H[z * (N + 1) + x] > w.fogTop - 1.0) above++;
      out.above = above;
      // opslaan/laden: generator 3 blijft; een save van generator 2 houdt zijn wereld (geen eiland)
      const sv = JSON.parse(JSON.stringify(g.serialize())); out.savedG = sv.g;
      const a = new VE.Game(VE.view.scene); a.init(sv); out.reload = { island: !!a.world.island, same: a.world.H.every((v, q) => Math.abs(v - w.H[q]) < 1e-6) }; a.dispose();
      const o = JSON.parse(JSON.stringify(sv)); o.g = 2;
      const b = new VE.Game(VE.view.scene); b.init(o); let bl = 0; for (let i = 0; i < N; i++) if (b.world.type[i] !== 1) bl++; out.old = { island: !!b.world.island, gen: b.world.gen, borderLand: bl }; b.dispose();
      return out;
    });
    console.log('eiland', JSON.stringify(r));
    expect(r.gen).toBe(3);
    expect(r.island).toBe(true);
    expect(r.border, 'rondom zee, geen land aan de kaartrand').toBe(0);
    expect(r.landFrac).toBeGreaterThan(0.45); expect(r.landFrac).toBeLessThan(0.8);
    expect(r.seaFrac).toBeGreaterThan(0.2);
    expect(r.beach, 'stranden').toBeGreaterThan(150);
    expect(r.cliff, 'kliffen').toBeGreaterThan(50);
    expect(r.stacks, 'rotspilaren').toBeGreaterThan(5);
    expect(r.volcCenter, 'vulkaan in het midden').toBeLessThan(2);
    for (const s of r.starts) {
      expect(s.land, 'genoeg land rond elke start').toBeGreaterThan(2400);
      expect(s.coast, 'zee niet te dichtbij').toBeGreaterThan(12);
      expect(s.harbor, 'eigen baai').toBeGreaterThan(0);
      expect(s.toBay, 'havenplek in de baai').toBeLessThanOrEqual(14);
    }
    const spread = k => Math.max(...r.starts.map(s => s[k])) - Math.min(...r.starts.map(s => s[k]));
    expect(spread('volc'), 'even ver van de vulkaan').toBeLessThanOrEqual(2);
    expect(spread('harbor'), 'baai even ver van elke start').toBeLessThanOrEqual(1.5);
    expect(spread('coast'), 'kust even ver (tegelraster bij gedraaide vormen)').toBeLessThanOrEqual(6);
    expect(Math.min(...r.starts.map(s => s.land)) / Math.max(...r.starts.map(s => s.land))).toBeGreaterThan(0.95);
    expect(r.harborPath, 'baai te voet bereikbaar').toBe(true);
    expect(r.sulfur).toBe(36);
    expect(r.sulfurBelow, 'zwavel onder de mist').toBe(true);
    expect(r.peak - r.fogTop, 'vulkaantop steekt ver boven de mist uit').toBeGreaterThan(4);
    expect(r.above, 'niets anders boven de mist').toBe(0);
    expect(r.savedG).toBe(3);
    expect(r.reload).toEqual({ island: true, same: true });
    expect(r.old.island).toBe(false);
    expect(r.old.gen).toBe(2);
    expect(errs(errors)).toEqual([]);
  });

  test('mist: horizontaal, verbergt alles behalve de vulkaantop, zachte rand bij het ontdekken', async ({ page }, info) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await page.evaluate(() => Promise.all([window.VE.glbAllReady, window.VE.sulfurReady]));
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, N = VE.N, V1 = N + 1, F = w.features.volcano;
      const pa = w.fog.geometry.attributes.position.array, fa = w.fog.geometry.attributes.fogA.array;
      const fogY = (x, z) => { const i = Math.min(N - 1, Math.floor(x)), j = Math.min(N - 1, Math.floor(z)), fx = x - i, fz = z - j;
        const y = v => pa[v * 3 + 1], a = j * V1 + i; return (y(a) * (1 - fx) + y(a + 1) * fx) * (1 - fz) + (y(a + V1) * (1 - fx) + y(a + V1 + 1) * fx) * fz; };
      const hidden = (x, z, top) => w.explored[Math.floor(z) * N + Math.floor(x)] < 0.05 && top < fogY(x, z) - 0.05;
      const unexp = (x, z) => w.explored[Math.floor(z) * N + Math.floor(x)] < 0.05 && w.fogD[Math.floor(z) * V1 + Math.floor(x)] > 8;
      const out = { top: w.fogTop };
      // horizontaal: in onontdekt land (verder dan de wolkenbank) ligt de mist overal even hoog
      let ys = []; for (let v = 0; v < V1 * V1; v++) if (w.fogD[v] > 8) ys.push(pa[v * 3 + 1]);
      out.flat = Math.max(...ys) - Math.min(...ys);
      // verborgen onder de mist: canyon, brug, rivieren, zwavel, rotsen, bomen, landmarks
      // de vulkaantop (binnen 0,6 × de straal, met zijn stoomgaten) mag zichtbaar zijn: niet meetellen
      const chk = (list, top) => { let n = 0, bad = 0; for (const [x, z] of list) { if (!unexp(x, z) || Math.hypot(x - F.x, z - F.z) < F.r * 0.6) continue; n++; if (!hidden(x, z, top(x, z))) bad++; } return [n, bad]; };
      const Fe = w.features;
      out.canyon = chk(Fe.canyon.map(p => [p[0], p[1]]).filter(p => w.inb(Math.floor(p[0]), Math.floor(p[1]))), (x, z) => Math.max(w.heightAt(x, z), 3.4));
      out.bridge = chk(Fe.bridge.tiles.map(k => [k % N + 0.5, ((k / N) | 0) + 0.5]), () => Fe.bridge.deck + 0.6);
      out.rivers = chk(Fe.rivers.flat().filter(p => w.inb(Math.floor(p[0]), Math.floor(p[1]))), () => 0.3);
      out.sulfur = chk(w.deposits.filter(d => d.type === 6).map(d => [d.x, d.z]), (x, z) => w.heightAt(x, z) + 0.25);
      out.ores = chk(w.deposits.filter(d => d.type !== 6).map(d => [d.x, d.z]), (x, z) => w.heightAt(x, z) + 0.3);
      out.rocks = chk(g.nature.rocks.filter(q => !q.dead).map(q => [q.x, q.z]), (x, z) => w.heightAt(x, z) + 0.5);
      out.trees = chk(g.nature.trees.filter(t => !t.dead).map(t => [t.x, t.z]), (x, z) => w.heightAt(x, z) + 1.4);
      out.landmarks = chk((g.landmarks || []).map(L => [L.x, L.z]), (x, z) => w.heightAt(x, z) + 1.2);
      // vulkaantop: boven de mist en apart getekend (zonder afstandsnevel)
      out.peakVisible = !!w.peak && w.peak.visible && w.heightAt(F.x + 4, F.z) > w.fogTop + 2;
      // zachte rand: van ontdekt naar onontdekt loopt de mist geleidelijk op (geen muur)
      const hq = g.hq; let prev = -1, steps = [], maxStep = 0;
      for (let d = 0; d < 30; d++) { const x = Math.round(hq.cx + d), z = Math.round(hq.cz); const y = pa[(z * V1 + x) * 3 + 1]; if (prev >= 0) maxStep = Math.max(maxStep, y - prev); prev = y; steps.push(+y.toFixed(2)); }
      out.maxStep = maxStep; out.profile = steps;
      // ontdekken: een plek onthullen laat de mist daar zakken en verdwijnen
      const tx = Math.round(hq.cx + 26), tz = Math.round(hq.cz), v = tz * V1 + tx, before = [pa[v * 3 + 1], fa[v]];
      const t0 = performance.now(); w.reveal(tx, tz, 6); w.updateFog(); out.fogMs = performance.now() - t0;
      out.reveal = { before: before.map(q => +q.toFixed(2)), after: [+pa[v * 3 + 1].toFixed(2), +fa[v].toFixed(2)] };
      return out;
    });
    console.log('mist', JSON.stringify(r));
    expect(r.flat, 'mistlaag horizontaal').toBeLessThan(0.01);
    for (const k of ['canyon', 'bridge', 'rivers', 'sulfur', 'ores', 'rocks', 'trees', 'landmarks']) {
      expect(r[k][0], k + ' getest').toBeGreaterThan(k === 'landmarks' || k === 'bridge' ? 0 : 3);
      expect(r[k][1], k + ' verborgen onder de mist').toBe(0);
    }
    expect(r.peakVisible, 'vulkaantop boven de mist').toBe(true);
    expect(r.maxStep, 'geen muur: geleidelijke wolkenbank').toBeLessThan(1.6);
    expect(r.reveal.after[1], 'mist verdwijnt bij ontdekken').toBeLessThan(0.05);
    expect(r.reveal.after[0]).toBeLessThan(r.reveal.before[0]);
    expect(r.fogMs, 'mist bijwerken is snel').toBeLessThan(60);
    // foto's: verschillende camerahoeken en zoomniveaus (aan het begin: alleen het eigen land en de vulkaantop)
    const look = (o) => page.evaluate(o => {
      const VE = window.VE, g = VE.game, F = g.world.features.volcano, hq = g.hq, c = VE.view.cam;
      const t = o.toward || 0; c.tx = VE.lerp(hq.cx, F.x, t); c.tz = VE.lerp(hq.cz, F.z, t);
      c.tdist = c.dist = o.dist; c.pitch = o.pitch; c.tyaw = c.yaw = o.yaw !== undefined ? o.yaw : Math.atan2(hq.cx - F.x, hq.cz - F.z);
      document.getElementById('hud').style.visibility = 'hidden';
    }, o);
    for (const [name, o] of [['eiland-start', { dist: 17, pitch: 0.9 }], ['eiland-dichtbij', { dist: 8, pitch: 0.6 }], ['eiland-laag-naar-vulkaan', { dist: 45, pitch: 0.42, toward: 0.45 }],
      ['eiland-uitgezoomd', { dist: 58, pitch: 1.2 }], ['eiland-vulkaan', { dist: 50, pitch: 0.42, toward: 1 }], ['eiland-zijkant', { dist: 30, pitch: 0.5, yaw: 1.2 }]]) {
      await look(o); await page.waitForTimeout(1300); await shot(page, info.project.name, name);
    }
    // alles ontdekt: de kust (stranden, kliffen, rotspilaren, schuim) en de baai
    await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, h = w.island.harbors[0], c = VE.view.cam;
      w.explored.fill(1); w.fogDirty = true; c.tx = h.x; c.tz = h.z; c.tdist = c.dist = 22; c.pitch = 0.6; c.tyaw = c.yaw = Math.atan2(h.x - w.island.x, h.z - w.island.z);
    });
    await page.waitForTimeout(1800);
    await shot(page, info.project.name, 'eiland-kust-baai');
    await page.evaluate(() => { const VE = window.VE, w = VE.game.world, c = VE.view.cam; let best = null, bd = -1; for (let k = 0; k < VE.N * VE.N; k++) if (w.type[k] === 4 && w.volc[k] === 5) { best = k; break; } c.tx = best % VE.N; c.tz = (best / VE.N) | 0; c.tdist = c.dist = 14; c.pitch = 0.5; });
    await page.waitForTimeout(1500);
    await shot(page, info.project.name, 'eiland-klif');
    expect(errs(errors)).toEqual([]);
  });

  test('prestaties: eiland, zee en mist', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await page.evaluate(() => window.VE.glbAllReady);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, R = VE.view.renderer, c = VE.view.cam;
      c.tdist = c.dist = 58; c.pitch = 0.7; c.update(0); VE.view.camera.updateMatrixWorld(true);
      R.render(VE.view.scene, VE.view.camera);
      const t0 = performance.now(); for (let i = 0; i < 5; i++) R.render(VE.view.scene, VE.view.camera); const draw = (performance.now() - t0) / 5;
      const t1 = performance.now(); for (let i = 0; i < 40; i++) { w.reveal(g.hq.cx + i, g.hq.cz, 5); w.updateFog(); } const fog = (performance.now() - t1) / 40;
      const t2 = performance.now(); for (let i = 0; i < 20; i++) g.update(0.05); const sim = (performance.now() - t2) / 20;
      return { draw, fog, sim, calls: R.info.render.calls, tris: R.info.render.triangles };
    });
    console.log('prestaties', JSON.stringify(r));
    expect(r.fog, 'mist bijwerken').toBeLessThan(25);
    expect(r.sim).toBeLessThan(8);
    expect(r.calls).toBeLessThan(160);
    expect(errs(errors)).toEqual([]);
  });
});
