/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Gevechten (single player tegen AI; straks ook online).

   - Soldaten van verschillende teams vallen elkaar automatisch aan binnen hun waakafstand (AGGRO tegels, voor
     boogschutters hun bereik + 2). Schade: VE.soldierDamage (aanval, verdediging, steen-papier-schaar via `strong`).
   - Bevel 'attack' (commando, js/commands.js): naar een vijandelijk gebouw of een vijandelijke soldaat lopen en die
     aanvallen; onderweg vechten ze met vijanden die ze tegenkomen. Daarna blijven ze staan waar ze zijn.
   - Na een gevecht lopen soldaten die 'hold' hadden terug naar hun wachtplek.
   - Gebouwen hebben levenspunten (VE.buildingHP). Op 0: het gebouw stort in (geen materialen terug).
   - Wachttorens schieten op vijandelijke soldaten binnen TOWER_R tegels.
   - Dorpshuis verwoest = die speler is verslagen. Zijn overige gebouwen vervallen daarna langzaam, zijn dorpelingen
     vertrekken. Zijn alle tegenstanders verslagen, dan heeft de laatste speler (of het laatste team) gewonnen.
   Alles is deterministisch (vaste ticks, geen Math.random) en zit in de snapshot. */
'use strict';
(function (VE) {
  const P = VE.Game.prototype, SOL = VE.SOLDIERS;
  const emit = (e, a) => VE.bus.emit(e, a);
  const sfx = (n, x, z) => emit('sfx', { n: n, x: x, z: z });
  const AGGRO = 6, LEASH = 11, TOWER_R = 6.5, TOWER_DMG = 9, TOWER_RATE = 1.6;

  /* vaandel in de spelerskleur (tegen de AI: wie is de eigenaar van dit gebouw?) */
  const BANNER = {};
  VE.ownerBanner = function (color, size) {
    if (!BANNER.pole) {
      BANNER.pole = new THREE.CylinderGeometry(0.012, 0.014, 0.62, 5); BANNER.pole.translate(0, 0.31, 0);
      const f = new THREE.BufferGeometry();
      f.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.6, 0, 0.2, 0.53, 0, 0, 0.46, 0], 3)); f.computeVertexNormals();
      BANNER.flag = f; BANNER.poleMat = new THREE.MeshLambertMaterial({ color: 0x5a3a22 });
    }
    const key = 'm' + color;
    BANNER[key] = BANNER[key] || new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide });
    const g = new THREE.Group(), s = (size || 1) / 2;
    g.add(new THREE.Mesh(BANNER.pole, BANNER.poleMat)); const fl = new THREE.Mesh(BANNER.flag, BANNER[key]); g.add(fl);
    g.position.set(-s + 0.08, 0, -s + 0.08); g.name = 'ownerBanner';
    return g;
  };
  /* levenspunten van een gebouw */
  VE.buildingHP = function (b) {
    const t = b.type, L = b.level || 1;
    if (t === 'hq') return 1200;
    if (t === 'tower') return 380 + 120 * (L - 1);
    if (t === 'barracks') return 520;
    if (t === 'yard') return 60;
    return (b.def.size > 1 ? 300 : 200) + 60 * (L - 1);
  };
  P.hpOf = function (b) { if (b.hp === undefined) b.hp = VE.buildingHP(b); return b.hp; };
  P.enemies = function (a, b) {
    if (a === b) return false;
    const pa = this.players[a], pb = this.players[b];
    return !!(pa && pb && pa.team !== pb.team);
  };

  /* ---------- bevel: aanvallen (vanuit het commando) ---------- */
  P.orderAttack = function (list, targetId) {
    const b = this.bmap[targetId];
    let tu = null;
    if (!b) tu = this.settlers.find(s => s.id === targetId && s.mode === 'soldier') || null;
    const owner = list.length ? list[0].owner : -1;
    if (b && (!b.alive || !this.enemies(owner, b.owner))) return { ok: false, why: 'Choose an enemy building or soldier' };
    if (!b && (!tu || !this.enemies(owner, tu.owner))) return { ok: false, why: 'Choose an enemy building or soldier' };
    let n = 0;
    for (const s of list) {
      const o = s.sol; if (!o) continue;
      o.ord = 'attack'; o.pts = null; o.tb = b ? b.id : 0; o.tu = tu ? tu.id : 0; o.eng = 0; o.chase = 0;
      s.path = null; s.cb = null;
      n++;
    }
    if (n) sfx('march', b ? b.cx : tu.x, b ? b.cz : tu.z);
    return { ok: n > 0, attacking: n };
  };

  /* ---------- elke tick ---------- */
  P.combatTick = function (dt) {
    const sol = [];
    for (const s of this.settlers) if (s.mode === 'soldier' && s.sol && s.sol.hp > 0) sol.push(s);
    const byId = new Map(); for (const s of sol) byId.set(s.id, s);
    const dead = [];
    for (const s of sol) {
      if (s.sol.hp <= 0) continue;
      this.cur = s.owner;
      this.soldierFight(s, sol, byId, dt, dead);
    }
    // wachttorens
    for (const b of this.buildings) {
      if (!b.alive || !b.built || b.type !== 'tower') continue;
      b.shotT = (b.shotT || 0) - dt;
      if (b.shotT > 0) continue;
      let best = null, bd = TOWER_R * TOWER_R;
      for (const s of sol) { if (s.sol.hp <= 0 || !this.enemies(b.owner, s.owner)) continue; const d = (s.x - b.cx) ** 2 + (s.z - b.cz) ** 2; if (d < bd) { bd = d; best = s; } }
      if (!best) { b.shotT = 0.5; continue; }
      b.shotT = TOWER_RATE;
      emit('arrow', { x: b.cx, y: b.y + 1.4, z: b.cz, tx: best.x, ty: (best.y || 0) + 0.25, tz: best.z });
      this.hurtSoldier(best, TOWER_DMG, dead);
    }
    for (const s of dead) this.killSoldier(s);
    // vijandelijke soldaten bij mijn dorpshuis: waarschuwen (eens per 30 s)
    const hq = this.hqOf(this.me);
    if (hq && this.time - (this.alarmT || -99) > 30 && sol.some(s => this.enemies(this.me, s.owner) && (s.x - hq.cx) ** 2 + (s.z - hq.cz) ** 2 < 220)) {
      this.alarmT = this.time; emit('toast', { text: '⚠️ Enemy soldiers near your Village Hall!', all: true }); sfx('fanfare', hq.cx, hq.cz);
    }
    this.cur = this.me;
    this.checkDefeat(dt);
  };

  P.soldierFight = function (s, sol, byId, dt, dead) {
    const o = s.sol, S = SOL[o.t];
    o.cd = (o.cd || 0) - dt; o.chase = (o.chase || 0) - dt;
    const reach = S.range + 0.25, aggro = Math.max(AGGRO, S.range + 2);
    // doel kiezen: huidige vijand (als hij nog leeft en niet te ver is), anders de dichtstbijzijnde vijand
    let t = o.eng ? byId.get(o.eng) : null;
    if (t && (t.sol.hp <= 0 || (t.x - s.x) ** 2 + (t.z - s.z) ** 2 > LEASH * LEASH)) t = null;
    if (!t && o.tu) { t = byId.get(o.tu) || null; if (!t) o.tu = 0; }
    if (!t) {
      let bd = aggro * aggro;
      for (const e of sol) { if (e.sol.hp <= 0 || !this.enemies(s.owner, e.owner)) continue; const d = (e.x - s.x) ** 2 + (e.z - s.z) ** 2; if (d < bd) { bd = d; t = e; } }
    }
    if (t) {
      o.eng = t.id;
      const d = Math.hypot(t.x - s.x, t.z - s.z);
      if (d <= reach) {
        if (s.path) { s.path = null; s.cb = null; s.moving = false; }
        s.rot = Math.atan2(t.x - s.x, t.z - s.z); s.act = VE.DRILL_ACT ? VE.DRILL_ACT[o.t] : null;
        if (o.cd <= 0) {
          o.cd = 1 / S.rate;
          if (S.range > 2) emit('arrow', { x: s.x, y: (s.y || 0) + 0.32, z: s.z, tx: t.x, ty: (t.y || 0) + 0.25, tz: t.z, bolt: o.t === 'crossbowman' });
          else sfx('chop', s.x, s.z);
          this.hurtSoldier(t, VE.soldierDamage(o.t, t.sol.t), dead);
        }
      } else if (o.chase <= 0 || !s.path) {
        o.chase = 0.8; s.act = null;
        // naar de vijand toe (tot net binnen bereik)
        const k = Math.max(0, d - reach * 0.8) / (d || 1), x = s.x + (t.x - s.x) * k, z = s.z + (t.z - s.z) * k;
        this.walkTo(s, this.tileOf(x, z), null, x, z);
      }
      return;
    }
    o.eng = 0;
    // geen vijand in de buurt: aanvalsbevel op een gebouw uitvoeren
    if (o.ord === 'attack' && o.tb) {
      const b = this.bmap[o.tb];
      if (!b || !b.alive) { o.ord = 'hold'; o.tb = 0; o.h = [s.x, s.z]; s.act = null; return; }
      const half = (b.size || 1) / 2 + 0.25, dx = Math.max(Math.abs(s.x - b.cx) - half, 0), dz = Math.max(Math.abs(s.z - b.cz) - half, 0);
      const d = Math.hypot(dx, dz);
      if (d <= reach) {
        if (s.path) { s.path = null; s.cb = null; s.moving = false; }
        s.rot = Math.atan2(b.cx - s.x, b.cz - s.z); s.act = VE.DRILL_ACT ? VE.DRILL_ACT[o.t] : null;
        if (o.cd <= 0) {
          o.cd = 1 / S.rate;
          if (S.range > 2) emit('arrow', { x: s.x, y: (s.y || 0) + 0.32, z: s.z, tx: b.cx, ty: b.y + 0.4, tz: b.cz, bolt: o.t === 'crossbowman' });
          else { sfx('chop', s.x, s.z); emit('dust', { x: s.x + Math.sin(s.rot) * 0.3, y: b.y + 0.15, z: s.z + Math.cos(s.rot) * 0.3, n: 2, small: true }); }
          this.hurtBuilding(b, S.atk * (S.range > 2 ? 0.6 : 1.4), s.owner);
        }
      } else if (o.chase <= 0 || !s.path) {
        o.chase = 1.5; s.act = null;
        // naar de dichtstbijzijnde vrije plek naast het gebouw
        const p = this.freeSpotNear(b.cx + Math.sign(s.x - b.cx) * half, b.cz + Math.sign(s.z - b.cz) * half, []);
        if (!this.walkTo(s, this.tileOf(p[0], p[1]), null, p[0], p[1])) { o.ord = 'hold'; o.tb = 0; o.h = [s.x, s.z]; }
      }
      return;
    }
    // na een gevecht terug naar de wachtplek
    if (s.act && !s.path) s.act = null;
    if (o.ord === 'hold' && o.h && !s.path && (o.h[0] - s.x) ** 2 + (o.h[1] - s.z) ** 2 > 0.5) {
      if (!this.walkTo(s, this.tileOf(o.h[0], o.h[1]), VE.K('soldierArrived'), o.h[0], o.h[1])) o.h = [s.x, s.z];
    }
  };

  P.hurtSoldier = function (t, dmg, dead) {
    if (t.sol.hp <= 0) return;
    t.sol.hp -= dmg;
    if (t.sol.hp <= 0) dead.push(t);
  };
  P.killSoldier = function (s) {
    if (this.settlers.indexOf(s) < 0) return;
    emit('poof', { x: s.x, y: (s.y || 0) + 0.2, z: s.z });
    sfx('demolish', s.x, s.z);
    s.path = null; s.cb = null;
    this.settlers = this.settlers.filter(x => x !== s);
    const p = this.players[s.owner]; if (p) p.stats.lost = (p.stats.lost || 0) + 1;
    if (s.owner === this.me) emit('toast', { text: '⚔️ A ' + SOL[s.sol.t].name.toLowerCase() + ' has fallen', all: true });
  };
  P.hurtBuilding = function (b, dmg, by) {
    if (!b.alive) return;
    b.hp = this.hpOf(b) - dmg;
    b.hitT = 1;
    if (b.hp > 0) return;
    const owner = b.owner, isHQ = b.type === 'hq';
    if (owner === this.me && !isHQ) emit('toast', { text: '🔥 Your ' + b.def.name + ' was destroyed!', all: true });
    this.as(owner, () => this.destroyBuilding(b));
    if (isHQ) this.defeat(owner, by);
  };
  /* verwoest (niet gesloopt): geen materialen terug, de goederen erin zijn weg */
  P.destroyBuilding = function (b) {
    if (!b.alive) return;
    b.input = {}; b.output = {}; if (b.store) b.store = {}; b.lumber && this.dropLumber(b);
    if (b.up) b.up.delivered = {};
    b.delivered = {}; b.ruined = true;
    this.demolish(b, true);
    emit('dust', { x: b.cx, y: b.y, z: b.cz, n: 20 });
  };

  /* ---------- verslagen en gewonnen ---------- */
  P.defeat = function (pid, by) {
    const p = this.players[pid]; if (!p || p.defeated) return;
    p.defeated = true; p.defeatT = this.time;
    // dorpelingen vertrekken, soldaten geven het op
    this.settlers = this.settlers.filter(s => s.owner !== pid);
    for (const b of this.buildings) if (b.owner === pid) { b.worker = null; b.builder = null; if (b.queue) b.queue.length = 0; }
    emit('defeat', { player: pid, by: by });
    if (pid === this.me) { emit('toast', { text: '🏰 Your Village Hall has fallen!', all: true }); emit('gameOver', { victory: false, game: this }); }
    else emit('toast', { text: '🏳️ ' + p.name + ' has been defeated!', all: true });
    this.checkWinner();
  };
  P.checkDefeat = function (dt) {
    // gebouwen van verslagen spelers vervallen langzaam (geen spookdorpen)
    for (const b of this.buildings) {
      const p = this.players[b.owner];
      if (!b.alive || !p || !p.defeated) continue;
      b.hp = this.hpOf(b) - dt * 6;
      if (b.hp <= 0) this.as(b.owner, () => this.destroyBuilding(b));
    }
  };
  P.checkWinner = function () {
    if (this.winner !== undefined && this.winner !== null) return;
    const live = this.players.filter(p => p.kind !== 'open' && !p.defeated);
    const teams = new Set(live.map(p => p.team));
    if (this.players.filter(p => p.kind !== 'open').length < 2) return;      // vreedzaam spel: niemand wint
    if (teams.size <= 1) {
      this.winner = live.length ? live[0].team : -1;
      emit('gameOver', { winnerTeam: this.winner, victory: live.some(p => p.id === this.me), game: this });
    }
  };
})(window.VE);
