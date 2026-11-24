// Wapensmederij: recepten, transport, lokale opslag (6), Storehouses per wapentype, Village Charter,
// opslaan/laden en zichtbare 3D-modellen.
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage, shot } = require('./helpers');

const errs = errors => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);

async function setup(page) {
  await page.evaluate(() => window.VE.glbAllReady);
  await page.evaluate(() => {
    const VE = window.VE, g = VE.game;
    g.rank = 3; g.world.owned.fill(1); g.world.explored.fill(1); g.world.fogDirty = true; g.world.recolor();
    for (let n = 0; n < 8; n++) g.spawnSettler();
    window.T = {
      spot(t, near, minD) {
        const N = VE.N; let best = null, bd = 1e9;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          if (!g.canPlace(t, i, j, true).ok) continue;
          const d = Math.hypot(i - near[0], j - near[1]);
          if (minD && d < minD) continue;
          if (d < bd) { bd = d; best = [i, j]; }
        }
        return best;
      },
      place(t, near, minD) { const s = this.spot(t, near, minD); return g.placeBuilding(t, s[0], s[1], true); },
      run(sec, each) { for (let t = 0; t < sec; t += 0.1) { g.arriveT = 1e9; g.update(0.1); if (each) each(t); } }
    };
    document.querySelectorAll('.toast').forEach(t => t.remove());
  });
}

