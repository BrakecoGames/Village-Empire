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
  // de opslagplaats met stapels
  { name: 'g-opslagplaats', dist: 7.5, yaw: Math.PI / 4, yard: true },
  // zo dicht mogelijk bij een groepje dorpelingen (dichtste zoom van de game)
  { name: 'd-poppetjes', dist: 6.5, yaw: Math.PI / 4 + 0.3, follow: true },
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
    // ingesleten paadjes voor de deuren (vroeger: aangelegde wegen)
    for (const b of g.buildings) for (let n = 1; n <= 2; n++) { const i = b.doorI, j = b.doorJ + n; if (g.world.inb(i, j)) for (let t = 0; t < VE.PATH.PATH_ON; t++) g.tread(j * VE.N + i); }
    g.world.rebuildRoads();
    VE.ui.toast = () => {}; // geen meldingen in beeld
    document.getElementById('hud').style.visibility = 'hidden';
  });
  await page.waitForTimeout(4000); // dorpelingen gaan lopen

  fs.mkdirSync(OUT, { recursive: true });
  for (const v of VIEWS) {
    await page.evaluate(v => {
      const c = window.VE.view.cam, g = window.VE.game, hq = g.hq;
      if (v.follow) {
        // dorpeling met de meeste buren binnen 1.5 tegel → mooi groepje in beeld
        let best = g.settlers[0], bn = -1;
        for (const s of g.settlers) { if (s.hidden) continue; const n = g.settlers.filter(o => !o.hidden && Math.hypot(o.x - s.x, o.z - s.z) < 1.5).length; if (n > bn) { bn = n; best = s; } }
        c.tx = best.x; c.tz = best.z; window.__focus = best;
        window.VE.game.speed = 0; // bevriezen zodat iedereen in beeld blijft
      } else if (v.yard) {
        const y = g.buildings.find(b => b.type === 'yard'); c.tx = y.cx; c.tz = y.cz;
      } else { c.tx = hq.cx + v.dx; c.tz = hq.cz + v.dz; }
      c.tdist = c.dist = v.dist; c.tyaw = c.yaw = v.yaw;
    }, v);
    // Software-WebGL is traag: na een camerasprong eerst een paar volledige frames afwachten
    await page.waitForTimeout(2000);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: path.join(OUT, `${info.project.name}-${v.name}.png`) });
    if (v.follow) {
      // uitsnede rond het groepje voor detailbeoordeling
      const p = await page.evaluate(() => {
        const s = window.__focus, v = new THREE.Vector3(s.x, s.y + 0.2, s.z).project(window.VE.view.camera);
        return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
      });
      const vw = page.viewportSize(), w = Math.min(480, vw.width), hgt = Math.min(300, vw.height);
      const clip = { x: Math.max(0, Math.min(vw.width - w, p.x - w / 2)), y: Math.max(0, Math.min(vw.height - hgt, p.y - hgt / 2)), width: w, height: hgt };
      await page.screenshot({ path: path.join(OUT, `${info.project.name}-e-poppetjes-uitsnede.png`), clip });
    }
  }
  // Prestaties: gemiddelde frametijd over 3 s (SwiftShader, dus alleen relatief bruikbaar)
  const ms = await page.evaluate(() => new Promise(res => {
    window.VE.game.speed = 1;
    const c = window.VE.view.cam, hq = window.VE.game.hq; c.tx = hq.cx; c.tz = hq.cz; c.tdist = c.dist = 19;
    let n = 0; const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res((performance.now() - t0) / n); };
    requestAnimationFrame(f);
  }));
  fs.writeFileSync(path.join(OUT, `${info.project.name}-frametijd.txt`), ms.toFixed(1) + ' ms/frame\n');
  const unknown = checkErrors(errors, info);
  if (unknown.length) throw new Error(unknown.join('\n'));
});

