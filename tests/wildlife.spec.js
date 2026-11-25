// Wilde dieren, jacht, mijnbouw en metaal: gedrag, bouwregels, economie, opslaan en screenshots.
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage, shot } = require('./helpers');

const checkErrors = (errors, info) => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);

/* Demo-opstelling: rang Town, hele kaart van jou en ontdekt, een mijn bij elke ertssoort, smelterij en jagershut. */
async function demo(page) {
  return page.evaluate(() => {
    const VE = window.VE, g = VE.game, w = g.world, N = VE.N;
    g.rank = 3; w.owned.fill(1); w.explored.fill(1); w.fogDirty = true; w.recolor();
    Object.assign(g.stock, { plank: 300, stone: 300, ironbar: 20, coal: 10, ironore: 10 });
    const find = (t, near, rmax) => {
      let best = null, bd = 1e9;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        if (!g.canPlace(t, i, j).ok) continue;
        const d = near ? Math.hypot(i - near[0], j - near[1]) : 0;
        if (near && rmax && d > rmax) continue;
        if (d < bd) { bd = d; best = [i, j]; }
        if (!near) return best;
      }
      return best;
    };
    const out = {};
    for (const t of ['coalmine', 'ironmine', 'coppermine', 'goldmine']) {
      const s = find(t, [g.hq.cx, g.hq.cz]);
      if (s) { const b = g.placeBuilding(t, s[0], s[1], true); out[t] = [b.cx, b.cz]; }
    }
    const sm = find('smelter', [g.hq.cx + 4, g.hq.cz + 1], 9);
    if (sm) { const b = g.placeBuilding('smelter', sm[0], sm[1], true); out.smelter = [b.cx, b.cz]; window._sm = b; }
    // jagershut bij een bosrand met wild
    // jagershut waar het meeste wild zit (binnen bereik van het dorp)
    let hu = null, hs = -1;
    for (let j = 2; j < N - 2; j++) for (let i = 2; i < N - 2; i++) {
      if (Math.hypot(i - g.hq.cx, j - g.hq.cz) > 16 || !g.canPlace('hunter', i, j).ok) continue;
      const sc = g.wild.list.filter(a => !a.dead && a.sp.hunt && Math.hypot(a.x - i - 0.5, a.z - j - 0.5) < 7).length;
      if (sc > hs) { hs = sc; hu = [i, j]; }
    }
    if (hu) { const b = g.placeBuilding('hunter', hu[0], hu[1], true); out.hunter = [b.cx, b.cz]; }
    // opslag voor de productieketens (sinds 1.4.0 houden producenten er zelf maar 6)
    for (const at of [[g.hq.cx - 3, g.hq.cz + 3], [g.hq.cx + 3, g.hq.cz - 2]]) {
      const s = find('warehouse', at, 8);
      if (s) { const b = g.placeBuilding('warehouse', s[0], s[1], true); b.level = 3; g.makeMesh(b); g.setAccept(b, '*', true); }
    }
    for (let n = 0; n < 20; n++) g.spawnSettler();
    document.querySelectorAll('.toast').forEach(t => t.remove());
    return out;
  });
}
async function look(page, x, z, dist, yaw, pitch) {
  await page.evaluate(({ x, z, dist, yaw, pitch }) => {
    const c = window.VE.view.cam;
    c.tx = x; c.tz = z; c.tdist = c.dist = dist;
    if (yaw !== undefined) c.tyaw = c.yaw = yaw;
    if (pitch !== undefined) c.pitch = pitch;
    window.VE.natureForceSync && window.VE.natureForceSync();
  }, { x, z, dist, yaw, pitch });
  await page.waitForTimeout(900);
}
async function run(page, seconds) {
  await page.evaluate(s => { const g = window.VE.game; for (let t = 0; t < s; t += 0.05) g.update(0.05); }, seconds);
}

