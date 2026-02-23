// ═══════════════════════════════════════════════════════════════════════
// Castle Fight - Character, Unit, Building, Tower & Hero Definitions
// ═══════════════════════════════════════════════════════════════════════

const COMBAT_MODIFIERS = {
  infantry: { infantry: 1.0, ranged: 0.9, cavalry: 0.7, siege: 1.5, flying: 0.0, building: 0.8, castle: 0.6 },
  ranged:   { infantry: 1.3, ranged: 1.0, cavalry: 0.6, siege: 0.9, flying: 1.2, building: 0.7, castle: 0.5 },
  cavalry:  { infantry: 1.3, ranged: 1.5, cavalry: 1.0, siege: 0.5, flying: 0.0, building: 0.9, castle: 0.7 },
  siege:    { infantry: 0.6, ranged: 0.6, cavalry: 1.5, siege: 1.0, flying: 0.0, building: 2.5, castle: 2.0 },
  flying:   { infantry: 0.8, ranged: 1.3, cavalry: 1.1, siege: 1.2, flying: 1.0, building: 0.6, castle: 0.4 }
};

const CAN_HIT_FLYING = {
  infantry: false,
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
    lore: 'For a thousand years, the Northern Lords have held the frost wall against the darkness.',
    color: '#4a6fa5',
    accentColor: '#8fb8de',
    darkColor: '#2a3f65',
    passive: {
      name: "Winter's Resolve",
      description: 'All buildings have +25% HP',
      type: 'building_hp',
      value: 0.25
    },
    hero: {
      id: 'lord_commander', name: 'Lord Commander', type: 'infantry',
      hp: 800, damage: 35, speed: 50, range: 40, attackSpeed: 1000,
      description: 'A battle-hardened commander wielding a Valyrian steel greatsword'
    },
    buildings: [
      {
        id: 'barracks', name: 'Barracks', cost: 100, hp: 500, income: 2,
        spawnInterval: 4900, unit: 'shieldwall',
        description: 'Trains hardened shield infantry to hold the front line.',
        levelNames: ['Barracks', 'Ironclad Barracks', 'Frostguard Citadel']
      },
      {
        id: 'archery_range', name: 'Archery Range', cost: 130, hp: 400, income: 2,
        spawnInterval: 5880, unit: 'longbow',
        description: 'Produces expert longbowmen with devastating range.',
        levelNames: ['Archery Range', 'Sharpshooter Lodge', 'Hall of the Marksman']
      },
      {
        id: 'stables', name: 'War Stables', cost: 180, hp: 480, income: 3,
        spawnInterval: 7350, unit: 'warhorse',
        description: 'Breeds mighty warhorses and trains their riders.',
        levelNames: ['War Stables', 'Destrier Keep', 'Vanguard Stables']
      },
      {
        id: 'siege_workshop', name: 'Siege Workshop', cost: 260, hp: 600, income: 3,
        spawnInterval: 10780, unit: 'siege_tower',
        description: 'Constructs massive siege towers to breach enemy walls.',
        levelNames: ['Siege Workshop', 'War Foundry', 'Titan Forge']
      },
      {
        id: 'falconry', name: 'Falconry', cost: 200, hp: 380, income: 2,
        spawnInterval: 8820, unit: 'snow_hawk',
        description: 'Trains fierce snow hawks to strike from above.',
        levelNames: ['Falconry', 'Raptor Spire', 'Stormwing Eyrie']
      },
      {
        id: 'gold_mine', name: 'Gold Mine', cost: 200, hp: 300, income: 10,
        description: 'Boosts your income by +10 gold every 5 seconds.'
      },
      {
        id: 'frost_tower', name: 'Frost Tower', cost: 150, hp: 600, income: 1,
        isTower: true, towerDamage: 20, towerRange: 280, towerAttackSpeed: 1800,
        description: 'Defensive tower that fires ice bolts at approaching enemies.'
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
        hp: 38, damage: 12, speed: 34, range: 220, attackSpeed: 5200,
        description: 'Expert archers with deadly range and precision'
      },
      {
        id: 'warhorse', name: 'Warhorse Rider', type: 'cavalry',
        hp: 95, damage: 13, speed: 75, range: 32, attackSpeed: 1100,
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
    ],
    l3Eligible: ['barracks', 'stables'],
    general: { name: 'Warden General', description: 'Northern field commander' }
  },

  // ─────────────────────────────────────────────────────────────────────
  // 2. THE DRAGON EMPRESS - Aggressive fire power, strong late game
  // ─────────────────────────────────────────────────────────────────────
  dragon_empress: {
    id: 'dragon_empress',
    name: 'The Dragon Empress',
    title: 'Mother of Flames',
    description: 'Commands the fury of dragonfire. Her forces grow fearsome in the later stages of battle, with powerful fire mages and dragons that dominate the skies.',
    lore: 'Born amid salt and smoke, the Dragon Empress rose from exile to command the last dragons.',
    color: '#c0392b',
    accentColor: '#e74c3c',
    darkColor: '#7b241c',
    passive: {
      name: 'Dragonfire',
      description: 'All units deal +12% damage',
      type: 'unit_damage',
      value: 0.12
    },
    hero: {
      id: 'dragon_queen', name: 'Dragon Queen', type: 'ranged',
      hp: 600, damage: 45, speed: 45, range: 250, attackSpeed: 1800,
      description: 'Commands dragonfire from afar with devastating magical power'
    },
    buildings: [
      {
        id: 'spear_hall', name: 'Spear Hall', cost: 100, hp: 420, income: 2,
        spawnInterval: 4900, unit: 'unsullied',
        description: 'Trains disciplined spearmen who never break formation.',
        levelNames: ['Spear Hall', 'Unsullied Fortress', 'Obsidian Garrison']
      },
      {
        id: 'fire_temple', name: 'Fire Temple', cost: 160, hp: 380, income: 2,
        spawnInterval: 6860, unit: 'fire_mage',
        description: 'Channels dark fire magic into devastating mages.',
        levelNames: ['Fire Temple', 'Advanced Fire Temple', 'Inferno Sanctum']
      },
      {
        id: 'flame_stables', name: 'Flame Stables', cost: 170, hp: 440, income: 3,
        spawnInterval: 6860, unit: 'flame_rider',
        description: 'Breeds fire-touched steeds for mounted assault.',
        levelNames: ['Flame Stables', 'Emberhorn Stables', 'Hellfire Paddock']
      },
      {
        id: 'scorpion_foundry', name: 'Scorpion Foundry', cost: 240, hp: 520, income: 3,
        spawnInterval: 9800, unit: 'scorpion',
        description: 'Forges massive scorpion ballistas to shatter defenses.',
        levelNames: ['Scorpion Foundry', 'Dragonslayer Forge', 'Doom Armory']
      },
      {
        id: 'dragon_roost', name: 'Dragon Roost', cost: 300, hp: 450, income: 4,
        spawnInterval: 13720, unit: 'young_dragon',
        description: 'Nurtures young dragons into terrifying war beasts.',
        levelNames: ['Dragon Roost', 'Wyrm Sanctuary', 'Dragon Spire']
      },
      {
        id: 'gold_mine', name: 'Gold Mine', cost: 200, hp: 300, income: 10,
        description: 'Boosts your income by +10 gold every 5 seconds.'
      },
      {
        id: 'flame_spire', name: 'Flame Spire', cost: 160, hp: 500, income: 1,
        isTower: true, towerDamage: 28, towerRange: 250, towerAttackSpeed: 2200,
        description: 'Launches fireballs that scorch enemies from afar.'
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
        hp: 32, damage: 18, speed: 30, range: 190, attackSpeed: 5720,
        description: 'Channelers of devastating dragonfire magic'
      },
      {
        id: 'flame_rider', name: 'Flame Rider', type: 'cavalry',
        hp: 80, damage: 13, speed: 72, range: 30, attackSpeed: 1000,
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
    ],
    l3Eligible: ['spear_hall', 'dragon_roost'],
    general: { name: 'Flame General', description: 'Dragonfire field commander' }
  },

  // ─────────────────────────────────────────────────────────────────────
  // 3. THE IRON ADMIRAL - Siege specialists, raider tactics
  // ─────────────────────────────────────────────────────────────────────
  iron_admiral: {
    id: 'iron_admiral',
    name: 'The Iron Admiral',
    title: 'Lord of the Salted Shores',
    description: 'A brutal warlord from the iron coasts. His forces specialize in destroying structures with powerful siege weapons and overwhelming raider tactics.',
    lore: 'What is dead may never die. The Iron Admiral pays the iron price for all he takes.',
    color: '#1a8a7a',
    accentColor: '#2ecc71',
    darkColor: '#0e524a',
    passive: {
      name: 'Iron Price',
      description: 'Siege units deal +30% damage to buildings & castle',
      type: 'siege_building_damage',
      value: 0.30
    },
    hero: {
      id: 'admiral_ironhand', name: 'Admiral Ironhand', type: 'infantry',
      hp: 750, damage: 40, speed: 55, range: 38, attackSpeed: 900,
      description: 'A relentless sea warrior wielding a massive iron axe'
    },
    buildings: [
      {
        id: 'raider_camp', name: 'Raider Camp', cost: 90, hp: 400, income: 2,
        spawnInterval: 4410, unit: 'reaver',
        description: 'Musters hardened ironborn reavers for the front.',
        levelNames: ['Raider Camp', 'Ironborn Stronghold', 'Reaver Fortress']
      },
      {
        id: 'crossbow_tower', name: 'Crossbow Tower', cost: 130, hp: 420, income: 2,
        spawnInterval: 5880, unit: 'crossbowman',
        description: 'Trains marksmen with armor-piercing crossbows.',
        levelNames: ['Crossbow Tower', 'Salted Marksman Hall', 'Bolt Storm Bastion']
      },
      {
        id: 'chariot_works', name: 'Chariot Works', cost: 170, hp: 460, income: 3,
        spawnInterval: 6860, unit: 'war_chariot',
        description: 'Builds devastating war chariots that trample foes.',
        levelNames: ['Chariot Works', 'Iron Wheelhouse', 'Doomchariot Forge']
      },
      {
        id: 'ram_forge', name: 'Ram Forge', cost: 220, hp: 580, income: 3,
        spawnInterval: 8820, unit: 'battering_ram',
        description: 'Forges iron-shod battering rams to break any gate.',
        levelNames: ['Ram Forge', 'Ironclad Smithy', 'Kraken Forge']
      },
      {
        id: 'storm_rookery', name: 'Storm Rookery', cost: 190, hp: 360, income: 2,
        spawnInterval: 7840, unit: 'storm_petrel',
        description: 'Breeds fierce storm birds for aerial harassment.',
        levelNames: ['Storm Rookery', 'Tempest Aviary', 'Thunderwing Spire']
      },
      {
        id: 'gold_mine', name: 'Gold Mine', cost: 200, hp: 300, income: 10,
        description: 'Boosts your income by +10 gold every 5 seconds.'
      },
      {
        id: 'harpoon_tower', name: 'Harpoon Tower', cost: 140, hp: 550, income: 1,
        isTower: true, towerDamage: 22, towerRange: 270, towerAttackSpeed: 2000,
        description: 'Fires iron harpoons at enemies within range.'
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
        hp: 42, damage: 13, speed: 32, range: 200, attackSpeed: 5200,
        description: 'Crossbowmen with armor-piercing bolts'
      },
      {
        id: 'war_chariot', name: 'War Chariot', type: 'cavalry',
        hp: 85, damage: 13, speed: 68, range: 34, attackSpeed: 1100,
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
    ],
    l3Eligible: ['raider_camp', 'ram_forge'],
    general: { name: 'Iron General', description: 'Ironborn war commander' }
  },

  // ─────────────────────────────────────────────────────────────────────
  // 4. THE GOLDEN LORD - Economic powerhouse, elite mercenaries
  // ─────────────────────────────────────────────────────────────────────
  golden_lord: {
    id: 'golden_lord',
    name: 'The Golden Lord',
    title: 'Keeper of the Gilded Vault',
    description: 'Wealth is the ultimate weapon. The Golden Lord\'s buildings generate more income, allowing him to field an ever-growing army of elite mercenaries.',
    lore: 'A Lannister always pays his debts. The Golden Lord\'s coffers run deeper than any mine.',
    color: '#d4a017',
    accentColor: '#f1c40f',
    darkColor: '#7d6010',
    passive: {
      name: 'Gilded Coffers',
      description: 'All buildings generate +15% more gold income',
      type: 'building_income',
      value: 0.15
    },
    hero: {
      id: 'golden_champion', name: 'The Golden Champion', type: 'cavalry',
      hp: 700, damage: 38, speed: 70, range: 35, attackSpeed: 1000,
      description: 'An elite mounted knight clad in gilded armor'
    },
    buildings: [
      {
        id: 'sellsword_camp', name: 'Sellsword Camp', cost: 90, hp: 380, income: 3,
        spawnInterval: 4900, unit: 'sellsword',
        description: 'Hires cheap but effective mercenary soldiers.',
        levelNames: ['Sellsword Camp', 'Mercenary Barracks', 'Golden Company Hall']
      },
      {
        id: 'guild_hall', name: 'Arbalist Guild', cost: 140, hp: 400, income: 3,
        spawnInterval: 6370, unit: 'arbalist',
        description: 'Trains guild arbalists with devastating heavy crossbows.',
        levelNames: ['Arbalist Guild', 'Gilded Marksman Hall', 'Sharpshot Citadel']
      },
      {
        id: 'champions_arena', name: "Champion's Arena", cost: 200, hp: 480, income: 4,
        spawnInterval: 7840, unit: 'mounted_champion',
        description: 'Produces elite mounted champions of the realm.',
        levelNames: ["Champion's Arena", 'Grand Tournament Hall', 'Legendary Colosseum']
      },
      {
        id: 'golden_foundry', name: 'Golden Foundry', cost: 270, hp: 520, income: 4,
        spawnInterval: 10780, unit: 'golden_trebuchet',
        description: 'Constructs ornate but deadly golden trebuchets.',
        levelNames: ['Golden Foundry', 'Imperial War Works', 'Crown Siege Citadel']
      },
      {
        id: 'eagle_spire', name: 'Eagle Spire', cost: 210, hp: 360, income: 3,
        spawnInterval: 8330, unit: 'war_eagle',
        description: 'Houses trained war eagles for aerial superiority.',
        levelNames: ['Eagle Spire', 'Gilded Eyrie', 'Royal Eagle Pinnacle']
      },
      {
        id: 'gold_mine', name: 'Gold Mine', cost: 200, hp: 300, income: 10,
        description: 'Boosts your income by +10 gold every 5 seconds.'
      },
      {
        id: 'gilded_bastion', name: 'Gilded Bastion', cost: 170, hp: 520, income: 1,
        isTower: true, towerDamage: 24, towerRange: 260, towerAttackSpeed: 1900,
        description: 'An ornate tower that defends with golden bolts.'
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
        hp: 36, damage: 15, speed: 33, range: 210, attackSpeed: 5460,
        description: 'Elite crossbow specialists with piercing bolts'
      },
      {
        id: 'mounted_champion', name: 'Mounted Champion', type: 'cavalry',
        hp: 100, damage: 13, speed: 70, range: 33, attackSpeed: 1100,
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
    ],
    l3Eligible: ['sellsword_camp', 'champions_arena'],
    general: { name: 'Golden General', description: 'Gilded field marshal' }
  },

  // ─────────────────────────────────────────────────────────────────────
  // 5. THE SHADOW PRIEST - Dark magic, undead swarms, attrition
  // ─────────────────────────────────────────────────────────────────────
  shadow_priest: {
    id: 'shadow_priest',
    name: 'The Shadow Priest',
    title: 'Herald of the Endless Night',
    description: 'Commands the forces of darkness and death. Cheap undead units swarm the battlefield in overwhelming numbers, wearing down even the mightiest defenses.',
    lore: 'The night is dark and full of terrors. The Shadow Priest draws power from beyond the veil.',
    color: '#8e44ad',
    accentColor: '#bb6bd9',
    darkColor: '#5b2c6f',
    passive: {
      name: 'Endless Legion',
      description: 'All buildings spawn units 20% faster',
      type: 'spawn_speed',
      value: 0.20
    },
    hero: {
      id: 'necromancer', name: 'The Necromancer', type: 'ranged',
      hp: 550, damage: 50, speed: 40, range: 220, attackSpeed: 2000,
      description: 'A dark sorcerer who drains life with shadowy magic'
    },
    buildings: [
      {
        id: 'crypt', name: 'Crypt', cost: 80, hp: 360, income: 2,
        spawnInterval: 3920, unit: 'skeleton',
        description: 'Raises skeleton warriors from the earth below.',
        levelNames: ['Crypt', 'Tomb of the Risen', 'Necropolis']
      },
      {
        id: 'dark_altar', name: 'Dark Altar', cost: 120, hp: 340, income: 2,
        spawnInterval: 5390, unit: 'plague_archer',
        description: 'Corrupts souls into plague-bearing archers.',
        levelNames: ['Dark Altar', 'Plague Shrine', 'Altar of Undeath']
      },
      {
        id: 'doom_stable', name: 'Doom Stables', cost: 190, hp: 440, income: 3,
        spawnInterval: 7840, unit: 'death_knight',
        description: 'Summons dread knights upon undead steeds.',
        levelNames: ['Doom Stables', 'Dread Rider Crypt', 'Spectral Stables']
      },
      {
        id: 'bone_forge', name: 'Bone Forge', cost: 230, hp: 500, income: 3,
        spawnInterval: 9800, unit: 'bone_colossus',
        description: 'Assembles colossal constructs from the bones of the fallen.',
        levelNames: ['Bone Forge', 'Ossuary Foundry', 'Colossus Catacombs']
      },
      {
        id: 'shadow_aerie', name: 'Shadow Aerie', cost: 180, hp: 320, income: 2,
        spawnInterval: 7350, unit: 'wraith',
        description: 'Unleashes incorporeal wraiths that haunt the skies.',
        levelNames: ['Shadow Aerie', 'Wraith Spire', 'Phantom Pinnacle']
      },
      {
        id: 'gold_mine', name: 'Gold Mine', cost: 200, hp: 300, income: 10,
        description: 'Boosts your income by +10 gold every 5 seconds.'
      },
      {
        id: 'dark_obelisk', name: 'Dark Obelisk', cost: 130, hp: 450, income: 1,
        isTower: true, towerDamage: 30, towerRange: 240, towerAttackSpeed: 2400,
        description: 'Channels dark energy to blast nearby enemies.'
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
        hp: 28, damage: 10, speed: 35, range: 190, attackSpeed: 4680,
        description: 'Undead archer whose arrows carry deadly plague'
      },
      {
        id: 'death_knight', name: 'Death Knight', type: 'cavalry',
        hp: 110, damage: 13, speed: 65, range: 32, attackSpeed: 1200,
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
    ],
    l3Eligible: ['crypt', 'doom_stable'],
    general: { name: 'Dark General', description: 'Shadow war commander' }
  },

  // ─────────────────────────────────────────────────────────────────────
  // 6. THE FOREST WARDEN - Nature magic, healing, balanced forces
  // ─────────────────────────────────────────────────────────────────────
  forest_warden: {
    id: 'forest_warden',
    name: 'The Forest Warden',
    title: 'Guardian of the Ancient Grove',
    description: 'Protector of the old forests. Nature magic heals and sustains troops over time, making them difficult to wear down. A balanced force with excellent staying power.',
    lore: 'In the heart of the ancient wood, the Forest Warden commands root and branch, beast and bird.',
    color: '#27ae60',
    accentColor: '#58d68d',
    darkColor: '#1a7a42',
    passive: {
      name: 'Nature\'s Blessing',
      description: 'All units regenerate 2 HP per second',
      type: 'unit_regen',
      value: 2
    },
    hero: {
      id: 'ancient_guardian', name: 'The Ancient Guardian', type: 'infantry',
      hp: 900, damage: 30, speed: 45, range: 45, attackSpeed: 1200,
      description: 'A massive treant spirit that regenerates in battle'
    },
    buildings: [
      {
        id: 'grove', name: 'Sentinel Grove', cost: 100, hp: 450, income: 2,
        spawnInterval: 4900, unit: 'sentinel',
        description: 'Grows woodland sentinels from the heart of the forest.',
        levelNames: ['Sentinel Grove', 'Ancient Wardenwood', 'Heart of the Forest']
      },
      {
        id: 'glade', name: 'Enchanted Glade', cost: 130, hp: 380, income: 2,
        spawnInterval: 5880, unit: 'elven_archer',
        description: 'A mystical clearing where elven archers train.',
        levelNames: ['Enchanted Glade', 'Starlight Glade', 'Moonbow Sanctuary']
      },
      {
        id: 'beastiary', name: 'Beastiary', cost: 180, hp: 460, income: 3,
        spawnInterval: 7350, unit: 'stag_rider',
        description: 'Tames great stags as mounts for swift riders.',
        levelNames: ['Beastiary', 'Wild Warden Lodge', 'Primal Beastiary']
      },
      {
        id: 'ancient_oak', name: 'Ancient Oak', cost: 250, hp: 650, income: 3,
        spawnInterval: 11760, unit: 'treant',
        description: 'Awakens ancient treants from slumbering oaks.',
        levelNames: ['Ancient Oak', 'Elder Heartwood', 'World Tree Sapling']
      },
      {
        id: 'eagle_nest', name: 'Eagle Nest', cost: 200, hp: 370, income: 2,
        spawnInterval: 8330, unit: 'great_eagle',
        description: 'Home to great eagles that patrol the forest canopy.',
        levelNames: ['Eagle Nest', 'Windcaller Aerie', 'Skywarden Eyrie']
      },
      {
        id: 'gold_mine', name: 'Gold Mine', cost: 200, hp: 300, income: 10,
        description: 'Boosts your income by +10 gold every 5 seconds.'
      },
      {
        id: 'thornwood_tower', name: 'Thornwood Tower', cost: 150, hp: 580, income: 1,
        isTower: true, towerDamage: 18, towerRange: 290, towerAttackSpeed: 1600,
        description: 'Living tower that fires enchanted thorns rapidly.'
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
        hp: 34, damage: 14, speed: 36, range: 230, attackSpeed: 4940,
        description: 'Graceful archers with supernaturally accurate aim'
      },
      {
        id: 'stag_rider', name: 'Stag Rider', type: 'cavalry',
        hp: 88, damage: 13, speed: 78, range: 30, attackSpeed: 1050,
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
    ],
    l3Eligible: ['grove', 'beastiary'],
    general: { name: 'Grove General', description: 'Forest war commander' }
  }
};

const CASTLE_DEF = {
  hp: 8000,
  maxHp: 8000,
  width: 120,
  height: 140
};

const GAME_CONSTANTS = {
  MAP_WIDTH: 3200,
  MAP_HEIGHT: 1600,
  BASE_INCOME: 8,
  INCOME_INTERVAL: 5000,
  INTEREST_RATE: 0.02,
  STARTING_GOLD: 70,
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
  UNIT_DETECTION_RANGE: 300,
  FOG_CASTLE_RANGE: 450,
  FOG_BUILDING_RANGE: 300,
  FOG_UNIT_RANGE: 250,
  FOG_HERO_RANGE: 400,
  TICK_RATE: 20,
  BASE_SPAWN_INTERVAL: 20000,
  L2_SPAWN_INTERVAL: 30000,
  L3_SPAWN_INTERVAL: 30000,
  L2_COST_MULT: 1.5,
  L3_COST_MULT: 2.0,
  L2_HP_MULT: 1.3,
  L2_DMG_MULT: 1.25,
  L3_HP_MULT: 1.6,
  L3_DMG_MULT: 1.5,
  CORE_FOUNDATION_COST: 750,
  // Gold Mine is now a building definition — cost/income in each character's buildings array
  // General constants — DISABLED (code preserved)
  GENERAL_HP: 500,
  GENERAL_DAMAGE: 25,
  GENERAL_SPEED: 45,
  GENERAL_RANGE: 45,
  GENERAL_ATTACK_SPEED: 1200,
  GENERAL_AURA_RANGE: 200
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CHARACTERS, COMBAT_MODIFIERS, CAN_HIT_FLYING, CASTLE_DEF, GAME_CONSTANTS };
}
