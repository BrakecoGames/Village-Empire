/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   AI: leger. Trainen, verdedigen en aanvallen, alleen met commando's.

   - Trainen: zolang er goud is en de wachtrij kort is, de volgende soldaat uit L.mix.
   - Verdedigen: vijandelijke soldaten binnen L.defendR van zijn dorpshuis → alle soldaten daarheen (ze vechten
     automatisch, js/combat.js).
   - Aanvallen: vanaf L.attackAfter seconden en met minstens L.army soldaten: alle soldaten naar het dorpshuis van de
     dichtstbijzijnde tegenstander die nog meedoet. Na een verloren aanval eerst L.regroup seconden opbouwen. */
'use strict';
(function (VE) {
  VE.AIArmy = {
    run(g, pid, st, L) {
      const did = [], me = g.players[pid], hq = g.hqOf(pid);
      if (!hq) return did;
      const mine = g.soldiers(undefined, pid);
      // trainen
      const bar = g.buildings.find(b => b.alive && b.built && b.owner === pid && b.def.barracks);
      if (bar) {
        const q = (bar.queue || []).length;
        const next = L.mix[(st.trained || 0) % L.mix.length];
        if (q < 3 && me.gold >= VE.SOLDIERS[next].gold + 10) {
          g.issue({ type: 'trainUnit', playerId: pid, buildingId: bar.id, unitType: next, count: 1 });
          st.trained = (st.trained || 0) + 1; did.push('train ' + next);
        }
      }
      // verdedigen
      let tx = 0, tz = 0, n = 0;
      for (const s of g.settlers) {
        if (s.mode !== 'soldier' || !g.enemies(pid, s.owner)) continue;
        if ((s.x - hq.cx) ** 2 + (s.z - hq.cz) ** 2 < L.defendR * L.defendR) { tx += s.x; tz += s.z; n++; }
      }
      if (n && mine.length) {
        st.defending = g.time;
        const idle = mine.filter(s => !s.sol.eng);
        if (idle.length) { g.issue({ type: 'moveUnits', playerId: pid, unitIds: idle.map(s => s.id), targetX: tx / n, targetZ: tz / n }); did.push('defend ' + idle.length); }
        return did;
      }
      // aanvallen
      const attacking = mine.filter(s => s.sol.ord === 'attack').length;
      if (st.attacking && !attacking) { st.attacking = false; st.nextAttack = g.time + L.regroup; did.push('regroup'); }
      if (!st.attacking && g.time >= L.attackAfter && g.time >= (st.nextAttack || 0) && mine.length >= L.army) {
        let tgt = null, td = 1e9;
        for (const p of g.players) {
          if (!p.active || !g.enemies(pid, p.id)) continue;
          const h = g.hqOf(p.id); if (!h) continue;
          const d = (h.cx - hq.cx) ** 2 + (h.cz - hq.cz) ** 2; if (d < td) { td = d; tgt = h; }
        }
        if (tgt) {
          g.issue({ type: 'attack', playerId: pid, unitIds: mine.map(s => s.id), targetId: tgt.id });
          st.attacking = true; st.attacks = (st.attacks || 0) + 1; did.push('attack ' + g.players[tgt.owner].name + ' with ' + mine.length);
        }
      } else if (st.attacking) {
        // nieuwe soldaten sluiten aan bij de aanval
        const fresh = mine.filter(s => s.sol.ord !== 'attack' && !s.sol.eng);
        const lead = mine.find(s => s.sol.ord === 'attack' && s.sol.tb);
        if (fresh.length && lead) g.issue({ type: 'attack', playerId: pid, unitIds: fresh.map(s => s.id), targetId: lead.sol.tb });
      }
      return did;
    }
  };
})(window.VE);
