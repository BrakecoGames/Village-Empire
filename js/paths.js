/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Natuurlijk ontstane wandelpaden.

   Slijtage wordt bijgehouden in een fijn raster (4×4 cellen per tegel) op de wérkelijke positie van
   lopende bewoners: alleen afgelegde afstand telt (stilstaan of een klein correctiestapje vrijwel niets,
   rondslenteren een kwart). Elke cel telt "passages" en groeit door vijf stadia:
     0 ongerept gras · 1 licht platgelopen · 2 beginnend pad (plukjes aarde) · 3 duidelijk voetpad · 4 veelgebruikt pad
   Ongebruikte paden herstellen heel langzaam (halfwaardetijd ~8 minuten) en het gras groeit terug.

   Gameplay blijft per tegel (pathfinding, loopsnelheid, bloemen langs paden): world.road wordt afgeleid —
   stadium 3 = spoor (1), stadium 4 = pad (2). Ingangen van gebouwen zijn vaste, aangelegde stoepjes
   (world.door) en slijten of herstellen niet.

   Weergave: het raster wordt (licht vervaagd) een textuur die de terreinshader mengt met ruis →
   zachte, onregelmatige randen, een uitgesleten midden, plukjes gras langs de kant. Geen losse
   geometrie, dus geen hoekige vlakken en geen extra draw calls. */
