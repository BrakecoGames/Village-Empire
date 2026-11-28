/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Volledige spelstatus als JSON (snapshot) en weer terug (restore).

   g.snapshot()            → een JSON-object met de hele simulatie: spelers, gebouwen, dorpelingen (ook wat ze op dit
                             moment doen: pad, taak, vervolg), bomen/rotsen/akkers/stammen, terrein (hoogtes, paden,
                             territorium), ertsaders, wilde dieren, random-toestand, tick en de commandowachtrij.
   new Game().init(snap)   → precies dezelfde toestand; daarna loopt de simulatie identiek verder (getest).
   VE.Snapshot.hash(obj)   → korte hash (determinisme-controle, later ook voor lockstep-desync).

   Hoe: een generieke graaf-serializer.
   - Een object dat vaker voorkomt (een boom die gereserveerd is én in de lijst staat, de werker van een
     gebouw ...) wordt één keer geschreven ({ $i: id, ... }) en daarna verwezen ({ $r: id }).
   - Vaste configuratie (VE.DEFS.farm, een diersoort ...) wordt een naam: { $s: 'DEFS.farm' }.
   - Getypeerde arrays (terrein) worden base64: { $t: 'Float32Array', b: '...' }.
   - Weergave hoort er niet in: 3D-objecten, velden die met '_' beginnen en de weergavevelden in SKIP.
   - Een functie in de toestand is een fout (dat zou betekenen dat iets niet te bewaren is). */
