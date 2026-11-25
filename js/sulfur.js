/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Zwavelafzettingen rond de vulkaan: zichtbaar in de wereld (Blender, public/models/sulfur.glb).

   Elke zwavelplek (VE.Mining, soort 6) toont een gele kristalkorst tussen donkere vulkanische rotsen, in drie
   varianten (nodes sulfur_dep0..2). De grootte volgt de voorraad: een volle plek is een flinke gele korst, een
   lege plek is alleen nog een kale, zwartgeblakerde opening; als de zwavel terugkomt, groeit de korst weer.
   Rijke velden (tussen twee spelers in) dampen zichtbaar.
   Eén InstancedMesh per variant; alleen ontdekt land; bijwerken alleen als er iets verandert. */
'use strict';
(function (VE) {
  const URL = 'public/models/sulfur.glb' + (VE.VERSION ? '?v=' + VE.VERSION : '');
  const GEO = [null, null, null];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

  /* reserve (zonder GLB): gele brokjes tussen donkere stenen */
  function procGeo(v) {
    const m = new VE.Model(60 + v);
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + v; m.add(new THREE.DodecahedronGeometry(0.09, 0), 0x3e3834, { x: Math.cos(a) * 0.22, z: Math.sin(a) * 0.2, sy: 0.6, j: 0.06 }); }
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + v * 0.7, r = 0.05 + (i % 3) * 0.05; m.add(new THREE.OctahedronGeometry(0.045, 0), i % 2 ? 0xf2d73a : 0xe0b82a, { x: Math.cos(a) * r, y: 0.02, z: Math.sin(a) * r, sy: 0.8, j: 0.05 }); }
    return m.build();
  }
  const ready = (VE.loadGlb ? VE.loadGlb(URL) : Promise.reject(new Error('geen loader'))).then(gltf => {
    for (let v = 0; v < 3; v++) { const n = gltf.scene.getObjectByName('sulfur_dep' + v); if (n) GEO[v] = VE.bakeGlbNode(n, 610 + v); }
    VE.sulfurSource = GEO.every(Boolean) ? 'glb' : 'partial';
    if (VE.game && VE.game.sulfurR) VE.game.sulfurR.rebuild();
  }).catch(e => { VE.sulfurSource = 'procedural'; console.warn('[Village Empire] zwavel: GLB niet geladen, eenvoudige afzettingen.', e && e.message || e); });
  VE.sulfurReady = ready;

  class SulfurRender {
    constructor(game) { this.g = game; this.meshes = []; this.rebuild(); }
    rebuild() {
      const g = this.g, w = g.world;
      for (const m of this.meshes) g.root.remove(m);
      this.meshes = [];
      const deps = (w.deposits || []).filter(d => d.type === 6);
      if (!deps.length) return;
      for (let v = 0; v < 3; v++) {
        const geo = GEO[v] || procGeo(v);
        const m = new THREE.InstancedMesh(geo, g.mats.building, deps.length);
        m.count = 0; m.castShadow = false; m.receiveShadow = true; m.name = 'sulfurDeposits';
        g.root.add(m); this.meshes.push(m);
      }
      this.key = '';
      this.update(true);
    }
    update(force) {
      const g = this.g, w = g.world, M = VE.Mining;
      if (!this.meshes.length) return;
      if (!force && !(M && M.sulfurDirty) && !w.fogDirtyForSulfur) return;
      if (M) M.sulfurDirty = false; w.fogDirtyForSulfur = false;
      const n = [0, 0, 0];
      for (const d of w.deposits) {
        if (d.type !== 6 || w.explored[d.k] < 0.5) continue;
        const h = ((d.k * 2654435761) >>> 0), v = h % 3, f = d.max ? d.amount / d.max : 0;
        const sc = 0.32 + 0.68 * Math.sqrt(f);                         // leeg: alleen de kale opening
        _q.setFromAxisAngle(UP, ((h >>> 3) % 628) / 100);
        _m.compose(_p.set(d.x, w.heightAt(d.x, d.z) - 0.01, d.z), _q, _s.set(sc * 1.15, 0.45 + 0.55 * sc, sc * 1.15));
        this.meshes[v].setMatrixAt(n[v]++, _m);
      }
      for (let v = 0; v < 3; v++) { this.meshes[v].count = n[v]; this.meshes[v].instanceMatrix.needsUpdate = true; }
    }
    /* damp uit de rijke velden (alleen in beeld en dichtbij genoeg: goedkoop) */
    steam(dt) {
      const w = this.g.world; this.st = (this.st || 0) - dt;
      if (this.st > 0 || !w.sulfurFields) return;
      this.st = 0.9;
      for (const f of w.sulfurFields) {
        if (!f.rich || w.explored[f.k] < 0.5 || Math.random() > 0.5) continue;
        const d = w.ore[f.k]; if (!d || d.amount <= 0) continue;
        VE.bus.emit('smoke', { x: d.x + (Math.random() - 0.5) * 0.3, y: w.heightAt(d.x, d.z) + 0.08, z: d.z + (Math.random() - 0.5) * 0.3, kind: 'steam' });
      }
    }
  }
  VE.SulfurRender = SulfurRender;

  /* koppelen: na het maken van een wereld; elke update bijwerken als er iets veranderde (graven, terugkomen, ontdekken) */
  const G = VE.Game.prototype, init0 = G.init, update0 = G.update;
  G.init = function (save) { init0.call(this, save); try { this.sulfurR = new SulfurRender(this); } catch (e) { console.warn('[Village Empire] zwavel', e); } };
  G.update = function (dt) {
    update0.call(this, dt);
    const R = this.sulfurR; if (!R) return;
    // twee keer per seconde: ontdekt land en voorraden zijn dan bijgewerkt (een paar tientallen plekken: goedkoop)
    R.t = (R.t || 0) + dt;
    if (R.t >= 0.5) { R.t = 0; this.world.fogDirtyForSulfur = true; }
    R.update(false); R.steam(dt);
  };
})(window.VE);
