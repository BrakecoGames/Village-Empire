/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Grote wereld (VE.BIG_N tegels per zijde, ±5× de oude kaart) voor maximaal drie dorpen.

   Opbouw (symmetrisch, zodat de drie startplekken gelijkwaardig zijn):
   - drie startplekken op een cirkel rond het midden (120° uit elkaar). Elke plek krijgt, in zijn eigen
     gedraaide assenstelsel, dezelfde omgeving: een zachte weide, een bergrug erachter (met erts), een meer
     opzij, bos aan de andere kant, rotsblokken en bomen dichtbij;
   - in het midden een grote vulkaan met een krater, donkere vulkanische rotsen, rook en stoom;
   - tussen speler 1 en 2, en tussen speler 1 en 3: een rivier van de vulkaan naar de rand, met voorden;
   - tussen speler 2 en 3: een diepe canyon met steile rotswanden en een rivier op de bodem. Eén stenen
     brug (Blender) is de enige oversteek: een natuurlijke strategische grens. Een spleet loopt van de
     vulkaan naar de kop van de canyon (voorbereid op een toekomstige lavastroom: world.lavaPath);
   - verder: randgebergte in de hoeken, heuvels en dalen (ruis), open graslanden, grote bossen, extra meren.
   Bijzondere plekken (ruïnes, grotten, waterval, stenen kring, monument, easter eggs): js/landmarks.js.

   Tegelsoorten: 0 gras, 1 water, 2 berg, 3 oever, 4 klif (onbegaanbaar), 5 brug (begaanbaar).
   world.volc: 1 vulkaanhelling, 2 krater, 3 spleet, 4 canyonwand (alleen voor kleuren). */
