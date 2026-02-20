// ═══════════════════════════════════════════════════════════════════════
// Castle Fight - Character, Unit & Building Definitions
// ═══════════════════════════════════════════════════════════════════════

// Unit type combat multipliers: attacker type → defender type → damage multiplier
const COMBAT_MODIFIERS = {
  infantry: { infantry: 1.0, ranged: 0.9, cavalry: 0.7, siege: 1.5, flying: 0.8, building: 0.8, castle: 0.6 },
  ranged:   { infantry: 1.3, ranged: 1.0, cavalry: 0.6, siege: 0.9, flying: 1.2, building: 0.7, castle: 0.5 },
  cavalry:  { infantry: 1.3, ranged: 1.5, cavalry: 1.0, siege: 0.5, flying: 0.0, building: 0.9, castle: 0.7 },
  siege:    { infantry: 0.6, ranged: 0.6, cavalry: 1.5, siege: 1.0, flying: 0.0, building: 2.5, castle: 2.0 },
  flying:   { infantry: 0.8, ranged: 1.3, cavalry: 1.1, siege: 1.2, flying: 1.0, building: 0.6, castle: 0.4 }
};

// Which unit types can target flying units
const CAN_HIT_FLYING = {
  infantry: true,
  ranged: true,
  cavalry: false,
  siege: false,
  flying: true
};

