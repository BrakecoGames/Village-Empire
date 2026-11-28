/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Voedsel als basisbehoefte: honger, eten en tevredenheid.

   - Elke dorpeling heeft een verzadiging s.food (1 = vol, 0 = uitgehongerd) die langzaam daalt
     (VE.HUNGER.decay per seconde). Onder VE.HUNGER.hungry gaat hij eten: hij loopt naar de dichtstbijzijnde
     plek met brood, vis of vlees (Storehouse, startstapel, dorpshuis of de stapel van bakker, visser of jager),
     pakt één stuk (dat gaat echt van de voorraad af) en eet het daar op. Werkers gaan tussen twee
     klussen eten en lopen daarna terug naar hun werk; dragers en bouwers eten als ze vrij zijn.
   - Gevolgen:
       verzadigd          → tevreden; wie afwisselend eet (meerdere soorten) wordt nog iets tevredener;
       honger (< 0,25)    → werkt langzamer (tot de helft), tevredenheid daalt;
       uitgehongerd       → na VE.HUNGER.stopAfter s stopt hij met werken, na VE.HUNGER.leaveAfter s vertrekt hij
                            (het dorp houdt er altijd minstens VE.HUNGER.minPop).
     Tevredenheid (s.mood, 0..1) beweegt langzaam naar een doel en geeft een kleine werkbonus of -malus;
     een tevreden dorp trekt ook sneller nieuwe dorpelingen.
   - Markt en herberg verkopen alleen wat het dorp kan missen: eerst VE.HUNGER.reserve stuks per
     dorpeling blijven liggen (per markt uit te zetten: 'Feed the village first').
   - Soldaten krijgen hun rantsoen bij de kazerne en hebben geen honger.
   Alles hangt aan Game.prototype (zoals js/military.js). */
