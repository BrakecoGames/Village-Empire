/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Interface voor de kazerne en de soldaten (aanvulling op js/ui.js).

   Kazernepaneel: soldaten in het dorp, beschikbare wapens en uitrusting, per type de kosten en
   eigenschappen met knoppen om 1 of 5 te trainen, de wachtrij met voortgang (✖ = afbreken, goud terug).

   Soldaten besturen:
   - tik / klik op een soldaat: selecteren; shift- of ctrl-klik: erbij of eraf; dubbeltik: alle soldaten van
     dat type in beeld; ⚔️-knop rechtsboven: alle soldaten;
   - kader trekken: shift-slepen (muis) of de knop 'Drag to select' (ook op touch);
   - met soldaten geselecteerd: tik op de grond (of rechtsklik) = daarheen lopen en wachten, in formatie;
     modus 'Patrol': heen en weer tussen hun plek en de gekozen plek; 'Hold': blijven staan. */
'use strict';
(function (VE) {
  const $ = id => document.getElementById(id);
  const SOL = VE.SOLDIERS, ORDER = VE.SOLDIER_ORDER;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const U = VE.UI.prototype;
  const _v = new THREE.Vector3();
  const QUEUE_SHOW = 10;
  /* korte eigenschappen voor kaartjes en het soldatenpaneel */
  const statRow = S => '<span title="Health">❤️' + S.hp + '</span><span title="Attack (damage per hit)">⚔️' + S.atk + '</span>' +
    '<span title="Attack speed (hits per second)">⏱️' + S.rate + '</span><span title="Range (tiles)">🎯' + S.range + '</span>' +
    '<span title="Defence">🛡️' + S.def + '</span><span title="Move speed">👟' + S.speed + '</span>';
  const ordText = o => o.ord === 'patrol' ? 'patrolling' : 'holding position';

  U.armyInit = function () {
    if (this._armyInit) return;
    this._armyInit = true;
    this.army = this.army || new Set();
    this.armyMode = 'move';
    const scene = this.view.scene;
    const ring = new THREE.RingGeometry(0.14, 0.19, 24); ring.rotateX(-Math.PI / 2);
    const rmat = new THREE.MeshBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide });
    rmat.toneMapped = false;
    this.armyRings = new THREE.InstancedMesh(ring, rmat, 200);
    this.armyRings.count = 0; this.armyRings.frustumCulled = false; this.armyRings.renderOrder = 6; this.armyRings.name = 'armyRings';
    scene.add(this.armyRings);
    const mk = new THREE.RingGeometry(0.22, 0.3, 32); mk.rotateX(-Math.PI / 2);
    const mmat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide });
    mmat.toneMapped = false;
    this.armyMark = new THREE.Mesh(mk, mmat); this.armyMark.visible = false; this.armyMark.renderOrder = 6; scene.add(this.armyMark);
    const lmat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.75, depthTest: false });
    lmat.toneMapped = false;
    this.armyLines = new THREE.LineSegments(new THREE.BufferGeometry(), lmat); this.armyLines.renderOrder = 6; this.armyLines.frustumCulled = false;
    scene.add(this.armyLines);
    // zolang een knop in het infopaneel wordt ingedrukt, bouwen we het paneel niet opnieuw op (anders geen klik)
    const ip = $('infoPanel');
    ip.addEventListener('pointerdown', () => { this.panelDown = true; });
    const up = () => setTimeout(() => { this.panelDown = false; }, 0);
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    const box = document.createElement('div'); box.id = 'boxSel'; box.className = 'hidden'; document.body.appendChild(box);
    this.boxEl = box;
    const btn = $('btnArmy');
    if (btn) btn.addEventListener('click', () => {
      VE.audio.play('click');
      const g = this.game, all = g.soldiers();
      if (!all.length) { this.toast(g.countBuilt('barracks') ? '🛡️ Train soldiers at your Barracks' : '🛡️ Build a Barracks to train soldiers'); return; }
      if (this.army.size === all.length) { this.clearArmy(); return; }
      this.selectArmy(all);
      this.focusArmy();
    });
  };

  /* ---------- selecteren ---------- */
  U.screenOf = function (s) {
    const r = this.view.renderer.domElement.getBoundingClientRect();
    _v.set(s.x, s.y + 0.2, s.z).project(this.view.camera);
    return { x: r.left + (_v.x + 1) / 2 * r.width, y: r.top + (1 - _v.y) / 2 * r.height, ok: _v.z < 1 };
  };
  /* soldaat onder (cx, cy): afstand tot het lijnstuk voeten–helm op het scherm (de hele figuur telt) */
  U.soldierAtScreen = function (cx, cy, rad) {
    const r = this.view.renderer.domElement.getBoundingClientRect(), cam = this.view.camera;
    const sp = (x, y, z) => { _v.set(x, y, z).project(cam); return [r.left + (_v.x + 1) / 2 * r.width, r.top + (1 - _v.y) / 2 * r.height, _v.z < 1]; };
    let best = null, bd = rad * rad;
    for (const s of this.game.settlers) {
      if (s.mode !== 'soldier') continue;
      const a = sp(s.x, s.y + 0.04, s.z), b = sp(s.x, s.y + 0.5, s.z); if (!a[2]) continue;
      const vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((cx - a[0]) * vx + (cy - a[1]) * vy) / L));
      const d = (a[0] + vx * t - cx) ** 2 + (a[1] + vy * t - cy) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  };
  U.selectArmy = function (list, add) {
    this.armyInit();
    if (!add) this.army.clear();
    for (const s of list) if (s && s.mode === 'soldier' && s.owner === this.game.me) this.army.add(s);
    if (!this.army.size) { this.clearArmy(); return; }
    if (this.sel) this.select(null);
    this.armyMode = 'move';
    this.renderArmy(true);
    VE.audio.play('open');
  };
  U.clearArmy = function () {
    if (!this.army || !this.army.size) return;
    this.army.clear();
    this.lastArmy = null;
    if (!this.sel) this.hideInfo();
  };
  U.focusArmy = function () {
    let x = 0, z = 0, n = 0; for (const s of this.army) { x += s.x; z += s.z; n++; }
    if (n) this.view.cam.focus(x / n, z / n);
  };
  /* tik: een soldaat kiezen, of (met soldaten geselecteerd) een bevel op de grond geven */
  U.tapArmy = function (cx, cy, p, ptype, ev) {
    this.armyInit();
    const hit = this.soldierAtScreen(cx, cy, ptype === 'mouse' ? 22 : 34);
    if (hit) {
      const now = ev && ev.timeStamp ? ev.timeStamp : performance.now(), dbl = this.lastSolTap && this.lastSolTap.s === hit && now - this.lastSolTap.t < 400;
      this.lastSolTap = { s: hit, t: now };
      if (dbl) {                                               // dubbeltik: alle soldaten van dit type in beeld
        const W = window.innerWidth, H = window.innerHeight;
        this.selectArmy(this.game.soldiers(hit.sol.t).filter(s => { const q = this.screenOf(s); return q.ok && q.x > 0 && q.y > 0 && q.x < W && q.y < H; }));
      } else if (ev && (ev.shiftKey || ev.ctrlKey || ev.metaKey) && this.army.size) {
        if (this.army.has(hit)) { this.army.delete(hit); if (!this.army.size) this.clearArmy(); else this.renderArmy(true); }
        else this.selectArmy([hit], true);
      } else this.selectArmy([hit]);
      return true;
    }
    if (!this.army.size) return false;
    if (p.b && !p.b.def.pile) { this.clearArmy(); return false; }        // een gebouw: dat selecteren
    if (p.i >= 0) { this.orderArmy(p.x, p.z); return true; }
    return false;
  };
  U.orderArmyAt = function (cx, cy) {
    const p = this.pick(cx, cy);
    if (p && p.i >= 0) this.orderArmy(p.x, p.z);
  };
  U.orderArmy = function (x, z) {
    const g = this.game, list = [...this.army], mode = this.armyMode;
    if (mode === 'patrol') this.armyMode = 'move';
    g.issue({ type: 'moveUnits', unitIds: list.map(s => s.id), targetX: x, targetZ: z, mode: mode === 'patrol' ? 'patrol' : 'hold' }, r => {
      if (!r.ok) { this.toast('🚫 Your soldiers cannot get there'); VE.audio.play('error'); return; }
      const n = r.moved;
      this.armyMark.visible = true; this.armyMark.userData.t = 0; this.armyMark.position.set(x, g.world.heightAt(x, z) + 0.05, z);
      if (mode === 'patrol') this.toast('🔁 ' + (n > 1 ? n + ' soldiers patrol' : 'Patrolling') + ' between here and there');
      this.renderArmy(true);
    });
  };

  /* ---------- kader trekken ---------- */
  U.boxWanted = function (e) {
    this.armyInit();
    if (this.tool) return false;
    return !!this.boxArm || (e.pointerType === 'mouse' && e.shiftKey);
  };
  U.boxMove = function (p) {
    const el = this.boxEl; el.classList.remove('hidden');
    const x0 = Math.min(p.sx, p.x), y0 = Math.min(p.sy, p.y);
    el.style.left = x0 + 'px'; el.style.top = y0 + 'px'; el.style.width = Math.abs(p.x - p.sx) + 'px'; el.style.height = Math.abs(p.y - p.sy) + 'px';
  };
  U.boxEnd = function (p, e) {
    this.boxCancel();
    const x0 = Math.min(p.sx, p.x), x1 = Math.max(p.sx, p.x), y0 = Math.min(p.sy, p.y), y1 = Math.max(p.sy, p.y);
    const list = this.game.soldiers().filter(s => { const q = this.screenOf(s); return q.ok && q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1; });
    if (!list.length) { this.toast('No soldiers in that area'); return; }
    this.selectArmy(list, e && (e.ctrlKey || e.metaKey));
  };
  U.boxCancel = function () { this.boxArm = false; if (this.boxEl) this.boxEl.classList.add('hidden'); };

  /* ---------- panelen ---------- */
  U.renderArmy = function (force) {
    this.armyInit();
    for (const s of [...this.army]) if (s.mode !== 'soldier') this.army.delete(s);
    if (!this.army.size) { this.clearArmy(); return; }
    const list = [...this.army], c = {};
    for (const s of list) c[s.sol.t] = (c[s.sol.t] || 0) + 1;
    const types = ORDER.filter(t => c[t]), one = list.length === 1 ? list[0] : null, S1 = types.length === 1 ? SOL[types[0]] : null;
    const moving = list.filter(s => s.path).length, patrol = list.filter(s => s.sol.ord === 'patrol').length;
    const status = moving ? (moving === list.length ? 'Marching' : moving + ' marching') : patrol ? (patrol === list.length ? 'Patrolling' : patrol + ' patrolling') : 'Holding position';
    let h = '<div class="ip-head"><span class="ip-icon">' + (S1 ? S1.icon : '🛡️') + '</span><div class="ip-tt"><div class="ip-title">' +
      (one ? esc(S1.name) : list.length + ' ' + (S1 ? esc(S1.name.toLowerCase()) + (S1.name.endsWith('n') ? '' : 's') : 'soldiers')) + '</div>' +
      '<div class="ip-status">' + status + '</div></div><button class="x" data-act="armyClear">✕</button></div>';
    if (S1) {
      h += '<div class="sstats">' + statRow(S1) + '</div>';
      if (one) { const pct = Math.round(100 * one.sol.hp / S1.hp); h += '<div class="bar hp"><i style="width:' + pct + '%"></i><span>Health ' + Math.round(one.sol.hp) + ' / ' + S1.hp + '</span></div>'; }
      h += '<div class="ip-desc small">' + esc(S1.tip) + '</div>';
    }
    if (types.length > 1) {
      h += '<div class="ip-row wrap chips">';
      for (const t of types) h += '<button class="chip" data-act="armyType" data-arg="' + t + '" title="Keep only the ' + esc(SOL[t].name.toLowerCase()) + 's selected">' + VE.icon(SOL[t].weapon, 16) + '<b>' + c[t] + '</b> ' + esc(SOL[t].name) + '</button>';
      h += '</div>';
    }
    const m = this.armyMode;
    h += '<div class="ip-sub">Orders</div><div class="orders">' +
      '<button class="btn small' + (m === 'move' ? ' on' : '') + '" data-act="armyMode" data-arg="move" title="Tap the ground: walk there and wait">🚶 Move</button>' +
      '<button class="btn small' + (m === 'patrol' ? ' on' : '') + '" data-act="armyMode" data-arg="patrol" title="Tap the ground: walk back and forth between here and there">🔁 Patrol</button>' +
      '<button class="btn small" data-act="armyHold" title="Stop and wait here">✋ Hold</button></div>';
    h += '<div class="ip-desc small hint">' + (m === 'patrol' ? '🔁 Tap a spot: they patrol between their place and that spot.' : (VE.isMobile ? '👆 Tap the ground to send them there.' : '👆 Click the ground (or right-click) to send them there.')) + '</div>';
    h += '<div class="ip-btns"><button class="btn small" data-act="armyAll">⚔️ All soldiers</button><button class="btn small" data-act="boxSel">⬚ Drag to select</button>' +
      '<button class="btn small" data-act="armyFocus">🎯 Show</button><button class="btn small bad" data-act="armyDismiss" title="They become settlers again; their weapons go back to storage">Dismiss</button></div>';
    const el = $('infoPanel');
    if (!force && this.panelDown) return;
    if (force || h !== this.lastArmy) { el.innerHTML = h; this.lastArmy = h; this.lastInfo = null; }
    el.classList.add('armyp');
    el.classList.remove('hidden');
  };

  /* kazerne: soldaten, wapens, trainen en wachtrij (in het infopaneel van het gebouw) */
  const ri = U.renderInfo;
  U.renderInfo = function (force) { document.getElementById('infoPanel').classList.remove('armyp'); this.lastArmy = null; return ri.call(this, force); };
  U.barracksHtml = function (b) {
    const g = this.game, cnt = g.soldierCount(), Q = g.queueOf(b);
    let h = '<div class="ip-row wrap"><b>Soldiers</b><span class="cost">🛡️' + cnt.total + '</span>';
    for (const t of ORDER) if (cnt[t]) h += '<span class="cost" title="' + esc(SOL[t].name) + '">' + VE.icon(SOL[t].weapon, 14) + cnt[t] + '</span>';
    if (cnt.total) h += '<button class="btn small" data-act="armyAll">Select</button>';
    h += '</div><div class="ip-row wrap"><b>Weapons</b>';
    for (const r of VE.WEAPONS.concat(['gear'])) {
      const here = b.input[r] || 0, av = g.avail(r);
      h += '<span class="cost' + (here + av ? '' : ' dim') + '" title="' + esc(VE.RES[r].name) + ': ' + av + ' in your village' + (here ? ', ' + here + ' at the barracks' : '') + '">' + VE.icon(r, 15) + av + (here ? '<small class="here">+' + here + '</small>' : '') + '</span>';
    }
    h += '</div><div class="ip-sub">Train soldiers</div><div class="tgrid">';
    for (const t of ORDER) {
      const S = SOL[t], q = Q.filter(e => e.t === t).length, ok = g.gold >= S.gold;
      h += '<div class="tcard" title="' + esc(S.tip) + '"><div class="tc-head">' + VE.icon(S.weapon, 22) + '<b>' + esc(S.name) + '</b>' + (q ? '<span class="tq-n">' + q + '</span>' : '') + '</div>' +
        '<div class="tc-cost">' + VE.icon(S.weapon, 13) + '1 ' + VE.icon('gear', 13) + S.gear + ' <span class="' + (ok ? '' : 'short') + '">' + VE.icon('gold', 13) + S.gold + '</span> · ' + Math.round(S.time) + 's</div>' +
        '<div class="sstats mini">' + statRow(S) + '</div>' +
        '<div class="tc-btns"><button class="btn small good" data-act="trainQ" data-arg="' + t + '" data-n="1"' + (ok ? '' : ' disabled') + '>+1</button>' +
        '<button class="btn small" data-act="trainQ" data-arg="' + t + '" data-n="5"' + (g.gold >= S.gold * 5 ? '' : ' disabled') + '>+5</button></div></div>';
    }
    h += '</div>';
    if (Q.length) {
      h += '<div class="ip-sub">Training queue (' + Q.length + ')</div><div class="tqueue">';
      Q.slice(0, QUEUE_SHOW).forEach(e => {
        const S = SOL[e.t];
        let st;
        // breedte zet U.update elk frame: zo verandert de html niet tijdens het trainen (knoppen blijven klikbaar)
        if (e.st === 'train') st = '<div class="bar mini"><i data-qp="' + e.id + '"></i></div>';
        else if (e.st === 'wait' || e.st === 'gate') st = '<span class="dim">waiting for ' + esc(VE.RES[S.weapon].name.toLowerCase()) + '</span>';
        else if (e.s) st = '<span class="dim">walking to the barracks</span>';
        else if (e.cov) st = '<span class="dim">waiting for a volunteer</span>';
        else {
          const miss = Object.keys(g.trainNeeds(e.t)).find(r => (b.input[r] || 0) + (b.incoming[r] || 0) + g.avail(r) < g.trainNeeds(e.t)[r]);
          st = miss ? '<span class="short">needs ' + esc(VE.RES[miss].name.toLowerCase()) + '</span>' : '<span class="dim">carriers bring the weapons</span>';
        }
        h += '<div class="tq">' + VE.icon(S.weapon, 16) + '<span class="tq-name">' + esc(S.name) + '</span>' + st + '<button class="x small" data-act="trainCancel" data-arg="' + e.id + '" title="Cancel: gold back">✕</button></div>';
      });
      if (Q.length > QUEUE_SHOW) h += '<div class="dim small">+ ' + (Q.length - QUEUE_SHOW) + ' more</div>';
      h += '</div>';
    }
    return h;
  };

  U.onArmyAct = function (a, arg, el, e) {
    const g = this.game;
    switch (a) {
      case 'trainQ': {
        const b = this.sel; if (!b || !b.def.barracks) return;
        g.issue({ type: 'trainUnit', buildingId: b.id, unitType: arg, count: +el.dataset.n || 1 }, r => {
          if (!r.ok) { this.toast(g.gold < SOL[arg].gold ? '💰 Not enough gold' : 'The training queue is full'); VE.audio.play('error'); }
          else { VE.audio.play('coin'); VE.save(); }
          this.renderInfo(true);
        });
        break;
      }
      case 'trainCancel': if (this.sel && this.sel.queue) g.issue({ type: 'cancelTraining', buildingId: this.sel.id, entryId: +arg }, r => { if (r.ok) { this.toast('Training cancelled: gold returned'); VE.save(); } this.renderInfo(true); }); break;
      case 'armyAll': { const all = g.soldiers(); if (all.length) { this.selectArmy(all); this.focusArmy(); } break; }
      case 'armyType': this.selectArmy([...this.army].filter(s => s.sol.t === arg)); break;
      case 'armyMode': this.armyMode = arg; this.renderArmy(true); break;
      case 'armyHold': g.issue({ type: 'holdUnits', unitIds: [...this.army].map(s => s.id) }, () => { this.toast('✋ Holding position'); this.renderArmy(true); }); break;
      case 'armyFocus': this.focusArmy(); break;
      case 'boxSel': this.boxArm = true; this.toast('⬚ Drag a box around your soldiers'); break;
      case 'armyClear': this.clearArmy(); break;
      case 'armyDismiss':
        this.openModal('<h2>Dismiss ' + (this.army.size > 1 ? this.army.size + ' soldiers' : 'this soldier') + '?</h2><p>They become ordinary settlers again. Their weapons go back to storage; the training gear is used up.</p>' +
          '<div class="mbtns"><button class="btn" data-act="closeModal">Keep them</button><button class="btn bad" data-act="armyDismissYes">Dismiss</button></div>');
        break;
      case 'armyDismissYes': { const ids = [...this.army].map(s => s.id); this.closeModal(); this.clearArmy(); g.issue({ type: 'dismissUnits', unitIds: ids }, r => { const n = r.dismissed || 0; if (n) { this.toast('Dismissed ' + n + ' soldier' + (n > 1 ? 's' : '')); VE.save(); } }); break; }
    }
  };

  /* ---------- elk frame: ringen, doelmarkering, patrouilleroutes, voortgang ---------- */
  U.armyHud = function () {
    this.armyInit();
    const btn = $('btnArmy'), g = this.game; if (!btn) return;
    const n = g.soldierCount().total, show = n > 0 || g.rank >= 2;
    if (btn.classList.contains('hidden') === show) btn.classList.toggle('hidden', !show);
    const b = $('armyBadge'); if (b) { const t = n ? String(n) : ''; if (b.textContent !== t) b.textContent = t; b.classList.toggle('hidden', !n); }
  };
  const _m = new THREE.Matrix4();
  const upd = U.update;
  U.update = function (dt) {
    upd.call(this, dt);
    this.armyInit();
    const g = this.game; if (!g) return;
    // geselecteerde soldaten: ring eronder
    let n = 0;
    const pts = [];
    for (const s of this.army) {
      if (s.mode !== 'soldier') continue;
      if (n < 200) { _m.makeTranslation(s.x, s.y + 0.03, s.z); this.armyRings.setMatrixAt(n++, _m); }
      const o = s.sol;
      if (o.ord === 'patrol' && o.pts) {
        const a = o.pts[0], c = o.pts[1], w = g.world;
        pts.push(a[0], w.heightAt(a[0], a[1]) + 0.06, a[1], c[0], w.heightAt(c[0], c[1]) + 0.06, c[1]);
      }
    }
    this.armyRings.count = n; this.armyRings.instanceMatrix.needsUpdate = true;
    this.armyRings.material.opacity = 0.65 + Math.sin(performance.now() * 0.006) * 0.25;
    this.armyLines.visible = pts.length > 0;
    if (pts.length) { this.armyLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); this.armyLines.geometry.computeBoundingSphere(); }
    // doelmarkering: kort uitdijende ring
    const mk = this.armyMark;
    if (mk.visible) { mk.userData.t += dt; const t = mk.userData.t; mk.scale.setScalar(0.6 + t * 1.4); mk.material.opacity = Math.max(0, 0.9 - t * 0.75); if (t > 1.2) mk.visible = false; }
    // wachtrij in het kazernepaneel: voortgangsbalken bijwerken zonder het paneel opnieuw op te bouwen
    if (this.sel && this.sel.def.barracks && this.sel.queue) {
      const bars = document.querySelectorAll('#infoPanel [data-qp]');
      for (const el of bars) { const e = this.sel.queue.find(q => q.id === +el.dataset.qp); if (e) el.style.width = Math.min(100, Math.round(100 * e.p / SOL[e.t].time)) + '%'; }
    }
  };
})(window.VE);