'use strict';
(function (VE) {
  const N = VE.N, R = 4, M = N * R;
  // drempels in passages per cel (afgestemd op loopsnelheid en dorpsgrootte, zie tests/verbeteringen.spec.js)
  const CFG = VE.PATHS = { R: R, stage: [0, 6, 18, 42, 90], max: 200, decayMul: 0.993, decayLin: 0.015, apron: 70 };
  VE.PATH = { TRAIL_ON: CFG.stage[3], PATH_ON: CFG.stage[4], PATH_MAX: CFG.max };

  class FootPaths {
    constructor(w) {
      this.w = w;
      this.v = new Float32Array(M * M);
      this.dirtyTiles = new Set();
      this.texDirty = true; this.texT = 0; this.tileT = 0;
      this.tileVal = new Float32Array(N * N);
      this.fixed = new Uint8Array(N * N);                           // stoepjes bij ingangen: vast, slijten/herstellen niet
      this.data = new Uint8Array(M * M);
      this.tex = new THREE.DataTexture(this.data, M, M, THREE.LuminanceFormat, THREE.UnsignedByteType);
      this.tex.magFilter = THREE.LinearFilter; this.tex.minFilter = THREE.LinearFilter;
      this.tex.wrapS = this.tex.wrapT = THREE.ClampToEdgeWrapping;
      this.tex.needsUpdate = true;
      this.onRoads = null;                                          // callback (game): nieuwe paden tellen mee voor de opdracht
    }
    blocked(ti, tj) { const k = tj * N + ti, w = this.w; return w.type[k] === 1 || w.bld[k] > 0; }
    addCell(ci, cj, a) {
      if (ci < 0 || cj < 0 || ci >= M || cj >= M || a <= 0) return;
      const ti = (ci / R) | 0, tj = (cj / R) | 0;
      if (this.blocked(ti, tj)) return;
      const q = cj * M + ci, v = this.v[q] + a;
      this.v[q] = v > CFG.max ? CFG.max : v;
      this.dirtyTiles.add(tj * N + ti); this.texDirty = true;
    }
    /* bewoner liep `dist` tegels op (x, z); f: 1 = gewoon lopen/dragen, 0.25 = slenteren */
    walk(x, z, dist, f) {
      const a = dist * R * f; if (a <= 0) return;
      const ci = Math.floor(x * R), cj = Math.floor(z * R);
      this.addCell(ci, cj, a);
      const s = a * 0.12;                                           // een beetje breder dan de voetstap zelf
      this.addCell(ci + 1, cj, s); this.addCell(ci - 1, cj, s); this.addCell(ci, cj + 1, s); this.addCell(ci, cj - 1, s);
    }
    /* één volledige passage dwars over tegel k (voor tests en oude saves) */
    passTile(k, amt) {
      const i = k % N, j = (k / N) | 0;
      for (let c = 0; c < R; c++) {
        this.addCell(i * R + c, j * R + 1, amt); this.addCell(i * R + c, j * R + 2, amt);
        this.addCell(i * R + c, j * R, amt * 0.15); this.addCell(i * R + c, j * R + 3, amt * 0.15);
      }
    }
    setTile(k, val) {
      const i = k % N, j = (k / N) | 0;
      for (let b = 0; b < R; b++) for (let a = 0; a < R; a++) {
        const edge = a === 0 || b === 0 || a === R - 1 || b === R - 1;
        this.v[(j * R + b) * M + i * R + a] = Math.min(CFG.max, edge ? val * 0.6 : val);
      }
      this.dirtyTiles.add(k); this.texDirty = true;
    }
    clearTile(k) { this.fixed[k] = 0; this.setTile(k, 0); }
    /* hoogste slijtage binnen een tegel → stadium en spel-niveau */
    tileValue(k) {
      const i = k % N, j = (k / N) | 0; let mx = 0;
      for (let b = 0; b < R; b++) for (let a = 0; a < R; a++) { const v = this.v[(j * R + b) * M + i * R + a]; if (v > mx) mx = v; }
      return mx;
    }
    stageOf(v) { const S = CFG.stage; return v >= S[4] ? 4 : v >= S[3] ? 3 : v >= S[2] ? 2 : v >= S[1] ? 1 : 0; }
    /* afgeleide tegelwaarden bijwerken (alleen tegels die veranderd zijn) */
    syncTiles(game) {
      if (!this.dirtyTiles.size) return;
      const w = this.w; let changed = false;
      for (const k of this.dirtyTiles) {
        const v = this.tileValue(k);
        this.tileVal[k] = v; w.wear[k] = v;
        if (w.door[k] || w.bld[k] || this.fixed[k]) continue;       // stoepjes: vast pad (gezet door placeBuilding)
        const st = this.stageOf(v), lvl = st >= 4 ? 2 : st >= 3 ? 1 : 0;
        if (lvl !== w.road[k]) {
          if (lvl >= 1 && w.road[k] === 0 && game) game.stats.roads++;   // opdracht: een voetpad ingesleten
          w.road[k] = lvl; changed = true;
        }
        // gras platgetrapt: vanaf stadium 1 lager, vanaf stadium 3 verdwenen (komt terug als het pad herstelt)
        if (w.veg && w.veg.setTrample) w.veg.setTrample(k, VE.clamp((v - CFG.stage[1]) / (CFG.stage[3] - CFG.stage[1]), 0, 1));
      }
      this.dirtyTiles.clear();
      if (changed && game) game.roadsDirty = true;
    }
    /* heel langzaam herstel (elke 5 s) */
    decay() {
      const V = this.v, w = this.w, mul = CFG.decayMul, lin = CFG.decayLin;
      for (let q = 0; q < V.length; q++) {
        const v = V[q]; if (v <= 0) continue;
        const ci = q % M, cj = (q / M) | 0, k = ((cj / R) | 0) * N + ((ci / R) | 0);
        if (w.door[k] || this.fixed[k]) continue;
        const nv = v * mul - lin;
        V[q] = nv > 0 ? nv : 0;
        this.dirtyTiles.add(k);
      }
      this.texDirty = true;
    }
    /* stoepje voor de ingang van een gebouw: aangestampt, slijt niet */
    apron(k) {
      // klein uitgesleten plekje vlak voor de deur (midden van de tegel), geen grote zandvlek
      this.fixed[k] = 1;
      const i = k % N, j = (k / N) | 0;
      for (let b = 0; b < R; b++) for (let a = 0; a < R; a++) {
        const inner = a > 0 && a < R - 1 && b < R - 1;
        this.v[(j * R + b) * M + i * R + a] = inner ? CFG.apron : CFG.stage[1];
      }
      this.dirtyTiles.add(k); this.texDirty = true;
    }
    unfix(k) { this.fixed[k] = 0; }
    /* textuur: licht vervaagd (zachte randen), max ~1× per halve seconde */
    update(dt, game) {
      this.tileT -= dt;
      if (this.tileT <= 0) { this.tileT = 0.5; this.syncTiles(game); }
      this.texT -= dt;
      if (this.texDirty && this.texT <= 0) { this.texT = 0.5; this.upload(); }
    }
    upload() {
      this.texDirty = false;
      const V = this.v, D = this.data, k = 255 / CFG.max;
      for (let j = 0; j < M; j++) {
        const j0 = j > 0 ? j - 1 : j, j1 = j < M - 1 ? j + 1 : j;
        for (let i = 0; i < M; i++) {
          const i0 = i > 0 ? i - 1 : i, i1 = i < M - 1 ? i + 1 : i;
          const c = V[j * M + i];
          if (c === 0 && V[j0 * M + i] === 0 && V[j1 * M + i] === 0 && V[j * M + i0] === 0 && V[j * M + i1] === 0) { D[j * M + i] = 0; continue; }
          const s = c * 0.4 + (V[j0 * M + i] + V[j1 * M + i] + V[j * M + i0] + V[j * M + i1]) * 0.15;
          D[j * M + i] = s * k > 255 ? 255 : s * k;
        }
      }
      this.tex.needsUpdate = true;
    }
    /* opslaan: alleen cellen met slijtage, in stukken (start, waarden 0..35 als base36-tekens) */
    serialize() {
      const V = this.v, out = []; let run = null;
      for (let q = 0; q < V.length; q++) {
        const c = Math.round(V[q] / CFG.max * 35);
        if (c > 0) { if (!run) { run = [q, '']; out.push(run); } run[1] += c.toString(36); }
        else run = null;
      }
      return out;
    }
    load(runs) {
      if (!Array.isArray(runs)) return;
      for (const r of runs) {
        if (!Array.isArray(r) || typeof r[1] !== 'string') continue;
        for (let n = 0; n < r[1].length; n++) {
          const q = r[0] + n; if (q >= this.v.length) break;
          this.v[q] = parseInt(r[1][n], 36) / 35 * CFG.max;
          this.dirtyTiles.add(((((q / M) | 0) / R) | 0) * N + (((q % M) / R) | 0));
        }
      }
      this.texDirty = true;
    }
  }
  VE.FootPaths = FootPaths;

  /* ---------------- terreinshader: paden (en de mijnbouw-informatielaag) in het terrein mengen ---------------- */
  VE.terrainPathShader = function (mat, w) {
    const paths = w.paths;
    // uniforms vooraf: de informatielaag kan aan/uit nog voordat de shader voor het eerst gecompileerd is
    const U = { uWear: { value: paths.tex }, uOre: { value: w.oreTex || paths.tex }, uSurvey: w.surveyU || (w.surveyU = { value: 0 }) };
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec2 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xz;');
      sh.fragmentShader = [
        'uniform sampler2D uWear; uniform sampler2D uOre; uniform float uSurvey; varying vec2 vWP;',
        'float phash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        'float pnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
        '  return mix(mix(phash(i), phash(i + vec2(1.0, 0.0)), f.x), mix(phash(i + vec2(0.0, 1.0)), phash(i + vec2(1.0, 1.0)), f.x), f.y); }'
      ].join('\n') + '\n' + sh.fragmentShader.replace('#include <color_fragment>', [
        '#include <color_fragment>',
        '{',
        '  float wv = texture2D(uWear, vWP / ' + N.toFixed(1) + ').r;',
        '  if (wv > 0.004) {',
        '    float n1 = pnoise(vWP * 2.3), n2 = pnoise(vWP * 7.1 + 3.7), n3 = pnoise(vWP * 19.0);',
        '    float n = n1 * 0.55 + n2 * 0.3 + n3 * 0.15;',
        '    vec3 g = diffuseColor.rgb;',
        '    // 1: platgelopen gras (iets geler en doffer)',
        '    float s1 = smoothstep(0.02, 0.09, wv);',
        '    vec3 trampled = g * vec3(1.02, 0.98, 0.78) + vec3(0.035, 0.025, 0.0);',
        '    // 2: plukjes aarde die met de ruis groeien; 3/4: doorlopend pad, midden meer uitgesleten',
        '    float s2 = smoothstep(0.07 + n * 0.16, 0.13 + n * 0.16, wv);',
        '    float s3 = smoothstep(0.22, 0.48, wv + (n2 - 0.5) * 0.08);',
        '    vec3 dirt = mix(vec3(0.60, 0.47, 0.31), vec3(0.70, 0.57, 0.40), n);',
        '    vec3 packed = mix(vec3(0.79, 0.67, 0.49), vec3(0.71, 0.59, 0.42), n3);',
        '    vec3 c = mix(g, trampled, s1);',
        '    c = mix(c, dirt, s2 * 0.92);',
        '    c = mix(c, packed, s3 * 0.85);',
        '    // steentjes en zandkorrels op veelgebruikte paden',
        '    vec2 pq = mat2(0.88, -0.48, 0.48, 0.88) * vWP * 17.0;',          // scheef raster: geen rijen
        '    vec2 pc = floor(pq), pf = fract(pq) - 0.5;',
        '    float ph = phash(pc), pr = 0.1 + 0.12 * phash(pc + 5.3);',
        '    float pd = length(pf - (vec2(phash(pc + 1.7), phash(pc + 9.1)) - 0.5) * 0.5);',
        '    float peb = smoothstep(pr, pr * 0.55, pd);',                       // ronde steentjes met zachte rand
        '    c = mix(c, vec3(0.56, 0.53, 0.48), step(0.9, ph) * peb * s3 * 0.75);',
        '    c = mix(c, vec3(0.87, 0.77, 0.6), step(0.8, ph) * (1.0 - step(0.9, ph)) * peb * s3 * 0.45);',
        '    diffuseColor.rgb = c;',
        '  }',
        '  if (uSurvey > 0.001) {',
        '    vec4 o = texture2D(uOre, vWP / ' + N.toFixed(1) + ');',
        '    float edge = smoothstep(0.12, 0.42, o.a + (pnoise(vWP * 1.9) - 0.5) * 0.3);',   // organische randen
        '    float stripe = smoothstep(0.35, 0.65, abs(fract((vWP.x + vWP.y) * 1.6) - 0.5) * 2.0);',
        '    diffuseColor.rgb = mix(diffuseColor.rgb, o.rgb / max(o.a, 0.05), edge * min(1.0, o.a * 1.6) * uSurvey * (0.45 + 0.3 * stripe));',
        '  }',
        '}'
      ].join('\n'));
    };
    mat.customProgramCacheKey = () => 'terrain_paths_v1';
  };
})(window.VE);
