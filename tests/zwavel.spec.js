// Vulkaan: zwavel (alleen rond de vulkaan, zichtbare afzettingen), zwavelmijn (alleen op de vulkaanhelling,
// mijnwerker loopt en draagt zichtbaar, lokale opslag 6), buskruitwerkplaats (zwavel + steenkool + hout → buskruit),
// transport en Storehouses, zichtbare stapels, langzaam herstel van de zwavel, eerlijke verdeling voor drie
// spelers, opslaan/laden en oude saves. Buskruit is voorbereid voor de toekomst (nog geen kanonnen).
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage, shot } = require('./helpers');

const errs = errors => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);

test.describe('Zwavel en buskruit', () => {
  test('volledige keten: zwavelmijn → dragers → werkplaats → buskruit → opslag', async ({ page }, info) => {
    test.setTimeout(300_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await page.evaluate(() => Promise.all([window.VE.glbAllReady, window.VE.sulfurReady]));
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, N = VE.N, hq = g.hq, M = VE.Mining;
      const out = { res: ['sulfur', 'gunpowder'].every(k => VE.RES[k] && VE.RES_ORDER.indexOf(k) >= 0), future: VE.FUTURE_USES.gunpowder,
        icons: ['sulfur', 'gunpowder'].every(k => VE.icon(k, 16).indexOf('<path') >= 0) };
      // zwavel: alleen op de vulkaanhelling
      const S = w.deposits.filter(d => d.type === 6);
      out.sulfur = S.length; out.onSlope = S.every(d => w.volc[d.k] === 1 && w.type[d.k] === 2);
      out.fields = w.sulfurFields.map(f => f.rich);
      // eerlijk: per speler het eigen veld en de twee betwiste velden aan zijn kanten op vrijwel gelijke afstand
      out.own = w.starts.map((s, n) => { const d = w.ore[w.sulfurFields[n].k]; return Math.hypot(d.x - s.i - 1, d.z - s.j - 1); });
      out.contested = w.starts.map((s, n) => [3 + n, 3 + (n + 2) % 3].map(q => { const d = w.ore[w.sulfurFields[q].k]; return Math.hypot(d.x - s.i - 1, d.z - s.j - 1); }));
      out.visible = g.sulfurR.meshes.length === 3;
      // bouwregels
      g.rank = 3; w.owned.fill(1); w.explored.fill(1); w.fogDirty = true;
      out.onGrass = g.canPlace('sulfurmine', hq.i + 3, hq.j + 4, true).why;
      let anyMountain = null; for (let k = 0; k < N * N && !anyMountain; k++) if (w.type[k] === 2 && !w.volc[k] && g.canPlace('coalmine', k % N, (k / N) | 0, true).why !== 'Mines can only be built on the mountain') anyMountain = k;
      out.onMountain = anyMountain !== null ? g.canPlace('sulfurmine', anyMountain % N, (anyMountain / N) | 0, true).why : null;
      // zwavelmijn naast een eigen (niet-rijk) zwavelveld
      const f0 = w.sulfurFields[0], d0 = w.ore[f0.k];
      let best = null, bd = 1e9;
      for (let j = Math.floor(d0.z) - 6; j <= d0.z + 6; j++) for (let i = Math.floor(d0.x) - 6; i <= d0.x + 6; i++) {
        const c = g.canPlace('sulfurmine', i, j, true); if (!c.ok) continue;
        const dd = Math.hypot(i - d0.x, j - d0.z); if (dd < bd) { bd = dd; best = [i, j, c.why]; }
      }
      out.why = best && best[2];
      const mine = g.placeBuilding('sulfurmine', best[0], best[1], true);
      // werkplaats en Storehouse halverwege, met hun eigen dragers; steenkool en hout in de opslag
      const mid = [VE.lerp(mine.cx, hq.cx, 0.5), VE.lerp(mine.cz, hq.cz, 0.5)];
      const spot = (t, near) => { let b2 = null, bd2 = 1e9; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const d = Math.hypot(i - near[0], j - near[1]); if (d >= bd2 || !g.canPlace(t, i, j, true).ok) continue; if (!g.pf.find(mine.doorK, (j + 1) * N + i)) continue; bd2 = d; b2 = [i, j]; } return b2; };
      const sp = spot('warehouse', [mine.cx + 3, mine.cz + 3]);
      const st = g.placeBuilding('warehouse', sp[0], sp[1], true); st.level = 3; g.makeMesh(st);
      g.setAccept(st, '*', false); for (const k of ['sulfur', 'gunpowder', 'coal', 'log']) g.setAccept(st, k, true);
      const pp = spot('powdermill', [mine.cx + 5, mine.cz]);
      const pm = g.placeBuilding('powdermill', pp[0], pp[1], true);
      st.store.coal = 30; st.store.log = 30; g.sd = true;
      for (let n = 0; n < 14; n++) { g.spawnSettler(); const s = g.settlers[g.settlers.length - 1]; s.x = st.dx; s.z = st.dz; }
      out.places = { mine: [mine.i, mine.j], st: sp, pm: pp };
      // simuleren: zichtbaar graven en dragen, opslag, werkplaats
      let walkVis = 0, carrySulfur = 0, digAt = 0, maxOut = 0, maxPmOut = 0, carriedSulfur = 0, carriedPowder = 0;
      const amt0 = S.reduce((a, d) => a + d.amount, 0);
      for (let t = 0; t < 900; t += 0.1) {
        g.arriveT = 1e9; for (const s of g.settlers) s.food = 1;   // deze test gaat over de zwavelketen, niet over honger
        g.update(0.1);
        const s = mine.worker;
        if (s && !s.hidden && s.wstate === 'walk') walkVis++;
        if (s && !s.hidden && s.carry === 'sulfur') carrySulfur++;
        if (s && s.act === 'pick' && !s.hidden) digAt++;
        maxOut = Math.max(maxOut, g.outTotal(mine)); maxPmOut = Math.max(maxPmOut, g.outTotal(pm));
        for (const q of g.settlers) if (q.task && q.task.picked) { if (q.carry === 'sulfur') carriedSulfur++; if (q.carry === 'gunpowder') carriedPowder++; }
      }
      out.walkVis = walkVis; out.carrySulfur = carrySulfur; out.digAt = digAt; out.maxOut = maxOut; out.maxPmOut = maxPmOut;
      out.carriedSulfur = carriedSulfur; out.carriedPowder = carriedPowder;
      out.produced = { sulfur: g.stats.produced.sulfur || 0, gunpowder: g.stats.produced.gunpowder || 0 };
      out.inStore = { sulfur: st.store.sulfur || 0, gunpowder: st.store.gunpowder || 0, coal: st.store.coal || 0, log: st.store.log || 0 };
      out.used = amt0 - S.reduce((a, d) => a + d.amount, 0);
      out.pmStatus = pm.status; out.mineStatus = mine.status;
      // zichtbare stapels: zwavel en buskruit liggen als Blender-goederen in de opslag
      g.piles.update(g);
      out.piles = { sulfur: g.piles.meshes.sulfur ? g.piles.meshes.sulfur.count : -1, gunpowder: g.piles.meshes.gunpowder ? g.piles.meshes.gunpowder.count : -1 };
      out.itemSrc = VE.itemSource; out.models = [VE.modelSource.sulfurmine_1, VE.modelSource.powdermill_1, VE.sulfurSource];
      // herstel: een afzetting leeghalen, dan 3 minuten wachten (zonder mijn)
      g.demolish(mine, true);
      const dE = S[0]; dE.amount = 0; M.sulfurDirty = true;
      for (let t = 0; t < 180; t += 0.5) g.update(0.5);
      out.regen = dE.amount;
      // opslaan en laden: zwavel (ook een lege plek) en de keuze van de opslag blijven
      dE.amount = 0;
      const sv = JSON.parse(JSON.stringify(g.serialize()));
      const a = new VE.Game(VE.view.scene); a.init(sv);
      const S2 = a.world.deposits.filter(d => d.type === 6);
      out.saved = { n: S2.length, empty: S2.some(d => d.k === dE.k && d.amount === 0), same: S2.reduce((x, d) => x + d.amount, 0) === S.reduce((x, d) => x + d.amount, 0),
        acc: VE.RES_ORDER.filter(k => a.buildings.find(b => b.type === 'warehouse' && b.level === 3).accept[k]) };
      a.dispose();
      // oude save (van vóór de zwavel): krijgt zwavel rond zijn vulkaan, de rest van de aders blijft gelijk
      const old = JSON.parse(JSON.stringify(sv)); old.ore = old.ore.filter(e => e[1] !== 6);
      const o = new VE.Game(VE.view.scene); o.init(old);
      out.oldSulfur = o.world.deposits.filter(d => d.type === 6).length; out.oldOre = o.world.deposits.filter(d => d.type !== 6).length === sv.ore.filter(e => e[1] !== 6).length;
      o.dispose();
      return out;
    });
    console.log('zwavel', JSON.stringify(r));
    expect(r.res && r.icons).toBe(true);
    expect(r.future).toContain('cannon');
    expect(r.sulfur).toBeGreaterThanOrEqual(30);
    expect(r.onSlope, 'zwavel alleen op de vulkaanhelling').toBe(true);
    expect(r.fields.filter(Boolean).length, 'drie rijke, betwiste velden').toBe(3);
    expect(Math.max(...r.own) - Math.min(...r.own), 'eigen veld even ver voor elke speler').toBeLessThan(6);
    const c = r.contested.flat(); expect(Math.max(...c) - Math.min(...c), 'betwiste velden even ver').toBeLessThan(8);
    expect(r.visible).toBe(true);
    expect(r.onGrass).toBe('Sulfur Mines can only be built on the slope of the volcano');
    if (r.onMountain) expect(r.onMountain).toBe('Sulfur Mines can only be built on the slope of the volcano');
    expect(r.why).toMatch(/sulfur deposit nearby/);
    expect(r.walkVis, 'mijnwerker loopt zichtbaar').toBeGreaterThan(50);
    expect(r.digAt, 'mijnwerker graaft zichtbaar').toBeGreaterThan(50);
    expect(r.carrySulfur, 'mijnwerker draagt zwavel').toBeGreaterThan(20);
    expect(r.maxOut, 'lokale opslag max. 6').toBeLessThanOrEqual(6);
    expect(r.maxPmOut).toBeLessThanOrEqual(6);
    expect(r.produced.sulfur).toBeGreaterThan(30);
    expect(r.produced.gunpowder, 'werkplaats maakt buskruit').toBeGreaterThan(10);
    expect(r.produced.gunpowder % 2, 'recept: 2 buskruit per keer').toBe(0);
    expect(r.carriedSulfur, 'dragers brengen zwavel').toBeGreaterThan(0);
    expect(r.carriedPowder, 'dragers brengen buskruit').toBeGreaterThan(0);
    expect(r.inStore.gunpowder, 'buskruit in de opslag').toBeGreaterThan(4);
    expect(r.used, 'zwavel uit de afzettingen').toBeGreaterThan(30);
    expect(r.piles.sulfur + r.piles.gunpowder, 'voorraad zichtbaar als stapels').toBeGreaterThan(0);
    expect(r.itemSrc).toBe('glb');
    expect(r.models).toEqual(['glb', 'glb', 'glb']);
    expect(r.regen, 'zwavel komt langzaam terug').toBeGreaterThanOrEqual(3);
    expect(r.saved.n).toBe(r.sulfur);
    expect(r.saved.empty, 'lege plek blijft bewaard').toBe(true);
    expect(r.saved.same).toBe(true);
    expect(r.saved.acc).toEqual(['log', 'coal', 'sulfur', 'gunpowder']);
    expect(r.oldSulfur, 'oude save krijgt zwavel').toBe(r.sulfur);
    expect(r.oldOre, 'oude aders ongewijzigd').toBe(true);
    // foto's: afzettingen met de mijn, en de werkplaats
    await page.evaluate(p => {
      const VE = window.VE, c = VE.view.cam; c.tx = p.mine[0] + 0.5; c.tz = p.mine[1] + 0.5; c.tdist = c.dist = 5.5; c.pitch = 0.6; c.tyaw = c.yaw = 0.5;
      document.getElementById('hud').style.visibility = 'hidden';
    }, r.places);
    await page.waitForTimeout(1500);
    await shot(page, info.project.name, 'zwavel-vulkaan');
    await page.evaluate(p => { const c = window.VE.view.cam; c.tx = p.pm[0] + 0.5; c.tz = p.pm[1] + 0.5; c.tdist = c.dist = 3.4; c.pitch = 0.5; c.tyaw = c.yaw = 0.35; }, r.places);
    await page.waitForTimeout(1500);
    await shot(page, info.project.name, 'buskruitwerkplaats');
    expect(errs(errors)).toEqual([]);
  });

  test('UI: rangen, bouwbalk, uitleg bij plaatsen, infopaneel en kleine wereld zonder vulkaan', async ({ page }, info) => {
    test.setTimeout(120_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, D = VE.DEFS;
      const out = { mineRank: D.sulfurmine.rank, pmRank: D.powdermill.rank, cat: [D.sulfurmine.cat, D.powdermill.cat],
        unlock: [VE.RANKS[2].unlock.indexOf('sulfurmine') >= 0, VE.RANKS[3].unlock.indexOf('powdermill') >= 0],
        recipe: D.powdermill.inp, out: D.powdermill.out };
      g.rank = 3; VE.ui.renderBuildBar && VE.ui.renderBuildBar();
      VE.ui.setTool('sulfurmine'); VE.ui.showInfoDef('sulfurmine');
      // telefoon: bij het kiezen van een bouwknop blijft het paneel dicht (mobiele interface): dan de beschrijving zelf
      out.panelMine = document.getElementById('infoPanel').innerText || D.sulfurmine.desc;
      VE.ui.setTool('powdermill'); VE.ui.showInfoDef('powdermill');
      out.panelPm = document.getElementById('infoPanel').innerText || D.powdermill.desc;
      VE.ui.setTool(null);
      return out;
    });
    expect(r.mineRank).toBe(2);
    expect(r.pmRank).toBe(3);
    expect(r.unlock).toEqual([true, true]);
    expect(r.recipe).toEqual({ sulfur: 1, coal: 1, log: 1 });
    expect(r.out).toEqual({ gunpowder: 2 });
    expect(r.panelMine).toMatch(/volcano/);
    expect(r.panelPm).toMatch(/cannons and artillery/);
    // kleine (oude) wereld zonder vulkaan: geen zwavel, geen fouten
    await page.goto('/index.html?small');
    await page.locator('#menuBtns').waitFor({ state: 'visible' });
    await page.locator('#btnNew').click();
    await page.waitForTimeout(500);
    if (await page.locator('#cnYes').isVisible()) await page.locator('#cnYes').click();   // er staat al een save: opnieuw beginnen
    await page.waitForFunction(() => window.VE.playing === true && window.VE.N === 64);
    const s = await page.evaluate(() => { const g = window.VE.game; for (let i = 0; i < 50; i++) g.update(0.1); return { n: window.VE.N, sulfur: g.world.deposits.filter(d => d.type === 6).length, why: g.canPlace('sulfurmine', g.hq.i + 3, g.hq.j + 4, true).why }; });
    expect(s.n).toBe(64);
    expect(s.sulfur).toBe(0);
    expect(s.why).toBe('Sulfur Mines can only be built on the slope of the volcano');
    expect(errs(errors)).toEqual([]);
  });
});
