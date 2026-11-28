/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Spelers. Elk gebouw, elke dorpeling en elke soldaat heeft een eigenaar (owner = player.id).
   Goud, rang, quests, statistieken, upgrades, nieuwkomers, voorraad, voedsel en territorium zijn per speler.

   Uitvoerende speler: alles wat de simulatie doet, doet ze voor één speler tegelijk (Game.cur): per gebouw,
   per dorpeling, per dispatchronde en per commando. Game.gold, .rank, .claimed, .stats, .upg, .stock, .avail,
   .hq enz. gaan over die speler. Buiten een tick is cur = Game.me (de speler achter dit scherm), zodat de
   interface gewoon g.gold en g.stock kan lezen. Gebruik Game.as(pid, fn) om iets voor een andere speler te doen. */
'use strict';
(function (VE) {
  VE.PLAYER_COLORS = [0x3d63b0, 0xb0503a, 0x4f7d34];
  VE.PLAYER_COLOR_NAMES = ['Blue', 'Red', 'Green'];

  class Player {
    constructor(o) {
      this.id = o.id;
      this.name = o.name || 'Player ' + (o.id + 1);
      this.color = o.color !== undefined ? o.color : VE.PLAYER_COLORS[o.id % VE.PLAYER_COLORS.length];
      this.team = o.team !== undefined ? o.team : o.id;          // zelfde team = bondgenoten
      this.kind = o.kind || 'open';                               // 'human' | 'ai' | 'open' (vrij land, speelt niet mee)
      this.isAI = this.kind === 'ai';
      this.ai = o.ai || null;                                     // { level: 'easy' | 'normal' | 'hard' }
      this.start = o.start || null;
      this.gold = 0; this.rank = 0; this.claimed = {};
      this.stats = { produced: {}, goldEarned: 0, roads: 0, built: {}, upgrades: 0 };
      this.upg = {}; for (const u of VE.UPGRADES) this.upg[u.id] = 0;
      this.arriveT = 4;
      this.defeated = false;
    }
    get active() { return this.kind !== 'open' && !this.defeated; }
    /* JSON voor saves (en later: de lobby) */
    toJSON() {
      return { id: this.id, name: this.name, color: this.color, team: this.team, kind: this.kind, ai: this.ai, start: this.start,
        gold: this.gold, rank: this.rank, claimed: this.claimed, stats: this.stats, upg: this.upg, arriveT: this.arriveT, defeated: this.defeated };
    }
    load(d) {
      for (const k of ['name', 'color', 'team', 'kind', 'ai', 'start', 'gold', 'rank', 'claimed', 'stats', 'upg', 'arriveT', 'defeated']) if (d[k] !== undefined) this[k] = d[k];
      this.isAI = this.kind === 'ai';
      return this;
    }
  }
  VE.Player = Player;
})(window.VE);