'use strict';
(function (VE) {
  const H = VE.HUNGER = Object.assign({
    decay: 1 / 600,        // per seconde: van vol tot leeg in 10 minuten
    hungry: 0.45,          // hieronder gaat hij eten
    weak: 0.25,            // hieronder werkt hij langzamer
    stopAfter: 90,         // s helemaal leeg: stopt met werken
    leaveAfter: 240,       // s helemaal leeg: vertrekt
    minPop: 8,             // zoveel blijven er altijd
    reserve: 1.5,          // stuks voedsel per dorpeling die markt en herberg laten liggen
    meal: { bread: 0.5, fish: 0.45, meat: 0.6 },
    eatTime: 1.6
  }, VE.HUNGER || {});
  const FOOD = VE.FOOD;
  const emit = (e, a) => VE.bus.emit(e, a);
  const P = VE.Game.prototype;

  const fed = s => s.mode !== 'soldier';                     // soldaten: rantsoen, geen honger
  P.initHunger = function (s, full) {
    if (s.food === undefined) s.food = full ? 1 : 0.75 + (this.rand ? this.rand() : 0.5) * 0.25;
    if (s.mood === undefined) s.mood = 0.65;
    s.starve = s.starve || 0; s.ate = s.ate || [];
    if (s.eff === undefined) s.eff = 1;
    if (s.walkEff === undefined) s.walkEff = 1;
  };

  /* ---------------- voorraad ---------------- */
  P.foodAvail = function () { let n = 0; for (const r of FOOD) n += Math.max(0, this.avail(r)); return n; };
  P.foodReserve = function () { return Math.ceil(this.settlers.filter(s => fed(s) && s.owner === this.cur).length * H.reserve); };
  /* mag r verkocht of in de herberg geschonken worden? Alleen voedsel boven de reserve van het dorp */
  P.foodSpare = function (r, market) {
    if (FOOD.indexOf(r) < 0) return true;
    if (market && market.feed === false) return true;
    return this.foodAvail() > this.foodReserve();
  };
  /* verwacht verbruik per minuut: eten van de dorpelingen (nieuwkomers niet meegerekend) */
  P.foodRate = function () {
    let n = 0, val = 0; for (const r of FOOD) val += H.meal[r]; val /= FOOD.length;
    for (const s of this.settlers) if (fed(s) && s.owner === this.cur) n++;
    return n * H.decay * 60 / val;
  };
  /* samenvatting voor de interface */
  P.foodSummary = function () {
    let n = 0, food = 0, mood = 0, hungry = 0, starving = 0, idle = 0;
    for (const s of this.settlers) {
      if (!fed(s) || s.owner !== this.cur) continue;
      this.initHunger(s);
      n++; food += s.food; mood += s.mood;
      if (s.food < H.weak) hungry++;
      if (s.food <= 0) starving++;
      if (s.starve >= H.stopAfter) idle++;
    }
    const stock = this.foodAvail(), rate = this.foodRate();
    const per = {}; for (const r of FOOD) per[r] = Math.max(0, this.avail(r));
    return {
      n, stock, per, rate, minutes: rate > 0 ? stock / rate : Infinity,
      food: n ? food / n : 1, mood: n ? mood / n : 0.65, hungry, starving, idle,
      reserve: this.foodReserve(),
      warn: stock <= 0 ? (hungry ? 'starving' : 'empty') : (rate > 0 && stock / rate < 3) ? 'low' : hungry ? 'hungry' : ''
    };
  };

  /* ---------------- tik: honger, tevredenheid, vertrekken ---------------- */
  P.hungerTick = function (dt) {
    const left = {};
    for (const s of this.settlers) {
      if (!fed(s)) continue;
      if (s.food === undefined) this.initHunger(s);
      s.food = Math.max(0, s.food - H.decay * dt);
      s.starve = s.food <= 0 ? s.starve + dt : Math.max(0, s.starve - dt * 3);
      // werktempo: vol = 1, honger tot de helft; tevredenheid geeft ±8 %
      const hf = s.food >= H.weak ? 1 : 0.55 + 1.8 * s.food;
      s.eff = hf * (0.92 + 0.16 * s.mood);
      s.walkEff = 0.75 + 0.25 * hf;
      // tevredenheid: doel hangt af van hoe vol hij zit en hoe gevarieerd hij at
      let tgt = s.food >= H.hungry ? 0.7 : s.food >= H.weak ? 0.5 : s.food > 0 ? 0.3 : 0.1;
      if (s.food >= H.weak) { const kinds = new Set(s.ate).size; tgt += kinds >= 3 ? 0.15 : kinds === 2 ? 0.08 : 0; }
      s.mood += (tgt - s.mood) * Math.min(1, dt * 0.02);
      if (s.starve >= H.leaveAfter && !left[s.owner] && s.mode !== 'train') left[s.owner] = s;
    }
    // vertrekken: hooguit één per 20 s (geen leegloop in één keer), nooit onder het minimum
    this.leaveT = this.leaveT || {};
    for (const p of this.players) {
      const t = this.leaveT[p.id] = (this.leaveT[p.id] || 0) - dt, s = left[p.id];
      if (s && t <= 0 && this.popOf(p.id) > H.minPop) { this.leaveT[p.id] = 20; this.as(p.id, () => this.leaveVillage(s)); }
    }
  };
  P.tooHungry = function (s) { return !!s && fed(s) && s.starve >= H.stopAfter; };
  /* werktempo van het gebouw (de werker): 0,5 .. ~1,06 */
  P.workEff = function (b) { const s = b && b.worker; return s && s.eff ? Math.max(0.5, s.eff) : 1; };

  /* uitgehongerd vertrekken: alles wat hij deed of droeg wordt netjes afgehandeld (er raakt niets kwijt) */
  P.leaveVillage = function (s) {
    if (s.meal) this.dropMeal(s);
    if (s.mode === 'work' || s.mode === 'goWork') this.freeWorker(s);
    if (s.mode === 'build' && s.work && s.work.builder === s) s.work.builder = null;
    if (s.task) this.failTask(s);
    if (s.entry && this.releaseTrainee) this.releaseTrainee(s);
    if (s.carry) { this.addGoods(s.carry, 1, s.x, s.z); s.carry = null; }
    this.settlers = this.settlers.filter(x => x !== s);
    this.stats.left = (this.stats.left || 0) + 1;
    if (s.owner === this.me) emit('toast', { text: '😞 A hungry settler left your village. Make more bread, fish or meat!' });
  };

  /* ---------------- eten ---------------- */
  /* welk voedsel: liefst een soort die hij de laatste keren niet at (afwisseling), anders wat er is */
  P.pickFood = function (s) {
    const have = FOOD.filter(r => this.avail(r) > 0);
    if (!have.length) return null;
    const fresh = have.filter(r => s.ate.indexOf(r) < 0);
    const list = fresh.length ? fresh : have;
    return list[Math.floor(this.rand() * list.length)];
  };
  /* op weg naar voedsel; back = gebouw van een werker (daarna terug naar zijn werk) */
  P.goEat = function (s, back) {
    this.initHunger(s);
    const r = this.pickFood(s); if (!r) return false;
    const src = this.sourceFor(r, s.x, s.z, true); if (!src) return false;
    src.outRes[r] = (src.outRes[r] || 0) + 1; this.sd = true;
    s.meal = { r: r, src: src, back: back || null, st: 'go', t: 0 };
    if (back) { s.wstate = 'eat'; s.hidden = false; s.x = back.dx; s.z = back.dz; }
    else s.mode = 'eat';
    s.act = null; s.carry = null;
    if (!this.walkToB(s, src, VE.K('atFood'))) {
      // niet te bereiken: alles terug zoals het was (de aanroeper beslist wat hij verder doet)
      src.unreach = this.time + 6; this.dropMeal(s);
      if (back) { s.wstate = 'inside'; s.hidden = true; s.wt = 1; } else s.mode = 'idle';
      return false;
    }
    return true;
  };
  P.dropMeal = function (s) {
    const m = s.meal; if (!m) return;
    if (m.st === 'go' && m.src && m.src.alive && m.src.outRes[m.r] > 0) { m.src.outRes[m.r]--; this.sd = true; }
    s.meal = null;
  };
  P.atFood = function (s) {
    const m = s.meal; if (!m) return;
    const src = m.src;
    if (src.alive && src.outRes[m.r] > 0) src.outRes[m.r]--;
    m.st = 'eat'; this.sd = true;
    const h = src.alive && this.held(src);
    if (!h || !(h[m.r] > 0)) {                    // net op: ergens anders proberen
      s.meal = null;
      if (this.goEat(s, m.back)) return;
      this.endMeal(s, true, m.back); return;
    }
    h[m.r]--; if (src.def.pile) this.checkPiles();
    s.food = Math.min(1, s.food + (H.meal[m.r] || 0.5));
    s.starve = 0;
    s.ate.push(m.r); if (s.ate.length > 3) s.ate.shift();
    this.stats.eaten = this.stats.eaten || {}; this.stats.eaten[m.r] = (this.stats.eaten[m.r] || 0) + 1;
    this.meals = this.meals || []; this.meals.push(this.time);
    m.t = H.eatTime; s.rot = Math.atan2(src.cx - s.x, src.cz - s.z);
    emit('float', { x: src.cx, y: src.y + 0.7, z: src.cz, text: '-1', icon: m.r });
  };
  /* klaar met eten (of mislukt): werker terug naar zijn werk, anderen weer vrij */
  P.endMeal = function (s, failed, back) {
    const m = s.meal; back = back || (m && m.back);
    if (m) this.dropMeal(s);
    s.meal = null; s.path = null; s.cb = null;
    if (back) {
      if (!back.alive || back.worker !== s) { this.freeWorker(s); return; }
      s.wstate = 'walk'; s.hidden = false;
      if (!this.walkToB(s, back, VE.K('mealHome', back, !!failed))) this.k_mealHome(s, back, !!failed);
    } else { s.mode = 'idle'; s.wt = failed ? 2 : 0.4; }
  };
  P.k_atFood = function (s) { this.atFood(s); };
  P.k_mealHome = function (s, back, failed) {
    if (!back.alive || back.worker !== s) { this.freeWorker(s); return; }
    s.wstate = 'inside'; s.hidden = true; s.wt = failed ? 3 : 0.5; s.x = back.dx; s.z = back.dz;
  };
  P.updateMeal = function (s, dt) {
    const m = s.meal; if (!m) { this.endMeal(s); return; }
    if (m.st !== 'eat' || s.path) return;
    m.t -= dt;
    if (m.t <= 0) this.endMeal(s);
  };
  /* werker tussen twee klussen (binnen): eerst eten als hij honger heeft; uitgehongerd stopt hij */
  P.workerMeal = function (s, b) {
    if (!fed(s)) return false;
    this.initHunger(s);
    if (s.food < H.hungry && this.goEat(s, b)) { b.status = 'Worker is having a meal'; return true; }
    if (this.tooHungry(s)) { b.status = 'Too hungry to work: needs food'; b.working = false; s.wt = 2; return true; }
    return false;
  };
  /* bouwer met honger: laat de bouwplaats los (een ander gaat verder) als er iets te eten is */
  P.builderMeal = function (s, b) {
    if (!fed(s) || s.food >= H.hungry || this.foodAvail() <= 0) return false;
    if (b.builder === s) b.builder = null;
    s.mode = 'idle'; s.tool = null; s.act = null; s.work = null; s.path = null; s.cb = null; s.wt = 0;
    return true;
  };
  /* in Game.dispatch: vrije dorpelingen met honger gaan eerst eten; uitgehongerden werken niet meer */
  P.feedIdle = function (idle) {
    for (let n = idle.length - 1; n >= 0; n--) {
      const s = idle[n];
      if (!fed(s)) continue;
      this.initHunger(s);
      if (s.food < H.hungry && this.goEat(s)) { idle.splice(n, 1); continue; }
      if (this.tooHungry(s)) idle.splice(n, 1);
    }
  };

  /* ---------------- opslaan / laden ---------------- */
  P.serializeHunger = function () {
    return this.settlers.filter(fed).map(s => [s.owner || 0, Math.round((s.food === undefined ? 1 : s.food) * 100) / 100, Math.round((s.mood === undefined ? 0.65 : s.mood) * 100) / 100, (s.ate || []).join(',')]);
  };
  P.loadHunger = function (list) {
    // per eigenaar in volgorde (oude opmaak zonder eigenaar: [food, mood, ate] → speler 0)
    const q = {};
    for (const e of list || []) { const o = e.length >= 4 ? e[0] : 0, v = e.length >= 4 ? e.slice(1) : e; (q[o] = q[o] || []).push(v); }
    for (const s of this.settlers.filter(fed)) {
      const e = q[s.owner] && q[s.owner].shift();
      if (e) { s.food = +e[0]; s.mood = +e[1]; s.ate = e[2] ? String(e[2]).split(',').filter(r => FOOD.indexOf(r) >= 0) : []; }
      else { s.food = 1; s.mood = 0.65; s.ate = []; }    // oude save: iedereen begint verzadigd
      this.initHunger(s);
    }
  };
})(window.VE);
