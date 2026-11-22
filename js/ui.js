/* Village Empire — © 2026 Brakeco Games. All rights reserved. */
'use strict';
(function (VE) {
  const $ = id => document.getElementById(id);
  const N = VE.N;
  /* een goed staat in de balk (en bij handel/markt) zodra je het kunt gebruiken of al hebt */
  VE.resVisible = (g, r) => { const d = VE.RES[r]; return !d.rank || g.rank >= d.rank || (g.stock[r] || 0) > 0 || ((g.stats.produced || {})[r] || 0) > 0; };
  const resTip = r => VE.RES[r].name + (VE.RES[r].tip ? ': ' + VE.RES[r].tip : '');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const costHtml = (cost, game) => {
    let h = '';
    for (const r in cost) {
      const have = r === 'gold' ? game.gold : game.avail(r);
      h += '<span class="cost ' + (have >= cost[r] ? '' : 'short') + '">' + VE.icon(r, 15) + cost[r] + '</span>';
    }
    return h || '<span class="cost">free</span>';
  };

  /* ================= Camera controller ================= */
  const _ndc = new THREE.Vector2(), _ray = new THREE.Raycaster(), _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _g = new THREE.Vector3();
  class CameraCtl {
    constructor(camera) {
      this.camera = camera;
      this.tx = 32; this.tz = 33; this.ty = 1;
      this.dist = 17; this.tdist = 17; this.yaw = Math.PI / 4; this.tyaw = Math.PI / 4; this.pitch = 0.9;
      this.orbit = false;
    }
    update(dt) {
      const w = VE.game && VE.game.world;
      if (this.orbit) this.tyaw += dt * 0.045;
      this.dist += (this.tdist - this.dist) * Math.min(1, dt * 8);
      this.yaw += (this.tyaw - this.yaw) * Math.min(1, dt * 7);
      this.tx = VE.clamp(this.tx, 1, N - 1); this.tz = VE.clamp(this.tz, 1, N - 1);
      if (w) this.ty += (Math.max(0.3, w.heightAt(this.tx, this.tz)) - this.ty) * Math.min(1, dt * 4);
      const p = VE.clamp(this.pitch + (this.dist - 17) * 0.004, 0.35, 1.43), cp = Math.cos(p), sp = Math.sin(p);
      this.camera.position.set(this.tx + Math.sin(this.yaw) * cp * this.dist, this.ty + sp * this.dist, this.tz + Math.cos(this.yaw) * cp * this.dist);
      this.camera.lookAt(this.tx, this.ty, this.tz);
    }
    pan(dx, dy) {
      const s = 0.63 * this.dist / window.innerHeight;
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw), fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      this.tx += -rx * dx * s + fx * dy * s * 1.25;
      this.tz += -rz * dx * s + fz * dy * s * 1.25;
    }
    zoom(f) { this.tdist = VE.clamp(this.tdist * f, 6.5, 42); }
    /* punt op het maaiveld (vlak y = ty) onder schermpositie (clientX, clientY); null als je boven de horizon wijst */
    groundAt(cx, cy, out, planeY) {
      const el = VE.view && VE.view.renderer.domElement; if (!el) return null;
      const r = el.getBoundingClientRect();
      _ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      this.camera.updateMatrixWorld();
      _ray.setFromCamera(_ndc, this.camera);
      _plane.constant = -(planeY === undefined ? this.ty : planeY);
      return _ray.ray.intersectPlane(_plane, out) ? out : null;
    }
    /* slepen: het vastgepakte punt blijft onder de muis (camerahoek en draaiing veranderen niet) */
    dragTo(anchor, cx, cy) {
      this.update(0);
      if (!this.groundAt(cx, cy, _g, anchor.y)) return;          // zelfde hoogte als bij het vastpakken: geen drift over heuvels
      this.tx += anchor.x - _g.x; this.tz += anchor.z - _g.z;
      this.tx = VE.clamp(this.tx, 1, N - 1); this.tz = VE.clamp(this.tz, 1, N - 1);
      this.update(0);
    }
    rotate(a) { this.tyaw += a; }
    /* tilt up/down (radians, positive = more top-down), 20°–82° like the other Brakeco games */
    tilt(a) { this.pitch = VE.clamp(this.pitch + a, 0.42, 1.36); }
    focus(x, z) { this.tx = x; this.tz = z; }
  }
  VE.CameraCtl = CameraCtl;

  /* ================= UI ================= */
  class UI {
    constructor(view) {
      this.view = view;
      this.tool = null; // null | 'demolish' | building type
      this.cat = 'basic';
      this.sel = null;
      this.pointers = new Map();
      this.ray = new THREE.Raycaster();
      this.ndc = new THREE.Vector2();
      this.floaters = [];
      this.qOpen = !VE.isMobile;
      this.lastSig = {};
      this.makeHelpers();
      this.bindInput();
      this.bindHud();
      VE.bus.on('toast', e => this.toast(e.text));
      VE.bus.on('float', e => this.floater(e));
      VE.bus.on('promote', e => this.onPromote(e.rank));
      VE.bus.on('territory', () => this.toast('🗼 Your borders grow — new land to settle!'));
    }
    get game() { return VE.game; }

    /* ---------- 3D helpers: ghost, rings ---------- */
    makeHelpers() {
      const scene = this.view.scene;
      this.ghost = new THREE.Group(); this.ghost.visible = false; scene.add(this.ghost);
      this.ghostMat = new THREE.MeshBasicMaterial({ color: 0x7dff8a, transparent: true, opacity: 0.55, depthWrite: false });
      this.ghostMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.ghostMat); this.ghost.add(this.ghostMesh);
      const tileGeo = new THREE.PlaneGeometry(1, 1); tileGeo.rotateX(-Math.PI / 2);
      this.tileMark = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
      this.tileMark.visible = false; scene.add(this.tileMark);
      this.rangeRing = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 72), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.6, depthTest: false, side: THREE.DoubleSide }));
      this.rangeRing.rotation.x = -Math.PI / 2; this.rangeRing.visible = false; this.rangeRing.renderOrder = 5; scene.add(this.rangeRing);
      this.selRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 40), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
      this.selRing.rotation.x = -Math.PI / 2; this.selRing.visible = false; this.selRing.renderOrder = 6; scene.add(this.selRing);
      // UI markers keep their exact colours, unaffected by the scene's tone mapping
      for (const m of [this.ghostMat, this.tileMark.material, this.rangeRing.material, this.selRing.material]) m.toneMapped = false;
    }
    setGhost(type) {
      if (!type || type === 'demolish') { this.ghost.visible = false; return; }
      this.ghostMesh.geometry = VE.buildModel(type, 1).geo;
      this.ghostType = type;
    }

    /* ---------- input ---------- */
    pick(cx, cy) {
      const g = this.game; if (!g) return null;
      const r = this.view.renderer.domElement.getBoundingClientRect();
      this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(this.ndc, this.view.camera);
      const meshes = [];
      for (const b of g.buildings) if (b.alive && b.mesh) meshes.push(b.mesh);
      const hb = this.ray.intersectObjects(meshes, false)[0];
      const ht = this.ray.intersectObject(g.world.terrain, false)[0];
      let res = { b: null, i: -1, j: -1 };
      if (ht) { res.i = Math.floor(ht.point.x); res.j = Math.floor(ht.point.z); res.x = ht.point.x; res.z = ht.point.z; }
      if (hb) res.b = hb.object.parent.userData.b;
      else if (ht && g.world.inb(res.i, res.j)) { const id = g.world.bld[res.j * N + res.i]; if (id) res.b = g.bmap[id]; }
      return res;
    }
    bindInput() {
      const el = this.view.renderer.domElement;
      el.addEventListener('contextmenu', e => e.preventDefault());
      // middle mouse: no browser auto-scroll / paste, it orbits the camera instead
      el.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
      el.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });
      el.addEventListener('pointerdown', e => {
        if (!VE.playing) return;
        if (e.button === 1) e.preventDefault();
        el.setPointerCapture(e.pointerId);
        const pt = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, b: e.button, type: e.pointerType, drag: false, anchor: null };
        // linkerknop / één vinger: het punt op de grond onthouden waar je de wereld 'vastpakt'
        if (e.button === 0) { const a = new THREE.Vector3(); if (this.view.cam.groundAt(e.clientX, e.clientY, a)) pt.anchor = a; }
        this.pointers.set(e.pointerId, pt);
        this.moved = 0;
        if (this.pointers.size > 1) this.pinch = null;
      });
      el.addEventListener('pointermove', e => {
        if (!VE.playing) return;
        const p = this.pointers.get(e.pointerId);
        if (!p) { if (e.pointerType === 'mouse') this.hover(e.clientX, e.clientY); return; }
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        if (this.pointers.size === 2) {
          const [a, b] = [...this.pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          if (this.pinch) {
            this.view.cam.zoom(this.pinch.d / Math.max(10, d));
            let da = ang - this.pinch.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
            this.view.cam.rotate(-da);
            this.view.cam.pan(mx - this.pinch.mx, my - this.pinch.my);
          }
          this.pinch = { d: d, a: ang, mx: mx, my: my };
          for (const q of this.pointers.values()) { q.drag = true; q.anchor = null; }   // na knijpen geen tik of sprong
          this.moved += 99;
          return;
        }
        this.moved += Math.abs(dx) + Math.abs(dy);
        if (p.b === 1) { this.view.cam.rotate(-dx * 0.008); this.view.cam.tilt(dy * 0.006); return; } // middle drag: orbit + tilt
        if (p.b === 2) { this.view.cam.rotate(-dx * 0.006); return; }
        // linkerknop / één vinger: pas na een kleine drempel slepen (klikken blijft klikken)
        if (!p.drag && Math.hypot(p.x - p.sx, p.y - p.sy) > (e.pointerType === 'mouse' ? 6 : 10)) { p.drag = true; this.ghost.visible = false; }
        if (p.drag) {
          if (p.anchor) this.view.cam.dragTo(p.anchor, e.clientX, e.clientY); else this.view.cam.pan(dx, dy);
          return;
        }
        if (e.pointerType === 'mouse') this.hover(e.clientX, e.clientY);
      });
      const up = e => {
        const p = this.pointers.get(e.pointerId);
        if (!p) return;
        this.pointers.delete(e.pointerId);
        if (this.pointers.size === 0) {
          if (!p.drag && this.moved < 9 && p.b === 0) this.tap(e.clientX, e.clientY, p.type);
          if (p.drag && p.type === 'mouse') this.hover(e.clientX, e.clientY);
          if (this.moved < 9 && p.b === 2) this.setTool(null);
          this.pinch = null;
        } else this.pinch = null;
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('wheel', e => { e.preventDefault(); if (VE.playing) this.view.cam.zoom(e.deltaY > 0 ? 1.12 : 0.89); }, { passive: false });
      window.addEventListener('keydown', e => {
        if (!VE.playing || e.target.tagName === 'INPUT') return;
        const c = this.view.cam, k = e.key.toLowerCase();
        if (k === 'escape') { if (!$('modal').classList.contains('hidden')) this.closeModal(); else if (this.tool) this.setTool(null); else this.select(null); }
        else if (k === 'q') c.rotate(-Math.PI / 4);
        else if (k === 'e') c.rotate(Math.PI / 4);
        else if (k === '+' || k === '=') c.zoom(0.85);
        else if (k === '-') c.zoom(1.18);
        else if (k === 'pageup') { c.tilt(0.15); e.preventDefault(); }
        else if (k === 'pagedown') { c.tilt(-0.15); e.preventDefault(); }
        else if (k === 'x') this.setTool(this.tool === 'demolish' ? null : 'demolish');
        else if (k === ' ') { this.cycleSpeed(); e.preventDefault(); }
        else this.keys[k] = true;
      });
      window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
      this.keys = {};
    }
    keyPan(dt) {
      const k = this.keys, s = 500 * dt;
      let dx = 0, dy = 0;
      if (k.a || k.arrowleft) dx += s; if (k.d || k.arrowright) dx -= s;
      if (k.w || k.arrowup) dy += s; if (k.s || k.arrowdown) dy -= s;
      if (dx || dy) this.view.cam.pan(dx, dy);
    }
    hover(cx, cy) {
      const g = this.game; if (!g) return;
      const p = this.pick(cx, cy);
      this.hoverP = p;
      this.updateGhost(p);
    }
    updateGhost(p) {
      const g = this.game, w = g.world;
      this.ghost.visible = false; this.tileMark.visible = false;
      if (!this.selRangeShown) this.rangeRing.visible = false;
      if (!p || p.i < 0 || !w.inb(p.i, p.j)) return;
      if (this.tool === 'demolish') {
        this.tileMark.visible = true;
        this.tileMark.position.set(p.i + 0.5, w.tileH(p.i, p.j) + 0.08, p.j + 0.5);
        const ok = !!p.b && !p.b.def.fixed;
        this.tileMark.material.color.setHex(ok ? 0xff6a5a : 0x9a9a9a);
        return;
      }
      if (this.tool && VE.DEFS[this.tool]) {
        const def = VE.DEFS[this.tool], size = def.size || 1;
        const i = size > 1 ? Math.round(p.x - 1) : p.i, j = size > 1 ? Math.round(p.z - 1) : p.j;
        const chk = g.canPlace(this.tool, i, j), ok = chk.ok;
        this.ghost.visible = true;
        this.placeHint(chk);
        let sum = 0; for (let z = j; z <= j + size; z++) for (let x = i; x <= i + size; x++) if (w.inb(Math.min(x, N - 1), Math.min(z, N - 1))) sum += w.vh(Math.min(x, N), Math.min(z, N));
        this.ghost.position.set(i + size / 2, sum / ((size + 1) * (size + 1)) + 0.02, j + size / 2);
        this.ghostMat.color.setHex(ok ? 0x7dff8a : 0xff6a5a);
        this.ghostAt = { i: i, j: j, ok: ok };
        if (def.radius) this.showRange(i + size / 2, j + size / 2, def.radius);
      }
    }
    /* uitleg onder de werkbalk: groen = hier kan het (met reden), rood = waarom niet */
    placeHint(chk) {
      const el = $('toolHintWhy'); if (!el) return;
      const t = chk.why || (chk.ok ? 'Good spot' : '');
      if (el.textContent !== t) el.textContent = t;
      el.className = chk.ok ? 'ok' : 'bad';
    }
    showRange(x, z, r) {
      this.rangeRing.visible = true;
      this.rangeRing.scale.set(r, r, r);
      this.rangeRing.position.set(x, this.game.world.heightAt(x, z) + 0.15, z);
    }
    tap(cx, cy, ptype) {
      const g = this.game; if (!g) return;
      const p = this.pick(cx, cy); if (!p) return;
      const w = g.world;
      if (this.tool === 'demolish') {
        if (p.b && !p.b.def.fixed) this.confirmDemolish(p.b);
        return;
      }
      if (this.tool && VE.DEFS[this.tool]) {
        this.updateGhost(p);
        const ga = this.ghostAt; if (!ga) return;
        if (ptype !== 'mouse' && (!this.pending || this.pending.i !== ga.i || this.pending.j !== ga.j)) {
          this.pending = { i: ga.i, j: ga.j };
          if (!ga.ok) this.toast(g.canPlace(this.tool, ga.i, ga.j).why); else this.toast('Tap again to build here');
          return;
        }
        this.pending = null;
        const chk = g.canPlace(this.tool, ga.i, ga.j);
        if (!chk.ok) { this.toast(chk.why); VE.audio.play('error'); return; }
        if (VE.DEFS[this.tool].gold) g.gold -= VE.DEFS[this.tool].gold;
        const b = g.placeBuilding(this.tool, ga.i, ga.j);
        VE.audio.play('place', b.cx, b.cz);
        VE.bus.emit('dust', { x: b.cx, y: b.y, z: b.cz, n: 6 });
        if (this.tool !== 'house') this.setTool(null);
        this.updateGhost(p);
        this.refreshHud(true);
        return;
      }
      this.select(p.b || null);
    }

    /* ---------- tools & build bar ---------- */
    setTool(t) {
      this.tool = t; this.pending = null;
      this.setGhost(t);
      this.ghost.visible = false; this.tileMark.visible = false;
      if (!this.selRangeShown) this.rangeRing.visible = false;
      if (t) this.select(null);
      document.querySelectorAll('.tool').forEach(b => b.classList.toggle('on', b.dataset.tool === (t || 'select')));
      document.querySelectorAll('.card').forEach(c => c.classList.toggle('on', c.dataset.b === t));
      const hint = $('toolHint');
      if (!$('toolHintWhy')) { const w = document.createElement('span'); w.id = 'toolHintWhy'; hint.insertBefore(w, $('toolCancel')); }
      $('toolHintWhy').textContent = '';
      // mijn plaatsen: de passende ertsaders lichten op
      if (VE.Mining) VE.Mining.highlight(this.game, t && VE.DEFS[t] && VE.DEFS[t].ore ? VE.DEFS[t].ore : 0);
      if (t) {
        hint.classList.remove('hidden');
        $('toolHintText').textContent = t === 'demolish' ? 'Tap a building to remove it' : (VE.isMobile ? 'Tap a spot, then tap again to build ' : 'Click to place ') + VE.DEFS[t].name;
      } else hint.classList.add('hidden');
      if (this.hoverP) this.updateGhost(this.hoverP);
    }
    renderBuildBar() {
      const g = this.game;
      let tabs = '';
      for (const c of VE.CATS) tabs += '<button class="tab ' + (c.id === this.cat ? 'on' : '') + '" data-cat="' + c.id + '">' + c.name + '</button>';
      $('tabs').innerHTML = tabs;
      let cards = '';
      for (const k in VE.DEFS) {
        const d = VE.DEFS[k];
        if (d.cat !== this.cat || d.buildable === false) continue;
        const un = g.unlocked(k);
        const cost = Object.assign({}, d.cost || {}); if (d.gold) cost.gold = d.gold;
        cards += '<button class="card ' + (un ? '' : 'locked ') + (this.tool === k ? 'on' : '') + '" data-b="' + k + '">' +
          '<div class="c-icon">' + d.icon + '</div><div class="c-name">' + d.name + '</div>' +
          (un ? '<div class="c-cost">' + costHtml(cost, g) + '</div>' : '<div class="c-lock">🔒 ' + VE.RANKS[d.rank].name + '</div>') + '</button>';
      }
      // Mining: schakelaar voor de mijnbouw-informatielaag (welk erts ligt waar onder de berg)
      if (this.cat === 'metal') cards = '<button class="card survey ' + (this.survey ? 'on' : '') + '" data-survey="1" title="Show which ore lies below the mountains you have explored">' +
        '<div class="c-icon">🔍</div><div class="c-name">Survey</div><div class="c-cost"><span class="cost">' + (this.survey ? 'on' : 'off') + '</span></div></button>' + cards;
      $('cards').innerHTML = cards;
      this.lastSig.barStruct = g.rank + '|' + this.cat;
    }
    updateBuildBar() {
      const g = this.game;
      document.querySelectorAll('#cards .card').forEach(c => {
        const k = c.dataset.b, d = VE.DEFS[k];
        if (!d) return;                                           // Survey-knop e.d.: geen bouwkosten
        c.classList.toggle('on', this.tool === k);
        if (c.classList.contains('locked')) return;
        const cost = Object.assign({}, d.cost || {}); if (d.gold) cost.gold = d.gold;
        const spans = c.querySelectorAll('.c-cost .cost');
        let n = 0;
        for (const r in cost) {
          const have = r === 'gold' ? g.gold : g.avail(r);
          if (spans[n]) spans[n].classList.toggle('short', have < cost[r]);
          n++;
        }
      });
    }
    bindHud() {
      $('tabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (!t) return; this.cat = t.dataset.cat; VE.audio.play('click'); this.renderBuildBar(); });
      $('cards').addEventListener('click', e => {
        const c = e.target.closest('.card'); if (!c) return;
        if (c.dataset.survey) {
          this.survey = !this.survey; VE.audio.play('click');
          if (VE.Mining) VE.Mining.highlight(this.game, 0);
          this.renderBuildBar();
          if (this.survey) this.toast('🔍 Survey: coloured stripes show the ore below explored mountains');
          return;
        }
        const k = c.dataset.b, g = this.game;
        if (!g.unlocked(k)) { this.toast('🔒 Unlocks at rank ' + VE.RANKS[VE.DEFS[k].rank].name); VE.audio.play('error'); return; }
        VE.audio.play('click');
        this.setTool(this.tool === k ? null : k);
        this.showInfoDef(k);
      });
      document.querySelectorAll('.tool').forEach(b => b.addEventListener('click', () => {
        VE.audio.play('click');
        const t = b.dataset.tool;
        if (t === 'speed') { this.cycleSpeed(); return; }
        this.setTool(t === 'select' || this.tool === t ? null : t);
      }));
      $('toolCancel').addEventListener('click', () => this.setTool(null));
      $('btnQuests').addEventListener('click', () => { this.qOpen = !this.qOpen; VE.audio.play('click'); this.renderQuests(true); });
      $('btnUpgrades').addEventListener('click', () => this.openUpgrades());
      $('btnTrade').addEventListener('click', () => this.openTrade());
      $('btnMenu').addEventListener('click', () => this.openMenu());
      $('btnSound').addEventListener('click', () => {
        const on = !(VE.audio.sfxOn || VE.audio.musicOn);
        VE.audio.setSfx(on); VE.audio.setMusic(on); VE.saveSettings();
        this.syncSoundBtn(); VE.audio.play('click');
      });
      $('questPanel').addEventListener('click', e => this.onAct(e));
      $('infoPanel').addEventListener('click', e => this.onAct(e));
      $('modal').addEventListener('click', e => { if (e.target.id === 'modal') this.closeModal(); else this.onAct(e); });
      $('infoPanel').addEventListener('change', e => this.onAct(e));
    }
    syncSoundBtn() { $('btnSound').textContent = (VE.audio.sfxOn || VE.audio.musicOn) ? '🔊' : '🔇'; }
    cycleSpeed() {
      const g = this.game; g.speed = g.speed >= 3 ? 1 : g.speed + 1;
      $('speedBtn').innerHTML = '⏩<small>' + g.speed + '×</small>';
    }
    onAct(e) {
      const el = e.target.closest('[data-act]'); if (!el) return;
      if (e.type === 'click' && el.tagName === 'SELECT') return;
      const g = this.game, a = el.dataset.act, arg = el.dataset.arg;
      VE.audio.play('click');
      switch (a) {
        case 'close': this.select(null); this.hideInfo(); break;
        case 'qtoggle': this.qOpen = !this.qOpen; this.renderQuests(true); break;
        case 'claim': { const q = VE.RANKS[g.rank].quests.find(x => x.id === arg); if (q && g.claim(q)) { this.toast('🎁 Reward collected!'); VE.save(); } this.renderQuests(true); this.refreshHud(true); break; }
        case 'promote': if (g.promote()) { this.renderQuests(true); this.renderBuildBar(); VE.save(); } break;
        case 'upgrade': if (this.sel && g.upgrade(this.sel)) { this.toast('⭐ ' + this.sel.def.name + ' upgraded to level ' + this.sel.level); VE.save(); } this.renderInfo(true); break;
        case 'demolish': if (this.sel) this.confirmDemolish(this.sel); break;
        case 'doDemolish': { const b = g.bmap[arg]; if (b) g.demolish(b); this.closeModal(); this.select(null); break; }
        case 'sell': if (this.sel) { this.sel.sell[arg] = !this.sel.sell[arg]; this.renderInfo(true); } break;
        case 'recipe': if (this.sel && g.setRecipe(this.sel, arg)) { this.toast(VE.DEFS.smelter.icon + ' The smelter now makes ' + VE.RECIPES[arg].name.toLowerCase()); VE.save(); } this.renderInfo(true); break;
        case 'keep': if (this.sel && e.type === 'change') { this.sel.keep = +el.value; } break;
        case 'goto': if (this.sel) this.view.cam.focus(this.sel.cx, this.sel.cz); break;
        case 'buyUpg': if (g.buyUpgrade(arg)) { VE.audio.play('coin'); this.toast('🔨 Upgrade purchased!'); VE.save(); } this.openUpgrades(); break;
        case 'trade': { const n = +el.dataset.n; if (g.trade(arg, n)) VE.audio.play('coin'); else VE.audio.play('error'); this.openTrade(); break; }
        case 'closeModal': this.closeModal(); break;
        case 'save': VE.save(); this.toast('💾 Game saved'); this.closeModal(); break;
        case 'music': VE.audio.setMusic(!VE.audio.musicOn); VE.saveSettings(); this.syncSoundBtn(); this.openMenu(); break;
        case 'sfx': VE.audio.setSfx(!VE.audio.sfxOn); VE.saveSettings(); this.syncSoundBtn(); this.openMenu(); break;
        case 'help': this.openHelp(); break;
        case 'production': this.openProduction(); break;
        case 'mainmenu': this.closeModal(); VE.toMenu(); break;
        case 'newgame': this.confirmNew(); break;
        case 'doNew': this.closeModal(); VE.newGame(); break;
      }
    }

    /* ---------- selection & info panel ---------- */
    select(b) {
      this.sel = b;
      this.selRangeShown = false;
      if (b) {
        this.selRing.visible = true;
        const r = b.size > 1 ? 1.25 : 0.62;
        this.selRing.scale.set(r / 0.58, r / 0.58, 1);
        this.selRing.position.set(b.cx, b.y + 0.06, b.cz);
        if (b.def.radius) { this.showRange(b.cx, b.cz, b.def.radius); this.selRangeShown = true; }
        else this.rangeRing.visible = false;
        this.renderInfo(true);
        VE.audio.play('open');
      } else { this.selRing.visible = false; this.rangeRing.visible = false; this.hideInfo(); }
    }
    hideInfo() { $('infoPanel').classList.add('hidden'); this.infoDef = null; }
    showInfoDef(k) {
      if (!this.tool) { this.hideInfo(); return; }
      const d = VE.DEFS[k], g = this.game;
      let h = '<div class="ip-head"><span class="ip-icon">' + d.icon + '</span><div class="ip-tt"><div class="ip-title">' + d.name + '</div><div class="ip-status">Choose a spot to build</div></div><button class="x" data-act="close">✕</button></div>';
      h += '<div class="ip-desc">' + d.desc + '</div>';
      h += this.chainHtml(d);
      const cost = Object.assign({}, d.cost || {}); if (d.gold) cost.gold = d.gold;
      h += '<div class="ip-row"><b>Cost</b> ' + costHtml(cost, g) + '</div>';
      $('infoPanel').innerHTML = h; $('infoPanel').classList.remove('hidden');
      this.infoDef = k;
    }
    chainHtml(d, b) {
      if (d.recipes) d = (b ? this.game.rcp(b) : d.recipes[d.recipe]);
      if (d.inp) {
        let a = ''; for (const r in d.inp) a += VE.icon(r, 18) + (d.inp[r] > 1 ? d.inp[r] : '');
        let b = ''; if (d.out) for (const r in d.out) b += VE.icon(r, 18) + (d.out[r] > 1 ? '×' + d.out[r] : ''); if (d.outGold) b += VE.icon('gold', 18) + d.outGold;
        return '<div class="chain">' + a + '<span class="arr">➜</span>' + b + '</div>';
      }
      if (d.out && typeof d.out === 'string') return '<div class="chain">' + (d.gather === 'tree' ? '🌳' : d.gather === 'rock' ? '🪨' : d.gather === 'fish' ? '🌊' : d.gather === 'ore' ? '⛰️' : d.gather === 'hunt' ? '🐇🦌🐗' : '🌱') + '<span class="arr">➜</span>' + VE.icon(d.out, 18) + '</div>';
      return '';
    }
    renderInfo(force) {
      const b = this.sel, g = this.game, el = $('infoPanel');
      if (!b) return;
      if (!b.alive) { this.select(null); return; }
      const d = b.def;
      let h = '<div class="ip-head"><span class="ip-icon">' + d.icon + '</span><div class="ip-tt"><div class="ip-title">' + d.name +
        (d.cost ? ' <span class="lvl">' + '★'.repeat(b.level) + '<i>' + '★'.repeat(3 - b.level) + '</i></span>' : '') + '</div>';
      let status = !b.built ? 'Under construction' : b.status || (d.storage ? 'Storing goods' : d.housing ? 'Home sweet home' : d.territory ? 'Guarding the border' : '');
      h += '<div class="ip-status">' + esc(status) + '</div></div><button class="x" data-act="close">✕</button></div>';
      if (!b.built) {
        const pct = Math.round(100 * b.used / Math.max(1, b.total));
        h += '<div class="bar"><i style="width:' + pct + '%"></i><span>' + pct + '%</span></div><div class="ip-row"><b>Materials</b>';
        for (const r in d.cost) h += '<span class="cost ' + ((b.delivered[r] || 0) >= d.cost[r] ? 'ok' : '') + '">' + VE.icon(r, 15) + (b.delivered[r] || 0) + '/' + d.cost[r] + '</span>';
        h += '</div>';
        let need = false; for (const r in d.cost) if ((b.delivered[r] || 0) + (b.incoming[r] || 0) < d.cost[r] && g.avail(r) <= 0) need = true;
        if (need) h += '<div class="warn">Not enough materials in storage — keep producing!</div>';
        h += '<div class="ip-desc small">' + (b.builder ? '🔨 A builder is at work.' : 'Carriers bring materials, then a builder arrives.') + '</div>';
      } else {
        h += this.chainHtml(d, b);
        if (d.recipes) {
          // smelterij: kies het metaal
          h += '<div class="ip-sub">Smelt:</div><div class="recipes">';
          for (const k in d.recipes) {
            const R = d.recipes[k], lock = R.rank && g.rank < R.rank;
            let inp = ''; for (const r in R.inp) inp += VE.icon(r, 14) + R.inp[r];
            h += '<button class="rcp ' + (b.recipe === k ? 'on' : '') + '" data-act="recipe" data-arg="' + k + '"' + (lock ? ' disabled title="Unlocks at rank ' + VE.RANKS[R.rank].name + '"' : '') + '>' +
              VE.icon(k, 20) + '<small>' + (lock ? '🔒 ' + VE.RANKS[R.rank].name : inp) + '</small></button>';
          }
          h += '</div>';
          if (b.working && b.wt0) { const pct = Math.round(100 * (1 - b.wt / b.wt0)); h += '<div class="bar"><i style="width:' + pct + '%"></i><span>' + pct + '%</span></div>'; }
        }
        if (d.gather === 'ore' && VE.Mining) {
          const left = VE.Mining.reach(g.world, b.cx, b.cz, d.ore, d.radius + (b.level - 1) * 0.5);
          h += '<div class="ip-row"><b>Deposit</b> ' + (left ? VE.Mining.richness(left) + ', about ' + (Math.round(left / 5) * 5 || left) + ' ' + VE.RES[d.out].name.toLowerCase() + ' left' : '<span class="short">used up: build a new mine above another deposit</span>') + '</div>';
        }
        if (d.gather === 'hunt' && g.wild) {
          const r = d.radius + (b.level - 1), c = {};
          for (const a of g.wild.list) if (!a.dead && a.sp.hunt && (a.x - b.cx) ** 2 + (a.z - b.cz) ** 2 <= r * r) c[a.sp.name] = (c[a.sp.name] || 0) + 1;
          const txt = Object.keys(c).map(n => c[n] + ' ' + n.toLowerCase() + (c[n] > 1 && n !== 'Deer' && n !== 'Wild boar' ? 's' : '')).join(', ');
          h += '<div class="ip-row"><b>Game nearby</b> ' + (txt || '<span class="short">none: build closer to woods and meadows</span>') + '</div>';
        }
        if (d.worker) h += '<div class="ip-row"><b>Worker</b> ' + (b.worker ? (b.worker.mode === 'goWork' ? 'on the way' : 'at work') : '<span class="short">waiting for a free settler</span>') + '</div>';
        if (d.inp) { const R = g.rcp(b); h += '<div class="ip-row"><b>Input</b>'; for (const r in R.inp) h += '<span class="cost">' + VE.icon(r, 15) + (b.input[r] || 0) + '/' + g.cap(b) + '</span>'; h += '</div>'; }
        const outs = Object.keys(b.output).filter(r => b.output[r] > 0);
        if (d.out || outs.length) { h += '<div class="ip-row"><b>Output</b>'; for (const r of outs) h += '<span class="cost">' + VE.icon(r, 15) + b.output[r] + '</span>'; if (!outs.length) h += '<span class="dim">—</span>'; h += '</div>'; }
        if (d.housing) h += '<div class="ip-row"><b>Homes</b> ' + (d.housing + (d.levelHousing || 0) * (b.level - 1)) + ' settlers</div>';
        if (d.gather === 'field') h += '<div class="ip-row"><b>Fields</b> ' + b.fields.filter(f => !f.dead).length + '/' + (d.maxFields + 2 * (b.level - 1)) + '</div>';
        if (d.storage) { h += '<div class="ip-row wrap"><b>Stock</b>'; for (const r of VE.RES_ORDER) if (g.stock[r] > 0) h += '<span class="cost">' + VE.icon(r, 15) + VE.fmt(g.stock[r]) + '</span>'; h += '</div>'; }
        if (d.market) {
          h += '<div class="ip-sub">Sell automatically:</div><div class="sellgrid">';
          for (const r of VE.RES_ORDER) if (VE.resVisible(g, r)) h += '<button class="sell ' + (b.sell[r] ? 'on' : '') + '" data-act="sell" data-arg="' + r + '" title="' + esc(VE.RES[r].name) + '">' + VE.icon(r, 16) + '<small>' + g.sellPrice(r) + '</small></button>';
          h += '</div><div class="ip-row"><b>Keep in store</b> <select data-act="keep">' + [0, 5, 10, 20, 40].map(v => '<option value="' + v + '"' + (b.keep === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></div>';
          let pend = 0; for (const r in b.input) pend += b.input[r];
          h += '<div class="ip-row"><b>On the stalls</b> ' + pend + ' goods</div>';
        }
        if (d.territory) h += '<div class="ip-row"><b>Border</b> radius ' + (d.territory + (b.level - 1) * 1.5) + '</div>';
      }
      h += '<div class="ip-desc small">' + d.desc + '</div><div class="ip-btns">';
      if (b.built && d.cost) {
        if (b.level < 3) {
          const ml = g.maxLevel();
          if (b.level >= ml) h += '<button class="btn" disabled>⭐ Level ' + (b.level + 1) + ' at rank ' + VE.RANKS[b.level === 1 ? 1 : 3].name + '</button>';
          else { const c = VE.levelCost(d, b.level + 1); h += '<button class="btn good" data-act="upgrade" ' + (g.canAfford(c) ? '' : 'disabled') + '>⭐ Upgrade ' + costHtml(c, g) + '</button>'; }
        }
      }
      if (!d.fixed) h += '<button class="btn bad" data-act="demolish">Demolish</button>';
      h += '</div>';
      const ae = document.activeElement;
      if (!force && ae && ae.tagName === 'SELECT' && el.contains(ae)) return;
      if (force || h !== this.lastInfo) { el.innerHTML = h; this.lastInfo = h; }
      el.classList.remove('hidden');
    }
    confirmDemolish(b) {
      this.openModal('<h2>Demolish ' + b.def.name + '?</h2><p>' + (b.built ? 'You get half of the building materials back.' : 'All delivered materials are returned.') + '</p>' +
        '<div class="mbtns"><button class="btn" data-act="closeModal">Keep it</button><button class="btn bad" data-act="doDemolish" data-arg="' + b.id + '">Demolish</button></div>');
    }

    /* ---------- quests ---------- */
    renderQuests(force) {
      const g = this.game, el = $('questPanel');
      const rk = VE.RANKS[g.rank], next = VE.RANKS[g.rank + 1];
      let ready = 0;
      for (const q of rk.quests) if (!g.claimed[q.id] && g.questProgress(q) >= q.n) ready++;
      const promo = g.canPromote();
      $('qBadge').textContent = ready + (promo ? 1 : 0) || '';
      $('qBadge').classList.toggle('hidden', !(ready || promo));
      el.classList.toggle('closed', !this.qOpen);
      let h = '<div class="qp-head" data-act="qtoggle">📜 Village Charter <span class="chev">' + (this.qOpen ? '▾' : '▸') + '</span></div>';
      if (this.qOpen) {
        h += '<div class="qp-body">';
        if (next) h += '<div class="qp-rank">Complete every task to become a <b>' + next.name + '</b></div>';
        else h += '<div class="qp-rank">👑 Your realm is a true <b>Empire</b>. Keep growing it as you wish!</div>';
        for (const q of rk.quests) {
          const p = Math.min(q.n, Math.floor(g.questProgress(q))), cl = g.claimed[q.id], done = p >= q.n;
          let rw = ''; for (const r in q.reward) rw += VE.icon(r, 13) + q.reward[r] + ' ';
          h += '<div class="q ' + (cl ? 'claimed' : done ? 'done' : '') + '"><div class="q-text">' + (cl ? '✔ ' : '') + q.text + '</div>';
          if (!cl) h += '<div class="q-bar"><i style="width:' + (100 * p / q.n) + '%"></i></div><div class="q-meta"><span>' + VE.fmt(p) + '/' + VE.fmt(q.n) + '</span><span class="rw">' + rw + '</span></div>';
          if (done && !cl) h += '<button class="btn good small" data-act="claim" data-arg="' + q.id + '">Collect reward</button>';
          h += '</div>';
        }
        if (promo) h += '<button class="btn promote" data-act="promote">👑 Become a ' + next.name + '!</button>';
        h += '</div>';
      }
      if (force || h !== this.lastQ) { el.innerHTML = h; this.lastQ = h; }
    }
    onPromote(rank) {
      const r = VE.RANKS[rank];
      let un = r.unlock.map(k => '<div class="unl"><span>' + VE.DEFS[k].icon + '</span>' + VE.DEFS[k].name + '</div>').join('');
      if (rank === 1) un += '<div class="unl"><span>⭐</span>Building upgrades</div><div class="unl"><span>🔨</span>Village upgrades</div>';
      if (rank === 3) un += '<div class="unl"><span>⭐</span>Level 3 buildings</div>';
      this.openModal('<div class="celebrate">👑</div><h2>Your settlement is now a ' + r.name + '!</h2>' +
        (un ? '<p>Newly available:</p><div class="unlocks">' + un + '</div>' : '<p>Your people cheer in the streets. Long live the ' + r.name + '!</p>') +
        '<div class="mbtns"><button class="btn good" data-act="closeModal">Wonderful!</button></div>');
      VE.bus.emit('dust', { x: this.game.hq.cx, y: this.game.hq.y + 1.5, z: this.game.hq.cz, n: 24 });
      VE.sdk.happy();
    }

    /* ---------- modals ---------- */
    openModal(html) { $('modalBox').innerHTML = html; $('modal').classList.remove('hidden'); VE.audio.play('open'); }
    closeModal() { $('modal').classList.add('hidden'); }
    openUpgrades() {
      const g = this.game;
      let h = '<h2>🔨 Village Upgrades</h2>';
      if (g.rank < 1) h += '<p class="dim">Become a <b>Village</b> to unlock upgrades for your whole realm.</p>';
      h += '<div class="ulist">';
      for (const u of VE.UPGRADES) {
        const lvl = g.upg[u.id], max = u.cost.length, c = u.cost[lvl];
        h += '<div class="urow"><div class="u-icon">' + u.icon + '</div><div class="u-txt"><b>' + u.name + '</b><div class="dots">' + '●'.repeat(lvl) + '<i>' + '●'.repeat(max - lvl) + '</i></div><small>' + u.desc + '</small></div>';
        if (lvl >= max) h += '<button class="btn" disabled>Max</button>';
        else {
          const locked = g.rank < 1, ok = !locked && g.gold >= c;
          const why = locked ? 'Unlocks at rank ' + VE.RANKS[1].name : ok ? '' : 'Needs ' + c + ' gold';
          h += '<button class="btn good" data-act="buyUpg" data-arg="' + u.id + '"' + (ok ? '' : ' disabled') + (why ? ' title="' + esc(why) + '"' : '') + '>' +
            (locked ? '🔒 ' : '') + VE.icon('gold', 15) + c + '</button>';
        }
        h += '</div>';
      }
      h += '</div><div class="mbtns"><button class="btn" data-act="closeModal">Close</button></div>';
      this.openModal(h);
    }
    openTrade() {
      const g = this.game;
      let h = '<h2>⚖️ Travelling Merchants</h2>';
      if (!g.countBuilt('market')) {
        h += '<p>Build a <b>Marketplace</b> (rank Village) to trade with travelling merchants. Sell surplus for gold or buy what you lack.</p>';
      } else {
        h += '<p class="dim">Instant trades. Merchants pay a little less than your market stalls do.</p><div class="tlist">';
        for (const r of VE.RES_ORDER) {
          if (!VE.resVisible(g, r)) continue;
          h += '<div class="trow"><span class="t-name">' + VE.icon(r, 20) + VE.RES[r].name + '</span><span class="t-stock">' + VE.fmt(g.stock[r]) + '</span>' +
            '<button class="btn small" data-act="trade" data-arg="' + r + '" data-n="-1" ' + (g.avail(r) >= 1 ? '' : 'disabled') + '>Sell +' + g.sellPrice(r) + '</button>' +
            '<button class="btn small" data-act="trade" data-arg="' + r + '" data-n="-10" ' + (g.avail(r) >= 10 ? '' : 'disabled') + '>×10</button>' +
            '<button class="btn small good" data-act="trade" data-arg="' + r + '" data-n="1" ' + (g.gold >= g.buyPrice(r) ? '' : 'disabled') + '>Buy −' + g.buyPrice(r) + '</button></div>';
        }
        h += '</div>';
      }
      h += '<div class="mbtns"><button class="btn" data-act="closeModal">Close</button></div>';
      this.openModal(h);
    }
    openMenu() {
      const a = VE.audio;
      this.openModal('<h2>Village Empire</h2><div class="menu-col">' +
        '<button class="btn good" data-act="closeModal">▶ Resume</button>' +
        '<button class="btn" data-act="save">💾 Save now</button>' +
        '<button class="btn" data-act="music">🎵 Music: ' + (a.musicOn ? 'on' : 'off') + '</button>' +
        '<button class="btn" data-act="sfx">🔔 Sounds: ' + (a.sfxOn ? 'on' : 'off') + '</button>' +
        '<button class="btn" data-act="production">📊 Production overview</button>' +
        '<button class="btn" data-act="help">❓ How to play</button>' +
        '<button class="btn" data-act="mainmenu">🏠 Main menu</button>' +
        '<button class="btn bad" data-act="newgame">🌱 Start a new village</button></div>' +
        '<p class="copy">© 2026 Brakeco Games · progress is saved automatically</p>' +
        '<p class="copy version">' + (VE.versionLabel ? VE.versionLabel() : '') + '</p>');
    }
    /* overzicht per goed: voorraad, totaal gemaakt, en welke gebouwen het maken (aantal in je dorp) */
    openProduction() {
      const g = this.game, P = g.stats.produced || {};
      const makers = {};
      for (const k in VE.DEFS) {
        const d = VE.DEFS[k], outs = [];
        if (typeof d.out === 'string') outs.push(d.out);
        else if (d.recipes) for (const r in d.recipes) for (const o in d.recipes[r].out) outs.push(o);
        else if (d.out) for (const o in d.out) outs.push(o);
        for (const o of outs) (makers[o] = makers[o] || []).push(k);
      }
      let h = '<h2>📊 Production overview</h2><div class="plist"><div class="prow head"><span></span><span>In store</span><span>Made</span><span>Made by</span></div>';
      for (const r of VE.RES_ORDER) {
        if (!VE.resVisible(g, r)) continue;
        const by = (makers[r] || []).map(k => '<span class="pm' + (g.countBuilt(k) ? '' : ' none') + '" title="' + esc(VE.DEFS[k].name) + '">' + VE.DEFS[k].icon + (g.countBuilt(k) ? '<small>' + g.countBuilt(k) + '</small>' : '') + '</span>').join('');
        h += '<div class="prow" title="' + esc(resTip(r)) + '"><span class="t-name">' + VE.icon(r, 20) + VE.RES[r].name + '</span><span>' + VE.fmt(g.stock[r] || 0) + '</span><span>' + VE.fmt(P[r] || 0) + '</span><span class="pby">' + (by || '—') + '</span></div>';
      }
      h += '</div><p class="dim small">Grey icons: you have not built that workshop yet.</p><div class="mbtns"><button class="btn" data-act="closeModal">Close</button></div>';
      this.openModal(h);
    }
    openHelp() {
      this.openModal('<h2>How to play</h2><div class="help">' +
        '<p>🏗️ <b>Build</b> from the bar at the bottom. Carriers bring materials and a builder raises the building.</p>' +
        '<p>🛤️ <b>Paths</b> are not built: they wear in by themselves where settlers walk back and forth a lot. A trampled trail turns into a real path, and settlers walk faster on it. Paths that nobody uses grow over again.</p>' +
        '<p>🔗 <b>Production chains</b>: trees ➜ logs ➜ planks · wheat ➜ flour ➜ bread · grapes ➜ wine · game ➜ meat · ore + coal ➜ metal bars.</p>' +
        '<p>🦌 <b>Hunters</b> sneak up on rabbits, roe, deer and wild boar. They always leave enough animals to breed, so game recovers over time.</p>' +
        '<p>⛏️ <b>Mines</b> can only be built on the mountain, above a deposit of their ore: coal, iron, copper or gold. The ore lies underground: while you place a mine, or with <b>🔍 Survey</b> in the Mining tab, coloured stripes show what lies below explored mountains (grey = nothing found). A <b>Smelter</b> turns ore and coal into bars.</p>' +
        '<p>👥 <b>Cottages</b> give room for new settlers. They arrive much faster when bread or fish is in storage.</p>' +
        '<p>⚖️ <b>Marketplace</b>: choose which goods to sell for gold. Gold buys upgrades and watchtowers.</p>' +
        '<p>📜 Complete the <b>Village Charter</b> to rise in rank and unlock new buildings.</p>' +
        '<p>🖱️ <b>Left-drag</b> to move the view · <b>right-drag</b> (or Q/E, two fingers) to rotate · scroll or pinch to zoom · click to select or build · Space: game speed</p></div>' +
        '<div class="mbtns"><button class="btn good" data-act="closeModal">Got it</button></div>');
    }
    confirmNew() {
      this.openModal('<h2>Start a new village?</h2><p>Your current village will be lost forever.</p><div class="mbtns"><button class="btn" data-act="closeModal">Cancel</button><button class="btn bad" data-act="doNew">Start fresh</button></div>');
    }

    /* ---------- HUD ---------- */
    buildResBar() {
      let h = '';
      for (const r of VE.RES_ORDER) h += '<div class="res" id="res_' + r + '" title="' + esc(resTip(r)) + '">' + VE.icon(r, 22) + '<b>0</b></div>';
      $('resBar').innerHTML = h;
      $('goldIco').innerHTML = VE.icon('gold', 24);
      $('popIco').innerHTML = VE.icon('pop', 20);
    }
    refreshHud(force) {
      const g = this.game;
      for (const r of VE.RES_ORDER) {
        const el = $('res_' + r); if (!el) continue;
        const vis = VE.resVisible(g, r);
        if (el.classList.contains('hidden') === vis) el.classList.toggle('hidden', !vis);
        const v = VE.fmt(g.stock[r]);
        const b = el.lastChild; if (b.textContent !== v) b.textContent = v;
        el.classList.toggle('zero', g.stock[r] <= 0);
      }
      $('gold').textContent = VE.fmt(g.gold);
      $('pop').textContent = g.settlers.length + '/' + g.popCap();
      $('rankName').textContent = VE.RANKS[g.rank].name;
      const sig = g.rank + '|' + Math.floor(g.gold / 5) + '|' + VE.RES_ORDER.map(r => Math.min(99, g.avail(r))).join(',') + '|' + this.cat + '|' + this.tool;
      if (force || sig !== this.lastSig.bar) {
        this.lastSig.bar = sig;
        // Only rebuild the DOM when the card set changes; otherwise update in place so a
        // click that is in progress (pointerdown → pointerup) is not lost on a replaced element.
        if (this.lastSig.barStruct !== g.rank + '|' + this.cat || !$('cards').firstChild) this.renderBuildBar();
        else this.updateBuildBar();
      }
      this.renderQuests(force);
      if (this.sel) this.renderInfo(force);
    }
    toast(text) {
      const box = $('toasts');
      if (box.children.length > 3) box.removeChild(box.firstChild);
      const t = document.createElement('div'); t.className = 'toast'; t.textContent = text;
      box.appendChild(t);
      setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 500); }, 2600);
    }
    floater(e) {
      if (!VE.playing || this.floaters.length > 40) return;
      const cam = this.view.cam; if (Math.hypot(e.x - cam.tx, e.z - cam.tz) > cam.dist * 1.1) return;
      const d = document.createElement('div'); d.className = 'floater';
      d.innerHTML = (e.icon ? VE.icon(e.icon, 16) : '') + '<b>' + esc(e.text) + '</b>';
      $('floaters').appendChild(d);
      this.floaters.push({ el: d, x: e.x, y: e.y, z: e.z, t: 0 });
    }
    updateFloaters(dt) {
      const cam = this.view.camera, v = new THREE.Vector3(), W = window.innerWidth, H = window.innerHeight;
      this.floaters = this.floaters.filter(f => {
        f.t += dt;
        if (f.t > 1.7) { f.el.remove(); return false; }
        v.set(f.x, f.y + f.t * 0.45, f.z).project(cam);
        f.el.style.transform = 'translate(' + ((v.x + 1) / 2 * W) + 'px,' + ((1 - v.y) / 2 * H) + 'px) translate(-50%,-50%)';
        f.el.style.opacity = f.t < 1.2 ? 1 : 1 - (f.t - 1.2) / 0.5;
        return true;
      });
    }
    update(dt) {
      this.keyPan(dt);
      this.updateFloaters(dt);
      if (this.selRing.visible) { const s = 1 + Math.sin(performance.now() * 0.005) * 0.04; this.selRing.material.opacity = 0.65 + Math.sin(performance.now() * 0.006) * 0.25; void s; }
      if (VE.Mining) {
        const mineTool = this.tool && VE.DEFS[this.tool] && VE.DEFS[this.tool].mountain, mineSel = this.sel && this.sel.def.mountain;
        VE.Mining.tick(this.game, dt, !!(mineTool || mineSel || this.survey));
      }
      this.hudT = (this.hudT || 0) - dt;
      if (this.hudT <= 0) { this.hudT = 0.3; this.refreshHud(); }
    }
  }
  VE.UI = UI;
})(window.VE);
