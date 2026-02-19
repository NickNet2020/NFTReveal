const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

// ─── Game Constants ──────────────────────────────────────────────────
const MAP_SIZE = 4000;
const TICK_RATE = 20; // server ticks per second
const TICK_MS = 1000 / TICK_RATE;
const MAX_GOLD_COINS = 250;
const GOLD_COIN_VALUE_MIN = 3;
const GOLD_COIN_VALUE_MAX = 10;
const VIEW_DISTANCE = 900;
const PLAYER_SPEED = 130;
const PLAYER_HP = 100;
const PLAYER_COLLECT_RADIUS = 36;
const BUILDING_PLACE_DIST = 80;
const MAX_BOTS = 6;
const BOT_THINK_INTERVAL = 1500;

// ─── Unit Type Definitions ──────────────────────────────────────────
const UNIT_TYPES = {
  soldier: {
    hp: 60, damage: 8, speed: 75, range: 38,
    attackSpeed: 1000, cost: 10, pop: 1, xpValue: 10,
    name: 'Foot Soldier'
  },
  horse: {
    hp: 100, damage: 16, speed: 150, range: 42,
    attackSpeed: 900, cost: 30, pop: 2, xpValue: 25,
    name: 'Horse Knight'
  },
  wizard: {
    hp: 40, damage: 30, speed: 55, range: 200,
    attackSpeed: 1800, cost: 50, pop: 2, xpValue: 40,
    name: 'Wizard'
  },
  dragon: {
    hp: 250, damage: 45, speed: 100, range: 80,
    attackSpeed: 1400, cost: 100, pop: 5, xpValue: 80,
    name: 'Dragon'
  }
};

// ─── Building Type Definitions ──────────────────────────────────────
const BUILDING_TYPES = {
  house: { hp: 250, cost: 50, popBonus: 5, size: 48, xpValue: 20, name: 'House' },
  goldmine: { hp: 180, cost: 100, goldPerTick: 0.15, size: 48, xpValue: 30, name: 'Gold Mine' }
};

// ─── Level / XP Definitions ────────────────────────────────────────
const LEVELS = [
  { xp: 0, name: 'Peasant', bonus: null, desc: 'Starting rank' },
  { xp: 100, name: 'Squire', bonus: 'battleCry', desc: 'Battle Cry: +15% troop damage' },
  { xp: 300, name: 'Knight', bonus: 'swiftBoots', desc: 'Swift Boots: +20% troop speed' },
  { xp: 600, name: 'Baron', bonus: 'fortify', desc: 'Fortify: +30% building HP' },
  { xp: 1000, name: 'Earl', bonus: 'warDrums', desc: 'War Drums: +25% damage aura' },
  { xp: 1800, name: 'Duke', bonus: 'goldRush', desc: 'Gold Rush: +50% gold income' },
  { xp: 2800, name: 'Archduke', bonus: 'dragonMight', desc: "Dragon's Might: +35% dragon power" },
  { xp: 4200, name: 'King', bonus: 'ironWill', desc: 'Iron Will: +25% troop HP' },
  { xp: 6500, name: 'Emperor', bonus: 'regen', desc: 'Regeneration: troops heal 2 HP/s' },
  { xp: 10000, name: 'Legend', bonus: 'legendary', desc: 'All bonuses greatly enhanced' }
];

// ─── Decoration Definitions ─────────────────────────────────────────
const TREE_COUNT = 120;
const ROCK_COUNT = 80;
let decorations = [];

function generateDecorations() {
  decorations = [];
  for (let i = 0; i < TREE_COUNT; i++) {
    decorations.push({
      type: 'tree',
      x: randRange(50, MAP_SIZE - 50),
      y: randRange(50, MAP_SIZE - 50),
      variant: Math.floor(Math.random() * 3)
    });
  }
  for (let i = 0; i < ROCK_COUNT; i++) {
    decorations.push({
      type: 'rock',
      x: randRange(50, MAP_SIZE - 50),
      y: randRange(50, MAP_SIZE - 50),
      variant: Math.floor(Math.random() * 3)
    });
  }
}

// ─── Game State ─────────────────────────────────────────────────────
let nextId = 1;
const players = new Map();
const units = new Map();
const buildings = new Map();
let goldCoins = [];
const projectiles = [];
const damageNumbers = [];

