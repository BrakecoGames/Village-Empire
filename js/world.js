/* Village Empire — © 2026 Brakeco Games. All rights reserved. */
'use strict';
(function (VE) {
  /* Wereldgrootte (tegels per zijde): 64 voor oude saves, VE.BIG_N voor nieuwe werelden. VE.setWorldSize zet
     hem vóór het maken van een wereld; alle modules houden hun N bij via VE.sizeHooks. */
  let N = 64, V1 = N + 1; VE.N = N;
  VE.BIG_N = 144;
  VE.sizeHooks = VE.sizeHooks || [];
  VE.setWorldSize = function (n) { VE.N = n; for (const f of VE.sizeHooks) f(n); };
  VE.sizeHooks.push(n => { N = n; V1 = n + 1; });
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _c2 = new THREE.Color(), _up = new THREE.Vector3(0, 1, 0);
  VE.ZERO = ZERO;
  const _q2 = new THREE.Quaternion(), _ax = new THREE.Vector3();
  const _sh = new THREE.Matrix4(), _tr = new THREE.Matrix4();

  class World {
    constructor(seed, root) {
      this.seed = seed; this.N = N; this.root = root;
      this.H = new Float32Array(V1 * V1);
      this.mount = new Float32Array(N * N); this.forest = new Float32Array(N * N); this.gnoise = new Float32Array(V1 * V1);
      this.soft = new Uint8Array(N * N);   // gebouwtegels zonder aarde eronder (startvoorraad in het gras)
      this.type = new Uint8Array(N * N); this.bld = new Int32Array(N * N); this.road = new Uint8Array(N * N); // 0 grass, 1 faint trail, 2 worn path
      this.wear = new Float32Array(N * N); // how much settlers have walked here
      this.owned = new Uint8Array(N * N); this.door = new Uint8Array(N * N);
      this.tree = new Array(N * N).fill(null); this.rock = new Array(N * N).fill(null); this.field = new Array(N * N).fill(null);
      this.decoT = new Array(N * N).fill(null); this.decoF = new Array(N * N).fill(null);
      this.explored = new Float32Array(N * N); // 0 = hidden under the clouds, 1 = discovered
      this.fogDirty = true;
      this.start = { i: 30, j: 30 };
    }

    /* ---------------- exploration (fog of war) ---------------- */
    reveal(x, z, r) {
      const E = this.explored, soft = 2.2;
      for (let j = Math.max(0, Math.floor(z - r)); j <= Math.min(N - 1, Math.ceil(z + r)); j++)
        for (let i = Math.max(0, Math.floor(x - r)); i <= Math.min(N - 1, Math.ceil(x + r)); i++) {
          const d = Math.hypot(i + 0.5 - x, j + 0.5 - z); if (d > r) continue;
          const v = d < r - soft ? 1 : 1 - VE.smooth(r - soft, r, d), k = j * N + i;
          if (v > E[k] + 0.01) { E[k] = v; this.fogDirty = true; this.fogDirtyForSurvey = true; }
        }
    }
    isExplored(k) { return this.explored[k] > 0.5; }
    buildFog() {
      const pos = new Float32Array(V1 * V1 * 3), idx = new Uint32Array(N * N * 6);
      for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) {
        const v = z * V1 + x;
        pos[v * 3] = x; pos[v * 3 + 1] = Math.max(this.H[v], 0) + 1.7; pos[v * 3 + 2] = z;
      }
      let o = 0;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const a = j * V1 + i, b = a + 1, c = a + V1, d = c + 1;
        idx[o++] = a; idx[o++] = c; idx[o++] = d; idx[o++] = a; idx[o++] = d; idx[o++] = b;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('fogA', new THREE.BufferAttribute(new Float32Array(V1 * V1).fill(1), 1));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: VE.uTime },
        transparent: true, depthWrite: false,
        vertexShader: [
          'attribute float fogA; varying float vA; varying vec2 vP;',
          'void main() { vA = fogA; vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xz; gl_Position = projectionMatrix * viewMatrix * wp; }'
        ].join('\n'),
        fragmentShader: [
          'uniform float uTime; varying float vA; varying vec2 vP;',
          'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
          'float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
          '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }',
          'void main() {',
          '  vec2 q = vP * 0.16 + vec2(uTime * 0.035, uTime * 0.018);',
          '  float n = noise(q) * 0.6 + noise(q * 2.4 - vec2(uTime * 0.025, 0.0)) * 0.4;',
          '  vec3 col = mix(vec3(0.74, 0.80, 0.87), vec3(0.97, 0.97, 0.99), smoothstep(0.25, 0.8, n));',
          '  float edge = vA * (1.0 - vA) * 4.0;',                       // wispy, drifting border
          '  float a = smoothstep(0.06, 0.72, vA + (n - 0.5) * 0.55 * edge);',
          '  gl_FragColor = vec4(col, a);',
          '}'
        ].join('\n')
      });
      this.fog = new THREE.Mesh(g, m);
      this.fog.renderOrder = 10; // after water and other transparent things, so nothing shows through
      this.fog.frustumCulled = false;
      this.fog.name = 'fog';
      this.root.add(this.fog);
      this.fogDirty = true;
    }
    updateFog() {
      if (!this.fogDirty || !this.fog) return;
      this.fogDirty = false;
      const E = this.explored, fa = this.fog.geometry.attributes.fogA;
      for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) {
        let s = 0;
        for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) { const i = x + dx, j = z + dz; if (this.inb(i, j)) s += E[j * N + i]; }
        fa.array[z * V1 + x] = 1 - s / 4;
      }
      fa.needsUpdate = true;
    }
    serializeFog() { let s = ''; for (let k = 0; k < N * N; k++) s += Math.round(this.explored[k] * 9); return s; }
    loadFog(s) {
      if (typeof s !== 'string' || s.length !== N * N) return;
      for (let k = 0; k < N * N; k++) this.explored[k] = (s.charCodeAt(k) - 48) / 9;
      this.fogDirty = true;
    }
    inb(i, j) { return i >= 0 && j >= 0 && i < N && j < N; }
    vh(x, z) { return this.H[z * V1 + x]; }
    heightAt(x, z) {
      x = VE.clamp(x, 0, N - 0.0001); z = VE.clamp(z, 0, N - 0.0001);
      const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, H = this.H;
      if (this.deck && this.deck[j * N + i] > -50) return this.deck[j * N + i];   // over de brug
      const ha = H[j * V1 + i], hb = H[j * V1 + i + 1], hc = H[(j + 1) * V1 + i], hd = H[(j + 1) * V1 + i + 1];
      if (fz > fx) return ha + (hd - hc) * fx + (hc - ha) * fz;
      return ha + (hb - ha) * fx + (hd - hb) * fz;
    }
    tileH(i, j) { return this.heightAt(i + 0.5, j + 0.5); }
    slope(i, j, s) {
      s = s || 1; let mn = 1e9, mx = -1e9;
      for (let z = j; z <= j + s; z++) for (let x = i; x <= i + s; x++) { const h = this.vh(x, z); if (h < mn) mn = h; if (h > mx) mx = h; }
      return mx - mn;
    }
    // boulders block the way (a mason may still path *to* his own boulder: the pathfinder allows the target tile)
    walkable(k) { const t = this.type[k]; return t !== 1 && t !== 4 && this.bld[k] === 0 && !this.rock[k] && !(this.lmk && this.lmk[k]); }
    isWater(k) { return this.type[k] === 1; }

    generate() {
      if (N > 64 && this.generateBig) return this.generateBig();          // grote wereld (js/worldgen.js)
      const n = VE.noise(this.seed), n2 = VE.noise(this.seed + 77), n3 = VE.noise(this.seed + 191), n4 = VE.noise(this.seed + 333);
      const cx = this.start.i + 1, cz = this.start.j + 1;
      const ph = (this.seed % 97) * 0.13;
      const rv = z => N * 0.76 + Math.sin(z * 0.11 + ph) * 3.5 + Math.sin(z * 0.043 + 1.7) * 3.5;
      const fords = [N * 0.5, N * 0.14, N * 0.86];
      for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) {
        const e = n.fbm(x * 0.05, z * 0.05, 4);
        let h = 0.75 + (e - 0.42) * 3.6;
        // rolling mountain range in the north-west
        const md = Math.hypot(x - N * 0.12, z - N * 0.14) / (N * 0.42);
        const m = VE.smooth(1.0, 0.3, md + (n2.fbm(x * 0.07, z * 0.07, 3) - 0.5) * 0.7);
        h += m * m * 5.2 + m * n3.fbm(x * 0.22, z * 0.22, 2) * 1.6;
        // river with fords
        const d = Math.abs(x - rv(z));
        let rc = VE.smooth(2.4, 0.7, d);
        let ford = 0; for (const f of fords) ford = Math.max(ford, VE.smooth(2.6, 0.8, Math.abs(z - f)));
        rc *= (1 - ford * 0.92);
        h = VE.lerp(h, -0.75, rc);
        if (ford > 0 && d < 3) h = Math.max(h, VE.lerp(h, 0.22, ford));
        // two little lakes
        const l1 = Math.hypot(x - (cx - 7.5), z - (cz + 5.5)) + (n4(x * 0.3, z * 0.3) - 0.5) * 1.5;
        h = VE.lerp(h, -0.6, VE.smooth(3.0, 1.3, l1));
        const l2 = Math.hypot(x - N * 0.32, z - N * 0.84) + (n4(x * 0.3 + 9, z * 0.3) - 0.5) * 2;
        h = VE.lerp(h, -0.6, VE.smooth(4.2, 1.8, l2));
        // gentle starting meadow
        const sd = Math.hypot(x - cx, z - cz);
        h = VE.lerp(h, 0.85 + (e - 0.5) * 0.4, VE.smooth(7.5, 2.5, sd) * (1 - VE.smooth(3.0, 1.3, l1)));
        this.H[z * V1 + x] = h;
        this.gnoise[z * V1 + x] = n4.fbm(x * 0.09 + 5, z * 0.09 - 3, 3);
      }
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = j * N + i;
        const md = Math.hypot(i + 0.5 - N * 0.12, j + 0.5 - N * 0.14) / (N * 0.42);
        this.mount[k] = VE.smooth(1.0, 0.3, md + (n2.fbm(i * 0.07, j * 0.07, 3) - 0.5) * 0.7);
        this.forest[k] = n3.fbm(i * 0.085 + 20, j * 0.085 - 13, 3);
        const hc = this.tileH(i, j);
        let t = 0;
        if (hc < 0.06) t = 1;
        else if (this.mount[k] > 0.5) t = 2;
        else if (hc < 0.32) t = 3;
        this.type[k] = t;
      }
    }

    /* ---------------- terrain mesh ---------------- */
    buildMeshes() {
      const pos = new Float32Array(V1 * V1 * 3), col = new Float32Array(V1 * V1 * 3);
      for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) { const v = z * V1 + x; pos[v * 3] = x; pos[v * 3 + 1] = this.H[v]; pos[v * 3 + 2] = z; }
      const idx = new Uint16Array(N * N * 6);
      let o = 0;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const a = j * V1 + i, b = a + 1, c = a + V1, d = c + 1;
        idx[o++] = a; idx[o++] = c; idx[o++] = d; idx[o++] = a; idx[o++] = d; idx[o++] = b;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.computeVertexNormals();
      // natuurlijke wandelpaden en de mijnbouw-informatielaag worden in de terreinshader gemengd
      this.paths = new VE.FootPaths(this);
      this.oreTex = new THREE.DataTexture(new Uint8Array(N * N * 4), N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
      this.oreTex.magFilter = THREE.LinearFilter; this.oreTex.minFilter = THREE.LinearFilter; this.oreTex.needsUpdate = true;   // zachte, ronde vlekken
      const tmat = new THREE.MeshLambertMaterial({ vertexColors: true });
      VE.terrainPathShader(tmat, this);
      this.terrain = new THREE.Mesh(g, tmat);
      this.terrain.receiveShadow = true;
      this.terrain.name = 'terrain';
      this.root.add(this.terrain);
      this.buildChunks(g, tmat);
      this.buildSkirt();
      this.buildWater();
      this.buildFog();
      this.recolor();
      // border posts
      this.borderCap = Math.round(900 * Math.max(1, N / 64));
      this.border = new THREE.InstancedMesh(VE.borderGeo(), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 5 }), this.borderCap);
      this.border.count = 0; this.border.castShadow = true; this.border.frustumCulled = false;
      this.root.add(this.border);
    }
    /* Grote wereld: het terrein wordt in vakken (chunks) getekend die dezelfde hoekpunten, kleuren en normalen
       delen, elk met een eigen indexlijst en begrenzing. Wat buiten beeld valt, wordt niet getekend (frustum
       culling). this.terrain blijft de bron van de gegevens en het doel voor klikken (raycast), maar is zelf
       onzichtbaar. Kleuren en hoogtes bijwerken (recolor, flatten) werkt dus voor alle chunks tegelijk. */
    buildChunks(g, mat) {
      this.chunks = null;
      if (N <= 64) return;
      const CH = 24, chunks = [];
      for (let cj = 0; cj < N; cj += CH) for (let ci = 0; ci < N; ci += CH) {
        const i1 = Math.min(N, ci + CH), j1 = Math.min(N, cj + CH), idx = [];
        let lo = 1e9, hi = -1e9;
        for (let j = cj; j < j1; j++) for (let i = ci; i < i1; i++) {
          const a = j * V1 + i, b = a + 1, c = a + V1, d = c + 1;
          idx.push(a, c, d, a, d, b);
        }
        for (let z = cj; z <= j1; z++) for (let x = ci; x <= i1; x++) { const h = this.H[z * V1 + x]; lo = Math.min(lo, h); hi = Math.max(hi, h); }
        const cg = new THREE.BufferGeometry();
        for (const k of ['position', 'normal', 'color']) cg.setAttribute(k, g.attributes[k]);
        cg.setIndex(idx);
        const cx = (ci + i1) / 2, cz = (cj + j1) / 2, cy = (lo + hi) / 2;
        cg.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, cy, cz), Math.hypot(i1 - ci, j1 - cj, hi - lo + 2) / 2 + 0.5);
        const m = new THREE.Mesh(cg, mat);
        m.receiveShadow = true; m.name = 'terrainChunk'; m.frustumCulled = true;
        this.root.add(m); chunks.push(m);
      }
      this.chunks = chunks;
      this.terrain.visible = false;                       // alleen nog voor gegevens en klikken
    }
    buildSkirt() {
      const pts = [];
      for (let x = 0; x <= N; x++) pts.push([x, 0]);
      for (let z = 1; z <= N; z++) pts.push([N, z]);
      for (let x = N - 1; x >= 0; x--) pts.push([x, N]);
      for (let z = N - 1; z >= 0; z--) pts.push([0, z]);
      this.skirtPts = pts;
      const rows = [0, -0.5, -1.6, -3.2];
      const cols = [[0.42, 0.3, 0.18], [0.36, 0.25, 0.15], [0.3, 0.21, 0.13], [0.22, 0.15, 0.09]];
      const pos = [], col = [];
      for (let p = 0; p < pts.length - 1; p++) {
        const a = pts[p], b = pts[p + 1];
        for (let r = 0; r < rows.length - 1; r++) {
          const quad = [[a, r], [b, r], [b, r + 1], [a, r], [b, r + 1], [a, r + 1]];
          for (const q of quad) {
            pos.push(q[0][0], 0, q[0][1]);
            const c = cols[q[1]]; const f = 0.9 + ((q[0][0] * 7 + q[0][1] * 13 + q[1] * 3) % 5) * 0.04;
            col.push(c[0] * f, c[1] * f, c[2] * f);
          }
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      this.skirt = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      this.root.add(this.skirt);
      this.skirtRows = rows;
      this.updateSkirt();
      // dark base plate
      const base = new THREE.Mesh(new THREE.PlaneGeometry(N, N), new THREE.MeshBasicMaterial({ color: 0x2a1d12 }));
      base.rotation.x = Math.PI / 2; base.position.set(N / 2, -3.2, N / 2);
      this.root.add(base);
    }
    updateSkirt() {
      const pa = this.skirt.geometry.attributes.position, ca = this.skirt.geometry.attributes.color;
      const pts = this.skirtPts, rows = this.skirtRows;
      let v = 0;
      for (let p = 0; p < pts.length - 1; p++) {
        const a = pts[p], b = pts[p + 1];
        for (let r = 0; r < rows.length - 1; r++) {
          const quad = [[a, r], [b, r], [b, r + 1], [a, r], [b, r + 1], [a, r + 1]];
          for (const q of quad) {
            const h = this.vh(q[0][0], q[0][1]);
            let y;
            if (q[1] === 0) y = Math.max(h, 0.0);
            else if (q[1] === 1) y = Math.min(h, 0) - 0.45;
            else y = rows[q[1]];
            pa.setY(v, y);
            if (q[1] === 0 && h < 0.0) ca.setXYZ(v, 0.25, 0.5, 0.68);
            else if (q[1] === 0 && h > 3.6) ca.setXYZ(v, 0.55, 0.53, 0.5);
            v++;
          }
        }
      }
      pa.needsUpdate = true; ca.needsUpdate = true;
      this.skirt.geometry.computeVertexNormals();
    }
    buildWater() {
      const g = new THREE.PlaneGeometry(N, N, N, N);
      // Depth-tinted water: turquoise in the shallows, deep blue further out
      const wp = g.attributes.position, wc = new Float32Array(wp.count * 3);
      const shallow = new THREE.Color(0x3a98b0), deep = new THREE.Color(0x1a4f8a), wcol = new THREE.Color();
      for (let v = 0; v < wp.count; v++) {
        const x = Math.round(wp.getX(v) + N / 2), z = Math.round(N / 2 - wp.getY(v));
        const d = -this.vh(VE.clamp(x, 0, N), VE.clamp(z, 0, N));
        wcol.copy(shallow).lerp(deep, VE.smooth(0.0, 0.9, d));
        wc[v * 3] = wcol.r; wc[v * 3 + 1] = wcol.g; wc[v * 3 + 2] = wcol.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(wc, 3));
      const m = new THREE.MeshPhongMaterial({ color: 0xffffff, vertexColors: true, specular: 0x3a5468, shininess: 24, flatShading: true, transparent: true, opacity: 0.9 });
      m.onBeforeCompile = function (sh) {
        sh.uniforms.uTime = VE.uTime;
        sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n transformed.z += sin(position.x*1.7 + uTime*1.4) * 0.028 + cos(position.y*1.9 + uTime*1.1) * 0.028 + sin((position.x+position.y)*0.9 + uTime*0.7)*0.02;');
      };
      m.customProgramCacheKey = () => 'water';
      this.water = new THREE.Mesh(g, m);
      this.water.rotation.x = -Math.PI / 2;
      this.water.position.set(N / 2, 0.0, N / 2);
      this.water.receiveShadow = true;
      this.root.add(this.water);
    }
    vertexOwned(x, z) {
      for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) {
        const i = x + dx, j = z + dz; if (this.inb(i, j) && this.owned[j * N + i]) return true;
      }
      return false;
    }
    vertexNearHard(x, z) {
      for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) {
        const i = x + dx, j = z + dz; if (!this.inb(i, j)) continue;
        const k = j * N + i; if (this.bld[k] && !this.soft[k]) return true;
      }
      return false;
    }
    vertexNear(x, z, arr) {
      for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) {
        const i = x + dx, j = z + dz; if (this.inb(i, j) && arr[j * N + i]) return true;
      }
      return false;
    }
    recolor() {
      const ca = this.terrain.geometry.attributes.color;
      // Softer, more natural meadow greens (was a neon lime that clipped in sunlight)
      const g1 = new THREE.Color(0x6aa53c), g2 = new THREE.Color(0x96c050), g3 = new THREE.Color(0x4a8732), sand = new THREE.Color(0xe2cf98),
        bed = new THREE.Color(0x7c6c4c), rock = new THREE.Color(0x9e988c), rock2 = new THREE.Color(0x857f74), snow = new THREE.Color(0xf6f6f2), dirt = new THREE.Color(0xb39368), dim = new THREE.Color(0x6f7d74);
      const c = new THREE.Color(), t = new THREE.Color();
      for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) {
        const v = z * V1 + x, h = this.H[v], gn = this.gnoise[v];
        const ti = Math.min(N - 1, x), tj = Math.min(N - 1, z), k = tj * N + ti;
        c.copy(g1).lerp(g2, VE.smooth(0.42, 0.68, gn));
        c.lerp(g3, VE.smooth(0.5, 0.68, this.forest[k]) * 0.75);
        const m = this.mount[k];
        if (m > 0.2) { t.copy(rock).lerp(rock2, gn); c.lerp(t, VE.smooth(0.25, 0.6, m)); }
        if (this.volc && this.volc[k] > 0) this.volcColor(c, k, h, gn);     // vulkaan, canyonwanden, spleet (js/worldgen.js)
        else if (h > 4.6) c.lerp(snow, VE.smooth(4.6, 5.6, h));
        if (h < 0.34) c.lerp(sand, VE.smooth(0.34, 0.14, h));
        if (h < 0.0) c.lerp(bed, VE.smooth(0.0, -0.35, h));
        if (this.vertexNearHard(x, z)) c.lerp(dirt, 0.55);
        if (!this.vertexOwned(x, z)) { c.lerp(dim, 0.28); c.multiplyScalar(0.78); }
        ca.setXYZ(v, c.r, c.g, c.b);
      }
      ca.needsUpdate = true;
    }
    updateHeights() {
      const pa = this.terrain.geometry.attributes.position;
      for (let v = 0; v < V1 * V1; v++) pa.setY(v, this.H[v]);
      pa.needsUpdate = true;
      this.terrain.geometry.computeVertexNormals();
      this.updateSkirt();
    }
    flatten(i, j, s) {
      let sum = 0, n = 0;
      for (let z = j; z <= j + s; z++) for (let x = i; x <= i + s; x++) { sum += this.vh(x, z); n++; }
      const avg = Math.max(0.12, sum / n);
      for (let z = j; z <= j + s; z++) for (let x = i; x <= i + s; x++) this.H[z * V1 + x] = avg;
      this.updateHeights();
      return avg;
    }

    /* ---------------- roads ---------------- */
    /* Kleur/normaal van het terrein op (x, z): bilineair uit de vertex-attributen van het terreinraster. */
    groundSample(attr, x, z, out) {
      x = VE.clamp(x, 0, N - 0.0001); z = VE.clamp(z, 0, N - 0.0001);
      const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, a = attr.array, s = attr.itemSize;
      const v00 = (j * V1 + i) * s, v10 = v00 + s, v01 = v00 + V1 * s, v11 = v01 + s;
      for (let c = 0; c < 3; c++) {
        out[c] = (a[v00 + c] * (1 - fx) + a[v10 + c] * fx) * (1 - fz) + (a[v01 + c] * (1 - fx) + a[v11 + c] * fx) * fz;
      }
      return out;
    }
    /* Paden zitten in de terreinshader (js/paths.js): hier alleen de bloemetjes langs paden bijwerken. */
    rebuildRoads() {
      if (this.veg) this.veg.updateEdges();          // bloemen langs paden, plantjes rond gebouwen
    }

    /* ---------------- territory ---------------- */
    setTerritory(circles) {
      this.owned.fill(0);
      for (const c of circles) {
        const r2 = c.r * c.r;
        for (let j = Math.max(0, Math.floor(c.z - c.r)); j <= Math.min(N - 1, Math.ceil(c.z + c.r)); j++)
          for (let i = Math.max(0, Math.floor(c.x - c.r)); i <= Math.min(N - 1, Math.ceil(c.x + c.r)); i++) {
            const dx = i + 0.5 - c.x, dz = j + 0.5 - c.z; if (dx * dx + dz * dz <= r2) this.owned[j * N + i] = 1;
          }
      }
      this.recolor();
      // border posts
      let n = 0;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = j * N + i; if (!this.owned[k] || this.type[k] === 1) continue;
        let edge = false;
        for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + d[0], b = j + d[1]; if (!this.inb(a, b) || !this.owned[b * N + a]) edge = true; }
        if (!edge || (i + j) % 2) continue;
        if (n >= this.borderCap) break;
        const x = i + 0.5, z = j + 0.5;
        _e.set(0, (i * 7 + j * 3) % 6, 0); _q.setFromEuler(_e);
        _m.compose(_p.set(x, this.heightAt(x, z), z), _q, _s.set(1, 1, 1));
        this.border.setMatrixAt(n++, _m);
      }
      this.border.count = n;
      this.border.instanceMatrix.needsUpdate = true;
    }

    /* ---------------- decorations ---------------- */
    buildDecor(rand) {
      if (VE.natureGeo && VE.Vegetation) {
        // nieuwe vegetatie (Blender) met een eigen random-reeks; de oude reeks wordt exact even ver
        // doorgeschoven, zodat de bomen en rotsen van een seed precies op dezelfde plek blijven
        this.skipLegacyDecor(rand);
        this.veg = new VE.Vegetation(this, VE.natureGeo);
        this.veg.build();
        return;
      }
      this.buildDecorLegacy(rand);
    }
    skipLegacyDecor(rand) {
      const cap = VE.isMobile ? 2600 : 5200, fcap = VE.isMobile ? 700 : 1400;
      let t = 0, f = 0;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = j * N + i; if (this.type[k] === 1 || this.type[k] === 2) continue;
        const dens = this.type[k] === 3 ? 0.4 : 1.5;
        const cnt = Math.floor(rand() * dens * 2 + 0.3);
        for (let q = 0; q < cnt && t < cap; q++) {
          const x = i + 0.1 + rand() * 0.8, z = j + 0.1 + rand() * 0.8; rand();
          if (this.heightAt(x, z) < 0.08) continue;
          rand(); rand(); t++;
        }
        if (this.type[k] === 0 && rand() < 0.16 + this.gnoise[j * V1 + i] * 0.12 && f < fcap) { rand(); rand(); rand(); rand(); rand(); f++; }
      }
    }
    buildDecorLegacy(rand) {
      const cap = VE.isMobile ? 2600 : 5200, fcap = VE.isMobile ? 700 : 1400;
      this.tufts = new THREE.InstancedMesh(VE.tuftGeo(), VE.swayMat({ vertexColors: true }, 0.35, 0.0, 'tuft'), cap);
      this.flowers = new THREE.InstancedMesh(VE.flowerGeo(), VE.swayMat({ vertexColors: true }, 0.4, 0.0, 'flower'), fcap);
      this.tuftPos = []; this.flowerPos = [];
      const gcol = [0x6fb03a, 0x88c045, 0x5e9e34, 0x9ccc55], fcol = [0xffffff, 0xffd84a, 0xe84a5f, 0xb98ce8, 0xff9f43];
      let t = 0, f = 0;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = j * N + i; if (this.type[k] === 1 || this.type[k] === 2) continue;
        const dens = this.type[k] === 3 ? 0.4 : 1.5;
        let cnt = Math.floor(rand() * dens * 2 + 0.3);
        for (let q = 0; q < cnt && t < cap; q++) {
          const x = i + 0.1 + rand() * 0.8, z = j + 0.1 + rand() * 0.8, s = 0.7 + rand() * 0.7;
          if (this.heightAt(x, z) < 0.08) continue;
          (this.decoT[k] = this.decoT[k] || []).push(t);
          this.tuftPos.push([x, z, s, rand() * 6]);
          this.setDeco(this.tufts, t, x, z, s, this.tuftPos[t][3]);
          this.tufts.setColorAt(t, _c.setHex(gcol[Math.floor(rand() * gcol.length)]));
          t++;
        }
        if (this.type[k] === 0 && rand() < 0.16 + this.gnoise[j * V1 + i] * 0.12 && f < fcap) {
          const x = i + 0.2 + rand() * 0.6, z = j + 0.2 + rand() * 0.6, s = 0.8 + rand() * 0.6;
          (this.decoF[k] = this.decoF[k] || []).push(f);
          this.flowerPos.push([x, z, s, rand() * 6]);
          this.setDeco(this.flowers, f, x, z, s, this.flowerPos[f][3]);
          this.flowers.setColorAt(f, _c.setHex(fcol[Math.floor(rand() * fcol.length)]));
          f++;
        }
      }
      this.tufts.count = t; this.flowers.count = f;
      this.tufts.receiveShadow = true; this.tufts.frustumCulled = this.flowers.frustumCulled = false;
      this.root.add(this.tufts); this.root.add(this.flowers);
    }
    setDeco(mesh, idx, x, z, s, r) {
      _e.set(0, r, 0); _q.setFromEuler(_e);
      _m.compose(_p.set(x, this.heightAt(x, z), z), _q, _s.set(s, s, s));
      mesh.setMatrixAt(idx, _m);
    }
    clearDeco(k) {
      if (this.veg) { this.veg.clearTile(k); this.veg.edgeMask[k] = -1; this.veg.flush(); return; }
      if (this.decoT[k]) { for (const t of this.decoT[k]) this.tufts.setMatrixAt(t, ZERO); this.decoT[k] = null; this.tufts.instanceMatrix.needsUpdate = true; }
      if (this.decoF[k]) { for (const f of this.decoF[k]) this.flowers.setMatrixAt(f, ZERO); this.decoF[k] = null; this.flowers.instanceMatrix.needsUpdate = true; }
    }
    refreshDecoArea(i0, j0, i1, j1) {
      if (this.veg) { this.veg.refreshArea(i0, j0, i1, j1); this.veg.flush(); return; }
      for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) {
        const k = j * N + i;
        if (this.decoT[k]) for (const t of this.decoT[k]) { const p = this.tuftPos[t]; this.setDeco(this.tufts, t, p[0], p[1], p[2], p[3]); }
        if (this.decoF[k]) for (const f of this.decoF[k]) { const p = this.flowerPos[f]; this.setDeco(this.flowers, f, p[0], p[1], p[2], p[3]); }
      }
      this.tufts.instanceMatrix.needsUpdate = true; this.flowers.instanceMatrix.needsUpdate = true;
    }
  }
  VE.World = World;

  /* ================= Nature: trees, rocks, fields ================= */
  class Nature {
    constructor(world, root) {
      this.w = world; this.root = root;
      const cap = Math.round(1500 * Math.max(1, (N / 64) ** 2 * 0.6));   // grote wereld: meer bomen
      this.cap = cap;
      /* Boomsoorten: elke soort is een pool met eigen InstancedMesh(es). Met de Blender-natuur
         (VE.natureGeo) zijn dat eik, beuk, oude eik, berk, den, spar, fruitbomen, jonge boom en twee
         easter eggs (één mesh per soort, wind via aWind). Zonder: de drie oude procedurele types. */
      this.glb = !!VE.natureGeo;
      this.pools = {};
      this.trees = [];
      this.rockMesh = new THREE.InstancedMesh(VE.rockGeo(), new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 8 }), Math.round(600 * Math.max(1, (N / 64) ** 2 * 0.6)));
      this.rockMesh.castShadow = this.rockMesh.receiveShadow = true; this.rockMesh.count = 0; this.rockMesh.frustumCulled = false;
      root.add(this.rockMesh);
      this.rocks = []; this.rockFree = []; this.rockUsed = 0;
      // fields
      const fc = 400;
      this.soil = new THREE.InstancedMesh(VE.soilGeo(), new THREE.MeshLambertMaterial({ vertexColors: true }), fc);
      this.wheat = new THREE.InstancedMesh(VE.wheatGeo(), VE.swayMat({ vertexColors: true }, 0.35, 0.05, 'wheat'), fc);
      this.vines = new THREE.InstancedMesh(VE.vineGeo(), VE.swayMat({ vertexColors: true }, 0.06, 0.15, 'vine'), fc);
      this.grapes = new THREE.InstancedMesh(VE.grapeGeo(), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 30 }), fc);
      // na de oogst: stoppels, en een hok (schoven tegen elkaar) tot de boer de schoof meeneemt
      this.stubble = new THREE.InstancedMesh(VE.stubbleGeo(), new THREE.MeshLambertMaterial({ vertexColors: true }), fc);
      this.stook = new THREE.InstancedMesh(VE.stookGeo(), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 4 }), fc);
      for (let i = 0; i < fc; i++) this.wheat.setColorAt(i, _c.setHex(0x7fbf3f));
      this.fieldMeshes = [this.soil, this.wheat, this.vines, this.grapes, this.stubble, this.stook];
      for (const m of this.fieldMeshes) { m.count = 0; m.receiveShadow = true; m.frustumCulled = false; root.add(m); }
      this.wheat.castShadow = this.vines.castShadow = this.stook.castShadow = true;
      this.fields = []; this.fieldFree = []; this.fieldUsed = 0;
      // rijp graan: warm goud zoals een zomerse akker (was felgeel)
      this.green = new THREE.Color(0x86c24a); this.goldC = new THREE.Color(0xe3c27e);
    }
    /* trees */
    pool(name) {
      if (this.pools[name]) return this.pools[name];
      let meshes, cap;
      if (name[0] === 'L') {                                       // oud procedureel model: stam + kroon
        const t = +name[1], g = VE.treeGeo(t);
        cap = this.cap;
        this.trunkMat = this.trunkMat || new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 3 });
        meshes = [new THREE.InstancedMesh(g.trunk, this.trunkMat, cap), new THREE.InstancedMesh(g.crown, VE.swayMat({ vertexColors: true }, t === 1 ? 0.035 : 0.05, 0.3, 'tree' + t), cap)];
      } else {
        cap = Math.round((VE.TREE_CAP[name] || 400) * Math.max(1, (N / 64) ** 2 * 0.6));   // grote wereld: meer bomen
        const conifer = name === 'tree_pine' || name === 'tree_spruce';
        meshes = [new THREE.InstancedMesh(VE.natureGeo[name], VE.windMat({}, { amp: conifer ? 0.035 : 0.045, flutter: conifer ? 0.002 : 0.007, base: 0.12, pow: 1.5 }, name), cap)];
        meshes[0].setColorAt(0, _c.setHex(0xffffff));
        meshes[0].name = name;
      }
      for (const m of meshes) { m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; this.w.root.add(m); }
      // Blender-bomen: alleen de zichtbare exemplaren naar de GPU (VE.natureSync)
      const inst = name[0] === 'L' ? null : new VE.Instancer(meshes[0], cap, 0.9);
      return (this.pools[name] = { name: name, meshes: meshes, inst: inst, cap: cap, free: [], used: 0, dirty: false });
    }
    speciesOf(t) {
      if (!this.glb) return 'L' + t.type;
      if (t.growth < 0.5 && t.type !== 1) return 'tree_young';
      return t.sp0 || (t.sp0 = VE.treeSpecies(this.w, t));
    }
    alloc(t, name) {
      if (!name) return false;
      const P = this.pool(name);
      const idx = P.free.length ? P.free.pop() : P.used < P.cap ? P.used++ : -1;
      if (idx < 0) return false;
      t.sp = name; t.idx = idx;
      if (P.inst) P.inst.color(idx, _c.setHex(t.look.tint));
      return true;
    }
    release(t) {
      const P = this.pools[t.sp]; if (!P) return;
      if (P.inst) P.inst.kill(t.idx); else for (const m of P.meshes) m.setMatrixAt(t.idx, ZERO);
      P.free.push(t.idx); P.dirty = true; t.sp = null;
    }
    addTree(i, j, type, growth, r) {
      const w = this.w, k = j * VE.N + i;
      if (w.tree[k]) return null;
      r = r || Math.random;
      const t = { i: i, j: j, k: k, x: i + 0.5 + (r() - 0.5) * 0.3, z: j + 0.5 + (r() - 0.5) * 0.3, type: type, idx: -1, growth: growth, rot: r() * 6.28, sc: 0.85 + r() * 0.35, fall: 0, falling: false, reserved: false, dead: false };
      t.look = this.glb ? VE.treeLook(w, t) : { tint: 0xffffff, vx: 1, vy: 1 };
      if (!this.alloc(t, this.speciesOf(t))) return null;
      w.tree[k] = t; this.trees.push(t);
      this.setTreeM(t);
      return t;
    }
    setTreeM(t) {
      const w = this.w;
      const sp = this.speciesOf(t);
      if (sp !== t.sp) { const old = t.sp; this.release(t); if (!this.alloc(t, sp)) this.alloc(t, old); }   // jong → volwassen model
      const P = this.pools[t.sp];
      if (!P) return;
      const s = t.sc * (0.18 + 0.82 * Math.min(1, t.growth));
      // easter-egg-bomen: vogelhuisje/embleem naar de standaardcamera
      _e.set(0, t.sp === 'tree_oak_bird' || t.sp === 'tree_beech_logo' ? Math.PI / 4 : t.rot, 0); _q.setFromEuler(_e);
      if (t.fall) {
        // omvallen: kantelen om de horizontale as loodrecht op de valrichting (de boom zelf draait niet)
        const d = t.fallDir || [0, 1];
        _q2.setFromAxisAngle(_ax.set(d[1], 0, -d[0]), t.fall); _q.premultiply(_q2);
      }
      _m.compose(_p.set(t.x, w.heightAt(t.x, t.z) - 0.02 + (t.fall ? 0.03 : 0), t.z), _q, _s.set(s * t.look.vx, s * t.look.vy, s * t.look.vx));
      if (P.inst) P.inst.set(t.idx, _m); else for (const m of P.meshes) m.setMatrixAt(t.idx, _m);
      P.dirty = true;
    }
    removeTree(t) {
      if (t.dead) return;
      this.release(t);
      t.dead = true;
      if (this.w.tree[t.k] === t) this.w.tree[t.k] = null;
    }
    /* Omhakken. De boom valt in richting `dir` ([dx, dz], weg van de houthakker en vrij van obstakels):
       eerst langzaam, dan steeds sneller (zwaartekracht), en hij komt tot stilstand op de hoek waarop de
       kroon de grond raakt (het terrein meegerekend), met een kleine stuit. Daarna blijft hij liggen tot de
       houthakker hem in stukken hakt (buckTree). */
    fellTree(t, dir) {
      t.falling = true; t.fall = 0.012; t.fallV = 0.05; t.landed = false;
      t.fallDir = dir || [Math.sin(t.rot), Math.cos(t.rot)];
      const s = t.sc * (0.18 + 0.82 * Math.min(1, t.growth)), w = this.w, sp = t.sp || '';
      const hc = (sp === 'tree_pine' ? 0.88 : sp === 'tree_birch' ? 0.8 : sp === 'tree_spruce' ? 0.55 : /apple|pear|blossom/.test(sp) ? 0.52 : 0.72) * s;
      const rc = (sp === 'tree_spruce' ? 0.2 : /apple|pear|blossom|birch/.test(sp) ? 0.18 : 0.24) * s;
      const g0 = w.heightAt(t.x, t.z);
      let max = 1.5;
      for (let a = 0.9; a <= 1.5; a += 0.02) {
        const x = t.x + t.fallDir[0] * hc * Math.sin(a), z = t.z + t.fallDir[1] * hc * Math.sin(a);
        const gy = w.inb(Math.floor(x), Math.floor(z)) ? w.heightAt(x, z) - g0 : 0;
        if (hc * Math.cos(a) - rc * 0.8 <= gy) { max = a; break; }
      }
      t.fallMax = max; t.trunkLen = hc * 0.78; t.logR = 0.055 * s;
    }
    /* valrichting: zo veel mogelijk weg van de houthakker, maar niet op gebouwen, water, andere bomen of
       buiten de kaart (16 richtingen, de beste score wint) */
    fallDir(t, cx, cz) {
      const w = this.w, N = VE.N, L = 0.95 * t.sc;
      const away = Math.atan2(t.x - cx, t.z - cz);
      let best = away, bs = 1e9;
      for (let k = 0; k < 16; k++) {
        const a = away + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8;
        const dx = Math.sin(a), dz = Math.cos(a);
        let sc = Math.ceil(k / 2) * 0.6;
        for (let r = 0.3; r <= L; r += 0.15) {
          const x = t.x + dx * r, z = t.z + dz * r, i = Math.floor(x), j = Math.floor(z);
          if (!w.inb(i, j)) { sc += 6; continue; }
          const kk = j * N + i;
          if (w.bld[kk] || w.door[kk]) sc += 5;
          if (w.type[kk] === 1) sc += 3;
          const o = w.tree[kk];
          if (o && o !== t && !o.dead && !o.falling && Math.hypot(o.x - x, o.z - z) < 0.3) sc += 2;
          if (w.rock[kk]) sc += 1;
        }
        if (sc < bs) { bs = sc; best = a; }
      }
      return [Math.sin(best), Math.cos(best)];
    }
    /* de omgevallen boom in stukken: de kroon gaat eraf (bladeren), de stam wordt één lange stam op de grond */
    buckTree(t) {
      const d = t.fallDir || [0, 1], len = t.trunkLen || 0.5, R = t.logR || 0.05;
      const cx = t.x + d[0] * (len + 0.1), cz = t.z + d[1] * (len + 0.1);
      VE.bus.emit('leaves', { x: cx, y: this.w.heightAt(cx, cz) + 0.2, z: cz });
      VE.bus.emit('leaves', { x: cx + d[0] * 0.15, y: this.w.heightAt(cx, cz) + 0.15, z: cz + d[1] * 0.15 });
      this.removeTree(t);
      return this.addLog(t.x + d[0] * len * 0.52, t.z + d[1] * len * 0.52, d, len, R);
    }
    /* een lange stam in twee losse stammen */
    splitLog(p) {
      const d = p.dir, h = p.len * 0.25;
      this.removeLog(p);
      return [this.addLog(p.x - d[0] * h * 1.04, p.z - d[1] * h * 1.04, d, p.len * 0.48, p.R),
              this.addLog(p.x + d[0] * h * 1.04, p.z + d[1] * h * 1.04, d, p.len * 0.48, p.R)];
    }
    /* losse boomstammen op de grond (één InstancedMesh, item-model 'log', geschaald naar de echte stam) */
    addLog(x, z, d, len, R) {
      if (!this.logMesh || this.logGeoVer !== (VE.itemGeoVer || 0)) {
        const g = VE.itemGeo('log');
        if (!this.logMesh) {
          this.logMesh = new THREE.InstancedMesh(g, new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 4, specular: 0x111111 }), 64);
          this.logMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(64 * 3).fill(1), 3);   // zie VE-001
          this.logMesh.count = 0; this.logMesh.castShadow = this.logMesh.receiveShadow = true; this.logMesh.frustumCulled = false;
          this.logMesh.name = 'fallen_logs'; this.w.root.add(this.logMesh);
          this.logs = []; this.logFree = [];
        } else this.logMesh.geometry = g;
        this.logGeoVer = VE.itemGeoVer || 0;
      }
      const idx = this.logFree.length ? this.logFree.pop() : this.logs.length < 64 ? this.logMesh.count++ : -1;
      const p = { x: x, z: z, dir: d, len: len, R: R, idx: idx, dead: false };
      if (idx >= 0) {
        // lokale x langs de valrichting; schaal: item-stam (0,24 lang, straal 0,035) naar de echte stam
        _q.setFromAxisAngle(_up, Math.atan2(-d[1], d[0]));
        _m.compose(_p.set(x, this.w.heightAt(x, z) + R * 0.85, z), _q, _s.set(len / 0.24, R / 0.035, R / 0.035));
        this.logMesh.setMatrixAt(idx, _m); this.logMesh.instanceMatrix.needsUpdate = true;
      }
      this.logs.push(p);
      return p;
    }
    removeLog(p) {
      if (!p || p.dead) return;
      p.dead = true;
      if (p.idx >= 0) { this.logMesh.setMatrixAt(p.idx, ZERO); this.logMesh.instanceMatrix.needsUpdate = true; this.logFree.push(p.idx); }
      this.logs = this.logs.filter(q => q !== p);
    }
    /* rocks */
    addRock(i, j, amount, r) {
      const w = this.w, k = j * VE.N + i;
      if (w.rock[k]) return null;
      const idx = this.rockFree.length ? this.rockFree.pop() : this.rockUsed++;
      if (idx >= 600) { this.rockUsed = 600; return null; }
      r = r || Math.random;
      const o = { i: i, j: j, k: k, x: i + 0.5 + (r() - 0.5) * 0.2, z: j + 0.5 + (r() - 0.5) * 0.2, amount: amount, max: 8, idx: idx, rot: r() * 6.28, sc: 0.9 + r() * 0.35, reserved: false, dead: false };
      w.rock[k] = o; this.rocks.push(o);
      this.setRockM(o);
      return o;
    }
    setRockM(o) {
      const s = o.sc * (0.45 + 0.55 * o.amount / o.max);
      _e.set(0, o.rot, 0); _q.setFromEuler(_e);
      _m.compose(_p.set(o.x, this.w.heightAt(o.x, o.z) - 0.03, o.z), _q, _s.set(s * 1.4, s * 1.4, s * 1.4));
      this.rockMesh.setMatrixAt(o.idx, _m); this.rockDirty = true;
    }
    mineRock(o) {
      o.amount--;
      if (o.amount <= 0) { this.rockMesh.setMatrixAt(o.idx, ZERO); this.rockFree.push(o.idx); o.dead = true; if (this.w.rock[o.k] === o) this.w.rock[o.k] = null; this.rockDirty = true; }
      else this.setRockM(o);
    }
    /* fields */
    addField(i, j, kind, owner) {
      const w = this.w, k = j * VE.N + i;
      if (w.field[k]) return null;
      const idx = this.fieldFree.length ? this.fieldFree.pop() : this.fieldUsed++;
      if (idx >= 400) { this.fieldUsed = 400; return null; }
      const f = { i: i, j: j, k: k, kind: kind, idx: idx, growth: 0, state: 'growing', owner: owner, reserved: false, dead: false };
      w.field[k] = f; this.fields.push(f);
      w.clearDeco(k);
      this.setFieldM(f);
      return f;
    }
    /* Akkers volgen het terrein: het vlak door de vier hoeken van de tegel (hoogte in het midden en de
       helling in x en z). Grond, graan en stoppels worden daarlangs 'geschoven' (shear): de akker ligt
       overal op het maaiveld, en halmen blijven rechtop staan. */
    fieldPlane(f) {
      const w = this.w, i = f.i, j = f.j;
      const a = w.heightAt(i + 0.02, j + 0.02), b = w.heightAt(i + 0.98, j + 0.02), c = w.heightAt(i + 0.02, j + 0.98), d = w.heightAt(i + 0.98, j + 0.98);
      return { y: (a + b + c + d) / 4, hx: ((b + d) - (a + c)) / 2 / 0.96, hz: ((c + d) - (a + b)) / 2 / 0.96 };
    }
    fieldMat(f, P, ox, oy, oz, sx, sy, sz) {
      _m.makeScale(sx, sy, sz); _m.setPosition(ox, oy, oz);
      _sh.set(1, 0, 0, 0, P.hx, 1, P.hz, 0, 0, 0, 1, 0, 0, 0, 0, 1);
      _m.premultiply(_sh);
      _m.premultiply(_tr.makeTranslation(f.i + 0.5, P.y, f.j + 0.5));
      return _m;
    }
    setFieldM(f) {
      const x = f.i + 0.5, z = f.j + 0.5, P = this.fieldPlane(f), y = P.y;
      _q.identity();
      this.soil.setMatrixAt(f.idx, this.fieldMat(f, P, 0, 0.0, 0, 1, 1, 1));         // bovenkant net boven het maaiveld
      const g = (f.state === 'empty' || f.state === 'cut') ? 0 : Math.min(1, f.growth);
      if (f.kind === 0) {
        // maaien: een maaifront schuift over de akker; het staande graan wordt smaller vanaf één kant
        const mw = Math.min(0.97, f.mow || 0), h = 0.15 + 0.85 * g;
        if (g <= 0 || mw >= 0.97) this.wheat.setMatrixAt(f.idx, ZERO);
        else this.wheat.setMatrixAt(f.idx, this.fieldMat(f, P, mw * 0.45, 0.02, 0, 1 - mw, h, 1));
        this.wheat.setColorAt(f.idx, _c.copy(this.green).lerp(this.goldC, VE.smooth(0.55, 1.0, g)));
        // stoppels na het maaien (tot er opnieuw gezaaid wordt), hok zolang de schoof er staat
        const stub = f.state === 'empty' || f.state === 'cut' || (f.mow || 0) > 0;
        if (stub) this.stubble.setMatrixAt(f.idx, this.fieldMat(f, P, 0, 0.02, 0, 1, 1, 1)); else this.stubble.setMatrixAt(f.idx, ZERO);
        if (f.state === 'cut') {
          _q.setFromAxisAngle(_up, (f.i * 7 + f.j * 3) % 6);
          _m.compose(_p.set(x + 0.12, y + 0.12 * P.hx - 0.06 * P.hz + 0.02, z - 0.06), _q, _s.set(1, 1, 1)); this.stook.setMatrixAt(f.idx, _m); _q.identity();   // hok rechtop, op het maaiveld
        } else this.stook.setMatrixAt(f.idx, ZERO);
        this.vines.setMatrixAt(f.idx, ZERO); this.grapes.setMatrixAt(f.idx, ZERO);
      } else {
        this.stubble.setMatrixAt(f.idx, ZERO); this.stook.setMatrixAt(f.idx, ZERO);
        this.vines.setMatrixAt(f.idx, this.fieldMat(f, P, 0, 0.02, 0, 1, 0.3 + 0.7 * Math.max(0.35, g), 1));
        const gs = VE.smooth(0.5, 1.0, g);
        if (gs <= 0.01) this.grapes.setMatrixAt(f.idx, ZERO);
        else this.grapes.setMatrixAt(f.idx, this.fieldMat(f, P, 0, 0.02, 0, 1, gs, 1));
        this.wheat.setMatrixAt(f.idx, ZERO);
      }
      this.fieldDirty = true;
    }
    removeField(f) {
      for (const m of this.fieldMeshes) m.setMatrixAt(f.idx, ZERO);
      this.fieldFree.push(f.idx); f.dead = true;
      if (this.w.field[f.k] === f) this.w.field[f.k] = null;
      this.fieldDirty = true;
    }
    refreshArea(i0, j0, i1, j1) {
      for (const t of this.trees) if (!t.dead && t.i >= i0 && t.i <= i1 && t.j >= j0 && t.j <= j1) this.setTreeM(t);
      for (const r of this.rocks) if (!r.dead && r.i >= i0 && r.i <= i1 && r.j >= j0 && r.j <= j1) this.setRockM(r);
      for (const f of this.fields) if (!f.dead && f.i >= i0 && f.i <= i1 && f.j >= j0 && f.j <= j1) this.setFieldM(f);
    }
    update(dt, growMult) {
      this.acc = (this.acc || 0) + dt;
      const slow = this.acc > 0.25;
      for (let n = 0; n < this.trees.length; n++) {
        const t = this.trees[n];
        if (t.dead) continue;
        if (t.falling) {
          if (t.landed) continue;
          // vallen: zwaartekracht (sneller naarmate hij schuiner hangt), stilstaan op de grond met een stuit
          t.fallV += dt * (0.9 + 5.2 * Math.sin(t.fall + 0.05)); t.fall += t.fallV * dt;
          const max = t.fallMax || 1.45;
          if (t.fall >= max) {
            t.fall = max;
            if (t.fallV > 0.7) {
              if (!t.thud) {
                t.thud = true;
                const d = t.fallDir || [0, 1], r = (t.trunkLen || 0.5) * 1.3;
                VE.bus.emit('sfx', { n: 'thud', x: t.x, z: t.z });
                VE.bus.emit('dust', { x: t.x + d[0] * r, y: this.w.heightAt(t.x + d[0] * r, t.z + d[1] * r), z: t.z + d[1] * r, n: 8 });
                VE.bus.emit('leaves', { x: t.x + d[0] * r, y: this.w.heightAt(t.x + d[0] * r, t.z + d[1] * r) + 0.15, z: t.z + d[1] * r });
              }
              t.fallV = -t.fallV * 0.2;                     // kleine stuit
            } else { t.fallV = 0; t.landed = true; }
          }
          this.setTreeM(t);
        } else if (t.growth < 1 && slow) {
          t.growth = Math.min(1, t.growth + this.acc / 75 * growMult);
          this.setTreeM(t);
        }
      }
      if (slow) {
        for (const f of this.fields) {
          if (f.dead || f.state !== 'growing') continue;
          const def = f.kind === 0 ? VE.DEFS.farm : VE.DEFS.vineyard;
          f.growth += this.acc / def.grow * growMult;
          if (f.growth >= 1) { f.growth = 1; f.state = 'grown'; }
          this.setFieldM(f);
        }
        this.acc = 0;
        if (this.trees.length > 200 && this.trees.some(t => t.dead)) this.trees = this.trees.filter(t => !t.dead);
        if (this.fields.some(f => f.dead)) this.fields = this.fields.filter(f => !f.dead);
        if (this.rocks.some(r => r.dead)) this.rocks = this.rocks.filter(r => !r.dead);
      }
      for (const name in this.pools) {
        const P = this.pools[name]; if (!P.dirty || P.inst) { P.dirty = false; continue; }
        for (const m of P.meshes) { m.count = P.used; m.instanceMatrix.needsUpdate = true; }
        P.dirty = false;
      }
      if (this.rockDirty) { this.rockMesh.count = this.rockUsed; this.rockMesh.instanceMatrix.needsUpdate = true; this.rockDirty = false; }
      if (this.fieldDirty) {
        for (const m of this.fieldMeshes) { m.count = this.fieldUsed; m.instanceMatrix.needsUpdate = true; }
        if (this.wheat.instanceColor) this.wheat.instanceColor.needsUpdate = true;
        this.fieldDirty = false;
      }
    }
    populate(rand) {
      const w = this.w, N = VE.N, cx = w.start.i + 1, cz = w.start.j + 1;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = j * N + i; const ty = w.type[k];
        if (ty === 1) continue;
        const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cz);
        if (d < 3.6) continue;
        if (ty === 2 || (w.mount[k] > 0.35 && ty !== 3)) {
          if (rand() < 0.16 && w.slope(i, j) < 1.6) { this.addRock(i, j, 8, rand); continue; }
          if (rand() < 0.22 * (1 - w.mount[k]) && w.tileH(i, j) < 4.2) this.addTree(i, j, 1, 1, rand);
          continue;
        }
        const f = w.forest[k];
        let p = VE.smooth(0.46, 0.6, f) * 0.8 + 0.025;
        if (ty === 3) p *= 0.3;
        if (d < 6) p *= 0.6;
        if (rand() < p) {
          const type = (w.mount[k] > 0.15 || f > 0.64) ? (rand() < 0.7 ? 1 : 0) : (rand() < 0.22 ? 2 : 0);
          this.addTree(i, j, type, 1, rand);
        }
      }
      // guaranteed groves and boulders near the start
      const groves = [[cx - 6, cz - 3], [cx + 4, cz - 6], [cx - 3, cz - 7]];
      for (const g of groves) for (let q = 0; q < 9; q++) {
        const i = Math.round(g[0] + (rand() - 0.5) * 4), j = Math.round(g[1] + (rand() - 0.5) * 4);
        if (w.inb(i, j) && w.type[j * N + i] !== 1 && Math.hypot(i + 0.5 - cx, j + 0.5 - cz) > 3.6) this.addTree(i, j, rand() < 0.3 ? 2 : 0, 1, rand);
      }
      const quarries = [[cx + 6, cz + 2], [cx + 1, cz + 7], [cx - 6, cz - 6]];
      for (const g of quarries) for (let q = 0; q < 9; q++) {
        const i = Math.round(g[0] + (rand() - 0.5) * 3), j = Math.round(g[1] + (rand() - 0.5) * 3);
        const k = j * N + i;
        if (w.inb(i, j) && w.type[k] !== 1 && !w.tree[k] && Math.hypot(i + 0.5 - cx, j + 0.5 - cz) > 3.6) this.addRock(i, j, 8, rand);
      }
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; if (w.tree[k] || w.rock[k]) { if (w.rock[k]) w.clearDeco(k); } }
    }
    serialize() {
      return {
        t: this.trees.filter(t => !t.dead && !t.falling).map(t => [t.k, t.type, Math.round(t.growth * 100) / 100]),
        r: this.rocks.filter(r => !r.dead).map(r => [r.k, r.amount]),
        f: this.fields.filter(f => !f.dead).map(f => [f.k, f.kind, Math.round(f.growth * 100) / 100, f.state, f.owner ? f.owner.id : 0])
      };
    }
  }
  VE.Nature = Nature;
})(window.VE);
