/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Zachte wereldrand: geen harde afsnijding, geen lege vlakken, ook niet helemaal uitgezoomd.

   - Buitenland: een terreinring rond de kaart (niet speelbaar). Aan de rand sluit hij precies aan op de
     hoogtes van de kaart; verder weg gaat hij over in heuvels en een bergkam aan de horizon. De kleuren
     (gras, bos, rots) vervagen naar de nevelkleur van de lucht.
   - Bomen in de verte: zelfde Blender-bomen als op de kaart (InstancedMesh met chunks, alleen wat in beeld is).
   - Water loopt door: een tweede waterlaag onder het buitenland, dus rivieren en meren aan de rand stoppen
     niet abrupt.
   - Randmist: een driftende, wolkige nevellaag die vanaf de rand dichter wordt (zelfde soort shader als de
     mist boven onontdekt land) en het buitenland in de verte helemaal laat opgaan in de lucht.
   Alles is statisch (één keer opgebouwd per wereld) en kost per frame alleen de shader van de mist. */
'use strict';
(function (VE) {
  const HAZE = new THREE.Color(0xcfe0e2);               // = scene.fog in main.js
  const M = 64;
  const DIM = new THREE.Color(0x6f7d74);                                        // breedte van het buitenland (tegels)

  function build(game) {
    const w = game.world, N = VE.N, root = game.root;
    const n = VE.noise(w.seed + 911), n2 = VE.noise(w.seed + 1913);
    const S = 2, lo = -M, hi = N + M, cnt = (hi - lo) / S + 1;
    const edgeH = (x, z) => w.heightAt(VE.clamp(x, 0, N), VE.clamp(z, 0, N));
    const out = (x, z) => Math.max(0, -x, -z, x - N, z - N);           // afstand buiten de kaart (0 = op of in de kaart)
    const pos = [], col = [], idx = [], parts = {}, vid = new Int32Array(cnt * cnt).fill(-1);
    const g1 = new THREE.Color(0x6aa53c), g2 = new THREE.Color(0x4a8732), rock = new THREE.Color(0x9e988c), c = new THREE.Color();
    const hAt = (x, z) => {
      const d = out(x, z), e = n.fbm(x * 0.03, z * 0.03, 4);
      const far = 0.9 + (e - 0.45) * 3 + Math.max(0, n2.fbm(x * 0.02, z * 0.02, 3) - 0.45) * 9 * VE.smooth(18, 48, d);   // heuvels, verderop bergen
      return VE.lerp(edgeH(x, z), far, VE.smooth(0, 14, d));
    };
    // hoekpunten (alleen waar een cel buiten de kaart ligt)
    for (let j = 0; j < cnt; j++) for (let i = 0; i < cnt; i++) {
      const x = lo + i * S, z = lo + j * S;
      if (out(x, z) <= 0 && x > 0 && z > 0 && x < N && z < N) continue;
      const d = out(x, z), h = hAt(x, z);
      vid[j * cnt + i] = pos.length / 3;
      pos.push(x, h, z);
      const f = n.fbm(x * 0.06 + 7, z * 0.06, 3);
      c.copy(g1).lerp(g2, VE.smooth(0.45, 0.62, f)).lerp(rock, VE.smooth(3, 6, h));
      c.lerp(DIM, 0.28).multiplyScalar(0.78);                                  // zoals niet-eigen land op de kaart (World.recolor)
      c.lerp(HAZE, VE.smooth(4, 44, d));                                     // vervagen in de nevel
      col.push(c.r, c.g, c.b);
    }
    for (let j = 0; j < cnt - 1; j++) for (let i = 0; i < cnt - 1; i++) {
      const x = lo + i * S, z = lo + j * S;
      if (x >= 0 && z >= 0 && x + S <= N && z + S <= N) continue;           // cel helemaal binnen de kaart
      const a = vid[j * cnt + i], b = vid[j * cnt + i + 1], cc = vid[(j + 1) * cnt + i], d = vid[(j + 1) * cnt + i + 1];
      if (a < 0 || b < 0 || cc < 0 || d < 0) continue;
      idx.push(a, cc, d, a, d, b);
      const key = Math.floor((x - lo) / 48) * 100 + Math.floor((z - lo) / 48);              // vak van 48 × 48 tegels
      (parts[key] || (parts[key] = [])).push(a, cc, d, a, d, b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
    // getekend in vakken (alleen wat in beeld is); de hele ring blijft als bron (normalen, gegevens)
    const lmat = new THREE.MeshLambertMaterial({ vertexColors: true }), lands = [];
    const land = new THREE.Mesh(geo, lmat); land.name = 'horizonLand'; land.visible = false; root.add(land);
    for (const key in parts) {
      const cg = new THREE.BufferGeometry();
      for (const a of ['position', 'color', 'normal']) cg.setAttribute(a, geo.attributes[a]);
      cg.setIndex(parts[key]);
      const P = geo.attributes.position, L = parts[key], bb = new THREE.Box3();
      for (const v of L) bb.expandByPoint(new THREE.Vector3(P.getX(v), P.getY(v), P.getZ(v)));
      cg.boundingSphere = bb.getBoundingSphere(new THREE.Sphere());
      const cm = new THREE.Mesh(cg, lmat); cm.receiveShadow = true; cm.name = 'horizonLandChunk'; root.add(cm); lands.push(cm);
    }
    // water dat doorloopt (net onder het kaartwater, zodat ze niet door elkaar flikkeren)
    const wg = new THREE.PlaneGeometry(N + 2 * M, N + 2 * M, 1, 1); wg.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(wg, new THREE.MeshPhongMaterial({ color: 0x2f7aa8, specular: 0x3a5468, shininess: 24, transparent: true, opacity: 0.9 }));
    water.position.set(N / 2, -0.03, N / 2); water.name = 'horizonWater';
    root.add(water);
    // bomen in de verte (zelfde soorten, alleen in het buitenland, dichter bij de rand)
    const trees = [];
    if (VE.natureGeo && VE.Instancer) {
      const rnd = VE.rng((w.seed ^ 0x51a7) >>> 0), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
      for (const [name, share] of [['tree_pine', 0.35], ['tree_oak', 0.3], ['tree_spruce', 0.2], ['tree_birch', 0.15]]) {
        const geo2 = VE.natureGeo[name]; if (!geo2) continue;
        const cap = Math.round((N + M) * 4 * 9 * share * (VE.isMobile ? 0.5 : 1));
        const mesh = new THREE.InstancedMesh(geo2, VE.windMat({}, { amp: 0.03, flutter: 0.003, base: 0.12, pow: 1.5 }, 'hz_' + name), cap);
        mesh.setColorAt(0, new THREE.Color(1, 1, 1)); mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
        mesh.name = 'horizonTrees'; root.add(mesh);
        const inst = new VE.Instancer(mesh, cap, 0.9);
        let k = 0;
        for (let t = 0; t < cap * 6 && k < cap; t++) {
          const x = lo + rnd() * (hi - lo), z = lo + rnd() * (hi - lo), d = out(x, z);
          if (d < 0.8 || d > 40 || rnd() > VE.smooth(40, 6, d)) continue;
          if (n.fbm(x * 0.06 + 7, z * 0.06, 3) < 0.47 && rnd() < 0.75) continue;   // bosjes, geen egaal tapijt
          const h = hAt(x, z); if (h < 0.15 || h > 5) continue;
          const s = 0.8 + rnd() * 0.5;
          q.setFromAxisAngle(UP, rnd() * 6.28);
          m.compose(p.set(x, h - 0.03, z), q, sc.set(s, s, s));
          inst.set(k, m);
          const t2 = 0.82 + VE.smooth(4, 40, d) * 0.25; inst.color(k, new THREE.Color(t2, t2 * 1.02, t2 * 1.03));
          k++;
        }
        trees.push(inst);
      }
    }
    // randmist: wolkige nevel die vanaf de rand dichter wordt
    const mg = new THREE.PlaneGeometry(N + 2 * M, N + 2 * M, 1, 1); mg.rotateX(-Math.PI / 2);
    const mist = new THREE.Mesh(mg, new THREE.ShaderMaterial({
      uniforms: { uTime: VE.uTime, uN: { value: N }, uCol: { value: HAZE } },
      transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vP; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xz; gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: [
        'uniform float uTime; uniform float uN; uniform vec3 uCol; varying vec2 vP;',
        'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        'float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
        '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }',
        'void main() {',
        '  vec2 o = max(vec2(0.0), max(-vP, vP - vec2(uN)));',
        '  float d = length(o);',                                                       // afstand buiten de kaart
        '  vec2 q = vP * 0.06 + vec2(uTime * 0.02, uTime * 0.011);',
        '  float nz = noise(q) * 0.6 + noise(q * 2.3 - vec2(uTime * 0.015, 0.0)) * 0.4;',
        '  float a = smoothstep(-3.0, 22.0, d + (nz - 0.5) * 12.0);',
        '  gl_FragColor = vec4(mix(uCol * 0.97, vec3(1.0), nz * 0.25), a * 0.97);',
        '}'
      ].join('\n')
    }));
    mist.position.set(N / 2, 3.2, N / 2); mist.renderOrder = 9; mist.frustumCulled = false; mist.name = 'horizonMist';
    root.add(mist);
    // de oude rand (bruine wand en donkere bodemplaat) is niet meer nodig
    if (w.skirt) w.skirt.visible = false;
    root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry' && o.material && o.material.color && o.material.color.getHex() === 0x2a1d12) o.visible = false; });
    w.horizon = { land: land, lands: lands, water: water, mist: mist, trees: trees };
  }

  /* koppelen: na het maken van een wereld; de bomen in de verte gaan mee in de zichtbaarheidsronde */
  const G = VE.Game.prototype, init0 = G.init;
  G.init = function (save) { init0.call(this, save); try { build(this); } catch (e) { console.warn('[Village Empire] horizon', e); } };
  const sync0 = VE.natureSync;
  if (sync0) {
    VE.natureSync = function (g, camera) {
      sync0(g, camera);
      const H = g.world && g.world.horizon; if (!H || !H.trees.length) return;
      if (!H.fr) H.fr = new THREE.Frustum();
      const e = camera.matrixWorld.elements, key = Math.round(e[12] * 2) + ',' + Math.round(e[14] * 2) + ',' + Math.round(e[13] * 2) + ',' + Math.round(e[8] * 30) + ',' + Math.round(e[10] * 30);
      if (key === H.key) return;
      H.key = key;
      H.fr.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      for (const it of H.trees) it.sync(H.fr, 1.6);
    };
  }
  VE.buildHorizon = build;
})(window.VE);
