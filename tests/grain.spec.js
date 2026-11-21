// Graan: rijp veld → maaien met de zeis → hok op het stoppelveld → schoof naar de boerderij → naar de molen.
const { test, expect } = require('@playwright/test');
const { trackErrors, checkErrors, openGame, startNewVillage, shot } = require('./helpers');

async function farmSetup(page) {
  return page.evaluate(() => {
    const VE = window.VE, g = VE.game, hq = g.hq, w = g.world, N = VE.N;
    g.rank = 4; g.gold = 1e6; w.setTerritory([{ x: hq.cx, z: hq.cz, r: 16 }]);
    let b = null;
    for (let r = 4; r < 14 && !b; r++) for (let j = hq.j - r; j <= hq.j + r && !b; j++) for (let i = hq.i - r; i <= hq.i + r && !b; i++) {
      if (Math.max(Math.abs(i - hq.i), Math.abs(j - hq.j)) !== r || !g.canPlace('farm', i, j).ok) continue;
      let free = 0; for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const k = (j + dj) * N + i + di; if (w.inb(i + di, j + dj) && g.freeTile(k)) free++; }
      if (free > 25) b = g.placeBuilding('farm', i, j, true);
    }
    w.reveal(b.cx, b.cz, 9); w.updateFog();
    window.__farm = b;
    return { id: b.id };
  });
}