/* Dierenparade: van elke soort een dier op een rij (stilgezet, animaties lopen door) */
async function parade(page, states) {
  return page.evaluate(states => {
    const VE = window.VE, g = VE.game, w = g.world, wl = g.wild;
    g.speed = 0;                                           // simulatie stil; de weergave (en animaties) loopt door
    const keys = ['rabbit', 'squirrel', 'bird', 'fox', 'roe', 'boar', 'deer'];
    // vlak, vrij stuk land naast het dorpshuis
    const x0 = g.hq.cx - 3.2, z0 = g.hq.cz + 4.2;
    for (const a of wl.list) if (Math.hypot(a.x - x0 - 2, a.z - z0) < 6) a.dead = true;
    for (const t of g.nature.trees) if (!t.dead && t.x > x0 - 2.5 && t.x < x0 + 7 && t.z > z0 - 3 && t.z < z0 + 3) g.nature.removeTree(t);
    let x = x0;
    keys.forEach((k, i) => {
      for (let row = 0; row < states.length; row++) {
        const a = wl.add(VE.SPECIES[k], x, z0 + row * 0.9, 0, false);
        a.state = states[row]; a.t = 999; a.rot = 0.5 + row * 0.4; a.stag = true; a.spd = 0.5;
        if (a.state === 'up') { a.y = 0; a.state = 'idle'; }
      }
      x += k === 'deer' || k === 'roe' || k === 'boar' ? 0.75 : 0.5;
    });
    for (let dx = -1; dx < 9; dx++) for (let dz = -1; dz < 3; dz++) w.clearDeco(Math.floor(z0 + dz) * VE.N + Math.floor(x0 + dx));
    return [x0 + (x - x0) / 2 - 0.25, z0 + (states.length - 1) * 0.45];
  }, states);
}

