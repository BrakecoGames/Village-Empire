/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Ertsaders in de bergen (steenkool, ijzer, koper, goud) en de bewegende delen van mijnen en smelterij.

   Wereld: world.ore[k] = ader-object of null (alleen op bergtegels, type 2), world.deposits = lijst.
   Een ader is géén obstakel (de mijnwerker staat er bovenop te hakken) en geen bouwgrond: een mijn
   komt ernaast (bouwregel in Game.canPlace).

   Generatie: eigen random-reeks uit de wereldseed (los van de gedeelde `rand` van bomen/rotsen, zodat
   de bestaande wereldgeneratie exact gelijk blijft). Aders liggen in groepjes op bergtegels zonder rotsblok.
   Garantie tegen vastlopen: de eerste steenkool- en ijzerader liggen aan de bergrand die het dichtst bij
   het dorp ligt, met naast elke ader een plek waar een mijn past. Gouderts is zeldzaam en ligt dieper.
   Na het genereren worden de aders met de save opgeslagen (voorraad per tegel).

   Weergave: per ertssoort en variant één InstancedMesh (Blender: public/models/ores.glb, anders
   procedureel). Hoe meer er is uitgehakt, hoe kleiner de ader. */
'use strict';
(function (VE) {
  const N = VE.N;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  const VARIANTS = 2;

  /* aders per soort: aantal groepjes, tegels per groepje, voorraad per tegel, waar (rangorde van afstand tot het dorp, 0..1) */
  const PLAN = {
    1: { clusters: 4, size: [4, 6], amount: 42, band: [0, 0.55] },     // steenkool: algemeen
    2: { clusters: 3, size: [3, 5], amount: 36, band: [0, 0.6] },      // ijzer: regelmatig
    3: { clusters: 2, size: [3, 4], amount: 32, band: [0.08, 0.7] },   // koper: minder algemeen
    4: { clusters: 2, size: [2, 3], amount: 24, band: [0.3, 0.95] }    // goud: zeldzaam, dieper in de bergen
  };
  VE.ORE_PLAN = PLAN;

  const Mining = {
    /* ---------------- generatie ---------------- */
    init(game, saved) {
      const w = game.world;
      w.ore = new Array(N * N).fill(null);
      w.deposits = [];
      if (Array.isArray(saved) && saved.length) {
        for (const e of saved) {
          const k = e[0], t = e[1];
          if (!VE.ORES[t] || k < 0 || k >= N * N || w.type[k] !== 2) continue;
          this.add(w, k, t, e[2], e[3] || e[2]);
        }
      } else this.generate(w);
      // een ader ligt open en bloot: geen boom erop, geen decoratie erdoorheen
      for (const d of w.deposits) {
        if (w.tree[d.k] && game.nature) game.nature.removeTree(w.tree[d.k]);
        if (w.clearDeco) w.clearDeco(d.k);
      }
      this.buildMeshes(game);
    },
    add(w, k, type, amount, max) {
      const i = k % N, j = (k / N) | 0, h = VE.hash2 ? VE.hash2(k, type) : ((k * 2654435761) >>> 0);
      const d = { k: k, i: i, j: j, type: type, amount: amount, max: max || amount, reserved: false, dead: false,
        x: i + 0.5 + ((h % 100) / 100 - 0.5) * 0.18, z: j + 0.5 + (((h >>> 8) % 100) / 100 - 0.5) * 0.18,
        rot: ((h >>> 12) % 628) / 100, sc: 0.9 + ((h >>> 20) % 25) / 100, v: (h >>> 4) % VARIANTS, idx: -1 };
      w.ore[k] = d; w.deposits.push(d);
      return d;
    },
    /* een mijn past op (i, j): bergtegel, geen ader, geen rotsblok, niet te steil, ingang vrij */
    mineSpot(w, i, j) {
      if (!w.inb(i, j) || !w.inb(i, j + 1)) return false;
      const k = j * N + i, dk = (j + 1) * N + i;
      if (w.type[k] !== 2 || w.ore[k] || w.rock[k]) return false;
      if (w.slope(i, j, 1) > 1.9) return false;
      if (w.type[dk] === 1 || w.rock[dk]) return false;
      return true;
    },
    generate(w) {
      const rnd = VE.rng((w.seed ^ 0x0e5a1173) >>> 0);
      const cx = w.start.i + 1, cz = w.start.j + 1;
      const cand = [];
      for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
        const k = j * N + i;
        if (w.type[k] !== 2 || w.rock[k]) continue;
        if (w.slope(i, j, 1) > 2.6) continue;
        cand.push({ k: k, i: i, j: j, d: Math.hypot(i + 0.5 - cx, j + 0.5 - cz) });
      }
      if (!cand.length) return;
      cand.sort((a, b) => a.d - b.d || a.k - b.k);
      const seeds = [];
      const farEnough = (c, minD) => seeds.every(s => Math.hypot(s.i - c.i, s.j - c.j) >= minD);
      const hasSpot = c => {
        for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
          if (Math.hypot(di, dj) > 2.4 || (!di && !dj)) continue;
          if (this.mineSpot(w, c.i + di, c.j + dj)) return true;
        }
        return false;
      };
      const grow = (c, type, n, amount) => {
        const tiles = [c.k], open = [c.k];
        w.ore[c.k] = true;
        while (tiles.length < n && open.length) {
          const from = open[Math.floor(rnd() * open.length)], fi = from % N, fj = (from / N) | 0;
          const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(d => [fi + d[0], fj + d[1]]).filter(p => {
            if (!w.inb(p[0], p[1])) return false;
            const q = p[1] * N + p[0];
            return w.type[q] === 2 && !w.rock[q] && !w.ore[q];
          });
          if (!nb.length) { open.splice(open.indexOf(from), 1); continue; }
          const p = nb[Math.floor(rnd() * nb.length)], q = p[1] * N + p[0];
          w.ore[q] = true; tiles.push(q); open.push(q);
        }
        for (const q of tiles) { w.ore[q] = null; this.add(w, q, type, Math.round(amount * (0.8 + rnd() * 0.4))); }
      };
      // volgorde: eerst gegarandeerd steenkool en ijzer dichtbij, dan de rest
      const order = [];
      for (const t of [1, 2, 3, 4]) for (let c = 0; c < PLAN[t].clusters; c++) order.push({ t: t, first: c === 0 });
      order.sort((a, b) => (b.first && b.t <= 2) - (a.first && a.t <= 2) || a.t - b.t);
      for (const o of order) {
        const P = PLAN[o.t];
        // de eerste steenkool- en ijzerader: in de dichtstbijzijnde strook (garantie); anders in de eigen strook
        const lo = o.first && o.t <= 2 ? 0 : Math.floor(P.band[0] * cand.length);
        const hi = o.first && o.t <= 2 ? Math.max(6, Math.floor(cand.length * 0.12)) : Math.max(lo + 4, Math.floor(P.band[1] * cand.length));
        const pool = cand.slice(lo, Math.min(cand.length, hi)).filter(c => !w.ore[c.k]);
        let pickC = null;
        for (let tries = 0; tries < 40 && pool.length; tries++) {
          const c = o.first && o.t <= 2 ? pool[Math.min(pool.length - 1, Math.floor(rnd() * Math.min(pool.length, 8)))] : pool[Math.floor(rnd() * pool.length)];
          if (farEnough(c, o.first ? 3.5 : 4.5) && hasSpot(c)) { pickC = c; break; }
        }
        if (!pickC) pickC = pool.find(c => hasSpot(c) && farEnough(c, 2.5));
        if (!pickC) continue;
        seeds.push(pickC);
        grow(pickC, o.t, P.size[0] + Math.floor(rnd() * (P.size[1] - P.size[0] + 1)), P.amount);
      }
    },

    /* ---------------- zoeken en uithakken ---------------- */
    near(w, x, z, type, r) {
      if (!w.deposits) return false;
      for (const d of w.deposits) if (d.type === type && d.amount > 0 && (d.x - x) ** 2 + (d.z - z) ** 2 <= r * r) return true;
      return false;
    },
    anyNear(w, x, z, r) {
      let best = 0, bd = 1e9;
      if (w.deposits) for (const d of w.deposits) {
        if (d.amount <= 0) continue;
        const q = (d.x - x) ** 2 + (d.z - z) ** 2;
        if (q <= r * r && q < bd) { bd = q; best = d.type; }
      }
      return best;
    },
    pick(w, x, z, type, r) {
      let best = null, bd = 1e9;
      for (const d of w.deposits || []) {
        if (d.type !== type || d.amount <= 0 || d.reserved) continue;
        const q = (d.x - x) ** 2 + (d.z - z) ** 2;
        if (q <= r * r && q < bd) { bd = q; best = d; }
      }
      return best;
    },
    take(w, d) {
      d.amount = Math.max(0, d.amount - 1);
      if (d.amount <= 0) { d.dead = true; if (w.ore[d.k] === d) w.ore[d.k] = null; }
      this.setM(w, d);
    },
    remaining(w, type) { let n = 0; for (const d of w.deposits || []) if (d.type === type) n += d.amount; return n; },
    serialize(w) { return (w.deposits || []).filter(d => d.amount > 0).map(d => [d.k, d.type, d.amount, d.max]); },
    refreshArea(w, i0, j0, i1, j1) {
      for (const d of w.deposits || []) if (d.i >= i0 && d.i <= i1 && d.j >= j0 && d.j <= j1) this.setM(w, d);
    },

    /* ---------------- weergave ---------------- */
    buildMeshes(game) {
      const w = game.world;
      if (w.oreMeshes) for (const m of w.oreMeshes) if (m) w.root.remove(m);
      w.oreMeshes = [];
      const mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 18, specular: 0x333333, flatShading: false });
      const counts = {};
      for (const d of w.deposits) { const key = d.type * VARIANTS + d.v; counts[key] = (counts[key] || 0) + 1; }
      for (let t = 1; t <= 4; t++) for (let v = 0; v < VARIANTS; v++) {
        const key = t * VARIANTS + v, n = counts[key] || 0;
        if (!n) { w.oreMeshes[key] = null; continue; }
        const geo = (VE.oreGeo && VE.oreGeo(t, v)) || procOre(t, v);
        const m = new THREE.InstancedMesh(geo, mat, n);
        m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.name = 'ore_' + VE.ORES[t].key + v;
        w.root.add(m); w.oreMeshes[key] = m; m.userData.n = 0;
      }
      for (const d of w.deposits) {
        const m = w.oreMeshes[d.type * VARIANTS + d.v];
        d.idx = m.userData.n++;
        this.setM(w, d);
      }
    },
    setM(w, d) {
      const m = w.oreMeshes && w.oreMeshes[d.type * VARIANTS + d.v];
      if (!m || d.idx < 0) return;
      if (d.amount <= 0) { m.setMatrixAt(d.idx, VE.ZERO); m.instanceMatrix.needsUpdate = true; return; }
      const f = 0.5 + 0.5 * Math.min(1, d.amount / d.max), s = d.sc * f;
      _e.set(0, d.rot, 0); _q.setFromEuler(_e);
      _m.compose(_p.set(d.x, w.heightAt(d.x, d.z) - 0.025, d.z), _q, _s.set(s, s, s));
      m.setMatrixAt(d.idx, _m); m.instanceMatrix.needsUpdate = true;
    },
    /* tijdens het plaatsen van een mijn: aders van de gevraagde soort zachtjes laten oplichten */
    highlight(game, type) {
      const w = game && game.world; if (!w || !w.deposits) return;
      if (!this.ring) {
        const g = new THREE.RingGeometry(0.36, 0.46, 28); g.rotateX(-Math.PI / 2);
        this.ring = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0.75, depthTest: false, toneMapped: false }), 120);
        this.ring.renderOrder = 6; this.ring.frustumCulled = false; this.ring.count = 0;
      }
      if (this.ring.parent !== w.root) w.root.add(this.ring);
      let n = 0;
      if (type) for (const d of w.deposits) {
        if (d.type !== type || d.amount <= 0 || n >= 120) continue;
        _m.makeTranslation(d.x, w.heightAt(d.x, d.z) + 0.06, d.z);
        this.ring.setMatrixAt(n++, _m);
      }
      this.ring.count = n; this.ring.instanceMatrix.needsUpdate = true;
      this.ring.material.color.setHex(type ? VE.ORES[type].color : 0xffffff).lerp(_c.setHex(0xffffff), 0.45);
    }
  };
  VE.Mining = Mining;

  /* procedurele reserve-ader: brokken rots met gekleurde stukken */
  function procOre(t, v) {
    const m = new VE.Model(600 + t * 7 + v);
    const rock = t === 1 ? 0x4a4a50 : t === 4 ? 0x8f8a82 : t === 3 ? 0x8a6a50 : 0x6e5a4c;
    const ore = VE.ORES[t].color;
    m.add(new THREE.DodecahedronGeometry(0.2, 0), rock, { y: 0.08, sy: 0.6, j: 0.06 });
    m.add(new THREE.DodecahedronGeometry(0.12, 0), rock, { x: 0.16, y: 0.05, z: 0.06, sy: 0.7, j: 0.06 });
    for (let i = 0; i < 5 + v * 2; i++) {
      const a = i * 2.4 + v;
      m.add(new THREE.OctahedronGeometry(0.035 + (i % 3) * 0.012, 0), ore, { x: Math.cos(a) * 0.13, y: 0.1 + (i % 2) * 0.05, z: Math.sin(a) * 0.12, j: 0.04 });
    }
    return m.build();
  }

  /* ---------------- bewegende delen van mijnen en smelterij ---------------- */
  // kind: 'cart' (karretje rijdt over de rails naar buiten en terug), 'wheel' (katrol), 'bellows', 'glow' (ovenmond)
  VE.animPart = function (game, b, a, dt) {
    const s = b.worker;
    // mijn actief: de mijnwerker is buiten aan het hakken, of heeft net iets opgeleverd
    const busy = b.def.gather === 'ore' ? !!(s && s.mode === 'work' && s.wstate !== 'inside') : !!b.working;
    a.v = VE.lerp(a.v || 0, busy ? 1 : 0, Math.min(1, dt * 2));
    if (!a.base) a.base = a.mesh.position.clone();
    if (a.kind === 'cart') {
      a.ph += dt * 0.9 * a.v;
      const z = (1 - Math.cos(a.ph)) * 0.5;                          // 0 = in de schacht, 1 = buiten bij de stort
      a.mesh.position.set(a.base.x, a.base.y, a.base.z + z * 0.16 * Math.min(1, a.v * 3));
    } else if (a.kind === 'wheel') {
      a.mesh.rotation.x -= dt * 3.2 * a.v;
    } else if (a.kind === 'bellows') {
      a.ph += dt * 4.2 * a.v;
      a.mesh.scale.y = 1 - 0.28 * (0.5 + 0.5 * Math.sin(a.ph)) * a.v;
    } else if (a.kind === 'glow') {
      const mat = a.mesh.material;
      if (mat && mat.color) {
        const fl = 0.85 + 0.15 * Math.sin(game.time * 13 + a.ph) * Math.sin(game.time * 7.3);
        const k = 0.18 + 0.82 * a.v * fl;
        mat.color.setRGB(0.35 + 0.65 * k, 0.12 + 0.48 * k * k, 0.04 + 0.12 * k * k * k);
      }
      // vonken uit de ovenmond terwijl er gesmolten wordt
      if (a.v > 0.5) {
        a.sp = (a.sp || 0) - dt;
        if (a.sp <= 0) { a.sp = 0.35 + Math.random() * 0.45; VE.bus.emit('sparks', { x: b.cx + a.base.x, y: b.y + a.base.y + 0.02, z: b.cz + a.base.z + 0.04 }); }
      }
    }
  };
  /* ovengloed: eigen materiaal per gebouw (de rest deelt het gebouwmateriaal) */
  VE.glowMat = function () { return new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); };

  /* ---------------- ertsaders uit Blender (public/models/ores.glb, nodes ore_<soort>_<v>) ---------------- */
  VE.oreSource = 'loading';
  const oreGeos = {};
  VE.oreGeo = (t, v) => oreGeos[t * VARIANTS + v] || null;
  const URL = 'public/models/ores.glb' + (VE.VERSION ? '?v=' + VE.VERSION : '');
  const load = (VE.loadGlb ? VE.loadGlb(URL) : Promise.reject(new Error('GLTFLoader niet beschikbaar')))
    .then(gltf => {
      for (let t = 1; t <= 4; t++) for (let v = 0; v < VARIANTS; v++) {
        const node = gltf.scene.getObjectByName('ore_' + VE.ORES[t].key + '_' + v);
        if (!node) throw new Error('node ore_' + VE.ORES[t].key + '_' + v + ' ontbreekt');
        oreGeos[t * VARIANTS + v] = VE.bakeGlbNode(node, 700 + t * 10 + v);
      }
      VE.oreSource = 'glb';
      const g = VE.game;                                              // spel al bezig: aders opnieuw opbouwen
      if (g && g.world && g.world.deposits) Mining.buildMeshes(g);
    })
    .catch(e => {
      for (const k in oreGeos) delete oreGeos[k];
      VE.oreSource = 'procedural';
      console.warn('[Village Empire] ertsaders: GLB niet geladen, eenvoudige aders worden gebruikt.', e && e.message || e);
    });
  const prev = VE.glbReady || Promise.resolve();
  VE.glbReady = Promise.race([Promise.all([prev, load]), new Promise(r => setTimeout(r, 10000))]);
})(window.VE);
