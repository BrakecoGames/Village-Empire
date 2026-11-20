/* Village Empire — © 2026 Brakeco Games. All rights reserved. */
'use strict';
(function (VE) {
  const N = VE.N, DEFS = VE.DEFS;
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  const MAX_POP = 160;
  // footpath wear (one point per settler step onto a tile): a trail appears, becomes a path, and fades again when unused
  const TRAIL_ON = 5, PATH_ON = 14, PATH_OFF = 8, TRAIL_OFF = 2, PATH_MAX = 40;
  VE.PATH = { TRAIL_ON: TRAIL_ON, PATH_ON: PATH_ON, PATH_MAX: PATH_MAX };

  VE.bus = {
    h: {},
    on(e, f) { (this.h[e] = this.h[e] || []).push(f); },
    emit(e, a) { const l = this.h[e]; if (l) for (const f of l) { try { f(a); } catch (err) { console.error(err); } } }
  };
  const emit = (e, a) => VE.bus.emit(e, a);
  const sfx = (n, x, z) => emit('sfx', { n: n, x: x, z: z });

  /* ---------------- A* pathfinding ---------------- */
  class Pathfinder {
    constructor(w) {
      this.w = w; const n = N * N;
      this.g = new Float32Array(n); this.from = new Int32Array(n); this.seen = new Uint32Array(n); this.closed = new Uint32Array(n);
      this.stamp = 0; this.hk = []; this.hf = [];
    }
    // worn paths are cheaper, so settlers keep using (and deepening) the routes that already exist
    cost(k) { const w = this.w, r = w.road[k]; if (r === 2) return 0.6; if (r === 1) return 0.8; return w.type[k] === 2 ? 1.5 : 1.0; }
    push(k, f) {
      const hk = this.hk, hf = this.hf; let i = hk.length; hk.push(k); hf.push(f);
      while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= f) break; hk[i] = hk[p]; hf[i] = hf[p]; i = p; }
      hk[i] = k; hf[i] = f;
    }
    pop() {
      const hk = this.hk, hf = this.hf, top = hk[0];
      const lk = hk.pop(), lf = hf.pop(), n = hk.length;
      if (n > 0) {
        let i = 0;
        for (;;) { const l = 2 * i + 1; if (l >= n) break; const r = l + 1; const c = (r < n && hf[r] < hf[l]) ? r : l; if (hf[c] >= lf) break; hk[i] = hk[c]; hf[i] = hf[c]; i = c; }
        hk[i] = lk; hf[i] = lf;
      }
      return top;
    }
    find(s, t) {
      const w = this.w;
      if (s === t) return [t];
      const st = ++this.stamp; this.hk.length = 0; this.hf.length = 0;
      const ti = t % N, tj = (t / N) | 0;
      const h = k => { const dx = Math.abs(k % N - ti), dz = Math.abs(((k / N) | 0) - tj); return (Math.max(dx, dz) + 0.414 * Math.min(dx, dz)) * 0.55; };
      this.g[s] = 0; this.seen[s] = st; this.from[s] = -1; this.push(s, h(s));
      let found = false, iter = 0;
      while (this.hk.length) {
        const c = this.pop();
        if (this.closed[c] === st) continue;
        this.closed[c] = st;
        if (c === t) { found = true; break; }
        if (++iter > 5000) break;
        const ci = c % N, cj = (c / N) | 0, cc = this.cost(c);
        for (let q = 0; q < 8; q++) {
          const d = DIRS[q], ni = ci + d[0], nj = cj + d[1];
          if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
          const nk = nj * N + ni;
          if (this.closed[nk] === st) continue;
          if (nk !== t && !w.walkable(nk)) continue;
          if (d[2] > 1 && (!w.walkable(cj * N + ni) || !w.walkable(nj * N + ci))) continue;
          const ng = this.g[c] + d[2] * (cc + this.cost(nk)) * 0.5;
          if (this.seen[nk] !== st || ng < this.g[nk]) { this.g[nk] = ng; this.seen[nk] = st; this.from[nk] = c; this.push(nk, ng + h(nk)); }
        }
      }
      if (!found) return null;
      const path = []; let c = t;
      while (c !== -1) { path.push(c); c = this.from[c]; }
      return path.reverse();
    }
  }
  VE.Pathfinder = Pathfinder;

  /* ---------------- Settler ---------------- */
  class Settler {
    constructor(id, x, z) {
      this.id = id; this.x = x; this.z = z; this.rot = Math.random() * 6.28;
      this.mode = 'idle'; this.role = 'carrier';
      this.path = null; this.pi = 0; this.cb = null;
      this.carry = null; this.tool = null; this.act = null; this.ap = 0; this.wp = Math.random() * 6;
      this.moving = false; this.hidden = false; this.wt = 0.5 + Math.random() * 2;
      this.task = null; this.work = null; this.wstate = null; this.resv = null; this.onAct = null; this.actTick = 0;
    }
  }

  /* ---------------- Game ---------------- */
  class Game {
    constructor(scene) { this.scene = scene; }

    init(save) {
      this.root = new THREE.Group();
      this.scene.add(this.root);
      this.seed = save ? save.seed : ((Math.random() * 1e9) >>> 0);
      const rand = VE.rng(this.seed ^ 0x5bd1e995);
      const w = this.world = new VE.World(this.seed, this.root);
      w.generate();
      w.buildMeshes();
      w.buildDecor(rand);
      this.nature = new VE.Nature(w, this.root);
      this.pf = new Pathfinder(w);
      this.buildings = []; this.bmap = {}; this.settlers = [];
      this.bid = 0; this.sid = 0; this.time = 0;
      this.stock = {}; this.stockRes = {};
      for (const r of VE.RES_ORDER) { this.stock[r] = 0; this.stockRes[r] = 0; }
      this.gold = 0; this.rank = 0; this.claimed = {};
      this.stats = { produced: {}, goldEarned: 0, roads: 0, built: {}, upgrades: 0 };
      this.upg = {}; for (const u of VE.UPGRADES) this.upg[u.id] = 0;
      this.arriveT = 4; this.dispT = 0; this.roadsDirty = false; this.roadT = 0; this.wearT = 5;
      this.speed = 1;
      this.mats = {
        building: new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 6, specular: 0x161616 })
      };
      this.scaffolds = {};
      if (save) this.load(save, rand);
      else this.newVillage(rand);
      this.updateTerritory(true);
      if (!this.buildings.some(b => b.type === 'yard')) this.placeYard(); // new village, or a save from before stockyards
      w.rebuildRoads();
      this.nature.update(0, 1);
    }
    dispose() { this.scene.remove(this.root); }

    newVillage(rand) {
      this.nature.populate(rand);
      const s = this.world.start;
      this.placeBuilding('hq', s.i, s.j, true);
      Object.assign(this.stock, { log: 6, stone: 14, plank: 28, bread: 8, fish: 4 });
      this.gold = 40;
      for (let n = 0; n < 10; n++) this.spawnSettler();
    }

    /* Stockyard next to the Village Hall, without blocking the space in front of the hall's door */
    placeYard() {
      const hq = this.hq; if (!hq) return null;
      let best = null, bd = 1e9;
      for (let j = hq.j - 7; j <= hq.j + 7; j++) for (let i = hq.i - 7; i <= hq.i + 7; i++) {
        if (i + 1 >= hq.i - 1 && i <= hq.i + 2 && j + 1 >= hq.j + 2 && j <= hq.j + 4) continue; // keep the hall's front free
        if (!this.canPlace('yard', i, j, true).ok) continue;
        const d = (i + 1 - hq.cx) ** 2 + (j + 1 - hq.cz) ** 2;
        if (d < bd) { bd = d; best = [i, j]; }
      }
      return best ? this.placeBuilding('yard', best[0], best[1], true) : null;
    }

    /* ---------- helpers ---------- */
    get hq() { return this.buildings.find(b => b.type === 'hq'); }
    avail(r) { return (this.stock[r] || 0) - (this.stockRes[r] || 0); }
    tileOf(x, z) { const i = VE.clamp(Math.floor(x), 0, N - 1), j = VE.clamp(Math.floor(z), 0, N - 1); return j * N + i; }
    unlocked(type) { const d = DEFS[type]; return d.buildable !== false && d.rank <= this.rank; }
    maxLevel() { return this.rank >= 3 ? 3 : this.rank >= 1 ? 2 : 1; }
    popCap() {
      let c = 0;
      for (const b of this.buildings) if (b.alive && b.built && b.def.housing) c += b.def.housing + (b.def.levelHousing || 0) * (b.level - 1);
      return Math.min(MAX_POP, c);
    }
    lvlMult(b) { return 1 + 0.4 * (b.level - 1); }
    gatherMult(b) { return this.lvlMult(b) * (1 + 0.15 * this.upg.tools); }
    craftMult(b) { return this.lvlMult(b) * (1 + 0.15 * this.upg.craft); }
    tradeMult() { return 1 + 0.15 * this.upg.trade; }
    growMult() { return 1 + 0.2 * this.upg.soil; }
    walkSpeed() { return 1.15 * (1 + 0.12 * this.upg.boots); }
    cap(b) { return 4 + 2 * (b.level - 1); }
    outTotal(b) { let n = 0; for (const r in b.output) n += b.output[r]; return n; }
    outFull(b) { return this.outTotal(b) >= this.cap(b); }
    storages() { return this.buildings.filter(b => b.alive && b.built && b.def.storage); }
    nearestStorage(x, z) {
      let best = null, bd = 1e9;
      for (const b of this.buildings) if (b.alive && b.built && b.def.storage) { const d = (b.dx - x) ** 2 + (b.dz - z) ** 2; if (d < bd) { bd = d; best = b; } }
      return best;
    }
    countBuilt(type) { let n = 0; for (const b of this.buildings) if (b.alive && b.built && b.type === type) n++; return n; }
    canAfford(cost) {
      for (const r in cost) { if (r === 'gold') { if (this.gold < cost[r]) return false; } else if (this.avail(r) < cost[r]) return false; }
      return true;
    }
    pay(cost) { for (const r in cost) { if (r === 'gold') this.gold -= cost[r]; else this.stock[r] -= cost[r]; } }
    give(rew) {
      for (const r in rew) { if (r === 'gold') this.gold += rew[r]; else this.stock[r] = (this.stock[r] || 0) + rew[r]; }
    }

    /* ---------- placement ---------- */
    canPlace(type, i, j, force) {
      const def = DEFS[type], w = this.world, size = def.size || 1;
      if (!force && !this.unlocked(type)) return { ok: false, why: 'Not unlocked yet' };
      for (let dj = 0; dj < size; dj++) for (let di = 0; di < size; di++) {
        const a = i + di, b = j + dj;
        if (!w.inb(a, b)) return { ok: false, why: 'Outside the map' };
        const k = b * N + a;
        if (!w.owned[k]) return { ok: false, why: 'Outside your borders' };
        if (w.type[k] === 1) return { ok: false, why: 'Cannot build on water' };
        if (w.type[k] === 2) return { ok: false, why: 'Too rocky here' };
        if (w.bld[k]) return { ok: false, why: 'Space is taken' };
        if (w.door[k]) return { ok: false, why: 'An entrance is in the way' };
        if (w.rock[k]) return { ok: false, why: 'A boulder is in the way' };
        if (w.field[k]) return { ok: false, why: 'A field is in the way' };
      }
      if (w.slope(i, j, size) > (size > 1 ? 1.1 : 0.75)) return { ok: false, why: 'Ground too steep' };
      const di = i + (size > 1 ? 1 : 0), dj = j + size;
      if (!w.inb(di, dj)) return { ok: false, why: 'No room for an entrance' };
      const dk = dj * N + di;
      if (w.type[dk] === 1 || w.bld[dk] || w.rock[dk]) return { ok: false, why: 'Entrance is blocked' };
      if (def.gold && this.gold < def.gold) return { ok: false, why: 'Needs ' + def.gold + ' gold' };
      return { ok: true };
    }
    placeBuilding(type, i, j, instant) {
      const def = DEFS[type], w = this.world, size = def.size || 1;
      const b = {
        id: ++this.bid, type: type, def: def, i: i, j: j, size: size, level: 1, built: false, alive: true, used: 0, total: 0,
        delivered: {}, incoming: {}, input: {}, output: {}, outRes: {}, worker: null, builder: null, wt: 0, working: false,
        sell: {}, keep: 10, fields: [], status: '', sellIdx: 0, unreach: 0
      };
      b.cx = i + size / 2; b.cz = j + size / 2;
      b.doorI = i + (size > 1 ? 1 : 0); b.doorJ = j + size; b.doorK = b.doorJ * N + b.doorI;
      b.dx = b.doorI + 0.5; b.dz = b.doorJ + 0.32;
      if (def.cost) for (const r in def.cost) b.total += def.cost[r];
      if (def.market) for (const r of ['bread', 'fish', 'wine', 'flour']) b.sell[r] = true;
      for (let dj = 0; dj < size; dj++) for (let di = 0; di < size; di++) {
        const k = (j + dj) * N + i + di;
        w.bld[k] = b.id; w.road[k] = 0; w.wear[k] = 0;
        if (w.tree[k]) this.nature.removeTree(w.tree[k]);
        if (w.rock[k]) { w.rock[k].amount = 1; this.nature.mineRock(w.rock[k]); }
        if (w.field[k]) this.nature.removeField(w.field[k]);
        w.clearDeco(k);
      }
      w.door[b.doorK]++;
      const doorTiles = [b.doorK];
      if (size > 1) doorTiles.push(b.doorJ * N + i);
      for (const k of doorTiles) {
        if (w.tree[k]) this.nature.removeTree(w.tree[k]);
        if (w.field[k]) this.nature.removeField(w.field[k]);
        w.road[k] = 2; w.wear[k] = PATH_MAX; w.clearDeco(k);
      }
      b.y = w.flatten(i, j, size);
      this.nature.refreshArea(i - 1, j - 1, i + size, j + size);
      w.refreshDecoArea(i - 1, j - 1, i + size, j + size);
      w.recolor();
      this.makeMesh(b);
      this.buildings.push(b); this.bmap[b.id] = b;
      if (instant || b.total === 0) this.complete(b, true);
      this.roadsDirty = true;
      return b;
    }
    makeMesh(b) {
      if (b.group) this.root.remove(b.group);
      const md = VE.buildModel(b.type, b.level);
      const g = new THREE.Group();
      g.position.set(b.cx, b.y, b.cz);
      const mesh = new THREE.Mesh(md.geo, this.mats.building);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
      b.anims = md.anims.map(a => {
        const am = new THREE.Mesh(a.geo, this.mats.building);
        am.position.set(a.x, a.y, a.z); am.castShadow = true; g.add(am);
        return { mesh: am, kind: a.kind, ph: Math.random() * 6 };
      });
      b.chimneys = md.chimneys;
      b.group = g; b.mesh = mesh; g.userData.b = b;
      if (!b.built) {
        const key = b.size;
        if (!this.scaffolds[key]) this.scaffolds[key] = VE.scaffoldGeo(b.size);
        b.scaffold = new THREE.Mesh(this.scaffolds[key], this.mats.building);
        b.scaffold.castShadow = true;
        g.add(b.scaffold);
        for (const a of b.anims) a.mesh.visible = false;
        mesh.scale.y = 0.03 + 0.97 * (b.total ? b.used / b.total : 0);
      }
      this.root.add(g);
    }
    complete(b, silent) {
      b.built = true;
      if (b.scaffold) { b.group.remove(b.scaffold); b.scaffold = null; }
      b.mesh.scale.y = 1;
      for (const a of b.anims) a.mesh.visible = true;
      if (b.builder) { const s = b.builder; s.mode = 'idle'; s.tool = null; s.act = null; s.wt = 0.5; b.builder = null; }
      this.stats.built[b.type] = (this.stats.built[b.type] || 0) + 1;
      if (b.def.territory) this.updateTerritory();
      if (!silent) {
        emit('dust', { x: b.cx, y: b.y, z: b.cz, n: 14 });
        emit('toast', { text: b.def.icon + ' ' + b.def.name + ' is ready!' });
        sfx('done', b.cx, b.cz);
      }
    }
    updateTerritory(initial) {
      const c = [];
      for (const b of this.buildings) if (b.alive && b.built && b.def.territory) c.push({ x: b.cx, z: b.cz, r: b.def.territory + (b.level - 1) * 1.5 });
      this.world.setTerritory(c);
      for (const t of c) this.world.reveal(t.x, t.z, t.r + 2.5);   // your own land (and a little beyond) is known
      if (!initial) emit('territory', {});
    }
    upgrade(b) {
      if (!b.built || b.level >= this.maxLevel() || !b.def.cost) return false;
      const cost = VE.levelCost(b.def, b.level + 1);
      if (!this.canAfford(cost)) return false;
      this.pay(cost);
      b.level++;
      this.stats.upgrades++;
      this.makeMesh(b);
      if (b.def.territory) this.updateTerritory();
      emit('dust', { x: b.cx, y: b.y, z: b.cz, n: 10 });
      sfx('done', b.cx, b.cz);
      return true;
    }
    demolish(b) {
      if (!b || b.def.fixed || !b.alive) return;
      const w = this.world;
      b.alive = false;
      this.root.remove(b.group);
      for (let dj = 0; dj < b.size; dj++) for (let di = 0; di < b.size; di++) w.bld[(b.j + dj) * N + b.i + di] = 0;
      w.door[b.doorK] = Math.max(0, w.door[b.doorK] - 1);
      // refunds
      if (b.built) { if (b.def.cost) for (const r in b.def.cost) this.stock[r] += Math.floor(b.def.cost[r] / 2); }
      else for (const r in b.delivered) this.stock[r] += b.delivered[r];
      for (const r in b.input) this.stock[r] += b.input[r];
      for (const r in b.output) this.stock[r] += b.output[r] - (b.outRes[r] || 0);
      b.input = {}; b.output = {};
      if (b.worker) this.freeWorker(b.worker);
      if (b.builder) { const s = b.builder; s.mode = 'idle'; s.tool = null; s.act = null; b.builder = null; s.path = null; s.cb = null; }
      for (const f of b.fields) if (!f.dead) this.nature.removeField(f);
      b.fields = [];
      this.buildings = this.buildings.filter(x => x !== b);
      delete this.bmap[b.id];
      if (b.def.territory) this.updateTerritory();
      w.recolor();
      emit('dust', { x: b.cx, y: b.y, z: b.cz, n: 12 });
      sfx('demolish', b.cx, b.cz);
    }
    /* ---------- footpaths: they wear in where settlers walk a lot ---------- */
    tread(k, amt) {
      const w = this.world;
      if (w.type[k] === 1 || w.bld[k] || w.door[k]) return;
      w.wear[k] = Math.min(PATH_MAX, w.wear[k] + (amt === undefined ? 1 : amt));
      if (w.tree[k] || w.rock[k] || w.field[k]) return; // the path bends around trees and fields
      const lvl = w.wear[k] >= PATH_ON ? 2 : w.wear[k] >= TRAIL_ON ? 1 : 0;
      if (lvl > w.road[k]) {
        if (lvl === 2) this.stats.roads++;
        if (!w.road[k]) w.clearDeco(k);
        w.road[k] = lvl; this.roadsDirty = true;
      }
    }
    wearDecay() {
      // unused paths slowly grow over again (half-life about 4 minutes without traffic)
      const w = this.world;
      for (let k = 0; k < N * N; k++) {
        if (w.wear[k] <= 0 || w.door[k]) continue;
        let v = w.wear[k] * 0.985 - 0.01; if (v < 0) v = 0;
        w.wear[k] = v;
        const r = w.road[k];
        if (r === 2 && v < PATH_OFF) { w.road[k] = 1; this.roadsDirty = true; }
        else if (r === 1 && v < TRAIL_OFF) { w.road[k] = 0; this.roadsDirty = true; }
      }
    }

    /* ---------- settlers ---------- */
    spawnSettler(near) {
      if (this.settlers.length >= MAX_POP) return null;
      const hq = near || this.hq;
      const s = new Settler(++this.sid, hq.dx + (Math.random() - 0.5) * 0.8, hq.dz + 0.3 + Math.random() * 0.6);
      this.settlers.push(s);
      return s;
    }
    walkTo(s, tk, cb, fx, fz) {
      const sk = this.tileOf(s.x, s.z);
      const path = this.pf.find(sk, tk);
      if (!path) return false;
      const pts = [];
      for (let n = 1; n < path.length; n++) {
        const k = path[n], i = k % N, j = (k / N) | 0, last = n === path.length - 1;
        if (last && fx !== undefined) pts.push([fx, fz]);
        else pts.push([i + 0.5 + (last ? 0 : (Math.random() - 0.5) * 0.3), j + 0.5 + (last ? 0 : (Math.random() - 0.5) * 0.3)]);
      }
      if (!pts.length) pts.push([fx !== undefined ? fx : (tk % N) + 0.5, fz !== undefined ? fz : ((tk / N) | 0) + 0.5]);
      s.path = pts; s.pi = 0; s.cb = cb;
      return true;
    }
    walkToB(s, b, cb) { return this.walkTo(s, b.doorK, cb, b.dx + (Math.random() - 0.5) * 0.12, b.dz - 0.06); }
    moveSettler(s, dt) {
      const p = s.path[s.pi];
      const dx = p[0] - s.x, dz = p[1] - s.z, d = Math.hypot(dx, dz);
      const k = this.tileOf(s.x, s.z), w = this.world;
      if (k !== s.tk) { s.tk = k; this.tread(k, s.mode === 'wander' ? 0.25 : 1); } // strolling about barely wears the grass
      const sp = this.walkSpeed() * (w.road[k] === 2 ? 1.6 : w.road[k] === 1 ? 1.25 : 1) * (w.type[k] === 2 ? 0.8 : 1) * (s.carry ? 0.92 : 1);
      const step = sp * dt;
      if (d <= step) {
        s.x = p[0]; s.z = p[1]; s.pi++;
        if (s.pi >= s.path.length) { s.path = null; s.moving = false; const cb = s.cb; s.cb = null; if (cb) cb(); }
      } else {
        s.x += dx / d * step; s.z += dz / d * step;
        let tr = Math.atan2(dx, dz), dr = tr - s.rot;
        while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2;
        s.rot += dr * Math.min(1, dt * 12);
        s.moving = true; s.wp += dt * sp * 11;
      }
    }

    /* ---------- transport ---------- */
    startTransport(s, res, src, dst) {
      s.mode = 'carry'; s.task = { res: res, src: src, dst: dst, picked: false }; s.tool = null; s.act = null;
      if (src.def.storage) this.stockRes[res]++; else src.outRes[res] = (src.outRes[res] || 0) + 1;
      dst.incoming[res] = (dst.incoming[res] || 0) + 1;
      if (!this.walkToB(s, src, () => this.pickup(s))) this.failTask(s, true);
    }
    pickup(s) {
      const t = s.task; if (!t) return;
      if (!t.src.alive) { this.failTask(s); return; }
      if (t.src.def.storage) { this.stock[t.res]--; this.stockRes[t.res]--; }
      else { t.src.output[t.res]--; t.src.outRes[t.res]--; }
      t.picked = true; s.carry = t.res;
      if (!t.dst.alive) { this.redirect(s); return; }
      if (!this.walkToB(s, t.dst, () => this.deliver(s))) this.redirect(s);
    }
    redirect(s) {
      const t = s.task;
      if (t.dst.alive && t.dst.incoming[t.res]) t.dst.incoming[t.res]--;
      const st = this.nearestStorage(s.x, s.z);
      if (!st) { this.stock[t.res]++; s.carry = null; s.task = null; s.mode = 'idle'; return; }
      t.dst = st; st.incoming[t.res] = (st.incoming[t.res] || 0) + 1;
      if (!this.walkToB(s, st, () => this.deliver(s))) { st.incoming[t.res]--; this.stock[t.res]++; s.carry = null; s.task = null; s.mode = 'idle'; }
    }
    deliver(s) {
      const t = s.task; if (!t) return;
      const d = t.dst;
      if (!d.alive) { this.redirect(s); return; }
      if (d.incoming[t.res]) d.incoming[t.res]--;
      if (!d.built) d.delivered[t.res] = (d.delivered[t.res] || 0) + 1;
      else if (d.def.storage) this.stock[t.res]++;
      else d.input[t.res] = (d.input[t.res] || 0) + 1;
      s.carry = null; s.task = null; s.mode = 'idle'; s.wt = 0.2;
    }
    failTask(s, early) {
      const t = s.task;
      if (t) {
        if (!t.picked) {
          if (t.src.def.storage) this.stockRes[t.res]--; else if (t.src.alive) t.src.outRes[t.res]--;
          if (early) t.src.unreach = this.time + 6;
        } else { this.stock[t.res]++; }
        if (t.dst.alive && t.dst.incoming[t.res]) t.dst.incoming[t.res]--;
        if (early) t.dst.unreach = this.time + 6;
      }
      s.carry = null; s.task = null; s.mode = 'idle'; s.path = null; s.cb = null; s.wt = 1;
    }
    findConsumer(res, from) {
      let best = null, bd = 1e9;
      for (const b of this.buildings) {
        if (!b.alive || b === from || b.unreach > this.time) continue;
        let want = 0;
        if (!b.built) { if (b.def.cost && b.def.cost[res]) want = b.def.cost[res] - (b.delivered[res] || 0) - (b.incoming[res] || 0); }
        else if (b.def.inp && b.def.inp[res] && (!b.def.market)) want = this.cap(b) - (b.input[res] || 0) - (b.incoming[res] || 0);
        if (want <= 0) continue;
        const d = (b.dx - from.dx) ** 2 + (b.dz - from.dz) ** 2;
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    }
    dispatch() {
      const idle = [];
      for (const s of this.settlers) if (s.mode === 'idle' || s.mode === 'wander') idle.push(s);
      if (!idle.length) return;
      const take = (x, z) => {
        let bi = -1, bd = 1e9;
        for (let n = 0; n < idle.length; n++) { const s = idle[n], d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; bi = n; } }
        if (bi < 0) return null;
        const s = idle[bi]; idle.splice(bi, 1);
        s.path = null; s.cb = null; s.moving = false;
        return s;
      };
      const T = this.time, B = this.buildings;
      const alive = b => b.alive && b.unreach <= T;
      // each step assigns at most `cap` settlers and returns how many it used
      const steps = [
        // staff buildings
        cap => { let n = 0; for (const b of B) { if (n >= cap || !idle.length) break; if (!alive(b) || !b.built || !b.def.worker || b.worker) continue; const s = take(b.dx, b.dz); if (!s) break; this.assignWorker(s, b); n++; } return n; },
        // construction materials
        cap => {
          let n = 0;
          for (const b of B) {
            if (!alive(b) || b.built || !b.def.cost) continue;
            for (const r in b.def.cost) {
              let need = b.def.cost[r] - (b.delivered[r] || 0) - (b.incoming[r] || 0);
              while (need > 0 && n < cap && idle.length && this.avail(r) > 0) {
                const src = this.nearestStorage(b.dx, b.dz); if (!src) break;
                const s = take(src.dx, src.dz); if (!s) break;
                this.startTransport(s, r, src, b); need--; n++;
              }
            }
          }
          return n;
        },
        // builders
        cap => {
          let n = 0;
          for (const b of B) {
            if (n >= cap || !idle.length) break;
            if (!alive(b) || b.built || b.builder) continue;
            let has = -b.used; for (const r in b.delivered) has += b.delivered[r];
            for (const r in b.incoming) has += b.incoming[r];
            if (has <= 0) continue;
            const s = take(b.dx, b.dz); if (!s) break;
            this.assignBuilder(s, b); n++;
          }
          return n;
        },
        // finished goods straight to a consumer (or to storage when the workshop is full)
        cap => this.moveOutputs(take, idle, cap, true),
        // workshop inputs from storage
        cap => {
          let n = 0;
          for (const b of B) {
            if (!alive(b) || !b.built || !b.def.inp) continue;
            for (const r in b.def.inp) {
              let want = this.cap(b) - (b.input[r] || 0) - (b.incoming[r] || 0);
              while (want > 0 && n < cap && idle.length && this.avail(r) > 0) {
                const src = this.nearestStorage(b.dx, b.dz); if (!src) break;
                const s = take(src.dx, src.dz); if (!s) break;
                this.startTransport(s, r, src, b); want--; n++;
              }
            }
          }
          return n;
        },
        // markets
        cap => {
          let n = 0;
          for (const b of B) {
            if (!alive(b) || !b.built || !b.def.market) continue;
            let pending = 0; for (const r in b.input) pending += b.input[r]; for (const r in b.incoming) pending += b.incoming[r];
            for (const r of VE.RES_ORDER) {
              if (!b.sell[r]) continue;
              while (pending < 6 && n < cap && idle.length && this.avail(r) > b.keep) {
                const src = this.nearestStorage(b.dx, b.dz); if (!src) break;
                const s = take(src.dx, src.dz); if (!s) break;
                this.startTransport(s, r, src, b); pending++; n++;
              }
            }
          }
          return n;
        },
        // everything else into storage
        cap => this.moveOutputs(take, idle, cap, false)
      ];
      for (let pass = 0; pass < 2; pass++) {
        for (const st of steps) {
          if (!idle.length) return;
          st(pass === 0 ? Math.max(1, Math.ceil(idle.length * 0.5)) : 1e9);
        }
      }
    }
    moveOutputs(take, idle, cap, consumerOnly) {
      let n = 0;
      for (const b of this.buildings) {
        if (!b.alive || b.unreach > this.time) continue;
        for (const r in b.output) {
          while (b.output[r] - (b.outRes[r] || 0) > 0 && n < cap && idle.length) {
            let dst = this.findConsumer(r, b);
            if (!dst) {
              if (consumerOnly && !this.outFull(b)) break;
              dst = this.nearestStorage(b.dx, b.dz);
            }
            if (!dst) break;
            const s = take(b.dx, b.dz); if (!s) return n;
            this.startTransport(s, r, b, dst); n++;
          }
        }
      }
      return n;
    }

    /* ---------- builders ---------- */
    assignBuilder(s, b) {
      b.builder = s; s.mode = 'build'; s.work = b; s.tool = 'hammer'; s.act = null; s.bstate = 'go';
      const ok = this.walkTo(s, b.doorK, () => { s.bstate = 'at'; s.wt = 1.1; s.rot = Math.atan2(b.cx - s.x, b.cz - s.z); }, b.dx + (Math.random() - 0.5) * 0.3, b.dz + 0.05);
      if (!ok) { b.builder = null; b.unreach = this.time + 6; s.mode = 'idle'; s.tool = null; }
    }
    updateBuilder(s, dt) {
      const b = s.work;
      if (!b || !b.alive || b.built) { s.mode = 'idle'; s.tool = null; s.act = null; s.work = null; return; }
      if (s.bstate !== 'at') return;
      let has = 0; for (const r in b.delivered) has += b.delivered[r];
      if (has - b.used > 0) {
        s.act = 'hammer'; s.ap += dt; s.wt -= dt;
        if (Math.floor(s.ap / 0.45) !== s.actTick) { s.actTick = Math.floor(s.ap / 0.45); sfx('hammer', s.x, s.z); }
        if (s.wt <= 0) {
          b.used++; s.wt = 1.1;
          b.mesh.scale.y = 0.03 + 0.97 * (b.used / b.total);
          if (b.used >= b.total) this.complete(b);
        }
      } else {
        s.act = null;
        let inc = 0; for (const r in b.incoming) inc += b.incoming[r];
        if (inc === 0) {
          s.waitT = (s.waitT || 0) + dt;
          if (s.waitT > 3) { s.waitT = 0; b.builder = null; s.mode = 'idle'; s.tool = null; s.work = null; s.wt = 0.5; }
        } else s.waitT = 0;
      }
    }
    remainingCost(b) {
      const c = {}; if (!b.def.cost) return c;
      for (const r in b.def.cost) { const n = b.def.cost[r] - (b.delivered[r] || 0) - (b.incoming[r] || 0); if (n > 0) c[r] = n; }
      return c;
    }

    /* ---------- workers ---------- */
    assignWorker(s, b) {
      b.worker = s; s.mode = 'goWork'; s.work = b; s.role = b.def.worker; s.tool = b.def.tool || null;
      const ok = this.walkToB(s, b, () => {
        if (!b.alive || b.worker !== s) { this.freeWorker(s); return; }
        s.mode = 'work'; s.wstate = 'inside'; s.hidden = true; s.wt = 0.6; s.x = b.dx; s.z = b.dz;
      });
      if (!ok) { b.worker = null; b.unreach = this.time + 6; s.mode = 'idle'; s.role = 'carrier'; s.tool = null; s.work = null; }
    }
    freeWorker(s) {
      const b = s.work;
      if (b && b.worker === s) b.worker = null;
      if (s.resv) { s.resv.reserved = false; s.resv = null; }
      if (s.carry && b) { this.stock[s.carry]++; }
      s.carry = null; s.mode = 'idle'; s.role = 'carrier'; s.tool = null; s.act = null; s.work = null; s.hidden = false; s.path = null; s.cb = null; s.wstate = null; s.wt = 0.5;
      if (b) { s.x = b.dx; s.z = b.dz + 0.1; }
    }
    goAct(s, b, tk, fx, fz, face, act, time, done) {
      s.hidden = false; s.x = b.dx; s.z = b.dz; s.wstate = 'walk'; s.act = null;
      return this.walkTo(s, tk, () => {
        if (!b.alive || b.worker !== s) { this.freeWorker(s); return; }
        s.wstate = 'act'; s.act = act; s.ap = 0; s.actTick = 0; s.wt = time;
        if (face) s.rot = Math.atan2(face[0] - s.x, face[1] - s.z);
        s.onAct = done;
      }, fx, fz);
    }
    goHome(s, b, carry, done) {
      s.carry = carry; s.wstate = 'walk'; s.act = null;
      const arrive = () => {
        if (!b.alive || b.worker !== s) { if (carry) { this.stock[carry]++; s.carry = null; } this.freeWorker(s); return; }
        s.carry = null; s.hidden = true; s.wstate = 'inside'; s.wt = 1.0; s.x = b.dx; s.z = b.dz;
        if (done) done();
      };
      if (!this.walkToB(s, b, arrive)) arrive();
    }
    produce(b, res, n) {
      b.output[res] = (b.output[res] || 0) + n;
      this.stats.produced[res] = (this.stats.produced[res] || 0) + n;
      emit('float', { x: b.cx, y: b.y + 0.9, z: b.cz, text: '+' + n, icon: res });
    }
    earn(g, x, y, z) {
      this.gold += g; this.stats.goldEarned += g;
      emit('float', { x: x, y: y, z: z, text: '+' + g, icon: 'gold' });
      sfx('coin', x, z);
    }
    standPoint(b, x, z, d) {
      let vx = b.dx - x, vz = b.dz - z; const l = Math.hypot(vx, vz) || 1;
      return [x + vx / l * d, z + vz / l * d];
    }
    inRange(b, i, j, r) { const dx = i + 0.5 - b.cx, dz = j + 0.5 - b.cz; return dx * dx + dz * dz <= r * r; }
    tilesInRange(b, r) {
      const out = [];
      for (let j = Math.floor(b.cz - r); j <= Math.ceil(b.cz + r); j++) for (let i = Math.floor(b.cx - r); i <= Math.ceil(b.cx + r); i++) {
        if (!this.world.inb(i, j) || !this.inRange(b, i, j, r)) continue;
        out.push(j * N + i);
      }
      return out;
    }
    freeTile(k) {
      const w = this.world;
      return w.type[k] !== 1 && w.type[k] !== 2 && !w.bld[k] && !w.road[k] && !w.door[k] && !w.tree[k] && !w.rock[k] && !w.field[k];
    }
    think(s, b) {
      const d = b.def, w = this.world;
      s.tool = d.tool || null;
      if (d.gather) {
        if (d.gather !== 'plant' && this.outFull(b)) { b.status = 'Waiting for carriers'; s.wt = 1; return; }
        const gm = this.gatherMult(b);
        if (d.gather === 'tree') {
          let best = null, bd = 1e9;
          for (const t of this.nature.trees) {
            if (t.dead || t.falling || t.reserved || t.growth < 1) continue;
            const dd = (t.x - b.cx) ** 2 + (t.z - b.cz) ** 2;
            if (dd < d.radius * d.radius && dd < bd) { bd = dd; best = t; }
          }
          if (!best) { b.status = 'No mature trees in range'; s.wt = 3; return; }
          const t = best; t.reserved = true; s.resv = t; b.status = 'Felling trees';
          const sp = this.standPoint(b, t.x, t.z, 0.3);
          const ok = this.goAct(s, b, t.k, sp[0], sp[1], [t.x, t.z], 'chop', d.time / gm, () => {
            s.resv = null; t.reserved = false;
            if (t.dead || t.falling) { this.goHome(s, b, null); return; }
            this.nature.fellTree(t); sfx('fall', t.x, t.z);
            emit('leaves', { x: t.x, y: w.heightAt(t.x, t.z) + 0.6, z: t.z });
            this.goHome(s, b, 'log', () => this.produce(b, 'log', 1));
          });
          if (!ok) { t.reserved = false; s.resv = null; s.hidden = true; s.wstate = 'inside'; s.wt = 3; b.status = 'Cannot reach the trees'; }
        } else if (d.gather === 'plant') {
          let cnt = 0;
          for (const t of this.nature.trees) if (!t.dead && t.growth < 1 && (t.x - b.cx) ** 2 + (t.z - b.cz) ** 2 < d.radius * d.radius) cnt++;
          if (cnt >= 12) { b.status = 'Young trees are growing'; s.wt = 3; return; }
          const cand = this.tilesInRange(b, d.radius).filter(k => this.freeTile(k) && w.tileH(k % N, (k / N) | 0) > 0.15 && Math.hypot((k % N) + 0.5 - b.cx, ((k / N) | 0) + 0.5 - b.cz) > 1.6);
          if (!cand.length) { b.status = 'No free soil to plant'; s.wt = 4; return; }
          const k = cand[Math.floor(Math.random() * cand.length)];
          const i = k % N, j = (k / N) | 0;
          b.status = 'Planting trees';
          const ok = this.goAct(s, b, k, i + 0.5 + 0.25, j + 0.5 + 0.2, [i + 0.5, j + 0.5], 'dig', d.time / gm, () => {
            if (this.freeTile(k)) { this.nature.addTree(i, j, w.mount[k] > 0.15 ? 1 : (Math.random() < 0.25 ? 2 : 0), 0.04); w.clearDeco(k); sfx('plant', i, j); }
            this.goHome(s, b, null);
          });
          if (!ok) { s.hidden = true; s.wstate = 'inside'; s.wt = 3; }
        } else if (d.gather === 'rock') {
          let best = null, bd = 1e9;
          for (const r of this.nature.rocks) {
            if (r.dead || r.reserved) continue;
            // boulders are solid: only pick one with a free tile beside it (inner boulders of a cluster come later)
            const ri = r.k % N, rj = (r.k / N) | 0;
            let open = false;
            for (const dd of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = ri + dd[0], c = rj + dd[1]; if (w.inb(a, c) && w.walkable(c * N + a)) { open = true; break; } }
            if (!open) continue;
            const dd = (r.x - b.cx) ** 2 + (r.z - b.cz) ** 2;
            if (dd < d.radius * d.radius && dd < bd) { bd = dd; best = r; }
          }
          if (!best) { b.status = 'No stone in range'; s.wt = 3; return; }
          const r = best; r.reserved = true; s.resv = r; b.status = 'Cutting stone';
          // stand at the edge of the boulder, on its open side nearest to the quarry
          let sp = this.standPoint(b, r.x, r.z, 0.36), sd = 1e9;
          { const ri = r.k % N, rj = (r.k / N) | 0;
            for (const dd of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const a = ri + dd[0], c = rj + dd[1];
              if (!w.inb(a, c) || !w.walkable(c * N + a)) continue;
              const q = (a + 0.5 - b.dx) ** 2 + (c + 0.5 - b.dz) ** 2;
              if (q < sd) { sd = q; sp = [ri + 0.5 + dd[0] * 0.46, rj + 0.5 + dd[1] * 0.46]; }
            } }
          const ok = this.goAct(s, b, r.k, sp[0], sp[1], [r.x, r.z], 'pick', d.time / gm, () => {
            s.resv = null; r.reserved = false;
            if (r.dead) { this.goHome(s, b, null); return; }
            this.nature.mineRock(r);
            emit('dust', { x: r.x, y: w.heightAt(r.x, r.z) + 0.2, z: r.z, n: 5, stone: true });
            this.goHome(s, b, 'stone', () => this.produce(b, 'stone', 1));
          });
          if (!ok) { r.reserved = false; s.resv = null; s.hidden = true; s.wstate = 'inside'; s.wt = 3; b.status = 'Cannot reach the stone'; }
        } else if (d.gather === 'field') {
          b.fields = b.fields.filter(f => !f.dead);
          const res = d.out;
          let f = b.fields.find(x => x.state === 'grown' && !x.reserved);
          let act = 'harvest';
          if (!f) { f = b.fields.find(x => x.state === 'empty' && !x.reserved); act = 'sow'; }
          let newK = -1;
          if (!f && b.fields.length < d.maxFields + 2 * (b.level - 1)) {
            const cand = this.tilesInRange(b, d.radius + (b.level - 1) * 0.5).filter(k => this.freeTile(k) && w.owned[k] && w.type[k] === 0 && w.slope(k % N, (k / N) | 0) < 0.5);
            if (cand.length) {
              cand.sort((a, c) => ((a % N) + 0.5 - b.cx) ** 2 + (((a / N) | 0) + 0.5 - b.cz) ** 2 - (((c % N) + 0.5 - b.cx) ** 2 + (((c / N) | 0) + 0.5 - b.cz) ** 2));
              newK = cand[0]; act = 'sow';
            }
          }
          if (!f && newK < 0) { b.status = b.fields.length ? 'Crops are growing' : 'No free farmland nearby'; s.wt = 2; return; }
          const k = f ? f.k : newK, i = k % N, j = (k / N) | 0;
          if (f) f.reserved = true;
          s.resv = f || null;
          b.status = act === 'harvest' ? 'Harvesting' : 'Sowing';
          s.tool = act === 'harvest' ? d.tool : null;
          const ok = this.goAct(s, b, k, i + 0.5 + (Math.random() - 0.5) * 0.4, j + 0.5 + 0.3, [i + 0.5, j + 0.5], act, (act === 'harvest' ? d.time : 1.8) / gm, () => {
            s.resv = null; if (f) f.reserved = false;
            if (act === 'harvest') {
              if (f.dead) { this.goHome(s, b, null); return; }
              f.state = 'empty'; f.growth = 0; this.nature.setFieldM(f);
              this.goHome(s, b, res, () => this.produce(b, res, 1));
            } else {
              if (f && !f.dead) { f.state = 'growing'; f.growth = 0; this.nature.setFieldM(f); }
              else if (!f && this.freeTile(k)) { const nf = this.nature.addField(i, j, d.fieldKind, b); if (nf) b.fields.push(nf); }
              this.goHome(s, b, null);
            }
          });
          if (!ok) { if (f) f.reserved = false; s.resv = null; s.hidden = true; s.wstate = 'inside'; s.wt = 3; }
        } else if (d.gather === 'fish') {
          const spots = [];
          for (const k of this.tilesInRange(b, d.radius)) {
            if (!w.walkable(k)) continue;
            const i = k % N, j = (k / N) | 0;
            for (const dd of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const a = i + dd[0], c = j + dd[1];
              if (w.inb(a, c) && w.type[c * N + a] === 1) { spots.push({ k: k, i: i, j: j, wx: a + 0.5, wz: c + 0.5, d: (i - b.cx) ** 2 + (j - b.cz) ** 2 }); break; }
            }
          }
          if (!spots.length) { b.status = 'No water in range'; s.wt = 4; return; }
          spots.sort((a, c) => a.d - c.d);
          const sp = spots[Math.floor(Math.random() * Math.min(6, spots.length))];
          const fx = VE.lerp(sp.i + 0.5, sp.wx, 0.42), fz = VE.lerp(sp.j + 0.5, sp.wz, 0.42);
          b.status = 'Fishing';
          const ok = this.goAct(s, b, sp.k, fx, fz, [sp.wx, sp.wz], 'fish', d.time / gm, () => {
            emit('splash', { x: VE.lerp(fx, sp.wx, 0.9), z: VE.lerp(fz, sp.wz, 0.9) });
            if (Math.random() < 0.85) this.goHome(s, b, 'fish', () => this.produce(b, 'fish', 1));
            else this.goHome(s, b, null);
          });
          if (!ok) { s.hidden = true; s.wstate = 'inside'; s.wt = 3; }
        }
      }
      // indoor workers just stay inside; the building does the work
      else { s.wt = 0.5; }
    }
    updateWorker(s, dt) {
      const b = s.work;
      if (!b || !b.alive) { this.freeWorker(s); return; }
      if (s.wstate === 'inside') { s.wt -= dt; if (s.wt <= 0) this.think(s, b); }
      else if (s.wstate === 'act') {
        s.wt -= dt; s.ap += dt;
        const per = s.act === 'chop' ? 0.75 : s.act === 'pick' ? 0.6 : 0.9;
        const tick = Math.floor(s.ap / per);
        if (tick !== s.actTick) { s.actTick = tick; if (s.act === 'chop') sfx('chop', s.x, s.z); else if (s.act === 'pick') sfx('pick', s.x, s.z); }
        if (s.wt <= 0) { s.act = null; const f = s.onAct; s.onAct = null; if (f) f(); }
      }
    }
    updateBuilding(b, dt) {
      const d = b.def;
      for (const a of b.anims) {
        if (a.kind === 'sails') { a.speed = VE.lerp(a.speed || 0, b.working ? 1.6 : 0.15, dt * 0.8); a.mesh.rotation.z -= a.speed * dt; }
        else if (a.kind === 'saw') { if (b.working) a.mesh.rotation.z -= dt * 14; }
        else if (a.kind === 'flag') { a.ph += dt * 2.2; a.mesh.rotation.y = Math.sin(a.ph) * 0.35 + Math.sin(a.ph * 2.3) * 0.12; }
      }
      if (!b.built) return;
      // smoke
      if (b.chimneys.length) {
        b.smokeT = (b.smokeT || Math.random()) - dt;
        const active = d.storage || d.housing || b.working || (b.worker && b.worker.hidden);
        if (b.smokeT <= 0) {
          b.smokeT = active ? (b.working ? 0.35 : 0.9) : 2.5;
          if (active) for (const c of b.chimneys) emit('smoke', { x: b.cx + c[0], y: b.y + c[1], z: b.cz + c[2] });
        }
      }
      const s = b.worker;
      const present = s && s.mode === 'work' && s.wstate === 'inside';
      if (d.market) {
        if (!present) { b.status = s ? 'Merchant is on the way' : 'Needs a merchant'; return; }
        let total = 0; for (const r in b.input) total += b.input[r];
        if (!total) { b.status = 'Waiting for goods to sell'; b.working = false; return; }
        b.working = true; b.status = 'Trading';
        b.wt -= dt * this.lvlMult(b);
        if (b.wt <= 0) {
          b.wt = 2.4;
          const keys = VE.RES_ORDER.filter(r => b.input[r] > 0);
          const r = keys[b.sellIdx++ % keys.length];
          b.input[r]--;
          this.earn(Math.round(VE.RES[r].price * this.tradeMult()), b.cx, b.y + 1, b.cz);
        }
        return;
      }
      if (!d.inp) return;
      if (!present) { b.status = s ? 'Worker is on the way' : 'Needs a worker'; b.working = false; return; }
      if (!b.working) {
        let ok = true; for (const r in d.inp) if ((b.input[r] || 0) < d.inp[r]) ok = false;
        if (!ok) { b.status = 'Waiting for ' + Object.keys(d.inp).map(r => VE.RES[r].name.toLowerCase()).join(' & '); return; }
        if (d.out && this.outFull(b)) { b.status = 'Waiting for carriers'; return; }
        for (const r in d.inp) b.input[r] -= d.inp[r];
        b.working = true; b.wt = d.time; b.status = 'Working';
      } else {
        b.wt -= dt * this.craftMult(b);
        if (b.wt <= 0) {
          b.working = false;
          if (d.out) for (const r in d.out) this.produce(b, r, d.out[r]);
          if (d.outGold) this.earn(Math.round(d.outGold * this.tradeMult()), b.cx, b.y + 1.1, b.cz);
        }
      }
    }
    updateIdle(s, dt) {
      if (s.path) return;
      s.wt -= dt;
      if (s.wt > 0) return;
      s.wt = 2 + Math.random() * 5;
      const w = this.world;
      const hq = this.hq;
      const cx = (s.x * 2 + hq.dx) / 3, cz = (s.z * 2 + hq.dz + 1) / 3;
      for (let tries = 0; tries < 6; tries++) {
        const i = Math.floor(cx + (Math.random() - 0.5) * 6), j = Math.floor(cz + (Math.random() - 0.5) * 6);
        if (!w.inb(i, j)) continue;
        const k = j * N + i;
        if (!w.walkable(k) || !w.owned[k]) continue;
        s.mode = 'wander';
        if (this.walkTo(s, k, () => { s.mode = 'idle'; }, i + 0.2 + Math.random() * 0.6, j + 0.2 + Math.random() * 0.6)) return;
        s.mode = 'idle';
      }
    }

    /* ---------- main update ---------- */
    update(dt) {
      this.time += dt;
      const w = this.world;
      // settlers
      for (const s of this.settlers) {
        if (s.path) this.moveSettler(s, dt); else s.moving = false;
        if (s.mode === 'work') this.updateWorker(s, dt);
        else if (s.mode === 'build') this.updateBuilder(s, dt);
        else if (s.mode === 'idle' || s.mode === 'wander') this.updateIdle(s, dt);
        s.y = w.heightAt(s.x, s.z);
      }
      for (const b of this.buildings) this.updateBuilding(b, dt);
      this.nature.update(dt, this.growMult());
      // exploration: wherever settlers walk, the clouds lift
      this.fogT = (this.fogT || 0) - dt;
      if (this.fogT <= 0) {
        this.fogT = 0.4;
        for (const s of this.settlers) if (!s.hidden) w.reveal(s.x, s.z, 4.5);
      }
      w.updateFog();
      this.dispT -= dt;
      if (this.dispT <= 0) { this.dispT = 0.25; this.dispatch(); }
      // newcomers
      this.arriveT -= dt;
      if (this.arriveT <= 0) {
        const cap = this.popCap();
        if (this.settlers.length < cap) {
          const food = this.avail('bread') > 0 ? 'bread' : this.avail('fish') > 0 ? 'fish' : null;
          if (food) this.stock[food]--;
          const s = this.spawnSettler();
          if (s) emit('arrive', { x: s.x, z: s.z });
          const tav = this.countBuilt('tavern');
          this.arriveT = (food ? 6.5 : 20) * Math.max(0.45, 1 - tav * 0.15);
        } else this.arriveT = 3;
      }
      this.wearT -= dt; if (this.wearT <= 0) { this.wearT = 5; this.wearDecay(); }
      if (this.roadsDirty) { this.roadT -= dt; if (this.roadT <= 0) { this.roadT = 0.12; this.roadsDirty = false; w.rebuildRoads(); } }
    }

    /* ---------- quests ---------- */
    questProgress(q) {
      switch (q.type) {
        case 'roads': return this.stats.roads;
        case 'build': return this.stats.built[q.b] || 0;
        case 'produce': return this.stats.produced[q.res] || 0;
        case 'gold': return this.stats.goldEarned;
        case 'pop': return this.settlers.length;
        case 'upgrade': return this.stats.upgrades;
      }
      return 0;
    }
    claim(q) {
      if (this.claimed[q.id] || this.questProgress(q) < q.n) return false;
      this.claimed[q.id] = true; this.give(q.reward);
      sfx('coin', this.hq.cx, this.hq.cz);
      return true;
    }
    canPromote() {
      const r = VE.RANKS[this.rank];
      if (!r || !VE.RANKS[this.rank + 1]) return false;
      return r.quests.every(q => this.claimed[q.id]);
    }
    promote() {
      if (!this.canPromote()) return false;
      this.rank++;
      sfx('fanfare', this.hq.cx, this.hq.cz);
      emit('promote', { rank: this.rank });
      return true;
    }

    /* ---------- trade ---------- */
    sellPrice(r) { return Math.max(1, Math.round(VE.RES[r].price * this.tradeMult() * 0.8)); }
    buyPrice(r) { return Math.max(2, Math.round(VE.RES[r].price * 2.2)); }
    trade(r, n) {
      if (n > 0) { const c = this.buyPrice(r) * n; if (this.gold < c) return false; this.gold -= c; this.stock[r] += n; return true; }
      n = -n; if (this.avail(r) < n) return false;
      this.stock[r] -= n; const g = this.sellPrice(r) * n; this.gold += g; this.stats.goldEarned += g; return true;
    }
    buyUpgrade(id) {
      const u = VE.UPGRADES.find(x => x.id === id), lvl = this.upg[id];
      if (!u || lvl >= u.cost.length || this.gold < u.cost[lvl]) return false;
      this.gold -= u.cost[lvl]; this.upg[id]++;
      return true;
    }

    /* ---------- save / load ---------- */
    serialize(cam) {
      const w = this.world, roads = [];
      for (let k = 0; k < N * N; k++) if (w.wear[k] >= 1 && !w.door[k] && !w.bld[k]) roads.push([k, Math.round(w.wear[k])]);
      return {
        v: 1, seed: this.seed, time: Math.round(this.time), stock: this.stock, gold: this.gold, rank: this.rank, claimed: this.claimed,
        stats: this.stats, upg: this.upg, pop: this.settlers.length, speed: this.speed,
        buildings: this.buildings.filter(b => b.alive).map(b => ({
          id: b.id, t: b.type, i: b.i, j: b.j, l: b.level, b: b.built ? 1 : 0, u: b.used,
          d: b.built ? {} : b.delivered, inp: b.input, out: b.output, sell: b.sell, keep: b.keep
        })),
        roads: roads, nature: this.nature.serialize(), fog: w.serializeFog(), cam: cam || null, saved: Date.now()
      };
    }
    load(sv, rand) {
      const w = this.world;
      this.gold = sv.gold || 0; this.rank = sv.rank || 0; this.claimed = sv.claimed || {}; this.time = sv.time || 0;
      for (const r of VE.RES_ORDER) this.stock[r] = (sv.stock && sv.stock[r]) || 0;
      Object.assign(this.stats, sv.stats || {});
      Object.assign(this.upg, sv.upg || {});
      this.speed = sv.speed || 1;
      if (sv.fog) w.loadFog(sv.fog); // older saves: only the land around your borders starts discovered
      const idmap = {};
      for (const bs of sv.buildings) {
        if (!DEFS[bs.t]) continue;
        const b = this.placeBuilding(bs.t, bs.i, bs.j, bs.b === 1);
        idmap[bs.id] = b;
        if (bs.l > 1) { b.level = bs.l; this.makeMesh(b); }
        if (!b.built) { b.delivered = bs.d || {}; b.used = bs.u || 0; b.mesh.scale.y = 0.03 + 0.97 * (b.total ? b.used / b.total : 0); }
        b.input = bs.inp || {}; b.output = bs.out || {}; if (bs.sell) b.sell = bs.sell; if (bs.keep !== undefined) b.keep = bs.keep;
      }
      // stats.built was re-incremented by instant completes; restore the saved values
      if (sv.stats && sv.stats.built) this.stats.built = Object.assign({}, sv.stats.built);
      // roads: [tile, wear] pairs; older saves stored plain tile numbers of player-built roads → full paths
      for (const e of sv.roads || []) {
        const k = Array.isArray(e) ? e[0] : e, v = Array.isArray(e) ? e[1] : PATH_MAX;
        if (w.bld[k] || w.door[k] || w.type[k] === 1) continue;
        w.wear[k] = Math.min(PATH_MAX, v);
        const lvl = v >= PATH_OFF ? 2 : v >= TRAIL_OFF ? 1 : 0;
        if (lvl) { w.road[k] = lvl; w.clearDeco(k); }
      }
      const nat = sv.nature || { t: [], r: [], f: [] };
      for (const t of nat.t) { const k = t[0]; if (!w.bld[k] && !w.road[k]) this.nature.addTree(k % N, (k / N) | 0, t[1], t[2], rand); }
      for (const r of nat.r) { const k = r[0]; if (!w.bld[k]) { this.nature.addRock(k % N, (k / N) | 0, r[1], rand); w.clearDeco(k); } }
      for (const f of nat.f) {
        const k = f[0]; if (w.bld[k] || w.road[k]) continue;
        const owner = idmap[f[4]];
        const fo = this.nature.addField(k % N, (k / N) | 0, f[1], owner || null);
        if (fo) { fo.growth = f[2]; fo.state = f[3]; this.nature.setFieldM(fo); if (owner) owner.fields.push(fo); }
      }
      const n = Math.max(4, sv.pop || 10);
      for (let i = 0; i < n; i++) this.spawnSettler();
      for (const s of this.settlers) { s.x += (Math.random() - 0.5) * 2; s.z += Math.random() * 1.2; }
    }
  }
  VE.Game = Game;
})(window.VE);
