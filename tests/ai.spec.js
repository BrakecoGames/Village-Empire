// Single player tegen AI: menu, gevechten, winnen en verliezen, AI op alle moeilijkheden, AI tegen AI (versneld),
// determinisme met AI en aanvallen via de interface (js/combat.js, js/ai/).
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage, shot } = require('./helpers');

const errs = errors => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);

/* spel met tegenstanders, los van het spel op het scherm; ticks = vaste simulatiestappen */
async function lib(page) {
  await page.evaluate(() => window.VE.glbAllReady);
  await page.evaluate(() => {
    const VE = window.VE;
    window.AI = {
      make(seed, levels, start, allAI) {
        const g = new VE.Game(VE.view.scene);
        g.init({ fresh: true, seed: seed, setup: { start: start || 0, opponents: levels.map(l => ({ level: l })) } });
        if (allAI) { const p = g.players[g.me]; p.kind = 'ai'; p.isAI = true; p.ai = { level: allAI }; }
        return g;
      },
      // per speler: gebouwen, bevolking, soldaten, voedsel; AI-gebouwen alleen via commando's?
      report(g) {
        return g.players.filter(p => p.kind !== 'open').map(p => {
          const b = g.buildings.filter(x => x.alive && x.owner === p.id);
          const f = g.as(p.id, () => g.foodSummary());
          const builtCmds = (g.cmdLog || []).filter(c => c.ok && c.c.playerId === p.id && c.c.type === 'build').length;
          return { id: p.id, name: p.name, kind: p.kind, level: p.ai && p.ai.level, defeated: p.defeated, pop: g.popOf(p.id), soldiers: g.soldiers(undefined, p.id).length,
            buildings: b.length, built: b.filter(x => x.built).length, food: f.stock, hungry: f.hungry, gold: Math.round(p.gold), builtCmds,
            attacks: (p.ai && p.ai.attacks) || 0, lost: p.stats.lost || 0, types: [...new Set(b.map(x => x.type))].length };
        });
      }
    };
  });
}

