// Upgrades als bouwplaats (dragers, bouwer met hamer, steiger, voortgang), zichtbare grondstoffen en wapenrek
// bij de werkplaatsen, en natuurlijk vliegende vlinders.
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
      place(t, near, minD) { const s = this.spot(t, near, minD); const b = g.placeBuilding(t, s[0], s[1], true); if (b && b.accept) VE.game.setAccept(b, '*', true); return b; },   // Storehouse: alles
      run(sec, each) { for (let t = 0; t < sec; t += 0.1) { g.arriveT = 1e9; g.update(0.1); if (each) each(t); } },
      // zichtbare stuks van een goed binnen een gebouw (plus rand), uit de InstancedMesh van de stapels
      visible(b, r, pad) {
        g.piles.update(g);
        const m = g.piles.meshes[r], a = m.instanceMatrix.array, h = b.size / 2 + (pad === undefined ? 0.75 : pad);
        let n = 0;
        for (let i = 0; i < m.count; i++) { const x = a[i * 16 + 12], z = a[i * 16 + 14]; if (Math.abs(x - b.cx) < h && Math.abs(z - b.cz) < h) n++; }
        return n;
      },
      look(b, dist, pitch, yaw, dz) {
        const c = VE.view.cam; c.tx = b.cx; c.tz = b.cz + (dz || 0); c.tdist = c.dist = dist; c.pitch = pitch; c.tyaw = c.yaw = yaw || 0;
        if (VE.natureForceSync) VE.natureForceSync();
      }
    };
    document.querySelectorAll('.toast').forEach(t => t.remove());
  });
}