// Ingesleten paden na een kwartier spelen (zonder tekenen gesimuleerd)
test('@visual paden na een tijdje spelen', async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    let s = 1;
    window.__seedRng = v => { s = v; };
    Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  });
  await openGame(page);
  await page.evaluate(() => { window.__seedRng(1234567); window.VE.newGame(); document.getElementById('hud').style.visibility = 'hidden'; window.VE.ui.toast = () => {}; });
  await page.waitForFunction(() => window.VE.playing === true);
  const n = await page.evaluate(() => {
    const VE = window.VE, g = VE.game, hq = g.hq, w = g.world;
    const want = ['woodcutter', 'house', 'sawmill', 'quarry', 'forester', 'house'];
    for (let r = 3; r < 10 && want.length; r++) for (let j = hq.j - r; j <= hq.j + r && want.length; j++) for (let i = hq.i - r; i <= hq.i + r && want.length; i++) {
      if (Math.max(Math.abs(i - hq.i), Math.abs(j - hq.j)) !== r) continue;
      if ((i + j) % 3 === 0 && g.canPlace(want[0], i, j, true).ok) g.placeBuilding(want.shift(), i, j, true);
    }
    g.stock.log += 20; g.stock.plank += 20; g.stock.stone += 10;
    g.speed = 0;
    for (let t = 0; t < 900; t += 0.1) g.update(0.1);
    w.rebuildRoads();
    const c = VE.view.cam; c.tx = hq.cx; c.tz = hq.cz + 1; c.tdist = c.dist = 17; c.tyaw = c.yaw = Math.PI / 4 + 0.3;
    let a = 0; for (let k = 0; k < VE.N * VE.N; k++) if (w.road[k]) a++; return a;
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${info.project.name}-h-paden.png`) });
  fs.writeFileSync(path.join(OUT, `${info.project.name}-paden.txt`), n + ' pad/spoor-tegels\n');
  const unknown = checkErrors(errors, info);
  if (unknown.length) throw new Error(unknown.join('\n'));
});

// Opgestelde dorpelingen in verschillende houdingen, van dichtbij (dichter dan de game toelaat)
test('@visual poppetjes line-up', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    let s = 1;
    window.__seedRng = v => { s = v; };
    Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  });
  await openGame(page);
  await page.evaluate(() => { window.__seedRng(1234567); window.VE.newGame(); document.getElementById('hud').style.visibility = 'hidden'; window.VE.ui.toast = () => {}; });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const VE = window.VE, g = VE.game, c = VE.view.cam, hq = g.hq;
    g.speed = 0; // simulatie bevriezen; houdingen blijven staan
    // vrije plek zoeken: geen bomen/rotsen/gebouwen in een strook rond de line-up en ervoor (richting camera)
    const yaw = Math.PI / 4, w = g.world, N = VE.N;
    let tx = hq.cx + 2.2, tz = hq.cz + 2.2;
    const free = (x, z) => { for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const i = Math.floor(x + dx), j = Math.floor(z + dz); if (!w.inb(i, j)) return false; const k = j * N + i; if (w.tree[k] || w.rock[k] || w.bld[k] || w.type[k] !== 0 || w.explored[k] < 0.99) return false; } return true; };
    search: for (let r = 2; r < 14; r++) for (let a = 0; a < 16; a++) { const x = hq.cx + Math.cos(a / 16 * 6.283) * r, z = hq.cz + Math.sin(a / 16 * 6.283) * r; if (free(x, z)) { tx = x; tz = z; break search; } }
    c.tx = tx; c.tz = tz; c.tdist = c.dist = 3.2; c.tyaw = c.yaw = yaw; c.pitch = 0.62;
    const px = Math.cos(yaw), pz = -Math.sin(yaw);
    const poses = [
      { mode: 'work', role: 'mason', tool: 'pick', act: 'pick', ap: 0.12 },
      { mode: 'idle' },
      { mode: 'idle', moving: true, wp: 1.3 },
      { mode: 'idle', moving: true, wp: 4.2, carry: 'log' },
      { mode: 'work', role: 'woodcutter', tool: 'axe', act: 'chop', ap: 0.4 },
      { mode: 'work', role: 'mason', tool: 'pick', act: 'pick', ap: 0.3 },
      { mode: 'idle', moving: true, wp: 2.4, carry: 'plank' },
    ];
    g.settlers.forEach((s, i) => {
      if (i >= poses.length) { s.hidden = true; return; }
      const k = i - (poses.length - 1) / 2;
      Object.assign(s, { hidden: false, moving: false, act: null, tool: null, carry: null, role: 'carrier', path: null }, poses[i]);
      s.x = tx + px * k * 0.42; s.z = tz + pz * k * 0.42; s.y = g.world.heightAt(s.x, s.z); s.rot = yaw;
    });
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${info.project.name}-f-line-up.png`) });
  // zijaanzicht: gereedschap en draaghouding van opzij
  await page.evaluate(() => { for (const s of window.VE.game.settlers) s.rot += Math.PI / 2; });
  await page.waitForTimeout(2500);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: path.join(OUT, `${info.project.name}-f-line-up-zijkant.png`) });
  const unknown = checkErrors(errors, info);
  if (unknown.length) throw new Error(unknown.join('\n'));
});