test.describe('wildlife & mijnbouw: logica', () => {
  test('ertsaders, bouwregels voor mijnen en determinisme', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'logica: alleen desktop');
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, N = VE.N, M = VE.Mining;
      const out = { types: {}, onMountain: true, dist: {} };
      const cx = w.start.i + 1, cz = w.start.j + 1;
      for (const d of w.deposits) {
        out.types[d.type] = (out.types[d.type] || 0) + d.amount;
        if (w.type[d.k] !== 2) out.onMountain = false;
        const dd = Math.hypot(d.x - cx, d.z - cz);
        out.dist[d.type] = Math.min(out.dist[d.type] || 1e9, dd);
      }
      // dichtste steenkool- en ijzerader: er past een mijn naast
      // dichtstbijzijnde plek waar een mijn naast een ader van deze soort past (garantie van de generator)
      const spotNear = (W, t) => {
        const ds = W.deposits.filter(d => d.type === t).sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz));
        for (const d of ds) for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++)
          if (Math.hypot(di, dj) <= 2.4 && M.mineSpot(W, d.i + di, d.j + dj)) return [d.i + di, d.j + dj, Math.hypot(d.x - cx, d.z - cz)];
        return null;
      };
      out.coalSpot = spotNear(w, 1); out.ironSpot = spotNear(w, 2);
      // 30 andere werelden: overal steenkool en ijzer met een mijnplek, op bereikbare afstand
      out.seeds = [];
      for (let s = 1; s <= 30; s++) {
        const W = new VE.World((s * 2654435761) >>> 0, new THREE.Group()); W.generate();
        W.ore = new Array(N * N).fill(null); W.deposits = []; M.generate(W);
        // afstand vanaf de startplek van díe wereld (in de grote wereld ligt de start per seed ergens anders)
        const sx = W.start.i + 1, sz = W.start.j + 1;
        const near = t => { const ds = W.deposits.filter(d => d.type === t).sort((a, b) => Math.hypot(a.x - sx, a.z - sz) - Math.hypot(b.x - sx, b.z - sz));
          for (const d of ds) for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (Math.hypot(di, dj) <= 2.4 && M.mineSpot(W, d.i + di, d.j + dj)) return Math.hypot(d.x - sx, d.z - sz);
          return 999; };
        out.seeds.push(Math.max(near(1), near(2)));
      }
      // bouwregels (territorium overal, rang 2)
      g.rank = 2; w.owned.fill(1);
      const why = (t, i, j) => g.canPlace(t, i, j);
      out.onGrass = why('coalmine', g.hq.i + 3, g.hq.j + 3).why;
      // ondergronds: niets zichtbaars in de wereld; bouwen bóven een voorraad mag
      out.oreMeshes = 0; g.root.traverse(o => { if (/^ore_/.test(o.name || '')) out.oreMeshes++; });
      out.good = why('coalmine', out.coalSpot[0], out.coalSpot[1]);
      // een steenkoolplek zonder ijzer in de buurt: een ijzermijn mag daar niet, met een tip
      let cs = null;
      for (const d of w.deposits.filter(d => d.type === 1)) for (let dj = -2; dj <= 2 && !cs; dj++) for (let di = -2; di <= 2 && !cs; di++) {
        const i = d.i + di, j = d.j + dj;
        if (M.mineSpot(w, i, j) && g.canPlace('coalmine', i, j).ok && !M.near(w, i + 0.5, j + 0.5, 2, 2.6)) cs = [i, j];
      }
      out.wrongOre = cs ? why('ironmine', cs[0], cs[1]) : { ok: false, why: 'No iron below this spot, but coal (geen losse plek)' };
      // berg zonder erts in de buurt
      let bare = null;
      for (let j = 1; j < N - 2 && !bare; j++) for (let i = 1; i < N - 1 && !bare; i++) {
        const k = j * N + i;
        if (w.type[k] === 2 && !w.rock[k] && !w.ore[k] && !M.anyNear(w, i + 0.5, j + 0.5, 3) && w.slope(i, j, 1) < 1.5 && !w.rock[k + N] && w.type[k + N] !== 1) bare = [i, j];
      }
      out.bare = bare ? why('coalmine', bare[0], bare[1]).why : 'geen';
      // gewone gebouwen niet op de berg
      out.houseOnMountain = why('house', out.coalSpot[0], out.coalSpot[1]).why;
      // determinisme: dezelfde seed geeft dezelfde aders en dezelfde dieren
      const sv = JSON.parse(JSON.stringify(g.serialize()));
      delete sv.ore; delete sv.wild;
      const a = new VE.Game(VE.view.scene); a.init({ seed: g.seed, buildings: [{ id: 1, t: 'hq', i: g.hq.i, j: g.hq.j, l: 1, b: 1 }], stock: {}, nature: g.nature.serialize() });
      const b = new VE.Game(VE.view.scene); b.init({ seed: g.seed, buildings: [{ id: 1, t: 'hq', i: g.hq.i, j: g.hq.j, l: 1, b: 1 }], stock: {}, nature: g.nature.serialize() });
      out.sameOre = JSON.stringify(VE.Mining.serialize(a.world)) === JSON.stringify(VE.Mining.serialize(b.world));
      out.sameWild = JSON.stringify(a.wild.serialize()) === JSON.stringify(b.wild.serialize());
      out.oreLen = VE.Mining.serialize(a.world).length;
      a.dispose(); b.dispose();
      return out;
    });
    console.log('ertsaders:', JSON.stringify({ types: r.types, dist: r.dist }));
    for (const t of [1, 2, 3, 4]) expect(r.types[t], 'erts ' + t).toBeGreaterThan(0);
    expect(r.types[1]).toBeGreaterThan(r.types[4]);                  // steenkool algemeen, goud zeldzaam
    expect(r.onMountain, 'alle aders op bergtegels').toBe(true);
    expect(r.coalSpot, 'mijn past naast de dichtste steenkoolader').not.toBeNull();
    expect(r.ironSpot, 'mijn past naast de dichtste ijzerader').not.toBeNull();
    expect(r.dist[1], 'steenkool bereikbaar').toBeLessThan(26);
    expect(r.dist[2], 'ijzer bereikbaar').toBeLessThan(26);
    console.log('mijnplek steenkool+ijzer over 30 seeds (max afstand):', JSON.stringify(r.seeds));
    expect(Math.max(...r.seeds), 'elke wereld: steenkool en ijzer met mijnplek binnen bereik').toBeLessThan(28);
    expect(r.onGrass).toBe('Mines can only be built on the mountain');
    expect(r.oreMeshes, 'geen zichtbare ertsaders').toBe(0);
    expect(r.good.ok).toBe(true);
    expect(r.good.why).toMatch(/(small|good|rich) coal deposit below \(about \d+\)/);
    expect(r.wrongOre.ok).toBe(false);
    expect(r.wrongOre.why).toMatch(/No iron below this spot, but (coal|copper|gold): try a /);
    expect(r.bare).toMatch(/No coal found below this spot|geen/);
    expect(r.houseOnMountain).toBe('Too rocky here');
    expect(r.sameOre && r.sameWild, 'deterministisch').toBe(true);
    expect(r.oreLen).toBeGreaterThan(10);
    expect(checkErrors(errors, info)).toEqual([]);
  });

  test('productieketens: mijnen, smelterij (recept wisselen), jacht; niets uit het niets', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'logica: alleen desktop');
    test.setTimeout(180_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await demo(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world;
      const ore0 = {}; for (const d of w.deposits) ore0[d.type] = (ore0[d.type] || 0) + d.amount;
      const wild0 = g.wild.list.filter(a => !a.dead && a.sp.hunt).length;
      const stock0 = Object.assign({}, g.stock);
      const sm = window._sm;
      for (let t = 0; t < 300; t += 0.05) g.update(0.05);
      const mid = { ironbar: g.stats.produced.ironbar || 0, inp: Object.assign({}, sm.input) };
      g.setRecipe(sm, 'copperbar');
      const afterSwitch = Object.assign({}, sm.output);
      for (let t = 0; t < 300; t += 0.05) g.update(0.05);
      const ore1 = {}; for (const d of w.deposits) ore1[d.type] = (ore1[d.type] || 0) + d.amount;
      const P = g.stats.produced;
      const caught = wild0 + 0;
      const carrying = {}; for (const s of g.settlers) if (s.role === 'miner' && s.carry) carrying[s.carry] = (carrying[s.carry] || 0) + 1;
      return { carrying: carrying, P: P, ore0: ore0, ore1: ore1, mid: mid, afterSwitch: afterSwitch, recipe: sm.recipe, stock0: stock0, stock: Object.assign({}, g.stock),
        status: g.buildings.filter(b => b.def.gather === 'ore' || b.def.gather === 'hunt' || b.def.recipes).map(b => b.type + ': ' + b.status),
        wild: g.wild.list.filter(a => !a.dead && a.sp.hunt).length, wild0: caught };
    });
    console.log('productie:', JSON.stringify({ P: r.P, status: r.status }));
    // mijnen leveren alleen wat er in de aders zat
    const mined = t => r.ore0[t] - (r.ore1[t] || 0);
    expect(r.P.coal).toBeGreaterThan(5);
    expect(r.P.ironore).toBeGreaterThan(5);
    expect(r.P.copperore).toBeGreaterThan(3);
    // wat de mijnwerker net heeft losgehakt en nog naar de mijn draagt, telt mee
    const got = res => (r.P[res] || 0) + (r.carrying[res] || 0);
    expect(got('coal')).toBe(mined(1));
    expect(got('ironore')).toBe(mined(2));
    expect(got('copperore')).toBe(mined(3));
    expect(got('goldore')).toBe(mined(4));
    // smelterij: ijzer, daarna koper; staven kosten erts en steenkool
    expect(r.mid.ironbar).toBeGreaterThan(2);
    expect(r.recipe).toBe('copperbar');
    expect(r.P.copperbar || 0).toBeGreaterThan(0);
    expect(r.P.ironbar * 2).toBeLessThanOrEqual(r.P.ironore + r.stock0.ironore);
    expect((r.P.ironbar + r.P.copperbar) * 1).toBeLessThanOrEqual(r.P.coal + r.stock0.coal);
    // jacht
    expect(r.P.meat || 0).toBeGreaterThan(0);
    expect(r.wild).toBeLessThan(r.wild0 + 40);
    expect(checkErrors(errors, info)).toEqual([]);
  });

  test('wilde dieren: leefgebied, niet door obstakels, dorp mijden, duurzame jacht en herstel', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'logica: alleen desktop');
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, wl = g.wild, N = VE.N;
      g.rank = 2; w.owned.fill(1);
      const count = () => { const c = {}; for (const a of wl.list) if (!a.dead) c[a.key] = (c[a.key] || 0) + 1; return c; };
      const c0 = count();
      // drie jagershutten bij het meeste wild
      const hunters = [];
      const scoreAt = (x, z) => wl.list.filter(a => !a.dead && a.sp.hunt && Math.hypot(a.x - x, a.z - z) < 8).length;
      const spots = [];
      for (let j = 4; j < N - 4; j += 2) for (let i = 4; i < N - 4; i += 2) if (g.canPlace('hunter', i, j).ok) spots.push([i, j, scoreAt(i + 0.5, j + 0.5)]);
      spots.sort((a, b) => b[2] - a[2]);
      for (const s of spots) {
        if (hunters.length >= 3) break;
        if (hunters.some(h => Math.hypot(h.i - s[0], h.j - s[1]) < 7)) continue;
        hunters.push(g.placeBuilding('hunter', s[0], s[1], true));
      }
      for (let n = 0; n < 15; n++) g.spawnSettler();
      let bad = 0, inVillage = 0, samples = 0, minSeen = {};
      for (let t = 0; t < 900; t += 0.05) {
        g.update(0.05);
        if (Math.round(t * 20) % 200 === 0) {
          const c = count();
          for (const k in VE.SPECIES) if (VE.SPECIES[k].hunt) minSeen[k] = Math.min(minSeen[k] === undefined ? 99 : minSeen[k], c[k] || 0);
          for (const a of wl.list) {
            if (a.dead) continue;
            samples++;
            const k = Math.floor(a.z) * N + Math.floor(a.x);
            const flying = a.state === 'fly' || a.y > 0.05;
            if (!flying && !wl.passable(k)) bad++;
            if (a.key !== 'bird' && Math.hypot(a.x - g.hq.cx, a.z - g.hq.cz) < 3) inVillage++;
          }
        }
      }
      const meat = g.stats.produced.meat || 0;
      const c1 = count();
      // jagers weg: het wild herstelt
      for (const h of hunters) g.demolish(h);
      for (let t = 0; t < 900; t += 0.05) g.update(0.05);
      const c2 = count();
      return { c0, c1, c2, minSeen, bad, inVillage, samples, meat, hunters: hunters.length, minKeep: Object.fromEntries(Object.keys(VE.SPECIES).map(k => [k, VE.SPECIES[k].minKeep || 0])) };
    });
    console.log('dieren:', JSON.stringify(r));
    expect(r.hunters).toBeGreaterThan(0);
    expect(r.meat, 'jagers brengen vlees').toBeGreaterThan(5);
    expect(r.bad, 'nooit in water, op bergen of in gebouwen').toBe(0);
    expect(r.inVillage, 'dieren mijden de dorpskern').toBeLessThan(r.samples * 0.01 + 2);
    for (const k of ['rabbit', 'roe', 'deer', 'boar']) {
      expect(r.minSeen[k], k + ' nooit uitgeroeid').toBeGreaterThanOrEqual(Math.min(r.c0[k], r.minKeep[k]));
      expect(r.c2[k] || 0, k + ' herstelt').toBeGreaterThanOrEqual(r.c1[k] || 0);
    }
    for (const k of ['fox', 'squirrel', 'bird']) expect(r.c2[k] || 0, k + ' (niet bejaagd)').toBeGreaterThan(0);
    expect(checkErrors(errors, info)).toEqual([]);
  });

  test('opslaan/laden, oude saves, UI (balk, uitleg bij plaatsen, recept kiezen) en Village Charter', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'logica: alleen desktop');
    test.setTimeout(120_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const ui0 = await page.evaluate(() => ({ hidden: ['meat', 'coal', 'goldbar'].map(r => document.getElementById('res_' + r).classList.contains('hidden')) }));
    expect(ui0.hidden, 'nieuwe goederen nog verborgen bij Hamlet').toEqual([true, true, true]);
    await demo(page);
    await run(page, 120);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world;
      VE.ui.refreshHud(true);
      const shown = ['meat', 'coal', 'ironbar', 'goldbar'].map(x => !document.getElementById('res_' + x).classList.contains('hidden'));
      // recept kiezen via het infopaneel
      const sm = window._sm; VE.ui.select(sm);
      const btn = document.querySelector('[data-act="recipe"][data-arg="copperbar"]'); btn.click();
      const recipeAfterClick = sm.recipe;
      VE.ui.select(null);
      // live uitleg tijdens het plaatsen van een mijn
      VE.ui.setTool('ironmine');
      const dep = w.deposits.find(d => d.type === 2);
      VE.ui.updateGhost({ i: g.hq.i + 2, j: g.hq.j + 2, x: g.hq.i + 2.5, z: g.hq.j + 2.5 });
      const whyBad = document.getElementById('toolHintWhy').textContent, clsBad = document.getElementById('toolHintWhy').className;
      VE.ui.update(0.5); VE.ui.update(0.5);
      const rings = w.surveyU.value;                                 // informatielaag zichtbaar tijdens het plaatsen
      VE.ui.setTool(null);
      // opslaan en laden
      const save = JSON.parse(JSON.stringify(g.serialize()));
      const g2 = new VE.Game(VE.view.scene); g2.init(save);
      const same = {
        ore: JSON.stringify(VE.Mining.serialize(g2.world)) === JSON.stringify(save.ore),
        wild: g2.wild.list.filter(a => !a.dead).length === save.wild.length,
        recipe: g2.buildings.find(b => b.type === 'smelter').recipe,
        stock: ['coal', 'ironore', 'ironbar', 'meat'].every(x => g2.stock[x] === save.stock[x]) || JSON.stringify(['coal', 'ironore', 'ironbar', 'meat'].map(x => [g2.stock[x], save.stock[x]])),
        mines: g2.buildings.filter(b => b.def.mountain).length
      };
      g2.dispose();
      // oude save (zonder aders, dieren en recept) laadt ook
      // (oud formaat v1: één totale voorraad, geen opslag per gebouw)
      const old = JSON.parse(JSON.stringify(save)); delete old.ore; delete old.wild; old.v = 1; for (const b of old.buildings) { delete b.rc; delete b.st; delete b.ac; }
      const coalAtMines = old.buildings.reduce((a, b) => a + ((b.out || {}).coal || 0), 0);
      for (const x of VE.RES_ORDER.slice(9)) delete old.stock[x];
      const g3 = new VE.Game(VE.view.scene); g3.init(old);
      const oldOk = { deposits: g3.world.deposits.length, wild: g3.wild.list.length, recipe: (g3.buildings.find(b => b.type === 'smelter') || {}).recipe, coal: g3.stock.coal - coalAtMines };
      g3.dispose();
      const q = id => VE.RANKS.some(r => r.quests.some(x => x.id === id));
      VE.ui.openProduction();
      const prod = document.getElementById('modalBox').textContent;
      VE.ui.closeModal();
      // smelter staat zichtbaar bij de oven zolang er gesmolten wordt
      let smithSeen = false;
      for (let t = 0; t < 120 && !smithSeen; t += 0.05) { g.update(0.05); if (sm.working && sm.worker && !sm.worker.hidden && sm.worker.act === 'hammer') smithSeen = true; }
      return { prodOk: /Coal/.test(prod) && /Iron Bars/.test(prod) && /Made by/.test(prod), smithSeen, shown, recipeAfterClick, whyBad, clsBad, rings, same, oldOk,
        quests: ['v9', 'v10', 'm8', 'm9', 'm10', 'm11', 't8', 't9', 't10'].every(q),
        unlocks: [VE.RANKS[1].unlock.includes('hunter'), VE.RANKS[2].unlock.includes('smelter'), VE.RANKS[3].unlock.includes('goldmine')],
        cathedral: VE.DEFS.monument.cost, lvl3: VE.levelCost(VE.DEFS.house, 3) };
    });
    expect(r.prodOk, 'productieoverzicht').toBe(true);
    expect(r.smithSeen, 'smelter zichtbaar aan het werk bij de oven').toBe(true);
    expect(r.shown).toEqual([true, true, true, true]);
    expect(r.recipeAfterClick).toBe('copperbar');
    expect(r.whyBad).toBe('Mines can only be built on the mountain');
    expect(r.clsBad).toBe('bad');
    expect(r.rings, 'mijnbouw-informatielaag zichtbaar').toBeGreaterThan(0.5);
    expect([r.same.ore, r.same.wild, r.same.stock]).toEqual([true, true, true]);
    expect(r.same.recipe).toBe('copperbar');
    expect(r.same.mines).toBe(4);
    expect(r.oldOk.deposits).toBeGreaterThan(10);
    expect(r.oldOk.wild).toBeGreaterThan(20);
    expect(r.oldOk.recipe).toBe('ironbar');
    expect(r.oldOk.coal).toBe(0);
    expect(r.quests).toBe(true);
    expect(r.unlocks).toEqual([true, true, true]);
    expect(r.cathedral.ironbar).toBeGreaterThan(0);
    expect(r.cathedral.goldbar).toBeGreaterThan(0);
    expect(r.lvl3.ironbar).toBeGreaterThan(0);
    expect(checkErrors(errors, info)).toEqual([]);
  });

  test('prestaties: dieren en aders', async ({ page }, info) => {
    test.setTimeout(120_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await page.waitForTimeout(1500);
    const r = await page.evaluate(async () => {
      const VE = window.VE, g = VE.game, R = VE.view.renderer;
      const t0 = performance.now();
      for (let i = 0; i < 400; i++) g.wild.update(0.05);
      const simMs = (performance.now() - t0) / 400;
      const t1 = performance.now();
      for (let i = 0; i < 60; i++) g.wr.render(g.wild, VE.view.camera, 1 / 60);
      const renderMs = (performance.now() - t1) / 60;
      await new Promise(r => setTimeout(r, 300));
      R.info.autoReset = false; R.info.reset();
      R.render(VE.view.scene, VE.view.camera);
      const calls = R.info.render.calls; R.info.autoReset = true;
      let animalCalls = 0; g.root.traverse(o => { if (o.isInstancedMesh && /^animal_/.test(o.name) && o.visible && o.count) animalCalls++; });
      return { simMs, renderMs, calls, animalCalls, animals: g.wild.list.length, src: VE.animalSource, drawn: g.wr.stats };
    });
    console.log('prestaties dieren:', JSON.stringify(r));
    expect(r.src).toBe('glb');
    expect(r.simMs, 'dier-AI per update').toBeLessThan(2.5);
    expect(r.renderMs, 'dieren tekenen per frame').toBeLessThan(4);
    expect(r.animalCalls, 'draw calls dieren').toBeLessThanOrEqual(40);
    expect(checkErrors(errors, info)).toEqual([]);
  });

  test('fallback: zonder animals.glb en ores.glb werken dieren en aders ook', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'logica: alleen desktop');
    const errors = trackErrors(page);
    await page.route(/animals\.glb|mine\.glb|hunter\.glb|smelter\.glb/, r => r.abort());
    await openGame(page);
    await startNewVillage(page);
    await demo(page);
    await run(page, 30);
    const r = await page.evaluate(() => ({ a: VE.animalSource, m: VE.modelSource.coalmine, n: VE.game.wild.list.length, drawn: VE.game.wr.stats.src }));
    expect(r.a).toBe('procedural');
    expect(r.m).toBe('procedural');
    expect(r.n).toBeGreaterThan(20);
    const unknown = checkErrors(errors, info).filter(e => !/GLB niet geladen|Failed to load resource|ERR_FAILED|net::/.test(e));
    expect(unknown).toEqual([]);
  });
});

