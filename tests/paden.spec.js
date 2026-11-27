// Paden worden niet gebouwd: ze slijten vanzelf in waar dorpelingen vaak heen en weer lopen.
const { test, expect } = require('@playwright/test');
const { SAVE_KEY, trackErrors, checkErrors, openGame, startNewVillage } = require('./helpers');

// Een vrije grastegel dicht bij het dorpshuis (geen boom, steen, veld, gebouw, deur of pad)
const FREE_TILE = `(() => {
  const VE = window.VE, g = VE.game, w = g.world, N = VE.N, hq = g.hq;
  for (let r = 3; r < 10; r++) for (let j = hq.j - r; j <= hq.j + r; j++) for (let i = hq.i - r; i <= hq.i + r; i++) {
    if (!w.inb(i, j)) continue; const k = j * N + i;
    if (w.type[k] === 0 && !w.tree[k] && !w.rock[k] && !w.field[k] && !w.bld[k] && !w.door[k] && !w.road[k] && w.owned[k]) return k;
  }
  return -1;
})()`;

test.describe('Paden', () => {
  test('er is geen gereedschap meer om wegen te bouwen', async ({ page }, info) => {
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await expect(page.locator('.tool[data-tool="road"]')).toHaveCount(0);
    await page.keyboard.press('r'); // vroeger: wegen-gereedschap
    const r = await page.evaluate(() => ({ tool: window.VE.ui.tool, addRoad: typeof window.VE.game.addRoad, help: true }));
    expect(r.tool).toBeNull();
    expect(r.addRoad).toBe('undefined');
    expect(checkErrors(errors, info)).toEqual([]);
  });

  test('vaak belopen tegel wordt eerst een spoor, dan een pad, en groeit weer dicht', async ({ page }, info) => {
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const r = await page.evaluate(src => {
      const VE = window.VE, g = VE.game, w = g.world, P = VE.PATH;
      const k = eval(src); if (k < 0) return { k };
      const out = { k, roadsBefore: g.stats.roads, costGrass: g.pf.cost(k) };
      for (let n = 0; n < P.TRAIL_ON; n++) g.tread(k);
      out.afterTrail = w.road[k]; out.costTrail = g.pf.cost(k);
      for (let n = P.TRAIL_ON; n < P.PATH_ON; n++) g.tread(k);
      out.afterPath = w.road[k]; out.costPath = g.pf.cost(k); out.roadsAfter = g.stats.roads;
      // niemand loopt er meer: een paar minuten spel-tijd later is het pad weer gras
      for (let n = 0; n < 200 && w.road[k]; n++) g.wearDecay();
      out.afterDecay = w.road[k];
      // een gebouw mag over een pad heen gebouwd worden
      for (let n = 0; n < P.PATH_ON; n++) g.tread(k);
      const i = k % VE.N, j = (k / VE.N) | 0;
      out.placeOnPath = g.canPlace('house', i, j, true);
      return out;
    }, FREE_TILE);
    expect(r.k).toBeGreaterThanOrEqual(0);
    expect(r.afterTrail).toBe(1);
    expect(r.afterPath).toBe(2);
    expect(r.costTrail).toBeLessThan(r.costGrass);
    expect(r.costPath).toBeLessThan(r.costTrail);
    expect(r.roadsAfter).toBe(r.roadsBefore + 1); // telt mee voor de opdracht
    expect(r.afterDecay).toBe(0);
    // alleen als de helling het toelaat; de reden mag in elk geval niet het pad zijn
    if (!r.placeOnPath.ok) expect(r.placeOnPath.why).not.toMatch(/road|path|entrance/i);
    expect(checkErrors(errors, info)).toEqual([]);
  });

  test('paden ontstaan vanzelf door het lopen van dorpelingen', async ({ page }, info) => {
    test.setTimeout(150_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const r = await page.evaluate(async () => {
      const VE = window.VE, g = VE.game, w = g.world, N = VE.N, hq = g.hq;
      VE.ui.toast = () => {};
      // een houthakker en zagerij een eind van het dorpshuis, zodat er gesjouwd moet worden
      for (const t of ['woodcutter', 'sawmill', 'quarry', 'woodcutter']) {
        let done = false;
        for (let r = 5; r < 11 && !done; r++) for (let j = hq.j - r; j <= hq.j + r && !done; j++) for (let i = hq.i - r; i <= hq.i + r && !done; i++)
          if (Math.max(Math.abs(i - hq.i), Math.abs(j - hq.j)) === r && g.canPlace(t, i, j, true).ok) { g.placeBuilding(t, i, j, true); done = true; }
      }
      // en een Storehouse bij het dorpshuis: dragers sjouwen hout en steen erheen (sinds 1.4.0)
      { let done = false;
        for (let r = 2; r < 6 && !done; r++) for (let j = hq.j - r; j <= hq.j + r && !done; j++) for (let i = hq.i - r; i <= hq.i + r && !done; i++)
          if (g.canPlace('warehouse', i, j, true).ok) { g.placeBuilding('warehouse', i, j, true); done = true; } }
      for (let n = 0; n < 6; n++) g.spawnSettler();
      const count = () => { let a = 0, b = 0; for (let k = 0; k < N * N; k++) if (!w.door[k]) { if (w.road[k] === 1) a++; else if (w.road[k] === 2) b++; } return { trail: a, path: b }; };
      const before = count();
      // acht spel-minuten simuleren zonder te tekenen (de software-renderer is te traag)
      const saved = g.speed; g.speed = 0;
      // de Storehouse wordt af en toe geleegd (verbruik), anders loopt hij vol en stopt de productie (en het lopen)
      const st = g.buildings.find(b => b.def.depot);
      for (let t = 0, n = 0; t < 480; t += 0.1, n++) { g.update(0.1); if (st && n % 300 === 0) { for (const r in st.store) st.store[r] = st.outRes[r] || 0; g.sd = true; } }
      g.speed = saved;
      w.rebuildRoads();
      w.paths.upload();
      let lit = 0; for (const b of w.paths.data) if (b > 0) lit++;
      return { before, after: count(), roads: g.stats.roads, lit };
    });
    expect(r.before.path).toBeLessThan(4); // aan het begin alleen de ingangen van grote gebouwen
    expect(r.after.trail + r.after.path).toBeGreaterThan(r.before.trail + r.before.path + 1);   // willekeurige wereld: minstens 2 nieuwe paden
    expect(r.roads).toBeGreaterThanOrEqual(3);                     // willekeurige wereld: soms precies 3
    expect(r.lit, 'slijtage zichtbaar in het terrein').toBeGreaterThan(100);
    expect(checkErrors(errors, info)).toEqual([]);
  });

  test('paden worden opgeslagen, en wegen uit oude saves blijven paden', async ({ page }, info) => {
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const r = await page.evaluate(src => {
      const VE = window.VE, g = VE.game, P = VE.PATH;
      const k = eval(src);
      for (let n = 0; n < P.PATH_ON + 2; n++) g.tread(k);
      VE.save();
      return { k };
    }, FREE_TILE);
    const saved = JSON.parse(await page.evaluate(k => localStorage.getItem(k), SAVE_KEY));
    expect(Array.isArray(saved.trail) && saved.trail.length > 0).toBe(true);
    // oud formaat: een kale lijst tegelnummers van zelf aangelegde wegen
    delete saved.trail; saved.roads = [r.k];
    await page.evaluate(([key, s]) => { window.VE.playing = false; localStorage.setItem(key, JSON.stringify(s)); }, [SAVE_KEY, saved]);
    await page.reload();
    await page.locator('#btnContinue').click();
    await page.waitForFunction(() => window.VE.playing === true);
    const lvl = await page.evaluate(k => window.VE.game.world.road[k], r.k);
    expect(lvl).toBe(2);
    expect(checkErrors(errors, info)).toEqual([]);
  });
});
