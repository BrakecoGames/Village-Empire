// Wereldrand: geen harde rand, geen lege vlakken. Buitenland sluit naadloos aan op de kaart, bomen in de verte,
// water loopt door, randmist; ook helemaal uitgezoomd aan elke rand en in elke hoek geen gat (lege achtergrond)
// in de onderste helft van het beeld.
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage, shot } = require('./helpers');

const errs = errors => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);

test('wereldrand: buitenland, mist en geen lege vlakken, ook uitgezoomd', async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await openGame(page);
  await startNewVillage(page);
  await page.evaluate(() => window.VE.glbAllReady);
  const r = await page.evaluate(() => {
    const VE = window.VE, g = VE.game, w = g.world, N = VE.N, H = w.horizon;
    const out = { N, has: !!H, island: !!w.island };
    if (!H) return out;
    // naad: hoekpunten van het buitenland op de kaartrand liggen precies op de kaarthoogte
    const p = H.land.geometry.attributes.position; let seam = 0, seamN = 0;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      if ((x === 0 || x === N || z === 0 || z === N) && x >= 0 && z >= 0 && x <= N && z <= N) { seam = Math.max(seam, Math.abs(p.getY(i) - w.heightAt(x, z))); seamN++; }
    }
    out.seam = seam; out.seamN = seamN;
    out.skirtHidden = !w.skirt || !w.skirt.visible;
    out.mist = H.mist.visible && H.mist.material.transparent;
    out.trees = H.trees.reduce((s, t) => s + t.hi, 0);
    // uitgezoomd aan alle randen en hoeken: doorzichtige pixels (= niets getekend) in de onderste 55 % van het beeld
    const R = VE.view.renderer, cam = VE.view.cam, gl = R.getContext(), cv = R.domElement;
    const views = [];
    const spots = [[N / 2, -2], [N + 2, N / 2], [N / 2, N + 2], [-2, N / 2], [0, 0], [N, 0], [N, N], [0, N]];
    for (const [x, z] of spots) for (const yaw of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      cam.tx = x; cam.tz = z; cam.tdist = cam.dist = N > 64 ? 58 : 42; cam.pitch = 0.42; cam.tyaw = cam.yaw = yaw;
      cam.update ? cam.update(0) : 0;
      VE.view.camera.updateMatrixWorld(true);
      R.render(VE.view.scene, VE.view.camera);
      const W = gl.drawingBufferWidth, Hh = gl.drawingBufferHeight, h = Math.floor(Hh * 0.55);
      const px = new Uint8Array(W * h * 4);
      gl.readPixels(0, 0, W, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let empty = 0, n = 0;
      for (let i = 0; i < px.length; i += 4 * 7) { n++; if (px[i + 3] < 200) empty++; }
      views.push({ x, z, yaw: +yaw.toFixed(2), empty: empty / n });
    }
    out.views = views; out.worst = Math.max(...views.map(v => v.empty));
    return out;
  });
  console.log('rand', JSON.stringify({ ...r, views: undefined }), JSON.stringify(r.views.filter(v => v.empty > 0)));
  expect(r.has).toBe(true);
  if (r.island) expect(r.seamN, 'eiland: rondom zee, geen buitenland').toBe(0);
  else { expect(r.seamN).toBeGreaterThan(50); expect(r.seam, 'naadloze aansluiting op de kaart').toBeLessThan(0.02); }
  expect(r.skirtHidden, 'geen bruine rand meer').toBe(true);
  expect(r.mist).toBe(true);
  if (!r.island) expect(r.trees, 'bomen in de verte').toBeGreaterThan(500);
  expect(r.worst, 'nergens een leeg vlak in beeld').toBeLessThan(0.005);
  // foto: helemaal uitgezoomd boven een hoek
  await page.evaluate(() => {
    const VE = window.VE, N = VE.N, cam = VE.view.cam;
    cam.tx = N - 6; cam.tz = 6; cam.tdist = cam.dist = N > 64 ? 58 : 42; cam.pitch = 0.6; cam.tyaw = cam.yaw = Math.PI * 0.75;
  });
  await page.waitForTimeout(1500);
  await shot(page, info.project.name, 'rand-uitgezoomd');
  expect(errs(errors)).toEqual([]);
});
