// Ronde 3: opslagplaats, stenen als obstakel, middenmuis-camera, pikhouweel, verkenning (fog of war).
const { test, expect } = require('@playwright/test');
const { SAVE_KEY, trackErrors, checkErrors, openGame, startNewVillage } = require('./helpers');

test.describe('Ronde 3', () => {
  test('opslagplaats met stapels naast het dorpshuis', async ({ page }, info) => {
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const r = await page.evaluate(() => {
      const g = window.VE.game, y = g.buildings.find(b => b.type === 'yard'), hq = g.hq;
      const piles = {}; for (const k in g.piles.meshes) piles[k] = g.piles.meshes[k].count;
      g.demolish(y); // vaste gebouwen kunnen niet gesloopt worden
      const before = { ...piles };
      y.store.log += 25; g.piles.update(g);   // de stapel toont elk stuk dat erop ligt
      return { yard: !!y, dist: Math.hypot(y.cx - hq.cx, y.cz - hq.cz), storage: !!y.def.storage, alive: y.alive, before, logAfter: g.piles.meshes.log.count };
    });
    expect(r.yard).toBe(true);
    expect(r.dist).toBeLessThan(6);
    expect(r.storage).toBe(true);
    expect(r.alive).toBe(true);
    expect(r.before.plank).toBeGreaterThan(0);
    expect(r.before.stone).toBeGreaterThan(0);
    expect(r.logAfter).toBeGreaterThan(r.before.log); // stapel groeit mee met de voorraad
    expect(checkErrors(errors, info)).toEqual([]);
  });

  test('dorpelingen lopen niet door stenen', async ({ page }, info) => {
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const r = await page.evaluate(() => {
      const g = window.VE.game, w = g.world, N = window.VE.N;
      const rocks = g.nature.rocks.filter(o => !o.dead);
      const allBlocked = rocks.every(o => !w.walkable(o.k));
      // zoek een steen met vrije tegels links en rechts, en vraag een pad van links naar rechts
      let tested = 0, through = 0;
      for (const o of rocks) {
        const i = o.k % N, j = (o.k / N) | 0;
        if (i < 2 || i > N - 3) continue;
        const a = j * N + i - 1, b = j * N + i + 1;
        if (!w.walkable(a) || !w.walkable(b)) continue;
        const p = g.pf.find(a, b); if (!p) continue;
        tested++; if (p.some(k => w.rock[k])) through++;
        if (tested >= 10) break;
      }
      return { rocks: rocks.length, allBlocked, tested, through };
    });
    expect(r.rocks).toBeGreaterThan(0);
    expect(r.allBlocked).toBe(true);
    expect(r.tested).toBeGreaterThan(0);
    expect(r.through).toBe(0);
    expect(checkErrors(errors, info)).toEqual([]);
  });

  test('middelste muisknop: draaien en kantelen', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'geen muis op mobiel');
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const before = await page.evaluate(() => { const c = window.VE.view.cam; return { yaw: c.tyaw, pitch: c.pitch }; });
    const vw = page.viewportSize();
    await page.mouse.move(vw.width / 2, vw.height / 2);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(vw.width / 2 + 120, vw.height / 2 + 60, { steps: 6 });
    await page.mouse.up({ button: 'middle' });
    const after = await page.evaluate(() => { const c = window.VE.view.cam; return { yaw: c.tyaw, pitch: c.pitch, tool: window.VE.ui.tool, sel: !!window.VE.ui.sel }; });
    expect(after.yaw).not.toBeCloseTo(before.yaw, 2);   // zijwaarts slepen draait
    expect(after.pitch).toBeGreaterThan(before.pitch);   // omlaag slepen = meer van bovenaf
    expect(after.tool).toBeNull();
    expect(after.sel).toBe(false);
    // grenzen: nooit platter dan ~20° of steiler dan ~82°
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(vw.width / 2, vw.height - 5, { steps: 4 });
    await page.mouse.move(vw.width / 2, 5, { steps: 8 });
    await page.mouse.move(vw.width / 2, 2, { steps: 2 });
    await page.mouse.up({ button: 'middle' });
    const p = await page.evaluate(() => window.VE.view.cam.pitch);
    expect(p).toBeGreaterThanOrEqual(0.42 - 1e-6);
    expect(p).toBeLessThanOrEqual(1.36 + 1e-6);
    expect(checkErrors(errors, info)).toEqual([]);
  });

  test('pikhouweel: kop in de zwaairichting en gebogen', async ({ page }, info) => {
    await openGame(page);
    const r = await page.evaluate(() => {
      const g = window.VE.toolGeo('pick'); g.computeBoundingBox();
      const bb = g.boundingBox, p = g.attributes.position;
      // punten: de uiteinden van de kop liggen lager dan het midden (boog)
      let tipY = -1e9, midY = -1e9;
      for (let i = 0; i < p.count; i++) {
        const z = Math.abs(p.getZ(i)), y = p.getY(i);
        if (z > 0.09) tipY = Math.max(tipY, y);
        if (z < 0.01 && y > 0.1) midY = Math.max(midY, y);
      }
      return { dx: bb.max.x - bb.min.x, dz: bb.max.z - bb.min.z, tipY, midY };
    });
    expect(r.dz).toBeGreaterThan(r.dx * 3);  // kop loopt in de zwaairichting (z), niet zijwaarts
    expect(r.tipY).toBeLessThan(r.midY);     // gebogen: de punten hangen lager dan het midden
  });

  test('kaart ontdekken: wolken verdwijnen waar dorpelingen lopen, en dat wordt opgeslagen', async ({ page }, info) => {
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    const r = await page.evaluate(async () => {
      const VE = window.VE, g = VE.game, w = g.world, N = VE.N, hq = g.hq;
      const at = (x, z) => w.explored[Math.floor(z) * N + Math.floor(x)];
      // een onontdekte tegel, ver van de grens
      let far = null;
      for (let j = 2; j < N - 2 && !far; j++) for (let i = 2; i < N - 2; i++) {
        const k = j * N + i;
        if (w.explored[k] === 0 && w.walkable(k) && Math.hypot(i - hq.cx, j - hq.cz) > 16) { far = [i + 0.5, j + 0.5]; break; }
      }
      const res = { hq: at(hq.cx, hq.cz), farBefore: far ? at(far[0], far[1]) : -1, far: !!far };
      // een dorpeling "loopt" ernaartoe
      const s = g.settlers[0]; s.x = far[0]; s.z = far[1]; s.hidden = false; s.path = null; s.mode = 'idle'; s.wt = 999;
      // wachten op de volgende verkenningsronde (in spel-tijd; de software-renderer is traag)
      for (let t = 0; t < 150 && at(far[0], far[1]) < 1; t++) await new Promise(rs => setTimeout(rs, 100));
      res.farAfter = at(far[0], far[1]);
      res.fogAlphaHq = w.fog.geometry.attributes.fogA.array[Math.floor(hq.cz) * (N + 1) + Math.floor(hq.cx)];
      VE.save();
      res.far2 = far;
      return res;
    });
    expect(r.hq).toBe(1);
    expect(r.far).toBe(true);
    expect(r.farBefore).toBe(0);
    expect(r.farAfter).toBe(1);
    expect(r.fogAlphaHq).toBe(0);
    const saved = JSON.parse(await page.evaluate(k => localStorage.getItem(k), SAVE_KEY));
    expect(typeof saved.fog).toBe('string');
    // na herladen + Continue is de ontdekte plek nog steeds ontdekt
    await page.reload();
    await page.locator('#btnContinue').click();
    await page.waitForFunction(() => window.VE.playing === true);
    const kept = await page.evaluate(f => { const w = window.VE.game.world; return w.explored[Math.floor(f[1]) * window.VE.N + Math.floor(f[0])]; }, r.far2);
    expect(kept).toBeGreaterThan(0.85);
    expect(checkErrors(errors, info)).toEqual([]);
  });

  test('oude save zonder opslagplaats en zonder verkenning laadt goed', async ({ page }, info) => {
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    // maak er een "oude" save van: geen yard, geen fog
    await page.evaluate(k => {
      window.VE.save();
      const sv = JSON.parse(localStorage.getItem(k));
      sv.buildings = sv.buildings.filter(b => b.t !== 'yard'); delete sv.fog; sv.v = 1;   // oud formaat (voor 1.4.0)
      localStorage.setItem(k, JSON.stringify(sv));
    }, SAVE_KEY);
    // zonder beforeunload-save herladen, zodat de aangepaste save blijft staan
    await page.evaluate(() => { window.VE.playing = false; });
    await page.reload();
    await page.locator('#btnContinue').click();
    await page.waitForFunction(() => window.VE.playing === true);
    const r = await page.evaluate(() => {
      const g = window.VE.game, hq = g.hq, w = g.world, N = window.VE.N;
      return { yards: g.buildings.filter(b => b.type === 'yard').length, hqExplored: w.explored[Math.floor(hq.cz) * N + Math.floor(hq.cx)] };
    });
    expect(r.yards).toBe(1);
    expect(r.hqExplored).toBe(1);
    expect(checkErrors(errors, info)).toEqual([]);
  });
});
