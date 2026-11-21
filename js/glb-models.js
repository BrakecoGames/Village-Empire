/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Gebouwen uit Blender (GLB) die de procedurele modellen uit models.js vervangen.

   Een GLB wordt bij het laden omgezet naar exact hetzelfde formaat als de procedurele
   modellen: één niet-geïndexeerde BufferGeometry met position/normal/color, getekend met
   het gedeelde materiaal `game.mats.building`. Daardoor blijven plaatsen, selecteren
   (raycast op b.mesh), bouwsteiger (mesh.scale.y), upgrades en opslaan ongewijzigd werken,
   en delen alle exemplaren van een gebouw één geometrie (1 draw call per gebouw).

   Mislukt het laden (geen GLTFLoader, netwerkfout, ontbrekende node), dan blijft het
   procedurele model gewoon in gebruik.

   Materiaalnamen "Naam@0.07": het getal is de kleurvariatie per driehoek, net als `j`
   bij de procedurele modellen. Kleuren in de GLB zijn lineair en worden terug naar sRGB
   omgezet, zodat ze overeenkomen met de hex-kleuren in de rest van de game. */
'use strict';
(function (VE) {
  /* Welke gebouwen uit een GLB komen. levels: game-level -> node-naam in de GLB.
     smoke: node met dezelfde naam + '_smoke' markeert de top van de schoorsteen. */
  const SOURCES = {
    house: { url: 'public/models/house.glb', levels: { 1: 'house_l1', 2: 'house_l2', 3: 'house_l3' } }
  };
  const TIMEOUT_MS = 10000;

  VE.modelSource = {};
  for (const t in SOURCES) {
    VE.modelSource[t] = 'loading';
    for (const l in SOURCES[t].levels) VE.modelSource[t + '_' + l] = 'procedural';
  }

  const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _c = new THREE.Color(), _v = new THREE.Vector3();

  /** Zet een GLB-node (met submeshes/materialen) om naar één vertex-gekleurde geometrie. */
  function bakeNode(node, seed) {
    const rnd = VE.rng(seed);
    node.updateMatrixWorld(true);
    _inv.copy(node.matrixWorld).invert();
    const parts = [];
    let count = 0;
    node.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      let g = o.geometry.clone();
      _m.multiplyMatrices(_inv, o.matrixWorld);
      g.applyMatrix4(_m);
      if (g.index) g = g.toNonIndexed();
      if (!g.attributes.normal) g.computeVertexNormals();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const mat = mats[0] || {};
      const name = mat.name || '';
      const at = name.lastIndexOf('@');
      const jit = at >= 0 ? parseFloat(name.slice(at + 1)) || 0 : 0.04;
      const col = mat.color ? mat.color.clone().convertLinearToSRGB() : new THREE.Color(0xcccccc);
      parts.push({ g: g, col: col, jit: jit });
      count += g.attributes.position.count;
    });
    if (!count) return null;
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), colA = new Float32Array(count * 3);
    let o = 0;
    for (const p of parts) {
      const n = p.g.attributes.position.count;
      pos.set(p.g.attributes.position.array, o * 3);
      nor.set(p.g.attributes.normal.array, o * 3);
      for (let v = 0; v < n; v += 3) {
        const f = 1 + (rnd() * 2 - 1) * p.jit;
        _c.setRGB(Math.min(1, p.col.r * f), Math.min(1, p.col.g * f), Math.min(1, p.col.b * f));
        for (let q = 0; q < 3 && v + q < n; q++) { const i = (o + v + q) * 3; colA[i] = _c.r; colA[i + 1] = _c.g; colA[i + 2] = _c.b; }
      }
      o += n;
      p.g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colA, 3));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }

  function loadGlb(url) {
    return new Promise((resolve, reject) => {
      if (!THREE.GLTFLoader) { reject(new Error('GLTFLoader niet beschikbaar')); return; }
      new THREE.GLTFLoader().load(url, resolve, undefined, reject);
    });
  }

  /** Gebouwen die al met het procedurele model in de wereld staan, opnieuw opbouwen. */
  function refreshExisting(type) {
    const g = VE.game;
    if (g && g.buildings) for (const b of g.buildings) if (b.alive && b.type === type) g.makeMesh(b);
    const ui = VE.ui;
    if (ui && ui.ghostType === type && ui.setGhost) ui.setGhost(type);
  }

  async function loadType(type) {
    const src = SOURCES[type];
    try {
      const gltf = await loadGlb(src.url);
      const baked = {};
      for (const lvl in src.levels) {
        const node = gltf.scene.getObjectByName(src.levels[lvl]);
        if (!node) throw new Error('node ' + src.levels[lvl] + ' ontbreekt in ' + src.url);
        const geo = bakeNode(node, type.length * 31 + +lvl);
        if (!geo) throw new Error('node ' + src.levels[lvl] + ' bevat geen meshes');
        const chimneys = [];
        const smoke = gltf.scene.getObjectByName(src.levels[lvl] + '_smoke');
        if (smoke) { smoke.getWorldPosition(_v); chimneys.push([_v.x, _v.y, _v.z]); }
        baked[lvl] = { geo: geo, anims: [], chimneys: chimneys };
      }
      // pas vervangen als alle levels gelukt zijn: nooit een half GLB / half procedureel gebouw
      for (const lvl in baked) {
        const key = type + '_' + lvl;
        const old = VE.modelCache[key];
        VE.modelCache[key] = baked[lvl];
        VE.modelSource[key] = 'glb';
        if (old && old.geo && old.geo !== baked[lvl].geo) refreshExisting(type);
      }
      VE.modelSource[type] = 'glb';
      gltf.scene.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } });
    } catch (e) {
      VE.modelSource[type] = 'procedural';
      console.warn('[Village Empire] ' + type + ': GLB niet geladen, oorspronkelijk model wordt gebruikt.', e && e.message || e);
    }
  }

  /* Laden start direct bij het inladen van dit script (parallel aan de rest van het opstarten).
     VE.glbReady resolvet altijd (ook bij fouten of na de time-out). */
  const all = Promise.all(Object.keys(SOURCES).map(loadType));
  VE.glbReady = Promise.race([all, new Promise(r => setTimeout(r, TIMEOUT_MS))]);
})(window.VE);
