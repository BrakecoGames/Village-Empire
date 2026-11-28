/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Kazerne en soldaten.

   Keten: wapensmederij (wapens + trainingsuitrusting) → dragers → kazerne → rekruut → soldaat.
   - De speler zet soldaten in de wachtrij van een kazerne (type en aantal). Het goud gaat er direct af;
     bij afbreken komt het terug.
   - Dragers brengen per wachtende rekruut één wapen en de trainingsuitrusting (VE.SOLDIERS[t].gear) uit de
     wapensmederij of een Storehouse. Alles wat er ligt, staat zichtbaar in de wapenrekken en op de stapel.
   - Een vrije dorpeling loopt naar de kazerne zodra de materialen er liggen of onderweg zijn, gaat bij een
     oefenplek staan (pop, schietschijf of oefenveld) en begint pas als het wapen en de uitrusting er echt
     zijn. Dan oefent hij met het echte wapen tot de trainingstijd om is.
   - Daarna is hij een soldaat: dezelfde bewoner (de bevolking groeit niet), met eigen uitrusting en
     eigenschappen. Soldaten zijn te selecteren en te sturen: verplaatsen, wachten of patrouilleren.
   Gevechten zelf bestaan nog niet; VE.soldierDamage (config.js), hp en bereik zijn de basis daarvoor. */
