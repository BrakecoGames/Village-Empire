/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   AI-tegenstander: de beslislus. Uitbreiden: nieuwe regels in planner.js (economie) of army.js (leger), knoppen in
   difficulty.js.

   - Elke AI-speler (player.kind === 'ai') denkt om de L.think seconden (zijn moeilijkheid, player.ai.level).
   - Hij leest de spelstatus alleen en verandert niets zelf: alles gaat via g.issue(commando), net als de mens.
     Binnen een tick komen die commando's in de wachtrij en worden ze aan het begin van de volgende tick uitgevoerd
     (deterministisch: ook straks online kan een AI meedoen).
   - Zijn geheugen (player.ai: timer, eigen random, aanvalsstatus) is JSON en gaat mee in saves en snapshots.
   - g.aiLog bewaart de laatste beslissingen (tests en debuggen). */
'use strict';
(function (VE) {
  const P = VE.Game.prototype;
  P.aiTick = function (dt) {
    for (const p of this.players) {
      if (p.kind !== 'ai' || p.defeated || !this.hqOf(p.id)) continue;
      const st = p.ai = p.ai || { level: 'normal' };
      const L = VE.AI_LEVELS[st.level] || VE.AI_LEVELS.normal;
      if (st.rng === undefined) st.rng = ((this.seed ^ (0x51ed27 * (p.id + 1))) >>> 0) || 1;
      st.t = (st.t === undefined ? L.think * (0.5 + p.id * 0.15) : st.t) - dt;
      if (st.t > 0) continue;
      st.t = L.think;
      const R = new VE.SimRng(st.rng), rnd = () => R.next();
      const did = [].concat(VE.AIPlanner.economy(this, p.id, st, L, rnd), VE.AIArmy.run(this, p.id, st, L));
      VE.AIPlanner.manage(this, p.id, st, L);
      st.rng = R.s;
      st.thinks = (st.thinks || 0) + 1;
      if (did.length) { (this.aiLog = this.aiLog || []).push({ t: Math.round(this.time), p: p.id, did: did }); if (this.aiLog.length > 400) this.aiLog.splice(0, 100); }
    }
  };
})(window.VE);
