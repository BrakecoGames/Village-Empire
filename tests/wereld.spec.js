// Grote wereld: grootte, drie gelijkwaardige startplekken, landschap (vulkaan, canyon met brug, rivieren, meren,
// bergen), bereikbaarheid, bijzondere plekken en ontdekken, minimap, opslaan/laden (ook oude saves) en prestaties
// met drie volle dorpen.
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage, shot } = require('./helpers');

const errs = errors => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);

test.describe('Grote wereld', () => {
  test('grootte, startplekken, landschap, bereikbaarheid en balans', async ({ page }, info) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await page.evaluate(() => window.VE.glbAllReady);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, N = VE.N, F = w.features;
      const types = {}; for (const t of w.type) types[t] = (types[t] || 0) + 1;
      // bereikbaarheid (BFS over beloopbare tegels, 8 richtingen zoals de padzoeker)
      const bfs = (from, block) => {
        const seen = new Uint8Array(N * N), q = [from]; seen[from] = 1;
        const ok = k => w.walkable(k) && !(block && block.has(k));
        while (q.length) {
          const c = q.pop(), ci = c % N, cj = (c / N) | 0;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const i = ci + di, j = cj + dj; if (!w.inb(i, j)) continue;
            const k = j * N + i; if (seen[k] || !ok(k)) continue;
            if (di && dj && (!ok(cj * N + i) || !ok(j * N + ci))) continue;
            seen[k] = 1; q.push(k);
          }
        }
        return seen;
      };
      const startK = s => (s.j + 3) * N + s.i + 1;                   // voor de deur van het dorpshuis
      const seen = bfs(startK(w.starts[0]));
      let land = 0, reach = 0;
      for (let k = 0; k < N * N; k++) if (w.walkable(k)) { land++; if (seen[k]) reach++; }
      const startsReach = w.starts.map(s => !!seen[startK(s)]);
      // bijzondere plekken: een beloopbare, bereikbare tegel ernaast
      const lmReach = g.landmarks.filter(L => L.kind !== 'egg_duck' && L.kind !== 'vent').map(L => {
        for (let r = 1; r <= 3; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = Math.floor(L.x) + di, j = Math.floor(L.z) + dj; if (w.inb(i, j) && seen[j * N + i]) return true; }
        return L.kind;
      });
      // canyon: over de brug kort, zonder brug een lange omweg (strategische barrière)
      const B = F.bridge, a = [B.x - B.dir[0] * (B.half + 1.5), B.z - B.dir[1] * (B.half + 1.5)], b = [B.x + B.dir[0] * (B.half + 1.5), B.z + B.dir[1] * (B.half + 1.5)];
      const ka = Math.floor(a[1]) * N + Math.floor(a[0]), kb = Math.floor(b[1]) * N + Math.floor(b[0]);
      const p1 = g.pf.find(ka, kb);
      const saved = B.tiles.map(k => w.type[k]); for (const k of B.tiles) w.type[k] = 4;
      const p2 = g.pf.find(ka, kb);
      B.tiles.forEach((k, n) => { w.type[k] = saved[n]; });
      // brugdek: bewoners lopen er echt over (hoogte op het dek, niet in de canyon)
      const mid = B.tiles[Math.floor(B.tiles.length / 2)], deckY = w.heightAt(mid % N + 0.5, ((mid / N) | 0) + 0.5);
      // balans tussen de drie startplekken
      const st = VE.worldStats(g, 16);
      const spread = key => { const v = st.map(o => o[key]); return (Math.max(...v) - Math.min(...v)) / Math.max(1, Math.max(...v)); };
      const ore = st.map(o => o.ore);
      const volcH = w.heightAt(F.volcano.x + 4.5, F.volcano.z), craterH = w.heightAt(F.volcano.x, F.volcano.z);
      return { N, types, reachFrac: reach / land, startsReach, lmReach, bridge: { with: p1 ? p1.length : null, without: p2 ? p2.length : null, deck: B.deck, deckY },
        st, spread: { trees: spread('trees'), rocks: spread('rocks'), water: spread('water'), build: spread('build'), mountain: spread('mountain') }, ore,
        startDist: w.starts.map((s, n) => { const t = w.starts[(n + 1) % 3]; return Math.hypot(s.i - t.i, s.j - t.j); }),
        volcano: { rim: volcH, crater: craterH }, lava: (w.lavaPath || []).length, canyonCliffs: types[4] || 0, landmarks: g.landmarks.map(L => L.kind),
        rivers: F.rivers.length, lakes: F.lakes.length };
    });
    console.log('wereld', JSON.stringify(r));
    expect(r.N).toBe(144);                                            // 144² = ruim 5× de oude 64² wereld
    expect(r.startsReach).toEqual([true, true, true]);
    expect(r.reachFrac).toBeGreaterThan(0.97);                        // vrijwel al het land is bereikbaar
    for (const x of r.lmReach) expect(x).toBe(true);
    expect(r.bridge.with).not.toBeNull();
    expect(r.bridge.with).toBeLessThan(25);
    expect(r.bridge.without === null || r.bridge.without > r.bridge.with * 3).toBe(true);
    expect(Math.abs(r.bridge.deckY - r.bridge.deck)).toBeLessThan(0.01);
    // drie gelijkwaardige starts: gelijke onderlinge afstand, vergelijkbare grondstoffen
    const dmin = Math.min(...r.startDist), dmax = Math.max(...r.startDist);
    expect(dmax - dmin).toBeLessThan(3);
    expect(dmin).toBeGreaterThan(70);                                 // genoeg ruimte om uit te breiden
    expect(r.spread.trees).toBeLessThan(0.25);
    expect(r.spread.rocks).toBeLessThan(0.35);
    expect(r.spread.build).toBeLessThan(0.2);
    for (const o of r.ore) { expect(o[1] || 0).toBeGreaterThan(50); expect(o[2] || 0).toBeGreaterThan(50); }   // kolen en ijzer bij elke start
    for (const o of r.st) { expect(o.trees).toBeGreaterThan(40); expect(o.rocks).toBeGreaterThan(8); expect(o.water).toBeGreaterThan(10); }
    // landschap
    expect(r.volcano.rim).toBeGreaterThan(6);
    expect(r.volcano.crater).toBeLessThan(r.volcano.rim - 1);       // krater
    expect(r.lava).toBeGreaterThan(20);                              // geul voorbereid op lava
    expect(r.canyonCliffs).toBeGreaterThan(80);
    expect(r.rivers).toBe(2);
    expect(r.lakes).toBeGreaterThanOrEqual(6);
    for (const k of ['bridge', 'falls_canyon', 'falls_hidden', 'ruin', 'cave', 'stones', 'monument', 'egg_sword', 'egg_duck', 'egg_gnomes', 'vent']) expect(r.landmarks).toContain(k);
    expect(errs(errors)).toEqual([]);
  });

  test('ontdekken, minimap, opslaan en laden (en oude saves blijven 64 × 64)', async ({ page }, info) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await page.evaluate(() => Promise.all([window.VE.glbAllReady, window.VE.Landmarks.ready]));
    // een plek ontdekken door de mist erboven weg te halen
    const d = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, L = g.landmarks.find(l => l.kind === 'ruin');
      const gold0 = g.gold, found0 = L.found;
      w.reveal(L.x, L.z, 4);
      for (let i = 0; i < 20; i++) g.update(0.05);
      return { found0, found: L.found, gold: g.gold - gold0, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ') };
    });
    expect(d.found0).toBe(false);
    expect(d.found).toBe(true);
    expect(d.gold).toBe(30);
    expect(d.toast).toContain('Discovered: Ancient Ruins');
    // minimap: zichtbaar; tikken verplaatst de camera
    if (await page.locator('#mmToggle').isVisible()) await page.locator('#mmToggle').click();   // telefoon: kaartknop
    await expect(page.locator('#minimap canvas')).toBeVisible();
    const box = await page.locator('#minimap canvas').boundingBox();
    await page.locator('#minimap canvas').click({ position: { x: box.width * 0.8, y: box.height * 0.2 } });
    const cam = await page.evaluate(() => ({ x: window.VE.view.cam.tx, z: window.VE.view.cam.tz, N: window.VE.N }));
    expect(Math.abs(cam.x - cam.N * 0.8)).toBeLessThan(cam.N * 0.06);
    expect(Math.abs(cam.z - cam.N * 0.2)).toBeLessThan(cam.N * 0.06);
    await shot(page, info.project.name, 'wereld-minimap');
    // opslaan en laden: zelfde wereld, ontdekte plekken blijven ontdekt
    const s = await page.evaluate(() => {
      const VE = window.VE, g = VE.game;
      const save = JSON.parse(JSON.stringify(g.serialize()));
      const before = { n: save.n, starts: JSON.stringify(g.world.starts), disc: save.disc, players: save.players.length, trees: g.nature.trees.filter(t => !t.dead).length };
      g.dispose(); const g2 = new VE.Game(VE.view.scene); VE.game = g2; g2.init(save);
      g2.sr = VE.makeSettlerRender(g2.root); g2.fx = new VE.FX(g2.root, g2); g2.piles = new VE.StockpileRender(g2.root); g2.started = true;
      const after = { n: VE.N, starts: JSON.stringify(g2.world.starts), disc: g2.landmarks.filter(L => L.found).map(L => L.id), players: g2.players.length, trees: g2.nature.trees.filter(t => !t.dead).length };
      // oude save (zonder n): blijft een 64 × 64 wereld
      const old = JSON.parse(JSON.stringify(save)); delete old.n; delete old.players; delete old.disc;
      old.buildings = old.buildings.filter(b => b.t === 'hq'); old.buildings[0].i = 30; old.buildings[0].j = 30;
      old.trail = undefined; old.fog = undefined; old.nature = { t: [], r: [], f: [] }; old.ore = undefined; old.wild = undefined; old.sol = undefined;
      g2.dispose(); const g3 = new VE.Game(VE.view.scene); VE.game = g3; g3.init(old);
      g3.sr = VE.makeSettlerRender(g3.root); g3.fx = new VE.FX(g3.root, g3); g3.piles = new VE.StockpileRender(g3.root); g3.started = true;
      const legacy = { n: VE.N, hq: !!g3.hq, starts: (g3.world.starts || []).length, update: (() => { try { for (let i = 0; i < 30; i++) g3.update(0.05); return true; } catch (e) { return e.message; } })() };
      return { before, after, legacy };
    });
    console.log('opslaan', JSON.stringify(s));
    expect(s.before.n).toBe(144);
    expect(s.after).toEqual(s.before);
    expect(s.legacy).toEqual({ n: 64, hq: true, starts: 0, update: true });
    expect(errs(errors)).toEqual([]);
  });

  test('prestaties: drie volle dorpen met bewoners, soldaten en gebouwen', async ({ page }, info) => {
    test.setTimeout(300_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await page.evaluate(() => window.VE.glbAllReady);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, N = VE.N;
      g.rank = 4; g.maxPop = 640; w.owned.fill(1); w.explored.fill(1); w.fogDirty = true; w.recolor();
      const types = ['house', 'house', 'house', 'house', 'woodcutter', 'forester', 'quarry', 'sawmill', 'farm', 'windmill', 'bakery', 'fisher', 'market', 'warehouse', 'warehouse',
        'vineyard', 'winery', 'tavern', 'smelter', 'weaponsmith', 'barracks', 'house', 'house', 'house', 'house', 'house', 'house', 'woodcutter', 'quarry', 'sawmill', 'farm', 'bakery', 'warehouse', 'hunter'];
      let placed = 0;
      w.starts.forEach((s, n) => {
        const cx = s.i + 1, cz = s.j + 1;
        if (n > 0) { const h = g.placeBuilding('warehouse', s.i, s.j, true); placed++; }
        for (const t of types) {
          const sz = VE.DEFS[t].size || 1; let done = false;
          for (let r = 3; r < 16 && !done; r++) for (let a = 0; a < 24 && !done; a++) {
            const i = Math.round(cx + Math.cos(a / 24 * 6.283 + r) * r), j = Math.round(cz + Math.sin(a / 24 * 6.283 + r) * r);
            if (g.canPlace(t, i, j, true).ok) { g.placeBuilding(t, i, j, true); placed++; done = true; }
          }
        }
        for (let q = 0; q < 140; q++) { const st = g.spawnSettler(); if (!st) break; st.x = cx + (Math.random() - 0.5) * 6; st.z = cz + 2 + (Math.random() - 0.5) * 4; }
        for (let q = 0; q < 30; q++) { const st = g.spawnSettler(); if (!st) break; st.x = cx + (q % 6) * 0.4 - 1; st.z = cz + 5 + Math.floor(q / 6) * 0.4; g.makeSoldier(st, VE.SOLDIER_ORDER[q % 6]); }
      });
      for (const r of ['plank', 'stone', 'grain', 'flour', 'ironbar', 'log', 'bread']) g.addGoods(r, 120);
      // warm lopen
      for (let i = 0; i < 120; i++) { g.arriveT = 1e9; g.update(1 / 60); }
      const t0 = performance.now(); let worst = 0;
      for (let i = 0; i < 300; i++) { const a = performance.now(); g.arriveT = 1e9; g.update(1 / 60); worst = Math.max(worst, performance.now() - a); }
      const sim = (performance.now() - t0) / 300;
      // tekenen: alle bewoners en dieren (renderer-tijd per frame, zonder de GPU)
      const t1 = performance.now();
      for (let i = 0; i < 30; i++) { g.sr.render(g.settlers); g.piles.update(g); if (g.wr) g.wr.render(g.wild, VE.view.camera, 1 / 60); }
      const draw = (performance.now() - t1) / 30;
      return { placed, settlers: g.settlers.length, soldiers: g.soldiers().length, buildings: g.buildings.length, animals: g.wild.list.filter(a => !a.dead).length,
        trees: g.nature.trees.length, simMs: sim, worstMs: worst, drawMs: draw, chunks: w.chunks.length, srCap: g.sr.cap, drawn: g.sr.stats.settlers };
    });
    console.log('prestaties', JSON.stringify(r));
    expect(r.placed).toBeGreaterThan(90);
    expect(r.settlers).toBeGreaterThan(450);
    expect(r.soldiers).toBe(90);
    expect(r.simMs).toBeLessThan(10);                                 // ruim binnen een frame (60 fps = 16,7 ms)
    expect(r.drawMs).toBeLessThan(14);
    expect(r.chunks).toBe(36);
    // speelbaar beeld met de drie dorpen: één frame meten in de browser zelf
    const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { if (++n < 40) requestAnimationFrame(f); else res(1000 * n / (performance.now() - t0)); }; requestAnimationFrame(f); }));
    console.log('fps (software-rendering in de test)', fps.toFixed(1));
    await page.evaluate(() => { const VE = window.VE, s = VE.game.world.starts[1], c = VE.view.cam; c.tx = s.i + 1; c.tz = s.j + 3; c.tdist = c.dist = 22; });
    await page.waitForTimeout(1500);
    await shot(page, info.project.name, 'wereld-drie-dorpen');
    expect(errs(errors)).toEqual([]);
  });
});
