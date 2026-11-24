// Productie en opslag: startvoorraad op de grond, lokale opslag van 6, Storehouses met filters en
// capaciteit, transport, nette stapels (Blender), oude saves, en een sluitende boekhouding (niets verdwijnt,
// niets dubbel).
const { test, expect } = require('@playwright/test');
const { trackErrors, openGame, startNewVillage, shot } = require('./helpers');

const errs = errors => errors.filter(e => !/crazygames/.test(e.text)).map(e => e.text);

/* hulpjes in de pagina: plekken zoeken, boekhouding, simuleren */
async function setup(page) {
  await page.evaluate(() => {
    const VE = window.VE;
    window.T = {
      spot(t, near, minD) {
        const g = VE.game, N = VE.N; let best = null, bd = 1e9;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          if (!g.canPlace(t, i, j, true).ok) continue;
          const d = Math.hypot(i - near[0], j - near[1]);
          if (minD && d < minD) continue;
          if (d < bd) { bd = d; best = [i, j]; }
        }
        return best;
      },
      place(t, near, minD) { const s = this.spot(t, near, minD); return s ? VE.game.placeBuilding(t, s[0], s[1], true) : null; },
      // bouwplek binnen 14 tegels van het dorpshuis met de meeste bomen of rotsen binnen bereik (willekeurige wereld)
      placeRich(t, not) {
        const g = VE.game, N = VE.N, hq = g.hq, rad = VE.DEFS[t].radius - 1;
        const list = t === 'quarry' ? g.nature.rocks.filter(r => !r.dead) : g.nature.trees.filter(x => !x.dead && x.growth >= 1);
        let best = null, bs = -1;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          if (Math.hypot(i - hq.cx, j - hq.cz) > 14 || (not && Math.hypot(i - not.cx, j - not.cz) < 5) || !g.canPlace(t, i, j, true).ok) continue;
          const sc = list.filter(o => (o.x - i - 0.5) ** 2 + (o.z - j - 0.5) ** 2 < rad * rad).length;
          if (sc > bs) { bs = sc; best = [i, j]; }
        }
        return g.placeBuilding(t, best[0], best[1], true);
      },
      // alles wat er in de wereld ligt of gedragen wordt, per goed
      count(g) {
        g = g || VE.game; const C = {};
        const add = (r, n) => { if (n) C[r] = (C[r] || 0) + n; };
        for (const b of g.buildings) {
          if (!b.alive) continue;
          if (b.store) for (const r in b.store) add(r, b.store[r]);
          for (const r in b.output) add(r, b.output[r]);
          for (const r in b.input) add(r, b.input[r]);
          if (!b.built) { let u = b.used; for (const r of Object.keys(b.def.cost || {})) { const d = b.delivered[r] || 0, k = Math.min(d, u); u -= k; add(r, d - k); } }
        }
        for (const s of g.settlers) if (s.task && s.task.picked && s.carry) add(s.carry, 1);
        return C;
      },
      produced() { return Object.assign({}, VE.game.stats.produced); },
      run(sec, each) {
        const g = VE.game;
        for (let t = 0; t < sec; t += 0.1) { g.arriveT = 1e9; g.update(0.1); if (each) each(t); }
      }
    };
  });
}

