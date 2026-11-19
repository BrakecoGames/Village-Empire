// Vaste, reproduceerbare beelden voor voor/na-vergelijking van de graphics.
// Draaien:  npm run shots            (map: tests/screenshots/visual)
//           set SHOTS_DIR=voor&& npm run shots   (eigen submap)
// Dezelfde wereld (vaste seed), dezelfde gebouwen en dezelfde camerastanden.
const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { trackErrors, checkErrors, openGame, SHOT_DIR } = require('./helpers');

const OUT = path.join(SHOT_DIR, 'visual', process.env.SHOTS_DIR || '');

const VIEWS = [
  { name: 'a-dorp-dichtbij', dist: 11, yaw: Math.PI / 4, dx: 0, dz: 1 },
  { name: 'b-dorp-midden', dist: 19, yaw: Math.PI / 4 + 0.6, dx: 0, dz: 1 },
  { name: 'c-overzicht', dist: 40, yaw: Math.PI / 4, dx: 0, dz: 0 },
];

test('@visual vaste camerabeelden', async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  // Vaste seed voor Math.random → altijd dezelfde wereld en dorpelingen
  await page.addInitScript(() => {
    let s = 1234567;
    window.__seedRng = v => { s = v; };
    Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  });
  await openGame(page);
  // RNG vlak voor het maken van de wereld resetten: three.js verbruikt zelf ook random-getallen
  // (UUID's), dus zonder reset zou elke graphics-wijziging een andere wereld opleveren.
  await page.evaluate(() => { window.__seedRng(1234567); window.VE.newGame(); });
  await page.waitForFunction(() => window.VE.playing === true);

  // Een klein dorp neerzetten zodat er iets te zien is
  await page.evaluate(() => {
    const VE = window.VE, g = VE.game, hq = g.hq;
    const want = ['house', 'woodcutter', 'sawmill', 'house', 'quarry', 'forester', 'house'];
    const spots = [];
    for (let r = 2; r < 9 && want.length; r++) for (let j = hq.j - r; j <= hq.j + r && want.length; j++) for (let i = hq.i - r; i <= hq.i + r && want.length; i++) {
      if (Math.max(Math.abs(i - hq.i), Math.abs(j - hq.j)) !== r) continue;
      if (g.canPlace(want[0], i, j).ok) { g.placeBuilding(want.shift(), i, j, true); spots.push([i, j]); }
    }
    // wegen naar de deuren
    for (const b of g.buildings) for (let n = 1; n <= 2; n++) g.addRoad(b.doorI, b.doorJ + n);
    g.world.rebuildRoads();
    VE.ui.toast = () => {}; // geen meldingen in beeld
    document.getElementById('hud').style.visibility = 'hidden';
  });
  await page.waitForTimeout(4000); // dorpelingen gaan lopen

  fs.mkdirSync(OUT, { recursive: true });
  for (const v of VIEWS) {
    await page.evaluate(v => {
      const c = window.VE.view.cam, hq = window.VE.game.hq;
      c.tx = hq.cx + v.dx; c.tz = hq.cz + v.dz;
      c.tdist = c.dist = v.dist; c.tyaw = c.yaw = v.yaw;
    }, v);
    // Software-WebGL is traag: na een camerasprong eerst een paar volledige frames afwachten
    await page.waitForTimeout(2000);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: path.join(OUT, `${info.project.name}-${v.name}.png`) });
  }
  // Prestaties: gemiddelde frametijd over 3 s (SwiftShader, dus alleen relatief bruikbaar)
  const ms = await page.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res((performance.now() - t0) / n); };
    requestAnimationFrame(f);
  }));
  fs.writeFileSync(path.join(OUT, `${info.project.name}-frametijd.txt`), ms.toFixed(1) + ' ms/frame\n');
  const unknown = checkErrors(errors, info);
  if (unknown.length) throw new Error(unknown.join('\n'));
});