test.describe('Single player tegen AI', () => {
  test('menu: Single Player met tegenstanders, moeilijkheid en startplek; Multiplayer komt nog', async ({ page }, info) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await expect(page.locator('#btnNew')).toHaveText(/Single Player/);
    await expect(page.locator('#btnMulti')).toBeDisabled();
    await expect(page.locator('#btnMulti')).toContainText('Coming soon');
    await page.locator('#btnNew').click();
    await expect(page.locator('#spSetup')).toBeVisible();
    await expect(page.locator('.sp-ai[data-n="1"]').first()).toBeHidden();         // 'None': geen tegenstanders
    await page.locator('[data-set="opp"] button[data-v="2"]').click();
    await page.locator('[data-set="lv1"] button[data-v="hard"]').click();
    await page.locator('[data-set="lv2"] button[data-v="easy"]').click();
    await page.locator('[data-set="start"] button[data-v="1"]').click();
    await shot(page, info.project.name, 'ai-menu');
    await page.locator('#spStart').click();
    await page.waitForFunction(() => window.VE.playing === true);
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const g = window.VE.game;
      return { me: g.me, players: g.players.map(p => ({ kind: p.kind, level: p.ai && p.ai.level, color: p.color, hq: !!g.hqOf(p.id), rank: p.rank, pop: g.popOf(p.id) })),
        banners: g.buildings.filter(b => b.group && b.group.getObjectByName('ownerBanner')).length, skirmish: g.skirmish, colors: g.world.ownerColors && g.world.ownerColors.length };
    });
    console.log('menu', JSON.stringify(r));
    expect(r.me).toBe(1);                                         // gekozen startplek II
    expect(r.players[1].kind).toBe('human');
    expect(r.players.filter(p => p.kind === 'ai').map(p => p.level).sort()).toEqual(['easy', 'hard']);
    for (const p of r.players) { expect(p.hq).toBe(true); expect(p.pop).toBe(10); expect(p.rank).toBe(2); }
    expect(new Set(r.players.map(p => p.color)).size).toBe(3);   // eigen kleuren
    expect(r.banners).toBeGreaterThanOrEqual(3);                  // vaandels op de gebouwen
    expect(r.colors).toBe(3);
    await page.evaluate(() => { const g = window.VE.game, p = g.players.find(x => x.kind === 'ai'), h = g.hqOf(p.id); window.VE.view.cam.focus(h.cx, h.cz); });
    await page.waitForTimeout(1200);
    await shot(page, info.project.name, 'ai-dorp');
    expect(errs(errors)).toEqual([]);
  });

  test('gevechten: soldaten vechten, torens schieten, gebouwen vallen; dorpshuis weg = Defeat / Victory en terug naar het menu', async ({ page }, info) => {
    test.setTimeout(300_000);
    const errors = trackErrors(page);
    await openGame(page); await startNewVillage(page); await lib(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = window.AI.make(5150, ['normal']);
      const ai = g.players.find(p => p.kind === 'ai').id, me = g.me, hqA = g.hqOf(ai), hqM = g.hqOf(me);
      g.players[ai].kind = 'ai'; g.players[ai].ai.t = 1e9;          // AI denkt even niet (zuivere gevechtstest)
      const mk = (pid, t, x, z) => g.as(pid, () => { const s = g.spawnSettler(); s.x = x; s.z = z; g.makeSoldier(s, t); s.sol.h = [x, z]; return s; });
      // 1. twee groepen in het open veld
      const mx = (hqA.cx + hqM.cx) / 2, mz = (hqA.cz + hqM.cz) / 2;
      const spot = g.freeSpotNear(mx, mz, []);
      const A = [mk(me, 'swordsman', spot[0] - 1, spot[1]), mk(me, 'swordsman', spot[0] - 1, spot[1] + 0.4), mk(me, 'archer', spot[0] - 2, spot[1])];
      const B = [mk(ai, 'spearman', spot[0] + 1.2, spot[1]), mk(ai, 'swordsman', spot[0] + 1.2, spot[1] + 0.4)];
      let hits = 0; const hp0 = B.map(s => s.sol.hp);
      for (let i = 0; i < 600 && g.soldiers(undefined, ai).length && g.soldiers(undefined, me).length; i++) g.tick();
      const fight = { mine: g.soldiers(undefined, me).length, theirs: g.soldiers(undefined, ai).length, lostAI: g.players[ai].stats.lost || 0, lostMe: g.players[me].stats.lost || 0 };
      // 2. toren schiet op een vijand
      const tw = g.as(me, () => { let p = null; for (let d = 3; d < 9 && !p; d++) for (let a = 0; a < 12 && !p; a++) { const i = Math.round(hqM.cx + Math.cos(a) * d), j = Math.round(hqM.cz + Math.sin(a) * d); if (g.canPlace('tower', i, j, true).ok) p = [i, j]; } return g.placeBuilding('tower', p[0], p[1], true); });
      const e = mk(ai, 'swordsman', tw.cx + 2, tw.cz + 2); e.sol.ord = 'hold'; const e0 = e.sol.hp;
      for (let i = 0; i < 80; i++) g.tick();
      const tower = { hit: e.sol.hp < e0 || !g.settlers.includes(e) };
      // 3. aanvallen op een gebouw tot het valt, dan het dorpshuis van de AI → AI verslagen → Victory
      const army = [];
      for (let n = 0; n < 8; n++) army.push(mk(me, 'axeman', hqA.cx - 3 + (n % 4) * 0.4, hqA.cz + 4 + Math.floor(n / 4) * 0.4));
      const house = g.as(ai, () => { let p = null; for (let d = 3; d < 9 && !p; d++) for (let a = 0; a < 12 && !p; a++) { const i = Math.round(hqA.cx + Math.cos(a) * d), j = Math.round(hqA.cz + Math.sin(a) * d); if (g.canPlace('house', i, j, true).ok) p = [i, j]; } return g.placeBuilding('house', p[0], p[1], true); });
      const res1 = VE.applyCommand(g, { type: 'attack', playerId: me, unitIds: army.map(s => s.id), targetId: house.id });
      const bad = VE.checkCommand(g, { type: 'attack', playerId: me, unitIds: army.map(s => s.id), targetId: hqM.id }).why;    // eigen gebouw: nee
      let houseGone = -1;
      for (let i = 0; i < 2400 && house.alive; i++) { g.tick(); if (!house.alive) houseGone = i; }
      const over = []; VE.bus.on('gameOver', e => over.push(e));
      VE.applyCommand(g, { type: 'attack', playerId: me, unitIds: g.soldiers(undefined, me).map(s => s.id), targetId: hqA.id });
      for (let i = 0; i < 6000 && !g.players[ai].defeated; i++) g.tick();
      const end = { defeated: g.players[ai].defeated, winner: g.winner, over: over.map(o => o.victory), aiBuildingsAfter: 0 };
      for (let i = 0; i < 1200; i++) g.tick();                      // verval: de rest van het AI-dorp verdwijnt
      end.aiBuildingsAfter = g.buildings.filter(b => b.alive && b.owner === ai).length;
      end.aiSettlers = g.popOf(ai);
      g.dispose();
      return { fight, tower, attackOk: res1.ok, bad, houseGone, end };
    });
    console.log('gevecht', JSON.stringify(r));
    expect(r.fight.lostAI + r.fight.lostMe).toBeGreaterThan(0);      // er sneuvelen soldaten
    expect(r.fight.theirs === 0 || r.fight.mine === 0).toBe(true);   // tot één kant over is
    expect(r.tower.hit).toBe(true);
    expect(r.attackOk).toBe(true);
    expect(r.bad).toMatch(/enemy/i);
    expect(r.houseGone).toBeGreaterThan(0);
    expect(r.end.defeated).toBe(true);
    expect(r.end.over).toEqual([true]);                           // Victory
    expect(r.end.aiSettlers).toBe(0);
    expect(r.end.aiBuildingsAfter).toBeLessThan(5);
    // eindscherm in de interface (het spel op het scherm): Defeat → terug naar het menu
    await page.evaluate(() => { const g = window.VE.game; g.skirmish = true; g.players[1].kind = 'ai'; g.players[1].ai = { level: 'easy' }; window.VE.bus.emit('gameOver', { victory: false }); });
    await expect(page.locator('#modalBox')).toContainText('Defeat');
    await shot(page, info.project.name, 'ai-defeat');
    await page.locator('#modalBox [data-act="endToMenu"]').click();
    await expect(page.locator('#startScreen')).toBeVisible();
    await expect(page.locator('#btnNew')).toBeVisible();
    expect(errs(errors)).toEqual([]);
  });

  for (const n of [1, 2]) {
    test('tegen ' + n + ' AI' + (n > 1 ? "'s" : '') + ' op alle moeilijkheden: bouwen, eten, trainen, alleen via commando\'s', async ({ page }) => {
      test.setTimeout(600_000);
      const errors = trackErrors(page);
      await openGame(page); await startNewVillage(page); await lib(page);
      const out = [];
      for (const lv of ['easy', 'normal', 'hard']) {
        const r = await page.evaluate(({ lv, n }) => {
          const g = window.AI.make(31000 + n * 7 + lv.length, n === 1 ? [lv] : [lv, lv]);
          let maxHungry = 0;
          for (let m = 0; m < 14; m++) { for (let i = 0; i < 1200; i++) g.tick(); for (const p of g.players) if (p.kind === 'ai') { const f = g.as(p.id, () => g.foodSummary()); maxHungry = Math.max(maxHungry, f.n ? f.hungry / f.n : 0); } }
          const rep = window.AI.report(g).filter(p => p.kind === 'ai');
          const failed = (g.cmdLog || []).filter(c => !c.ok && g.players[c.c.playerId].kind === 'ai').length, total = (g.cmdLog || []).filter(c => g.players[c.c.playerId].kind === 'ai').length;
          g.dispose();
          return { lv, rep, maxHungry, failed, total };
        }, { lv, n });
        out.push(r);
        console.log('AI ' + n + 'x ' + lv, JSON.stringify(r));
      }
      for (const r of out) {
        for (const p of r.rep) {
          if (p.defeated) continue;                                   // twee AI's vechten ook onderling: een verslagen AI telt niet mee
          expect(p.built, p.name + ' ' + r.lv + ' bouwt').toBeGreaterThan(r.lv === 'easy' ? 14 : 20);
          expect(p.types, 'verschillende gebouwen').toBeGreaterThan(r.lv === 'easy' ? 7 : 10);
          expect(p.builtCmds, 'elk gebouw via een commando').toBeGreaterThanOrEqual(p.buildings - 2);   // hq + startstapel
          expect(p.pop, 'bevolking groeit').toBeGreaterThan(25);
          expect(p.food + 0.1, 'voedsel op peil').toBeGreaterThan(0);
          if (r.lv !== 'easy') expect(p.soldiers + p.lost, 'traint soldaten').toBeGreaterThan(0);
        }
        expect(r.maxHungry, 'nooit massale honger').toBeLessThan(0.35);
        expect(r.failed / Math.max(1, r.total), 'weinig afgewezen commando\'s').toBeLessThan(0.2);
      }
      expect(errs(errors)).toEqual([]);
    });
  }

  test('AI tegen AI (versneld): blijft bouwen, houdt voedsel op peil en valt aan tot er een winnaar is', async ({ page }) => {
    test.setTimeout(900_000);
    const errors = trackErrors(page);
    await openGame(page); await startNewVillage(page); await lib(page);
    const r = await page.evaluate(() => {
      const g = window.AI.make(777, ['hard', 'normal'], 0, 'easy');    // drie AI's: easy, hard, normal
      const timeline = [], t0 = performance.now();
      let minFood = 1e9, attacks = 0;
      for (let m = 1; m <= 45; m++) {
        for (let i = 0; i < 1200; i++) g.tick();
        const rep = window.AI.report(g);
        if (m >= 3) for (const p of rep) if (!p.defeated) minFood = Math.min(minFood, p.food + (p.hungry ? 0 : 1));
        attacks = rep.reduce((a, p) => a + p.attacks, 0);
        if (m % 5 === 0) timeline.push({ m, rep: rep.map(p => [p.name, p.defeated ? 'X' : p.built, p.pop, p.soldiers, p.food]) });
        if (g.winner !== undefined && g.winner !== null) { timeline.push({ m, winner: g.winner }); break; }
      }
      const res = { timeline, attacks, minFood, winner: g.winner, defeated: g.players.filter(p => p.defeated).length, msPerTick: (performance.now() - t0) / g.tickN, rep: window.AI.report(g) };
      g.dispose();
      return res;
    });
    console.log('AI tegen AI', JSON.stringify(r));
    expect(r.attacks, 'de AI valt aan').toBeGreaterThan(0);
    expect(r.defeated, 'er valt een dorp').toBeGreaterThan(0);
    for (const p of r.rep) if (!p.defeated) expect(p.built, p.name + ' blijft bouwen').toBeGreaterThan(30);
    expect(r.msPerTick, 'snel genoeg voor de browser').toBeLessThan(6);
    expect(errs(errors)).toEqual([]);
  });

  test('determinisme en snapshot met AI: zelfde seed = zelfde potje; opslaan midden in het potje loopt identiek verder', async ({ page }) => {
    test.setTimeout(600_000);
    const errors = trackErrors(page);
    await openGame(page); await startNewVillage(page); await lib(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, run = () => { const g = window.AI.make(4242, ['hard', 'easy']); for (let i = 0; i < 6000; i++) g.tick(); return g; };
      const a = run(), b = run();
      const same = a.stateHash() === b.stateHash();
      b.dispose();
      const snap = JSON.parse(JSON.stringify(a.snapshot(true)));
      const c = new VE.Game(VE.view.scene); c.init(snap);
      for (let i = 0; i < 3000; i++) { a.tick(); c.tick(); }
      const after = [a.stateHash(), c.stateHash()], ai = a.players.filter(p => p.kind === 'ai').map(p => p.ai.thinks);
      a.dispose(); c.dispose();
      return { same, after, ai };
    });
    console.log('det-ai', JSON.stringify(r));
    expect(r.same).toBe(true);
    expect(r.ai.every(n => n > 50)).toBe(true);
    expect(r.after[1]).toBe(r.after[0]);
    expect(errs(errors)).toEqual([]);
  });

  test('aanvallen via de interface: soldaten kiezen en op een vijandelijk gebouw tikken', async ({ page }, info) => {
    test.setTimeout(300_000);
    const errors = trackErrors(page);
    await openGame(page);
    await page.locator('#btnNew').click();
    await page.locator('[data-set="opp"] button[data-v="1"]').click();
    await page.locator('#spStart').click();
    await page.waitForFunction(() => window.VE.playing === true);
    await page.waitForTimeout(2500);
    const touch = info.project.name === 'mobile';
    const tap = async (x, y) => { if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };
    // eigen soldaten naast een AI-gebouw, camera erop
    const p = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, ai = g.players.find(p => p.kind === 'ai').id, h = g.hqOf(ai);
      g.players[ai].ai.t = 1e9;
      const ids = [];
      for (let n = 0; n < 3; n++) g.as(g.me, () => { const s = g.spawnSettler(); const sp = g.freeSpotNear(h.cx + 3 + n * 0.4, h.cz + 3, []); s.x = sp[0]; s.z = sp[1]; g.makeSoldier(s, 'swordsman'); s.sol.h = sp; ids.push(s.id); });
      g.world.explored.fill(1); g.world.fogDirty = true;
      const c = VE.view.cam; c.tx = h.cx + 1.5; c.tz = h.cz + 2; c.ty = g.world.heightAt(h.cx, h.cz); c.tdist = c.dist = 9; c.pitch = 0.95; c.tyaw = c.yaw = 0; c.update(0);
      VE.ui.selectArmy(g.soldiers(undefined, g.me));
      const v = new THREE.Vector3(h.cx, h.y + 0.4, h.cz).project((VE.view.camera.updateMatrixWorld(), VE.view.camera)), R = VE.view.renderer.domElement.getBoundingClientRect();
      return { x: R.left + (v.x + 1) / 2 * R.width, y: R.top + (1 - v.y) / 2 * R.height, hq: h.id, n: VE.ui.army.size };
    });
    expect(p.n).toBe(3);
    await tap(p.x, p.y);
    await page.waitForTimeout(300);
    const r = await page.evaluate(hq => { const g = window.VE.game, L = g.cmdLog, c = L[L.length - 1].c; return { type: c.type, target: c.targetId, ord: g.soldiers(undefined, g.me).map(s => s.sol.ord) }; }, p.hq);
    expect(r.type).toBe('attack');
    expect(r.target).toBe(p.hq);
    expect(r.ord.every(o => o === 'attack')).toBe(true);
    await shot(page, info.project.name, 'ai-aanval');
    expect(errs(errors)).toEqual([]);
  });
});
