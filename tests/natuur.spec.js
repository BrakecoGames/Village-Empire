// Natuur: Blender-bomen (soorten), gras, bloemen, struiken, details, wind en easter eggs.
const { test, expect } = require('@playwright/test');
const { trackErrors, checkErrors, openGame, startNewVillage, shot } = require('./helpers');

/* Bouwt in de pagina een losse wereld met een vaste seed (zoals Game.init) en geeft de bomen en
   rotsen terug. withGlb=false bootst de oude situatie na (geen Blender-natuur). */
async function worldFor(page, seed, withGlb) {
  return page.evaluate(([seed, withGlb]) => {
    const VE = window.VE, keep = VE.natureGeo;
    if (!withGlb) VE.natureGeo = null;
    try {
      const rand = VE.rng(seed ^ 0x5bd1e995), root = new THREE.Group();
      const w = new VE.World(seed, root); w.generate(); w.buildMeshes(); w.buildDecor(rand);
      const nat = new VE.Nature(w, root); nat.populate(rand);
      const s = nat.serialize();
      return { t: JSON.stringify(s.t), r: JSON.stringify(s.r), trees: s.t.length, veg: !!w.veg };
    } finally { VE.natureGeo = keep; }
  }, [seed, withGlb]);
}

test.describe('Natuur', () => {
  test('soorten, vegetatie, eggs, bouwen/paden en opslaan', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'logica: alleen desktop');
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, nat = g.nature, v = w.veg, N = VE.N;
      const pools = {}; for (const n in nat.pools) pools[n] = nat.pools[n].used - nat.pools[n].free.length;
      const st = v.stats();
      // bouwen: decoratie verdwijnt op de bouwtegels
      const hq = g.hq; let spot = null;
      for (let rr = 3; rr < 12 && !spot; rr++) for (let j = hq.j - rr; j <= hq.j + rr && !spot; j++) for (let i = hq.i - rr; i <= hq.i + rr && !spot; i++)
        if (g.canPlace('house', i, j).ok && v.items[j * N + i]) spot = [i, j];
      g.rank = VE.RANKS.length - 1; g.gold = 1e6;
      const b = g.placeBuilding('house', spot[0], spot[1], true);
      const cleared = !v.items[b.j * N + b.i];
      // pad: na het uitlopen groeien er bloemen/plantjes langs
      let pathK = null;
      for (let jj = 6; jj < 12 && pathK === null; jj++) for (let i = hq.i - 8; i < hq.i + 8 && pathK === null; i++) { const k = (hq.j + jj) * N + i; if (g.freeTile(k) && g.freeTile(k + 1) && g.freeTile(k + 2) && g.freeTile(k - N) && g.freeTile(k + N) && [k - N, k + N, k + 1 - N, k + 1 + N].every(q => w.type[q] === 0)) pathK = k; }   // op gras (op rots groeien geen bloemen)
      for (const k of [pathK, pathK + 1, pathK + 2]) { w.road[k] = 2; w.wear[k] = 99; w.clearDeco(k); }
      w.rebuildRoads();
      const edge = [pathK - N, pathK + N, pathK + 1 - N, pathK + 1 + N].filter(k => v.edge[k] && v.edge[k].length).length;
      const onPath = [pathK, pathK + 1, pathK + 2].some(k => (v.items[k] && v.items[k].length) || (v.edge[k] && v.edge[k].length));
      // jonge boom → volwassen model; omhakken haalt hem uit zijn soort-pool
      let tk = null; for (let rr = 4; rr < 14 && tk === null; rr++) for (let i = hq.i - rr; i <= hq.i + rr && tk === null; i++) { const k = (hq.j - rr) * N + i; if (g.freeTile(k) && w.type[k] === 0) tk = k; }
      const t = nat.addTree(tk % N, (tk / N) | 0, 0, 0.04);
      const youngSp = t.sp;
      t.growth = 1; nat.setTreeM(t); nat.update(0, 1);
      const adultSp = t.sp;
      const before = nat.pools[adultSp].used - nat.pools[adultSp].free.length;
      nat.fellTree(t); for (let n = 0; n < 60; n++) nat.update(0.05, 1);
      // sinds de nieuwe houthakcyclus blijft de boom liggen tot hij in stukken gehakt wordt (buckTree)
      if (t.landed) nat.removeLog(nat.buckTree(t));
      const after = nat.pools[adultSp].used - nat.pools[adultSp].free.length;
      // wind: één gedeelde shader voor alle planten (geen mixers)
      const windMats = new Set(); g.root.traverse(o => { if (o.isInstancedMesh && o.material && /wind_/.test(o.material.customProgramCacheKey ? o.material.customProgramCacheKey() : '')) windMats.add(o.material.customProgramCacheKey()); });
      const allColor = (() => { let ok = true; g.root.traverse(o => { if (o.isInstancedMesh && /^(veg_|tree_)/.test(o.name) && (!o.instanceColor || !o.instanceColor.array.length)) ok = false; }); return ok; })();
      return { src: VE.natureSource, pools, st, cleared, edge, onPath, youngSp, adultSp, felled: before - after, windMats: windMats.size, allColor,
        decoF: w.decoF.filter(Boolean).length };
    });
    console.log('natuur:', JSON.stringify({ pools: r.pools, total: r.st.total, drawCalls: r.st.drawCalls }));
    expect(r.src).toBe('glb');
    const species = Object.keys(r.pools).filter(n => r.pools[n] > 0 && !/bird|logo/.test(n));
    expect(species.length, 'boomsoorten in de wereld: ' + species.join(', ')).toBeGreaterThanOrEqual(9);
    expect(r.st.total, 'decoratieve planten').toBeGreaterThan(8000);
    expect(r.st.drawCalls, 'draw calls vegetatie').toBeLessThanOrEqual(26);
    for (const k of ['grass_short', 'grass_mid', 'grass_tall', 'grass_bloom', 'weed', 'fl_daisy', 'fl_poppy', 'fl_yellow', 'fl_purple', 'fl_mix',
      'bush_round', 'bush_big', 'bush_berry', 'd_stones', 'd_mushrooms', 'd_leaves']) expect(r.st.kinds[k], k).toBeGreaterThan(0);
    const eggs = ['egg_stump_door', 'egg_shroom_face', 'bush_eyes'].filter(k => r.st.kinds[k] === 1).length;
    expect(eggs, 'zeldzame easter eggs (elk hooguit één)').toBeGreaterThanOrEqual(2);
    expect(r.cleared, 'bouwen ruimt de decoratie op').toBe(true);
    expect(r.edge, 'bloemen/plantjes langs het pad').toBeGreaterThan(0);
    expect(r.onPath, 'niets óp het pad').toBe(false);
    expect(r.youngSp).toBe('tree_young');
    expect(r.adultSp).not.toBe('tree_young');
    expect(r.felled, 'omgehakte boom verdwijnt').toBe(1);
    expect(r.windMats).toBeGreaterThan(10);
    expect(r.allColor, 'elke vertex-color InstancedMesh heeft instanceColor').toBe(true);
    expect(r.decoF, 'vlinders vinden bloemen').toBeGreaterThan(50);

    // opslaan en laden: zelfde bomen, decoratie opnieuw opgebouwd
    const s = await page.evaluate(() => {
      const VE = window.VE, g = VE.game;
      const save = JSON.parse(JSON.stringify(g.serialize()));
      const g2 = new VE.Game(VE.view.scene); g2.init(save);
      const res = { a: save.nature.t.length, b: g2.nature.serialize().t.length, veg: g2.world.veg.stats().total,
        sameSp: g.nature.trees.filter(t => !t.dead).slice(0, 200).every(t => { const u = g2.world.tree[t.k]; return u && u.sp === t.sp; }) };
      g2.dispose();
      return res;
    });
    expect(s.b).toBe(s.a);
    expect(s.veg).toBeGreaterThan(8000);
    expect(s.sameSp, 'zelfde boomsoort na laden').toBe(true);
    const unknown = checkErrors(errors, info);
    expect(unknown, unknown.join('\n')).toEqual([]);
  });

  test('wereldgeneratie blijft gelijk (zelfde seed → zelfde bomen en rotsen als zonder Blender-natuur)', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'logica: alleen desktop');
    await openGame(page);
    for (const seed of [12345, 987654321, 4242]) {
      const a = await worldFor(page, seed, true), b = await worldFor(page, seed, false);
      expect(a.veg).toBe(true); expect(b.veg).toBe(false);
      expect(a.trees).toBe(b.trees);
      expect(a.t, 'bomen seed ' + seed).toBe(b.t);
      expect(a.r, 'rotsen seed ' + seed).toBe(b.r);
      const a2 = await worldFor(page, seed, true);
      expect(a2.t, 'deterministisch').toBe(a.t);
    }
  });

  test('fallback: zonder nature.glb blijven de oude bomen en het gras werken', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'logica: alleen desktop');
    const errors = trackErrors(page);
    await page.route('**/public/models/nature.glb*', r => r.abort());
    await openGame(page);
    await startNewVillage(page);
    const r = await page.evaluate(() => ({ src: window.VE.natureSource, pools: Object.keys(window.VE.game.nature.pools), trees: window.VE.game.nature.trees.length, legacy: !!window.VE.game.world.tufts }));
    expect(r.src).toBe('procedural');
    expect(r.pools.sort()).toEqual(['L0', 'L1', 'L2']);
    expect(r.trees).toBeGreaterThan(300);
    expect(r.legacy).toBe(true);
    const unknown = checkErrors(errors, info).filter(e => !/nature\.glb|natuur: GLB niet geladen|Failed to load resource/.test(e));
    expect(unknown, unknown.join('\n')).toEqual([]);
  });

  test('prestaties: draw calls, driehoeken en frametijd', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'meting: desktop');
    test.setTimeout(300_000);
    // dezelfde camera (standaard zoom 19 én helemaal uitgezoomd) met de oude en de nieuwe natuur
    const measure = () => page.evaluate(async () => {
      const VE = window.VE, rr = VE.view.renderer, g = VE.game, c = VE.view.cam, out = {};
      for (const d of [19, 30]) {
        c.tx = g.hq.cx; c.tz = g.hq.cz; c.tdist = c.dist = d;
        await new Promise(r => setTimeout(r, 900));
        const t0 = performance.now(); let frames = 0, cpu = 0;
        await new Promise(res => { const f = () => { frames++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
        const s0 = performance.now(); for (let n = 0; n < 20; n++) { VE.natureForceSync && VE.natureForceSync(); VE.natureSync && VE.natureSync(g, VE.view.camera); } cpu = (performance.now() - s0) / 20;
        const i = rr.info.render;
        out['zoom' + d] = { calls: i.calls, triangles: i.triangles, fps: +(frames / ((performance.now() - t0) / 1000)).toFixed(1), syncMs: +cpu.toFixed(2) };
      }
      out.trees = g.nature.trees.length; out.veg = g.world.veg ? g.world.veg.stats().total : 0; out.src = VE.natureSource;
      return out;
    });
    await openGame(page);
    await startNewVillage(page);
    const m = await measure();
    await page.evaluate(() => { localStorage.clear(); window.VE.save = () => {}; });
    await page.goto('/index.html?oldnature');
    await page.locator('#menuBtns').waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForFunction(() => window.VE && window.VE.game && window.VE.ui);
    await page.locator('#btnNew').click();
    await page.locator('#spStart').click();
    if (await page.locator('#cnYes').isVisible().catch(() => false)) await page.locator('#cnYes').click();
    await page.waitForFunction(() => window.VE.playing === true);
    await page.waitForTimeout(2500);
    const old = await measure();
    console.log('prestaties natuur NIEUW:', JSON.stringify(m));
    console.log('prestaties natuur OUD  :', JSON.stringify(old));
    expect(m.src).toBe('glb'); expect(old.src).toBe('procedural');
    expect(m.zoom19.calls).toBeLessThan(old.zoom19.calls + 60);     // grote wereld: meer soorten tegelijk in beeld
    expect(m.zoom19.syncMs, 'culling kost weinig CPU').toBeLessThan(25);
  });

  test('screenshots: bos, weide, pad en easter eggs', async ({ page }, info) => {
    test.setTimeout(180_000);
    await openGame(page);
    await startNewVillage(page);
    await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world;
      document.getElementById('hud').style.visibility = 'hidden';
      w.reveal(g.hq.cx, g.hq.cz, 40); w.updateFog();
      for (const s of g.settlers) s.hidden = true;
    });
    const go = (x, z, d, p) => page.evaluate(([x, z, d, p]) => { const c = window.VE.view.cam; c.tx = x; c.tz = z; c.tdist = c.dist = d; c.pitch = p; }, [x, z, d, p]);
    const hq = await page.evaluate(() => ({ x: window.VE.game.hq.cx, z: window.VE.game.hq.cz }));
    await go(hq.x, hq.z, 16, 0.85); await page.waitForTimeout(2200); await shot(page, info.project.name, 'natuur-overzicht');
    // dichtste bos en een bloemrijke weide
    const spots = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, v = w.veg, N = VE.N, hq = g.hq;
      let forest = null, meadow = null, bf = -1, bm = -1;
      for (let j = 4; j < N - 4; j++) for (let i = 4; i < N - 4; i++) {
        const d = Math.hypot(i - hq.i, j - hq.j); if (d > 18) continue;
        let tr = 0, fl = 0;
        for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const k = (j + b) * N + i + a; if (w.tree[k]) tr++; if (w.decoF[k]) fl++; }
        if (tr > bf) { bf = tr; forest = [i + 0.5, j + 0.5]; }
        if (fl - tr > bm) { bm = fl - tr; meadow = [i + 0.5, j + 0.5]; }
      }
      const eggs = {};
      for (const name of ['egg_stump_door', 'egg_shroom_face', 'bush_eyes']) { const K = v.byName[name]; const p = K.pos.find(Boolean); if (p) eggs[name] = [p[0], p[1]]; }
      const trees = {};
      for (const name of ['tree_oak_bird', 'tree_beech_logo']) { const t = g.nature.trees.find(t => !t.dead && t.sp === name); if (t) trees[name] = [t.x, t.z]; }
      return { forest, meadow, eggs, trees };
    });
    await go(spots.forest[0], spots.forest[1], 7, 0.62); await page.waitForTimeout(1800); await shot(page, info.project.name, 'natuur-bos');
    await go(spots.meadow[0], spots.meadow[1], 6, 0.55); await page.waitForTimeout(1800); await shot(page, info.project.name, 'natuur-weide');
    for (const [name, p] of Object.entries(Object.assign({}, spots.eggs, spots.trees))) {
      const tree = name.startsWith('tree_');
      await go(p[0], p[1] + (tree ? 0.2 : 0), tree ? 2.6 : 1.5, tree ? 0.35 : 0.42); await page.waitForTimeout(1500);
      await shot(page, info.project.name, 'natuur-egg-' + name);
    }
  });
});
