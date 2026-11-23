// Houthakken: boom zoeken -> omhakken -> vloeiend omvallen -> in stukken hakken -> stammen oppakken ->
// naar de hut dragen -> op de stapel (lokale voorraad, max. 6). Ook meerdere houthakkers tegelijk, opslaan
// midden in de cyclus, slopen, en naadloze boommodellen (screenshots van alle soorten).
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage, shot } = require('./helpers');

const errs = errors => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);

async function setup(page) {
  await page.evaluate(() => window.VE.glbAllReady);
  await page.evaluate(() => {
    const VE = window.VE, g = VE.game;
    g.world.owned.fill(1);
    for (let n = 0; n < 6; n++) g.spawnSettler();
    window.T = {
      // bouwplek met de meeste volgroeide bomen binnen bereik (en niet te dicht bij `not`)
      placeRich(not) {
        const N = VE.N, hq = g.hq, rad = VE.DEFS.woodcutter.radius - 1;
        const trees = g.nature.trees.filter(x => !x.dead && x.growth >= 1);
        let best = null, bs = -1;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          if (Math.hypot(i - hq.cx, j - hq.cz) > 16 || (not && not.some(b => Math.hypot(b.cx - i, b.cz - j) < 2.5)) || !g.canPlace('woodcutter', i, j, true).ok) continue;
          const sc = trees.filter(o => (o.x - i - 0.5) ** 2 + (o.z - j - 0.5) ** 2 < rad * rad).length;
          if (sc > bs) { bs = sc; best = [i, j]; }
        }
        return g.placeBuilding('woodcutter', best[0], best[1], true);
      },
      lumberOnGround() { let n = 0; for (const b of g.buildings) { const L = b.lumber; if (L) n += (L.tree && !L.tree.dead ? 2 : 0) + (L.long ? 2 : 0) + (L.pieces ? L.pieces.length : 0); } return n; },
      inHand() { return g.settlers.filter(s => s.mode === 'work' && s.carry === 'log' && !(s.task && s.task.picked)).length; }
    };
    document.querySelectorAll('.toast').forEach(t => t.remove());
  });
}

