/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Minimap: de hele wereld van bovenaf (terrein, water, bergen, vulkaan, canyon, bos, brug, gebouwen, territorium,
   mist), de ontdekte bijzondere plekken, soldaten en het camerabeeld. Tik of klik (of sleep) om de camera te
   verplaatsen. De achtergrond wordt maar af en toe opnieuw getekend (goedkoop: één pixel per tegel); het
   camerakader en de stipjes vier keer per seconde. Op mobiel klein, met een knop om hem in te klappen. */
'use strict';
(function (VE) {
  const $ = id => document.getElementById(id);
  const COL = {
    grass: [120, 173, 72], grass2: [140, 186, 84], forest: [62, 112, 46], water: [58, 127, 181], deep: [40, 96, 160], shore: [216, 200, 152],
    mount: [142, 135, 122], snow: [236, 236, 232], volc: [78, 70, 66], crater: [110, 52, 38], fiss: [88, 56, 44], cliff: [165, 112, 76], bridge: [150, 112, 70],
    bld: [246, 228, 190], fog: [196, 206, 216]
  };
  class Minimap {
    constructor(ui) {
      this.ui = ui;
      const wrap = document.createElement('div'); wrap.id = 'minimap'; wrap.className = 'panel';
      const cv = document.createElement('canvas'); wrap.appendChild(cv);
      const btn = document.createElement('button'); btn.id = 'mmToggle'; btn.className = 'round'; btn.title = 'Map'; btn.textContent = '🗺️';
      $('hud').appendChild(wrap); $('sideBtns').insertBefore(btn, $('btnSound'));
      this.wrap = wrap; this.cv = cv; this.ctx = cv.getContext('2d'); this.btn = btn;
      this.base = document.createElement('canvas'); this.bctx = this.base.getContext('2d');
      this.open = !(VE.touchUI && VE.touchUI());           // telefoon: standaard dicht (kaartknop rechts), anders open
      this.baseT = 0; this.drawT = 0; this.n = 0;
      btn.addEventListener('click', () => { this.open = !this.open; VE.audio.play('click'); this.layout(); });
      const go = e => {
        const r = cv.getBoundingClientRect(), g = VE.game; if (!g) return;
        const x = (e.clientX - r.left) / r.width * VE.N, z = (e.clientY - r.top) / r.height * VE.N;
        this.ui.view.cam.focus(VE.clamp(x, 1, VE.N - 1), VE.clamp(z, 1, VE.N - 1));
        this.drawT = 0;
      };
      cv.addEventListener('pointerdown', e => { e.stopPropagation(); this.drag = true; cv.setPointerCapture(e.pointerId); go(e); });
      cv.addEventListener('pointermove', e => { if (this.drag) go(e); });
      cv.addEventListener('pointerup', () => { this.drag = false; });
      cv.addEventListener('pointercancel', () => { this.drag = false; });
      window.addEventListener('resize', () => this.layout());
      this.layout();
    }
    layout() {
      const mob = VE.touchUI ? VE.touchUI() : window.innerWidth < 700;
      const size = mob ? 96 : 176;
      this.cv.width = this.cv.height = size * (window.devicePixelRatio > 1 ? 2 : 1);
      this.cv.style.width = this.cv.style.height = size + 'px';
      this.wrap.classList.toggle('mob', mob);
      this.wrap.classList.toggle('hidden', !this.open);
      this.btn.classList.toggle('hidden', !mob);
      this.btn.classList.toggle('on', this.open);
      this.baseT = 0; this.drawT = 0;
    }
    /* achtergrond: één pixel per tegel */
    paintBase(g) {
      const w = g.world, N = VE.N;
      if (this.base.width !== N) { this.base.width = this.base.height = N; this.img = this.bctx.createImageData(N, N); }
      const d = this.img.data, mix = (c, o, f) => [c[0] + (o[0] - c[0]) * f, c[1] + (o[1] - c[1]) * f, c[2] + (o[2] - c[2]) * f];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = j * N + i, t = w.type[k], h = w.tileH(i, j), v = w.volc ? w.volc[k] : 0;
        let c;
        if (t === 5) c = COL.bridge;
        else if (t === 1) c = h < -0.4 ? COL.deep : COL.water;
        else if (t === 4 || v === 4) c = COL.cliff;
        else if (v === 2) c = COL.crater;
        else if (v === 3) c = COL.fiss;
        else if (v === 1) c = mix(COL.volc, COL.mount, 0.15);
        else if (t === 2) c = h > 4.6 ? COL.snow : COL.mount;
        else if (t === 3) c = COL.shore;
        else if (w.tree[k] && !w.tree[k].dead) c = COL.forest;
        else c = (i * 7 + j * 13) % 5 < 2 ? COL.grass2 : COL.grass;
        if (w.bld[k]) c = COL.bld;
        if (!w.owned[k] && !w.bld[k]) c = mix(c, [60, 70, 64], 0.18);
        const e = w.explored[k];
        // onontdekt: helemaal mist (geen kustlijn, rivieren of canyon); alleen de vulkaantop is altijd te zien
        const peak = w.peak && w.volc && v === 2;
        if (e < 0.5 && !peak) c = mix(c, COL.fog, e < 0.2 ? 1 : 1 - (e - 0.2) * 1.5);
        const o = k * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
      this.bctx.putImageData(this.img, 0, 0);
    }
    update(dt) {
      if (!this.open) return;
      const g = VE.game; if (!g || !g.world) return;
      this.baseT -= dt; this.drawT -= dt;
      if (this.baseT <= 0) { this.baseT = 2.5; this.paintBase(g); this.drawT = 0; }
      if (this.drawT > 0) return;
      this.drawT = 0.25;
      const ctx = this.ctx, W = this.cv.width, s = W / VE.N, N = VE.N;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.base, 0, 0, W, W);
      // territoriumgrens
      // bijzondere plekken (alleen ontdekt)
      if (g.world.landmarks) for (const L of g.world.landmarks) {
        if (!L.found) continue;
        ctx.fillStyle = '#ffe08a'; ctx.strokeStyle = '#5a3820'; ctx.lineWidth = Math.max(1, s * 0.4);
        ctx.beginPath(); ctx.arc(L.x * s, L.z * s, Math.max(2.5, s * 1.1), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      // andere startplekken (ontdekt): vlaggetjes
      if (g.players) for (const p of g.players) {
        if (p.id === 0) continue;
        const x = p.start.i + 1, z = p.start.j + 1, k = Math.floor(z) * N + Math.floor(x);
        if (g.world.explored[k] < 0.5) continue;
        ctx.fillStyle = '#' + p.color.toString(16).padStart(6, '0'); ctx.fillRect(x * s - 2, z * s - 6, 2, 8); ctx.fillRect(x * s, z * s - 6, 5, 4);
      }
      // soldaten
      ctx.fillStyle = '#8fe3ff';
      for (const st of g.settlers) if (st.mode === 'soldier') ctx.fillRect(st.x * s - 1, st.z * s - 1, 2.5, 2.5);
      // camerabeeld: de vier schermhoeken op de grond
      const cam = this.ui.view.cam, el = this.ui.view.renderer.domElement, r = el.getBoundingClientRect();
      const pts = [[r.left, r.top], [r.right, r.top], [r.right, r.bottom], [r.left, r.bottom]].map(p => { const v = new THREE.Vector3(); return cam.groundAt(p[0], p[1], v) ? v : null; });
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = Math.max(1.5, W / 110);
      if (pts.every(Boolean)) {
        ctx.beginPath(); pts.forEach((v, q) => { const x = VE.clamp(v.x, -N, 2 * N) * s, z = VE.clamp(v.z, -N, 2 * N) * s; if (q) ctx.lineTo(x, z); else ctx.moveTo(x, z); }); ctx.closePath(); ctx.stroke();
      } else { ctx.beginPath(); ctx.arc(cam.tx * s, cam.tz * s, W * 0.05, 0, Math.PI * 2); ctx.stroke(); }
    }
  }
  VE.Minimap = Minimap;
  // koppelen aan de interface: aanmaken bij de eerste update, daarna elke frame bijwerken
  const U = VE.UI.prototype, upd = U.update;
  U.update = function (dt) {
    upd.call(this, dt);
    if (!this.minimap) this.minimap = new Minimap(this);
    this.minimap.update(dt);
  };
})(window.VE);
