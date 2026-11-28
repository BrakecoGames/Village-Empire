/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Bijzondere plekken in de grote wereld (Blender: public/models/landmarks.glb).

   - De brug over de canyon (precies over de brugtegels van js/worldgen.js, dek op randhoogte).
   - Watervallen langs de canyonwand bij de brug, en een verborgen waterval aan de voet van een bergrug.
   - Ruïnes, grotten, een oude stenen kring, een monument, stoomgaten bij de vulkaan, en easter eggs
     (zwaard in de steen, een reuzenbadeend op een meer, kabouterhuisjes in het bos).
   Plekken volgen deterministisch uit de wereld (seed), dus ze hoeven niet in de save. De tegels eronder
   zijn geblokkeerd (geen bouwen, geen doorlopen). Wie een plek voor het eerst ontdekt (de mist trekt weg),
   krijgt een melding en een kleine beloning; ontdekte plekken staan in de save (disc) en op de minimap.
   De vulkaan rookt zachtjes uit de krater, de stoomgaten dampen; vallend water stroomt in banden. */
'use strict';
(function (VE) {
  const TAU = Math.PI * 2;
  const URL = 'public/models/landmarks.glb' + (VE.VERSION ? '?v=' + VE.VERSION : '');
  let GEO = null;
  const ready = (VE.loadGlb ? VE.loadGlb(URL) : Promise.reject(new Error('geen GLTFLoader'))).then(gltf => {
    GEO = {};
    for (const o of gltf.scene.children) if (o.name) { const g = VE.bakeGlbNode(o, 500 + o.name.length); if (g) GEO[o.name] = g; }
    const g = VE.game; if (g && g.landmarks) VE.Landmarks.attach(g);
  }).catch(e => console.warn('[Village Empire] landmarks: GLB niet geladen', e && e.message || e));

  const INFO = {
    ruin: { name: 'Ancient Ruins', icon: '🏛️', gold: 30, size: 3 },
    cave: { name: 'Mysterious Cave', icon: '🕳️', gold: 30, size: 2, mount: true },
    falls_hidden: { name: 'Hidden Waterfall', icon: '💧', gold: 40, size: 3, mount: true },
    stones: { name: 'Old Stone Circle', icon: '🪨', gold: 30, size: 3 },
    monument: { name: 'Forgotten Monument', icon: '🗿', gold: 30, size: 2 },
    egg_sword: { name: 'The Sword in the Stone', icon: '🗡️', gold: 60, size: 1, forest: true, egg: true },
    egg_duck: { name: 'A Giant Rubber Duck?!', icon: '🦆', gold: 60, size: 0, egg: true },
    egg_gnomes: { name: 'The Gnome Village', icon: '🍄', gold: 60, size: 2, forest: true, egg: true },
    bridge: { name: 'The Old Canyon Bridge', icon: '🌉', gold: 20, size: 0 },
    falls_canyon: { name: 'Canyon Falls', icon: '🌊', gold: 20, size: 0 },
    vent: { size: 0, quiet: true }
  };
  VE.LANDMARK_INFO = INFO;

  /* ---------- plekken kiezen (na het genereren van de wereld) ---------- */
  function plan(game) {
    const w = game.world, N = VE.N, F = w.features;
    if (!F) return [];
    const C = N / 2, rnd = VE.rng((w.seed ^ 0x7a11d) >>> 0), out = [];
    const S = w.starts, ang = k => S[k].a, at = (a, r) => [C + Math.cos(a) * r, C + Math.sin(a) * r];
    const farFromStarts = (x, z, d) => S.every(s => Math.hypot(s.i + 1 - x, s.j + 1 - z) > d);
    const lava = new Set(w.lavaPath || []);
    const free = (i, j, sz, opt) => {
      let mountain = 0;
      for (let dj = 0; dj < sz; dj++) for (let di = 0; di < sz; di++) {
        const a = i + di, b = j + dj; if (!w.inb(a, b)) return false;
        const k = b * N + a, t = w.type[k];
        if (t !== 0 && t !== 3 && !(opt.mount && t === 2)) return false;
        if (w.bld[k] || w.door[k] || (w.lmk && w.lmk[k]) || lava.has(k) || (w.volc && w.volc[k] >= 2)) return false;
        if (opt.forest && w.forest[k] < 0.5) return false;
        if (t === 2) mountain++;
      }
      if (w.slope(i, j, sz) > (opt.mount ? 1.4 : 0.8)) return false;
      if (opt.mount) {                                           // aan de voet van een berg: berg vlak achter de plek
        let m = 0; for (let dj = -2; dj < sz + 2; dj++) for (let di = -2; di < sz + 2; di++) { const a = i + di, b = j + dj; if (w.inb(a, b) && w.type[b * N + a] === 2) m++; }
        if (m < 4 || mountain > sz) return false;
      }
      return true;
    };
    const spot = (x0, z0, kind) => {
      const I = INFO[kind], sz = I.size;
      for (let r = 0; r < 26; r++) for (let q = 0; q < Math.max(1, r * 8); q++) {
        const a = q / Math.max(1, r * 8) * TAU + r, i = Math.round(x0 + Math.cos(a) * r - sz / 2), j = Math.round(z0 + Math.sin(a) * r - sz / 2);
        if (!farFromStarts(i + sz / 2, j + sz / 2, 15)) continue;
        if (free(i, j, sz, I)) return { i: i, j: j, x: i + sz / 2, z: j + sz / 2 };
      }
      return null;
    };
    const add = (kind, p, extra) => { if (p) out.push(Object.assign({ kind: kind, id: kind + '_' + out.filter(o => o.kind === kind).length, x: p.x, z: p.z, i: p.i, j: p.j, rot: 0 }, extra || {})); };
    // brug: het midden van de brugtegels, langs de dwarsrichting
    const B = F.bridge;
    if (B && B.tiles && B.tiles.length) add('bridge', { x: B.x, z: B.z }, { rot: Math.atan2(-B.dir[1], B.dir[0]), len: B.half * 2 + 1.6, y: B.deck });
    // canyonwatervallen: twee, aan weerszijden van de brug, op de rand
    const can = F.canyon;
    for (const [off, side] of [[-5, 1], [7, -1]]) {
      const n0 = Math.max(1, Math.min(can.length - 2, Math.round(can.length * 0.42) + off)), p = can[n0], q = can[n0 + 1];
      const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * side, nz = dx / l * side;
      let x = p[0] + nx * 4.4, z = p[1] + nz * 4.4;
      const top = w.heightAt(p[0] + nx * 5.4, p[1] + nz * 5.4);
      add('falls_canyon', { x: x, z: z }, { rot: Math.atan2(-nx, -nz), y: top - 0.05, drop: Math.max(1.2, top + 0.8) });
    }
    // overige plekken: vaste richtingen ten opzichte van de dorpen (eerlijk verdeeld), in de buurt een geschikte plek
    const bis = (p, q) => (ang(p) + ang(q)) / 2 + (Math.abs(ang(p) - ang(q)) > Math.PI ? Math.PI : 0);
    add('ruin', spot(...at(bis(0, 1) + 0.55, N * 0.4), 'ruin'));
    add('ruin', spot(...at(bis(0, 2) - 0.55, N * 0.27), 'ruin'));
    for (const k of [1, 2]) {
      const s = S[k], o = [Math.cos(s.a), Math.sin(s.a)], t = [-Math.sin(s.a), Math.cos(s.a)];
      add('cave', spot(s.i + 1 + o[0] * 18 + t[0] * 19 * (k === 1 ? 1 : -1), s.j + 1 + o[1] * 18 + t[1] * 19 * (k === 1 ? 1 : -1), 'cave'));
    }
    { const s = S[0], o = [Math.cos(s.a), Math.sin(s.a)], t = [-Math.sin(s.a), Math.cos(s.a)];
      add('falls_hidden', spot(s.i + 1 + o[0] * 26 + t[0] * 8, s.j + 1 + o[1] * 26 + t[1] * 8, 'falls_hidden')); }
    add('stones', spot(...at(ang(0) + Math.PI - 0.7, N * 0.3), 'stones'));
    add('monument', spot(...at(ang(0) + 0.35, N * 0.2), 'monument'));
    add('egg_sword', spot(...at(ang(1) + 0.9, N * 0.36), 'egg_sword'));
    add('egg_gnomes', spot(...at(ang(2) - 0.9, N * 0.36), 'egg_gnomes'));
    const lake = F.lakes[3]; if (lake) add('egg_duck', { x: lake.x, z: lake.z });
    if (N >= 180) for (let k = 0; k < 3; k++) {
      const a = (ang(k) + ang((k + 1) % 3)) / 2 + (Math.abs(ang(k) - ang((k + 1) % 3)) > Math.PI ? Math.PI : 0);
      add(['ruin', 'stones', 'monument'][k], spot(...at(a + 0.35, N * 0.46), ['ruin', 'stones', 'monument'][k]));
      add(k === 1 ? 'falls_hidden' : 'cave', spot(...at(ang(k) + Math.PI * 0.62, N * 0.47), k === 1 ? 'falls_hidden' : 'cave'));
    }
    // stoomgaten rond de krater
    for (let k = 0; k < 5; k++) {
      const vs = F.volcano.r / 16, a = k / 5 * TAU + 0.4 + rnd() * 0.5, r = (6 + rnd() * 5) * vs, x = C + Math.cos(a) * r, z = C + Math.sin(a) * r;
      if (!(w.lavaPath || []).includes(Math.floor(z) * N + Math.floor(x))) add('vent', { x: x, z: z }, { rot: rnd() * TAU });
    }
    // draaiing: grotten en watervallen met de opening van de berg af (bergop = achter)
    for (const L of out) {
      if (L.kind === 'cave' || L.kind === 'falls_hidden') {
        const e = 1.5, gx = w.heightAt(L.x + e, L.z) - w.heightAt(L.x - e, L.z), gz = w.heightAt(L.x, L.z + e) - w.heightAt(L.x, L.z - e);
        L.rot = Math.atan2(-gx, -gz);                              // voorkant (+z van het model) bergaf
      } else if (L.kind === 'ruin' || L.kind === 'stones' || L.kind === 'monument' || L.kind.indexOf('egg') === 0) L.rot = rnd() * TAU;
    }
    return out;
  }

  /* ---------- in de wereld zetten ---------- */
  function occupy(game, L) {
    const w = game.world, N = VE.N, I = INFO[L.kind];
    if (!w.lmk) w.lmk = new Uint8Array(N * N);
    if (!I.size) return;
    for (let dj = 0; dj < I.size; dj++) for (let di = 0; di < I.size; di++) {
      const i = L.i + di, j = L.j + dj; if (!w.inb(i, j)) continue;
      const k = j * N + i;
      w.lmk[k] = 1;
      if (w.tree[k]) game.nature.removeTree(w.tree[k]);
      if (w.rock[k]) { w.rock[k].amount = 1; game.nature.mineRock(w.rock[k]); }
      w.clearDeco(k);
      if (w.veg && w.veg.clearBig) w.veg.clearBig(k);
    }
  }
  const fallMat = () => {
    const m = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 30, specular: 0x334455, side: THREE.DoubleSide });
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = VE.uTime;
      sh.vertexShader = 'varying float vWY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWY = (modelMatrix * vec4(transformed, 1.0)).y;');
      sh.fragmentShader = 'uniform float uTime; varying float vWY;\n' + sh.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\n if (vColor.b > 0.62 && vColor.b > vColor.r + 0.02) { float s = sin(vWY * 13.0 + uTime * 9.0) * 0.5 + 0.5; diffuseColor.rgb *= 0.86 + s * 0.24; }');
    };
    m.customProgramCacheKey = () => 'falls';
    return m;
  };
  const Landmarks = {
    build(game, save) {
      const w = game.world;
      w.landmarks = game.landmarks = plan(game);
      const found = new Set(save && Array.isArray(save.disc) ? save.disc : []);
      for (const L of game.landmarks) { occupy(game, L); L.found = L.seen = found.has(L.id); }
      game.lmT = 0;
      // volledige snapshot (js/snapshot.js): ook wat gezien maar nog niet gemeld is, en de timer
      const S = save && save.snap && save.lmk;
      if (S) { const seen = new Set(S.seen || []); for (const L of game.landmarks) if (seen.has(L.id)) L.seen = true; game.lmT = S.t || 0; }
      this.attach(game);
    },
    attach(game) {
      if (!GEO || !game.landmarks || game.lmAttached) return;
      game.lmAttached = true;
      const w = game.world, mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 6, specular: 0x161616 }), fm = fallMat();
      for (const L of game.landmarks) {
        const geo = GEO[L.kind]; if (!geo) continue;
        const m = new THREE.Mesh(geo, L.kind.indexOf('falls') === 0 ? fm : mat);
        m.castShadow = L.kind !== 'falls_canyon'; m.receiveShadow = true; m.name = 'landmark_' + L.kind;
        const y = L.y !== undefined ? L.y : L.kind === 'egg_duck' ? 0.02 : w.heightAt(L.x, L.z) - 0.02;
        m.position.set(L.x, y, L.z); m.rotation.y = L.rot || 0;
        if (L.kind === 'bridge') m.scale.set(L.len / 14, 1, 1);
        if (L.kind === 'falls_canyon') m.scale.set(1, L.drop / 3, 1);
        game.root.add(m); L.mesh = m;
      }
    },
    update(game, dt) {
      if (!game.landmarks) return;
      if (!game.lmAttached && GEO) this.attach(game);              // modellen later binnen dan de wereld
      const w = game.world, N = VE.N;
      game.lmT -= dt;
      if (game.lmT > 0) return;
      game.lmT = 0.5;
      const T = VE.uTime.value;
      for (const L of game.landmarks) {
        // ontdekken: de mist boven de plek is weg
        if (!L.found && INFO[L.kind].name) {
          if (L.seen) {
            L.found = true;
            const I = INFO[L.kind];
            game.gold += I.gold; game.stats.goldEarned += I.gold;
            game.stats.discovered = (game.stats.discovered || 0) + 1;
            VE.bus.emit('toast', { text: I.icon + ' Discovered: ' + I.name + '! (+' + I.gold + ' gold)' });
            VE.bus.emit('sfx', { n: 'fanfare', x: L.x, z: L.z });
          }
        }
        if (L.kind === 'egg_duck' && L.mesh) { L.mesh.position.y = 0.02 + Math.sin(T * 1.3) * 0.03; L.mesh.rotation.y = L.rot + Math.sin(T * 0.4) * 0.4; }
        if (L.kind === 'vent' && Math.random() < 0.55) VE.bus.emit('smoke', { x: L.x + (Math.random() - 0.5) * 0.2, y: w.heightAt(L.x, L.z) + 0.1, z: L.z, kind: 'steam' });
        if (L.kind === 'falls_canyon' && L.mesh && Math.random() < 0.5) VE.bus.emit('splash', { x: L.x - Math.sin(L.rot) * 0.4, z: L.z - Math.cos(L.rot) * 0.4 });
      }
      // vulkaan: rustige grijze pluim uit de krater
      const F = w.features;
      if (F && F.volcano && Math.random() < 0.7) {
        const C = F.volcano;
        VE.bus.emit('smoke', { x: C.x + (Math.random() - 0.5) * 2, y: w.heightAt(C.x + 4.5, C.z) + 0.4, z: C.z + (Math.random() - 0.5) * 2, kind: 'volcano' });
      }
    },
    ready: ready
  };
  VE.Landmarks = Landmarks;

  /* ontdekken = verkennen: de plek ligt binnen het gebied dat een bewoner of soldaat net vrijmaakt */
  const reveal0 = VE.World.prototype.reveal;
  VE.World.prototype.reveal = function (x, z, r) {
    reveal0.call(this, x, z, r);
    if (this.landmarks) for (const L of this.landmarks) if (!L.seen && (L.x - x) ** 2 + (L.z - z) ** 2 < (r - 1.2) * (r - 1.2)) L.seen = true;
  };

  /* ---------- koppeling: wereld maken, bijwerken, opslaan ---------- */
  const G = VE.Game.prototype, init0 = G.init, update0 = G.update, ser0 = G.serialize;
  G.init = function (save) {
    init0.call(this, save);
    if (this.world.features) Landmarks.build(this, save);
  };
  G.update = function (dt) { update0.call(this, dt); Landmarks.update(this, dt); };
  G.serialize = function (cam) {
    const s = ser0.call(this, cam);
    if (this.landmarks) s.disc = this.landmarks.filter(L => L.found).map(L => L.id);
    return s;
  };
})(window.VE);