test.describe('wildlife & mijnbouw', () => {
  test('screenshots: dierenparade', async ({ page }, info) => {
    test.setTimeout(120_000);
    await openGame(page);
    await startNewVillage(page);
    await page.evaluate(() => { document.getElementById('questPanel').style.display = 'none'; document.querySelectorAll('.toast').forEach(t => t.remove()); });
    const c = await parade(page, ['alert', 'walk']);
    await look(page, c[0], c[1], 3.6, 0.0, 0.55);
    await shot(page, info.project.name, 'dieren-parade-1');
    await page.evaluate(() => { for (const a of window.VE.game.wild.list) if (a.t === 999) a.state = a.state === 'alert' ? 'eat' : 'rest'; });
    await page.waitForTimeout(800);
    await shot(page, info.project.name, 'dieren-parade-2');
    await page.evaluate(() => { for (const a of window.VE.game.wild.list) if (a.t === 999) a.state = a.state === 'eat' ? 'idle' : 'flee'; });
    await look(page, c[0], c[1], 3.0, 0.9, 0.45);
    await shot(page, info.project.name, 'dieren-parade-3');
  });

  test('screenshots: gebouwen, mijnen, dieren', async ({ page }, info) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const pos = await demo(page);
    await page.evaluate(() => { document.getElementById('questPanel').style.display = 'none'; });
    await run(page, 40);
    const P = info.project.name;
    if (pos.smelter) { await look(page, pos.smelter[0], pos.smelter[1] + 0.2, 4.2, 0.7, 0.75); await shot(page, P, 'metaal-smelterij'); }
    if (pos.hunter) { await look(page, pos.hunter[0], pos.hunter[1] + 0.2, 4.2, 0.7, 0.75); await shot(page, P, 'metaal-jagershut'); }
    for (const t of ['coalmine', 'ironmine', 'coppermine', 'goldmine']) {
      if (pos[t]) { await look(page, pos[t][0], pos[t][1] + 0.3, 4.6, 0.6, 0.7); await shot(page, P, 'metaal-' + t); }
    }
    // dieren: zoom in op een groepje van elke soort
    const sp = await page.evaluate(() => {
      const o = {}; for (const a of window.VE.game.wild.list) if (!a.dead && !o[a.key]) o[a.key] = [a.x, a.z];
      return o;
    });
    for (const k of Object.keys(sp)) { await look(page, sp[k][0], sp[k][1], 3.4, 0.8, 0.62); await shot(page, P, 'dier-' + k); }
    expect(checkErrors(errors, info).filter(e => !/Failed to load resource|GLB niet geladen/.test(e))).toEqual([]);
  });
});
