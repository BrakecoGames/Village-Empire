// Touchbediening met twee vingers (mobiel): draaien gaat mee met de vingers, samen omhoog/omlaag vegen kantelt.
// Echte multi-touch via het Chrome DevTools Protocol (Input.dispatchTouchEvent).
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage } = require('./helpers');

const errs = errors => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);

async function gesture(page, from, to, steps) {
  const cdp = await page.context().newCDPSession(page);
  const pts = t => from.map((p, i) => ({ x: p[0] + (to[i][0] - p[0]) * t, y: p[1] + (to[i][1] - p[1]) * t, id: i }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(0) });
  for (let s = 1; s <= steps; s++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(s / steps) }); await page.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
}
const cam = page => page.evaluate(() => { const c = window.VE.view.cam; return { yaw: c.tyaw, pitch: c.pitch, dist: c.tdist, tx: c.tx, tz: c.tz }; });

test('twee vingers: draaien in de richting van de vingers, samen omhoog/omlaag vegen kantelt', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'touch: alleen mobiel');
  const errors = trackErrors(page);
  await openGame(page);
  await startNewVillage(page);
  const W = page.viewportSize().width, H = page.viewportSize().height, cx = W / 2, cy = H * 0.45;
  // draaien met de klok mee (op het scherm): de kaart draait mee → de camera draait de andere kant op dan voorheen
  const c0 = await cam(page);
  await gesture(page, [[cx - 80, cy], [cx + 80, cy]], [[cx - 57, cy - 57], [cx + 57, cy + 57]], 12);   // 45° met de klok mee
  const c1 = await cam(page);
  const dYaw = c1.yaw - c0.yaw;
  console.log('draaien', dYaw.toFixed(3));
  expect(dYaw).toBeGreaterThan(0.5);                                  // zelfde richting als de vingers (positief = met de klok mee)
  expect(Math.abs(c1.pitch - c0.pitch)).toBeLessThan(0.05);           // geen kanteling bij alleen draaien
  // twee vingers samen omhoog: meer naar de horizon (lagere pitch); omlaag: meer van bovenaf
  await gesture(page, [[cx - 60, cy + 60], [cx + 60, cy + 60]], [[cx - 60, cy - 40], [cx + 60, cy - 40]], 12);
  const c2 = await cam(page);
  await gesture(page, [[cx - 60, cy - 60], [cx + 60, cy - 60]], [[cx - 60, cy + 60], [cx + 60, cy + 60]], 12);
  const c3 = await cam(page);
  console.log('kantelen', c1.pitch.toFixed(3), c2.pitch.toFixed(3), c3.pitch.toFixed(3));
  expect(c2.pitch).toBeLessThan(c1.pitch - 0.2);
  expect(c3.pitch).toBeGreaterThan(c2.pitch + 0.2);
  expect(Math.abs(c2.yaw - c1.yaw)).toBeLessThan(0.05);               // geen draaiing bij alleen kantelen
  expect(Math.abs(c2.dist - c1.dist) / c1.dist).toBeLessThan(0.05);   // geen zoom bij alleen kantelen
  // knijpen zoomt nog steeds
  await gesture(page, [[cx - 40, cy], [cx + 40, cy]], [[cx - 120, cy], [cx + 120, cy]], 10);
  const c4 = await cam(page);
  expect(c4.dist).toBeLessThan(c3.dist * 0.6);
  expect(errs(errors)).toEqual([]);
});
