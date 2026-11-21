// Testgebied voor de nieuwe visuele stijl: Cottage + Woodcutter + pad + gras/vegetatie.
// Vaste seed → altijd dezelfde wereld, dezelfde plek en dezelfde camerastanden.
//
//   set SHOTS_DIR=voor&& npm run stage      → tests/screenshots/stage/voor/
//   set SHOTS_DIR=na&& npm run stage        → tests/screenshots/stage/na/
//
// Naast screenshots schrijft de test <project>-metingen.json: draw calls, driehoeken en
// frametijden (SwiftShader-software-rendering: alleen onderling vergelijkbaar).
const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { trackErrors, checkErrors, openGame, SHOT_DIR } = require('./helpers');

const OUT = path.join(SHOT_DIR, 'stage', process.env.SHOTS_DIR || 'huidig');

const VIEWS = [
  { name: '1-testgebied-dichtbij', dist: 4.6, yaw: Math.PI / 4 },
  { name: '2-testgebied-voorkant', dist: 4.6, yaw: Math.PI / 4 - 0.75 },
  { name: '3-testgebied-midden', dist: 8.5, yaw: Math.PI / 4 + 0.35 },
  { name: '4-dorp-overzicht', dist: 17, yaw: Math.PI / 4, hq: true },
];

async function frameStats(page, seconds) {
  return page.evaluate(sec => new Promise(res => {
    const R = window.VE.view.renderer, times = [];
    let last = performance.now();
    const t0 = last;
    const f = now => {
      times.push(now - last); last = now;
      if (now - t0 < sec * 1000) requestAnimationFrame(f);
      else {
        times.shift(); times.sort((a, b) => a - b);
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        res({ frames: times.length, avgMs: +avg.toFixed(1), p95Ms: +times[Math.floor(times.length * 0.95)].toFixed(1),
          calls: R.info.render.calls, triangles: R.info.render.triangles,
          geometries: R.info.memory.geometries, programs: R.info.programs.length });
      }
    };
    requestAnimationFrame(t => { last = t; requestAnimationFrame(f); });
  }), seconds);
}

test('@visual testgebied: Cottage + Woodcutter', async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    let s = 1;
    window.__seedRng = v => { s = v; };
    Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  });
  await openGame(page);
  await page.evaluate(() => { window.__seedRng(1234567); window.VE.newGame(); });
  await page.waitForFunction(() => window.VE.playing === true);

  const stage = await page.evaluate(() => {
    const VE = window.VE, g = VE.game, hq = g.hq, w = g.world, N = VE.N;
    VE.ui.toast = () => {};
    // eerste plek (zo dicht mogelijk bij het dorpshuis) waar Cottage en Woodcutter naast elkaar passen
    let spot = null;
    for (let r = 3; r < 12 && !spot; r++) for (let j = hq.j - r; j <= hq.j + r && !spot; j++) for (let i = hq.i - r; i <= hq.i + r && !spot; i++) {
      if (Math.max(Math.abs(i - hq.i), Math.abs(j - hq.j)) !== r) continue;
      if (g.canPlace('house', i, j).ok && g.canPlace('woodcutter', i + 2, j).ok) spot = { i, j };
    }
    const house = g.placeBuilding('house', spot.i, spot.j, true);
    const wood = g.placeBuilding('woodcutter', spot.i + 2, spot.j, true);
    // paden: voor beide deuren langs, en een pad richting het dorpshuis
    const tread = (i, j) => { if (w.inb(i, j) && !w.bld[j * N + i]) for (let t = 0; t < VE.PATH.PATH_ON + 2; t++) g.tread(j * N + i); };
    const row = house.doorJ + 1;
    for (let i = house.doorI - 1; i <= wood.doorI + 1; i++) tread(i, row);
    tread(house.doorI, house.doorJ); tread(wood.doorI, wood.doorJ);
    // naar het dorpshuis: eerst horizontaal, dan verticaal
    let ci = house.doorI - 1, cj = row;
    while (ci !== hq.doorI) { ci += Math.sign(hq.doorI - ci); tread(ci, cj); }
    while (cj !== hq.doorJ + 1) { cj += Math.sign(hq.doorJ + 1 - cj); tread(ci, cj); }
    w.rebuildRoads();
    w.reveal(hq.cx, hq.cz, 16); w.updateFog(); // wolken (fog of war) boven het dorp weg
    g.speed = 0; // simulatie bevriezen: paden en dorpelingen blijven staan
    document.getElementById('hud').style.visibility = 'hidden';
    window.__stage = { x: (house.cx + wood.cx) / 2, z: house.cz + 0.6 };
    return { house: [house.i, house.j], wood: [wood.i, wood.j], src: Object.assign({}, VE.modelSource) };
  });

  fs.mkdirSync(OUT, { recursive: true });
  const shoot = async name => {
    await page.waitForTimeout(1800);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: path.join(OUT, `${info.project.name}-${name}.png`) });
  };
  const metrics = { stage, views: {} };
  for (const v of VIEWS) {
    await page.evaluate(v => {
      const c = window.VE.view.cam, hq = window.VE.game.hq, s = window.__stage;
      c.tx = v.hq ? hq.cx : s.x; c.tz = v.hq ? hq.cz + 1 : s.z;
      c.tdist = c.dist = v.dist; c.tyaw = c.yaw = v.yaw;
    }, v);
    await shoot(v.name);
    metrics.views[v.name] = await frameStats(page, 2);
  }
  // in de echte game: met HUD
  await page.evaluate(() => {
    document.getElementById('hud').style.visibility = '';
    const c = window.VE.view.cam, s = window.__stage; c.tx = s.x; c.tz = s.z; c.tdist = c.dist = 7; c.tyaw = c.yaw = Math.PI / 4;
  });
  await shoot('5-met-hud');
  // frametijd met lopende simulatie op normale speelafstand
  await page.evaluate(() => { const c = window.VE.view.cam, hq = window.VE.game.hq; c.tx = hq.cx; c.tz = hq.cz; c.tdist = c.dist = 19; window.VE.game.speed = 1; });
  await page.waitForTimeout(1500);
  metrics.spelend = await frameStats(page, 4);
  fs.writeFileSync(path.join(OUT, `${info.project.name}-metingen.json`), JSON.stringify(metrics, null, 2));
  const unknown = checkErrors(errors, info);
  if (unknown.length) throw new Error(unknown.join('\n'));
});
