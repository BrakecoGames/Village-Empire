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
    coal: { name: 'Coal', price: 4, rank: 2, tip: 'Dug from black veins in the mountains. Fuel for the smelter.' },
    ironore: { name: 'Iron Ore', price: 4, rank: 2, tip: 'Rust-veined rock from an iron mine. Smelted into iron bars.' },
    copperore: { name: 'Copper Ore', price: 5, rank: 2, tip: 'Green-flecked rock from a copper mine. Smelted into copper bars.' },
    goldore: { name: 'Gold Ore', price: 9, rank: 3, tip: 'Rare rock with golden veins. Smelted into gold bars.' },
    ironbar: { name: 'Iron Bars', price: 16, rank: 2, tip: 'Smelted iron. Needed for gold mines, level 3 buildings and the cathedral.' },
    copperbar: { name: 'Copper Bars', price: 18, rank: 2, tip: 'Smelted copper. A sought-after trade good.' },
    goldbar: { name: 'Gold Bars', price: 60, rank: 3, tip: 'Pure gold. The most valuable trade good, and needed for the cathedral.' }
  };
  VE.RES_ORDER = ['log', 'stone', 'plank', 'grain', 'flour', 'bread', 'fish', 'grape', 'wine',
    'meat', 'coal', 'ironore', 'copperore', 'goldore', 'ironbar', 'copperbar', 'goldbar'];
  /* voedsel waarmee nieuwe bewoners sneller komen (in deze volgorde gebruikt) */
  VE.FOOD = ['bread', 'fish', 'meat'];

  /* Smelterij: recepten (configureerbaar). De speler kiest het metaal per smelterij. */
  VE.RECIPES = {
    ironbar: { name: 'Iron bars', inp: { ironore: 2, coal: 1 }, out: { ironbar: 1 }, time: 10 },
    copperbar: { name: 'Copper bars', inp: { copperore: 2, coal: 1 }, out: { copperbar: 1 }, time: 10 },
    goldbar: { name: 'Gold bars', inp: { goldore: 3, coal: 2 }, out: { goldbar: 1 }, time: 14, rank: 3 }
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
    hunter: [0x4f6b2f, 0x3d5a22], miner: [0x6b5a4a, 0xe0b040], smelter: [0x5a4a42, 0x8a3a2a]
  };

  VE.DEFS = {
    hq: { name: 'Village Hall', icon: '🏰', size: 2, storage: true, housing: 12, territory: 9, buildable: false, fixed: true,
      desc: 'Heart of your village. Stores all goods and shelters your first settlers.' },
    yard: { name: 'Stockyard', icon: '🪵', size: 2, storage: true, buildable: false, fixed: true,
      desc: 'Every log, stone and sack your village owns is piled up here. Carriers drop goods off at the yard, builders fetch them from it.' },
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
    warehouse: { name: 'Storehouse', icon: '📦', cat: 'trade', rank: 2, cost: { plank: 8, stone: 6 }, storage: true,
      desc: 'Extra storage point. Carriers drop goods at the nearest store, saving long walks.' },
    monument: { name: 'Grand Cathedral', icon: '⛪', cat: 'trade', rank: 4, size: 2, cost: { plank: 60, stone: 80, wine: 20, ironbar: 12, goldbar: 6 }, gold: 2500, housing: 0,
      desc: 'A wonder that crowns your empire. Visible from every corner of the realm.' },
    // jacht: de jager zoekt wild binnen bereik (js/wildlife.js) en brengt vlees thuis
    hunter: { name: "Hunter's Lodge", icon: '🦌', cat: 'food', rank: 1, cost: { plank: 4, stone: 1 }, worker: 'hunter', gather: 'hunt', radius: 8, out: 'meat', time: 3.6, tool: 'net',
      desc: 'A hunter sneaks up on rabbits, roe, deer and wild boar and brings home meat. Build it near woods and meadows full of game.' },
    // mijnen: alleen op een vrije bergtegel met de juiste ertsader binnen bereik (mountain: echte bouwregel in canPlace)
    coalmine: { name: 'Coal Mine', icon: '⚫', cat: 'metal', rank: 2, cost: { plank: 5, stone: 2 }, worker: 'miner', gather: 'ore', ore: 1, mountain: true, radius: 2.6, out: 'coal', time: 4.4, tool: 'pick',
      desc: 'Digs coal from a black vein. Build it on the mountain, right beside a coal vein.' },
    ironmine: { name: 'Iron Mine', icon: '🔩', cat: 'metal', rank: 2, cost: { plank: 5, stone: 3 }, worker: 'miner', gather: 'ore', ore: 2, mountain: true, radius: 2.6, out: 'ironore', time: 5.2, tool: 'pick',
      desc: 'Digs iron ore from a rust-red vein. Build it on the mountain, right beside an iron vein.' },
    coppermine: { name: 'Copper Mine', icon: '🟢', cat: 'metal', rank: 2, cost: { plank: 6, stone: 3 }, worker: 'miner', gather: 'ore', ore: 3, mountain: true, radius: 2.6, out: 'copperore', time: 5.6, tool: 'pick',
      desc: 'Digs copper ore from a green vein. Build it on the mountain, right beside a copper vein.' },
    goldmine: { name: 'Gold Mine', icon: '⭐', cat: 'metal', rank: 3, cost: { plank: 8, stone: 4, ironbar: 2 }, worker: 'miner', gather: 'ore', ore: 4, mountain: true, radius: 2.6, out: 'goldore', time: 7.2, tool: 'pick',
      desc: 'Digs precious gold ore from a rare golden vein. Build it on the mountain, right beside a gold vein.' },
    smelter: { name: 'Smelter', icon: '🔥', cat: 'metal', rank: 2, cost: { plank: 4, stone: 8 }, worker: 'smelter', recipes: VE.RECIPES, recipe: 'ironbar',
      inp: VE.RECIPES.ironbar.inp, out: VE.RECIPES.ironbar.out, time: VE.RECIPES.ironbar.time, smoke: true,
      desc: 'Melts ore with coal into metal bars. Choose which metal it makes.' }
  };
  VE.CATS = [
    { id: 'basic', name: 'Wood & Stone' },
    { id: 'food', name: 'Food' },
    { id: 'wine', name: 'Wine' },
    { id: 'metal', name: 'Mining' },
    { id: 'trade', name: 'Realm' }
  ];

  const R = (gold, extra) => Object.assign({ gold: gold }, extra || {});
  VE.RANKS = [
    { name: 'Hamlet', unlock: ['house', 'woodcutter', 'forester', 'quarry', 'sawmill'], quests: [
      { id: 'h1', text: 'Let settlers wear in 8 path tiles', type: 'roads', n: 8, reward: R(15) },
      { id: 'h2', text: 'Build a Woodcutter', type: 'build', b: 'woodcutter', n: 1, reward: R(10, { plank: 4 }) },
      { id: 'h3', text: 'Build a Sawmill', type: 'build', b: 'sawmill', n: 1, reward: R(20) },
      { id: 'h4', text: 'Build a Quarry', type: 'build', b: 'quarry', n: 1, reward: R(10, { plank: 3 }) },
      { id: 'h5', text: 'Build a Forester', type: 'build', b: 'forester', n: 1, reward: R(10) },
      { id: 'h6', text: 'Produce 20 planks', type: 'produce', res: 'plank', n: 20, reward: R(30) },
      { id: 'h7', text: 'Build 2 Cottages', type: 'build', b: 'house', n: 2, reward: R(10, { bread: 6 }) }
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
    { name: 'Market Town', unlock: ['vineyard', 'winery', 'tavern', 'warehouse', 'coalmine', 'ironmine', 'coppermine', 'smelter'], quests: [
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
      { id: 'm11', text: 'Smelt 10 iron bars', type: 'produce', res: 'ironbar', n: 10, reward: R(120) }
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
      { id: 't10', text: 'Smelt 6 gold bars', type: 'produce', res: 'goldbar', n: 6, reward: R(400) }
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