test.describe('Upgrades als bouwplaats', () => {
  test('dragers leveren eerst, dan een bouwer met hamer; pas daarna het nieuwe level; niets kwijt', async ({ page }, info) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      const b = T.place('bakery', [hq.cx + 4, hq.cz + 3], 3);
      g.addGoods('plank', 30); g.addGoods('stone', 30); g.addGoods('ironbar', 6); g.gold = 1000;
      const cost = VE.levelCost(b.def, 2);
      const s0 = { plank: g.stock.plank, stone: g.stock.stone, gold: g.gold, ups: g.stats.upgrades };
      const ok = g.upgrade(b);
      const after = { level: b.level, gold: g.gold, hasUp: !!b.up, scaf: !!(b.upScaf && b.upScaf.parent), plank: g.stock.plank, again: g.upgrade(b) };
      // tijdens de upgrade bijhouden: wie levert, wie hamert, voortgang, zichtbare materialen
      let carriers = 0, hammer = 0, maxVis = 0, levelEarly = 0, scaleMin = 9, scaleMax = 0, workerOk = 0, seenUnused = 0;
      const del0 = g.deliver.bind(g);
      g.deliver = s => { const t = s.task; if (t && t.up && t.dst === b && t.picked) carriers++; return del0(s); };
      let t = 0;
      while (b.up && t < 120) {
        T.run(0.5); t += 0.5;
        if (!b.up) break;
        const u = b.up;
        if (b.level !== 1) levelEarly++;
        if (b.builder && b.builder.act === 'hammer' && !b.builder.hidden) hammer++;
        let unused = -u.used; for (const k in u.delivered) unused += u.delivered[k];
        const vis = T.visible(b, 'plank') + T.visible(b, 'stone');
        if (unused > 0) { seenUnused++; if (vis >= unused) maxVis++; }
        if (b.upScaf) { scaleMin = Math.min(scaleMin, b.upScaf.scale.y); scaleMax = Math.max(scaleMax, b.upScaf.scale.y); }
        if (b.worker) workerOk++;
      }
      g.deliver = del0;
      T.run(3);
      return {
        ok, s0, cost, after, t, carriers, hammer, maxVis, seenUnused, levelEarly, scaleMin, scaleMax, workerOk,
        level: b.level, up: !!b.up, scafGone: !b.upScaf, ups: g.stats.upgrades - s0.ups,
        plankUsed: s0.plank - g.stock.plank, stoneUsed: s0.stone - g.stock.stone, goldUsed: s0.gold - g.gold,
        leftOnSite: T.visible(b, 'plank', 0.4) + T.visible(b, 'stone', 0.4), builderFree: g.settlers.every(s => s.work !== b || s.mode !== 'build')
      };
    });
    console.log('upgrade:', JSON.stringify(r));
    expect(r.ok).toBe(true);
    expect(r.after.level, 'level verandert niet direct').toBe(1);
    expect(r.after.hasUp).toBe(true);
    expect(r.after.scaf, 'steiger rond het gebouw').toBe(true);
    expect(r.after.gold).toBe(1000 - r.cost.gold);
    expect(r.after.plank, 'materialen gaan niet in één keer weg: dragers halen ze').toBe(r.s0.plank);
    expect(r.after.again, 'geen tweede upgrade tegelijk').toBe(false);
    expect(r.carriers).toBe(r.cost.plank + r.cost.stone);
    expect(r.hammer, 'bouwer zichtbaar aan het hameren').toBeGreaterThan(5);
    expect(r.seenUnused).toBeGreaterThan(0);
    expect(r.maxVis, 'geleverde materialen liggen zichtbaar bij het gebouw').toBe(r.seenUnused);
    expect(r.levelEarly, 'pas na voltooiing het nieuwe level').toBe(0);
    expect(r.scaleMax).toBeGreaterThan(r.scaleMin);
    expect(r.workerOk, 'het gebouw blijft werken').toBeGreaterThan(0);
    expect(r.level).toBe(2);
    expect(r.up).toBe(false);
    expect(r.scafGone).toBe(true);
    expect(r.ups).toBe(1);
    expect(r.plankUsed).toBe(r.cost.plank);
    expect(r.stoneUsed).toBe(r.cost.stone);
    expect(r.goldUsed).toBe(r.cost.gold);
    expect(r.leftOnSite).toBe(0);
    expect(errs(errors)).toEqual([]);
  });

  test('opslaan midden in een upgrade, afbreken en slopen: niets kwijt', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      const b = T.place('sawmill', [hq.cx + 4, hq.cz + 3], 3);
      g.addGoods('plank', 30); g.addGoods('stone', 30); g.addGoods('ironbar', 6); g.gold = 1000;
      g.upgrade(b);
      let t = 0; while (b.up && b.up.used < 2 && t < 60) { T.run(0.2); t += 0.2; }
      const mid = JSON.parse(JSON.stringify(b.up));
      const sv = JSON.parse(JSON.stringify(g.serialize()));
      const a = new VE.Game(VE.view.scene); a.init(sv);
      const b2 = a.buildings.find(x => x.type === 'sawmill');
      const loaded = { level: b2.level, up: b2.up && { lvl: b2.up.lvl, used: b2.up.used, del: b2.up.delivered, cost: b2.up.cost }, scaf: !!b2.upScaf };
      // geladen spel maakt de upgrade gewoon af
      for (let k = 0; k < 900 && b2.up; k++) { a.arriveT = 1e9; a.update(0.1); }
      const loadedDone = b2.level;
      a.dispose();
      // afbreken: materialen en goud terug
      T.run(60);
      const lvlNow = b.level;
      const st0 = { plank: g.stock.plank, stone: g.stock.stone, gold: g.gold };
      g.upgrade(b);                                   // naar level 3
      const cost3 = VE.levelCost(b.def, 3);
      t = 0; while (b.up && (b.up.delivered.plank || 0) < 4 && t < 60) { T.run(0.2); t += 0.2; }
      g.cancelUpgrade(b);
      T.run(30);                                      // dragers die nog onderweg waren, leveren elders af
      const carrying = g.settlers.filter(s => s.carry && s.carry !== 'log' && s.task).length;
      const back = { plank: g.stock.plank, stone: g.stock.stone, gold: g.gold, up: !!b.up, scaf: !!b.upScaf, level: b.level };
      // slopen tijdens een upgrade: de geleverde materialen gaan naar de opslag
      g.upgrade(b);
      t = 0; while (b.up && (b.up.delivered.plank || 0) < 3 && t < 60) { T.run(0.2); t += 0.2; }
      const delivered = Object.assign({}, b.up.delivered), used = b.up.used, p0 = g.stock.plank;
      g.demolish(b);
      T.run(20);
      return { mid, loaded, loadedDone, lvlNow, st0, back, carrying, cost3, delivered, used, plankAfterDemolish: g.stock.plank - p0 };
    });
    console.log('upgrade-save:', JSON.stringify(r));
    expect(r.loaded.level).toBe(1);
    expect(r.loaded.up.lvl).toBe(2);
    expect(r.loaded.up.used).toBe(r.mid.used);
    expect(r.loaded.up.del).toEqual(r.mid.delivered);
    expect(r.loaded.scaf).toBe(true);
    expect(r.loadedDone).toBe(2);
    expect(r.lvlNow).toBe(2);
    expect(r.back.up).toBe(false);
    expect(r.back.scaf).toBe(false);
    expect(r.back.level).toBe(2);
    expect(r.back.gold).toBe(r.st0.gold);
    expect(r.back.plank + r.carrying).toBeGreaterThanOrEqual(r.st0.plank - 0);
    expect(r.back.stone).toBe(r.st0.stone);
    expect(r.delivered.plank).toBeGreaterThanOrEqual(3);
    expect(r.plankAfterDemolish).toBeGreaterThanOrEqual(r.delivered.plank);
    expect(errs(errors)).toEqual([]);
  });

  test('beeld: upgrade-bouwplaats met materialen en hamerende bouwer', async ({ page }, info) => {
    test.setTimeout(150_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      const b = T.place('bakery', [hq.cx + 3, hq.cz + 4], 3); window.UB = b;
      g.addGoods('plank', 30); g.addGoods('stone', 30); g.gold = 1000;
      g.upgrade(b);
      let t = 0; while (b.up && !(b.builder && b.builder.bstate === 'at' && b.builder.act === 'hammer' && b.up.used >= 1 && (b.up.delivered.stone || 0) - 0 > 0) && t < 90) { T.run(0.1); t += 0.1; }
      g.speed = 0;
      T.look(b, VE.isMobile ? 3.6 : 3.0, 0.62, 0.35, 0.25);
      VE.ui.select(b); VE.ui.renderInfo(true);
    });
    await page.waitForTimeout(1500);
    await shot(page, info.project.name, 'upgrade-bouwplaats');
    const txt = await page.locator('#infoPanel').innerText();
    expect(txt).toMatch(/Upgrading to level 2/);
    expect(txt).toMatch(/Cancel upgrade/);
    expect(errs(errors)).toEqual([]);
  });
});