'use strict';
(function (VE) {
  let N = VE.N; const SOL = VE.SOLDIERS;
  (VE.sizeHooks = VE.sizeHooks || []).push(n => { N = n; });
  const emit = (e, a) => VE.bus.emit(e, a);
  const sfx = (n, x, z) => emit('sfx', { n: n, x: x, z: z });
  const QUEUE_MAX = 30;
  const KEEP_FREE = 3;          // zoveel vrije dorpelingen blijven altijd over voor het dragen
  const STOCK_CAP = 12;         // max. per goed in de kazerne (2 rekken × 6 wapens; uitrusting op de stapel)
  const RACK_TOTAL = 12, RESERVE_W = 6, RESERVE_GEAR = 6;   // voorraad zonder wachtrij: wapens in de rekken, uitrusting
  /* oefening per type: animatieclip (settler.glb) en ritme (s) — zie ACT_PERIOD in settler-glb.js */
  VE.DRILL_ACT = { swordsman: 'slash', axeman: 'cleave', dagger: 'stab', spearman: 'thrust', archer: 'shoot', crossbowman: 'xbow' };
  VE.DRILL_PERIOD = { slash: 0.9, cleave: 1.35, stab: 0.5, thrust: 1.05, shoot: 1.9, xbow: 2.6 };
  /* afstand van oefenplek tot pop / schijf / paal, als het model geen 'tg'-marker heeft */
  const TARGET_DIST = { dummy: 0.2, target: 0.85, drill: 0.32 };

  const P = VE.Game.prototype;

  /* ---------------- kazerne: oefenplekken en voorraad ---------------- */
  /* oefenplekken in wereldcoördinaten: { x, z, rot, kind, tx, ty, tz } (rot = kijkrichting, t = pop/schijf) */
  P.drillSpots = function (b) {
    const md = VE.buildModel(b.type, b.level);
    const list = (md.drill && md.drill.length ? md.drill : VE.DRILL_SPOT && VE.DRILL_SPOT[b.type] && VE.DRILL_SPOT[b.type][b.level - 1]) || [];
    return list.map(d => {
      const tx = d.t ? d.t[0] : d[0] + Math.sin(d[3]) * TARGET_DIST[d[4]], tz = d.t ? d.t[2] : d[2] + Math.cos(d[3]) * TARGET_DIST[d[4]];
      return { x: b.cx + d[0], z: b.cz + d[2], rot: d[3], kind: d[4], tx: b.cx + tx, ty: b.y + (d.t ? d.t[1] : 0.16), tz: b.cz + tz };
    });
  };
  P.queueOf = function (b) { return b.queue || (b.queue = []); };
  /* wat één rekruut van type t nodig heeft */
  P.trainNeeds = function (t) { const S = SOL[t], n = {}; n[S.weapon] = 1; if (S.gear) n.gear = S.gear; return n; };
  /* welke wachtende rekruten hun materialen al hebben (in de kazerne of onderweg), in volgorde van de wachtrij */
  P.barracksPlan = function (b) {
    const pool = {}, Q = this.queueOf(b);
    for (const r of VE.RES_ORDER) pool[r] = (b.input[r] || 0) + (b.incoming[r] || 0);
    for (const e of Q) {
      if (e.st === 'train') { e.cov = true; continue; }
      const need = this.trainNeeds(e.t);
      let ok = true; for (const r in need) if (pool[r] < need[r]) ok = false;
      if (ok) for (const r in need) pool[r] -= need[r];
      e.cov = ok;
    }
    return Q;
  };
  /* hoeveel van r de kazerne nog wil hebben (wachtrij min wat er ligt en onderweg is) */
  P.barracksWant = function (b, r) {
    if (!b.built || !b.alive || !VE.RES[r]) return 0;
    let need = 0;
    for (const e of this.queueOf(b)) if (e.st !== 'train') need += this.trainNeeds(e.t)[r] || 0;
    const have = (b.input[r] || 0) + (b.incoming[r] || 0);
    // vaste voorraad, ook zonder wachtrij: wapens in de rekken (max. RESERVE_W per soort, samen niet meer dan
    // in de rekken past) en een stapel trainingsuitrusting. Zo heeft wat de wapensmederij maakt altijd een
    // bestemming en raakt zijn eigen opslag niet vol.
    let keep = 0;
    if (VE.RES[r].weapon) {
      let all = 0; for (const w of VE.WEAPONS) all += (b.input[w] || 0) + (b.incoming[w] || 0);
      keep = Math.min(RESERVE_W, have + Math.max(0, RACK_TOTAL - all));
    } else if (r === 'gear') keep = RESERVE_GEAR;
    return Math.max(Math.min(need, STOCK_CAP), keep) - have;
  };
  /* in de wachtrij zetten: n soldaten van type t (goud direct betaald) */
  P.queueTraining = function (b, t, n) {
    const S = SOL[t]; if (!S || !b || !b.alive || !b.def.barracks) return 0;
    const Q = this.queueOf(b);
    let k = 0;
    for (; k < (n || 1); k++) {
      if (Q.length >= QUEUE_MAX || this.gold < S.gold) break;
      this.gold -= S.gold;
      Q.push({ t: t, st: 'queued', s: null, p: 0, id: ++this.bid });
    }
    return k;
  };
  /* één plek uit de wachtrij halen (positie in de wachtrij of het item zelf): goud terug; was hij al aan het
     trainen, dan ook wapen en uitrusting */
  P.cancelTraining = function (b, idx) {
    const Q = this.queueOf(b), e = typeof idx === 'number' ? Q[idx] : idx;
    if (e && Q.indexOf(e) < 0) return false;
    if (!e) return false;
    Q.splice(Q.indexOf(e), 1);
    this.gold += SOL[e.t].gold;
    if (e.st === 'train') { const need = this.trainNeeds(e.t); for (const r in need) b.input[r] = (b.input[r] || 0) + need[r]; }
    e.st = 'cancelled';
    if (e.s) this.releaseTrainee(e.s);
    this.sd = true;
    return true;
  };
  /* sloop: wachtrij leeg, goud terug, materialen van rekruten in training terug in de invoer (sloop geeft die terug) */
  P.clearBarracks = function (b) {
    const Q = this.queueOf(b);
    while (Q.length) this.cancelTraining(b, 0);
  };
  P.releaseTrainee = function (s) {
    const e = s.entry;
    if (e) {
      // rekruut weg terwijl hij al trainde (zou niet moeten gebeuren): wapen en uitrusting terug in de kazerne
      const b = s.work;
      if (e.st === 'train' && b && b.alive) { const need = this.trainNeeds(e.t); for (const r in need) b.input[r] = (b.input[r] || 0) + need[r]; this.sd = true; }
      e.s = null; if (e.st !== 'cancelled') e.st = 'queued'; e.spot = null; e.p = 0;
    }
    s.entry = null; s.work = null; s.mode = 'idle'; s.role = 'carrier'; s.act = null; s.weapon = null; s.tool = null;
    s.path = null; s.cb = null; s.wt = 0.5; s.hidden = false;
  };

  /* ---------------- dispatch: materialen en rekruten ---------------- */
  /* stap in Game.dispatch: dragers halen wapens en uitrusting (wapensmederij of opslag) */
  P.dispatchBarracks = function (take, idle, cap) {
    let n = 0;
    for (const b of this.buildings) {
      // zonder wachtrij vult de kazerne haar voorraad alleen aan met wat de wapensmederij net maakt
      // (moveOutputs → findConsumer); de Storehouses worden dan niet leeggehaald
      if (!b.alive || !b.built || !b.def.barracks || b.unreach > this.time || !b.queue || !b.queue.length) continue;
      for (const r of VE.RES_ORDER) {
        let want = this.barracksWant(b, r);
        while (want > 0 && n < cap && idle.length && this.avail(r) > 0) {
          const src = this.sourceFor(r, b.dx, b.dz, true); if (!src) break;
          const s = take(src.dx, src.dz); if (!s) break;
          this.startTransport(s, r, src, b); want--; n++;
        }
      }
    }
    return n;
  };
  /* stap in Game.dispatch: vrije dorpelingen naar de kazerne (alleen als hun spullen er liggen of onderweg zijn) */
  P.dispatchRecruits = function (take, idle, cap) {
    let n = 0;
    for (const b of this.buildings) {
      if (!b.alive || !b.built || !b.def.barracks || b.unreach > this.time || !b.queue || !b.queue.length) continue;
      // vrije oefenplekken per soort; wie al onderweg of bezig is, houdt de zijne
      const free = { dummy: 0, target: 0, drill: 0 };
      for (const d of this.drillSpots(b)) free[d.kind]++;
      for (const e of b.queue) if (e.s) claimSpot(free, e.t, e.spot);
      for (const e of this.barracksPlan(b)) {
        if (n >= cap || idle.length <= KEEP_FREE) break;
        if (e.s || !e.cov || !claimSpot(free, e.t)) continue;           // geen passende plek vrij: deze wacht
        const s = take(b.dx, b.dz); if (!s) break;
        this.assignTrainee(s, b, e); n++;
      }
    }
    return n;
  };
  /* plek reserveren voor type t: afstand alleen bij een schietschijf, melee bij de eigen soort of anders
     een andere plek die geen schijf is. Met `has` (de plek die hij al heeft) telt precies die. */
  function claimSpot(free, t, has) {
    if (has) { if (free[has.kind] > 0) free[has.kind]--; return true; }
    const want = SOL[t].drill;
    if (free[want] > 0) { free[want]--; return true; }
    if (want === 'target') return false;
    for (const k of ['dummy', 'drill']) if (free[k] > 0) { free[k]--; return true; }
    return false;
  }
  P.assignTrainee = function (s, b, e) {
    e.s = s; e.st = 'walk'; s.entry = e; s.work = b; s.mode = 'train'; s.role = 'recruit'; s.tool = null; s.act = null; s.carry = null;
    const ok = this.walkToB(s, b, () => this.enterYard(s));
    if (!ok) { this.releaseTrainee(s); b.unreach = this.time + 6; }
  };
  /* bij de poort: naar een vrije oefenplek die bij het type past */
  P.enterYard = function (s) {
    const b = s.work, e = s.entry;
    if (!b || !b.alive || !e) { this.releaseTrainee(s); return; }
    const spots = this.drillSpots(b), want = SOL[e.t].drill, ranged = want === 'target';
    const used = new Set(); for (const q of b.queue) if (q.spot && q !== e) used.add(q.spot.i);
    let pick = -1;
    for (let pass = 0; pass < 2 && pick < 0; pass++) {
      for (let i = 0; i < spots.length; i++) {
        if (used.has(i)) continue;
        const k = spots[i].kind;
        if (pass === 0 ? k === want : (!ranged && k !== 'target')) { pick = i; break; }
      }
    }
    if (pick < 0) { e.st = 'gate'; s.wt = 1; return; }                    // alle passende plekken bezet: even wachten
    const sp = Object.assign({ i: pick }, spots[pick]);
    e.spot = sp; e.st = 'enter';
    s.path = [[s.x * 0.5 + sp.x * 0.5, s.z * 0.5 + sp.z * 0.5], [sp.x, sp.z]]; s.pi = 0;   // door de poort het oefenterrein op
    s.cb = () => { e.st = 'wait'; s.rot = sp.rot; };
  };

  /* ---------------- rekruut: wachten op spullen, oefenen, soldaat worden ---------------- */
  P.updateTrainee = function (s, dt) {
    const b = s.work, e = s.entry;
    if (!b || !b.alive || !e || !b.queue || b.queue.indexOf(e) < 0) { this.releaseTrainee(s); return; }
    if (s.path) return;
    if (e.st === 'gate') { s.wt -= dt; if (s.wt <= 0) this.enterYard(s); return; }
    if (e.st === 'wait') {
      const need = this.trainNeeds(e.t);
      let ok = true; for (const r in need) if ((b.input[r] || 0) < need[r]) ok = false;
      s.rot = e.spot.rot; s.act = null;
      if (!ok) return;
      for (const r in need) b.input[r] -= need[r];                      // wapen uit het rek, uitrusting van de stapel
      this.sd = true;
      e.st = 'train'; e.p = 0; s.weapon = SOL[e.t].weapon; s.act = VE.DRILL_ACT[e.t]; s.ap = 0; s.actTick = 0;
      return;
    }
    if (e.st !== 'train') return;
    const S = SOL[e.t], sp = e.spot, per = VE.DRILL_PERIOD[s.act] || 1;
    s.rot = sp.rot;
    e.p += dt * this.lvlMult(b);
    s.ap += dt;
    const tick = Math.floor(s.ap / per);
    if (tick !== s.actTick) {
      s.actTick = tick;
      if (S.drill === 'target') {
        // schot: de pijl (of bout) vliegt naar de schijf en blijft er even in steken
        const hx = s.x + Math.sin(s.rot) * 0.1, hz = s.z + Math.cos(s.rot) * 0.1;
        emit('arrow', { x: hx, y: s.y + 0.32, z: hz, tx: sp.tx + (Math.random() - 0.5) * 0.06, ty: sp.ty + (Math.random() - 0.5) * 0.06, tz: sp.tz, bolt: e.t === 'crossbowman' });
        sfx('bow', s.x, s.z);
      } else {
        sfx(e.t === 'spearman' ? 'thwack' : 'chop', s.x, s.z);
        emit('chips', { x: sp.tx, y: sp.ty, z: sp.tz, straw: true });     // stro uit de pop
      }
    }
    if (e.p >= S.time) this.finishTraining(s, b, e);
  };
  P.finishTraining = function (s, b, e) {
    const Q = b.queue; Q.splice(Q.indexOf(e), 1);
    s.entry = null; s.work = null;
    this.stats.trained = (this.stats.trained || 0) + 1;
    this.makeSoldier(s, e.t);
    // verzamelen vóór de kazerne
    const spot = this.freeSpotNear(b.dx, b.dz + 0.9, this.soldiers().filter(o => o !== s).map(o => o.sol.h));
    s.sol.h = spot; s.sol.face = 0;
    if (!this.walkTo(s, this.tileOf(spot[0], spot[1]), () => this.soldierArrived(s), spot[0], spot[1])) { s.x = spot[0]; s.z = spot[1]; }
    emit('poof', { x: s.x, y: s.y + 0.2, z: s.z });
    sfx('done', s.x, s.z);
    emit('toast', { text: SOL[e.t].icon + ' A new ' + SOL[e.t].name.toLowerCase() + ' has finished training!' });
  };
  P.makeSoldier = function (s, t) {
    const S = SOL[t];
    s.mode = 'soldier'; s.role = 'soldier'; s.weapon = S.weapon; s.spd = S.speed; s.act = null; s.tool = null; s.carry = null; s.hidden = false;
    s.sol = { t: t, hp: S.hp, ord: 'hold', h: [s.x, s.z], pts: null, pi: 0, wait: 0, face: s.rot };
    return s;
  };

  /* ---------------- soldaten ---------------- */
  P.soldiers = function (t) { return this.settlers.filter(s => s.mode === 'soldier' && (!t || s.sol.t === t)); };
  P.soldierCount = function () { const c = { total: 0 }; for (const s of this.settlers) if (s.mode === 'soldier') { c.total++; c[s.sol.t] = (c[s.sol.t] || 0) + 1; } return c; };
  P.updateSoldier = function (s, dt) {
    const o = s.sol;
    if (s.path) { s.act = null; return; }
    if (o.ord === 'patrol' && o.pts) {
      o.wait -= dt;
      if (o.wait <= 0) {
        o.pi = (o.pi + 1) % o.pts.length;
        const p = o.pts[o.pi];
        if (!this.walkTo(s, this.tileOf(p[0], p[1]), () => this.soldierArrived(s), p[0], p[1])) { o.ord = 'hold'; o.h = [s.x, s.z]; }
      } else if (o.face !== undefined) s.rot = turn(s.rot, o.face, dt);
      return;
    }
    // wachten: stilstaan op de wachtplek, in de looprichting (of rustig rondkijken)
    if (o.face !== undefined) s.rot = turn(s.rot, o.face, dt);
  };
  function turn(a, b, dt) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * Math.min(1, dt * 6); }
  P.soldierArrived = function (s) {
    const o = s.sol; if (!o) return;
    o.face = s.rot;
    if (o.ord === 'patrol') o.wait = 1.6 + Math.random() * 1.6;
    else o.h = [s.x, s.z];
  };

  /* vrije, beloopbare plek bij (x, z), niet te dicht bij `taken` (andere soldaten) */
  P.freeSpotNear = function (x, z, taken) {
    const w = this.world, T = taken || [];
    const ok = (px, pz) => {
      const i = Math.floor(px), j = Math.floor(pz);
      if (!w.inb(i, j) || !w.walkable(j * N + i)) return false;
      for (const t of T) if (t && (t[0] - px) ** 2 + (t[1] - pz) ** 2 < 0.36 * 0.36) return false;
      return true;
    };
    if (ok(x, z)) return [x, z];
    for (let r = 1; r <= 12; r++) {
      const n = 6 * r;
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2 + r * 0.7, px = x + Math.cos(a) * r * 0.36, pz = z + Math.sin(a) * r * 0.36;
        if (ok(px, pz)) return [px, pz];
      }
    }
    return [x, z];
  };
  /* formatie: rijen loodrecht op de looprichting, sterke types voorop (melee voor, afstand achter) */
  P.formation = function (list, x, z) {
    let cx = 0, cz = 0; for (const s of list) { cx += s.x; cz += s.z; } cx /= list.length; cz /= list.length;
    let fx = x - cx, fz = z - cz; const fl = Math.hypot(fx, fz);
    if (fl < 0.01) { fx = 0; fz = 1; } else { fx /= fl; fz /= fl; }
    const rx = fz, rz = -fx;                                         // rechts van de looprichting
    const order = list.slice().sort((a, b) => (SOL[b.sol.t].range > 2 ? 0 : 1) - (SOL[a.sol.t].range > 2 ? 0 : 1) || a.id - b.id);
    const cols = Math.max(1, Math.min(6, Math.ceil(Math.sqrt(order.length * 1.6)))), SP = 0.42;
    const taken = [], out = new Map();
    order.forEach((s, i) => {
      const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, order.length - r * cols);
      const off = (c - (inRow - 1) / 2) * SP, back = -r * SP;
      const p = this.freeSpotNear(x + rx * off + fx * back, z + rz * off + fz * back, taken);
      taken.push(p); out.set(s, p);
    });
    return { spots: out, face: Math.atan2(fx, fz) };
  };
  /* bevel: naar (x, z) lopen en daar wachten, of daarheen patrouilleren (heen en weer vanaf de huidige plek) */
  P.orderSoldiers = function (list, x, z, mode) {
    list = list.filter(s => s.mode === 'soldier');
    if (!list.length) return 0;
    const w = this.world;
    if (!w.inb(Math.floor(x), Math.floor(z))) return 0;
    const f = this.formation(list, x, z);
    let ok = 0;
    for (const s of list) {
      const p = f.spots.get(s), o = s.sol;
      o.face = f.face;
      if (mode === 'patrol') { o.ord = 'patrol'; o.pts = [[s.x, s.z], p]; o.pi = 1; o.wait = 0; }
      else { o.ord = 'hold'; o.pts = null; o.h = p; }
      s.path = null; s.cb = null;
      if (this.walkTo(s, this.tileOf(p[0], p[1]), () => this.soldierArrived(s), p[0], p[1])) ok++;
      else { o.ord = 'hold'; o.pts = null; o.h = [s.x, s.z]; }
    }
    if (ok) sfx('march', x, z);
    return ok;
  };
  /* halt: blijven staan waar ze nu zijn */
  P.holdSoldiers = function (list) {
    for (const s of list) {
      if (s.mode !== 'soldier') continue;
      s.path = null; s.cb = null; s.moving = false;
      s.sol.ord = 'hold'; s.sol.pts = null; s.sol.h = [s.x, s.z];
    }
  };
  /* ontslaan: de soldaat wordt weer een gewone dorpeling, het wapen gaat terug naar de opslag */
  P.dismissSoldier = function (s) {
    if (!s || s.mode !== 'soldier') return false;
    this.addGoods(SOL[s.sol.t].weapon, 1, s.x, s.z);
    s.sol = null; s.mode = 'idle'; s.role = 'carrier'; s.weapon = null; s.spd = 1; s.path = null; s.cb = null; s.act = null; s.wt = 0.5;
    return true;
  };
  /* dichtstbijzijnde soldaat bij (x, z) binnen r */
  P.soldierAt = function (x, z, r) {
    let best = null, bd = (r || 0.4) ** 2;
    for (const s of this.settlers) if (s.mode === 'soldier') { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; best = s; } }
    return best;
  };

  /* ---------------- status van de kazerne ---------------- */
  P.barracksStatus = function (b) {
    const Q = this.queueOf(b);
    if (!Q.length) return 'Choose soldiers to train';
    let tr = 0, wait = 0, walk = 0; for (const e of Q) { if (e.st === 'train') tr++; else if (e.st === 'wait' || e.st === 'gate') wait++; else if (e.s) walk++; }
    if (tr) return 'Training ' + tr + ' recruit' + (tr > 1 ? 's' : '');
    if (wait) return 'Recruits wait for their weapons';
    if (walk) return 'Recruits are on their way';
    const need = this.missingFor(b);
    return need ? 'Waiting for ' + need : 'Waiting for free settlers';
  };
  /* eerste ontbrekende goed voor de wachtrij (nergens in het dorp te vinden), of null */
  P.missingFor = function (b) {
    for (const e of this.barracksPlan(b)) {
      if (e.cov || e.st === 'train') continue;
      const need = this.trainNeeds(e.t);
      for (const r in need) if ((b.input[r] || 0) + (b.incoming[r] || 0) + this.avail(r) < need[r]) return VE.RES[r].name.toLowerCase();
      return null;
    }
    return null;
  };

  /* ---------------- opslaan / laden ---------------- */
  /* rekruten in training: hun wapen en uitrusting gaan in de save terug in de kazerne (na laden traint hij opnieuw) */
  P.serializeBarracks = function (b, e) {
    if (!b.queue) return;
    e.q = b.queue.map(x => x.t);
    for (const x of b.queue) if (x.st === 'train') { const need = this.trainNeeds(x.t); for (const r in need) e.inp[r] = (e.inp[r] || 0) + need[r]; }
  };
  P.loadBarracks = function (b, bs) {
    if (!b.def.barracks) return;
    b.queue = b.queue || [];
    if (!bs.q) return;
    for (const t of bs.q) if (SOL[t]) this.queueOf(b).push({ t: t, st: 'queued', s: null, p: 0, id: ++this.bid });
  };
  P.serializeSoldiers = function () {
    const r2 = v => Math.round(v * 100) / 100, ang = a => r2(Math.atan2(Math.sin(a), Math.cos(a)));
    return this.soldiers().map(s => {
      const o = s.sol, tgt = s.path && s.path.length ? s.path[s.path.length - 1] : null;
      return { t: o.t, x: r2(s.x), z: r2(s.z), r: ang(s.rot), hp: o.hp, o: o.ord, h: o.h ? [r2(o.h[0]), r2(o.h[1])] : null,
        p: o.pts ? o.pts.map(q => [r2(q[0]), r2(q[1])]) : null, pi: o.pi, f: o.face !== undefined ? ang(o.face) : null, g: tgt && o.ord === 'hold' ? [r2(tgt[0]), r2(tgt[1])] : null };
    });
  };
  P.loadSoldiers = function (list) {
    for (const d of list || []) {
      if (!SOL[d.t]) continue;
      const s = this.spawnSettler(); if (!s) break;
      s.x = d.x; s.z = d.z; s.rot = d.r || 0;
      this.makeSoldier(s, d.t);
      const o = s.sol;
      o.hp = d.hp || SOL[d.t].hp; o.ord = d.o === 'patrol' && d.p ? 'patrol' : 'hold'; o.h = d.h || [d.x, d.z]; o.pts = d.p || null; o.pi = d.pi || 0;
      if (d.f !== null && d.f !== undefined) o.face = d.f;
      const g = d.g || (o.ord === 'hold' && o.h && (o.h[0] - d.x) ** 2 + (o.h[1] - d.z) ** 2 > 0.04 ? o.h : null);
      if (g) this.walkTo(s, this.tileOf(g[0], g[1]), () => this.soldierArrived(s), g[0], g[1]);
      else if (o.ord === 'patrol') o.wait = 0.5;
    }
  };

  /* ---------------- oefenpoppen: knikken bij elke klap (geanimeerde delen 'dummy0', 'dummy1' ...) ---------------- */
  VE.bus.on('chips', e => {
    const g = VE.game; if (!g || !e.straw) return;
    for (const b of g.buildings) {
      if (!b.alive || !b.def.barracks || !b.anims) continue;
      for (const a of b.anims) if (/^dummy/.test(a.kind) && (b.cx + a.mesh.position.x - e.x) ** 2 + (b.cz + a.mesh.position.z - e.z) ** 2 < 0.06) a.hit = 1;
    }
  });
  const prevAnim = VE.animPart;
  VE.animPart = function (game, b, a, dt) {
    if (/^dummy/.test(a.kind)) {
      // de pop veert terug na een klap (draait om de voet, van de oefenplek af)
      a.hit = Math.max(0, (a.hit || 0) - dt * 2.2);
      const k = a.hit;
      a.mesh.rotation.x = -Math.sin(k * 9) * k * 0.28;
      a.mesh.rotation.y = Math.sin(k * 6) * k * 0.12;
      return;
    }
    if (prevAnim) prevAnim(game, b, a, dt);
  };
})(window.VE);
