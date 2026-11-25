// Hulpje voor ingezoomde dierenfoto's (tests/dieren.spec.js): zet een rij dieren op een vlakke, vrije plek,
// in een vaste toestand/clip, zonder gras ervoor, met de camera er dichtbij. Draait in de pagina.
module.exports = function show(state, opts) {
  const VE = window.VE;
  opts = opts || {};
  const g = VE.game, W = g.wild, w = g.world, N = VE.N;
  W.threat = () => null;
  w.explored.fill(1); w.fogDirty = true;
  const keys = opts.keys || ['rabbit', 'fox', 'roe', 'boar', 'deer'];
  let best = null;
  if (opts.x !== undefined) best = { i: Math.floor(opts.x), j: Math.floor(opts.z), s: 0 };
  else for (let j = 6; j < N - 6; j++) for (let i = 6; i < N - 6; i++) {
    let ok = true, hmin = 9, hmax = -9;
    for (let b = -3; b <= 3 && ok; b++) for (let a = -4; a <= 4 && ok; a++) {
      const k = (j + b) * N + i + a; if (!W.passable(k)) ok = false;
      const h = w.heightAt(i + a, j + b); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h);
    }
    if (!ok) continue;
    if (!best || hmax - hmin < best.s) best = { i, j, s: hmax - hmin };
  }
  const cx = opts.x !== undefined ? opts.x : best.i + 0.5, cz = opts.z !== undefined ? opts.z : best.j + 0.5;
  for (const t of g.nature.trees.slice()) if (!t.dead && (t.x - cx) ** 2 + (t.z - cz) ** 2 < 25) g.nature.removeTree(t);
  for (const a of W.list) a.dead = true;
  W.list = [];
  const gap = opts.gap || 0.6;
  keys.forEach((key, n) => {
    const x = cx + (n - (keys.length - 1) / 2) * gap;
    const a = W.add(VE.SPECIES[key], x, cz, 0, false);
    a.sc = 1; a.rot = opts.rot !== undefined ? opts.rot : Math.PI / 2; a.state = state; a.t = 1e9; a.vis = true; a.reserved = true;   // reserved: geen graasstapjes tijdens de foto
    if (key === 'deer' || key === 'roe') a.stag = opts.stag !== undefined ? opts.stag : true;
    if (state === 'walk' || state === 'flee') { a.tx = a.x + Math.sin(a.rot) * 100; a.tz = a.z + Math.cos(a.rot) * 100; a.spd = 1e-5; }
    if (state === 'jump') { a.state = 'flee'; a.leapT = 1e9; a.clipWant = 'jump'; a.clipP = opts.p === undefined ? 0.5 : opts.p; a.tx = a.x; a.tz = a.z; a.spd = 0; }
  });
  if (!W.__think0) W.__think0 = W.think;
  W.think = function (a, dt) { if (a.leapT > 1e5) return; return W.__think0.call(this, a, dt); };
  const c = VE.view.cam;
  // camera vast (ook als de openingsanimatie van het spel hem nog wil verplaatsen)
  window.__camFix = { tx: cx, tz: cz, ty: w.heightAt(cx, cz) + (opts.ty || 0.12), dist: opts.dist || 2.6, pitch: opts.pitch || 0.32, yaw: opts.yaw !== undefined ? opts.yaw : 0 };
  const fix = () => { const f = window.__camFix; c.orbit = false; c.tx = f.tx; c.tz = f.tz; c.ty = f.ty; c.tdist = c.dist = f.dist; c.pitch = f.pitch; c.tyaw = c.yaw = f.yaw; };
  const hide = () => { fix(); g.root.traverse(o => { if (o.isMesh && /^veg_|^butterfly/.test(o.name || '')) o.visible = false; }); };
  hide(); if (!window.__hideT) window.__hideT = setInterval(hide, 50);
  const hud = document.getElementById('hud'); if (hud) hud.style.visibility = 'hidden';
  return { cx, cz };
};