// ─── Utility Functions ──────────────────────────────────────────────
function genId() { return nextId++; }
function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }
function angleTo(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
function randRange(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function randName() {
  const titles = ['Lord', 'King', 'Duke', 'Baron', 'Sir', 'Chief', 'Warlord', 'Commander'];
  const names = ['Pixel', 'Storm', 'Blade', 'Shadow', 'Iron', 'Gold', 'Thunder', 'Frost', 'Flame', 'Dark', 'Steel', 'Brave', 'Swift', 'Stone', 'Oak'];
  return titles[Math.floor(Math.random() * titles.length)] + ' ' + names[Math.floor(Math.random() * names.length)];
}

// ─── Level Bonuses Calculator ───────────────────────────────────────
function getLevelBonuses(player) {
  const b = {
    damageMult: 1, speedMult: 1, buildingHpMult: 1,
    goldMult: 1, dragonDamageMult: 1, hpMult: 1, regen: 0
  };
  for (let i = 1; i <= player.level; i++) {
    const lvl = LEVELS[i];
    if (!lvl || !lvl.bonus) continue;
    const legendary = player.level >= 9 ? 1.5 : 1;
    switch (lvl.bonus) {
      case 'battleCry': b.damageMult += 0.15 * legendary; break;
      case 'swiftBoots': b.speedMult += 0.20 * legendary; break;
      case 'fortify': b.buildingHpMult += 0.30 * legendary; break;
      case 'warDrums': b.damageMult += 0.25 * legendary; break;
      case 'goldRush': b.goldMult += 0.50 * legendary; break;
      case 'dragonMight': b.dragonDamageMult += 0.35 * legendary; break;
      case 'ironWill': b.hpMult += 0.25 * legendary; break;
      case 'regen': b.regen = 2 * legendary; break;
    }
  }
  return b;
}

// ─── Update Player Level ────────────────────────────────────────────
function updateLevel(player) {
  let newLevel = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (player.xp >= LEVELS[i].xp) { newLevel = i; break; }
  }
  const prev = player.level;
  player.level = newLevel;
  if (newLevel > prev) return LEVELS[newLevel];
  return null;
}

// ─── Player Factory ─────────────────────────────────────────────────
const TEAM_COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#e67e22','#1abc9c','#e91e63','#00bcd4','#ff5722'];
let colorIndex = 0;

function createPlayer(id, name, isBot = false) {
  const p = {
    id, name: name || randName(),
    x: randRange(300, MAP_SIZE - 300), y: randRange(300, MAP_SIZE - 300),
    vx: 0, vy: 0, speed: PLAYER_SPEED,
    gold: 25, xp: 0, level: 0,
    maxPop: 5, currentPop: 0,
    color: TEAM_COLORS[colorIndex++ % TEAM_COLORS.length],
    hp: PLAYER_HP, maxHp: PLAYER_HP,
    isBot, score: 0,
    lastAttackTime: 0, lastDamageTime: 0,
    input: { x: 0, y: 0 },
    alive: true, respawnTimer: 0
  };
  return p;
}

// ─── Gold Coin Spawning ─────────────────────────────────────────────
function spawnGoldCoins() {
  while (goldCoins.length < MAX_GOLD_COINS) {
    goldCoins.push({
      id: genId(),
      x: randRange(80, MAP_SIZE - 80),
      y: randRange(80, MAP_SIZE - 80),
      value: Math.floor(randRange(GOLD_COIN_VALUE_MIN, GOLD_COIN_VALUE_MAX + 1))
    });
  }
}

// ─── Create Unit ────────────────────────────────────────────────────
function createUnit(ownerId, type, x, y) {
  const def = UNIT_TYPES[type];
  const player = players.get(ownerId);
  if (!player || !def) return null;
  if (player.gold < def.cost) return null;
  if (player.currentPop + def.pop > player.maxPop) return null;

  const bonuses = getLevelBonuses(player);
  const maxHp = Math.floor(def.hp * bonuses.hpMult);

  const unit = {
    id: genId(), ownerId, type,
    x: x + randRange(-30, 30), y: y + randRange(-30, 30),
    vx: 0, vy: 0,
    hp: maxHp, maxHp,
    damage: def.damage, speed: def.speed, range: def.range,
    attackSpeed: def.attackSpeed, cost: def.cost, pop: def.pop,
    lastAttackTime: 0, targetId: null, targetType: null,
    state: 'follow', // follow, attack, idle
    xpValue: def.xpValue
  };

  player.gold -= def.cost;
  player.currentPop += def.pop;
  units.set(unit.id, unit);
  return unit;
}

// ─── Create Building ────────────────────────────────────────────────
function createBuilding(ownerId, type, x, y) {
  const def = BUILDING_TYPES[type];
  const player = players.get(ownerId);
  if (!player || !def) return null;
  if (player.gold < def.cost) return null;

  // Check for nearby buildings collision
  for (const [, b] of buildings) {
    if (dist({ x, y }, b) < 60) return null;
  }

  const bonuses = getLevelBonuses(player);
  const maxHp = Math.floor(def.hp * bonuses.buildingHpMult);

  const building = {
    id: genId(), ownerId, type,
    x, y, hp: maxHp, maxHp,
    size: def.size, xpValue: def.xpValue
  };

  player.gold -= def.cost;
  if (type === 'house') {
    player.maxPop += def.popBonus;
  }
  buildings.set(building.id, building);
  return building;
}

// ─── Find Nearest Enemy ─────────────────────────────────────────────
function findNearestEnemy(unit, searchRange) {
  let nearest = null;
  let nearestDist = searchRange;
  const owner = players.get(unit.ownerId);
  if (!owner) return null;

  // Check enemy units
  for (const [, other] of units) {
    if (other.ownerId === unit.ownerId) continue;
    if (other.hp <= 0) continue;
    const d = dist(unit, other);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = { id: other.id, type: 'unit', x: other.x, y: other.y };
    }
  }

  // Check enemy buildings
  for (const [, b] of buildings) {
    if (b.ownerId === unit.ownerId) continue;
    if (b.hp <= 0) continue;
    const d = dist(unit, b);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = { id: b.id, type: 'building', x: b.x, y: b.y };
    }
  }

  // Check enemy players
  for (const [, p] of players) {
    if (p.id === unit.ownerId) continue;
    if (!p.alive) continue;
    const d = dist(unit, p);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = { id: p.id, type: 'player', x: p.x, y: p.y };
    }
  }

  return nearest;
}

