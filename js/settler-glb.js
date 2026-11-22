/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Dorpelingen uit Blender (public/models/settler.glb): gedeeld rig + losse delen + animatieclips.

   Rendering: elk deel (lichaam, gezicht, kapsel, hoed, arm, been, easter egg …) is één InstancedMesh
   voor ALLE bewoners, met het gedeelde vertex-color-materiaal. Per bewoner wordt de Blender-animatie
   op de CPU gesampled (10 rig-nodes) en in de instance-matrices verwerkt. Zo blijft het aantal draw
   calls klein en vast, ook met honderden bewoners. Kleuren per bewoner via instanceColor ('Tint').

   Gedrag: dezelfde spelstatus als de oude renderer (s.act / s.ap, s.carry, s.moving / s.wp, s.mode,
   s.role, s.tool, s.hidden). De ritmes van de werkclips volgen de vaste periodes uit de simulatie,
   zodat de klap en het geluid samenvallen.

   Fallback: laadt de GLB niet, dan blijft VE.SettlerRender (procedureel) in gebruik. */
'use strict';
(function (VE) {
  const URL = 'public/models/settler.glb' + (VE.VERSION ? '?v=' + VE.VERSION : '');
  const S = 1.28;                     // zelfde schaal als de oude dorpelingen
  const TAU = Math.PI * 2;
  // perioden (s) van de werkbewegingen in de simulatie (zie oude SettlerRender.toolAngle / sim.js)
  const ACT_PERIOD = { chop: 0.75, pick: 0.6, hammer: 0.45, harvest: TAU / 6, dig: TAU / 5, sow: TAU / 5, fish: TAU / 1.4, hunt: 1.8 };
  // werkclip die (nog) niet in settler.glb zit: een clip die erop lijkt
  const ACT_ALIAS = { hunt: 'sow' };
  const BLEND = 0.18;                 // overvloeitijd tussen clips (s)
  const LOD_FAR = 24;                 // verder dan dit (camera-afstand): geen eggs/baarden, halve animatie-update

  // kleuren (wit 'Tint'-materiaal × deze kleuren)
  const C = h => new THREE.Color(h);
  const SKIN = [0xf6d2b0, 0xeec29a, 0xe2b089, 0xd9a47e, 0xb98563, 0x8d5f43].map(C);
  const HAIR = [0x6b4423, 0x2e2018, 0xd9a441, 0xb8582a, 0xb3aea6, 0x4a2e1a, 0xe8d8b0].map(C);
  const PANTS = [0x5a4030, 0x4a566c, 0x6e5c3a, 0x44503a, 0x6a3a3a].map(C);
  const BOOTS = [0x4a3020, 0x3a2a1e, 0x5e3c24].map(C);
  const SOCK_FUN = [0xd8402f, 0x3f7fbf, 0x6aaa3e, 0xf2c230].map(C);
  const WHITE = new THREE.Color(1, 1, 1);

  // hoed per beroep (deelnaam zonder 'head__')
  const HAT = {
    carrier: 'hat_straw', builder: 'hat_hood', woodcutter: 'hat_beanie', forester: 'hat_feather', mason: 'hat_helmet',
    farmer: 'hat_wide', miller: 'hat_floppy', baker: 'hat_toque', fisher: 'hat_souwester', vintner: 'hat_beret',
    merchant: 'hat_bycocket', innkeeper: 'hat_bandana', sawyer: 'hat_flatcap', guard: 'hat_kettle', hunter: 'hat_feather', miner: 'hat_helmet', smelter: 'hat_bandana'
  };
  const APRON = new Set(['baker', 'miller', 'innkeeper', 'sawyer', 'smelter']);
  /* Easter eggs: ~13% van de bewoners krijgt er één (vast per bewoner en beroep).
     part: extra deel; hat/beard: vervangt hoed/baard; fx: speciaal effect. roles: alleen voor die beroepen. */
  const EGGS = [
    { id: 'socks', fx: 'socks' },                                         // twee verschillende sokken/laarzen
    { id: 'bigmustache', beard: 'egg_bigmustache', roles: ['woodcutter'] },
    { id: 'carrot', part: 'head__egg_carrot', roles: ['farmer'] },
    { id: 'duck', part: 'head__egg_duck' },
    { id: 'pencil', part: 'head__egg_pencil', roles: ['builder', 'sawyer'] },
    { id: 'tilt', fx: 'tilt', roles: ['mason'] },                         // scheef hangende helm
    { id: 'teddy', part: 'torso__egg_teddy' },
    { id: 'toque', hat: 'egg_tall_toque', roles: ['baker'] },
    { id: 'logo', part: 'torso__egg_logo' },                              // verstopt Brakeco-logo
    { id: 'monocle', part: 'head__egg_monocle', roles: ['merchant', 'carrier', 'innkeeper', 'vintner'] },
    // eigen vondsten
    { id: 'bee', part: 'head__egg_bee', fx: 'bee' },                      // bijtje dat rond het hoofd zoemt
    { id: 'snail', part: 'head__egg_snail' },                             // slakje lift mee op de hoed
    { id: 'nest', part: 'head__egg_nest' },                               // vogelnestje met eitjes op de hoed
    { id: 'frog', part: 'torso__egg_frog' },                              // kikker op de schouder
    { id: 'eyepatch', part: 'head__egg_eyepatch', roles: ['fisher', 'carrier'] },
    { id: 'bandaid', part: 'head__egg_bandaid', roles: ['woodcutter', 'builder', 'mason'] },   // pleister op de neus
    { id: 'flower', part: 'head__egg_flower' },                           // bloemetje in de hoedband
    { id: 'spoon', part: 'head__egg_spoon', roles: ['innkeeper', 'baker', 'carrier'] },        // lepel in de hoed
    { id: 'quill', part: 'head__egg_quill', roles: ['merchant', 'guard'] },                    // ganzenveer achter het oor
    { id: 'nightcap', hat: 'egg_nightcap', roles: ['carrier'] },          // vergeten de slaapmuts af te zetten
    { id: 'braid', beard: 'egg_braid' },                                  // gevlochten baard met strikje
    { id: 'lantern', part: 'torso__egg_lantern', roles: ['guard', 'miller', 'carrier'] },
    { id: 'horseshoe', part: 'torso__egg_horseshoe' },                    // gelukshoefijzer aan de riem
    { id: 'apple', part: 'torso__egg_apple' },                            // appeltje voor onderweg
    { id: 'cheese', part: 'torso__egg_cheese', roles: ['miller', 'farmer', 'carrier'] },
    { id: 'leek', part: 'torso__egg_leek', roles: ['carrier', 'farmer'] },                     // prei uit de rugzak
    { id: 'patch', part: 'legR__egg_patch' }                              // roze lap op de knie
  ];
  const EGG_RATE = 13;                // procent

  const hash = (a, b) => { let h = Math.imul((a + 1) ^ Math.imul(b + 7, 0x9e3779b1), 2654435761) >>> 0; h ^= h >>> 15; return Math.imul(h, 0x85ebca6b) >>> 0; };

  /* ---------------- laden en voorbereiden ---------------- */
  function prepare(gltf) {
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);
    // rig-nodes: ouders eerst
    const nodes = [], idx = {};
    const walk = o => {
      if (o.name && o.name.indexOf('rig_') === 0) {
        const name = o.name.slice(4);
        idx[name] = nodes.length;
        let p = o.parent; while (p && !(p.name && p.name.indexOf('rig_') === 0)) p = p.parent;
        nodes.push({ name: name, parent: p ? idx[p.name.slice(4)] : -1, pos: o.position.clone(), quat: o.quaternion.clone(),
          restWorld: o.matrixWorld.clone() });
      }
      for (const c of o.children) walk(c);
    };
    walk(scene);
    if (!nodes.length) throw new Error('geen rig_-nodes in settler.glb');
    /* Rustpose zelf bepalen: de exporter laat de rig-nodes in de pose van de laatst geëvalueerde
       NLA-track staan (niet in rust). De delen zijn in rust gemodelleerd: geen rotatie, posities
       uit de idle-clip op t = 0 (of de nodepositie als die ontbreekt). */
    const idleClip = gltf.animations.find(a => a.name === 'idle');
    for (const n of nodes) {
      const tr = idleClip && idleClip.tracks.find(t => t.name === 'rig_' + n.name + '.position');
      if (tr) n.pos.set(tr.values[0], tr.values[1], tr.values[2]);
      n.quat.identity();
    }
    for (const n of nodes) {
      const local = new THREE.Matrix4().compose(n.pos, n.quat, new THREE.Vector3(1, 1, 1));
      n.restWorld = n.parent < 0 ? local : new THREE.Matrix4().multiplyMatrices(nodes[n.parent].restWorld, local);
    }
    // delen: '<node>__<naam>' → geometrie in de lokale ruimte van die rig-node
    const parts = {};
    const inv = new THREE.Matrix4();
    scene.traverse(o => {
      // alleen delen op het hoogste niveau (bij meerdere materialen maakt GLTFLoader kind-meshes aan)
      if (o.parent !== scene || !o.name || o.name.indexOf('__') < 0 || o.name.indexOf('rig_') === 0) return;
      const [node, name] = o.name.split('__');
      if (idx[node] === undefined || parts[o.name]) return;
      const geo = VE.bakeGlbNode(o, 90 + Object.keys(parts).length);
      if (!geo) return;
      inv.copy(nodes[idx[node]].restWorld).invert();
      geo.applyMatrix4(inv);
      geo.computeBoundingSphere();
      parts[o.name] = { node: idx[node], geo: geo, name: name };
    });
    // clips: per node een interpolant voor positie en rotatie
    const clips = {};
    for (const clip of gltf.animations) {
      const per = nodes.map(() => ({ p: null, q: null }));
      for (const tr of clip.tracks) {
        const dot = tr.name.lastIndexOf('.'), nodeName = tr.name.slice(0, dot), prop = tr.name.slice(dot + 1);
        const id = idx[nodeName.replace(/^rig_/, '')];
        if (id === undefined) continue;
        if (prop === 'quaternion') per[id].q = tr.createInterpolant();
        else if (prop === 'position') per[id].p = tr.createInterpolant();
      }
      clips[clip.name] = { dur: clip.duration, per: per };
    }
    return { nodes: nodes, idx: idx, parts: parts, clips: clips };
  }

  /* ---------------- renderer ---------------- */
  const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(),
    _p = new THREE.Vector3(), _s = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler(),
    _cam = new THREE.Vector3(), _rz = new THREE.Matrix4(), _ry = new THREE.Matrix4();
  const UP = new THREE.Vector3(0, 1, 0);

  class SettlerRenderGLB {
    constructor(root, A, cap) {
      cap = cap || 200; this.cap = cap; this.root = root; this.A = A;
      this.mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 6, specular: 0x141414 });
      this.meshes = [];
      const mk = (geo, n, shadow) => {
        const m = new THREE.InstancedMesh(geo, this.mat, n);
        // alle meshes met dit materiaal krijgen instanceColor (three.js r128, zie VE-001)
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
        m.count = 0; m.castShadow = shadow; m.receiveShadow = false; m.frustumCulled = false; m.visible = false;
        root.add(m); this.meshes.push(m);
        return m;
      };
      const SHADOW = /^(torso__body|head__face|head__hat|head__hair_long|legR__leg|armR__sleeve|head__egg_tall|head__egg_night)/;
      this.part = {};
      for (const k in A.parts) {
        const pairs = /^(legR__leg|legR__boot|armR__sleeve|armR__hand)$/.test(k);   // links + rechts
        this.part[k] = { mesh: mk(A.parts[k].geo, pairs ? cap * 2 : cap, SHADOW.test(k)), node: A.parts[k].node, n: 0 };
      }
      this.tools = {};
      for (const t of ['axe', 'hammer', 'pick', 'spade', 'scythe', 'sickle', 'rod', 'net']) this.tools[t] = { mesh: mk(VE.toolGeo(t), 100, true), n: 0 };
      this.items = {};
      for (const r of VE.RES_ORDER) this.items[r] = { mesh: mk(VE.itemGeo(r), 140, true), n: 0 };
      this.roleCol = {};
      for (const r in VE.ROLES) this.roleCol[r] = [C(VE.ROLES[r][0]), C(VE.ROLES[r][1])];
      const N = A.nodes.length;
      this.N = N;
      this.world = []; for (let i = 0; i < N; i++) this.world.push(new THREE.Matrix4());
      this.frame = 0; this.quality = 1; this.ft = 16; this.lastT = 0; this.slowT = 0; this.fastT = 0;
      this.stats = { settlers: 0, instances: 0, drawn: 0 };
    }
    dispose() { for (const m of this.meshes) this.root.remove(m); }

    /* vast uiterlijk per bewoner (beroep kan wisselen: hoed/eggs volgen het huidige beroep) */
    look(s) {
      if (s._look) return s._look;
      const h = hash(s.id, 11);
      return (s._look = {
        body: (h % 5 < 2) ? 'round' : 'slim',
        face: ['face_a', 'face_b', 'face_c'][(h >>> 3) % 3],
        hair: [null, 'hair_short', 'hair_short', 'hair_long', 'hair_curly', 'hair_ponytail'][(h >>> 5) % 6],
        beard: [null, null, null, 'beard_mustache', 'beard_full', 'beard_goatee'][(h >>> 8) % 6],
        skin: SKIN[(h >>> 11) % SKIN.length], hairC: HAIR[(h >>> 14) % HAIR.length],
        pants: PANTS[(h >>> 17) % PANTS.length], boots: BOOTS[(h >>> 19) % BOOTS.length],
        sx: 0.93 + ((h >>> 21) % 8) * 0.02, sy: 0.94 + ((h >>> 24) % 6) * 0.025,
        apronLike: (h >>> 27) % 7 === 0, h2: hash(s.id, 97)
      });
    }
    egg(s, look, role) {
      if (s._eggForce) return EGGS.find(e => e.id === s._eggForce) || null;   // alleen voor tests/screenshots
      if (look.h2 % 100 >= EGG_RATE) return null;
      const ok = EGGS.filter(e => !e.roles || e.roles.indexOf(role) >= 0);
      return ok[(look.h2 >>> 8) % ok.length];
    }

    /* clip + tijd voor deze bewoner, volgens de spelstatus */
    choose(s, T) {
      const clips = this.A.clips;
      const act = s.act && !clips[s.act] ? ACT_ALIAS[s.act] : s.act;
      if (act && clips[act]) {
        const P = ACT_PERIOD[s.act] || clips[act].dur;
        return [act, ((s.ap % P) / P) * clips[act].dur];
      }
      if (s.carry) {
        if (s.moving) return ['carry', ((s.wp / TAU) % 1) * clips.carry.dur];
        return ['carry_idle', (T + s.id * 0.37) % clips.carry_idle.dur];
      }
      if (s.moving) return ['walk', (((s.wp / TAU) % 1) + 1) % 1 * clips.walk.dur];
      // stilstaan: rustig ademen en rondkijken, af en toe een eigen gebaar
      const tt = T + s.id * 3.1, win = Math.floor(tt / 7), into = tt - win * 7, r = hash(win, s.id) % 100;
      let v = null;
      if (s.mode === 'idle' && !s.tool) v = r < 12 ? 'idle_hat' : r < 22 ? 'wave' : r < 29 ? 'cheer' : null;
      else if (r < 10) v = 'idle_hat';
      if (v && clips[v] && into < clips[v].dur) return [v, into];
      return ['idle', (T + s.id * 1.37) % clips.idle.dur];
    }

    sample(name, t, out) {
      const c = this.A.clips[name], nodes = this.A.nodes;
      for (let i = 0; i < this.N; i++) {
        const o = i * 7, pc = c.per[i];
        if (pc.p) { const v = pc.p.evaluate(t); out[o] = v[0]; out[o + 1] = v[1]; out[o + 2] = v[2]; }
        else { out[o] = nodes[i].pos.x; out[o + 1] = nodes[i].pos.y; out[o + 2] = nodes[i].pos.z; }
        if (pc.q) { const v = pc.q.evaluate(t); out[o + 3] = v[0]; out[o + 4] = v[1]; out[o + 5] = v[2]; out[o + 6] = v[3]; }
        else { const q = nodes[i].quat; out[o + 3] = q.x; out[o + 4] = q.y; out[o + 5] = q.z; out[o + 6] = q.w; }
      }
    }

    put(key, M, col) {
      const p = this.part[key]; if (!p) return;
      if (p.n >= p.mesh.instanceMatrix.count) return;
      p.mesh.setMatrixAt(p.n, M); p.mesh.setColorAt(p.n, col || WHITE); p.n++;
    }

    render(settlers) {
      const A = this.A, nodes = A.nodes, N = this.N, T = VE.uTime.value;
      const now = performance.now();
      let fdt = 1 / 60;
      if (this.lastT) { const dt = now - this.lastT; fdt = Math.min(dt, 100) / 1000; this.ft += (Math.min(dt, 100) - this.ft) * 0.05; this.adapt(dt); }
      this.lastT = now; this.frame++;
      for (const k in this.part) this.part[k].n = 0;
      for (const k in this.tools) this.tools[k].n = 0;
      for (const k in this.items) this.items[k].n = 0;
      const cam = VE.view && VE.view.camera; if (cam) _cam.copy(cam.position);
      let count = 0;
      for (const s of settlers) {
        if (s.hidden || count >= this.cap) continue;
        count++;
        const look = this.look(s);
        const role = s.mode === 'build' ? 'builder' : (s.mode === 'work' || s.mode === 'goWork') ? s.role : 'carrier';
        const rc = this.roleCol[role] || this.roleCol.carrier;
        const far = cam ? (s.x - _cam.x) ** 2 + (s.z - _cam.z) ** 2 > LOD_FAR * LOD_FAR : false;
        // ---- pose: clip kiezen, sampelen, overvloeien
        if (!s._pose) { s._pose = new Float32Array(N * 7); s._from = new Float32Array(N * 7); s._blend = 0; s._clip = null; }
        const pick = this.choose(s, T);
        if (pick[0] !== s._clip) {
          if (s._clip) { s._from.set(s._pose); s._blend = BLEND; }
          s._clip = pick[0];
        }
        const skip = far && this.quality < 1 && ((this.frame + s.id) & 1) && !s._blend;   // verre bewoners: halve update
        if (!skip) {
          this.sample(pick[0], pick[1], s._pose);
          if (s._blend > 0) {
            const w = 1 - s._blend / BLEND;
            for (let i = 0; i < N; i++) {
              const o = i * 7, P = s._pose, F = s._from;
              for (let k = 0; k < 3; k++) P[o + k] = F[o + k] + (P[o + k] - F[o + k]) * w;
              _q.set(F[o + 3], F[o + 4], F[o + 5], F[o + 6]); _q2.set(P[o + 3], P[o + 4], P[o + 5], P[o + 6]);
              _q.slerp(_q2, w); P[o + 3] = _q.x; P[o + 4] = _q.y; P[o + 5] = _q.z; P[o + 6] = _q.w;
            }
            s._blend = Math.max(0, s._blend - fdt);          // in echte tijd, ook bij lage framerate
          }
        }
        // ---- wereldmatrices van de rig-nodes
        let lean = 0; if (s.act === 'sow') lean = 0.12;
        _q.setFromAxisAngle(UP, s.rot);
        _m.compose(_p.set(s.x, s.y, s.z), _q, _s.set(S * look.sx, S * look.sy, S * look.sx));
        if (lean) { _l.makeRotationX(lean); _m.multiply(_l); }
        const P = s._pose;
        for (let i = 0; i < N; i++) {
          const o = i * 7;
          _l.compose(_p.set(P[o], P[o + 1], P[o + 2]), _q.set(P[o + 3], P[o + 4], P[o + 5], P[o + 6]), _one);
          this.world[i].multiplyMatrices(nodes[i].parent < 0 ? _m : this.world[nodes[i].parent], _l);
        }
        const W = this.world, I = A.idx;
        // ---- delen plaatsen
        const egg = this.egg(s, look, role);
        this.put('torso__body_' + look.body, W[I.torso], rc[0]);
        this.put('torso__belt_' + look.body, W[I.torso], WHITE);
        if (APRON.has(role) || (role === 'carrier' && look.apronLike)) this.put('torso__apron', W[I.torso], WHITE);
        this.put('head__' + look.face, W[I.head], look.skin);
        if (look.hair) this.put('head__' + look.hair, W[I.head], look.hairC);
        const beard = egg && egg.beard ? egg.beard : look.beard;
        if (beard && !far) this.put('head__' + beard, W[I.head], look.hairC);
        let hat = egg && egg.hat ? egg.hat : (HAT[role] || 'hat_straw');
        if (egg && egg.fx === 'tilt') { _rz.makeRotationZ(0.32); _ry.multiplyMatrices(W[I.head], _rz); this.put('head__' + hat, _ry, rc[1]); }
        else this.put('head__' + hat, W[I.head], hat === 'egg_nightcap' ? SOCK_FUN[1] : rc[1]);
        for (const side of ['R', 'L']) {
          this.put('armR__sleeve', W[I['arm' + side]], rc[0]);
          this.put('armR__hand', W[I['arm' + side]], look.skin);
          this.put('legR__leg', W[I['leg' + side]], look.pants);
          const sock = egg && egg.fx === 'socks' ? SOCK_FUN[(side === 'R' ? 0 : 2 + (look.h2 >>> 3) % 2)] : look.boots;
          this.put('legR__boot', W[I['leg' + side]], sock);
        }
        if (egg && egg.part && !far) {
          if (egg.fx === 'bee') { _ry.makeRotationY(T * 2.4 + s.id); _rz.multiplyMatrices(W[I.head], _ry); this.put(egg.part, _rz, WHITE); }
          else this.put(egg.part, W[egg.part.indexOf('legR') === 0 ? I.legR : egg.part.indexOf('torso') === 0 ? I.torso : I.head], WHITE);
        }
        // ---- gereedschap en vracht
        if (s.tool && this.tools[s.tool]) {
          const tl = this.tools[s.tool];
          if (tl.n < tl.mesh.instanceMatrix.count) { tl.mesh.setMatrixAt(tl.n++, W[I.tool]); }
        }
        if (s.carry && this.items[s.carry]) {
          const it = this.items[s.carry];
          if (it.n < it.mesh.instanceMatrix.count) { _l.makeRotationY(0.08); _ry.multiplyMatrices(W[I.carry], _l); it.mesh.setMatrixAt(it.n++, _ry); }
        }
      }
      let inst = 0, drawn = 0;
      const fin = o => { const m = o.mesh; m.count = o.n; m.visible = o.n > 0; inst += o.n; if (o.n) drawn++; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; };
      for (const k in this.part) fin(this.part[k]);
      for (const k in this.tools) fin(this.tools[k]);
      for (const k in this.items) fin(this.items[k]);
      this.stats = { settlers: count, instances: inst, drawn: drawn, quality: this.quality, frameMs: +this.ft.toFixed(1) };
    }

    /* kwaliteit dynamisch aanpassen: lange tijd traag → verre bewoners halve animatie-update en
       minder schaduw; weer snel → terug naar vol */
    adapt(dt) {
      if (dt > 30) { this.slowT += dt; this.fastT = 0; } else if (dt < 20) { this.fastT += dt; this.slowT = 0; }
      if (this.quality === 1 && this.slowT > 3000) { this.quality = 0; this.setShadows(false); this.slowT = 0; }
      if (this.quality === 0 && this.fastT > 6000) { this.quality = 1; this.setShadows(true); this.fastT = 0; }
    }
    setShadows(on) {
      for (const k in this.part) if (/^(head__hat|head__hair|legR__leg|armR__sleeve)/.test(k)) this.part[k].mesh.castShadow = on;
    }
  }
  VE.SettlerRenderGLB = SettlerRenderGLB;

  /* ---------------- laden; renderer kiezen ---------------- */
  VE.settlerAssets = null;
  VE.settlerSource = 'loading';
  VE.makeSettlerRender = root => VE.settlerAssets ? new SettlerRenderGLB(root, VE.settlerAssets) : new VE.SettlerRender(root);
  const load = (VE.loadGlb ? VE.loadGlb(URL) : Promise.reject(new Error('GLTFLoader niet beschikbaar')))
    .then(gltf => {
      VE.settlerAssets = prepare(gltf);
      VE.settlerSource = 'glb';
      // al een spel bezig met de oude bewoners? dan live wisselen
      const g = VE.game;
      if (g && g.sr && !(g.sr instanceof SettlerRenderGLB)) { if (g.sr.dispose) g.sr.dispose(); g.sr = new SettlerRenderGLB(g.root, VE.settlerAssets); }
    })
    .catch(e => {
      VE.settlerSource = 'procedural';
      console.warn('[Village Empire] bewoners: GLB niet geladen, oorspronkelijke bewoners worden gebruikt.', e && e.message || e);
    });
  // opstarten wacht ook hierop (met dezelfde time-out als de gebouwen)
  const prev = VE.glbReady || Promise.resolve();
  VE.glbReady = Promise.race([Promise.all([prev, load]), new Promise(r => setTimeout(r, 10000))]);
})(window.VE);
