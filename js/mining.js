/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Ondergrondse ertsvoorraden (steenkool, ijzer, koper, goud) en de bewegende delen van mijnen en smelterij.

   Wereld: world.ore[k] = voorraad-object of null (alleen op bergtegels, type 2), world.deposits = lijst.
   Elke voorraad heeft een soort, een begin- en resterende hoeveelheid en daarmee een rijkdom. Ze zitten
   ONDER de grond: in de wereld zie je niets, alleen in de mijnbouw-informatielaag (terreinshader, js/paths.js)
   die verschijnt zodra je een mijn plaatst of selecteert, of met de knop 'Survey' in het tabblad Mining.
   Alleen ontdekt (onder de wolken vandaan) land wordt getoond.

   Generatie: eigen random-reeks uit de wereldseed (los van de gedeelde `rand` van bomen/rotsen, zodat
   de bestaande wereldgeneratie exact gelijk blijft). Voorraden liggen in groepjes op bergtegels zonder rotsblok.
   Garantie tegen vastlopen: de eerste steenkool- en ijzervoorraad liggen onder de bergrand die het dichtst bij
   het dorp ligt, met een plek waar een mijn past. Goud is zeldzaam en ligt dieper.
   Voorraden gaan met de save mee (zelfde formaat als de vroegere zichtbare aders: niets gaat verloren).

   Mijn: staat op een bergtegel met de juiste voorraad binnen bereik; de mijnwerker werkt ondergronds
   en haalt er één brok per keer uit. Op = melding en status. */
'use strict';
(function (VE) {
  const N = VE.N;
  const _c = new THREE.Color();

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
      this.game = game;
      this.paintSurvey(w);
    },
    add(w, k, type, amount, max) {
      const i = k % N, j = (k / N) | 0, h = VE.hash2 ? VE.hash2(k, type) : ((k * 2654435761) >>> 0);
      const d = { k: k, i: i, j: j, type: type, amount: amount, max: max || amount, reserved: false, dead: false,
        x: i + 0.5 + ((h % 100) / 100 - 0.5) * 0.18, z: j + 0.5 + (((h >>> 8) % 100) / 100 - 0.5) * 0.18,
        rich: 0.8 + ((h >>> 12) % 41) / 100 };
      w.ore[k] = d; w.deposits.push(d);
      return d;
    },
    /* een mijn past op (i, j): bergtegel, geen ader, geen rotsblok, niet te steil, ingang vrij */
    mineSpot(w, i, j) {
      if (!w.inb(i, j) || !w.inb(i, j + 1)) return false;
      const k = j * N + i, dk = (j + 1) * N + i;
      if (w.type[k] !== 2 || w.rock[k]) return false;
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
      this.surveyDirty = true;
    },
    remaining(w, type) { let n = 0; for (const d of w.deposits || []) if (d.type === type) n += d.amount; return n; },
    serialize(w) { return (w.deposits || []).filter(d => d.amount > 0).map(d => [d.k, d.type, d.amount, d.max]); },
    refreshArea() { /* ondergronds: niets te verplaatsen */ },
    /* hoeveel er binnen bereik van (x, z) zit, en hoe rijk (voor de uitleg bij het plaatsen en het infopaneel) */
    reach(w, x, z, type, r) {
      let n = 0;
      for (const d of w.deposits || []) if (d.type === type && d.amount > 0 && (d.x - x) ** 2 + (d.z - z) ** 2 <= r * r) n += d.amount;
      return n;
    },
    richness(n) { return n >= 90 ? 'rich' : n >= 35 ? 'good' : 'small'; },

    /* ---------------- mijnbouw-informatielaag ---------------- */
    // per tegel (RGBA): kleur van het erts, dekking naar rijkdom; ontdekte berg zonder erts: lichtgrijs ('niets gevonden')
    paintSurvey(w, focus) {
      if (!w.oreTex) return;
      if (focus !== undefined) this.focus = focus;
      const D = w.oreTex.image.data, f = this.focus || 0;
      D.fill(0);
      for (let k = 0; k < N * N; k++) {
        if (w.type[k] !== 2 || w.explored[k] < 0.5) continue;
        const ga = 40 / 255;                                          // voorvermenigvuldigd (zachte randen bij lineair filteren)
        D[k * 4] = 205 * ga; D[k * 4 + 1] = 200 * ga; D[k * 4 + 2] = 190 * ga; D[k * 4 + 3] = 40;
      }
      for (const d of w.deposits) {
        if (d.amount <= 0 || w.explored[d.k] < 0.5) continue;
        _c.setHex(VE.ORES[d.type].color);
        const lit = d.type === 4 ? 1 : 1.25;                         // donkere ertsen (steenkool) iets lichter, anders onzichtbaar
        const a = (0.5 + 0.5 * Math.min(1, d.amount / 45)) * (f && d.type !== f ? 0.3 : 1);
        D[d.k * 4] = Math.min(255, _c.r * 255 * lit + (d.type === 1 ? 40 : 0)) * a; D[d.k * 4 + 1] = Math.min(255, _c.g * 255 * lit + (d.type === 1 ? 40 : 0)) * a;
        D[d.k * 4 + 2] = Math.min(255, _c.b * 255 * lit + (d.type === 1 ? 50 : 0)) * a; D[d.k * 4 + 3] = 255 * a;
      }
      w.oreTex.needsUpdate = true;
      this.surveyDirty = false;
    },
    /* informatielaag aan (met nadruk op één ertssoort) of uit; vloeiend in en uit (VE.Mining.tick) */
    highlight(game, type) {
      this.want = type ? 1 : 0;
      if (game && game.world) this.paintSurvey(game.world, type || 0);
    },
    tick(game, dt, on) {
      const w = game && game.world; if (!w || !w.surveyU) return;
      const target = on ? 1 : 0, u = w.surveyU;
      if ((on || u.value > 0) && (this.surveyDirty || w.fogDirtyForSurvey)) { this.paintSurvey(w); w.fogDirtyForSurvey = false; }
      u.value += (target - u.value) * Math.min(1, dt * 6);
      if (u.value < 0.002) u.value = 0;
    }
  };
  VE.Mining = Mining;

  /* ---------------- bewegende delen van mijnen en smelterij ---------------- */
  // kind: 'cart' (karretje rijdt over de rails naar buiten en terug), 'wheel' (katrol), 'bellows', 'glow' (ovenmond)
  VE.animPart = function (game, b, a, dt) {
    const s = b.worker;
    // mijn actief: de mijnwerker is buiten aan het hakken, of heeft net iets opgeleverd
    const busy = !!b.working;
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

})(window.VE);
