// Controleert dat elk Blender-model in public/models laadt in Three.js r128 (zelfde versie als de game).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public', 'models');
const models = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.glb')).map(f => f.slice(0, -4)) : [];

test.describe('Blender-modellen', () => {
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop', 'alleen op desktop nodig'); });
  for (const name of models) {
    test(`${name}.glb laadt in Three.js r128`, async ({ page }, info) => {
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto(`/tools/blender/preview.html?model=${name}&still`);
      await page.waitForFunction(() => window.__modelResult, null, { timeout: 30_000 });
      const r = await page.evaluate(() => window.__modelResult);
      expect(r.ok, r.error).toBe(true);
      expect(r.meshes).toBeGreaterThan(0);
      expect(r.tris).toBeGreaterThan(0);
      expect(Math.abs(r.min[1]), 'oorsprong onderaan (y-min ≈ 0)').toBeLessThan(0.01);
      fs.mkdirSync(path.join(__dirname, 'screenshots', 'models'), { recursive: true });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(__dirname, 'screenshots', 'models', name + '.png') });
      expect(errors).toEqual([]);
    });
  }
});
