// Telefoon-interface: zo veel mogelijk speelveld (staand en liggend). Bouwbalk ingeklapt tot één rij,
// categorie aantikken klapt uit, na het kiezen van een gebouw weer in; opdrachtenpaneel ingeklapt weg;
// minimap klein en standaard dicht; niets overlapt.
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage, shot } = require('./helpers');

const errs = errors => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);

// deel van het scherm dat niet door de interface wordt bedekt (raster van punten: is het bovenste element het canvas?)
const freeArea = page => page.evaluate(() => {
  const W = innerWidth, H = innerHeight, cv = window.VE.view.renderer.domElement; let free = 0, n = 0;
  for (let y = 4; y < H; y += 12) for (let x = 4; x < W; x += 12) { n++; if (document.elementFromPoint(x, y) === cv) free++; }
  return free / n;
});
const rect = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e || e.offsetParent === null && getComputedStyle(e).position !== 'fixed') return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom, r: r.right } : null; }, sel);
const overlap = (a, b) => a && b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;

for (const orient of ['staand', 'liggend']) {
  test(`telefoon ${orient}: speelveld vrij, bouwbalk inklapbaar, geen overlap`, async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'telefoon');
    test.setTimeout(150_000);
    const errors = trackErrors(page);
    if (orient === 'liggend') await page.setViewportSize({ width: 844, height: 390 });
    await openGame(page);
    await startNewVillage(page);
    await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
    await page.waitForTimeout(500);
    // ingeklapt: alleen gereedschap en categorieën
    const bar0 = await rect(page, '#buildBar');
    expect(await page.locator('#cards').isVisible()).toBe(false);
    expect(bar0.h).toBeLessThan(62);
    expect(await page.locator('#questPanel').isVisible()).toBe(false);          // opdrachten ingeklapt: weg
    expect(await page.locator('#minimap').isVisible()).toBe(false);             // minimap standaard dicht
    await expect(page.locator('#mmToggle')).toBeVisible();
    const free = await freeArea(page);
    console.log(orient, 'vrij speelveld', (free * 100).toFixed(0) + '%', 'bouwbalk', Math.round(bar0.h));
    expect(free).toBeGreaterThan(orient === 'staand' ? 0.72 : 0.68);
    await shot(page, info.project.name, 'ui-' + orient + '-ingeklapt');
    // categorie aantikken: gebouwen verschijnen; nog eens: weer weg
    await page.locator('.tab[data-cat="basic"]').tap();
    await expect(page.locator('#cards')).toBeVisible();
    const bar1 = await rect(page, '#buildBar');
    expect(bar1.h).toBeGreaterThan(bar0.h + 40);
    await page.locator('.tab[data-cat="basic"]').tap();
    await expect(page.locator('#cards')).toBeHidden();
    // andere categorie open, gebouw kiezen: balk klapt in, de bouwhint staat net boven de balk
    await page.locator('.tab[data-cat="food"]').tap();
    await page.locator('.tab[data-cat="basic"]').tap();
    await expect(page.locator('#cards')).toBeVisible();
    await page.locator('.card[data-b="house"]').tap();
    await expect(page.locator('#cards')).toBeHidden();
    await expect(page.locator('#toolHint')).toBeVisible();
    const hint = await rect(page, '#toolHint'), bar2 = await rect(page, '#buildBar');
    expect(hint.b).toBeLessThanOrEqual(bar2.y + 1);
    expect(bar2.y - hint.b).toBeLessThan(20);
    await page.locator('#toolCancel').tap();
    // minimap openen: klein en niet over de knoppen of de bovenbalk
    await page.locator('#mmToggle').tap();
    await expect(page.locator('#minimap')).toBeVisible();
    const mm = await rect(page, '#minimap'), side = await rect(page, '#sideBtns'), top = await rect(page, '#topbar');
    expect(mm.w).toBeLessThan(110);
    expect(overlap(mm, side)).toBeFalsy();
    expect(overlap(mm, top)).toBeFalsy();
    // opdrachten openen via de knop: zichtbaar, niet over de bouwbalk
    await page.locator('#btnQuests').tap();
    await expect(page.locator('#questPanel')).toBeVisible();
    const qp = await rect(page, '#questPanel'), bar3 = await rect(page, '#buildBar');
    expect(qp.b).toBeLessThanOrEqual(bar3.y + 1);
    await shot(page, info.project.name, 'ui-' + orient + '-open');
    expect(errs(errors)).toEqual([]);
  });
}
