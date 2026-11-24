/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Eekhoorns: klimmen, takken, springen en gedrag op de grond.

   Klimdata komt uit Blender (public/models/nature-climb.json, geschreven door nature.py): per boomsoort de
   echte stamlijn (punten + straal) en de beloopbare takken. Per boom worden die één keer omgerekend naar de
   wereld (positie, draaiing, schaal van dat exemplaar). De eekhoorn staat altijd op het oppervlak:
     stam:  positie = as(h) + n·straal(h), buik naar de stam (lokale y = n), kop omhoog of omlaag (z = ±raaklijn)
     tak:   positie = lijn(u) + boven·straal(u), loopt over de bovenkant van de tak
     grond: hoogte van het terrein; stammen, gebouwen, rotsen en water worden ontweken.
   Zo kan hij nooit door een stam, tak, gebouw of de grond heen.

   Gedrag (toestand a.sq.mode):
     ground  rondhuppen, snuffelen/graven, rechtop zitten met een nootje, rondkijken, naar een boom rennen
     trunk   klimmen (kop omhoog) of afdalen (kop omlaag), met een lichte spiraal om de stam
     cling   even stil tegen de stam, kopje omhoog
     branch  over een tak lopen (heen of terug naar de stam)
     perch   op een tak zitten, staart over de rug
     jump    sprong naar een tak van dezelfde of een naburige boom (ballistische boog)
   Schrikt hij (bewoner of jager dichtbij): op de grond naar de dichtste boom en omhoog; in de boom hoger.
   Prestaties: buiten beeld krijgt hij (net als andere dieren) twee keer per seconde een update. */