'use strict';
(function (VE) {
  const SKIP = new Set(['group', 'mesh', 'anims', 'chimneys', 'scaffold', 'upScaf', 'idx', 'px', 'pz', 'py', 'pr', 'moving', 'wp', 'look', 'g', 'w', 'game', 'root', 'dirtyTiles', 'onRoads', 'smokeT', 'vis', 'ph', 'tp', 'tr']);
  let STATIC = null, STATIC_BY = null;
  function statics() {
    if (STATIC) return STATIC;
    STATIC = new Map(); STATIC_BY = {};
    const reg = (name, tbl) => { if (!tbl) return; for (const k in tbl) if (tbl[k] && typeof tbl[k] === 'object') { const p = name + '.' + k; STATIC.set(tbl[k], p); STATIC_BY[p] = tbl[k]; } };
    reg('DEFS', VE.DEFS); reg('SOLDIERS', VE.SOLDIERS); reg('RES', VE.RES); reg('SPECIES', VE.SPECIES); reg('ORES', VE.ORES);
    reg('WEAPON_RECIPES', VE.WEAPON_RECIPES);
    return STATIC;
  }
  const isView = v => typeof THREE !== 'undefined' && (v instanceof THREE.Object3D || v instanceof THREE.Material || v instanceof THREE.BufferGeometry || v instanceof THREE.Texture || v instanceof THREE.BufferAttribute ||
    v instanceof THREE.Euler || v instanceof THREE.Matrix4 || v instanceof THREE.Color);
  // rekenobjecten die de simulatie zelf gebruikt (eekhoorn: houding, plek): als getallen bewaren
  const isQ = v => typeof THREE !== 'undefined' && v instanceof THREE.Quaternion, isV3 = v => typeof THREE !== 'undefined' && v instanceof THREE.Vector3;
  const TYPED = { Float32Array, Float64Array, Int32Array, Uint32Array, Int16Array, Uint16Array, Int8Array, Uint8Array };
  function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function unb64(s) { const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; }

  /* ---------- schrijven ---------- */
  function encode(root, strict) {
    const st = statics(), count = new Map();
    // ronde 1: tellen hoe vaak elk object voorkomt (alleen gedeelde objecten krijgen een id)
    (function walk(v) {
      if (!v || typeof v !== 'object' || st.has(v) || isView(v) || isQ(v) || isV3(v) || ArrayBuffer.isView(v)) return;
      const c = count.get(v) || 0; count.set(v, c + 1); if (c) return;
      if (Array.isArray(v)) { for (const x of v) walk(x); return; }
      if (v instanceof Map || v instanceof Set) return;
      for (const k in v) { if (SKIP.has(k) || k[0] === '_') continue; walk(v[k]); }
    })(root);
    const ids = new Map(); let next = 1;
    function out(v, path) {
      if (v === null || v === undefined) return v === undefined ? undefined : null;
      const t = typeof v;
      if (t === 'number') return Number.isFinite(v) ? v : (v > 0 ? 1e308 : v < 0 ? -1e308 : 0);
      if (t === 'string' || t === 'boolean') return v;
      if (t === 'function') { if (strict) throw new Error('Function in game state at ' + path); return undefined; }
      if (st.has(v)) return { $s: st.get(v) };
      if (isView(v)) return undefined;
      if (isQ(v)) return { $q: [v.x, v.y, v.z, v.w] };
      if (isV3(v)) return { $v: [v.x, v.y, v.z] };
      if (ArrayBuffer.isView(v)) return { $t: v.constructor.name, b: b64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
      if (v instanceof Map || v instanceof Set) return undefined;
      if (ids.has(v)) return { $r: ids.get(v) };
      const shared = count.get(v) > 1;
      let id = 0; if (shared) { id = next++; ids.set(v, id); }
      if (Array.isArray(v)) {
        const a = v.map((x, i) => { const r = out(x, path + '[' + i + ']'); return r === undefined ? null : r; });
        return shared ? { $i: id, $a: a } : a;
      }
      const o = shared ? { $i: id } : {};
      for (const k in v) {
        if (SKIP.has(k) || k[0] === '_') continue;
        const r = out(v[k], path + '.' + k);
        if (r !== undefined) o[k] = r;
      }
      return o;
    }
    return out(root, 'state');
  }
  /* ---------- lezen ---------- */
  function decode(json) {
    statics();
    const byId = new Map(), fix = [];
    function inn(v) {
      if (v === null || typeof v !== 'object') return v;
      if (Array.isArray(v)) return v.map(inn);
      if (v.$s !== undefined) return STATIC_BY[v.$s];
      if (v.$q !== undefined) return new THREE.Quaternion(v.$q[0], v.$q[1], v.$q[2], v.$q[3]);
      if (v.$v !== undefined) return new THREE.Vector3(v.$v[0], v.$v[1], v.$v[2]);
      if (v.$t !== undefined) { const u8 = unb64(v.b), C = TYPED[v.$t]; return new C(u8.buffer, 0, u8.byteLength / C.BYTES_PER_ELEMENT); }
      if (v.$r !== undefined) { if (byId.has(v.$r)) return byId.get(v.$r); const p = { $pending: v.$r }; fix.push(p); return p; }
      if (v.$a !== undefined) { const a = []; byId.set(v.$i, a); for (const x of v.$a) a.push(inn(x)); return a; }
      const o = {};
      if (v.$i !== undefined) byId.set(v.$i, o);
      for (const k in v) { if (k === '$i') continue; o[k] = inn(v[k]); }
      return o;
    }
    const root = inn(json);
    if (fix.length) {   // verwijzing vóór het object zelf (komt bij diepe grafen niet voor, maar voor de zekerheid)
      const seen = new Set();
      (function walk(o) {
        if (!o || typeof o !== 'object' || seen.has(o) || ArrayBuffer.isView(o)) return; seen.add(o);
        for (const k in o) { const v = o[k]; if (v && v.$pending !== undefined) o[k] = byId.get(v.$pending); else walk(v); }
      })(root);
    }
    return root;
  }
  /* korte hash van een JSON-object (FNV-1a over de JSON-tekst) */
  function hash(obj) {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
  VE.Snapshot = { encode, decode, hash };

  const P = VE.Game.prototype;
  const WORLD_ARRAYS = ['H', 'type', 'bld', 'road', 'wear', 'soft', 'owned', 'door', 'explored'];
  /* de hele simulatiestatus als JSON (strict: een functie in de toestand geeft een fout) */
  P.snapshot = function (strict) {
    const w = this.world, n = this.nature, wl = this.wild;
    const root = {
      core: { time: this.time, tickN: this.tickN || 0, rng: this.rng.s, speed: this.speed, bid: this.bid, sid: this.sid, me: this.me,
        dispT: this.dispT, roadsDirty: this.roadsDirty, roadT: this.roadT, wearT: this.wearT, leaveT: this.leaveT || {}, cmdSeq: this.cmdSeq || 0,
        cmdQueue: this.cmdQueue || [], fogT: this.fogT || 0 },
      players: this.players.map(p => p.toJSON()),
      buildings: this.buildings,
      settlers: this.settlers,
      world: { tree: w.tree, rock: w.rock, field: w.field, ore: w.ore || null, deposits: w.deposits || [], sulfurFields: w.sulfurFields || null },
      nature: { trees: n.trees, rocks: n.rocks, fields: n.fields, logs: n.logs || [], acc: n.acc || 0 },
      paths: { v: w.paths.v, fixed: w.paths.fixed, tileVal: w.paths.tileVal, texT: w.paths.texT, tileT: w.paths.tileT },
      wild: wl ? { list: wl.list, id: wl.id, herd: wl.herd, rng: wl.rng ? wl.rng.s : 0, busy: wl.busy, hab: wl.hab, busyT: wl.busyT, habT: wl.habT, breedT: wl.breedT, time: wl.time, flocks: wl.flocks || null } : null,
      mining: { regT: this.regT || 0 }
    };
    for (const k of WORLD_ARRAYS) root.world[k] = w[k];
    const L = this.landmarks || [];
    return { snap: 2, n: VE.N, g: w.gen || 1, seed: this.seed, state: encode(root, strict),
      disc: L.filter(x => x.found).map(x => x.id), lmk: { t: this.lmT || 0, seen: L.filter(x => x.seen).map(x => x.id) } };
  };
  P.stateHash = function () { return hash(this.snapshot().state); };

  /* terugzetten (vanuit Game.init): de wereld komt uit de seed, daarna gaat de hele toestand eroverheen */
  P.restoreSnapshot = function (snap) {
    const S = decode(snap.state), w = this.world, n = this.nature, G = S.core;
    // terrein en tegels
    for (const k of WORLD_ARRAYS) if (S.world[k] && w[k]) w[k].set(S.world[k]);
    w.updateHeights();
    w.tree = S.world.tree; w.rock = S.world.rock; w.field = S.world.field;
    // natuur: dezelfde objecten (gebouwen en dorpelingen verwijzen ernaar), weergave opnieuw opbouwen
    n.trees = S.nature.trees; n.rocks = S.nature.rocks; n.fields = S.nature.fields; n.acc = S.nature.acc;
    for (const t of n.trees) { if (t.dead) continue; t.look = n.glb ? VE.treeLook(w, t) : { tint: 0xffffff, vx: 1, vy: 1 }; const sp = t.sp; t.sp = null; if (!n.alloc(t, sp || n.speciesOf(t))) n.alloc(t, n.speciesOf(t)); n.setTreeM(t); }
    for (const r of n.rocks) { if (r.dead) continue; r.idx = n.rockFree.length ? n.rockFree.pop() : n.rockUsed++; n.setRockM(r); }
    for (const f of n.fields) { if (f.dead) continue; f.idx = n.fieldFree.length ? n.fieldFree.pop() : n.fieldUsed++; n.setFieldM(f); }
    for (const p of S.nature.logs) { if (p.dead) continue; const q = n.addLog(p.x, p.z, p.dir, p.len, p.R); n.logs.pop(); p.idx = q.idx; n.logs.push(p); }
    for (let k = 0; k < w.bld.length; k++) if (w.bld[k] || w.road[k] || w.rock[k] || w.field[k] || w.door[k]) w.clearDeco(k);
    // spelers, gebouwen, dorpelingen
    this.players = S.players.map(d => new VE.Player({ id: d.id }).load(d));
    this.me = G.me || 0; this.cur = this.me;
    this.buildings = S.buildings; this.bmap = {};
    for (const b of this.buildings) { this.bmap[b.id] = b; if (b.alive) this.makeMesh(b); }
    this.settlers = S.settlers;
    this.time = G.time; this.tickN = G.tickN; this.rng.s = G.rng >>> 0; this.speed = G.speed; this.bid = G.bid; this.sid = G.sid;
    this.dispT = G.dispT; this.roadsDirty = G.roadsDirty; this.roadT = G.roadT; this.wearT = G.wearT; this.leaveT = G.leaveT;
    this.cmdSeq = G.cmdSeq; this.cmdQueue = G.cmdQueue || []; this.fogT = G.fogT;
    // paden
    const fp = w.paths; fp.v.set(S.paths.v); fp.fixed.set(S.paths.fixed); fp.tileVal.set(S.paths.tileVal); fp.texT = S.paths.texT; fp.tileT = S.paths.tileT;
    for (let k = 0; k < N2(); k++) fp.dirtyTiles.add(k); fp.texDirty = true;
    // ertsaders
    if (VE.Mining) {
      w.ore = S.world.ore || new Array(w.bld.length).fill(null); w.deposits = S.world.deposits || [];
      if (S.world.sulfurFields) w.sulfurFields = S.world.sulfurFields;
      VE.Mining.sulfurDirty = true; VE.Mining.game = this; VE.Mining.paintSurvey(w);
      if (S.mining) this.regT = S.mining.regT;
    }
    this._wildSnap = S.wild;
    this.sd = true;
    function N2() { return VE.N * VE.N; }
  };
  /* wilde dieren: na het aanmaken van Wildlife (die maakt zelf geen dieren als er een snapshot is) */
  P.restoreWild = function () {
    const W = this._wildSnap, wl = this.wild; this._wildSnap = null;
    if (!W || !wl) return;
    wl.list = W.list; wl.id = W.id; wl.herd = W.herd; if (wl.rng) wl.rng.s = W.rng >>> 0;
    if (W.busy) wl.busy.set(W.busy);
    wl.hab = W.hab; wl.busyT = W.busyT; wl.habT = W.habT; wl.breedT = W.breedT; wl.time = W.time; if (W.flocks) wl.flocks = W.flocks;
  };
})(window.VE);