test.describe('Houthakken', () => {
  test('volledige cyclus: omhakken, omvallen, in stukken, dragen, opslaan', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, w = g.world;
      const b = T.placeRich();
      const phases = [];
      const note = p => { if (phases[phases.length - 1] !== p) phases.push(p); };
      let fallSeq = [], tree = null, landedAt = null, maxFall = 0, deadWhileFalling = false, logsSeen = 0, carrySeen = 0, produceAtHome = 0, produceAway = 0;
      const prod0 = g.produce.bind(g);
      g.produce = (bb, res, n) => { if (bb === b && res === 'log') { const s = b.worker; if (s && Math.hypot(s.x - b.dx, s.z - b.dz) < 0.4) produceAtHome += n; else produceAway += n; } return prod0(bb, res, n); };
      for (let t = 0; t < 200; t += 0.05) {
        g.arriveT = 1e9; g.update(0.05);
        const s = b.worker, L = b.lumber;
        if (s && s.act === 'chop' && !L) note('omhakken');
        if (L && L.tree && !L.tree.dead && L.tree.falling) {
          tree = L.tree;
          if (!tree.landed) { note('omvallen'); fallSeq.push(tree.fall); }
          else if (landedAt === null) { landedAt = tree.fall; note('ligt'); }
          maxFall = Math.max(maxFall, tree.fall);
        }
        if (tree && tree.dead && !L) deadWhileFalling = deadWhileFalling || (!tree.landed);
        if (s && s.act === 'chop' && L && (L.long || L.tree)) note('in stukken');
        const nl = (g.nature.logs || []).length; logsSeen = Math.max(logsSeen, nl);
        if (s && s.carry === 'log' && s.moving) { carrySeen++; note('dragen'); }
        if ((b.output.log || 0) >= 2) { note('op de stapel'); break; }
      }
      // vloeiend: de valhoek neemt steeds toe met kleine stapjes (geen sprong), en wordt nooit groter dan de landingshoek
      let jumps = 0, back = 0;
      for (let i = 1; i < fallSeq.length; i++) { const dlt = fallSeq[i] - fallSeq[i - 1]; if (dlt > 0.25) jumps++; if (dlt < -0.08) back++; }
      return { phases, steps: fallSeq.length, landedAt, maxFall, jumps, back, deadWhileFalling, logsSeen, carrySeen, produceAtHome, produceAway,
        out: b.output.log || 0, felled: g.stats.felled || 0, logsLeft: (g.nature.logs || []).length, treeDead: tree && tree.dead };
    });
    console.log('cyclus:', JSON.stringify(r));
    expect(r.phases.slice(0, 6)).toEqual(['omhakken', 'omvallen', 'ligt', 'in stukken', 'dragen', 'op de stapel']);
    expect(r.steps, 'omvallen duurt een paar tellen').toBeGreaterThan(15);
    expect(r.jumps).toBe(0);
    expect(r.landedAt).toBeGreaterThan(0.85);
    expect(r.landedAt).toBeLessThanOrEqual(1.5);
    expect(r.maxFall).toBeLessThanOrEqual(r.landedAt + 1e-6);   // nooit door de grond
    expect(r.deadWhileFalling).toBe(false);                      // verdwijnt niet plotseling
    expect(r.logsSeen).toBe(2);                                  // twee losse stammen op de grond
    expect(r.carrySeen).toBeGreaterThan(10);                     // zichtbaar gedragen
    expect(r.produceAway).toBe(0);                               // pas bij de hut in de voorraad
    expect(r.produceAtHome).toBeGreaterThanOrEqual(2);
    expect(r.out).toBe(2);
    expect(r.treeDead).toBe(true);
    expect(errs(errors)).toEqual([]);
  });

  test('meerdere houthakkers tegelijk, opslaan midden in de cyclus, slopen: niets kwijt', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T;
      const a = T.placeRich(), b = T.placeRich([a]), c = T.placeRich([a, b]);
      const st = g.placeBuilding('warehouse', ...(() => { const hq = g.hq; for (let r = 2; r < 8; r++) for (let j = hq.j - r; j <= hq.j + r; j++) for (let i = hq.i - r; i <= hq.i + r; i++) if (g.canPlace('warehouse', i, j, true).ok) return [i, j]; })(), true);
      g.setAccept(st, '*', false); g.setAccept(st, 'log', true);
      const wc = [a, b, c];
      let doubleChop = 0, maxOut = 0;
      for (let t = 0; t < 300; t += 0.1) {
        g.arriveT = 1e9; g.update(0.1);
        // twee houthakkers nooit aan dezelfde boom
        const trees = wc.map(x => x.lumber && x.lumber.tree).filter(Boolean);
        if (new Set(trees).size !== trees.length) doubleChop++;
        for (const x of wc) maxOut = Math.max(maxOut, g.outTotal(x));
      }
      const produced = g.stats.produced.log || 0, felled = g.stats.felled || 0;
      // boekhouding: elke omgehakte boom = 2 stammen (opgeleverd, in de hand of nog in het bos)
      const balance = produced + T.inHand() + T.lumberOnGround() - 2 * felled;
      // opslaan midden in de cyclus (eerst ruimte maken: de Storehouse kan inmiddels vol zijn)
      st.store = {}; g.sd = true;
      let saved = null;
      for (let t = 0; t < 60 && !saved; t += 0.1) { g.arriveT = 1e9; g.update(0.1); if (T.lumberOnGround() + T.inHand() >= 2) saved = { ground: T.lumberOnGround(), hand: T.inHand(), carriers: g.settlers.filter(q => q.task && q.task.picked && q.carry === 'log').length, log: g.stock.log, sv: JSON.parse(JSON.stringify(g.serialize())) }; }
      const n = new VE.Game(VE.view.scene); n.init(saved.sv);
      const afterLoad = n.stock.log;
      n.dispose();
      // slopen terwijl er hout in het bos ligt: het hout gaat naar de opslag
      let demo = null;
      for (let t = 0; t < 60 && !demo; t += 0.1) {
        g.arriveT = 1e9; g.update(0.1);
        const x = wc.find(q => q.lumber && (q.lumber.pieces.length || q.lumber.long || (q.lumber.tree && q.lumber.tree.landed)));
        if (x) { const ground = T.lumberOnGround(), before = g.stock.log, hand = T.inHand(); g.demolish(x); g.update(0.01); demo = { ground, lost: before + ground + hand - (g.stock.log + T.lumberOnGround() + T.inHand()) - Math.floor(VE.DEFS.woodcutter.cost.plank / 2) * 0, logsOnMap: (g.nature.logs || []).filter(p => !p.dead).length }; }
      }
      return { produced, felled, balance, doubleChop, maxOut, stored: st.store.log || 0, saved: { ground: saved.ground, hand: saved.hand, carriers: saved.carriers, log: saved.log, afterLoad }, demo, perHut: wc.map(x => x.alive) };
    });
    console.log('meerdere:', JSON.stringify(r));
    expect(r.felled).toBeGreaterThan(5);
    expect(r.doubleChop).toBe(0);
    expect(r.balance).toBe(0);
    expect(r.maxOut).toBeLessThanOrEqual(6);
    expect(r.stored).toBeGreaterThan(0);
    // na het laden: voorraad + hout in het bos + in de hand van houthakkers + bij dragers onderweg
    expect(r.saved.afterLoad).toBe(r.saved.log + r.saved.ground + r.saved.hand + r.saved.carriers);
    expect(r.demo).not.toBeNull();
    expect(r.demo.lost).toBe(0);
    expect(errs(errors)).toEqual([]);
  });

  test('screenshots: omvallen, liggen, in stukken hakken, stam dragen en alle boomsoorten', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'screenshots: desktop');
    test.setTimeout(180_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    await page.evaluate(() => { for (const e of document.body.children) if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.display = 'none'; window._wc = window.T.placeRich(); });
    const snap = async (name, cond) => {
      await page.evaluate(cond => {
        const g = window.VE.game, b = window._wc;
        const f = new Function('g', 'b', 'return ' + cond);
        for (let t = 0; t < 120 && !f(g, b); t += 0.05) { g.arriveT = 1e9; g.update(0.05); }
        g.speed = 0.25;
        const L = b.lumber, s = b.worker, c = window.VE.view.cam;
        const fx = L && L.tree ? L.tree.x + (L.tree.fallDir[0] * 0.35) : s ? s.x : b.cx, fz = L && L.tree ? L.tree.z + (L.tree.fallDir[1] * 0.35) : s ? s.z : b.cz;
        c.tx = fx; c.tz = fz; c.tdist = c.dist = 3.0; c.tyaw = c.yaw = 0.6;
      }, cond);
      await page.waitForTimeout(700);
      await shot(page, 'desktop', 'hout-' + name);
      await page.evaluate(() => { window.VE.game.speed = 0; });
    };
    await snap('1-omhakken', "b.worker && b.worker.act === 'chop' && !b.lumber && b.worker.ap > 0.5");
    await snap('2-omvallen', 'b.lumber && b.lumber.tree && b.lumber.tree.fall > 0.6 && !b.lumber.tree.landed');
    await snap('3-ligt', 'b.lumber && b.lumber.tree && b.lumber.tree.landed');
    await snap('4-in-stukken', "b.lumber && b.lumber.long && b.worker.act === 'chop'");
    await snap('5-dragen', "b.worker && b.worker.carry === 'log' && b.worker.moving");
    // boomsoorten op een rij (naden tussen stam en takken controleren)
    await page.evaluate(() => {
      const VE = window.VE, g = VE.game, hq = g.hq, nat = g.nature;
      const kinds = ['tree_oak', 'tree_oak_old', 'tree_beech', 'tree_birch', 'tree_pine', 'tree_spruce', 'tree_apple', 'tree_pear'];
      const z = hq.cz + 4;
      kinds.forEach((k, i) => {
        const x = hq.cx - 5 + i * 1.3;
        const t = nat.trees.find(t => !t.dead && !t.falling && t.sp === k && t.growth >= 1);
        if (!t) return;
        t.x = x; t.z = z; t.rot = 0.3; nat.setTreeM(t);
      });
      const c = VE.view.cam; c.tx = hq.cx - 0.5; c.tz = z; c.tdist = c.dist = 6.5; c.tyaw = c.yaw = 0; c.pitch = 0.45;
      window.VE.natureForceSync && window.VE.natureForceSync();
    });
    await page.waitForTimeout(1500);
    await shot(page, 'desktop', 'hout-6-boomsoorten');
    expect(errs(errors)).toEqual([]);
  });
});
