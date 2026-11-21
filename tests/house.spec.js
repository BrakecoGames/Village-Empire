// Woonhuis (Cottage): GLB-model uit Blender, met fallback naar het procedurele model.
const { test, expect } = require('@playwright/test');
const { SAVE_KEY, trackErrors, checkErrors, openGame, startNewVillage, shot, findPlaceSpots } = require('./helpers');

/** Plaatst direct (zonder bouwtijd) een huis op de dichtstbijzijnde vrije zichtbare plek. */
async function placeHouseInstant(page, level) {
  const spots = await findPlaceSpots(page, 'house', 1);
  expect(spots.length).toBeGreaterThan(0);
  return page.evaluate(({ s, level }) => {
    const g = window.VE.game;
    const b = g.placeBuilding('house', s.i, s.j, true);
    if (level > 1) { b.level = level; g.makeMesh(b); }
    return { id: b.id, i: b.i, j: b.j, cx: b.cx, cz: b.cz, y: b.y };
  }, { s: spots[0], level });
}

/** Camera dichtbij op een gebouw richten. */
async function focusOn(page, b, dist) {
  await page.evaluate(({ b, dist }) => {
    const c = window.VE.view.cam;
    c.focus(b.cx, b.cz); c.tdist = dist; c.dist = dist;
  }, { b, dist });
  await page.waitForTimeout(1800);
}

