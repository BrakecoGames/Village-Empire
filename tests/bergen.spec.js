// Lagere bergen (generator 2): beloopbaar, bebouwbaar (plateaus), eerlijke verdeling per startplek; oude saves houden
// hun oude terrein. Steenmijn: alleen op bergen, raakt nooit op, lokale opslag 6, vroeg genoeg te bouwen, levert
// tijdens een lange sessie steen. Wachttorens op bergen: bouwers en dragers komen er, hoger = verder ontdekken.
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage, shot } = require('./helpers');

const errs = errors => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);

async function setup(page) {
  await page.evaluate(() => {
    const VE = window.VE, g = VE.game, N = VE.N;
    window.T = {
      // plek voor `t` dicht bij `near` met een bereikbare deur; filter(i, j) mag extra eisen stellen
      place(t, near, filter, done) {
        const hq = g.hq, sz = VE.DEFS[t].size || 1; let best = null, bd = 1e9;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          const d = Math.hypot(i - near[0], j - near[1]); if (d >= bd) continue;
          if (!g.canPlace(t, i, j, true).ok || (filter && !filter(i, j))) continue;
          if (!g.pf.find(hq.doorK, (j + sz) * N + i + (sz > 1 ? 1 : 0))) continue;
          bd = d; best = [i, j];
        }
        if (!best) return null;
        const b = g.placeBuilding(t, best[0], best[1], done !== false);
        if (b && b.accept) g.setAccept(b, '*', true);
        return b;
      },
      run(sec, each) { for (let t = 0; t < sec; t += 0.1) { g.arriveT = 1e9; g.update(0.1); if (each) each(t); } }
    };
  });
}

