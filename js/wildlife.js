/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Wilde dieren: konijnen, reeën, herten, wilde zwijnen, vossen, eekhoorns en grondvogels.

   Simulatie (VE.Wildlife, onderdeel van het spel en de save):
   - elk dier heeft een leefgebied (wei, bosrand, bos, bij bomen, open veld) en een thuisplek;
   - toestanden: rondkijken, eten, rusten, wandelen, vluchten (+ eekhoorn klimt in een boom, vogels vliegen op,
     vos besluipt en springt, konijn gaat rechtop zitten of springt opeens weg);
   - herten en zwijnen leven in groepjes: volgers blijven bij de leider en vluchten samen;
   - dieren mijden de drukke dorpskern (busy-kaart uit gebouwen en bewoners) en lopen nooit door water,
     bergen, gebouwen of rotsblokken (controle langs het hele stuk dat ze afleggen);
   - voortplanting: langzaam en begrensd per soort (jongen groeien op); is een soort (bijna) weg, dan komt
     er af en toe een nieuw dier uit de wildernis aanlopen. Jagers laten altijd een minimum staan (minKeep).
   - dieren buiten beeld krijgen minder vaak een update (elke 0,5 s, met de opgetelde tijd).

   Weergave (VE.WildlifeRender): Blender-modellen uit public/models/animals.glb (gedeeld rig per soort,
   losse delen, animatieclips idle/walk/run/eat/alert/rest + extra's). Elk deel is één InstancedMesh voor
   alle dieren van die soort; alleen dieren in beeld worden getekend. Laadt de GLB niet, dan tekent een
   eenvoudige procedurele reserve de dieren (zelfde gedrag). */
'use strict';
(function (VE) {
  const N = VE.N, TAU = Math.PI * 2;
  const MOB = VE.isMobile ? 0.65 : 1;

  /* ---------------- soorten ---------------- */
  // walk/run: tegels per seconde. alert: vluchtafstand voor bewoners; alertHunter: voor een sluipende jager.
  // target: gewenste populatie; minKeep: daaronder jaagt niemand op deze soort. effort: duur van de jacht (×).
  const SPECIES = {
    rabbit: { name: 'Rabbit', hunt: true, meat: 1, catch: 0.85, effort: 0.8, minKeep: 4, habitat: 'meadow', group: [1, 2], target: 14,
      walk: 0.55, run: 2.7, alert: 2.0, alertHunter: 0.8, home: 5, size: 1.15 },
    roe: { name: 'Roe deer', hunt: true, meat: 2, catch: 0.62, effort: 1.1, minKeep: 3, habitat: 'edge', group: [1, 2], target: 8,
      walk: 0.45, run: 2.6, alert: 3.2, alertHunter: 1.35, home: 6, size: 1 },
    deer: { name: 'Deer', hunt: true, meat: 3, catch: 0.55, effort: 1.25, minKeep: 4, habitat: 'forest', group: [3, 5], target: 11,
      walk: 0.45, run: 2.4, alert: 2.8, alertHunter: 1.25, home: 7, size: 1 },
    boar: { name: 'Wild boar', hunt: true, meat: 3, catch: 0.5, effort: 1.45, minKeep: 3, habitat: 'forest', group: [2, 4], target: 8,
      walk: 0.4, run: 2.1, alert: 1.9, alertHunter: 1.05, home: 6, size: 1 },
    fox: { name: 'Fox', habitat: 'edge', group: [1, 1], target: 4, walk: 0.42, run: 2.7, alert: 2.6, alertHunter: 2.6, home: 8, size: 1.15 },
    squirrel: { name: 'Squirrel', habitat: 'trees', group: [1, 1], target: 10, walk: 0.7, run: 2.2, alert: 1.7, alertHunter: 1.7, home: 4, size: 1.35 },
    bird: { name: 'Robin', habitat: 'open', group: [2, 3], target: 7, walk: 0.35, run: 0.9, alert: 1.7, alertHunter: 1.7, home: 9, size: 1.5, fly: 2.3 },
    tit: { name: 'Blue tit', habitat: 'trees', group: [2, 4], target: 7, walk: 0.35, run: 0.9, alert: 1.5, alertHunter: 1.5, home: 7, size: 1.5, fly: 2.4, perch: 0.6 },
    blackbird: { name: 'Blackbird', habitat: 'edge', group: [1, 2], target: 5, walk: 0.4, run: 1.0, alert: 1.9, alertHunter: 1.9, home: 9, size: 1.4, fly: 2.2, perch: 0.3 }
  };
  for (const k in SPECIES) { SPECIES[k].key = k; SPECIES[k].target = Math.max(2, Math.round(SPECIES[k].target * MOB)); }
  VE.SPECIES = SPECIES;
  const ORDER = Object.keys(SPECIES);

  /* ---------------- simulatie ---------------- */
  class Wildlife {
    constructor(game, saved) {
      this.g = game; this.w = game.world;
      this.list = []; this.id = 0; this.herd = 0;
      this.rnd = VE.rng((game.seed ^ 0x77a11fe5) >>> 0);
      this.busy = new Float32Array(N * N);
      this.hab = {};
      this.busyT = 0; this.habT = 0; this.breedT = 8; this.time = 0;
      this.updateBusy(); this.updateHabitat();
      if (Array.isArray(saved) && saved.length) this.load(saved);
      else this.populate();
    }
    /* tegels waar een dier kan staan: land (geen berg/water), geen gebouw, rotsblok of ingang */
    passable(k) { const w = this.w, t = w.type[k]; return (t === 0 || t === 3) && !w.bld[k] && !w.rock[k] && !w.door[k]; }
    passXZ(x, z) { if (x < 0.3 || z < 0.3 || x > N - 0.3 || z > N - 0.3) return false; return this.passable((Math.floor(z)) * N + Math.floor(x)); }
    /* vrij pad in een rechte lijn (stappen van een derde tegel) */
    clear(x0, z0, x1, z1) {
      const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d * 3));
      for (let i = 1; i <= n; i++) { const t = i / n; if (!this.passXZ(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false; }
      return true;
    }
    treesNear(i, j, r) {
      const w = this.w; let n = 0;
      for (let b = j - r; b <= j + r; b++) for (let a = i - r; a <= i + r; a++) if (w.inb(a, b) && w.tree[b * N + a] && !w.tree[b * N + a].dead) n++;
      return n;
    }
    /* drukte: gebouwen (straal ~3,5) en bewoners (straal ~1,5); elke 2 s opnieuw */
    updateBusy() {
      const B = this.busy, g = this.g; B.fill(0);
      const stamp = (x, z, r, v) => {
        for (let j = Math.max(0, Math.floor(z - r)); j <= Math.min(N - 1, Math.floor(z + r)); j++)
          for (let i = Math.max(0, Math.floor(x - r)); i <= Math.min(N - 1, Math.floor(x + r)); i++) {
            const d = Math.hypot(i + 0.5 - x, j + 0.5 - z); if (d <= r) B[j * N + i] += v * (1 - d / (r + 0.5));
          }
      };
      for (const b of g.buildings) if (b.alive) stamp(b.cx, b.cz, b.def.size > 1 || b.def.storage ? 4.5 : 3.2, 1.2);
      for (const s of g.settlers) if (!s.hidden) stamp(s.x, s.z, 1.6, 0.35);
    }
    /* leefgebieden per tegel (lijst met tegelnummers), elke 30 s opnieuw (bomen groeien en verdwijnen) */
    updateHabitat() {
      const w = this.w, H = { meadow: [], edge: [], forest: [], trees: [], open: [] };
      for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
        const k = j * N + i;
        if (!this.passable(k) || w.field[k] || w.road[k] === 2) continue;
        const t2 = this.treesNear(i, j, 2), tree = !!w.tree[k];
        if (tree) { H.trees.push(k); continue; }
        if (t2 >= 7) H.forest.push(k);
        else if (t2 >= 3) { H.edge.push(k); if (t2 >= 5) H.forest.push(k); }
        if (t2 >= 1 && t2 <= 5) H.meadow.push(k);
        if (t2 <= 3) H.open.push(k);
      }
      this.hab = H;
    }
    habOK(sp, k) {
      const w = this.w, i = k % N, j = (k / N) | 0;
      if (!this.passable(k)) return false;
      const t2 = this.treesNear(i, j, 2);
      switch (sp.habitat) {
        case 'meadow': return !w.tree[k] && t2 <= 6;
        case 'edge': return t2 >= 1;
        case 'forest': return t2 >= 3;
        case 'trees': return t2 >= 1;
        default: return t2 <= 4;
      }
    }
    /* willekeurige geschikte tegel voor een soort: rustig, niet te dicht bij het dorp */
    spawnTile(sp, rnd, nearX, nearZ, r) {
      const L = this.hab[sp.habitat] || [];
      const hq = this.g.hq;
      for (let tries = 0; tries < 60 && L.length; tries++) {
        const k = L[Math.floor(rnd() * L.length)], i = k % N, j = (k / N) | 0;
        if (nearX !== undefined && Math.hypot(i + 0.5 - nearX, j + 0.5 - nearZ) > r) continue;
        if (this.busy[k] > 0.25) continue;
        if (hq && Math.hypot(i + 0.5 - hq.cx, j + 0.5 - hq.cz) < 6.5) continue;
        if (sp.habitat === 'trees' && !this.w.tree[k]) continue;
        return k;
      }
      return -1;
    }
    add(sp, x, z, herd, baby) {
      const a = { id: ++this.id, sp: sp, key: sp.key, x: x, z: z, hx: x, hz: z, rot: this.rnd() * TAU, state: 'idle', t: 0.5 + this.rnd() * 3,
        tx: x, tz: z, sp0: 0, herd: herd || 0, y: 0, pitch: 0, age: baby ? 0 : 1, sc: 0.9 + this.rnd() * 0.2, dead: false, reserved: false,
        acc: 0, chk: this.rnd() * 0.3, vis: false, clip: 'idle', ct: this.rnd() * 3, var: Math.floor(this.rnd() * 4), stag: sp.key === 'deer' && this.rnd() < 0.45 };
      a.onRelease = () => { if (a.state === 'held') { a.state = 'alert'; a.t = 0.6; } };
      this.list.push(a);
      return a;
    }
    populate() {
      const rnd = this.rnd;
      for (const key of ORDER) {
        const sp = SPECIES[key];
        let n = 0, guard = 0;
        while (n < sp.target && guard++ < 40) {
          const k = this.spawnTile(sp, rnd);
          if (k < 0) break;
          const size = Math.min(sp.target - n, sp.group[0] + Math.floor(rnd() * (sp.group[1] - sp.group[0] + 1)));
          const herd = sp.group[1] > 1 ? ++this.herd : 0;
          const cx = k % N + 0.5, cz = ((k / N) | 0) + 0.5;
          for (let m = 0; m < size; m++) {
            let x = cx, z = cz;
            for (let t = 0; t < 8 && m; t++) { const a = rnd() * TAU, r = 0.4 + rnd() * 1.1; if (this.passXZ(cx + Math.cos(a) * r, cz + Math.sin(a) * r)) { x = cx + Math.cos(a) * r; z = cz + Math.sin(a) * r; break; } }
            const an = this.add(sp, x, z, herd);
            if (key === 'squirrel') this.toTree(an, 'spawn');
            n++;
          }
        }
      }
    }
    serialize() {
      return this.list.filter(a => !a.dead).map(a => [a.key, Math.round(a.hx * 10) / 10, Math.round(a.hz * 10) / 10, a.herd, Math.round(a.age * 100) / 100, a.stag ? 1 : 0]);
    }
    load(saved) {
      for (const e of saved) {
        const sp = SPECIES[e[0]]; if (!sp) continue;
        let x = e[1], z = e[2];
        if (!this.passXZ(x, z)) { const k = this.spawnTile(sp, this.rnd); if (k < 0) continue; x = k % N + 0.5; z = ((k / N) | 0) + 0.5; }
        const a = this.add(sp, x, z, e[3] || 0, false);
        a.age = e[4] === undefined ? 1 : e[4]; a.stag = !!e[5];
        if (a.herd > this.herd) this.herd = a.herd;
      }
    }
    count(key) { let n = 0; for (const a of this.list) if (!a.dead && a.key === key) n++; return n; }

    /* ---------------- jacht ---------------- */
    findPrey(x, z, r) {
      let best = null, bd = 1e9;
      const cnt = {};
      for (const a of this.list) if (!a.dead) cnt[a.key] = (cnt[a.key] || 0) + 1;
      for (const a of this.list) {
        const sp = a.sp;
        if (!sp.hunt || a.dead || a.reserved || a.age < 0.85 || a.state === 'flee' || a.state === 'held') continue;
        if (cnt[a.key] <= sp.minKeep) continue;                      // nooit uitroeien
        const d = (a.x - x) ** 2 + (a.z - z) ** 2;
        if (d > r * r) continue;
        const score = d * (a.state === 'eat' || a.state === 'rest' ? 0.7 : 1);   // grazende dieren zijn makkelijker
        if (score < bd) { bd = score; best = a; }
      }
      return best;
    }
    anyGameNear(x, z, r) { for (const a of this.list) if (!a.dead && a.sp.hunt && (a.x - x) ** 2 + (a.z - z) ** 2 <= r * r) return true; return false; }
    /* plek waar de jager gaat staan: ~1,1 tegel van het dier, aan de kant van de hut */
    stalkPoint(a, b) {
      const w = this.w, base = Math.atan2(b.dx - a.x, b.dz - a.z);
      for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, Math.PI]) {
        const ang = base + off, x = a.x + Math.sin(ang) * 1.1, z = a.z + Math.cos(ang) * 1.1;
        if (!w.inb(Math.floor(x), Math.floor(z))) continue;
        const k = Math.floor(z) * N + Math.floor(x);
        if (w.walkable(k) && !w.door[k]) return { k: k, x: x, z: z };
      }
      return null;
    }
    hold(a, s) { a.state = 'held'; a.t = 60; a.clip = 'alert'; a.rot = Math.atan2(s.x - a.x, s.z - a.z) + Math.PI * 0.85; }
    caught(a) {
      a.dead = true; a.reserved = false;
      const y = this.w.heightAt(a.x, a.z);
      VE.bus.emit('dust', { x: a.x, y: y, z: a.z, n: 12 });
      VE.bus.emit('poof', { x: a.x, y: y + 0.15, z: a.z });
    }
    scare(a, fx, fz) {
      this.flee(a, fx, fz);
      if (a.herd) for (const o of this.list) if (o !== a && !o.dead && o.herd === a.herd && (o.x - a.x) ** 2 + (o.z - a.z) ** 2 < 25) this.flee(o, fx, fz);
    }

    /* ---------------- gedrag ---------------- */
    setTarget(a, x, z, state, speed) { a.tx = x; a.tz = z; a.state = state; a.spd = speed; a.t = 25; }
    wander(a) {
      const sp = a.sp, rnd = this.rnd;
      // volger: dicht bij de leider van de groep blijven
      let cx = a.hx, cz = a.hz, r = sp.home;
      const lead = a.herd ? this.leader(a) : null;
      if (lead && lead !== a) { cx = lead.tx; cz = lead.tz; r = 1.3; }
      for (let tries = 0; tries < 8; tries++) {
        const ang = rnd() * TAU, d = (lead && lead !== a ? 0.4 : 1.2) + rnd() * r;
        const x = cx + Math.cos(ang) * d, z = cz + Math.sin(ang) * d;
        const k = Math.floor(z) * N + Math.floor(x);
        if (!this.passXZ(x, z) || this.busy[k] > 0.45) continue;
        if (!(lead && lead !== a) && !this.habOK(sp, k) && tries < 6) continue;
        if (!this.clear(a.x, a.z, x, z)) continue;
        this.setTarget(a, x, z, 'walk', sp.walk * (0.85 + rnd() * 0.3));
        return true;
      }
      return false;
    }
    leader(a) {
      let best = null;
      for (const o of this.list) if (!o.dead && o.herd === a.herd && (!best || o.id < best.id)) best = o;
      return best;
    }
    flee(a, fx, fz) {
      if (a.dead) return;
      if (a.state === 'held') { a.state = 'alert'; a.t = 0.3; }        // net gemist: los, en weg!
      const sp = a.sp, rnd = this.rnd;
      if (sp.fly) { this.takeOff(a, fx, fz); return; }
      if (sp.key === 'squirrel' && this.toTree(a, 'flee')) return;
      const away = Math.atan2(a.x - fx, a.z - fz);
      for (let tries = 0; tries < 10; tries++) {
        const ang = away + (rnd() - 0.5) * (tries < 5 ? 1.1 : 2.6), d = 3 + rnd() * 3.5;
        const x = a.x + Math.sin(ang) * d, z = a.z + Math.cos(ang) * d;
        if (!this.passXZ(x, z) || !this.clear(a.x, a.z, x, z)) continue;
        this.setTarget(a, x, z, 'flee', sp.run * (0.9 + rnd() * 0.2));
        a.reserved = false;
        // nieuwe thuisplek wat verder van de onrust
        a.hx = VE.lerp(a.hx, x, 0.5); a.hz = VE.lerp(a.hz, z, 0.5);
        return;
      }
    }
    /* eekhoorn: naar de dichtstbijzijnde boom en erin klimmen. mode: 'flee' (rennen), 'walk', of 'spawn' (meteen in de boom) */
    toTree(a, mode) {
      const w = this.w, i0 = Math.floor(a.x), j0 = Math.floor(a.z);
      let best = null, bd = 1e9;
      for (let j = j0 - 3; j <= j0 + 3; j++) for (let i = i0 - 3; i <= i0 + 3; i++) {
        if (!w.inb(i, j)) continue;
        const t = w.tree[j * N + i];
        if (!t || t.dead || t.falling || t.growth < 0.7) continue;
        const d = (t.x - a.x) ** 2 + (t.z - a.z) ** 2;
        if (d < bd) { bd = d; best = t; }
      }
      if (!best) return false;
      a.tree = best;
      const ang = this.rnd() * TAU;
      const x = best.x + Math.cos(ang) * 0.09, z = best.z + Math.sin(ang) * 0.09;
      if (mode === 'flee') this.setTarget(a, x, z, 'toTree', a.sp.run);
      else if (mode === 'walk') this.setTarget(a, x, z, 'toTree', a.sp.walk * 1.4);
      else { a.x = x; a.z = z; a.state = 'up'; a.y = 0.45; a.t = 2 + this.rnd() * 8; }
      return true;
    }
    /* vogels: opvliegen naar een rustige landingsplek (grond of boomkruin), weg van (fx, fz).
       Een groepje vliegt samen: wie als eerste opvliegt kiest de plek, de rest landt er vlakbij. */
    takeOff(a, fx, fz, far) {
      const rnd = this.rnd, sp = a.sp, w = this.w;
      const flock = a.herd ? (this.flocks || (this.flocks = {}))[a.herd] : null;
      let land = flock && this.time - flock.t < 3 ? flock : null;
      if (!land) {
        const away = fx === undefined ? rnd() * TAU : Math.atan2(a.x - fx, a.z - fz);
        for (let tries = 0; tries < 16 && !land; tries++) {
          const ang = away + (rnd() - 0.5) * (fx === undefined ? TAU : 2.2), d = (far ? 7 : 4) + rnd() * (far ? 9 : 6);
          const x = a.x + Math.sin(ang) * d, z = a.z + Math.cos(ang) * d;
          if (x < 1 || z < 1 || x > N - 1 || z > N - 1) continue;
          const k = Math.floor(z) * N + Math.floor(x);
          if (this.busy[k] > 0.4) continue;
          // sommige soorten landen liever in een boom
          const t = w.tree[k];
          if (t && !t.dead && !t.falling && t.growth >= 0.8 && rnd() < (sp.perch || 0.15)) { land = { x: t.x, z: t.z, tree: t }; break; }
          if (!this.passXZ(x, z) || t) continue;
          land = { x: x, z: z, tree: null };
        }
        if (!land) return;
        if (a.herd) this.flocks[a.herd] = { x: land.x, z: land.z, tree: land.tree, t: this.time };
      }
      const off = land === flock ? 0.35 + rnd() * 0.45 : 0, oa = rnd() * TAU;
      a.perchT = land.tree && off < 0.6 ? land.tree : null;
      this.setTarget(a, land.x + (a.perchT ? Math.cos(oa) * 0.12 : Math.cos(oa) * off), land.z + (a.perchT ? Math.sin(oa) * 0.12 : Math.sin(oa) * off), 'fly', sp.fly * (0.9 + rnd() * 0.2));
      a.hx = a.tx; a.hz = a.tz;
      a.fh = a.rot; a.bank = 0; a.glideT = 0.6 + rnd(); a.glide = false; a.t = 30;
      a.alt = this.w.heightAt(a.x, a.z) + (a.y || 0);
      a.acc = 1;                                                     // meteen de eerste vliegstap, ook buiten beeld
      a.ox = a.x; a.oz = a.z;
      a.perch = null;
    }
    /* veilige vlieghoogte boven (x, z): grond, boomkruinen en daken met wat ruimte */
    clearance(x, z, r) {
      r = r === undefined ? 1 : r;                                   // 1: buurtegels erbij (marge), 0: alleen deze tegel
      const w = this.w; let h = w.heightAt(x, z) + 0.75;
      const i0 = Math.floor(x), j0 = Math.floor(z);
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const i = i0 + di, j = j0 + dj; if (!w.inb(i, j)) continue;
        const k = j * N + i, t = w.tree[k];
        if (t && !t.dead) h = Math.max(h, w.heightAt(t.x, t.z) + this.treeTop(t) + 0.3);
        if (w.bld[k]) { const b = this.g.bmap[w.bld[k]]; if (b) h = Math.max(h, b.y + (b.size > 1 ? 2.9 : 1.6)); }
      }
      return h;
    }
    treeTop(t) { return (1.05 + 0.15 * (t.type === 1 ? 1 : 0)) * t.sc * (t.look ? t.look.vy : 1) * (0.18 + 0.82 * Math.min(1, t.growth)); }
    /* vliegen: geleidelijk bijsturen (helling in de bocht), afwisselend fladderen en zweven, boven alles langs, zacht landen */
    flyStep(a, dt) {
      const sp = a.sp, rnd = this.rnd;
      const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let dr = want - a.fh; while (dr > Math.PI) dr -= TAU; while (dr < -Math.PI) dr += TAU;
      const turn = Math.max(-2.2 * dt, Math.min(2.2 * dt, dr * Math.min(1, dt * 3)));
      a.fh += turn; a.rot = a.fh;
      a.bank += ((-turn / Math.max(dt, 1e-3)) * 0.35 - a.bank) * Math.min(1, dt * 4);
      a.bank = Math.max(-0.6, Math.min(0.6, a.bank));
      const gy = this.w.heightAt(a.x, a.z);
      const landY = (a.perchT && !a.perchT.dead ? this.w.heightAt(a.perchT.x, a.perchT.z) + this.treeTop(a.perchT) * 0.92 : this.w.heightAt(a.tx, a.tz));
      // gewenste hoogte: veilig boven grond/bomen/daken (ook iets vooruit), bij het naderen omlaag naar de landingsplek
      const ax = a.x + Math.sin(a.fh) * 0.8, az = a.z + Math.cos(a.fh) * 0.8;
      let safe = Math.max(this.clearance(a.x, a.z), this.clearance(ax, az));
      const cruise = safe + 0.25 + 0.15 * Math.sin(this.time * 0.7 + a.id);
      const near = Math.min(1, d / 1.8);
      const target = d < 1.8 ? landY + (cruise - landY) * near * near : cruise;
      const climbing = target > a.alt + 0.05;
      // onder de veilige hoogte: snel en vooral steil omhoog, pas daarna vol vooruit (nooit door een kruin of dak)
      const below = d > 1.2 ? Math.max(0, safe - 0.1 - a.alt) : 0;
      a.alt += (target - a.alt) * Math.min(1, dt * (below > 0 ? 4 : climbing ? 2.5 : 1.6));
      a.y = a.alt - gy;
      // fladderen ↔ zweven (niet zweven tijdens het klimmen)
      a.glideT -= dt;
      if (a.glideT <= 0) { a.glide = !a.glide && !climbing && d > 2; a.glideT = a.glide ? 0.6 + rnd() * 1.1 : 0.8 + rnd() * 1.4; }
      if (climbing) a.glide = false;
      const v = a.spd * (a.glide ? 0.85 : 1) * Math.min(1, 0.35 + d * 0.6) * Math.max(0.12, 1 - below / 0.5);
      a.x += Math.sin(a.fh) * v * dt; a.z += Math.cos(a.fh) * v * dt;
      a.t -= dt;
      if ((d < 0.14 && Math.abs(a.alt - landY) < 0.08) || a.t <= 0) {
        // geland: op de grond of in de kruin
        a.x = a.tx; a.z = a.tz; a.alt = landY; a.y = landY - this.w.heightAt(a.x, a.z); a.bank = 0;
        a.perch = a.perchT && !a.perchT.dead ? a.perchT : null; a.perchT = null;
        if (!a.perch) a.y = 0;
        a.state = 'idle'; a.t = 1.5 + rnd() * 4;
      }
    }
    /* drukte en bedreiging: dichtstbijzijnde zichtbare bewoner (jagers sluipen: kleinere straal) */
    threat(a) {
      const sp = a.sp, grid = this.sgrid;
      if (!grid) return null;
      const gi = Math.floor(a.x / 4), gj = Math.floor(a.z / 4);
      let best = null, bd = 1e9;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ci = gi + di, cj = gj + dj;
        if (ci < 0 || cj < 0 || ci > 15 || cj > 15) continue;
        const cell = grid[cj * 16 + ci]; if (!cell) continue;
        for (const s of cell) {
          const stalking = s.role === 'hunter' && s.mode === 'work';
          const r = stalking ? sp.alertHunter : sp.alert;
          const d = (s.x - a.x) ** 2 + (s.z - a.z) ** 2;
          if (d > r * r || d >= bd) continue;
          if (stalking && s.act === 'hunt') continue;                // tijdens het netgooien al te laat
          if (stalking && this.rnd() > 0.45) continue;               // de jager sluipt: niet altijd opgemerkt
          bd = d; best = s;
        }
      }
      return best;
    }
    think(a, dt) {
      const sp = a.sp, rnd = this.rnd;
      if (a.state === 'held') return;
      // er is net iets gebouwd waar het dier stond: naar de dichtste vrije plek, en dan weg
      if (a.state !== 'fly' && a.y < 0.05 && !this.passXZ(a.x, a.z)) {
        for (let r = 0.5; r <= 3; r += 0.5) {
          let done = false;
          for (let q = 0; q < 8 && !done; q++) {
            const x = a.x + Math.cos(q * 0.785) * r, z = a.z + Math.sin(q * 0.785) * r;
            if (this.passXZ(x, z)) { const ox = a.x, oz = a.z; a.x = x; a.z = z; this.flee(a, ox, oz); done = true; }
          }
          if (done) break;
        }
        return;
      }
      // vluchten?
      a.chk -= dt;
      if (a.chk <= 0) {
        a.chk = 0.25 + rnd() * 0.15;
        if (a.state !== 'flee' && a.state !== 'fly' && a.state !== 'toTree') {
          const s = this.threat(a);
          if (s) {
            if (a.state === 'up') { a.t = Math.max(a.t, 3); }      // eekhoorn in de boom: blijft lekker zitten
            else if (sp.key === 'rabbit' && a.state !== 'alert' && rnd() < 0.3) { a.state = 'alert'; a.t = 0.5; a.rot = Math.atan2(s.x - a.x, s.z - a.z); }
            else if (sp.key === 'deer' && a.state !== 'alert' && rnd() < 0.35 && (s.x - a.x) ** 2 + (s.z - a.z) ** 2 > 2.2) { a.state = 'alert'; a.t = 0.8; a.rot = Math.atan2(s.x - a.x, s.z - a.z); }   // nieuwsgierig kijken…
            else this.scare(a, s.x, s.z);
            return;
          }
        }
      }
      a.t -= dt;
      if (a.state === 'walk' || a.state === 'flee' || a.state === 'fly' || a.state === 'toTree') return this.move(a, dt);
      if (a.state === 'up') {
        if (a.t <= 0 || (a.tree && (a.tree.dead || a.tree.falling))) { a.state = 'down'; a.t = 0.8; }
        return;
      }
      if (a.state === 'down') { a.y = Math.max(0, a.y - dt * 0.6); if (a.y <= 0) { a.state = 'idle'; a.t = 1 + rnd() * 2; a.tree = null; } return; }
      if (a.state === 'pounce') { if (a.t <= 0) { a.state = 'idle'; a.t = 1.5; } return; }
      if (sp.fly && a.perch && (a.perch.dead || a.perch.falling)) { this.takeOff(a, a.x, a.z + 0.1); return; }
      if (a.t > 0) return;
      if (sp.fly) {
        const r0 = rnd();
        if (r0 < 0.22) { this.takeOff(a, undefined, undefined, r0 < 0.07); return; }    // rustmoment voorbij: een stukje (of ver) vliegen
        if (a.perch) { a.state = r0 < 0.6 ? 'idle' : 'alert'; a.t = 2 + rnd() * 4; return; }
      }
      // volgende bezigheid
      const reserved = a.reserved;                                   // besprongen door een jager: niet weglopen
      const r = rnd();
      if (sp.key === 'squirrel' && r < 0.25 && this.toTree(a, 'walk')) return;
      if (sp.key === 'fox' && r < 0.12) { a.state = 'pounce'; a.t = 1.2; return; }
      if (sp.key === 'rabbit' && r < 0.06 && !reserved) {           // opeens wegspringen, zomaar
        const ang = rnd() * TAU; this.flee(a, a.x + Math.sin(ang), a.z + Math.cos(ang)); if (a.state === 'flee') { a.tx = VE.lerp(a.x, a.tx, 0.5); a.tz = VE.lerp(a.z, a.tz, 0.5); } return;
      }
      if (r < 0.38 && !reserved) { if (this.wander(a)) return; }
      if (r < 0.7) { a.state = 'eat'; a.t = 2.5 + rnd() * 5; return; }
      if (r < 0.82 && (sp.key === 'deer' || sp.key === 'boar' || sp.key === 'roe' || sp.key === 'fox')) { a.state = 'rest'; a.t = 6 + rnd() * 9; return; }
      a.state = (sp.key === 'rabbit' || sp.key === 'deer' || sp.key === 'roe') && r < 0.92 ? 'alert' : 'idle';
      a.t = 1.5 + rnd() * 2.5;
    }
    move(a, dt) {
      if (a.state === 'fly') {                                       // kleine stapjes, ook buiten beeld: nooit door een kruin heen
        for (let r = dt; r > 1e-4 && a.state === 'fly'; r -= 0.08) this.flyStep(a, Math.min(0.08, r));
        return;
      }
      const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
      const fly = false;
      const step = a.spd * dt * (a.age < 1 ? 0.85 : 1);
      if (d <= step || a.t <= 0) {
        if (d <= step) { a.x = a.tx; a.z = a.tz; }
        if (fly) { a.y = 0; a.flyD = 0; }
        if (a.state === 'toTree') { a.state = 'up'; a.y = 0; a.climb = true; a.t = 4 + this.rnd() * 8; return; }
        a.state = a.state === 'flee' ? 'alert' : 'idle'; a.t = 0.8 + this.rnd() * 2;
        return;
      }
      const nx = a.x + dx / d * step, nz = a.z + dz / d * step;
      if (!fly && !this.passXZ(nx, nz)) { a.state = 'idle'; a.t = 0.4; return; }
      a.x = nx; a.z = nz;
      let tr = Math.atan2(dx, dz), dr = tr - a.rot;
      while (dr > Math.PI) dr -= TAU; while (dr < -Math.PI) dr += TAU;
      a.rot += dr * Math.min(1, dt * (a.state === 'flee' ? 14 : 7));
    }
    breed() {
      const rnd = this.rnd;
      for (const key of ORDER) {
        const sp = SPECIES[key], n = this.count(key);
        if (n >= sp.target) continue;
        const p = 0.5 * (1 - n / sp.target);
        if (rnd() > p) continue;
        const parents = this.list.filter(a => !a.dead && a.key === key && a.age >= 1 && a.state !== 'flee');
        let x, z, herd = 0, baby = false;
        if (parents.length >= 2 || (parents.length === 1 && key !== 'deer' && key !== 'boar')) {
          const par = parents[Math.floor(rnd() * parents.length)];
          const ang = rnd() * TAU; x = par.x + Math.cos(ang) * 0.35; z = par.z + Math.sin(ang) * 0.35;
          if (!this.passXZ(x, z)) { x = par.x; z = par.z; }
          herd = par.herd; baby = true;
        } else {
          // (bijna) weg: af en toe trekt er een dier uit de wildernis het dal in
          if (rnd() > 0.35) continue;
          const k = this.spawnTile(sp, rnd); if (k < 0) continue;
          x = k % N + 0.5; z = ((k / N) | 0) + 0.5; herd = sp.group[1] > 1 ? ++this.herd : 0;
        }
        const a = this.add(sp, x, z, herd, baby);
        if (key === 'squirrel' && !baby) this.toTree(a, 'spawn');
      }
    }
    update(dt) {
      this.time += dt;
      this.busyT -= dt; if (this.busyT <= 0) { this.busyT = 2; this.updateBusy(); }
      this.habT -= dt; if (this.habT <= 0) { this.habT = 30; this.updateHabitat(); }
      this.breedT -= dt; if (this.breedT <= 0) { this.breedT = 14; this.breed(); }
      // bewoners in een rooster van 4×4 tegels (snel zoeken)
      const grid = this.sgrid = new Array(256);
      for (const s of this.g.settlers) {
        if (s.hidden) continue;
        const c = Math.floor(s.z / 4) * 16 + Math.floor(s.x / 4);
        (grid[c] || (grid[c] = [])).push(s);
      }
      let dead = false;
      for (const a of this.list) {
        if (a.dead) { dead = true; continue; }
        if (a.age < 1) a.age = Math.min(1, a.age + dt / 90);
        // buiten beeld: twee keer per seconde, met de opgetelde tijd
        a.acc += dt;
        // staat het dier ineens in een gebouw (net neergezet)? dan meteen verplaatsen, ook buiten beeld
        const blocked = a.state !== 'fly' && a.y < 0.05 && a.state !== 'held' && !this.passXZ(a.x, a.z);
        if (!a.vis && a.acc < 0.5 && !blocked) continue;
        const st = Math.min(a.acc, 0.6); a.acc = 0;
        this.think(a, st);
      }
      if (dead && this.list.length > 40) this.list = this.list.filter(a => !a.dead);
    }
  }
  VE.Wildlife = Wildlife;

  /* ================= weergave ================= */
  const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(),
    _s = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _c = new THREE.Color(), _sph = new THREE.Sphere(), _fr = new THREE.Frustum(), _pv = new THREE.Matrix4(),
    _x = new THREE.Vector3(1, 0, 0), _zf = new THREE.Vector3(0, 0, 1);
  const UP = new THREE.Vector3(0, 1, 0);
  const WHITE = new THREE.Color(1, 1, 1);
  const BLEND = 0.22;

  /* GLB (animals.glb) → per soort: rig-nodes, delen en clips */
  function prepare(gltf) {
    const scene = gltf.scene; scene.updateMatrixWorld(true);
    const out = {};
    for (const key of ORDER) {
      const pre = 'rig_' + key + '_';
      const nodes = [], idx = {};
      const walk = o => {
        if (o.name && o.name.indexOf(pre) === 0) {
          const name = o.name.slice(pre.length);
          idx[name] = nodes.length;
          let p = o.parent; while (p && !(p.name && p.name.indexOf(pre) === 0)) p = p.parent;
          nodes.push({ name: name, parent: p ? idx[p.name.slice(pre.length)] : -1, pos: o.position.clone(), quat: new THREE.Quaternion() });
        }
        for (const c of o.children) walk(c);
      };
      walk(scene);
      if (!nodes.length) continue;
      const idle = gltf.animations.find(a => a.name === key + '_idle');
      for (const n of nodes) {
        const tr = idle && idle.tracks.find(t => t.name === pre + n.name + '.position');
        if (tr) n.pos.set(tr.values[0], tr.values[1], tr.values[2]);
      }
      for (const n of nodes) {
        const local = new THREE.Matrix4().compose(n.pos, n.quat, _one);
        n.restWorld = n.parent < 0 ? local : new THREE.Matrix4().multiplyMatrices(nodes[n.parent].restWorld, local);
      }
      const parts = [];
      const inv = new THREE.Matrix4();
      scene.traverse(o => {
        if (o.parent !== scene || !o.name || o.name.indexOf(key + '__') !== 0) return;
        const bits = o.name.split('__'), node = bits[1], name = bits[2] || 'part';
        // 'legF' / 'legB': hetzelfde deel aan beide kanten (legFL + legFR)
        const at = idx[node] !== undefined ? [idx[node]] : [idx[node + 'L'], idx[node + 'R']].filter(v => v !== undefined);
        if (!at.length) return;
        const geo = VE.bakeGlbNode(o, 300 + parts.length);
        if (!geo) return;
        inv.copy(nodes[at[0]].restWorld).invert();
        geo.applyMatrix4(inv);
        const rests = at.map(id => nodes[id].restWorld);
        // het tweede exemplaar (andere kant): verschuiving tussen de rustposities van de twee nodes
        parts.push({ name: name, nodes: at, geo: geo, stag: name.indexOf('antler') >= 0, rest: rests });
      });
      const clips = {};
      for (const clip of gltf.animations) {
        if (clip.name.indexOf(key + '_') !== 0) continue;
        const per = nodes.map(() => ({ p: null, q: null }));
        for (const tr of clip.tracks) {
          const dot = tr.name.lastIndexOf('.'), nn = tr.name.slice(0, dot), prop = tr.name.slice(dot + 1);
          const id = idx[nn.slice(pre.length)];
          if (id === undefined) continue;
          if (prop === 'quaternion') per[id].q = tr.createInterpolant();
          else if (prop === 'position') per[id].p = tr.createInterpolant();
        }
        clips[clip.name.slice(key.length + 1)] = { dur: clip.duration, per: per };
      }
      out[key] = { nodes: nodes, idx: idx, parts: parts, clips: clips };
    }
    // vlinder (geen rig): lijfje en twee vleugels, gebruikt door de vlinders in js/fx.js
    const bf = {};
    for (const n of ['body', 'wingL', 'wingR']) { const o = scene.getObjectByName('butterfly__' + n); if (o) bf[n] = VE.bakeGlbNode(o, 400 + n.length); }
    if (bf.body && bf.wingL && bf.wingR) VE.butterflyGeo = bf;
    return out;
  }

  /* procedurele reserve (zelfde opbouw, eenvoudiger): lijf, kop, poten, staart */
  function procAssets() {
    const look = {
      rabbit: { body: [0.06, 0.05, 0.08], col: 0xa88a6a, h: 0.07, head: 0.04, leg: 0.03, ear: true },
      roe: { body: [0.07, 0.07, 0.16], col: 0xb0703a, h: 0.2, head: 0.045, leg: 0.17 },
      deer: { body: [0.09, 0.09, 0.2], col: 0x9a5f34, h: 0.26, head: 0.055, leg: 0.22 },
      boar: { body: [0.1, 0.09, 0.17], col: 0x4a3a30, h: 0.13, head: 0.06, leg: 0.1 },
      fox: { body: [0.05, 0.05, 0.13], col: 0xd8692a, h: 0.1, head: 0.04, leg: 0.08 },
      squirrel: { body: [0.03, 0.035, 0.05], col: 0xb4542a, h: 0.04, head: 0.025, leg: 0.03 },
      bird: { body: [0.025, 0.025, 0.04], col: 0x8a6a4a, h: 0.03, head: 0.018, leg: 0.02, bird: true },
      tit: { body: [0.023, 0.023, 0.036], col: 0x7fa0d0, h: 0.03, head: 0.016, leg: 0.02, bird: true },
      blackbird: { body: [0.027, 0.027, 0.045], col: 0x2a2826, h: 0.032, head: 0.019, leg: 0.02, bird: true }
    };
    const out = {};
    for (const key of ORDER) {
      const L = look[key], b = L.body;
      const nodes = [
        { name: 'root', parent: -1, pos: new THREE.Vector3(0, 0, 0) },
        { name: 'body', parent: 0, pos: new THREE.Vector3(0, L.h, 0) },
        { name: 'head', parent: 1, pos: new THREE.Vector3(0, b[1] * 0.6, b[2] * 0.95) },
        { name: 'legFL', parent: 1, pos: new THREE.Vector3(-b[0] * 0.6, -b[1] * 0.3, b[2] * 0.6) },
        { name: 'legFR', parent: 1, pos: new THREE.Vector3(b[0] * 0.6, -b[1] * 0.3, b[2] * 0.6) },
        { name: 'legBL', parent: 1, pos: new THREE.Vector3(-b[0] * 0.6, -b[1] * 0.3, -b[2] * 0.6) },
        { name: 'legBR', parent: 1, pos: new THREE.Vector3(b[0] * 0.6, -b[1] * 0.3, -b[2] * 0.6) }
      ];
      for (const n of nodes) { n.quat = new THREE.Quaternion(); const l = new THREE.Matrix4().compose(n.pos, n.quat, _one); n.restWorld = n.parent < 0 ? l : new THREE.Matrix4().multiplyMatrices(nodes[n.parent].restWorld, l); }
      const idx = {}; nodes.forEach((n, i) => { idx[n.name] = i; });
      const body = new VE.Model(70); body.ball(1, L.col, { sx: b[0], sy: b[1], sz: b[2] }, 1);
      const head = new VE.Model(71); head.ball(L.head, L.col, { z: L.head * 0.5 }, 1); head.ball(L.head * 0.25, 0x222222, { z: L.head * 1.4, y: -L.head * 0.1 });
      if (L.ear) { head.box(0.012, 0.07, 0.02, L.col, { x: -0.015, y: 0.02 }); head.box(0.012, 0.07, 0.02, L.col, { x: 0.015, y: 0.02 }); }
      if (L.bird) head.cone(0.008, 0.02, 4, 0xe8a33a, { z: 0.025, rx: Math.PI / 2 });
      const leg = new VE.Model(72); leg.box(L.leg * 0.18 + 0.008, L.leg, L.leg * 0.18 + 0.008, L.col, { y: -L.leg });
      out[key] = { nodes: nodes, idx: idx, clips: {}, proc: true,
        parts: [{ name: 'body', nodes: [1], geo: body.build() }, { name: 'head', nodes: [2], geo: head.build() },
          { name: 'leg', nodes: L.bird ? [] : [3, 4, 5, 6], geo: leg.build() }].filter(p => p.nodes.length) };
    }
    return out;
  }

  /* welke clip en tijd voor een dier */
  function choose(A, a, T) {
    const C = A.clips, st = a.state;
    // eekhoorn (js/squirrel.js): de besturing kiest zelf de clip; loopclips volgen de afgelegde weg (a.cyc)
    if (a.clipWant && C[a.clipWant]) {
      const c = C[a.clipWant], w = a.clipWant;
      if (w === 'jump') return [w, Math.min(0.999, a.clipP || 0) * c.dur];
      if (w === 'walk' || w === 'run' || w === 'climb' || w === 'descend') return [w, ((a.cyc % 1) + 1) % 1 * c.dur];
      return [w, (T + a.id * 1.7) % c.dur];
    }
    let want = st === 'walk' ? 'walk' : (st === 'flee' || st === 'toTree') ? 'run' : st === 'eat' ? 'eat' : st === 'rest' ? 'rest'
      : (st === 'alert' || st === 'held') ? 'alert' : st === 'fly' ? (a.glide && C.glide ? 'glide' : 'fly') : st === 'pounce' ? 'pounce' : (st === 'up' || st === 'down') ? 'climb' : 'idle';
    if (!C[want]) want = (want === 'run' || want === 'fly') && C.walk ? 'walk' : want === 'climb' && C.run ? 'run' : 'idle';
    if (!C[want]) return null;
    const c = C[want];
    let t;
    if (want === 'walk' || want === 'run' || want === 'fly') t = (a.ph % c.dur + c.dur) % c.dur;
    else if (want === 'pounce') t = Math.min(c.dur * 0.999, 1.2 - Math.max(0, a.t)) % c.dur;
    else t = (T + a.id * 1.7) % c.dur;
    return [want, t];
  }

  class WildlifeRender {
    constructor(root) {
      this.root = root;
      this.A = VE.animalAssets || procAssets();
      this.src = VE.animalAssets ? 'glb' : 'procedural';
      this.mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 6, specular: 0x141414 });
      this.meshes = []; this.sp = {};
      for (const key of ORDER) {
        const A = this.A[key]; if (!A) continue;
        const cap = Math.ceil(SPECIES[key].target * 1.6) + 4;
        const parts = A.parts.map(p => {
          const n = cap * p.nodes.length;
          const m = new THREE.InstancedMesh(p.geo, this.mat, n);
          m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);   // zie VE-001
          m.count = 0; m.castShadow = !VE.isMobile || key === 'deer' || key === 'boar'; m.receiveShadow = false; m.frustumCulled = false; m.visible = false;
          m.name = 'animal_' + key + '_' + p.name;
          root.add(m); this.meshes.push(m);
          return { mesh: m, nodes: p.nodes, stag: p.stag, n: 0 };
        });
        this.sp[key] = { A: A, parts: parts, world: A.nodes.map(() => new THREE.Matrix4()), cap: cap, pose: new Float32Array(A.nodes.length * 7) };
      }
      this.stats = { animals: 0, drawn: 0 };
    }
    dispose() { for (const m of this.meshes) this.root.remove(m); }
    sample(A, name, t, out) {
      const c = A.clips[name], nodes = A.nodes;
      for (let i = 0; i < nodes.length; i++) {
        const o = i * 7, pc = c ? c.per[i] : null;
        if (pc && pc.p) { const v = pc.p.evaluate(t); out[o] = v[0]; out[o + 1] = v[1]; out[o + 2] = v[2]; }
        else { out[o] = nodes[i].pos.x; out[o + 1] = nodes[i].pos.y; out[o + 2] = nodes[i].pos.z; }
        if (pc && pc.q) { const v = pc.q.evaluate(t); out[o + 3] = v[0]; out[o + 4] = v[1]; out[o + 5] = v[2]; out[o + 6] = v[3]; }
        else { out[o + 3] = 0; out[o + 4] = 0; out[o + 5] = 0; out[o + 6] = 1; }
      }
    }
    /* eenvoudige procedurele beweging voor de reserve-modellen */
    procPose(A, a, T, out) {
      this.sample(A, null, 0, out);
      const moving = a.state === 'walk' || a.state === 'flee' || a.state === 'toTree';
      const sw = moving ? Math.sin(a.ph * 1.0) * (a.state === 'walk' ? 0.5 : 0.9) : 0;
      const legs = [['legFL', 1], ['legFR', -1], ['legBL', -1], ['legBR', 1]];
      for (const [n, sgn] of legs) { const i = A.idx[n]; if (i === undefined) continue; _q.setFromAxisAngle(_x, sw * sgn); out[i * 7 + 3] = _q.x; out[i * 7 + 4] = _q.y; out[i * 7 + 5] = _q.z; out[i * 7 + 6] = _q.w; }
      const h = A.idx.head;
      if (h !== undefined) { _q.setFromAxisAngle(_x, a.state === 'eat' ? 0.9 : a.state === 'alert' ? -0.3 : Math.sin(T * 0.7 + a.id) * 0.1); out[h * 7 + 3] = _q.x; out[h * 7 + 4] = _q.y; out[h * 7 + 5] = _q.z; out[h * 7 + 6] = _q.w; }
      const b = A.idx.body;
      if (b !== undefined) out[b * 7 + 1] += moving ? Math.abs(Math.sin(a.ph)) * 0.02 : a.state === 'rest' ? -0.5 * out[b * 7 + 1] : 0;
    }
    render(wild, camera, dt) {
      if (!wild) return;
      const T = VE.uTime.value, w = wild.w;
      for (const key in this.sp) for (const p of this.sp[key].parts) p.n = 0;
      if (camera) { _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pv); }
      const cx = camera ? camera.position.x : 0, cz = camera ? camera.position.z : 0;
      let count = 0;
      for (const a of wild.list) {
        if (a.dead) continue;
        const S = this.sp[a.key]; if (!S) { a.vis = false; continue; }
        const gy = w.heightAt(a.x, a.z);
        _sph.center.set(a.x, gy + 0.2 + (a.y || 0), a.z); _sph.radius = 0.6;
        a.vis = camera ? _fr.intersectsSphere(_sph) : true;
        // onder de wolken (onontdekt land): niet tekenen
        const k = Math.floor(a.z) * N + Math.floor(a.x);
        if (!a.vis || (w.explored && w.explored[k] < 0.35)) continue;
        if (S.parts[0].n >= S.cap * S.parts[0].nodes.length) continue;
        count++;
        const A = S.A, nodes = A.nodes;
        // loopfase volgt de afgelegde weg (geen glijdende poten)
        const moving = a.state === 'walk' || a.state === 'flee' || a.state === 'toTree' || a.state === 'fly';
        const spd = a.state === 'walk' ? a.spd : a.state === 'fly' ? 1.4 : a.sp.run;
        if (!a.ownPh) a.ph = (a.ph || 0) + (moving ? dt * (a.state === 'fly' ? (a.glide ? 1 : 1.15) : spd * 1.1 + 0.5) : 0);
        if (!a._pose) { a._pose = new Float32Array(nodes.length * 7); a._from = new Float32Array(nodes.length * 7); a._blend = 0; a._clip = null; }
        const far = (a.x - cx) ** 2 + (a.z - cz) ** 2 > 900;
        if (A.proc) this.procPose(A, a, T, a._pose);
        else {
          const pick = choose(A, a, T);
          if (!pick) continue;
          if (pick[0] !== a._clip) { if (a._clip) { a._from.set(a._pose); a._blend = BLEND; } a._clip = pick[0]; }
          if (!(far && (a.id & 1) && !a._blend && (Math.floor(T * 60) & 1))) {
            this.sample(A, pick[0], pick[1], a._pose);
            if (a._blend > 0) {
              const f = 1 - a._blend / BLEND, P = a._pose, F = a._from;
              for (let i = 0; i < nodes.length; i++) {
                const o = i * 7;
                for (let q = 0; q < 3; q++) P[o + q] = F[o + q] + (P[o + q] - F[o + q]) * f;
                _q.set(F[o + 3], F[o + 4], F[o + 5], F[o + 6]); _q2.set(P[o + 3], P[o + 4], P[o + 5], P[o + 6]); _q.slerp(_q2, f);
                P[o + 3] = _q.x; P[o + 4] = _q.y; P[o + 5] = _q.z; P[o + 6] = _q.w;
              }
              a._blend = Math.max(0, a._blend - dt);
            }
          }
        }
        // wereldmatrix: positie, richting, schaal (jongen kleiner), eekhoorn tegen de stam omhoog
        let y = gy, pitch = 0;
        if (a.q && a.wy !== undefined) {
          // eekhoorn: echte houding op de stam, tak of grond (js/squirrel.js)
          const sc = a.sc * a.sp.size * (0.55 + 0.45 * a.age);
          _m.compose(_p.set(a.wx, a.wy, a.wz), a.q, _s.set(sc, sc, sc));
        } else if (a.key === 'squirrel' && (a.state === 'up' || a.state === 'down')) {
          if (a.state === 'up' && a.y < 0.45) a.y = Math.min(0.45, a.y + dt * 0.7);
          y += a.y; pitch = a.y > 0.02 && a.y < 0.44 ? -1.25 : 0;
          if (a.tree) a.rot = Math.atan2(a.tree.x - a.x, a.tree.z - a.z);
          if (a.state === 'down') pitch = 1.25;
        } else if (a.sp.fly) y += a.y;                                       // vogels: in de lucht of in een boomkruin
        if (!(a.q && a.wy !== undefined)) {
          const sc = a.sc * a.sp.size * (0.55 + 0.45 * a.age);        // kleine dieren iets groter: leesbaar van boven
          _q.setFromAxisAngle(UP, a.rot);
          if (pitch) { _q2.setFromAxisAngle(_x, pitch); _q.multiply(_q2); }
          if (a.state === 'fly' && a.bank) { _q2.setFromAxisAngle(_zf, a.bank); _q.multiply(_q2); }   // hellen in de bocht
          _m.compose(_p.set(a.x, y, a.z), _q, _s.set(sc, sc, sc));
        }
        const P = a._pose, W = S.world;
        for (let i = 0; i < nodes.length; i++) {
          const o = i * 7;
          _l.compose(_p.set(P[o], P[o + 1], P[o + 2]), _q.set(P[o + 3], P[o + 4], P[o + 5], P[o + 6]), _one);
          W[i].multiplyMatrices(nodes[i].parent < 0 ? _m : W[nodes[i].parent], _l);
        }
        // vachtkleur: lichte variatie per dier
        const tint = 0.93 + a.var * 0.035;
        _c.setRGB(tint, tint * (a.key === 'fox' ? 1 : 0.99), tint * 0.98);
        for (const p of S.parts) {
          if (p.stag && !a.stag) continue;
          for (const ni of p.nodes) { if (p.n < p.mesh.instanceMatrix.count) { p.mesh.setMatrixAt(p.n, W[ni]); p.mesh.setColorAt(p.n, _c); p.n++; } }
        }
      }
      let drawn = 0;
      for (const key in this.sp) for (const p of this.sp[key].parts) {
        const m = p.mesh; m.count = p.n; m.visible = p.n > 0;
        if (p.n) { drawn++; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
      }
      this.stats = { animals: count, drawn: drawn, src: this.src };
    }
  }
  VE.WildlifeRender = WildlifeRender;

  /* ---------------- laden ---------------- */
  VE.animalAssets = null;
  VE.animalSource = 'loading';
  const URL = 'public/models/animals.glb' + (VE.VERSION ? '?v=' + VE.VERSION : '');
  const load = (VE.loadGlb && !/[?&]noanimals/.test(location.search) ? VE.loadGlb(URL) : Promise.reject(new Error('uit')))
    .then(gltf => {
      const A = prepare(gltf);
      if (!Object.keys(A).length) throw new Error('geen dieren in animals.glb');
      VE.animalAssets = A; VE.animalSource = 'glb';
      const g = VE.game;
      if (g && g.wr && g.wr.src !== 'glb') { g.wr.dispose(); g.wr = new WildlifeRender(g.root); }
    })
    .catch(e => {
      VE.animalSource = 'procedural';
      console.warn('[Village Empire] dieren: GLB niet geladen, eenvoudige dieren worden gebruikt.', e && e.message || e);
    });
  const prev = VE.glbReady || Promise.resolve();
  VE.glbReady = Promise.race([Promise.all([prev, load]), new Promise(r => setTimeout(r, 10000))]);
})(window.VE);