test.describe('Woonhuis', () => {
  test('GLB-huisje laadt, staat op de grond en houdt functionaliteit', async ({ page }, info) => {
    const errors = trackErrors(page);
    await openGame(page);
    const src = await page.evaluate(() => window.VE.modelSource && window.VE.modelSource.house);
    info.annotations.push({ type: 'house-source', description: String(src) });
    expect(src, 'huis komt uit public/models/house.glb').toBe('glb');

    await startNewVillage(page);

    // Plaatsen via echte UI (kaart + klik/tik), zoals de speler het doet
    await page.locator('#cards .card[data-b="house"]').click();
    const spots = await findPlaceSpots(page, 'house', 6);
    expect(spots.length).toBeGreaterThan(0);
    let placed = null;
    for (const s of spots) {
      if (info.project.name === 'mobile') { await page.touchscreen.tap(s.x, s.y); await page.waitForTimeout(200); await page.touchscreen.tap(s.x, s.y); }
      else await page.mouse.click(s.x, s.y);
      await page.waitForTimeout(300);
      placed = await page.evaluate(({ i, j }) => { const b = window.VE.game.buildings.find(b => b.type === 'house' && b.i === i && b.j === j); return b ? { id: b.id } : null; }, s);
      if (placed) break;
    }
    expect(placed, 'huis geplaatst via UI').not.toBeNull();

    // Bouwsteiger-animatie werkt nog (mesh groeit met scale.y)
    const growing = await page.evaluate(id => { const b = window.VE.game.bmap[id]; return { built: b.built, sy: b.mesh.scale.y, scaffold: !!b.scaffold }; }, placed.id);
    expect(growing.built).toBe(false);
    expect(growing.scaffold).toBe(true);

    // Bouwen afronden en controleren: geometrie = gedeelde GLB-geometrie, op de grond, selecteerbaar
    const st = await page.evaluate(id => {
      const VE = window.VE, g = VE.game, b = g.bmap[id];
      g.complete(b, true);
      const geo = b.mesh.geometry; geo.computeBoundingBox();
      return {
        shared: geo === VE.buildModel('house', 1).geo,
        minY: geo.boundingBox.min.y, maxY: geo.boundingBox.max.y,
        hasColor: !!geo.attributes.color, verts: geo.attributes.position.count,
        material: b.mesh.material === g.mats.building,
        chimneys: b.chimneys.length,
      };
    }, placed.id);
    expect(st.shared).toBe(true);
    expect(st.material).toBe(true);
    expect(st.hasColor).toBe(true);
    expect(st.minY).toBeLessThan(0);          // fundering zakt in het terrein (net als het origineel)
    expect(st.minY).toBeGreaterThan(-0.3);
    expect(st.maxY).toBeGreaterThan(0.7);
    expect(st.maxY).toBeLessThan(1.4);
    expect(st.chimneys).toBeGreaterThan(0);  // rookpunt van de schoorsteen

    // Selectie: klik op het huis opent het infopaneel
    await page.locator('#toolRow .tool[data-tool="select"]').click().catch(() => {});
    const b = await page.evaluate(id => { const b = window.VE.game.bmap[id]; return { cx: b.cx, cz: b.cz, y: b.y }; }, placed.id);
    await focusOn(page, b, 7);
    const scr = await page.evaluate(({ b }) => {
      const v = new THREE.Vector3(b.cx, b.y + 0.35, b.cz).project(window.VE.view.camera);
      return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
    }, { b });
    if (info.project.name === 'mobile') await page.touchscreen.tap(scr.x, scr.y); else await page.mouse.click(scr.x, scr.y);
    await expect.poll(() => page.evaluate(() => window.VE.ui.sel && window.VE.ui.sel.type)).toBe('house');
    await shot(page, info.project.name, 'huis-geselecteerd');

    // Upgrades: level 2 en 3 gebruiken hun eigen GLB-variant
    const lv = await page.evaluate(id => {
      const VE = window.VE, g = VE.game, b = g.bmap[id], out = [];
      for (const l of [2, 3]) { b.level = l; g.makeMesh(b); out.push(b.mesh.geometry === VE.buildModel('house', l).geo && VE.modelSource['house_' + l] === 'glb'); }
      return out;
    }, placed.id);
    expect(lv).toEqual([true, true]);

    // Opslaan + herladen: huis met level 3 komt terug
    await page.evaluate(() => window.VE.save());
    expect(await page.evaluate(k => localStorage.getItem(k), SAVE_KEY)).toContain('"t":"house"');
    await page.reload();
    await page.locator('#btnContinue').waitFor({ state: 'visible', timeout: 30_000 });
    await page.locator('#btnContinue').click();
    const after = await page.evaluate(() => window.VE.game.buildings.filter(b => b.type === 'house').map(b => ({ l: b.level, glb: b.mesh.geometry === window.VE.buildModel('house', b.level).geo })));
    expect(after).toContainEqual({ l: 3, glb: true });

    const unknown = checkErrors(errors, info);
    expect(unknown, unknown.join('\n')).toEqual([]);
  });

  test('screenshots van het huisje (level 1–3)', async ({ page }, info) => {
    await openGame(page);
    await startNewVillage(page);
    const b1 = await placeHouseInstant(page, 1);
    await focusOn(page, b1, info.project.name === 'mobile' ? 6 : 5);
    await shot(page, info.project.name, 'huis-level1-closeup');
    for (const l of [2, 3]) {
      await page.evaluate(({ id, l }) => { const g = window.VE.game, b = g.bmap[id]; b.level = l; g.makeMesh(b); }, { id: b1.id, l });
      await page.waitForTimeout(400);
      await shot(page, info.project.name, `huis-level${l}-closeup`);
    }
    // een rijtje huizen op normale speelafstand (eerst uitzoomen, dan zijn er zichtbare bouwplekken)
    await page.evaluate(() => { const c = window.VE.view.cam, hq = window.VE.game.hq; c.focus(hq.cx, hq.cz + 1); c.tdist = 16; c.dist = 16; });
    await page.waitForTimeout(1800);
    for (let n = 0; n < 4; n++) await placeHouseInstant(page, 1 + (n % 3));
    await page.waitForTimeout(600);
    await shot(page, info.project.name, 'huis-dorp-overzicht');
  });

  test('fallback: zonder GLB start de game met het oorspronkelijke huis', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'alleen desktop nodig');
    const errors = trackErrors(page);
    await page.route(/house\.glb/, r => r.abort());
    await openGame(page);
    expect(await page.evaluate(() => window.VE.modelSource.house)).toBe('procedural');
    await startNewVillage(page);
    const b = await placeHouseInstant(page, 1);
    expect(await page.evaluate(id => window.VE.game.bmap[id].mesh.geometry.attributes.position.count > 0, b.id)).toBe(true);
    // de afgebroken GLB-request zelf is verwacht; al het andere moet schoon zijn
    const unknown = checkErrors(errors.filter(e => !/house\.glb|Failed to load resource/.test(e.text)), info);
    expect(unknown, unknown.join('\n')).toEqual([]);
  });
});
