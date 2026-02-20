const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { CHARACTERS, COMBAT_MODIFIERS, CAN_HIT_FLYING, CASTLE_DEF, GAME_CONSTANTS } = require('./public/js/characters.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

// ═══════════════════════════════════════════════════════════════════════
// Game Constants
// ═══════════════════════════════════════════════════════════════════════
const GC = GAME_CONSTANTS;
const TICK_MS = 1000 / GC.TICK_RATE;
const BOT_MATCH_DELAY = 4000; // Wait 4s before matching with bot

// ═══════════════════════════════════════════════════════════════════════
// Game State
// ═══════════════════════════════════════════════════════════════════════
let nextId = 1;
const matchQueue = [];        // Players waiting for a match
const gameRooms = new Map();  // roomId -> GameRoom
const playerRooms = new Map(); // socketId -> roomId

function genId() { return nextId++; }
function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }
function angleTo(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ═══════════════════════════════════════════════════════════════════════
// Map Decorations (trees, rocks for visual richness)
// ═══════════════════════════════════════════════════════════════════════
function generateDecorations() {
  const decorations = [];
  // Trees along borders and between lanes
  for (let i = 0; i < 80; i++) {
    let x, y;
    const zone = Math.random();
    if (zone < 0.3) {
      // Top border
      x = Math.random() * GC.MAP_WIDTH;
      y = Math.random() * 120 + 20;
    } else if (zone < 0.6) {
      // Bottom border
      x = Math.random() * GC.MAP_WIDTH;
      y = GC.MAP_HEIGHT - Math.random() * 120 - 20;
    } else {
      // Middle area between lanes
      x = 700 + Math.random() * 1800;
      y = GC.LANE_TOP_Y + 120 + Math.random() * (GC.LANE_BOT_Y - GC.LANE_TOP_Y - 240);
    }
    decorations.push({
      type: 'tree',
      x, y,
      variant: Math.floor(Math.random() * 4),
      scale: 0.7 + Math.random() * 0.6
    });
  }
  // Rocks scattered around
  for (let i = 0; i < 40; i++) {
    decorations.push({
      type: 'rock',
      x: Math.random() * GC.MAP_WIDTH,
      y: Math.random() * GC.MAP_HEIGHT,
      variant: Math.floor(Math.random() * 3),
      scale: 0.5 + Math.random() * 0.5
    });
  }
  return decorations;
}

const sharedDecorations = generateDecorations();

// ═══════════════════════════════════════════════════════════════════════
// Game Room
// ═══════════════════════════════════════════════════════════════════════
function createGameRoom(p1Socket, p1Char, p2Socket, p2Char, p2IsBot = false) {
  const roomId = 'room_' + genId();

  const room = {
    id: roomId,
    state: 'playing', // playing, finished
    startTime: Date.now(),
    lastIncomeTime: Date.now(),

    player1: {
      socketId: p1Socket ? p1Socket.id : null,
      characterId: p1Char,
      character: CHARACTERS[p1Char],
      gold: GC.STARTING_GOLD,
      income: GC.BASE_INCOME,
      side: 'left',
      rescueStrikeUsed: false,
      isBot: false,
      name: p1Socket ? (p1Socket.playerName || 'Player 1') : 'Player 1'
    },
    player2: {
      socketId: p2Socket ? p2Socket.id : null,
      characterId: p2Char,
      character: CHARACTERS[p2Char],
      gold: GC.STARTING_GOLD,
      income: GC.BASE_INCOME,
      side: 'right',
      rescueStrikeUsed: false,
      isBot: p2IsBot,
      name: p2IsBot ? 'AI Commander' : (p2Socket ? (p2Socket.playerName || 'Player 2') : 'Player 2')
    },

    castle1: {
      id: genId(), x: GC.P1_CASTLE_X, y: GC.CASTLE_Y,
      hp: GC.CASTLE_HP, maxHp: GC.CASTLE_HP, side: 'left'
    },
    castle2: {
      id: genId(), x: GC.P2_CASTLE_X, y: GC.CASTLE_Y,
      hp: GC.CASTLE_HP, maxHp: GC.CASTLE_HP, side: 'right'
    },

    units: new Map(),
    buildings: new Map(),
    projectiles: [],
    damageNumbers: [],
    effects: [],

    // Bot AI state
    botState: p2IsBot ? {
      nextBuildTime: Date.now() + 3000,
      buildOrder: [],
      phase: 'early' // early, mid, late
    } : null,

    winner: null,
    winTime: null
  };

  // Apply character passives
  applyPassives(room);

  gameRooms.set(roomId, room);

  if (p1Socket) {
    playerRooms.set(p1Socket.id, roomId);
    p1Socket.join(roomId);
  }
  if (p2Socket && !p2IsBot) {
    playerRooms.set(p2Socket.id, roomId);
    p2Socket.join(roomId);
  }

  // Send game start to both players
  const startData = {
    roomId,
    mapWidth: GC.MAP_WIDTH,
    mapHeight: GC.MAP_HEIGHT,
    decorations: sharedDecorations,
    characters: CHARACTERS,
    constants: GC
  };

  if (p1Socket) {
    p1Socket.emit('gameStart', {
      ...startData,
      side: 'left',
      yourCharacter: p1Char,
      opponentCharacter: p2Char,
      opponentName: room.player2.name
    });
  }
  if (p2Socket && !p2IsBot) {
    p2Socket.emit('gameStart', {
      ...startData,
      side: 'right',
      yourCharacter: p2Char,
      opponentCharacter: p1Char,
      opponentName: room.player1.name
    });
  }

  console.log(`Game room ${roomId} created: ${room.player1.name} (${p1Char}) vs ${room.player2.name} (${p2Char})`);
  return room;
}

function applyPassives(room) {
  // Passives are applied during gameplay calculations, not stored permanently
}

function getPlayerData(room, side) {
  return side === 'left' ? room.player1 : room.player2;
}

function getEnemyData(room, side) {
  return side === 'left' ? room.player2 : room.player1;
}

function getCastle(room, side) {
  return side === 'left' ? room.castle1 : room.castle2;
}

function getEnemyCastle(room, side) {
  return side === 'left' ? room.castle2 : room.castle1;
}

// ═══════════════════════════════════════════════════════════════════════
// Building Placement
// ═══════════════════════════════════════════════════════════════════════
function canPlaceBuilding(room, side, x, y) {
  // Check if within base area
  if (side === 'left') {
    if (x < GC.P1_BASE_MIN_X || x > GC.P1_BASE_MAX_X) return false;
  } else {
    if (x < GC.P2_BASE_MIN_X || x > GC.P2_BASE_MAX_X) return false;
  }
  if (y < GC.BASE_MIN_Y || y > GC.BASE_MAX_Y) return false;

  // Check collision with existing buildings
  for (const [, b] of room.buildings) {
    if (dist({ x, y }, b) < GC.BUILDING_GRID_SIZE) return false;
  }

  // Check collision with castles
  const castle = getCastle(room, side);
  if (dist({ x, y }, castle) < 120) return false;

  return true;
}

function placeBuilding(room, side, buildingTypeId, x, y) {
  const playerData = getPlayerData(room, side);
  const charData = playerData.character;

  // Find the building definition
  const buildingDef = charData.buildings.find(b => b.id === buildingTypeId);
  if (!buildingDef) return { success: false, reason: 'Invalid building type' };

  if (playerData.gold < buildingDef.cost) {
    return { success: false, reason: 'Not enough gold' };
  }

  // Snap to grid
  const gx = Math.round(x / GC.BUILDING_GRID_SIZE) * GC.BUILDING_GRID_SIZE;
  const gy = Math.round(y / GC.BUILDING_GRID_SIZE) * GC.BUILDING_GRID_SIZE;

  if (!canPlaceBuilding(room, side, gx, gy)) {
    return { success: false, reason: 'Cannot build here' };
  }

  // Apply building HP passive
  let hp = buildingDef.hp;
  if (charData.passive.type === 'building_hp') {
    hp = Math.floor(hp * (1 + charData.passive.value));
  }

  const building = {
    id: genId(),
    typeId: buildingTypeId,
    side,
    x: gx, y: gy,
    hp, maxHp: hp,
    income: buildingDef.income,
    spawnInterval: buildingDef.spawnInterval,
    unitType: buildingDef.unit,
    lastSpawnTime: Date.now(),
    constructionTime: Date.now(),
    constructed: false,
    constructionDuration: 2000, // 2 seconds to build
    characterId: playerData.characterId
  };

  // Apply spawn speed passive
  if (charData.passive.type === 'spawn_speed') {
    building.spawnInterval = Math.floor(building.spawnInterval * (1 - charData.passive.value));
  }

  playerData.gold -= buildingDef.cost;

  // Apply income passive
  let incomeBonus = buildingDef.income;
  if (charData.passive.type === 'building_income') {
    incomeBonus = Math.floor(incomeBonus * (1 + charData.passive.value));
  }
  playerData.income += incomeBonus;

  room.buildings.set(building.id, building);

  // Add construction effect
  room.effects.push({
    type: 'construction',
    x: gx, y: gy,
    time: Date.now(),
    duration: 2000
  });

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

  // Determine lane based on building Y position
  const midY = (GC.LANE_TOP_Y + GC.LANE_BOT_Y) / 2;
  const lane = building.y < midY ? 'top' : 'bottom';
  const laneY = lane === 'top' ? GC.LANE_TOP_Y : GC.LANE_BOT_Y;

  // Apply damage passive
  let damage = unitDef.damage;
  if (charData.passive.type === 'unit_damage') {
    damage = Math.floor(damage * (1 + charData.passive.value));
  }

  const unit = {
    id: genId(),
    typeId: unitDef.id,
    unitType: unitDef.type, // infantry, ranged, cavalry, siege, flying
    side: building.side,
    characterId: playerData.characterId,
    x: building.x + (building.side === 'left' ? 30 : -30),
    y: building.y,
    hp: unitDef.hp,
    maxHp: unitDef.hp,
    damage,
    speed: unitDef.speed,
    range: unitDef.range,
    attackSpeed: unitDef.attackSpeed,
    lastAttackTime: 0,
    targetId: null,
    targetType: null, // 'unit', 'building', 'castle'
    state: 'marching', // marching, fighting, moving_to_lane
    lane,
    laneY,
    reachedLane: false,
    spawnTime: Date.now()
  };

  room.units.set(unit.id, unit);
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
  if (targetUnitType === 'flying') {
    return CAN_HIT_FLYING[attackerUnitType] || false;
  }
  return true;
}

function findTarget(room, unit) {
  let nearest = null;
  let nearestDist = GC.UNIT_DETECTION_RANGE;
  const enemySide = unit.side === 'left' ? 'right' : 'left';

  // Check enemy units
  for (const [, other] of room.units) {
    if (other.side === unit.side) continue;
    if (other.hp <= 0) continue;
    if (!canAttackTarget(unit.unitType, other.unitType)) continue;

    const d = dist(unit, other);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = { id: other.id, type: 'unit', x: other.x, y: other.y };
    }
  }

  // Check enemy buildings
  for (const [, b] of room.buildings) {
    if (b.side === unit.side) continue;
    if (b.hp <= 0) continue;

    const d = dist(unit, b);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = { id: b.id, type: 'building', x: b.x, y: b.y };
    }
  }

  // Check enemy castle (always a valid target if in range)
  const enemyCastle = getEnemyCastle(room, unit.side);
  if (enemyCastle.hp > 0) {
    const d = dist(unit, enemyCastle);
    if (d < nearestDist + 60) { // Slightly larger detection for castle
      nearestDist = d;
      nearest = { id: enemyCastle.id, type: 'castle', x: enemyCastle.x, y: enemyCastle.y };
    }
  }

  return nearest;
}