const CHARACTERS = {
  // ─────────────────────────────────────────────────────────────────────
  // 1. THE NORTHERN LORD - Defensive, hardy infantry, resilient buildings
  // ─────────────────────────────────────────────────────────────────────
  northern_lord: {
    id: 'northern_lord',
    name: 'The Northern Lord',
    title: 'Warden of the Frostlands',
    description: 'A stalwart defender of the frozen north. His troops are hardy and resilient, built to hold the line against any assault. Buildings are reinforced with ancient northern stonework.',
    lore: 'For a thousand years, the Northern Lords have held the frost wall against the darkness. Their soldiers are forged in bitter cold and unyielding honor.',
    color: '#4a6fa5',
    accentColor: '#8fb8de',
    darkColor: '#2a3f65',
    passive: {
      name: "Winter's Resolve",
      description: 'All buildings have +25% HP',
      type: 'building_hp',
      value: 0.25
    },
    buildings: [
      {
        id: 'barracks', name: 'Barracks', cost: 100, hp: 500, income: 2,
        spawnInterval: 10000, unit: 'shieldwall',
        description: 'Trains hardened shield infantry to hold the front line.'
      },
      {
        id: 'archery_range', name: 'Archery Range', cost: 130, hp: 400, income: 2,
        spawnInterval: 12000, unit: 'longbow',
        description: 'Produces expert longbowmen with devastating range.'
      },
      {
        id: 'stables', name: 'War Stables', cost: 180, hp: 480, income: 3,
        spawnInterval: 15000, unit: 'warhorse',
        description: 'Breeds mighty warhorses and trains their riders.'
      },
      {
        id: 'siege_workshop', name: 'Siege Workshop', cost: 260, hp: 600, income: 3,
        spawnInterval: 22000, unit: 'siege_tower',
        description: 'Constructs massive siege towers to breach enemy walls.'
      },
      {
        id: 'falconry', name: 'Falconry', cost: 200, hp: 380, income: 2,
        spawnInterval: 18000, unit: 'snow_hawk',
        description: 'Trains fierce snow hawks to strike from above.'
      }
    ],
    units: [
      {
        id: 'shieldwall', name: 'Shieldwall Infantry', type: 'infantry',
        hp: 75, damage: 8, speed: 38, range: 28, attackSpeed: 1200,
        description: 'Sturdy shield-bearing soldiers of the north'
      },
      {
        id: 'longbow', name: 'Longbowman', type: 'ranged',
        hp: 38, damage: 14, speed: 34, range: 220, attackSpeed: 2000,
        description: 'Expert archers with deadly range and precision'
      },
      {
        id: 'warhorse', name: 'Warhorse Rider', type: 'cavalry',
        hp: 95, damage: 16, speed: 75, range: 32, attackSpeed: 1100,
        description: 'Mounted knights charging through enemy lines'
      },
      {
        id: 'siege_tower', name: 'Siege Tower', type: 'siege',
        hp: 200, damage: 30, speed: 18, range: 45, attackSpeed: 2800,
        description: 'Massive siege engine devastating to structures'
      },
      {
        id: 'snow_hawk', name: 'Snow Hawk', type: 'flying',
        hp: 55, damage: 11, speed: 58, range: 35, attackSpeed: 1400,
        description: 'Swift bird of prey striking from the skies'
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────
  // 2. THE DRAGON EMPRESS - Aggressive fire power, strong late game
  // ─────────────────────────────────────────────────────────────────────
  dragon_empress: {
    id: 'dragon_empress',
    name: 'The Dragon Empress',
    title: 'Mother of Flames',
    description: 'Commands the fury of dragonfire. Her forces grow fearsome in the later stages of battle, with powerful fire mages and dragons that dominate the skies.',
    lore: 'Born amid salt and smoke, the Dragon Empress rose from exile to command the last dragons. Her armies march beneath wings of shadow and flame.',
    color: '#c0392b',
    accentColor: '#e74c3c',
    darkColor: '#7b241c',
    passive: {
      name: 'Dragonfire',
      description: 'All units deal +12% damage',
      type: 'unit_damage',
      value: 0.12
    },
    buildings: [
      {
        id: 'spear_hall', name: 'Spear Hall', cost: 100, hp: 420, income: 2,
        spawnInterval: 10000, unit: 'unsullied',
        description: 'Trains disciplined spearmen who never break formation.'
      },
      {
        id: 'fire_temple', name: 'Fire Temple', cost: 160, hp: 380, income: 2,
        spawnInterval: 14000, unit: 'fire_mage',
        description: 'Channels dark fire magic into devastating mages.'
      },
      {
        id: 'flame_stables', name: 'Flame Stables', cost: 170, hp: 440, income: 3,
        spawnInterval: 14000, unit: 'flame_rider',
        description: 'Breeds fire-touched steeds for mounted assault.'
      },
      {
        id: 'scorpion_foundry', name: 'Scorpion Foundry', cost: 240, hp: 520, income: 3,
        spawnInterval: 20000, unit: 'scorpion',
        description: 'Forges massive scorpion ballistas to shatter defenses.'
      },
      {
        id: 'dragon_roost', name: 'Dragon Roost', cost: 300, hp: 450, income: 4,
        spawnInterval: 28000, unit: 'young_dragon',
        description: 'Nurtures young dragons into terrifying war beasts.'
      }
    ],
    units: [
      {
        id: 'unsullied', name: 'Unsullied Spearman', type: 'infantry',
        hp: 60, damage: 9, speed: 40, range: 32, attackSpeed: 1100,
        description: 'Disciplined warriors who fight to the last breath'
      },
      {
        id: 'fire_mage', name: 'Fire Mage', type: 'ranged',
        hp: 32, damage: 20, speed: 30, range: 190, attackSpeed: 2200,
        description: 'Channelers of devastating dragonfire magic'
      },
      {
        id: 'flame_rider', name: 'Flame Rider', type: 'cavalry',
        hp: 80, damage: 15, speed: 72, range: 30, attackSpeed: 1000,
        description: 'Cavalry wreathed in flame, charging fearlessly'
      },
      {
        id: 'scorpion', name: 'Scorpion Ballista', type: 'siege',
        hp: 130, damage: 40, speed: 16, range: 60, attackSpeed: 3200,
        description: 'Anti-structure siege weapon of immense power'
      },
      {
        id: 'young_dragon', name: 'Young Dragon', type: 'flying',
        hp: 130, damage: 22, speed: 50, range: 45, attackSpeed: 1600,
        description: 'Fearsome winged beast raining fire from above'
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────
  // 3. THE IRON ADMIRAL - Siege specialists, raider tactics
  // ─────────────────────────────────────────────────────────────────────
  iron_admiral: {
    id: 'iron_admiral',
    name: 'The Iron Admiral',
    title: 'Lord of the Salted Shores',
    description: 'A brutal warlord from the iron coasts. His forces specialize in destroying structures with powerful siege weapons and overwhelming raider tactics.',
    lore: 'What is dead may never die. The Iron Admiral pays the iron price for all he takes, leading his reavers in raids that leave nothing but ash and ruin.',
    color: '#1a8a7a',
    accentColor: '#2ecc71',
    darkColor: '#0e524a',
    passive: {
      name: 'Iron Price',
      description: 'Siege units deal +30% damage to buildings & castle',
      type: 'siege_building_damage',
      value: 0.30
    },
    buildings: [
      {
        id: 'raider_camp', name: 'Raider Camp', cost: 90, hp: 400, income: 2,
        spawnInterval: 9000, unit: 'reaver',
        description: 'Musters hardened ironborn reavers for the front.'
      },
      {
        id: 'crossbow_tower', name: 'Crossbow Tower', cost: 130, hp: 420, income: 2,
        spawnInterval: 12000, unit: 'crossbowman',
        description: 'Trains marksmen with armor-piercing crossbows.'
      },
      {
        id: 'chariot_works', name: 'Chariot Works', cost: 170, hp: 460, income: 3,
        spawnInterval: 14000, unit: 'war_chariot',
        description: 'Builds devastating war chariots that trample foes.'
      },
      {
        id: 'ram_forge', name: 'Ram Forge', cost: 220, hp: 580, income: 3,
        spawnInterval: 18000, unit: 'battering_ram',
        description: 'Forges iron-shod battering rams to break any gate.'
      },
      {
        id: 'storm_rookery', name: 'Storm Rookery', cost: 190, hp: 360, income: 2,
        spawnInterval: 16000, unit: 'storm_petrel',
        description: 'Breeds fierce storm birds for aerial harassment.'
      }
    ],
    units: [
      {
        id: 'reaver', name: 'Ironborn Reaver', type: 'infantry',
        hp: 55, damage: 11, speed: 44, range: 28, attackSpeed: 1000,
        description: 'Fierce coastal raiders who pay the iron price'
      },
      {
        id: 'crossbowman', name: 'Salted Crossbowman', type: 'ranged',
        hp: 42, damage: 15, speed: 32, range: 200, attackSpeed: 2000,
        description: 'Crossbowmen with armor-piercing bolts'
      },
      {
        id: 'war_chariot', name: 'War Chariot', type: 'cavalry',
        hp: 85, damage: 14, speed: 68, range: 34, attackSpeed: 1100,
        description: 'Iron-plated chariots that crush everything in their path'
      },
      {
        id: 'battering_ram', name: 'Battering Ram', type: 'siege',
        hp: 240, damage: 28, speed: 15, range: 35, attackSpeed: 2600,
        description: 'Massive iron ram that shatters walls and gates'
      },
      {
        id: 'storm_petrel', name: 'Storm Petrel', type: 'flying',
        hp: 48, damage: 13, speed: 65, range: 38, attackSpeed: 1300,
        description: 'Nimble storm bird striking with lightning speed'
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────
  // 4. THE GOLDEN LORD - Economic powerhouse, elite mercenaries
  // ─────────────────────────────────────────────────────────────────────
  golden_lord: {
    id: 'golden_lord',
    name: 'The Golden Lord',
    title: 'Keeper of the Gilded Vault',
    description: 'Wealth is the ultimate weapon. The Golden Lord\'s buildings generate more income, allowing him to field an ever-growing army of elite mercenaries.',
    lore: 'A Lannister always pays his debts. The Golden Lord\'s coffers run deeper than any mine, buying loyalty, swords, and dominion over all who oppose him.',
    color: '#d4a017',
    accentColor: '#f1c40f',
    darkColor: '#7d6010',
    passive: {
      name: 'Gilded Coffers',
      description: 'All buildings generate +50% more gold income',
      type: 'building_income',
      value: 0.50
    },
    buildings: [
      {
        id: 'sellsword_camp', name: 'Sellsword Camp', cost: 90, hp: 380, income: 3,
        spawnInterval: 10000, unit: 'sellsword',
        description: 'Hires cheap but effective mercenary soldiers.'
      },
      {
        id: 'guild_hall', name: 'Arbalist Guild', cost: 140, hp: 400, income: 3,
        spawnInterval: 13000, unit: 'arbalist',
        description: 'Trains guild arbalists with devastating heavy crossbows.'
      },
      {
        id: 'champions_arena', name: "Champion's Arena", cost: 200, hp: 480, income: 4,
        spawnInterval: 16000, unit: 'mounted_champion',
        description: 'Produces elite mounted champions of the realm.'
      },
      {
        id: 'golden_foundry', name: 'Golden Foundry', cost: 270, hp: 520, income: 4,
        spawnInterval: 22000, unit: 'golden_trebuchet',
        description: 'Constructs ornate but deadly golden trebuchets.'
      },
      {
        id: 'eagle_spire', name: 'Eagle Spire', cost: 210, hp: 360, income: 3,
        spawnInterval: 17000, unit: 'war_eagle',
        description: 'Houses trained war eagles for aerial superiority.'
      }
    ],
    units: [
      {
        id: 'sellsword', name: 'Sellsword', type: 'infantry',
        hp: 50, damage: 10, speed: 42, range: 28, attackSpeed: 1100,
        description: 'Cheap mercenaries who fight for coin'
      },
      {
        id: 'arbalist', name: 'Guild Arbalist', type: 'ranged',
        hp: 36, damage: 17, speed: 33, range: 210, attackSpeed: 2100,
        description: 'Elite crossbow specialists with piercing bolts'
      },
      {
        id: 'mounted_champion', name: 'Mounted Champion', type: 'cavalry',
        hp: 100, damage: 17, speed: 70, range: 33, attackSpeed: 1100,
        description: 'Heavily armored champion riders of the realm'
      },
      {
        id: 'golden_trebuchet', name: 'Golden Trebuchet', type: 'siege',
        hp: 140, damage: 42, speed: 14, range: 70, attackSpeed: 3500,
        description: 'Ornate trebuchet hurling massive golden boulders'
      },
      {
        id: 'war_eagle', name: 'War Eagle', type: 'flying',
        hp: 58, damage: 12, speed: 62, range: 36, attackSpeed: 1300,
        description: 'Majestic eagle trained for aerial warfare'
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────
  // 5. THE SHADOW PRIEST - Dark magic, undead swarms, attrition
  // ─────────────────────────────────────────────────────────────────────
  shadow_priest: {
    id: 'shadow_priest',
    name: 'The Shadow Priest',
    title: 'Herald of the Endless Night',
    description: 'Commands the forces of darkness and death. Cheap undead units swarm the battlefield in overwhelming numbers, wearing down even the mightiest defenses.',
    lore: 'The night is dark and full of terrors. The Shadow Priest draws power from beyond the veil, raising legions of the dead to serve an insatiable hunger for conquest.',
    color: '#8e44ad',
    accentColor: '#bb6bd9',
    darkColor: '#5b2c6f',
    passive: {
      name: 'Endless Legion',
      description: 'All buildings spawn units 20% faster',
      type: 'spawn_speed',
      value: 0.20
    },
    buildings: [
      {
        id: 'crypt', name: 'Crypt', cost: 80, hp: 360, income: 2,
        spawnInterval: 8000, unit: 'skeleton',
        description: 'Raises skeleton warriors from the earth below.'
      },
      {
        id: 'dark_altar', name: 'Dark Altar', cost: 120, hp: 340, income: 2,
        spawnInterval: 11000, unit: 'plague_archer',
        description: 'Corrupts souls into plague-bearing archers.'
      },
      {
        id: 'doom_stable', name: 'Doom Stables', cost: 190, hp: 440, income: 3,
        spawnInterval: 16000, unit: 'death_knight',
        description: 'Summons dread knights upon undead steeds.'
      },
      {
        id: 'bone_forge', name: 'Bone Forge', cost: 230, hp: 500, income: 3,
        spawnInterval: 20000, unit: 'bone_colossus',
        description: 'Assembles colossal constructs from the bones of the fallen.'
      },
      {
        id: 'shadow_aerie', name: 'Shadow Aerie', cost: 180, hp: 320, income: 2,
        spawnInterval: 15000, unit: 'wraith',
        description: 'Unleashes incorporeal wraiths that haunt the skies.'
      }
    ],
    units: [
      {
        id: 'skeleton', name: 'Skeleton Warrior', type: 'infantry',
        hp: 40, damage: 7, speed: 42, range: 26, attackSpeed: 900,
        description: 'Cheap undead soldier that attacks in swarms'
      },
      {
        id: 'plague_archer', name: 'Plague Archer', type: 'ranged',
        hp: 28, damage: 12, speed: 35, range: 190, attackSpeed: 1800,
        description: 'Undead archer whose arrows carry deadly plague'
      },
      {
        id: 'death_knight', name: 'Death Knight', type: 'cavalry',
        hp: 110, damage: 18, speed: 65, range: 32, attackSpeed: 1200,
        description: 'Fearsome undead knight on a spectral steed'
      },
      {
        id: 'bone_colossus', name: 'Bone Colossus', type: 'siege',
        hp: 210, damage: 26, speed: 16, range: 40, attackSpeed: 2400,
        description: 'Towering construct of fused bone and dark magic'
      },
      {
        id: 'wraith', name: 'Wraith', type: 'flying',
        hp: 65, damage: 14, speed: 55, range: 40, attackSpeed: 1500,
        description: 'Ghostly spirit that drains the life from its victims'
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────
  // 6. THE FOREST WARDEN - Nature magic, healing, balanced forces
  // ─────────────────────────────────────────────────────────────────────
  forest_warden: {
    id: 'forest_warden',
    name: 'The Forest Warden',
    title: 'Guardian of the Ancient Grove',
    description: 'Protector of the old forests. Nature magic heals and sustains troops over time, making them difficult to wear down. A balanced force with excellent staying power.',
    lore: 'In the heart of the ancient wood, the Forest Warden commands root and branch, beast and bird. The forest itself rises to defend against those who threaten its sacred groves.',
    color: '#27ae60',
    accentColor: '#58d68d',
    darkColor: '#1a7a42',
    passive: {
      name: 'Nature\'s Blessing',
      description: 'All units regenerate 2 HP per second',
      type: 'unit_regen',
      value: 2
    },
    buildings: [
      {
        id: 'grove', name: 'Sentinel Grove', cost: 100, hp: 450, income: 2,
        spawnInterval: 10000, unit: 'sentinel',
        description: 'Grows woodland sentinels from the heart of the forest.'
      },
      {
        id: 'glade', name: 'Enchanted Glade', cost: 130, hp: 380, income: 2,
        spawnInterval: 12000, unit: 'elven_archer',
        description: 'A mystical clearing where elven archers train.'
      },
      {
        id: 'beastiary', name: 'Beastiary', cost: 180, hp: 460, income: 3,
        spawnInterval: 15000, unit: 'stag_rider',
        description: 'Tames great stags as mounts for swift riders.'
      },
      {
        id: 'ancient_oak', name: 'Ancient Oak', cost: 250, hp: 650, income: 3,
        spawnInterval: 24000, unit: 'treant',
        description: 'Awakens ancient treants from slumbering oaks.'
      },
      {
        id: 'eagle_nest', name: 'Eagle Nest', cost: 200, hp: 370, income: 2,
        spawnInterval: 17000, unit: 'great_eagle',
        description: 'Home to great eagles that patrol the forest canopy.'
      }
    ],
    units: [
      {
        id: 'sentinel', name: 'Woodland Sentinel', type: 'infantry',
        hp: 60, damage: 9, speed: 40, range: 30, attackSpeed: 1100,
        description: 'Nature warriors guarding the ancient forests'
      },
      {
        id: 'elven_archer', name: 'Elven Archer', type: 'ranged',
        hp: 34, damage: 16, speed: 36, range: 230, attackSpeed: 1900,
        description: 'Graceful archers with supernaturally accurate aim'
      },
      {
        id: 'stag_rider', name: 'Stag Rider', type: 'cavalry',
        hp: 88, damage: 15, speed: 78, range: 30, attackSpeed: 1050,
        description: 'Swift riders atop great forest stags'
      },
      {
        id: 'treant', name: 'Ancient Treant', type: 'siege',
        hp: 280, damage: 22, speed: 12, range: 40, attackSpeed: 2800,
        description: 'Living tree of immense size and destructive power'
      },
      {
        id: 'great_eagle', name: 'Great Eagle', type: 'flying',
        hp: 72, damage: 13, speed: 60, range: 38, attackSpeed: 1400,
        description: 'Majestic eagle soaring above the battlefield'
      }
    ]
  }
};

// Castle definition (same for all characters)
const CASTLE_DEF = {
  hp: 8000,
  maxHp: 8000,
  width: 120,
  height: 140
};

// Game constants
const GAME_CONSTANTS = {
  MAP_WIDTH: 3200,
  MAP_HEIGHT: 1600,
  BASE_INCOME: 8,          // Gold per income tick
  INCOME_INTERVAL: 5000,   // 5 seconds between income ticks
  STARTING_GOLD: 200,
  CASTLE_HP: 8000,
  RESCUE_STRIKE_RADIUS: 500,
  LANE_TOP_Y: 450,
  LANE_BOT_Y: 1150,
  LANE_WIDTH: 120,
  P1_CASTLE_X: 180,
  P2_CASTLE_X: 3020,
  CASTLE_Y: 800,
  P1_BASE_MIN_X: 50,
  P1_BASE_MAX_X: 650,
  P2_BASE_MIN_X: 2550,
  P2_BASE_MAX_X: 3150,
  BASE_MIN_Y: 100,
  BASE_MAX_Y: 1500,
  BUILDING_GRID_SIZE: 80,
  UNIT_DETECTION_RANGE: 200,
  TICK_RATE: 20
};

// Export for Node.js (server) or make available globally (browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CHARACTERS, COMBAT_MODIFIERS, CAN_HIT_FLYING, CASTLE_DEF, GAME_CONSTANTS };
}
