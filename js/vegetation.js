/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Decoratieve vegetatie: gras, bloemen, struiken, stenen, stronken, paddenstoelen, bladeren en
   een paar zeldzame easter eggs. Plus de keuze van de boomsoort per boom (zie Nature in world.js).

   Puur decoratief: niets hiervan staat in w.tree / w.rock / w.bld, dus bouwen, paden, pathfinding
   en selectie werken precies als voorheen. Bouw je ergens (gebouw, pad, akker, nieuwe boom), dan
   verdwijnt de decoratie op die tegel (World.clearDeco).

   Deterministisch: alles volgt uit de wereld-seed (eigen random-reeks, los van de wereldgeneratie)
   en de tegelpositie; er wordt niets van opgeslagen. Elke soort is één InstancedMesh.

   Verspreiding in natuurlijke groepen: per soort een eigen ruisveld (bloemenweides, plukken hoog
   gras, struiken langs bosranden), bosbodem (bladeren, paddenstoelen, takken) waar het bos dicht is,
   stenen in het bergland. Langs gelopen paden en rond gebouwen groeien wat bloemen en plantjes. */
'use strict';
(function (VE) {
  const N = VE.N || 64;
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _y = new THREE.Vector3(0, 1, 0);

  // hash → [0,1): deterministisch per tegel/zout, onafhankelijk van welke random-reeks dan ook
  const hash = (a, b) => {
    let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  };
  VE.vegHash = hash;

  const GREENS = [0x9ccd58, 0xa8d462, 0x8cc24c, 0xb4d86a, 0x94c650];
  const WARM = [0xffffff, 0xfff4e4, 0xf6fbec, 0xfffbea, 0xeef5e6];
  /* soort → capaciteit [desktop, mobiel], wind, kleurvariaties, schaduw */
  const KINDS = {
    grass_short: { cap: [7500, 3200], wind: { amp: 0.32, pow: 1 }, tints: GREENS },
    grass_mid: { cap: [3800, 1600], wind: { amp: 0.3, pow: 1 }, tints: GREENS },
    grass_tall: { cap: [1500, 650], wind: { amp: 0.26, flutter: 0.004, pow: 1.3 }, tints: [0xa6cc5c, 0xb2d266, 0x98c452, 0xbcd472, 0xc6d67a] },
    grass_bloom: { cap: [700, 320], wind: { amp: 0.3, pow: 1.2 }, tints: [0xbcd870, 0xc8dc78, 0xb0d266, 0xd4e086] },
    weed: { cap: [500, 240], wind: { amp: 0.15, pow: 1 }, tints: [0x8cc450, 0x9ccc5a, 0x80bc48] },
    fl_daisy: { cap: [420, 200], wind: { amp: 0.32, pow: 1 }, tints: WARM },
    fl_poppy: { cap: [360, 170], wind: { amp: 0.36, pow: 1 }, tints: WARM },
    fl_yellow: { cap: [420, 200], wind: { amp: 0.32, pow: 1 }, tints: WARM },
    fl_purple: { cap: [360, 170], wind: { amp: 0.3, pow: 1 }, tints: WARM },
    fl_mix: { cap: [420, 200], wind: { amp: 0.32, pow: 1 }, tints: WARM },
    bush_round: { cap: [420, 220], wind: { amp: 0.07, flutter: 0.004, pow: 1 }, tints: WARM, shadow: true },
    bush_big: { cap: [320, 160], wind: { amp: 0.06, flutter: 0.004, pow: 1 }, tints: WARM, shadow: true },
    bush_flower: { cap: [160, 80], wind: { amp: 0.07, flutter: 0.004, pow: 1 }, tints: WARM, shadow: true },
    bush_berry: { cap: [200, 100], wind: { amp: 0.06, flutter: 0.004, pow: 1 }, tints: WARM, shadow: true },
    hedge: { cap: [90, 50], wind: { amp: 0.04, flutter: 0.003, pow: 1 }, tints: WARM, shadow: true },
    d_stones: { cap: [500, 260], tints: [0xffffff, 0xf2efe8, 0xe8e6e2] },
    d_mossrock: { cap: [160, 90], tints: [0xffffff, 0xf0f4ea], shadow: true },
    d_stump: { cap: [90, 50], tints: [0xffffff, 0xf4ece2], shadow: true },
    d_branch: { cap: [160, 80], tints: [0xffffff, 0xf2eadf] },
    d_mushrooms: { cap: [160, 80], tints: [0xffffff, 0xfff0ea] },
    d_roots: { cap: [90, 50], tints: [0xffffff] },
    d_leaves: { cap: [600, 300], tints: [0xffffff, 0xfff0d8, 0xf6f0e0] },
    egg_stump_door: { cap: [2, 2], tints: [0xffffff], shadow: true },
    egg_shroom_face: { cap: [2, 2], tints: [0xffffff], shadow: true },
    bush_eyes: { cap: [2, 2], wind: { amp: 0.05, flutter: 0.003, pow: 1 }, tints: [0xffffff], shadow: true }
  };
  const NAMES = Object.keys(KINDS);
  const BIG = new Set(['bush_round', 'bush_big', 'bush_flower', 'bush_berry', 'hedge', 'd_mossrock', 'd_stump', 'd_roots', 'd_branch', 'egg_stump_door', 'egg_shroom_face', 'bush_eyes']);
  const FLOWERS = ['fl_daisy', 'fl_poppy', 'fl_yellow', 'fl_purple', 'fl_mix'];
  const EGGS = ['egg_stump_door', 'egg_shroom_face', 'bush_eyes'];

  /* Instancer: houdt alle exemplaren van één soort bij (matrix, kleur, plek) en zet per frame alleen
     de zichtbare in de InstancedMesh. Three.js cullt een InstancedMesh als geheel (niet per exemplaar);
     zo tekent de GPU alleen wat in beeld is, zonder extra draw calls. */
  const _sph = new THREE.Sphere(), _fr = new THREE.Frustum(), _pv = new THREE.Matrix4();
  class Instancer {
    constructor(mesh, cap, radius) {
      this.mesh = mesh; this.cap = cap; this.r = radius;
      this.mat = new Float32Array(cap * 16); this.col = new Float32Array(cap * 3).fill(1);
      this.pos = new Float32Array(cap * 3); this.alive = new Uint8Array(cap); this.hi = 0; this.dirty = true;
      mesh.count = 0;
    }
    set(i, m) {
      const e = m.elements;
      m.toArray(this.mat, i * 16);
      this.pos[i * 3] = e[12]; this.pos[i * 3 + 1] = e[13]; this.pos[i * 3 + 2] = e[14];
      this.alive[i] = (e[0] || e[1] || e[2]) ? 1 : 0;
      if (i >= this.hi) this.hi = i + 1;
      this.dirty = true;
    }
    color(i, c) { this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b; this.dirty = true; }
    kill(i) { this.alive[i] = 0; this.dirty = true; }
    sync(fr, margin) {
      const im = this.mesh.instanceMatrix.array, ic = this.mesh.instanceColor ? this.mesh.instanceColor.array : null;
      _sph.radius = this.r + margin;
      let n = 0;
      for (let i = 0; i < this.hi; i++) {
        if (!this.alive[i]) continue;
        if (fr) { _sph.center.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]); if (!fr.intersectsSphere(_sph)) continue; }
        im.set(this.mat.subarray(i * 16, i * 16 + 16), n * 16);
        if (ic) ic.set(this.col.subarray(i * 3, i * 3 + 3), n * 3);
        n++;
      }
      this.mesh.count = n;
      this.mesh.instanceMatrix.needsUpdate = true;
      if (ic) this.mesh.instanceColor.needsUpdate = true;
      this.dirty = false;
      return n;
    }
  }
  VE.Instancer = Instancer;

  /* Per frame (main.js): bij camerabeweging of wijzigingen de zichtbare exemplaren bijwerken. Het
     frustum wordt ruim genomen (marge), zodat kleine bewegingen niet meteen een nieuwe ronde vragen. */
  let lastKey = '';
  VE.natureSync = function (g, camera) {
    const list = [];
    if (g.world.veg) for (const K of g.world.veg.kinds) list.push(K.inst);
    if (g.nature && g.nature.pools) for (const n in g.nature.pools) if (g.nature.pools[n].inst) list.push(g.nature.pools[n].inst);
    if (!list.length) return;
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements;
    const key = [Math.round(e[12] / 0.6), Math.round(e[13] / 0.6), Math.round(e[14] / 0.6), Math.round(e[8] * 40), Math.round(e[9] * 40), Math.round(e[10] * 40), Math.round(camera.fov), Math.round(camera.aspect * 20)].join(',');
    const moved = key !== lastKey;
    if (moved) { lastKey = key; _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pv); }
    for (const it of list) if (moved || it.dirty) it.sync(VE.noCull ? null : _fr, 1.6);
  };
  VE.natureForceSync = () => { lastKey = ''; };

  class Vegetation {
    constructor(world, geos) {
      this.w = world;
      const mob = VE.isMobile ? 1 : 0;
      this.kinds = NAMES.map((name, id) => {
        const def = KINDS[name], cap = def.cap[mob];
        const mat = def.wind ? VE.windMat({}, def.wind, 'veg_' + name) : new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 5, specular: 0x111111 });
        const mesh = new THREE.InstancedMesh(geos[name], mat, cap);
        mesh.setColorAt(0, _c.setHex(0xffffff));        // instanceColor bestaat altijd (VE-001); r128: vóór count = 0, anders is de buffer leeg
        mesh.count = 0; mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = !!def.shadow && !VE.isMobile;
        mesh.name = 'veg_' + name;
        world.root.add(mesh);
        const inst = new Instancer(mesh, cap, name.startsWith('bush') || name === 'hedge' || name === 'd_mossrock' ? 0.5 : 0.3);
        return { id: id, name: name, def: def, mesh: mesh, inst: inst, cap: cap, used: 0, free: [], pos: [], dirty: false };
      });
      this.byName = {}; for (const k of this.kinds) this.byName[k.name] = k;
      this.items = new Array(N * N).fill(null);   // natuurlijke decoratie per tegel: [kind<<16 | idx]
      this.edge = new Array(N * N).fill(null);    // langs paden/rond gebouwen
      this.edgeMask = new Int32Array(N * N);
      this.eggCand = {};                           // soort → kandidaat-tegels (volgorde = random)
    }

    /* ---------------- instances ---------------- */
    add(name, k, x, z, s, rot, sy, list, tint) {
      const K = this.byName[name];
      // 10% van elke soort blijft vrij voor plantjes langs paden en gebouwen die later ontstaan
      if (list !== 'edge' && K.used - K.free.length >= Math.floor(K.cap * 0.9)) return false;
      const idx = K.free.length ? K.free.pop() : K.used < K.cap ? K.used++ : -1;
      if (idx < 0) return false;
      K.pos[idx] = [x, z, s, rot, sy || 1];
      this.place(K, idx);
      const tints = K.def.tints;
      K.inst.color(idx, _c.setHex(tint !== undefined ? tint : tints[Math.floor(hash(k * 31 + idx, K.id) * tints.length)]));
      const arr = list === 'edge' ? this.edge : this.items;
      (arr[k] = arr[k] || []).push((K.id << 16) | idx);
      if (list !== 'edge' && name.startsWith('fl_')) this.w.decoF[k] = true;
      return true;
    }
    place(K, idx) {
      const p = K.pos[idx], w = this.w;
      _q.setFromAxisAngle(_y, p[3]);
      _m.compose(_p.set(p[0], w.heightAt(p[0], p[1]) - 0.006, p[1]), _q, _s.set(p[2], p[2] * p[4], p[2]));
      K.inst.set(idx, _m);
    }
    drop(code) {
      const K = this.kinds[code >> 16], idx = code & 0xffff;
      K.inst.kill(idx); K.free.push(idx); K.pos[idx] = null;
    }
    clearTile(k, which) {
      if (which !== 'edge' && this.items[k]) { for (const c of this.items[k]) this.drop(c); this.items[k] = null; this.w.decoF[k] = null; }
      if (which !== 'items' && this.edge[k]) { for (const c of this.edge[k]) this.drop(c); this.edge[k] = null; }
    }
    clearBig(k) {
      const a = this.items[k]; if (!a) return;
      this.items[k] = a.filter(c => { if (BIG.has(this.kinds[c >> 16].name)) { this.drop(c); return false; } return true; });
    }
    refreshArea(i0, j0, i1, j1) {
      for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) {
        const k = j * N + i;
        for (const arr of [this.items[k], this.edge[k]]) if (arr) for (const c of arr) this.place(this.kinds[c >> 16], c & 0xffff);
      }
    }
    flush() { /* de Instancers werken zichzelf bij in VE.natureSync (per frame, alleen wat zichtbaar is) */ }

    /* ---------------- natuurlijke verspreiding ---------------- */
    build() {
      const w = this.w, r = VE.rng((w.seed ^ 0x7e9a11) >>> 0);
      const nz = VE.noise((w.seed + 9011) >>> 0), nf = FLOWERS.map((_, q) => VE.noise((w.seed + 4100 + q * 37) >>> 0));
      const cx = w.start.i + 1, cz = w.start.j + 1;
      const free = (x, z) => w.heightAt(x, z) > 0.08;
      // n plantjes van één soort als groepje rond (gx, gz) binnen de tegel
      const group = (name, k, i, j, n, spread, smin, smax, gx, gz) => {
        gx = gx === undefined ? i + 0.15 + r() * 0.7 : gx; gz = gz === undefined ? j + 0.15 + r() * 0.7 : gz;
        for (let q = 0; q < n; q++) {
          const a = r() * 6.283, d = Math.sqrt(r()) * spread;
          const x = VE.clamp(gx + Math.cos(a) * d, i + 0.04, i + 0.96), z = VE.clamp(gz + Math.sin(a) * d, j + 0.04, j + 0.96);
          if (!free(x, z)) continue;
          this.add(name, k, x, z, smin + r() * (smax - smin), r() * 6.283, 0.85 + r() * 0.35);
        }
      };
      // tegels in een vaste, gehusselde volgorde: raakt een soort aan zijn maximum, dan dunt hij
      // overal gelijkmatig uit (en niet alleen in het zuiden van de kaart)
      const order = Array.from({ length: N * N }, (_, k) => k), rs = VE.rng((w.seed ^ 0x51ed27) >>> 0);
      for (let n = order.length - 1; n > 0; n--) { const q = Math.floor(rs() * (n + 1)); const t = order[n]; order[n] = order[q]; order[q] = t; }
      for (const k of order) {
        const i = k % N, j = (k / N) | 0, ty = w.type[k];
        if (ty === 1) continue;
        const f = w.forest[k], m = w.mount[k];
        const dStart = Math.hypot(i + 0.5 - cx, j + 0.5 - cz);
        const near = dStart < 3.6;                                    // rond het hoofdkwartier: alleen wat gras
        const meadow = 1 - VE.smooth(0.42, 0.6, f), wood = VE.smooth(0.5, 0.66, f), edgeWood = VE.smooth(0.4, 0.5, f) * (1 - VE.smooth(0.56, 0.64, f));
        if (ty === 2) {                                               // bergland: stenen, mossige rotsen, wat gras
          if (r() < 0.28) group('d_stones', k, i, j, 1, 0.2, 0.9, 1.6);
          if (r() < 0.07) group('d_mossrock', k, i, j, 1, 0.1, 0.8, 1.2);
          if (r() < 0.45) group('grass_short', k, i, j, 1 + Math.floor(r() * 2), 0.3, 0.8, 1.2);
          continue;
        }
        const sand = ty === 3;
        const tallN = nz.fbm(i * 0.21 + 3.1, j * 0.21 - 7.3, 2), bloomN = nz.fbm(i * 0.17 - 11, j * 0.17 + 4, 2);
        // gras: kort overal, middel en hoog in plukken (ruisveld), bloeiend gras in eigen vlekken
        const lush = nz.fbm(i * 0.12 - 5.3, j * 0.12 + 8.1, 2);
        group('grass_short', k, i, j, sand ? Math.floor(r() * 2) : 1 + Math.floor(r() * 2 + VE.smooth(0.35, 0.65, lush) * 4), 0.45, 0.8, 1.4);
        if (!sand && r() < 0.45 + wood * 0.3 + lush * 0.4) group('grass_mid', k, i, j, 1 + Math.floor(r() * 2 + lush * 1.5), 0.3, 0.85, 1.35);
        if (!near && tallN > 0.56 && r() < 0.8) group('grass_tall', k, i, j, 2 + Math.floor(r() * 3), 0.22, 0.8, 1.3);
        else if (!near && (sand || edgeWood > 0.3) && r() < 0.25) group('grass_tall', k, i, j, 1 + Math.floor(r() * 2), 0.2, 0.8, 1.2);
        if (!sand && !near && bloomN > 0.55 && meadow > 0.4 && r() < 0.75) group('grass_bloom', k, i, j, 1 + Math.floor(r() * 2), 0.3, 0.8, 1.25);
        if (!sand && r() < 0.1) group('weed', k, i, j, 1, 0.3, 0.8, 1.3);
        if (sand) { if (r() < 0.12) group('d_stones', k, i, j, 1, 0.3, 0.7, 1.2); continue; }
        // bloemenweides: per bloemsoort een eigen ruisveld → losse velden madeliefjes, klaprozen …
        let fl = 0;
        if (!near && meadow > 0.35) for (let q = 0; q < FLOWERS.length && fl < 2; q++) {
          const v = nf[q].fbm(i * 0.14 + q * 13, j * 0.14 - q * 7, 2);
          if (v > 0.6 && r() < 0.35 + (v - 0.6) * 4) { group(FLOWERS[q], k, i, j, 1 + (v > 0.66 && r() < 0.6 ? 1 : 0), 0.3, 1.15, 1.6); fl++; }
        }
        if (!fl && !near && meadow > 0.5 && r() < 0.035) group(FLOWERS[Math.floor(r() * 5)], k, i, j, 1, 0.2, 1.0, 1.4);
        // bosbodem
        if (wood > 0.2) {
          if (r() < 0.4 * wood) group('d_leaves', k, i, j, 1, 0.2, 0.9, 1.4);
          if (r() < 0.07 * wood) group('d_mushrooms', k, i, j, 1, 0.2, 0.8, 1.3);
          if (r() < 0.07 * wood) group('d_branch', k, i, j, 1, 0.2, 0.8, 1.2);
          if (r() < 0.03 * wood) group('d_stump', k, i, j, 1, 0.2, 0.85, 1.2);
          if (r() < 0.035 * wood) group('d_roots', k, i, j, 1, 0.15, 0.8, 1.2);
          if (r() < 0.025 * wood) group('d_mossrock', k, i, j, 1, 0.15, 0.7, 1.1);
        }
        // struiken langs bosranden, losse bloeiende struikjes en heggen in de weide
        if (!near && edgeWood > 0.15 && r() < 0.28 * edgeWood) group(['bush_big', 'bush_round', 'bush_berry', 'bush_big'][Math.floor(r() * 4)], k, i, j, 1, 0.15, 0.85, 1.25);
        else if (!near && meadow > 0.6 && r() < 0.022) group(r() < 0.5 ? 'bush_flower' : 'bush_round', k, i, j, 1, 0.15, 0.8, 1.15);
        else if (!near && meadow > 0.7 && r() < 0.006) this.add('hedge', k, i + 0.5, j + 0.5, 0.9 + r() * 0.25, r() < 0.5 ? 0 : Math.PI / 2, 1);
        if (m > 0.2 && r() < 0.1 * m) group('d_stones', k, i, j, 1, 0.3, 0.7, 1.3);
        // kandidaten voor de easter eggs (de definitieve plek wordt pas na het planten van de bomen gekozen)
        if (dStart > 6 && dStart < 17) {
          if (wood > 0.3 && r() < 0.06) (this.eggCand.egg_stump_door = this.eggCand.egg_stump_door || []).push(k);
          if (wood > 0.2 && r() < 0.06) (this.eggCand.egg_shroom_face = this.eggCand.egg_shroom_face || []).push(k);
          if (edgeWood > 0.2 && r() < 0.06) (this.eggCand.bush_eyes = this.eggCand.bush_eyes || []).push(k);
        }
      }
      this.flush();
    }

    /* Na het planten/laden van de bomen: geen struiken of rotsen dwars door een stam, en de
       easter eggs elk op de eerste vrije kandidaat-tegel. */
    settle() {
      const w = this.w;
      for (let k = 0; k < N * N; k++) if (w.tree[k] || w.rock[k]) this.clearBig(k);
      for (const name of EGGS) {
        const K = this.byName[name];
        if (K.used) continue;
        const k = (this.eggCand[name] || []).find(k => !w.tree[k] && !w.rock[k] && !w.bld[k] && !w.road[k] && !w.field[k] && w.type[k] !== 1);
        if (k === undefined) continue;
        this.clearBig(k);
        const i = k % N, j = (k / N) | 0;
        // gezicht/deurtje naar de standaardcamera (yaw π/4), met een klein beetje speling
        this.add(name, k, i + 0.5, j + 0.5, 1.1, Math.PI / 4 + (hash(k, 77) - 0.5) * 0.5, 1, 'items', 0xffffff);
      }
      this.flush();
    }

    /* ---------------- langs paden en rond gebouwen ---------------- */
    updateEdges() {
      const w = this.w;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = j * N + i;
        let mask = 0;
        if (w.type[k] !== 1 && w.type[k] !== 2 && !w.bld[k] && !w.road[k] && !w.door[k] && !w.field[k] && !w.tree[k] && !w.rock[k]) {
          const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (let d = 0; d < 4; d++) {
            const a = i + nb[d][0], b = j + nb[d][1];
            if (a < 0 || b < 0 || a >= N || b >= N) continue;
            const kk = b * N + a;
            if (w.road[kk] === 2 && !w.bld[kk]) mask |= 1 << d;
            else if (w.bld[kk]) mask |= 16 << d;
          }
        }
        if (mask === this.edgeMask[k]) continue;
        this.edgeMask[k] = mask;
        this.clearTile(k, 'edge');
        if (mask) this.edgeTile(k, i, j, mask);
      }
      this.flush();
    }
    edgeTile(k, i, j, mask) {
      const r = VE.rng((k * 7919 + mask * 131 + (this.w.seed >>> 0)) >>> 0);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let d = 0; d < 4; d++) {
        const road = mask & (1 << d), bld = mask & (16 << d);
        if (!road && !bld) continue;
        const n = road ? 1 + (r() < 0.55 ? 1 : 0) : 1 + (r() < 0.4 ? 1 : 0);
        for (let q = 0; q < n; q++) {
          const t = 0.15 + r() * 0.7, inset = 0.1 + r() * 0.1;
          const x = i + (dirs[d][0] ? (dirs[d][0] > 0 ? 1 - inset : inset) : t);
          const z = j + (dirs[d][1] ? (dirs[d][1] > 0 ? 1 - inset : inset) : t);
          let name;
          if (road) name = ['fl_yellow', 'fl_daisy', 'fl_mix', 'grass_mid', 'fl_yellow', 'grass_bloom'][Math.floor(r() * 6)];
          else name = ['grass_mid', 'weed', 'fl_daisy', 'bush_round', 'grass_mid', 'fl_mix'][Math.floor(r() * 6)];
          const s = name === 'bush_round' ? 0.5 + r() * 0.15 : name.startsWith('fl_') ? 0.55 + r() * 0.2 : 0.75 + r() * 0.3;
          this.add(name, k, x, z, s, r() * 6.283, 1, 'edge');
        }
      }
    }
    stats() {
      const out = {}; let total = 0, calls = 0;
      for (const K of this.kinds) { const n = K.used - K.free.length; out[K.name] = n; total += n; if (K.used) calls++; }
      return { kinds: out, total: total, drawCalls: calls };
    }
  }
  VE.Vegetation = Vegetation;

  /* ---------------- boomsoorten ----------------
     Gameplay kent drie boomtypes (0 loofboom, 1 naaldboom, 2 berk) — die blijven ongewijzigd in de
     save en voor de houthakker. De soort (eik, beuk, oude eik, fruitboom …) is puur visueel en volgt
     deterministisch uit tegel + seed; jonge bomen (< 50 % gegroeid) zijn een eigen model. */
  const TREE_CAP = { tree_oak: 1500, tree_beech: 1200, tree_oak_old: 500, tree_birch: 1500, tree_young: 1200, tree_pine: 1500, tree_spruce: 1500,
    tree_apple: 400, tree_pear: 400, tree_blossom: 400, tree_oak_bird: 6, tree_beech_logo: 6 };
  VE.TREE_CAP = TREE_CAP;
  const TINTS = [0xffffff, 0xf2fae6, 0xfff5e0, 0xe8f0e2, 0xfaffee];
  VE.treeSpecies = function (w, t) {
    const k = t.k, h = hash(k, w.seed | 0), h2 = hash(k * 3 + 1, (w.seed | 0) + 99);
    if (t.type === 1) return h < (w.mount[k] > 0.3 ? 0.3 : 0.45) ? 'tree_pine' : 'tree_spruce';
    if (t.type === 2) return 'tree_birch';
    if (h2 < 1 / 300) return 'tree_oak_bird';
    if (h2 > 1 - 1 / 300) return 'tree_beech_logo';
    const deep = w.forest[k] > 0.6;
    const table = deep ? [['tree_oak', 0.45], ['tree_beech', 0.8], ['tree_oak_old', 1]]
      : [['tree_oak', 0.36], ['tree_beech', 0.6], ['tree_oak_old', 0.68], ['tree_apple', 0.8], ['tree_pear', 0.9], ['tree_blossom', 1]];
    for (const [name, p] of table) if (h < p) return name;
    return 'tree_oak';
  };
  /* per boom: kleurvariant en verhoudingen (vast per tegel) */
  VE.treeLook = function (w, t) {
    const a = hash(t.k, 5151), b = hash(t.k, 6262), c = hash(t.k, 7373);
    let tint = TINTS[Math.floor(a * TINTS.length)];
    if ((t.type === 0) && c < 0.08) tint = 0xffe8bc;                // af en toe een boom met een warme, nazomerse tint
    return { tint: tint, vx: 0.9 + b * 0.22, vy: 0.88 + c * 0.27 };
  };
})(window.VE);