test.describe('Zichtbare voorraad bij werkplaatsen', () => {
  test('wapensmederij: planken en ijzerstaven op stapels, wapens in het rek; aantallen kloppen en nemen af', async ({ page }, info) => {
    test.setTimeout(200_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      const ws = T.place('weaponsmith', [hq.cx + 4, hq.cz + 3], 3);
      const md = VE.buildModel('weaponsmith', 1);
      ws.input = { plank: 5, ironbar: 6 }; ws.output = {}; g.sd = true;
      const v0 = { plank: T.visible(ws, 'plank', 0.2), ironbar: T.visible(ws, 'ironbar', 0.2) };
      // één zwaard: 3 ijzer + 1 plank gaan van de stapels af
      g.setRecipe(ws, 'sword');
      for (const s of g.settlers) if (s.mode === 'idle') s.mode = 'wander';          // geen dragers die bijvullen
      let k = 0; while (!ws.working && k++ < 300) { g.arriveT = 1e9; g.update(0.1); }
      const v1 = { plank: T.visible(ws, 'plank', 0.2), ironbar: T.visible(ws, 'ironbar', 0.2), input: Object.assign({}, ws.input) };
      // wapens in het rek: elk wapen rechtop, max. 6
      ws.output = { sword: 2, spear: 1, battleaxe: 1, dagger: 1, bow: 1 }; g.sd = true;
      g.piles.update(g);
      const rack = {}; let upright = 0, inRack = 0;
      const rk = md.rack, hx = ws.cx + rk[0], hz = ws.cz + rk[2];
      for (const w of VE.WEAPONS) {
        const m = g.piles.meshes[w], a = m.instanceMatrix.array; rack[w] = 0;
        for (let i = 0; i < m.count; i++) {
          const x = a[i * 16 + 12], z = a[i * 16 + 14];
          if (Math.abs(x - hx) < 0.25 && Math.abs(z - hz) < 0.12) { rack[w]++; inRack++; if (Math.abs(a[i * 16 + 1]) > 0.6 || Math.abs(a[i * 16 + 5]) > 0.6 || Math.abs(a[i * 16 + 9]) > 0.6) upright++; }
        }
      }
      return { src: VE.modelSource.weaponsmith, rackMarker: !!md.rack, inMarkers: md.inp && md.inp.length, v0, v1, rack, inRack, upright, working: ws.working };
    });
    console.log('wapensmederij-voorraad:', JSON.stringify(r));
    expect(r.src).toBe('glb');
    expect(r.rackMarker).toBe(true);
    expect(r.inMarkers).toBe(2);
    expect(r.v0).toEqual({ plank: 5, ironbar: 6 });
    expect(r.working).toBe(true);
    expect(r.v1.plank).toBe(r.v1.input.plank);
    expect(r.v1.ironbar).toBe(r.v1.input.ironbar);
    expect(r.v1.ironbar).toBeLessThan(6);
    expect(r.rack).toEqual({ sword: 2, spear: 1, battleaxe: 1, dagger: 1, bow: 1, crossbow: 0 });
    expect(r.upright).toBe(6);
    expect(errs(errors)).toEqual([]);
  });

  test('alle werkplaatsen: aangeleverde grondstoffen en eigen goederen zichtbaar, aantallen kloppen', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq, out = {};
      const set = [['sawmill', { log: 4 }, { plank: 4 }], ['windmill', { grain: 4 }, { flour: 3 }], ['bakery', { flour: 4 }, { bread: 4 }],
        ['winery', { grape: 4 }, { wine: 3 }], ['smelter', { coal: 3, ironore: 4 }, { ironbar: 3, copperore: 2 }], ['tavern', { bread: 3, wine: 3 }, {}],
        ['woodcutter', {}, { log: 4 }], ['quarry', {}, { stone: 5 }], ['fisher', {}, { fish: 3 }], ['hunter', {}, { meat: 3 }], ['coalmine', {}, { coal: 4 }],
        ['ironmine', {}, { ironore: 4 }], ['vineyard', {}, { grape: 4 }], ['farm', {}, { grain: 4 }]];
      let k = 0;
      for (const [t, i, o] of set) {
        const s = T.spot(t, [hq.cx - 8 + (k % 6) * 3, hq.cz - 6 + Math.floor(k / 6) * 4], 3); k++;
        if (!s) { out[t] = 'geen plek'; continue; }
        const b = g.placeBuilding(t, s[0], s[1], true);
        b.input = Object.assign({}, i); b.output = Object.assign({}, o);
        out[t] = { b };
      }
      g.sd = true;
      const res = {};
      for (const t in out) {
        if (typeof out[t] === 'string') { res[t] = out[t]; continue; }
        const b = out[t].b, row = {};
        // elk goed telt alleen wat bij dit gebouw ligt (nabije gebouwen kunnen hetzelfde goed hebben: kleine rand)
        const want = {}; for (const r in b.input) want[r] = (want[r] || 0) + b.input[r]; for (const r in b.output) want[r] = (want[r] || 0) + b.output[r];
        for (const r in want) row[r] = T.visible(b, r, 0.05) + '/' + want[r];
        res[t] = row;
      }
      // na het leegmaken: niets meer zichtbaar
      for (const t in out) if (out[t].b) { out[t].b.input = {}; out[t].b.output = {}; }
      g.sd = true; g.piles.update(g);
      let left = 0; for (const t in out) if (out[t].b) for (const r of VE.RES_ORDER) left += T.visible(out[t].b, r, 0.05);
      return { res, left };
    });
    console.log('werkplaatsen:', JSON.stringify(r));
    for (const t in r.res) {
      expect(typeof r.res[t], t).toBe('object');
      for (const k in r.res[t]) { const [a, b] = r.res[t][k].split('/'); expect(+a, t + ' ' + k).toBe(+b); }
    }
    expect(r.left).toBe(0);
    expect(errs(errors)).toEqual([]);
  });

  test('beeld: wapensmederij en werkplaatsen met hun voorraad', async ({ page }, info) => {
    test.setTimeout(150_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      const ws = T.place('weaponsmith', [hq.cx + 4, hq.cz + 3], 3);
      ws.input = { plank: 5, ironbar: 6 }; ws.output = { sword: 2, spear: 1, battleaxe: 1, dagger: 1, bow: 1 }; g.sd = true; g.speed = 0;
      for (const s of g.settlers) s.hidden = true;
      window.WS = ws;
      T.look(ws, VE.isMobile ? 2.4 : 1.9, 0.6, -0.35, 0.1);
      document.getElementById('hud').style.visibility = 'hidden';
    });
    await page.waitForTimeout(1500);
    await shot(page, info.project.name, 'voorraad-wapensmederij');
    for (const [t, i, o] of [['smelter', { coal: 3, ironore: 4 }, { ironbar: 3 }], ['sawmill', { log: 4 }, { plank: 4 }], ['bakery', { flour: 4 }, { bread: 4 }]]) {
      await page.evaluate(({ t, i, o }) => {
        const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
        const b = T.place(t, [hq.cx - 4, hq.cz - 4], 3);
        b.input = i; b.output = o; g.sd = true;
        T.look(b, VE.isMobile ? 2.8 : 2.2, 0.95, 0, 0.2);
      }, { t, i, o });
      await page.waitForTimeout(1200);
      await shot(page, info.project.name, 'voorraad-' + t);
    }
    expect(errs(errors)).toEqual([]);
  });
});

