/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   All models are original, built procedurally from primitives. */
'use strict';
(function (VE) {
  const C = {
    plaster: 0xf3e5c8, plaster2: 0xead2a6, timber: 0x6a4226, wood: 0xa0703f, woodL: 0xc89a5e, woodD: 0x5a3a20,
    roofR: 0xbf4a30, roofR2: 0xa83f2a, thatch: 0xdcb65e, thatch2: 0xc9a048, slate: 0x5f6c80, slate2: 0x4e5a6c,
    stone: 0xb5ae9f, stoneD: 0x8e877a, stoneL: 0xcfc8b8, door: 0x4b2f1c, win: 0x2c3a4e, glow: 0xffd27a, green: 0x5c9a3a,
    leaf: 0x4b8a30, red: 0xc0392b, blue: 0x2f6fb0, gold: 0xe8b73a, white: 0xf7f3ea, purple: 0x6e3463, hay: 0xe8c860,
    dirt: 0x8a6a45, brick: 0xa8553a, iron: 0x55585e, moss: 0x6f8f3a, cream: 0xfff3d6
  };
  VE.COL = C;
  const PI = Math.PI;

  /* ---------- building blocks ---------- */
  function foundation(m, w, d, col) { m.box(w, 0.26, d, col || C.stoneD, { y: -0.2, j: 0.08 }); }
  function windowAt(m, x, y, z, face, lit) {
    // face: 'z' front (+z), 'x' side (+x), '-x'
    const ww = 0.09, wh = 0.1;
    if (face === 'z') {
      m.box(ww, wh, 0.02, lit ? C.glow : C.win, { x: x, y: y, z: z });
      m.box(ww + 0.04, 0.02, 0.035, C.timber, { x: x, y: y - 0.015, z: z + 0.005 });
      m.box(0.03, wh, 0.02, C.blue, { x: x - 0.065, y: y, z: z + 0.003, j: 0.1 });
      m.box(0.03, wh, 0.02, C.blue, { x: x + 0.065, y: y, z: z + 0.003, j: 0.1 });
    } else {
      const s = face === 'x' ? 1 : -1;
      m.box(0.02, wh, ww, lit ? C.glow : C.win, { x: x, y: y, z: z });
      m.box(0.035, 0.02, ww + 0.04, C.timber, { x: x + 0.005 * s, y: y - 0.015, z: z });
    }
  }
  function flowerBox(m, x, y, z) {
    m.box(0.12, 0.03, 0.04, C.wood, { x: x, y: y, z: z });
    for (let i = 0; i < 3; i++) m.ball(0.018, [0xe84a5f, 0xffd166, 0xf78fb3][i], { x: x - 0.035 + i * 0.035, y: y + 0.04, z: z });
  }
  function door(m, x, z, w, h, col) {
    w = w || 0.13; h = h || 0.2;
    m.box(w + 0.03, h + 0.02, 0.02, C.timber, { x: x, y: 0, z: z });
    m.box(w, h, 0.03, col || C.door, { x: x, y: 0, z: z + 0.004 });
  }
  function timberFrame(m, w, h, d, y) {
    const t = 0.03;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(t, h, t, C.timber, { x: sx * (w / 2), y: y, z: sz * (d / 2) });
    m.box(w + t, t, t, C.timber, { y: y + h - t, z: d / 2 });
    m.box(w + t, t, t, C.timber, { y: y + h * 0.48, z: d / 2 });
    m.box(t, t, d + t, C.timber, { x: w / 2, y: y + h - t });
    m.box(t, t, d + t, C.timber, { x: w / 2, y: y + h * 0.48 });
    // diagonal braces on the side
    m.box(t, h * 0.62, t, C.timber, { x: w / 2 + 0.003, y: y + h * 0.04, z: d / 4, rx: 0.55 });
  }
  function house(m, o) {
    const w = o.w, d = o.d, h = o.h, y = o.y || 0;
    m.box(w, h, d, o.wall || C.plaster, { x: o.x || 0, y: y, z: o.z || 0, j: 0.04 });
    if (o.timber !== false) {
      const sub = new VE.Model(3); timberFrame(sub, w, h, d, y);
      for (const p of sub.parts) { p.g.translate(o.x || 0, 0, o.z || 0); m.parts.push(p); }
    }
    m.roof(w + 0.14, o.rh || h * 0.85, d + 0.16, o.roof || C.roofR, { x: o.x || 0, y: y + h, z: o.z || 0, ry: o.rot || 0, j: 0.07 });
  }
  function chimney(m, x, z, y, h, col) {
    m.box(0.09, h, 0.09, col || C.brick, { x: x, y: y, z: z, j: 0.1 });
    m.box(0.11, 0.03, 0.11, C.stoneD, { x: x, y: y + h, z: z });
  }
  function barrel(m, x, z, y, rot) {
    const o = { x: x, y: y || 0, z: z };
    if (rot) { m.add(new THREE.CylinderGeometry(0.06, 0.06, 0.13, 8), C.wood, { x: x, y: (y || 0) + 0.06, z: z, rz: PI / 2 }); return; }
    m.cyl(0.062, 0.055, 0.14, 8, C.wood, o);
    m.cyl(0.064, 0.064, 0.015, 8, C.iron, { x: x, y: (y || 0) + 0.03, z: z });
    m.cyl(0.064, 0.064, 0.015, 8, C.iron, { x: x, y: (y || 0) + 0.1, z: z });
  }
  function crate(m, x, z, y, s) { s = s || 0.1; m.box(s, s, s, C.woodL, { x: x, y: y || 0, z: z, ry: (x * 13) % 1, j: 0.12 }); }
  function logPile(m, x, z, n) {
    let k = 0;
    for (let row = 0; row < 3 && k < n; row++) for (let i = 0; i < 3 - row && k < n; i++, k++) {
      m.add(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 7), k % 2 ? C.wood : 0x8a5a2b, { x: x, y: 0.035 + row * 0.06, z: z - 0.07 + i * 0.07 + row * 0.035, rz: PI / 2 });
    }
  }
  function plankPile(m, x, z, n) {
    for (let i = 0; i < n; i++) m.box(0.26, 0.022, 0.08, i % 2 ? C.woodL : 0xd7a868, { x: x, y: i * 0.024, z: z, ry: (i % 2) * 0.08 });
  }
  function fence(m, x0, z0, x1, z1, posts) {
    for (let i = 0; i <= posts; i++) {
      const t = i / posts; m.box(0.022, 0.1, 0.022, C.wood, { x: VE.lerp(x0, x1, t), z: VE.lerp(z0, z1, t) });
    }
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
    m.box(len, 0.016, 0.012, C.woodL, { x: (x0 + x1) / 2, y: 0.06, z: (z0 + z1) / 2, ry: -ang });
  }
  function flag(color) {
    const m = new VE.Model(9);
    m.box(0.22, 0.13, 0.008, color || C.red, { x: 0.11, y: -0.13 });
    m.box(0.07, 0.04, 0.009, C.gold, { x: 0.11, y: -0.085 });
    return m.build();
  }

  /* ---------- buildings ---------- */
  const B = {};
  B.hq = function (m, lvl, ex) {
    foundation(m, 1.75, 1.75, C.stoneD);
    m.box(1.7, 0.06, 1.7, C.stoneL, { y: 0.0 });
    // main hall: stone ground floor, timber upper floor
    m.box(1.25, 0.5, 0.9, C.stone, { x: -0.1, z: -0.2, j: 0.05 });
    m.box(1.32, 0.42, 0.96, C.plaster, { x: -0.1, y: 0.5, z: -0.2 });
    const tf = new VE.Model(4); timberFrame(tf, 1.32, 0.42, 0.96, 0.5); for (const p of tf.parts) { p.g.translate(-0.1, 0, -0.2); m.parts.push(p); }
    m.roof(1.5, 0.55, 1.18, C.roofR, { x: -0.1, y: 0.92, z: -0.2 });
    chimney(m, -0.45, -0.35, 1.05, 0.38);
    ex.chimneys.push([-0.45, 1.45, -0.35]);
    // round keep tower
    m.cyl(0.26, 0.3, 1.55, 10, C.stone, { x: 0.58, z: -0.45 });
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; m.box(0.07, 0.08, 0.07, C.stoneL, { x: 0.58 + Math.cos(a) * 0.27, y: 1.55, z: -0.45 + Math.sin(a) * 0.27 }); }
    m.cone(0.36, 0.55, 10, C.slate, { x: 0.58, y: 1.6, z: -0.45 });
    m.cyl(0.012, 0.012, 0.35, 4, C.iron, { x: 0.58, y: 2.1, z: -0.45 });
    ex.anims.push({ geo: flag(C.red), x: 0.585, y: 2.44, z: -0.45, kind: 'flag' });
    for (let i = 0; i < 3; i++) windowAt(m, 0.58 + 0.29, 0.4 + i * 0.4, -0.45, 'x', i === 1);
    // gatehouse front
    m.box(0.5, 0.42, 0.25, C.stone, { x: -0.1, z: 0.33 });
    m.roof(0.62, 0.25, 0.37, C.roofR2, { x: -0.1, y: 0.42, z: 0.33, ry: PI / 2 });
    m.box(0.24, 0.3, 0.02, C.door, { x: -0.1, z: 0.46 });
    m.box(0.3, 0.04, 0.03, C.timber, { x: -0.1, y: 0.3, z: 0.47 });
    windowAt(m, -0.55, 0.28, 0.255, 'z', true);
    windowAt(m, 0.32, 0.28, 0.255, 'z', false);
    windowAt(m, -0.5, 0.7, 0.285, 'z', true); windowAt(m, 0.3, 0.7, 0.285, 'z', true); windowAt(m, -0.1, 0.75, 0.285, 'z', false);
    flowerBox(m, -0.5, 0.62, 0.31); flowerBox(m, 0.3, 0.62, 0.31);
    // yard goods
    barrel(m, 0.55, 0.55); barrel(m, 0.68, 0.48); barrel(m, 0.6, 0.66, 0, true);
    crate(m, -0.6, 0.6); crate(m, -0.72, 0.55); crate(m, -0.66, 0.58, 0.1, 0.08);
    m.cyl(0.07, 0.09, 0.14, 8, C.stone, { x: 0.65, z: 0.15 }); // well
    m.cyl(0.05, 0.05, 0.02, 8, 0x3d7fb5, { x: 0.65, y: 0.13, z: 0.15 });
    m.box(0.01, 0.2, 0.01, C.wood, { x: 0.58, y: 0.12, z: 0.15 }); m.box(0.01, 0.2, 0.01, C.wood, { x: 0.72, y: 0.12, z: 0.15 });
    m.roof(0.2, 0.08, 0.16, C.roofR, { x: 0.65, y: 0.32, z: 0.15, ry: PI / 2 });
  };
  /* Stockyard: fenced, trampled yard; the goods piles themselves are drawn by VE.StockpileRender */
  B.yard = function (m) {
    // startvoorraad: alleen de stapels zelf (VE.StockpileRender), gewoon in het gras; een paar graspolletjes
    for (const [x, z] of [[-0.85, 0.1], [0.82, -0.3], [0.05, 0.86], [-0.4, -0.88]]) m.cone(0.03, 0.07, 4, 0x5f9a36, { x: x, z: z, j: 0.08 });
  };
  B.house = function (m, lvl, ex) {
    foundation(m, 0.82, 0.74);
    house(m, { w: 0.6, d: 0.46, h: 0.38, roof: lvl >= 3 ? C.roofR : C.thatch, rh: 0.36 });
    chimney(m, 0.16, -0.08, 0.4, 0.34);
    ex.chimneys.push([0.16, 0.8, -0.08]);
    door(m, -0.08, 0.235);
    windowAt(m, 0.15, 0.2, 0.235, 'z', true);
    windowAt(m, 0.305, 0.2, 0.0, 'x', false);
    flowerBox(m, 0.15, 0.14, 0.255);
    m.box(0.1, 0.012, 0.06, C.stoneL, { x: -0.08, y: 0, z: 0.3 });
    if (lvl >= 2) {
      m.box(0.24, 0.28, 0.34, C.plaster2, { x: -0.38, z: -0.04 });
      m.roof(0.36, 0.2, 0.3, lvl >= 3 ? C.roofR2 : C.thatch2, { x: -0.38, y: 0.28, z: -0.04, ry: PI / 2 });
      windowAt(m, -0.38, 0.16, 0.135, 'z', true);
      fence(m, 0.33, 0.1, 0.33, 0.36, 3);
    }
    if (lvl >= 3) {
      m.box(0.16, 0.12, 0.1, C.plaster, { x: 0.0, y: 0.48, z: 0.15 });
      m.roof(0.2, 0.1, 0.14, C.roofR, { x: 0.0, y: 0.6, z: 0.15, ry: PI / 2 });
      windowAt(m, 0.0, 0.53, 0.2, 'z', true);
      m.box(0.16, 0.03, 0.05, C.wood, { x: 0.22, y: 0.06, z: 0.33 });
    }
  };
  B.woodcutter = function (m, lvl, ex) {
    foundation(m, 0.8, 0.74);
    // log cabin walls
    for (let i = 0; i < 6; i++) {
      const y = 0.03 + i * 0.058;
      m.add(new THREE.CylinderGeometry(0.03, 0.03, 0.56, 6), i % 2 ? 0x8a5a2b : 0x7a4c22, { x: 0, y: y, z: 0.2, rz: PI / 2 });
      m.add(new THREE.CylinderGeometry(0.03, 0.03, 0.56, 6), i % 2 ? 0x7a4c22 : 0x8a5a2b, { x: 0, y: y, z: -0.2, rz: PI / 2 });
      m.add(new THREE.CylinderGeometry(0.03, 0.03, 0.44, 6), i % 2 ? 0x8a5a2b : 0x7a4c22, { x: 0.25, y: y + 0.029, z: 0, rx: PI / 2 });
      m.add(new THREE.CylinderGeometry(0.03, 0.03, 0.44, 6), i % 2 ? 0x7a4c22 : 0x8a5a2b, { x: -0.25, y: y + 0.029, z: 0, rx: PI / 2 });
    }
    m.box(0.48, 0.34, 0.38, 0x6b4321, { y: 0 });
    m.roof(0.7, 0.3, 0.6, 0x5c4a3a, { y: 0.35 });
    door(m, 0.0, 0.225, 0.12, 0.2, 0x3b2414);
    windowAt(m, 0.27, 0.2, 0.0, 'x', true);
    logPile(m, -0.15, 0.36, lvl >= 2 ? 6 : 4);
    m.cyl(0.06, 0.07, 0.08, 8, 0x9c6b3f, { x: 0.25, z: 0.33 });
    m.box(0.015, 0.14, 0.015, C.woodL, { x: 0.27, y: 0.08, z: 0.33, rz: 0.4 });
    m.box(0.06, 0.04, 0.01, C.iron, { x: 0.3, y: 0.2, z: 0.33, rz: 0.4 });
    chimney(m, -0.18, -0.08, 0.38, 0.26, C.stone);
    ex.chimneys.push([-0.18, 0.66, -0.08]);
    if (lvl >= 3) logPile(m, 0.33, -0.15, 6);
  };
  B.forester = function (m, lvl, ex) {
    foundation(m, 0.78, 0.74);
    house(m, { w: 0.46, d: 0.38, h: 0.32, wall: 0xd9c9a3, roof: C.moss, rh: 0.3, x: -0.1, z: -0.1 });
    door(m, -0.1, 0.095, 0.11, 0.18);
    windowAt(m, 0.135, 0.18, -0.1, 'x', true);
    // sapling garden
    fence(m, 0.12, 0.05, 0.38, 0.05, 3); fence(m, 0.38, 0.05, 0.38, 0.36, 3); fence(m, 0.12, 0.36, 0.38, 0.36, 3);
    m.box(0.24, 0.02, 0.28, C.dirt, { x: 0.25, z: 0.2 });
    for (let i = 0; i < 4; i++) m.cone(0.04, 0.12, 6, 0x3f7f35, { x: 0.19 + (i % 2) * 0.12, y: 0.02, z: 0.12 + Math.floor(i / 2) * 0.15 });
    m.box(0.012, 0.16, 0.012, C.wood, { x: -0.36, y: 0.0, z: 0.2, rz: 0.15 });
    m.box(0.05, 0.06, 0.01, C.iron, { x: -0.34, y: 0.0, z: 0.2 });
  };
  B.quarry = function (m, lvl, ex) {
    foundation(m, 0.8, 0.76);
    house(m, { w: 0.44, d: 0.38, h: 0.3, wall: C.stone, roof: C.slate, rh: 0.28, x: -0.12, z: -0.12, timber: false });
    door(m, -0.12, 0.075, 0.11, 0.18);
    windowAt(m, 0.105, 0.18, -0.12, 'x', false);
    for (let i = 0; i < 6; i++) m.box(0.1, 0.07, 0.08, i % 2 ? C.stoneL : C.stone, { x: 0.16 + (i % 3) * 0.1, y: Math.floor(i / 3) * 0.07, z: 0.22, j: 0.1 });
    // wooden crane
    m.box(0.03, 0.55, 0.03, C.wood, { x: 0.3, z: -0.25 });
    m.box(0.36, 0.03, 0.03, C.wood, { x: 0.2, y: 0.53, z: -0.25 });
    m.box(0.005, 0.25, 0.005, 0x332211, { x: 0.05, y: 0.3, z: -0.25 });
    m.box(0.07, 0.05, 0.06, C.stoneL, { x: 0.05, y: 0.25, z: -0.25 });
    m.ball(0.06, C.stoneD, { x: -0.32, y: 0.04, z: 0.28 });
  };
  B.sawmill = function (m, lvl, ex) {
    foundation(m, 0.86, 0.8);
    house(m, { w: 0.5, d: 0.44, h: 0.36, wall: C.woodL, roof: C.roofR, rh: 0.32, x: -0.14, z: -0.1 });
    door(m, -0.2, 0.125, 0.14, 0.22);
    windowAt(m, 0.115, 0.2, -0.1, 'x', true);
    // open shed with saw bench
    for (const sx of [0.16, 0.38]) for (const sz of [0.06, 0.34]) m.box(0.025, 0.3, 0.025, C.timber, { x: sx, z: sz });
    m.roof(0.32, 0.12, 0.38, C.roofR2, { x: 0.27, y: 0.3, z: 0.2, ry: PI / 2 });
    m.box(0.26, 0.08, 0.1, C.wood, { x: 0.27, z: 0.2 });
    m.add(new THREE.CylinderGeometry(0.03, 0.03, 0.24, 6), 0x8a5a2b, { x: 0.27, y: 0.11, z: 0.2, rz: PI / 2 });
    ex.anims.push({ geo: sawGeo(), x: 0.27, y: 0.13, z: 0.2, kind: 'saw' });
    plankPile(m, -0.15, 0.32, lvl >= 2 ? 6 : 4);
    logPile(m, -0.35, -0.3, 3);
  };
  function sawGeo() {
    const m = new VE.Model(5);
    m.add(new THREE.CylinderGeometry(0.075, 0.075, 0.008, 12), 0xc9ced4, { rx: PI / 2 });
    m.add(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 6), C.iron, { rx: PI / 2 });
    return m.build();
  }
  B.farm = function (m, lvl, ex) {
    foundation(m, 0.84, 0.78);
    house(m, { w: 0.52, d: 0.38, h: 0.32, roof: C.thatch, rh: 0.32, x: -0.12, z: 0.0 });
    door(m, -0.2, 0.195, 0.11, 0.19);
    windowAt(m, 0.0, 0.18, 0.195, 'z', true);
    chimney(m, -0.25, -0.05, 0.36, 0.28);
    ex.chimneys.push([-0.25, 0.66, -0.05]);
    // red barn behind
    m.box(0.3, 0.3, 0.3, 0xa8402c, { x: 0.25, z: -0.22 });
    m.roof(0.36, 0.2, 0.36, 0x5a3a2a, { x: 0.25, y: 0.3, z: -0.22, ry: PI / 2 });
    m.box(0.14, 0.18, 0.02, 0xf2e7d0, { x: 0.25, z: -0.065 });
    // hay bales
    m.add(new THREE.CylinderGeometry(0.07, 0.07, 0.11, 10), C.hay, { x: 0.3, y: 0.07, z: 0.22, rz: PI / 2 });
    m.add(new THREE.CylinderGeometry(0.07, 0.07, 0.11, 10), C.hay, { x: 0.3, y: 0.07, z: 0.36, rz: PI / 2 });
    if (lvl >= 2) m.add(new THREE.CylinderGeometry(0.07, 0.07, 0.11, 10), C.hay, { x: 0.3, y: 0.19, z: 0.29, rz: PI / 2 });
    m.box(0.015, 0.2, 0.015, C.wood, { x: -0.38, y: 0, z: 0.28, rz: 0.2 });
  };
  B.windmill = function (m, lvl, ex) {
    foundation(m, 0.72, 0.72);
    m.cyl(0.2, 0.3, 0.95, 10, C.plaster, { j: 0.04 });
    m.cyl(0.305, 0.305, 0.12, 10, C.stone, { y: 0.0 });
    m.cyl(0.24, 0.24, 0.04, 10, C.timber, { y: 0.55 });
    m.cone(0.3, 0.4, 10, C.thatch, { y: 0.93 });
    door(m, 0, 0.27, 0.12, 0.2);
    windowAt(m, 0.0, 0.62, 0.225, 'z', true);
    windowAt(m, 0.235, 0.4, 0.0, 'x', false);
    m.add(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), C.timber, { y: 0.98, z: 0.22, rx: PI / 2 });
    ex.anims.push({ geo: sailsGeo(), x: 0, y: 0.98, z: 0.32, kind: 'sails' });
    m.add(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), 0xefe7d6, { x: 0.3, y: 0.05, z: 0.26 });
    m.add(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), 0xefe7d6, { x: 0.38, y: 0.05, z: 0.18 });
  };
  function sailsGeo() {
    const m = new VE.Model(6);
    m.cyl(0.04, 0.04, 0.05, 8, C.timber, { rx: PI / 2, y: -0.025 });
    for (let i = 0; i < 4; i++) {
      const a = i * PI / 2;
      const arm = new VE.Model(i + 11);
      arm.box(0.025, 0.62, 0.02, C.timber, {});
      arm.box(0.12, 0.48, 0.008, 0xf4ecd8, { x: 0.075, y: 0.12, j: 0.05 });
      for (let k = 0; k < 5; k++) arm.box(0.13, 0.01, 0.012, C.timber, { x: 0.075, y: 0.14 + k * 0.1 });
      for (const p of arm.parts) { p.g.rotateZ(a); m.parts.push(p); }
    }
    return m.build();
  }
  B.bakery = function (m, lvl, ex) {
    foundation(m, 0.84, 0.78);
    house(m, { w: 0.54, d: 0.44, h: 0.36, wall: C.cream, roof: C.roofR, rh: 0.32, x: -0.06, z: -0.06 });
    door(m, -0.14, 0.165, 0.12, 0.2);
    windowAt(m, 0.08, 0.2, 0.165, 'z', true);
    chimney(m, 0.12, -0.15, 0.4, 0.42);
    ex.chimneys.push([0.12, 0.86, -0.15]);
    // dome oven
    m.add(new THREE.SphereGeometry(0.13, 10, 6, 0, PI * 2, 0, PI / 2), C.brick, { x: 0.3, y: 0.0, z: 0.22 });
    m.box(0.07, 0.06, 0.02, 0x2a1a10, { x: 0.3, y: 0.0, z: 0.35 });
    // hanging sign with loaf
    m.box(0.012, 0.12, 0.012, C.timber, { x: -0.36, y: 0.2, z: 0.17 });
    m.box(0.12, 0.012, 0.012, C.timber, { x: -0.31, y: 0.32, z: 0.17 });
    m.box(0.1, 0.07, 0.012, C.woodL, { x: -0.29, y: 0.23, z: 0.17 });
    m.ball(0.03, 0xd08b3e, { x: -0.29, y: 0.265, z: 0.18, sx: 1.4, sy: 0.8 });
    crate(m, 0.32, -0.25, 0, 0.09);
    if (lvl >= 2) m.ball(0.04, 0xd08b3e, { x: 0.32, y: 0.11, z: -0.25, sx: 1.5, sy: 0.7 });
  };
  B.fisher = function (m, lvl, ex) {
    for (const sx of [-0.2, 0.2]) for (const sz of [-0.18, 0.12]) m.box(0.035, 0.2, 0.035, C.woodD, { x: sx - 0.05, y: -0.1, z: sz });
    m.box(0.56, 0.035, 0.46, C.wood, { x: -0.05, y: 0.06, z: -0.03 });
    house(m, { w: 0.42, d: 0.34, h: 0.28, wall: C.woodL, roof: C.blue, rh: 0.26, x: -0.05, y: 0.09, z: -0.05, timber: false });
    door(m, -0.1, 0.125, 0.1, 0.17);
    m.parts[m.parts.length - 1].g.translate(0, 0.09, 0); m.parts[m.parts.length - 2].g.translate(0, 0.09, 0);
    windowAt(m, 0.165, 0.27, -0.05, 'x', true);
    // nets on a rack
    m.box(0.02, 0.28, 0.02, C.woodD, { x: 0.3, z: 0.2 }); m.box(0.02, 0.28, 0.02, C.woodD, { x: 0.3, z: -0.2 });
    m.box(0.015, 0.015, 0.42, C.woodD, { x: 0.3, y: 0.27, z: 0 });
    m.box(0.008, 0.2, 0.36, 0x6d6a55, { x: 0.3, y: 0.07, z: 0, j: 0.15 });
    // little boat
    m.add(new THREE.CylinderGeometry(0.07, 0.07, 0.32, 8, 1, false, 0, PI), 0x8a5a2b, { x: -0.2, y: 0.07, z: 0.32, rz: PI / 2, ry: 0.2 });
    m.box(0.08, 0.02, 0.06, 0x79b3df, { x: 0.15, y: 0.06, z: 0.28 });
  };
  B.market = function (m, lvl, ex) {
    m.box(0.88, 0.04, 0.84, C.stoneL, { y: -0.02, j: 0.08 });
    for (let i = 0; i < 16; i++) m.box(0.2, 0.012, 0.2, (i % 2) ? C.stone : C.stoneL, { x: -0.3 + (i % 4) * 0.2, y: 0.02, z: -0.3 + Math.floor(i / 4) * 0.2, j: 0.08 });
    // little guild booth at the back
    house(m, { w: 0.34, d: 0.26, h: 0.3, wall: C.plaster, roof: C.roofR, rh: 0.24, x: -0.18, z: -0.24 });
    door(m, -0.18, -0.105, 0.1, 0.18);
    // two stalls with striped awnings
    const stall = function (x, z, c1, c2, goods) {
      for (const sx of [-0.12, 0.12]) for (const sz of [-0.08, 0.08]) m.box(0.018, 0.26, 0.018, C.timber, { x: x + sx, z: z + sz });
      m.box(0.26, 0.08, 0.16, C.wood, { x: x, z: z });
      for (let s = 0; s < 4; s++) m.roof(0.072, 0.07, 0.24, s % 2 ? c1 : c2, { x: x - 0.11 + s * 0.072, y: 0.26, z: z, ry: PI / 2, j: 0.02 });
      for (let g = 0; g < 4; g++) m.ball(0.026, goods[g % goods.length], { x: x - 0.08 + g * 0.055, y: 0.1, z: z + 0.02 });
    };
    stall(0.22, -0.18, 0xd8402f, C.white, [0xd8402f, 0x9bc23c, 0xf1c40f]);
    stall(0.2, 0.22, 0x2f6fb0, C.white, [0x7b3f8f, 0xd08b3e, 0xe8c860]);
    barrel(m, -0.3, 0.25); crate(m, -0.15, 0.3); crate(m, -0.36, 0.08, 0, 0.08);
    m.cyl(0.012, 0.012, 0.6, 4, C.timber, { x: -0.38, z: -0.36 });
    ex.anims.push({ geo: flag(C.blue), x: -0.375, y: 0.6, z: -0.36, kind: 'flag' });
  };
  B.tower = function (m, lvl, ex) {
    foundation(m, 0.66, 0.66);
    m.box(0.46, 1.15, 0.46, C.stone, { j: 0.05 });
    for (let i = 0; i < 4; i++) m.box(0.5, 0.04, 0.5, C.stoneD, { y: 0.28 * i + 0.05 });
    m.box(0.56, 0.05, 0.56, C.timber, { y: 1.15 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(0.03, 0.26, 0.03, C.timber, { x: sx * 0.25, y: 1.2, z: sz * 0.25 });
    m.box(0.52, 0.06, 0.012, C.wood, { y: 1.22, z: 0.26 }); m.box(0.012, 0.06, 0.52, C.wood, { x: 0.26, y: 1.22 });
    m.cone(0.46, 0.4, 4, C.roofR, { y: 1.44, ry: PI / 4 });
    door(m, 0, 0.235, 0.12, 0.22);
    windowAt(m, 0.0, 0.7, 0.235, 'z', true);
    windowAt(m, 0.235, 0.5, 0.0, 'x', false);
    m.cyl(0.01, 0.01, 0.32, 4, C.iron, { y: 1.8 });
    ex.anims.push({ geo: flag(C.red), x: 0.005, y: 2.1, z: 0, kind: 'flag' });
  };
  B.vineyard = function (m, lvl, ex) {
    foundation(m, 0.8, 0.74);
    house(m, { w: 0.48, d: 0.38, h: 0.32, wall: C.cream, roof: C.purple, rh: 0.3, x: -0.1, z: -0.1 });
    door(m, -0.16, 0.095, 0.11, 0.18);
    windowAt(m, 0.04, 0.19, 0.095, 'z', true);
    // pergola with vines
    for (const sx of [0.18, 0.38]) for (const sz of [0.1, 0.34]) m.box(0.02, 0.3, 0.02, C.timber, { x: sx, z: sz });
    m.box(0.26, 0.02, 0.3, C.timber, { x: 0.28, y: 0.3, z: 0.22 });
    for (let i = 0; i < 6; i++) m.ball(0.05, C.leaf, { x: 0.2 + (i % 3) * 0.08, y: 0.33, z: 0.14 + Math.floor(i / 3) * 0.16 });
    for (let i = 0; i < 3; i++) m.ball(0.028, 0x6b2d7a, { x: 0.22 + i * 0.08, y: 0.26, z: 0.22 });
    barrel(m, -0.32, 0.25);
  };
  B.winery = function (m, lvl, ex) {
    foundation(m, 0.86, 0.8);
    house(m, { w: 0.56, d: 0.46, h: 0.36, wall: C.stone, roof: 0x7a3a2a, rh: 0.3, x: -0.06, z: -0.08, timber: false });
    m.box(0.16, 0.2, 0.03, 0x3b2414, { x: -0.06, z: 0.155 });
    m.add(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 10, 1, false, 0, PI), C.stoneD, { x: -0.06, y: 0.2, z: 0.155, rx: PI / 2, ry: 0 });
    windowAt(m, 0.225, 0.22, -0.08, 'x', true);
    for (let i = 0; i < 3; i++) barrel(m, 0.3, 0.12 + i * 0.12, 0.0, true);
    barrel(m, 0.3, 0.18, 0.11, true);
    m.box(0.012, 0.15, 0.012, C.timber, { x: -0.36, y: 0.15, z: 0.16 });
    m.box(0.1, 0.07, 0.012, C.woodL, { x: -0.31, y: 0.22, z: 0.16 });
    m.ball(0.022, 0x7b1e3a, { x: -0.31, y: 0.255, z: 0.17 });
  };
  B.tavern = function (m, lvl, ex) {
    foundation(m, 0.86, 0.8);
    m.box(0.6, 0.3, 0.46, C.stone, { x: -0.04, z: -0.08 });
    house(m, { w: 0.64, d: 0.5, h: 0.32, roof: C.roofR, rh: 0.36, x: -0.04, y: 0.3, z: -0.08 });
    door(m, -0.16, 0.155, 0.13, 0.21);
    windowAt(m, 0.08, 0.17, 0.155, 'z', true); windowAt(m, -0.2, 0.47, 0.175, 'z', true); windowAt(m, 0.12, 0.47, 0.175, 'z', true);
    chimney(m, 0.18, -0.2, 0.62, 0.36);
    ex.chimneys.push([0.18, 1.0, -0.2]);
    // sign
    m.box(0.15, 0.012, 0.012, C.iron, { x: -0.38, y: 0.42, z: 0.17 });
    m.box(0.11, 0.09, 0.012, C.woodL, { x: -0.4, y: 0.31, z: 0.17 });
    m.cyl(0.02, 0.018, 0.04, 6, C.gold, { x: -0.4, y: 0.33, z: 0.18 });
    // bench & table out front
    m.box(0.22, 0.07, 0.08, C.wood, { x: 0.22, z: 0.32 });
    m.box(0.22, 0.035, 0.04, C.woodD, { x: 0.22, z: 0.4 });
    m.cyl(0.015, 0.015, 0.03, 6, 0xe8c860, { x: 0.18, y: 0.07, z: 0.32 });
    m.cyl(0.015, 0.015, 0.03, 6, 0x7b1e3a, { x: 0.26, y: 0.07, z: 0.32 });
    barrel(m, -0.37, -0.28);
  };
  B.warehouse = function (m, lvl, ex) {
    // open loods: achterwand, lessenaarsdak, vakken voor de stapels (VE.STORE_SLOTS.warehouse)
    foundation(m, 0.9, 0.88);
    m.box(0.86, 0.03, 0.8, C.wood, { y: 0.04, z: -0.04 });
    m.box(0.88, 0.46, 0.04, C.woodL, { z: -0.42 });
    for (const x of [-0.42, 0.42]) { m.box(0.035, 0.46, 0.035, C.timber, { x: x, z: -0.42 }); m.box(0.035, 0.4, 0.035, C.timber, { x: x, z: -0.02 }); m.box(0.03, 0.12, 0.5, C.woodL, { x: x, y: 0.04, z: -0.2 }); }
    m.box(0.96, 0.03, 0.54, C.slate2, { y: 0.5, z: -0.22, rx: 0.3 });
    const S = VE.STORE_SLOTS.warehouse[lvl - 1];
    for (const sl of S) if (sl[0] < 0.2) m.box(0.022, 0.07, 0.22, C.timber, { x: sl[0] + 0.135, y: 0.05, z: sl[2] });
  };
  B.monument = function (m, lvl, ex) {
    foundation(m, 1.8, 1.8, C.stoneL);
    m.box(1.7, 0.06, 1.7, C.stoneL);
    m.box(0.7, 0.75, 1.3, C.stoneL, { x: -0.25, z: -0.1 });
    m.roof(0.84, 0.5, 1.4, C.slate, { x: -0.25, y: 0.75, z: -0.1, ry: PI / 2 });
    m.box(1.2, 0.6, 0.4, C.stoneL, { x: 0.0, z: -0.3 });
    m.roof(1.32, 0.38, 0.52, C.slate, { x: 0, y: 0.6, z: -0.3 });
    // grand spire
    m.box(0.5, 1.5, 0.5, C.stone, { x: -0.25, z: 0.45 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.cone(0.06, 0.3, 4, C.slate, { x: -0.25 + sx * 0.25, y: 1.5, z: 0.45 + sz * 0.25 });
    m.cone(0.36, 1.1, 8, C.slate, { x: -0.25, y: 1.5, z: 0.45 });
    m.ball(0.06, C.gold, { x: -0.25, y: 2.65, z: 0.45 }, 1);
    m.box(0.02, 0.2, 0.02, C.gold, { x: -0.25, y: 2.65, z: 0.45 });
    m.box(0.12, 0.02, 0.02, C.gold, { x: -0.25, y: 2.78, z: 0.45 });
    // rose window and great door
    m.add(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 12), 0x5a7fd6, { x: -0.25, y: 0.95, z: 0.71, rx: PI / 2 });
    m.add(new THREE.CylinderGeometry(0.07, 0.07, 0.025, 12), 0xd94a5a, { x: -0.25, y: 0.95, z: 0.715, rx: PI / 2 });
    m.box(0.22, 0.38, 0.03, C.door, { x: -0.25, z: 0.71 });
    for (let i = 0; i < 4; i++) windowAt(m, 0.11, 0.25 + (i % 2) * 0.3, -0.42 + Math.floor(i / 2) * 0.6, 'x', true);
    // garden
    for (let i = 0; i < 5; i++) m.cone(0.07, 0.3, 7, 0x2f6a3a, { x: 0.65, z: -0.7 + i * 0.32 });
    m.cyl(0.12, 0.14, 0.08, 10, C.stone, { x: 0.45, z: 0.55 });
    m.cyl(0.1, 0.1, 0.02, 10, 0x4a9bd1, { x: 0.45, y: 0.07, z: 0.55 });
    m.cyl(0.02, 0.03, 0.18, 6, C.stoneL, { x: 0.45, y: 0.08, z: 0.55 });
  };

  /* ---------- jacht, mijnbouw en metaal (procedurele reserve; de Blender-modellen vervangen ze) ---------- */
  B.hunter = function (m, lvl, ex) {
    foundation(m, 0.8, 0.74, C.dirt);
    // blokhut van liggende stammen
    for (let i = 0; i < 6; i++) {
      m.add(new THREE.CylinderGeometry(0.028, 0.028, 0.5, 7), i % 2 ? 0x7a4e2a : 0x8a5a2b, { y: 0.03 + i * 0.05, z: 0.13, rz: PI / 2, x: -0.04 });
      m.add(new THREE.CylinderGeometry(0.028, 0.028, 0.5, 7), i % 2 ? 0x7a4e2a : 0x8a5a2b, { y: 0.03 + i * 0.05, z: -0.23, rz: PI / 2, x: -0.04 });
    }
    m.box(0.46, 0.3, 0.36, 0x7a4e2a, { x: -0.04, z: -0.05 });
    m.roof(0.62, 0.26, 0.5, C.thatch, { x: -0.04, y: 0.3, z: -0.05, j: 0.07 });
    door(m, -0.1, 0.135, 0.1, 0.17);
    // veranda met palen
    m.box(0.5, 0.025, 0.12, C.woodL, { x: -0.04, y: 0.0, z: 0.22 });
    for (const sx of [-0.26, 0.18]) m.box(0.022, 0.24, 0.022, C.timber, { x: sx, z: 0.26 });
    m.box(0.5, 0.02, 0.14, C.wood, { x: -0.04, y: 0.24, z: 0.22, rx: -0.2 });
    chimney(m, 0.12, -0.15, 0.25, 0.3, C.stone);
    ex.chimneys.push([0.12, 0.6, -0.15]);
    // gewei boven de deur, houtstapel en vleesrek
    m.box(0.08, 0.012, 0.012, 0xe8dcc0, { x: -0.1, y: 0.26, z: 0.15 });
    m.box(0.012, 0.05, 0.012, 0xe8dcc0, { x: -0.13, y: 0.27, z: 0.15, rz: 0.4 }); m.box(0.012, 0.05, 0.012, 0xe8dcc0, { x: -0.07, y: 0.27, z: 0.15, rz: -0.4 });
    logPile(m, 0.3, 0.05, 4);
    for (const sx of [0.26, 0.4]) m.box(0.015, 0.22, 0.015, C.timber, { x: sx, z: -0.3 });
    m.box(0.16, 0.012, 0.012, C.timber, { x: 0.33, y: 0.21, z: -0.3 });
    m.ball(0.025, 0xc8553f, { x: 0.3, y: 0.16, z: -0.3, sy: 1.6 }); m.ball(0.025, 0xc8553f, { x: 0.36, y: 0.16, z: -0.3, sy: 1.6 });
    if (lvl >= 2) barrel(m, -0.34, 0.24);
    if (lvl >= 3) crate(m, 0.36, 0.3, 0, 0.08);
  };
  function mineB(ore) {
    const oreCol = VE.ORES ? VE.ORES[ore].color : 0x444444;
    return function (m, lvl, ex) {
      // houten ingang tegen de berg, stutten, rails naar buiten en een stort met erts
      m.add(new THREE.DodecahedronGeometry(0.42, 0), 0x8e877a, { y: 0.12, z: -0.18, sy: 0.7, j: 0.08 });
      m.box(0.26, 0.26, 0.04, 0x1e1a18, { y: 0.0, z: 0.1 });
      m.box(0.04, 0.3, 0.05, C.timber, { x: -0.15, z: 0.12 }); m.box(0.04, 0.3, 0.05, C.timber, { x: 0.15, z: 0.12 });
      m.box(0.38, 0.05, 0.06, C.timber, { y: 0.3, z: 0.12 });
      m.box(0.44, 0.03, 0.34, C.woodL, { y: -0.01, z: 0.3, j: 0.1 });            // houten platform
      for (const sx of [-0.05, 0.05]) m.box(0.012, 0.012, 0.42, C.iron, { x: sx, y: 0.025, z: 0.28 });
      for (let i = 0; i < 5; i++) m.box(0.14, 0.01, 0.025, C.woodD, { y: 0.018, z: 0.12 + i * 0.08 });
      // ertsstort
      for (let i = 0; i < 6; i++) m.ball(0.035, i % 2 ? oreCol : 0x6e675e, { x: 0.26 + (i % 3) * 0.04, y: 0.02 + Math.floor(i / 3) * 0.03, z: 0.32 + (i % 2) * 0.04 });
      // lantaarn
      m.box(0.012, 0.12, 0.012, C.iron, { x: 0.15, y: 0.3, z: 0.16 });
      m.box(0.03, 0.04, 0.03, C.glow, { x: 0.15, y: 0.26, z: 0.2 });
      // katrolbok
      m.box(0.025, 0.4, 0.025, C.timber, { x: -0.3, z: 0.18 }); m.box(0.025, 0.4, 0.025, C.timber, { x: -0.3, z: 0.02 });
      m.box(0.03, 0.03, 0.2, C.timber, { x: -0.3, y: 0.4, z: 0.1 });
      if (lvl >= 2) crate(m, -0.32, 0.36, 0, 0.08);
      if (lvl >= 3) barrel(m, 0.34, 0.12);
      const cart = new VE.Model(91);
      cart.box(0.12, 0.06, 0.15, 0x6e4a2a, { y: 0.03, j: 0.08 });
      for (const sx of [-0.065, 0.065]) for (const sz of [-0.05, 0.05]) cart.add(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 8), C.iron, { x: sx, y: 0.022, z: sz, rz: PI / 2 });
      for (let i = 0; i < 4; i++) cart.ball(0.028, oreCol, { x: -0.03 + (i % 2) * 0.06, y: 0.09, z: -0.03 + Math.floor(i / 2) * 0.06 });
      ex.anims.push({ geo: cart.build(), x: 0, y: 0.02, z: 0.18, kind: 'cart' });
      const wheel = new VE.Model(92);
      wheel.add(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 10), C.wood, { rz: PI / 2 });
      wheel.box(0.024, 0.13, 0.02, C.woodD, {});
      ex.anims.push({ geo: wheel.build(), x: -0.3, y: 0.4, z: 0.1, kind: 'wheel' });
    };
  }
  B.coalmine = mineB(1); B.ironmine = mineB(2); B.coppermine = mineB(3); B.goldmine = mineB(4);
  B.smelter = function (m, lvl, ex) {
    foundation(m, 0.84, 0.8);
    m.box(0.5, 0.34, 0.4, C.stone, { x: -0.08, z: -0.12, j: 0.06 });
    m.roof(0.6, 0.22, 0.5, C.slate, { x: -0.08, y: 0.34, z: -0.12, j: 0.07 });
    // grote stenen oven met schoorsteen
    m.cyl(0.16, 0.2, 0.34, 10, C.brick, { x: 0.22, z: 0.06, j: 0.08 });
    m.cyl(0.08, 0.1, 0.5, 8, C.brick, { x: 0.22, y: 0.34, z: 0.06, j: 0.08 });
    ex.chimneys.push([0.22, 0.9, 0.06]);
    m.box(0.1, 0.09, 0.03, 0x1a1010, { x: 0.22, y: 0.06, z: 0.23 });
    door(m, -0.2, 0.08, 0.11, 0.18);
    // gietvormen en staven
    m.box(0.16, 0.03, 0.08, C.stoneD, { x: -0.08, z: 0.3 });
    for (let i = 0; i < 3; i++) m.box(0.06, 0.02, 0.025, 0xa8b0b8, { x: -0.3 + i * 0.07, y: 0.0, z: 0.34 });
    // kolenbak
    m.box(0.14, 0.06, 0.12, C.woodD, { x: -0.32, z: 0.2 });
    for (let i = 0; i < 4; i++) m.ball(0.025, 0x2b2b30, { x: -0.35 + (i % 2) * 0.05, y: 0.07, z: 0.18 + Math.floor(i / 2) * 0.04 });
    const glow = new VE.Model(93); glow.box(0.08, 0.07, 0.01, 0xffffff, { j: 0 });
    ex.anims.push({ geo: glow.build(), x: 0.22, y: 0.065, z: 0.245, kind: 'glow' });
    const bel = new VE.Model(94); bel.box(0.1, 0.06, 0.14, 0x7a4e2a, { j: 0.06 }); bel.box(0.02, 0.02, 0.08, C.iron, { y: 0.03, z: 0.1 });
    ex.anims.push({ geo: bel.build(), x: 0.42, y: 0.02, z: 0.1, kind: 'bellows' });
    if (lvl >= 2) barrel(m, -0.36, -0.3);
    if (lvl >= 3) crate(m, 0.36, -0.3, 0, 0.09);
  };

  /* Wapensmederij (reserve; de GLB levert het echte model): smidse, haard met gloed, blaasbalg en een
     aambeeld met het gloeiende wapen (anker 'hotblade'). */
  B.weaponsmith = function (m, lvl, ex) {
    foundation(m, 0.88, 0.84);
    house(m, { x: -0.16, z: -0.2, w: 0.5, d: 0.32, h: 0.36, roof: C.roofR, rh: 0.28 });
    m.box(0.26, 0.16, 0.22, C.brick, { x: 0.28, z: -0.12, j: 0.06 });
    m.box(0.11, 0.5, 0.11, C.brick, { x: 0.28, y: 0.42, z: -0.14, j: 0.06 });
    ex.chimneys.push([0.28, 0.96, -0.14]);
    m.cyl(0.05, 0.058, 0.08, 8, C.woodD, { x: 0.06, z: 0.2 });
    m.box(0.1, 0.03, 0.05, C.iron, { x: 0.06, y: 0.16, z: 0.2 });
    for (const dx of [-0.12, 0.12]) m.box(0.02, 0.26, 0.02, C.timber, { x: -0.24 + dx, z: 0.22 });
    for (let k = 0; k < 3; k++) m.box(0.016, 0.2, 0.006, 0xb8c0c8, { x: -0.3 + k * 0.05, y: 0.07, z: 0.23 });
    barrel(m, 0.36, 0.22);
    const glow = new VE.Model(95); glow.box(0.2, 0.012, 0.16, 0xffffff, { j: 0 });
    ex.anims.push({ geo: glow.build(), x: 0.28, y: 0.2, z: -0.07, kind: 'glow' });
    const bel = new VE.Model(96); bel.box(0.1, 0.06, 0.14, 0x7a4e2a, { j: 0.06 });
    ex.anims.push({ geo: bel.build(), x: 0.44, y: 0.09, z: -0.1, kind: 'bellows' });
    const hot = new VE.Model(97); hot.box(0.09, 0.006, 0.02, 0xffffff, { j: 0 }); hot.box(0.03, 0.008, 0.012, 0x5a3a24, { x: -0.06, j: 0 });
    ex.anims.push({ geo: hot.build(), x: 0.055, y: 0.193, z: 0.2, kind: 'hotblade' });
  };

  VE.modelCache = {};
  /* gehakte bouwsteen (breedte × hoogte × diepte, item-eenheden): overal precies dit formaat */
  VE.STONE_BLOCK = [0.09, 0.05, 0.06];
  /* schaal van goederen in de wereld (stapels, bouwplaatsen, lading): overal dezelfde, dus een
     bouwsteen is overal 0,072 × 0,04 × 0,048 tegel */
  VE.ITEM_SCALE = 0.8;
  /* Vakken voor voorraadstapels (gebouw-lokaal x, y, z). De GLB-modellen hebben eigen 'slot'-markers;
     dit is de reserve voor de procedurele modellen en de bron voor yard.py en warehouse.py. */
  // startvoorraad: losse stapels in het gras, de middelste eerst gevuld (gelijk aan yard.py)
  const grid4 = [[-0.24, -0.2], [0.2, -0.14], [-0.18, 0.22], [0.24, 0.28], [-0.62, -0.58], [-0.2, -0.66], [0.22, -0.6], [0.64, -0.52], [-0.66, -0.16], [0.6, -0.1], [-0.6, 0.26], [0.66, 0.32], [-0.56, 0.66], [-0.14, 0.62], [0.28, 0.68], [0.68, 0.72]].map(p => [p[0], 0.012, p[1]]);
  const row = (xs, z) => xs.map(x => [x, 0.055, z]), X3 = [-0.27, 0, 0.27];
  VE.STORE_SLOTS = {
    yard: [grid4],
    warehouse: [
      row(X3, -0.2).concat(row(X3, 0.16)),
      row(X3, -0.28).concat(row(X3, -0.04), row(X3, 0.2)),
      row(X3, -0.28).concat(row(X3, -0.04), row(X3, 0.2))
    ]
  };
  /* Plek (gebouw-lokaal x, y, z) waar de uitvoervoorraad van een productiebedrijf als stapel ligt.
     GLB-modellen hebben hun eigen marker 'pile'; dit is de reserve voor de procedurele modellen. */
  VE.PILE_SPOT = {
    woodcutter: [-0.24, 0.06, 0.34], quarry: [0.26, 0.06, 0.27], sawmill: [-0.15, 0.06, 0.34],
    farm: [0.3, 0.06, 0.27], windmill: [0.3, 0.06, 0.27], bakery: [-0.03, 0.06, 0.34],
    fisher: [0.14, 0.095, 0.1], vineyard: [-0.04, 0.06, 0.33], winery: [0.07, 0.06, 0.34],
    hunter: [0.3, 0.06, 0.3], coalmine: [0.3, 0.06, 0.34], ironmine: [0.3, 0.06, 0.34], coppermine: [0.3, 0.06, 0.34],
    goldmine: [0.3, 0.06, 0.34], smelter: [-0.1, 0.06, 0.34], weaponsmith: [0.22, 0.06, 0.4]
  };
  /* Stapels aangeleverde grondstoffen (b.input), op volgorde van VE.RES_ORDER. Blender-markers 'in0', 'in1' …
     gaan voor; dit is de reserve. */
  VE.IN_SPOT = {
    sawmill: [[0.3, 0.06, 0.36]], windmill: [[-0.3, 0.06, 0.34]], bakery: [[-0.33, 0.06, 0.36]],
    winery: [[-0.3, 0.06, 0.36]], tavern: [[-0.32, 0.06, 0.38], [0.06, 0.06, 0.4]],
    smelter: [[0.17, 0.06, 0.37], [0.37, 0.06, 0.37], [-0.36, 0.06, 0.38]],
    weaponsmith: [[-0.42, 0.06, 0.1], [-0.42, 0.06, 0.34]]
  };
  /* wapenrek: [x, y (voetplank), z, draaiing]; Blender-marker 'rack' gaat voor */
  VE.RACK_SPOT = { weaponsmith: [0.2, 0.07, 0.36, 0] };

  /* Procedureel model zonder cache (ook gebruikt door glb-models.js voor de geanimeerde delen). */
  VE.buildProcedural = function (type, lvl) {
    const m = new VE.Model(type.length * 31 + lvl);
    const ex = { anims: [], chimneys: [] };
    B[type](m, lvl, ex);
    return { geo: m.build(), anims: ex.anims, chimneys: ex.chimneys };
  };
  VE.buildModel = function (type, lvl) {
    const key = type + '_' + lvl;
    if (VE.modelCache[key]) return VE.modelCache[key];
    return (VE.modelCache[key] = VE.buildProcedural(type, lvl));
  };

  VE.scaffoldGeo = function (size, around) {
    if (around) return upgradeScaffold(size);
    const m = new VE.Model(2);
    const r = size === 2 ? 0.8 : 0.36;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(0.025, 0.75 * size, 0.025, 0xb68a55, { x: sx * r, z: sz * r });
    for (const y of [0.3, 0.6]) {
      m.box(r * 2, 0.02, 0.02, 0xb68a55, { y: y * size, z: r }); m.box(r * 2, 0.02, 0.02, 0xb68a55, { y: y * size, z: -r });
      m.box(0.02, 0.02, r * 2, 0xb68a55, { x: r, y: y * size }); m.box(0.02, 0.02, r * 2, 0xb68a55, { x: -r, y: y * size });
    }
    m.box(r * 2, 0.02, 0.1, 0xc9a06a, { y: 0.3 * size, z: r + 0.05 });
    m.box(r * 1.6, 0.03, r * 1.6, 0x9c7a50, { y: -0.01 });
    return m.build();
  };
  /* steiger rondom een bestaand gebouw (upgrade): palen op de hoeken net buiten de muren, regels en een
     loopplank aan de zijkanten en achter, schoren en een ladder. De voorkant blijft laag open (deur). */
  function upgradeScaffold(size) {
    const m = new VE.Model(3), W = 0xb68a55, P = 0xc9a06a, D = 0x8f6a40;
    const r = size === 2 ? 1.02 : 0.52, H = size === 2 ? 1.25 : 0.95;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(0.026, H, 0.026, W, { x: sx * r, y: 0, z: sz * r });
    for (const sx of [-1, 1]) m.box(0.022, H * 0.9, 0.022, W, { x: sx * r, z: 0 });                 // middenpalen zijkant
    for (const y of [0.34, 0.68]) {
      const yy = y * H;
      m.box(r * 2, 0.02, 0.02, W, { y: yy, z: -r });                                                   // achter
      m.box(0.02, 0.02, r * 2, W, { x: r, y: yy }); m.box(0.02, 0.02, r * 2, W, { x: -r, y: yy });   // zijkanten
      if (y > 0.5) m.box(r * 2, 0.02, 0.02, W, { y: yy, z: r });                                       // voor: alleen boven de deur
      // loopplanken
      m.box(r * 2, 0.014, 0.09, P, { y: yy + 0.017, z: -r - 0.03 });
      m.box(0.09, 0.014, r * 2, P, { x: r + 0.03, y: yy + 0.017 }); m.box(0.09, 0.014, r * 2, P, { x: -r - 0.03, y: yy + 0.017 });
    }
    // schoren op de zijkanten en achter
    const L = Math.hypot(r, H * 0.68);
    for (const sx of [-1, 1]) m.box(0.016, L, 0.016, D, { x: sx * r, y: H * 0.34, z: -r / 2, rx: Math.atan2(r, H * 0.68) * sx });
    m.box(0.016, Math.hypot(r * 2, H * 0.34), 0.016, D, { y: H * 0.17, z: -r, rz: Math.atan2(r * 2, H * 0.34) });
    // ladder tegen de rechterkant
    for (const dz of [-0.05, 0.05]) m.box(0.016, H * 0.72, 0.016, W, { x: r + 0.07, y: 0, z: r * 0.5 + dz, rz: -0.12 });
    for (let k = 1; k < 7; k++) m.box(0.012, 0.012, 0.1, D, { x: r + 0.07 - k * 0.0115 * H, y: k * H * 0.1, z: r * 0.5 });
    return m.build();
  }

  /* ---------- nature ---------- */
  VE.treeGeo = function (type) {
    const t = new VE.Model(type * 7 + 1), c = new VE.Model(type * 7 + 2);
    c.icoMin = 1; t.segMin = 10; // hundreds of trees: one subdivision less than other round parts keeps them cheap, smooth shading does the rest
    if (type === 0) { // oak
      t.cyl(0.045, 0.07, 0.42, 6, 0x6b4a2b);
      t.box(0.025, 0.12, 0.025, 0x6b4a2b, { x: 0.05, y: 0.28, rz: -0.7 });
      const greens = [0x4f9a35, 0x5aa83a, 0x3f8a2e, 0x63b043, 0x4a9232];
      const blobs = [[0, 0.62, 0, 0.27], [0.15, 0.52, 0.06, 0.2], [-0.14, 0.55, -0.05, 0.21], [0.03, 0.78, -0.08, 0.19], [-0.05, 0.5, 0.15, 0.18]];
      blobs.forEach((b, i) => c.ball(b[3], greens[i], { x: b[0], y: b[1], z: b[2], j: 0.1 }, 0));
    } else if (type === 1) { // pine
      t.cyl(0.04, 0.06, 0.3, 6, 0x5a3d24);
      const g = [0x2f6a3a, 0x357540, 0x3d7f45];
      c.cone(0.3, 0.42, 7, g[0], { y: 0.22, j: 0.08 });
      c.cone(0.24, 0.38, 7, g[1], { y: 0.44, j: 0.08 });
      c.cone(0.17, 0.34, 7, g[2], { y: 0.66, j: 0.08 });
    } else { // birch
      t.cyl(0.03, 0.045, 0.55, 6, 0xeeeae0, { j: 0.02 });
      for (let i = 0; i < 4; i++) t.box(0.05, 0.015, 0.05, 0x2a2a2a, { y: 0.1 + i * 0.11, ry: i });
      c.ball(0.2, 0x8cc04a, { y: 0.66, sy: 1.35, j: 0.1 }, 0);
      c.ball(0.14, 0x9ccc55, { x: 0.1, y: 0.56, z: 0.04, j: 0.1 }, 0);
      c.ball(0.13, 0x7fb543, { x: -0.08, y: 0.78, z: -0.04, j: 0.1 }, 0);
    }
    return { trunk: t.build(), crown: c.build() };
  };
  VE.rockGeo = function () {
    const m = new VE.Model(44);
    m.add(new THREE.DodecahedronGeometry(0.24, 0), 0xa29d93, { y: 0.1, sy: 0.75, j: 0.12 });
    m.add(new THREE.DodecahedronGeometry(0.16, 0), 0x8f8a81, { x: 0.2, y: 0.06, z: 0.08, sy: 0.7, j: 0.12 });
    m.add(new THREE.DodecahedronGeometry(0.12, 0), 0xb5b0a5, { x: -0.16, y: 0.05, z: 0.12, j: 0.12 });
    m.add(new THREE.DodecahedronGeometry(0.1, 0), 0x9a958b, { x: 0.02, y: 0.04, z: -0.2, j: 0.12 });
    return m.build();
  };
  VE.tuftGeo = function () {
    const m = new VE.Model(12);
    for (let i = 0; i < 4; i++) { const a = i * 1.7; m.cone(0.025, 0.13 + (i % 2) * 0.05, 3, 0xffffff, { x: Math.cos(a) * 0.03, z: Math.sin(a) * 0.03, rz: Math.cos(a) * 0.3, rx: Math.sin(a) * 0.3, j: 0.15 }); }
    return m.build();
  };
  VE.flowerGeo = function () {
    const m = new VE.Model(13);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.05, z = (i % 2) * 0.04;
      m.box(0.008, 0.09, 0.008, 0x4f8a2e, { x: x, z: z, j: 0 });
      m.ball(0.022, 0xffffff, { x: x, y: 0.1, z: z, j: 0.05 });
    }
    return m.build();
  };
  /* Rijp graanveld zoals op een zomerse akker: een dichte massa halmen met daarbovenop een tapijt
     van aren die licht knikken. De massa zorgt dat je geen kale grond ziet; de aren geven textuur
     en hangen over de randen (geen 'hek'-rand). Wit/licht: de kleur komt per veld uit de
     instance-kleur (groen → goud). ~1.400 driehoeken per veld. */
  VE.wheatGeo = function () {
    const m = new VE.Model(14), r = VE.rng(141);
    const H = 0.2;
    m.box(0.86, H, 0.86, 0xe6dcc6, { j: 0.05 });
    m.box(0.85, 0.012, 0.85, 0xf2ead8, { y: H - 0.006, j: 0.06 });
    // aren-tapijt bovenop: dicht en speels geknikt, tot net over de rand
    for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
      const x = -0.45 + i * 0.075 + (r() - 0.5) * 0.04, z = -0.45 + j * 0.075 + (r() - 0.5) * 0.04;
      const y = H - 0.01 + r() * 0.05, lean = 0.25 + r() * 0.5, dir = 0.5 + (r() - 0.5) * 1.0;
      const tx = Math.sin(dir) * lean, tz = Math.cos(dir) * lean, el = 0.09 + r() * 0.025, c = r() < 0.5 ? 0xffffff : 0xf4e8c8;
      m.add(new THREE.ConeGeometry(0.021, el * 0.62, 4), c, { x: x, y: y + el * 0.31, z: z, rx: tz, rz: -tx, j: 0.1 });
      m.add(new THREE.ConeGeometry(0.021, el * 0.38, 4), c, { x: x, y: y - el * 0.19, z: z, rx: tz + PI, rz: -tx, j: 0.1 });
    }
    return m.build();
  };
  /* Stoppelveld na het maaien: korte, rechte stoppels. */
  VE.stubbleGeo = function () {
    const m = new VE.Model(16), r = VE.rng(161);
    m.box(0.92, 0.02, 0.92, 0xc9a860, { y: 0.0, j: 0.05 });               // laag gemaaid stro over de akker
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
      const x = -0.44 + i * 0.08 + (r() - 0.5) * 0.04, z = -0.44 + j * 0.08 + (r() - 0.5) * 0.04;
      m.add(new THREE.CylinderGeometry(0.006, 0.008, 0.055, 3, 1, true), r() < 0.5 ? 0xe2c478 : 0xcdaa5e, { x: x, y: 0.045, z: z, rz: (r() - 0.5) * 0.4, j: 0.12 });
    }
    // losse strohalmen die blijven liggen
    for (let n = 0; n < 14; n++) m.box(0.09, 0.005, 0.008, 0xe8cf86, { x: (r() - 0.5) * 0.8, y: 0.02, z: (r() - 0.5) * 0.8, ry: r() * PI, j: 0.1 });
    return m.build();
  };
  /* Eén schoof: bundel halmen, in het midden met een strootouw gebonden, aren uitwaaierend bovenaan. */
  function sheaf(m, o, s) {
    s = s || 1;
    const r = VE.rng(171 + (o.seed || 0));
    const parts = new VE.Model(172 + (o.seed || 0));
    parts.segMin = 6;                                   // niet afronden tot 18 segmenten: schoven zijn klein en talrijk
    // stelen: slank, onderaan iets uitlopend, smal bij de band, daarboven weer wat breder
    parts.add(new THREE.CylinderGeometry(0.018 * s, 0.03 * s, 0.13 * s, 6, 1, true), 0xd9b866, { y: 0.065 * s, j: 0.08 });
    parts.add(new THREE.CylinderGeometry(0.03 * s, 0.018 * s, 0.06 * s, 6, 1, true), 0xe2c278, { y: 0.16 * s, j: 0.08 });
    parts.add(new THREE.CylinderGeometry(0.021 * s, 0.021 * s, 0.014 * s, 6, 1, true), 0x9a7a3a, { y: 0.125 * s, j: 0 }); // band
    // aren: pluim van kegels die naar buiten waaieren en wat overhangen
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * PI * 2 + r() * 0.4, rr = (0.01 + r() * 0.022) * s;
      parts.add(new THREE.ConeGeometry(0.012 * s, 0.065 * s, 4), k % 2 ? 0xf0cf73 : 0xe5bd5c,
        { x: Math.cos(a) * rr, y: 0.215 * s, z: Math.sin(a) * rr, rx: Math.sin(a) * 0.75, rz: -Math.cos(a) * 0.75, j: 0.1 });
    }
    for (const p of parts.parts) {
      if (o.tilt) { p.g.rotateX(o.tilt); }
      if (o.ry) p.g.rotateY(o.ry);
      p.g.translate(o.x || 0, o.y || 0, o.z || 0);
      m.parts.push(p);
    }
  }
  /* Hok (stuik): schoven die schuin tegen elkaar staan te drogen, zoals op de oude akkers. */
  VE.stookGeo = function () {
    const m = new VE.Model(18);
    // schoven staan wijd uit met de voet en leunen met de koppen tegen elkaar (open, met tussenruimte)
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = i / n * PI * 2;
      sheaf(m, { x: Math.sin(a) * 0.12, z: Math.cos(a) * 0.12, ry: a, tilt: -0.42, seed: i }, 1.5);
    }
    sheaf(m, { seed: 9 }, 1.65);                       // middelste schoof rechtop
    return m.build();
  };
  VE.sheafGeo = function (s) { const m = new VE.Model(19); sheaf(m, {}, s || 1); return m.build(); };
  VE.soilGeo = function () {
    const m = new VE.Model(15);
    m.box(0.94, 0.03, 0.94, 0x7a5a38, { y: -0.01, j: 0.03 });
    m.box(0.93, 0.12, 0.93, 0x7a5a38, { y: -0.13, j: 0.03 });      // zijkant tot in de grond: nergens een zwevende rand
    for (let i = 0; i < 4; i++) m.box(0.9, 0.035, 0.08, 0x8f6a42, { y: 0.0, z: -0.33 + i * 0.22, j: 0.05 });
    return m.build();
  };
  VE.vineGeo = function () {
    const m = new VE.Model(16);
    for (const z of [-0.2, 0.2]) {
      for (const x of [-0.38, 0, 0.38]) m.box(0.02, 0.3, 0.02, 0x6b4a2b, { x: x, z: z, j: 0 });
      m.box(0.78, 0.008, 0.008, 0x444444, { y: 0.26, z: z });
      for (let i = 0; i < 6; i++) m.ball(0.075, i % 2 ? 0x4f8f34 : 0x5c9d3d, { x: -0.32 + i * 0.13, y: 0.22, z: z, sy: 0.85, j: 0.1 });
    }
    return m.build();
  };
  VE.grapeGeo = function () {
    const m = new VE.Model(17);
    for (const z of [-0.2, 0.2]) for (let i = 0; i < 5; i++) {
      const x = -0.27 + i * 0.135;
      m.ball(0.03, 0x6b2d7a, { x: x, y: 0.14, z: z + 0.06, j: 0.15 });
      m.ball(0.025, 0x7b3f8f, { x: x + 0.02, y: 0.1, z: z + 0.06, j: 0.15 });
    }
    return m.build();
  };
  VE.borderGeo = function () {
    const m = new VE.Model(18);
    m.box(0.03, 0.26, 0.03, 0x6b4a2b, { j: 0 });
    m.box(0.11, 0.06, 0.008, 0xd8402f, { x: 0.055, y: 0.19, j: 0.05 });
    m.box(0.06, 0.03, 0.06, 0x8e877a, { j: 0.05 });
    return m.build();
  };

  /* ---------- settlers ---------- */
  /* Settler parts. Body-local units (scaled ×1.28 when drawn); +z is the face.
     White parts are tinted per settler through instance colours (role, hair, pants, skin).
     Limbs are modelled hanging down from their pivot (hip / shoulder) so they can swing. */
  VE.SETTLER_SHOULDER = { x: 0.064, y: 0.198 };
  VE.SETTLER_HIP = { x: 0.024, y: 0.095 };
  VE.settlerGeo = function () {
    const torso = new VE.Model(21), head = new VE.Model(22), hat = new VE.Model(23), leg = new VE.Model(24);
    const hair = new VE.Model(25), arm = new VE.Model(26), hand = new VE.Model(27);
    const mustache = new VE.Model(28), beard = new VE.Model(29), feather = new VE.Model(31);
    const SKIN = 0xf1c9a0;
    // body: tunic, round belly, belt with a shiny buckle, collar and shoulders
    torso.cyl(0.044, 0.062, 0.125, 8, 0xffffff, { y: 0.088, j: 0.04 });
    torso.ball(0.05, 0xffffff, { y: 0.135, z: 0.014, sy: 0.95, sz: 0.88, j: 0.03 }, 1);
    torso.cyl(0.067, 0.067, 0.016, 8, 0x5a4028, { y: 0.11, j: 0 });
    torso.box(0.024, 0.02, 0.01, 0xffe9a0, { y: 0.108, z: 0.066, j: 0 });
    torso.cyl(0.03, 0.047, 0.014, 8, 0xf4f0e8, { y: 0.2, j: 0 });
    torso.ball(0.022, 0xffffff, { x: 0.056, y: 0.198 }, 1); torso.ball(0.022, 0xffffff, { x: -0.056, y: 0.198 }, 1);
    // head: big friendly face
    head.add(new THREE.SphereGeometry(0.05, 10, 8), SKIN, { y: 0.262, j: 0.02 });
    head.ball(0.012, SKIN, { x: 0.05, y: 0.262, sz: 0.7 }, 1); head.ball(0.012, SKIN, { x: -0.05, y: 0.262, sz: 0.7 }, 1);
    head.ball(0.014, 0xe48f6c, { y: 0.255, z: 0.051 }, 1);                                   // big round nose
    head.box(0.009, 0.015, 0.006, 0x24160e, { x: 0.019, y: 0.263, z: 0.045, j: 0 });          // eyes
    head.box(0.009, 0.015, 0.006, 0x24160e, { x: -0.019, y: 0.263, z: 0.045, j: 0 });
    head.box(0.004, 0.004, 0.003, 0xffffff, { x: 0.021, y: 0.271, z: 0.0485, j: 0 });         // eye sparkle
    head.box(0.004, 0.004, 0.003, 0xffffff, { x: -0.017, y: 0.271, z: 0.0485, j: 0 });
    head.box(0.017, 0.005, 0.005, 0x4a3020, { x: 0.02, y: 0.285, z: 0.041, rz: 0.12, j: 0 });  // raised, cheerful eyebrows
    head.box(0.017, 0.005, 0.005, 0x4a3020, { x: -0.02, y: 0.285, z: 0.041, rz: -0.12, j: 0 });
    head.ball(0.009, 0xf2958a, { x: 0.031, y: 0.247, z: 0.039, sz: 0.5 }, 1);                // rosy cheeks
    head.ball(0.009, 0xf2958a, { x: -0.031, y: 0.247, z: 0.039, sz: 0.5 }, 1);
    head.box(0.018, 0.005, 0.005, 0x8a3226, { y: 0.234, z: 0.046, j: 0 });                    // smile with
    head.box(0.006, 0.005, 0.005, 0x8a3226, { x: 0.011, y: 0.237, z: 0.0445, rz: 0.6, j: 0 });  // upturned corners
    head.box(0.006, 0.005, 0.005, 0x8a3226, { x: -0.011, y: 0.237, z: 0.0445, rz: -0.6, j: 0 });
    // hair (tinted per settler): back of the head and side tufts peeking out under the hat
    hair.add(new THREE.SphereGeometry(0.054, 10, 5, 0, PI * 2, 0, PI / 2.2), 0xffffff, { y: 0.27, z: -0.01, j: 0.04 });
    hair.box(0.014, 0.03, 0.034, 0xffffff, { x: 0.047, y: 0.244, z: -0.012 });
    hair.box(0.014, 0.03, 0.034, 0xffffff, { x: -0.047, y: 0.244, z: -0.012 });
    hair.box(0.07, 0.034, 0.02, 0xffffff, { y: 0.236, z: -0.04 });
    // hat (role colour): smaller brim so the face shows, dark band
    hat.cyl(0.06, 0.06, 0.01, 10, 0xffffff, { y: 0.302 });
    hat.cyl(0.035, 0.042, 0.046, 10, 0xeeeeee, { y: 0.306 });
    hat.cyl(0.0435, 0.0435, 0.01, 10, 0x6a4a30, { y: 0.308, j: 0 });
    // optional extras
    mustache.ball(0.015, 0xffffff, { x: 0.014, y: 0.245, z: 0.05, sx: 1.5, sy: 0.55, sz: 0.7, rz: 0.35 }, 1);
    mustache.ball(0.015, 0xffffff, { x: -0.014, y: 0.245, z: 0.05, sx: 1.5, sy: 0.55, sz: 0.7, rz: -0.35 }, 1);
    mustache.ball(0.006, 0xffffff, { x: 0.035, y: 0.252, z: 0.044 }, 1); mustache.ball(0.006, 0xffffff, { x: -0.035, y: 0.252, z: 0.044 }, 1);
    beard.ball(0.04, 0xffffff, { y: 0.226, z: 0.024, sy: 1.05, sz: 0.68 }, 1);
    beard.ball(0.022, 0xffffff, { y: 0.196, z: 0.03, sy: 1.2, sz: 0.6 }, 1);
    feather.box(0.007, 0.075, 0.02, 0xe2483a, { x: 0.042, y: 0.31, z: -0.012, rz: -0.45 });
    feather.box(0.003, 0.05, 0.003, 0xf6e7c8, { x: 0.044, y: 0.31, z: -0.004, rz: -0.45 });
    // leg (pivot at hip): trousers and a chunky shoe
    leg.box(0.034, 0.072, 0.036, 0xffffff, { y: -0.076, j: 0.04 });
    leg.box(0.039, 0.022, 0.058, 0x3a2a1a, { y: -0.098, z: 0.011, j: 0 });
    leg.box(0.04, 0.008, 0.06, 0x2a1d12, { y: -0.099, z: 0.011, j: 0 });
    // arm (pivot at shoulder): sleeve with a cuff
    arm.box(0.027, 0.07, 0.029, 0xffffff, { y: -0.07, j: 0.04 });
    arm.box(0.031, 0.012, 0.033, 0xf4f0e8, { y: -0.074, j: 0 });
    // hand (same pivot as the arm): mitten with a thumb, tinted by skin tone
    hand.ball(0.018, SKIN, { y: -0.087 }, 1);
    hand.ball(0.008, SKIN, { y: -0.08, z: 0.014 }, 1);
    return {
      torso: torso.build(), head: head.build(), hat: hat.build(), leg: leg.build(), hair: hair.build(),
      arm: arm.build(), hand: hand.build(), mustache: mustache.build(), beard: beard.build(), feather: feather.build()
    };
  };
  VE.toolGeo = function (kind) {
    const m = new VE.Model(30);
    const handle = (len) => m.box(0.014, len, 0.014, 0xb08050, { y: -0.03, j: 0.05 });
    if (kind === 'axe') { handle(0.18); m.box(0.055, 0.045, 0.012, 0x9aa0a6, { x: 0.025, y: 0.12 }); }
    else if (kind === 'hammer') { handle(0.15); m.box(0.06, 0.035, 0.035, 0x6a6e74, { y: 0.11 }); }
    else if (kind === 'pick') {
      // Curved pickaxe head in the swing plane (y/z): an arch of steel segments with pointed tips
      handle(0.18);
      const R = 0.085, cy = 0.152 - R, A = 1.05, segs = 6, steel = 0x7a7e84;
      for (let s = 0; s < segs; s++) {
        const th = -A + (s + 0.5) * (2 * A / segs), w = 0.022 - Math.abs(th) * 0.006;
        m.add(new THREE.BoxGeometry(w, w, R * (2 * A / segs) * 1.12), steel, { y: cy + R * Math.cos(th), z: R * Math.sin(th), rx: th, j: 0.03 });
      }
      for (const sgn of [1, -1]) {                                   // sharp tips continuing the curve
        const tip = new THREE.ConeGeometry(0.011, 0.045, 5); tip.translate(0, 0.0225, 0);
        m.add(tip, 0x9aa0a6, { y: cy + R * Math.cos(A), z: sgn * R * Math.sin(A), rx: sgn * (Math.PI / 2 + A), j: 0 });
      }
      m.box(0.03, 0.03, 0.03, 0x5a5e64, { y: 0.135, j: 0 });      // collar where the head meets the handle
    }
    else if (kind === 'hoe') {   // schoffel: lange steel, smal blad haaks naar voren
      handle(0.24);
      m.box(0.012, 0.012, 0.04, 0x6a6e74, { y: 0.205, z: 0.02, j: 0 });
      m.box(0.085, 0.055, 0.006, 0x9aa0a6, { y: 0.16, z: 0.045, j: 0.02 });
    }
    else if (kind === 'spade') { handle(0.18); m.box(0.05, 0.06, 0.008, 0x8a8f96, { y: -0.06 }); }
    else if (kind === 'scythe') { handle(0.22); m.box(0.13, 0.02, 0.008, 0xb8bec4, { x: 0.06, y: 0.18, rz: -0.25 }); }
    else if (kind === 'sickle') { handle(0.08); m.box(0.07, 0.015, 0.008, 0xb8bec4, { x: 0.03, y: 0.07, rz: 0.6 }); }
    else if (kind === 'net') {   // jachtnet aan een stok: een ring met een zak van touw
      handle(0.2);
      m.add(new THREE.TorusGeometry(0.06, 0.006, 4, 12), 0x9c7a50, { y: 0.22, rx: PI / 2 - 0.3 });
      m.add(new THREE.ConeGeometry(0.058, 0.1, 8, 1, true), 0xd9c7a0, { y: 0.175, z: -0.015, rx: PI - 0.3, j: 0.04 });
    }
    else if (kind === 'rod') { m.box(0.01, 0.4, 0.01, 0x9c7a50, { y: -0.03 }); m.box(0.003, 0.25, 0.003, 0xeeeeee, { x: 0.0, y: 0.12, z: 0.03, rx: 0.3 }); }
    return m.build();
  };
  VE.itemGeo = function (res) {
    const m = new VE.Model(40);
    switch (res) {
      case 'log': m.add(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 7), 0x8a5a2b, { rz: PI / 2 }); m.add(new THREE.CylinderGeometry(0.03, 0.03, 0.005, 7), 0xe2b77c, { x: 0.121, rz: PI / 2 }); break;
      // gehakte bouwsteen: een rechthoekig blok, altijd exact VE.STONE_BLOCK groot
      case 'stone': m.box(VE.STONE_BLOCK[0], VE.STONE_BLOCK[1], VE.STONE_BLOCK[2], 0xa9aaa4, { y: -VE.STONE_BLOCK[1] / 2, j: 0.03 }); break;
      case 'plank': m.box(0.24, 0.02, 0.06, 0xe0aa66, { y: -0.02 }); m.box(0.24, 0.02, 0.06, 0xd39a55, { y: 0.0, ry: 0.1 }); break;
      case 'grain': { const g = VE.sheafGeo(0.85); g.translate(0, -0.07, 0); return g; }  // graan = schoof (ook in de handen van dragers)
      case 'flour': m.ball(0.055, 0xf4ecdb, { sy: 1.2 }, 1); m.box(0.03, 0.025, 0.03, 0xa89474, { y: 0.065 }); break;
      case 'bread': m.ball(0.05, 0xd08b3e, { sx: 1.5, sy: 0.75 }, 1); break;
      case 'fish': m.ball(0.04, 0x79b3df, { sx: 2, sy: 0.8, sz: 0.6 }, 1); m.cone(0.03, 0.05, 4, 0x5f9bc9, { x: -0.1, y: -0.025, rz: PI / 2 }); break;
      case 'grape': m.cyl(0.06, 0.045, 0.06, 8, 0xb08050, { y: -0.03 }); for (let i = 0; i < 5; i++) m.ball(0.025, 0x6b2d7a, { x: (i % 3 - 1) * 0.03, y: 0.035, z: (i % 2) * 0.02 }); break;
      case 'wine': m.cyl(0.05, 0.045, 0.11, 8, 0x9c6b3f, { y: -0.04 }); m.cyl(0.052, 0.052, 0.01, 8, 0x555555, { y: 0.0 }); break;
      // vlees: een ham in een doek gebonden (vriendelijk, geen bloed)
      case 'meat': m.ball(0.05, 0xc8553f, { sx: 1.25, sy: 0.85, z: 0.01 }, 1); m.ball(0.03, 0xf2b8a0, { x: 0.035, y: 0.025, z: 0.01, sx: 1.2, sy: 0.5 }, 1);
        m.cyl(0.012, 0.012, 0.07, 6, 0xf3ead6, { x: -0.07, y: -0.035, rz: PI / 2 }); m.ball(0.017, 0xf3ead6, { x: -0.105, y: 0.0 }); break;
      case 'coal': for (let i = 0; i < 4; i++) m.add(new THREE.DodecahedronGeometry(0.03 + (i % 2) * 0.008, 0), i % 2 ? 0x2b2b30 : 0x3a3a40, { x: (i % 2 - 0.5) * 0.05, y: Math.floor(i / 2) * 0.03 - 0.01, z: (i - 1.5) * 0.012, j: 0.08 }); break;
      case 'ironore': case 'copperore': case 'goldore': {
        const base = res === 'goldore' ? 0x8f8a82 : res === 'copperore' ? 0x8a6a50 : 0x6e5a4c;
        const vein = res === 'goldore' ? 0xf2c443 : res === 'copperore' ? 0x3fae94 : 0xc0612f;
        m.add(new THREE.DodecahedronGeometry(0.055, 0), base, { sy: 0.8, j: 0.06 });
        for (let i = 0; i < 4; i++) { const a = i * 1.6; m.add(new THREE.OctahedronGeometry(0.018, 0), vein, { x: Math.cos(a) * 0.045, y: 0.012 + (i % 2) * 0.015, z: Math.sin(a) * 0.04, j: 0.03 }); }
        break;
      }
      case 'ironbar': case 'copperbar': case 'goldbar': {
        const col = res === 'goldbar' ? 0xe8b73a : res === 'copperbar' ? 0xc4703e : 0x9aa2aa;
        m.add(new THREE.CylinderGeometry(0.05, 0.068, 0.035, 4, 1), col, { ry: PI / 4, sz: 0.5, y: -0.01, j: 0.02 });
        break;
      }
      // wapens (reserve voor items.glb): plat liggend, lengte langs x
      case 'sword': m.box(0.2, 0.008, 0.024, 0xc4cbd2, { x: 0.03, y: -0.004 }); m.box(0.014, 0.014, 0.075, 0x7e868e, { x: -0.077, y: -0.007 }); m.box(0.05, 0.016, 0.017, 0x5a3a24, { x: -0.11, y: -0.008 }); break;
      case 'spear': m.box(0.28, 0.012, 0.012, 0xa0703f, { x: -0.01, y: -0.006 }); m.cone(0.018, 0.06, 4, 0xc4cbd2, { x: 0.16, rz: -PI / 2 }); break;
      case 'battleaxe': m.box(0.25, 0.014, 0.014, 0xa0703f, { x: -0.02, y: -0.007 }); m.box(0.04, 0.01, 0.13, 0xc4cbd2, { x: 0.085, y: -0.005 }); break;
      case 'dagger': m.box(0.085, 0.006, 0.018, 0xc4cbd2, { x: 0.025, y: -0.003 }); m.box(0.01, 0.012, 0.045, 0x7e868e, { x: -0.022, y: -0.006 }); m.box(0.035, 0.013, 0.013, 0x5a3a24, { x: -0.045, y: -0.0065 }); break;
      case 'bow': m.box(0.26, 0.012, 0.014, 0x8e5e30, { z: -0.02, y: -0.006 }); m.box(0.24, 0.003, 0.003, 0xede3c8, { z: 0.03 }); break;
      case 'crossbow': m.box(0.19, 0.02, 0.03, 0x8e5e30, { x: -0.01, y: -0.01 }); m.box(0.014, 0.012, 0.17, 0x7e868e, { x: 0.07, y: -0.006 }); break;
      default: m.ball(0.04, 0xf2c443, {});
    }
    return m.build();
  };
  VE.birdGeo = function () {
    const b = new VE.Model(50), w = new VE.Model(51);
    b.ball(0.05, 0x3a3a44, { sx: 0.7, sz: 1.6 }, 0); b.cone(0.02, 0.05, 4, 0xe8a33a, { z: 0.09, rx: PI / 2, y: -0.025 });
    w.box(0.18, 0.008, 0.07, 0x4a4a55, { x: 0.09, j: 0.05 });
    return { body: b.build(), wing: w.build() };
  };
})(window.VE);