// ─── Combat: Deal Damage ────────────────────────────────────────────
function dealDamage(attacker, targetInfo, player) {
  const bonuses = getLevelBonuses(player);
  let dmg = attacker.damage * bonuses.damageMult;
  if (attacker.type === 'dragon') dmg *= bonuses.dragonDamageMult;
  dmg = Math.floor(dmg);

  let target;
  if (targetInfo.type === 'unit') {
    target = units.get(targetInfo.id);
  } else if (targetInfo.type === 'building') {
    target = buildings.get(targetInfo.id);
  } else if (targetInfo.type === 'player') {
    target = players.get(targetInfo.id);
  }

  if (!target || target.hp <= 0) return;

  target.hp -= dmg;
  if (targetInfo.type === 'player') target.lastDamageTime = Date.now();

  // Create damage number
  damageNumbers.push({
    x: target.x, y: target.y - 20,
    value: dmg, time: Date.now(), ownerId: attacker.ownerId
  });

  // Create projectile for wizards
  if (attacker.type === 'wizard') {
    projectiles.push({
      x: attacker.x, y: attacker.y,
      tx: target.x, ty: target.y,
      speed: 300, time: Date.now(),
      color: '#9b59b6', ownerId: attacker.ownerId
    });
  }

  // Check death
  if (target.hp <= 0) {
    if (targetInfo.type === 'unit') {
      const deadUnit = units.get(targetInfo.id);
      if (deadUnit) {
        const deadOwner = players.get(deadUnit.ownerId);
        if (deadOwner) deadOwner.currentPop -= deadUnit.pop;
        player.xp += deadUnit.xpValue;
        player.score += deadUnit.xpValue;
        units.delete(targetInfo.id);
      }
    } else if (targetInfo.type === 'building') {
      const deadBuilding = buildings.get(targetInfo.id);
      if (deadBuilding) {
        const deadOwner = players.get(deadBuilding.ownerId);
        if (deadOwner && deadBuilding.type === 'house') {
          deadOwner.maxPop -= BUILDING_TYPES.house.popBonus;
          // Remove excess units if over pop
          while (deadOwner.currentPop > deadOwner.maxPop) {
            const ownerUnits = [...units.values()].filter(u => u.ownerId === deadOwner.id);
            if (ownerUnits.length === 0) break;
            const removeUnit = ownerUnits[ownerUnits.length - 1];
            deadOwner.currentPop -= removeUnit.pop;
            units.delete(removeUnit.id);
          }
        }
        player.xp += deadBuilding.xpValue;
        player.score += deadBuilding.xpValue;
        buildings.delete(targetInfo.id);
      }
    } else if (targetInfo.type === 'player') {
      const deadPlayer = players.get(targetInfo.id);
      if (deadPlayer) {
        deadPlayer.alive = false;
        deadPlayer.respawnTimer = Date.now() + 5000;
        player.xp += 50;
        player.score += 50;
        // Transfer some gold
        const stolenGold = Math.floor(deadPlayer.gold * 0.3);
        player.gold += stolenGold;
        deadPlayer.gold -= stolenGold;
      }
    }
    updateLevel(player);
  }
}

