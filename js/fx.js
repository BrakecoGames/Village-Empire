/* Village Empire — © 2026 Brakeco Games. All rights reserved. */
'use strict';
(function (VE) {
  const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _o = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  const UP = new THREE.Vector3(0, 1, 0);
  const _a = new THREE.Matrix4(), _r = new THREE.Matrix4(), _v = new THREE.Vector3();
  // settler variety (multiplied with the white / skin vertex colours)
  const HAIR = [0x6b4423, 0x2e2018, 0xd9a441, 0xb8582a, 0xb3aea6].map(c => new THREE.Color(c));
  const SKIN = [0xffffff, 0xf2dfcc, 0xd9b49a, 0xb8896a].map(c => new THREE.Color(c));
  const PANTS = [0x5a4030, 0x4a566c, 0x6e5c3a, 0x44503a].map(c => new THREE.Color(c));
  const TOOL_ACTS = new Set(['chop', 'pick', 'hammer', 'harvest', 'dig', 'fish']);

  /* ---------------- Settlers (fully instanced) ---------------- */
  class SettlerRender {
    constructor(root, cap) {
      cap = cap || 170; this.cap = cap;
      const g = VE.settlerGeo();
      const mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 5, specular: 0x111111 });
      // All meshes share `mat`; three.js r128 needs every one of them to have instanceColor once any
      // has it, otherwise rendering crashes (VE-001). Build the buffer at full capacity (white = unchanged);
      // setColorAt would size it by the current `count`, which is 0 here.
      this.root = root; this._all = [];
      const mk = (geo, n, shadow) => {
        const m = new THREE.InstancedMesh(geo, mat, n);
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
        m.count = 0; m.castShadow = shadow; m.frustumCulled = false; root.add(m); this._all.push(m);
        return m;
      };
      // tiny parts (hands, hair, face extras) skip the shadow pass: invisible in the shadow, saves draw calls
      this.torso = mk(g.torso, cap, true); this.head = mk(g.head, cap, true); this.hat = mk(g.hat, cap, true);
      this.hair = mk(g.hair, cap, false);
      this.legL = mk(g.leg, cap, true); this.legR = mk(g.leg, cap, true);
      this.armL = mk(g.arm, cap, true); this.armR = mk(g.arm, cap, true);
      this.handL = mk(g.hand, cap, false); this.handR = mk(g.hand, cap, false);
      this.parts = [this.torso, this.head, this.hair, this.hat, this.legL, this.legR, this.armL, this.armR, this.handL, this.handR];
      this.mustache = mk(g.mustache, cap, false); this.beard = mk(g.beard, cap, false); this.feather = mk(g.feather, cap, false);
      this.tools = {};
      for (const t of ['axe', 'hammer', 'pick', 'spade', 'scythe', 'sickle', 'rod']) this.tools[t] = mk(VE.toolGeo(t), 80, true);
      this.items = {};
      for (const r of VE.RES_ORDER) this.items[r] = mk(VE.itemGeo(r), 120, true);
      this.roleCol = {};
      for (const r in VE.ROLES) this.roleCol[r] = [new THREE.Color(VE.ROLES[r][0]), new THREE.Color(VE.ROLES[r][1])];
    }
    /* opruimen bij het live wisselen naar de Blender-bewoners (settler-glb.js) */
    dispose() { for (const m of this._all) this.root.remove(m); }
    toolAngle(s) {
      const lerp = VE.lerp;
      if (s.act === 'chop' || s.act === 'pick') {
        const per = s.act === 'chop' ? 0.75 : 0.6, t = (s.ap % per) / per;
        return t < 0.62 ? lerp(-0.2, -1.4, t / 0.62) : lerp(-1.4, 1.65, (t - 0.62) / 0.38);
      }
      if (s.act === 'hammer') { const t = (s.ap % 0.45) / 0.45; return t < 0.6 ? lerp(0.2, -0.7, t / 0.6) : lerp(-0.7, 1.4, (t - 0.6) / 0.4); }
      if (s.act === 'harvest') return 1.25 + Math.sin(s.ap * 6) * 0.45;
      if (s.act === 'dig') return 2.5 + Math.sin(s.ap * 5) * 0.35;
      if (s.act === 'fish') return 0.85 + Math.sin(s.ap * 1.4) * 0.08;
      if (s.moving) return -0.4 + Math.sin(s.wp) * 0.08;
      return -0.15;
    }
    /* body-local matrix for an arm hanging from the shoulder at side x, swung by `a` (X) and splayed by `z` (Z) */
    armMatrix(x, a, z) {
      _a.makeRotationX(a); _r.makeRotationZ(z); _a.premultiply(_r);
      _a.setPosition(x, VE.SETTLER_SHOULDER.y, 0);
      return _a;
    }
    render(settlers) {
      let n = 0, nm = 0, nb = 0, nf = 0;
      const tc = {}, ic = {};
      const S = 1.28, T = VE.uTime.value, SX = VE.SETTLER_SHOULDER.x, HIP = VE.SETTLER_HIP;
      for (const s of settlers) {
        if (s.hidden || n >= this.cap) continue;
        let bob = s.moving ? Math.abs(Math.sin(s.wp)) * 0.02 : 0;
        if (s.act === 'sow' || s.act === 'dig') bob = Math.abs(Math.sin(s.ap * 5)) * 0.012;
        _q.setFromAxisAngle(UP, s.rot);
        let lean = 0;
        if (s.act === 'sow') lean = 0.35;
        if (lean) { const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), lean); _q.multiply(q2); }
        _m.compose(_p.set(s.x, s.y + bob, s.z), _q, _s.set(S, S, S));
        // stable per-settler looks: hair, skin tone, trousers, mustache/beard/feather
        const h = Math.imul(s.id + 1, 2654435761) >>> 0;
        const hair = HAIR[h % HAIR.length], skin = SKIN[(h >>> 6) % SKIN.length], pants = PANTS[(h >>> 3) % PANTS.length];
        const role = s.mode === 'build' ? 'builder' : (s.mode === 'work' || s.mode === 'goWork') ? s.role : 'carrier';
        const rc = this.roleCol[role] || this.roleCol.carrier;
        for (const p of [this.torso, this.head, this.hair, this.hat]) p.setMatrixAt(n, _m);
        this.torso.setColorAt(n, rc[0]); this.hat.setColorAt(n, rc[1]); this.hair.setColorAt(n, hair); this.head.setColorAt(n, skin);
        this.armL.setColorAt(n, rc[0]); this.armR.setColorAt(n, rc[0]); this.handL.setColorAt(n, skin); this.handR.setColorAt(n, skin);
        this.legL.setColorAt(n, pants); this.legR.setColorAt(n, pants);
        if ((h >>> 9) % 3 === 0) { this.mustache.setMatrixAt(nm, _m); this.mustache.setColorAt(nm++, hair); }
        if ((h >>> 11) % 5 === 0) { this.beard.setMatrixAt(nb, _m); this.beard.setColorAt(nb++, hair); }
        if ((h >>> 13) % 4 === 0) this.feather.setMatrixAt(nf++, _m);
        // legs
        const sw = s.moving ? Math.sin(s.wp) * 0.75 : 0;
        _l.makeRotationX(sw); _l.setPosition(HIP.x, HIP.y, 0); _o.multiplyMatrices(_m, _l); this.legL.setMatrixAt(n, _o);
        _l.makeRotationX(-sw); _l.setPosition(-HIP.x, HIP.y, 0); _o.multiplyMatrices(_m, _l); this.legR.setMatrixAt(n, _o);
        // arms: R = +x side (tool hand), L = -x side
        let aR, aL, zR = 0.12, zL = -0.12;
        if (s.carry) { aR = aL = -0.95; zR = 0.04; zL = -0.04; }              // hug the load in front of the belly
        else if (s.moving) { aR = -sw * 0.8; aL = sw * 0.8; }                  // swing opposite to the legs
        else {
          const br = Math.sin(T * 1.6 + s.id) * 0.04; aR = -br; aL = br;      // breathing
          if (!s.act && !s.tool && s.mode === 'idle' && Math.sin(T * 0.55 + s.id * 1.7) > 0.6) {
            aL = -2.75 + Math.sin(T * 11 + s.id) * 0.28; zL = -0.5;            // a cheerful wave
          }
        }
        let ta = 0;
        if (s.tool) {
          ta = this.toolAngle(s);
          aR = TOOL_ACTS.has(s.act) ? VE.clamp(-1.2 + 0.45 * ta, -2.2, 0) : (s.moving ? -0.3 - sw * 0.2 : -0.25);
          zR = 0.06;
        }
        const mr = this.armMatrix(SX, aR, zR);
        if (s.tool && this.tools[s.tool]) {
          const tm = this.tools[s.tool]; tc[s.tool] = tc[s.tool] || 0;
          if (tc[s.tool] < 80) {
            _v.set(0, -0.087, 0).applyMatrix4(mr);                              // tool sits in the right hand
            _l.makeRotationX(ta); _l.setPosition(_v.x, _v.y, _v.z + 0.012); _o.multiplyMatrices(_m, _l);
            tm.setMatrixAt(tc[s.tool]++, _o);
          }
        }
        _o.multiplyMatrices(_m, mr); this.armR.setMatrixAt(n, _o); this.handR.setMatrixAt(n, _o);
        _o.multiplyMatrices(_m, this.armMatrix(-SX, aL, zL)); this.armL.setMatrixAt(n, _o); this.handL.setMatrixAt(n, _o);
        if (s.carry && this.items[s.carry]) {
          const im = this.items[s.carry]; ic[s.carry] = ic[s.carry] || 0;
          if (ic[s.carry] < 120) {
            _l.makeRotationY(0.08); _l.setPosition(0, 0.15 + (s.moving ? Math.sin(s.wp * 2) * 0.004 : 0), 0.092); _o.multiplyMatrices(_m, _l);
            im.setMatrixAt(ic[s.carry]++, _o);
          }
        }
        n++;
      }
      for (const p of this.parts) { p.count = n; p.instanceMatrix.needsUpdate = true; p.instanceColor.needsUpdate = true; }
      this.mustache.count = nm; this.beard.count = nb; this.feather.count = nf;
      for (const p of [this.mustache, this.beard, this.feather]) { p.instanceMatrix.needsUpdate = true; p.instanceColor.needsUpdate = true; }
      for (const t in this.tools) { this.tools[t].count = tc[t] || 0; this.tools[t].instanceMatrix.needsUpdate = true; }
      for (const r in this.items) { this.items[r].count = ic[r] || 0; this.items[r].instanceMatrix.needsUpdate = true; }
    }
  }
  VE.SettlerRender = SettlerRender;

  /* ---------------- Stockpiles in the stockyard ---------------- */
  // Item positions per pile (item units, y = item centre), filled in order as the stock grows.
  const PILE_S = 1.7;
  function heap(r, h) {           // round goods: 7 on the ground, 3 on top, 1 crowning
    const out = [{ x: 0, y: h, z: 0 }];
    for (let a = 0; a < 6; a++) out.push({ x: Math.cos(a * 1.047) * r * 1.95, y: h, z: Math.sin(a * 1.047) * r * 1.95, ry: a });
    for (let a = 0; a < 3; a++) out.push({ x: Math.cos(a * 2.094 + 0.5) * r * 1.05, y: h * 2.6, z: Math.sin(a * 2.094 + 0.5) * r * 1.05, ry: a * 2 });
    out.push({ x: 0, y: h * 4.1, z: 0, ry: 1 });
    return out;
  }
  function grid(sp, h, layers) {   // baskets and barrels: 2×2 per layer
    const out = [];
    for (let l = 0; l < layers; l++) for (let q = 0; q < 4; q++) out.push({ x: ((q & 1) - 0.5) * sp, y: h + l * h * 2.6, z: ((q >> 1) - 0.5) * sp, ry: q });
    return out;
  }
  const LAYOUT = {
    log: (() => { const o = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 4 - r; c++) o.push({ x: 0, y: 0.035 + r * 0.061, z: (c - (3 - r) / 2) * 0.072 }); return o; })(),
    plank: (() => { const o = []; for (let l = 0; l < 6; l++) for (let c = 0; c < 2; c++) o.push(l % 2 ? { x: (c - 0.5) * 0.09, y: 0.02 + l * 0.042, z: 0, ry: Math.PI / 2 } : { x: 0, y: 0.02 + l * 0.042, z: (c - 0.5) * 0.09 }); return o; })(),
    stone: heap(0.055, 0.045), grain: heap(0.06, 0.066), flour: heap(0.06, 0.066),
    bread: heap(0.058, 0.038), fish: heap(0.05, 0.034),
    grape: grid(0.13, 0.03, 2), wine: grid(0.11, 0.04, 2)
  };
  // a fixed spot for every good inside the 2×2 yard (yard-local x/z)
  const SLOT = { log: [-0.55, -0.55], stone: [0, -0.55], plank: [0.55, -0.55], grain: [-0.55, 0], flour: [0, 0], bread: [0.55, 0], fish: [-0.55, 0.5], grape: [0, 0.5], wine: [0.55, 0.5] };
  // 1 item per unit for small stocks, then the pile grows more slowly until it is full
  const visCount = (s, cap) => s <= 0 ? 0 : Math.min(cap, s <= 6 ? Math.ceil(s) : 6 + Math.ceil((s - 6) / 4));

  // Uitvoervoorraad bij productiebedrijven: dezelfde stapels, kleiner, op de 'pile'-plek van het model.
  const PILE_B = 0.85, PROD_CAP = 640;   // max. items per goed over alle bedrijven samen

  class StockpileRender {
    constructor(root) {
      const mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 5, specular: 0x111111 });
      this.meshes = {};
      for (const r of VE.RES_ORDER) {
        const n = LAYOUT[r].length * 2 + PROD_CAP;
        const m = new THREE.InstancedMesh(VE.itemGeo(r), mat, n);
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3); // see VE-001
        m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
        root.add(m); this.meshes[r] = m;
      }
      this.sig = '';
    }
    update(game) {
      const yards = game.buildings.filter(b => b.alive && b.built && b.type === 'yard').slice(0, 2);
      const counts = VE.RES_ORDER.map(r => visCount(game.stock[r] || 0, LAYOUT[r].length));
      // productiebedrijven: elk stuk in de uitvoervoorraad (b.output) is één item op de stapel.
      // Leeg = geen stapel; vol (= de werker wacht op dragers) = volle stapel.
      const prod = [];
      let psig = '';
      for (const b of game.buildings) {
        if (!b.alive || !b.built || !b.def.out) continue;
        let any = false; for (const r in b.output) if (b.output[r] > 0) { any = true; psig += b.id + r + b.output[r] + ','; }
        if (!any) continue;
        const md = VE.buildModel(b.type, b.level), spot = md.pile || (VE.PILE_SPOT && VE.PILE_SPOT[b.type]);
        if (spot) { prod.push({ b: b, spot: spot }); psig += b.level + ':' + b.y.toFixed(2) + (md.pile ? 'g' : 'p') + ';'; }
      }
      // bouwplaatsen: geleverde maar nog niet verbouwde materialen liggen op de grond. De bouwer verbruikt
      // ze één voor één (b.used); het laatste stuk verdwijnt precies als het gebouw klaar is.
      const sites = [];
      for (const b of game.buildings) {
        if (!b.alive || b.built || !b.def.cost) continue;
        let u = b.used || 0;
        const rem = {};
        let any = false;
        for (const r of Object.keys(b.def.cost)) {
          const del = b.delivered[r] || 0, take = Math.min(del, u);
          u -= take;
          if (del - take > 0) { rem[r] = del - take; any = true; psig += 's' + b.id + r + rem[r] + ','; }
        }
        if (any) { sites.push({ b: b, rem: rem }); psig += b.y.toFixed(2) + ';'; }
      }
      const sig = yards.map(b => b.id + ':' + b.y.toFixed(2)).join(',') + '|' + counts.join(',') + '|' + psig;
      if (sig === this.sig) return;
      this.sig = sig;
      VE.RES_ORDER.forEach((r, ri) => {
        const mesh = this.meshes[r], lay = LAYOUT[r], sl = SLOT[r], capN = mesh.instanceMatrix.count;
        let n = 0;
        for (const b of yards) for (let q = 0; q < counts[ri]; q++) {
          const p = lay[q], jit = ((q * 37 + ri * 11) % 7 - 3) * 0.012;  // a little untidiness
          _q.setFromAxisAngle(UP, (p.ry || 0) + jit);
          _m.compose(_p.set(b.cx + sl[0] + p.x * PILE_S, b.y + 0.07 + p.y * PILE_S, b.cz + sl[1] + p.z * PILE_S), _q, _s.set(PILE_S, PILE_S, PILE_S));
          mesh.setMatrixAt(n++, _m);
        }
        for (const pr of prod) {
          const b = pr.b, amt = Math.min(lay.length, Math.ceil(b.output[r] || 0));
          for (let q = 0; q < amt && n < capN; q++) {
            const p = lay[q], jit = ((q * 37 + b.id * 13) % 7 - 3) * 0.015;
            _q.setFromAxisAngle(UP, (p.ry || 0) + jit);
            _m.compose(_p.set(b.cx + pr.spot[0] + p.x * PILE_B, b.y + pr.spot[1] + p.y * PILE_B, b.cz + pr.spot[2] + p.z * PILE_B), _q, _s.set(PILE_B, PILE_B, PILE_B));
            mesh.setMatrixAt(n++, _m);
          }
        }
        for (const st of sites) {
          const amt = Math.min(lay.length, st.rem[r] || 0);
          if (!amt) continue;
          // eerste materiaal links vooraan op de bouwplaats, tweede rechts vooraan
          // vaste kant per materiaal (volgorde in de bouwkosten), zodat een stapel niet verspringt
          // vóór de steiger (loopplank op z≈0.41), links en rechts van de ingang: zichtbaar vanuit de
          // gebruikelijke camerahoek en het deurpad blijft vrij. 2×2: naast de steiger (palen op ±0.8).
          const b = st.b, side = Object.keys(b.def.cost).indexOf(r) % 2 ? 1 : -1, e = b.size > 1 ? 0.88 : 0.27, f = b.size > 1 ? 0.5 : 0.47;
          for (let q = 0; q < amt && n < capN; q++) {
            const p = lay[q], jit = ((q * 29 + b.id * 7) % 7 - 3) * 0.015;
            _q.setFromAxisAngle(UP, (p.ry || 0) + jit);
            _m.compose(_p.set(b.cx + side * e + p.x * PILE_B, b.y + 0.02 + p.y * PILE_B, b.cz + f + p.z * PILE_B), _q, _s.set(PILE_B, PILE_B, PILE_B));
            mesh.setMatrixAt(n++, _m);
          }
        }
        mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
      });
    }
  }
  VE.StockpileRender = StockpileRender;

  /* ---------------- particles ---------------- */
  class Puffs {
    constructor(root, color, cap, opacity, detail) {
      this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, detail === undefined ? 2 : detail),
        new THREE.MeshLambertMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false }), cap);
      this.mesh.count = 0; this.mesh.frustumCulled = false; this.cap = cap; this.list = [];
      root.add(this.mesh);
    }
    emit(p) { if (this.list.length >= this.cap) this.list.shift(); p.age = 0; this.list.push(p); }
    update(dt) {
      let n = 0;
      const keep = [];
      for (const p of this.list) {
        p.age += dt; if (p.age >= p.life) continue;
        keep.push(p);
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.g) p.vy -= p.g * dt;
        const t = p.age / p.life;
        let s = VE.lerp(p.s0, p.s1, Math.sqrt(t));
        if (t > 0.75) s *= (1 - t) / 0.25;
        _q.identity();
        _m.compose(_p.set(p.x, p.y, p.z), _q, _s.set(s, s * (p.sy || 1), s));
        this.mesh.setMatrixAt(n++, _m);
      }
      this.list = keep;
      this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  class FX {
    constructor(root, game) {
      this.root = root; this.game = game;
      this.smoke = new Puffs(root, 0xf3f1ec, 260, 0.6, 2);
      this.dust = new Puffs(root, 0xcdb88e, 160, 0.7, 1);
      this.leaves = new Puffs(root, 0x5aa83a, 120, 1.0, 0);
      this.splash = new Puffs(root, 0xe8f6ff, 80, 0.85, 0);
      const bus = VE.bus;
      this.handlers = {
        smoke: e => this.smoke.emit({ x: e.x + (Math.random() - 0.5) * 0.03, y: e.y, z: e.z, vx: 0.12 + Math.random() * 0.05, vy: 0.32 + Math.random() * 0.1, vz: -0.05, life: 3.2, s0: 0.05, s1: 0.2 }),
        dust: e => { for (let i = 0; i < (e.n || 8); i++) { const a = Math.random() * 6.28, sp = 0.4 + Math.random() * 0.6; this.dust.emit({ x: e.x + Math.cos(a) * 0.3, y: e.y + 0.1, z: e.z + Math.sin(a) * 0.3, vx: Math.cos(a) * sp, vy: 0.25 + Math.random() * 0.3, vz: Math.sin(a) * sp, life: 1.1 + Math.random() * 0.5, s0: 0.06, s1: 0.2 }); } },
        leaves: e => { for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28; this.leaves.emit({ x: e.x, y: e.y, z: e.z, vx: Math.cos(a) * 0.6, vy: 0.6 + Math.random() * 0.5, vz: Math.sin(a) * 0.6, g: 1.4, life: 1.4, s0: 0.03, s1: 0.035, sy: 0.4 }); } },
        splash: e => { for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28; this.splash.emit({ x: e.x, y: 0.03, z: e.z, vx: Math.cos(a) * 0.4, vy: 0.9 + Math.random() * 0.5, vz: Math.sin(a) * 0.4, g: 4, life: 0.6, s0: 0.025, s1: 0.03 }); } }
      };
      for (const k in this.handlers) bus.on(k, a => { if (this.game === VE.game) this.handlers[k](a); });
      this.makeBirds(); this.makeClouds(); this.makeButterflies();
    }
    makeBirds() {
      const g = VE.birdGeo();
      const mat = new THREE.MeshPhongMaterial({ vertexColors: true });
      const n = 14;
      this.birdBody = new THREE.InstancedMesh(g.body, mat, n);
      this.birdWing = new THREE.InstancedMesh(g.wing, mat, n * 2);
      this.birdBody.frustumCulled = this.birdWing.frustumCulled = false;
      this.birdBody.castShadow = this.birdWing.castShadow = true;
      this.root.add(this.birdBody); this.root.add(this.birdWing);
      this.birds = [];
      const N = VE.N;
      for (let f = 0; f < 3; f++) {
        const cx = 12 + Math.random() * (N - 24), cz = 12 + Math.random() * (N - 24), r = 6 + Math.random() * 8, h = 5 + Math.random() * 3, sp = (0.12 + Math.random() * 0.08) * (Math.random() < 0.5 ? 1 : -1);
        for (let i = 0; i < 4 + f; i++) this.birds.push({ cx: cx, cz: cz, r: r + (Math.random() - 0.5) * 1.2, h: h + (Math.random() - 0.5) * 0.8, a: Math.random() * 0.8 + f, sp: sp, fl: Math.random() * 6, drift: Math.random() * 6 });
      }
      this.birdBody.count = this.birds.length; this.birdWing.count = this.birds.length * 2;
    }
    makeClouds() {
      this.clouds = [];
      const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9a9a9a, transparent: true, opacity: 0.9 });
      const N = VE.N;
      for (let c = 0; c < 8; c++) {
        const m = new VE.Model(60 + c);
        const k = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < k; i++) m.ball(0.8 + Math.random() * 0.9, 0xffffff, { x: i * 1.0 - k * 0.5, y: Math.random() * 0.4, z: (Math.random() - 0.5) * 1.2, sy: 0.65, j: 0.03 }, 1);
        const mesh = new THREE.Mesh(m.build(), mat);
        mesh.position.set(Math.random() * (N + 30) - 15, 11 + Math.random() * 4, Math.random() * (N + 10) - 5);
        const s = 0.8 + Math.random() * 0.8; mesh.scale.set(s, s, s);
        this.root.add(mesh);
        this.clouds.push({ mesh: mesh, sp: 0.25 + Math.random() * 0.2 });
      }
    }
    makeButterflies() {
      const geo = new THREE.PlaneGeometry(0.075, 0.06); geo.translate(0.0375, 0, 0); geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
      const n = 14;
      this.bfL = new THREE.InstancedMesh(geo, mat, n); this.bfR = new THREE.InstancedMesh(geo, mat, n);
      const cols = [0xffd84a, 0xffffff, 0xff9f43, 0x9ad0ff, 0xf78fb3];
      this.bf = [];
      for (let i = 0; i < n; i++) {
        const c = _c.setHex(cols[i % cols.length]); this.bfL.setColorAt(i, c); this.bfR.setColorAt(i, c);
        this.bf.push({ x: 0, z: 0, y: 0.4, tx: 0, tz: 0, hx: 0, hz: 0, ph: Math.random() * 6, rot: 0, t: 0 });
      }
      this.bfL.frustumCulled = this.bfR.frustumCulled = false;
      this.root.add(this.bfL); this.root.add(this.bfR);
      this.bfReady = false;
    }
    placeButterflies() {
      const w = this.game.world, N = VE.N, hq = this.game.hq;
      for (const b of this.bf) {
        for (let t = 0; t < 30; t++) {
          const i = Math.floor(hq.cx + (Math.random() - 0.5) * 18), j = Math.floor(hq.cz + (Math.random() - 0.5) * 18);
          if (!w.inb(i, j)) continue;
          if (w.decoF[j * N + i] || t > 25) { b.hx = b.x = b.tx = i + 0.5; b.hz = b.z = b.tz = j + 0.5; break; }
        }
      }
      this.bfReady = true;
    }
    update(dt, t) {
      this.smoke.update(dt); this.dust.update(dt); this.leaves.update(dt); this.splash.update(dt);
      // birds
      let n = 0;
      for (const b of this.birds) {
        b.a += b.sp * dt; b.fl += dt * (9 + Math.sin(t * 0.7 + b.drift) * 3);
        const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r, y = b.h + Math.sin(t * 0.5 + b.drift) * 0.4;
        const heading = Math.atan2(-Math.sin(b.a) * Math.sign(b.sp), Math.cos(b.a) * Math.sign(b.sp));
        _q.setFromAxisAngle(UP, heading);
        _m.compose(_p.set(x, y, z), _q, _s.set(1.3, 1.3, 1.3));
        this.birdBody.setMatrixAt(n, _m);
        const fl = Math.sin(b.fl) * 0.7;
        _l.makeRotationZ(fl); _l.setPosition(0.02, 0.0, 0); _o.multiplyMatrices(_m, _l); this.birdWing.setMatrixAt(n * 2, _o);
        _l.makeRotationY(Math.PI); const r2 = new THREE.Matrix4().makeRotationZ(-fl); _l.premultiply(r2); _l.setPosition(-0.02, 0.0, 0); _o.multiplyMatrices(_m, _l); this.birdWing.setMatrixAt(n * 2 + 1, _o);
        n++;
      }
      this.birdBody.instanceMatrix.needsUpdate = true; this.birdWing.instanceMatrix.needsUpdate = true;
      // clouds
      for (const c of this.clouds) {
        c.mesh.position.x += c.sp * dt;
        if (c.mesh.position.x > VE.N + 18) c.mesh.position.x = -18;
      }
      // butterflies
      if (!this.bfReady && this.game.hq) this.placeButterflies();
      const w = this.game.world;
      n = 0;
      for (const b of this.bf) {
        b.t -= dt;
        if (b.t <= 0) { b.t = 1.5 + Math.random() * 3; b.tx = b.hx + (Math.random() - 0.5) * 3; b.tz = b.hz + (Math.random() - 0.5) * 3; }
        const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
        if (d > 0.05) { b.x += dx / d * dt * 0.45; b.z += dz / d * dt * 0.45; b.rot = Math.atan2(dx, dz); }
        b.ph += dt * 18;
        const y = w.heightAt(b.x, b.z) + 0.35 + Math.sin(t * 2 + b.hx) * 0.12;
        _q.setFromAxisAngle(UP, b.rot);
        _m.compose(_p.set(b.x, y, b.z), _q, _s.set(1, 1, 1));
        const f = Math.sin(b.ph) * 1.1;
        _l.makeRotationZ(f); _o.multiplyMatrices(_m, _l); this.bfL.setMatrixAt(n, _o);
        _l.makeRotationZ(Math.PI - f); _o.multiplyMatrices(_m, _l); this.bfR.setMatrixAt(n, _o);
        n++;
      }
      this.bfL.instanceMatrix.needsUpdate = true; this.bfR.instanceMatrix.needsUpdate = true;
    }
  }
  VE.FX = FX;
})(window.VE);
