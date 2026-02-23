const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { CHARACTERS, COMBAT_MODIFIERS, CAN_HIT_FLYING, CASTLE_DEF, GAME_CONSTANTS } = require('./public/js/characters.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

const GC = GAME_CONSTANTS;
const TICK_MS = 1000 / GC.TICK_RATE;
const BOT_MATCH_DELAY = 4000;

let nextId = 1;
const matchQueue = [];
const gameRooms = new Map();
const playerRooms = new Map();

function genId() { return nextId++; }
function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }
function angleTo(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ═══════════════════════════════════════════════════════════════════════
// Map Decorations
// ═══════════════════════════════════════════════════════════════════════
function generateDecorations() {
  const decorations = [];
  const midMinX = GC.P1_BASE_MAX_X + 20;
  const midMaxX = GC.P2_BASE_MIN_X - 20;
  const topLaneHi = GC.LANE_TOP_Y + GC.LANE_WIDTH / 2 + 15;
  const botLaneLo = GC.LANE_BOT_Y - GC.LANE_WIDTH / 2 - 15;
  const topLaneLo = GC.LANE_TOP_Y - GC.LANE_WIDTH / 2 - 15;
  const botLaneHi = GC.LANE_BOT_Y + GC.LANE_WIDTH / 2 + 15;

  // Trees between lanes in the middle (the grassy wilderness)
  for (let i = 0; i < 50; i++) {
    const x = midMinX + Math.random() * (midMaxX - midMinX);
    const y = topLaneHi + Math.random() * (botLaneLo - topLaneHi);
    decorations.push({ type: 'tree', x, y, variant: Math.floor(Math.random() * 4), scale: 0.7 + Math.random() * 0.6 });
  }
  // Trees north of top lane (middle only)
  for (let i = 0; i < 15; i++) {
    const x = midMinX + Math.random() * (midMaxX - midMinX);
    const y = 20 + Math.random() * Math.max(10, topLaneLo - 40);
    decorations.push({ type: 'tree', x, y, variant: Math.floor(Math.random() * 4), scale: 0.7 + Math.random() * 0.6 });
  }
  // Trees south of bottom lane (middle only)
  for (let i = 0; i < 15; i++) {
    const x = midMinX + Math.random() * (midMaxX - midMinX);
    const y = botLaneHi + Math.random() * (GC.MAP_HEIGHT - botLaneHi - 20);
    decorations.push({ type: 'tree', x, y, variant: Math.floor(Math.random() * 4), scale: 0.7 + Math.random() * 0.6 });
  }
  // Rocks in grassy middle areas only
  for (let i = 0; i < 30; i++) {
    const x = midMinX + Math.random() * (midMaxX - midMinX);
    const y = Math.random() * GC.MAP_HEIGHT;
    if (Math.abs(y - GC.LANE_TOP_Y) < GC.LANE_WIDTH / 2 + 20) continue;
    if (Math.abs(y - GC.LANE_BOT_Y) < GC.LANE_WIDTH / 2 + 20) continue;
    decorations.push({ type: 'rock', x, y, variant: Math.floor(Math.random() * 3), scale: 0.5 + Math.random() * 0.5 });
  }
  return decorations;
}

const sharedDecorations = generateDecorations();

// ═══════════════════════════════════════════════════════════════════════
// Fog of War
// ═══════════════════════════════════════════════════════════════════════
function isVisibleTo(room, side, wx, wy) {
  // Home territory is always fully visible — no fog of war in your own base
  if (side === 'left' && wx <= GC.P1_BASE_MAX_X) return true;
  if (side === 'right' && wx >= GC.P2_BASE_MIN_X) return true;

  const castle = getCastle(room, side);
  if (dist({ x: wx, y: wy }, castle) < GC.FOG_CASTLE_RANGE) return true;

  for (const [, b] of room.buildings) {
    if (b.side !== side || b.hp <= 0) continue;
    if (dist({ x: wx, y: wy }, b) < GC.FOG_BUILDING_RANGE) return true;
  }

  for (const [, u] of room.units) {
    if (u.side !== side) continue;
    if (dist({ x: wx, y: wy }, u) < GC.FOG_UNIT_RANGE) return true;
  }

  const hero = side === 'left' ? room.hero1 : room.hero2;
  if (hero && hero.hp > 0 && dist({ x: wx, y: wy }, hero) < GC.FOG_HERO_RANGE) return true;

  return false;
}

// ═══════════════════════════════════════════════════════════════════════
// Game Room
// ═══════════════════════════════════════════════════════════════════════
function createGameRoom(p1Socket, p1Char, p2Socket, p2Char, p2IsBot = false) {
  const roomId = 'room_' + genId();
  const charData1 = CHARACTERS[p1Char];
  const charData2 = CHARACTERS[p2Char];

  const room = {
    id: roomId,
    state: 'playing',
    startTime: Date.now(),
    lastIncomeTime: Date.now(),

    player1: {
      socketId: p1Socket ? p1Socket.id : null,
      characterId: p1Char,
      character: charData1,
      gold: GC.STARTING_GOLD,
      income: GC.BASE_INCOME,
      side: 'left',
      rescueStrikeUsed: false,
      isBot: false,
      name: p1Socket ? (p1Socket.playerName || 'Player 1') : 'Player 1',
      kills: 0,
      coreFoundations: 1
    },
    player2: {
      socketId: p2Socket ? p2Socket.id : null,
      characterId: p2Char,
      character: charData2,
      gold: GC.STARTING_GOLD,
      income: GC.BASE_INCOME,
      side: 'right',
      rescueStrikeUsed: false,
      isBot: p2IsBot,
      name: p2IsBot ? 'AI Commander' : (p2Socket ? (p2Socket.playerName || 'Player 2') : 'Player 2'),
      kills: 0,
      coreFoundations: 1
    },

    castle1: { id: genId(), x: GC.P1_CASTLE_X, y: GC.CASTLE_Y, hp: GC.CASTLE_HP, maxHp: GC.CASTLE_HP, side: 'left' },
    castle2: { id: genId(), x: GC.P2_CASTLE_X, y: GC.CASTLE_Y, hp: GC.CASTLE_HP, maxHp: GC.CASTLE_HP, side: 'right' },

    // Heroes
    hero1: createHero(charData1, 'left', GC.P1_CASTLE_X + 60, GC.CASTLE_Y),
    hero2: createHero(charData2, 'right', GC.P2_CASTLE_X - 60, GC.CASTLE_Y),

    // Generals — DISABLED (code preserved)
    // general1: createGeneral(charData1, 'left', GC.P1_CASTLE_X + 40, GC.CASTLE_Y - 60),
    // general2: createGeneral(charData2, 'right', GC.P2_CASTLE_X - 40, GC.CASTLE_Y - 60),
    general1: null,
    general2: null,

    units: new Map(),
    buildings: new Map(),
    projectiles: [],
    damageNumbers: [],
    effects: [],

    botState: p2IsBot ? { nextBuildTime: Date.now() + 3000, phase: 'early', heroMoveTime: 0 } : null,
    winner: null,
    winTime: null,

    outposts: {
      north: { x: GC.MAP_WIDTH / 2, y: GC.LANE_TOP_Y - 80, lane: 'top', controlledBy: null, captureProgress: { left: 0, right: 0 } },
      south: { x: GC.MAP_WIDTH / 2, y: GC.LANE_BOT_Y + 80, lane: 'bottom', controlledBy: null, captureProgress: { left: 0, right: 0 } }
    }
  };

  applyPassives(room);
  gameRooms.set(roomId, room);

  if (p1Socket) { playerRooms.set(p1Socket.id, roomId); p1Socket.join(roomId); }
  if (p2Socket && !p2IsBot) { playerRooms.set(p2Socket.id, roomId); p2Socket.join(roomId); }

  const startData = {
    roomId, mapWidth: GC.MAP_WIDTH, mapHeight: GC.MAP_HEIGHT,
    decorations: sharedDecorations, characters: CHARACTERS, constants: GC
  };

  if (p1Socket) {
    p1Socket.emit('gameStart', {
      ...startData, side: 'left', yourCharacter: p1Char, opponentCharacter: p2Char,
      opponentName: room.player2.name
    });
  }
  if (p2Socket && !p2IsBot) {
    p2Socket.emit('gameStart', {
      ...startData, side: 'right', yourCharacter: p2Char, opponentCharacter: p1Char,
      opponentName: room.player1.name
    });
  }

  console.log(`Game room ${roomId}: ${room.player1.name} (${p1Char}) vs ${room.player2.name} (${p2Char})`);
  return room;
}

function createHero(charData, side, x, y) {
  if (!charData || !charData.hero) return null;
  const h = charData.hero;
  return {
    id: genId(),
    typeId: h.id,
    unitType: h.type,
    side,
    characterId: charData.id,
    x, y,
    hp: h.hp, maxHp: h.hp,
    damage: h.damage,
    speed: h.speed,
    range: h.range,
    attackSpeed: h.attackSpeed,
    lastAttackTime: 0,
    targetId: null,
    targetType: null,
    moveTargetX: null,
    moveTargetY: null,
    state: 'idle',
    isHero: true,
    name: h.name,
    activated: false
  };
}

function createGeneral(charData, side, x, y) {
  const genDef = charData.general || {};
  return {
    id: genId(),
    typeId: 'general',
    unitType: 'infantry',
    side,
    characterId: charData.id,
    x, y,
    hp: GC.GENERAL_HP, maxHp: GC.GENERAL_HP,
    damage: GC.GENERAL_DAMAGE,
    speed: GC.GENERAL_SPEED,
    range: GC.GENERAL_RANGE,
    attackSpeed: GC.GENERAL_ATTACK_SPEED,
    lastAttackTime: 0,
    targetId: null,
    targetType: null,
    moveTargetX: null,
    moveTargetY: null,
    state: 'idle',
    isGeneral: true,
    name: genDef.name || 'General',
    xp: 0,
    rank: 0,
    baseDamage: GC.GENERAL_DAMAGE,
    baseAttackSpeed: GC.GENERAL_ATTACK_SPEED,
    baseMaxHp: GC.GENERAL_HP,
    auraRange: GC.GENERAL_AURA_RANGE,
    activated: false
  };
}

function applyPassives(room) {}

function getPlayerData(room, side) { return side === 'left' ? room.player1 : room.player2; }
function getEnemyData(room, side) { return side === 'left' ? room.player2 : room.player1; }
function getCastle(room, side) { return side === 'left' ? room.castle1 : room.castle2; }
function getEnemyCastle(room, side) { return side === 'left' ? room.castle2 : room.castle1; }
function getHero(room, side) { return side === 'left' ? room.hero1 : room.hero2; }

function getOutpostBuffs(room, side) {
  if (!room.outposts) return { attackSpeedMult: 1.0, damageReduction: 0 };
  let count = 0;
  if (room.outposts.north.controlledBy === side) count++;
  if (room.outposts.south.controlledBy === side) count++;
  return {
    attackSpeedMult: count >= 1 ? 0.9 : 1.0,
    damageReduction: count >= 2 ? 0.1 : 0
  };
}

function updateOutposts(room, dt) {
  const laneHalfW = GC.LANE_WIDTH / 2 + 50;
  const outpostEntries = [room.outposts.north, room.outposts.south];

  for (const outpost of outpostEntries) {
    const laneY = outpost.lane === 'top' ? GC.LANE_TOP_Y : GC.LANE_BOT_Y;

    let leftPast = false;
    let rightPast = false;

    for (const [, unit] of room.units) {
      if (unit.hp <= 0) continue;
      if (Math.abs(unit.y - laneY) > laneHalfW) continue;
      if (unit.side === 'left' && unit.x > outpost.x) leftPast = true;
      if (unit.side === 'right' && unit.x < outpost.x) rightPast = true;
    }

    // Left capture progress
    if (leftPast && outpost.controlledBy !== 'left') {
      outpost.captureProgress.left = Math.min(10, outpost.captureProgress.left + dt);
      if (outpost.captureProgress.left >= 10) {
        outpost.controlledBy = 'left';
        outpost.captureProgress.right = 0;
      }
    } else if (!leftPast) {
      outpost.captureProgress.left = Math.max(0, outpost.captureProgress.left - dt * 2);
    }

    // Right capture progress
    if (rightPast && outpost.controlledBy !== 'right') {
      outpost.captureProgress.right = Math.min(10, outpost.captureProgress.right + dt);
      if (outpost.captureProgress.right >= 10) {
        outpost.controlledBy = 'right';
        outpost.captureProgress.left = 0;
      }
    } else if (!rightPast) {
      outpost.captureProgress.right = Math.max(0, outpost.captureProgress.right - dt * 2);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Building Placement
// ═══════════════════════════════════════════════════════════════════════
function canPlaceBuilding(room, side, x, y) {
  if (side === 'left') {
    if (x < GC.P1_BASE_MIN_X || x > GC.P1_BASE_MAX_X) return false;
  } else {
    if (x < GC.P2_BASE_MIN_X || x > GC.P2_BASE_MAX_X) return false;
  }
  if (y < GC.BASE_MIN_Y || y > GC.BASE_MAX_Y) return false;
  for (const [, b] of room.buildings) {
    if (dist({ x, y }, b) < GC.BUILDING_GRID_SIZE) return false;
  }
  if (dist({ x, y }, getCastle(room, side)) < 120) return false;
  return true;
}

function placeBuilding(room, side, buildingTypeId, x, y) {
  const playerData = getPlayerData(room, side);
  const charData = playerData.character;
  const buildingDef = charData.buildings.find(b => b.id === buildingTypeId);
  if (!buildingDef) return { success: false, reason: 'Invalid building type' };
  if (playerData.gold < buildingDef.cost) return { success: false, reason: 'Not enough gold' };

  const gx = Math.round(x / GC.BUILDING_GRID_SIZE) * GC.BUILDING_GRID_SIZE;
  const gy = Math.round(y / GC.BUILDING_GRID_SIZE) * GC.BUILDING_GRID_SIZE;
  if (!canPlaceBuilding(room, side, gx, gy)) return { success: false, reason: 'Cannot build here' };

  let hp = buildingDef.hp;
  if (charData.passive.type === 'building_hp') hp = Math.floor(hp * (1 + charData.passive.value));

  const building = {
    id: genId(), typeId: buildingTypeId, side, x: gx, y: gy,
    hp, maxHp: hp,
    income: buildingDef.income,
    isTower: buildingDef.isTower || false,
    towerDamage: buildingDef.towerDamage || 0,
    towerRange: buildingDef.towerRange || 0,
    towerAttackSpeed: buildingDef.towerAttackSpeed || 0,
    lastTowerAttack: 0,
    spawnInterval: GC.BASE_SPAWN_INTERVAL,
    unitType: buildingDef.unit || null,
    lastSpawnTime: Date.now(),
    constructionTime: Date.now(),
    constructed: false,
    constructionDuration: 2000,
    characterId: playerData.characterId,
    level: 1
  };

  if (!building.isTower && charData.passive.type === 'spawn_speed') {
    building.spawnInterval = Math.floor(building.spawnInterval * (1 - charData.passive.value));
  }

  playerData.gold -= buildingDef.cost;

  let incomeBonus = buildingDef.income;
  if (charData.passive.type === 'building_income') incomeBonus = Math.floor(incomeBonus * (1 + charData.passive.value));
  playerData.income += incomeBonus;

  room.buildings.set(building.id, building);
  room.effects.push({ type: 'construction', x: gx, y: gy, time: Date.now(), duration: 2000 });
  return { success: true, building };
}

// ═══════════════════════════════════════════════════════════════════════
// Unit Spawning
// ═══════════════════════════════════════════════════════════════════════
function spawnUnitFromBuilding(room, building) {
  const playerData = getPlayerData(room, building.side);
  const charData = playerData.character;
  const unitDef = charData.units.find(u => u.id === building.unitType);
  if (!unitDef) return;

  const midY = (GC.LANE_TOP_Y + GC.LANE_BOT_Y) / 2;
  const lane = building.y < midY ? 'top' : 'bottom';
  const laneY = lane === 'top' ? GC.LANE_TOP_Y : GC.LANE_BOT_Y;

  let damage = unitDef.damage;
  if (charData.passive.type === 'unit_damage') damage = Math.floor(damage * (1 + charData.passive.value));

  const unit = {
    id: genId(), typeId: unitDef.id, unitType: unitDef.type, side: building.side,
    characterId: playerData.characterId,
    x: building.x + (building.side === 'left' ? 30 : -30), y: building.y,
    hp: unitDef.hp, maxHp: unitDef.hp, damage, speed: unitDef.speed,
    range: unitDef.range, attackSpeed: unitDef.attackSpeed, lastAttackTime: 0,
    targetId: null, targetType: null,
    state: 'marching', lane, laneY, reachedLane: false, spawnTime: Date.now(),
    onLane: false,
    xp: 0, rank: 0,
    baseDamage: damage, baseAttackSpeed: unitDef.attackSpeed, baseMaxHp: unitDef.hp
  };

  // Apply building level multipliers
  if (building.level >= 2) {
    const hpMult = building.level === 3 ? GC.L3_HP_MULT : GC.L2_HP_MULT;
    const dmgMult = building.level === 3 ? GC.L3_DMG_MULT : GC.L2_DMG_MULT;
    unit.hp = Math.floor(unit.hp * hpMult);
    unit.maxHp = Math.floor(unit.maxHp * hpMult);
    unit.damage = Math.floor(unit.damage * dmgMult);
    unit.baseDamage = unit.damage;
    unit.baseMaxHp = unit.maxHp;
    unit.unitLevel = building.level;
  } else {
    unit.unitLevel = 1;
  }

  // Unit passives based on level
  if (building.level >= 2) {
    const passives = {};
    if (unit.unitType === 'infantry') passives.damageReduction = building.level === 3 ? 0.20 : 0.10;
    else if (unit.unitType === 'ranged') passives.attackSpeedBonus = building.level === 3 ? 0.25 : 0.15;
    else if (unit.unitType === 'cavalry') passives.firstStrikeMult = building.level === 3 ? 2.0 : 1.5;
    else if (unit.unitType === 'siege') passives.damageReduction = building.level === 3 ? 0.30 : 0.20;
    else if (unit.unitType === 'flying') passives.dodgeChance = building.level === 3 ? 0.20 : 0.10;
    unit.passives = passives;

    // Apply attack speed bonus for ranged immediately
    if (passives.attackSpeedBonus) {
      unit.attackSpeed = Math.max(200, Math.floor(unit.attackSpeed * (1 - passives.attackSpeedBonus)));
      unit.baseAttackSpeed = unit.attackSpeed;
    }
  }

  room.units.set(unit.id, unit);
}

// ═══════════════════════════════════════════════════════════════════════
// Building Upgrade System
// ═══════════════════════════════════════════════════════════════════════
function upgradeBuilding(room, side, buildingId) {
  const playerData = getPlayerData(room, side);
  const charData = playerData.character;
  const building = room.buildings.get(buildingId);
  if (!building || building.side !== side || !building.constructed || building.isTower) {
    return { success: false, reason: 'Cannot upgrade this building' };
  }

  const bDef = charData.buildings.find(b => b.id === building.typeId);
  if (!bDef) return { success: false, reason: 'Invalid building' };

  if (building.level >= 3) return { success: false, reason: 'Already max level' };

  const targetLevel = building.level + 1;

  if (targetLevel === 3) {
    // L3 requires l3Eligible check and core foundation
    if (!charData.l3Eligible || !charData.l3Eligible.includes(building.typeId)) {
      return { success: false, reason: 'This building cannot reach Level 3' };
    }
    if (playerData.coreFoundations <= 0) {
      return { success: false, reason: 'Requires a Core Foundation' };
    }
  }

  const upgradeCost = targetLevel === 2
    ? Math.floor(bDef.cost * GC.L2_COST_MULT)
    : Math.floor(bDef.cost * GC.L3_COST_MULT);

  if (playerData.gold < upgradeCost) {
    return { success: false, reason: 'Not enough gold' };
  }

  playerData.gold -= upgradeCost;
  if (targetLevel === 3) playerData.coreFoundations--;

  building.level = targetLevel;
  // Upgrade spawn interval
  building.spawnInterval = targetLevel >= 2 ? GC.L2_SPAWN_INTERVAL : GC.BASE_SPAWN_INTERVAL;
  if (charData.passive.type === 'spawn_speed') {
    building.spawnInterval = Math.floor(building.spawnInterval * (1 - charData.passive.value));
  }

  // Boost building HP
  const hpMult = targetLevel === 3 ? 1.5 : 1.25;
  building.maxHp = Math.floor(building.maxHp * hpMult);
  building.hp = building.maxHp;

  return { success: true, level: targetLevel };
}

// ═══════════════════════════════════════════════════════════════════════
// Combat System
// ═══════════════════════════════════════════════════════════════════════
function getDamageMultiplier(attackerType, defenderType) {
  if (COMBAT_MODIFIERS[attackerType] && COMBAT_MODIFIERS[attackerType][defenderType] !== undefined) {
    return COMBAT_MODIFIERS[attackerType][defenderType];
  }
  return 1.0;
}

function canAttackTarget(attackerUnitType, targetUnitType) {
  if (targetUnitType === 'flying') return CAN_HIT_FLYING[attackerUnitType] || false;
  return true;
}

// Find the nearest reachable enemy. Lane-aware: units in the middle can only target
// enemies on the same lane or in home territories.
function findTarget(room, unit) {
  let nearest = null;
  let nearestDist = Infinity;
  const enemySide = unit.side === 'left' ? 'right' : 'left';
  const inMiddle = unit.x > GC.P1_BASE_MAX_X && unit.x < GC.P2_BASE_MIN_X;
  const laneReach = GC.LANE_WIDTH / 2 + 50;

  // Flying units are unrestricted
  const isFlying = unit.unitType === 'flying';
  // Units can only detect enemies within visual range (fog of war awareness)
  const detRange = GC.UNIT_DETECTION_RANGE;

  function isReachable(t) {
    if (isFlying || !inMiddle) return true;
    // Target in a home territory — always reachable by marching forward
    if (t.x <= GC.P1_BASE_MAX_X || t.x >= GC.P2_BASE_MIN_X) return true;
    // Target in middle — must be on same lane
    return Math.abs(t.y - unit.laneY) <= laneReach;
  }

  for (const [, other] of room.units) {
    if (other.side === unit.side || other.hp <= 0) continue;
    if (!canAttackTarget(unit.unitType, other.unitType)) continue;
    if (!isReachable(other)) continue;
    const d = dist(unit, other);
    if (d > detRange) continue; // Can't see beyond detection range
    if (d < nearestDist) { nearestDist = d; nearest = { id: other.id, type: 'unit' }; }
  }

  const enemyHero = getHero(room, enemySide);
  if (enemyHero && enemyHero.hp > 0 && isReachable(enemyHero) && canAttackTarget(unit.unitType, enemyHero.unitType || 'infantry')) {
    const d = dist(unit, enemyHero);
    if (d <= detRange && d < nearestDist) { nearestDist = d; nearest = { id: enemyHero.id, type: 'hero' }; }
  }

  for (const [, b] of room.buildings) {
    if (b.side === unit.side || b.hp <= 0) continue;
    const d = dist(unit, b);
    if (d < nearestDist) { nearestDist = d; nearest = { id: b.id, type: 'building' }; }
  }

  const enemyCastle = getEnemyCastle(room, unit.side);
  if (enemyCastle.hp > 0) {
    const d = dist(unit, enemyCastle);
    if (d < nearestDist) { nearestDist = d; nearest = { id: enemyCastle.id, type: 'castle' }; }
  }

  return nearest;
}

function getTargetPos(room, targetInfo) {
  if (targetInfo.type === 'unit') return room.units.get(targetInfo.id);
  if (targetInfo.type === 'building') return room.buildings.get(targetInfo.id);
  if (targetInfo.type === 'hero') {
    if (room.hero1 && room.hero1.id === targetInfo.id) return room.hero1;
    if (room.hero2 && room.hero2.id === targetInfo.id) return room.hero2;
  }
  if (targetInfo.type === 'castle') {
    return targetInfo.id === room.castle1.id ? room.castle1 : room.castle2;
  }
  return null;
}

function dealDamage(room, attacker, targetInfo, isHero) {
  const playerData = getPlayerData(room, attacker.side);
  const charData = playerData.character;
  let target = getTargetPos(room, targetInfo);
  if (!target || target.hp <= 0) return;

  let defenderType = 'building';
  if (targetInfo.type === 'unit') defenderType = target.unitType;
  else if (targetInfo.type === 'hero') defenderType = target.unitType;
  else if (targetInfo.type === 'castle') defenderType = 'castle';

  let dmg = attacker.damage;
  if (!isHero) {
    dmg *= getDamageMultiplier(attacker.unitType, defenderType);
    if (charData.passive.type === 'siege_building_damage' && attacker.unitType === 'siege' &&
        (defenderType === 'building' || defenderType === 'castle')) {
      dmg *= (1 + charData.passive.value);
    }
  } else {
    // Heroes deal full damage to everything
    dmg *= 1.5;
  }

  // Cavalry first-strike bonus (L2/L3 passive)
  if (!isHero && attacker.passives && attacker.passives.firstStrikeMult && !attacker.hasStruck) {
    dmg *= attacker.passives.firstStrikeMult;
    attacker.hasStruck = true;
  }

  dmg = Math.max(1, Math.floor(dmg));

  // Target dodge chance (L2/L3 flying passive)
  if (target.passives && target.passives.dodgeChance && Math.random() < target.passives.dodgeChance) {
    room.damageNumbers.push({ x: target.x, y: target.y - 20, value: 'DODGE', time: Date.now(), side: attacker.side });
    return;
  }

  // Target damage reduction (L2/L3 infantry/siege passive)
  if (target.passives && target.passives.damageReduction) {
    dmg = Math.max(1, Math.floor(dmg * (1 - target.passives.damageReduction)));
  }

  // Outpost buff: 2 outposts = 10% damage reduction
  const targetSide = target.side || null;
  if (targetSide) {
    const tBuffs = getOutpostBuffs(room, targetSide);
    if (tBuffs.damageReduction > 0) dmg = Math.max(1, Math.floor(dmg * (1 - tBuffs.damageReduction)));
  }

  target.hp -= dmg;

  room.damageNumbers.push({ x: target.x, y: target.y - 20, value: dmg, time: Date.now(), side: attacker.side });

  // Projectile for ranged
  if (attacker.unitType === 'ranged' || attacker.unitType === 'flying') {
    room.projectiles.push({
      x: attacker.x, y: attacker.y, tx: target.x, ty: target.y,
      time: Date.now(), side: attacker.side, characterId: attacker.characterId
    });
  }

  if (target.hp <= 0) {
    handleDeath(room, targetInfo, target, attacker);
  }
}

function handleDeath(room, targetInfo, target, attacker) {
  const attackerOwner = getPlayerData(room, attacker.side);

  if (targetInfo.type === 'unit') {
    attackerOwner.kills++;
    // Gold reward: 2% of the slain unit's producing building cost, rounded up
    const defenderOwner = getPlayerData(room, target.side);
    const producingBuilding = defenderOwner.character.buildings.find(b => b.unit === target.typeId);
    if (producingBuilding) {
      attackerOwner.gold += Math.ceil(producingBuilding.cost * 0.02);
    }
    // XP reward to killing unit (not heroes, not towers/castles)
    if (!attacker.isHero && room.units.has(attacker.id)) {
      const killerUnit = room.units.get(attacker.id);
      if (killerUnit && killerUnit.hp > 0) {
        const xpGained = producingBuilding ? Math.ceil(producingBuilding.cost * 0.10) : 10;
        killerUnit.xp += xpGained;
        checkRankUp(killerUnit);
      }
    }
    room.units.delete(targetInfo.id);
    room.effects.push({ type: 'death', x: target.x, y: target.y, unitType: target.unitType, time: Date.now(), duration: 1000 });
  } else if (targetInfo.type === 'hero') {
    attackerOwner.kills++;
    room.effects.push({ type: 'hero_death', x: target.x, y: target.y, time: Date.now(), duration: 2000 });
    // Hero stays dead - set hp to 0
  } else if (targetInfo.type === 'building') {
    const buildingOwner = getPlayerData(room, target.side);
    const bDef = buildingOwner.character.buildings.find(b => b.id === target.typeId);
    if (bDef) {
      let incomeReduction = bDef.income;
      if (buildingOwner.character.passive.type === 'building_income') {
        incomeReduction = Math.floor(incomeReduction * (1 + buildingOwner.character.passive.value));
      }
      buildingOwner.income = Math.max(GC.BASE_INCOME, buildingOwner.income - incomeReduction);
    }
    room.buildings.delete(targetInfo.id);
    room.effects.push({ type: 'building_destroy', x: target.x, y: target.y, time: Date.now(), duration: 1500 });
  } else if (targetInfo.type === 'castle') {
    room.winner = attacker.side;
    room.winTime = Date.now();
    room.state = 'finished';
    const winnerData = getPlayerData(room, attacker.side);
    const loserData = getEnemyData(room, attacker.side);
    io.to(room.id).emit('gameOver', {
      winner: attacker.side, winnerName: winnerData.name, winnerCharacter: winnerData.characterId,
      loserName: loserData.name, loserCharacter: loserData.characterId,
      duration: Date.now() - room.startTime, winnerKills: winnerData.kills, loserKills: loserData.kills
    });
    console.log(`Game ${room.id} over! ${winnerData.name} wins!`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Castle Attack Logic (Defensive arrows)
// ═══════════════════════════════════════════════════════════════════════
function updateCastleDefense(room, now) {
  const castles = [
    { castle: room.castle1, side: 'left', enemySide: 'right' },
    { castle: room.castle2, side: 'right', enemySide: 'left' }
  ];

  for (const { castle, side, enemySide } of castles) {
    if (castle.hp <= 0) continue;
    if (!castle.lastAttackTime) castle.lastAttackTime = 0;
    if (now - castle.lastAttackTime < 2000) continue; // one arrow every 2s

    let nearestEnemy = null;
    let nearestDist = 350;

    for (const [, u] of room.units) {
      if (u.side === side || u.hp <= 0) continue;
      const d = dist(castle, u);
      if (d < nearestDist) { nearestDist = d; nearestEnemy = u; }
    }

    const enemyHero = getHero(room, enemySide);
    if (enemyHero && enemyHero.hp > 0) {
      const d = dist(castle, enemyHero);
      if (d < nearestDist) { nearestDist = d; nearestEnemy = enemyHero; }
    }

    if (nearestEnemy) {
      castle.lastAttackTime = now;
      const dmg = 30;
      nearestEnemy.hp -= dmg;
      room.damageNumbers.push({ x: nearestEnemy.x, y: nearestEnemy.y - 20, value: dmg, time: now, side });
      room.projectiles.push({
        x: castle.x, y: castle.y - 30, tx: nearestEnemy.x, ty: nearestEnemy.y,
        time: now, side, characterId: '', isTower: true
      });

      if (nearestEnemy.hp <= 0) {
        if (nearestEnemy.isHero) {
          room.effects.push({ type: 'hero_death', x: nearestEnemy.x, y: nearestEnemy.y, time: now, duration: 2000 });
        } else {
          const playerData = getPlayerData(room, side);
          playerData.kills++;
          // 2% of the slain unit's producing building cost
          const defenderData = getPlayerData(room, enemySide);
          const producingBuilding = defenderData.character.buildings.find(b => b.unit === nearestEnemy.typeId);
          if (producingBuilding) playerData.gold += Math.ceil(producingBuilding.cost * 0.02);
          room.units.delete(nearestEnemy.id);
          room.effects.push({ type: 'death', x: nearestEnemy.x, y: nearestEnemy.y, unitType: nearestEnemy.unitType, time: now, duration: 1000 });
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Tower Attack Logic
// ═══════════════════════════════════════════════════════════════════════
function updateTowers(room, now) {
  for (const [, building] of room.buildings) {
    if (!building.isTower || !building.constructed || building.hp <= 0) continue;
    if (now - building.lastTowerAttack < building.towerAttackSpeed) continue;

    // Find nearest enemy in range
    let nearestEnemy = null;
    let nearestDist = building.towerRange;
    const enemySide = building.side === 'left' ? 'right' : 'left';

    for (const [, u] of room.units) {
      if (u.side === building.side || u.hp <= 0) continue;
      const d = dist(building, u);
      if (d < nearestDist) { nearestDist = d; nearestEnemy = u; }
    }

    // Check enemy hero
    const enemyHero = getHero(room, enemySide);
    if (enemyHero && enemyHero.hp > 0) {
      const d = dist(building, enemyHero);
      if (d < nearestDist) { nearestDist = d; nearestEnemy = enemyHero; }
    }

    if (nearestEnemy) {
      building.lastTowerAttack = now;
      const dmg = Math.max(1, Math.floor(building.towerDamage));
      nearestEnemy.hp -= dmg;

      room.damageNumbers.push({ x: nearestEnemy.x, y: nearestEnemy.y - 20, value: dmg, time: now, side: building.side });
      room.projectiles.push({
        x: building.x, y: building.y - 20, tx: nearestEnemy.x, ty: nearestEnemy.y,
        time: now, side: building.side, characterId: building.characterId, isTower: true
      });

      if (nearestEnemy.hp <= 0) {
        if (nearestEnemy.isHero) {
          room.effects.push({ type: 'hero_death', x: nearestEnemy.x, y: nearestEnemy.y, time: now, duration: 2000 });
        } else {
          const attackerOwner = getPlayerData(room, building.side);
          attackerOwner.kills++;
          room.units.delete(nearestEnemy.id);
          room.effects.push({ type: 'death', x: nearestEnemy.x, y: nearestEnemy.y, unitType: nearestEnemy.unitType, time: now, duration: 1000 });
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Hero Update
// ═══════════════════════════════════════════════════════════════════════
function updateHero(room, hero, now, dt) {
  if (!hero || hero.hp <= 0) return;

  const playerData = getPlayerData(room, hero.side);
  const charData = playerData.character;

  // Regeneration passive for Forest Warden hero
  if (charData.passive.type === 'unit_regen' && hero.hp < hero.maxHp) {
    hero.hp = Math.min(hero.maxHp, hero.hp + charData.passive.value * dt);
  }

  // Move toward move target
  if (hero.moveTargetX !== null && hero.moveTargetY !== null) {
    const dx = hero.moveTargetX - hero.x;
    const dy = hero.moveTargetY - hero.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 10) {
      hero.x += (dx / d) * hero.speed * dt;
      hero.y += (dy / d) * hero.speed * dt;
      hero.x = clamp(hero.x, 20, GC.MAP_WIDTH - 20);
      hero.y = clamp(hero.y, 20, GC.MAP_HEIGHT - 20);
      hero.state = 'moving';
    } else {
      hero.moveTargetX = null;
      hero.moveTargetY = null;
      hero.state = 'idle';
    }
  }

  // Auto-attack nearest enemy in range (only after hero has been moved/activated)
  if (hero.activated) {
    let nearestEnemy = null;
    let nearestDist = hero.range + 50;
    const enemySide = hero.side === 'left' ? 'right' : 'left';

    for (const [, u] of room.units) {
      if (u.side === hero.side || u.hp <= 0) continue;
      const d = dist(hero, u);
      if (d < nearestDist) { nearestDist = d; nearestEnemy = { id: u.id, type: 'unit', target: u }; }
    }

    const enemyHero = getHero(room, enemySide);
    if (enemyHero && enemyHero.hp > 0) {
      const d = dist(hero, enemyHero);
      if (d < nearestDist) { nearestDist = d; nearestEnemy = { id: enemyHero.id, type: 'hero', target: enemyHero }; }
    }

    for (const [, b] of room.buildings) {
      if (b.side === hero.side || b.hp <= 0) continue;
      const d = dist(hero, b);
      if (d < nearestDist) { nearestDist = d; nearestEnemy = { id: b.id, type: 'building', target: b }; }
    }

    const eCastle = getEnemyCastle(room, hero.side);
    if (eCastle.hp > 0) {
      const d = dist(hero, eCastle);
      if (d < nearestDist) { nearestDist = d; nearestEnemy = { id: eCastle.id, type: 'castle', target: eCastle }; }
    }

    if (nearestEnemy && nearestDist <= hero.range + 10) {
      const heroBuff = getOutpostBuffs(room, hero.side);
      const heroEffAS = Math.floor(hero.attackSpeed * heroBuff.attackSpeedMult);
      if (now - hero.lastAttackTime >= heroEffAS) {
        hero.lastAttackTime = now;
        hero.state = 'fighting';
        dealDamage(room, hero, nearestEnemy, true);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// General Update (similar to hero but restricted to own half + AOE aura)
// ═══════════════════════════════════════════════════════════════════════
function updateGeneral(room, general, now, dt) {
  if (!general || general.hp <= 0) return;

  // Move toward target
  if (general.moveTargetX !== null && general.moveTargetY !== null) {
    const dx = general.moveTargetX - general.x;
    const dy = general.moveTargetY - general.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 10) {
      general.x += (dx / d) * general.speed * dt;
      general.y += (dy / d) * general.speed * dt;
      // Clamp general to own half of map
      if (general.side === 'left') {
        general.x = clamp(general.x, 20, GC.MAP_WIDTH / 2);
      } else {
        general.x = clamp(general.x, GC.MAP_WIDTH / 2, GC.MAP_WIDTH - 20);
      }
      general.y = clamp(general.y, 20, GC.MAP_HEIGHT - 20);
      general.state = 'moving';
    } else {
      general.moveTargetX = null;
      general.moveTargetY = null;
      general.state = 'idle';
    }
  }

  // Auto-attack nearest enemy in range
  let nearestEnemy = null;
  let nearestDist = general.range + 50;
  const enemySide = general.side === 'left' ? 'right' : 'left';

  for (const [, u] of room.units) {
    if (u.side === general.side || u.hp <= 0) continue;
    const d = dist(general, u);
    if (d < nearestDist) { nearestDist = d; nearestEnemy = { id: u.id, type: 'unit', target: u }; }
  }

  const enemyHero = getHero(room, enemySide);
  if (enemyHero && enemyHero.hp > 0) {
    const d = dist(general, enemyHero);
    if (d < nearestDist) { nearestDist = d; nearestEnemy = { id: enemyHero.id, type: 'hero', target: enemyHero }; }
  }

  if (nearestEnemy && nearestDist <= general.range + 10) {
    const genBuff = getOutpostBuffs(room, general.side);
    const genEffAS = Math.floor(general.attackSpeed * genBuff.attackSpeedMult);
    if (now - general.lastAttackTime >= genEffAS) {
      general.lastAttackTime = now;
      general.state = 'fighting';
      // General deals damage like a hero
      dealDamageGeneral(room, general, nearestEnemy, now);
    }
  }

  // AOE aura: apply buffs to nearby friendly units based on rank
  if (general.rank > 0) {
    const auraRange = general.auraRange;
    for (const [, u] of room.units) {
      if (u.side !== general.side || u.hp <= 0) continue;
      if (dist(general, u) > auraRange) continue;
      // Regen aura
      if (general.rank >= 1 && u.hp < u.maxHp) {
        u.hp = Math.min(u.maxHp, u.hp + (general.rank >= 3 ? 3 : 1) * dt);
      }
    }
  }
}

function dealDamageGeneral(room, general, targetInfo, now) {
  const target = targetInfo.target;
  if (!target || target.hp <= 0) return;

  let dmg = Math.max(1, Math.floor(general.damage * 1.2));

  // Outpost damage reduction
  const targetSide = target.side || null;
  if (targetSide) {
    const tBuffs = getOutpostBuffs(room, targetSide);
    if (tBuffs.damageReduction > 0) dmg = Math.max(1, Math.floor(dmg * (1 - tBuffs.damageReduction)));
  }

  target.hp -= dmg;
  room.damageNumbers.push({ x: target.x, y: target.y - 20, value: dmg, time: now, side: general.side });

  if (target.hp <= 0) {
    // XP for general on kill
    if (targetInfo.type === 'unit') {
      const defenderData = getPlayerData(room, target.side);
      const producingBuilding = defenderData.character.buildings.find(b => b.unit === target.typeId);
      const xpGained = producingBuilding ? Math.ceil(producingBuilding.cost * 0.10) : 10;
      general.xp += xpGained;
      checkRankUp(general);

      const attackerOwner = getPlayerData(room, general.side);
      attackerOwner.kills++;
      if (producingBuilding) attackerOwner.gold += Math.ceil(producingBuilding.cost * 0.02);
      room.units.delete(targetInfo.id);
      room.effects.push({ type: 'death', x: target.x, y: target.y, unitType: target.unitType, time: now, duration: 1000 });
    } else if (targetInfo.type === 'hero') {
      room.effects.push({ type: 'hero_death', x: target.x, y: target.y, time: now, duration: 2000 });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Rescue Strike
// ═══════════════════════════════════════════════════════════════════════
function executeRescueStrike(room, side) {
  const playerData = getPlayerData(room, side);
  if (playerData.rescueStrikeUsed) return false;
  playerData.rescueStrikeUsed = true;
  const castle = getCastle(room, side);

  for (const [id, unit] of room.units) {
    if (unit.side !== side && dist(unit, castle) < GC.RESCUE_STRIKE_RADIUS) {
      room.units.delete(id);
    }
  }

  room.effects.push({ type: 'rescue_strike', x: castle.x, y: castle.y, radius: GC.RESCUE_STRIKE_RADIUS, time: Date.now(), duration: 2000 });
  io.to(room.id).emit('rescueStrike', { side, x: castle.x, y: castle.y, radius: GC.RESCUE_STRIKE_RADIUS });
  return true;
}

// ═══════════════════════════════════════════════════════════════════════
// Bot AI
// ═══════════════════════════════════════════════════════════════════════
function botThink(room) {
  if (room.state !== 'playing' || !room.botState) return;
  const bot = room.player2;
  const botChar = bot.character;
  const now = Date.now();
  const elapsed = now - room.startTime;

  if (elapsed > 300000) room.botState.phase = 'late';
  else if (elapsed > 120000) room.botState.phase = 'mid';

  // Bot hero movement
  const botHero = room.hero2;
  if (botHero && botHero.hp > 0 && now - room.botState.heroMoveTime > 5000) {
    room.botState.heroMoveTime = now;
    botHero.activated = true;
    // Send hero to fight along a random lane
    const laneY = Math.random() < 0.5 ? GC.LANE_TOP_Y : GC.LANE_BOT_Y;
    const targetX = GC.P2_CASTLE_X - 200 - Math.random() * 800;
    botHero.moveTargetX = targetX;
    botHero.moveTargetY = laneY + (Math.random() - 0.5) * 100;
  }

  if (now < room.botState.nextBuildTime) return;

  let totalBuildings = 0;
  for (const [, b] of room.buildings) {
    if (b.side === 'right') totalBuildings++;
  }

  const buildOrder = botChar.buildings;
  let buildingToBuild = null;

  if (room.botState.phase === 'early') {
    if (totalBuildings < 2) buildingToBuild = buildOrder[0];
    else if (totalBuildings < 4) buildingToBuild = buildOrder[Math.floor(Math.random() * 2)];
    else buildingToBuild = buildOrder[Math.floor(Math.random() * 3)];
  } else if (room.botState.phase === 'mid') {
    // Sometimes build towers
    buildingToBuild = buildOrder[Math.floor(Math.random() * Math.min(5, buildOrder.length))];
  } else {
    buildingToBuild = buildOrder[Math.floor(Math.random() * buildOrder.length)];
  }

  if (buildingToBuild && bot.gold >= buildingToBuild.cost) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const bx = GC.P2_BASE_MIN_X + 40 + Math.random() * (GC.P2_BASE_MAX_X - GC.P2_BASE_MIN_X - 80);
      const by = GC.BASE_MIN_Y + 40 + Math.random() * (GC.BASE_MAX_Y - GC.BASE_MIN_Y - 80);
      if (placeBuilding(room, 'right', buildingToBuild.id, bx, by).success) break;
    }
  }

  const baseDelay = room.botState.phase === 'early' ? 5000 : room.botState.phase === 'mid' ? 4000 : 3000;
  room.botState.nextBuildTime = now + baseDelay + Math.random() * 3000;

  // Bot rescue strike
  const botCastle = room.castle2;
  if (!bot.rescueStrikeUsed && botCastle.hp < botCastle.maxHp * 0.3) {
    let enemyNear = 0;
    for (const [, unit] of room.units) {
      if (unit.side === 'left' && dist(unit, botCastle) < GC.RESCUE_STRIKE_RADIUS) enemyNear++;
    }
    if (enemyNear >= 3) executeRescueStrike(room, 'right');
  }
}

// ═══════════════════════════════════════════════════════════════════════
// XP & Rank System
// ═══════════════════════════════════════════════════════════════════════
const RANK_THRESHOLDS = [30, 70, 150]; // Cumulative XP needed for rank 1, 2, 3
const RANK_BUFFS = [0, 0.05, 0.10, 0.20]; // Damage/HP boost + attack speed reduction per rank

function checkRankUp(unit) {
  while (unit.rank < 3 && unit.xp >= RANK_THRESHOLDS[unit.rank]) {
    unit.rank++;
    const buff = RANK_BUFFS[unit.rank];
    unit.damage = Math.floor(unit.baseDamage * (1 + buff));
    unit.attackSpeed = Math.max(200, Math.floor(unit.baseAttackSpeed * (1 - buff)));
    const prevMaxHp = unit.maxHp;
    unit.maxHp = Math.floor(unit.baseMaxHp * (1 + buff));
    unit.hp += (unit.maxHp - prevMaxHp); // Gain extra HP on rank up
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Path Clamping — keep ground units on cobblestone (home territory or lane)
// ═══════════════════════════════════════════════════════════════════════
function clampToPath(unit) {
  if (unit.unitType === 'flying') return;
  const laneHalfW = GC.LANE_WIDTH / 2;

  if (unit.x <= GC.P1_BASE_MAX_X) {
    // Left home territory — clamp to base area (all brick)
    unit.x = clamp(unit.x, GC.P1_BASE_MIN_X + 5, GC.P1_BASE_MAX_X);
    unit.y = clamp(unit.y, GC.BASE_MIN_Y + 5, GC.BASE_MAX_Y - 5);
  } else if (unit.x >= GC.P2_BASE_MIN_X) {
    // Right home territory — clamp to base area (all brick)
    unit.x = clamp(unit.x, GC.P2_BASE_MIN_X, GC.P2_BASE_MAX_X - 5);
    unit.y = clamp(unit.y, GC.BASE_MIN_Y + 5, GC.BASE_MAX_Y - 5);
  } else {
    // Middle — must stay on lane cobblestone
    unit.y = clamp(unit.y, unit.laneY - laneHalfW, unit.laneY + laneHalfW);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Game Tick
// ═══════════════════════════════════════════════════════════════════════
function gameTick() {
  const now = Date.now();
  const dt = 1 / GC.TICK_RATE;

  for (const [roomId, room] of gameRooms) {
    if (room.state !== 'playing') {
      if (room.winTime && now - room.winTime > 15000) gameRooms.delete(roomId);
      continue;
    }

    // ─── Gold Income + Interest ──────────────────────────────────
    if (now - room.lastIncomeTime >= GC.INCOME_INTERVAL) {
      // Base income
      room.player1.gold += room.player1.income;
      room.player2.gold += room.player2.income;
      // Interest: +2% of current gold
      room.player1.gold += Math.floor(room.player1.gold * GC.INTEREST_RATE);
      room.player2.gold += Math.floor(room.player2.gold * GC.INTEREST_RATE);
      room.lastIncomeTime = now;
    }

    // ─── Building Spawning ───────────────────────────────────────
    for (const [, building] of room.buildings) {
      if (!building.constructed) {
        if (now - building.constructionTime >= building.constructionDuration) {
          building.constructed = true;
          building.lastSpawnTime = now;
        }
        continue;
      }
      if (building.hp <= 0 || building.isTower || !building.unitType) continue;

      if (now - building.lastSpawnTime >= building.spawnInterval) {
        building.lastSpawnTime = now;
        spawnUnitFromBuilding(room, building);
      }
    }

    // ─── Castle Defense ───────────────────────────────────────────
    updateCastleDefense(room, now);

    // ─── Tower Attacks ────────────────────────────────────────────
    updateTowers(room, now);

    // ─── Hero Updates ─────────────────────────────────────────────
    updateHero(room, room.hero1, now, dt);
    updateHero(room, room.hero2, now, dt);

    // ─── General Updates — DISABLED ──────────────────────────────
    // updateGeneral(room, room.general1, now, dt);
    // updateGeneral(room, room.general2, now, dt);

    // ─── Outpost Updates ──────────────────────────────────────────
    updateOutposts(room, dt);

    // ─── Unit Updates ────────────────────────────────────────────
    const unitsToRemove = [];

    for (const [unitId, unit] of room.units) {
      if (unit.hp <= 0) { unitsToRemove.push(unitId); continue; }

      const charData = getPlayerData(room, unit.side).character;

      // Regeneration passive
      if (charData.passive.type === 'unit_regen' && unit.hp < unit.maxHp) {
        unit.hp = Math.min(unit.maxHp, unit.hp + charData.passive.value * dt);
      }

      // Movement zones — side-aware so units don't get stuck at enemy stairs
      const inOwnBase = (unit.side === 'left' && unit.x <= GC.P1_BASE_MAX_X) ||
                        (unit.side === 'right' && unit.x >= GC.P2_BASE_MIN_X);
      const inEnemyBase = (unit.side === 'left' && unit.x >= GC.P2_BASE_MIN_X) ||
                          (unit.side === 'right' && unit.x <= GC.P1_BASE_MAX_X);
      const isFlying = unit.unitType === 'flying';
      const laneHalfW = GC.LANE_WIDTH / 2 + 30;
      const onLaneY = Math.abs(unit.y - unit.laneY) < laneHalfW;

      // Outpost attack speed buff
      const buffs = getOutpostBuffs(room, unit.side);
      const effectiveAS = Math.floor(unit.attackSpeed * buffs.attackSpeedMult);

      // Find the nearest reachable enemy
      const found = findTarget(room, unit);
      if (found) {
        unit.targetId = found.id;
        unit.targetType = found.type;
      } else {
        // No valid target found — clear stale target so unit doesn't chase an unreachable enemy
        unit.targetId = null;
        unit.targetType = null;
      }

      let targetPos = unit.targetId ? getTargetPos(room, { id: unit.targetId, type: unit.targetType }) : null;

      // Validate target: if we can't attack this target type (e.g. cavalry vs flying), drop it
      if (targetPos && targetPos.unitType && !canAttackTarget(unit.unitType, targetPos.unitType)) {
        unit.targetId = null;
        unit.targetType = null;
        targetPos = null;
      }

      if (targetPos && targetPos.hp > 0) {
        const d = dist(unit, targetPos);

        if (d <= unit.range + 10) {
          // In range — attack
          unit.state = 'fighting';
          if (now - unit.lastAttackTime >= effectiveAS) {
            unit.lastAttackTime = now;
            dealDamage(room, unit, { id: unit.targetId, type: unit.targetType }, false);
          }
        } else {
          // Move toward target
          unit.state = 'marching';
          const closeChaseRange = unit.range + 80;

          if (isFlying) {
            // Flying: direct toward target always
            const a = angleTo(unit, targetPos);
            unit.x += Math.cos(a) * unit.speed * dt;
            unit.y += Math.sin(a) * unit.speed * dt;
          } else if (inEnemyBase) {
            // In enemy base — chase target directly
            const a = angleTo(unit, targetPos);
            unit.x += Math.cos(a) * unit.speed * dt;
            unit.y += Math.sin(a) * unit.speed * dt;
          } else if (inOwnBase) {
            if (d <= closeChaseRange) {
              // Close enemy in base — chase directly
              const a = angleTo(unit, targetPos);
              unit.x += Math.cos(a) * unit.speed * dt;
              unit.y += Math.sin(a) * unit.speed * dt;
            } else {
              // Far target — navigate toward stairs (lane entrance)
              const stairsX = unit.side === 'left' ? GC.P1_BASE_MAX_X : GC.P2_BASE_MIN_X;
              const a = angleTo(unit, { x: stairsX, y: unit.laneY });
              unit.x += Math.cos(a) * unit.speed * dt;
              unit.y += Math.sin(a) * unit.speed * dt;
            }
          } else {
            // Middle: march forward on lane toward target
            const moveDir = unit.side === 'left' ? 1 : -1;
            unit.x += moveDir * unit.speed * dt;
            // Gradually center on lane
            if (Math.abs(unit.y - unit.laneY) > 3) {
              const dy = unit.laneY - unit.y;
              unit.y += Math.sign(dy) * Math.min(Math.abs(dy), unit.speed * dt * 0.5);
            }
          }

          unit.x = clamp(unit.x, 20, GC.MAP_WIDTH - 20);
          unit.y = clamp(unit.y, 20, GC.MAP_HEIGHT - 20);
          clampToPath(unit);
        }
      } else {
        // No target — navigate toward lane and march forward
        unit.state = 'marching';
        unit.targetId = null;
        unit.targetType = null;

        if (isFlying) {
          const moveDir = unit.side === 'left' ? 1 : -1;
          unit.x += moveDir * unit.speed * dt;
        } else if (inEnemyBase) {
          // In enemy base with no target — march toward enemy castle
          const enemyCastle = getEnemyCastle(room, unit.side);
          const a = angleTo(unit, enemyCastle);
          unit.x += Math.cos(a) * unit.speed * dt;
          unit.y += Math.sin(a) * unit.speed * dt;
        } else if (inOwnBase) {
          // Navigate toward stairs (lane entrance)
          const stairsX = unit.side === 'left' ? GC.P1_BASE_MAX_X : GC.P2_BASE_MIN_X;
          const a = angleTo(unit, { x: stairsX, y: unit.laneY });
          unit.x += Math.cos(a) * unit.speed * dt;
          unit.y += Math.sin(a) * unit.speed * dt;
        } else {
          // On lane — march forward
          const moveDir = unit.side === 'left' ? 1 : -1;
          unit.x += moveDir * unit.speed * dt;
          // Gradually center on lane
          if (Math.abs(unit.y - unit.laneY) > 3) {
            const dy = unit.laneY - unit.y;
            unit.y += Math.sign(dy) * Math.min(Math.abs(dy), unit.speed * dt * 0.5);
          }
        }

        unit.x = clamp(unit.x, 20, GC.MAP_WIDTH - 20);
        unit.y = clamp(unit.y, 20, GC.MAP_HEIGHT - 20);
        clampToPath(unit);
      }
    }

    for (const id of unitsToRemove) room.units.delete(id);

    // ─── Unit Collision Separation ────────────────────────────────
    const UNIT_RADIUS = { infantry: 12, ranged: 11, cavalry: 16, siege: 20, flying: 0 };
    const unitArr = [];
    for (const [, u] of room.units) {
      if (u.hp > 0 && u.unitType !== 'flying') unitArr.push(u);
    }
    for (let i = 0; i < unitArr.length; i++) {
      for (let j = i + 1; j < unitArr.length; j++) {
        const a = unitArr[i];
        const b = unitArr[j];
        const minD = (UNIT_RADIUS[a.unitType] || 12) + (UNIT_RADIUS[b.unitType] || 12);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minD && d > 0.1) {
          const overlap = (minD - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;
          a.x = clamp(a.x, 20, GC.MAP_WIDTH - 20);
          a.y = clamp(a.y, 20, GC.MAP_HEIGHT - 20);
          b.x = clamp(b.x, 20, GC.MAP_WIDTH - 20);
          b.y = clamp(b.y, 20, GC.MAP_HEIGHT - 20);
        }
      }
    }

    // Re-clamp to cobblestone paths after collision separation
    for (const u of unitArr) {
      clampToPath(u);
    }

    // ─── Clean up ────────────────────────────────────────────────
    room.projectiles = room.projectiles.filter(p => now - p.time < 400);
    room.damageNumbers = room.damageNumbers.filter(d => now - d.time < 1200);
    room.effects = room.effects.filter(e => now - e.time < e.duration);

    // ─── Bot AI ──────────────────────────────────────────────────
    if (room.botState) botThink(room);

    // ─── Send State ──────────────────────────────────────────────
    broadcastState(room, now);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// State Broadcasting (with Fog of War)
// ═══════════════════════════════════════════════════════════════════════
function serializeState(room, now, playerSide) {
  const unitArray = [];
  const leftBuffs = getOutpostBuffs(room, 'left');
  const rightBuffs = getOutpostBuffs(room, 'right');
  for (const [, u] of room.units) {
    // Fog of war: hide enemy units not visible
    if (u.side !== playerSide && !isVisibleTo(room, playerSide, u.x, u.y)) continue;
    const buffs = u.side === 'left' ? leftBuffs : rightBuffs;
    unitArray.push({
      id: u.id, typeId: u.typeId, unitType: u.unitType, side: u.side,
      characterId: u.characterId,
      x: Math.round(u.x * 10) / 10, y: Math.round(u.y * 10) / 10,
      hp: Math.round(u.hp), maxHp: u.maxHp, state: u.state, lane: u.lane,
      damage: u.damage, speed: u.speed,
      attackSpeed: Math.floor(u.attackSpeed * buffs.attackSpeedMult),
      xp: u.xp, rank: u.rank,
      xpToNext: u.rank < 3 ? RANK_THRESHOLDS[u.rank] : RANK_THRESHOLDS[2],
      unitLevel: u.unitLevel || 1
    });
  }

  const buildingArray = [];
  for (const [, b] of room.buildings) {
    if (b.side !== playerSide && !isVisibleTo(room, playerSide, b.x, b.y)) continue;
    // Hide constructing buildings from enemy view (fog of war)
    if (b.side !== playerSide && !b.constructed) continue;
    buildingArray.push({
      id: b.id, typeId: b.typeId, side: b.side, characterId: b.characterId,
      x: b.x, y: b.y, hp: Math.round(b.hp), maxHp: b.maxHp,
      constructed: b.constructed, isTower: b.isTower,
      constructionProgress: b.constructed ? 1 : Math.min(1, (now - b.constructionTime) / b.constructionDuration),
      spawnProgress: (b.constructed && !b.isTower && b.spawnInterval > 0)
        ? Math.min(1, (now - b.lastSpawnTime) / b.spawnInterval) : 0,
      level: b.level || 1
    });
  }

  // Heroes
  const serializeHero = (hero) => {
    if (!hero) return null;
    return {
      id: hero.id, typeId: hero.typeId, unitType: hero.unitType, side: hero.side,
      characterId: hero.characterId, name: hero.name,
      x: Math.round(hero.x * 10) / 10, y: Math.round(hero.y * 10) / 10,
      hp: Math.round(hero.hp), maxHp: hero.maxHp, state: hero.state, isHero: true
    };
  };

  let hero1Data = serializeHero(room.hero1);
  let hero2Data = serializeHero(room.hero2);

  const serializeGeneral = (gen) => {
    if (!gen || gen.hp <= 0) return null;
    return {
      id: gen.id, typeId: gen.typeId, unitType: gen.unitType, side: gen.side,
      characterId: gen.characterId, name: gen.name,
      x: Math.round(gen.x * 10) / 10, y: Math.round(gen.y * 10) / 10,
      hp: Math.round(gen.hp), maxHp: gen.maxHp, state: gen.state,
      isGeneral: true, damage: gen.damage, speed: gen.speed,
      attackSpeed: gen.attackSpeed, range: gen.range,
      xp: gen.xp, rank: gen.rank,
      xpToNext: gen.rank < 3 ? RANK_THRESHOLDS[gen.rank] : RANK_THRESHOLDS[2],
      auraRange: gen.auraRange
    };
  };

  let gen1Data = serializeGeneral(room.general1);
  let gen2Data = serializeGeneral(room.general2);

  // Fog: hide enemy hero if not visible
  if (playerSide === 'left' && hero2Data && hero2Data.hp > 0 && !isVisibleTo(room, 'left', hero2Data.x, hero2Data.y)) {
    hero2Data = null;
  }
  if (playerSide === 'right' && hero1Data && hero1Data.hp > 0 && !isVisibleTo(room, 'right', hero1Data.x, hero1Data.y)) {
    hero1Data = null;
  }

  return {
    time: now, gameTime: now - room.startTime,
    castle1: { hp: Math.round(room.castle1.hp), maxHp: room.castle1.maxHp, x: room.castle1.x, y: room.castle1.y },
    castle2: { hp: Math.round(room.castle2.hp), maxHp: room.castle2.maxHp, x: room.castle2.x, y: room.castle2.y },
    units: unitArray, buildings: buildingArray,
    hero1: hero1Data, hero2: hero2Data,
    general1: gen1Data, general2: gen2Data,
    projectiles: room.projectiles.map(p => ({
      x: Math.round(p.x), y: Math.round(p.y), tx: Math.round(p.tx), ty: Math.round(p.ty),
      time: p.time, side: p.side, characterId: p.characterId, isTower: p.isTower || false
    })),
    damageNumbers: room.damageNumbers.map(d => ({ x: d.x, y: d.y, value: d.value, time: d.time })),
    effects: room.effects,
    outposts: {
      north: { x: room.outposts.north.x, y: room.outposts.north.y, controlledBy: room.outposts.north.controlledBy, captureProgress: { ...room.outposts.north.captureProgress } },
      south: { x: room.outposts.south.x, y: room.outposts.south.y, controlledBy: room.outposts.south.controlledBy, captureProgress: { ...room.outposts.south.captureProgress } }
    }
  };
}

function broadcastState(room, now) {
  // Player 1
  if (room.player1.socketId) {
    const socket = io.sockets.sockets.get(room.player1.socketId);
    if (socket) {
      const state = serializeState(room, now, 'left');
      socket.emit('state', {
        ...state,
        self: { gold: Math.floor(room.player1.gold), income: room.player1.income, rescueStrikeUsed: room.player1.rescueStrikeUsed, kills: room.player1.kills, coreFoundations: room.player1.coreFoundations },
        opponent: { gold: Math.floor(room.player2.gold), income: room.player2.income, rescueStrikeUsed: room.player2.rescueStrikeUsed, kills: room.player2.kills }
      });
    }
  }

  // Player 2
  if (room.player2.socketId && !room.player2.isBot) {
    const socket = io.sockets.sockets.get(room.player2.socketId);
    if (socket) {
      const state = serializeState(room, now, 'right');
      socket.emit('state', {
        ...state,
        self: { gold: Math.floor(room.player2.gold), income: room.player2.income, rescueStrikeUsed: room.player2.rescueStrikeUsed, kills: room.player2.kills, coreFoundations: room.player2.coreFoundations },
        opponent: { gold: Math.floor(room.player1.gold), income: room.player1.income, rescueStrikeUsed: room.player1.rescueStrikeUsed, kills: room.player1.kills }
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Matchmaking
// ═══════════════════════════════════════════════════════════════════════
function tryMatchmaking() {
  while (matchQueue.length >= 2) {
    const p1 = matchQueue.shift();
    const p2 = matchQueue.shift();
    const p1Socket = io.sockets.sockets.get(p1.socketId);
    const p2Socket = io.sockets.sockets.get(p2.socketId);
    if (!p1Socket) { matchQueue.unshift(p2); continue; }
    if (!p2Socket) { matchQueue.unshift(p1); continue; }
    createGameRoom(p1Socket, p1.characterId, p2Socket, p2.characterId);
  }

  const now = Date.now();
  for (let i = matchQueue.length - 1; i >= 0; i--) {
    const entry = matchQueue[i];
    if (now - entry.joinTime > BOT_MATCH_DELAY) {
      matchQueue.splice(i, 1);
      const socket = io.sockets.sockets.get(entry.socketId);
      if (socket) {
        const charIds = Object.keys(CHARACTERS).filter(c => c !== entry.characterId);
        const botChar = charIds[Math.floor(Math.random() * charIds.length)];
        createGameRoom(socket, entry.characterId, null, botChar, true);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Socket.IO
// ═══════════════════════════════════════════════════════════════════════
io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on('findMatch', (data) => {
    const charId = data.characterId;
    if (!CHARACTERS[charId]) return socket.emit('error', { message: 'Invalid character' });
    socket.playerName = data.name || 'Unnamed Lord';
    const idx = matchQueue.findIndex(e => e.socketId === socket.id);
    if (idx >= 0) matchQueue.splice(idx, 1);
    matchQueue.push({ socketId: socket.id, characterId: charId, joinTime: Date.now() });
    socket.emit('matchmaking', { status: 'searching' });
    console.log(`${socket.playerName} searching as ${CHARACTERS[charId].name}`);
  });

  socket.on('build', (data) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = gameRooms.get(roomId);
    if (!room || room.state !== 'playing') return;
    const side = room.player1.socketId === socket.id ? 'left' : 'right';
    socket.emit('buildResult', placeBuilding(room, side, data.buildingTypeId, data.x, data.y));
  });

  socket.on('heroMove', (data) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = gameRooms.get(roomId);
    if (!room || room.state !== 'playing') return;
    const side = room.player1.socketId === socket.id ? 'left' : 'right';
    const hero = getHero(room, side);
    if (hero && hero.hp > 0) {
      hero.moveTargetX = clamp(data.x, 20, GC.MAP_WIDTH - 20);
      hero.moveTargetY = clamp(data.y, 20, GC.MAP_HEIGHT - 20);
      hero.activated = true;
    }
  });

  // generalMove — DISABLED (code preserved)
  // socket.on('generalMove', (data) => {
  //   const roomId = playerRooms.get(socket.id);
  //   if (!roomId) return;
  //   const room = gameRooms.get(roomId);
  //   if (!room || room.state !== 'playing') return;
  //   const side = room.player1.socketId === socket.id ? 'left' : 'right';
  //   const general = side === 'left' ? room.general1 : room.general2;
  //   if (general && general.hp > 0) {
  //     let tx = clamp(data.x, 20, GC.MAP_WIDTH - 20);
  //     let ty = clamp(data.y, 20, GC.MAP_HEIGHT - 20);
  //     if (side === 'left') tx = Math.min(tx, GC.MAP_WIDTH / 2);
  //     else tx = Math.max(tx, GC.MAP_WIDTH / 2);
  //     general.moveTargetX = tx;
  //     general.moveTargetY = ty;
  //     general.activated = true;
  //   }
  // });

  socket.on('upgradeBuilding', (data) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = gameRooms.get(roomId);
    if (!room || room.state !== 'playing') return;
    const side = room.player1.socketId === socket.id ? 'left' : 'right';
    socket.emit('upgradeResult', upgradeBuilding(room, side, data.buildingId));
  });

  socket.on('buyFoundation', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = gameRooms.get(roomId);
    if (!room || room.state !== 'playing') return;
    const side = room.player1.socketId === socket.id ? 'left' : 'right';
    const playerData = getPlayerData(room, side);
    if (playerData.gold >= GC.CORE_FOUNDATION_COST) {
      playerData.gold -= GC.CORE_FOUNDATION_COST;
      playerData.coreFoundations++;
      socket.emit('foundationResult', { success: true, count: playerData.coreFoundations });
    } else {
      socket.emit('foundationResult', { success: false, reason: 'Not enough gold' });
    }
  });

  // buyGoldMine removed — Gold Mine is now a placeable building

  socket.on('rescueStrike', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = gameRooms.get(roomId);
    if (!room || room.state !== 'playing') return;
    const side = room.player1.socketId === socket.id ? 'left' : 'right';
    socket.emit('rescueStrikeResult', { success: executeRescueStrike(room, side) });
  });

  socket.on('disconnect', () => {
    const idx = matchQueue.findIndex(e => e.socketId === socket.id);
    if (idx >= 0) matchQueue.splice(idx, 1);
    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      const room = gameRooms.get(roomId);
      if (room && room.state === 'playing') {
        const winnerSide = room.player1.socketId === socket.id ? 'right' : 'left';
        room.winner = winnerSide;
        room.winTime = Date.now();
        room.state = 'finished';
        const winnerData = getPlayerData(room, winnerSide);
        io.to(roomId).emit('gameOver', {
          winner: winnerSide, winnerName: winnerData.name, reason: 'disconnect',
          duration: Date.now() - room.startTime
        });
      }
      playerRooms.delete(socket.id);
    }
    console.log(`Disconnected: ${socket.id}`);
  });
});

setInterval(gameTick, TICK_MS);
setInterval(tryMatchmaking, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ⚔️  Castle Fight running on http://0.0.0.0:${PORT}\n`);
});