function dealUnitDamage(room, unit, targetInfo) {
  const playerData = getPlayerData(room, unit.side);
  const charData = playerData.character;

  let target;
  let defenderType = 'building';

  if (targetInfo.type === 'unit') {
    target = room.units.get(targetInfo.id);
    if (target) defenderType = target.unitType;
  } else if (targetInfo.type === 'building') {
    target = room.buildings.get(targetInfo.id);
    defenderType = 'building';
  } else if (targetInfo.type === 'castle') {
    target = targetInfo.id === room.castle1.id ? room.castle1 : room.castle2;
    defenderType = 'castle';
  }

  if (!target || target.hp <= 0) return;

  // Calculate damage with combat modifiers
  let dmg = unit.damage * getDamageMultiplier(unit.unitType, defenderType);

  // Apply siege building damage passive for Iron Admiral
  if (charData.passive.type === 'siege_building_damage' && unit.unitType === 'siege' &&
      (defenderType === 'building' || defenderType === 'castle')) {
    dmg *= (1 + charData.passive.value);
  }

  dmg = Math.max(1, Math.floor(dmg));
  target.hp -= dmg;

  // Create damage number
  room.damageNumbers.push({
    x: target.x, y: target.y - 20,
    value: dmg, time: Date.now(), side: unit.side
  });

  // Create projectile for ranged units
  if (unit.unitType === 'ranged' || unit.unitType === 'flying') {
    room.projectiles.push({
      x: unit.x, y: unit.y,
      tx: target.x, ty: target.y,
      time: Date.now(),
      side: unit.side,
      characterId: unit.characterId
    });
  }

  // Handle death
  if (target.hp <= 0) {
    if (targetInfo.type === 'unit') {
      // Remove dead unit
      room.units.delete(targetInfo.id);
      room.effects.push({
        type: 'death', x: target.x, y: target.y,
        unitType: target.unitType, time: Date.now(), duration: 1000
      });
    } else if (targetInfo.type === 'building') {
      // Remove building and reduce income
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
      room.effects.push({
        type: 'building_destroy', x: target.x, y: target.y,
        time: Date.now(), duration: 1500
      });
    } else if (targetInfo.type === 'castle') {
      // Castle destroyed - game over!
      const winnerSide = unit.side;
      room.winner = winnerSide;
      room.winTime = Date.now();
      room.state = 'finished';

      const winnerData = getPlayerData(room, winnerSide);
      const loserData = getEnemyData(room, winnerSide);

      io.to(room.id).emit('gameOver', {
        winner: winnerSide,
        winnerName: winnerData.name,
        winnerCharacter: winnerData.characterId,
        loserName: loserData.name,
        loserCharacter: loserData.characterId,
        duration: Date.now() - room.startTime
      });

      console.log(`Game ${room.id} over! ${winnerData.name} wins!`);
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

  // Kill all enemy units near the castle
  const killed = [];
  for (const [id, unit] of room.units) {
    if (unit.side !== side && dist(unit, castle) < GC.RESCUE_STRIKE_RADIUS) {
      killed.push({ x: unit.x, y: unit.y, unitType: unit.unitType });
      room.units.delete(id);
    }
  }

  // Big visual effect
  room.effects.push({
    type: 'rescue_strike',
    x: castle.x, y: castle.y,
    radius: GC.RESCUE_STRIKE_RADIUS,
    time: Date.now(),
    duration: 2000,
    killed: killed.length
  });

  io.to(room.id).emit('rescueStrike', {
    side,
    x: castle.x, y: castle.y,
    radius: GC.RESCUE_STRIKE_RADIUS,
    killed: killed.length
  });

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

  // Determine phase
  if (elapsed > 300000) room.botState.phase = 'late';
  else if (elapsed > 120000) room.botState.phase = 'mid';

  if (now < room.botState.nextBuildTime) return;

  // Count buildings by type
  const myBuildings = {};
  let totalBuildings = 0;
  for (const [, b] of room.buildings) {
    if (b.side === 'right') {
      myBuildings[b.typeId] = (myBuildings[b.typeId] || 0) + 1;
      totalBuildings++;
    }
  }

  // Bot building strategy
  let buildingToBuild = null;
  const buildOrder = botChar.buildings;

  if (room.botState.phase === 'early') {
    // Early: focus on cheap infantry and ranged buildings
    if (!myBuildings[buildOrder[0].id] || myBuildings[buildOrder[0].id] < 2) {
      buildingToBuild = buildOrder[0];
    } else if (!myBuildings[buildOrder[1].id]) {
      buildingToBuild = buildOrder[1];
    } else if (myBuildings[buildOrder[0].id] < 3) {
      buildingToBuild = buildOrder[0];
    } else {
      buildingToBuild = buildOrder[Math.floor(Math.random() * 3)];
    }
  } else if (room.botState.phase === 'mid') {
    // Mid: diversify with cavalry and more ranged
    const idx = Math.floor(Math.random() * 4);
    buildingToBuild = buildOrder[idx];
  } else {
    // Late: go for expensive buildings
    const idx = Math.floor(Math.random() * 5);
    buildingToBuild = buildOrder[idx];
  }

  if (buildingToBuild && bot.gold >= buildingToBuild.cost) {
    // Find a valid position in the bot's base
    let placed = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const bx = GC.P2_BASE_MIN_X + 40 + Math.random() * (GC.P2_BASE_MAX_X - GC.P2_BASE_MIN_X - 80);
      const by = GC.BASE_MIN_Y + 40 + Math.random() * (GC.BASE_MAX_Y - GC.BASE_MIN_Y - 80);
      const result = placeBuilding(room, 'right', buildingToBuild.id, bx, by);
      if (result.success) {
        placed = true;
        break;
      }
    }
  }

  // Vary build timing based on phase
  const baseDelay = room.botState.phase === 'early' ? 5000 :
                    room.botState.phase === 'mid' ? 4000 : 3000;
  room.botState.nextBuildTime = now + baseDelay + Math.random() * 3000;

  // Bot rescue strike: use when castle below 30% HP
  const botCastle = room.castle2;
  if (!bot.rescueStrikeUsed && botCastle.hp < botCastle.maxHp * 0.3) {
    // Check if there are enemy units near castle
    let enemyNearCastle = 0;
    for (const [, unit] of room.units) {
      if (unit.side === 'left' && dist(unit, botCastle) < GC.RESCUE_STRIKE_RADIUS) {
        enemyNearCastle++;
      }
    }
    if (enemyNearCastle >= 3) {
      executeRescueStrike(room, 'right');
    }
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
      // Clean up finished games after 15 seconds
      if (room.winTime && now - room.winTime > 15000) {
        gameRooms.delete(roomId);
      }
      continue;
    }

    // ─── Gold Income ─────────────────────────────────────────────
    if (now - room.lastIncomeTime >= GC.INCOME_INTERVAL) {
      room.player1.gold += room.player1.income;
      room.player2.gold += room.player2.income;
      room.lastIncomeTime = now;
    }

    // ─── Building Spawning ───────────────────────────────────────
    for (const [, building] of room.buildings) {
      // Check construction completion
      if (!building.constructed) {
        if (now - building.constructionTime >= building.constructionDuration) {
          building.constructed = true;
          building.lastSpawnTime = now; // Reset spawn timer on completion
        }
        continue;
      }

      if (building.hp <= 0) continue;

      // Spawn units
      if (now - building.lastSpawnTime >= building.spawnInterval) {
        building.lastSpawnTime = now;
        spawnUnitFromBuilding(room, building);
      }
    }

    // ─── Unit Updates ────────────────────────────────────────────
    const unitsToRemove = [];

    for (const [unitId, unit] of room.units) {
      if (unit.hp <= 0) {
        unitsToRemove.push(unitId);
        continue;
      }

      const charData = getPlayerData(room, unit.side).character;

      // Apply regeneration passive (Forest Warden)
      if (charData.passive.type === 'unit_regen' && unit.hp < unit.maxHp) {
        unit.hp = Math.min(unit.maxHp, unit.hp + charData.passive.value * dt);
      }

      // Move to lane first if not there yet
      if (!unit.reachedLane) {
        const dy = unit.laneY - unit.y;
        if (Math.abs(dy) > 5) {
          unit.y += Math.sign(dy) * unit.speed * dt;
          continue;
        } else {
          unit.y = unit.laneY;
          unit.reachedLane = true;
        }
      }

      // Find target
      let target = null;
      if (unit.targetId) {
        if (unit.targetType === 'unit') {
          target = room.units.get(unit.targetId);
        } else if (unit.targetType === 'building') {
          target = room.buildings.get(unit.targetId);
        } else if (unit.targetType === 'castle') {
          target = unit.targetId === room.castle1.id ? room.castle1 : room.castle2;
        }
        if (target && target.hp <= 0) target = null;
      }

      if (!target) {
        const found = findTarget(room, unit);
        if (found) {
          unit.targetId = found.id;
          unit.targetType = found.type;
          unit.state = 'fighting';
        } else {
          unit.state = 'marching';
          unit.targetId = null;
          unit.targetType = null;
        }
      }

      if (unit.state === 'fighting' && unit.targetId) {
        let targetPos;
        if (unit.targetType === 'unit') targetPos = room.units.get(unit.targetId);
        else if (unit.targetType === 'building') targetPos = room.buildings.get(unit.targetId);
        else if (unit.targetType === 'castle') {
          targetPos = unit.targetId === room.castle1.id ? room.castle1 : room.castle2;
        }

        if (targetPos && targetPos.hp > 0) {
          const d = dist(unit, targetPos);
          if (d > unit.range + 10) {
            // Move toward target
            const a = angleTo(unit, targetPos);
            unit.x += Math.cos(a) * unit.speed * dt;
            unit.y += Math.sin(a) * unit.speed * dt;
          } else {
            // Attack
            if (now - unit.lastAttackTime >= unit.attackSpeed) {
              unit.lastAttackTime = now;
              dealUnitDamage(room, unit, {
                id: unit.targetId, type: unit.targetType
              });
            }
          }
        } else {
          unit.state = 'marching';
          unit.targetId = null;
          unit.targetType = null;
        }
      }

      if (unit.state === 'marching') {
        // March toward enemy castle along the lane
        const direction = unit.side === 'left' ? 1 : -1;
        unit.x += direction * unit.speed * dt;

        // Keep on lane (with slight variation for visual interest)
        const laneDeviation = Math.sin(unit.id * 1.7 + now * 0.001) * 15;
        const targetY = unit.laneY + laneDeviation;
        unit.y += (targetY - unit.y) * 0.05;

        // Clamp to map bounds
        unit.x = clamp(unit.x, 20, GC.MAP_WIDTH - 20);
        unit.y = clamp(unit.y, 20, GC.MAP_HEIGHT - 20);
      }
    }

    // Remove dead units
    for (const id of unitsToRemove) {
      room.units.delete(id);
    }

    // ─── Clean up effects ────────────────────────────────────────
    room.projectiles = room.projectiles.filter(p => now - p.time < 400);
    room.damageNumbers = room.damageNumbers.filter(d => now - d.time < 1200);
    room.effects = room.effects.filter(e => now - e.time < e.duration);

    // ─── Bot AI ──────────────────────────────────────────────────
    if (room.botState) {
      botThink(room);
    }

    // ─── Send State ──────────────────────────────────────────────
    broadcastState(room, now);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// State Broadcasting
// ═══════════════════════════════════════════════════════════════════════
function broadcastState(room, now) {
  const unitArray = [];
  for (const [, u] of room.units) {
    unitArray.push({
      id: u.id, typeId: u.typeId, unitType: u.unitType,
      side: u.side, characterId: u.characterId,
      x: Math.round(u.x * 10) / 10,
      y: Math.round(u.y * 10) / 10,
      hp: Math.round(u.hp), maxHp: u.maxHp,
      state: u.state, lane: u.lane
    });
  }

  const buildingArray = [];
  for (const [, b] of room.buildings) {
    buildingArray.push({
      id: b.id, typeId: b.typeId, side: b.side,
      characterId: b.characterId,
      x: b.x, y: b.y,
      hp: Math.round(b.hp), maxHp: b.maxHp,
      constructed: b.constructed,
      constructionProgress: b.constructed ? 1 :
        Math.min(1, (now - b.constructionTime) / b.constructionDuration)
    });
  }

  const state = {
    time: now,
    gameTime: now - room.startTime,
    castle1: {
      hp: Math.round(room.castle1.hp),
      maxHp: room.castle1.maxHp,
      x: room.castle1.x, y: room.castle1.y
    },
    castle2: {
      hp: Math.round(room.castle2.hp),
      maxHp: room.castle2.maxHp,
      x: room.castle2.x, y: room.castle2.y
    },
    units: unitArray,
    buildings: buildingArray,
    projectiles: room.projectiles.map(p => ({
      x: Math.round(p.x), y: Math.round(p.y),
      tx: Math.round(p.tx), ty: Math.round(p.ty),
      time: p.time, side: p.side, characterId: p.characterId
    })),
    damageNumbers: room.damageNumbers.map(d => ({
      x: d.x, y: d.y, value: d.value, time: d.time
    })),
    effects: room.effects
  };

  // Send to player 1
  if (room.player1.socketId) {
    const socket = io.sockets.sockets.get(room.player1.socketId);
    if (socket) {
      socket.emit('state', {
        ...state,
        self: {
          gold: Math.floor(room.player1.gold),
          income: room.player1.income,
          rescueStrikeUsed: room.player1.rescueStrikeUsed
        },
        opponent: {
          gold: Math.floor(room.player2.gold),
          income: room.player2.income,
          rescueStrikeUsed: room.player2.rescueStrikeUsed
        }
      });
    }
  }

  // Send to player 2 (if not bot)
  if (room.player2.socketId && !room.player2.isBot) {
    const socket = io.sockets.sockets.get(room.player2.socketId);
    if (socket) {
      socket.emit('state', {
        ...state,
        self: {
          gold: Math.floor(room.player2.gold),
          income: room.player2.income,
          rescueStrikeUsed: room.player2.rescueStrikeUsed
        },
        opponent: {
          gold: Math.floor(room.player1.gold),
          income: room.player1.income,
          rescueStrikeUsed: room.player1.rescueStrikeUsed
        }
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Matchmaking
// ═══════════════════════════════════════════════════════════════════════
function tryMatchmaking() {
  // Match two players from queue
  while (matchQueue.length >= 2) {
    const p1 = matchQueue.shift();
    const p2 = matchQueue.shift();

    const p1Socket = io.sockets.sockets.get(p1.socketId);
    const p2Socket = io.sockets.sockets.get(p2.socketId);

    if (!p1Socket) { matchQueue.unshift(p2); continue; }
    if (!p2Socket) { matchQueue.unshift(p1); continue; }

    createGameRoom(p1Socket, p1.characterId, p2Socket, p2.characterId);
  }

  // Check for players waiting too long - match with bot
  const now = Date.now();
  for (let i = matchQueue.length - 1; i >= 0; i--) {
    const entry = matchQueue[i];
    if (now - entry.joinTime > BOT_MATCH_DELAY) {
      matchQueue.splice(i, 1);
      const socket = io.sockets.sockets.get(entry.socketId);
      if (socket) {
        // Pick random bot character (different from player's)
        const charIds = Object.keys(CHARACTERS).filter(c => c !== entry.characterId);
        const botChar = charIds[Math.floor(Math.random() * charIds.length)];
        createGameRoom(socket, entry.characterId, null, botChar, true);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Socket.IO Connection Handler
// ═══════════════════════════════════════════════════════════════════════
io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on('findMatch', (data) => {
    const charId = data.characterId;
    if (!CHARACTERS[charId]) {
      socket.emit('error', { message: 'Invalid character' });
      return;
    }

    socket.playerName = data.name || 'Unnamed Lord';

    // Remove from queue if already there
    const idx = matchQueue.findIndex(e => e.socketId === socket.id);
    if (idx >= 0) matchQueue.splice(idx, 1);

    matchQueue.push({
      socketId: socket.id,
      characterId: charId,
      joinTime: Date.now()
    });

    socket.emit('matchmaking', { status: 'searching' });
    console.log(`${socket.playerName} searching for match as ${CHARACTERS[charId].name}`);
  });

  socket.on('build', (data) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = gameRooms.get(roomId);
    if (!room || room.state !== 'playing') return;

    // Determine player side
    const side = room.player1.socketId === socket.id ? 'left' : 'right';
    const result = placeBuilding(room, side, data.buildingTypeId, data.x, data.y);

    socket.emit('buildResult', result);
  });

  socket.on('rescueStrike', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = gameRooms.get(roomId);
    if (!room || room.state !== 'playing') return;

    const side = room.player1.socketId === socket.id ? 'left' : 'right';
    const success = executeRescueStrike(room, side);
    socket.emit('rescueStrikeResult', { success });
  });

  socket.on('disconnect', () => {
    // Remove from match queue
    const idx = matchQueue.findIndex(e => e.socketId === socket.id);
    if (idx >= 0) matchQueue.splice(idx, 1);

    // Handle active game
    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      const room = gameRooms.get(roomId);
      if (room && room.state === 'playing') {
        // Player disconnected - other player wins
        const winnerSide = room.player1.socketId === socket.id ? 'right' : 'left';
        room.winner = winnerSide;
        room.winTime = Date.now();
        room.state = 'finished';

        const winnerData = getPlayerData(room, winnerSide);
        io.to(roomId).emit('gameOver', {
          winner: winnerSide,
          winnerName: winnerData.name,
          reason: 'disconnect',
          duration: Date.now() - room.startTime
        });
      }
      playerRooms.delete(socket.id);
    }

    console.log(`Disconnected: ${socket.id}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Start Game Loop
// ═══════════════════════════════════════════════════════════════════════
setInterval(gameTick, TICK_MS);
setInterval(tryMatchmaking, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ⚔️  Castle Fight running on http://0.0.0.0:${PORT}\n`);
});
