// Uitvoervoorraad als zichtbare stapel bij elk productiebedrijf.
// Leeg = geen stapel, vol = volle stapel en de werker stopt ('Waiting for carriers').
const { test, expect } = require('@playwright/test');
const { trackErrors, checkErrors, openGame, startNewVillage, shot, findPlaceSpots } = require('./helpers');

const PRODUCERS = { woodcutter: 'log', quarry: 'stone', sawmill: 'plank', farm: 'grain', windmill: 'flour',
  bakery: 'bread', fisher: 'fish', vineyard: 'grape', winery: 'wine' };

test.describe('Bouwplaats', () => {
  test('geleverde materialen liggen op de grond tot de bouw klaar is', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'alleen desktop nodig');
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const spot = (await findPlaceSpots(page, 'house', 1))[0];
    const r = await page.evaluate(spot => {
      const VE = window.VE, g = VE.game, piles = g.piles;
      const b = g.placeBuilding('house', spot.i, spot.j);          // normaal bouwen: dragers + bouwer
      g.speed = 0;
      // items die binnen de bouwplaats liggen (stapels op het opslagerf tellen niet mee)
      const site = () => {
        piles.update(g);
        let c = 0; const tmp = new THREE.Matrix4(), p = new THREE.Vector3();
        for (const res of ['plank', 'stone']) {
          const m = piles.meshes[res];
          for (let k = 0; k < m.count; k++) { m.getMatrixAt(k, tmp); p.setFromMatrixPosition(tmp); if (Math.abs(p.x - b.cx) < 0.7 && Math.abs(p.z - b.cz) < 0.7) c++; }
        }
        return c;
      };
      let maxPile = 0, mismatch = 0;
      for (let t = 0; t < 600 && !b.built; t++) {
        g.update(0.1);
        const items = site();
        let del = 0; for (const res in b.delivered) del += b.delivered[res];
        if (items !== del - b.used) mismatch++;                    // stapel = geleverd min verbouwd
        maxPile = Math.max(maxPile, items);
      }
      return { built: b.built, maxPile, mismatch, after: site() };
    }, spot);
    expect(r.built, 'gebouw raakt klaar').toBe(true);
    expect(r.maxPile, 'geleverde materialen zichtbaar op de bouwplaats').toBeGreaterThan(0);
    expect(r.mismatch, 'stapel volgt geleverd min verbouwd').toBe(0);
    expect(r.after, 'na voltooiing ligt er niets meer').toBe(0);
    const unknown = checkErrors(errors, info);
    expect(unknown, unknown.join('\n')).toEqual([]);
  });

  test('stapel = geleverd min verbouwd, per materiaal', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'alleen desktop nodig');
    await openGame(page);
    await startNewVillage(page);
    const spot = (await findPlaceSpots(page, 'house', 1))[0];
    const r = await page.evaluate(spot => {
      const VE = window.VE, g = VE.game, piles = g.piles;
      const b = g.placeBuilding('house', spot.i, spot.j);
      g.speed = 0;
      const site = () => {
        piles.update(g);
        const c = { plank: 0, stone: 0 }, tmp = new THREE.Matrix4(), p = new THREE.Vector3();
        for (const r of ['plank', 'stone']) {
          const m = piles.meshes[r];
          for (let k = 0; k < m.count; k++) { m.getMatrixAt(k, tmp); p.setFromMatrixPosition(tmp); if (Math.abs(p.x - b.cx) < 0.7 && Math.abs(p.z - b.cz) < 0.7) c[r]++; }
        }
        return c;
      };
      const out = {};
      b.delivered = {}; b.used = 0; out.none = site();
      b.delivered = { plank: 3 }; out.p3 = site();
      b.delivered = { plank: 4, stone: 2 }; out.all = site();
      b.used = 2; out.used2 = site();          // 2 planken verbouwd
      b.used = 5; out.used5 = site();          // alle planken + 1 steen
      // vastleggen voor een screenshot
      b.used = 1; site();
      window.__site = { cx: b.cx, cz: b.cz };
      return out;
    }, spot);
    expect(r.none).toEqual({ plank: 0, stone: 0 });
    expect(r.p3).toEqual({ plank: 3, stone: 0 });
    expect(r.all).toEqual({ plank: 4, stone: 2 });
    expect(r.used2).toEqual({ plank: 2, stone: 2 });
    expect(r.used5).toEqual({ plank: 0, stone: 1 });
    await page.evaluate(() => { const c = window.VE.view.cam, s = window.__site; c.tx = s.cx; c.tz = s.cz + 0.2; c.tdist = c.dist = 3.4; c.tyaw = c.yaw = Math.PI / 4 - 0.35; });
    await page.waitForTimeout(1500);
    await shot(page, 'piles', 'bouwplaats');
  });
});

