// Kazerne en soldaten: de hele keten wapenproductie → transport → training → soldaat → besturing,
// plus opslaan/laden, sloop, ontslag, balans, interface en screenshots (desktop en mobiel).
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage, shot } = require('./helpers');

const errs = errors => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);

async function setup(page) {
  await page.evaluate(() => window.VE.glbAllReady);
  await page.evaluate(() => {
    const VE = window.VE, g = VE.game, N = VE.N;
    g.rank = 3; g.world.owned.fill(1); g.world.explored.fill(1); g.world.fogDirty = true; g.world.recolor();
    for (let n = 0; n < 14; n++) g.spawnSettler();
    window.T = {
      // vrije plek dicht bij `near`, met een deur die vanaf het dorpshuis bereikbaar is
      place(t, near, minD) {
        const hq = g.hq, sz = VE.DEFS[t].size || 1; let best = null, bd = 1e9;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          if (!g.canPlace(t, i, j, true).ok) continue;
          const d = Math.hypot(i - near[0], j - near[1]);
          if ((minD && d < minD) || d >= bd) continue;
          if (!g.pf.find(hq.doorK, (j + sz) * N + i + (sz > 1 ? 1 : 0))) continue;
          bd = d; best = [i, j];
        }
        return g.placeBuilding(t, best[0], best[1], true);
      },
      run(sec, each) { for (let t = 0; t < sec; t += 0.1) { g.arriveT = 1e9; g.update(0.1); if (each) each(t); } },
      // alle goederen in het dorp (opslag, producenten, invoer, kazerne, bouwplaatsen, dragers, rekruten in training)
      total(r) {
        let n = 0;
        for (const b of g.buildings) {
          if (!b.alive) continue;
          const h = g.held(b); n += (h && h[r]) || 0; n += (b.input && b.input[r]) || 0;
          if (b.queue) for (const e of b.queue) if (e.st === 'train') n += g.trainNeeds(e.t)[r] || 0;
        }
        for (const s of g.settlers) if (s.carry === r) n++;
        return n;
      },
      clearTrees(b, r) { for (const t of g.nature.trees.slice()) if (!t.dead && (t.x - b.cx) ** 2 + (t.z - b.cz - 1.4) ** 2 < r * r) g.nature.removeTree(t); },
      look(b, dist, pitch, yaw, dz) {
        const c = VE.view.cam; c.tx = b.cx; c.tz = b.cz + (dz || 0); c.ty = Math.max(0.3, g.world.heightAt(c.tx, c.tz)); c.tdist = c.dist = dist; c.pitch = pitch; c.tyaw = c.yaw = yaw || 0;
        if (VE.natureForceSync) VE.natureForceSync();
      },
      // schermpositie van een soldaat (midden van de figuur)
      screen(s) {
        const v = new THREE.Vector3(s.x, (s.y === undefined ? g.world.heightAt(s.x, s.z) : s.y) + 0.25, s.z).project((VE.view.camera.updateMatrixWorld(), VE.view.camera)), r = VE.view.renderer.domElement.getBoundingClientRect();
        return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
      },
      ground(x, z) {
        const v = new THREE.Vector3(x, g.world.heightAt(x, z), z).project((VE.view.camera.updateMatrixWorld(), VE.view.camera)), r = VE.view.renderer.domElement.getBoundingClientRect();
        return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
      }
    };
    VE.ui.qOpen = false; VE.ui.renderQuests(true);
    document.querySelectorAll('.toast').forEach(t => t.remove());
  });
}

