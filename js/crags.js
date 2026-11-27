/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Rotsformaties in de bergen en aan de kust (Blender: public/models/crags.glb, tools/blender/models/crags.py).

   Zoals Noorse kustbergen: groene hellingen waar grijs, gelaagd gesteente doorheen breekt.
   - steile bergtegels: gelaagde rotspartijen (outcrop) en puinwaaiers (scree);
   - toppen en kammen: rotskoppen (tor) en grillige richels (ridge);
   - overal in de bergen af en toe een groepje keien (boulders);
   - kustkliffen: steile klifwanden met grasrichels, met de voorkant naar zee (cliff); rotspilaren in zee: tor.
   Alleen decoratie: ze blokkeren niets. Ze staan nooit op een boom, rotsblok, gebouw, ingang of bijzondere
   plek; wordt er later iets gebouwd, dan verdwijnen de formaties op die tegels. Ze blijven onder de mistlaag
   (schaal begrensd op de hoogste kammen). Getekend als InstancedMesh per soort, in vakken (alleen wat in beeld is). */
'use strict';
(function (VE) {
  const URL = 'public/models/crags.glb' + (VE.VERSION ? '?v=' + VE.VERSION : '');
  const KINDS = ['tor', 'outcrop', 'ridge', 'boulders', 'scree', 'cliff'];
  const HEIGHT = { tor: 1.2, outcrop: 0.65, ridge: 0.6, boulders: 0.35, scree: 0.15, cliff: 1.1 };   // ongeveer, voor de mist
  const GEO = {};
  const ready = (VE.loadGlb ? VE.loadGlb(URL) : Promise.reject(new Error('geen loader'))).then(gltf => {
    for (const k of KINDS) { const n = gltf.scene.getObjectByName('crag_' + k); if (n) GEO[k] = VE.bakeGlbNode(n, 700 + k.length); }
    VE.cragSource = Object.keys(GEO).length === KINDS.length ? 'glb' : 'partial';
    const g = VE.game; if (g && g.world && !g.crags) { try { g.crags = build(g); } catch (e) { console.warn('[Village Empire] rotsen', e); } }
  }).catch(e => { VE.cragSource = 'none'; console.warn('[Village Empire] rotsformaties niet geladen', e && e.message || e); });
  VE.cragsReady = ready;

  /* waar komt wat: vaste uitkomst per wereld (eigen random-reeks, de rest van de wereld blijft gelijk) */
  function plan(w) {
    const N = VE.N, rnd = VE.rng((w.seed ^ 0x0c4a9517) >>> 0), out = [];
    const free = k => !w.tree[k] && !w.rock[k] && !w.bld[k] && !w.door[k] && !(w.lmk && w.lmk[k]) && !w.field[k];
    const top = w.fogTop || 99;
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const k = j * N + i, t = w.type[k], v = w.volc ? w.volc[k] : 0;
      if (!free(k)) continue;
      const h = w.tileH(i, j), s = w.slope(i, j);
      let kind = null, sc = 0.85 + rnd() * 0.35, yaw = rnd() * Math.PI * 2;
      if (t === 4 && v === 5) {
        if (rnd() < 0.62) {
          kind = 'cliff';
          // voorkant naar de laagste buurtegel (de zee)
          let lo = 1e9; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const hh = w.tileH(i + di, j + dj); if (hh < lo) { lo = hh; yaw = Math.atan2(di, dj); } }
          sc = 0.95 + rnd() * 0.4;
        }
      } else if (t === 2 && v === 5) {
        if (rnd() < 0.55) { kind = 'tor'; sc = 1.0 + rnd() * 0.5; }
      } else if (t === 2 && !v) {
        let peak = true; for (let dj = -1; dj <= 1 && peak; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && w.tileH(i + di, j + dj) > h + 0.02) { peak = false; break; }
        const m = w.mount[k], r = rnd();
        if (peak && m > 0.5 && h > 1.6) { if (r < 0.65) kind = r < 0.4 ? 'tor' : 'ridge'; }
        else if (s > 1.05) { if (r < 0.5) kind = r < 0.36 ? 'outcrop' : 'scree'; }
        else if (s > 0.6) { if (r < 0.2) kind = r < 0.09 ? 'outcrop' : r < 0.15 ? 'scree' : 'ridge'; }
        else if (r < 0.045) kind = 'boulders';
      } else if (t === 3 && w.island && w.sea && rnd() < 0.03) {
        let wet = false; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) if (w.inb(i + di, j + dj) && w.sea[(j + dj) * N + i + di]) wet = true;
        if (wet) { kind = 'boulders'; sc = 0.6 + rnd() * 0.4; }
      }
      if (!kind) continue;
      // nooit boven de mist (alleen de vulkaantop mag dat)
      const maxS = (top - 0.25 - h) / HEIGHT[kind];
      if (maxS < 0.45) continue;
      sc = Math.min(sc, maxS);
      out.push({ k: k, kind: kind, x: i + 0.5 + (rnd() - 0.5) * 0.2, z: j + 0.5 + (rnd() - 0.5) * 0.2, yaw: yaw, sc: sc, tint: 0.9 + rnd() * 0.18 });
    }
    return out;
  }

  function build(g) {
    const w = g.world; if (!w || VE.N <= 64 && !w.island) { /* kleine wereld: ook prima */ }
    if (!KINDS.every(k => GEO[k])) return null;
    const list = plan(w), by = {};
    for (const c of list) (by[c.kind] || (by[c.kind] = [])).push(c);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    const R = { list: list, inst: {}, byTile: new Map(), meshes: [] };
    for (const kind of KINDS) {
      const L = by[kind] || []; if (!L.length) continue;
      const mesh = new THREE.InstancedMesh(GEO[kind], mat, L.length);
      mesh.setColorAt(0, col.setRGB(1, 1, 1)); mesh.count = 0; mesh.frustumCulled = false;
      mesh.castShadow = !VE.isMobile; mesh.receiveShadow = true; mesh.name = 'crags_' + kind;
      g.root.add(mesh); R.meshes.push(mesh);
      const inst = new VE.Instancer(mesh, L.length, 1.2);
      L.forEach((c, n) => {
        q.setFromAxisAngle(UP, c.yaw);
        m4.compose(p.set(c.x, w.heightAt(c.x, c.z) - 0.04, c.z), q, s.set(c.sc, c.sc, c.sc));
        inst.set(n, m4); inst.color(n, col.setRGB(c.tint, c.tint, c.tint * 0.98));
        c.n = n; c.inst = inst; R.byTile.set(c.k, c);
      });
      R.inst[kind] = inst;
    }
    R.dirty = true;
    return R;
  }
  /* bouwen op een tegel: de rotsformatie daar verdwijnt */
  const ZERO = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1);
  function clearArea(g, i0, j0, i1, j1) {
    const R = g.crags; if (!R) return;
    const N = VE.N;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = R.byTile.get(j * N + i); if (!c) continue;
      c.inst.set(c.n, ZERO); R.byTile.delete(j * N + i); c.gone = true; R.dirty = true;
    }
  }
  VE.cragClear = clearArea;

  /* koppelen: na het maken van een wereld (of zodra het model binnen is), bij elk nieuw gebouw, en in de zichtbaarheidsronde */
  const G = VE.Game.prototype, init0 = G.init, place0 = G.placeBuilding;
  G.init = function (save) { init0.call(this, save); this.crags = null; try { this.crags = build(this); } catch (e) { console.warn('[Village Empire] rotsen', e); } };
  G.placeBuilding = function (t, i, j, done) {
    const b = place0.apply(this, arguments);
    if (b && this.crags) { const sz = (VE.DEFS[t] && VE.DEFS[t].size) || 1; clearArea(this, i - 1, j - 1, i + sz, j + sz + 1); }
    return b;
  };
  const sync0 = VE.natureSync;
  if (sync0) {
    VE.natureSync = function (g, camera) {
      sync0(g, camera);
      const R = g.crags; if (!R) return;
      if (!R.fr) R.fr = new THREE.Frustum();
      const e = camera.matrixWorld.elements, key = Math.round(e[12] * 2) + ',' + Math.round(e[14] * 2) + ',' + Math.round(e[13] * 2) + ',' + Math.round(e[8] * 30) + ',' + Math.round(e[10] * 30);
      if (key === R.key && !R.dirty) return;
      R.key = key; R.dirty = false;
      R.fr.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      for (const k in R.inst) R.inst[k].sync(R.fr, 1.4);
    };
  }
})(window.VE);