test.describe('Voorraadstapels', () => {
  test('leeg, half en vol per productiebedrijf; vol = werker stopt', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'logica: alleen desktop nodig');
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await page.evaluate(() => { const g = window.VE.game; g.rank = 4; g.gold = 1e6; g.world.setTerritory([{ x: g.hq.cx, z: g.hq.cz, r: 16 }]); });
    // wachten tot ook de later geladen modellen binnen zijn (anders test je de procedurele reserve)
    await page.evaluate(() => window.VE.glbAllReady);
    for (const [type, res] of Object.entries(PRODUCERS)) {
      // liefst een zichtbare plek (voor de screenshot), anders een geldige plek ergens in het gebied
      const spot = (await findPlaceSpots(page, type, 1))[0] || await page.evaluate(type => {
        const g = window.VE.game, hq = g.hq;
        for (let r = 2; r < 16; r++) for (let j = hq.j - r; j <= hq.j + r; j++) for (let i = hq.i - r; i <= hq.i + r; i++)
          if (Math.max(Math.abs(i - hq.i), Math.abs(j - hq.j)) === r && g.canPlace(type, i, j).ok) return { i, j };
        return null;
      }, type);
      expect(spot, type + ': bouwplek').toBeTruthy();
      const r = await page.evaluate(({ type, res, spot }) => {
        const VE = window.VE, g = VE.game, piles = g.piles;
        const b = g.placeBuilding(type, spot.i, spot.j, true);
        const count = () => { piles.update(g); return piles.meshes[res].count; };
        const base = (() => { b.output = {}; return count(); })();     // andere stapels (opslagerf) tellen mee
        const out = { type, cap: g.cap(b), glbPile: !!VE.buildModel(type, 1).pile };
        out.empty = count() - base;
        b.output = { [res]: 2 }; out.two = count() - base;
        b.output = { [res]: g.cap(b) }; out.full = count() - base;
        // vol: de werker begint niet aan nieuw werk
        out.outFull = g.outFull(b);
        // een drager haalt er één af → stapel krimpt
        b.output[res]--; out.afterPickup = count() - base;
        b.output = {};
        out.cleared = count() - base;
        // levels: een level-3 bedrijf heeft een grotere voorraad (cap) en dus een hogere volle stapel
        b.level = 3; g.makeMesh(b); out.cap3 = g.cap(b);
        b.output = { [res]: g.cap(b) }; out.full3 = count() - base;
        window.__last = { id: b.id, cx: b.cx, cz: b.cz };
        return out;
      }, { type, res, spot });
      expect(r.glbPile, type + ': model heeft een stapelplek').toBe(true);
      expect(r.empty, type + ': leeg = geen stapel').toBe(0);
      expect(r.two, type + ': 2 in voorraad = 2 items').toBe(2);
      expect(r.full, type + ': vol = cap items').toBe(r.cap);
      expect(r.outFull, type + ': vol → werker wacht op dragers').toBe(true);
      expect(r.afterPickup).toBe(r.cap - 1);
      expect(r.cleared).toBe(0);
      expect(r.full3).toBe(r.cap3);
      // screenshot met volle stapel (level 3)
      await page.evaluate(() => { const c = window.VE.view.cam, b = window.__last; c.tx = b.cx; c.tz = b.cz + 0.2; c.tdist = c.dist = 3.6; c.tyaw = c.yaw = Math.PI / 4 - 0.35; window.VE.game.speed = 0; });
      await page.waitForTimeout(1200);
      await shot(page, 'piles', `${type}-vol`);
    }
    const unknown = checkErrors(errors, info);
    expect(unknown, unknown.join('\n')).toEqual([]);
  });

  test('in het echt: houthakker vult zijn stapel en stopt als die vol is', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'alleen desktop nodig');
    test.setTimeout(240_000);
    await openGame(page);
    await startNewVillage(page);
    // willekeurige wereld: kies de bouwplek met de meeste volgroeide bomen binnen bereik
    const spots = await findPlaceSpots(page, 'woodcutter', 30);
    const r = await page.evaluate(spots => {
      const VE = window.VE, g = VE.game, rad = VE.DEFS.woodcutter.radius;
      const trees = s => g.nature.trees.filter(t => !t.dead && t.growth >= 1 && (t.x - s.i - 0.5) ** 2 + (t.z - s.j - 0.5) ** 2 < rad * rad).length;
      const spot = spots.slice().sort((a, b) => trees(b) - trees(a))[0];
      const b = g.placeBuilding('woodcutter', spot.i, spot.j, true);
      g.speed = 0;
      // dragers die uitvoer wegbrengen uitschakelen: alles wat hij hakt blijft bij de hut liggen
      g.moveOutputs = () => 0;
      const seen = [];
      let full = false;
      for (let t = 0; t < 900 && !full; t++) {
        for (let q = 0; q < 10; q++) g.update(0.1);
        const n = Object.values(b.output).reduce((a, c) => a + c, 0);
        if (!seen.length || seen[seen.length - 1] !== n) seen.push(n);
        full = g.outFull(b);
      }
      // nog 20 s doorspelen: hij hakt niets meer bij en wacht op dragers
      let maxAfter = 0;
      for (let q = 0; q < 200; q++) { g.update(0.1); maxAfter = Math.max(maxAfter, Object.values(b.output).reduce((a, c) => a + c, 0)); }
      const statusFull = b.status;
      g.piles.update(g);
      return { seen, full, cap: g.cap(b), statusFull, maxAfter, logs: g.piles.meshes.log.count, trees: trees(spot) };
    }, spots);
    expect(r.full, 'stapel raakt vol').toBe(true);
    expect(r.seen[0]).toBe(0);
    expect(r.seen[r.seen.length - 1]).toBe(r.cap);
    expect(r.statusFull).toBe('Waiting for carriers');
    expect(r.maxAfter, 'stopt: niet meer dan vol').toBe(r.cap);
    expect(r.logs).toBeGreaterThanOrEqual(r.cap);
  });
});