test.describe('Kazerne en soldaten', () => {
  test('volledige keten: wapensmederij → dragers → kazerne → training → soldaat → besturing', async ({ page }, info) => {
    test.setTimeout(300_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      const bar = T.place('barracks', [hq.cx + 5, hq.cz + 3], 4);
      const ws = T.place('weaponsmith', [hq.cx - 4, hq.cz + 4], 3);
      T.place('warehouse', [hq.cx + 2, hq.cz + 6], 3);
      g.addGoods('plank', 40); g.addGoods('ironbar', 16); g.gold = 1000;
      // eerst trainingsuitrusting, daarna zwaarden: alles komt uit de wapensmederij (niets uit de opslag)
      const noWeapons = VE.WEAPONS.concat(['gear']).every(r => g.avail(r) === 0);
      g.setRecipe(ws, 'gear');
      const pop0 = g.settlers.length, gold0 = g.gold;
      const q = g.queueTraining(bar, 'swordsman', 2);
      const goldPaid = gold0 - g.gold;
      let carriedWeapon = 0, carriedGear = 0, trainingSeen = 0, weaponInHand = 0, waitSeen = 0, levelSwitched = false, maxRack = 0, visibleOk = true, act = {};
      const seenCarry = new Set();
      T.run(260, () => {
        for (const s of g.settlers) {
          const t = s.task;
          if (t && t.dst === bar && t.picked && !seenCarry.has(s.id + ':' + t.res + ':' + Math.round(g.time))) {
            seenCarry.add(s.id + ':' + t.res + ':' + Math.round(g.time));
          }
          if (t && t.dst === bar && t.picked && t.src === ws) { if (t.res === 'sword') carriedWeapon = 1; if (t.res === 'gear') carriedGear = 1; }
          if (s.mode === 'train') {
            if (s.entry && s.entry.st === 'wait') waitSeen++;
            if (s.entry && s.entry.st === 'train') { trainingSeen++; if (s.weapon === 'sword') weaponInHand++; act[s.act] = 1; }
          }
        }
        if (!levelSwitched && (g.stats.produced.gear || 0) >= 2) { g.setRecipe(ws, 'sword'); levelSwitched = true; }
        // zichtbare wapens in de rekken = echte voorraad in de kazerne
        if (Math.round(g.time * 10) % 20 === 0) {
          g.piles.update(g);
          const m = g.piles.meshes.sword, a = m.instanceMatrix.array; let vis = 0;
          for (let i = 0; i < m.count; i++) { const x = a[i * 16 + 12], z = a[i * 16 + 14]; if (Math.abs(x - bar.cx) < 1 && Math.abs(z - bar.cz) < 1) vis++; }
          if (vis !== (bar.input.sword || 0)) visibleOk = false;
          maxRack = Math.max(maxRack, vis);
        }
      });
      const sol = g.soldiers();
      return {
        q, goldPaid, noWeapons, carriedWeapon, carriedGear, trainingSeen, weaponInHand, waitSeen, act: Object.keys(act), visibleOk, maxRack,
        soldiers: sol.length, types: sol.map(s => s.sol.t), pop0, pop1: g.settlers.length, queueLeft: bar.queue.length,
        stats: sol[0] && { hp: sol[0].sol.hp, spd: sol[0].spd, weapon: sol[0].weapon }, trained: g.stats.trained,
        producedSword: g.stats.produced.sword || 0, producedGear: g.stats.produced.gear || 0
      };
    });
    console.log('keten', JSON.stringify(r));
    expect(r.noWeapons).toBe(true);
    expect(r.q).toBe(2);
    expect(r.goldPaid).toBe(2 * 12);
    expect(r.producedGear).toBeGreaterThanOrEqual(2);
    expect(r.producedSword).toBeGreaterThanOrEqual(2);
    expect(r.carriedGear).toBe(1);                       // dragers brachten uitrusting uit de wapensmederij
    expect(r.carriedWeapon).toBe(1);                     // en zwaarden
    expect(r.trainingSeen).toBeGreaterThan(0);
    expect(r.weaponInHand).toBe(r.trainingSeen);         // oefent met het echte zwaard
    expect(r.act).toEqual(['slash']);
    expect(r.visibleOk).toBe(true);                      // rek toont precies de voorraad
    expect(r.soldiers).toBe(2);
    expect(r.types).toEqual(['swordsman', 'swordsman']);
    expect(r.pop1).toBe(r.pop0);                         // bevolking groeit niet
    expect(r.queueLeft).toBe(0);
    expect(r.stats).toEqual({ hp: 120, spd: 1, weapon: 'sword' });

    // besturing via de interface: soldaat aantikken, op de grond tikken = bevel
    const touch = info.project.name === 'mobile';
    const tap = async (x, y) => { if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };
    const pos = await page.evaluate(() => {
      const g = window.VE.game, s = g.soldiers()[0];
      window.T.look({ cx: s.x, cz: s.z + (window.innerWidth < 600 ? 1.6 : 0) }, 7, 0.9, 0.3);
      window.VE.view.cam.update(0);
      return window.T.screen(s);
    });
    await page.waitForTimeout(300);
    await tap(pos.x, pos.y);
    await expect(page.locator('#infoPanel')).toContainText('Swordsman');
    await expect(page.locator('#infoPanel')).toContainText('Orders');
    // dubbeltik: alle zwaardvechters in beeld
    await tap(pos.x, pos.y); await page.waitForTimeout(60); await tap(pos.x, pos.y);
    expect(await page.evaluate(() => window.VE.ui.army.size)).toBe(2);
    // doel op de grond (een beloopbare tegel een stukje verderop)
    const tgt = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, s = g.soldiers()[0], w = g.world, N = VE.N;
      for (let r = 2; r < 6; r++) for (let a = 0; a < 12; a++) {
        const x = s.x + Math.cos(a) * r * 0.5, z = s.z + Math.sin(a) * r * 0.5 + 0.3, k = Math.floor(z) * N + Math.floor(x);
        if (!w.walkable(k) || w.door[k]) continue;
        const p = window.T.ground(x, z), el = document.elementFromPoint(p.x, p.y);
        if (el !== VE.view.renderer.domElement) continue;
        if (g.soldierAt(x, z, 0.5)) continue;
        return { x, z, sx: p.x, sy: p.y };
      }
      return null;
    });
    expect(tgt).not.toBeNull();
    await tap(tgt.sx, tgt.sy);
    const moved = await page.evaluate(t => {
      const g = window.VE.game, list = g.soldiers();
      const marching = list.filter(s => s.path).length;
      window.T.run(25);
      return { marching, dist: list.map(s => Math.hypot(s.x - t.x, s.z - t.z)), ord: list.map(s => s.sol.ord) };
    }, tgt);
    console.log('bevel', JSON.stringify(moved));
    expect(moved.marching).toBe(2);
    for (const d of moved.dist) expect(d).toBeLessThan(1.2);
    expect(moved.ord).toEqual(['hold', 'hold']);
    // patrouille: knop 'Patrol' en een plek kiezen → heen en weer
    await page.locator('#infoPanel [data-act="armyMode"][data-arg="patrol"]').click();
    const tgt2 = await page.evaluate(t => {
      const VE = window.VE, g = VE.game, w = g.world, N = VE.N;
      for (const dx of [1.5, -1.5, 1.2, -1.2, 1.8, -1.8]) for (const dz of [0, -0.6, 0.6, -1.2]) {
        const x = t.x + dx, z = t.z + dz, k = Math.floor(z) * N + Math.floor(x);
        if (!w.walkable(k) || w.door[k] || g.soldierAt(x, z, 0.5)) continue;
        const p = window.T.ground(x, z);
        if (document.elementFromPoint(p.x, p.y) === VE.view.renderer.domElement) return { sx: p.x, sy: p.y };
      }
      return null;
    }, tgt);
    expect(tgt2).not.toBeNull();
    await tap(tgt2.sx, tgt2.sy);
    const pat = await page.evaluate(() => {
      const g = window.VE.game, s = g.soldiers()[0], xs = [];
      window.T.run(40, t => { if (Math.abs(t % 2) < 0.05) xs.push(s.x); });
      let turns = 0; for (let i = 2; i < xs.length; i++) if ((xs[i] - xs[i - 1]) * (xs[i - 1] - xs[i - 2]) < -1e-4) turns++;
      return { ord: s.sol.ord, turns, span: Math.max(...xs) - Math.min(...xs) };
    });
    console.log('patrouille', JSON.stringify(pat));
    expect(pat.ord).toBe('patrol');
    expect(pat.turns).toBeGreaterThanOrEqual(1);
    expect(pat.span).toBeGreaterThan(0.8);
    // halt
    await page.locator('#infoPanel [data-act="armyHold"]').click();
    expect(await page.evaluate(() => window.VE.game.soldiers().every(s => s.sol.ord === 'hold' && !s.path))).toBe(true);
    await shot(page, info.project.name, 'soldaten-bevel');
    expect(errs(errors)).toEqual([]);
  });

  test('alle zes typen: training met eigen oefening en uitrusting, eigenschappen en balans', async ({ page }, info) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      const bar = T.place('barracks', [hq.cx + 5, hq.cz + 3], 4);
      T.place('warehouse', [hq.cx + 2, hq.cz + 6], 3);
      g.gold = 2000;
      for (const w of VE.WEAPONS) g.addGoods(w, 2); g.addGoods('gear', 20);
      for (const t of VE.SOLDIER_ORDER) g.queueTraining(bar, t, 1);
      const acts = {}, spots = {}; let arrows = 0, maxActive = 0;
      VE.bus.on('arrow', () => arrows++);
      T.run(200, () => {
        let active = 0;
        for (const e of bar.queue) { if (e.s) active++; if (e.st === 'train' && e.s) { acts[e.t] = e.s.act; spots[e.t] = e.spot.kind; } }
        maxActive = Math.max(maxActive, active);
      });
      const S = VE.SOLDIERS, O = VE.SOLDIER_ORDER, keys = ['hp', 'atk', 'rate', 'range', 'def', 'speed'];
      // balans: elk type heeft een sterke tegenstander en is ergens kwetsbaar; geen type is overal de beste
      const best = {};
      for (const k of keys) { const mx = Math.max(...O.map(t => S[t][k])); best[k] = O.filter(t => S[t][k] === mx); }
      const strongOk = O.every(t => S[t].strong && VE.soldierDamage(t, S[t].strong) > S[t].atk - S[S[t].strong].def * 0.5 * (1 - (S[t].pierce || 0)));
      const weakOk = O.every(t => O.some(o => S[o].strong === t));
      const unique = new Set(O.map(t => keys.map(k => S[t][k]).join('|'))).size;
      return { acts, spots, arrows, maxActive, nSpots: g.drillSpots(bar).length, soldiers: g.soldiers().map(s => s.sol.t).sort(), best, strongOk, weakOk, unique,
        bow: g.soldiers('archer')[0] && g.soldiers('archer')[0].weapon };
    });
    console.log('typen', JSON.stringify(r));
    expect(r.soldiers).toEqual(['archer', 'axeman', 'crossbowman', 'dagger', 'spearman', 'swordsman']);
    expect(r.acts).toEqual({ swordsman: 'slash', archer: 'shoot', spearman: 'thrust', dagger: 'stab', axeman: 'cleave', crossbowman: 'xbow' });
    expect(r.spots.archer).toBe('target'); expect(r.spots.crossbowman).toBe('target');   // schutters op de schietschijf
    expect(r.spots.spearman).toBe('drill');                                                // speer aan de oefenpaal
    expect(r.spots.swordsman).toBe('dummy');
    expect(r.arrows).toBeGreaterThan(5);                                                    // er vliegen echt pijlen
    expect(r.maxActive).toBeLessThanOrEqual(r.nSpots);
    expect(r.unique).toBe(6);
    expect(r.strongOk).toBe(true);
    expect(r.weakOk).toBe(true);
    for (const k in r.best) expect(r.best[k].length).toBeLessThan(6);
    expect(new Set(Object.values(r.best).flat()).size).toBeGreaterThanOrEqual(4);          // de sterke punten zijn verdeeld
    expect(r.bow).toBe('bow');
    // het renderen: elk type zijn eigen helm en wapen in de hand
    const rend = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, sr = g.sr;
      sr.render(g.settlers);
      const n = k => (sr.part[k] ? sr.part[k].mesh.count : -1);
      const w = k => (sr.weapons && sr.weapons[k] ? sr.weapons[k].mesh.count : -1);
      return { glb: VE.settlerSource, helms: ['helm_nasal', 'hood_archer', 'helm_plume', 'hood_rogue', 'helm_fur', 'helm_brim'].map(h => n('head__' + h)),
        shields: [n('armL__shield_round'), n('armL__shield_kite')], weapons: VE.WEAPONS.map(w) };
    });
    console.log('render', JSON.stringify(rend));
    if (rend.glb === 'glb') {
      for (const c of rend.helms) expect(c).toBeGreaterThanOrEqual(1);
      for (const c of rend.shields) expect(c).toBeGreaterThanOrEqual(1);
      expect(rend.weapons).toEqual([1, 1, 1, 2, 1, 1]);                                      // dolkvechter: twee dolken
    }
    // screenshot: alle typen op een rij voor de kazerne, rekruten aan het oefenen
    await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, bar = g.buildings.find(b => b.type === 'barracks');
      T.clearTrees(bar, 3.2);
      g.queueTraining(bar, 'swordsman', 1); g.queueTraining(bar, 'archer', 1); g.queueTraining(bar, 'spearman', 1);
      g.addGoods('sword', 1); g.addGoods('bow', 1); g.addGoods('spear', 1);
      T.run(24);
      g.soldiers().forEach((s, k) => { s.path = null; s.x = bar.cx - 1.25 + k * 0.5; s.z = bar.cz + 1.75; s.rot = 0; s.sol.face = 0; s.sol.h = [s.x, s.z]; });
      T.look(bar, window.innerWidth < 600 ? 7.5 : 4.8, 0.6, 0.25, 0.8);
      for (let i = 0; i < 40; i++) g.fx.update(0.1, 0);           // wolkjes van net klaar getrainde soldaten laten uitdoven
      document.querySelectorAll('.toast').forEach(t => t.remove());
    });
    await page.waitForTimeout(1500);
    await shot(page, info.project.name, 'kazerne-training');
    expect(errs(errors)).toEqual([]);
  });

  test('interface: wachtrij, kosten, voortgang, wapens, afbreken en ontslaan', async ({ page }, info) => {
    test.setTimeout(180_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      window._bar = T.place('barracks', [hq.cx + 5, hq.cz + 3], 4);
      T.place('warehouse', [hq.cx + 2, hq.cz + 6], 3);
      g.gold = 500; g.addGoods('bow', 3); g.addGoods('gear', 10);
      T.look(window._bar, 9, 0.9, 0.3);
      VE.ui.select(window._bar);
    });
    const panel = page.locator('#infoPanel');
    await expect(panel).toContainText('Train soldiers');
    await expect(panel.locator('.tcard')).toHaveCount(6);
    await expect(panel).toContainText('Weapons');
    // +1 boogschutter, +5 boogschutters via de knoppen
    const gold0 = await page.evaluate(() => window.VE.game.gold);
    const btn = (t, n) => panel.locator(`[data-act="trainQ"][data-arg="${t}"][data-n="${n}"]`);
    await btn('archer', 1).click();
    await expect(panel).toContainText('Training queue (1)');
    await btn('archer', 5).click();
    await expect(panel).toContainText('Training queue (6)');
    expect(await page.evaluate(() => window.VE.game.gold)).toBe(gold0 - 6 * 8);
    // drie trainen (3 bogen), de rest wacht op bogen
    await page.evaluate(() => window.T.run(14));
    await expect(panel.locator('[data-qp]').first()).toBeVisible();
    // wapenrek en stapel: zichtbaar = voorraad in de kazerne
    const vis = await page.evaluate(() => { const g = window.VE.game, b = window._bar; g.piles.update(g); const c = r => { const m = g.piles.meshes[r], a = m.instanceMatrix.array; let n = 0; for (let i = 0; i < m.count; i++) if (Math.abs(a[i * 16 + 12] - b.cx) < 1 && Math.abs(a[i * 16 + 14] - b.cz) < 1) n++; return n; }; return { bow: c('bow'), gear: c('gear'), inBow: b.input.bow || 0, inGear: b.input.gear || 0 }; });
    expect(vis.bow).toBe(vis.inBow); expect(vis.gear).toBe(vis.inGear); expect(vis.inBow).toBeGreaterThan(0);
    await expect(panel).toContainText(/needs bows|waiting for a volunteer|carriers bring/);
    const w = await panel.locator('[data-qp]').first().evaluate(el => parseFloat(el.style.width));
    expect(w).toBeGreaterThan(0);
    // laatste plek afbreken: goud terug
    const g1 = await page.evaluate(() => window.VE.game.gold);
    await panel.locator('[data-act="trainCancel"]').last().click();
    await expect(panel).toContainText('Training queue (5)');
    expect(await page.evaluate(() => window.VE.game.gold)).toBe(g1 + 8);
    await shot(page, info.project.name, 'kazerne-paneel');
    // trainen afmaken, dan het leger-overzicht via de knop rechtsboven en ontslaan
    await page.evaluate(() => window.T.run(80));
    await expect(page.locator('#btnArmy')).toBeVisible();
    await expect(page.locator('#armyBadge')).toHaveText(/\d+/);
    await page.locator('#btnArmy').click();
    await expect(panel).toContainText(/archers|Archer/);
    const before = await page.evaluate(() => ({ n: window.VE.game.soldiers().length, bow: window.T.total('bow'), pop: window.VE.game.settlers.length }));
    expect(before.n).toBeGreaterThanOrEqual(2);
    await shot(page, info.project.name, 'leger-paneel');
    await panel.locator('[data-act="armyDismiss"]').click();
    await page.locator('#modal [data-act="armyDismissYes"]').click();
    const after = await page.evaluate(() => ({ n: window.VE.game.soldiers().length, bow: window.T.total('bow'), pop: window.VE.game.settlers.length }));
    expect(after.n).toBe(0);
    expect(after.bow).toBe(before.bow + before.n);       // bogen terug in de opslag
    expect(after.pop).toBe(before.pop);
    expect(errs(errors)).toEqual([]);
  });

  test('kader trekken, rechtsklik-bevel en formatie', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'muis: shift-slepen en rechtsklik (touch gebruikt de knop "Drag to select", hieronder ook getest)');
    test.setTimeout(150_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    const c = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, hq = g.hq, w = g.world, N = VE.N;
      const out = [];
      let k = 0;
      for (let j = Math.floor(hq.cz) + 3; j < Math.floor(hq.cz) + 9 && k < 6; j++) for (let i = Math.floor(hq.cx) - 3; i < Math.floor(hq.cx) + 4 && k < 6; i++) {
        if (!w.walkable(j * N + i)) continue;
        const s = g.spawnSettler(); s.x = i + 0.5; s.z = j + 0.5; g.makeSoldier(s, VE.SOLDIER_ORDER[k++]); out.push(s);
      }
      let cx = 0, cz = 0; for (const s of out) { cx += s.x; cz += s.z; } cx /= out.length; cz /= out.length;
      const cam = VE.view.cam; cam.tx = cx; cam.tz = cz; cam.ty = Math.max(0.3, w.heightAt(cx, cz)); cam.tdist = cam.dist = 14; cam.pitch = 1.2; cam.update(0);
      const pts = out.map(s => window.T.screen(s));
      return { n: out.length, x0: Math.min(...pts.map(p => p.x)) - 30, x1: Math.max(...pts.map(p => p.x)) + 30, y0: Math.min(...pts.map(p => p.y)) - 40, y1: Math.max(...pts.map(p => p.y)) + 40, cx, cz };
    });
    await page.keyboard.down('Shift');
    await page.mouse.move(c.x0, c.y0); await page.mouse.down();
    await page.mouse.move((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, { steps: 4 });
    await expect(page.locator('#boxSel')).toBeVisible();
    await page.mouse.move(c.x1, c.y1, { steps: 4 }); await page.mouse.up();
    await page.keyboard.up('Shift');
    expect(await page.evaluate(() => window.VE.ui.army.size)).toBe(c.n);
    await expect(page.locator('#infoPanel .chip')).toHaveCount(c.n);
    // rechtsklik op de grond: bevel in formatie (melee voorop)
    const t = await page.evaluate(c => { const x = c.cx + 2.2, z = c.cz + 1.2, p = window.T.ground(x, z); return { x, z, sx: p.x, sy: p.y }; }, c);
    await page.mouse.click(t.sx, t.sy, { button: 'right' });
    const f = await page.evaluate(t => {
      const g = window.VE.game, list = [...window.VE.ui.army];
      const n = list.filter(s => s.path).length;
      window.T.run(30);
      const pos = list.map(s => [s.x, s.z]);
      let minD = 9; for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) minD = Math.min(minD, Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]));
      const maxT = Math.max(...pos.map(p => Math.hypot(p[0] - t.x, p[1] - t.z)));
      return { n, minD, maxT };
    }, t);
    console.log('formatie', JSON.stringify(f));
    expect(f.n).toBe(c.n);
    expect(f.minD).toBeGreaterThan(0.3);      // niet op één hoop
    expect(f.maxT).toBeLessThan(1.6);         // dicht bij het doel
    // knop 'Drag to select' (ook voor touch): één sleep zonder shift
    await page.locator('#infoPanel [data-act="armyClear"]').click();
    await page.evaluate(() => { window.VE.ui.selectArmy(window.VE.game.soldiers().slice(0, 1)); });
    await page.locator('#infoPanel [data-act="boxSel"]').click();
    const c2 = await page.evaluate(() => {
      const pts = window.VE.game.soldiers().map(s => window.T.screen(s));
      return { x0: Math.min(...pts.map(p => p.x)) - 40, x1: Math.max(...pts.map(p => p.x)) + 40, y0: Math.min(...pts.map(p => p.y)) - 50, y1: Math.max(...pts.map(p => p.y)) + 50 };
    });
    await page.mouse.move(c2.x0, c2.y0); await page.mouse.down(); await page.mouse.move(c2.x1, c2.y1, { steps: 6 }); await page.mouse.up();
    expect(await page.evaluate(() => window.VE.ui.army.size)).toBe(c.n);
    expect(errs(errors)).toEqual([]);
  });

  test('opslaan en laden: soldaten, bevelen en wachtrij blijven; sloop geeft alles terug', async ({ page }, info) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      const bar = T.place('barracks', [hq.cx + 5, hq.cz + 3], 4);
      T.place('warehouse', [hq.cx + 2, hq.cz + 6], 3);
      g.gold = 800; g.addGoods('spear', 4); g.addGoods('dagger', 2); g.addGoods('gear', 10);
      g.queueTraining(bar, 'spearman', 2);
      T.run(60);                                          // twee speervechters klaar
      g.queueTraining(bar, 'dagger', 2);
      T.run(12);                                          // twee dolkvechters midden in de training
      const sols = g.soldiers();
      if (sols.length) g.orderSoldiers(sols.slice(0, 1), sols[0].x + 2, sols[0].z + 1, 'patrol');
      T.run(3);
      const totals = r => T.total(r) + g.soldiers().filter(s => VE.SOLDIERS[s.sol.t].weapon === r).length;
      const before = { pop: g.settlers.length, sol: g.soldiers().map(s => s.sol.t).sort(), q: bar.queue.map(e => e.t), spear: totals('spear'), dagger: totals('dagger'), gear: T.total('gear'),
        ord: g.soldiers().map(s => s.sol.ord).sort(), gold: g.gold };
      const save = JSON.parse(JSON.stringify(g.serialize()));
      return { before, save, inTraining: bar.queue.filter(e => e.st === 'train').length };
    });
    console.log('voor', JSON.stringify(r.before), 'in training', r.inTraining);
    expect(r.inTraining).toBeGreaterThanOrEqual(1);
    expect(r.save.v).toBe(4);
    expect(r.save.sol.length).toBe(r.before.sol.length);
    const after = await page.evaluate(save => {
      const VE = window.VE;
      VE.sdk.set('village_empire_save_v1', JSON.stringify(save));
      const g0 = VE.game; g0.dispose();
      const g = new VE.Game(VE.view.scene); VE.game = g; g.init(save);
      g.sr = VE.makeSettlerRender(g.root); g.fx = new VE.FX(g.root, g); g.piles = new VE.StockpileRender(g.root); g.started = true;
      const bar = g.buildings.find(b => b.type === 'barracks');
      const T = window.T;
      const totals = r => T.total(r) + g.soldiers().filter(s => VE.SOLDIERS[s.sol.t].weapon === r).length;
      const res = { pop: g.settlers.length, sol: g.soldiers().map(s => s.sol.t).sort(), q: bar.queue.map(e => e.t), spear: totals('spear'), dagger: totals('dagger'), gear: T.total('gear'),
        ord: g.soldiers().map(s => s.sol.ord).sort(), gold: g.gold };
      // na het laden gaat de training gewoon verder
      for (let t = 0; t < 90; t += 0.1) { g.arriveT = 1e9; g.update(0.1); }
      res.solLater = g.soldiers().length; res.qLater = bar.queue.length;
      // sloop: goud van de wachtrij en de spullen in de kazerne komen terug, rekruten zijn weer vrij
      g.queueTraining(bar, 'dagger', 1); g.addGoods('dagger', 1);
      for (let t = 0; t < 12; t += 0.1) { g.arriveT = 1e9; g.update(0.1); }
      const goldQ = g.gold, dag = totals('dagger');
      g.demolish(bar);
      res.goldBack = g.gold - goldQ; res.dagLost = dag - totals('dagger'); res.trainees = g.settlers.filter(s => s.mode === 'train').length;
      return res;
    }, r.save);
    console.log('na', JSON.stringify(after));
    expect(after.pop).toBe(r.before.pop);
    expect(after.sol).toEqual(r.before.sol);
    expect(after.ord).toEqual(r.before.ord);
    expect(after.q).toEqual(r.before.q);
    expect(after.spear).toBe(r.before.spear);
    expect(after.dagger).toBe(r.before.dagger);
    expect(after.gear).toBe(r.before.gear);
    expect(after.gold).toBe(r.before.gold);
    expect(after.solLater).toBe(4);
    expect(after.qLater).toBe(0);
    expect(after.goldBack).toBe(6);
    expect(after.dagLost).toBe(0);
    expect(after.trainees).toBe(0);
    expect(errs(errors)).toEqual([]);
  });
});
