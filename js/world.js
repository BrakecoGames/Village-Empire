/* Village Empire — © 2026 Brakeco Games. All rights reserved. */
'use strict';
(function (VE) {
  const N = 64; VE.N = N;
  const V1 = N + 1;
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  VE.ZERO = ZERO;

  class World {
    constructor(seed, root) {
      this.seed = seed; this.N = N; this.root = root;
      this.H = new Float32Array(V1 * V1);
      this.mount = new Float32Array(N * N); this.forest = new Float32Array(N * N); this.gnoise = new Float32Array(V1 * V1);
      this.type = new Uint8Array(N * N); this.bld = new Int32Array(N * N); this.road = new Uint8Array(N * N);
      this.owned = new Uint8Array(N * N); this.door = new Uint8Array(N * N);
      this.tree = new Array(N * N).fill(null); this.rock = new Array(N * N).fill(null); this.field = new Array(N * N).fill(null);
      this.decoT = new Array(N * N).fill(null); this.decoF = new Array(N * N).fill(null);
      this.start = { i: 30, j: 30 };
    }
    inb(i, j) { return i >= 0 && j >= 0 && i < N && j < N; }
    vh(x, z) { return this.H[z * V1 + x]; }
    heightAt(x, z) {
      x = VE.clamp(x, 0, N - 0.0001); z = VE.clamp(z, 0, N - 0.0001);
      const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, H = this.H;
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
    walkable(k) { return this.type[k] !== 1 && this.bld[k] === 0; }
    isWater(k) { return this.type[k] === 1; }

    generate() {
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
      this.terrain = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
      this.terrain.receiveShadow = true;
      this.terrain.name = 'terrain';
      this.root.add(this.terrain);
      this.buildSkirt();
      this.buildWater();
      this.recolor();
      // roads
      this.roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
      this.roadMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.roadMat);
      this.roadMesh.receiveShadow = true;
      this.root.add(this.roadMesh);
      // border posts
      this.border = new THREE.InstancedMesh(VE.borderGeo(), new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 5 }), 900);
      this.border.count = 0; this.border.castShadow = true; this.border.frustumCulled = false;
      this.root.add(this.border);
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
      const m = new THREE.MeshPhongMaterial({ color: 0x3f93c9, specular: 0xd8f0ff, shininess: 70, flatShading: true, transparent: true, opacity: 0.84 });
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
    vertexNear(x, z, arr) {
      for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) {
        const i = x + dx, j = z + dz; if (this.inb(i, j) && arr[j * N + i]) return true;
      }
      return false;
    }
    recolor() {
      const ca = this.terrain.geometry.attributes.color;
      const g1 = new THREE.Color(0x76b43e), g2 = new THREE.Color(0xa4cc52), g3 = new THREE.Color(0x4e8f32), sand = new THREE.Color(0xe6d29a),
        bed = new THREE.Color(0x7c6c4c), rock = new THREE.Color(0x9e988c), rock2 = new THREE.Color(0x857f74), snow = new THREE.Color(0xf6f6f2), dirt = new THREE.Color(0xb39368), dim = new THREE.Color(0x707a68);
      const c = new THREE.Color(), t = new THREE.Color();
      for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) {
        const v = z * V1 + x, h = this.H[v], gn = this.gnoise[v];
        const ti = Math.min(N - 1, x), tj = Math.min(N - 1, z), k = tj * N + ti;
        c.copy(g1).lerp(g2, VE.smooth(0.42, 0.68, gn));
        c.lerp(g3, VE.smooth(0.5, 0.68, this.forest[k]) * 0.75);
        const m = this.mount[k];
        if (m > 0.2) { t.copy(rock).lerp(rock2, gn); c.lerp(t, VE.smooth(0.25, 0.6, m)); }
        if (h > 4.6) c.lerp(snow, VE.smooth(4.6, 5.6, h));
        if (h < 0.34) c.lerp(sand, VE.smooth(0.34, 0.14, h));
        if (h < 0.0) c.lerp(bed, VE.smooth(0.0, -0.35, h));
        if (this.vertexNear(x, z, this.bld)) c.lerp(dirt, 0.55);
        if (!this.vertexOwned(x, z)) { c.lerp(dim, 0.3); c.multiplyScalar(0.72); }
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
    rebuildRoads() {
      const pos = [], col = [];
      const rr = VE.rng(99);
      const base = new THREE.Color(0xd6bb85), edge = new THREE.Color(0xc4a670);
      const push = (x, z, c) => { pos.push(x, this.heightAt(x, z) + 0.035, z); col.push(c.r, c.g, c.b); };
      const tint = (f) => _c.copy(base).lerp(edge, f);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = j * N + i; if (!this.road[k]) continue;
        const cx = i + 0.5, cz = j + 0.5, segs = 10;
        for (let s = 0; s < segs; s++) {
          const a0 = s / segs * Math.PI * 2, a1 = (s + 1) / segs * Math.PI * 2;
          const r0 = 0.3 + Math.sin(a0 * 3 + i * 1.3 + j) * 0.03, r1 = 0.3 + Math.sin(a1 * 3 + i * 1.3 + j) * 0.03;
          push(cx, cz, tint(0));
          push(cx + Math.cos(a1) * r1, cz + Math.sin(a1) * r1, tint(0.8));
          push(cx + Math.cos(a0) * r0, cz + Math.sin(a0) * r0, tint(0.8));
        }
        const dirs = [[1, 0], [0, 1], [1, 1], [-1, 1]];
        for (const d of dirs) {
          const ni = i + d[0], nj = j + d[1];
          if (!this.inb(ni, nj) || !this.road[nj * N + ni]) continue;
          if (d[0] !== 0 && d[1] !== 0 && (this.road[j * N + ni] || this.road[nj * N + i])) continue;
          const len = Math.hypot(d[0], d[1]), w = d[0] && d[1] ? 0.21 : 0.25;
          const px = -d[1] / len * w, pz = d[0] / len * w;
          const SEG = 4;
          for (let s = 0; s < SEG; s++) {
            const t0 = s / SEG, t1 = (s + 1) / SEG;
            const x0 = cx + d[0] * t0, z0 = cz + d[1] * t0, x1 = cx + d[0] * t1, z1 = cz + d[1] * t1;
            const wob0 = Math.sin((i + j + t0) * 5.1) * 0.03, wob1 = Math.sin((i + j + t1) * 5.1) * 0.03;
            const L0 = [x0 + px * (1 + wob0), z0 + pz * (1 + wob0)], R0 = [x0 - px, z0 - pz], L1 = [x1 + px * (1 + wob1), z1 + pz * (1 + wob1)], R1 = [x1 - px, z1 - pz];
            push(R0[0], R0[1], tint(0.7)); push(L0[0], L0[1], tint(0.7)); push(L1[0], L1[1], tint(0.7));
            push(R0[0], R0[1], tint(0.7)); push(L1[0], L1[1], tint(0.7)); push(R1[0], R1[1], tint(0.7));
            // centre wear line
            const mx0 = x0, mz0 = z0, mx1 = x1, mz1 = z1, q = 0.4;
            push(mx0 - px * q, mz0 - pz * q, tint(-0.4)); push(mx0 + px * q, mz0 + pz * q, tint(-0.4)); push(mx1 + px * q, mz1 + pz * q, tint(-0.4));
            push(mx0 - px * q, mz0 - pz * q, tint(-0.4)); push(mx1 + px * q, mz1 + pz * q, tint(-0.4)); push(mx1 - px * q, mz1 - pz * q, tint(-0.4));
          }
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeVertexNormals();
      this.roadMesh.geometry.dispose();
      this.roadMesh.geometry = g;
      void rr;
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
        if (n >= 900) break;
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
      if (this.decoT[k]) { for (const t of this.decoT[k]) this.tufts.setMatrixAt(t, ZERO); this.decoT[k] = null; this.tufts.instanceMatrix.needsUpdate = true; }
      if (this.decoF[k]) { for (const f of this.decoF[k]) this.flowers.setMatrixAt(f, ZERO); this.decoF[k] = null; this.flowers.instanceMatrix.needsUpdate = true; }
    }
    refreshDecoArea(i0, j0, i1, j1) {
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
      const cap = 1500;
      this.cap = cap;
      const trunkMat = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 3 });
      this.types = [0, 1, 2].map(t => {
        const g = VE.treeGeo(t);
        const trunk = new THREE.InstancedMesh(g.trunk, trunkMat, cap);
        const crown = new THREE.InstancedMesh(g.crown, VE.swayMat({ vertexColors: true }, t === 1 ? 0.035 : 0.05, 0.3, 'tree' + t), cap);
        trunk.castShadow = crown.castShadow = true; crown.receiveShadow = true;
        trunk.count = crown.count = 0; trunk.frustumCulled = crown.frustumCulled = false;
        root.add(trunk); root.add(crown);
        return { trunk: trunk, crown: crown, free: [], used: 0, dirty: false };
      });
      this.trees = [];
      this.rockMesh = new THREE.InstancedMesh(VE.rockGeo(), new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 8 }), 600);
      this.rockMesh.castShadow = this.rockMesh.receiveShadow = true; this.rockMesh.count = 0; this.rockMesh.frustumCulled = false;
      root.add(this.rockMesh);
      this.rocks = []; this.rockFree = []; this.rockUsed = 0;
      // fields
      const fc = 400;
      this.soil = new THREE.InstancedMesh(VE.soilGeo(), new THREE.MeshLambertMaterial({ vertexColors: true }), fc);
      this.wheat = new THREE.InstancedMesh(VE.wheatGeo(), VE.swayMat({ vertexColors: true }, 0.35, 0.05, 'wheat'), fc);
      this.vines = new THREE.InstancedMesh(VE.vineGeo(), VE.swayMat({ vertexColors: true }, 0.06, 0.15, 'vine'), fc);
      this.grapes = new THREE.InstancedMesh(VE.grapeGeo(), new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 30 }), fc);
      for (let i = 0; i < fc; i++) this.wheat.setColorAt(i, _c.setHex(0x7fbf3f));
      for (const m of [this.soil, this.wheat, this.vines, this.grapes]) { m.count = 0; m.receiveShadow = true; m.frustumCulled = false; root.add(m); }
      this.wheat.castShadow = this.vines.castShadow = true;
      this.fields = []; this.fieldFree = []; this.fieldUsed = 0;
      this.green = new THREE.Color(0x86c24a); this.goldC = new THREE.Color(0xf0c94c);
    }
    /* trees */
    addTree(i, j, type, growth, r) {
      const w = this.w, k = j * VE.N + i;
      if (w.tree[k]) return null;
      const T = this.types[type];
      const idx = T.free.length ? T.free.pop() : T.used++;
      if (idx >= this.cap) { T.used = this.cap; return null; }
      r = r || Math.random;
      const t = { i: i, j: j, k: k, x: i + 0.5 + (r() - 0.5) * 0.3, z: j + 0.5 + (r() - 0.5) * 0.3, type: type, idx: idx, growth: growth, rot: r() * 6.28, sc: 0.85 + r() * 0.35, fall: 0, falling: false, reserved: false, dead: false };
      w.tree[k] = t; this.trees.push(t);
      this.setTreeM(t);
      return t;
    }
    setTreeM(t) {
      const T = this.types[t.type], w = this.w;
      const s = t.sc * (0.18 + 0.82 * Math.min(1, t.growth));
      _e.set(t.fall, t.rot, 0); _q.setFromEuler(_e);
      _m.compose(_p.set(t.x, w.heightAt(t.x, t.z) - 0.02, t.z), _q, _s.set(s, s, s));
      T.trunk.setMatrixAt(t.idx, _m); T.crown.setMatrixAt(t.idx, _m);
      T.dirty = true;
    }
    removeTree(t) {
      if (t.dead) return;
      const T = this.types[t.type];
      T.trunk.setMatrixAt(t.idx, ZERO); T.crown.setMatrixAt(t.idx, ZERO); T.dirty = true;
      T.free.push(t.idx);
      t.dead = true;
      if (this.w.tree[t.k] === t) this.w.tree[t.k] = null;
    }
    fellTree(t) { t.falling = true; t.fall = 0.01; t.fallV = 0.4; }
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
    setFieldM(f) {
      const x = f.i + 0.5, z = f.j + 0.5, y = this.w.heightAt(x, z);
      _q.identity();
      _m.compose(_p.set(x, y + 0.01, z), _q, _s.set(1, 1, 1));
      this.soil.setMatrixAt(f.idx, _m);
      const g = f.state === 'empty' ? 0 : Math.min(1, f.growth);
      if (f.kind === 0) {
        if (g <= 0) this.wheat.setMatrixAt(f.idx, ZERO);
        else { _m.compose(_p.set(x, y + 0.02, z), _q, _s.set(1, 0.15 + 0.85 * g, 1)); this.wheat.setMatrixAt(f.idx, _m); }
        this.wheat.setColorAt(f.idx, _c.copy(this.green).lerp(this.goldC, VE.smooth(0.55, 1.0, g)));
        this.vines.setMatrixAt(f.idx, ZERO); this.grapes.setMatrixAt(f.idx, ZERO);
      } else {
        _m.compose(_p.set(x, y + 0.02, z), _q, _s.set(1, 0.3 + 0.7 * Math.max(0.35, g), 1));
        this.vines.setMatrixAt(f.idx, _m);
        const gs = VE.smooth(0.5, 1.0, g);
        if (gs <= 0.01) this.grapes.setMatrixAt(f.idx, ZERO);
        else { _m.compose(_p.set(x, y + 0.02 + 0.3 * (1 - gs) * 0, z), _q, _s.set(1, gs, 1)); this.grapes.setMatrixAt(f.idx, _m); }
        this.wheat.setMatrixAt(f.idx, ZERO);
      }
      this.fieldDirty = true;
    }
    removeField(f) {
      for (const m of [this.soil, this.wheat, this.vines, this.grapes]) m.setMatrixAt(f.idx, ZERO);
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
          t.fallV += dt * 3.2; t.fall += t.fallV * dt;
          if (t.fall > 1.5) { this.removeTree(t); continue; }
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
      for (const T of this.types) if (T.dirty) { T.trunk.count = T.crown.count = T.used; T.trunk.instanceMatrix.needsUpdate = T.crown.instanceMatrix.needsUpdate = true; T.dirty = false; }
      if (this.rockDirty) { this.rockMesh.count = this.rockUsed; this.rockMesh.instanceMatrix.needsUpdate = true; this.rockDirty = false; }
      if (this.fieldDirty) {
        for (const m of [this.soil, this.wheat, this.vines, this.grapes]) { m.count = this.fieldUsed; m.instanceMatrix.needsUpdate = true; }
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
