/* Village Empire — © 2026 Brakeco Games. All rights reserved. */
'use strict';
(function (VE) {
  const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _o = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  const UP = new THREE.Vector3(0, 1, 0), XAX = new THREE.Vector3(1, 0, 0), _qx = new THREE.Quaternion();
  /* draaiing van een stapel-item: om de verticale as (ry), optioneel naar binnen leunend (lean, schoven) */
  const pileRot = (p, jit) => { _q.setFromAxisAngle(UP, (p.ry || 0) + jit); if (p.lean) _q.multiply(_qx.setFromAxisAngle(XAX, -p.lean)); return _q; };
  const _a = new THREE.Matrix4(), _r = new THREE.Matrix4(), _v = new THREE.Vector3();
  // settler variety (multiplied with the white / skin vertex colours)
  const HAIR = [0x6b4423, 0x2e2018, 0xd9a441, 0xb8582a, 0xb3aea6].map(c => new THREE.Color(c));
  const SKIN = [0xffffff, 0xf2dfcc, 0xd9b49a, 0xb8896a].map(c => new THREE.Color(c));
  const PANTS = [0x5a4030, 0x4a566c, 0x6e5c3a, 0x44503a].map(c => new THREE.Color(c));
  const TOOL_ACTS = new Set(['chop', 'pick', 'hammer', 'harvest', 'dig', 'fish', 'hoe']);

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
      for (const t of ['axe', 'hammer', 'pick', 'spade', 'hoe', 'scythe', 'sickle', 'rod', 'net']) this.tools[t] = mk(VE.toolGeo(t), 80, true);
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
            _l.makeRotationY(0.08); _l.scale(_s.set(VE.ITEM_SCALE, VE.ITEM_SCALE, VE.ITEM_SCALE)); _l.setPosition(0, 0.15 + (s.moving ? Math.sin(s.wp * 2) * 0.004 : 0), 0.092); _o.multiplyMatrices(_m, _l);
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

  /* ---------------- Voorraadstapels ----------------
     Elk stuk in een opslag is één item op een nette stapel (InstancedMesh per goed, één draw call per goed):
       - startstapel naast het dorpshuis (vakken op pallets, 'slot'-markers uit yard.glb);
       - Storehouses (vakken in de open loods, 'slot'-markers uit warehouse.glb, per level meer vakken);
       - producenten: hun lokale voorraad (max. VE.LOCAL_CAP) op de 'pile'-plek van het model; meer soorten
         naast elkaar; wapens van de wapensmederij rechtop in het wapenrek ('rack');
       - werkplaatsen: aangeleverde grondstoffen (b.input) op eigen stapels ('in0', 'in1' … of VE.IN_SPOT);
       - bouwplaatsen (nieuwbouw en upgrades): geleverde maar nog niet verbouwde materialen.
     Posities in item-eenheden (y = midden van het item). Gehakte stenen zijn identieke rechthoekige
     blokken (0,09 × 0,05 × 0,06) die in een strak verband liggen: 3 × 2 per laag. */
  function heap(r, h) {           // ronde goederen: 7 onderop, 3 erop, 1 als kroon
    const out = [{ x: 0, y: h, z: 0 }];
    for (let a = 0; a < 6; a++) out.push({ x: Math.cos(a * 1.047) * r * 1.95, y: h, z: Math.sin(a * 1.047) * r * 1.95, ry: a });
    for (let a = 0; a < 3; a++) out.push({ x: Math.cos(a * 2.094 + 0.5) * r * 1.05, y: h * 2.6, z: Math.sin(a * 2.094 + 0.5) * r * 1.05, ry: a * 2 });
    out.push({ x: 0, y: h * 4.1, z: 0, ry: 1 });
    return out;
  }
  function grid(sp, h, layers) {   // manden, vaten en zakken: 2×2 per laag
    const out = [];
    for (let l = 0; l < layers; l++) for (let q = 0; q < 4; q++) out.push({ x: ((q & 1) - 0.5) * sp, y: h + l * h * 2, z: ((q >> 1) - 0.5) * sp, ry: (q & 1) * Math.PI });
    return out;
  }
  function stookLayout() {         // schoven: rechtop in het midden, ringen eromheen die naar binnen leunen (hok)
    const out = [{ x: 0, y: 0.07, z: 0 }];
    for (let a = 0; a < 6; a++) out.push({ x: Math.sin(a * 1.047) * 0.06, y: 0.066, z: Math.cos(a * 1.047) * 0.06, ry: a * 1.047, lean: 0.3 });
    for (let a = 0; a < 5; a++) out.push({ x: Math.sin(a * 1.257 + 0.5) * 0.12, y: 0.058, z: Math.cos(a * 1.257 + 0.5) * 0.12, ry: a * 1.257 + 0.5, lean: 0.45 });
    return out;
  }
  // bouwstenen: allemaal precies even groot (VE.STONE_BLOCK), strak gestapeld met een voeg van 3 mm
  const SB = VE.STONE_BLOCK || [0.09, 0.05, 0.06];
  function blocks() {
    const o = [], g = 0.003;
    for (let l = 0; l < 2; l++) for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++)
      o.push({ x: (c - 1) * (SB[0] + g), y: SB[1] / 2 + l * (SB[1] + g), z: (r - 0.5) * (SB[2] + g) });
    return o;
  }
  function bars() {               // metaalstaven: kruiselings gestapeld
    const o = [];
    for (let l = 0; l < 4; l++) for (let c = 0; c < 3; c++) o.push(l % 2 ? { x: (c - 1) * 0.045, y: 0.012 + l * 0.032, z: 0, ry: Math.PI / 2 } : { x: 0, y: 0.012 + l * 0.032, z: (c - 1) * 0.045 });
    return o;
  }
  const LAYOUT = {
    log: (() => { const o = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 4 - r; c++) o.push({ x: 0, y: 0.035 + r * 0.061, z: (c - (3 - r) / 2) * 0.072 }); return o; })(),
    plank: (() => { const o = []; for (let l = 0; l < 6; l++) for (let c = 0; c < 2; c++) o.push(l % 2 ? { x: (c - 0.5) * 0.09, y: 0.02 + l * 0.042, z: 0, ry: Math.PI / 2 } : { x: 0, y: 0.02 + l * 0.042, z: (c - 0.5) * 0.09 }); return o; })(),
    stone: blocks(), grain: stookLayout(), flour: grid(0.115, 0.06, 3),
    bread: heap(0.058, 0.038), fish: heap(0.05, 0.034),
    grape: grid(0.13, 0.03, 2), wine: grid(0.11, 0.055, 2),
    meat: heap(0.06, 0.04), coal: heap(0.055, 0.04), ironore: heap(0.058, 0.045), copperore: heap(0.058, 0.045), goldore: heap(0.058, 0.045),
    ironbar: bars(), copperbar: bars(), goldbar: bars(),
    // wapens: plat, netjes naast en op elkaar (lengte langs x)
    sword: rows(3, 0.078, 4, 0.016), spear: rows(4, 0.036, 3, 0.016), battleaxe: rows(3, 0.12, 3, 0.017),
    dagger: (() => { const o = []; for (let l = 0; l < 2; l++) for (let c = 0; c < 2; c++) for (let r = 0; r < 3; r++) o.push({ x: (c - 0.5) * 0.15, y: 0.008 + l * 0.014, z: (r - 1) * 0.048, ry: c ? Math.PI : 0 }); return o; })(),
    bow: rows(3, 0.03, 3, 0.014), crossbow: rows(1, 0, 8, 0.024)
  };
  function rows(n, sp, layers, h) {   // n wapens naast elkaar per laag, `layers` lagen
    const o = [];
    for (let l = 0; l < layers; l++) for (let c = 0; c < n; c++) o.push({ x: 0, y: h / 2 + l * h, z: (c - (n - 1) / 2) * sp, ry: (l % 2) * Math.PI });
    return o;
  }
  VE.PILE_LAYOUT = LAYOUT;
  // hoogte van één volle stapel: past een goed niet in zijn vakken, dan komt er een tweede laag stapel bovenop
  const LAYER_H = {};
  for (const r in LAYOUT) { let lo = 1, hi = 0; for (const p of LAYOUT[r]) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); } LAYER_H[r] = hi + lo; }
  const NEAT = new Set(['stone', 'plank', 'log', 'ironbar', 'copperbar', 'goldbar', 'flour', 'wine', 'grape', 'sword', 'spear', 'battleaxe', 'dagger', 'bow', 'crossbow']);   // strak gestapeld: geen schuine stukken

  // één schaal voor alle goederen in de wereld (stapels én lading van dragers): elk stuk is overal even groot
  const PILE_B = VE.ITEM_SCALE;
  const INST = 1400;                      // max. items per goed in de hele wereld

  /* vakken toewijzen per opslag: elk goed houdt zijn vak(ken) zolang het er ligt (stapels springen niet) */
  function allocSlots(b, nSlots, counts) {
    const A = b._slots || (b._slots = {}), used = new Set();
    const need = r => counts[r] > 0 ? Math.ceil(counts[r] / LAYOUT[r].length) : 0;
    for (const r in A) {
      A[r] = A[r].filter(i => i < nSlots).slice(0, need(r));
      if (!A[r].length) delete A[r]; else for (const i of A[r]) used.add(i);
    }
    const free = () => { for (let i = 0; i < nSlots; i++) if (!used.has(i)) { used.add(i); return i; } return -1; };
    for (const r of VE.RES_ORDER) if (need(r) && !A[r]) { const i = free(); if (i < 0) break; A[r] = [i]; }      // eerst elk goed één vak
    for (const r of VE.RES_ORDER) while (A[r] && A[r].length < need(r)) { const i = free(); if (i < 0) break; A[r].push(i); }
    return A;
  }

  /* wapenrek: RACK_N gleuven naast elkaar; zwaarden en dolken met de punt omlaag, de rest met de kop omhoog,
     licht achterover tegen de bovenste regel. Items liggen in hun model plat met de lengte langs x (punt +x). */
  const RACK_N = 6, RACK_SP = 0.05, RACK_LEAN = 0.16;
  const SIDE = [0, -0.15, 0.15, -0.3];                                  // x-verschuiving per extra soort op de uitvoerplek
  const _rp = new THREE.Vector3(), _rw = new THREE.Vector3(), _rb = new THREE.Matrix4(), _rq = new THREE.Quaternion();
  const _ax = new THREE.Vector3(), _ay = new THREE.Vector3(), _az = new THREE.Vector3(), _RX = new THREE.Vector3(1, 0, 0), _RY = new THREE.Vector3(0, 1, 0);
  const TIP_DOWN = { sword: true, dagger: true }, _ext = {};
  VE.RACK_N = RACK_N;
  function rackPose(r, k, rack) {
    const down = TIP_DOWN[r];
    if (!_ext[r] || _ext[r].ver !== VE.itemGeoVer) {
      const g = VE.itemGeo(r); g.computeBoundingBox();
      _ext[r] = { lo: g.boundingBox.min.x, hi: g.boundingBox.max.x, ver: VE.itemGeoVer };
    }
    // lengte (x) wordt verticaal, platte kant (y) naar voren (+z)
    if (down) _rb.makeBasis(_ax.set(0, -1, 0), _ay.set(0, 0, 1), _az.set(-1, 0, 0));
    else _rb.makeBasis(_ax.set(0, 1, 0), _ay.set(0, 0, 1), _az.set(1, 0, 0));
    _q.setFromRotationMatrix(_rb);
    _rq.setFromAxisAngle(_RX, -RACK_LEAN); _q.premultiply(_rq);
    const e = _ext[r], foot = (down ? e.hi : -e.lo) * PILE_B;            // onderkant van het wapen op de voetplank
    const rot = rack[3] || 0;                                            // draaiing van het rek om y
    const lx = (k - (RACK_N - 1) / 2) * RACK_SP, ly = foot * Math.cos(RACK_LEAN), lz = -foot * Math.sin(RACK_LEAN);
    _rp.set(Math.cos(rot) * lx + Math.sin(rot) * lz, ly, -Math.sin(rot) * lx + Math.cos(rot) * lz);
    if (rot) { _rq.setFromAxisAngle(_RY, rot); _q.premultiply(_rq); }
  }

  class StockpileRender {
    constructor(root) {
      const mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 5, specular: 0x111111 });
      this.meshes = {};
      for (const r of VE.RES_ORDER) {
        const m = new THREE.InstancedMesh(VE.itemGeo(r), mat, INST);
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(INST * 3).fill(1), 3); // see VE-001
        m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
        m.userData.item = r; m.name = 'pile_' + r;
        root.add(m); this.meshes[r] = m;
      }
      this.sig = ''; this.gv = VE.itemGeoVer || 0;
    }
    /* vakken van een opslag (game-lokaal x, y, z): uit het Blender-model, anders de procedurele reserve */
    slotsOf(b) {
      const md = VE.buildModel(b.type, b.level);
      return (md.slots && md.slots.length ? md.slots : (VE.STORE_SLOTS && VE.STORE_SLOTS[b.type] && VE.STORE_SLOTS[b.type][b.level - 1])) || [];
    }
    update(game) {
      // itemmodellen uit Blender later binnen: geometrie verwisselen
      if ((VE.itemGeoVer || 0) !== this.gv) { this.gv = VE.itemGeoVer; for (const r in this.meshes) this.meshes[r].geometry = VE.itemGeo(r); this.sig = ''; }
      let sig = '';
      const stores = [];
      for (const b of game.buildings) {
        if (!b.alive || !b.built || !b.store || !(b.def.pile || b.def.depot)) continue;
        let any = false; for (const r in b.store) if (b.store[r] > 0) { any = true; sig += b.id + r + b.store[r] + ','; }
        if (!any) { b._slots = null; continue; }
        const slots = this.slotsOf(b);
        if (!slots.length) continue;
        stores.push({ b: b, slots: slots, A: allocSlots(b, slots.length, b.store), sc: PILE_B });
        sig += b.level + ':' + b.y.toFixed(2) + (slots.g ? 'g' : '') + slots.length + ';';
      }
      // productiebedrijven: elk stuk in de uitvoervoorraad (b.output) is één item op de stapel
      const prod = [];
      for (const b of game.buildings) {
        if (!b.alive || !b.built || b.store || !b.output) continue;
        let any = false; for (const r in b.output) if (b.output[r] > 0) { any = true; sig += b.id + r + b.output[r] + ','; }
        if (!any) continue;
        const md = VE.buildModel(b.type, b.level), spot = md.pile || (VE.PILE_SPOT && VE.PILE_SPOT[b.type]);
        const rack = md.rack || (VE.RACK_SPOT && VE.RACK_SPOT[b.type]) || null, rackAt = {};
        if (rack) { let k = 0; for (const r of VE.WEAPONS) { rackAt[r] = k; k += b.output[r] || 0; } }
        // meer soorten in de uitvoer (bijv. na het wisselen van recept): elk goed een eigen stapel ernaast
        const side = {}; let si = 0;
        for (const r of VE.RES_ORDER) if (b.output[r] > 0 && !(rack && VE.RES[r].weapon === true)) side[r] = SIDE[Math.min(si++, SIDE.length - 1)];
        if (spot) { prod.push({ b: b, spot: spot, rack: rack, rackAt: rackAt, side: side }); sig += b.level + ':' + b.y.toFixed(2) + (md.pile ? 'g' : 'p') + (md.rack ? 'r' : '') + ';'; }
      }
      // werkplaatsen: aangeleverde grondstoffen (b.input) liggen op eigen stapels naast het gebouw ('in0'..
      // markers uit Blender, anders VE.IN_SPOT); vaste volgorde per goed, dus een stapel springt nooit
      const ins = [];
      for (const b of game.buildings) {
        if (!b.alive || !b.built || b.store || !b.input || b.def.market) continue;
        const keys = VE.RES_ORDER.filter(r => b.input[r] > 0);
        if (!keys.length) continue;
        const md = VE.buildModel(b.type, b.level), spots = (md.inp && md.inp.length ? md.inp : VE.IN_SPOT && VE.IN_SPOT[b.type]) || null;
        if (!spots) continue;
        const at = {};
        keys.forEach((r, i) => { if (i < spots.length) { at[r] = spots[i]; sig += 'i' + b.id + r + b.input[r] + ','; } });
        ins.push({ b: b, at: at }); sig += b.level + ':' + b.y.toFixed(2) + (md.inp ? 'g' : 'p') + ';';
      }
      // bouwplaatsen: geleverde maar nog niet verbouwde materialen liggen op de grond. De bouwer verbruikt
      // ze één voor één (used); het laatste stuk verdwijnt precies als het gebouw (of de upgrade) klaar is.
      const sites = [];
      for (const b of game.buildings) {
        const S = !b.alive ? null : !b.built ? (b.def.cost ? b : null) : b.up;
        if (!S) continue;
        const cost = S.cost || b.def.cost;
        let u = S.used || 0;
        const rem = {};
        let any = false;
        for (const r of Object.keys(cost)) {
          const del = S.delivered[r] || 0, take = Math.min(del, u);
          u -= take;
          if (del - take > 0) { rem[r] = del - take; any = true; sig += 's' + b.id + r + rem[r] + ','; }
        }
        if (any) { sites.push({ b: b, rem: rem, keys: Object.keys(cost), up: S !== b }); sig += b.y.toFixed(2) + (S !== b ? 'u' : '') + ';'; }
      }
      if (sig === this.sig) return;
      this.sig = sig;
      VE.RES_ORDER.forEach((r, ri) => {
        const mesh = this.meshes[r], lay = LAYOUT[r], L = lay.length, neat = NEAT.has(r);
        let n = 0;
        const put = (b, ox, oy, oz, sc, q, seed) => {
          if (n >= INST) return;
          oy += Math.floor(q / L) * LAYER_H[r] * sc; q %= L;
          const p = lay[q], jit = neat ? 0 : ((q * 37 + seed * 13) % 7 - 3) * 0.012;
          pileRot(p, jit);
          // het vak draait mee met het gebouw (alle gebouwen staan recht, deur naar +z)
          _m.compose(_p.set(b.cx + ox + p.x * sc, b.y + oy + p.y * sc, b.cz + oz + p.z * sc), _q, _s.set(sc, sc, sc));
          mesh.setMatrixAt(n++, _m);
        };
        for (const st of stores) {
          const S = st.A[r]; if (!S) continue;
          // gelijk verdeeld over de vakken van dit goed; meer dan één stapel per vak: hoger stapelen (max. 3 lagen)
          let left = st.b.store[r] || 0;
          const per = Math.min(L * 3, Math.ceil(left / S.length));
          for (let k = 0; k < S.length && left > 0; k++) {
            const sl = st.slots[S[k]], amt = Math.min(per, left);
            for (let q = 0; q < amt; q++) put(st.b, sl[0], sl[1], sl[2], st.sc, q, st.b.id + k);
            left -= amt;
          }
        }
        const weapon = VE.RES[r].weapon === true;
        for (const pr of prod) {
          const b = pr.b; let amt = Math.ceil(b.output[r] || 0);
          if (!amt) continue;
          if (weapon && pr.rack) {
            // wapenrek: elk wapen rechtop in zijn eigen gleuf (gleuf = volgorde over alle wapens samen)
            for (let q = 0; q < amt && n < INST; q++) {
              const k = pr.rackAt[r] + q; if (k >= RACK_N) break;
              rackPose(r, k, pr.rack);
              _m.compose(_rw.set(b.cx + pr.rack[0] + _rp.x, b.y + pr.rack[1] + _rp.y, b.cz + pr.rack[2] + _rp.z), _q, _s.set(PILE_B, PILE_B, PILE_B));
              mesh.setMatrixAt(n++, _m);
            }
            continue;
          }
          amt = Math.min(L, amt);
          const ox = pr.side[r] || 0;
          for (let q = 0; q < amt; q++) put(b, pr.spot[0] + ox, pr.spot[1], pr.spot[2], PILE_B, q, b.id);
        }
        for (const it of ins) {
          const sp = it.at[r]; if (!sp) continue;
          const amt = Math.min(L * 2, it.b.input[r]);
          for (let q = 0; q < amt; q++) put(it.b, sp[0], sp[1], sp[2], PILE_B, q, it.b.id * 3);
        }
        for (const st of sites) {
          const amt = Math.min(L * 2, st.rem[r] || 0);
          if (!amt) continue;
          // vaste kant per materiaal (volgorde in de kosten), links en rechts van de ingang;
          // bij een upgrade vóór het bestaande gebouw, op de stoep (de deur staat bij grote gebouwen rechts)
          const b = st.b, idx = st.keys.indexOf(r);
          let x, z;
          if (st.up) { x = b.size > 1 ? -0.78 + idx * 0.36 : (idx % 2 ? 0.34 : -0.34); z = b.size / 2 + 0.17 + (b.size > 1 ? 0 : Math.floor(idx / 2) * 0.2); }
          else { x = (idx % 2 ? 1 : -1) * (b.size > 1 ? 0.88 : 0.27); z = b.size > 1 ? 0.5 : 0.47; }
          for (let q = 0; q < amt; q++) put(b, x, 0.02, z, PILE_B, q, b.id * 7);
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

  /* ---------------- Schoorsteenrook ----------------
     Zachte rookwolkjes als camera-gerichte vlakjes met een wolkige alfa-textuur, allemaal in één
     InstancedMesh (één draw call). Elk wolkje stijgt eerst rustig op, wordt dan door een zachte, langzaam
     draaiende wind meegenomen (met wat turbulentie), groeit, draait een beetje en vervaagt vloeiend.
     Soorten: 'home' (dun en licht), 'work' (werkplaats aan het werk), 'heavy' (smelterij, dik en donker),
     'smoulder' (smelterij in rust: af en toe een dun pluimpje). */
  const SMOKE_KIND = {
    home: { s0: 0.08, s1: 0.46, life: 4.6, vy: 0.2, a: 0.62, tint: [0.93, 0.92, 0.9], jitter: 0.015 },
    work: { s0: 0.09, s1: 0.52, life: 4.0, vy: 0.26, a: 0.7, tint: [0.88, 0.87, 0.85], jitter: 0.02 },
    heavy: { s0: 0.13, s1: 0.78, life: 5.2, vy: 0.34, a: 0.85, tint: [0.5, 0.48, 0.46], jitter: 0.03 },
    smoulder: { s0: 0.07, s1: 0.4, life: 3.8, vy: 0.18, a: 0.45, tint: [0.66, 0.64, 0.62], jitter: 0.015 }
  };
  VE.SMOKE_KIND = SMOKE_KIND;
  class Smoke {
    constructor(root, cap) {
      this.cap = cap; this.list = [];
      const geo = new THREE.PlaneGeometry(1, 1);
      const mat = new THREE.ShaderMaterial({
        uniforms: { fogColor: { value: new THREE.Color(0xcfe0e2) }, fogNear: { value: 50 }, fogFar: { value: 115 } },
        transparent: true, depthWrite: false,
        vertexShader: [
          // per wolkje in de instance-matrix: kolom 0 = (schaal, alfa, draaiing, -), kolom 1 = tint, kolom 3 = positie
          'varying vec2 vUv; varying float vA; varying vec3 vT; varying float vDepth; varying float vSeed;',
          'void main() {',
          '  vUv = uv; vA = instanceMatrix[0].y; vT = instanceMatrix[1].xyz; vSeed = instanceMatrix[1].w;',
          '  vec3 c = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;',
          '  float sc = instanceMatrix[0].x, rot = instanceMatrix[0].z;',
          '  float cs = cos(rot), sn = sin(rot);',
          '  vec2 p = vec2(position.x * cs - position.y * sn, position.x * sn + position.y * cs) * sc;',
          '  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);',
          '  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);',
          '  vec4 mv = viewMatrix * vec4(c + right * p.x + up * p.y, 1.0);',
          '  vDepth = -mv.z;',
          '  gl_Position = projectionMatrix * mv;',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;',
          'varying vec2 vUv; varying float vA; varying vec3 vT; varying float vDepth; varying float vSeed;',
          'void main() {',
          // wolkje uit een paar zachte bolletjes (per wolkje anders gelegen): geen harde, identieke ballen
          '  vec2 q = vUv - 0.5; float d = 0.0;',
          '  for (int i = 0; i < 4; i++) {',
          '    float fi = float(i);',
          '    vec2 c = vec2(cos(fi * 2.3 + vSeed), sin(fi * 1.9 + vSeed * 1.3)) * 0.17;',
          '    float r = 0.27 - fi * 0.025;',
          '    d = max(d, smoothstep(r, r * 0.15, length(q - c)));',
          '  }',
          '  float a = d * smoothstep(0.5, 0.3, length(q)) * vA;',
          '  if (a < 0.004) discard;',
          '  vec3 col = vT * (0.86 + 0.14 * vUv.y);',                          // bovenkant iets lichter (zonlicht)
          '  col = mix(col, fogColor, smoothstep(fogNear, fogFar, vDepth));',
          '  gl_FragColor = vec4(col, a);',
          '}'
        ].join('\n')
      });
      this.mesh = new THREE.InstancedMesh(geo, mat, cap);
      this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 4; this.mesh.name = 'smoke';
      root.add(this.mesh);
      this.windA = Math.random() * 6.28; this.t = 0;
    }
    emit(e) {
      const K = SMOKE_KIND[e.kind] || SMOKE_KIND.home;
      if (this.list.length >= this.cap) this.list.shift();
      const r = Math.random;
      this.list.push({ x: e.x + (r() - 0.5) * K.jitter, y: e.y + 0.02, z: e.z + (r() - 0.5) * K.jitter, vx: 0, vy: K.vy * (0.8 + r() * 0.4), vz: 0,
        age: 0, life: K.life * (0.8 + r() * 0.4), s0: K.s0 * (0.8 + r() * 0.4), s1: K.s1 * (0.75 + r() * 0.5), a: K.a * (0.8 + r() * 0.35),
        rot: r() * 6.28, rv: (r() - 0.5) * 0.5, tint: K.tint, ph: r() * 6.28 });
    }
    update(dt) {
      this.t += dt;
      // zachte, langzaam van richting veranderende wind
      this.windA += dt * 0.05 * Math.sin(this.t * 0.07);
      const wx = Math.cos(this.windA) * 0.16, wz = Math.sin(this.windA) * 0.16;
      let n = 0;
      const keep = [];
      for (const p of this.list) {
        p.age += dt; if (p.age >= p.life) continue;
        keep.push(p);
        const t = p.age / p.life;
        // stijgen vertraagt; de wind neemt het geleidelijk over (eerst bijna recht omhoog)
        p.vy *= Math.max(0, 1 - dt * 0.32);
        const pull = Math.min(1, t * 2.2);
        p.vx += (wx * pull - p.vx) * Math.min(1, dt * 0.9) + Math.sin(this.t * 1.3 + p.ph) * 0.012 * dt;
        p.vz += (wz * pull - p.vz) * Math.min(1, dt * 0.9) + Math.cos(this.t * 1.1 + p.ph) * 0.012 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt + 0.03 * dt; p.z += p.vz * dt;
        p.rot += p.rv * dt;
        const s = p.s0 + (p.s1 - p.s0) * Math.sqrt(t);
        const a = p.a * Math.min(1, t / 0.12) * Math.pow(1 - t, 1.4);
        const e = this.mesh.instanceMatrix.array, o = n * 16;
        e[o] = s; e[o + 1] = a; e[o + 2] = p.rot; e[o + 3] = 0;
        e[o + 4] = p.tint[0]; e[o + 5] = p.tint[1]; e[o + 6] = p.tint[2]; e[o + 7] = p.ph;
        e[o + 8] = 0; e[o + 9] = 0; e[o + 10] = 0; e[o + 11] = 0;
        e[o + 12] = p.x; e[o + 13] = p.y; e[o + 14] = p.z; e[o + 15] = 1;
        n++;
      }
      this.list = keep;
      this.mesh.count = n;
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  VE.Smoke = Smoke;

  /* ---------------- Vlinders ----------------
     Kleurrijke maar bescheiden vlinders uit Blender (animals.glb: lijfje + twee vleugels; anders eenvoudig).
     Gedrag: vrij zwerven met willekeurige, vloeiende bochten (geen rondjes om een doel), wisselende snelheid
     en vlieghoogte, af en toe even zweven, en na een tijdje landen op een bloem in de buurt (vleugels
     langzaam open en dicht); meer rond bloemenvelden, weg van drukke gebouwen, opvliegen als er iemand
     langs loopt. Drie InstancedMeshes (lijf, linker- en rechtervleugel). */
  const BF_COLORS = [0xffd84a, 0xff9f43, 0xfff3de, 0x8fc8ff, 0xd99ae0, 0xe9f06a, 0xffb0a0];
  class Butterflies {
    constructor(root, game) {
      this.game = game; this.root = root;
      const n = this.n = VE.isMobile ? 18 : 40;
      const G = VE.butterflyGeo || simpleButterfly();
      const mat = new THREE.MeshPhongMaterial({ vertexColors: true, side: THREE.DoubleSide, shininess: 10, specular: 0x222222 });
      const mk = (geo) => {
        const m = new THREE.InstancedMesh(geo, mat, n);
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);   // zie VE-001
        m.count = 0; m.frustumCulled = false; m.castShadow = false; m.name = 'butterfly'; root.add(m);
        return m;
      };
      this.body = mk(G.body); this.wL = mk(G.wingL); this.wR = mk(G.wingR);
      this.list = []; this.ready = false; this.t = 0;
    }
    /* bloemtegels (en struiken) in de buurt van het dorp, rustige plekken eerst */
    flowerTiles() {
      const w = this.game.world, N = VE.N, out = [];
      for (let k = 0; k < N * N; k++) if (w.decoF[k] && !w.bld[k]) out.push(k);
      return out;
    }
    place() {
      const tiles = this.flowerTiles(), w = this.game.world, N = VE.N, hq = this.game.hq;
      if (!tiles.length || !hq) return;
      // het meest rond bloemenvelden die je kunt zien: dichtbij het dorp, maar ook verder weg
      tiles.sort((a, b) => Math.hypot(a % N - hq.cx, ((a / N) | 0) - hq.cz) - Math.hypot(b % N - hq.cx, ((b / N) | 0) - hq.cz));
      const near = tiles.slice(0, Math.max(30, Math.floor(tiles.length * 0.35)));
      for (let i = 0; i < this.n; i++) {
        const pool = i % 3 === 2 ? tiles : near;
        const k = pool[Math.floor(Math.random() * pool.length)];
        const x = k % N + 0.5, z = ((k / N) | 0) + 0.5;
        const col = new THREE.Color(BF_COLORS[i % BF_COLORS.length]);
        this.wL.setColorAt(i, col); this.wR.setColorAt(i, col);
        this.list.push({ x: x, z: z, hx: x, hz: z, y: 0.35, by: 0.3 + Math.random() * 0.35, h: Math.random() * 6.28, sp: 0.22 + Math.random() * 0.16,
          ph: Math.random() * 6.28, fr: 15 + Math.random() * 6, sc: 1.45 + Math.random() * 0.75, state: 'fly', t: 2 + Math.random() * 6,
          tx: x, tz: z, seed: Math.random() * 100, acc: 0, vis: true });
      }
      this.wL.instanceColor.needsUpdate = this.wR.instanceColor.needsUpdate = true;
      this.ready = true;
    }
    /* een bloem in de buurt (vooral vóór de vlinder, binnen ~3 tegels), niet bij drukke gebouwen */
    pickFlower(b, R) {
      const w = this.game.world, N = VE.N, busy = this.game.wild && this.game.wild.busy;
      R = R || 3;
      for (let t = 0; t < 18; t++) {
        // de helft van de pogingen rond de eigen plek, de rest rond de thuisbloemen: nooit te ver weg zwerven
        const ox = t % 2 ? b.x + Math.sin(b.h) * R * 0.4 : b.hx, oz = t % 2 ? b.z + Math.cos(b.h) * R * 0.4 : b.hz;
        const i = Math.floor(ox + (Math.random() - 0.5) * R * 2), j = Math.floor(oz + (Math.random() - 0.5) * R * 2);
        if (!w.inb(i, j)) continue;
        const k = j * N + i;
        if (!w.decoF[k] || (busy && busy[k] > 0.7)) continue;
        return [i + 0.2 + Math.random() * 0.6, j + 0.2 + Math.random() * 0.6];
      }
      return null;
    }
    update(dt, T) {
      if (!this.ready) { if (this.game.hq && this.game.world.veg !== undefined) this.place(); if (!this.ready) return; }
      this.t += dt;
      const w = this.game.world, N = VE.N, busy = this.game.wild && this.game.wild.busy, settlers = this.game.settlers;
      const cam = VE.view && VE.view.camera; const cx = cam ? cam.position.x : 0, cz = cam ? cam.position.z : 0;
      let n = 0;
      for (const b of this.list) {
        const far = (b.x - cx) ** 2 + (b.z - cz) ** 2 > 900;
        // ver weg: minder vaak bijwerken (opgeteld)
        b.acc += dt; if (far && b.acc < 0.15) { } else { const st = b.acc; b.acc = 0; this.step(b, st, w, N, busy, settlers); }
        const gy = w.heightAt(b.x, b.z);
        // vleugels: snel fladderen; zweven = vleugels half open stil; zittend rustig open en dicht
        let flap, bob = 0;
        if (b.state === 'sit') flap = 0.25 + (Math.sin(this.t * 1.6 + b.seed) * 0.5 + 0.5) * 1.05;
        else if (b.glide > 0) flap = 0.55 + Math.sin(this.t * 5 + b.seed) * 0.08;
        else { flap = 0.15 + (Math.sin(b.ph) * 0.5 + 0.5) * 1.25; bob = Math.sin(b.ph) * 0.006; }   // elke slag een klein sprongetje
        _q.setFromAxisAngle(UP, b.h);
        if (b.state !== 'sit') {
          // neus omhoog bij klimmen, omlaag bij dalen; overhellen in de bocht
          _e2.set(-0.22 - Math.max(-0.5, Math.min(0.5, (b.vy || 0) * 3)) + Math.sin(b.ph * 0.5) * 0.06, 0, -Math.max(-0.45, Math.min(0.45, (b.turn || 0) * 0.14)));
          _q2.setFromEuler(_e2); _q.multiply(_q2);
        }
        _m.compose(_p.set(b.x, gy + b.y + bob, b.z), _q, _s.set(b.sc, b.sc, b.sc));
        this.body.setMatrixAt(n, _m);
        _l.makeRotationZ(-flap); _o.multiplyMatrices(_m, _l); this.wL.setMatrixAt(n, _o);
        _l.makeRotationZ(flap); _o.multiplyMatrices(_m, _l); this.wR.setMatrixAt(n, _o);
        n++;
      }
      for (const m of [this.body, this.wL, this.wR]) { m.count = n; m.instanceMatrix.needsUpdate = true; }
    }
    /* Natuurlijke vlucht, geen cirkels om een doel:
       - koers: een draaisnelheid die om de paar tienden van een seconde een nieuw willekeurig doel krijgt en
         daar vloeiend naartoe gaat (zigzaggen, lussen, rechte stukjes); zachte trek terug naar de thuisbloemen
         als hij te ver weg dwaalt, en weg van drukke gebouwen;
       - snelheid en vlieghoogte: telkens een nieuw willekeurig doel, vloeiend benaderd; af en toe even zweven;
       - landen: na een tijdje kiest hij een bloem in de buurt, fladdert er (nog steeds wat onrustig) naartoe,
         daalt en gaat zitten; daarna (of als er iemand langskomt) vliegt hij omhoog weer verder. */
    step(b, dt, w, N, busy, settlers) {
      if (dt <= 0) return;
      const R = Math.random, wrap = a => { while (a > Math.PI) a -= 6.283; while (a < -Math.PI) a += 6.283; return a; };
      if (b.state === 'sit') {
        b.t -= dt;
        for (let i = 0; i < settlers.length; i += 3) { const s = settlers[i]; if (!s.hidden && (s.x - b.x) ** 2 + (s.z - b.z) ** 2 < 0.36) { b.t = 0; break; } }   // iemand loopt vlakbij: opfladderen
        if (b.t <= 0) {
          b.state = 'fly'; b.landing = false; b.t = 5 + R() * 9;
          b.h += (R() - 0.5) * 3; b.turn = (R() - 0.5) * 3; b.ty = 0.3 + R() * 0.4; b.yt = 1 + R() * 2; b.v = b.sp * 0.6; b.glide = 0;
        }
        return;
      }
      if (b.turn === undefined) { b.turn = 0; b.turnT = 0; b.tw = 0; b.v = b.sp; b.vT = b.sp; b.vw = 0; b.ty = b.by; b.yt = 0; b.glide = 0; b.vy = 0; }
      b.ph += dt * b.fr * (b.glide > 0 ? 0.2 : 1);
      b.t -= dt;
      const k = Math.floor(b.z) * N + Math.floor(b.x);
      // willekeurige draaisnelheid (rad/s), vloeiend
      b.tw -= dt;
      if (b.tw <= 0) { b.turnT = (R() - 0.5) * (R() < 0.15 ? 7 : 3.2); b.tw = 0.25 + R() * 1.1; }
      b.turn += (b.turnT - b.turn) * Math.min(1, dt * 3);
      let steer = b.turn;
      const d = b.landing ? Math.hypot(b.tx - b.x, b.tz - b.z) : 0;
      if (b.landing) {
        // naar de bloem: hoe dichterbij, hoe minder gezigzag
        const near = Math.min(1, d / 1.2);
        steer = b.turn * near + wrap(Math.atan2(b.tx - b.x, b.tz - b.z) - b.h) * (1.4 + (1 - near) * 5);
        b.lt -= dt; if (b.lt <= 0) { b.landing = false; b.t = 2 + R() * 4; }
      } else {
        const dh = Math.hypot(b.x - b.hx, b.z - b.hz);
        if (dh > 2.5) steer += wrap(Math.atan2(b.hx - b.x, b.hz - b.z) - b.h) * Math.min(2, (dh - 2.5) * 0.7);
      }
      if (busy && busy[k] > 0.7) steer += wrap(Math.atan2(b.hx - b.x, b.hz - b.z) - b.h) * 2.5;    // terug naar de rustige bloemen
      if (b.x < 1.5 || b.z < 1.5 || b.x > N - 1.5 || b.z > N - 1.5) steer += wrap(Math.atan2(N / 2 - b.x, N / 2 - b.z) - b.h) * 2;
      b.h = wrap(b.h + steer * dt);
      // snelheid: telkens een nieuw doel, vloeiend; zweven gaat iets sneller en rechter
      b.vw -= dt;
      if (b.vw <= 0) { b.vT = b.sp * (0.5 + R() * 1.0); b.vw = 0.8 + R() * 2.2; }
      if (b.glide > 0) b.glide -= dt;
      else if (!b.landing && R() < dt * 0.12) b.glide = 0.5 + R() * 0.9;
      let vT = b.vT * (b.glide > 0 ? 1.15 : 1);
      if (b.landing) vT *= Math.min(1, 0.35 + d * 0.6);
      b.v += (vT - b.v) * Math.min(1, dt * 1.6);
      b.x = Math.max(0.5, Math.min(N - 0.5, b.x + Math.sin(b.h) * b.v * dt));
      b.z = Math.max(0.5, Math.min(N - 0.5, b.z + Math.cos(b.h) * b.v * dt));
      // hoogte: willekeurige doelhoogte; bij het zweven zakt hij langzaam; bij de bloem omlaag
      b.yt -= dt;
      if (b.yt <= 0) { b.ty = 0.2 + R() * R() * 0.75; b.yt = 1 + R() * 2.5; }
      let ty = b.ty;
      if (b.glide > 0) ty = Math.max(0.18, b.y - 0.12);
      if (b.landing && d < 1) ty = 0.13 + d * 0.35;
      const y0 = b.y;
      b.y += (ty - b.y) * Math.min(1, dt * (b.landing && d < 0.4 ? 3 : 1.4));
      b.vy = (b.y - y0) / dt;
      if (b.landing && d < 0.08) { b.state = 'sit'; b.t = 2 + R() * 5; b.y = 0.13; b.landing = false; b.sits = (b.sits || 0) + 1; b.vy = 0; return; }
      // tijd om te landen
      if (!b.landing && b.t <= 0) {
        const f = this.pickFlower(b);
        if (f) { b.tx = f[0]; b.tz = f[1]; b.landing = true; b.lt = 14; }
        else b.t = 2 + R() * 3;
      }
      // af en toe een andere thuisplek: zo zwerft een vlinder langzaam langs de bloemenvelden
      if (!b.landing && R() < dt * 0.015) { const f = this.pickFlower(b, 4); if (f) { b.hx = f[0]; b.hz = f[1]; } }
    }
  }
  function simpleButterfly() {
    const body = new VE.Model(81); body.cyl(0.004, 0.004, 0.026, 5, 0x2e2622, { rx: Math.PI / 2, z: -0.013 });
    const wl = new VE.Model(82); wl.ball(0.018, 0xffffff, { x: -0.017, sy: 0.06, sz: 0.8 }, 1); wl.ball(0.013, 0xffffff, { x: -0.013, z: -0.012, sy: 0.06 }, 1);
    const wr = new VE.Model(83); wr.ball(0.018, 0xffffff, { x: 0.017, sy: 0.06, sz: 0.8 }, 1); wr.ball(0.013, 0xffffff, { x: 0.013, z: -0.012, sy: 0.06 }, 1);
    return { body: body.build(), wingL: wl.build(), wingR: wr.build() };
  }
  const _e2 = new THREE.Euler(0, 0, 0, 'XYZ'), _q2 = new THREE.Quaternion();

  class FX {
    constructor(root, game) {
      this.root = root; this.game = game;
      this.smoke = new Smoke(root, VE.isMobile ? 220 : 420);
      this.dust = new Puffs(root, 0xcdb88e, 160, 0.7, 1);
      this.leaves = new Puffs(root, 0x5aa83a, 120, 1.0, 0);
      this.chips = new Puffs(root, 0xd9b07a, 90, 1.0, 0);        // houtsnippers bij elke bijlslag
      this.splash = new Puffs(root, 0xe8f6ff, 80, 0.85, 0);
      this.sparks = new Puffs(root, 0xffb347, 90, 1.0, 0);
      this.poofs = new Puffs(root, 0xfffbe8, 60, 0.9, 1);
      this.sparks.mesh.material.emissive.setHex(0xff7a18);              // vonken gloeien
      this.poofs.mesh.material.emissive.setHex(0x555046);
      const bus = VE.bus;
      this.handlers = {
        smoke: e => this.smoke.emit(e),
        // e.small: kluitjes aarde bij het schoffelen (klein en kort)
        dust: e => { const k = e.small ? 0.22 : 1; for (let i = 0; i < (e.n || 8); i++) { const a = Math.random() * 6.28, sp = (0.4 + Math.random() * 0.6) * k; this.dust.emit({ x: e.x + Math.cos(a) * 0.3 * k, y: e.y + 0.1 * k, z: e.z + Math.sin(a) * 0.3 * k, vx: Math.cos(a) * sp, vy: (0.25 + Math.random() * 0.3) * (e.small ? 0.8 : 1), vz: Math.sin(a) * sp, g: e.small ? 1.2 : 0, life: (1.1 + Math.random() * 0.5) * (e.small ? 0.45 : 1), s0: 0.06 * k, s1: 0.2 * k }); } },
        chips: e => { for (let i = 0; i < 5; i++) { const a = Math.random() * 6.28; this.chips.emit({ x: e.x, y: e.y, z: e.z, vx: Math.cos(a) * 0.5 + (e.vx || 0), vy: 0.7 + Math.random() * 0.6, vz: Math.sin(a) * 0.5 + (e.vz || 0), g: 3.2, life: 0.55 + Math.random() * 0.3, s0: 0.012, s1: 0.014, sy: 0.5 }); } },
        leaves: e => { for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28; this.leaves.emit({ x: e.x, y: e.y, z: e.z, vx: Math.cos(a) * 0.6, vy: 0.6 + Math.random() * 0.5, vz: Math.sin(a) * 0.6, g: 1.4, life: 1.4, s0: 0.03, s1: 0.035, sy: 0.4 }); } },
        sparks: e => { for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28; this.sparks.emit({ x: e.x, y: e.y, z: e.z, vx: Math.cos(a) * 0.35, vy: 0.7 + Math.random() * 0.6, vz: Math.sin(a) * 0.35 + 0.15, g: 2.2, life: 0.5 + Math.random() * 0.3, s0: 0.012, s1: 0.004 }); } },
        poof: e => { for (let i = 0; i < 9; i++) { const a = i * 0.7; this.poofs.emit({ x: e.x, y: e.y, z: e.z, vx: Math.cos(a) * 0.5, vy: 0.35 + (i % 3) * 0.15, vz: Math.sin(a) * 0.5, life: 0.8, s0: 0.05, s1: 0.16 }); } },
        splash: e => { for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28; this.splash.emit({ x: e.x, y: 0.03, z: e.z, vx: Math.cos(a) * 0.4, vy: 0.9 + Math.random() * 0.5, vz: Math.sin(a) * 0.4, g: 4, life: 0.6, s0: 0.025, s1: 0.03 }); } }
      };
      for (const k in this.handlers) bus.on(k, a => { if (this.game === VE.game) this.handlers[k](a); });
      this.makeClouds();
      this.butterflies = new Butterflies(this.root, this.game);   // vogels: zie js/wildlife.js (zangvogels met echte vlucht)
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
    update(dt, t) {
      this.smoke.update(dt); this.dust.update(dt); this.leaves.update(dt); this.chips.update(dt); this.splash.update(dt); this.sparks.update(dt); this.poofs.update(dt);
      // clouds
      for (const c of this.clouds) {
        c.mesh.position.x += c.sp * dt;
        if (c.mesh.position.x > VE.N + 18) c.mesh.position.x = -18;
      }
      this.butterflies.update(dt, t);
    }
  }
  VE.FX = FX;
})(window.VE);
