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
  /* Welke gebouwen uit een GLB komen: public/models/<type>.glb met nodes <type>_l1..l<n>.
     Markers per level: <node>_smoke, _smoke2 … (rook) en <node>_anim_<soort> (anker voor de
     geanimeerde delen uit models.js: vlag, wieken, zaag).
     first: nodig bij de start (rang 0 en vaste gebouwen) — de rest laadt daarna op de achtergrond. */
  const TYPES = {
    hq: { levels: 1, first: true }, yard: { levels: 1, first: true },
    house: { first: true }, woodcutter: { first: true }, forester: { first: true }, quarry: { first: true }, sawmill: { first: true },
    farm: {}, windmill: {}, bakery: {}, fisher: {}, market: {}, tower: {},
    vineyard: {}, winery: {}, tavern: {}, warehouse: {}, monument: {},
    // jacht en mijnbouw. De vier mijnen delen één model (mine.glb, nodes mine_l1..l3); de ertsaders
    // in de rots en het bordje (materialen Vein/Vein2) krijgen per mijn de kleur van het erts
    hunter: {}, smelter: {},
    coalmine: { file: 'mine', node: 'mine', tint: { Vein: 0x26262b, Vein2: 0x6f7688 } },
    ironmine: { file: 'mine', node: 'mine', tint: { Vein: 0xb0582c, Vein2: 0x6e4a38 } },
    coppermine: { file: 'mine', node: 'mine', tint: { Vein: 0x3fae94, Vein2: 0x6fd6c4 } },
    goldmine: { file: 'mine', node: 'mine', tint: { Vein: 0xf2c443, Vein2: 0xffe58a } }
  };
  const SOURCES = {};
  for (const t in TYPES) {
    const n = TYPES[t].levels || 3, levels = {};
    for (let l = 1; l <= n; l++) levels[l] = (TYPES[t].node || t) + '_l' + l;
    // ?v=versie: na een nieuwe release haalt de browser de modellen opnieuw op (geen oude cache)
    SOURCES[t] = { url: 'public/models/' + (TYPES[t].file || t) + '.glb' + (VE.VERSION ? '?v=' + VE.VERSION : ''), levels: levels, first: !!TYPES[t].first };
  }
  const TIMEOUT_MS = 10000;
  /* Sterkte van de in Blender gebakken ambient occlusion (COLOR_0): 0 = uit, 1 = volledig. */
  const AO_STRENGTH = 0.6;
  /* AO staat per hoekpunt: grote vlakken met weinig hoekpunten (muren, torens, aarde, dakbeschot)
     zouden in hun geheel donker worden. Daarom krijgen driehoeken groter dan AO_MAX_AREA (m²)
     geen AO — kleine onderdelen (pannen, balken, keien, gras) wel. Gloeiende ramen nooit. */
  const AO_SKIP = /^(Glow|Plaster|Earth|RoofDeck)/;
  const AO_MAX_AREA = 0.004;
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();

  VE.modelSource = {};
  for (const t in SOURCES) {
    VE.modelSource[t] = 'loading';
    for (const l in SOURCES[t].levels) VE.modelSource[t + '_' + l] = 'procedural';
  }

  const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _c = new THREE.Color(), _v = new THREE.Vector3();

  /** Zet een GLB-node (met submeshes/materialen) om naar één vertex-gekleurde geometrie. */
  function bakeNode(node, seed, tint) {
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
      const base = at >= 0 ? name.slice(0, at) : name;
      if (tint && tint[base] !== undefined) col.setHex(tint[base]);       // variant (bijv. mijn per ertssoort)
      // gebakken AO (vertex-kleur) → per hoekpunt een helderheidsfactor; gloeiende ramen niet verdonkeren
      let ao = null;
      const ca = g.attributes.color;
      if (ca && AO_STRENGTH > 0 && !AO_SKIP.test(name)) {
        const arr = ca.array, isz = ca.itemSize;
        const div = ca.normalized ? (arr instanceof Uint8Array ? 255 : arr instanceof Uint16Array ? 65535 : 1) : 1;
        ao = new Float32Array(ca.count);
        for (let i = 0; i < ca.count; i++) {
          const lin = arr[i * isz] / div;                                   // lineair
          const s = lin <= 0.0031308 ? lin * 12.92 : 1.055 * Math.pow(lin, 1 / 2.4) - 0.055;  // → perceptueel
          ao[i] = 1 - AO_STRENGTH * (1 - Math.min(1, s * 1.15));            // licht opgetild: open vlakken blijven helder
        }
        // grote driehoeken: geen AO (zie AO_MAX_AREA)
        const pa = g.attributes.position.array;
        for (let v = 0; v + 2 < ca.count; v += 3) {
          _a.fromArray(pa, v * 3); _b.fromArray(pa, v * 3 + 3); _d.fromArray(pa, v * 3 + 6);
          _b.sub(_a); _d.sub(_a);
          if (_b.cross(_d).length() * 0.5 > AO_MAX_AREA) ao[v] = ao[v + 1] = ao[v + 2] = 1;
        }
      }
      parts.push({ g: g, col: col, jit: jit, ao: ao });
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
        for (let q = 0; q < 3 && v + q < n; q++) {
          const i = (o + v + q) * 3, a = p.ao ? p.ao[v + q] : 1;
          colA[i] = _c.r * a; colA[i + 1] = _c.g * a; colA[i + 2] = _c.b * a;
        }
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

  // gedeeld met settler-glb.js (personages): GLB-node → vertex-gekleurde geometrie, en het laden zelf
  VE.bakeGlbNode = (node, seed) => bakeNode(node, seed);
  VE.loadGlb = url => loadGlb(url);

  // één keer laden per bestand (meerdere gebouwtypes kunnen uit hetzelfde GLB komen)
  const glbCache = {};
  function loadGlb(url) {
    if (glbCache[url]) return glbCache[url];
    return (glbCache[url] = new Promise((resolve, reject) => {
      if (!THREE.GLTFLoader) { reject(new Error('GLTFLoader niet beschikbaar')); return; }
      new THREE.GLTFLoader().load(url, resolve, undefined, reject);
    }));
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
        const geo = bakeNode(node, type.length * 31 + +lvl, TYPES[type].tint);
        if (!geo) throw new Error('node ' + src.levels[lvl] + ' bevat geen meshes');
        // markers uitlezen: rookpunten en ankers voor animaties
        const chimneys = [], anchors = {}, pre = src.levels[lvl] + '_';
        let pile = null; const slots = [];
        gltf.scene.traverse(o => {
          if (!o.name || o.name.indexOf(pre) !== 0) return;
          const rest = o.name.slice(pre.length);
          o.getWorldPosition(_v);
          if (/^smoke\d*$/.test(rest)) chimneys.push([_v.x, _v.y, _v.z]);
          else if (rest.indexOf('anim_') === 0) anchors[rest.slice(5)] = [_v.x, _v.y, _v.z];
          else if (rest === 'pile') pile = [_v.x, _v.y, _v.z];          // plek voor de uitvoervoorraad
          else if (/^slot\d+$/.test(rest)) slots[+rest.slice(4)] = [_v.x, _v.y, _v.z];   // vakken van een opslag
        });
        // geanimeerde delen (vlag, wieken, zaag) blijven procedureel, op het anker uit het nieuwe model
        let anims = [];
        if (VE.buildProcedural) {
          const proc = VE.buildProcedural(type, +lvl);
          proc.geo.dispose();
          anims = proc.anims.map(a => {
            const p = anchors[a.kind];
            return p ? Object.assign({}, a, { x: p[0], y: p[1], z: p[2] }) : a;
          });
        }
        const sl = slots.filter(Boolean); sl.g = true;
        baked[lvl] = { geo: geo, anims: anims, chimneys: chimneys, pile: pile, slots: sl.length ? sl : null };
      }
      // pas vervangen als alle levels gelukt zijn: nooit een half GLB / half procedureel gebouw
      let replaced = false;
      for (const lvl in baked) {
        const key = type + '_' + lvl;
        const old = VE.modelCache[key];
        VE.modelCache[key] = baked[lvl];
        VE.modelSource[key] = 'glb';
        if (old && old.geo && old.geo !== baked[lvl].geo) replaced = true;
      }
      VE.modelSource[type] = 'glb';
      if (replaced) refreshExisting(type);
      if (!TYPES[type].file) gltf.scene.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } });
    } catch (e) {
      VE.modelSource[type] = 'procedural';
      console.warn('[Village Empire] ' + type + ': GLB niet geladen, oorspronkelijk model wordt gebruikt.', e && e.message || e);
    }
  }

  /* Goederen (items.glb, nodes item_<goed>): voor de voorraadstapels en de lading van dragers.
     Ontbreekt een node, dan blijft voor dat goed het procedurele model in gebruik. Komt het bestand pas
     binnen als de game al loopt, dan wisselen de renderers de geometrie (VE.itemGeoVer). */
  VE.itemGlb = {};
  VE.itemSource = 'loading';
  const procItem = VE.itemGeo;
  VE.itemGeo = res => VE.itemGlb[res] || procItem(res);
  const itemsDone = loadGlb('public/models/items.glb' + (VE.VERSION ? '?v=' + VE.VERSION : '')).then(gltf => {
    let n = 0;
    for (const r of VE.RES_ORDER) {
      const node = gltf.scene.getObjectByName('item_' + r);
      if (!node) continue;
      const geo = bakeNode(node, 900 + r.length * 7);
      if (geo) { VE.itemGlb[r] = geo; n++; }
    }
    VE.itemSource = n ? 'glb' : 'procedural';
    VE.itemGeoVer = (VE.itemGeoVer || 0) + 1;
  }).catch(e => { VE.itemSource = 'procedural'; console.warn('[Village Empire] items: GLB niet geladen, procedurele goederen.', e && e.message || e); });

  /* Laden start direct bij het inladen van dit script (parallel aan de rest van het opstarten).
     VE.glbReady resolvet altijd (ook bij fouten of na de time-out). */
  // Eerst de gebouwen die je bij de start ziet (opstarten wacht hierop, met time-out); de rest
  // daarna op de achtergrond — tot die binnen is, tonen die gebouwen hun procedurele model.
  const first = Object.keys(SOURCES).filter(t => SOURCES[t].first);
  const later = Object.keys(SOURCES).filter(t => !SOURCES[t].first);
  const firstDone = Promise.all(first.map(loadType).concat([itemsDone]));
  VE.glbReady = Promise.race([firstDone, new Promise(r => setTimeout(r, TIMEOUT_MS))]);
  VE.glbAllReady = firstDone.then(() => Promise.all(later.map(loadType)));
})(window.VE);
