// Voedsel als basisbehoefte (js/food.js) en de zwaarden naar de kazerne (js/military.js).
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage, shot } = require('./helpers');

const errs = errors => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);

async function setup(page) {
  await page.evaluate(() => window.VE.glbAllReady);
  await page.evaluate(() => {
    const VE = window.VE, g = VE.game, N = VE.N;
    g.rank = 3; g.world.owned.fill(1); g.world.explored.fill(1); g.world.fogDirty = true;
    window.T = {
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
      // alle stuks van r in het dorp (opslag, producenten, invoer, dragers)
      total(r) {
        let n = 0;
        for (const b of g.buildings) { if (!b.alive) continue; const h = g.held(b); n += (h && h[r]) || 0; n += (b.input && b.input[r]) || 0; }
        for (const s of g.settlers) if (s.carry === r) n++;
        return n;
      },
      food() { return VE.FOOD.reduce((n, r) => n + window.T.total(r), 0); },
      setFood(n) { for (const r of VE.FOOD) { g.takeGoods(r, g.avail(r)); } if (n) g.addGoods('bread', n); }
    };
    document.querySelectorAll('.toast').forEach(t => t.remove());
  });
}

test.describe('Voedsel en zwaarden', () => {
  test('zwaarden: de kazerne neemt wat de smid maakt, ook zonder wachtrij, en rust er soldaten mee uit', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page); await startNewVillage(page); await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      for (let n = 0; n < 10; n++) g.spawnSettler();
      const ws = T.place('weaponsmith', [hq.cx - 4, hq.cz + 4], 3);
      const bar = T.place('barracks', [hq.cx + 5, hq.cz + 3], 4);
      const wh = T.place('warehouse', [hq.cx + 2, hq.cz + 7], 3);
      g.setAccept(wh, 'spear', true); wh.store.spear = 3; g.sd = true;          // speren in de opslag: blijven daar
      g.addGoods('plank', 30); g.addGoods('ironbar', 20); g.gold = 1000;
      g.setRecipe(ws, 'sword');
      let fromSmith = 0, fromStore = 0;
      T.run(110, () => { for (const s of g.settlers) { const t = s.task; if (t && t.dst === bar && !t._c) { t._c = 1; if (t.src === ws) fromSmith++; else fromStore++; } } });
      const before = { rack: bar.input.sword || 0, smithStatus: ws.status, smithOut: ws.output.sword || 0, produced: g.stats.produced.sword || 0, spearInStore: wh.store.spear, status: g.barracksStatus(bar) };
      // nu soldaten: zwaarden liggen er al; uitrusting komt van de smid
      g.queueTraining(bar, 'swordsman', 2);
      g.setRecipe(ws, 'gear');
      T.run(130);
      const sol = g.soldiers();
      return { before, fromSmith, fromStore, soldiers: sol.length, weapons: sol.map(s => s.weapon), rackAfter: bar.input.sword || 0, queue: bar.queue.length };
    });
    console.log('zwaarden', JSON.stringify(r));
    expect(r.before.produced).toBeGreaterThanOrEqual(5);
    expect(r.before.rack).toBeGreaterThanOrEqual(5);            // zwaarden staan in het rek van de kazerne
    expect(r.before.rack).toBeLessThanOrEqual(6);               // vaste voorraad: max. 6 per soort
    expect(r.fromSmith).toBeGreaterThanOrEqual(5);
    expect(r.fromStore).toBe(0);                                 // zonder wachtrij geen Storehouse leeghalen
    expect(r.before.spearInStore).toBe(3);
    expect(r.before.smithStatus).not.toMatch(/full/i);          // de smid blijft werken
    expect(r.soldiers).toBe(2);
    expect(r.weapons).toEqual(['sword', 'sword']);              // uitgerust met de zwaarden uit het rek
    expect(r.queue).toBe(0);
    expect(errs(errors)).toEqual([]);
  });

  test('eten: dorpelingen halen voedsel en eten het op; de voorraad daalt echt', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackErrors(page);
    await openGame(page); await startNewVillage(page); await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T;
      for (const s of g.settlers) { s.food = 0.3; s.ate = []; }
      const food0 = T.food(), per0 = {}; for (const f of VE.FOOD) per0[f] = T.total(f);
      const fed0 = g.settlers.map(s => s.food);
      let walking = 0, eatingSeen = 0;
      T.run(40, () => { for (const s of g.settlers) { if (s.meal && s.path) walking++; if (s.meal && s.meal.st === 'eat') eatingSeen++; } });
      const eaten = Object.values(g.stats.eaten || {}).reduce((a, b) => a + b, 0);
      return {
        n: g.settlers.length, food0, food1: T.food(), eaten, per0, per1: Object.fromEntries(VE.FOOD.map(f => [f, T.total(f)])),
        fedMin: Math.min(...g.settlers.map(s => s.food)), fed0: Math.max(...fed0), walking, eatingSeen,
        kinds: Object.keys(g.stats.eaten || {}), reservedLeft: VE.FOOD.reduce((n, f) => n + (g.stockRes[f] || 0), 0)
      };
    });
    console.log('eten', JSON.stringify(r));
    expect(r.eaten).toBe(r.n);                                   // iedereen at precies één keer
    expect(r.food0 - r.food1).toBe(r.eaten);                     // en dat ging echt van de voorraad af
    expect(r.fedMin).toBeGreaterThan(0.6);                       // weer verzadigd
    expect(r.walking).toBeGreaterThan(0);                        // ze liepen er echt heen
    expect(r.eatingSeen).toBeGreaterThan(0);
    expect(r.kinds.length).toBe(2);                              // brood én vis (afwisseling)
    expect(r.reservedLeft).toBe(0);
    expect(errs(errors)).toEqual([]);
  });

  test('honger: tevredenheid daalt, werk gaat trager en stopt, uitgehongerden vertrekken; afwisseling maakt blij', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page); await startNewVillage(page); await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, H = VE.HUNGER, hq = g.hq;
      for (let n = 0; n < 6; n++) g.spawnSettler();
      const saw = T.place('sawmill', [hq.cx - 3, hq.cz + 4], 3);
      g.addGoods('log', 30);
      T.run(15);                                                // werker is binnen
      const worker = saw.worker;
      const fullMult = g.craftMult(saw);
      // geen voedsel meer, iedereen zit bijna leeg
      T.setFood(0);
      for (const s of g.settlers) { s.food = 0.1; s.mood = 0.65; }
      T.run(2);
      const hungryMult = g.craftMult(saw), hungryWalk = Math.min(...g.settlers.map(s => s.walkEff));
      T.run(60);
      const moodHungry = g.foodSummary().mood;
      T.run(H.stopAfter + 10);
      const stopStatus = saw.status, stopped = g.tooHungry(worker);
      const pop0 = g.settlers.length;
      const wp0 = saw.wt, working0 = saw.working;
      T.run(10);
      const progressWhileStopped = saw.working && working0 ? wp0 - saw.wt : 0;
      T.run(H.leaveAfter);
      const pop1 = g.settlers.length, left = g.stats.left || 0;
      // voedsel terug: ze eten en worden weer tevreden; met drie soorten tevredener dan met één
      g.addGoods('bread', 60); g.addGoods('fish', 60); g.addGoods('meat', 60);
      T.run(30);
      const ss = g.settlers.filter(s => s.mode !== 'soldier');
      const a = ss[0], b = ss[1];
      a.ate = ['bread', 'fish', 'meat']; b.ate = ['bread', 'bread', 'bread'];
      a.food = b.food = 0.95; a.mood = b.mood = 0.5;
      for (let t = 0; t < 120; t++) { a.food = b.food = 0.95; g.hungerTick(1); }
      const fedNow = g.foodSummary();
      return {
        fullMult, hungryMult, hungryWalk, moodHungry, stopStatus, stopped, progressWhileStopped, pop0, pop1, left,
        moodVaried: a.mood, moodSame: b.mood, fedNow: { food: fedNow.food, starving: fedNow.starving }, minPop: H.minPop
      };
    });
    console.log('honger', JSON.stringify(r));
    expect(r.hungryMult).toBeLessThan(r.fullMult * 0.8);          // honger: duidelijk trager
    expect(r.hungryWalk).toBeLessThan(1);
    expect(r.moodHungry).toBeLessThan(0.45);                      // tevredenheid daalt
    expect(r.stopped).toBe(true);
    expect(r.stopStatus).toMatch(/too hungry/i);
    expect(r.progressWhileStopped).toBe(0);                       // werkt niet meer
    expect(r.left).toBeGreaterThan(0);                            // uitgehongerden vertrekken
    expect(r.pop1).toBeLessThan(r.pop0);
    expect(r.pop1).toBeGreaterThanOrEqual(r.minPop);              // nooit onder het minimum
    expect(r.fedNow.starving).toBe(0);                            // weer gegeten
    expect(r.moodVaried).toBeGreaterThan(r.moodSame + 0.05);      // afwisseling maakt tevredener
    expect(r.moodSame).toBeGreaterThan(0.62);
    expect(errs(errors)).toEqual([]);
  });

  test('markt: verkoopt alleen voedsel boven wat het dorp nodig heeft (instelbaar)', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackErrors(page);
    await openGame(page); await startNewVillage(page); await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      for (const s of g.settlers) s.food = 1;                    // niemand eet tijdens de meting
      const m = T.place('market', [hq.cx + 4, hq.cz + 4], 3);
      m.keep = 0;
      const reserve = g.foodReserve();
      T.setFood(reserve - 2);
      T.run(40);
      const soldLow = T.total('bread') < reserve - 2 || (m.input.bread || 0) > 0;
      T.setFood(reserve + 6);
      T.run(80);
      const afterSurplus = g.foodAvail();
      m.feed = false;                                           // uitgezet: alles mag weg
      T.run(80);
      return { reserve, soldLow, afterSurplus, afterOff: g.foodAvail() };
    });
    console.log('markt', JSON.stringify(r));
    expect(r.reserve).toBeGreaterThanOrEqual(15);
    expect(r.soldLow).toBe(false);                                // onder de reserve: niets naar de kraam
    expect(r.afterSurplus).toBe(r.reserve);                       // alleen het overschot verkocht
    expect(r.afterOff).toBeLessThan(r.reserve);
    expect(errs(errors)).toEqual([]);
  });

  test('balans, interface en opslaan: nieuw spel heeft ruim de tijd; HUD toont voorraad en tekort', async ({ page }, info) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page); await startNewVillage(page); await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T;
      const start = g.foodSummary();
      // nieuw dorp zonder voedselproductie: hoe lang duurt het voor iemand honger lijdt?
      let firstHungry = null, foodAt10 = null;
      for (let t = 0; t < 900; t += 0.5) { g.arriveT = 1e9; g.update(0.5); const f = g.foodSummary(); if (firstHungry === null && f.hungry) firstHungry = g.time; if (foodAt10 === null && t >= 600) foodAt10 = f.stock; }
      return { start: { stock: start.stock, mood: start.mood, rate: start.rate, minutes: start.minutes }, firstHungry, foodAt10 };
    });
    console.log('balans', JSON.stringify(r));
    expect(r.start.stock).toBe(24);
    expect(r.start.minutes).toBeGreaterThan(9);
    expect(r.foodAt10).toBeGreaterThan(0);                         // na 10 minuten nog eten
    expect(r.firstHungry === null || r.firstHungry > 720).toBe(true);   // pas na ruim 12 minuten honger
    // HUD: voorraad en waarschuwing
    await page.evaluate(() => { window.VE.ui.refreshHud(true); });
    const chip = page.locator('#foodBtn');
    await expect(chip).toBeVisible();
    await page.evaluate(() => { const T = window.T, g = window.VE.game; T.setFood(0); for (const s of g.settlers) s.food = 0.1; g.hungerTick(0.1); window.VE.ui.refreshHud(true); });
    await expect(chip).toHaveClass(/warn/);
    await chip.click();
    await expect(page.locator('#modalBox')).toContainText('Food & Happiness');
    await expect(page.locator('#modalBox')).toContainText('Your food is gone');
    await expect(page.locator('#modalBox')).toContainText('Eaten per minute');
    await page.waitForTimeout(600);
    await shot(page, info.project.name, 'voedsel-paneel');
    await page.evaluate(() => window.VE.ui.closeModal());
    await page.evaluate(() => { const g = window.VE.game; window.T.setFood(40); for (const s of g.settlers) s.food = 1; g.hungerTick(0.1); window.VE.ui._foodTxt = ''; window.VE.ui.refreshHud(true); });
    await expect(chip).not.toHaveClass(/warn/);
    await expect(chip).toContainText('40');
    // opslaan en laden: honger en tevredenheid blijven bewaard; oude save zonder honger → verzadigd; markt-instelling blijft
    const sv = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      const m = T.place('market', [hq.cx + 4, hq.cz + 4], 3); m.feed = false;
      g.settlers.forEach((s, i) => { s.food = 0.2 + (i % 5) * 0.1; s.mood = 0.4; s.ate = ['fish']; });
      const want = g.settlers.map(s => s.food);
      const data = JSON.parse(JSON.stringify(g.serialize()));
      const a = new VE.Game(VE.view.scene); a.init(data);
      const got = a.settlers.map(s => s.food), moods = a.settlers.map(s => s.mood), ate = a.settlers[0].ate.join(','), feed = a.buildings.find(b => b.type === 'market').feed;
      a.dispose();
      const old = JSON.parse(JSON.stringify(data)); delete old.hun;
      const o = new VE.Game(VE.view.scene); o.init(old);
      const oldFoods = o.settlers.map(s => s.food); o.dispose();
      return { want, got, moods, ate, feed, oldFoods, n: data.hun.length, pop: data.pop };
    });
    console.log('laden', JSON.stringify(sv));
    expect(sv.n).toBe(sv.pop);
    expect(sv.got.slice().sort()).toEqual(sv.want.map(v => Math.round(v * 100) / 100).sort());
    expect(sv.moods.every(v => Math.abs(v - 0.4) < 0.01)).toBe(true);
    expect(sv.ate).toBe('fish');
    expect(sv.feed).toBe(false);
    expect(sv.oldFoods.every(v => v === 1)).toBe(true);
    expect(errs(errors)).toEqual([]);
  });
});