test.describe('Wapensmederij', () => {
  test('keten: grondstoffen aanleveren, smeden, recepten, opslag van 6 en Storehouses per wapen', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      const ws = T.place('weaponsmith', [hq.cx + 4, hq.cz + 3], 3);
      const st = T.place('warehouse', [hq.cx - 3, hq.cz + 3], 3);
      st.level = 3; g.makeMesh(st);                                   // 100 plaatsen
      g.setAccept(st, '*', false); for (const k of ['ironbar', 'plank', 'sword']) g.setAccept(st, k, true);
      g.addGoods('ironbar', 40); g.addGoods('plank', 40);
      const p0 = Object.assign({}, g.stats.produced);
      const iron0 = g.stock.ironbar, plank0 = g.stock.plank;
      let maxOut = 0, hammer = 0, glowing = 0;
      const md = VE.buildModel('weaponsmith', 1);
      const hot = ws.anims.find(a => a.kind === 'hotblade');
      T.run(150, () => {
        maxOut = Math.max(maxOut, g.outTotal(ws));
        const s = ws.worker; if (s && ws.working && s.act === 'hammer' && !s.hidden) hammer++;
        if (hot && hot.mesh.material.color.r > 0.8) glowing++;
      });
      const swords = (g.stats.produced.sword || 0) - (p0.sword || 0);
      const inWork = ws.working ? 1 : 0;
      // grondstoffen: elk zwaard kost precies 3 ijzer + 1 plank (ook wat er als invoer of in de lopende batch zit)
      const ironUsed = iron0 - g.stock.ironbar - (ws.input.ironbar || 0) - [...g.settlers].filter(s => s.task && s.task.picked && s.carry === 'ironbar').length;
      const plankUsed = plank0 - g.stock.plank - (ws.input.plank || 0) - [...g.settlers].filter(s => s.task && s.task.picked && s.carry === 'plank').length;
      const swordsStored = st.store.sword || 0;
      // ander wapen: bogen (alleen planken); bogen mag de Storehouse niet hebben -> blijven bij de smid, max. 6
      g.setRecipe(ws, 'bow');
      let maxOut2 = 0;
      T.run(200, () => { maxOut2 = Math.max(maxOut2, g.outTotal(ws)); });
      const bowsAtSmith = ws.output.bow || 0, statusFull = ws.status, bowsInStore = st.store.bow || 0;
      // nu bogen aanvinken: dragers brengen ze naar de Storehouse
      g.setAccept(st, 'bow', true);
      T.run(60);
      return { swords, inWork, ironUsed, plankUsed, swordsStored, maxOut, maxOut2, hammer, glowing, recipe: ws.recipe, bowsAtSmith, statusFull, bowsInStore,
        bowsAfter: st.store.bow || 0, smithOut: g.outTotal(ws), anchors: md.anims.map(a => a.kind).sort(), src: VE.modelSource.weaponsmith, pile: !!md.pile };
    });
    console.log('wapens:', JSON.stringify(r));
    expect(r.src).toBe('glb');
    expect(r.anchors).toEqual(['bellows', 'glow', 'hotblade']);
    expect(r.pile).toBe(true);
    expect(r.swords).toBeGreaterThan(3);
    expect(r.ironUsed).toBe(3 * (r.swords + r.inWork));
    expect(r.plankUsed).toBe(1 * (r.swords + r.inWork));
    expect(r.swordsStored).toBeGreaterThan(0);
    expect(r.maxOut).toBeLessThanOrEqual(6);
    expect(r.hammer, 'smid zichtbaar aan het aambeeld').toBeGreaterThan(50);
    expect(r.glowing, 'wapen op het aambeeld gloeit').toBeGreaterThan(50);
    expect(r.recipe).toBe('bow');
    expect(r.bowsAtSmith).toBe(6);
    expect(r.maxOut2).toBeLessThanOrEqual(6);
    expect(r.statusFull).toMatch(/Storage full \(6\/6\)/);
    expect(r.bowsInStore).toBe(0);
    expect(r.bowsAfter).toBeGreaterThan(0);
    expect(errs(errors)).toEqual([]);
  });

  test('alle zes recepten, Village Charter, opslaan en laden', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      const ws = T.place('weaponsmith', [hq.cx + 4, hq.cz + 3], 3);
      const st = T.place('warehouse', [hq.cx - 3, hq.cz + 3], 3); st.level = 3; g.makeMesh(st);
      const exp = { sword: { ironbar: 3, plank: 1 }, spear: { ironbar: 1, plank: 2 }, battleaxe: { ironbar: 2, plank: 2 }, dagger: { ironbar: 1 }, bow: { plank: 3 }, crossbow: { plank: 2, ironbar: 1 } };
      const out = {};
      // alles wat dragers erbij brengen, telt mee: verbruikt = gegeven + gebracht - over
      const brought = {}; const del0 = g.deliver.bind(g);
      g.deliver = s => { const t = s.task; if (t && t.dst === ws && t.picked) brought[t.res] = (brought[t.res] || 0) + 1; return del0(s); };
      for (const w of VE.WEAPONS) {
        g.setRecipe(ws, w);
        out[w] = { inp: VE.DEFS.weaponsmith.recipes[w].inp };
        // grondstoffen rechtstreeks in de smidse, wachten op één wapen
        for (const k in brought) delete brought[k];
        const start = {}; for (const k in exp[w]) start[k] = ws.input[k] || 0;
        for (const k in exp[w]) ws.input[k] = (ws.input[k] || 0) + exp[w][k];
        const before = g.stats.produced[w] || 0;
        let t = 0; while ((g.stats.produced[w] || 0) === before && t < 60) { g.arriveT = 1e9; g.update(0.1); t += 0.1; }
        out[w].made = (g.stats.produced[w] || 0) - before;
        // verbruikt per grondstof = begin + gegeven + gebracht - over (precies de recepthoeveelheid)
        out[w].used = {}; for (const k in exp[w]) out[w].used[k] = start[k] + exp[w][k] + (brought[k] || 0) - (ws.input[k] || 0) - (ws.working && ws.batch === w ? 0 : 0);
        out[w].left = Object.keys(exp[w]).reduce((a, k) => a + Math.abs(out[w].used[k] - exp[w][k]), 0);
        // volgend recept: wat er nog ligt, gaat terug naar de uitvoer of wordt gebruikt
      }
      g.deliver = del0;
      T.run(40);   // dragers brengen de wapens naar de Storehouse (neemt alles aan)
      const stored = VE.WEAPONS.map(w => st.store[w] || 0);
      // Village Charter: wapens tellen in de opslag
      const q13 = VE.RANKS[3].quests.find(q => q.id === 't13');
      g.addGoods('sword', 20);
      const qProg = g.questProgress(q13);
      const quests = ['m12', 't11', 't12', 't13'].every(id => VE.RANKS.some(rk => rk.quests.some(q => q.id === id)));
      // opslaan en laden (v3)
      g.setAccept(st, 'dagger', false);
      const sv = JSON.parse(JSON.stringify(g.serialize()));
      const a = new VE.Game(VE.view.scene); a.init(sv);
      const ws2 = a.buildings.find(b => b.type === 'weaponsmith'), st2 = a.buildings.find(b => b.type === 'warehouse');
      const loaded = { v: sv.v, recipe: ws2.recipe, swords: a.stock.sword, sameStock: VE.WEAPONS.every(w => a.stock[w] === g.stock[w]), dagger: st2.accept.dagger, bow: st2.accept.bow };
      a.dispose();
      // oude save (v2, van voor de wapens): Storehouses nemen de nieuwe wapens standaard aan
      const old = JSON.parse(JSON.stringify(sv)); old.v = 2;
      for (const b of old.buildings) if (b.ac) b.ac = b.ac.filter(k => !VE.RES[k].weapon);
      const o = new VE.Game(VE.view.scene); o.init(old);
      const oldAccept = VE.WEAPONS.every(w => o.buildings.find(b => b.type === 'warehouse').accept[w]);
      o.dispose();
      return { out, stored, qProg, quests, loaded, oldAccept, market: VE.WEAPONS.every(w => g.sellPrice(w) > 0) };
    });
    console.log('recepten:', JSON.stringify(r));
    for (const w of ['sword', 'spear', 'battleaxe', 'dagger', 'bow', 'crossbow']) {
      expect(r.out[w].made, w + ' gemaakt').toBe(1);
      expect(r.out[w].left, w + ': precies de recepthoeveelheid verbruikt').toBe(0);
    }
    expect(r.out.sword.inp).toEqual({ ironbar: 3, plank: 1 });
    expect(r.out.spear.inp).toEqual({ ironbar: 1, plank: 2 });
    expect(r.out.battleaxe.inp).toEqual({ ironbar: 2, plank: 2 });
    expect(r.out.dagger.inp).toEqual({ ironbar: 1 });
    expect(r.out.bow.inp).toEqual({ plank: 3 });
    expect(r.out.crossbow.inp).toEqual({ plank: 2, ironbar: 1 });
    expect(r.stored.reduce((a, c) => a + c, 0)).toBe(6);
    expect(r.qProg).toBeGreaterThanOrEqual(20);
    expect(r.quests).toBe(true);
    expect(r.market).toBe(true);
    expect(r.loaded.v).toBe(4);
    expect(r.loaded.recipe).toBe('crossbow');
    expect(r.loaded.sameStock).toBe(true);
    expect(r.loaded.dagger).toBe(false);
    expect(r.loaded.bow).toBe(true);
    expect(r.oldAccept).toBe(true);
    expect(errs(errors)).toEqual([]);
  });

  test('UI en 3D: wapen kiezen, vinkjes per wapen, smid aan het werk, wapenstapels', async ({ page }, info) => {
    test.setTimeout(180_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      const ws = window._ws = T.place('weaponsmith', [hq.cx + 3, hq.cz + 4], 3);
      const st = window._st = T.place('warehouse', [hq.cx - 3, hq.cz + 3], 3); st.level = 2; g.makeMesh(st);
      g.setAccept(st, '*', false); for (const w of VE.WEAPONS) g.setAccept(st, w, true);
      for (const [w, n] of [['sword', 12], ['spear', 10], ['battleaxe', 9], ['dagger', 12], ['bow', 9], ['crossbow', 8]]) g.addGoods(w, n);
      ws.output.sword = 3; ws.output.battleaxe = 2; g.sd = true;
      g.piles.update(g);
    });
    // infopaneel: 6 wapens om uit te kiezen
    await page.evaluate(() => window.VE.ui.select(window._ws));
    await expect(page.locator('#infoPanel .recipes.forge .rcp')).toHaveCount(7);                 // zes wapens + trainingsuitrusting
    await page.locator('#infoPanel [data-act="recipe"][data-arg="crossbow"]').click();
    expect(await page.evaluate(() => window._ws.recipe)).toBe('crossbow');
    await page.locator('#infoPanel [data-act="recipe"][data-arg="sword"]').click();
    await shot(page, info.project.name, 'wapens-paneel');
    // Storehouse: aparte vinkjes per wapentype
    await page.evaluate(() => window.VE.ui.select(window._st));
    for (const w of ['sword', 'spear', 'battleaxe', 'dagger', 'bow', 'crossbow']) await expect(page.locator('#infoPanel .sellgrid.accept .sell[data-arg="' + w + '"]')).toBeVisible();
    await page.locator('#infoPanel .sellgrid.accept .sell[data-arg="spear"]').click();
    expect(await page.evaluate(() => window._st.accept.spear)).toBe(false);
    await page.locator('#infoPanel .sellgrid.accept .sell[data-arg="spear"]').click();
    const vis = await page.evaluate(() => { const g = window.VE.game; return window.VE.WEAPONS.map(w => g.piles.meshes[w].count); });
    expect(vis.every(n => n > 0), 'elk wapen zichtbaar op een stapel').toBe(true);
    expect(await page.evaluate(() => window.VE.WEAPONS.every(w => !!window.VE.itemGlb[w]))).toBe(true);
    await page.evaluate(() => { window.VE.ui.select(null); const c = window.VE.view.cam, st = window._st; c.tx = st.cx; c.tz = st.cz + 0.1; c.tdist = c.dist = 2.4; c.tyaw = c.yaw = 0.4; });
    await page.waitForTimeout(1200);
    await shot(page, info.project.name, 'wapens-storehouse');
    // smid aan het werk: gloeiend wapen op het aambeeld, vonken, rook
    await page.evaluate(() => {
      const VE = window.VE, g = VE.game, ws = window._ws;
      ws.output = {}; ws.input.ironbar = 6; ws.input.plank = 2; g.sd = true;
      for (let t = 0; t < 30 && !(ws.working && ws.worker && ws.worker.act === 'hammer'); t += 0.1) g.update(0.1);
      g.speed = 0.4;
      const c = VE.view.cam; c.tx = ws.cx + 0.05; c.tz = ws.cz + 0.1; c.tdist = c.dist = 2.2; c.tyaw = c.yaw = 0.55;
    });
    await page.waitForTimeout(1500);
    await shot(page, info.project.name, 'wapens-smederij');
    expect(errs(errors)).toEqual([]);
  });
});
