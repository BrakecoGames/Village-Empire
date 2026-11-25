// Village Empire — geautomatiseerde rooktests (desktop 1920×1080 en mobiel 390×844).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { SAVE_KEY, SHOT_DIR, trackErrors, checkErrors, clickUntil, openGame, startNewVillage, shot, findPlaceSpots, layoutAudit } = require('./helpers');

const isMobileProject = info => info.project.name === 'mobile';

test.describe('Village Empire', () => {
  test('start zonder JavaScript-fouten', async ({ page }, info) => {
    const errors = trackErrors(page);
    await openGame(page);
    await expect(page.locator('#loadingText')).toBeHidden();
    await expect(page.locator('#btnNew')).toBeVisible();
    // Leeg testprofiel: er mag geen bestaande save zijn
    await expect(page.locator('#btnContinue')).toBeHidden();
    await page.waitForTimeout(1500); // een paar frames renderen
    await shot(page, info.project.name, '01-startscherm');

    await startNewVillage(page);
    await page.waitForTimeout(1500);
    await shot(page, info.project.name, '02-in-game');

    // WebGL-canvas aanwezig en gerenderd op volledige grootte
    const canvas = await page.evaluate(() => { const c = window.VE.view.renderer.domElement; return { w: c.clientWidth, h: c.clientHeight }; });
    expect(canvas.w).toBe(page.viewportSize().width);
    expect(canvas.h).toBe(page.viewportSize().height);

    const unknown = checkErrors(errors, info);
    expect(unknown, 'JS-fouten/console-errors:\n' + unknown.join('\n')).toEqual([]);
  });

  test('bouwmenu werkt en een gebouw kan geplaatst worden', async ({ page }, info) => {
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);

    // --- bouwmenu: alle categorieën tonen kaarten ---
    const cats = await page.evaluate(() => window.VE.CATS.map(c => c.id));
    await expect(page.locator('#tabs .tab')).toHaveCount(cats.length);
    for (const cat of cats) {
      await clickUntil(page, `#tabs .tab[data-cat="${cat}"]`, () => page.evaluate(c => window.VE.ui.cat === c, cat));
      await expect(page.locator(`#tabs .tab[data-cat="${cat}"]`)).toHaveClass(/\bon\b/);
      expect(await page.locator('#cards .card').count(), `categorie ${cat} heeft kaarten`).toBeGreaterThan(0);
    }
    // Vergrendelde kaart geeft melding en selecteert niets
    if (await page.locator('#cards .card.locked').count()) {
      await clickUntil(page, '#cards .card.locked >> nth=0', () => page.locator('#toasts').textContent().then(t => t.includes('Unlocks at rank')));
      expect(await page.evaluate(() => window.VE.ui.tool)).toBeNull();
    }

    await clickUntil(page, '#tabs .tab[data-cat="basic"]', () => page.evaluate(() => window.VE.ui.cat === 'basic'));
    await shot(page, info.project.name, '03-bouwmenu');

    // --- selecteer Woodcutter ---
    await expect(page.locator('#cards .card[data-b="woodcutter"]')).not.toHaveClass(/locked/);
    await clickUntil(page, '#cards .card[data-b="woodcutter"]', () => page.evaluate(() => window.VE.ui.tool === 'woodcutter'));
    await expect(page.locator('#cards .card[data-b="woodcutter"]')).toHaveClass(/\bon\b/);
    await expect(page.locator('#toolHint')).toBeVisible();
    expect(await page.evaluate(() => window.VE.ui.tool)).toBe('woodcutter');

    // --- plaatsen via echte klik/tap op het canvas ---
    const before = await page.evaluate(() => window.VE.game.buildings.length);
    const spots = await findPlaceSpots(page, 'woodcutter');
    expect(spots.length, 'er is minstens één zichtbare geldige bouwplek').toBeGreaterThan(0);

    let placed = null;
    for (const s of spots) {
      if (isMobileProject(info)) {
        await page.touchscreen.tap(s.x, s.y); // eerste tik: voorbeeld
        await page.waitForTimeout(250);
        await shot(page, info.project.name, '04-plaatsing-voorbeeld');
        await page.touchscreen.tap(s.x, s.y); // tweede tik: bouwen
      } else {
        await page.mouse.move(s.x, s.y);
        await page.waitForTimeout(250);
        await shot(page, info.project.name, '04-plaatsing-voorbeeld');
        await page.mouse.click(s.x, s.y);
      }
      await page.waitForTimeout(300);
      placed = await page.evaluate(({ i, j }) => {
        const b = window.VE.game.buildings.find(b => b.type === 'woodcutter' && b.i === i && b.j === j);
        return b ? { id: b.id, i: b.i, j: b.j, built: b.built } : null;
      }, s);
      if (placed) break;
    }
    expect(placed, 'woodcutter is geplaatst').not.toBeNull();
    expect(await page.evaluate(() => window.VE.game.buildings.length)).toBe(before + 1);
    // na plaatsen keert de tool terug naar 'select'
    expect(await page.evaluate(() => window.VE.ui.tool)).toBeNull();
    await expect(page.locator('#toolHint')).toBeHidden();

    await page.waitForTimeout(3000); // bouwers laten lopen
    await shot(page, info.project.name, '05-gebouw-geplaatst');

    // --- opslaan gebeurt uitsluitend in het tijdelijke testprofiel ---
    await page.evaluate(() => window.VE.save());
    const saved = await page.evaluate(k => localStorage.getItem(k), SAVE_KEY);
    expect(saved).toBeTruthy();
    expect(saved).toContain('woodcutter');
    await page.reload();
    await page.locator('#menuBtns').waitFor({ state: 'visible', timeout: 30_000 });
    await expect(page.locator('#btnContinue')).toBeVisible();

    const unknown = checkErrors(errors, info);
    expect(unknown, 'JS-fouten/console-errors:\n' + unknown.join('\n')).toEqual([]);
  });

  test('VE-002: klik in bouwbalk gaat niet verloren als de voorraad verandert', async ({ page }, info) => {
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await require('./helpers').showCards(page);
    await expect(page.locator('#cards .card[data-b="woodcutter"]')).toBeVisible();

    // DOM-knoop moet behouden blijven bij een voorraadwijziging, en 'short' moet meebewegen
    const card = await page.$('#cards .card[data-b="woodcutter"]');
    await page.evaluate(() => { const g = window.VE.game; g._plank = g.stock.plank; g.stock.plank = 0; window.VE.ui.refreshHud(); });
    expect(await card.evaluate(el => el.isConnected)).toBe(true);
    expect(await card.evaluate(el => el.querySelector('.cost').classList.contains('short'))).toBe(true);
    await page.evaluate(() => { const g = window.VE.game; g.stock.plank = g._plank; window.VE.ui.refreshHud(); });
    expect(await card.evaluate(el => el.querySelector('.cost').classList.contains('short'))).toBe(false);

    // Klik met een voorraadwijziging tussen indrukken en loslaten
    const box = await card.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.evaluate(() => { const g = window.VE.game; g.stock.plank -= 1; window.VE.ui.refreshHud(); });
    await page.mouse.up();
    expect(await page.evaluate(() => window.VE.ui.tool)).toBe('woodcutter');
    await expect(page.locator('#cards .card[data-b="woodcutter"]')).toHaveClass(/\bon\b/);

    // Van tab wisselen bouwt de kaarten wel opnieuw op
    await page.locator('#tabs .tab[data-cat="food"]').click();
    expect(await card.evaluate(el => el.isConnected)).toBe(false);

    const unknown = checkErrors(errors, info);
    expect(unknown, 'JS-fouten/console-errors:\n' + unknown.join('\n')).toEqual([]);
  });

  test('VE-003: vergrendelde upgrade-knoppen zien er niet actief uit', async ({ page }, info) => {
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await page.locator('#btnUpgrades').click();
    const btns = page.locator('#modalBox button[data-act="buyUpg"]');
    await expect(btns.first()).toBeVisible();
    const n = await btns.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const b = btns.nth(i);
      await expect(b).toBeDisabled();
      await expect(b).toContainText('🔒');
      await expect(b).toHaveAttribute('title', /Unlocks at rank/);
      // niet meer groen: groenkanaal van de achtergrond mag niet duidelijk domineren
      const bg = await b.evaluate(el => getComputedStyle(el).backgroundImage);
      expect(bg).not.toContain('166, 216, 106');
    }
    await shot(page, info.project.name, '08-upgrades-vergrendeld');

    // Met rang 1 en genoeg goud is de goedkoopste upgrade wél actief en groen
    await page.evaluate(() => { const g = window.VE.game; g.rank = 1; g.gold = 1000; window.VE.ui.openUpgrades(); });
    const first = page.locator('#modalBox button[data-act="buyUpg"]').first();
    await expect(first).toBeEnabled();
    await expect(first).not.toContainText('🔒');
    expect(await first.evaluate(el => getComputedStyle(el).backgroundImage)).toContain('166, 216, 106');

    const unknown = checkErrors(errors, info);
    expect(unknown, 'JS-fouten/console-errors:\n' + unknown.join('\n')).toEqual([]);
  });

  test('visuele audit van de HUD', async ({ page }, info) => {
    await openGame(page);
    await startNewVillage(page);
    await page.waitForTimeout(7000); // welkomst-toasts verschijnen
    await shot(page, info.project.name, '06-hud-met-meldingen');
    const audit = await layoutAudit(page);
    // ook met de charter-/questlijst open en een modal
    await page.locator('#btnUpgrades').click();
    await page.waitForTimeout(600);
    await shot(page, info.project.name, '07-upgrades-venster');
    audit.modal = await page.evaluate(() => {
      const r = document.getElementById('modalBox').getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), outside: r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight };
    });
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.writeFileSync(path.join(SHOT_DIR, `layout-audit-${info.project.name}.json`), JSON.stringify(audit, null, 2));
    // Deze test faalt niet op visuele punten; ze worden vastgelegd voor het rapport.
    info.annotations.push({ type: 'layout', description: audit.issues.join(' | ') || 'geen problemen' });
  });
});
