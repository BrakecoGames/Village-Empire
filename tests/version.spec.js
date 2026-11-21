// Versienummer + releasedatum op het startscherm en in het spelmenu; cachebusters op eigen bestanden.
const { test, expect } = require('@playwright/test');
const { trackErrors, checkErrors, openGame, startNewVillage, shot } = require('./helpers');

test('versie en datum zichtbaar in startscherm en menu', async ({ page }, info) => {
  const errors = trackErrors(page);
  const requested = [];
  page.on('request', r => requested.push(r.url()));
  await openGame(page);
  const v = await page.evaluate(() => ({ version: window.VE.VERSION, label: window.VE.versionLabel() }));
  expect(v.version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(v.label).toMatch(/^v\d+\.\d+\.\d+ · \d{2}-\d{2}-\d{4}$/);
  await expect(page.locator('#versionLabel')).toHaveText(v.label);
  await expect(page.locator('.copyright')).toBeVisible();
  await shot(page, info.project.name, 'versie-startscherm');

  // eigen scripts, stylesheet en GLB-modellen worden met ?v=<versie> opgehaald
  const own = requested.filter(u => u.startsWith('http://127.0.0.1') && /\.(js|css|glb)(\?|$)/.test(u));
  expect(own.length).toBeGreaterThan(10);
  expect(own.filter(u => !u.includes('?v=' + v.version)), 'zonder cachebuster').toEqual([]);

  await startNewVillage(page);
  await page.locator('#btnMenu').click();
  await expect(page.locator('#modal .copy.version')).toHaveText(v.label);
  await shot(page, info.project.name, 'versie-menu');
  const unknown = checkErrors(errors, info);
  expect(unknown, unknown.join('\n')).toEqual([]);
});