// ─── Respawn Player ─────────────────────────────────────────────────
function respawnPlayer(player) {
  player.x = randRange(300, MAP_SIZE - 300);
  player.y = randRange(300, MAP_SIZE - 300);
  player.hp = player.maxHp;
  player.alive = true;
  player.respawnTimer = 0;
}

// ─── Bot AI ─────────────────────────────────────────────────────────
const botTimers = new Map();

function botThink(bot) {
  if (!bot.alive) return;
  const bonuses = getLevelBonuses(bot);

  // Count bot's units and buildings
  const myUnits = [...units.values()].filter(u => u.ownerId === bot.id);
  const myBuildings = [...buildings.values()].filter(b => b.ownerId === bot.id);

  // Priority 1: Collect gold (move toward nearest coin)
  if (bot.gold < 30 || (myUnits.length === 0 && bot.gold < 50)) {
    let nearestCoin = null;
    let nearestDist = Infinity;
    for (const coin of goldCoins) {
      const d = dist(bot, coin);
      if (d < nearestDist) { nearestDist = d; nearestCoin = coin; }
    }
    if (nearestCoin) {
      const a = angleTo(bot, nearestCoin);
      bot.input = { x: Math.cos(a), y: Math.sin(a) };
      return;
    }
  }

  // Priority 2: Build houses if we need more pop
  if (bot.gold >= 50 && bot.maxPop - bot.currentPop < 3 && myBuildings.filter(b => b.type === 'house').length < 6) {
    const bx = bot.x + randRange(-60, 60);
    const by = bot.y + randRange(-60, 60);
    createBuilding(bot.id, 'house', clamp(bx, 50, MAP_SIZE - 50), clamp(by, 50, MAP_SIZE - 50));
  }

  // Priority 3: Build gold mines
  if (bot.gold >= 100 && myBuildings.filter(b => b.type === 'goldmine').length < 3 && Math.random() < 0.3) {
    const bx = bot.x + randRange(-60, 60);
    const by = bot.y + randRange(-60, 60);
    createBuilding(bot.id, 'goldmine', clamp(bx, 50, MAP_SIZE - 50), clamp(by, 50, MAP_SIZE - 50));
  }

  // Priority 4: Buy units
  if (bot.currentPop < bot.maxPop) {
    if (bot.gold >= 100 && bot.level >= 5 && Math.random() < 0.2) {
      createUnit(bot.id, 'dragon', bot.x, bot.y);
    } else if (bot.gold >= 50 && bot.level >= 3 && Math.random() < 0.3) {
      createUnit(bot.id, 'wizard', bot.x, bot.y);
    } else if (bot.gold >= 30 && Math.random() < 0.4) {
      createUnit(bot.id, 'horse', bot.x, bot.y);
    } else if (bot.gold >= 10) {
      createUnit(bot.id, 'soldier', bot.x, bot.y);
    }
  }

  // Priority 5: Roam / attack nearby enemies
  const nearestEnemy = findNearestPlayerOrUnit(bot);
  if (nearestEnemy && myUnits.length >= 3) {
    // Move toward enemy with army
    const a = angleTo(bot, nearestEnemy);
    bot.input = { x: Math.cos(a), y: Math.sin(a) };
  } else {
    // Roam toward gold
    let nearestCoin = null;
    let nearestDist = Infinity;
    for (const coin of goldCoins) {
      const d = dist(bot, coin);
      if (d < nearestDist) { nearestDist = d; nearestCoin = coin; }
    }
    if (nearestCoin) {
      const a = angleTo(bot, nearestCoin);
      bot.input = { x: Math.cos(a), y: Math.sin(a) };
    } else {
      // Random movement
      bot.input = { x: Math.cos(Date.now() / 2000), y: Math.sin(Date.now() / 2000) };
    }
  }
}

