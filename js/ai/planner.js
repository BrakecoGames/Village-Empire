/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   AI: economie. Een build order als basis plus een prioriteitensysteem dat elke beslisronde naar tekorten kijkt.

   Volgorde van een beslisronde (VE.AIPlanner.economy):
     1. voedsel laag of honger      → visser / jager (en later graan → molen → bakkerij)
     2. huisjes vol                 → huisje
     3. planken / steen laag        → houthakker, zagerij, steengroeve
     4. de build order (VE.AI_BUILD): voedsel → hout/steen → woningen → opslag → metaal → smid → kazerne → markt
     5. instellingen: wat de smid maakt, wat de markt verkoopt, opdrachten (quests) innen
   Alles gaat via commando's (g.issue); de AI leest de toestand alleen. */
'use strict';
(function (VE) {
  /* basis-volgorde: [gebouw, hoeveel er dan moeten staan] */
  VE.AI_BUILD = [
    ['woodcutter', 1], ['fisher', 1], ['sawmill', 1], ['quarry', 1], ['hunter', 1], ['house', 1], ['woodcutter', 2],
    ['warehouse', 1], ['forester', 1], ['fisher', 2], ['house', 2], ['farm', 1], ['windmill', 1], ['bakery', 1],
    ['coalmine', 1], ['ironmine', 1], ['smelter', 1], ['house', 3], ['weaponsmith', 1], ['barracks', 1],
    ['market', 1], ['sawmill', 2], ['woodcutter', 3], ['house', 4], ['hunter', 2], ['farm', 2], ['tower', 1],
    ['coalmine', 2], ['ironmine', 2], ['house', 5], ['quarry', 2], ['house', 6]
  ];
  const N = () => VE.N;

  const A = VE.AIPlanner = {
    /* hoeveel van type (af en in aanbouw) heeft speler pid */
    count(g, pid, type) { let n = 0; for (const b of g.buildings) if (b.alive && b.owner === pid && b.type === type) n++; return n; },
    building(g, pid, type) { return g.buildings.some(b => b.alive && b.owner === pid && b.type === type && !b.built); },
    sites(g, pid) { let n = 0; for (const b of g.buildings) if (b.alive && b.owner === pid && !b.built && b.def.cost) n++; return n; },

    /* geschikte plek: kandidaten binnen het eigen land, met een score per soort gebouw */
    findSpot(g, pid, type) {
      const hq = g.hqOf(pid); if (!hq) return null;
      const d = VE.DEFS[type], w = g.world, n = N(), R = 20;
      let best = null, bs = -1e9;
      const i0 = Math.max(0, Math.floor(hq.cx - R)), i1 = Math.min(n - 2, Math.ceil(hq.cx + R)), j0 = Math.max(0, Math.floor(hq.cz - R)), j1 = Math.min(n - 2, Math.ceil(hq.cz + R));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = j * n + i;
        if (w.owned[k] !== pid + 1) continue;
        if (d.mountain ? w.type[k] !== 2 : w.type[k] !== 0) continue;
        const dist = Math.hypot(i + 0.5 - hq.cx, j + 0.5 - hq.cz);
        if (dist < 2.5) continue;
        if (!g.as(pid, () => g.canPlace(type, i, j).ok)) continue;
        const sc = this.score(g, pid, type, i, j, dist);
        if (sc > bs) { bs = sc; best = [i, j]; }
      }
      return best;
    },
    score(g, pid, type, i, j, dist) {
      const w = g.world, n = N(), d = VE.DEFS[type], x = i + 0.5, z = j + 0.5;
      const around = (r, f) => { let c = 0; for (let b = Math.floor(z - r); b <= z + r; b++) for (let a = Math.floor(x - r); a <= x + r; a++) { if (!w.inb(a, b) || (a + 0.5 - x) ** 2 + (b + 0.5 - z) ** 2 > r * r) continue; if (f(b * n + a)) c++; } return c; };
      let s = -dist * 0.6;
      if (type === 'woodcutter' || type === 'forester') s += around(d.radius, k => w.tree[k] && !w.tree[k].dead) * (type === 'woodcutter' ? 2 : -0.5) + (type === 'forester' ? around(4, k => w.type[k] === 0 && !w.bld[k]) * 0.3 : 0);
      else if (type === 'quarry') s += around(d.radius, k => !!w.rock[k]) * 3;
      else if (type === 'fisher') { const wt = around(d.radius, k => w.type[k] === 1); s += wt >= 3 ? 20 + Math.min(wt, 30) : -100; }
      else if (type === 'hunter') s += (g.wild ? g.wild.list.filter(a => !a.dead && a.sp.hunt && (a.x - x) ** 2 + (a.z - z) ** 2 < 64).length : 0) * 2 - Math.max(0, 6 - dist) * 2;
      else if (type === 'farm') s += around(3, k => w.type[k] === 0 && !w.bld[k] && !w.tree[k] && !w.rock[k] && !w.road[k]) * 1.2;
      else if (type === 'tower') s += dist * 1.2;                                  // grenzen verleggen: zo ver mogelijk
      else if (d.mountain) s += 10;
      else s -= around(1.5, k => !!w.bld[k]) * 0.5;                                // niet alles dicht op elkaar
      return s;
    },
    /* toren richting de dichtstbijzijnde ertsader van een soort (als er binnen de grenzen geen mijnplek is) */
    towerToward(g, pid, ore) {
      const hq = g.hqOf(pid), w = g.world; if (!hq || !w.deposits) return null;
      let dep = null, dd = 1e9;
      for (const q of w.deposits) { if (q.type !== ore || q.amount <= 0) continue; const d = (q.x - hq.cx) ** 2 + (q.z - hq.cz) ** 2; if (d < dd) { dd = d; dep = q; } }
      if (!dep) return null;
      const n = N(); let best = null, bs = 1e9;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        if (w.owned[j * n + i] !== pid + 1 || w.type[j * n + i] !== 0) continue;
        const d = (i + 0.5 - dep.x) ** 2 + (j + 0.5 - dep.z) ** 2; if (d >= bs) continue;
        if (!g.as(pid, () => g.canPlace('tower', i, j).ok)) continue;
        bs = d; best = [i, j];
      }
      return best;
    },

    /* één beslisronde voor de economie; geeft terug wat hij deed (voor de log en de tests) */
    economy(g, pid, st, L, rnd) {
      const did = [];
      const me = g.players[pid];
      // bouwmateriaal en opslag mogen altijd één bouwplaats extra (anders kan alles op steen of planken blijven wachten)
      // vrije dragers: zonder dragers komt er niets aan en staat alles stil
      const idle = g.settlers.filter(s => s.owner === pid && (s.mode === 'idle' || s.mode === 'wander')).length;
      const build = (type, why) => {
        const critical = why === 'planks' || why === 'stone' || why === 'storage' || why === 'carriers';
        if (A.sites(g, pid) >= L.sites + (critical ? 1 : 0)) return false;
        if (VE.DEFS[type].worker && idle < 3 && !critical) return false;           // eerst meer volk (huisjes)
        if (!g.as(pid, () => g.unlocked(type))) return false;
        if (VE.DEFS[type].gold && me.gold < VE.DEFS[type].gold) return false;
        let p = A.findSpot(g, pid, type);
        if (!p && VE.DEFS[type].mountain && VE.DEFS[type].ore) {
          // geen plek binnen de grenzen: een toren richting de ader
          if (A.count(g, pid, 'tower') < 3 && me.gold >= VE.DEFS.tower.gold && !g.buildings.some(b => b.alive && b.owner === pid && b.type === 'tower' && !b.built)) {
            const t = A.towerToward(g, pid, VE.DEFS[type].ore);
            if (t) { g.issue({ type: 'build', playerId: pid, buildingType: 'tower', i: t[0], j: t[1] }); did.push('tower→' + type); return true; }
          }
          return false;
        }
        if (!p) return false;
        g.issue({ type: 'build', playerId: pid, buildingType: type, i: p[0], j: p[1], accept: type === 'warehouse' ? VE.RES_ORDER.slice() : undefined });
        did.push(type + (why ? ' (' + why + ')' : ''));
        return true;
      };
      const f = g.as(pid, () => g.foodSummary());
      const cap = g.as(pid, () => g.popCap()), pop = g.popOf(pid);
      const plank = g.as(pid, () => g.avail('plank')), stone = g.as(pid, () => g.avail('stone')), log = g.as(pid, () => g.avail('log'));
      // 0. opslag: producenten lopen vol en de Storehouses zitten vol → nog een Storehouse
      const full = g.buildings.filter(b => b.alive && b.built && b.owner === pid && !b.store && b.output && g.outTotal(b) >= VE.LOCAL_CAP).length;
      const room = g.buildings.filter(b => b.alive && b.built && b.owner === pid && b.def.depot).reduce((n, b) => n + g.storeFree(b), 0);
      if (full >= 2 && room < 15 && A.count(g, pid, 'warehouse') < 8 && !A.building(g, pid, 'warehouse') && build('warehouse', 'storage')) return did;
      // 1. voedsel: groeit mee met de bevolking (vissers en jagers, daarna graan → molen → bakkerij)
      const foodBld = A.count(g, pid, 'fisher') + A.count(g, pid, 'hunter') + 2 * A.count(g, pid, 'bakery');
      if ((f.minutes < 6 || f.hungry > 0 || foodBld < pop / 9) && !A.building(g, pid, 'fisher') && !A.building(g, pid, 'hunter')) {
        const fishers = A.count(g, pid, 'fisher'), hunters = A.count(g, pid, 'hunter'), farms = A.count(g, pid, 'farm'), mills = A.count(g, pid, 'windmill'), bak = A.count(g, pid, 'bakery');
        if (farms > mills * 2 && build('windmill', 'food')) return did;
        if (mills > bak && build('bakery', 'food')) return did;
        if (fishers <= hunters && fishers < 8 && build('fisher', 'food')) return did;
        if (hunters < 5 && build('hunter', 'food')) return did;
        if (farms < 6 && build('farm', 'food')) return did;
      }
      // 2. woningen: te weinig dragers → meteen een huisje (voorrang); anders als er eten genoeg is
      if (idle < 3 && pop >= cap - 1 && cap < 160 && !A.building(g, pid, 'house') && build('house', 'carriers')) return did;
      if (pop >= cap - 1 && cap < 160 && f.hungry <= pop / 10 && f.minutes > 3 && !A.building(g, pid, 'house') && build('house', 'room')) return did;
      // 3. bouwmateriaal
      if (plank < 6 && log < 4 && A.count(g, pid, 'woodcutter') < 4 && build('woodcutter', 'planks')) return did;
      if (plank < 6 && log >= 4 && A.count(g, pid, 'sawmill') < 2 && build('sawmill', 'planks')) return did;
      // steen: ook als een bouwplaats erop wacht
      const waitStone = g.buildings.some(b => b.alive && b.owner === pid && !b.built && b.def.cost && b.def.cost.stone > (b.delivered.stone || 0) + (b.incoming.stone || 0));
      if ((stone < 5 || (waitStone && stone < 2)) && A.count(g, pid, 'quarry') + A.count(g, pid, 'stonemine') < 3 && !A.building(g, pid, 'quarry')) { if (build('quarry', 'stone') || build('stonemine', 'stone')) return did; }
      // 4. build order (slordig: soms een stap overslaan)
      for (const [type, n] of VE.AI_BUILD) {
        if (A.count(g, pid, type) >= n) continue;
        if (type === 'house' && (cap >= 160 || f.hungry > pop / 10)) continue;
        if (L.sloppy && rnd() < L.sloppy) continue;
        if (build(type)) return did;
        if (A.sites(g, pid) >= L.sites) break;
      }
      return did;
    },
    /* instellingen van gebouwen: smid, markt, opdrachten */
    manage(g, pid, st, L) {
      const me = g.players[pid];
      // smid: maakt wat de wachtrij van de kazerne mist (uitrusting of het wapen), anders afwisselend voorraad.
      // Nooit midden in een partij wisselen en hooguit eens per 20 s (anders gaat het ijzer heen en weer).
      const bar = g.buildings.find(x => x.alive && x.built && x.owner === pid && x.def.barracks);
      const have = r => (bar ? (bar.input[r] || 0) + (bar.incoming[r] || 0) : 0) + g.as(pid, () => g.avail(r));
      const need = {};
      if (bar) for (const e of bar.queue || []) if (e.st !== 'train') { const n = g.trainNeeds(e.t); for (const r in n) need[r] = (need[r] || 0) + n[r]; }
      let want = null;
      for (const r of ['gear'].concat(Object.keys(need).filter(r => r !== 'gear'))) if ((need[r] || 0) > have(r)) { want = r; break; }
      if (!want) { const w = VE.SOLDIERS[L.mix[(st.trained || 0) % L.mix.length]].weapon; want = have('gear') < 4 ? 'gear' : have(w) < 3 ? w : null; }
      for (const b of g.buildings) {
        if (!b.alive || !b.built || b.owner !== pid || b.type !== 'weaponsmith' || !want || b.recipe === want || b.working) continue;
        if (g.time - (st.smithT || -99) < 20) continue;
        st.smithT = g.time;
        g.issue({ type: 'setRecipe', playerId: pid, buildingId: b.id, recipe: want });
      }
      // uitgeputte mijnen afbreken (dan komt er elders een nieuwe)
      for (const b of g.buildings) {
        if (!b.alive || !b.built || b.owner !== pid || !b.def.mountain || !b.def.ore || b.def.ore === 5 || b.def.surface) continue;
        const r = b.def.radius + (b.level - 1) * 0.5;
        if (VE.Mining && !VE.Mining.near(g.world, b.cx, b.cz, b.def.ore, r) && g.outTotal(b) === 0) g.issue({ type: 'demolish', playerId: pid, buildingId: b.id });
      }
      // markt: overschot aan hout, planken en steen verkopen (voedsel alleen boven de reserve)
      for (const b of g.buildings) {
        if (!b.alive || !b.built || b.owner !== pid || !b.def.market || st.market === b.id) continue;
        for (const r of ['log', 'plank', 'stone', 'fish', 'bread', 'meat']) g.issue({ type: 'setMarketTrade', playerId: pid, buildingId: b.id, res: r, sell: true });
        g.issue({ type: 'setMarketTrade', playerId: pid, buildingId: b.id, keep: 20, feed: true });
        st.market = b.id;
      }
      // opdrachten van de rang: innen wat af is (geeft goud)
      const R = VE.RANKS[me.rank];
      if (R) for (const q of R.quests) if (!me.claimed[q.id] && g.as(pid, () => g.questProgress(q)) >= q.n) g.issue({ type: 'claimQuest', playerId: pid, questId: q.id });
    }
  };
})(window.VE);
