/* Village Empire — © 2026 Brakeco Games. All rights reserved. */
'use strict';
(function (VE) {
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'village_empire_save_v1', SET_KEY = 'village_empire_settings';

  /* ---------------- CrazyGames SDK wrapper (safe when unavailable) ---------------- */
  VE.sdk = {
    sdk: null,
    init() {
      return new Promise(resolve => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        setTimeout(finish, 2500);
        try {
          const s = document.createElement('script');
          s.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
          s.onload = () => {
            try {
              if (window.CrazyGames && window.CrazyGames.SDK) {
                window.CrazyGames.SDK.init().then(() => { this.sdk = window.CrazyGames.SDK; finish(); }).catch(finish);
              } else finish();
            } catch (e) { finish(); }
          };
          s.onerror = finish;
          document.head.appendChild(s);
        } catch (e) { finish(); }
      });
    },
    call(fn) { try { if (this.sdk && this.sdk.environment !== 'disabled') fn(this.sdk); } catch (e) { /* ignore */ } },
    loadingStart() { this.call(s => s.game.loadingStart()); },
    loadingStop() { this.call(s => s.game.loadingStop()); },
    gameplayStart() { this.call(s => s.game.gameplayStart()); },
    gameplayStop() { this.call(s => s.game.gameplayStop()); },
    happy() { this.call(s => s.game.happytime()); },
    get(k) {
      let v = null;
      try { if (this.sdk && this.sdk.data) v = this.sdk.data.getItem(k); } catch (e) { v = null; }
      if (v == null) { try { v = window.localStorage.getItem(k); } catch (e) { v = null; } }
      return v;
    },
    set(k, v) {
      try { if (this.sdk && this.sdk.data) this.sdk.data.setItem(k, v); } catch (e) { /* ignore */ }
      try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ }
    },
    del(k) {
      try { if (this.sdk && this.sdk.data) this.sdk.data.removeItem(k); } catch (e) { /* ignore */ }
      try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ }
    }
  };

  let renderer, scene, camera, sun, hemi, view, ui, last = 0, saveT = 20, tickAcc = 0;
  VE.playing = false;

  function readSave() { try { const s = VE.sdk.get(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  VE.save = function () {
    if (!VE.game || !VE.game.started) return;
    try { VE.sdk.set(SAVE_KEY, JSON.stringify(VE.game.serialize({ x: view.cam.tx, z: view.cam.tz, d: view.cam.tdist, yaw: view.cam.tyaw }))); } catch (e) { console.warn('save failed', e); }
  };
  VE.saveSettings = function () { try { VE.sdk.set(SET_KEY, JSON.stringify({ sfx: VE.audio.sfxOn, music: VE.audio.musicOn })); } catch (e) { /* ignore */ } };

  function createGame(save) {
    if (VE.game) VE.game.dispose();
    const g = new VE.Game(scene);
    VE.game = g;
    g.init(save);
    g.sr = VE.makeSettlerRender ? VE.makeSettlerRender(g.root) : new VE.SettlerRender(g.root);   // Blender-bewoners of oude reserve
    g.fx = new VE.FX(g.root, g);
    g.piles = new VE.StockpileRender(g.root);
    g.wr = VE.WildlifeRender ? new VE.WildlifeRender(g.root) : null;      // wilde dieren (Blender of reserve)
    g.started = !!save;
    const hq = g.hq;
    if (save && save.cam) { view.cam.tx = save.cam.x; view.cam.tz = save.cam.z; view.cam.tdist = view.cam.dist = save.cam.d || 17; view.cam.tyaw = view.cam.yaw = save.cam.yaw || Math.PI / 4; }
    else { view.cam.tx = hq.cx; view.cam.tz = hq.cz + 1; view.cam.tdist = view.cam.dist = 19; }
    view.cam.ty = Math.max(0.3, g.world.heightAt(view.cam.tx, view.cam.tz));
    if (ui) { ui.select(null); ui.setTool(null); }
    return g;
  }

  function startPlaying() {
    VE.audio.init();
    const g = VE.game;
    const fresh = !g.started;
    g.started = true;
    VE.playing = true;
    view.cam.orbit = false;
    $('startScreen').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('speedBtn').innerHTML = '⏩<small>' + g.speed + '×</small>';
    ui.syncSoundBtn();
    ui.refreshHud(true);
    VE.sdk.gameplayStart();
    if (fresh) {
      view.cam.focus(g.hq.cx, g.hq.cz + 1); view.cam.tdist = 16;
      setTimeout(() => ui.toast('👑 Welcome, my lord! This valley is yours to settle.'), 400);
      setTimeout(() => ui.toast('📜 Follow the Village Charter to grow your hamlet.'), 3200);
      setTimeout(() => ui.toast('🪓 Start with a Woodcutter close to the trees.'), 6000);
      VE.save();
    }
  }
  VE.toMenu = function () {
    VE.save();
    VE.playing = false;
    VE.sdk.gameplayStop();
    view.cam.orbit = true;
    $('hud').classList.add('hidden');
    $('startScreen').classList.remove('hidden');
    $('btnContinue').classList.remove('hidden');
  };
  /* nieuw spel; setup = { opponents: [{ level }], start } (js/sim.js applySetup). Zonder: vreedzaam dorp */
  VE.newGame = function (setup) {
    VE.sdk.del(SAVE_KEY);
    createGame(setup && setup.opponents && setup.opponents.length ? { fresh: true, setup: setup } : null);
    startPlaying();
  };
  /* na Victory/Defeat: terug naar het menu met een nieuw (vreedzaam) dorp op de achtergrond */
  VE.endToMenu = function () {
    VE.playing = false;
    VE.sdk.gameplayStop();
    VE.sdk.del(SAVE_KEY);
    createGame(null);
    view.cam.orbit = true;
    $('hud').classList.add('hidden');
    $('startScreen').classList.remove('hidden');
    $('btnContinue').classList.add('hidden');
  };

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000 || 0.016)); last = now;
    VE.uTime.value += dt;
    const g = VE.game, c = view.cam;
    if (g) {
      // vaste simulatieticks (VE.TICK), los van de framerate; snelheid 2×/3× = meer ticks per seconde
      tickAcc += dt * (VE.playing ? g.speed : 1);
      let n = 0;
      while (tickAcc >= VE.TICK && n < 16) { g.tick(); tickAcc -= VE.TICK; n++; }
      if (n >= 16) tickAcc = 0;                                   // te traag: niet inhalen (geen spiraal)
      VE.alpha = VE.clamp(tickAcc / VE.TICK, 0, 1);
      g.fx.update(dt, VE.uTime.value);
      g.sr.render(g.settlers);
      g.piles.update(g);
      if (g.wr) g.wr.render(g.wild, camera, dt);
    }
    if (VE.playing) {
      ui.update(dt);
      saveT -= dt; if (saveT <= 0) { saveT = 20; VE.save(); }
    }
    c.update(dt);
    // sun & shadows follow the view
    const d = Math.max(11, c.dist * 1.05);
    sun.position.set(c.tx - 14, c.ty + 26, c.tz + 10);
    sun.target.position.set(c.tx, c.ty, c.tz);
    const sc = sun.shadow.camera;
    if (sc.right !== d) { sc.left = -d; sc.right = d; sc.top = d; sc.bottom = -d; sc.updateProjectionMatrix(); }
    VE.audio.lx = c.tx; VE.audio.lz = c.tz; VE.audio.ld = c.dist;
    if (g && VE.natureSync) VE.natureSync(g, camera);   // bomen en planten: alleen wat in beeld is
    renderer.render(scene, camera);
  }

  async function boot() {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, VE.isMobile ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    $('game').appendChild(renderer.domElement);
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xcfe0e2, 50, 115);
    camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.3, 300);
    // Warm sky light, earthy bounce light from the ground
    hemi = new THREE.HemisphereLight(0xfff1dc, 0x5f6b3e, 0.5);
    scene.add(hemi);
    scene.add(new THREE.AmbientLight(0xdfe8ff, 0.06));
    // Cool fill light from the opposite side: lifts shadows and gives objects shape (no shadow cost)
    const fill = new THREE.DirectionalLight(0xbcd2ff, 0.2);
    fill.position.set(30, 18, -20);
    scene.add(fill);
    sun = new THREE.DirectionalLight(0xffe0b4, 0.74);
    sun.castShadow = true;
    const ms = VE.isMobile ? 1024 : 2048;
    sun.shadow.mapSize.set(ms, ms);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);
    view = { renderer: renderer, scene: scene, camera: camera, cam: new VE.CameraCtl(camera) };
    VE.view = view;
    resize();
    window.addEventListener('resize', resize);

    $('loadingText').textContent = 'Preparing the valley…';
    await VE.sdk.init();
    // Blender-modellen (GLB) laden parallel; bij een fout/time-out blijft het procedurele model in gebruik
    if (VE.glbReady) await VE.glbReady;
    VE.sdk.loadingStart();
    try { const st = JSON.parse(VE.sdk.get(SET_KEY) || 'null'); if (st) { VE.audio.sfxOn = st.sfx !== false; VE.audio.musicOn = st.music !== false; } } catch (e) { /* ignore */ }

    ui = new VE.UI(view);
    VE.ui = ui;
    ui.buildResBar();
    const save = readSave();
    try { createGame(save); }
    catch (e) { console.error('Save could not be loaded, starting fresh', e); createGame(null); }
    view.cam.orbit = true;
    if (VE.game.started) $('btnContinue').classList.remove('hidden');
    else $('btnContinue').classList.add('hidden');
    $('loadingText').classList.add('hidden');
    $('menuBtns').classList.remove('hidden');
    VE.sdk.loadingStop();

    $('btnContinue').addEventListener('click', () => { VE.audio.init(); VE.audio.play('open'); startPlaying(); });
    // Single Player: instellingen (tegenstanders, moeilijkheid, startplek)
    const SP = { opp: 0, lv1: 'normal', lv2: 'normal', start: -1 };
    const spSync = () => {
      document.querySelectorAll('#spSetup .seg').forEach(seg => seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', String(SP[seg.dataset.set]) === b.dataset.v)));
      document.querySelectorAll('#spSetup .sp-ai').forEach(r => r.classList.toggle('off', SP.opp < +r.dataset.n));
      $('spHint').textContent = SP.opp ? 'Each player starts with a Village Hall, settlers and supplies. Destroy every rival Village Hall to win; lose yours and you are defeated.' : 'A peaceful village: build at your own pace.';
    };
    $('spSetup').addEventListener('click', e => { const b = e.target.closest('.seg button'); if (!b) return; const k = b.closest('.seg').dataset.set; SP[k] = k === 'lv1' || k === 'lv2' ? b.dataset.v : +b.dataset.v; VE.audio.play('click'); spSync(); });
    const spSetup = () => SP.opp ? { opponents: [{ level: SP.lv1 }, { level: SP.lv2 }].slice(0, SP.opp), start: SP.start } : null;
    $('btnNew').addEventListener('click', () => { VE.audio.init(); spSync(); $('menuBtns').classList.add('hidden'); $('spSetup').classList.remove('hidden'); $('startScreen').classList.add('setup'); });
    $('spBack').addEventListener('click', () => { $('spSetup').classList.add('hidden'); $('menuBtns').classList.remove('hidden'); $('startScreen').classList.remove('setup'); });
    $('spStart').addEventListener('click', () => {
      $('spSetup').classList.add('hidden'); $('menuBtns').classList.remove('hidden'); $('startScreen').classList.remove('setup');
      if (VE.game.started) { VE.pendingSetup = spSetup(); $('confirmNew').classList.remove('hidden'); return; }
      if (SP.opp) VE.newGame(spSetup()); else startPlaying();
    });
    $('cnYes').addEventListener('click', () => { $('confirmNew').classList.add('hidden'); VE.newGame(VE.pendingSetup); VE.pendingSetup = null; });
    $('cnNo').addEventListener('click', () => $('confirmNew').classList.add('hidden'));
    document.addEventListener('visibilitychange', () => { if (document.hidden && VE.playing) VE.save(); });
    window.addEventListener('beforeunload', () => { if (VE.playing) VE.save(); });
    // first interaction unlocks audio
    const unlock = () => { VE.audio.init(); window.removeEventListener('pointerdown', unlock); };
    window.addEventListener('pointerdown', unlock);
    requestAnimationFrame(t => { last = t; frame(t); });
  }

  // versie + releasedatum op het startscherm (bron: js/version.js)
  { const v = document.getElementById('versionLabel'); if (v && VE.versionLabel) v.textContent = VE.versionLabel(); }

  window.addEventListener('load', () => {
    if (!window.THREE) { document.getElementById('loadingText').textContent = 'Could not load the 3D engine. Please check your connection and reload.'; return; }
    boot().catch(e => { console.error(e); document.getElementById('loadingText').textContent = 'Something went wrong while starting: ' + e.message; });
  });
})(window.VE);