function findNearestPlayerOrUnit(bot) {
  let nearest = null;
  let nearestDist = 500;
  for (const [, p] of players) {
    if (p.id === bot.id || !p.alive) continue;
    const d = dist(bot, p);
    if (d < nearestDist) { nearestDist = d; nearest = p; }
  }
  return nearest;
}

// ─── Main Game Tick ─────────────────────────────────────────────────
function gameTick() {
  const now = Date.now();
  const dt = 1 / TICK_RATE;

  // Respawn dead players
  for (const [, player] of players) {
    if (!player.alive && player.respawnTimer && now >= player.respawnTimer) {
      respawnPlayer(player);
    }
  }

  // Run bot AI
  for (const [id, player] of players) {
    if (player.isBot && player.alive) {
      const timer = botTimers.get(id) || 0;
      if (now >= timer) {
        botThink(player);
        botTimers.set(id, now + BOT_THINK_INTERVAL + Math.random() * 500);
      }
    }
  }

  // Move players
  for (const [, player] of players) {
    if (!player.alive) continue;
    const ix = player.input.x || 0;
    const iy = player.input.y || 0;
    const mag = Math.sqrt(ix * ix + iy * iy);
    if (mag > 0) {
      player.vx = (ix / mag) * player.speed;
      player.vy = (iy / mag) * player.speed;
    } else {
      player.vx *= 0.85;
      player.vy *= 0.85;
    }
    player.x = clamp(player.x + player.vx * dt, 20, MAP_SIZE - 20);
    player.y = clamp(player.y + player.vy * dt, 20, MAP_SIZE - 20);

    // Player hp regen when not in combat
    if (now - player.lastDamageTime > 5000 && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + 0.5);
    }
  }

  // Collect gold coins
  for (const [, player] of players) {
    if (!player.alive) continue;
    const bonuses = getLevelBonuses(player);
    for (let i = goldCoins.length - 1; i >= 0; i--) {
      const coin = goldCoins[i];
      if (dist(player, coin) < PLAYER_COLLECT_RADIUS) {
        const goldValue = Math.floor(coin.value * bonuses.goldMult);
        player.gold += goldValue;
        player.xp += Math.ceil(goldValue / 2);
        player.score += goldValue;
        goldCoins.splice(i, 1);
        updateLevel(player);
      }
    }
  }

  // Gold mine income
  for (const [, building] of buildings) {
    if (building.type === 'goldmine' && building.hp > 0) {
      const owner = players.get(building.ownerId);
      if (owner) {
        const bonuses = getLevelBonuses(owner);
        owner.gold += BUILDING_TYPES.goldmine.goldPerTick * bonuses.goldMult;
      }
    }
  }

  // Move units
  for (const [, unit] of units) {
    if (unit.hp <= 0) continue;
    const owner = players.get(unit.ownerId);
    if (!owner) continue;

    const bonuses = getLevelBonuses(owner);
    const moveSpeed = unit.speed * bonuses.speedMult;

    // Regeneration
    if (bonuses.regen > 0 && unit.hp < unit.maxHp) {
      unit.hp = Math.min(unit.maxHp, unit.hp + bonuses.regen * dt);
    }

    // Find nearest enemy if no target or target dead
    let target = null;
    if (unit.targetId) {
      if (unit.targetType === 'unit') target = units.get(unit.targetId);
      else if (unit.targetType === 'building') target = buildings.get(unit.targetId);
      else if (unit.targetType === 'player') target = players.get(unit.targetId);
      if (target && (target.hp <= 0 || (target.alive === false))) target = null;
    }

    if (!target) {
      const enemy = findNearestEnemy(unit, 350);
      if (enemy) {
        unit.targetId = enemy.id;
        unit.targetType = enemy.type;
        unit.state = 'attack';
      } else {
        unit.state = 'follow';
        unit.targetId = null;
        unit.targetType = null;
      }
    }

    if (unit.state === 'attack' && unit.targetId) {
      let targetPos;
      if (unit.targetType === 'unit') targetPos = units.get(unit.targetId);
      else if (unit.targetType === 'building') targetPos = buildings.get(unit.targetId);
      else if (unit.targetType === 'player') targetPos = players.get(unit.targetId);

      if (targetPos && targetPos.hp > 0 && (targetPos.alive !== false)) {
        const d = dist(unit, targetPos);
        if (d > unit.range) {
          // Move toward target
          const a = angleTo(unit, targetPos);
          unit.x += Math.cos(a) * moveSpeed * dt;
          unit.y += Math.sin(a) * moveSpeed * dt;
        } else {
          // Attack
          if (now - unit.lastAttackTime >= unit.attackSpeed) {
            unit.lastAttackTime = now;
            dealDamage(unit, { id: unit.targetId, type: unit.targetType }, owner);
          }
        }
      } else {
        unit.state = 'follow';
        unit.targetId = null;
      }
    }

    if (unit.state === 'follow' && owner.alive) {
      // Follow owner in formation
      const targetDist = 60 + Math.random() * 20;
      const d = dist(unit, owner);
      if (d > targetDist) {
        const a = angleTo(unit, owner);
        const speed = d > 200 ? moveSpeed * 1.5 : moveSpeed;
        unit.x += Math.cos(a) * speed * dt;
        unit.y += Math.sin(a) * speed * dt;
      }
    }

    unit.x = clamp(unit.x, 10, MAP_SIZE - 10);
    unit.y = clamp(unit.y, 10, MAP_SIZE - 10);
  }

  // Update projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    if (now - projectiles[i].time > 500) {
      projectiles.splice(i, 1);
    }
  }

  // Clean up damage numbers
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    if (now - damageNumbers[i].time > 1200) {
      damageNumbers.splice(i, 1);
    }
  }

  // Respawn gold
  spawnGoldCoins();

  // Maintain bot count
  const botCount = [...players.values()].filter(p => p.isBot).length;
  const humanCount = [...players.values()].filter(p => !p.isBot).length;
  const targetBots = Math.max(2, MAX_BOTS - humanCount);
  if (botCount < targetBots) {
    const botId = 'bot_' + genId();
    const bot = createPlayer(botId, randName(), true);
    bot.gold = 50;
    players.set(botId, bot);
  }

  // ─── Send State to Clients ─────────────────────────────────────
  for (const [socketId, player] of players) {
    if (player.isBot) continue;

    // Only send nearby entities
    const nearbyPlayers = [];
    for (const [, p] of players) {
      if (dist(player, p) < VIEW_DISTANCE * 1.5 || p.id === player.id) {
        nearbyPlayers.push({
          id: p.id, name: p.name,
          x: Math.round(p.x), y: Math.round(p.y),
          hp: Math.round(p.hp), maxHp: p.maxHp,
          level: p.level, color: p.color,
          alive: p.alive, isBot: p.isBot,
          vx: Math.round(p.vx), vy: Math.round(p.vy)
        });
      }
    }

    const nearbyUnits = [];
    for (const [, u] of units) {
      if (dist(player, u) < VIEW_DISTANCE * 1.5) {
        nearbyUnits.push({
          id: u.id, ownerId: u.ownerId, type: u.type,
          x: Math.round(u.x), y: Math.round(u.y),
          hp: Math.round(u.hp), maxHp: u.maxHp,
          state: u.state
        });
      }
    }

    const nearbyBuildings = [];
    for (const [, b] of buildings) {
      if (dist(player, b) < VIEW_DISTANCE * 1.5) {
        nearbyBuildings.push({
          id: b.id, ownerId: b.ownerId, type: b.type,
          x: Math.round(b.x), y: Math.round(b.y),
          hp: Math.round(b.hp), maxHp: b.maxHp
        });
      }
    }

    const nearbyCoins = [];
    for (const coin of goldCoins) {
      if (dist(player, coin) < VIEW_DISTANCE * 1.2) {
        nearbyCoins.push({ id: coin.id, x: Math.round(coin.x), y: Math.round(coin.y), value: coin.value });
      }
    }

    const nearbyProjectiles = projectiles
      .filter(p => dist(player, p) < VIEW_DISTANCE)
      .map(p => ({ x: Math.round(p.x), y: Math.round(p.y), tx: Math.round(p.tx), ty: Math.round(p.ty), color: p.color, time: p.time }));

    const nearbyDmgNums = damageNumbers
      .filter(d => dist(player, d) < VIEW_DISTANCE)
      .map(d => ({ x: Math.round(d.x), y: Math.round(d.y), value: d.value, time: d.time }));

    // All buildings/players for minimap
    const minimapData = [];
    for (const [, p] of players) {
      if (p.alive) minimapData.push({ x: p.x, y: p.y, color: p.color, type: 'player' });
    }
    for (const [, b] of buildings) {
      minimapData.push({ x: b.x, y: b.y, color: players.get(b.ownerId)?.color || '#888', type: 'building' });
    }

    // Leaderboard
    const leaderboard = [...players.values()]
      .filter(p => p.alive || p.isBot)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(p => ({ name: p.name, score: p.score, color: p.color, id: p.id }));

    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('state', {
        self: {
          id: player.id, x: Math.round(player.x), y: Math.round(player.y),
          gold: Math.floor(player.gold), xp: player.xp, level: player.level,
          maxPop: player.maxPop, currentPop: player.currentPop,
          hp: Math.round(player.hp), maxHp: player.maxHp,
          alive: player.alive, score: player.score, color: player.color, name: player.name,
          levelName: LEVELS[player.level]?.name || 'Peasant'
        },
        players: nearbyPlayers,
        units: nearbyUnits,
        buildings: nearbyBuildings,
        goldCoins: nearbyCoins,
        projectiles: nearbyProjectiles,
        damageNumbers: nearbyDmgNums,
        minimap: minimapData,
        leaderboard,
        mapSize: MAP_SIZE
      });
    }
  }
}