'use strict';
(function (VE) {
  const TAU = Math.PI * 2;
  const W = VE.World.prototype;

  /* afstand van (x, z) tot een lijn van punten; geeft ook de fractie langs de lijn (0..1) */
  function polyDist(pts, x, z, out) {
    let best = 1e9, bt = 0, acc = 0, total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], vx = b[0] - a[0], vz = b[1] - a[1], L = vx * vx + vz * vz || 1, l = Math.sqrt(L);
      const f = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / L));
      const d = Math.hypot(a[0] + vx * f - x, a[1] + vz * f - z);
      if (d < best) { best = d; bt = (acc + f * l) / (total || 1); }
      acc += l;
    }
    if (out) out.t = bt;
    return best;
  }
  function segDist(ax, az, bx, bz, x, z) {
    const vx = bx - ax, vz = bz - az, L = vx * vx + vz * vz || 1, f = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L));
    return Math.hypot(ax + vx * f - x, az + vz * f - z);
  }

  W.generateBig = function () {
    const N = VE.N, V1 = N + 1, seed = this.seed;
    const n = VE.noise(seed), n2 = VE.noise(seed + 77), n3 = VE.noise(seed + 191), n4 = VE.noise(seed + 333), n5 = VE.noise(seed + 555);
    const rnd = VE.rng((seed ^ 0x3a7c11d) >>> 0);
    const C = N / 2, R = N * 0.33, VS = Math.min(1.35, Math.sqrt(N / 144));   // VS: grootte van de vulkaan
    const G2 = (this.gen || 1) >= 2;                                   // generator 2: lagere bergen, terrassen (config.js VE.GEN)
    const G3 = (this.gen || 1) >= 3;                                   // generator 3: eiland in zee
    const n6 = VE.noise(seed + 2027), n7 = VE.noise(seed + 3301);
    // ruis met drievoudige symmetrie rond het midden: de kust is natuurlijk grillig, maar voor elke speler gelijk
    const rot3 = [0, 1, 2].map(k => [Math.cos(k * TAU / 3), Math.sin(k * TAU / 3)]);
    const sym = (nf, x, z, sc, oct) => { let s = 0; for (const r of rot3) { const dx = x - C, dz = z - C; s += nf.fbm((C + dx * r[0] - dz * r[1]) * sc + 11, (C + dx * r[1] + dz * r[0]) * sc - 7, oct); } return s / 3; };
    const IR = N * 0.47;                                               // straal van het eiland (zonder de grillige kust)
    const rot = rnd() * TAU;                                  // per wereld een andere draaiing van het geheel
    // ---- startplekken (speler 1 = index 0)
    const S = [0, 1, 2].map(k => {
      const a = rot + k * TAU / 3, o = [Math.cos(a), Math.sin(a)], t = [-Math.sin(a), Math.cos(a)];
      return { a: a, o: o, t: t, x: C + o[0] * R, z: C + o[1] * R };
    });
    this.starts = S.map(s => ({ i: Math.round(s.x) - 1, j: Math.round(s.z) - 1, a: s.a }));
    this.start = this.starts[0];
    const L = (s, u, v) => [s.x + s.o[0] * u + s.t[0] * v, s.z + s.o[1] * u + s.t[1] * v];   // lokaal → wereld
    // ---- rivieren (tussen 1-2 en 1-3) en canyon (tussen 2-3): op de bissectrices
    const bis = (p, q) => { const a = (S[p].a + S[q].a) / 2 + (Math.abs(S[p].a - S[q].a) > Math.PI ? Math.PI : 0); return a; };
    const line = (a, r0, wig, ph) => {
      const pts = [], dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
      for (let r = r0; r < N * 0.8; r += 2) {
        const w = Math.sin(r * 0.09 + ph) * wig + Math.sin(r * 0.23 + ph * 2) * wig * 0.35;
        const x = C + dx * r + px * w, z = C + dz * r + pz * w;
        pts.push([x, z]);
        if (x < -3 || z < -3 || x > N + 3 || z > N + 3) break;
      }
      return pts;
    };
    const rivers = [line(bis(0, 1), 15, 4, seed % 7), line(bis(0, 2), 15, 4, 3 + seed % 5)];
    const canA = bis(1, 2);
    const canyon = line(canA, 19, 3.2, 1.7);
    // voorden: twee per rivier, op vaste fracties (gelijk voor beide rivieren)
    const fords = rivers.map(p => [0.3, 0.55, 0.8].map(f => p[Math.min(p.length - 1, Math.round(f * (p.length - 1)))]));
    // brug: halverwege de canyon (tussen de startplekken van speler 2 en 3)
    const bi = Math.round(canyon.length * 0.42), bp = canyon[bi], bq = canyon[Math.min(canyon.length - 1, bi + 1)];
    const cdx = bq[0] - bp[0], cdz = bq[1] - bp[1], cl = Math.hypot(cdx, cdz) || 1;
    const bridge = { x: bp[0], z: bp[1], dir: [-cdz / cl, cdx / cl], half: 6.2 };   // dwars over de canyon
    // spleet van de vulkaan naar de kop van de canyon
    const fiss = []; {
      const ax = C + Math.cos(canA) * 6, az = C + Math.sin(canA) * 6, b = canyon[0];
      for (let q = 0; q <= 12; q++) { const f = q / 12, w = Math.sin(f * Math.PI) * Math.sin(f * 9 + seed) * 1.6; fiss.push([ax + (b[0] - ax) * f - Math.sin(canA) * w, az + (b[1] - az) * f + Math.cos(canA) * w]); }
    }
    // meren: één per startplek (zelfde relatieve plek) en drie tussen de dorpen, verder naar buiten
    const lakes = S.map(s => { const p = L(s, -1, -11); return { x: p[0], z: p[1], r: 4.1 }; });
    for (let k = 0; k < 3; k++) { const a = S[k].a + Math.PI / 3 + 0.25, r = N * 0.44; lakes.push({ x: C + Math.cos(a) * r, z: C + Math.sin(a) * r, r: 4.2 }); }
    if (N >= 180) for (let k = 0; k < 6; k++) { const a = rot + k * TAU / 6 + 0.5, r = N * (k % 2 ? 0.24 : 0.37); lakes.push({ x: C + Math.cos(a) * r, z: C + Math.sin(a) * r, r: 3.2 + (k % 3) * 0.8 }); }
    this.features = { starts: S.map(s => [s.x, s.z]), volcano: { x: C, z: C, r: 16 * VS }, rivers: rivers, canyon: canyon, bridge: bridge, fissure: fiss, lakes: lakes, fords: fords };
    const P = {};
    for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) {
      const e = n.fbm(x * 0.028, z * 0.028, 5);
      let h = 0.85 + (e - 0.45) * 2.4;
      h += Math.max(0, n5.fbm(x * 0.055 + 3, z * 0.055 - 7, 3) - 0.56) * 5;          // losse heuvels
      // bergruggen achter elke startplek (zelfde vorm, gedraaid) en randgebergte in de hoeken
      let m = 0;
      for (const s of S) {
        const a = L(s, 16, -16), b = L(s, 18, 16);
        m = Math.max(m, G2 ? VE.smooth(11, 3.5, segDist(a[0], a[1], b[0], b[1], x, z) + (n2.fbm(x * 0.07, z * 0.07, 3) - 0.5) * 4)
          : VE.smooth(8.5, 3, segDist(a[0], a[1], b[0], b[1], x, z) + (n2.fbm(x * 0.07, z * 0.07, 3) - 0.5) * 4));
      }
      // generator 2: bij elke start (zelfde plek, gedraaid) een kleine rotsheuvel binnen de eerste grenzen, voor de
      // steenmijn: zo is er altijd steen te winnen, ook als de rotsblokken op zijn en er nog geen wachttoren staat
      if (G2) for (const s of S) { const p = L(s, -5, 7); m = Math.max(m, 0.8 * VE.smooth(5.6, 1.6, Math.hypot(x - p[0], z - p[1]) + (n2.fbm(x * 0.1 + 4, z * 0.1, 2) - 0.5) * 1.2)); }
      if (!G3) for (const c of [[0, 0], [N, 0], [0, N], [N, N]]) m = Math.max(m, VE.smooth(N * 0.2, N * 0.06, Math.hypot(x - c[0], z - c[1]) + (n2.fbm(x * 0.05 + 9, z * 0.05, 3) - 0.5) * 12));
      if (G2) h = this.mountainH(h, m, n3.fbm(x * 0.2, z * 0.2, 2));
      else h += m * m * 5.4 + m * n3.fbm(x * 0.2, z * 0.2, 2) * 1.6;
      // vulkaan: brede kegel met een krater bovenop
      const dv = Math.hypot(x - C, z - C) + (n4.fbm(x * 0.12, z * 0.12, 2) - 0.5) * 2.2;
      const cone = VE.smooth(18 * VS, 2.5, dv);
      // ruwe hellingen: radiale geulen en ribbels (lavastromen uit het verleden)
      const va = Math.atan2(z - C, x - C), gully = (Math.sin(va * 11 + n4.fbm(x * 0.15, z * 0.15, 2) * 6) * 0.5 + 0.5) * 0.45;
      // generator 3: brede voet met daarop een steile topkegel die ver boven de mist uitsteekt (herkenningspunt)
      // rechte kegel (geen koepel) met geulen en ribbels langs de flanken
      // binnen de kraterrand (4,6 × VS) blijft de top vlak; daarin wordt hieronder de krater uitgediept
      const sl = G3 ? VE.clamp((8.6 * VS - Math.max(dv, 4.6 * VS)) / (6.8 * VS), 0, 1) : 0;
      const summit = G3 ? Math.pow(sl, 1.15) * 12 - sl * (1 - sl) * gully * 3.4 : 0;
      h = Math.max(h, 0.9 + Math.pow(cone, 1.3) * (G3 ? 5.4 : G2 ? 6.2 : 8.6) + summit - gully * cone * (1 - cone) * 2.2);
      h -= G3 ? VE.smooth(4.2 * VS, 2.4 * VS, dv) * 3.6 : VE.smooth(4.8 * VS, 1.6, dv) * 2.8;
      // rivieren met voorden en een breed dal
      rivers.forEach((pts, ri) => {
        const d = polyDist(pts, x, z) + (n4(x * 0.3, z * 0.3) - 0.5) * 0.8;
        if (d > (G2 ? 9.5 : 7)) return;
        let ford = 0; for (const fp of fords[ri]) ford = Math.max(ford, VE.smooth(2.8, 0.9, Math.hypot(x - fp[0], z - fp[1])));
        h = G2 ? VE.lerp(h, Math.min(h, 0.55 + Math.max(0, d - 2.2) * 0.45), VE.smooth(9, 2.2, d) * 0.95)   // breed dal, ook door een berg
          : VE.lerp(h, Math.min(h, 0.55), VE.smooth(6.5, 2.2, d) * 0.6);
        h = VE.lerp(h, -0.75, VE.smooth(2.4, 0.7, d) * (1 - ford * 0.92));
        if (ford > 0 && d < 3) h = Math.max(h, VE.lerp(h, 0.22, ford));
      });
      // meren
      if (G2) for (const l of lakes) { const dl = Math.hypot(x - l.x, z - l.z); if (dl < l.r + 7) h = Math.min(h, 0.6 + Math.max(0, dl - l.r) * 0.45); }   // geleidelijke oever
      for (const l of lakes) h = VE.lerp(h, -0.65, VE.smooth(l.r, l.r * 0.45, Math.hypot(x - l.x, z - l.z) + (n4(x * 0.3 + 9, z * 0.3) - 0.5) * 1.8));
      // spleet: smalle, ondiepe geul van donker gesteente
      const df = polyDist(fiss, x, z);
      if (df < 2.4) h -= VE.smooth(1.6, 0.4, df) * 0.6;
      // canyon: plateau aan weerszijden, steile wanden, rivier op de bodem
      const o = {}, dc = polyDist(canyon, x, z, o) + (n4(x * 0.25, z * 0.25) - 0.5) * 0.6;
      if (dc < 14) {
        const head = VE.smooth(0, 0.04, o.t);                    // de kop van de canyon loopt rond af
        // hoog plateau aan weerszijden, dan bijna loodrechte wanden met een paar richels, smalle rivier op de bodem
        h = VE.lerp(h, Math.max(h, 2.8 + (n5(x * 0.2, z * 0.2) - 0.5) * 0.4), VE.smooth(13, 6, dc) * head);
        const wall = VE.smooth(4.1, 2.5, dc), ledge = VE.smooth(3.6, 3.1, dc) * (1 - VE.smooth(3.1, 2.7, dc));
        h = VE.lerp(h, -0.85, wall * head) + ledge * 0.35 * head;
      }
      // weides rond de startplekken
      for (const s of S) h = VE.lerp(h, 0.9 + (e - 0.5) * 0.4, VE.smooth(8.5, 3, Math.hypot(x - s.x, z - s.z)));
      let cst = 0, cliff = 0;
      if (G3) {
        // c < 1: land, c >= 1: zee. Grillige kust uit symmetrische ruis, een diepe baai bij elke start (haven, later)
        let c = Math.hypot(x - C, z - C) / IR + (sym(n6, x, z, 0.02, 3) - 0.5) * 0.85 + (sym(n6, x, z, 0.06, 2) - 0.5) * 0.4 + (sym(n7, x, z, 0.14, 2) - 0.5) * 0.14;
        for (const s of S) c -= VE.smooth(32, 18, Math.hypot(x - s.x, z - s.z)) * 0.22;              // rond elke start: genoeg land (ook de bergrug)
        c += VE.smooth(N / 2 - 12, N / 2 - 2, Math.hypot(x - C, z - C)) * 0.8;      // aan de rand altijd zee (cirkel: symmetrisch voor de drie spelers)
        for (const s of S) { const b = L(s, 20, 19); c += VE.smooth(11, 3, Math.hypot(x - b[0], z - b[1])) * 0.3; const b2 = L(s, 40, 25); c += VE.smooth(5, 1.5, segDist(b[0], b[1], b2[0], b2[1], x, z)) * 0.45; /* geul naar open zee */ }
        cliff = VE.smooth(0.485, 0.54, sym(n7, x, z, 0.04, 2));                   // stukken kust met hoge kliffen
        for (const s of S) { const b = L(s, 20, 19); cliff *= VE.smooth(7, 13, Math.hypot(x - b[0], z - b[1])); }   // in de baai altijd strand (haven, later)
        cst = c;
        if (c < 1) {
          // strand: zacht aflopend naar de waterlijn; klif: land blijft hoog tot vlak bij de rand
          const beach = VE.smooth(0.9, 1.0, c);
          const hb = VE.lerp(h, 0.16 + (e - 0.5) * 0.08, beach);
          const hc = Math.max(h, VE.lerp(h, 1.9 + n7(x * 0.3, z * 0.3) * 0.7, VE.smooth(0.88, 0.97, c)));
          // de canyon loopt met zijn steile wanden door tot in zee: niemand loopt er via het strand omheen (alleen de brug)
          h = VE.lerp(VE.lerp(hb, hc, cliff), h, VE.smooth(6.5, 4.8, dc));
        } else {
          // zee: snel dieper, met hier en daar een rotspilaar voor de kliffen
          h = -0.75 - Math.min(2.4, (c - 1) * 12);
          const stack = cliff * VE.smooth(0.72, 0.8, n7(x * 0.32 + 5, z * 0.32 - 3)) * (1 - VE.smooth(1.06, 1.14, c));
          if (stack > 0.05) h = VE.lerp(h, 1.6 + n7(x, z) * 0.8, VE.smooth(0.05, 0.5, stack));
        }
      }
      this.H[z * V1 + x] = h;
      this.gnoise[z * V1 + x] = n4.fbm(x * 0.09 + 5, z * 0.09 - 3, 3);
      if (z < N && x < N) P[z * N + x] = { m: m, dv: dv, dc: dc, df: df, c: cst, cl: cliff };
    }
    this.volc = new Uint8Array(N * N);
    this.deck = new Float32Array(N * N).fill(-99);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, p = P[k];
      this.mount[k] = Math.max(p.m, VE.smooth(16 * VS, 9 * VS, p.dv) * 0.9);
      this.forest[k] = n3.fbm(i * 0.07 + 20, j * 0.07 - 13, 3);
      const hc = this.tileH(i, j);
      let t = 0;
      if (hc < 0.06) t = 1;
      else if (p.dc < 5.2 && this.slope(i, j) > 0.9) t = 4;    // canyonwand: steile klif
      else if (G3 && p.c > 0.9 && p.cl > 0.3 && this.slope(i, j) > 1.05) t = 4;   // kustklif
      else if (G3 && p.c > 0.82 && this.slope(i, j) > 1.6) t = 4;              // bergrug die steil in zee eindigt: ook een klif
      else if (G3 && p.c >= 1) t = 2;                           // rotspilaar in zee
      else if (this.mount[k] > 0.5) t = 2;
      else if (hc < 0.32) t = 3;
      this.type[k] = t;
      if (p.dv < 4.2 * VS) this.volc[k] = 2; else if (p.dv < 17 * VS) this.volc[k] = 1;
      if (p.df < 1.3) { this.volc[k] = 3; if (t === 0 || t === 3) this.type[k] = 2; }
      if (t === 4) this.volc[k] = G3 && p.dc >= 5.2 ? 5 : 4;      // 5: kustklif (grijs gesteente)
      if (G3 && p.c >= 1 && t === 2) this.volc[k] = 5;
      if (G3 && t !== 1 && !this.volc[k] && p.c > 0.86 && p.cl > 0.3 && this.slope(i, j) > 0.6) this.volc[k] = 5;   // steile kustwand: rots (alleen de kleur)
    }
    if (G3) {
      // zee = al het water dat met de rand van de kaart verbonden is (meren en rivieren tellen niet)
      const sea = this.sea = new Uint8Array(N * N), q = [];
      for (let k = 0; k < N; k++) for (const kk of [k, (N - 1) * N + k, k * N, k * N + N - 1]) if (this.type[kk] === 1 && !sea[kk]) { sea[kk] = 1; q.push(kk); }
      while (q.length) { const c = q.pop(), ci = c % N, cj = (c / N) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i = ci + di, j = cj + dj; if (!this.inb(i, j)) continue; const kk = j * N + i; if (!sea[kk] && this.type[kk] === 1) { sea[kk] = 1; q.push(kk); } } }
      // baaien (later: havens, vissersboten, handelsschepen): per start het strand in de eigen baai
      const harbors = S.map(s => { const b = L(s, 20, 19); let best = null, bd = 1e9;
        for (let j = Math.floor(b[1]) - 16; j <= b[1] + 16; j++) for (let i = Math.floor(b[0]) - 16; i <= b[0] + 16; i++) {
          if (!this.inb(i, j) || this.type[j * N + i] === 1 || this.type[j * N + i] >= 4) continue;
          let wet = false; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.inb(i + di, j + dj) && sea[(j + dj) * N + i + di]) wet = true;
          if (!wet) continue; const d = Math.hypot(i + 0.5 - b[0], j + 0.5 - b[1]); const pen = this.slope(i, j) < 0.9 ? 0 : 10;                 // liefst een vlakke oever
          if (d + pen < bd) { bd = d + pen; best = { i: i, j: j, x: i + 0.5, z: j + 0.5 }; }
        } if (best) { best.bx = b[0]; best.bz = b[1]; } return best; });   // bx/bz: het (symmetrische) midden van de baai
      this.island = { x: C, z: C, r: IR, harbors: harbors };
    }
    // brug: tegels dwars over de canyon krijgen een dek op randhoogte (type 5)
    const bt = [];
    for (let s2 = -bridge.half; s2 <= bridge.half; s2 += 0.25) {
      const x = bridge.x + bridge.dir[0] * s2, z = bridge.z + bridge.dir[1] * s2, i = Math.floor(x), j = Math.floor(z);
      if (!this.inb(i, j)) continue;
      const k = j * N + i;
      if (bt.indexOf(k) < 0) {
        // aaneengesloten strook: bij een schuine stap ook een buurtegel (diagonaal tussen blokkades mag niet)
        const last = bt[bt.length - 1];
        if (last !== undefined && last % N !== i && ((last / N) | 0) !== j) bt.push(((last / N) | 0) * N + i);
        bt.push(k);
      }
    }
    // dekhoogte: de rand aan weerszijden (hoogste van de twee uiteinden)
    const e0 = this.heightAt(bridge.x - bridge.dir[0] * (bridge.half + 0.8), bridge.z - bridge.dir[1] * (bridge.half + 0.8));
    const e1 = this.heightAt(bridge.x + bridge.dir[0] * (bridge.half + 0.8), bridge.z + bridge.dir[1] * (bridge.half + 0.8));
    bridge.deck = Math.max(e0, e1) + 0.05;
    for (const k of bt) if (this.type[k] === 1 || this.type[k] === 4 || this.tileH(k % N, (k / N) | 0) < bridge.deck - 0.3) { this.type[k] = 5; this.deck[k] = bridge.deck; }
    bridge.tiles = bt.filter(k => this.type[k] === 5);
    // lavapad (toekomstige uitbarsting): van de krater langs de spleet tot in de canyon, tegel voor tegel
    const lp = [];
    const addPath = pts => { for (let q = 1; q < pts.length; q++) { const a = pts[q - 1], b = pts[q], l = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s2 = 0; s2 < l; s2 += 0.4) { const x = a[0] + (b[0] - a[0]) * s2 / l, z = a[1] + (b[1] - a[1]) * s2 / l, k = Math.floor(z) * N + Math.floor(x); if (this.inb(Math.floor(x), Math.floor(z)) && lp[lp.length - 1] !== k) lp.push(k); } } };
    addPath([[C, C]].concat(fiss).concat(canyon.slice(0, 8)));
    this.lavaPath = lp;
  };

  /* Vulkaantop: het deel van de vulkaan dat boven de mistlaag (fogTop) uitsteekt, nog een keer getekend zonder de
     afstandsnevel van de scène. Zo blijft de top vanaf het begin een donker, scherp herkenningspunt, ook van ver.
     Zelfde hoekpunten en kleuren als het terrein (gedeelde attributen), alleen de driehoeken van de top. */
  W.buildPeak = function (g) {
    const F = this.features && this.features.volcano; if (!F || !this.fogTop || !this.island) return;
    const N = VE.N, V1 = N + 1, idx = [], lim = this.fogTop - 0.6;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * V1 + i, b = a + 1, c = a + V1, d = c + 1;
      if (Math.max(this.H[a], this.H[b], this.H[c], this.H[d]) < lim) continue;
      if (Math.hypot(i - F.x, j - F.z) > F.r) continue;
      idx.push(a, c, d, a, d, b);
    }
    if (!idx.length) return;
    // eigen kleuren voor de top (niet gedimd zoals onontdekt/vreemd land): donker basalt met lichtere banden van
    // gestolde lava langs de geulen, as bovenaan, en een gloeiende kraterbodem
    const col = new Float32Array(V1 * V1 * 3), c = new THREE.Color(), dark = new THREE.Color(0x35302d), mid = new THREE.Color(0x4f4844),
      ashC = new THREE.Color(0x8a837c), lava = new THREE.Color(0x6e3a2a), glow = new THREE.Color(0xc8552a);
    let top = 0; for (const v of idx) top = Math.max(top, this.H[v]);
    for (const v of new Set(idx)) {
      const x = v % V1, z = (v / V1) | 0, h = this.H[v], gn = this.gnoise[v], dv = Math.hypot(x - F.x, z - F.z);
      const va = Math.atan2(z - F.z, x - F.x), streak = Math.pow(Math.sin(va * 11 + gn * 6) * 0.5 + 0.5, 6);
      c.copy(dark).lerp(mid, gn * 0.8).lerp(lava, streak * 0.55);
      c.lerp(ashC, VE.smooth(top - 2.2, top - 0.2, h) * 0.55);                   // as op de kraterrand
      if (dv < F.r * 0.22) c.lerp(glow, VE.smooth(top - 2.4, top - 3.6, h));      // gloed onderin de krater
      col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
    }
    const pg = new THREE.BufferGeometry();
    for (const k of ['position', 'normal']) pg.setAttribute(k, g.attributes[k]);
    pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    pg.setIndex(idx); pg.computeBoundingSphere();
    const m = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }));
    m.name = 'volcanoPeak'; m.renderOrder = 1;
    this.root.add(m); this.peak = m;
    // lavagloed in de krater: een schijfje dat zacht pulseert (zonder licht, goedkoop)
    let floor = 1e9; for (let z = Math.floor(F.z) - 3; z <= F.z + 3; z++) for (let x = Math.floor(F.x) - 3; x <= F.x + 3; x++) floor = Math.min(floor, this.H[z * V1 + x]);
    const gm = new THREE.MeshBasicMaterial({ color: 0xff7a2e, transparent: true, opacity: 0.85, fog: false, depthWrite: false });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(F.r * 0.12, 16), gm);
    disc.rotation.x = -Math.PI / 2; disc.position.set(F.x, floor + 0.12, F.z); disc.name = 'craterGlow'; disc.renderOrder = 2;
    disc.onBeforeRender = () => { const t = VE.uTime.value; gm.opacity = 0.62 + 0.25 * Math.sin(t * 1.3) * Math.sin(t * 0.47 + 1); };
    this.root.add(disc); this.craterGlow = disc;
  };

  /* kleuren voor vulkaan, krater, spleet en canyonwanden (aangeroepen vanuit World.recolor) */
  const basalt = new THREE.Color(0x4a4440), basalt2 = new THREE.Color(0x5e5650), ash = new THREE.Color(0x77706a), ember = new THREE.Color(0x6a3426),
    sand1 = new THREE.Color(0xb7835a), sand2 = new THREE.Color(0x9c6a48), sand3 = new THREE.Color(0xc9976a), _t = new THREE.Color(),
    cliffA = new THREE.Color(0x9a948a), cliffB = new THREE.Color(0x857f75), cliffC = new THREE.Color(0xaea89c);
  W.volcColor = function (c, k, h, gn) {
    const v = this.volc[k];
    if (v === 1) { _t.copy(basalt2).lerp(ash, gn); c.lerp(_t, VE.smooth(0.9, 3.5, h) * 0.85); }
    else if (v === 2) { _t.copy(basalt).lerp(ember, VE.smooth(6.2, 4.6, h) * 0.6); c.copy(_t); }
    else if (v === 3) { c.copy(basalt).lerp(ember, 0.25); }
    else if (v === 5) { const band = Math.floor((h + 1) * 3.4) % 3; c.copy(band === 0 ? cliffA : band === 1 ? cliffB : cliffC).lerp(basalt2, gn * 0.2); }
    else if (v === 4) {
      // gelaagde zandsteen: banden op hoogte
      const band = Math.floor((h + 1) * 3.2) % 3;
      c.copy(band === 0 ? sand1 : band === 1 ? sand2 : sand3).lerp(basalt2, gn * 0.25);
    }
  };

  /* ---------- bomen en rotsen voor de grote wereld: overal natuurlijk, rond elke startplek hetzelfde ---------- */
  const NP = VE.Nature.prototype, populate0 = NP.populate;
  NP.populate = function (rand) {
    const w = this.w, N = VE.N;
    if (!w.starts || w.starts.length < 2) return populate0.call(this, rand);
    const S = w.starts.map(s => [s.i + 1, s.j + 1, s.a]), G2 = (w.gen || 1) >= 2;
    const nearStart = (i, j) => { let d = 1e9; for (const s of S) d = Math.min(d, Math.hypot(i + 0.5 - s[0], j + 0.5 - s[1])); return d; };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, ty = w.type[k];
      if (ty === 1 || ty >= 4) continue;
      const d = nearStart(i, j);
      if (d < 4.2) continue;
      if (d < 16) continue;                                      // rond de startplekken: hieronder, voor alle drie gelijk
      const v = w.volc[k];
      if (v === 2 || v === 3) continue;
      if (v === 1) { if (rand() < 0.035 && w.slope(i, j) < 1.6) this.addRock(i, j, 8, rand); continue; }   // kale vulkaanhelling
      if (ty === 2 || (w.mount[k] > 0.35 && ty !== 3)) {
        if (rand() < (G2 ? 0.2 : 0.14) && w.slope(i, j) < 1.6) { this.addRock(i, j, 8, rand); continue; }
        if (rand() < 0.2 * (1 - w.mount[k]) && w.tileH(i, j) < 4.2) this.addTree(i, j, 1, 1, rand);
        continue;
      }
      const f = w.forest[k];
      let p = VE.smooth(0.45, 0.6, f) * 0.85 + 0.03;            // grote bossen en losse bomen
      if (ty === 3) p *= 0.3;
      if (rand() < p) this.addTree(i, j, (w.mount[k] > 0.15 || f > 0.63) ? (rand() < 0.7 ? 1 : 0) : (rand() < 0.22 ? 2 : 0), 1, rand);
      else if (rand() < (G2 ? 0.011 : 0.004) && w.slope(i, j) < 0.8) this.addRock(i, j, 8, rand);        // verspreide keien
    }
    // rond elke startplek precies dezelfde verdeling (gedraaid): eerlijke start
    const local = VE.rng((w.seed ^ 0x1ab5) >>> 0), pattern = [];
    for (let q = 0; q < 900; q++) {
      const u = (local() - 0.5) * 32, v = (local() - 0.5) * 32, r = local(), r2 = local(), r3 = local();
      pattern.push([u, v, r, r2, r3]);
    }
    const groves = [[-6, -3], [4, -6], [-3, -7], [8, 5], [-9, 6]], quarries = [[6, 2], [1, 7], [-6, -6]].concat(G2 ? [[10, -4], [-2, 11], [12, 8]] : []);
    for (const s of S) {
      const ca = Math.cos(s[2]), sa = Math.sin(s[2]), W2 = (u, v) => [s[0] + ca * u - sa * v, s[1] + sa * u + ca * v];
      const ok = (i, j) => { if (!w.inb(i, j)) return false; const k = j * N + i, t = w.type[k]; return t !== 1 && t < 4 && !w.tree[k] && !w.rock[k] && Math.hypot(i + 0.5 - s[0], j + 0.5 - s[1]) > 4.2; };
      for (const p of pattern) {
        const d = Math.hypot(p[0], p[1]); if (d < 4.2 || d > 16) continue;
        const q = W2(p[0], p[1]), i = Math.floor(q[0]), j = Math.floor(q[1]); if (!ok(i, j)) continue;
        const k = j * N + i, ty = w.type[k];
        if (ty === 2) { if (p[2] < 0.2) this.addTree(i, j, 1, 1, rand); continue; }   // rotsblokken rond de start: alleen de vaste groepjes hieronder
        // zelfde kans rond elke start (niet afhankelijk van de lokale bosruis): eerlijk
        if (p[2] < (d > 9 ? 0.3 : d > 6 ? 0.14 : 0.05)) this.addTree(i, j, p[3] < 0.22 ? 2 : p[3] < 0.4 ? 1 : 0, 1, rand);
      }
      for (const g of groves) for (let q = 0; q < 9; q++) {
        const p = W2(g[0] + (local() - 0.5) * 4, g[1] + (local() - 0.5) * 4), i = Math.round(p[0]), j = Math.round(p[1]);
        if (ok(i, j)) this.addTree(i, j, local() < 0.3 ? 2 : 0, 1, rand);
      }
      for (const g of quarries) for (let q = 0; q < 9; q++) {
        const p = W2(g[0] + (local() - 0.5) * 3, g[1] + (local() - 0.5) * 3), i = Math.round(p[0]), j = Math.round(p[1]);
        // plek bezet (water, berg, boom)? dan een tegel ernaast: elke start krijgt evenveel rotsblokken
        let done = false;
        for (const [di, dj] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) {
          if (ok(i + di, j + dj) && w.slope(i + di, j + dj) < 1.2) { this.addRock(i + di, j + dj, 8, rand); done = true; break; }
        }
        if (!done) continue;
      }
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; if (w.rock[k]) w.clearDeco(k); }
  };

  /* hulpjes voor de tests en de minimap */
  VE.worldStats = function (game, r) {
    const w = game.world, N = VE.N, out = [];
    for (const s of w.starts || [w.start]) {
      const cx = s.i + 1, cz = s.j + 1, o = { trees: 0, rocks: 0, water: 0, mountain: 0, build: 0, ore: {} };
      for (let j = Math.floor(cz - r); j <= cz + r; j++) for (let i = Math.floor(cx - r); i <= cx + r; i++) {
        if (!w.inb(i, j) || Math.hypot(i + 0.5 - cx, j + 0.5 - cz) > r) continue;
        const k = j * N + i;
        if (w.tree[k] && !w.tree[k].dead) o.trees++;
        if (w.rock[k] && !w.rock[k].dead) o.rocks++;
        if (w.type[k] === 1) o.water++;
        if (w.type[k] === 2) o.mountain++;
        if ((w.type[k] === 0 || w.type[k] === 3) && !w.tree[k] && !w.rock[k] && !w.bld[k] && w.slope(i, j) < 0.75) o.build++;
      }
      if (w.deposits) for (const d of w.deposits) if (Math.hypot(d.x - cx, d.z - cz) <= 34) o.ore[d.type] = (o.ore[d.type] || 0) + d.amount;
      out.push(o);
    }
    return out;
  };
})(window.VE);