test.describe('Bergen, steen en wachttorens', () => {
  test('lagere bergen: beloopbaar, plateaus om op te bouwen, eerlijke verdeling, oude saves ongewijzigd', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await page.evaluate(() => window.VE.glbAllReady);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, N = VE.N, hq = g.hq;
      const out = { gen: w.gen, N };
      // bergtegels (zonder vulkaan): hoogte, steilte, bebouwbaar
      let mt = 0, maxH = 0, steep = 0, flat = 0;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = j * N + i; if (w.type[k] !== 2 || w.volc[k]) continue;
        mt++; maxH = Math.max(maxH, w.tileH(i, j)); const s = w.slope(i, j);
        if (s > 1.6) steep++; if (s <= 0.95) flat++;
      }
      Object.assign(out, { mt, maxH, steep: steep / mt, flat: flat / mt });
      // bereikbaarheid vanaf de deur van het dorpshuis (8 richtingen, zoals de padzoeker)
      const seen = new Uint8Array(N * N), q = [hq.doorK]; seen[hq.doorK] = 1;
      const ok = k => w.walkable(k);
      while (q.length) {
        const c = q.pop(), ci = c % N, cj = (c / N) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const i = ci + di, j = cj + dj; if (!w.inb(i, j)) continue;
          const k = j * N + i; if (seen[k] || !ok(k)) continue;
          if (di && dj && (!ok(cj * N + i) || !ok(j * N + ci))) continue;
          seen[k] = 1; q.push(k);
        }
      }
      let mw = 0, mr = 0;
      for (let k = 0; k < N * N; k++) if (w.type[k] === 2 && !w.volc[k] && ok(k)) { mw++; if (seen[k]) mr++; }
      out.mountReach = mr / mw;
      // padzoeker: naar 25 willekeurige plateautegels in en rond het eigen gebied
      const rnd = VE.rng(42); let pfOk = 0, pfN = 0;
      for (let t = 0; t < 4000 && pfN < 25; t++) {
        const i = Math.floor(rnd() * N), j = Math.floor(rnd() * N), k = j * N + i;
        if (w.type[k] !== 2 || w.volc[k] || !ok(k) || w.slope(i, j) > 0.95 || Math.hypot(i - hq.cx, j - hq.cz) > 45) continue;
        pfN++; if (g.pf.find(hq.doorK, k)) pfOk++;
      }
      out.pf = [pfOk, pfN];
      // per startplek: rotsblokken, erts, bebouwbare bergtegels en steenmijnplekken
      out.starts = VE.worldStats(g, 22).map(o => ({ rocks: o.rocks, ore: o.ore, build: o.build }));
      out.plat = w.starts.map(s => { let p = 0, m = 0; for (let j = s.j - 20; j <= s.j + 20; j++) for (let i = s.i - 20; i <= s.i + 20; i++) {
        if (!w.inb(i, j) || Math.hypot(i - s.i, j - s.j) > 20) continue; const k = j * N + i; if (w.type[k] !== 2) continue;
        if (w.slope(i, j) <= 0.95 && !w.rock[k] && !w.tree[k]) p++; if (VE.Mining.mineSpot(w, i, j)) m++; } return { p, m }; });
      // opslaan en laden: zelfde terrein; een save zonder generatorversie (van vóór deze versie) krijgt het oude terrein
      const sv = JSON.parse(JSON.stringify(g.serialize()));
      out.savedG = sv.g;
      const a = new VE.Game(VE.view.scene); a.init(sv);
      let same = true; for (let v = 0; v < w.H.length; v += 7) if (Math.abs(a.world.H[v] - w.H[v]) > 1e-6) { same = false; break; }
      out.sameTerrain = same; out.sameBuildings = a.buildings.length === g.buildings.length; a.dispose();
      const old = JSON.parse(JSON.stringify(sv)); delete old.g;
      const o = new VE.Game(VE.view.scene); o.init(old);
      let oMax = 0; for (let k = 0; k < N * N; k++) if (o.world.type[k] === 2 && !o.world.volc[k]) oMax = Math.max(oMax, o.world.tileH(k % N, (k / N) | 0));
      out.oldGen = o.world.gen; out.oldMax = oMax; out.oldHq = !!o.hq; o.dispose();
      return out;
    });
    console.log('bergen', JSON.stringify(r));
    expect(r.gen).toBe(2);
    expect(r.maxH, 'bergen lager').toBeLessThan(7);
    expect(r.steep, 'vrijwel nergens te steil').toBeLessThan(0.01);
    expect(r.flat, 'veel bebouwbare bergtegels (plateaus)').toBeGreaterThan(0.6);
    expect(r.mountReach, 'bergen bereikbaar').toBeGreaterThan(0.97);
    expect(r.pf[0]).toBe(r.pf[1]);
    expect(r.pf[1]).toBeGreaterThan(10);
    for (const s of r.starts) {
      expect(s.rocks, 'natuursteen bij elke start').toBeGreaterThan(80);
      for (const t of ['1', '2', '3', '4']) expect(s.ore[t] || 0, 'erts ' + t).toBeGreaterThan(50);
    }
    const ps = r.plat.map(p => p.p), ms = r.plat.map(p => p.m);
    expect(Math.min(...ps), 'plateaus bij elke start').toBeGreaterThan(80);
    expect(Math.min(...ms), 'steenmijnplekken bij elke start').toBeGreaterThan(80);
    expect(Math.min(...r.starts.map(s => s.rocks)) / Math.max(...r.starts.map(s => s.rocks)), 'eerlijk verdeeld').toBeGreaterThan(0.75);
    expect(r.savedG).toBe(2);
    expect(r.sameTerrain && r.sameBuildings).toBe(true);
    expect(r.oldGen, 'oude save: oude generator').toBe(1);
    expect(r.oldMax, 'oude save: oude (hoge) bergen').toBeGreaterThan(r.maxH);
    expect(r.oldHq).toBe(true);
    expect(errs(errors)).toEqual([]);
  });

  test('bouwen op de berg en wachttoren op hoogte: bouwers en dragers komen er, hoger = verder zicht', async ({ page }, info) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await page.evaluate(() => window.VE.glbAllReady);
    await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, N = VE.N, hq = g.hq;
      g.rank = 1; w.owned.fill(1);
      for (let n = 0; n < 8; n++) g.spawnSettler();
      g.stock.plank = 60; g.stock.stone = 40; g.stock.log = 20; g.gold = 400;
      const onMountain = (i, j) => w.type[j * N + i] === 2;
      const house = T.place('house', [hq.cx + 6, hq.cz], onMountain, false);
      // wachttoren op het hoogste bebouwbare plekje binnen 30 tegels, en een op vlak land
      let hi = null, hv = -1;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        if (Math.hypot(i - hq.cx, j - hq.cz) > 30 || !onMountain(i, j) || !g.canPlace('tower', i, j, true).ok) continue;
        const v = g.towerView(i + 0.5, j + 0.5); if (v > hv && g.pf.find(hq.doorK, (j + 1) * N + i)) { hv = v; hi = [i, j]; }
      }
      const why = g.canPlace('tower', hi[0], hi[1]).why;
      const tHigh = g.placeBuilding('tower', hi[0], hi[1], false);
      const tLow = T.place('tower', [hq.cx - 7, hq.cz + 4], (i, j) => w.type[j * N + i] !== 2 && w.tileH(i, j) < 1.2, false);
      const t0 = { house: [house.i, house.j], high: hi, view: hv, why: why, startBuilt: [house.built, tHigh.built, tLow.built] };
      let builtAt = {};
      T.run(500, t => { for (const [n, b] of [['house', house], ['high', tHigh], ['low', tLow]]) if (b.built && builtAt[n] === undefined) builtAt[n] = Math.round(t); });
      // ontdekt: tot hoe ver rond elke toren (eerst alles weer onontdekt maken, dan de torens laten kijken)
      const reach = b => {
        const others = g.buildings.filter(o => o !== b && o.alive && o.built && o.def.territory);
        for (const o of others) o.built = false;
        w.explored.fill(0); g.updateTerritory(true);
        let m = 0; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (w.explored[j * N + i] >= 0.99) m = Math.max(m, Math.hypot(i + 0.5 - b.cx, j + 0.5 - b.cz));
        for (const o of others) o.built = true;
        g.updateTerritory(true);
        return m;
      };
      return Object.assign(t0, { builtAt, onM: [house.built, tHigh.built, tLow.built], hType: w.type[house.j * N + house.i], reachHigh: reach(tHigh), reachLow: reach(tLow), viewLow: g.towerView(tLow.cx, tLow.cz) });
    });
    console.log('toren', JSON.stringify(r));
    expect(r.hType, 'huis staat op de berg').toBe(2);
    expect(r.onM, 'huis en torens gebouwd (bouwers en dragers bereikten de berg)').toEqual([true, true, true]);
    expect(r.view, 'hoge toren kijkt verder').toBeGreaterThan(2);
    expect(r.why).toMatch(/High ground: sees \d+ tiles further/);
    expect(r.startBuilt, 'begonnen als bouwplaats').toEqual([false, false, false]);
    expect(r.viewLow, 'vlak land: geen extra zicht').toBeLessThan(0.5);
    expect(r.reachHigh - r.reachLow, 'hoge toren ontdekt een groter gebied').toBeGreaterThan(r.view - 1.5);
    // foto: huis en toren op de berg
    await page.evaluate(h => {
      const VE = window.VE, c = VE.view.cam; c.tx = h[0] + 0.5; c.tz = h[1] + 0.5; c.ty = VE.game.world.heightAt(c.tx, c.tz); c.tdist = c.dist = 12; c.pitch = 0.6; c.tyaw = c.yaw = 0.5;
      VE.game.world.explored.fill(1); VE.game.world.fogDirty = true; document.getElementById('hud').style.visibility = 'hidden';
    }, r.high);
    await page.waitForTimeout(1500);
    await shot(page, info.project.name, 'berg-toren');
    expect(errs(errors)).toEqual([]);
  });

  test('steenmijn: alleen op de berg, vroeg te bouwen, raakt nooit op en levert steen in een lange sessie', async ({ page }, info) => {
    test.setTimeout(300_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await page.evaluate(() => window.VE.glbAllReady);
    await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, N = VE.N, hq = g.hq, D = VE.DEFS.stonemine;
      const out = { rank: D.rank, cost: D.cost, quest: VE.RANKS[1].quests.some(q => q.b === 'stonemine'), unlock: VE.RANKS[1].unlock.indexOf('stonemine') >= 0 };
      // al bij de start een plek binnen de grenzen (vóór de natuursteen op is)
      let inTerr = 0; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (g.canPlace('stonemine', i, j, true).ok) inTerr++;
      out.spotsAtStart = inTerr;
      // bouwregels
      let grass = null; for (let j = hq.j + 3; j < N && !grass; j++) for (let i = hq.i - 4; i < hq.i + 4; i++) if (w.owned[j * N + i] && w.type[j * N + i] === 0 && !w.bld[j * N + i] && !w.rock[j * N + i] && !w.tree[j * N + i]) { grass = [i, j]; break; }
      out.onGrass = g.canPlace('stonemine', grass[0], grass[1], true).why;
      g.rank = 1; w.owned.fill(1);
      for (let n = 0; n < 10; n++) g.spawnSettler();
      g.stock.plank = 40; g.stock.log = 20;
      const st = T.place('warehouse', [hq.cx + 4, hq.cz + 4]);
      const m = T.place('stonemine', [hq.cx, hq.cz]);
      out.why = null; for (let j = 0; j < N && !out.why; j++) for (let i = 0; i < N; i++) { const c = g.canPlace('stonemine', i, j, true); if (c.ok) { out.why = c.why; break; } }
      out.mineOnMountain = w.type[m.j * N + m.i] === 2;
      // natuursteen: alle rotsblokken binnen 6 tegels van het dorpshuis weg (alsof ze op zijn): de mijn moet het overnemen
      for (const rk of g.nature.rocks.slice()) if (!rk.dead && Math.hypot(rk.x - hq.cx, rk.z - hq.cz) < 30 && g.nature.removeRock) g.nature.removeRock(rk);
      const stone0 = g.stats.produced.stone || 0;
      let maxOut = 0, empty = 0, stoneAt = [], used = 0;
      // 25 minuten speeltijd
      T.run(1500, t => {
        maxOut = Math.max(maxOut, g.outTotal(m));
        if (st.store.stone >= 40) { used += st.store.stone; st.store.stone = 0; g.sd = true; }   // verbouwd in het dorp
        if (/used up|No solid rock/.test(m.status || '')) empty++;
        if (Math.abs(t % 300) < 0.05) stoneAt.push((g.stats.produced.stone || 0) - stone0);
      });
      out.built = m.built; out.produced = (g.stats.produced.stone || 0) - stone0; out.maxOut = maxOut; out.empty = empty; out.stoneAt = stoneAt;
      out.status = m.status; out.inStore = ((st.store && st.store.stone) || 0) + used;
      // infopaneel
      VE.ui.select(m); out.panel = document.getElementById('infoPanel').innerText;
      return out;
    });
    console.log('steenmijn', JSON.stringify(r));
    expect(r.rank, 'Village (vóór de natuursteen op is)').toBe(1);
    expect(r.cost.stone || 0, 'kost geen steen').toBe(0);
    expect(r.unlock && r.quest).toBe(true);
    expect(r.spotsAtStart, 'al binnen de startgrenzen een plek').toBeGreaterThan(0);
    expect(r.onGrass).toBe('Mines can only be built on the mountain');
    expect(r.mineOnMountain).toBe(true);
    expect(r.why).toMatch(/never runs out/);
    expect(r.built).toBe(true);
    expect(r.maxOut, 'lokale opslag max. 6').toBeLessThanOrEqual(6);
    expect(r.empty, 'raakt nooit op').toBe(0);
    expect(r.produced, 'levert steen in een lange sessie').toBeGreaterThan(120);
    // gelijkmatig: in elk blok van 5 minuten na de bouw komt er steen bij
    for (let i = 2; i < r.stoneAt.length; i++) expect(r.stoneAt[i]).toBeGreaterThan(r.stoneAt[i - 1]);
    expect(r.inStore, 'dragers brengen het naar de opslag').toBeGreaterThan(20);
    expect(r.panel).toMatch(/never runs out/);
    await page.evaluate(() => { const VE = window.VE, b = VE.game.buildings.find(x => x.type === 'stonemine'), c = VE.view.cam; c.tx = b.cx; c.tz = b.cz; c.tdist = c.dist = 4; c.pitch = 0.55; c.tyaw = c.yaw = 0.4; VE.game.world.explored.fill(1); VE.game.world.fogDirty = true; });
    await page.waitForTimeout(1500);
    await shot(page, info.project.name, 'steenmijn');
    expect(errs(errors)).toEqual([]);
  });
});