test.describe('Vlinders', () => {
  test('natuurlijke vlucht: geen cirkels, wisselende snelheid en hoogte, landen op bloemen', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, w = g.world, N = VE.N, B = g.fx.butterflies;
      for (let i = 0; i < 20; i++) g.fx.update(0.05, i * 0.05);
      // 90 s volgen in stapjes van 0,05 s
      const tr = B.list.map(() => ({ h: [], v: [], y: [], turn: 0, circles: 0, win: [], sits: 0, flyT: 0 }));
      let prev = B.list.map(b => ({ x: b.x, z: b.z, h: b.h, st: b.state }));
      for (let i = 0; i < 1800; i++) {
        g.fx.update(0.05, i * 0.05);
        B.list.forEach((b, n) => {
          const p = prev[n], T = tr[n];
          if (b.state !== 'sit' && p.st !== 'sit') {
            let dh = b.h - p.h; while (dh > Math.PI) dh -= 6.283; while (dh < -Math.PI) dh += 6.283;
            T.win.push(dh); if (T.win.length > 160) T.win.shift();          // 8 s venster
            const s = T.win.reduce((a, c) => a + c, 0);
            if (T.win.length === 160 && Math.abs(s) > 6.283 * 1.5) T.circles++;   // >1,5 rondje in 8 s = cirkelen
            T.v.push(Math.hypot(b.x - p.x, b.z - p.z) / 0.05); T.y.push(b.y); T.flyT++;
          }
          if (b.state === 'sit' && p.st !== 'sit') T.sits++;
          prev[n] = { x: b.x, z: b.z, h: b.h, st: b.state };
        });
      }
      const sd = a => { if (a.length < 2) return 0; const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
      let circling = 0, landed = 0, vVar = 0, yVar = 0, flying = 0, nearFlowers = 0;
      tr.forEach((T, n) => {
        if (T.flyT > 200) { flying++; if (T.circles > T.flyT * 0.15) circling++; if (sd(T.v) > 0.03) vVar++; if (sd(T.y) > 0.04) yVar++; }
        if (T.sits > 0) landed++;
        const b = B.list[n], i0 = Math.floor(b.x), j0 = Math.floor(b.z); let f = false;
        for (let dj = -3; dj <= 3 && !f; dj++) for (let di = -3; di <= 3 && !f; di++) if (w.inb(i0 + di, j0 + dj) && w.decoF[(j0 + dj) * N + i0 + di]) f = true;
        if (f) nearFlowers++;
      });
      return { n: B.list.length, flying, circling, landed, vVar, yVar, nearFlowers };
    });
    console.log('vlinders:', JSON.stringify(r));
    expect(r.flying).toBeGreaterThan(r.n * 0.5);
    expect(r.circling, 'vlinders draaien geen rondjes').toBeLessThanOrEqual(Math.ceil(r.flying * 0.1));
    expect(r.vVar, 'wisselende snelheid').toBeGreaterThan(r.flying * 0.8);
    expect(r.yVar, 'wisselende hoogte').toBeGreaterThan(r.flying * 0.8);
    expect(r.landed, 'landen op bloemen').toBeGreaterThan(r.n * 0.6);
    expect(r.nearFlowers / r.n).toBeGreaterThan(0.8);
    expect(errs(errors)).toEqual([]);
  });
});