test.describe('Opslag en productie', () => {
  test('startvoorraad op de grond, nooit aangevuld; verdwijnt als hij op is', async ({ page }, info) => {
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, pile = g.buildings.find(b => b.type === 'yard');
      const start = Object.assign({}, pile.store);
      const total = Object.assign({}, g.stock);
      g.piles.update(g);
      const shown = {}; for (const k in start) shown[k] = g.piles.meshes[k].count;
      return { start, total, shown, vault: Object.keys(g.hq.store).length, name: pile.def.name, depots: g.buildings.filter(b => b.def.depot).length,
        dist: Math.hypot(pile.cx - g.hq.cx, pile.cz - g.hq.cz), itemSrc: VE.itemSource, pileSrc: VE.modelSource.yard,
        slots: VE.buildModel('yard', 1).slots.length };
    });
    expect(r.start).toEqual({ log: 6, stone: 14, plank: 28, bread: 8, fish: 4 });
    for (const k in r.start) expect(r.total[k]).toBe(r.start[k]);
    expect(r.shown).toEqual(r.start);               // elk stuk ligt zichtbaar op de stapel
    expect(r.vault).toBe(0);
    expect(r.depots).toBe(0);
    expect(r.dist).toBeLessThan(5);
    expect(r.itemSrc).toBe('glb');
    expect(r.pileSrc).toBe('glb');
    expect(r.slots).toBe(16);
    await page.evaluate(() => { const g = window.VE.game, p = g.buildings.find(b => b.type === 'yard'), c = window.VE.view.cam; c.tx = p.cx; c.tz = p.cz; c.tdist = c.dist = 4.2; document.querySelectorAll('.toast').forEach(t => t.remove()); });
    await page.waitForTimeout(900);
    await shot(page, info.project.name, 'opslag-startvoorraad');

    // houthakker zonder Storehouse: de startstapel groeit nooit, de houthakker stopt bij 6
    const r2 = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, pile = g.buildings.find(b => b.type === 'yard');
      const wc = T.placeRich('woodcutter');
      let maxOut = 0, pileMax = 0;
      T.run(260, () => { maxOut = Math.max(maxOut, g.outTotal(wc)); pileMax = Math.max(pileMax, pile.store.log || 0); });
      const p1 = g.stats.produced.log || 0;
      T.run(60);
      return { maxOut, pileMax, out: wc.output.log, status: wc.status, more: (g.stats.produced.log || 0) - p1 };
    });
    expect(r2.maxOut).toBe(6);
    expect(r2.out).toBe(6);
    expect(r2.pileMax).toBe(6);                      // nooit aangevuld
    expect(r2.more).toBe(0);                         // productie staat stil
    expect(r2.status).toMatch(/Storage full \(6\/6\): build a Storehouse/);

    // de stapel opmaken: hij verdwijnt en de grond komt vrij
    const r3 = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, pile = g.buildings.find(b => b.type === 'yard'), k = pile.j * VE.N + pile.i;
      const toasts = []; VE.bus.on('toast', e => toasts.push(e.text));
      for (const r in pile.store) g.takeGoods(r, pile.store[r]);
      return { alive: pile.alive, inList: g.buildings.includes(pile), tile: g.world.bld[k], toast: toasts.join('|') };
    });
    expect(r3.alive).toBe(false);
    expect(r3.inList).toBe(false);
    expect(r3.tile).toBe(0);
    expect(r3.toast).toMatch(/starting supplies are used up/);
    expect(errs(errors)).toEqual([]);
  });

  test('Storehouses: filters, capaciteit, transport en sluitende boekhouding', async ({ page }, info) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      g.world.owned.fill(1);
      for (let n = 0; n < 10; n++) g.spawnSettler();
      const c0 = T.count(), p0 = T.produced();
      const wc1 = T.placeRich('woodcutter'), wc2 = T.placeRich('woodcutter', wc1);
      const qu = T.placeRich('quarry');
      const sA = T.place('warehouse', [hq.cx - 2, hq.cz + 4], 3), sB = T.place('warehouse', [hq.cx + 3, hq.cz + 1], 3);
      g.setAccept(sA, '*', false); g.setAccept(sA, 'log', true);
      g.setAccept(sB, '*', false); g.setAccept(sB, 'stone', true);
      const bad = [];
      const check = (tag) => {
        const c = T.count(), p = T.produced();
        for (const r of VE.RES_ORDER) {
          const exp = (c0[r] || 0) + (p[r] || 0) - (p0[r] || 0);
          if ((c[r] || 0) !== exp) bad.push(tag + ' ' + r + ': ' + (c[r] || 0) + ' != ' + exp);
        }
      };
      let maxA = 0, maxB = 0, maxOut = 0, wrong = 0;
      const watch = () => {
        maxA = Math.max(maxA, g.storeTotal(sA)); maxB = Math.max(maxB, g.storeTotal(sB));
        for (const b of [wc1, wc2, qu]) maxOut = Math.max(maxOut, g.outTotal(b));
        if (sA.store.stone || sB.store.log) wrong++;
      };
      T.run(240, t => { watch(); if (Math.round(t * 10) % 200 === 0) check('fase1@' + Math.round(t)); });
      check('fase1');
      const phase1 = { A: Object.assign({}, sA.store), B: Object.assign({}, sB.store) };
      // vol: A krijgt 55 hout erbij (beloning): A raakt vol, de rest blijft bij de houthakkers
      const wrongPhase1 = wrong;
      // goederen van buiten (beloning): eerst in A tot die vol is, de rest naar het dorpshuis
      const rebase = (extra) => { const c1 = T.count(), p1 = T.produced(); for (const r of VE.RES_ORDER) c0[r] = (c1[r] || 0) - ((p1[r] || 0) - (p0[r] || 0)) + ((extra && extra[r]) || 0); };
      g.addGoods('log', 200);
      const vault = g.hq.store.log || 0;
      rebase();
      T.run(120, watch);
      check('vol');
      const full = { A: g.storeTotal(sA), out1: g.outTotal(wc1), out2: g.outTotal(wc2), st1: wc1.status, st2: wc2.status };
      // filter wisselen: hout mag niet meer in A, wel in B. Dragers verhuizen het (B heeft plek)
      g.setAccept(sA, 'log', false); g.setAccept(sB, 'log', true);
      T.run(200, watch);
      check('verhuizen');
      const moved = { A: Object.assign({}, sA.store), B: Object.assign({}, sB.store) };
      // Storehouse met inhoud slopen: alles gaat naar een andere opslag, niets kwijt (+ de helft van de bouwkosten)
      const refund = {}; for (const k in sB.def.cost) refund[k] = Math.floor(sB.def.cost[k] / 2);
      rebase(); g.demolish(sB);
      for (const k in refund) c0[k] += refund[k];
      T.run(30);
      check('sloop');
      return { phase1, full, moved, maxA, maxB, maxOut, wrongPhase1, bad: bad.slice(0, 8), vault };
    });
    expect(r.bad).toEqual([]);
    expect(r.phase1.A.log).toBeGreaterThan(0);
    expect(r.phase1.A.stone || 0).toBe(0);
    expect(r.phase1.B.stone).toBeGreaterThan(0);
    expect(r.phase1.B.log || 0).toBe(0);
    expect(r.maxA).toBeLessThanOrEqual(60);
    expect(r.maxB).toBeLessThanOrEqual(60);
    expect(r.maxOut).toBeLessThanOrEqual(6);
    expect(r.wrongPhase1).toBe(0);
    expect(r.full.A).toBe(60);
    expect(r.vault).toBeGreaterThan(0);              // te veel voor de opslag: in het dorpshuis
    expect(r.full.out1 + r.full.out2).toBeGreaterThan(0);
    expect(r.moved.A.log || 0).toBeLessThan(r.full.A);
    expect(r.moved.B.log || 0).toBeGreaterThan(0);
    expect(errs(errors)).toEqual([]);
  });

  test('werkplaatsen en bouwen halen uit alle opslag; boekhouding met zagerij', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      g.world.owned.fill(1);
      for (let n = 0; n < 8; n++) g.spawnSettler();
      const c0 = T.count(), p0 = T.produced();
      T.place('woodcutter', [hq.cx - 5, hq.cz + 3]);
      const saw = T.place('sawmill', [hq.cx + 3, hq.cz + 3], 3);
      const st = T.place('warehouse', [hq.cx - 3, hq.cz - 3], 3);
      // de startvoorraad gaat eerst op: zolang er hout op de stapel ligt, haalt niemand hout bij de houthakker voor de zagerij
      const pile = g.buildings.find(b => b.def.pile);
      let fromProducerWhilePile = 0, fromPile = 0;
      const st0 = g.startTransport.bind(g);
      g.startTransport = (s, res, src, dst) => {
        if (res === 'log' && dst === saw) { if (src === pile) fromPile++; else if (pile.alive && (pile.store.log || 0) - (pile.outRes.log || 0) > 0) fromProducerWhilePile++; }
        return st0(s, res, src, dst);
      };
      const bad = [];
      const check = tag => {
        const c = T.count(), p = T.produced(), d = r => (p[r] || 0) - (p0[r] || 0);
        const inWork = saw.working ? 1 : 0;
        const exp = { log: (c0.log || 0) + d('log') - d('plank') / 2 - inWork, plank: (c0.plank || 0) + d('plank') };
        for (const r in exp) if ((c[r] || 0) !== exp[r]) bad.push(tag + ' ' + r + ': ' + (c[r] || 0) + ' != ' + exp[r]);
      };
      T.run(300, t => { if (Math.round(t * 10) % 300 === 0) check('@' + Math.round(t)); });
      check('eind');
      // een bouwplaats krijgt materiaal uit de opslag, de startstapel of rechtstreeks van de zagerij
      const site = g.placeBuilding('house', ...T.spot('house', [hq.cx, hq.cz + 5]));
      T.run(120);
      return { fromPile, fromProducerWhilePile, pileLog: pile.alive ? pile.store.log || 0 : 0, bad: bad.slice(0, 6), planks: g.stats.produced.plank || 0, stPlank: st.store.plank || 0, built: site.built, used: site.used, total: site.total };
    });
    expect(r.bad).toEqual([]);
    expect(r.planks).toBeGreaterThan(4);
    expect(r.fromPile).toBe(6);                      // alle 6 stammen van de startstapel gingen naar de zagerij
    expect(r.fromProducerWhilePile).toBe(0);
    expect(r.pileLog).toBe(0);
    expect(r.built || r.used > 0).toBe(true);
    expect(errs(errors)).toEqual([]);
  });

  test('opslaan en laden: nieuwe en oude saves, niets kwijt', async ({ page }) => {
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      g.world.owned.fill(1);
      const st = T.place('warehouse', [hq.cx - 3, hq.cz + 3], 3);
      g.setAccept(st, '*', false); g.setAccept(st, 'plank', true); g.setAccept(st, 'wine', true); g.setAccept(st, 'log', true);
      g.addGoods('plank', 20); g.addGoods('wine', 3); g.addGoods('ironbar', 4);   // ijzer: niet aangenomen -> dorpshuis
      const wc = T.place('woodcutter', [hq.cx + 5, hq.cz]); wc.output.log = 4; g.sd = true;
      const before = Object.assign({}, g.stock);
      const sv = JSON.parse(JSON.stringify(g.serialize()));
      const a = new VE.Game(VE.view.scene); a.init(sv);
      const st2 = a.buildings.find(b => b.type === 'warehouse');
      const after = Object.assign({}, a.stock);
      const acc = VE.RES_ORDER.filter(x => st2.accept[x]);
      a.dispose();
      // oude save (v1): totale voorraad zonder opslag per gebouw, met Stockyard
      const old = JSON.parse(JSON.stringify(sv));
      old.v = 1; old.stock = { log: 40, stone: 33, plank: 51, wine: 7, ironbar: 2 };
      for (const b of old.buildings) { delete b.st; delete b.ac; }
      old.buildings = old.buildings.filter(b => b.t !== 'woodcutter');
      const o = new VE.Game(VE.view.scene); o.init(old);
      const pile = o.buildings.find(b => b.type === 'yard'), wh = o.buildings.find(b => b.type === 'warehouse');
      const res = { pile: pile && Object.assign({}, pile.store), whAll: VE.RES_ORDER.every(x => wh.accept[x]), whEmpty: o.storeTotal(wh), stock: Object.assign({}, o.stock), hall: Object.keys(o.hq.store).length };
      // heel oude save: zonder Stockyard
      const older = JSON.parse(JSON.stringify(old)); older.buildings = older.buildings.filter(b => b.t !== 'yard');
      const q = new VE.Game(VE.view.scene); q.init(older);
      const qp = q.buildings.find(b => b.type === 'yard');
      res.older = qp && Object.assign({}, qp.store);
      o.dispose(); q.dispose();
      // midden in het transport opslaan: wat dragers vasthouden, ligt na het laden weer bij de bron
      for (let n = 0; n < 8; n++) g.spawnSettler();
      const wc2 = T.placeRich('woodcutter', wc); wc.output.log = 6; g.sd = true;
      let mid = null, carriedAtSave = 0;
      for (let t = 0; t < 90 && !mid; t += 0.1) {
        g.arriveT = 1e9; g.update(0.1);
        const c = g.settlers.filter(s => s.task && s.task.picked && s.carry).length;
        if (c >= 2) { carriedAtSave = c; mid = { c: T.count(), sv: JSON.parse(JSON.stringify(g.serialize())) }; }
      }
      const m = new VE.Game(VE.view.scene); m.init(mid.sv);
      const midAfter = T.count(m); m.dispose();
      return { before, after, acc, v: sv.v, st: sv.buildings.find(b => b.t === 'warehouse').st, old: res, carriedAtSave, midBefore: mid.c, midAfter };
    });
    expect(r.v).toBe(4);                              // save-versie 4 sinds de kazerne
    expect(r.carriedAtSave).toBeGreaterThan(1);
    expect(r.midAfter).toEqual(r.midBefore);
    for (const k of Object.keys(r.before)) expect(r.after[k]).toBe(r.before[k]);
    expect(r.acc).toEqual(['log', 'plank', 'wine']);
    expect(r.st).toEqual({ plank: 20, wine: 3 });
    expect(r.old.pile).toEqual({ log: 40, stone: 33, plank: 51, wine: 7, ironbar: 2 });
    expect(r.old.whAll).toBe(true);
    expect(r.old.whEmpty).toBe(0);
    expect(r.old.hall).toBe(0);
    expect(r.old.stock.plank).toBe(51);
    expect(r.old.older).toEqual({ log: 40, stone: 33, plank: 51, wine: 7, ironbar: 2 });
    expect(errs(errors)).toEqual([]);
  });

  test('bouwstenen identiek en rechthoekig; nette stapels in de Storehouse; infopaneel', async ({ page }, info) => {
    const errors = trackErrors(page);
    await openGame(page);
    await startNewVillage(page);
    await setup(page);
    const geo = await page.evaluate(() => {
      const VE = window.VE, gm = VE.itemGeo('stone'); gm.computeBoundingBox();
      const b = gm.boundingBox, pos = gm.attributes.position;
      // rechthoekig: elk hoekpunt ligt op (of binnen de afschuining van) een zijvlak
      let off = 0;
      for (let i = 0; i < pos.count; i++) {
        const x = Math.abs(pos.getX(i)), y = Math.abs(pos.getY(i)), z = Math.abs(pos.getZ(i));
        const near = Math.max(x / 0.045, y / 0.025, z / 0.03);
        if (near < 0.85 && !(y > 0.024)) off++;
      }
      return { size: [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z], block: VE.STONE_BLOCK, off, src: VE.itemSource };
    });
    expect(geo.src).toBe('glb');
    for (let i = 0; i < 3; i++) expect(Math.abs(geo.size[i] - geo.block[i])).toBeLessThan(0.0015);
    expect(geo.off).toBe(0);

    const r = await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      g.world.owned.fill(1);
      const st = T.place('warehouse', [hq.cx + 3, hq.cz + 3], 3);
      for (const [k, n] of [['stone', 24], ['log', 10], ['plank', 12], ['flour', 6], ['wine', 4], ['ironbar', 4]]) g.addGoods(k, n);
      g.piles.update(g);
      // alle stenen exact even groot (zelfde schaal), recht (geen draaiing) en netjes in lagen
      const m = g.piles.meshes.stone, M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
      const scales = new Set(), ys = new Set(); let tilted = 0;
      for (let i = 0; i < m.count; i++) {
        m.getMatrixAt(i, M); M.decompose(P, Q, S);
        scales.add(S.x.toFixed(4) + ',' + S.y.toFixed(4) + ',' + S.z.toFixed(4));
        if (Math.abs(Q.x) + Math.abs(Q.y) + Math.abs(Q.z) > 1e-6) tilted++;
        ys.add((P.y - st.y).toFixed(3));
      }
      window._st = st;
      return { stones: m.count, scales: [...scales], tilted, layers: ys.size, logs: g.piles.meshes.log.count, total: g.storeTotal(st), slots: VE.buildModel('warehouse', 1).slots.length, slots2: VE.buildModel('warehouse', 2).slots.length };
    });
    expect(r.total).toBe(60);
    expect(r.stones).toBe(24 + 14);                 // 24 in de Storehouse + 14 op de startstapel
    expect(r.scales.length).toBe(1);
    expect(r.tilted).toBe(0);
    expect(r.slots).toBe(6);
    expect(r.slots2).toBe(9);
    await page.evaluate(() => { const c = window.VE.view.cam, st = window._st; c.tx = st.cx; c.tz = st.cz + 0.1; c.tdist = c.dist = 2.6; document.querySelectorAll('.toast').forEach(t => t.remove()); });
    await page.waitForTimeout(900);
    await shot(page, info.project.name, 'opslag-storehouse');

    // infopaneel: vinkjes per goed, alles/niets
    await page.evaluate(() => window.VE.ui.select(window._st));
    await expect(page.locator('#infoPanel .sellgrid.accept .sell').first()).toBeVisible();
    const before = await page.evaluate(() => window._st.accept.log);
    await page.locator('#infoPanel .sellgrid.accept .sell[data-arg="log"]').click();
    const after = await page.evaluate(() => window._st.accept.log);
    expect(before).toBe(true);
    expect(after).toBe(false);
    await page.locator('#infoPanel [data-act="acceptAll"][data-arg="0"]').click();
    expect(await page.evaluate(() => window.VE.RES_ORDER.some(x => window._st.accept[x]))).toBe(false);
    await page.locator('#infoPanel [data-act="acceptAll"][data-arg="1"]').click();
    expect(await page.evaluate(() => window.VE.RES_ORDER.every(x => window._st.accept[x]))).toBe(true);
    await expect(page.locator('#infoPanel .bar.store')).toContainText('60 / 60');
    await shot(page, info.project.name, 'opslag-storehouse-paneel');

    // producent vol: 6 op zijn stapel, melding in het infopaneel
    await page.evaluate(() => {
      const VE = window.VE, g = VE.game, T = window.T, hq = g.hq;
      const q = T.place('woodcutter', [hq.cx - 4, hq.cz + 3]); q.output.log = 6; g.sd = true; q.status = g.fullStatus(q, 'log');
      window._q = q; VE.ui.select(q);
      const c = VE.view.cam; c.tx = q.cx; c.tz = q.cz; c.tdist = c.dist = 3;
    });
    await page.waitForTimeout(900);
    await expect(page.locator('#infoPanel')).toContainText('6/6 full');
    await shot(page, info.project.name, 'opslag-producent-vol');
    expect(errs(errors)).toEqual([]);
  });
});
