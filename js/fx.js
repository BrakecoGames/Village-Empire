/* Village Empire — © 2026 Brakeco Games. All rights reserved. */
'use strict';
(function (VE) {
  const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _o = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  const UP = new THREE.Vector3(0, 1, 0);

  /* ---------------- Settlers (fully instanced) ---------------- */
  class SettlerRender {
    constructor(root, cap) {
      cap = cap || 170; this.cap = cap;
      const g = VE.settlerGeo();
      const mat = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 5, specular: 0x111111 });
      this.torso = new THREE.InstancedMesh(g.torso, mat, cap);
      this.head = new THREE.InstancedMesh(g.head, mat, cap);
      this.hat = new THREE.InstancedMesh(g.hat, mat, cap);
      this.legL = new THREE.InstancedMesh(g.leg, mat, cap);
      this.legR = new THREE.InstancedMesh(g.leg, mat, cap);
      for (let i = 0; i < cap; i++) {
        this.torso.setColorAt(i, _c.setHex(0xb07a45)); this.hat.setColorAt(i, _c.setHex(0xd9b45c));
        this.legL.setColorAt(i, _c.setHex(0x5a4030)); this.legR.setColorAt(i, _c.setHex(0x5a4030));
      }
      this.parts = [this.torso, this.head, this.hat, this.legL, this.legR];
      for (const p of this.parts) { p.count = 0; p.castShadow = true; p.frustumCulled = false; root.add(p); }
      this.tools = {};
      for (const t of ['axe', 'hammer', 'pick', 'spade', 'scythe', 'sickle', 'rod']) {
        const m = new THREE.InstancedMesh(VE.toolGeo(t), mat, 80); m.count = 0; m.frustumCulled = false; m.castShadow = true; root.add(m); this.tools[t] = m;
      }
      this.items = {};
      for (const r of VE.RES_ORDER) {
        const m = new THREE.InstancedMesh(VE.itemGeo(r), mat, 120); m.count = 0; m.frustumCulled = false; m.castShadow = true; root.add(m); this.items[r] = m;
      }
      this.roleCol = {};
      for (const r in VE.ROLES) this.roleCol[r] = [new THREE.Color(VE.ROLES[r][0]), new THREE.Color(VE.ROLES[r][1])];
    }
    toolAngle(s) {
      const lerp = VE.lerp;
      if (s.act === 'chop' || s.act === 'pick') {
        const per = s.act === 'chop' ? 0.75 : 0.6, t = (s.ap % per) / per;
        return t < 0.62 ? lerp(-0.2, -1.4, t / 0.62) : lerp(-1.4, 1.65, (t - 0.62) / 0.38);
      }
      if (s.act === 'hammer') { const t = (s.ap % 0.45) / 0.45; return t < 0.6 ? lerp(0.2, -0.7, t / 0.6) : lerp(-0.7, 1.4, (t - 0.6) / 0.4); }
      if (s.act === 'harvest') return 1.25 + Math.sin(s.ap * 6) * 0.45;
      if (s.act === 'dig') return 2.5 + Math.sin(s.ap * 5) * 0.35;
      if (s.act === 'fish') return 0.85 + Math.sin(s.ap * 1.4) * 0.08;
      if (s.moving) return -0.4 + Math.sin(s.wp) * 0.08;
      return -0.15;
    }
    render(settlers) {
      let n = 0;
      const tc = {}, ic = {};
      const S = 1.28;
      for (const s of settlers) {
        if (s.hidden || n >= this.cap) continue;
        let bob = s.moving ? Math.abs(Math.sin(s.wp)) * 0.02 : 0;
        if (s.act === 'sow' || s.act === 'dig') bob = Math.abs(Math.sin(s.ap * 5)) * 0.012;
        _q.setFromAxisAngle(UP, s.rot);
        let lean = 0;
        if (s.act === 'sow') lean = 0.35;
        if (lean) { const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), lean); _q.multiply(q2); }
        _m.compose(_p.set(s.x, s.y + bob, s.z), _q, _s.set(S, S, S));
        this.torso.setMatrixAt(n, _m); this.head.setMatrixAt(n, _m); this.hat.setMatrixAt(n, _m);
        const role = s.mode === 'build' ? 'builder' : (s.mode === 'work' || s.mode === 'goWork') ? s.role : 'carrier';
        const rc = this.roleCol[role] || this.roleCol.carrier;
        this.torso.setColorAt(n, rc[0]); this.hat.setColorAt(n, rc[1]);
        const sw = s.moving ? Math.sin(s.wp) * 0.75 : 0;
        _l.makeRotationX(sw); _l.setPosition(0.024, 0.095, 0); _o.multiplyMatrices(_m, _l); this.legL.setMatrixAt(n, _o);
        _l.makeRotationX(-sw); _l.setPosition(-0.024, 0.095, 0); _o.multiplyMatrices(_m, _l); this.legR.setMatrixAt(n, _o);
        if (s.tool && this.tools[s.tool]) {
          const tm = this.tools[s.tool]; tc[s.tool] = tc[s.tool] || 0;
          if (tc[s.tool] < 80) {
            _l.makeRotationX(this.toolAngle(s)); _l.setPosition(0.072, 0.11, 0.015); _o.multiplyMatrices(_m, _l);
            tm.setMatrixAt(tc[s.tool]++, _o);
          }
        }
        if (s.carry && this.items[s.carry]) {
          const im = this.items[s.carry]; ic[s.carry] = ic[s.carry] || 0;
          if (ic[s.carry] < 120) {
            _l.makeRotationY(0.3); _l.setPosition(0, 0.375 + (s.moving ? Math.sin(s.wp * 2) * 0.004 : 0), 0); _o.multiplyMatrices(_m, _l);
            im.setMatrixAt(ic[s.carry]++, _o);
          }
        }
        n++;
      }
      for (const p of this.parts) { p.count = n; p.instanceMatrix.needsUpdate = true; }
      this.torso.instanceColor.needsUpdate = true; this.hat.instanceColor.needsUpdate = true;
      for (const t in this.tools) { this.tools[t].count = tc[t] || 0; this.tools[t].instanceMatrix.needsUpdate = true; }
      for (const r in this.items) { this.items[r].count = ic[r] || 0; this.items[r].instanceMatrix.needsUpdate = true; }
    }
  }
  VE.SettlerRender = SettlerRender;

  /* ---------------- particles ---------------- */
  class Puffs {
    constructor(root, color, cap, opacity, detail) {
      this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, detail === undefined ? 1 : detail),
        new THREE.MeshLambertMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false }), cap);
      this.mesh.count = 0; this.mesh.frustumCulled = false; this.cap = cap; this.list = [];
      root.add(this.mesh);
    }
    emit(p) { if (this.list.length >= this.cap) this.list.shift(); p.age = 0; this.list.push(p); }
    update(dt) {
      let n = 0;
      const keep = [];
      for (const p of this.list) {
        p.age += dt; if (p.age >= p.life) continue;
        keep.push(p);
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.g) p.vy -= p.g * dt;
        const t = p.age / p.life;
        let s = VE.lerp(p.s0, p.s1, Math.sqrt(t));
        if (t > 0.75) s *= (1 - t) / 0.25;
        _q.identity();
        _m.compose(_p.set(p.x, p.y, p.z), _q, _s.set(s, s * (p.sy || 1), s));
        this.mesh.setMatrixAt(n++, _m);
      }
      this.list = keep;
      this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  class FX {
    constructor(root, game) {
      this.root = root; this.game = game;
      this.smoke = new Puffs(root, 0xf3f1ec, 260, 0.6, 1);
      this.dust = new Puffs(root, 0xcdb88e, 160, 0.7, 0);
      this.leaves = new Puffs(root, 0x5aa83a, 120, 1.0, 0);
      this.splash = new Puffs(root, 0xe8f6ff, 80, 0.85, 0);
      const bus = VE.bus;
      this.handlers = {
        smoke: e => this.smoke.emit({ x: e.x + (Math.random() - 0.5) * 0.03, y: e.y, z: e.z, vx: 0.12 + Math.random() * 0.05, vy: 0.32 + Math.random() * 0.1, vz: -0.05, life: 3.2, s0: 0.05, s1: 0.2 }),
        dust: e => { for (let i = 0; i < (e.n || 8); i++) { const a = Math.random() * 6.28, sp = 0.4 + Math.random() * 0.6; this.dust.emit({ x: e.x + Math.cos(a) * 0.3, y: e.y + 0.1, z: e.z + Math.sin(a) * 0.3, vx: Math.cos(a) * sp, vy: 0.25 + Math.random() * 0.3, vz: Math.sin(a) * sp, life: 1.1 + Math.random() * 0.5, s0: 0.06, s1: 0.2 }); } },
        leaves: e => { for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28; this.leaves.emit({ x: e.x, y: e.y, z: e.z, vx: Math.cos(a) * 0.6, vy: 0.6 + Math.random() * 0.5, vz: Math.sin(a) * 0.6, g: 1.4, life: 1.4, s0: 0.03, s1: 0.035, sy: 0.4 }); } },
        splash: e => { for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28; this.splash.emit({ x: e.x, y: 0.03, z: e.z, vx: Math.cos(a) * 0.4, vy: 0.9 + Math.random() * 0.5, vz: Math.sin(a) * 0.4, g: 4, life: 0.6, s0: 0.025, s1: 0.03 }); } }
      };
      for (const k in this.handlers) bus.on(k, a => { if (this.game === VE.game) this.handlers[k](a); });
      this.makeBirds(); this.makeClouds(); this.makeButterflies();
    }
    makeBirds() {
      const g = VE.birdGeo();
      const mat = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true });
      const n = 14;
      this.birdBody = new THREE.InstancedMesh(g.body, mat, n);
      this.birdWing = new THREE.InstancedMesh(g.wing, mat, n * 2);
      this.birdBody.frustumCulled = this.birdWing.frustumCulled = false;
      this.birdBody.castShadow = this.birdWing.castShadow = true;
      this.root.add(this.birdBody); this.root.add(this.birdWing);
      this.birds = [];
      const N = VE.N;
      for (let f = 0; f < 3; f++) {
        const cx = 12 + Math.random() * (N - 24), cz = 12 + Math.random() * (N - 24), r = 6 + Math.random() * 8, h = 5 + Math.random() * 3, sp = (0.12 + Math.random() * 0.08) * (Math.random() < 0.5 ? 1 : -1);
        for (let i = 0; i < 4 + f; i++) this.birds.push({ cx: cx, cz: cz, r: r + (Math.random() - 0.5) * 1.2, h: h + (Math.random() - 0.5) * 0.8, a: Math.random() * 0.8 + f, sp: sp, fl: Math.random() * 6, drift: Math.random() * 6 });
      }
      this.birdBody.count = this.birds.length; this.birdWing.count = this.birds.length * 2;
    }
    makeClouds() {
      this.clouds = [];
      const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9a9a9a, transparent: true, opacity: 0.9, flatShading: true });
      const N = VE.N;
      for (let c = 0; c < 8; c++) {
        const m = new VE.Model(60 + c);
        const k = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < k; i++) m.ball(0.8 + Math.random() * 0.9, 0xffffff, { x: i * 1.0 - k * 0.5, y: Math.random() * 0.4, z: (Math.random() - 0.5) * 1.2, sy: 0.65, j: 0.03 }, 1);
        const mesh = new THREE.Mesh(m.build(), mat);
        mesh.position.set(Math.random() * (N + 30) - 15, 11 + Math.random() * 4, Math.random() * (N + 10) - 5);
        const s = 0.8 + Math.random() * 0.8; mesh.scale.set(s, s, s);
        this.root.add(mesh);
        this.clouds.push({ mesh: mesh, sp: 0.25 + Math.random() * 0.2 });
      }
    }
    makeButterflies() {
      const geo = new THREE.PlaneGeometry(0.075, 0.06); geo.translate(0.0375, 0, 0); geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
      const n = 14;
      this.bfL = new THREE.InstancedMesh(geo, mat, n); this.bfR = new THREE.InstancedMesh(geo, mat, n);
      const cols = [0xffd84a, 0xffffff, 0xff9f43, 0x9ad0ff, 0xf78fb3];
      this.bf = [];
      for (let i = 0; i < n; i++) {
        const c = _c.setHex(cols[i % cols.length]); this.bfL.setColorAt(i, c); this.bfR.setColorAt(i, c);
        this.bf.push({ x: 0, z: 0, y: 0.4, tx: 0, tz: 0, hx: 0, hz: 0, ph: Math.random() * 6, rot: 0, t: 0 });
      }
      this.bfL.frustumCulled = this.bfR.frustumCulled = false;
      this.root.add(this.bfL); this.root.add(this.bfR);
      this.bfReady = false;
    }
    placeButterflies() {
      const w = this.game.world, N = VE.N, hq = this.game.hq;
      for (const b of this.bf) {
        for (let t = 0; t < 30; t++) {
          const i = Math.floor(hq.cx + (Math.random() - 0.5) * 18), j = Math.floor(hq.cz + (Math.random() - 0.5) * 18);
          if (!w.inb(i, j)) continue;
          if (w.decoF[j * N + i] || t > 25) { b.hx = b.x = b.tx = i + 0.5; b.hz = b.z = b.tz = j + 0.5; break; }
        }
      }
      this.bfReady = true;
    }
    update(dt, t) {
      this.smoke.update(dt); this.dust.update(dt); this.leaves.update(dt); this.splash.update(dt);
      // birds
      let n = 0;
      for (const b of this.birds) {
        b.a += b.sp * dt; b.fl += dt * (9 + Math.sin(t * 0.7 + b.drift) * 3);
        const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r, y = b.h + Math.sin(t * 0.5 + b.drift) * 0.4;
        const heading = Math.atan2(-Math.sin(b.a) * Math.sign(b.sp), Math.cos(b.a) * Math.sign(b.sp));
        _q.setFromAxisAngle(UP, heading);
        _m.compose(_p.set(x, y, z), _q, _s.set(1.3, 1.3, 1.3));
        this.birdBody.setMatrixAt(n, _m);
        const fl = Math.sin(b.fl) * 0.7;
        _l.makeRotationZ(fl); _l.setPosition(0.02, 0.0, 0); _o.multiplyMatrices(_m, _l); this.birdWing.setMatrixAt(n * 2, _o);
        _l.makeRotationY(Math.PI); const r2 = new THREE.Matrix4().makeRotationZ(-fl); _l.premultiply(r2); _l.setPosition(-0.02, 0.0, 0); _o.multiplyMatrices(_m, _l); this.birdWing.setMatrixAt(n * 2 + 1, _o);
        n++;
      }
      this.birdBody.instanceMatrix.needsUpdate = true; this.birdWing.instanceMatrix.needsUpdate = true;
      // clouds
      for (const c of this.clouds) {
        c.mesh.position.x += c.sp * dt;
        if (c.mesh.position.x > VE.N + 18) c.mesh.position.x = -18;
      }
      // butterflies
      if (!this.bfReady && this.game.hq) this.placeButterflies();
      const w = this.game.world;
      n = 0;
      for (const b of this.bf) {
        b.t -= dt;
        if (b.t <= 0) { b.t = 1.5 + Math.random() * 3; b.tx = b.hx + (Math.random() - 0.5) * 3; b.tz = b.hz + (Math.random() - 0.5) * 3; }
        const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
        if (d > 0.05) { b.x += dx / d * dt * 0.45; b.z += dz / d * dt * 0.45; b.rot = Math.atan2(dx, dz); }
        b.ph += dt * 18;
        const y = w.heightAt(b.x, b.z) + 0.35 + Math.sin(t * 2 + b.hx) * 0.12;
        _q.setFromAxisAngle(UP, b.rot);
        _m.compose(_p.set(b.x, y, b.z), _q, _s.set(1, 1, 1));
        const f = Math.sin(b.ph) * 1.1;
        _l.makeRotationZ(f); _o.multiplyMatrices(_m, _l); this.bfL.setMatrixAt(n, _o);
        _l.makeRotationZ(Math.PI - f); _o.multiplyMatrices(_m, _l); this.bfR.setMatrixAt(n, _o);
        n++;
      }
      this.bfL.instanceMatrix.needsUpdate = true; this.bfR.instanceMatrix.needsUpdate = true;
    }
  }
  VE.FX = FX;
})(window.VE);