test.describe('Graan', () => {
  test('maaien met zeis, hok op het veld, schoof naar boerderij en molen', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'logica: alleen desktop');
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await farmSetup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, b = window.__farm, N = VE.N, w = g.world;
      g.speed = 0;
      // één rijp veld naast de boerderij
      const k = g.tilesInRange(b, 2).find(k => g.freeTile(k) && w.owned[k] && w.type[k] === 0);
      const f = g.nature.addField(k % N, (k / N) | 0, 0, b); b.fields.push(f); f.state = 'grown'; f.growth = 1; g.nature.setFieldM(f);
      // de boer en windmolen moeten er zijn: geef de boerderij een werker
      const seen = { mowTool: false, mowShrink: false, cut: false, stookShown: false, bindAct: false, carriedSheaf: false, empty: false, produced: 0 };
      let maxMow = 0;
      for (let t = 0; t < 1500; t++) {
        g.update(0.05);
        const s = b.worker;
        if (s && s.act === 'harvest' && s.tool === 'scythe') seen.mowTool = true;
        if ((f.mow || 0) > maxMow) maxMow = f.mow;
        if (f.state === 'cut') { seen.cut = true; g.nature.update(0.01, 1); seen.stookShown = seen.stookShown || g.nature.stook.count > 0; }
        if (s && s.act === 'sow' && f.state === 'cut') seen.bindAct = true;
        if (s && s.carry === 'grain') seen.carriedSheaf = true;
        if (seen.cut && f.state === 'empty') seen.empty = true;
        if ((b.output.grain || 0) > 0) { seen.produced = b.output.grain; break; }
      }
      seen.mowShrink = maxMow > 0.5;
      return seen;
    });
    expect(r.mowTool, 'boer maait met de zeis').toBe(true);
    expect(r.mowShrink, 'graan zakt weg tijdens het maaien').toBe(true);
    expect(r.cut, 'na het maaien staat er een hok').toBe(true);
    expect(r.stookShown).toBe(true);
    expect(r.bindAct, 'boer bindt de schoven').toBe(true);
    expect(r.carriedSheaf, 'boer draagt een schoof weg').toBe(true);
    expect(r.empty, 'daarna stoppelveld').toBe(true);
    expect(r.produced, 'schoof ligt bij de boerderij').toBeGreaterThan(0);

    // naar de molen: een drager brengt de schoof van de boerderij naar de windmolen
    const m = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, b = window.__farm, hq = g.hq;
      let mill = null;
      for (let r = 2; r < 14 && !mill; r++) for (let j = hq.j - r; j <= hq.j + r && !mill; j++) for (let i = hq.i - r; i <= hq.i + r && !mill; i++)
        if (Math.max(Math.abs(i - hq.i), Math.abs(j - hq.j)) === r && g.canPlace('windmill', i, j).ok) mill = g.placeBuilding('windmill', i, j, true);
      b.output.grain = 3;
      let carried = false, arrived = 0;
      for (let t = 0; t < 4000 && !arrived; t++) {
        g.update(0.05);
        if (g.settlers.some(s => s.carry === 'grain' && s.task && s.task.dst === mill)) carried = true;
        arrived = (mill.input.grain || 0) + (mill.working ? 1 : 0) + (mill.output.flour || 0);
      }
      return { carried, arrived };
    });
    expect(m.carried, 'drager brengt een schoof naar de molen').toBe(true);
    expect(m.arrived).toBeGreaterThan(0);
    const unknown = checkErrors(errors, info);
    expect(unknown, unknown.join('\n')).toEqual([]);
  });

  test('screenshots: akker, maaien, hokken en schoven', async ({ page }, info) => {
    test.setTimeout(180_000);
    await openGame(page);
    await startNewVillage(page);
    await farmSetup(page);
    await page.evaluate(() => {
      const VE = window.VE, g = VE.game, b = window.__farm, N = VE.N, w = g.world;
      VE.ui.toast = () => {};
      const cand = g.tilesInRange(b, 3).filter(k => g.freeTile(k) && w.owned[k] && w.type[k] === 0)
        .sort((a, c) => ((a % N) + 0.5 - b.cx) ** 2 + (((a / N) | 0) + 0.5 - b.cz) ** 2 - (((c % N) + 0.5 - b.cx) ** 2 + (((c / N) | 0) + 0.5 - b.cz) ** 2)).slice(0, 8);
      const st = [['grown', 1], ['grown', 1], ['grown', 1, 0.55], ['cut', 0], ['growing', 0.4], ['grown', 1], ['cut', 0], ['empty', 0]];
      cand.forEach((k, n) => { const f = g.nature.addField(k % N, (k / N) | 0, 0, b); b.fields.push(f); f.state = st[n][0]; f.growth = st[n][1]; f.mow = st[n][2] || 0; g.nature.setFieldM(f); });
      b.output = { grain: 7 };
      g.nature.update(0.01, 1); g.speed = 0;
      // boer met zeis in het half gemaaide veld, en een boer die een schoof draagt
      const f = b.fields[2], s = g.settlers[0], s2 = g.settlers[1];
      Object.assign(s, { hidden: false, mode: 'work', role: 'farmer', tool: 'scythe', act: 'harvest', ap: 0.3, moving: false, carry: null, path: null });
      s.x = f.i + 0.5; s.z = f.j + 0.85; s.y = w.heightAt(s.x, s.z); s.rot = Math.PI;
      Object.assign(s2, { hidden: false, mode: 'work', role: 'farmer', tool: null, act: null, moving: true, wp: 1.2, carry: 'grain', path: null });
      s2.x = b.dx + 0.4; s2.z = b.dz + 0.5; s2.y = w.heightAt(s2.x, s2.z); s2.rot = Math.PI * 0.75;
      for (let n = 2; n < g.settlers.length; n++) g.settlers[n].hidden = true;
      document.getElementById('hud').style.visibility = 'hidden';
      const c = VE.view.cam; c.tx = b.cx + 0.3; c.tz = b.cz + 0.5; c.tdist = c.dist = 7; c.pitch = 0.7;
    });
    await page.waitForTimeout(2000);
    await shot(page, info.project.name, 'graan-overzicht');
    await page.evaluate(() => { const VE = window.VE, b = window.__farm, f = b.fields[2], c = VE.view.cam; c.tx = f.i + 0.5; c.tz = f.j + 0.6; c.tdist = c.dist = 3.2; c.pitch = 0.45; });
    await page.waitForTimeout(1800);
    await shot(page, info.project.name, 'graan-maaien');
    await page.evaluate(() => { const VE = window.VE, b = window.__farm, f = b.fields[3], c = VE.view.cam; c.tx = f.i + 0.6; c.tz = f.j + 0.45; c.tdist = c.dist = 2.4; c.pitch = 0.4; });
    await page.waitForTimeout(1800);
    await shot(page, info.project.name, 'graan-hok');
  });
});
