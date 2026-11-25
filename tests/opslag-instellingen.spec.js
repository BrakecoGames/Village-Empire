// Storehouse-instellingen: standaard alleen hout (stammen en planken) en steen; kiezen bij het plaatsen, aanpassen
// tijdens de bouw en daarna; dragers houden zich eraan zodra het gebouw klaar is; opslaan en laden.
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage, findPlaceSpots, shot } = require('./helpers');

const errs = errors => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);
const onSet = page => page.evaluate(() => Array.from(document.querySelectorAll('#infoPanel .accept .sell.on')).map(b => b.dataset.arg).sort());

test('Storehouse: goederen kiezen bij plaatsen, tijdens de bouw en daarna', async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await openGame(page);
  await startNewVillage(page);
  const mob = info.project.name === 'mobile';
  // 1. bouwknop: het infopaneel toont de keuze, standaard hout en steen
  await page.evaluate(() => (window.VE.ui.setTool('warehouse'), window.VE.ui.showInfoDef('warehouse')));
  await page.locator('#infoPanel .accept').waitFor({ state: 'visible' });
  expect(await onSet(page)).toEqual(['log', 'plank', 'stone']);
  // een extra goed aanzetten (het eerste dat nog uit staat) en planken uitzetten
  const extra = await page.evaluate(() => document.querySelector('#infoPanel .accept .sell:not(.on)').dataset.arg);
  await page.locator(`#infoPanel .accept .sell[data-arg="${extra}"]`).click();
  await page.locator('#infoPanel .accept .sell[data-arg="plank"]').click();
  expect(await onSet(page)).toEqual(['log', 'stone', extra].sort());
  await shot(page, info.project.name, 'opslag-kiezen-bij-plaatsen');
  // 2. plaatsen (op een telefoon: twee keer tikken)
  const spots = await findPlaceSpots(page, 'warehouse', 3);
  expect(spots.length).toBeGreaterThan(0);
  const before = await page.evaluate(() => window.VE.game.buildings.length);
  for (let i = 0; i < (mob ? 2 : 1); i++) { if (mob) await page.touchscreen.tap(spots[0].x, spots[0].y); else await page.mouse.click(spots[0].x, spots[0].y); await page.waitForTimeout(250); }
  const placed = await page.evaluate(n => { const b = window.VE.game.buildings[n]; return b && { type: b.type, built: b.built, acc: Object.keys(b.accept).filter(r => b.accept[r]).sort() }; }, before);
  expect(placed.type).toBe('warehouse');
  expect(placed.built).toBe(false);
  expect(placed.acc).toEqual(['log', 'stone', extra].sort());
  // het volgende Storehouse krijgt dezelfde keuze (onthouden in dit spel)
  await page.evaluate(() => (window.VE.ui.setTool('warehouse'), window.VE.ui.showInfoDef('warehouse')));
  expect(await onSet(page)).toEqual(['log', 'stone', extra].sort());
  await page.evaluate(() => window.VE.ui.setTool(null));
  // 3. tijdens de bouw: selecteren, 'Geen', dan alleen steen en vis/graan
  await page.evaluate(n => window.VE.ui.select(window.VE.game.buildings[n]), before);
  await page.locator('#infoPanel .accept').waitFor({ state: 'visible' });
  expect(await page.locator('#infoPanel').innerText()).toMatch(/Carriers start bringing these goods as soon as the Storehouse is ready/);
  await page.locator('#infoPanel [data-act="acceptAll"][data-arg="0"]').click();
  expect(await onSet(page)).toEqual([]);
  await page.locator('#infoPanel .accept .sell[data-arg="stone"]').click();
  expect(await onSet(page)).toEqual(['stone']);
  await shot(page, info.project.name, 'opslag-tijdens-bouw');
  // nog niet klaar: dragers brengen er niets heen
  const r = await page.evaluate(n => {
    const g = window.VE.game, b = g.buildings[n];
    const during = g.depotFor('stone', b.dx, b.dz, null, true) === b;
    // echt laten bouwen door dragers en een bouwer (geen geforceerde oplevering)
    for (let t = 0; t < 600 && !b.built; t += 0.1) { g.arriveT = 1e9; g.update(0.1); }
    if (!b.built) return { notBuilt: true };
    const stone = g.depotFor('stone', b.dx, b.dz, null, true) === b, log = g.depotFor('log', b.dx, b.dz, null, true) === b;
    // dragers: een tijdje laten werken; in dit Storehouse komt alleen steen
    for (let t = 0; t < 120; t += 0.1) { g.arriveT = 1e9; g.update(0.1); }
    const other = Object.keys(b.store).filter(k => k !== 'stone' && b.store[k] > 0);
    // na de bouw aanpassen: ook hout erbij
    g.setAccept(b, 'log', true);
    const log2 = g.depotFor('log', b.dx, b.dz, null, true) === b;
    return { during, stone, log, other, log2 };
  }, before);
  expect(r.notBuilt, 'gebouwd').toBeFalsy();
  expect(r.during, 'onder constructie: geen opslagplek').toBe(false);
  expect(r.stone).toBe(true);
  expect(r.log).toBe(false);
  expect(r.other, 'alleen steen erin').toEqual([]);
  expect(r.log2).toBe(true);
  // na de bouw in het paneel aanpassen
  await page.evaluate(n => { window.VE.ui.select(null); window.VE.ui.select(window.VE.game.buildings[n]); }, before);
  await page.locator('#infoPanel .accept').waitFor({ state: 'visible' });
  expect(await onSet(page)).toEqual(['log', 'stone']);
  await page.locator('#infoPanel .accept .sell[data-arg="log"]').click();
  expect(await onSet(page)).toEqual(['stone']);
  // opslaan en laden
  const kept = await page.evaluate(n => {
    const VE = window.VE, g = VE.game, b = g.buildings[n];
    const sv = JSON.parse(JSON.stringify(g.serialize()));
    const a = new VE.Game(VE.view.scene); a.init(sv);
    const b2 = a.buildings.find(q => q.type === 'warehouse' && q.cx === b.cx && q.cz === b.cz);
    const out = b2 ? VE.RES_ORDER.filter(k => b2.accept[k]).sort() : null;
    a.dispose();
    return out;
  }, before);
  expect(kept).toEqual(['stone']);
  expect(errs(errors)).toEqual([]);
});
