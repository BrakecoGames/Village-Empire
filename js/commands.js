/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Commando's: de enige manier om de spelstatus te veranderen (mens, AI en later het netwerk).

   Een commando is een klein JSON-object, bijvoorbeeld
       { type: 'build', playerId: 0, buildingType: 'farm', i: 40, j: 52 }
   - g.issue(cmd, cb) zet het in de wachtrij; het wordt aan het begin van de volgende tick uitgevoerd
     (Game.tick → runCommands). cb(result) is optioneel en alleen lokaal (bijv. een melding in de interface).
   - VE.applyCommand(g, cmd) controleert en voert uit: eerst `check` (eigenaar, plek, grondstoffen, rang ...),
     dan `run`, als die speler (g.as). Resultaat: { ok: true, ... } of { ok: false, why: 'Engelse uitleg' }.
   - Alles wat is uitgevoerd komt in g.cmdLog ({ t: tick, c: cmd }): dat is meteen een replay. Voor
     lockstep-multiplayer stuurt de netwerklaag later precies deze commando's rond en voert iedereen ze in
     dezelfde tick uit.
   Commando's verwijzen alleen met id's (buildingId, unitIds), nooit met objecten. */
'use strict';
(function (VE) {
  const P = VE.Game.prototype;
  const no = why => ({ ok: false, why: why });
  const OK = { ok: true };

  /* hulpjes: eigen gebouw / eigen soldaten */
  function own(g, c) {
    const b = g.bmap[c.buildingId];
    if (!b || !b.alive) return { why: 'That building is gone' };
    if (b.owner !== c.playerId) return { why: 'That is not your building' };
    return { b: b };
  }
  function units(g, c) {
    const ids = new Set(c.unitIds || []);
    return g.settlers.filter(s => ids.has(s.id) && s.owner === c.playerId && s.mode === 'soldier');
  }

  const C = VE.COMMANDS = {
    /* bouwen: { buildingType, i, j, accept?: [goederen] (Storehouse) } */
    build: {
      check(g, c) {
        const d = VE.DEFS[c.buildingType];
        if (!d || d.buildable === false) return no('Unknown building');
        if (!g.unlocked(c.buildingType)) return no('Not unlocked yet');
        const chk = g.canPlace(c.buildingType, c.i | 0, c.j | 0);
        return chk.ok ? OK : no(chk.why);
      },
      run(g, c) {
        const d = VE.DEFS[c.buildingType];
        if (d.gold) g.gold -= d.gold;
        const b = g.placeBuilding(c.buildingType, c.i | 0, c.j | 0);
        if (b.accept && Array.isArray(c.accept)) for (const r of VE.RES_ORDER) b.accept[r] = c.accept.indexOf(r) >= 0;
        return { ok: true, buildingId: b.id };
      }
    },
    demolish: {
      check(g, c) { const o = own(g, c); if (!o.b) return no(o.why); return o.b.def.fixed ? no('This building cannot be removed') : OK; },
      run(g, c) { g.demolish(g.bmap[c.buildingId]); return OK; }
    },
    upgrade: {
      check(g, c) {
        const o = own(g, c); if (!o.b) return no(o.why);
        const b = o.b;
        if (!b.built || b.up || !b.def.cost) return no('Cannot upgrade now');
        if (b.level >= g.maxLevel()) return no('Reach a higher rank to upgrade further');
        if (!g.canAfford(VE.levelCost(b.def, b.level + 1))) return no('Not enough gold or materials');
        return OK;
      },
      run(g, c) { return g.upgrade(g.bmap[c.buildingId]) ? OK : no('Cannot upgrade now'); }
    },
    cancelUpgrade: {
      check(g, c) { const o = own(g, c); if (!o.b) return no(o.why); return o.b.up ? OK : no('No upgrade in progress'); },
      run(g, c) { g.cancelUpgrade(g.bmap[c.buildingId]); return OK; }
    },
    /* { buildingId, recipe } */
    setRecipe: {
      check(g, c) {
        const o = own(g, c); if (!o.b) return no(o.why);
        const R = o.b.def.recipes && o.b.def.recipes[c.recipe];
        if (!R) return no('Unknown recipe');
        if (R.rank && g.rank < R.rank) return no('Not unlocked yet');
        return OK;
      },
      run(g, c) { g.setRecipe(g.bmap[c.buildingId], c.recipe); return OK; }
    },
    /* Storehouse-filter: { buildingId, res ('*' = alles), on } */
    setAccept: {
      check(g, c) { const o = own(g, c); if (!o.b) return no(o.why); if (!o.b.def.depot) return no('Not a Storehouse'); return c.res === '*' || VE.RES[c.res] ? OK : no('Unknown goods'); },
      run(g, c) { g.setAccept(g.bmap[c.buildingId], c.res, c.on); return OK; }
    },
    /* markt: { buildingId, res?, sell?: bool, keep?: getal, feed?: bool } */
    setMarketTrade: {
      check(g, c) {
        const o = own(g, c); if (!o.b) return no(o.why);
        if (!o.b.def.market) return no('Not a Marketplace');
        if (c.res !== undefined && !VE.RES[c.res]) return no('Unknown goods');
        if (c.keep !== undefined && !(c.keep >= 0 && c.keep <= 999)) return no('Invalid amount');
        return OK;
      },
      run(g, c) {
        const b = g.bmap[c.buildingId];
        if (c.res !== undefined) b.sell[c.res] = c.sell === undefined ? !b.sell[c.res] : !!c.sell;
        if (c.keep !== undefined) b.keep = c.keep | 0;
        if (c.feed !== undefined) b.feed = !!c.feed;
        return OK;
      }
    },
    /* handel met reizende kooplieden: { res, n } (n > 0 kopen, n < 0 verkopen) */
    trade: {
      check(g, c) {
        if (!VE.RES[c.res] || !(c.n | 0)) return no('Unknown trade');
        if (!g.countBuilt('market')) return no('Build a Marketplace first');
        if (c.n > 0 && g.gold < g.buyPrice(c.res) * c.n) return no('Not enough gold');
        if (c.n < 0 && g.avail(c.res) < -c.n) return no('Not enough goods');
        return OK;
      },
      run(g, c) { return g.trade(c.res, c.n | 0) ? OK : no('Trade failed'); }
    },
    buyUpgrade: {
      check(g, c) {
        const u = VE.UPGRADES.find(x => x.id === c.upgradeId); if (!u) return no('Unknown upgrade');
        const lvl = g.upg[u.id];
        if (lvl >= u.cost.length) return no('Already at the highest level');
        return g.gold >= u.cost[lvl] ? OK : no('Not enough gold');
      },
      run(g, c) { return g.buyUpgrade(c.upgradeId) ? OK : no('Not enough gold'); }
    },
    claimQuest: {
      check(g, c) {
        const q = VE.RANKS[g.rank] && VE.RANKS[g.rank].quests.find(x => x.id === c.questId);
        if (!q) return no('Unknown task');
        if (g.claimed[q.id]) return no('Already collected');
        return g.questProgress(q) >= q.n ? OK : no('Not finished yet');
      },
      run(g, c) { const q = VE.RANKS[g.rank].quests.find(x => x.id === c.questId); return g.claim(q) ? OK : no('Not finished yet'); }
    },
    promote: {
      check(g) { return g.canPromote() ? OK : no('Finish every task first'); },
      run(g) { return g.promote() ? { ok: true, rank: g.rank } : no('Finish every task first'); }
    },
    /* kazerne: { buildingId, unitType, count } */
    trainUnit: {
      check(g, c) {
        const o = own(g, c); if (!o.b) return no(o.why);
        if (!o.b.def.barracks || !o.b.built) return no('Not a Barracks');
        const S = VE.SOLDIERS[c.unitType]; if (!S) return no('Unknown soldier');
        return g.gold >= S.gold ? OK : no('Needs ' + S.gold + ' gold');
      },
      run(g, c) { const n = g.queueTraining(g.bmap[c.buildingId], c.unitType, Math.max(1, c.count | 0)); return n ? { ok: true, queued: n } : no('The queue is full'); }
    },
    /* { buildingId, entryId } */
    cancelTraining: {
      check(g, c) { const o = own(g, c); if (!o.b) return no(o.why); return o.b.queue && o.b.queue.some(e => e.id === c.entryId) ? OK : no('Not in the queue'); },
      run(g, c) { const b = g.bmap[c.buildingId]; return g.cancelTraining(b, b.queue.find(e => e.id === c.entryId)) ? OK : no('Not in the queue'); }
    },
    /* soldaten: { unitIds, targetX, targetZ (of targetY), mode: 'hold' | 'patrol' } */
    moveUnits: {
      check(g, c) {
        if (!units(g, c).length) return no('Select your soldiers first');
        const x = +c.targetX, z = +(c.targetZ !== undefined ? c.targetZ : c.targetY);
        return g.world.inb(Math.floor(x), Math.floor(z)) ? OK : no('Outside the map');
      },
      run(g, c) {
        const z = c.targetZ !== undefined ? c.targetZ : c.targetY;
        const n = g.orderSoldiers(units(g, c), +c.targetX, +z, c.mode === 'patrol' ? 'patrol' : 'hold');
        return n ? { ok: true, moved: n } : no('They cannot get there');
      }
    },
    holdUnits: {
      check(g, c) { return units(g, c).length ? OK : no('Select your soldiers first'); },
      run(g, c) { g.holdSoldiers(units(g, c)); return OK; }
    },
    dismissUnits: {
      check(g, c) { return units(g, c).length ? OK : no('Select your soldiers first'); },
      run(g, c) { let n = 0; for (const s of units(g, c)) if (g.dismissSoldier(s)) n++; return { ok: n > 0, dismissed: n }; }
    },
    /* aanvallen: { unitIds, targetId } (gebouw of soldaat). Gevechten komen in fase 2 (js/combat.js). */
    attack: {
      check(g, c) { return g.orderAttack ? (units(g, c).length ? OK : no('Select your soldiers first')) : no('Combat is not available yet'); },
      run(g, c) { return g.orderAttack(units(g, c), c.targetId); }
    },
    /* spelsnelheid (single player; online beslist straks de host) */
    setSpeed: {
      check(g, c) { return [1, 2, 3].indexOf(c.speed) >= 0 ? OK : no('Invalid speed'); },
      run(g, c) { g.speed = c.speed; return OK; }
    }
  };

  /* controleren en uitvoeren, als de speler van het commando */
  VE.applyCommand = function (g, cmd) {
    const H = cmd && C[cmd.type];
    if (!H) return no('Unknown command');
    const p = g.players[cmd.playerId];
    if (!p || !p.active) return no('Unknown player');
    return g.as(cmd.playerId, () => {
      const v = H.check ? H.check(g, cmd) : OK;
      if (!v.ok) return v;
      return H.run(g, cmd) || OK;
    });
  };
  /* alleen controleren (interface: knop wel/niet mogelijk), zonder iets te veranderen */
  VE.checkCommand = function (g, cmd) {
    const H = cmd && C[cmd.type]; if (!H) return no('Unknown command');
    const p = g.players[cmd.playerId]; if (!p || !p.active) return no('Unknown player');
    return g.as(cmd.playerId, () => H.check ? H.check(g, cmd) : OK);
  };

  /* in de wachtrij (uitvoeren in de volgende tick). Standaard speler: de speler achter dit scherm. */
  P.issue = function (cmd, cb) {
    const c = JSON.parse(JSON.stringify(cmd));
    if (c.playerId === undefined) c.playerId = this.me;
    this.cmdSeq = (this.cmdSeq || 0) + 1; c.seq = this.cmdSeq;
    (this.cmdQueue = this.cmdQueue || []).push(c);
    if (cb) (this._cmdCb = this._cmdCb || {})[c.seq] = cb;
    // lokaal spel, buiten een tick: meteen uitvoeren. Voor een replay is dat hetzelfde als "aan het begin van de
    // volgende tick" (het log bewaart de tick). Binnen een tick (AI) of online (lockstep): wachtrij.
    if (!this.inTick && !this.lockstep) this.runCommands();
    return c.seq;
  };
  P.runCommands = function () {
    const q = this.cmdQueue; if (!q || !q.length) return;
    this.cmdQueue = [];
    this.cmdLog = this.cmdLog || [];
    for (const c of q) {
      const res = VE.applyCommand(this, c);
      this.cmdLog.push({ t: this.tickN || 0, c: c, ok: !!res.ok });
      if (this.cmdLog.length > 20000) this.cmdLog.splice(0, 5000);
      VE.bus.emit('command', { cmd: c, res: res });
      const cb = this._cmdCb && this._cmdCb[c.seq];
      if (cb) { delete this._cmdCb[c.seq]; try { cb(res); } catch (e) { console.error(e); } }
    }
    this.cur = this.me;
  };
})(window.VE);