// ─── Socket.IO Connection Handler ───────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('join', (data) => {
    const player = createPlayer(socket.id, data.name);
    players.set(socket.id, player);

    socket.emit('joined', {
      id: socket.id,
      mapSize: MAP_SIZE,
      unitTypes: UNIT_TYPES,
      buildingTypes: BUILDING_TYPES,
      levels: LEVELS,
      decorations
    });

    console.log(`${player.name} joined the game`);
  });

  socket.on('input', (data) => {
    const player = players.get(socket.id);
    if (player && player.alive) {
      player.input = { x: data.x || 0, y: data.y || 0 };
    }
  });

  socket.on('build', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.alive) return;
    const bType = data.type;
    if (!BUILDING_TYPES[bType]) return;
    const result = createBuilding(socket.id, bType, data.x, data.y);
    if (result) {
      socket.emit('buildResult', { success: true, type: bType });
    } else {
      socket.emit('buildResult', { success: false, type: bType, reason: 'Cannot build here or insufficient gold' });
    }
  });

  socket.on('buyUnit', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.alive) return;
    const uType = data.type;
    if (!UNIT_TYPES[uType]) return;
    const result = createUnit(socket.id, uType, player.x, player.y);
    if (result) {
      socket.emit('unitResult', { success: true, type: uType });
    } else {
      socket.emit('unitResult', { success: false, type: uType, reason: 'Insufficient gold or population' });
    }
  });

  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player) {
      // Remove player's units
      for (const [id, unit] of units) {
        if (unit.ownerId === socket.id) units.delete(id);
      }
      // Remove player's buildings
      for (const [id, building] of buildings) {
        if (building.ownerId === socket.id) buildings.delete(id);
      }
      players.delete(socket.id);
      console.log(`${player.name} disconnected`);
    }
  });
});

// ─── Initialize and Start ───────────────────────────────────────────
generateDecorations();
spawnGoldCoins();

// Spawn initial bots
for (let i = 0; i < MAX_BOTS; i++) {
  const botId = 'bot_' + genId();
  const bot = createPlayer(botId, randName(), true);
  bot.gold = 40 + Math.floor(Math.random() * 30);
  players.set(botId, bot);
}

setInterval(gameTick, TICK_MS);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ⚔️  Lordz.io Replica running on http://0.0.0.0:${PORT}\n`);
});