'use strict';
(function (VE) {
  const N = VE.N, TAU = Math.PI * 2;
  let CLIMB = null;
  const load = (window.fetch ? fetch('public/models/nature-climb.json' + (VE.VERSION ? '?v=' + VE.VERSION : '')).then(r => r.ok ? r.json() : null) : Promise.resolve(null))
    .then(j => { CLIMB = j; }).catch(() => { CLIMB = null; });
  // reserve (procedurele bomen of geen klimdata): rechte stam, een paar takken
  const FALLBACK = { trunk: [[0, -0.02, 0, 0.055], [0, 0.48, 0, 0.034]], br: [[0, 0.36, 0, 0.18, 0.5, 0.04, 0.022, 0.01], [0, 0.42, 0, -0.15, 0.56, -0.05, 0.02, 0.009]] };
  const GAP = 0.0015;                      // pootjes net op de schors

  const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

  /* ---------- klimvorm van een boom (wereldcoördinaten, gecachet per boom) ---------- */
  function geom(t, w) {
    const sp = t.sp && t.sp[0] !== 'L' ? t.sp : 'L';
    const s = t.sc * (0.18 + 0.82 * Math.min(1, t.growth)), vx = t.look ? t.look.vx : 1, vy = t.look ? t.look.vy : 1;
    const key = sp + ':' + s.toFixed(3) + (CLIMB ? 'j' : 'f');
    if (t._cl && t._cl.key === key) return t._cl;
    const D = (CLIMB && CLIMB[sp]) || FALLBACK;
    const rot = sp === 'tree_oak_bird' || sp === 'tree_beech_logo' ? Math.PI / 4 : t.rot;
    const c = Math.cos(rot), sn = Math.sin(rot), gy = w.heightAt(t.x, t.z) - 0.02, sh = s * vx;
    const X = (x, y, z) => ({ x: t.x + (x * c + z * sn) * sh, y: gy + y * s * vy, z: t.z + (-x * sn + z * c) * sh });
    const trunk = D.trunk.map(p => Object.assign(X(p[0], p[1], p[2]), { r: p[3] * sh }));
    let L = 0; trunk[0].d = 0;
    for (let i = 1; i < trunk.length; i++) { const a = trunk[i - 1], b = trunk[i]; L += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); b.d = L; }
    const G = { key: key, trunk: trunk, L: L, br: [], t: t, dmin: Math.max(0.05, (trunk[0].r || 0.05) * 1.1 + (gy + 0.02 - trunk[0].y)) };
    for (const b of D.br) {
      const a = X(b[0], b[1], b[2]), e = X(b[3], b[4], b[5]);
      const len = Math.hypot(e.x - a.x, e.y - a.y, e.z - a.z);
      if (len < 0.05) continue;
      // hoogte langs de stam waar de tak begint (dichtstbijzijnde punt op de stamlijn)
      let bd = 0, best = 1e9;
      for (let d = 0; d <= L; d += 0.01) { const p = at(G, d), dd = (p.x - a.x) ** 2 + (p.y - a.y) ** 2 + (p.z - a.z) ** 2; if (dd < best) { best = dd; bd = d; } }
      const r0 = b[6] * sh, r1 = b[7] * sh;
      const B = { a: a, b: e, r0: r0, r1: r1, len: len, d: bd, u0: 0.5, u1: r1 > 0.006 ? 0.92 : 0.8 };
      // beloopbaar vanaf het punt waar de eekhoorn (lijf ~4 cm) helemaal vrij van de stam zit
      for (let u = 0.02; u < 0.6; u += 0.02) {
        const p = branchPoint(B, u);
        let clear = 1e9;
        for (let d = 0; d <= L; d += 0.01) { const P = at(G, d); clear = Math.min(clear, Math.hypot(p.x - P.x, p.y + 0.03 - P.y, p.z - P.z) - P.r); }
        if (clear > 0.035) { B.u0 = u; break; }
      }
      if (B.u0 >= B.u1 - 0.1) continue;                     // te kort om over te lopen
      G.br.push(B);
    }
    G.top = L - 0.03;
    t._cl = G;
    return G;
  }
  /* punt op de stamlijn op afstand d (vanaf de voet): positie, straal en raaklijn */
  const _at = { x: 0, y: 0, z: 0, r: 0, tx: 0, ty: 1, tz: 0 };
  function at(G, d) {
    const T = G.trunk;
    let i = 1; while (i < T.length - 1 && T[i].d < d) i++;
    const a = T[i - 1], b = T[i], f = Math.max(0, Math.min(1, (d - a.d) / ((b.d - a.d) || 1)));
    const l = (b.d - a.d) || 1;
    _at.x = a.x + (b.x - a.x) * f; _at.y = a.y + (b.y - a.y) * f; _at.z = a.z + (b.z - a.z) * f; _at.r = a.r + (b.r - a.r) * f;
    _at.tx = (b.x - a.x) / l; _at.ty = (b.y - a.y) / l; _at.tz = (b.z - a.z) / l;
    return _at;
  }
  /* nooit in de stam: bij een knik in een kromme stam ligt de binnenbocht dichter bij het volgende stuk.
     Duw het punt (lijf ~3 cm boven de voeten meegerekend) naar buiten tot het overal vrij is. */
  function clearOf(G, a, ox, oy, oz) {
    for (let pass = 0; pass < 2; pass++) for (let d = 0; d <= G.L; d += 0.025) {
      const P = at(G, d), dx = a.wx - P.x, dy = a.wy - P.y, dz = a.wz - P.z, l = Math.hypot(dx, dy, dz) || 1, need = P.r + GAP - l;
      if (need > 0) { a.wx += dx / l * need; a.wy += dy / l * need; a.wz += dz / l * need; }
    }
  }
  /* houding op de stam: buik tegen de schors, kop omhoog (dir 1) of omlaag (dir -1) */
  function trunkPose(a, G, d, th, dir) {
    const P = at(G, d);
    _z.set(P.tx, P.ty, P.tz);
    _y.set(Math.cos(th), 0, Math.sin(th)); _y.addScaledVector(_z, -_y.dot(_z)).normalize();
    a.wx = P.x + _y.x * (P.r + GAP); a.wy = P.y + _y.y * (P.r + GAP); a.wz = P.z + _y.z * (P.r + GAP);
    if (dir < 0) _z.negate();
    _x.crossVectors(_y, _z).normalize();
    _m.makeBasis(_x, _y, _z); a.tq.setFromRotationMatrix(_m);
    clearOf(G, a);
  }
  /* houding op een tak: bovenop, in de looprichting */
  function branchPose(a, B, u, dir) {
    branchPose0(a, B, u, dir);
    if (a.sq && a.sq.t && a.sq.t._cl) clearOf(a.sq.t._cl, a);
  }
  function branchPose0(a, B, u, dir) {
    const dx = B.b.x - B.a.x, dy = B.b.y - B.a.y, dz = B.b.z - B.a.z, l = B.len;
    _z.set(dx / l, dy / l, dz / l);
    _y.copy(UP).addScaledVector(_z, -_z.y).normalize();
    const r = B.r0 + (B.r1 - B.r0) * u;
    a.wx = B.a.x + dx * u + _y.x * (r + GAP); a.wy = B.a.y + dy * u + _y.y * (r + GAP); a.wz = B.a.z + dz * u + _y.z * (r + GAP);
    if (dir < 0) _z.negate();
    _x.crossVectors(_y, _z).normalize();
    _m.makeBasis(_x, _y, _z); a.tq.setFromRotationMatrix(_m);
  }
  function groundPose(a, w) {
    a.wx = a.x; a.wz = a.z; a.wy = w.heightAt(a.x, a.z);
    a.tq.setFromAxisAngle(UP, a.rot);
  }
  function branchPoint(B, u) { const r = B.r0 + (B.r1 - B.r0) * u; return { x: B.a.x + (B.b.x - B.a.x) * u, y: B.a.y + (B.b.y - B.a.y) * u + r, z: B.a.z + (B.b.z - B.a.z) * u }; }
  const treeOK = t => t && !t.dead && !t.falling && t.growth >= 0.7;

  /* ---------- naar een boom ---------- */
  function nearestTree(W, x, z, r) {
    const w = W.w, i0 = Math.floor(x), j0 = Math.floor(z);
    let best = null, bd = 1e9;
    for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
      if (!w.inb(i, j)) continue;
      const t = w.tree[j * N + i];
      if (!treeOK(t)) continue;
      const d = (t.x - x) ** 2 + (t.z - z) ** 2;
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }
  /* mode: 'flee' (rennen), 'walk', 'spawn' (meteen in de boom, bij het begin van het spel) */
  function toTree(W, a, mode) {
    const t = nearestTree(W, a.x, a.z, mode === 'flee' ? 4 : 3);
    if (!t) return false;
    const S = sq(a), G = geom(t, W.w), rnd = W.rnd;
    if (mode === 'spawn') {
      S.t = t; S.mode = 'cling'; S.d = G.dmin + rnd() * (G.top - G.dmin) * 0.8; S.th = rnd() * TAU; S.dir = 1; S.goal = S.d; S.spin = 0;
      S.speed = 0.55; a.state = 'climb'; S.wait = 1 + rnd() * 6;
      trunkPose(a, G, S.d, S.th, 1); a.q.copy(a.tq);
      return true;
    }
    // voet van de stam aan de kant waar hij vandaan komt, net buiten de schors (en buiten de wortels)
    const ang = Math.atan2(a.z - t.z, a.x - t.x) + (rnd() - 0.5) * 0.6, R = G.trunk[0].r + 0.035;
    S.t = t; S.th = ang; S.mode = 'ground';
    W.setTarget(a, t.x + Math.cos(ang) * R, t.z + Math.sin(ang) * R, 'toTree', mode === 'flee' ? a.sp.run : a.sp.walk * 1.5);
    S.flee = mode === 'flee';
    return true;
  }
  function sq(a) {
    if (!a.sq) { a.sq = { mode: 'ground' }; a.q = new THREE.Quaternion().setFromAxisAngle(UP, a.rot); a.tq = new THREE.Quaternion(); a.cyc = 0; a.wx = a.x; a.wy = 0; a.wz = a.z; }
    return a.sq;
  }

  /* ---------- botsing op de grond: nooit door een stam ---------- */
  function pushFromTrunks(W, a) {
    const w = W.w, i0 = Math.floor(a.x), j0 = Math.floor(a.z), S = a.sq;
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      if (!w.inb(i, j)) continue;
      const t = w.tree[j * N + i]; if (!t || t.dead) continue;
      if (S.mode === 'ground' && a.state === 'toTree' && t === S.t) continue;   // eigen doelboom: hij stopt zelf aan de voet
      const G = geom(t, w), R = G.trunk[0].r + 0.03, dx = a.x - t.x, dz = a.z - t.z, d = Math.hypot(dx, dz);
      if (d < R && d > 1e-4) { a.x = t.x + dx / d * R; a.z = t.z + dz / d * R; }
      else if (d <= 1e-4) { a.x = t.x + R; }
    }
  }

  /* ---------- sprongdoelen: takpunten van deze of een naburige boom ---------- */
  function jumpTarget(W, a, from, G0) {
    const w = W.w, i0 = Math.floor(from.x), j0 = Math.floor(from.z), rnd = W.rnd;
    const out = [];
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      if (!w.inb(i, j)) continue;
      const t = w.tree[j * N + i]; if (!treeOK(t)) continue;
      const G = geom(t, w);
      G.br.forEach((B, bi) => {
        if (G === G0 && B === a.sq.B) return;
        const u = B.u0 + (B.u1 - B.u0) * (0.55 + rnd() * 0.35), p = branchPoint(B, u);
        const d = Math.hypot(p.x - from.x, p.z - from.z), dy = p.y - from.y;
        if (d < 0.18 || d > 0.95 || Math.abs(dy) > 0.3) return;
        // niet dwars door een stam (ook niet die van de eigen boom)
        if (blockedByTrunk(W, from, p, G0, G)) return;
        out.push({ G: G, B: B, u: u, p: p });
      });
    }
    return out.length ? out[Math.floor(rnd() * out.length)] : null;
  }
  function blockedByTrunk(W, p, q, G0, G1) {
    const w = W.w, mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2, i0 = Math.floor(mx), j0 = Math.floor(mz);
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      if (!w.inb(i, j)) continue;
      const t = w.tree[j * N + i]; if (!t || t.dead) continue;
      const G = geom(t, w);
      // afstand van de stamas tot de sprongbaan (2D), op de hoogte van de sprong
      const vx = q.x - p.x, vz = q.z - p.z, L = vx * vx + vz * vz || 1;
      const f = Math.max(0, Math.min(1, ((t.x - p.x) * vx + (t.z - p.z) * vz) / L));
      if ((G === G0 && f < 0.15) || (G === G1 && f > 0.85)) continue;      // vertrek- en landingsboom aan de uiteinden
      const y = p.y + (q.y - p.y) * f;
      const P = at(G, Math.max(0, Math.min(G.L, y - G.trunk[0].y)));
      if (y > G.trunk[G.trunk.length - 1].y + 0.02) continue;              // boven de stam uit
      if (Math.hypot(p.x + vx * f - P.x, p.z + vz * f - P.z) < P.r + 0.04) return true;
    }
    return false;
  }

  /* ---------- gedrag ---------- */
  function think(W, a, dt) {
    const S = sq(a), rnd = W.rnd, w = W.w, sp = a.sp;
    dt = Math.min(dt, 0.6);
    const t = S.t;
    if (S.mode !== 'ground' && S.mode !== 'jump' && !treeOK(t)) { fallOff(W, a); return finish(W, a, dt); }
    // schrikken: op de grond naar een boom; laag in de boom: hoger klimmen
    a.chk -= dt;
    if (a.chk <= 0) {
      a.chk = 0.25 + rnd() * 0.15;
      const s = W.threat(a);
      if (s) {
        if (S.mode === 'ground' && !(a.state === 'toTree' && S.flee)) {
          if (!toTree(W, a, 'flee')) W.flee(a, s.x, s.z);
        } else if (S.mode !== 'ground' && S.mode !== 'jump') {
          const G = geom(t, w);
          if (S.mode === 'branch' || S.mode === 'perch') { if (S.mode === 'perch') { S.mode = 'branch'; } S.dirB = -1; S.speed = 1.2; }
          else if ((S.d || 0) < G.top * 0.75) { S.mode = 'trunk'; S.dir = 1; S.goal = G.top * (0.8 + rnd() * 0.18); S.speed = 0.9; }
        }
      }
    }
    switch (S.mode) {
      case 'ground': ground(W, a, dt); break;
      case 'trunk': trunk(W, a, dt); break;
      // stil tegen de stam (de klimpose staat stil)
      case 'cling': a.clipWant = S.dir > 0 ? 'climb' : 'descend'; S.wait -= dt; if (S.wait <= 0) decideOnTrunk(W, a); else trunkPose(a, geom(t, w), S.d, S.th, S.dir); break;
      case 'branch': branch(W, a, dt); break;
      case 'perch': S.wait -= dt; branchPose(a, S.B, S.u, S.dirB); if (S.wait <= 0) afterPerch(W, a); break;
      case 'jump': jump(W, a, dt); break;
    }
    return finish(W, a, dt);
  }
  function finish(W, a, dt) {
    // houding vloeiend naar de doelhouding (overgang grond → stam, omdraaien op een tak, landen)
    const S = a.sq;
    if (S.mode === 'ground') groundPose(a, W.w);
    // net van toestand gewisseld (tak → stam, omkeren): de houding hoort meteen bij de nieuwe toestand
    else if ((S.mode === 'trunk' || S.mode === 'cling') && treeOK(S.t)) trunkPose(a, geom(S.t, W.w), S.d, S.th, S.dir);
    // op een helling: nooit onder het maaiveld
    const gy = W.w.heightAt(a.wx, a.wz);
    if (a.wy < gy) a.wy = gy;
    a.q.slerp(a.tq, 1 - Math.exp(-dt * 16));
    a.y = a.wy - W.w.heightAt(a.x, a.z);
    a.ownPh = true;
  }

  function ground(W, a, dt) {
    const S = a.sq, rnd = W.rnd, w = W.w;
    // net een gebouw neergezet waar hij stond: naar de dichtste vrije plek
    if (!W.passXZ(a.x, a.z)) {
      for (let r = 0.3; r <= 3; r += 0.3) for (let q = 0; q < 8; q++) { const x = a.x + Math.cos(q * 0.785) * r, z = a.z + Math.sin(q * 0.785) * r; if (W.passXZ(x, z)) { a.x = x; a.z = z; a.state = 'idle'; a.t = 0.2; return; } }
    }
    a.t -= dt;
    if (a.state === 'walk' || a.state === 'flee' || a.state === 'toTree') {
      const ox = a.x, oz = a.z, st0 = a.state;
      W.move(a, dt);
      pushFromTrunks(W, a);
      a.cyc += Math.hypot(a.x - ox, a.z - oz) / (st0 === 'walk' ? 0.075 : 0.11);
      a.clipWant = st0 === 'walk' ? 'walk' : 'run';
      // aan de voet van de boom aangekomen (W.move zet de toestand dan op 'up')
      if (st0 === 'toTree' && a.state !== 'toTree') startClimb(W, a);
      return;
    }
    a.clipWant = a.state === 'eat' ? 'forage' : a.state === 'sit' ? 'sit' : a.state === 'alert' ? 'alert' : a.state === 'rest' ? 'rest' : 'idle';
    if (a.t > 0) return;
    // volgende bezigheid: wisselend, met rustmomenten
    const r = rnd();
    if (r < 0.28 && toTree(W, a, 'walk')) return;
    if (r < 0.5 && W.wander(a)) { a.spd = a.sp.walk * (0.8 + rnd() * 0.5); return; }
    if (r < 0.72) { a.state = 'eat'; a.t = 2 + rnd() * 4; return; }               // snuffelen en graven naar nootjes
    if (r < 0.86) { a.state = 'sit'; a.t = 2 + rnd() * 3.5; return; }             // rechtop met een nootje
    if (r < 0.93) { a.state = 'alert'; a.t = 1 + rnd() * 2; return; }
    a.state = 'idle'; a.t = 1 + rnd() * 2.5;
  }
  function startClimb(W, a) {
    const S = a.sq, t = S.t, rnd = W.rnd;
    if (!treeOK(t)) { a.state = 'idle'; a.t = 0.5; S.mode = 'ground'; return; }
    const G = geom(t, W.w);
    S.mode = 'trunk'; S.dir = 1; S.d = G.dmin; S.th = Math.atan2(a.z - t.z, a.x - t.x);
    S.goal = S.flee ? G.top * (0.75 + rnd() * 0.2) : G.dmin + (G.top - G.dmin) * (0.35 + rnd() * 0.6);
    S.spin = (rnd() - 0.5) * 1.2; S.speed = S.flee ? 0.95 : 0.55 + rnd() * 0.2; S.skipBr = rnd() < 0.3;
    a.state = 'climb';
  }
  function trunk(W, a, dt) {
    const S = a.sq, G = geom(S.t, W.w), rnd = W.rnd;
    // huppend klimmen: snelheid golft mee met de sprongen (clip 'climb' / 'descend')
    const hop = 0.55 + 0.45 * Math.max(0, Math.sin(a.cyc * TAU));
    const step = (S.speed || 0.55) * dt * hop * (S.dir < 0 ? 0.75 : 1);
    const d0 = S.d;
    S.d = Math.max(G.dmin, Math.min(G.top, S.d + S.dir * step));
    S.th += S.spin * dt;
    a.cyc += Math.abs(S.d - d0) / (S.dir > 0 ? 0.06 : 0.05) + dt * 0.15;
    a.clipWant = S.dir > 0 ? 'climb' : 'descend';
    trunkPose(a, G, S.d, S.th, S.dir);
    // onderweg een tak: soms eropaf
    if (S.dir > 0 && !S.skipBr) for (const B of G.br) {
      if (d0 < B.d && S.d >= B.d && rnd() < 0.55) { onBranch(a, B, B.u0, 1); return; }
    }
    if (S.dir > 0 && S.d >= S.goal - 1e-4) { S.mode = 'cling'; S.wait = 1 + rnd() * 3; S.flee = false; return; }
    if (S.dir < 0 && S.d <= G.dmin + 1e-4) dismount(W, a, G);
  }
  function decideOnTrunk(W, a) {
    const S = a.sq, G = geom(S.t, W.w), rnd = W.rnd, r = rnd();
    // dichtstbijzijnde tak op deze hoogte, anders verder klimmen of omlaag
    let near = null; for (const B of G.br) if (Math.abs(B.d - S.d) < 0.12 && (!near || Math.abs(B.d - S.d) < Math.abs(near.d - S.d))) near = B;
    if (near && r < 0.5) { S.d = near.d; onBranch(a, near, near.u0, 1); return; }
    if (r < 0.65 && S.d < G.top - 0.08) { S.dir = 1; S.goal = Math.min(G.top, S.d + 0.1 + rnd() * 0.3); S.mode = 'trunk'; return; }
    S.mode = 'trunk'; S.dir = -1; S.speed = 0.5 + rnd() * 0.2; S.spin = (rnd() - 0.5) * 0.8;
  }
  function onBranch(a, B, u, dir) {
    const S = a.sq;
    S.mode = 'branch'; S.B = B; S.u = u; S.dirB = dir; S.speed = 0.35 + Math.random() * 0.25;
  }
  function branch(W, a, dt) {
    const S = a.sq, B = S.B, rnd = W.rnd;
    const u0 = S.u;
    S.u += S.dirB * S.speed * dt / B.len;
    a.cyc += Math.abs(S.u - u0) * B.len / 0.075;
    a.clipWant = S.speed > 0.8 ? 'run' : 'walk';
    if (S.dirB > 0 && S.u >= B.u1) {
      S.u = B.u1;
      const r = rnd();
      const from = branchPoint(B, S.u);
      const J = r < 0.5 ? jumpTarget(W, a, from, geom(S.t, W.w)) : null;
      if (J) { startJump(W, a, from, J); return; }
      if (r < 0.85) { S.mode = 'perch'; S.wait = 2.5 + rnd() * 6; a.clipWant = 'perch'; branchPose(a, B, S.u, 1); return; }
      S.dirB = -1;
    } else if (S.dirB < 0 && S.u <= B.u0) {
      // terug bij de stam: omhoog of omlaag verder
      S.u = B.u0; S.d = B.d; S.th = Math.atan2(B.b.z - B.a.z, B.b.x - B.a.x);
      S.mode = 'trunk'; S.spin = (rnd() - 0.5) * 0.8; S.skipBr = true;
      const G = geom(S.t, W.w);
      if (rnd() < 0.35 && S.d < G.top - 0.1) { S.dir = 1; S.goal = Math.min(G.top, S.d + 0.1 + rnd() * 0.25); }
      else { S.dir = -1; S.speed = 0.5 + rnd() * 0.2; }
      return;
    }
    branchPose(a, B, S.u, S.dirB);
  }
  function afterPerch(W, a) {
    const S = a.sq, r = W.rnd();
    const from = branchPoint(S.B, S.u);
    const J = r < 0.45 ? jumpTarget(W, a, from, geom(S.t, W.w)) : null;
    if (J) { startJump(W, a, from, J); return; }
    S.mode = 'branch'; S.dirB = -1;
  }
  function startJump(W, a, from, J) {
    const S = a.sq, d = Math.hypot(J.p.x - from.x, J.p.z - from.z);
    S.mode = 'jump';
    S.J = { x0: from.x, y0: from.y, z0: from.z, x1: J.p.x, y1: J.p.y, z1: J.p.z, p: 0, dur: 0.32 + d * 0.32, h: 0.05 + d * 0.12, G: J.G, B: J.B, u: J.u };
    a.rot = Math.atan2(J.p.x - from.x, J.p.z - from.z);
  }
  function jump(W, a, dt) {
    const S = a.sq, J = S.J;
    J.p = Math.min(1, J.p + dt / J.dur);
    const p = J.p;
    a.wx = J.x0 + (J.x1 - J.x0) * p; a.wz = J.z0 + (J.z1 - J.z0) * p;
    a.wy = J.y0 + (J.y1 - J.y0) * p + Math.sin(p * Math.PI) * J.h;
    if (S.t && S.t._cl) clearOf(S.t._cl, a);
    if (J.G) clearOf(J.G, a);
    a.x = a.wx; a.z = a.wz;
    // kop in de vliegrichting, licht omhoog bij het afzetten en omlaag bij het landen
    const pitch = Math.atan2((J.y1 - J.y0) / J.dur + Math.cos(p * Math.PI) * Math.PI * J.h / J.dur, Math.hypot(J.x1 - J.x0, J.z1 - J.z0) / J.dur);
    _q.setFromAxisAngle(UP, a.rot); a.tq.setFromAxisAngle(_x.set(1, 0, 0), -pitch); a.tq.premultiply(_q);
    a.clipWant = 'jump'; a.clipP = p;
    if (p >= 1) {
      if (!treeOK(J.G.t)) { fallOff(W, a); return; }
      S.t = J.G.t; S.B = J.B; S.u = J.u; S.mode = 'branch'; S.dirB = -1; S.speed = 0.3 + W.rnd() * 0.2;   // landen, dan naar de stam
    }
  }
  /* van de stam af op de grond: naast de voet, met de kop van de boom af */
  function dismount(W, a, G) {
    const S = a.sq, t = S.t, base = G.trunk[0];
    const R = base.r + 0.04;
    let x = t.x + Math.cos(S.th) * R, z = t.z + Math.sin(S.th) * R;
    if (!W.passXZ(x, z)) { x = t.x + Math.cos(S.th + Math.PI) * R; z = t.z + Math.sin(S.th + Math.PI) * R; }
    a.x = x; a.z = z; a.rot = Math.atan2(Math.cos(S.th), Math.sin(S.th));
    S.mode = 'ground'; S.t = null; a.state = 'idle'; a.t = 0.3 + W.rnd() * 1.2;
    a.hx = VE.lerp(a.hx, a.x, 0.3); a.hz = VE.lerp(a.hz, a.z, 0.3);
  }
  /* boom omgehakt of weg: op de grond, en wegrennen */
  function fallOff(W, a) {
    const S = a.sq;
    if (S.t) { const R = 0.12; a.x = S.t.x + Math.cos(S.th || 0) * R; a.z = S.t.z + Math.sin(S.th || 0) * R; }
    if (!W.passXZ(a.x, a.z)) { a.x = a.hx; a.z = a.hz; }
    S.mode = 'ground'; S.t = null; a.state = 'idle'; a.t = 0.2;
    W.flee(a, a.x + 0.3, a.z + 0.3);
  }

  VE.Squirrel = { think: think, toTree: toTree, geom: geom, at: at, ready: load,
    /* voor tests: afstand van een punt tot het stamoppervlak van boom t (negatief = erin) */
    trunkClearance(t, w, x, y, z) {
      const G = geom(t, w); let best = 1e9;
      for (let d = 0; d <= G.L; d += 0.01) { const P = at(G, d); best = Math.min(best, Math.hypot(x - P.x, y - P.y, z - P.z) - P.r); }
      return best;
    } };

  /* ---------- koppeling met js/wildlife.js ---------- */
  const W0 = VE.Wildlife && VE.Wildlife.prototype;
  if (W0) {
    const think0 = W0.think, toTree0 = W0.toTree, flee0 = W0.flee;
    W0.think = function (a, dt) { if (a.key === 'squirrel') return think(this, a, dt); return think0.call(this, a, dt); };
    W0.toTree = function (a, mode) { if (a.key === 'squirrel') return toTree(this, a, mode); return toTree0.call(this, a, mode); };
    // vluchten op de grond: eerst een boom proberen (W0.flee roept toTree aan); in de boom niet wegrennen
    W0.flee = function (a, fx, fz) {
      if (a.key === 'squirrel' && a.sq && a.sq.mode !== 'ground') return;
      return flee0.call(this, a, fx, fz);
    };
  }
})(window.VE);
