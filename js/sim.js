/* Village Empire — © 2026 Brakeco Games. All rights reserved. */
'use strict';
(function (VE) {
  let N = VE.N; const DEFS = VE.DEFS;
  (VE.sizeHooks = VE.sizeHooks || []).push(n => { N = n; });
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  const MAX_POP = 160;
  // voetpaden: zie js/paths.js (slijtage per 1/4 tegel op de echte looproute, vijf stadia, langzaam herstel)

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
      this.maxIter = Math.max(5000, Math.round(n * 0.6));          // grote wereld: verder zoeken (lange routes)
    }
    // worn paths are cheaper, so settlers keep using (and deepening) the routes that already exist
    cost(k) {
      const w = this.w, r = w.road[k]; if (r === 2) return 0.6; if (r === 1) return 0.8;
      const sl = w.slopeOf(k);                            // steilte van de tegel: bergop is zwaarder
      return (w.type[k] === 2 ? 1.25 : 1.0) + Math.min(1.2, sl * 0.35);
    }
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
        if (++iter > this.maxIter) break;
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
      this.owner = 0;                                              // speler (multiplayer-voorbereiding)
    }
  }

  /* ---------------- Game ---------------- */
  class Game {
    constructor(scene) { this.scene = scene; }

    init(save) {
      // wereldgrootte: oude saves 64 × 64; nieuwe werelden groot (VE.BIG_N), tenzij ?small in de URL (tests/oud)
      const small = typeof location !== 'undefined' && /[?&]small(&|$|=)/.test(location.search);
      VE.setWorldSize(save ? (save.n || 64) : (small ? 64 : VE.BIG_N));
      this.root = new THREE.Group();
      this.scene.add(this.root);
      this.seed = save ? save.seed : ((Math.random() * 1e9) >>> 0);
      const rand = VE.rng(this.seed ^ 0x5bd1e995);
      const w = this.world = new VE.World(this.seed, this.root);
      w.gen = save ? (save.g || 1) : VE.GEN;                              // oude saves: hun eigen (oude) terrein
      w.generate();
      w.buildMeshes();
      w.buildDecor(rand);
      this.nature = new VE.Nature(w, this.root);
      this.pf = new Pathfinder(w);
      /* Spelers (voorbereiding op multiplayer, max. 3): elk een eigen startplek; speler 0 ben jij. Gebouwen en
         bewoners hebben een eigenaar (owner, nu altijd 0). AI en online spelen bestaan nog niet. */
      const starts = w.starts || [w.start];
      const SP = save && Array.isArray(save.players) ? save.players : null;
      this.players = starts.map((st, id) => Object.assign({ id: id, kind: id === 0 ? 'human' : 'open', name: id === 0 ? 'You' : 'Free land',
        color: [0x3d63b0, 0xb0503a, 0x4f7d34][id], start: { i: st.i, j: st.j } }, SP && SP[id] ? { kind: SP[id].kind, name: SP[id].name } : {}));
      this.buildings = []; this.bmap = {}; this.settlers = [];
      this.bid = 0; this.sid = 0; this.time = 0;
      /* Voorraad ligt altijd ergens: in een Storehouse, op de startstapel, in het dorpshuis (beloningen en
         ingekochte waar) of bij een producent (max. VE.LOCAL_CAP). this.stock is het totaal daarvan
         (alleen-lezen overzicht, wordt bij elke wijziging opnieuw geteld). Schrijven naar this.stock[r]
         (tests, oude code) legt het verschil netjes in een opslag of haalt het eruit: nooit iets dubbel. */
      this._stock = {}; this._res = {}; this.sd = true;
      for (const r of VE.RES_ORDER) { this._stock[r] = 0; this._res[r] = 0; }
      const self = this;
      this.stock = new Proxy(this._stock, {
        get(t, r) { if (self.sd) self.recount(); return t[r]; },
        set(t, r, v) {
          if (!VE.RES[r]) { t[r] = v; return true; }
          if (self.sd) self.recount();
          const d = Math.round((+v || 0) - (t[r] || 0));
          if (d > 0) self.addGoods(r, d); else if (d < 0) self.takeGoods(r, -d);
          return true;
        }
      });
      this.stockRes = new Proxy(this._res, { get(t, r) { if (self.sd) self.recount(); return t[r]; }, set() { return true; } });
      this.gold = 0; this.rank = 0; this.claimed = {};
      this.stats = { produced: {}, goldEarned: 0, roads: 0, built: {}, upgrades: 0 };
      this.upg = {}; for (const u of VE.UPGRADES) this.upg[u.id] = 0;
      this.arriveT = 4; this.dispT = 0; this.roadsDirty = false; this.roadT = 0; this.wearT = 5;
      this.speed = 1;
      this.mats = {
        building: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 6, specular: 0x161616 })
      };
      this.scaffolds = {};
      if (save) this.load(save, rand);
      else this.newVillage(rand);
      // ertsaders in de bergen: uit de save, of (nieuw dorp / oude save) deterministisch uit de seed
      if (VE.Mining) VE.Mining.init(this, save ? save.ore : null);
      if (w.veg) w.veg.settle();             // geen struiken door stammen; easter eggs op een vrije plek
      this.updateTerritory(true);
      // startvoorraad: ligt zichtbaar op de grond naast het dorpshuis en wordt nooit aangevuld.
      // Oude saves (v1): de hele oude voorraad komt op die stapel te liggen, er gaat niets verloren.
      const legacy = !save || (save.v || 1) < 2;
      if (legacy && !this.buildings.some(b => b.type === 'yard')) this.placeYard();
      if (!save) this.fillPile(VE.START_STOCK);
      else if (legacy) this.fillPile(save.stock || {});
      this.checkPiles(true);
      w.rebuildRoads();
      this.nature.update(0, 1);
      // wilde dieren (na het dorp: ze mijden de drukke dorpskern)
      this.wild = VE.Wildlife ? new VE.Wildlife(this, save ? save.wild : null) : null;
    }
    dispose() { this.scene.remove(this.root); }

    newVillage(rand) {
      this.nature.populate(rand);
      const s = this.world.start;
      this.placeBuilding('hq', s.i, s.j, true);
      this.gold = 40;
      for (let n = 0; n < 10; n++) this.spawnSettler();
    }

    /* Startstapel naast het dorpshuis, zonder de ruimte voor de deur van het dorpshuis te blokkeren */
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
    /* recept van een werkplaats: { inp, out, time, outGold }. Smelterij: het gekozen metaal. */
    rcp(b) { const d = b.def; return d.recipes ? (d.recipes[b.recipe] || d.recipes[d.recipe]) : d; }
    setRecipe(b, key) {
      const d = b.def;
      if (!d.recipes || !d.recipes[key] || b.recipe === key) return false;
      const R = d.recipes[key];
      if (R.rank && this.rank < R.rank) return false;
      b.recipe = key;
      // grondstoffen die het nieuwe recept niet gebruikt: terug naar de uitvoer, dragers brengen ze weg
      for (const r in b.input) if (b.input[r] > 0 && !R.inp[r]) { b.output[r] = (b.output[r] || 0) + b.input[r]; b.input[r] = 0; }
      this.sd = true;
      if (!b.working) b.status = '';
      return true;
    }
    // werktempo: level, upgrades en de werker zelf (honger en tevredenheid, js/food.js)
    gatherMult(b) { return this.lvlMult(b) * (1 + 0.15 * this.upg.tools) * (this.workEff ? this.workEff(b) : 1); }
    craftMult(b) { return this.lvlMult(b) * (1 + 0.15 * this.upg.craft) * (this.workEff ? this.workEff(b) : 1); }
    tradeMult() { return 1 + 0.15 * this.upg.trade; }
    growMult() { return 1 + 0.2 * this.upg.soil; }
    walkSpeed() { return 1.15 * (1 + 0.12 * this.upg.boots); }
    cap(b) { return 4 + 2 * (b.level - 1); }               // invoervoorraad van een werkplaats
    outTotal(b) { let n = 0; for (const r in b.output) n += b.output[r]; return n; }
    /* lokale opslag van een producent: max. VE.LOCAL_CAP stuks. Past `add` er niet meer bij, dan stopt hij. */
    outFull(b, add) { return this.outTotal(b) + (add || 1) > VE.LOCAL_CAP; }
    fullStatus(b, r) {
      const st = r && this.depotFor(r, b.dx, b.dz, null, true);
      return 'Storage full (' + this.outTotal(b) + '/' + VE.LOCAL_CAP + '): ' + (st || !r ? 'waiting for carriers' : 'build a Storehouse that keeps ' + VE.RES[r].name.toLowerCase());
    }

    /* ---------- opslag ---------- */
    // alles wat goederen vasthoudt: opslag (b.store) of de uitvoer van een producent (b.output)
    held(b) { return b.store || b.output; }
    recount() {
      this.sd = false;
      const S = this._stock, R = this._res;
      for (const r of VE.RES_ORDER) { S[r] = 0; R[r] = 0; }
      for (const b of this.buildings) {
        if (!b.alive || !b.built) continue;
        const h = this.held(b);
        for (const r in h) if (h[r]) S[r] = (S[r] || 0) + h[r];
        for (const r in b.outRes) if (b.outRes[r]) R[r] = (R[r] || 0) + b.outRes[r];
      }
    }
    storages() { return this.buildings.filter(b => b.alive && b.built && b.store); }
    nearestStorage(x, z) {
      let best = null, bd = 1e9;
      for (const b of this.buildings) if (b.alive && b.built && b.store) { const d = (b.dx - x) ** 2 + (b.dz - z) ** 2; if (d < bd) { bd = d; best = b; } }
      return best;
    }
    storeTotal(b) { let n = 0; for (const r in b.store) n += b.store[r]; return n; }
    storeCap(b) { return b.def.depot ? VE.STORE_CAP[b.level - 1] || VE.STORE_CAP[0] : Infinity; }
    storeFree(b) { let inc = 0; for (const r in b.incoming) inc += b.incoming[r]; return this.storeCap(b) - this.storeTotal(b) - inc; }
    /* dichtstbijzijnde Storehouse die r aanneemt en nog plek heeft (`not`: behalve dit gebouw) */
    depotFor(r, x, z, not, any) {
      let best = null, bd = 1e9;
      for (const b of this.buildings) {
        if (!b.alive || !b.built || !b.def.depot || b === not || !b.accept[r]) continue;
        if (!any && (b.unreach > this.time || this.storeFree(b) <= 0)) continue;
        const d = (b.dx - x) ** 2 + (b.dz - z) ** 2;
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    }
    /* dichtstbijzijnde plek waar r vrij (niet gereserveerd) ligt: opslag, en met `outputs` ook producenten */
    sourceFor(r, x, z, outputs) {
      let best = null, bd = 1e9;
      for (const b of this.buildings) {
        if (!b.alive || !b.built || b.unreach > this.time) continue;
        if (!b.store && !outputs) continue;
        const h = this.held(b);
        if ((h[r] || 0) - (b.outRes[r] || 0) <= 0) continue;
        // de startvoorraad gaat als eerste op (hij ligt er alleen tijdelijk), daarna de dichtstbijzijnde plek
        const d = (b.dx - x) ** 2 + (b.dz - z) ** 2 + (b.store ? 0 : 4) - (b.def.pile ? 1e6 : 0);
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    }
    /* goederen van buiten (beloningen, inkoop, sloop): eerst een Storehouse dat ze aanneemt, anders het dorpshuis */
    addGoods(r, n, x, z) {
      n = Math.round(n); if (!(n > 0) || !VE.RES[r]) return;
      this.sd = true;
      const hq = this.hq;
      if (x === undefined) { x = hq ? hq.dx : 0; z = hq ? hq.dz : 0; }
      while (n > 0) {
        const d = this.depotFor(r, x, z); if (!d) break;
        const k = Math.min(n, this.storeFree(d));
        d.store[r] = (d.store[r] || 0) + k; n -= k;
      }
      if (n > 0 && hq && hq.store) hq.store[r] = (hq.store[r] || 0) + n;
    }
    /* goederen verbruiken zonder drager (upgrade, verkoop, eten): alleen wat niet gereserveerd is */
    takeGoods(r, n) {
      n = Math.round(n); if (!(n > 0)) return true;
      this.sd = true;
      const pr = b => b.def.pile ? 0 : b.type === 'hq' ? 1 : b.store ? 2 : 3;     // startvoorraad eerst
      const list = this.buildings.filter(b => b.alive && b.built).sort((a, c) => pr(a) - pr(c));
      for (const b of list) {
        const h = this.held(b), free = (h[r] || 0) - (b.outRes[r] || 0);
        if (free <= 0) continue;
        const k = Math.min(free, n); h[r] -= k; n -= k;
        if (n <= 0) break;
      }
      this.checkPiles();
      return n <= 0;
    }
    fillPile(goods) {
      const pile = this.buildings.find(b => b.alive && b.def.pile) || this.hq;
      for (const r in goods) if (VE.RES[r] && goods[r] > 0) pile.store[r] = (pile.store[r] || 0) + Math.round(goods[r]);
      this.sd = true;
    }
    /* de startstapel is op: hij verdwijnt (en de grond komt vrij) */
    checkPiles(silent) {
      for (const b of this.buildings.slice()) {
        if (!b.alive || !b.def.pile || this.storeTotal(b) > 0) continue;
        let res = 0; for (const r in b.outRes) res += b.outRes[r];
        if (res > 0) continue;
        this.demolish(b, true);
        if (!silent) emit('toast', { text: '🪵 The starting supplies are used up. Build Storehouses to keep your goods.' });
      }
    }
    setAccept(b, r, on) {
      if (!b || !b.def.depot) return;
      if (r === '*') { for (const k of VE.RES_ORDER) b.accept[k] = !!on; }
      else if (VE.RES[r]) b.accept[r] = on === undefined ? !b.accept[r] : !!on;
    }
    countBuilt(type) { let n = 0; for (const b of this.buildings) if (b.alive && b.built && b.type === type) n++; return n; }
    canAfford(cost) {
      for (const r in cost) { if (r === 'gold') { if (this.gold < cost[r]) return false; } else if (this.avail(r) < cost[r]) return false; }
      return true;
    }
    pay(cost) { for (const r in cost) { if (r === 'gold') this.gold -= cost[r]; else this.takeGoods(r, cost[r]); } }
    give(rew) {
      for (const r in rew) { if (r === 'gold') this.gold += rew[r]; else this.addGoods(r, rew[r]); }
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
        if (w.type[k] === 4) return { ok: false, why: 'Too steep: a cliff' };
        if (w.type[k] === 5) return { ok: false, why: 'Cannot build on the bridge' };
        if (w.lmk && w.lmk[k]) return { ok: false, why: 'A landmark is in the way' };
        if (def.mountain) {
          if (def.ore === 6 && (!w.volc || w.volc[k] !== 1)) return { ok: false, why: 'Sulfur Mines can only be built on the slope of the volcano' };
          if (w.type[k] !== 2) return { ok: false, why: 'Mines can only be built on the mountain' };
          if (w.road[k]) return { ok: false, why: 'A path is in the way' };
        } else if (w.type[k] === 2 && def.gather === 'field') return { ok: false, why: 'Too rocky for fields' };
        if (w.bld[k]) return { ok: false, why: 'Space is taken' };
        if (w.door[k]) return { ok: false, why: 'An entrance is in the way' };
        if (w.rock[k]) return { ok: false, why: 'A boulder is in the way' };
        if (w.field[k]) return { ok: false, why: 'A field is in the way' };
      }
      if (w.slope(i, j, size) > (def.mountain ? 1.9 : size > 1 ? 1.25 : 0.95)) return { ok: false, why: def.mountain ? 'This cliff is too steep' : 'Ground too steep' };
      const di = i + (size > 1 ? 1 : 0), dj = j + size;
      if (!w.inb(di, dj)) return { ok: false, why: 'No room for an entrance' };
      const dk = dj * N + di;
      if (w.type[dk] === 1 || w.type[dk] === 4 || w.bld[dk] || w.rock[dk] || (w.lmk && w.lmk[dk])) return { ok: false, why: 'Entrance is blocked' };
      if (def.mountain) {
        const M = VE.Mining, ore = VE.ORES[def.ore];
        if (M && def.ore !== 5 && !M.near(w, i + 0.5, j + 0.5, def.ore, def.radius)) {
          const other = M.anyNear(w, i + 0.5, j + 0.5, def.radius);
          return { ok: false, why: other ? 'No ' + ore.name + ' below this spot, but ' + VE.ORES[other].name + ': try a ' + VE.DEFS[VE.ORES[other].mine].name : 'No ' + ore.name + ' found below this spot' };
        }
        if (!this.routeToStore(dk)) return { ok: false, why: 'No route to your storage from here' };
      }
      if (def.gold && this.gold < def.gold) return { ok: false, why: 'Needs ' + def.gold + ' gold' };
      if (def.mountain && def.ore === 5) return { ok: true, why: 'Good spot: solid rock for building stone (never runs out)' };
      if (def.territory && !force) { const v = this.towerView(i + (size > 1 ? 1 : 0.5), j + (size > 1 ? 1 : 0.5)); if (v >= 1) return { ok: true, why: 'High ground: sees ' + Math.round(v) + ' tiles further' }; }
      if (def.mountain) {
        const n = VE.ORES[def.ore].name, amt = VE.Mining.reach(w, i + 0.5, j + 0.5, def.ore, def.radius);
        return { ok: true, why: 'Good spot: ' + VE.Mining.richness(amt) + ' ' + n + ' deposit ' + (def.surface ? 'nearby' : 'below') + ' (about ' + (Math.round(amt / 5) * 5 || amt) + ')' };
      }
      return { ok: true };
    }
    /* kan een drager van deze tegel naar een opslag lopen? (gecachet tot er iets gebouwd/gesloopt wordt) */
    routeToStore(k) {
      const key = k + ':' + this.bid + ':' + this.buildings.length;
      this._route = this._route || {};
      if (this._route[key] !== undefined) return this._route[key];
      const st = this.hq || this.nearestStorage(k % N + 0.5, ((k / N) | 0) + 0.5);
      const ok = !!(st && this.pf.find(k, st.doorK));
      if (Object.keys(this._route).length > 400) this._route = {};
      return (this._route[key] = ok);
    }
    placeBuilding(type, i, j, instant) {
      const def = DEFS[type], w = this.world, size = def.size || 1;
      const b = {
        id: ++this.bid, type: type, def: def, i: i, j: j, size: size, level: 1, built: false, alive: true, used: 0, total: 0,
        delivered: {}, incoming: {}, input: {}, output: {}, outRes: {}, worker: null, builder: null, wt: 0, working: false,
        sell: {}, keep: 10, fields: [], status: '', sellIdx: 0, unreach: 0, owner: 0
      };
      b.cx = i + size / 2; b.cz = j + size / 2;
      b.doorI = i + (size > 1 ? 1 : 0); b.doorJ = j + size; b.doorK = b.doorJ * N + b.doorI;
      b.dx = b.doorI + 0.5; b.dz = b.doorJ + 0.32;
      if (def.cost) for (const r in def.cost) b.total += def.cost[r];
      if (def.market) for (const r of ['bread', 'fish', 'wine', 'flour']) b.sell[r] = true;
      if (def.recipes) b.recipe = def.recipe;
      if (def.storage) b.store = {};
      if (def.depot) { b.accept = {}; for (const r of VE.RES_ORDER) b.accept[r] = (VE.DEFAULT_ACCEPT || VE.RES_ORDER).indexOf(r) >= 0; }
      this.sd = true;
      for (let dj = 0; dj < size; dj++) for (let di = 0; di < size; di++) {
        const k = (j + dj) * N + i + di;
        w.bld[k] = b.id; w.road[k] = 0; w.wear[k] = 0; if (w.paths) w.paths.clearTile(k);
        if (def.pile) w.soft[k] = 1;                  // startvoorraad ligt gewoon in het gras: geen aarde eronder
        if (w.tree[k]) this.nature.removeTree(w.tree[k]);
        if (w.rock[k]) { w.rock[k].amount = 1; this.nature.mineRock(w.rock[k]); }
        if (w.field[k]) this.nature.removeField(w.field[k]);
        if (!def.pile) w.clearDeco(k);
      }
      w.door[b.doorK]++;
      const doorTiles = [b.doorK];
      if (size > 1) doorTiles.push(b.doorJ * N + i);
      for (const k of doorTiles) {
        if (w.tree[k]) this.nature.removeTree(w.tree[k]);
        if (w.field[k]) this.nature.removeField(w.field[k]);
        if (def.pile) continue;                        // geen stoepje: dragers lopen gewoon door het gras
        w.road[k] = 2; w.clearDeco(k); if (w.paths) w.paths.apron(k);
      }
      if (!def.pile && !def.mountain) this.clearDoorway(b);
      b.y = w.flatten(i, j, size);
      this.nature.refreshArea(i - 1, j - 1, i + size, j + size);
      w.refreshDecoArea(i - 1, j - 1, i + size, j + size);
      if (VE.Mining && w.deposits) VE.Mining.refreshArea(w, i - 1, j - 1, i + size, j + size);
      w.recolor();
      this.makeMesh(b);
      this.buildings.push(b); this.bmap[b.id] = b;
      if (instant || b.total === 0) this.complete(b, true);
      this.roadsDirty = true;
      return b;
    }
    /* Ingang ingesloten door rotsblokken (vaak bij een quarry tussen de keien): bewoners lopen niet schuin
       tussen twee blokken door, dus dragers en bouwers kunnen de deur niet bereiken. De bouwers ruimen dan
       de blokken vóór, links en rechts van de ingang op (alleen rotsblokken; water en bergen blijven). */
    clearDoorway(b) {
      const w = this.world, N = VE.N, hq = this.hq, d = b.doorK;
      const reach = () => hq && hq !== b ? !!this.pf.find(hq.doorK, d) : [[0, 1], [-1, 0], [1, 0]].some(([di, dj]) => w.inb(b.doorI + di, b.doorJ + dj) && w.walkable(d + dj * N + di));
      if (reach()) return;
      for (const [di, dj] of [[0, 1], [-1, 0], [1, 0], [-1, 1], [1, 1], [0, 2]]) {
        if (!w.inb(b.doorI + di, b.doorJ + dj)) continue;
        const k = d + dj * N + di, r = w.rock[k];
        if (!r || w.bld[k]) continue;
        r.amount = 1; this.nature.mineRock(r);
        if (reach()) return;
      }
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
        const am = new THREE.Mesh(a.geo, (a.kind === 'glow' || a.kind === 'hotblade') && VE.glowMat ? VE.glowMat() : this.mats.building);
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
      b.upScaf = null;
      if (b.up) this.upScaffold(b);
      this.root.add(g);
    }
    complete(b, silent) {
      b.built = true; this.sd = true;
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
      for (const b of this.buildings) if (b.alive && b.built && b.def.territory) c.push({ x: b.cx, z: b.cz, r: b.def.territory + (b.level - 1) * 1.5, view: b.type === 'tower' ? this.towerView(b.cx, b.cz) : 0 });
      this.world.setTerritory(c);
      for (const t of c) this.world.reveal(t.x, t.z, t.r + 2.5 + t.view);   // your own land (and a little beyond) is known
      if (!initial) emit('territory', {});
    }
    /* wachttoren op hoogte kijkt verder: extra ontdekkingsbereik (tegels) t.o.v. vlak land (hoogte ~0,9) */
    towerView(x, z) { return VE.clamp((this.world.heightAt(x, z) - 1.1) * 2.2, 0, 9); }
    /* bouwplaats van een gebouw: het gebouw zelf (nog in aanbouw) of zijn lopende upgrade (b.up) */
    site(b) { return !b.alive ? null : !b.built ? (b.def.cost ? b : null) : (b.up || null); }
    siteCost(S, b) { return S.cost || b.def.cost; }
    /* Upgrade = bouwplaats, net als nieuwbouw: het goud gaat direct uit de schatkist, de materialen brengen
       dragers één voor één. Daarna komt een bouwer met een hamer; pas als alles verbouwd is, krijgt het
       gebouw zijn nieuwe level. Het gebouw blijft tijdens de upgrade gewoon werken. */
    upgrade(b) {
      if (!b.built || b.up || b.level >= this.maxLevel() || !b.def.cost) return false;
      const cost = VE.levelCost(b.def, b.level + 1);
      if (!this.canAfford(cost)) return false;
      const mat = {}; let total = 0;
      for (const r in cost) if (r !== 'gold') { mat[r] = cost[r]; total += cost[r]; }
      if (cost.gold) this.gold -= cost.gold;
      b.up = { lvl: b.level + 1, cost: mat, gold: cost.gold || 0, delivered: {}, incoming: {}, used: 0, total: total };
      this.sd = true;
      this.upScaffold(b);
      emit('dust', { x: b.cx, y: b.y, z: b.cz, n: 6 });
      sfx('place', b.cx, b.cz);
      if (!total) this.finishUpgrade(b);
      return true;
    }
    /* steiger rondom het bestaande gebouw; groeit mee met de voortgang */
    upScaffold(b) {
      if (b.upScaf) { b.group.remove(b.upScaf); b.upScaf = null; }
      if (!b.up) return;
      const key = 'up' + b.size;
      if (!this.scaffolds[key]) this.scaffolds[key] = VE.scaffoldGeo(b.size, true);
      b.upScaf = new THREE.Mesh(this.scaffolds[key], this.mats.building);
      b.upScaf.castShadow = true; b.upScaf.name = 'upgradeScaffold';
      b.group.add(b.upScaf);
      this.upProgress(b);
    }
    upProgress(b) {
      if (b.upScaf && b.up) b.upScaf.scale.y = 0.45 + 0.55 * (b.up.total ? b.up.used / b.up.total : 1);
    }
    finishUpgrade(b, silent) {
      const u = b.up; if (!u) return;
      b.up = null; this.sd = true;
      if (b.builder) { const s = b.builder; s.mode = 'idle'; s.tool = null; s.act = null; s.wt = 0.5; s.work = null; b.builder = null; }
      b.level = u.lvl;
      this.stats.upgrades++;
      this.makeMesh(b);
      if (b.def.territory) this.updateTerritory();
      if (!silent) {
        emit('dust', { x: b.cx, y: b.y, z: b.cz, n: 14 });
        emit('toast', { text: '⭐ ' + b.def.name + ' upgraded to level ' + b.level + '!' });
        sfx('done', b.cx, b.cz);
      }
    }
    /* upgrade afbreken: geleverde materialen en het goud gaan terug (dragers onderweg leveren elders af) */
    cancelUpgrade(b) {
      const u = b.up; if (!u) return false;
      b.up = null; this.sd = true;
      for (const r in u.delivered) if (u.delivered[r] > 0) this.addGoods(r, u.delivered[r], b.dx, b.dz);
      this.gold += u.gold;
      if (b.builder) { const s = b.builder; s.mode = 'idle'; s.tool = null; s.act = null; s.wt = 0.5; s.work = null; b.builder = null; }
      this.upScaffold(b);
      return true;
    }
    demolish(b, force) {
      if (!b || (b.def.fixed && !force) || !b.alive) return;
      const w = this.world;
      b.alive = false; this.sd = true;
      this.root.remove(b.group);
      for (let dj = 0; dj < b.size; dj++) for (let di = 0; di < b.size; di++) { const k = (b.j + dj) * N + b.i + di; w.bld[k] = 0; w.soft[k] = 0; }
      w.door[b.doorK] = Math.max(0, w.door[b.doorK] - 1);
      if (w.paths) { w.paths.unfix(b.doorK); if (b.size > 1) w.paths.unfix(b.doorJ * N + b.i); }   // stoepje groeit langzaam weer dicht
      if (b.dig) { b.dig.reserved = false; b.dig = null; }                // ondergrondse ronde van een mijn afbreken
      if (b.lumber) { const n = this.dropLumber(b); if (n) this.addGoods('log', n, b.dx, b.dz); }   // gevallen boom / stammen
      // terug naar de opslag: de helft van de bouwkosten, alles wat er lag (ook gereserveerd: die drager
      // vindt straks een leeg gebouw en haalt niets op, dus niets dubbel en niets kwijt)
      const back = (r, n) => this.addGoods(r, n, b.dx, b.dz);
      if (b.built) { if (b.def.cost) for (const r in b.def.cost) back(r, Math.floor(b.def.cost[r] / 2)); }
      else for (const r in b.delivered) back(r, b.delivered[r]);
      if (b.up) { for (const r in b.up.delivered) back(r, b.up.delivered[r]); this.gold += b.up.gold; b.up = null; }
      if (b.queue && this.clearBarracks) this.clearBarracks(b);         // kazerne: goud terug, rekruten weer vrij
      for (const r in b.input) back(r, b.input[r]);
      for (const r in b.output) back(r, b.output[r]);
      if (b.store) for (const r in b.store) back(r, b.store[r]);
      b.input = {}; b.output = {}; if (b.store) b.store = {};
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
    /* één volledige passage over tegel k (tests en hulpfuncties; gewoon lopen gaat via moveSettler) */
    tread(k, amt) {
      const w = this.world;
      if (w.type[k] === 1 || w.bld[k] || w.door[k]) return;
      w.paths.passTile(k, amt === undefined ? 1 : amt);
      w.paths.syncTiles(this);
    }
    /* ongebruikte paden groeien heel langzaam weer dicht (elke 5 s) */
    wearDecay() { this.world.paths.decay(); this.world.paths.syncTiles(this); }

    /* ---------- settlers ---------- */
    spawnSettler(near) {
      if (this.settlers.length >= (this.maxPop || MAX_POP)) return null;   // maxPop: per spel instelbaar (tests: drie volle dorpen)
      const hq = near || this.hq;
      const s = new Settler(++this.sid, hq.dx + (Math.random() - 0.5) * 0.8, hq.dz + 0.3 + Math.random() * 0.6);
      if (this.initHunger) this.initHunger(s);                         // honger en tevredenheid (js/food.js)
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
      const sp = this.walkSpeed() * (w.road[k] === 2 ? 1.6 : w.road[k] === 1 ? 1.25 : 1) * (w.type[k] === 2 ? 0.8 : 1) * (s.carry ? 0.92 : 1) * (s.spd || 1) * (s.walkEff || 1);
      const step = sp * dt;
      if (d <= step) {
        s.x = p[0]; s.z = p[1]; s.pi++;
        if (s.pi >= s.path.length) { s.path = null; s.moving = false; const cb = s.cb; s.cb = null; if (cb) cb(); }
      } else {
        s.x += dx / d * step; s.z += dz / d * step;
        // slijtage: alleen echte verplaatsing; rondslenteren telt een kwart, korte correctiestapjes nauwelijks
        if (step > 0.004) w.paths.walk(s.x, s.z, step, s.mode === 'wander' ? 0.25 : 1);
        let tr = Math.atan2(dx, dz), dr = tr - s.rot;
        while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2;
        s.rot += dr * Math.min(1, dt * 12);
        s.moving = true; s.wp += dt * sp * 11;
      }
    }

    /* ---------- transport ---------- */
    /* up: de upgrade-bouwplaats (dst.up) waar dit goed heen gaat, anders gewoon het gebouw */
    startTransport(s, res, src, dst, up) {
      s.mode = 'carry'; s.task = { res: res, src: src, dst: dst, picked: false, up: up || null }; s.tool = null; s.act = null;
      src.outRes[res] = (src.outRes[res] || 0) + 1; this.sd = true;
      const I = (up || dst).incoming; I[res] = (I[res] || 0) + 1;
      if (!this.walkToB(s, src, () => this.pickup(s))) this.failTask(s, true);
    }
    pickup(s) {
      const t = s.task; if (!t) return;
      if (!t.src.alive) { this.failTask(s); return; }
      const h = this.held(t.src);
      t.src.outRes[t.res]--; this.sd = true;
      if (!(h[t.res] > 0)) { this.failTask(s); return; }
      h[t.res]--;
      t.picked = true; s.carry = t.res;
      if (t.src.def.pile) this.checkPiles();
      if (!t.dst.alive) { this.redirect(s); return; }
      if (!this.walkToB(s, t.dst, () => this.deliver(s))) this.redirect(s);
    }
    /* bestemming weg of onbereikbaar: naar een Storehouse dat het aanneemt, anders terug naar de bron */
    redirect(s) {
      const t = s.task, I0 = (t.up || t.dst).incoming;
      if (t.dst.alive && I0[t.res]) I0[t.res]--;
      let st = this.depotFor(t.res, s.x, s.z, t.dst), back = false;
      if (!st && t.src.alive && t.src.built && t.src !== t.dst) { st = t.src; back = !t.src.store; }
      t.up = null;
      if (st) {
        t.dst = st; t.back = back; st.incoming[t.res] = (st.incoming[t.res] || 0) + 1;
        if (this.walkToB(s, st, () => this.deliver(s))) return;
        st.incoming[t.res]--;
      }
      this.dropCarry(s);
    }
    /* noodgeval (nergens heen te lopen): het goed gaat naar een opslag, het verdwijnt nooit */
    dropCarry(s) {
      if (s.carry) this.addGoods(s.carry, 1, s.x, s.z);
      s.carry = null; s.task = null; s.mode = 'idle'; s.path = null; s.cb = null;
    }
    deliver(s) {
      const t = s.task; if (!t) return;
      const d = t.dst;
      if (!d.alive) { this.redirect(s); return; }
      if (t.up && d.up !== t.up) { this.redirect(s); return; }       // upgrade intussen klaar of afgebroken
      const I = (t.up || d).incoming;
      if (I[t.res]) I[t.res]--;
      this.sd = true;
      if (t.up) t.up.delivered[t.res] = (t.up.delivered[t.res] || 0) + 1;
      else if (!d.built) d.delivered[t.res] = (d.delivered[t.res] || 0) + 1;
      else if (d.store) d.store[t.res] = (d.store[t.res] || 0) + 1;
      else if (t.back) d.output[t.res] = (d.output[t.res] || 0) + 1;
      else if (d.def.recipes && !this.rcp(d).inp[t.res]) d.output[t.res] = (d.output[t.res] || 0) + 1;
      else d.input[t.res] = (d.input[t.res] || 0) + 1;
      s.carry = null; s.task = null; s.mode = 'idle'; s.wt = 0.2;
    }
    failTask(s, early) {
      const t = s.task;
      if (t) {
        if (!t.picked) {
          if (t.src.alive && t.src.outRes[t.res] > 0) t.src.outRes[t.res]--;
          if (early) t.src.unreach = this.time + 6;
        } else if (s.carry) { this.addGoods(s.carry, 1, s.x, s.z); }
        this.sd = true;
        const I = (t.up || t.dst).incoming;
        if (t.dst.alive && I[t.res]) I[t.res]--;
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
        else if (b.def.inp && !b.def.market) { const R = this.rcp(b); if (R.inp[res] && (!this.foodSpare || this.foodSpare(res))) want = this.cap(b) - (b.input[res] || 0) - (b.incoming[res] || 0); }
        else if (b.def.barracks && this.barracksWant) want = this.barracksWant(b, res);       // wapens en uitrusting voor de wachtrij
        if (want <= 0) continue;
        const d = (b.dx - from.dx) ** 2 + (b.dz - from.dz) ** 2;
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    }
    dispatch() {
      const idle = [];
      for (const s of this.settlers) if (s.mode === 'idle' || s.mode === 'wander') idle.push(s);
      if (this.feedIdle) this.feedIdle(idle);                          // eerst eten (js/food.js)
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
            if (!alive(b)) continue;
            const S = this.site(b); if (!S) continue;            // nieuwbouw of upgrade
            const cost = this.siteCost(S, b), up = S === b ? null : S;
            for (const r in cost) {
              let need = cost[r] - (S.delivered[r] || 0) - (S.incoming[r] || 0);
              while (need > 0 && n < cap && idle.length && this.avail(r) > 0) {
                const src = this.sourceFor(r, b.dx, b.dz); if (!src) break;
                const s = take(src.dx, src.dz); if (!s) break;
                this.startTransport(s, r, src, b, up); need--; n++;
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
            if (!alive(b) || b.builder) continue;
            const S = this.site(b); if (!S) continue;
            let has = -S.used; for (const r in S.delivered) has += S.delivered[r];
            for (const r in S.incoming) has += S.incoming[r];
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
            const R = this.rcp(b);
            for (const r in R.inp) {
              if (this.foodSpare && !this.foodSpare(r)) continue;          // voedsel: eerst het dorp
              let want = this.cap(b) - (b.input[r] || 0) - (b.incoming[r] || 0);
              while (want > 0 && n < cap && idle.length && this.avail(r) > 0) {
                const src = this.sourceFor(r, b.dx, b.dz); if (!src) break;
                const s = take(src.dx, src.dz); if (!s) break;
                this.startTransport(s, r, src, b); want--; n++;
              }
            }
          }
          return n;
        },
        // kazerne: wapens en trainingsuitrusting, daarna vrije dorpelingen als rekruut (js/military.js)
        cap => this.dispatchBarracks ? this.dispatchBarracks(take, idle, cap) : 0,
        cap => this.dispatchRecruits ? this.dispatchRecruits(take, idle, cap) : 0,
        // markets
        cap => {
          let n = 0;
          for (const b of B) {
            if (!alive(b) || !b.built || !b.def.market) continue;
            let pending = 0; for (const r in b.input) pending += b.input[r]; for (const r in b.incoming) pending += b.incoming[r];
            for (const r of VE.RES_ORDER) {
              if (!b.sell[r]) continue;
              while (pending < 6 && n < cap && idle.length && this.avail(r) > b.keep && (!this.foodSpare || this.foodSpare(r, b))) {
                const src = this.sourceFor(r, b.dx, b.dz, true); if (!src) break;
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
      // ligt dit goed nog op de startstapel, dan bedient die stapel de werkplaatsen en bouwplaatsen eerst
      const pile = this.buildings.find(b => b.alive && b.built && b.def.pile);
      const onPile = r => pile && (pile.store[r] || 0) - (pile.outRes[r] || 0) > 0;
      for (const b of this.buildings) {
        if (!b.alive || !b.built || b.store || b.unreach > this.time) continue;
        for (const r in b.output) {
          while (b.output[r] - (b.outRes[r] || 0) > 0 && n < cap && idle.length) {
            let dst = onPile(r) ? null : this.findConsumer(r, b);
            if (!dst) {
              if (consumerOnly && !this.outFull(b)) break;
              dst = this.depotFor(r, b.dx, b.dz);          // alleen een Storehouse dat dit goed aanneemt en plek heeft
            }
            if (!dst) break;                                // geen plek: het blijft bij de producent liggen
            const s = take(b.dx, b.dz); if (!s) return n;
            this.startTransport(s, r, b, dst); n++;
          }
        }
      }
      // goederen die een Storehouse niet meer aanneemt (uitgevinkt): naar een Storehouse dat ze wel wil
      if (!consumerOnly) for (const b of this.buildings) {
        if (!b.alive || !b.built || !b.def.depot || b.unreach > this.time) continue;
        for (const r in b.store) {
          if (b.accept[r]) continue;
          while (b.store[r] - (b.outRes[r] || 0) > 0 && n < cap && idle.length) {
            const dst = this.depotFor(r, b.dx, b.dz, b); if (!dst) break;
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
      const b = s.work, S = b && this.site(b);
      if (!S || b.builder !== s) { if (b && b.builder === s) b.builder = null; s.mode = 'idle'; s.tool = null; s.act = null; s.work = null; return; }
      if (s.bstate === 'at' && s.wt <= 0 && this.builderMeal && this.builderMeal(s, b)) return;
      if (s.bstate !== 'at') return;
      let has = 0; for (const r in S.delivered) has += S.delivered[r];
      if (has - S.used > 0) {
        s.act = 'hammer'; s.ap += dt; s.wt -= dt;
        if (Math.floor(s.ap / 0.45) !== s.actTick) {
          s.actTick = Math.floor(s.ap / 0.45); sfx('hammer', s.x, s.z);
          if (S !== b && s.actTick % 2 === 0) emit('dust', { x: s.x + Math.sin(s.rot) * 0.2, y: b.y + 0.05, z: s.z + Math.cos(s.rot) * 0.2, n: 2, small: true });
        }
        if (s.wt <= 0) {
          S.used++; s.wt = 1.1;
          if (S === b) {
            b.mesh.scale.y = 0.03 + 0.97 * (b.used / b.total);
            if (b.used >= b.total) this.complete(b);
          } else {
            this.upProgress(b);
            if (S.used >= S.total) this.finishUpgrade(b);
          }
        }
      } else {
        s.act = null;
        let inc = 0; for (const r in S.incoming) inc += S.incoming[r];
        if (inc === 0) {
          s.waitT = (s.waitT || 0) + dt;
          if (s.waitT > 3) { s.waitT = 0; b.builder = null; s.mode = 'idle'; s.tool = null; s.work = null; s.wt = 0.5; }
        } else s.waitT = 0;
      }
    }
    remainingCost(b) {
      const c = {}, S = this.site(b); if (!S) return c;
      const cost = this.siteCost(S, b);
      for (const r in cost) { const n = cost[r] - (S.delivered[r] || 0) - (S.incoming[r] || 0); if (n > 0) c[r] = n; }
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
      if (s.meal && this.dropMeal) this.dropMeal(s);
      if (b && b.worker === s) b.worker = null;
      if (s.resv) {
        const f = s.resv; f.reserved = false; s.resv = null;
        if (f.onRelease) f.onRelease(s);
        // half gemaaid of hok nog niet opgepakt: het veld staat er weer zoals voor het maaien
        if (f.mow || f.state === 'cut') { f.mow = 0; if (f.state === 'cut') f.state = 'grown'; if (!f.dead && this.nature.setFieldM) this.nature.setFieldM(f); }
      }
      s.mowField = null;
      if (s.carry && b) this.addGoods(s.carry, 1, s.x, s.z);
      s.carry = null; s.mode = 'idle'; s.role = 'carrier'; s.tool = null; s.act = null; s.work = null; s.hidden = false; s.path = null; s.cb = null; s.wstate = null; s.wt = 0.5;
      if (b) { s.x = b.dx; s.z = b.dz + 0.1; }
    }
    goAct(s, b, tk, fx, fz, face, act, time, done) {
      if (s.hidden) { s.x = b.dx; s.z = b.dz; }        // vanuit de hut: vertrek bij de deur
      s.hidden = false; s.wstate = 'walk'; s.act = null;
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
        if (!b.alive || b.worker !== s) { if (carry) { this.addGoods(carry, 1, s.x, s.z); s.carry = null; } this.freeWorker(s); return; }
        s.carry = null; s.hidden = true; s.wstate = 'inside'; s.wt = 1.0; s.x = b.dx; s.z = b.dz;
        if (done) done();
      };
      if (!this.walkToB(s, b, arrive)) arrive();
    }
    produce(b, res, n) {
      b.output[res] = (b.output[res] || 0) + n; this.sd = true;
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
        if (d.gather !== 'plant' && this.outFull(b)) { b.status = this.fullStatus(b, d.out); s.wt = 1; return; }
        const gm = this.gatherMult(b);
        if (d.gather === 'tree') {
          // houthakken: boom zoeken -> omhakken -> omvallen -> kroon eraf en in stukken hakken -> stammen
          // één voor één oppakken, naar de hut dragen en op de stapel leggen (pas dan in de lokale voorraad)
          const L = b.lumber;
          if (L && L.pieces && L.pieces.length) { this.carryLog(s, b, L); return; }
          if (L && L.tree && !L.tree.dead) { if (!L.tree.landed) { s.wt = 0.3; return; } this.buckLog(s, b, L); return; }
          if (L) b.lumber = null;
          if (this.outFull(b, 2)) { b.status = this.fullStatus(b, d.out); s.wt = 1; return; }   // een boom levert 2 stammen
          let best = null, bd = 1e9;
          for (const t of this.nature.trees) {
            if (t.dead || t.falling || t.reserved || t.growth < 1) continue;
            const dd = (t.x - b.cx) ** 2 + (t.z - b.cz) ** 2;
            if (dd < d.radius * d.radius && dd < bd) { bd = dd; best = t; }
          }
          if (!best) { b.status = 'No mature trees in range'; s.wt = 3; return; }
          const t = best; t.reserved = true; s.resv = t; b.status = 'Felling a tree';
          const sp = this.standPoint(b, t.x, t.z, 0.3);
          const ok = this.goAct(s, b, t.k, sp[0], sp[1], [t.x, t.z], 'chop', d.time / gm, () => {
            if (t.dead || t.falling) { s.resv = null; t.reserved = false; this.goHome(s, b, null); return; }
            // de boom valt weg van de houthakker, op een vrije plek
            this.nature.fellTree(t, this.nature.fallDir(t, s.x, s.z));
            sfx('creak', t.x, t.z);
            emit('leaves', { x: t.x, y: w.heightAt(t.x, t.z) + 0.6, z: t.z });
            b.lumber = { tree: t, pieces: [], cut: 0 };
            b.status = 'Timber!';
            this.stats.felled = (this.stats.felled || 0) + 1;
            s.act = null; s.tool = 'axe';
            // wachten (bijl in de hand) tot de boom stil ligt
            const wait = () => {
              if (!b.alive || b.worker !== s) { this.freeWorker(s); return; }
              if (!t.landed && !t.dead) { s.wstate = 'act'; s.act = null; s.wt = 0.15; s.onAct = wait; return; }
              this.buckLog(s, b, b.lumber);
            };
            wait();
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
          // graan: eerst de grond schoffelen (een nieuwe akker verschijnt dan als omgewerkte grond), daarna zaaien
          const hoeFirst = act === 'sow' && d.fieldKind === 0;
          s.tool = act === 'harvest' ? d.tool : hoeFirst ? 'hoe' : null;
          if (hoeFirst) b.status = 'Hoeing the soil';
          // Graan: maaien met de zeis (60% van de tijd), dan de schoven tot een hok zetten en binden
          // (40%), daarna neemt de boer een schoof mee naar de boerderij. Totale tijd blijft d.time.
          const grain = act === 'harvest' && d.fieldKind === 0;
          const tAct = (act === 'harvest' ? d.time * (grain ? 0.6 : 1) : 1.8) / gm;
          if (grain) s.mowField = f;
          const hoed = () => {
            if (!b.alive || b.worker !== s) { this.freeWorker(s); return; }
            if (!f && this.freeTile(k)) {                    // nieuwe akker: de geschoffelde grond ligt er nu
              const nf = this.nature.addField(i, j, d.fieldKind, b);
              if (nf) { nf.state = 'empty'; nf.growth = 0; nf.reserved = true; s.resv = nf; this.nature.setFieldM(nf); b.fields.push(nf); }
            }
            b.status = 'Sowing';
            s.wstate = 'act'; s.act = 'sow'; s.tool = null; s.ap = 0; s.actTick = 0; s.wt = 1.1 / gm; s.onAct = sowDone;
          };
          const sowDone = () => {
            s.mowField = null;
            if (act === 'harvest' && grain && !f.dead && b.alive && b.worker === s) {
              // gemaaid: hok van schoven op het stoppelveld; de boer bindt en pakt een schoof op
              f.mow = 0; f.state = 'cut'; this.nature.setFieldM(f);
              s.wstate = 'act'; s.act = 'sow'; s.ap = 0; s.actTick = 0; s.wt = d.time * 0.4 / gm; s.tool = null;
              s.onAct = () => {
                s.resv = null; f.reserved = false;
                if (!f.dead) { f.state = 'empty'; f.growth = 0; this.nature.setFieldM(f); }
                this.goHome(s, b, res, () => this.produce(b, res, 1));
              };
              return;
            }
            s.resv = null; if (f) { f.reserved = false; f.mow = 0; }
            if (act === 'harvest') {
              if (f.dead) { this.goHome(s, b, null); return; }
              f.state = 'empty'; f.growth = 0; this.nature.setFieldM(f);
              this.goHome(s, b, res, () => this.produce(b, res, 1));
            } else {
              if (f && !f.dead) { f.state = 'growing'; f.growth = 0; this.nature.setFieldM(f); }
              else if (!f && this.freeTile(k)) { const nf = this.nature.addField(i, j, d.fieldKind, b); if (nf) b.fields.push(nf); }
              else if (!f && this.world.field[k] && this.world.field[k].owner === b) {   // tijdens het schoffelen aangelegd
                const nf = this.world.field[k]; nf.reserved = false; if (s.resv === nf) s.resv = null;
                nf.state = 'growing'; nf.growth = 0; this.nature.setFieldM(nf);
              }
              this.goHome(s, b, null);
            }
          };
          const ok = this.goAct(s, b, k, i + 0.5 + (Math.random() - 0.5) * 0.4, j + 0.5 + 0.3, [i + 0.5, j + 0.5],
            hoeFirst ? 'hoe' : act, hoeFirst ? 1.3 / gm : tAct, hoeFirst ? hoed : sowDone);
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
      if (d.gather === 'ore') this.thinkMine(s, b, d);
      else if (d.gather === 'hunt') this.thinkHunt(s, b, d);
      // indoor workers just stay inside; the building does the work
      if (!d.gather) { s.wt = 0.5; }
    }
    /* houthakker: de omgevallen boom in stukken hakken (eerst de kroon eraf, dan de stam doormidden) */
    buckLog(s, b, L) {
      const d = b.def, w = this.world, gm = this.gatherMult(b), t = L.tree;
      const dir = t.fallDir || [0, 1], len = t.trunkLen || 0.5;
      const side = [dir[1], -dir[0]];
      const cutAt = f => [t.x + dir[0] * len * f, t.z + dir[1] * len * f];
      const go = (f, then) => {
        const c = cutAt(f), sx = c[0] + side[0] * 0.2, sz = c[1] + side[1] * 0.2;
        const tk = this.tileOf(sx, sz);
        b.status = 'Cutting the tree into logs';
        const ok = this.goAct(s, b, tk, sx, sz, c, 'chop', 1.3 / gm, then);
        if (!ok) { // onbereikbaar: de stammen toch opleveren (niets kwijt), het hout ligt dan bij de hut
          if (!t.dead) this.nature.removeTree(t);
          for (const p of L.pieces) this.nature.removeLog(p);
          b.lumber = null; s.resv = null;
          this.goHome(s, b, 'log', () => this.produce(b, 'log', 2));
        }
      };
      if (!L.long) {
        go(1.02, () => {                                   // bij de kroon: kroon eraf, de stam blijft liggen
          s.resv = null;
          L.long = this.nature.buckTree(t);
          L.tree = null;
          go(0.5, () => {                                  // in het midden: twee losse stammen
            L.pieces = this.nature.splitLog(L.long); L.long = null;
            this.carryLog(s, b, L);
          });
        });
      } else {
        go(0.5, () => { L.pieces = this.nature.splitLog(L.long); L.long = null; this.carryLog(s, b, L); });
      }
    }
    /* houthakker: een gehakte stam oppakken en naar de hut dragen; op de stapel = in de lokale voorraad */
    carryLog(s, b, L) {
      if (!L.pieces.length) { b.lumber = null; this.goHome(s, b, null); return; }
      if (this.outFull(b)) { b.status = this.fullStatus(b, 'log'); if (!s.hidden) this.goHome(s, b, null); else s.wt = 1; return; }
      const p = L.pieces[0], side = [p.dir[1], -p.dir[0]];
      const sx = p.x + side[0] * 0.16, sz = p.z + side[1] * 0.16;
      b.status = 'Carrying logs home';
      const ok = this.goAct(s, b, this.tileOf(sx, sz), sx, sz, [p.x, p.z], 'sow', 0.55, () => {   // bukken en optillen
        this.nature.removeLog(p); L.pieces.shift();
        if (!L.pieces.length) b.lumber = null;
        this.goHome(s, b, 'log', () => this.produce(b, 'log', 1));
      });
      if (!ok) { this.nature.removeLog(p); L.pieces.shift(); if (!L.pieces.length) b.lumber = null; this.goHome(s, b, 'log', () => this.produce(b, 'log', 1)); }
    }
    /* weggevallen werk van een houthakker (sloop, werker weg): liggende boom en stammen opruimen, hout niet kwijt */
    dropLumber(b) {
      const L = b.lumber; if (!L) return 0;
      let n = 0;
      if (L.tree && !L.tree.dead) { L.tree.reserved = false; this.nature.removeTree(L.tree); n += 2; }
      if (L.long) { this.nature.removeLog(L.long); n += 2; }
      for (const p of L.pieces || []) { this.nature.removeLog(p); n++; }
      b.lumber = null;
      return n;
    }

    /* mijnwerker: loopt naar de ertsader naast de mijn, hakt een brok los en brengt die naar de mijn */
    thinkMine(s, b, d) {
      const w = this.world, M = VE.Mining, gm = this.gatherMult(b);
      // vorige ronde afronden: het losgehakte brok komt boven (karretje)
      if (b.dig) {
        const dep = b.dig; b.dig = null; dep.reserved = false;
        if (dep.amount > 0) { M.take(w, dep); this.produce(b, d.out, 1); }
      }
      b.working = false;
      if (this.outFull(b)) { b.status = this.fullStatus(b, d.out); s.wt = 1; return; }
      const r = d.radius + (b.level - 1) * 0.5;
      if (d.surface) return this.thinkSurfaceMine(s, b, d, r, gm);
      const dep = M && M.pick(w, b.cx, b.cz, d.ore, r);
      if (!dep) {
        const empty = !(M && M.near(w, b.cx, b.cz, d.ore, r));
        b.status = d.ore === 5 ? 'No solid rock in reach' : empty ? 'The ' + VE.ORES[d.ore].name + ' below this mine is used up' : 'Waiting for a free tunnel';
        if (empty && d.ore !== 5 && !b.emptyTold) { b.emptyTold = true; emit('toast', { text: '⛏️ ' + b.def.name + ': the ' + VE.ORES[d.ore].name + ' is used up. Build a new mine above another deposit.' }); }
        s.wt = 4; return;
      }
      // ondergronds hakken: de mijnwerker blijft binnen, het karretje rijdt
      dep.reserved = true; b.dig = dep; b.working = true; b.emptyTold = false;
      b.status = 'Mining ' + VE.RES[d.out].name.toLowerCase() + ' underground';
      s.hidden = true; s.wstate = 'inside'; s.wt = d.time / gm;
    }
    /* zwavelmijn: de mijnwerker loopt naar een afzetting op de helling, hakt de kristallen los en draagt ze terug */
    thinkSurfaceMine(s, b, d, r, gm) {
      const w = this.world, M = VE.Mining;
      const dep = M && M.pick(w, b.cx, b.cz, d.ore, r);
      if (!dep) {
        const any = (w.deposits || []).some(q => q.type === d.ore && (q.x - b.cx) ** 2 + (q.z - b.cz) ** 2 <= r * r);
        b.status = any ? 'The vents are empty: waiting for new sulfur' : 'No sulfur in range';
        s.wt = 4; return;
      }
      dep.reserved = true; s.resv = dep; b.working = true; b.status = 'Digging sulfur';
      // naast de afzetting staan, aan de kant van de mijn
      const ang = Math.atan2(b.dz - dep.z, b.dx - dep.x), fx = dep.x + Math.cos(ang) * 0.32, fz = dep.z + Math.sin(ang) * 0.32;
      const ok = this.goAct(s, b, dep.k, fx, fz, [dep.x, dep.z], 'pick', d.time / gm, () => {
        s.resv = null; dep.reserved = false;
        if (dep.amount <= 0) { b.working = false; this.goHome(s, b, null); return; }
        M.take(w, dep);
        emit('dust', { x: dep.x, y: w.heightAt(dep.x, dep.z) + 0.12, z: dep.z, n: 4, color: 0xf2d73a });
        this.goHome(s, b, d.out, () => { b.working = false; this.produce(b, d.out, 1); });
      });
      if (!ok) { dep.reserved = false; s.resv = null; b.working = false; b.status = 'Cannot reach the sulfur'; s.hidden = true; s.wstate = 'inside'; s.wt = 3; }
    }
    /* jager: sluipt naar een dier, gooit een net; lukt het, dan brengt hij het vlees thuis */
    thinkHunt(s, b, d) {
      const wl = this.wild, gm = this.gatherMult(b);
      if (!wl) { b.status = 'No game in range'; s.wt = 4; return; }
      if (this.outFull(b)) { b.status = this.fullStatus(b, d.out); s.wt = 1; return; }
      const r = d.radius + (b.level - 1);
      const a = wl.findPrey(b.cx, b.cz, r);
      if (!a) { b.status = wl.anyGameNear(b.cx, b.cz, r) ? 'Letting the game recover' : 'No game in range'; s.wt = 4; return; }
      const SP = a.sp;
      if (this.outFull(b, SP.meat)) { b.status = this.fullStatus(b, d.out); s.wt = 1; return; }   // de vangst moet erbij passen
      const st = wl.stalkPoint(a, b);
      if (!st) { s.wt = 2; return; }
      a.reserved = true; s.resv = a; b.status = 'Stalking a ' + SP.name.toLowerCase();
      s.hidden = false; s.x = b.dx; s.z = b.dz; s.wstate = 'walk'; s.act = null;
      const ok = this.walkTo(s, st.k, () => {
        if (!b.alive || b.worker !== s) { this.freeWorker(s); return; }
        const dist = Math.hypot(a.x - s.x, a.z - s.z);
        if (a.dead || a.state === 'flee' || dist > 2.6) {          // weggesprongen voor de jager er was
          if (s.resv === a) { a.reserved = false; s.resv = null; }
          b.status = 'The ' + SP.name.toLowerCase() + ' got away';
          this.goHome(s, b, null); return;
        }
        wl.hold(a, s);
        s.wstate = 'act'; s.act = 'hunt'; s.ap = 0; s.actTick = 0; s.wt = d.time * SP.effort / gm;
        s.rot = Math.atan2(a.x - s.x, a.z - s.z);
        s.onAct = () => {
          if (s.resv === a) s.resv = null;
          a.reserved = false;
          if (a.dead) { this.goHome(s, b, null); return; }
          if (Math.random() < SP.catch * (1 + 0.1 * (b.level - 1))) {
            wl.caught(a);
            sfx('plant', a.x, a.z);
            this.goHome(s, b, 'meat', () => this.produce(b, 'meat', SP.meat));
          } else {
            wl.scare(a, s.x, s.z);
            b.status = 'The ' + SP.name.toLowerCase() + ' escaped the net';
            this.goHome(s, b, null);
          }
        };
      }, st.x, st.z);
      if (!ok) { a.reserved = false; s.resv = null; s.hidden = true; s.wstate = 'inside'; s.wt = 3; b.status = 'Cannot reach the game'; }
    }
    updateWorker(s, dt) {
      const b = s.work;
      if (!b || !b.alive) { this.freeWorker(s); return; }
      if (s.wstate === 'eat') { this.updateMeal(s, dt); return; }
      if (s.wstate === 'inside') { s.wt -= dt; if (s.wt <= 0 && !(this.workerMeal && this.workerMeal(s, b))) this.think(s, b); }
      else if (s.wstate === 'act') {
        s.wt -= dt; s.ap += dt;
        // maaien: het graan zakt mee weg met de voortgang
        if (s.mowField && s.act === 'harvest') {
          const f = s.mowField, p = VE.clamp(s.ap / (s.ap + Math.max(0.001, s.wt)), 0, 1);
          if (!f.dead && Math.abs((f.mow || 0) - p) > 0.04) { f.mow = p; this.nature.setFieldM(f); }
        }
        const per = s.act === 'chop' ? 0.75 : s.act === 'pick' ? 0.6 : s.act === 'hoe' ? 0.65 : 0.9;
        const tick = Math.floor(s.ap / per);
        if (tick !== s.actTick) {
          s.actTick = tick;
          if (s.act === 'chop') { sfx('chop', s.x, s.z); emit('chips', { x: s.x + Math.sin(s.rot) * 0.2, y: s.y + 0.1, z: s.z + Math.cos(s.rot) * 0.2 }); }
          else if (s.act === 'pick') sfx('pick', s.x, s.z);
          else if (s.act === 'hoe') { sfx('plant', s.x, s.z); emit('dust', { x: s.x + Math.sin(s.rot) * 0.22, y: s.y + 0.02, z: s.z + Math.cos(s.rot) * 0.22, n: 3, small: true }); }   // kluitjes aarde
        }
        if (s.wt <= 0) { s.act = null; const f = s.onAct; s.onAct = null; if (f) f(); }
      }
    }
    updateBuilding(b, dt) {
      const d = b.def;
      for (const a of b.anims) {
        if (a.kind === 'sails') { a.speed = VE.lerp(a.speed || 0, b.working ? 1.6 : 0.15, dt * 0.8); a.mesh.rotation.z -= a.speed * dt; }
        else if (a.kind === 'saw') { if (b.working) a.mesh.rotation.z -= dt * 14; }
        else if (a.kind === 'flag') { a.ph += dt * 2.2; a.mesh.rotation.y = Math.sin(a.ph) * 0.35 + Math.sin(a.ph * 2.3) * 0.12; }
        else if (VE.animPart) VE.animPart(this, b, a, dt);         // mijnkarretje, katrol, blaasbalg, gloed (js/mining.js)
      }
      if (!b.built) return;
      // smoke
      if (b.chimneys.length) {
        b.smokeT = (b.smokeT || Math.random()) - dt;
        if (b.smokeT <= 0) {
          // woonhuizen en opslag: dun en rustig; werkplaatsen: alleen bij werk (meer als ze echt produceren);
          // smelterij: dik en donker tijdens het smelten, anders een dun pluimpje
          let kind = null, every = 2.5;
          if (d.recipes) { kind = b.working ? 'heavy' : 'smoulder'; every = b.working ? 0.16 : 1.6; }
          else if (d.storage || d.housing || d.barracks) { kind = 'home'; every = 0.75; }   // kazerne: slaapzaal, rustige rook
          else if (b.working) { kind = 'work'; every = 0.32; }
          else if (b.worker && b.worker.hidden) { kind = 'work'; every = 1.1; }
          b.smokeT = every * (0.85 + Math.random() * 0.3);
          if (kind) for (const c of b.chimneys) emit('smoke', { x: b.cx + c[0], y: b.y + c[1], z: b.cz + c[2], kind: kind });
        }
      }
      const s = b.worker;
      const present = s && s.mode === 'work' && s.wstate === 'inside';
      if (d.market) {
        if (!present) { b.status = s ? 'Merchant is on the way' : 'Needs a merchant'; return; }
        let total = 0; for (const r in b.input) total += b.input[r];
        if (!total) { b.status = 'Waiting for goods to sell'; b.working = false; return; }
        b.working = true; b.status = 'Trading';
        b.wt -= dt * this.lvlMult(b) * (this.workEff ? this.workEff(b) : 1);
        if (b.wt <= 0) {
          b.wt = 2.4;
          const keys = VE.RES_ORDER.filter(r => b.input[r] > 0);
          const r = keys[b.sellIdx++ % keys.length];
          b.input[r]--;
          this.earn(Math.round(VE.RES[r].price * this.tradeMult()), b.cx, b.y + 1, b.cz);
        }
        return;
      }
      if (d.barracks) { b.stT = (b.stT || 0) - dt; if (b.stT <= 0) { b.stT = 0.5; b.status = this.barracksStatus(b); } b.working = !!(b.queue && b.queue.some(e => e.st === 'train')); return; }
      if (!d.inp) return;
      if (!present) { b.status = s ? (s.wstate === 'eat' ? 'Worker is having a meal' : 'Worker is on the way') : 'Needs a worker'; if (!(s && s.wstate === 'eat')) b.working = false; return; }
      if (this.tooHungry && this.tooHungry(s)) { b.status = 'Too hungry to work: needs food'; return; }
      if (d.recipes) this.smithAtOven(b, s, dt);
      const R = this.rcp(b);
      if (!b.working) {
        let ok = true; for (const r in R.inp) if ((b.input[r] || 0) < R.inp[r]) ok = false;
        if (!ok) { b.status = 'Waiting for ' + Object.keys(R.inp).map(r => VE.RES[r].name.toLowerCase()).join(' & '); return; }
        if (R.out) { let k = 0; for (const r in R.out) k += R.out[r]; if (this.outFull(b, k)) { b.status = this.fullStatus(b, Object.keys(R.out)[0]); return; } }
        for (const r in R.inp) b.input[r] -= R.inp[r];
        b.working = true; b.wt = R.time; b.wt0 = R.time; b.batch = b.recipe || null; b.status = d.forge ? 'Forging ' + R.name.toLowerCase() : d.recipes ? 'Smelting ' + R.name.toLowerCase() : 'Working';
      } else {
        b.wt -= dt * this.craftMult(b);
        if (b.wt <= 0) {
          b.working = false;
          const RB = d.recipes && b.batch && d.recipes[b.batch] ? d.recipes[b.batch] : R;   // de lopende batch maakt af wat erin ging
          if (RB.out) for (const r in RB.out) this.produce(b, r, RB.out[r]);
          if (RB.outGold) this.earn(Math.round(RB.outGold * this.tradeMult()), b.cx, b.y + 1.1, b.cz);
        }
      }
    }
    /* smelterij: tijdens het smelten staat de smelter buiten bij de ovenmond (hamer, vonken); daarna weer binnen */
    smithAtOven(b, s, dt) {
      const md = VE.buildModel(b.type, b.level), anvil = md.anims && md.anims.find(a => a.kind === 'hotblade');
      const g = anvil || (md.anims && md.anims.find(a => a.kind === 'glow'));
      if (b.working && g) {
        s.hidden = false; s.tool = 'hammer'; s.act = 'hammer'; s.ap += dt;
        // wapensmederij: de smid staat voor het aambeeld en slaat op het gloeiende wapen; smelterij: bij de ovenmond
        if (anvil) { s.x = b.cx + g.x; s.z = b.cz + g.z + 0.12; s.rot = Math.PI; }
        else { s.x = b.cx + g.x + 0.05; s.z = b.cz + g.z + 0.15; s.rot = Math.PI + 0.25; }
        if (Math.floor(s.ap / 0.45) !== s.actTick) { s.actTick = Math.floor(s.ap / 0.45); if (s.actTick % 2 === 0) sfx('hammer', s.x, s.z); }
      } else if (s.act === 'hammer') { s.hidden = true; s.act = null; s.x = b.dx; s.z = b.dz; }
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
      this.time += dt; this.sd = true;
      const w = this.world;
      // settlers
      for (const s of this.settlers) {
        if (s.path) this.moveSettler(s, dt); else s.moving = false;
        if (s.mode === 'work') this.updateWorker(s, dt);
        else if (s.mode === 'build') this.updateBuilder(s, dt);
        else if (s.mode === 'train') this.updateTrainee(s, dt);
        else if (s.mode === 'soldier') this.updateSoldier(s, dt);
        else if (s.mode === 'idle' || s.mode === 'wander') this.updateIdle(s, dt);
        else if (s.mode === 'eat') this.updateMeal(s, dt);
        s.y = w.heightAt(s.x, s.z);
      }
      if (this.hungerTick) this.hungerTick(dt);                         // honger en tevredenheid (js/food.js)
      for (const b of this.buildings) this.updateBuilding(b, dt);
      this.nature.update(dt, this.growMult());
      if (this.wild) this.wild.update(dt);
      if (VE.Mining && VE.Mining.regen) VE.Mining.regen(this, dt);     // zwavel rond de vulkaan komt langzaam terug
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
          const food = (VE.FOOD || ['bread', 'fish']).find(r => this.avail(r) > 0) || null;
          if (food) this.takeGoods(food, 1);
          const s = this.spawnSettler();
          if (s) { emit('arrive', { x: s.x, z: s.z }); s.food = food ? 0.9 : 0.55; }
          const tav = this.countBuilt('tavern');
          const mood = this.foodSummary ? this.foodSummary().mood : 0.65;   // tevreden dorp: sneller nieuwkomers
          this.arriveT = (food ? 6.5 : 20) * Math.max(0.45, 1 - tav * 0.15) * VE.clamp(1.45 - mood * 0.75, 0.75, 1.4);
        } else this.arriveT = 3;
      }
      this.wearT -= dt; if (this.wearT <= 0) { this.wearT = 5; this.wearDecay(); }
      w.paths.update(dt, this);
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
        case 'weapons': { let n = 0; for (const r of VE.WEAPONS || []) n += this.stock[r] || 0; return n; }
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
      if (n > 0) { const c = this.buyPrice(r) * n; if (this.gold < c) return false; this.gold -= c; this.addGoods(r, n); return true; }
      n = -n; if (this.avail(r) < n) return false;
      this.takeGoods(r, n); const g = this.sellPrice(r) * n; this.gold += g; this.stats.goldEarned += g; return true;
    }
    buyUpgrade(id) {
      const u = VE.UPGRADES.find(x => x.id === id), lvl = this.upg[id];
      if (!u || lvl >= u.cost.length || this.gold < u.cost[lvl]) return false;
      this.gold -= u.cost[lvl]; this.upg[id]++;
      return true;
    }

    /* ---------- save / load ---------- */
    serialize(cam) {
      this.sd = true;                                // altijd een verse telling
      const w = this.world;
      const bl = this.buildings.filter(b => b.alive).map(b => ({
        id: b.id, t: b.type, i: b.i, j: b.j, l: b.level, b: b.built ? 1 : 0, u: b.used,
        d: b.built ? {} : Object.assign({}, b.delivered), inp: Object.assign({}, b.input), out: Object.assign({}, b.output), sell: b.sell, keep: b.keep, feed: b.feed === false ? 0 : undefined, rc: b.recipe || undefined,
        st: b.store ? Object.assign({}, b.store) : undefined, ac: b.accept ? VE.RES_ORDER.filter(r => b.accept[r]) : undefined,
        up: b.up ? { l: b.up.lvl, c: Object.assign({}, b.up.cost), g: b.up.gold, d: Object.assign({}, b.up.delivered), u: b.up.used } : undefined
      }));
      for (const e of bl) { const b = this.bmap[e.id]; if (b && b.queue && this.serializeBarracks) this.serializeBarracks(b, e); }
      // wat dragers op dit moment vasthouden, gaat terug naar waar het vandaan kwam (of het dorpshuis):
      // na het laden ligt het daar weer, er raakt niets kwijt
      const byId = {}; for (const e of bl) byId[e.id] = e;
      const hqE = this.hq && byId[this.hq.id];
      let carried = 0;
      for (const s of this.settlers) {
        const t = s.task; if (!t || !t.picked || !s.carry) continue;
        const e = t.src && t.src.alive && t.src.built ? byId[t.src.id] : hqE;
        if (!e) continue;
        const h = e.st || e.out; h[s.carry] = (h[s.carry] || 0) + 1; carried++;
      }
      for (const b of this.buildings) {
        const L = b.alive && b.lumber; if (!L) continue;
        const n = (L.tree && !L.tree.dead ? 2 : 0) + (L.long ? 2 : 0) + (L.pieces ? L.pieces.length : 0), e = byId[b.id];
        if (n && e) e.out.log = (e.out.log || 0) + n;
      }
      // wat een werker op weg naar huis draagt (stam, steen, graan ...), ligt na het laden op zijn stapel
      const inHand = {};
      for (const s of this.settlers) {
        const b = s.work;
        if (s.mode !== 'work' || !s.carry || !b || !b.alive || !byId[b.id] || (s.task && s.task.picked)) continue;
        byId[b.id].out[s.carry] = (byId[b.id].out[s.carry] || 0) + 1; inHand[s.carry] = (inHand[s.carry] || 0) + 1;
      }
      const stock = Object.assign({}, this.stock);
      for (const b of this.buildings) { const L = b.alive && b.lumber; if (L) stock.log = (stock.log || 0) + (L.tree && !L.tree.dead ? 2 : 0) + (L.long ? 2 : 0) + (L.pieces ? L.pieces.length : 0); }
      if (carried) for (const s of this.settlers) if (s.task && s.task.picked && s.carry) stock[s.carry] = (stock[s.carry] || 0) + 1;
      for (const r in inHand) stock[r] = (stock[r] || 0) + inHand[r];
      return {
        v: 4, n: VE.N, g: w.gen || 1, seed: this.seed, players: this.players ? this.players.map(p => ({ id: p.id, kind: p.kind, name: p.name })) : undefined, time: Math.round(this.time), stock: stock, gold: this.gold, rank: this.rank, claimed: this.claimed,
        stats: this.stats, upg: this.upg, pop: this.settlers.length, speed: this.speed,
        buildings: bl,
        ore: VE.Mining ? VE.Mining.serialize(w) : undefined, wild: this.wild ? this.wild.serialize() : undefined,
        sol: this.serializeSoldiers ? this.serializeSoldiers() : undefined,
        hun: this.serializeHunger ? this.serializeHunger() : undefined,
        trail: w.paths.serialize(), nature: this.nature.serialize(), fog: w.serializeFog(), cam: cam || null, saved: Date.now()
      };
    }
    load(sv, rand) {
      const w = this.world;
      this.gold = sv.gold || 0; this.rank = sv.rank || 0; this.claimed = sv.claimed || {}; this.time = sv.time || 0;
      // voorraad: v2 per gebouw (st); oude saves (v1) leggen hun totale voorraad op de startstapel (init)
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
        b.input = bs.inp || {}; b.output = bs.out || {}; if (bs.sell) b.sell = bs.sell; if (bs.keep !== undefined) b.keep = bs.keep; if (bs.feed === 0) b.feed = false;
        if (bs.rc && b.def.recipes && b.def.recipes[bs.rc]) b.recipe = bs.rc;
        if (b.store && bs.st && (sv.v || 1) >= 2) for (const r in bs.st) if (VE.RES[r] && bs.st[r] > 0) b.store[r] = bs.st[r];
        if (b.accept && !bs.ac) for (const r of VE.RES_ORDER) b.accept[r] = true;      // oude save: alles
        if (b.accept && bs.ac) for (const r of VE.RES_ORDER) b.accept[r] = bs.ac.indexOf(r) >= 0 || ((sv.v || 1) < 3 && VE.RES[r].weapon === true) || ((sv.v || 1) < 4 && r === 'gear');
        if (bs.up && b.built && bs.up.l > b.level) {                   // lopende upgrade (bouwplaats) gaat gewoon verder
          const c = {}; let total = 0; for (const r in bs.up.c) if (VE.RES[r] && bs.up.c[r] > 0) { c[r] = bs.up.c[r]; total += c[r]; }
          b.up = { lvl: bs.up.l, cost: c, gold: bs.up.g || 0, delivered: Object.assign({}, bs.up.d || {}), incoming: {}, used: Math.min(bs.up.u || 0, total), total: total };
          this.upScaffold(b);
        }
        if (this.loadBarracks) this.loadBarracks(b, bs);                    // wachtrij van een kazerne
      }
      // stats.built was re-incremented by instant completes; restore the saved values
      if (sv.stats && sv.stats.built) this.stats.built = Object.assign({}, sv.stats.built);
      // voetpaden: nieuw formaat (slijtageraster); oude saves: [tegel, slijtage] of kale tegelnummers (zelf aangelegde wegen)
      const statsRoads = this.stats.roads;
      if (sv.trail) w.paths.load(sv.trail);
      else for (const e of sv.roads || []) {
        const k = Array.isArray(e) ? e[0] : e, v = Array.isArray(e) ? e[1] : 40;
        if (w.bld[k] || w.door[k] || w.type[k] === 1) continue;
        // oud: spoor vanaf 2, pad vanaf 8, max 40 → nieuwe stadia (een pad blijft een pad)
        const nv = v >= 8 ? VE.PATHS.stage[4] + (v - 8) * 3 : v >= 2 ? VE.PATHS.stage[3] + (v - 2) * 6 : v * 15;
        w.paths.setTile(k, Math.min(VE.PATHS.max, nv));
      }
      w.paths.syncTiles(this);
      this.stats.roads = statsRoads;
      const nat = sv.nature || { t: [], r: [], f: [] };
      for (const t of nat.t) { const k = t[0]; if (!w.bld[k] && !w.road[k]) this.nature.addTree(k % N, (k / N) | 0, t[1], t[2], rand); }
      for (const r of nat.r) { const k = r[0]; if (!w.bld[k]) { this.nature.addRock(k % N, (k / N) | 0, r[1], rand); w.clearDeco(k); } }
      for (const f of nat.f) {
        const k = f[0]; if (w.bld[k] || w.road[k]) continue;
        const owner = idmap[f[4]];
        const fo = this.nature.addField(k % N, (k / N) | 0, f[1], owner || null);
        // opgeslagen tijdens het binden ('cut'): het graan staat weer rijp op het veld, de boer oogst opnieuw
        if (fo) { fo.growth = f[2]; fo.state = f[3] === 'cut' ? 'grown' : f[3]; if (f[3] === 'cut') fo.growth = 1; this.nature.setFieldM(fo); if (owner) owner.fields.push(fo); }
      }
      // oude saves: ingangen die door rotsblokken zijn ingesloten alsnog vrijmaken (rotsen staan er nu weer)
      for (const b of this.buildings) if (b.alive && !b.def.pile && !b.def.mountain) this.clearDoorway(b);
      this.sd = true;
      const sol = sv.sol || [];                                           // soldaten tellen mee in de bevolking
      const n = Math.max(4, (sv.pop || 10) - sol.length);
      for (let i = 0; i < n; i++) this.spawnSettler();
      for (const s of this.settlers) { s.x += (Math.random() - 0.5) * 2; s.z += Math.random() * 1.2; }
      if (this.loadHunger) this.loadHunger(sv.hun);                     // oude saves: iedereen verzadigd
      if (this.loadSoldiers) this.loadSoldiers(sol);
    }
  }
  VE.Game = Game;
})(window.VE);
