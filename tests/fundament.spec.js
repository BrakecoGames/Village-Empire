// Fundament voor single player tegen AI en multiplayer: spelers, commando's, vaste ticks, seeded random en een
// volledige JSON-snapshot (js/players.js, js/commands.js, js/snapshot.js).
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage } = require('./helpers');

const errs = errors => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);

async function helpers(page) {
  await page.evaluate(() => window.VE.glbAllReady);
  await page.evaluate(() => {
    const VE = window.VE, N = () => VE.N;
    window.F = {
      // nieuw spel met vaste seed, los van het spel op het scherm
      make(seed) { const g = new VE.Game(VE.view.scene); g.init({ fresh: true, seed: seed }); g.rank = 3; return g; },
      ticks(g, n, each) { for (let i = 0; i < n; i++) { g.tick(); if (each) each(g, i); } },
      // vrije plek voor type dicht bij near (vanuit de spelregels: canPlace als de speler)
      spot(g, type, near, minD) {
        const sz = VE.DEFS[type].size || 1, hq = g.hq; let best = null, bd = 1e9;
        for (let j = 0; j < N(); j++) for (let i = 0; i < N(); i++) {
          const d = Math.hypot(i - near[0], j - near[1]); if ((minD && d < minD) || d >= bd || d > 14) continue;
          if (!g.canPlace(type, i, j).ok) continue;
          if (!g.pf.find(hq.doorK, (j + sz) * N() + i + (sz > 1 ? 1 : 0))) continue;
          bd = d; best = [i, j];
        }
        return best;
      },
      // een druk dorp opzetten met alleen commando's
      village(g) {
        const hq = g.hq, out = {};
        g.gold = 400;
        for (const [t, near, minD] of [['woodcutter', [hq.cx - 6, hq.cz + 2], 3], ['sawmill', [hq.cx + 4, hq.cz + 3], 3], ['fisher', [hq.cx, hq.cz + 8], 3],
          ['hunter', [hq.cx - 4, hq.cz - 6], 3], ['farm', [hq.cx + 6, hq.cz - 4], 3], ['house', [hq.cx + 2, hq.cz + 6], 2], ['quarry', [hq.cx + 7, hq.cz + 1], 3]]) {
          const p = F.spot(g, t, near, minD); if (!p) continue;
          const r = { };
          g.issue({ type: 'build', buildingType: t, i: p[0], j: p[1] }, res => { r.res = res; });
          out[t] = r;
        }
        return out;
      }
    };
  });
}

