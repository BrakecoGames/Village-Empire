/* Village Empire — © 2026 Brakeco Games. All rights reserved. */
'use strict';
window.VE = window.VE || {};
(function (VE) {
  VE.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  VE.noise = function (seed) {
    const r = VE.rng(seed);
    const p = [];
    for (let i = 0; i < 256; i++) p.push(i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const vals = new Float32Array(256);
    for (let i = 0; i < 256; i++) vals[i] = r();
    const lat = (x, y) => vals[perm[(perm[x & 255] + (y & 255)) & 511]];
    const sm = t => t * t * (3 - 2 * t);
    const n2 = function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const a = lat(xi, yi), b = lat(xi + 1, yi), c = lat(xi, yi + 1), d = lat(xi + 1, yi + 1);
      const u = sm(xf), v = sm(yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    n2.fbm = function (x, y, o) {
      o = o || 4; let s = 0, a = 0.5, f = 1, n = 0;
      for (let i = 0; i < o; i++) { s += a * n2(x * f, y * f); n += a; a *= 0.5; f *= 2.03; }
      return s / n;
    };
    return n2;
  };

  VE.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  VE.lerp = (a, b, t) => a + (b - a) * t;
  VE.smooth = (a, b, x) => { const t = VE.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  VE.uTime = { value: 0 };
  VE.isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (('ontouchstart' in window) && Math.min(screen.width, screen.height) < 820);

  /* Gable roof prism, ridge along X, base at y=0 */
  VE.prism = function (w, h, d) {
    const x = w / 2, z = d / 2;
    const v = [
      -x, 0, z, x, 0, z, x, h, 0, -x, 0, z, x, h, 0, -x, h, 0,
      x, 0, -z, -x, 0, -z, -x, h, 0, x, 0, -z, -x, h, 0, x, h, 0,
      -x, 0, -z, -x, 0, z, -x, h, 0,
      x, 0, z, x, 0, -z, x, h, 0,
      -x, 0, -z, x, 0, -z, x, 0, z, -x, 0, -z, x, 0, z, -x, 0, z
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  };

  const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();

  /* ---------- rounder primitives ----------
     Round parts were modelled with few segments (6–10). Rebuild them with many more, so they read as
     smooth. Only untouched primitives are upgraded: if a geometry was translated/rotated before add(),
     its first vertex no longer matches a fresh one and it is left alone. Square pyramids (≤4 sides),
     3-sided spikes and rocks (dodecahedra) stay deliberately angular. */
  const segsFor = (n, frac, min) => Math.max(8, Math.round(Math.max(min, n * 2) * Math.max(frac, 0.25)));
  function rounder(geo, icoMin, segMin) {
    const p = geo.parameters, T = geo.type;
    if (!p) return null;
    let ng = null;
    if (T === 'CylinderGeometry' && p.radialSegments >= 5)
      ng = new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, segsFor(p.radialSegments, p.thetaLength / (Math.PI * 2), segMin), p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength);
    else if (T === 'ConeGeometry' && p.radialSegments >= 5)
      ng = new THREE.ConeGeometry(p.radius, p.height, segsFor(p.radialSegments, p.thetaLength / (Math.PI * 2), segMin), p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength);
    else if (T === 'SphereGeometry')
      ng = new THREE.SphereGeometry(p.radius, Math.max(22, p.widthSegments * 2), Math.max(14, p.heightSegments * 2), p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
    else if (T === 'IcosahedronGeometry' && p.detail < icoMin)
      ng = new THREE.IcosahedronGeometry(p.radius, icoMin);
    if (!ng) return null;
    // untouched? compare against a fresh copy with the original parameters
    const ref = new geo.constructor(...Object.values(p));
    const a = geo.attributes.position.array, b = ref.attributes.position.array;
    let same = a.length === b.length;
    for (let i = 0; same && i < Math.min(9, a.length); i++) same = Math.abs(a[i] - b[i]) < 1e-6;
    ref.dispose();
    if (!same) { ng.dispose(); return null; }
    return ng;
  }
  const ROUND = new Set(['CylinderGeometry', 'ConeGeometry', 'SphereGeometry', 'IcosahedronGeometry']);

  /* Builds one merged, vertex-coloured geometry out of many primitives. */
  VE.Model = class {
    constructor(seed) { this.parts = []; this.r = VE.rng(seed || 7); this.icoMin = 2; this.segMin = 18; }
    add(geo, color, o) {
      o = o || {};
      const up = rounder(geo, this.icoMin, this.segMin);
      if (up) { geo.dispose(); geo = up; }
      const round = ROUND.has(geo.type);
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      geo.dispose();
      if (!g.attributes.normal) g.computeVertexNormals();
      _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
      _q.setFromEuler(_e);
      const s = o.s !== undefined ? o.s : 1;
      _s.set(o.sx !== undefined ? o.sx : s, o.sy !== undefined ? o.sy : s, o.sz !== undefined ? o.sz : s);
      _p.set(o.x || 0, o.y || 0, o.z || 0);
      _m.compose(_p, _q, _s);
      g.applyMatrix4(_m);
      if (o.ox || o.oy || o.oz) g.translate(o.ox || 0, o.oy || 0, o.oz || 0);
      // per-triangle colour jitter would show every little facet on a smooth round part: keep it subtle there
      const j = o.j !== undefined ? o.j : 0.06;
      this.parts.push({ g: g, c: new THREE.Color(color), j: round ? j * 0.2 : j });
      return this;
    }
    /* box with its base on y */
    box(w, h, d, color, o) { o = Object.assign({}, o || {}); o.y = (o.y || 0) + h / 2; return this.add(new THREE.BoxGeometry(w, h, d), color, o); }
    cyl(rt, rb, h, seg, color, o) { o = Object.assign({}, o || {}); o.y = (o.y || 0) + h / 2; return this.add(new THREE.CylinderGeometry(rt, rb, h, seg || 8), color, o); }
    cone(r, h, seg, color, o) { o = Object.assign({}, o || {}); o.y = (o.y || 0) + h / 2; return this.add(new THREE.ConeGeometry(r, h, seg || 8), color, o); }
    roof(w, h, d, color, o) { return this.add(VE.prism(w, h, d), color, o); }
    ball(r, color, o, detail) { return this.add(new THREE.IcosahedronGeometry(r, detail || 0), color, o); }
    merge(other) { for (const p of other.parts) this.parts.push(p); return this; }
    build() {
      let n = 0;
      for (const p of this.parts) n += p.g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
      let o = 0;
      for (const p of this.parts) {
        const pa = p.g.attributes.position.array;
        const na = p.g.attributes.normal ? p.g.attributes.normal.array : null;
        const cnt = p.g.attributes.position.count;
        pos.set(pa, o * 3);
        if (na) nor.set(na, o * 3);
        for (let v = 0; v < cnt; v += 3) {
          const f = 1 + (this.r() * 2 - 1) * p.j;
          for (let q = 0; q < 3 && v + q < cnt; q++) {
            const i = (o + v + q) * 3;
            col[i] = Math.min(1, p.c.r * f); col[i + 1] = Math.min(1, p.c.g * f); col[i + 2] = Math.min(1, p.c.b * f);
          }
        }
        o += cnt;
        p.g.dispose();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.computeBoundingSphere();
      this.parts = [];
      return g;
    }
  };

  /* Phong material whose vertices sway in the wind (trees, crops, grass). */
  VE.swayMat = function (opts, amp, base, key) {
    const m = new THREE.MeshPhongMaterial(Object.assign({ shininess: 4, specular: 0x111111 }, opts));
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uTime = VE.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n' +
        ' vec3 ipos = vec3(0.0);\n' +
        ' #ifdef USE_INSTANCING\n ipos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);\n #endif\n' +
        ' float swh = max(position.y - ' + base.toFixed(3) + ', 0.0);\n' +
        ' transformed.x += sin(uTime*1.7 + ipos.x*0.9 + ipos.z*0.7) * swh * ' + amp.toFixed(4) + ';\n' +
        ' transformed.z += cos(uTime*1.3 + ipos.x*0.6 + ipos.z*1.1) * swh * ' + (amp * 0.6).toFixed(4) + ';\n');
    };
    m.customProgramCacheKey = function () { return 'sway_' + key + '_' + amp + '_' + base; };
    return m;
  };

  VE.fmt = function (n) {
    n = Math.floor(n);
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
    return '' + n;
  };

  /* Hand-drawn resource icons (original SVG) */
  VE.ICONS = {
    log: '<rect x="3" y="6" width="14" height="12" rx="2" fill="#8a5a2b"/><path d="M5 9h9M5 15h9" stroke="#6b431f" stroke-width="1"/><ellipse cx="17" cy="12" rx="4" ry="6" fill="#e2b77c" stroke="#7a4e24" stroke-width="1.2"/><ellipse cx="17" cy="12" rx="1.7" ry="2.7" fill="none" stroke="#b07a40"/>',
    stone: '<path d="M3 17 6 9 12 5 19 8 21 16 15 20 7 20Z" fill="#a3a8ad" stroke="#5f6368" stroke-width="1.2"/><path d="M6 9 12 11 19 8M12 11 15 20" stroke="#d6dadd" fill="none" stroke-width="1.2"/>',
    plank: '<rect x="2" y="4" width="20" height="4.5" rx="1" fill="#e0aa66" stroke="#8a5a2b"/><rect x="2" y="9.8" width="20" height="4.5" rx="1" fill="#d39a55" stroke="#8a5a2b"/><rect x="2" y="15.6" width="20" height="4.5" rx="1" fill="#e0aa66" stroke="#8a5a2b"/>',
    grain: '<path d="M12 22V9M12 14l-4-3M12 14l4-3M12 18l-4-3M12 18l4-3" stroke="#a7802a" stroke-width="1.6" fill="none"/><ellipse cx="12" cy="6" rx="2.2" ry="4" fill="#e8c14f" stroke="#a7802a"/><ellipse cx="7.5" cy="10" rx="1.8" ry="3" fill="#e8c14f" stroke="#a7802a" transform="rotate(-35 7.5 10)"/><ellipse cx="16.5" cy="10" rx="1.8" ry="3" fill="#e8c14f" stroke="#a7802a" transform="rotate(35 16.5 10)"/>',
    flour: '<path d="M7 7Q12 3 17 7L19.5 19Q12 22.5 4.5 19Z" fill="#f4ecdb" stroke="#a89474" stroke-width="1.2"/><path d="M8 7.5Q12 9.5 16 7.5" stroke="#a89474" fill="none"/><circle cx="12" cy="14" r="2.5" fill="none" stroke="#d1bd94"/>',
    bread: '<ellipse cx="12" cy="14" rx="9.5" ry="6" fill="#d08b3e" stroke="#8a5223" stroke-width="1.2"/><path d="M7.5 11.5l2.5 3M11.5 10.5l2.5 3M15.5 11.5l2.5 3" stroke="#f6cd88" stroke-width="1.6" stroke-linecap="round"/>',
    fish: '<path d="M2.5 12Q10 4.5 17 12Q10 19.5 2.5 12Z" fill="#79b3df" stroke="#2f5f8a" stroke-width="1.2"/><path d="M17 12l5-4.5v9Z" fill="#5f9bc9" stroke="#2f5f8a"/><circle cx="6.5" cy="11" r="1.1" fill="#12263a"/>',
    grape: '<path d="M12 5Q14 2 18 3" stroke="#5a7a2a" stroke-width="1.5" fill="none"/><path d="M13 4q5-1 6 3q-4 1-6-3z" fill="#7aa83a"/><g fill="#7b3f8f" stroke="#4a1f5a" stroke-width=".8"><circle cx="9" cy="8" r="2.4"/><circle cx="14" cy="8" r="2.4"/><circle cx="11.5" cy="11.5" r="2.4"/><circle cx="7" cy="12" r="2.2"/><circle cx="16" cy="12" r="2.2"/><circle cx="9.5" cy="15.5" r="2.2"/><circle cx="14" cy="15.5" r="2.2"/><circle cx="11.7" cy="19" r="2"/></g>',
    wine: '<path d="M10 2h4v5q4 2 4 7v7q0 1-1 1H7q-1 0-1-1v-7q0-5 4-7z" fill="#7b1e3a" stroke="#3d0d1c" stroke-width="1.2"/><rect x="7.5" y="12.5" width="9" height="5" rx="1" fill="#f0e2c0"/><rect x="10" y="1.5" width="4" height="2" fill="#c9a46a"/>',
    meat: '<path d="M14.5 3.5Q21 5 20.5 11.5Q19.5 17 13 17.5L9.5 17Q6.5 16.5 6 13.5Q5.8 9 9.5 6Q12 3.5 14.5 3.5Z" fill="#c8553f" stroke="#7a2a1c" stroke-width="1.2"/><path d="M9.5 8.5Q12 6.5 15.5 7.5" stroke="#f2b8a0" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M8.5 16.5 4 21" stroke="#f3ead6" stroke-width="3" stroke-linecap="round"/><circle cx="3.6" cy="20.6" r="1.9" fill="#f3ead6" stroke="#b8ab8e" stroke-width=".8"/><circle cx="5.6" cy="22" r="1.5" fill="#f3ead6" stroke="#b8ab8e" stroke-width=".8"/>',
    coal: '<path d="M3 17 5.5 10 11 7.5 15 9.5 13.5 17 8 19.5Z" fill="#2b2b30" stroke="#0e0e12" stroke-width="1.1"/><path d="M12.5 17 15 9 20 8.5 21.5 15 17.5 19.5Z" fill="#3a3a40" stroke="#0e0e12" stroke-width="1.1"/><path d="M6.5 11 9.5 9.5M16 10.5 19 10" stroke="#8d93a3" stroke-width="1.1" stroke-linecap="round"/>',
    ironore: '<path d="M3 16.5 5.5 8.5 12 5 19 7.5 21.5 15 15.5 20 7.5 20Z" fill="#6e5a4c" stroke="#3a2a20" stroke-width="1.2"/><path d="M6.5 10.5Q10 13 12.5 11.5T18.5 12.5M8 16.5Q11.5 15 14.5 17" stroke="#c0612f" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    copperore: '<path d="M3 16.5 5.5 8.5 12 5 19 7.5 21.5 15 15.5 20 7.5 20Z" fill="#8a6a50" stroke="#4a3424" stroke-width="1.2"/><circle cx="9" cy="11" r="2" fill="#3fae94"/><circle cx="14.5" cy="9.5" r="1.4" fill="#58c9c0"/><circle cx="15" cy="15" r="2.1" fill="#3fae94"/><circle cx="9.5" cy="16.5" r="1.2" fill="#58c9c0"/>',
    goldore: '<path d="M3 16.5 5.5 8.5 12 5 19 7.5 21.5 15 15.5 20 7.5 20Z" fill="#8f8a82" stroke="#4e4a44" stroke-width="1.2"/><path d="M6.5 11.5 10 10 12 13 16.5 11M9 16.5 12.5 15.5 15 17.5" stroke="#f2c443" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="14.5" r="1.1" fill="#ffe27a"/>',
    ironbar: '<path d="M2.5 17.5 6 11.5H18L21.5 17.5Z" fill="#8f979f" stroke="#454b52" stroke-width="1.2" stroke-linejoin="round"/><path d="M6 11.5 8.5 6.5H20L18 11.5" fill="#b3bac1" stroke="#454b52" stroke-width="1.2" stroke-linejoin="round"/><path d="M8 14.5H15" stroke="#d8dde2" stroke-width="1.2" stroke-linecap="round"/>',
    copperbar: '<path d="M2.5 17.5 6 11.5H18L21.5 17.5Z" fill="#c4703e" stroke="#6e3418" stroke-width="1.2" stroke-linejoin="round"/><path d="M6 11.5 8.5 6.5H20L18 11.5" fill="#e0905a" stroke="#6e3418" stroke-width="1.2" stroke-linejoin="round"/><path d="M8 14.5H15" stroke="#f6c39a" stroke-width="1.2" stroke-linecap="round"/>',
    goldbar: '<path d="M2.5 17.5 6 11.5H18L21.5 17.5Z" fill="#e8b73a" stroke="#8a6410" stroke-width="1.2" stroke-linejoin="round"/><path d="M6 11.5 8.5 6.5H20L18 11.5" fill="#f7d460" stroke="#8a6410" stroke-width="1.2" stroke-linejoin="round"/><path d="M8 14.5H15" stroke="#fff1b0" stroke-width="1.2" stroke-linecap="round"/><path d="M19.5 3.5v3M18 5h3" stroke="#fff1b0" stroke-width="1.1" stroke-linecap="round"/>',
    sword: '<path d="M18.5 2.5 21.5 5.5 9 18 6 15Z" fill="#d6dce2" stroke="#56606a" stroke-width="1.1" stroke-linejoin="round"/><path d="M4 13.5 10.5 20" stroke="#7e868e" stroke-width="2.4" stroke-linecap="round"/><path d="M5.5 18.5 3 21" stroke="#5a3a24" stroke-width="2.4" stroke-linecap="round"/><circle cx="2.8" cy="21.2" r="1.3" fill="#d9a93a"/>',
    spear: '<path d="M4 20 16.5 7.5" stroke="#a0703f" stroke-width="2" stroke-linecap="round"/><path d="M15 6 21.5 2.5 18 9Z" fill="#d6dce2" stroke="#56606a" stroke-width="1.1" stroke-linejoin="round"/><path d="M14.5 9.5 16.5 7.5" stroke="#7e868e" stroke-width="2.6"/>',
    battleaxe: '<path d="M5 21 17 6" stroke="#a0703f" stroke-width="2.2" stroke-linecap="round"/><path d="M13.5 3.5Q10 7 12.5 10.5L16 7Q19 9 21.5 6.5Q20 3 16.5 3.5Z" fill="#d6dce2" stroke="#56606a" stroke-width="1.1" stroke-linejoin="round"/>',
    dagger: '<path d="M17 4.5 19.5 7 11 15.5 8.5 13Z" fill="#d6dce2" stroke="#56606a" stroke-width="1.1" stroke-linejoin="round"/><path d="M7 12 12 17" stroke="#7e868e" stroke-width="2.2" stroke-linecap="round"/><path d="M8.5 15.5 5.5 18.5" stroke="#5a3a24" stroke-width="2.4" stroke-linecap="round"/><circle cx="5" cy="19" r="1.2" fill="#d9a93a"/>',
    bow: '<path d="M6 3Q19 12 6 21" fill="none" stroke="#8e5e30" stroke-width="2.4" stroke-linecap="round"/><path d="M6 3V21" stroke="#ede3c8" stroke-width="1"/><path d="M4 12H19" stroke="#a0703f" stroke-width="1.3"/><path d="M19 12 16.5 10.5V13.5Z" fill="#7e868e"/>',
    crossbow: '<path d="M12 4V21" stroke="#8e5e30" stroke-width="3" stroke-linecap="round"/><path d="M3 9Q12 3 21 9" fill="none" stroke="#7e868e" stroke-width="2.2" stroke-linecap="round"/><path d="M3 9 12 12 21 9" fill="none" stroke="#ede3c8" stroke-width="1"/><path d="M12 2.5V7" stroke="#56606a" stroke-width="1.4"/>',
    gold: '<circle cx="12" cy="12" r="9.5" fill="#f2c443" stroke="#a8781a" stroke-width="1.5"/><circle cx="12" cy="12" r="6.5" fill="#f7d460" stroke="#d9a22a"/><path d="M8.5 14.5h7l1-5-3 2-2-3-2 3-3-2z" fill="#c8901f"/>',
    pop: '<circle cx="12" cy="7" r="4" fill="#f1c9a0" stroke="#8a5a3a"/><path d="M4 21q0-8 8-8t8 8z" fill="#5d8a3a" stroke="#355a1f"/>'
  };
  VE.icon = function (k, size) {
    size = size || 20;
    return '<svg class="ico" width="' + size + '" height="' + size + '" viewBox="0 0 24 24">' + (VE.ICONS[k] || '') + '</svg>';
  };
})(window.VE);
