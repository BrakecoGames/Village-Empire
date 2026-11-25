/* Village Empire — © 2026 Brakeco Games. All rights reserved. */
'use strict';
(function (VE) {
  VE.RES = {
    log: { name: 'Logs', price: 1 },
    stone: { name: 'Stone', price: 2 },
    plank: { name: 'Planks', price: 3 },
    grain: { name: 'Grain', price: 2 },
    flour: { name: 'Flour', price: 4 },
    bread: { name: 'Bread', price: 7 },
    fish: { name: 'Fish', price: 5 },
    grape: { name: 'Grapes', price: 3 },
    wine: { name: 'Wine', price: 15 },
    // jacht, mijnbouw en metaal. rank: vanaf die rang staat het goed in de grondstoffenbalk (eerder alleen als je het al hebt)
    meat: { name: 'Meat', price: 6, rank: 1, tip: 'Game from the hunter. Feeds newcomers, just like bread and fish.' },
    coal: { name: 'Coal', price: 4, rank: 2, tip: 'Mined from deposits deep below the mountains. Fuel for the smelter.' },
    ironore: { name: 'Iron Ore', price: 4, rank: 2, tip: 'Rust-red rock from an iron mine. Smelted into iron bars.' },
    copperore: { name: 'Copper Ore', price: 5, rank: 2, tip: 'Green-flecked rock from a copper mine. Smelted into copper bars.' },
    goldore: { name: 'Gold Ore', price: 9, rank: 3, tip: 'Rare rock from a gold mine. Smelted into gold bars.' },
    ironbar: { name: 'Iron Bars', price: 16, rank: 2, tip: 'Smelted iron. Needed for gold mines, level 3 buildings and the cathedral.' },
    copperbar: { name: 'Copper Bars', price: 18, rank: 2, tip: 'Smelted copper. A sought-after trade good.' },
    goldbar: { name: 'Gold Bars', price: 60, rank: 3, tip: 'Pure gold. The most valuable trade good, and needed for the cathedral.' },
    // wapens uit de wapensmederij: voorlopig voor de opslag (later soldaten en verdediging) en voor de handel
    sword: { name: 'Swords', price: 44, rank: 2, weapon: true, tip: 'A forged steel sword. Stored for future soldiers, and a fine trade good.' },
    spear: { name: 'Spears', price: 18, rank: 2, weapon: true, tip: 'A long ash spear with an iron point. Stored for the defence of the village.' },
    battleaxe: { name: 'Battle Axes', price: 34, rank: 2, weapon: true, tip: 'A heavy two-handed battle axe. Stored for future soldiers.' },
    dagger: { name: 'Daggers', price: 15, rank: 2, weapon: true, tip: 'A small iron dagger. Cheap to forge, easy to trade.' },
    bow: { name: 'Bows', price: 14, rank: 2, weapon: true, tip: 'A longbow carved from wood. Needs no iron.' },
    crossbow: { name: 'Crossbows', price: 32, rank: 2, weapon: true, tip: 'A wooden crossbow with an iron bow. Stored for the defence of the village.' },
    // trainingsuitrusting: oefenzwaarden, gewatteerde schilden en stompe pijlen voor de kazerne
    gear: { name: 'Training Gear', price: 8, rank: 2, tip: 'Wooden practice swords, padded shields and blunt arrows from the Weaponsmith. Recruits use it up while they train at the Barracks.' }
  };
  VE.RES_ORDER = ['log', 'stone', 'plank', 'grain', 'flour', 'bread', 'fish', 'grape', 'wine',
    'meat', 'coal', 'ironore', 'copperore', 'goldore', 'ironbar', 'copperbar', 'goldbar',
    'sword', 'spear', 'battleaxe', 'dagger', 'bow', 'crossbow', 'gear'];
  VE.WEAPONS = ['sword', 'spear', 'battleaxe', 'dagger', 'bow', 'crossbow'];
  /* voedsel waarmee nieuwe bewoners sneller komen (in deze volgorde gebruikt) */
  VE.FOOD = ['bread', 'fish', 'meat'];

  /* Opslag. Producenten houden hun eigen product bij zich, maximaal LOCAL_CAP stuks: daarna stopt de
     productie tot dragers het ophalen. Grotere voorraden liggen in Storehouses (STORE_CAP per level,
     gedeeld over alle goederen die de speler aanvinkt). De startvoorraad ligt op een stapel naast het
     dorpshuis en wordt nooit aangevuld. */
  VE.LOCAL_CAP = 6;
  VE.STORE_CAP = [60, 80, 100];
  /* Een nieuw Storehouse neemt standaard alleen hout (stammen en planken) en steen aan; de speler vinkt de rest
     aan bij het plaatsen, tijdens de bouw of daarna. */
  VE.DEFAULT_ACCEPT = ['log', 'plank', 'stone'];
  VE.START_STOCK = { log: 6, stone: 14, plank: 28, bread: 8, fish: 4 };

  /* Smelterij: recepten (configureerbaar). De speler kiest het metaal per smelterij. */
  VE.RECIPES = {
    ironbar: { name: 'Iron bars', inp: { ironore: 2, coal: 1 }, out: { ironbar: 1 }, time: 10 },
    copperbar: { name: 'Copper bars', inp: { copperore: 2, coal: 1 }, out: { copperbar: 1 }, time: 10 },
    goldbar: { name: 'Gold bars', inp: { goldore: 3, coal: 2 }, out: { goldbar: 1 }, time: 14, rank: 3 }
  };
  /* Wapensmederij: één wapen per recept; de speler kiest welk wapen. 'Hout' = planken (bewerkt hout). */
  VE.WEAPON_RECIPES = {
    sword: { name: 'Swords', inp: { ironbar: 3, plank: 1 }, out: { sword: 1 }, time: 16 },
    spear: { name: 'Spears', inp: { ironbar: 1, plank: 2 }, out: { spear: 1 }, time: 10 },
    battleaxe: { name: 'Battle axes', inp: { ironbar: 2, plank: 2 }, out: { battleaxe: 1 }, time: 14 },
    dagger: { name: 'Daggers', inp: { ironbar: 1 }, out: { dagger: 1 }, time: 8 },
    bow: { name: 'Bows', inp: { plank: 3 }, out: { bow: 1 }, time: 10 },
    crossbow: { name: 'Crossbows', inp: { plank: 2, ironbar: 1 }, out: { crossbow: 1 }, time: 14 },
    gear: { name: 'Training gear', inp: { plank: 2 }, out: { gear: 2 }, time: 9 }
  };

  /* Soldaten (zie js/military.js). Elk type traint met één wapen uit de wapensmederij plus trainingsuitrusting.
     hp: gezondheid · atk: schade per slag/schot · rate: slagen per seconde · range: bereik (tegels) ·
     def: verdediging (trekt schade af) · speed: loopsnelheid (× een gewone bewoner) · time: trainingstijd (s).
     strong: tegen dit type 50% extra schade, pierce: deel van de verdediging dat genegeerd wordt. Kringloop zonder winnaar:
     bijl > zwaard > speer > bijl, en dolk > kruisboog > boog > dolk.
     Balans: zware melee (bijl, zwaard) hebben veel leven, afstand (boog, kruisboog) is kwetsbaar maar raakt
     van ver, de dolk is snel en goedkoop maar breekbaar, de speer houdt met zijn bereik de bijl op afstand. */
  VE.SOLDIERS = {
    swordsman: { name: 'Swordsman', icon: '🗡️', weapon: 'sword', gear: 1, gold: 12, time: 34, hp: 120, atk: 13, rate: 1.0, range: 0.6, def: 8, speed: 1.0, strong: 'spearman', drill: 'dummy',
      tip: 'Sword and round shield. Sturdy all-rounder with the best armour; slips past spear points. Beware of axes.' },
    archer: { name: 'Archer', icon: '🏹', weapon: 'bow', gear: 2, gold: 8, time: 30, hp: 75, atk: 10, rate: 0.9, range: 6, def: 2, speed: 1.08, strong: 'dagger', drill: 'target',
      tip: 'Longbow. Shoots from far away and moves quickly, but cannot take many hits. Strong against lightly armoured dagger fighters.' },
    spearman: { name: 'Spearman', icon: '🔱', weapon: 'spear', gear: 1, gold: 10, time: 28, hp: 115, atk: 11, rate: 0.95, range: 1.2, def: 6, speed: 0.96, strong: 'axeman', drill: 'drill',
      tip: 'Long spear and kite shield. Keeps heavy axemen at a distance with its reach.' },
    dagger: { name: 'Dagger Fighter', icon: '🔪', weapon: 'dagger', gear: 1, gold: 6, time: 22, hp: 75, atk: 7, rate: 2.2, range: 0.45, def: 3, speed: 1.3, strong: 'crossbowman', drill: 'dummy',
      tip: 'Two quick daggers and light leather. The fastest soldier: rushes slow-loading crossbowmen, but fragile.' },
    axeman: { name: 'Axeman', icon: '🪓', weapon: 'battleaxe', gear: 1, gold: 12, time: 32, hp: 135, atk: 21, rate: 0.62, range: 0.7, def: 4, speed: 0.9, strong: 'swordsman', drill: 'dummy',
      tip: 'Heavy two-handed battle axe. Slow, mighty blows that split shields; little armour.' },
    crossbowman: { name: 'Crossbowman', icon: '🎯', weapon: 'crossbow', gear: 2, gold: 12, time: 32, hp: 85, atk: 22, rate: 0.4, range: 7, def: 5, speed: 0.86, pierce: 0.6, strong: 'archer', drill: 'target',
      tip: 'Crossbow with a long reload. The longest range; outranges archers, and bolts pierce armour.' }
  };
  VE.SOLDIER_ORDER = ['swordsman', 'archer', 'spearman', 'dagger', 'axeman', 'crossbowman'];
  /* Schade van a op d (basis voor gevechten): aanvalskracht, verdediging (deels doorboord) en het voordeel. */
  VE.soldierDamage = function (a, d) {
    const A = VE.SOLDIERS[a], D = VE.SOLDIERS[d];
    if (!A || !D) return 0;
    const def = D.def * (1 - (A.pierce || 0));
    return Math.max(1, Math.round((A.atk * (A.strong === d ? 1.5 : 1) - def * 0.5) * 10) / 10);
  };

  /* Ertsaders in de bergen (zie js/mining.js). id = waarde in world.ore. */
  VE.ORES = [
    null,
    { key: 'coal', res: 'coal', name: 'coal', mine: 'coalmine', color: 0x2a2a2e },
    { key: 'iron', res: 'ironore', name: 'iron', mine: 'ironmine', color: 0x8a4a2a },
    { key: 'copper', res: 'copperore', name: 'copper', mine: 'coppermine', color: 0x3fae94 },
    { key: 'gold', res: 'goldore', name: 'gold', mine: 'goldmine', color: 0xf2c443 }
  ];

  /* role colours: tunic, hat */
  VE.ROLES = {
    carrier: [0xb07a45, 0xd9b45c], builder: [0xe08a2e, 0x8a5a2b], woodcutter: [0x4f8a36, 0x6e4527],
    forester: [0x2f6a3a, 0x7fae3f], mason: [0x8d8d8d, 0x5a5a5a], farmer: [0xe2c04a, 0xd9b45c],
    miller: [0xf2efe6, 0xdedad0], baker: [0xf6e2c0, 0xffffff], fisher: [0x3f7fbf, 0x2c4f73],
    vintner: [0x7b3f8f, 0x5a7a2a], merchant: [0xc0392b, 0x2a2a2a], innkeeper: [0x9c4a2b, 0x6b2d1a],
    sawyer: [0xa0703f, 0x5a3a20], guard: [0x4a6fa5, 0x9aa5b1],
    hunter: [0x4f6b2f, 0x3d5a22], miner: [0x6b5a4a, 0xe0b040], smelter: [0x5a4a42, 0x8a3a2a], blacksmith: [0x4a4a52, 0x2a2a2e],
    recruit: [0x9a8a6a, 0x6a5a3a]
  };

  VE.DEFS = {
    hq: { name: 'Village Hall', icon: '🏰', size: 2, storage: true, vault: true, housing: 12, territory: 9, buildable: false, fixed: true,
      desc: 'Heart of your village and home of your first settlers. Rewards and goods bought from merchants are kept here until they are used.' },
    // de startvoorraad (vroeger de Stockyard): ligt op de grond, carriers brengen er nooit iets heen
    yard: { name: 'Starting Supplies', icon: '🪵', size: 2, storage: true, pile: true, buildable: false, fixed: true,
      desc: 'The goods your settlers brought along, stacked on the ground. Builders and workshops take from it, but nothing is ever added: once it is used up, it is gone.' },
    house: { name: 'Cottage', icon: '🏡', cat: 'basic', rank: 0, cost: { plank: 4, stone: 2 }, housing: 5, levelHousing: 3,
      desc: 'A cosy home for 5 settlers. New settlers arrive faster when there is bread or fish in storage.' },
    woodcutter: { name: 'Woodcutter', icon: '🪓', cat: 'basic', rank: 0, cost: { plank: 3 }, worker: 'woodcutter', gather: 'tree', radius: 6, out: 'log', time: 3.2, tool: 'axe',
      desc: 'Fells mature trees nearby and brings back logs.' },
    forester: { name: 'Forester', icon: '🌲', cat: 'basic', rank: 0, cost: { plank: 3 }, worker: 'forester', gather: 'plant', radius: 5, time: 2.4, tool: 'spade',
      desc: 'Plants young trees so your woodcutters never run out.' },
    quarry: { name: 'Quarry', icon: '⛏️', cat: 'basic', rank: 0, cost: { plank: 3 }, worker: 'mason', gather: 'rock', radius: 6, out: 'stone', time: 4.0, tool: 'pick',
      desc: 'Cuts stone from boulders and rocky hills nearby.' },
    sawmill: { name: 'Sawmill', icon: '🪚', cat: 'basic', rank: 0, cost: { plank: 3, stone: 3 }, worker: 'sawyer', inp: { log: 1 }, out: { plank: 2 }, time: 7, anim: 'saw',
      desc: 'Saws logs into sturdy planks (1 log → 2 planks).' },
    farm: { name: 'Grain Farm', icon: '🌾', cat: 'food', rank: 1, cost: { plank: 4, stone: 2 }, worker: 'farmer', gather: 'field', fieldKind: 0, radius: 3, maxFields: 6, out: 'grain', time: 2.2, grow: 40, tool: 'scythe',
      desc: 'Sows and harvests golden wheat fields around the farm.' },
    windmill: { name: 'Windmill', icon: '🌬️', cat: 'food', rank: 1, cost: { plank: 5, stone: 4 }, worker: 'miller', inp: { grain: 1 }, out: { flour: 1 }, time: 7, anim: 'sails',
      desc: 'Grinds grain into flour.' },
    bakery: { name: 'Bakery', icon: '🍞', cat: 'food', rank: 1, cost: { plank: 4, stone: 4 }, worker: 'baker', inp: { flour: 1 }, out: { bread: 2 }, time: 9, smoke: true,
      desc: 'Bakes fresh bread from flour (1 flour → 2 bread).' },
    fisher: { name: 'Fisher', icon: '🎣', cat: 'food', rank: 1, cost: { plank: 3 }, worker: 'fisher', gather: 'fish', radius: 6, out: 'fish', time: 5.5, tool: 'rod',
      desc: 'Catches fish in nearby lakes and streams. Build it close to water.' },
    market: { name: 'Marketplace', icon: '⚖️', cat: 'trade', rank: 1, cost: { plank: 6, stone: 5 }, worker: 'merchant', market: true,
      desc: 'Carriers bring surplus goods here to be sold for gold. Also unlocks trading with travelling merchants.' },
    tower: { name: 'Watchtower', icon: '🗼', cat: 'trade', rank: 1, cost: { plank: 4, stone: 8 }, gold: 40, territory: 8,
      desc: 'Extends your borders so you can settle new land.' },
    vineyard: { name: 'Vineyard', icon: '🍇', cat: 'wine', rank: 2, cost: { plank: 4, stone: 2 }, worker: 'vintner', gather: 'field', fieldKind: 1, radius: 2, maxFields: 4, out: 'grape', time: 2.4, grow: 50, tool: 'sickle',
      desc: 'Grows grapevines and harvests sweet grapes.' },
    winery: { name: 'Winery', icon: '🍷', cat: 'wine', rank: 2, cost: { plank: 5, stone: 6 }, worker: 'vintner', inp: { grape: 1 }, out: { wine: 1 }, time: 9,
      desc: 'Presses grapes into fine wine — the most valuable trade good.' },
    tavern: { name: 'Tavern', icon: '🍺', cat: 'wine', rank: 2, cost: { plank: 8, stone: 6 }, worker: 'innkeeper', inp: { bread: 1, wine: 1 }, outGold: 32, time: 12, smoke: true,
      desc: 'Serves bread and wine for gold. Each tavern also attracts new settlers faster.' },
    warehouse: { name: 'Storehouse', icon: '📦', cat: 'basic', rank: 0, cost: { plank: 6, stone: 4 }, storage: true, depot: true,
      desc: 'Keeps up to 60 goods (80 and 100 after upgrades). Tick which goods it stores; carriers bring them from your producers. Producers only hold 6 of their goods themselves.' },
    monument: { name: 'Grand Cathedral', icon: '⛪', cat: 'trade', rank: 4, size: 2, cost: { plank: 60, stone: 80, wine: 20, ironbar: 12, goldbar: 6 }, gold: 2500, housing: 0,
      desc: 'A wonder that crowns your empire. Visible from every corner of the realm.' },
    // jacht: de jager zoekt wild binnen bereik (js/wildlife.js) en brengt vlees thuis
    hunter: { name: "Hunter's Lodge", icon: '🦌', cat: 'food', rank: 1, cost: { plank: 4, stone: 1 }, worker: 'hunter', gather: 'hunt', radius: 8, out: 'meat', time: 3.6, tool: 'net',
      desc: 'A hunter sneaks up on rabbits, roe, deer and wild boar and brings home meat. Build it near woods and meadows full of game.' },
    // mijnen: alleen op een vrije bergtegel met de juiste ertsader binnen bereik (mountain: echte bouwregel in canPlace)
    coalmine: { name: 'Coal Mine', icon: '⚫', cat: 'metal', rank: 2, cost: { plank: 5, stone: 2 }, worker: 'miner', gather: 'ore', ore: 1, mountain: true, radius: 2.6, out: 'coal', time: 4.4, tool: 'pick',
      desc: 'Digs coal from a deposit deep below the mountain. Build it above a coal deposit (use Survey to find one).' },
    ironmine: { name: 'Iron Mine', icon: '🔩', cat: 'metal', rank: 2, cost: { plank: 5, stone: 3 }, worker: 'miner', gather: 'ore', ore: 2, mountain: true, radius: 2.6, out: 'ironore', time: 5.2, tool: 'pick',
      desc: 'Digs iron ore from below the mountain. Build it above an iron deposit (use Survey to find one).' },
    coppermine: { name: 'Copper Mine', icon: '🟢', cat: 'metal', rank: 2, cost: { plank: 6, stone: 3 }, worker: 'miner', gather: 'ore', ore: 3, mountain: true, radius: 2.6, out: 'copperore', time: 5.6, tool: 'pick',
      desc: 'Digs copper ore from below the mountain. Build it above a copper deposit (use Survey to find one).' },
    goldmine: { name: 'Gold Mine', icon: '⭐', cat: 'metal', rank: 3, cost: { plank: 8, stone: 4, ironbar: 2 }, worker: 'miner', gather: 'ore', ore: 4, mountain: true, radius: 2.6, out: 'goldore', time: 7.2, tool: 'pick',
      desc: 'Digs precious gold ore from a rare deposit deep below the mountain. Build it above a gold deposit.' },
    smelter: { name: 'Smelter', icon: '🔥', cat: 'metal', rank: 2, cost: { plank: 4, stone: 8 }, worker: 'smelter', recipes: VE.RECIPES, recipe: 'ironbar',
      inp: VE.RECIPES.ironbar.inp, out: VE.RECIPES.ironbar.out, time: VE.RECIPES.ironbar.time, smoke: true,
      desc: 'Melts ore with coal into metal bars. Choose which metal it makes.' },
    // wapensmederij: de smid smeedt het gekozen wapen aan het aambeeld (iron bars + planks)
    weaponsmith: { name: 'Weaponsmith', icon: '⚔️', cat: 'metal', rank: 2, cost: { plank: 6, stone: 6, ironbar: 1 }, worker: 'blacksmith', recipes: VE.WEAPON_RECIPES, recipe: 'sword',
      inp: VE.WEAPON_RECIPES.sword.inp, out: VE.WEAPON_RECIPES.sword.out, time: VE.WEAPON_RECIPES.sword.time, smoke: true, forge: true,
      desc: 'A smith forges swords, spears, battle axes, daggers, bows, crossbows and training gear from iron bars and planks. Choose what it makes. Weapons go to the Barracks or into storage.' },
    // kazerne: dorpelingen trainen hier tot soldaat (wapen + trainingsuitrusting, zie VE.SOLDIERS en js/military.js)
    barracks: { name: 'Barracks', icon: '🛡️', cat: 'military', rank: 2, size: 2, cost: { plank: 10, stone: 10, ironbar: 2 }, barracks: true,
      desc: 'Settlers train here to become soldiers. Choose which soldiers and how many: carriers bring the weapons and training gear, then volunteers practise on dummies and targets. Your population stays the same.' }
  };
  VE.CATS = [
    { id: 'basic', name: 'Wood & Stone' },
    { id: 'food', name: 'Food' },
    { id: 'wine', name: 'Wine' },
    { id: 'metal', name: 'Mining' },
    { id: 'military', name: 'Military' },
    { id: 'trade', name: 'Realm' }
  ];

  const R = (gold, extra) => Object.assign({ gold: gold }, extra || {});
  VE.RANKS = [
    { name: 'Hamlet', unlock: ['house', 'woodcutter', 'forester', 'quarry', 'sawmill', 'warehouse'], quests: [
      { id: 'h1', text: 'Let settlers wear in 8 path tiles', type: 'roads', n: 8, reward: R(15) },
      { id: 'h2', text: 'Build a Woodcutter', type: 'build', b: 'woodcutter', n: 1, reward: R(10, { plank: 4 }) },
      { id: 'h3', text: 'Build a Sawmill', type: 'build', b: 'sawmill', n: 1, reward: R(20) },
      { id: 'h4', text: 'Build a Quarry', type: 'build', b: 'quarry', n: 1, reward: R(10, { plank: 3 }) },
      { id: 'h5', text: 'Build a Forester', type: 'build', b: 'forester', n: 1, reward: R(10) },
      { id: 'h6', text: 'Produce 20 planks', type: 'produce', res: 'plank', n: 20, reward: R(30) },
      { id: 'h7', text: 'Build 2 Cottages', type: 'build', b: 'house', n: 2, reward: R(10, { bread: 6 }) },
      { id: 'h8', text: 'Build a Storehouse', type: 'build', b: 'warehouse', n: 1, reward: R(15) }
    ] },
    { name: 'Village', unlock: ['farm', 'windmill', 'bakery', 'fisher', 'hunter', 'market', 'tower'], quests: [
      { id: 'v1', text: 'Build a Grain Farm', type: 'build', b: 'farm', n: 1, reward: R(20) },
      { id: 'v2', text: 'Mill 10 flour', type: 'produce', res: 'flour', n: 10, reward: R(30) },
      { id: 'v3', text: 'Bake 16 bread', type: 'produce', res: 'bread', n: 16, reward: R(40) },
      { id: 'v4', text: 'Catch 8 fish', type: 'produce', res: 'fish', n: 8, reward: R(30) },
      { id: 'v5', text: 'Build a Marketplace', type: 'build', b: 'market', n: 1, reward: R(30) },
      { id: 'v6', text: 'Earn 150 gold at the market', type: 'gold', n: 150, reward: R(50) },
      { id: 'v7', text: 'Build a Watchtower', type: 'build', b: 'tower', n: 1, reward: R(40, { stone: 6 }) },
      { id: 'v8', text: 'Reach 22 settlers', type: 'pop', n: 22, reward: R(60) },
      { id: 'v9', text: "Build a Hunter's Lodge", type: 'build', b: 'hunter', n: 1, reward: R(20) },
      { id: 'v10', text: 'Bring home 20 meat', type: 'produce', res: 'meat', n: 20, reward: R(40) }
    ] },
    { name: 'Market Town', unlock: ['vineyard', 'winery', 'tavern', 'coalmine', 'ironmine', 'coppermine', 'smelter', 'weaponsmith', 'barracks'], quests: [
      { id: 'm1', text: 'Harvest 20 grapes', type: 'produce', res: 'grape', n: 20, reward: R(60) },
      { id: 'm2', text: 'Press 12 wine', type: 'produce', res: 'wine', n: 12, reward: R(80) },
      { id: 'm3', text: 'Open a Tavern', type: 'build', b: 'tavern', n: 1, reward: R(80) },
      { id: 'm4', text: 'Upgrade 3 buildings', type: 'upgrade', n: 3, reward: R(100) },
      { id: 'm5', text: 'Reach 35 settlers', type: 'pop', n: 35, reward: R(120) },
      { id: 'm6', text: 'Earn 900 gold in total', type: 'gold', n: 900, reward: R(150) },
      { id: 'm7', text: 'Build 2 Watchtowers', type: 'build', b: 'tower', n: 2, reward: R(100) },
      { id: 'm8', text: 'Build a Coal Mine in the mountains', type: 'build', b: 'coalmine', n: 1, reward: R(60) },
      { id: 'm9', text: 'Build an Iron Mine', type: 'build', b: 'ironmine', n: 1, reward: R(60) },
      { id: 'm10', text: 'Build a Smelter', type: 'build', b: 'smelter', n: 1, reward: R(60) },
      { id: 'm11', text: 'Smelt 10 iron bars', type: 'produce', res: 'ironbar', n: 10, reward: R(120) },
      { id: 'm12', text: 'Build a Weaponsmith', type: 'build', b: 'weaponsmith', n: 1, reward: R(80) }
    ] },
    { name: 'Town', unlock: ['goldmine'], quests: [
      { id: 't1', text: 'Reach 55 settlers', type: 'pop', n: 55, reward: R(300) },
      { id: 't2', text: 'Press 80 wine', type: 'produce', res: 'wine', n: 80, reward: R(300) },
      { id: 't3', text: 'Bake 220 bread', type: 'produce', res: 'bread', n: 220, reward: R(300) },
      { id: 't4', text: 'Produce 400 planks', type: 'produce', res: 'plank', n: 400, reward: R(300) },
      { id: 't5', text: 'Build 4 Watchtowers', type: 'build', b: 'tower', n: 4, reward: R(400) },
      { id: 't6', text: 'Upgrade 10 buildings', type: 'upgrade', n: 10, reward: R(400) },
      { id: 't7', text: 'Earn 4000 gold in total', type: 'gold', n: 4000, reward: R(600) },
      { id: 't8', text: 'Smelt 15 copper bars', type: 'produce', res: 'copperbar', n: 15, reward: R(250) },
      { id: 't9', text: 'Build a Gold Mine', type: 'build', b: 'goldmine', n: 1, reward: R(250) },
      { id: 't10', text: 'Smelt 6 gold bars', type: 'produce', res: 'goldbar', n: 6, reward: R(400) },
      { id: 't11', text: 'Forge 6 swords', type: 'produce', res: 'sword', n: 6, reward: R(250) },
      { id: 't12', text: 'Make 8 bows', type: 'produce', res: 'bow', n: 8, reward: R(200) },
      { id: 't13', text: 'Store 20 weapons for your future army', type: 'weapons', n: 20, reward: R(350) }
    ] },
    { name: 'City', unlock: ['monument'], quests: [
      { id: 'c1', text: 'Build the Grand Cathedral', type: 'build', b: 'monument', n: 1, reward: R(2000) },
      { id: 'c2', text: 'Reach 90 settlers', type: 'pop', n: 90, reward: R(1000) },
      { id: 'c3', text: 'Press 400 wine', type: 'produce', res: 'wine', n: 400, reward: R(1000) },
      { id: 'c4', text: 'Earn 15000 gold in total', type: 'gold', n: 15000, reward: R(2000) }
    ] },
    { name: 'Empire', unlock: [], quests: [] }
  ];

  VE.UPGRADES = [
    { id: 'boots', name: 'Sturdy Boots', icon: '🥾', desc: 'All settlers walk 12% faster.', cost: [60, 180, 450, 900] },
    { id: 'tools', name: 'Fine Tools', icon: '🪓', desc: 'Gatherers work 15% faster.', cost: [80, 240, 600, 1200] },
    { id: 'craft', name: 'Master Craft', icon: '⚙️', desc: 'Workshops produce 15% faster.', cost: [100, 300, 700, 1400] },
    { id: 'trade', name: 'Trade Guild', icon: '💰', desc: 'Goods sell for 15% more gold.', cost: [120, 360, 800, 1600] },
    { id: 'soil', name: 'Rich Soil', icon: '🌱', desc: 'Fields, vines and saplings grow 20% faster.', cost: [90, 260, 650, 1300] }
  ];

  VE.levelCost = function (def, lvl) {
    if (lvl === 2) return { gold: 40, plank: 4, stone: 2 };
    return { gold: 160, plank: 10, stone: 8, ironbar: 2 };
  };
})(window.VE);
