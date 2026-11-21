/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Natuur uit Blender (public/models/nature.glb): boomsoorten, struiken, gras, bloemen, details.

   Elke node wordt één vertex-gekleurde geometrie (zelfde bakproces als de gebouwen) met een extra
   attribuut aWind (0 = staat stil, 1 = beweegt volledig mee). Dat gewicht komt uit de materiaalnaam:
   bladeren, naalden, bloesem, vruchten, gras en bloemen bewegen; stammen, stenen en hout niet.
   De wereld tekent elke soort als één InstancedMesh → het aantal draw calls hangt af van het aantal
   soorten, niet van het aantal bomen of grasplukken.

   Wind: één gedeelde shader-uitbreiding (VE.windMat) met globale tijd en windstoten die als golven
   over de wereld trekken. Geen AnimationMixers, geen physics; kost alleen een paar vertex-instructies.

   Fallback: laadt de GLB niet (of ?oldnature in de URL), dan blijven de oorspronkelijke procedurele
   bomen en graspolletjes in gebruik (VE.natureGeo blijft null). */
'use strict';
(function (VE) {
  const URL = 'public/models/nature.glb' + (VE.VERSION ? '?v=' + VE.VERSION : '');
  VE.natureGeo = null;
  VE.natureSource = 'loading';

  // windgewicht per materiaal (naam vóór de '@'); onbekend = 0 (staat stil)
  const WIND = [[/^(Leaf|Blossom|Fruit|Berry|FlBush)/, 1], [/^Needle/, 0.75], [/^Twig/, 0.4],
    [/^(Grass|Seed|Fl|Petal)/, 1]];
  // deze nodes bewegen in hun geheel (de hoogte boven de grond bepaalt hoeveel)
  const WHOLE = /^(bush_|hedge|grass_|weed|fl_)/;

  function windWeights(node, whole) {
    const out = [];
    node.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count;
      const mat = (Array.isArray(o.material) ? o.material[0] : o.material) || {};
      const name = (mat.name || '').split('@')[0];
      let w = whole ? 1 : 0;
      if (!whole) for (const [re, v] of WIND) if (re.test(name)) { w = v; break; }
      out.push([n, w]);
    });
    return out;
  }

  function prepare(gltf) {
    const geos = {};
    let seed = 700;
    for (const node of gltf.scene.children) {
      if (!node.name) continue;
      const geo = VE.bakeGlbNode(node, seed++);
      if (!geo) continue;
      const parts = windWeights(node, WHOLE.test(node.name));
      const n = geo.attributes.position.count, wa = new Float32Array(n);
      let o = 0;
      for (const [cnt, w] of parts) { wa.fill(w, o, Math.min(n, o + cnt)); o += cnt; }
      geo.setAttribute('aWind', new THREE.BufferAttribute(wa, 1));
      geos[node.name] = geo;
    }
    return geos;
  }

  /* Gedeelde wind-shader. cfg: amp (zwaai, per eenheid hoogte), flutter (trillen van bladeren),
     base (hoogte waaronder niets beweegt), pow (buigcurve: 1 = recht, 2 = top buigt het meest).
     Alleen hoekpunten met aWind > 0 bewegen; de stam blijft staan. */
  VE.uGust = { value: 1 };
  VE.windMat = function (opts, cfg, key) {
    const m = new THREE.MeshPhongMaterial(Object.assign({ shininess: 4, specular: 0x111111, vertexColors: true }, opts));
    const amp = cfg.amp.toFixed(4), fl = (cfg.flutter || 0).toFixed(4), base = (cfg.base || 0).toFixed(3), pw = (cfg.pow || 1.5).toFixed(2);
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uTime = VE.uTime; sh.uniforms.uGust = VE.uGust;
      sh.vertexShader = 'uniform float uTime;\nuniform float uGust;\nattribute float aWind;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n' +
        ' vec3 ipos = vec3(0.0);\n' +
        ' #ifdef USE_INSTANCING\n ipos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);\n #endif\n' +
        ' float wh = pow(max(position.y - ' + base + ', 0.0), ' + pw + ') * aWind;\n' +
        // trage windstoten die als golven over het land trekken + per plant een eigen fase
        ' float gust = uGust * (0.55 + 0.45 * sin(uTime * 0.42 - ipos.x * 0.11 - ipos.z * 0.07));\n' +
        ' float sw = sin(uTime * 1.55 + ipos.x * 0.9 + ipos.z * 0.7) * 0.6 + 0.4;\n' +
        ' float fl = sin(uTime * 6.3 + position.x * 37.0 + position.z * 29.0 + ipos.x * 3.1) * ' + fl + ';\n' +
        ' transformed.x += (sw * ' + amp + ' * gust + fl) * wh;\n' +
        ' transformed.z += (cos(uTime * 1.21 + ipos.x * 0.6 + ipos.z * 1.1) * ' + amp + ' * 0.45 * gust + fl * 0.6) * wh;\n');
    };
    m.customProgramCacheKey = function () { return 'wind_' + key + '_' + amp + '_' + fl + '_' + base + '_' + pw; };
    return m;
  };

  const off = /[?&]oldnature\b/.test(location.search) || window.VE_OLD_NATURE;
  const load = off ? Promise.resolve().then(() => { VE.natureSource = 'procedural'; })
    : (VE.loadGlb ? VE.loadGlb(URL) : Promise.reject(new Error('GLTFLoader niet beschikbaar')))
      .then(gltf => { VE.natureGeo = prepare(gltf); VE.natureSource = 'glb'; })
      .catch(e => {
        VE.natureSource = 'procedural';
        console.warn('[Village Empire] natuur: GLB niet geladen, oorspronkelijke bomen en gras worden gebruikt.', e && e.message || e);
      });
  const prev = VE.glbReady || Promise.resolve();
  VE.glbReady = Promise.race([Promise.all([prev, load]), new Promise(r => setTimeout(r, 10000))]);
})(window.VE);