test.describe('Fundament: spelers, commando\'s, ticks en snapshot', () => {
  test('determinisme: zelfde seed + zelfde commando\'s = zelfde toestand, los van de framerate', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = trackErrors(page);
    await openGame(page); await startNewVillage(page); await helpers(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, F = window.F;
      const run = (frameMs) => {
        const g = F.make(424242);
        const built = F.village(g);
        // vaste ticks uit een framelus met variabele frametijd (zoals main.js)
        let acc = 0, t = 0, frames = 0;
        while (g.tickN < 1600) {
          const dt = Math.min(0.05, frameMs / 1000 * (1 + 0.3 * Math.sin(frames++)));
          acc += dt;
          while (acc >= VE.TICK && g.tickN < 1600) { g.tick(); acc -= VE.TICK; }
          t += dt;
        }
        const h = g.stateHash(), ok = Object.values(built).filter(x => x.res && x.res.ok).length;
        const prod = Object.assign({}, g.players[0].stats.produced), log = g.cmdLog.length;
        g.dispose();
        return { h, ok, prod, log, frames };
      };
      return { a: run(1000 / 30), b: run(1000 / 144), c: run(1000 / 60) };
    });
    console.log('determinisme', JSON.stringify(r));
    expect(r.a.ok).toBeGreaterThanOrEqual(6);                     // gebouwd via commando's
    expect(r.a.log).toBeGreaterThanOrEqual(6);                    // en gelogd
    expect(Object.keys(r.a.prod).length).toBeGreaterThan(1);      // er gebeurt echt iets
    expect(r.b.h).toBe(r.a.h);                                    // 30 fps = 144 fps
    expect(r.c.h).toBe(r.a.h);
    expect(errs(errors)).toEqual([]);
  });

  test('snapshot: hele toestand naar JSON en terug; daarna loopt hij identiek verder', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = trackErrors(page);
    await openGame(page); await startNewVillage(page); await helpers(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, F = window.F;
      const a = F.make(77001);
      F.village(a);
      F.ticks(a, 2400);                                           // 2 minuten: houthakken, vissen, jagen, zagen, bouwen
      // soldaten: kazerne via commando's, wapens en uitrusting erbij
      a.gold = 500;
      const bp = F.spot(a, 'barracks', [a.hq.cx + 6, a.hq.cz + 6], 4);
      let bar = null; a.issue({ type: 'build', buildingType: 'barracks', i: bp[0], j: bp[1] }, res => { bar = a.bmap[res.buildingId]; });
      a.as(0, () => { a.addGoods('sword', 3); a.addGoods('gear', 3); a.addGoods('plank', 20); });
      if (bar) { a.complete(bar, true); a.issue({ type: 'trainUnit', buildingId: bar.id, unitType: 'swordsman', count: 2 }); }
      F.ticks(a, 1200);
      const busy = { carry: a.settlers.filter(s => s.mode === 'carry').length, work: a.settlers.filter(s => s.mode === 'work' && s.wstate !== 'inside').length, meal: a.settlers.filter(s => s.meal).length,
        withCb: a.settlers.filter(s => s.cb).length, withOnAct: a.settlers.filter(s => s.onAct).length, trees: a.nature.trees.length };
      const s1 = a.snapshot(true);                                 // strict: een functie in de toestand = fout
      const json = JSON.stringify(s1);
      const b = new VE.Game(VE.view.scene); b.init(JSON.parse(json));
      const s2 = b.snapshot(true);
      const round = VE.Snapshot.hash(s1.state) === VE.Snapshot.hash(s2.state);
      let firstDiff = null;
      if (!round) { const x = JSON.stringify(s1.state), y = JSON.stringify(s2.state); let i = 0; while (i < x.length && x[i] === y[i]) i++; firstDiff = x.slice(Math.max(0, i - 160), i + 80) + ' ||| ' + y.slice(Math.max(0, i - 160), i + 80); }
      // beide verder, met hetzelfde commando op dezelfde tick
      const after = [];
      for (const g of [a, b]) {
        const sol = g.soldiers(undefined, 0).map(s => s.id);
        F.ticks(g, 1200, (gg, i) => { if (i === 300 && sol.length) gg.issue({ type: 'moveUnits', unitIds: sol, targetX: gg.hq.cx + 3, targetZ: gg.hq.cz + 9 }); });
        after.push(g.stateHash());
      }
      const res = { size: json.length, busy, round, firstDiff, after, soldiers: b.soldiers(undefined, 0).length, pop: [a.settlers.length, b.settlers.length] };
      a.dispose(); b.dispose();
      return res;
    });
    console.log('snapshot', JSON.stringify(r).slice(0, 2000));
    expect(r.busy.withCb + r.busy.withOnAct).toBeGreaterThan(0);  // midden in handelingen opgeslagen
    expect(r.round).toBe(true);                                   // JSON → terug → dezelfde JSON
    expect(r.after[1]).toBe(r.after[0]);                          // en daarna identiek verder
    expect(errs(errors)).toEqual([]);
  });

  test('spelers en commando\'s: alles per speler, controle op eigenaar en kosten; de interface stuurt alleen commando\'s', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page); await startNewVillage(page); await helpers(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, F = window.F;
      const p = g.players[0];
      const info = { players: g.players.map(x => ({ id: x.id, kind: x.kind, color: x.color, team: x.team, isAI: x.isAI })),
        owners: [...new Set(g.buildings.map(b => b.owner))], settlerOwners: [...new Set(g.settlers.map(s => s.owner))] };
      // goud en voorraad zijn per speler
      g.gold = 123;
      info.goldP0 = p.gold;
      info.goldP1 = g.players[1].gold;
      // ongeldige commando's: verkeerde eigenaar, onbekende speler, te weinig goud, buiten de grenzen
      const hq = g.hq;
      info.notMine = VE.checkCommand(g, { type: 'demolish', playerId: 1, buildingId: hq.id }).why;
      info.noPlayer = VE.checkCommand(g, { type: 'build', playerId: 7, buildingType: 'house', i: 1, j: 1 }).why;
      info.outside = VE.checkCommand(g, { type: 'build', playerId: 0, buildingType: 'house', i: 0, j: 0 }).why;
      g.gold = 0;
      info.noGold = VE.checkCommand(g, { type: 'buyUpgrade', playerId: 0, upgradeId: VE.UPGRADES[0].id }).why;
      g.gold = 123;
      return info;
    });
    console.log('spelers', JSON.stringify(r));
    expect(r.players.length).toBeGreaterThanOrEqual(1);
    expect(r.players[0]).toMatchObject({ id: 0, kind: 'human', isAI: false });
    expect(r.owners).toEqual([0]);
    expect(r.settlerOwners).toEqual([0]);
    expect(r.goldP0).toBe(123);
    expect(r.goldP1).toBe(0);
    expect(r.notMine).toMatch(/Unknown player|not your/);
    expect(r.noPlayer).toBe('Unknown player');
    expect(r.outside).toMatch(/Outside|map|border/i);
    expect(r.noGold).toMatch(/gold/i);
    // interface: bouwen en markt instellen gaan als commando (in het log); alleen kijken verandert niets
    const before = await page.evaluate(() => { const g = window.VE.game; g._tick = g.tick; g.tick = () => {}; return { h: g.stateHash(), log: (g.cmdLog || []).length }; });
    await page.locator('#btnUpgrades').click();
    await page.evaluate(() => window.VE.ui.closeModal());
    await page.locator('#btnQuests').click();
    await page.locator('#btnQuests').click();
    await page.locator('#foodBtn').click();
    await page.evaluate(() => window.VE.ui.closeModal());
    const look = await page.evaluate(() => { const g = window.VE.game; return { h: g.stateHash(), log: (g.cmdLog || []).length }; });
    expect(look.h).toBe(before.h);                                // alleen kijken: niets veranderd
    // nu een echte actie via de interface: snelheid → setSpeed-commando
    await page.locator('#speedBtn').click();
    const act = await page.evaluate(() => { const g = window.VE.game, L = g.cmdLog; const last = L[L.length - 1]; g.tick = g._tick; return { type: last && last.c.type, speed: g.speed, ok: last && last.ok }; });
    expect(act).toEqual({ type: 'setSpeed', speed: 2, ok: true });
    expect(errs(errors)).toEqual([]);
  });
});
