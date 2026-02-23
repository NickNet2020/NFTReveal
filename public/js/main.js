// ═══════════════════════════════════════════════════════════════════════
// Castle Fight - Client Game Logic
// Networking, Input, Camera, UI, Game Loop
// ═══════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── DOM Elements ───────────────────────────────────────────────
  const titleScreen = document.getElementById('titleScreen');
  const matchmakingScreen = document.getElementById('matchmakingScreen');
  const gameScreen = document.getElementById('gameScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const gameCanvas = document.getElementById('gameCanvas');
  const minimapCanvas = document.getElementById('minimapCanvas');
  const playerNameInput = document.getElementById('playerName');
  const findMatchBtn = document.getElementById('findMatchBtn');
  const characterGrid = document.getElementById('characterGrid');
  const buildingList = document.getElementById('buildingList');
  const rescueStrikeBtn = document.getElementById('rescueStrikeBtn');
  const goldDisplay = document.getElementById('goldDisplay');
  const incomeDisplay = document.getElementById('incomeDisplay');
  const gameTimer = document.getElementById('gameTimer');
  const myCastleHpBar = document.getElementById('myCastleHpBar');
  const myCastleHpText = document.getElementById('myCastleHpText');
  const enemyCastleHpBar = document.getElementById('enemyCastleHpBar');
  const enemyCastleHpText = document.getElementById('enemyCastleHpText');
  const myCastleLabel = document.getElementById('myCastleLabel');
  const enemyCastleLabel = document.getElementById('enemyCastleLabel');
  const myCastleFaction = document.getElementById('myCastleFaction');
  const enemyCastleFaction = document.getElementById('enemyCastleFaction');
  const passiveText = document.getElementById('passiveText');
  const foundationDisplay = document.getElementById('foundationDisplay');
  const buyFoundationBtn = document.getElementById('buyFoundationBtn');
  // buyGoldMineBtn removed — Gold Mine is now a placeable building
  const gameOverTitle = document.getElementById('gameOverTitle');
  const gameOverSub = document.getElementById('gameOverSub');
  const gameOverDuration = document.getElementById('gameOverDuration');
  const playAgainBtn = document.getElementById('playAgainBtn');

  // ─── State ─────────────────────────────────────────────────────
  let socket;
  let selectedCharacterId = null;
  let mySide = 'left';
  let myCharacterId = null;
  let opponentCharacterId = null;
  let gameState = null;
  let gameActive = false;
  let lastFrameTime = 0;

  // Camera
  let camera = {
    x: 0, y: 0,
    targetX: 0, targetY: 0,
    zoom: 0.65,
    minZoom: 0.3,
    maxZoom: 2.0,
    screenW: window.innerWidth,
    screenH: window.innerHeight
  };

  // Input
  let keys = {};
  let mouse = { x: 0, y: 0, worldX: 0, worldY: 0 };
  let isPlacing = false;
  let selectedBuildingType = null;

  // Selection (units and buildings)
  let selectedUnitId = null;
  let selectedUnitName = null;
  let selectedBuildingId = null;
  let bannerEl = null;
  let pendingUpgradeBtn = null;

  // Name generator for units
  const UNIT_NAMES = [
    'Aedric', 'Baldric', 'Cedric', 'Duncan', 'Edmund', 'Fendrel',
    'Gareth', 'Harald', 'Ivar', 'Joffrey', 'Kael', 'Landon',
    'Marcus', 'Nolan', 'Osric', 'Percival', 'Quinlan', 'Roderick',
    'Siegfried', 'Theron', 'Ulric', 'Viktor', 'Wilhelm', 'Xander',
    'Yorick', 'Zephyr', 'Aldric', 'Bramwell', 'Corwin', 'Darian',
    'Eddard', 'Fyric', 'Gendry', 'Tormund', 'Bronn', 'Sandor',
    'Beric', 'Thoros', 'Barristan', 'Renly', 'Stannis', 'Oberyn'
  ];

  function getUnitDisplayName(unit) {
    const nameIndex = unit.id % UNIT_NAMES.length;
    const name = UNIT_NAMES[nameIndex];
    const charData = CHARACTERS[unit.characterId];
    const unitDef = charData ? charData.units.find(u => u.id === unit.typeId) : null;
    const typeName = unitDef ? unitDef.name : unit.unitType;
    return `${name} the ${typeName}`;
  }

  // Character icon map
  const CHAR_ICONS = {
    northern_lord: '&#x2744;',   // snowflake
    dragon_empress: '&#x1F525;', // fire
    iron_admiral: '&#x2693;',    // anchor
    golden_lord: '&#x1F451;',    // crown
    shadow_priest: '&#x1F480;',  // skull
    forest_warden: '&#x1F333;',  // tree
    orc_warchief: '&#x1F479;'   // ogre
  };

  // ─── Initialize ─────────────────────────────────────────────────
  function init() {
    socket = io();
    Renderer.init(gameCanvas);
    buildCharacterGrid();
    setupEventListeners();
    setupSocketListeners();
    gameLoop(0);
  }

  // ─── Build Character Selection Grid ────────────────────────────
  function buildCharacterGrid() {
    characterGrid.innerHTML = '';
    for (const [id, char] of Object.entries(CHARACTERS)) {
      const card = document.createElement('div');
      card.className = 'char-card';
      card.dataset.charId = id;
      card.style.setProperty('--char-color', char.color);

      card.innerHTML = `
        <div class="char-emblem" style="border-color: ${char.color}; color: ${char.color}">
          ${CHAR_ICONS[id] || '&#9876;'}
        </div>
        <div class="char-name">${char.name}</div>
        <div class="char-title" style="color: ${char.color}">${char.title}</div>
        <div class="char-passive"><strong>${char.passive.name}:</strong> ${char.passive.description}</div>
        <div class="char-desc">${char.description}</div>
      `;

      card.addEventListener('click', () => selectCharacter(id));
      characterGrid.appendChild(card);
    }
  }

  function selectCharacter(charId) {
    selectedCharacterId = charId;
    document.querySelectorAll('.char-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.charId === charId);
    });
    findMatchBtn.disabled = false;
  }

  // ─── Build Building Panel ──────────────────────────────────────
  function buildBuildingPanel() {
    if (!myCharacterId || !CHARACTERS[myCharacterId]) return;
    const char = CHARACTERS[myCharacterId];
    buildingList.innerHTML = '';

    for (const b of char.buildings) {
      const unitDef = char.units.find(u => u.id === b.unit);
      const item = document.createElement('div');
      item.className = 'building-item';
      item.dataset.buildingId = b.id;

      const spawnInfo = b.isTower ? 'Defense Tower' : (unitDef ? `Spawns: ${unitDef.name}` : 'Income Building');
      item.innerHTML = `
        <div class="building-header">
          <span class="building-name">${b.name}</span>
          <span class="building-cost">${b.cost}g</span>
        </div>
        <div class="building-desc">${b.description}</div>
        <div class="building-stats">
          <span class="building-stat">+${b.income}g/5s</span>
          <span class="building-stat">${spawnInfo}</span>
        </div>
      `;

      item.addEventListener('click', () => {
        if (item.classList.contains('cant-afford')) return;
        toggleBuildingSelection(b.id);
      });

      buildingList.appendChild(item);
    }
  }

  function toggleBuildingSelection(buildingId) {
    if (selectedBuildingType === buildingId) {
      // Deselect
      selectedBuildingType = null;
      isPlacing = false;
      gameCanvas.classList.remove('placing');
    } else {
      selectedBuildingType = buildingId;
      isPlacing = true;
      gameCanvas.classList.add('placing');
    }

    document.querySelectorAll('.building-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.buildingId === selectedBuildingType);
    });
  }

  function updateBuildingAffordability(gold) {
    if (!myCharacterId || !CHARACTERS[myCharacterId]) return;
    const char = CHARACTERS[myCharacterId];
    document.querySelectorAll('.building-item').forEach(item => {
      const bDef = char.buildings.find(b => b.id === item.dataset.buildingId);
      if (bDef) {
        item.classList.toggle('cant-afford', gold < bDef.cost);
      }
    });
    // Resource shop affordability
    if (buyFoundationBtn) buyFoundationBtn.classList.toggle('cant-afford', gold < GAME_CONSTANTS.CORE_FOUNDATION_COST);
    // buyGoldMineBtn affordability removed — Gold Mine is now a placeable building
  }

  // ─── Event Listeners ──────────────────────────────────────────
  function setupEventListeners() {
    // Find match button
    findMatchBtn.addEventListener('click', () => {
      if (!selectedCharacterId) return;
      const name = playerNameInput.value.trim() || 'Unnamed Lord';
      socket.emit('findMatch', { characterId: selectedCharacterId, name });
      titleScreen.classList.add('hidden');
      matchmakingScreen.classList.remove('hidden');
    });

    // Play again
    playAgainBtn.addEventListener('click', () => {
      gameOverScreen.classList.add('hidden');
      titleScreen.classList.remove('hidden');
      gameActive = false;
      gameState = null;
      particles.clear();
    });

    // Rescue strike
    rescueStrikeBtn.addEventListener('click', () => {
      if (rescueStrikeBtn.classList.contains('used')) return;
      socket.emit('rescueStrike');
    });

    // Buy core foundation
    buyFoundationBtn.addEventListener('click', () => {
      if (!gameActive) return;
      socket.emit('buyFoundation');
    });

    // buyGoldMine button removed — Gold Mine is now a placeable building

    // Keyboard
    window.addEventListener('keydown', (e) => {
      keys[e.key.toLowerCase()] = true;
      // Number keys to select buildings
      const num = parseInt(e.key);
      if (num >= 1 && num <= 5 && gameActive && myCharacterId) {
        const char = CHARACTERS[myCharacterId];
        if (char && char.buildings[num - 1]) {
          toggleBuildingSelection(char.buildings[num - 1].id);
        }
      }
      // Escape to cancel placement and deselect unit
      if (e.key === 'Escape') {
        selectedBuildingType = null;
        isPlacing = false;
        gameCanvas.classList.remove('placing');
        document.querySelectorAll('.building-item').forEach(i => i.classList.remove('selected'));
        deselectUnit();
      }
      // R for rescue strike
      if (e.key.toLowerCase() === 'r' && gameActive) {
        if (!rescueStrikeBtn.classList.contains('used')) {
          socket.emit('rescueStrike');
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.key.toLowerCase()] = false;
    });

    // Mouse
    gameCanvas.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      // Convert to world coordinates
      const world = Renderer.screenToWorld(e.clientX, e.clientY);
      mouse.worldX = world.x;
      mouse.worldY = world.y;
    });

    gameCanvas.addEventListener('click', (e) => {
      if (!gameActive) return;

      // Placement mode — build
      if (isPlacing && selectedBuildingType) {
        const world = Renderer.screenToWorld(e.clientX, e.clientY);
        socket.emit('build', {
          buildingTypeId: selectedBuildingType,
          x: world.x,
          y: world.y
        });
        return;
      }

      // Unit selection mode
      const world = Renderer.screenToWorld(e.clientX, e.clientY);
      trySelectUnit(world.x, world.y);
    });

    // Right-click — general move DISABLED
    gameCanvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      // General movement removed
    });

    // Mouse wheel zoom
    gameCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? -0.05 : 0.05;
      // Dynamic min zoom: battlefield must fill at least 85% of the screen
      const minZoom = Math.max(0.85 * camera.screenW / GAME_CONSTANTS.MAP_WIDTH, 0.85 * camera.screenH / GAME_CONSTANTS.MAP_HEIGHT);
      camera.zoom = Math.max(minZoom, Math.min(camera.maxZoom, camera.zoom + zoomDelta));
    }, { passive: false });

    // Minimap click to pan
    minimapCanvas.addEventListener('click', (e) => {
      const rect = minimapCanvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;
      camera.targetX = mx * GAME_CONSTANTS.MAP_WIDTH;
      camera.targetY = my * GAME_CONSTANTS.MAP_HEIGHT;
    });

    // Window resize
    window.addEventListener('resize', () => {
      camera.screenW = window.innerWidth;
      camera.screenH = window.innerHeight;
      // Re-clamp zoom so battlefield stays at least 85% of screen
      const minZoom = Math.max(0.85 * camera.screenW / GAME_CONSTANTS.MAP_WIDTH, 0.85 * camera.screenH / GAME_CONSTANTS.MAP_HEIGHT);
      if (camera.zoom < minZoom) camera.zoom = minZoom;
    });
  }

  // ─── Socket Listeners ─────────────────────────────────────────
  function setupSocketListeners() {
    socket.on('matchmaking', (data) => {
      // Still searching
    });

    socket.on('gameStart', (data) => {
      matchmakingScreen.classList.add('hidden');
      gameScreen.classList.remove('hidden');
      gameActive = true;

      mySide = data.side;
      myCharacterId = data.yourCharacter;
      opponentCharacterId = data.opponentCharacter;

      Renderer.setDecorations(data.decorations);
      Renderer.setSide(mySide);

      // Set initial camera position
      const GC = data.constants;
      if (mySide === 'left') {
        camera.targetX = GC.P1_CASTLE_X + 200;
        camera.targetY = GC.CASTLE_Y;
        camera.x = camera.targetX;
        camera.y = camera.targetY;
      } else {
        camera.targetX = GC.P2_CASTLE_X - 200;
        camera.targetY = GC.CASTLE_Y;
        camera.x = camera.targetX;
        camera.y = camera.targetY;
      }

      // Setup building panel
      buildBuildingPanel();

      // Set labels
      const myChar = CHARACTERS[myCharacterId];
      const oppChar = CHARACTERS[opponentCharacterId];
      myCastleLabel.textContent = myChar ? myChar.name : 'Your Castle';
      myCastleLabel.style.color = myChar ? myChar.color : '#fff';
      myCastleFaction.textContent = myChar ? myChar.title : '';
      enemyCastleLabel.textContent = data.opponentName || (oppChar ? oppChar.name : 'Enemy');
      enemyCastleLabel.style.color = oppChar ? oppChar.color : '#fff';
      enemyCastleFaction.textContent = oppChar ? oppChar.title : '';

      // Set passive display
      if (myChar) {
        passiveText.textContent = `${myChar.passive.name}: ${myChar.passive.description}`;
      }

      // Initialize audio
      AudioManager.init();
      AudioManager.startMusic();

      console.log(`Game started! Playing as ${myChar.name} (${mySide})`);
    });

    socket.on('state', (data) => {
      triggerAudio(data);
      gameState = data;
      updateHUD(data);
      updateSelectedUnit();
    });

    socket.on('buildResult', (data) => {
      if (data.success) {
        AudioManager.playBuildingPlace();
      } else {
        showToast(data.reason || 'Cannot build there');
      }
    });

    socket.on('rescueStrike', (data) => {
      particles.rescueStrikeEffect(data.x, data.y, data.radius);
      AudioManager.playRescueStrike();
    });

    socket.on('rescueStrikeResult', (data) => {
      if (!data.success) {
        showToast('Rescue Strike already used!');
      }
    });

    socket.on('gameOver', (data) => {
      gameActive = false;
      deselectUnit();
      gameScreen.classList.add('hidden');
      gameOverScreen.classList.remove('hidden');

      const won = data.winner === mySide;
      AudioManager.stopMusic();
      setTimeout(() => won ? AudioManager.playVictory() : AudioManager.playDefeat(), 500);
      gameOverTitle.textContent = won ? 'Victory!' : 'Defeat';
      gameOverTitle.className = won ? 'victory-title' : 'defeat-title';
      gameOverSub.textContent = won
        ? 'The enemy castle has fallen before your might!'
        : data.reason === 'disconnect'
          ? 'Your opponent has retreated from battle.'
          : 'Your castle has been reduced to rubble.';

      const duration = Math.floor((data.duration || 0) / 1000);
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      gameOverDuration.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    });

    socket.on('upgradeResult', (data) => {
      if (data.success) {
        showToast(`Building upgraded to Level ${data.level}!`);
        AudioManager.playBuildingPlace();
      } else {
        showToast(data.reason || 'Cannot upgrade');
      }
    });

    socket.on('foundationResult', (data) => {
      if (data.success) {
        showToast(`Core Foundation acquired! (${data.count} total)`);
        AudioManager.playGoldGain();
      } else {
        showToast(data.reason || 'Cannot buy foundation');
      }
    });

    // goldMineResult removed — Gold Mine is now a placeable building

    socket.on('error', (data) => {
      showToast(data.message);
    });
  }

  // ─── HUD Updates ──────────────────────────────────────────────
  // ─── Audio Triggers ───────────────────────────────────────────
  let prevProjectileCount = 0;
  let prevDeathCount = 0;
  let prevGold = 0;

  function triggerAudio(data) {
    if (!AudioManager.isEnabled()) return;
    AudioManager.resume();

    // Combat sounds: fire whenever new projectiles appear
    const projs = (data.projectiles || []).length;
    if (projs > prevProjectileCount) {
      const newShots = projs - prevProjectileCount;
      for (let i = 0; i < Math.min(newShots, 3); i++) {
        setTimeout(() => {
          const p = data.projectiles[data.projectiles.length - 1 - i];
          if (p && p.isTower) AudioManager.playTowerShot();
          else if (p && p.attackerType === 'flying') AudioManager.playFlyingAttack();
          else AudioManager.playArrowFire();
        }, i * 40);
      }
    }
    prevProjectileCount = projs;

    // Melee clash: fire when damage numbers appear (non-projectile combat)
    const dmgNums = data.damageNumbers || [];
    if (dmgNums.length > 0) {
      const recent = dmgNums.filter(d => Date.now() - d.time < 100);
      if (recent.length > 0) {
        // Pick sound based on the attacker's unit type
        const sample = recent[0];
        const aType = sample.attackerType || 'infantry';
        if (aType === 'cavalry') AudioManager.playCavalryAttack();
        else if (aType === 'siege') AudioManager.playSiegeAttack();
        else if (aType === 'flying') AudioManager.playFlyingAttack();
        else AudioManager.playInfantryAttack();
      }
    }

    // Death sounds
    const deaths = (data.effects || []).filter(e => e.type === 'death').length;
    if (deaths > prevDeathCount) {
      AudioManager.playUnitDeath();
    }
    prevDeathCount = deaths;

    // Gold gain sound
    const gold = data.self ? data.self.gold : 0;
    if (gold > prevGold && prevGold > 0) {
      AudioManager.playGoldGain();
    }
    prevGold = gold;
  }

  function updateHUD(state) {
    if (!state.self) return;

    // Gold & income
    goldDisplay.textContent = state.self.gold;
    incomeDisplay.textContent = '+' + state.self.income;

    // Update building affordability
    updateBuildingAffordability(state.self.gold);

    // Castle HP
    const myCastle = mySide === 'left' ? state.castle1 : state.castle2;
    const enemyCastle = mySide === 'left' ? state.castle2 : state.castle1;

    if (myCastle) {
      const pct = Math.max(0, myCastle.hp / myCastle.maxHp) * 100;
      myCastleHpBar.style.width = pct + '%';
      myCastleHpText.textContent = `${Math.ceil(myCastle.hp)} / ${myCastle.maxHp}`;
    }

    if (enemyCastle) {
      const pct = Math.max(0, enemyCastle.hp / enemyCastle.maxHp) * 100;
      enemyCastleHpBar.style.width = pct + '%';
      enemyCastleHpText.textContent = `${Math.ceil(enemyCastle.hp)} / ${enemyCastle.maxHp}`;
    }

    // Game timer
    if (state.gameTime !== undefined) {
      const totalSec = Math.floor(state.gameTime / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      gameTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Rescue strike
    if (state.self.rescueStrikeUsed) {
      rescueStrikeBtn.classList.add('used');
      rescueStrikeBtn.disabled = true;
    }

    // Core foundations
    if (state.self.coreFoundations !== undefined) {
      foundationDisplay.textContent = state.self.coreFoundations;
    }
  }

  // ─── Camera Update ────────────────────────────────────────────
  function updateCamera(dt) {
    const panSpeed = 600 / camera.zoom;
    const edgePanThreshold = 30;
    const edgePanSpeed = 400 / camera.zoom;

    // WASD panning
    if (keys['w'] || keys['arrowup']) camera.targetY -= panSpeed * dt;
    if (keys['s'] || keys['arrowdown']) camera.targetY += panSpeed * dt;
    if (keys['a'] || keys['arrowleft']) camera.targetX -= panSpeed * dt;
    if (keys['d'] || keys['arrowright']) camera.targetX += panSpeed * dt;

    // Edge panning
    if (mouse.x < edgePanThreshold) camera.targetX -= edgePanSpeed * dt;
    if (mouse.x > camera.screenW - edgePanThreshold) camera.targetX += edgePanSpeed * dt;
    if (mouse.y < edgePanThreshold) camera.targetY -= edgePanSpeed * dt;
    if (mouse.y > camera.screenH - edgePanThreshold) camera.targetY += edgePanSpeed * dt;

    // Clamp camera so game fills ~85% of screen with even borders
    const GC = GAME_CONSTANTS;
    const halfViewW = camera.screenW / (2 * camera.zoom);
    const halfViewH = camera.screenH / (2 * camera.zoom);
    const marginW = halfViewW * 0.15;
    const marginH = halfViewH * 0.15;
    // Offset Y slightly to account for top HUD eating into visible area
    const hudOffset = 25 / camera.zoom;
    camera.targetX = Math.max(halfViewW - marginW, Math.min(GC.MAP_WIDTH - halfViewW + marginW, camera.targetX));
    camera.targetY = Math.max(halfViewH - marginH + hudOffset, Math.min(GC.MAP_HEIGHT - halfViewH + marginH + hudOffset, camera.targetY));

    // Smooth follow
    camera.x += (camera.targetX - camera.x) * Math.min(1, 8 * dt);
    camera.y += (camera.targetY - camera.y) * Math.min(1, 8 * dt);

    // Home key: snap to castle
    if (keys[' ']) {
      const GC = GAME_CONSTANTS;
      camera.targetX = mySide === 'left' ? GC.P1_CASTLE_X + 200 : GC.P2_CASTLE_X - 200;
      camera.targetY = GC.CASTLE_Y;
    }

    camera.screenW = window.innerWidth;
    camera.screenH = window.innerHeight;
  }

  // ─── Toast Notification ───────────────────────────────────────
  function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
      background: rgba(42, 35, 24, 0.95); border: 1px solid rgba(201, 168, 76, 0.5);
      padding: 10px 24px; font-family: 'Cinzel', serif; font-size: 14px;
      color: #e6c766; z-index: 999; border-radius: 2px;
      animation: toastFade 2.5s ease forwards; pointer-events: none;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);

    // Add animation keyframes if not already present
    if (!document.getElementById('toast-animation')) {
      const style = document.createElement('style');
      style.id = 'toast-animation';
      style.textContent = `
        @keyframes toastFade {
          0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
          15% { opacity: 1; transform: translateX(-50%) translateY(0); }
          70% { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
      `;
      document.head.appendChild(style);
    }

    setTimeout(() => toast.remove(), 2500);
  }

  // ─── Selection & Info Banner (300x200) ─────────────────────
  function trySelectUnit(wx, wy) {
    if (!gameState) { deselectAll(); return; }

    // Try units first (closest within 30 world units)
    let closest = null;
    let closestDist = 30;

    if (gameState.units) {
      for (const u of gameState.units) {
        const dx = u.x - wx;
        const dy = u.y - wy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < closestDist) { closestDist = d; closest = { type: 'unit', data: u }; }
      }
    }

    // Also try heroes
    const heroes = [gameState.hero1, gameState.hero2].filter(h => h && h.hp > 0);
    for (const h of heroes) {
      const dx = h.x - wx;
      const dy = h.y - wy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < closestDist) { closestDist = d; closest = { type: 'hero', data: h }; }
    }

    // Generals — DISABLED
    // const generals = [gameState.general1, gameState.general2].filter(g => g && g.hp > 0);
    // for (const g of generals) { ... }

    // Try outposts (within 50 world units)
    if (gameState.outposts) {
      const outposts = [
        { key: 'north', data: gameState.outposts.north },
        { key: 'south', data: gameState.outposts.south }
      ];
      for (const op of outposts) {
        if (!op.data) continue;
        const dx = op.data.x - wx;
        const dy = op.data.y - wy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 50 && d < closestDist) { closestDist = d; closest = { type: 'outpost', data: op.data, key: op.key }; }
      }
    }

    // Try buildings (within 40 world units)
    if (gameState.buildings) {
      for (const b of gameState.buildings) {
        const dx = b.x - wx;
        const dy = b.y - wy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 40 && d < closestDist) { closestDist = d; closest = { type: 'building', data: b }; }
      }
    }

    // Try castles (within 80 world units — castles are large)
    const castles = [gameState.castle1, gameState.castle2].filter(c => c && c.hp > 0);
    for (const c of castles) {
      const dx = c.x - wx;
      const dy = c.y - wy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 80 && d < closestDist) {
        closestDist = d;
        const side = (c.x < GAME_CONSTANTS.MAP_WIDTH / 2) ? 'left' : 'right';
        const charId = side === mySide ? myCharacterId : opponentCharacterId;
        closest = { type: 'castle', data: { ...c, side, characterId: charId } };
      }
    }

    if (closest) {
      if (closest.type === 'unit' || closest.type === 'hero') {
        selectedUnitId = closest.data.id;
        selectedBuildingId = null;
        selectedUnitName = closest.data.isHero ? closest.data.name :
                          getUnitDisplayName(closest.data);
        Renderer.setSelectedUnit(selectedUnitId);
        showBanner(closest.data, closest.type);
      } else if (closest.type === 'outpost') {
        selectedBuildingId = null;
        selectedUnitId = null;
        selectedUnitName = null;
        Renderer.setSelectedUnit(null);
        showBanner(closest.data, 'outpost');
      } else if (closest.type === 'castle') {
        selectedBuildingId = null;
        selectedUnitId = null;
        selectedUnitName = null;
        Renderer.setSelectedUnit(null);
        showBanner(closest.data, 'castle');
      } else {
        selectedBuildingId = closest.data.id;
        selectedUnitId = null;
        selectedUnitName = null;
        Renderer.setSelectedUnit(null);
        showBanner(closest.data, 'building');
      }
    } else {
      deselectAll();
    }
  }

  function deselectAll() {
    selectedUnitId = null;
    selectedUnitName = null;
    selectedBuildingId = null;
    Renderer.setSelectedUnit(null);
    hideBanner();
  }

  // Alias for backward compat (escape key etc)
  function deselectUnit() { deselectAll(); }

  function createBanner() {
    bannerEl = document.createElement('div');
    bannerEl.id = 'infoBanner';
    bannerEl.style.cssText = `
      position: fixed; bottom: 10px; left: 50%; transform: translateX(-50%);
      width: 380px; height: 220px; display: none; z-index: 100;
      pointer-events: auto; font-family: 'Cinzel', serif; cursor: default;
    `;
    // We draw the banner on a canvas for the medieval sword-themed look
    const c = document.createElement('canvas');
    c.id = 'bannerCanvas';
    c.width = 380;
    c.height = 220;
    c.style.cssText = 'width: 380px; height: 220px; cursor: pointer;';
    bannerEl.appendChild(c);

    // Click handler for upgrade button on banner
    c.addEventListener('click', (e) => {
      if (!pendingUpgradeBtn) return;
      const rect = c.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const btn = pendingUpgradeBtn;
      if (cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
        socket.emit('upgradeBuilding', { buildingId: btn.buildingId });
      }
    });

    document.getElementById('gameScreen').appendChild(bannerEl);
  }

  function hideBanner() {
    if (bannerEl) bannerEl.style.display = 'none';
    pendingUpgradeBtn = null;
  }

  function showBanner(data, selType) {
    if (!bannerEl) createBanner();
    bannerEl.style.display = 'block';
    renderBanner(data, selType);
  }

  // Seeded random for deterministic unit variation based on ID
  function seededRng(seed) {
    let s = Math.abs(seed * 2654435761 | 0) || 1;
    return function() {
      s ^= s << 13; s ^= s >> 17; s ^= s << 5;
      return ((s >>> 0) % 10000) / 10000;
    };
  }

  function renderBanner(data, selType) {
    const canvas = document.getElementById('bannerCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 380, H = 220;

    pendingUpgradeBtn = null;
    ctx.clearRect(0, 0, W, H);

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'rgba(28, 22, 14, 0.97)');
    bg.addColorStop(1, 'rgba(18, 14, 8, 0.97)');
    ctx.fillStyle = bg;
    roundRectBanner(ctx, 4, 4, W - 8, H - 8, 6);
    ctx.fill();

    // Outer border - gold
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.7)';
    ctx.lineWidth = 2;
    roundRectBanner(ctx, 4, 4, W - 8, H - 8, 6);
    ctx.stroke();

    // Inner border
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.25)';
    ctx.lineWidth = 1;
    roundRectBanner(ctx, 8, 8, W - 16, H - 16, 4);
    ctx.stroke();

    // Corner ornaments (crossed swords)
    drawSwordOrnament(ctx, 16, 16, 0.7);
    drawSwordOrnament(ctx, W - 16, 16, 0.7);
    drawSwordOrnament(ctx, 16, H - 16, 0.7);
    drawSwordOrnament(ctx, W - 16, H - 16, 0.7);

    const charData = CHARACTERS[data.characterId];
    const primary = charData ? charData.color : '#888';

    if (selType === 'building') {
      renderBuildingBanner(ctx, data, charData, primary, W, H);
    } else if (selType === 'outpost') {
      renderOutpostBanner(ctx, data, W, H);
    } else if (selType === 'castle') {
      renderCastleBanner(ctx, data, charData, primary, W, H);
    // } else if (selType === 'general') {
    //   renderGeneralBanner(ctx, data, charData, primary, W, H);  // STASHED — may revisit later
    } else {
      renderUnitBanner(ctx, data, charData, primary, W, H, selType);
    }
  }

  function renderUnitBanner(ctx, unit, charData, primary, W, H, selType) {
    // === Full-height portrait on the left side ===
    const PW = 120, PH = H - 20; // portrait area
    const PX = 10, PY = 10;

    // Portrait background (dark vignette)
    const pbg = ctx.createRadialGradient(PX + PW / 2, PY + PH / 2, 10, PX + PW / 2, PY + PH / 2, PH * 0.7);
    pbg.addColorStop(0, '#1a1510');
    pbg.addColorStop(1, '#0a0806');
    ctx.fillStyle = pbg;
    ctx.fillRect(PX, PY, PW, PH);

    // Draw detailed portrait
    drawBannerPortrait(ctx, unit, PX, PY, PW, PH);

    // Portrait gold border
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(PX, PY, PW, PH);
    // Inner glow
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(PX + 2, PY + 2, PW - 4, PH - 4);

    // === Info panel on the right ===
    const IX = PX + PW + 10; // info start x
    const IW = W - IX - 12; // info width

    // Name
    ctx.font = 'bold 14px Cinzel, serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    const displayName = unit.isHero ? unit.name : (selectedUnitName || 'Unit');
    ctx.fillText(displayName, IX, 30, IW);

    // Type label + level badge
    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = primary;
    const typeLabel = unit.isHero ? 'HERO' : (unit.unitType || '').toUpperCase();
    const lvl = unit.unitLevel || 1;
    const lvlStr = lvl >= 2 ? ` — Lv.${lvl}` : '';
    ctx.fillText(typeLabel + lvlStr, IX, 44);

    // Rank stars
    if (!unit.isHero && unit.rank > 0) {
      const starColors = ['', '#cd7f32', '#c0c0c0', '#ffd700'];
      ctx.font = '12px serif';
      ctx.fillStyle = starColors[Math.min(unit.rank, 3)];
      let stars = '';
      for (let i = 0; i < unit.rank; i++) stars += '\u2605';
      ctx.fillText(stars, IX, 58);
    }

    // Separator
    ctx.fillStyle = 'rgba(201, 168, 76, 0.3)';
    ctx.fillRect(IX, 64, IW, 1);

    // Stats
    const sY = 80;
    const col1 = IX, col2 = IX + IW / 2 + 6;

    // HP
    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = '#888';
    ctx.fillText('HP', col1, sY);
    ctx.fillStyle = '#4a8c3f';
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillText(`${Math.ceil(unit.hp)} / ${unit.maxHp}`, col1 + 26, sY);

    // DMG
    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = '#888';
    ctx.fillText('DMG', col2, sY);
    ctx.fillStyle = '#c0392b';
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillText(`${unit.damage || '?'}`, col2 + 32, sY);

    // ATK SPD
    const sY2 = sY + 18;
    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = '#888';
    ctx.fillText('ATK', col1, sY2);
    ctx.fillStyle = '#d4a017';
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillText(`${unit.attackSpeed || '?'}ms`, col1 + 26, sY2);

    // MOVE
    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = '#888';
    ctx.fillText('SPD', col2, sY2);
    ctx.fillStyle = '#4a6fa5';
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillText(`${unit.speed || '?'}`, col2 + 32, sY2);

    // Lane
    if (unit.lane) {
      const sY3 = sY2 + 18;
      ctx.font = '10px Cinzel, serif';
      ctx.fillStyle = '#888';
      ctx.fillText('LANE', col1, sY3);
      ctx.fillStyle = '#c9a84c';
      ctx.font = 'bold 11px Cinzel, serif';
      ctx.fillText(unit.lane.toUpperCase(), col1 + 38, sY3);

      // Side
      ctx.font = '10px Cinzel, serif';
      ctx.fillStyle = unit.side === mySide ? '#4a8c3f' : '#b22222';
      ctx.fillText(unit.side === mySide ? 'ALLY' : 'FOE', col2, sY3);
    }

    // XP bar (only for non-heroes)
    if (!unit.isHero) {
      const xpBarY = H - 32;
      const xpBarX = IX;
      const xpBarW = IW;
      const xpBarH = 12;
      const xp = unit.xp || 0;
      const xpNeeded = unit.xpToNext || 30;
      const rank = unit.rank || 0;

      ctx.font = '9px Cinzel, serif';
      ctx.fillStyle = '#888';
      ctx.textAlign = 'left';
      ctx.fillText('XP', xpBarX, xpBarY - 3);
      ctx.textAlign = 'right';
      ctx.fillStyle = rank >= 3 ? '#ffd700' : '#888';
      ctx.fillText(rank >= 3 ? 'MAX RANK' : `Rank ${rank}`, xpBarX + xpBarW, xpBarY - 3);

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(xpBarX, xpBarY, xpBarW, xpBarH);
      const xpPct = rank >= 3 ? 1 : Math.min(1, xp / xpNeeded);
      const xpGrad = ctx.createLinearGradient(xpBarX, 0, xpBarX + xpBarW * xpPct, 0);
      xpGrad.addColorStop(0, '#6a5acd');
      xpGrad.addColorStop(1, '#9370db');
      ctx.fillStyle = xpGrad;
      ctx.fillRect(xpBarX, xpBarY, xpBarW * xpPct, xpBarH);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(xpBarX, xpBarY, xpBarW * xpPct, xpBarH / 2);
      ctx.font = 'bold 9px Cinzel, serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(rank >= 3 ? 'MAX' : `${xp} / ${xpNeeded}`, xpBarX + xpBarW / 2, xpBarY + 9);
      ctx.strokeStyle = 'rgba(201, 168, 76, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(xpBarX, xpBarY, xpBarW, xpBarH);
    }

    ctx.textAlign = 'left';
  }

  function renderBuildingBanner(ctx, building, charData, primary, W, H) {
    // Full-height building illustration on left
    const PW = 120, PH = H - 20;
    const PX = 10, PY = 10;

    ctx.fillStyle = '#0a0806';
    ctx.fillRect(PX, PY, PW, PH);
    drawBuildingIcon(ctx, building, PX, PY, PW, PH);
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(PX, PY, PW, PH);

    // Level badge
    const bLevel = building.level || 1;
    if (bLevel >= 2) {
      const badgeColor = bLevel === 3 ? '#ffd700' : '#c0c0c0';
      ctx.fillStyle = badgeColor;
      ctx.beginPath();
      ctx.arc(PX + PW - 14, PY + 14, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 10px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#222';
      ctx.fillText(`L${bLevel}`, PX + PW - 14, PY + 18);
      ctx.textAlign = 'left';
    }

    // Info panel
    const IX = PX + PW + 10;
    const IW = W - IX - 12;
    const bDef = charData ? charData.buildings.find(b => b.id === building.typeId) : null;

    ctx.font = 'bold 14px Cinzel, serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    // Use themed level names if available
    const nameStr = (bDef && bDef.levelNames && bDef.levelNames[bLevel - 1])
      ? bDef.levelNames[bLevel - 1]
      : (bDef ? bDef.name : 'Building');
    ctx.fillText(nameStr, IX, 30, IW);

    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = primary;
    ctx.fillText(building.isTower ? 'DEFENSE TOWER' : 'BARRACKS', IX, 44);

    ctx.fillStyle = building.side === mySide ? '#4a8c3f' : '#b22222';
    ctx.fillText(building.side === mySide ? 'FRIENDLY' : 'ENEMY', IX, 58);

    // Separator
    ctx.fillStyle = 'rgba(201, 168, 76, 0.3)';
    ctx.fillRect(IX, 66, IW, 1);

    // Stats
    const sY = 82;
    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = '#888';
    ctx.fillText('HP', IX, sY);
    ctx.fillStyle = '#4a8c3f';
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillText(`${Math.ceil(building.hp)} / ${building.maxHp}`, IX + 26, sY);

    if (bDef) {
      const sY2 = sY + 18;
      ctx.font = '10px Cinzel, serif';
      ctx.fillStyle = '#888';
      ctx.fillText('INCOME', IX, sY2);
      ctx.fillStyle = '#d4a017';
      ctx.font = 'bold 11px Cinzel, serif';
      ctx.fillText(`+${bDef.income}g`, IX + 52, sY2);
    }

    if (building.isTower) {
      const sY3 = sY + 36;
      ctx.font = '10px Cinzel, serif';
      ctx.fillStyle = '#888';
      ctx.fillText('STATUS', IX, sY3);
      ctx.fillStyle = '#c9a84c';
      ctx.font = 'bold 11px Cinzel, serif';
      ctx.fillText(building.constructed ? 'ACTIVE' : 'BUILDING...', IX + 48, sY3);
    } else {
      // Upgrade button for own non-tower buildings
      if (building.side === mySide && building.constructed && bLevel < 3 && bDef) {
        const upgY = sY + 38;
        const nextLevel = bLevel + 1;
        const upgCost = nextLevel === 2
          ? Math.floor(bDef.cost * GAME_CONSTANTS.L2_COST_MULT)
          : Math.floor(bDef.cost * GAME_CONSTANTS.L3_COST_MULT);

        let canUpgrade = true;
        let upgradeNote = '';
        if (nextLevel === 3) {
          if (!charData.l3Eligible || !charData.l3Eligible.includes(building.typeId)) {
            canUpgrade = false;
            upgradeNote = 'Not L3 eligible';
          } else {
            const foundations = gameState && gameState.self ? gameState.self.coreFoundations : 0;
            if (foundations <= 0) upgradeNote = 'Need Foundation';
          }
        }

        if (canUpgrade) {
          ctx.fillStyle = 'rgba(201, 168, 76, 0.15)';
          ctx.fillRect(IX, upgY - 4, IW, 20);
          ctx.strokeStyle = 'rgba(201, 168, 76, 0.4)';
          ctx.lineWidth = 1;
          ctx.strokeRect(IX, upgY - 4, IW, 20);

          ctx.font = 'bold 10px Cinzel, serif';
          ctx.fillStyle = '#e6c766';
          ctx.textAlign = 'left';
          const upgName = (bDef.levelNames && bDef.levelNames[nextLevel - 1])
            ? bDef.levelNames[nextLevel - 1] : `Level ${nextLevel}`;
          ctx.fillText(`\u2B06 ${upgName} — ${upgCost}g`, IX + 6, upgY + 9);

          if (upgradeNote) {
            ctx.font = '8px Cinzel, serif';
            ctx.fillStyle = '#c0392b';
            ctx.textAlign = 'right';
            ctx.fillText(upgradeNote, IX + IW - 4, upgY + 9);
          }

          pendingUpgradeBtn = { x: IX, y: upgY - 4, w: IW, h: 20, buildingId: building.id };
        }
      }

      // Spawn progress bar
      const barY = H - 32;
      const barX = IX;
      const barW = IW;
      const barH = 12;

      ctx.font = '9px Cinzel, serif';
      ctx.fillStyle = '#888';
      ctx.textAlign = 'left';
      ctx.fillText('SPAWN', barX, barY - 3);
      ctx.textAlign = 'right';
      const pct = Math.round((building.spawnProgress || 0) * 100);
      ctx.fillText(building.constructed ? `${pct}%` : 'Building...', barX + barW, barY - 3);

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barX, barY, barW, barH);
      const fillPct = building.constructed ? (building.spawnProgress || 0) : (building.constructionProgress || 0);
      const barGrad = ctx.createLinearGradient(barX, 0, barX + barW * fillPct, 0);
      barGrad.addColorStop(0, building.constructed ? '#4a8c3f' : '#d4a017');
      barGrad.addColorStop(1, building.constructed ? '#6aac5f' : '#e6c766');
      ctx.fillStyle = barGrad;
      ctx.fillRect(barX, barY, barW * fillPct, barH);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(barX, barY, barW * fillPct, barH / 2);
      ctx.strokeStyle = 'rgba(201, 168, 76, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
    }

    ctx.textAlign = 'left';
  }

  function renderOutpostBanner(ctx, outpost, W, H) {
    // Large outpost illustration on the left
    const PW = 120, PH = H - 20;
    const PX = 10, PY = 10;

    ctx.fillStyle = '#0a0806';
    ctx.fillRect(PX, PY, PW, PH);

    // Draw a detailed outpost tower
    const cx = PX + PW / 2, cy = PY + PH / 2;
    // Base
    ctx.fillStyle = '#3a3530';
    ctx.fillRect(cx - 30, cy + 30, 60, 40);
    // Tower body
    ctx.fillStyle = '#5a5550';
    ctx.fillRect(cx - 20, cy - 40, 40, 70);
    // Crenellations
    ctx.fillStyle = '#6a6560';
    for (let i = -18; i <= 14; i += 8) {
      ctx.fillRect(cx + i, cy - 48, 6, 10);
    }
    // Flag
    const flagColor = outpost.controlledBy === 'left' ? '#4a8c3f' : outpost.controlledBy === 'right' ? '#b22222' : '#888';
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(cx, cy - 70, 2, 30);
    ctx.fillStyle = flagColor;
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy - 70);
    ctx.lineTo(cx + 22, cy - 62);
    ctx.lineTo(cx + 2, cy - 54);
    ctx.fill();
    // Windows
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(cx - 8, cy - 20, 6, 8);
    ctx.fillRect(cx + 4, cy - 20, 6, 8);
    // Gate
    ctx.fillStyle = '#2a2520';
    ctx.fillRect(cx - 8, cy + 10, 16, 20);
    ctx.fillStyle = '#444';
    ctx.fillRect(cx - 1, cy + 10, 2, 20);

    ctx.strokeStyle = 'rgba(201, 168, 76, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(PX, PY, PW, PH);

    // Info
    const IX = PX + PW + 10;
    const IW = W - IX - 12;

    ctx.font = 'bold 14px Cinzel, serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText('Command Outpost', IX, 30, IW);

    ctx.font = '10px Cinzel, serif';
    const controlled = outpost.controlledBy;
    ctx.fillStyle = controlled === mySide ? '#4a8c3f' : controlled ? '#b22222' : '#888';
    ctx.fillText(controlled === mySide ? 'CONTROLLED BY YOU' : controlled ? 'ENEMY CONTROLLED' : 'NEUTRAL', IX, 46);

    ctx.fillStyle = 'rgba(201, 168, 76, 0.3)';
    ctx.fillRect(IX, 54, IW, 1);

    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillStyle = '#c9a84c';
    ctx.fillText('Outpost Bonuses:', IX, 72);

    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('1 Outpost: -10% Attack Speed', IX, 92);
    ctx.fillText('2 Outposts: +10% Dmg Reduction', IX, 110);

    ctx.font = 'bold 10px Cinzel, serif';
    ctx.fillStyle = '#e6c766';
    let ownedCount = 0;
    if (gameState && gameState.outposts) {
      if (gameState.outposts.north && gameState.outposts.north.controlledBy === mySide) ownedCount++;
      if (gameState.outposts.south && gameState.outposts.south.controlledBy === mySide) ownedCount++;
    }
    ctx.fillText(`You control: ${ownedCount} outpost(s)`, IX, 136);

    ctx.textAlign = 'left';
  }

  function renderCastleBanner(ctx, castle, charData, primary, W, H) {
    // Full-height castle illustration on left
    const PW = 120, PH = H - 20;
    const PX = 10, PY = 10;

    ctx.fillStyle = '#0a0806';
    ctx.fillRect(PX, PY, PW, PH);

    const cx = PX + PW / 2;
    const scale = PW / 120;
    function s(v) { return v * scale; }

    // Castle illustration
    const baseY = PY + PH - s(20);
    // Main keep
    ctx.fillStyle = '#5a5550';
    ctx.fillRect(cx - s(28), baseY - s(80), s(56), s(82));
    // Stone texture
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = s(0.5);
    for (let row = 0; row < 9; row++) {
      const ry = baseY - s(80) + row * s(9);
      ctx.beginPath(); ctx.moveTo(cx - s(28), ry); ctx.lineTo(cx + s(28), ry); ctx.stroke();
    }
    // Central tower
    ctx.fillStyle = '#666';
    ctx.fillRect(cx - s(14), baseY - s(110), s(28), s(34));
    // Crenellations on tower
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(cx + i * s(8) - s(4), baseY - s(118), s(8), s(10));
    }
    // Side towers
    ctx.fillStyle = '#5e5a55';
    ctx.fillRect(cx - s(40), baseY - s(60), s(16), s(62));
    ctx.fillRect(cx + s(24), baseY - s(60), s(16), s(62));
    // Side crenellations
    ctx.fillStyle = '#6a6560';
    ctx.fillRect(cx - s(42), baseY - s(66), s(6), s(8));
    ctx.fillRect(cx - s(32), baseY - s(66), s(6), s(8));
    ctx.fillRect(cx + s(26), baseY - s(66), s(6), s(8));
    ctx.fillRect(cx + s(36), baseY - s(66), s(6), s(8));
    // Gate
    ctx.fillStyle = '#2a2520';
    ctx.beginPath();
    ctx.arc(cx, baseY - s(22), s(12), Math.PI, 0);
    ctx.lineTo(cx + s(12), baseY);
    ctx.lineTo(cx - s(12), baseY);
    ctx.fill();
    // Gate bars
    ctx.strokeStyle = '#444';
    ctx.lineWidth = s(1.5);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * s(4), baseY - s(22));
      ctx.lineTo(cx + i * s(4), baseY);
      ctx.stroke();
    }
    // Windows
    ctx.fillStyle = '#d4a017';
    ctx.globalAlpha = 0.4;
    ctx.fillRect(cx - s(20), baseY - s(60), s(6), s(8));
    ctx.fillRect(cx + s(14), baseY - s(60), s(6), s(8));
    ctx.fillRect(cx - s(6), baseY - s(98), s(4), s(6));
    ctx.fillRect(cx + s(2), baseY - s(98), s(4), s(6));
    ctx.globalAlpha = 1;
    // Flag
    const flagColor = primary || '#888';
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(cx, baseY - s(130), s(2), s(20));
    ctx.fillStyle = flagColor;
    ctx.beginPath();
    ctx.moveTo(cx + s(2), baseY - s(130));
    ctx.lineTo(cx + s(18), baseY - s(124));
    ctx.lineTo(cx + s(2), baseY - s(116));
    ctx.fill();

    // Portrait border
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(PX, PY, PW, PH);

    // Info panel
    const IX = PX + PW + 10;
    const IW = W - IX - 12;
    const isMine = castle.side === mySide;

    ctx.font = 'bold 14px Cinzel, serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    const castleName = charData ? charData.name : 'Castle';
    ctx.fillText(castleName, IX, 30, IW);

    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = isMine ? '#4a8c3f' : '#b22222';
    ctx.fillText(isMine ? 'YOUR CASTLE' : 'ENEMY CASTLE', IX, 44);

    if (charData) {
      ctx.fillStyle = primary;
      ctx.fillText(charData.title || '', IX, 58);
    }

    // Separator
    ctx.fillStyle = 'rgba(201, 168, 76, 0.3)';
    ctx.fillRect(IX, 66, IW, 1);

    // HP
    const sY = 82;
    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = '#888';
    ctx.fillText('HP', IX, sY);
    ctx.fillStyle = '#4a8c3f';
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillText(`${Math.ceil(castle.hp)} / ${castle.maxHp}`, IX + 26, sY);

    // HP bar
    const hpBarY = sY + 8;
    const hpBarW = IW;
    const hpBarH = 10;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(IX, hpBarY, hpBarW, hpBarH);
    const hpPct = Math.max(0, castle.hp / castle.maxHp);
    const hpColor = hpPct > 0.5 ? '#4a8c3f' : hpPct > 0.25 ? '#d4a017' : '#c0392b';
    ctx.fillStyle = hpColor;
    ctx.fillRect(IX, hpBarY, hpBarW * hpPct, hpBarH);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(IX, hpBarY, hpBarW * hpPct, hpBarH / 2);
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(IX, hpBarY, hpBarW, hpBarH);

    // Passive info (for your castle)
    if (isMine && charData && charData.passive) {
      const pY = hpBarY + 24;
      ctx.font = 'bold 10px Cinzel, serif';
      ctx.fillStyle = '#c9a84c';
      ctx.fillText('Passive: ' + charData.passive.name, IX, pY);
      ctx.font = '9px Cinzel, serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText(charData.passive.description, IX, pY + 14, IW);
    }

    // Castle defense info
    const defY = H - 42;
    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = '#888';
    ctx.fillText('DEFENSE', IX, defY);
    ctx.fillStyle = '#c9a84c';
    ctx.font = 'bold 10px Cinzel, serif';
    ctx.fillText('Castle Arrows (Range: 350)', IX + 56, defY);

    ctx.textAlign = 'left';
  }

  function renderGeneralBanner(ctx, gen, charData, primary, W, H) {
    // Full-height portrait
    const PW = 120, PH = H - 20;
    const PX = 10, PY = 10;
    const pbg = ctx.createRadialGradient(PX + PW / 2, PY + PH / 2, 10, PX + PW / 2, PY + PH / 2, PH * 0.7);
    pbg.addColorStop(0, '#1a1510');
    pbg.addColorStop(1, '#0a0806');
    ctx.fillStyle = pbg;
    ctx.fillRect(PX, PY, PW, PH);

    // Draw general portrait using the unit portrait system with general flag
    const genData = { ...gen, unitType: 'general', characterId: gen.characterId, id: gen.id };
    drawBannerPortrait(ctx, genData, PX, PY, PW, PH);

    ctx.strokeStyle = 'rgba(201, 168, 76, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(PX, PY, PW, PH);
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(PX + 2, PY + 2, PW - 4, PH - 4);

    // Info
    const IX = PX + PW + 10;
    const IW = W - IX - 12;

    ctx.font = 'bold 14px Cinzel, serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(gen.name || 'General', IX, 30, IW);

    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = primary;
    ctx.fillText('GENERAL', IX, 44);

    if (gen.rank > 0) {
      const starColors = ['', '#cd7f32', '#c0c0c0', '#ffd700'];
      ctx.font = '12px serif';
      ctx.fillStyle = starColors[Math.min(gen.rank, 3)];
      let stars = '';
      for (let i = 0; i < gen.rank; i++) stars += '\u2605';
      ctx.fillText(stars, IX, 58);
    }

    ctx.fillStyle = 'rgba(201, 168, 76, 0.3)';
    ctx.fillRect(IX, 64, IW, 1);

    // Stats
    const sY = 80;
    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = '#888';
    ctx.fillText('HP', IX, sY);
    ctx.fillStyle = '#4a8c3f';
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillText(`${Math.ceil(gen.hp)} / ${gen.maxHp}`, IX + 26, sY);

    const sY2 = sY + 18;
    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = '#888';
    ctx.fillText('DMG', IX, sY2);
    ctx.fillStyle = '#c0392b';
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillText(`${gen.damage}`, IX + 32, sY2);

    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = '#888';
    ctx.fillText('SPD', IX + IW / 2, sY2);
    ctx.fillStyle = '#4a6fa5';
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillText(`${gen.speed}`, IX + IW / 2 + 28, sY2);

    const sY3 = sY2 + 18;
    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = '#c9a84c';
    const auraText = gen.rank >= 3 ? 'Aura: Regen + Dmg + Dodge' :
                     gen.rank >= 2 ? 'Aura: Regen + Damage' :
                     gen.rank >= 1 ? 'Aura: HP Regen' : 'No Aura (Rank up!)';
    ctx.fillText(auraText, IX, sY3);

    // XP bar
    const xpBarY = H - 32, xpBarX = IX, xpBarW = IW, xpBarH = 12;
    const xp = gen.xp || 0;
    const xpNeeded = gen.xpToNext || 30;
    const rank = gen.rank || 0;

    ctx.font = '9px Cinzel, serif';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'left';
    ctx.fillText('XP', xpBarX, xpBarY - 3);
    ctx.textAlign = 'right';
    ctx.fillStyle = rank >= 3 ? '#ffd700' : '#888';
    ctx.fillText(rank >= 3 ? 'MAX RANK' : `Rank ${rank}`, xpBarX + xpBarW, xpBarY - 3);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(xpBarX, xpBarY, xpBarW, xpBarH);
    const xpPct = rank >= 3 ? 1 : Math.min(1, xp / xpNeeded);
    const xpGrad = ctx.createLinearGradient(xpBarX, 0, xpBarX + xpBarW * xpPct, 0);
    xpGrad.addColorStop(0, '#6a5acd');
    xpGrad.addColorStop(1, '#9370db');
    ctx.fillStyle = xpGrad;
    ctx.fillRect(xpBarX, xpBarY, xpBarW * xpPct, xpBarH);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(xpBarX, xpBarY, xpBarW * xpPct, xpBarH / 2);
    ctx.font = 'bold 9px Cinzel, serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(rank >= 3 ? 'MAX' : `${xp} / ${xpNeeded}`, xpBarX + xpBarW / 2, xpBarY + 9);
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(xpBarX, xpBarY, xpBarW, xpBarH);

    ctx.textAlign = 'left';
  }

  function drawSwordOrnament(ctx, cx, cy, scale) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.5)';
    ctx.lineWidth = 1.5;
    // Crossed swords
    ctx.beginPath();
    ctx.moveTo(-6, -6); ctx.lineTo(6, 6);
    ctx.moveTo(6, -6); ctx.lineTo(-6, 6);
    ctx.stroke();
    // Hilts
    ctx.beginPath();
    ctx.moveTo(-3, 0); ctx.lineTo(3, 0);
    ctx.moveTo(0, -3); ctx.lineTo(0, 3);
    ctx.stroke();
    ctx.restore();
  }

  function roundRectBanner(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawBannerPortrait(ctx, unit, px, py, pw, ph) {
    const charData = CHARACTERS[unit.characterId];
    const primary = charData ? charData.color : '#666';
    const accent = charData ? charData.accentColor : '#888';
    const dark = charData ? charData.darkColor : '#444';
    const type = unit.unitType;
    const charId = unit.characterId;
    const typeId = unit.typeId;

    const rng = seededRng(unit.id || 1);
    const cx = px + pw / 2;
    const scale = pw / 120;
    function s(v) { return v * scale; }

    // --- Random trait generation ---
    const hairColors = ['#2a1a0a', '#4a3018', '#6b4a2a', '#8b6a3a', '#aa8844', '#c0c0c0', '#881818'];
    const hair = hairColors[Math.floor(rng() * hairColors.length)];
    const hairStyle = Math.floor(rng() * 5);
    const hasBeard = rng() > 0.45;
    const beardStyle = Math.floor(rng() * 3);
    const hasScar = rng() > 0.6;
    const scarSide = rng() > 0.5 ? 1 : -1;
    const eyeColors = ['#3a2510', '#2244aa', '#228833', '#666666', '#884400'];
    const eyeColor = eyeColors[Math.floor(rng() * eyeColors.length)];
    const noseWidth = 2 + Math.floor(rng() * 3);
    const browThickness = 1 + Math.floor(rng() * 2);

    // --- Faction-specific skin palettes ---
    let skinTones, skin, skinShadow, skinHighlight, skinIdx;
    if (charId === 'orc_warchief') {
      skinTones = ['#5a8a3a', '#4a7a2e', '#6a9a44', '#3a6a1e', '#7aaa54'];
      skinIdx = Math.floor(rng() * skinTones.length);
      skin = skinTones[skinIdx];
      skinShadow = ['#3a6a1e', '#2a5a12', '#4a7a28', '#1a4a08', '#5a8a38'][skinIdx];
      skinHighlight = ['#7aaa54', '#6a9a48', '#8aba64', '#5a8a38', '#9aca6e'][skinIdx];
    } else if (charId === 'shadow_priest') {
      skinTones = ['#b0a890', '#9a9080', '#c0b8a0', '#887868', '#706058'];
      skinIdx = Math.floor(rng() * skinTones.length);
      skin = skinTones[skinIdx];
      skinShadow = ['#908870', '#7a7060', '#a09880', '#685848', '#504038'][skinIdx];
      skinHighlight = ['#d0c8b0', '#b0a898', '#e0d8c0', '#a89888', '#907870'][skinIdx];
    } else if (charId === 'forest_warden') {
      skinTones = ['#f0dcc8', '#e8d4be', '#f4e4d4', '#eedcc8', '#f8ece0'];
      skinIdx = Math.floor(rng() * skinTones.length);
      skin = skinTones[skinIdx];
      skinShadow = ['#d8c4a8', '#d0bca0', '#dcc8b0', '#d6c0a8', '#e0d0bc'][skinIdx];
      skinHighlight = ['#fff0e0', '#f8e8d8', '#fff4e8', '#f8f0e0', '#fff8f0'][skinIdx];
    } else if (charId === 'dragon_empress') {
      skinTones = ['#d4a878', '#c89868', '#deb888', '#b88858', '#cca070'];
      skinIdx = Math.floor(rng() * skinTones.length);
      skin = skinTones[skinIdx];
      skinShadow = ['#b48858', '#a87848', '#be9868', '#986838', '#ac8050'][skinIdx];
      skinHighlight = ['#e8c898', '#dbb888', '#f0d0a0', '#c8a070', '#deb888'][skinIdx];
    } else if (charId === 'iron_admiral') {
      skinTones = ['#c89870', '#be8e66', '#d4a47a', '#b48460', '#ca9a72'];
      skinIdx = Math.floor(rng() * skinTones.length);
      skin = skinTones[skinIdx];
      skinShadow = ['#a87850', '#9e6e46', '#b4845a', '#946440', '#aa7a52'][skinIdx];
      skinHighlight = ['#e0b890', '#d6ae86', '#eac49a', '#c4a478', '#e0ba92'][skinIdx];
    } else {
      // Northern Lord, Golden Lord - lighter skin
      skinTones = ['#e8c4a0', '#d4a574', '#f0d4b8', '#deb898', '#c49464'];
      skinIdx = Math.floor(rng() * skinTones.length);
      skin = skinTones[skinIdx];
      skinShadow = ['#d4a880', '#c09060', '#dcc0a0', '#ca9e7e', '#a87850'][skinIdx];
      skinHighlight = ['#f0d4b8', '#e0b888', '#f8e4d0', '#eecab0', '#d4a474'][skinIdx];
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();

    // --- Background atmosphere ---
    const atmGrad = ctx.createLinearGradient(px, py, px, py + ph);
    const pr = parseInt(primary.slice(1,3),16), pg = parseInt(primary.slice(3,5),16), pb = parseInt(primary.slice(5,7),16);
    atmGrad.addColorStop(0, `rgba(${pr},${pg},${pb},0.08)`);
    atmGrad.addColorStop(0.5, `rgba(${Math.floor(pr*0.5)},${Math.floor(pg*0.5)},${Math.floor(pb*0.5)},0.12)`);
    atmGrad.addColorStop(1, `rgba(${pr},${pg},${pb},0.2)`);
    ctx.fillStyle = atmGrad;
    ctx.fillRect(px, py, pw, ph);

    // --- Shared layout ---
    const headY = py + s(30);
    const headCY = headY + s(24);
    const bodyY = headY + s(54);
    const eyeY = headCY - s(2);
    const eyeSpacing = s(9);

    // ============================================================
    // HELPER: draw humanoid eyes
    // ============================================================
    function drawEyes(glowColor) {
      for (let side = -1; side <= 1; side += 2) {
        const ex = cx + side * eyeSpacing;
        // Eye white
        ctx.fillStyle = '#eee';
        ctx.beginPath(); ctx.ellipse(ex, eyeY, s(6), s(3.5), 0, 0, Math.PI * 2); ctx.fill();
        // Iris
        ctx.fillStyle = glowColor || eyeColor;
        ctx.beginPath(); ctx.arc(ex + side * s(1), eyeY, s(2.5), 0, Math.PI * 2); ctx.fill();
        // Pupil
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(ex + side * s(1), eyeY, s(1.2), 0, Math.PI * 2); ctx.fill();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.arc(ex + side * s(1) + s(0.8), eyeY - s(0.8), s(0.7), 0, Math.PI * 2); ctx.fill();
        // Upper lid shadow
        ctx.fillStyle = skinShadow;
        ctx.fillRect(ex - s(6), eyeY - s(4), s(12), s(browThickness + 1));
      }
    }

    // ============================================================
    // HELPER: draw brows
    // ============================================================
    function drawBrows(browColor) {
      ctx.fillStyle = browColor || hair;
      for (let side = -1; side <= 1; side += 2) {
        ctx.fillRect(cx + side * eyeSpacing - s(6), eyeY - s(7), s(12), s(browThickness + 1));
      }
    }

    // ============================================================
    // HELPER: draw nose
    // ============================================================
    function drawNose(nw) {
      ctx.fillStyle = skinShadow;
      ctx.beginPath();
      ctx.moveTo(cx - s(1), headCY - s(4));
      ctx.lineTo(cx - s(nw || noseWidth), headCY + s(8));
      ctx.lineTo(cx + s(nw || noseWidth), headCY + s(8));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = skinHighlight;
      ctx.fillRect(cx - s(0.5), headCY - s(3), s(1), s(8));
    }

    // ============================================================
    // HELPER: draw mouth
    // ============================================================
    function drawMouth() {
      ctx.fillStyle = '#7a3030';
      ctx.fillRect(cx - s(5), headCY + s(12), s(10), s(2));
      ctx.fillStyle = skinShadow;
      ctx.fillRect(cx - s(4), headCY + s(14), s(8), s(1));
    }

    // ============================================================
    // HELPER: draw beard
    // ============================================================
    function drawBeard() {
      if (!hasBeard) return;
      ctx.fillStyle = hair;
      if (beardStyle === 0) {
        ctx.globalAlpha = 0.3;
        for (let bx = -8; bx <= 8; bx += 2) {
          for (let by = 10; by <= 18; by += 2) {
            if (rng() > 0.4) ctx.fillRect(cx + s(bx), headCY + s(by), s(1), s(1));
          }
        }
        ctx.globalAlpha = 1;
      } else if (beardStyle === 1) {
        ctx.beginPath();
        ctx.moveTo(cx - s(14), headCY + s(10));
        ctx.quadraticCurveTo(cx, headCY + s(24), cx + s(14), headCY + s(10));
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(cx - s(16), headCY + s(6));
        ctx.quadraticCurveTo(cx - s(18), headCY + s(20), cx, headCY + s(30));
        ctx.quadraticCurveTo(cx + s(18), headCY + s(20), cx + s(16), headCY + s(6));
        ctx.fill();
      }
    }

    // ============================================================
    // HELPER: draw scar
    // ============================================================
    function drawScar() {
      if (!hasScar) return;
      ctx.strokeStyle = 'rgba(180,60,60,0.5)';
      ctx.lineWidth = s(1.5);
      ctx.beginPath();
      ctx.moveTo(cx + scarSide * s(4), headCY - s(10));
      ctx.lineTo(cx + scarSide * s(8), headCY + s(6));
      ctx.stroke();
    }

    // ============================================================
    // HELPER: draw human ears
    // ============================================================
    function drawHumanEars() {
      const earSize = 3 + Math.floor(rng() * 3);
      ctx.fillStyle = skinShadow;
      ctx.beginPath(); ctx.ellipse(cx - s(22), headCY + s(2), s(earSize), s(earSize + 2), 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + s(22), headCY + s(2), s(earSize), s(earSize + 2), 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.ellipse(cx - s(21), headCY + s(2), s(earSize - 1), s(earSize + 1), 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + s(21), headCY + s(2), s(earSize - 1), s(earSize + 1), 0, 0, Math.PI * 2); ctx.fill();
    }

    // ============================================================
    // HELPER: draw elf ears (pointed)
    // ============================================================
    function drawElfEars() {
      for (let side = -1; side <= 1; side += 2) {
        ctx.fillStyle = skinShadow;
        ctx.beginPath();
        ctx.moveTo(cx + side * s(21), headCY - s(2));
        ctx.quadraticCurveTo(cx + side * s(32), headCY - s(14), cx + side * s(36), headCY - s(10));
        ctx.quadraticCurveTo(cx + side * s(30), headCY + s(2), cx + side * s(21), headCY + s(6));
        ctx.fill();
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.moveTo(cx + side * s(21), headCY - s(1));
        ctx.quadraticCurveTo(cx + side * s(30), headCY - s(12), cx + side * s(34), headCY - s(9));
        ctx.quadraticCurveTo(cx + side * s(28), headCY + s(1), cx + side * s(21), headCY + s(5));
        ctx.fill();
      }
    }

    // ============================================================
    // HELPER: draw orc ears (pointed, larger)
    // ============================================================
    function drawOrcEars() {
      for (let side = -1; side <= 1; side += 2) {
        ctx.fillStyle = skinShadow;
        ctx.beginPath();
        ctx.moveTo(cx + side * s(23), headCY - s(4));
        ctx.quadraticCurveTo(cx + side * s(36), headCY - s(18), cx + side * s(40), headCY - s(12));
        ctx.quadraticCurveTo(cx + side * s(34), headCY + s(4), cx + side * s(23), headCY + s(8));
        ctx.fill();
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.moveTo(cx + side * s(23), headCY - s(3));
        ctx.quadraticCurveTo(cx + side * s(34), headCY - s(16), cx + side * s(38), headCY - s(11));
        ctx.quadraticCurveTo(cx + side * s(32), headCY + s(3), cx + side * s(23), headCY + s(7));
        ctx.fill();
      }
    }

    // ============================================================
    // HELPER: draw neck and head oval
    // ============================================================
    function drawNeckAndHead(headRX, headRY) {
      const rx = headRX || 22, ry = headRY || 26;
      ctx.fillStyle = skin;
      ctx.fillRect(cx - s(10), bodyY - s(10), s(20), s(14));
      ctx.fillStyle = skinShadow;
      ctx.fillRect(cx - s(10), bodyY - s(2), s(20), s(4));
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.ellipse(cx, headCY, s(rx), s(ry), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ============================================================
    // HELPER: draw armored shoulders (heavy plate)
    // ============================================================
    function drawHeavyArmor(armorColor, accentCol, darkCol) {
      const shoulderW = s(52);
      const ag = ctx.createLinearGradient(cx - shoulderW, bodyY, cx + shoulderW, bodyY + s(80));
      ag.addColorStop(0, armorColor || primary);
      ag.addColorStop(0.5, darkCol || dark);
      ag.addColorStop(1, '#111');
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.moveTo(cx - shoulderW, bodyY + s(10));
      ctx.quadraticCurveTo(cx - shoulderW - s(6), bodyY + s(40), cx - shoulderW + s(4), py + ph);
      ctx.lineTo(cx + shoulderW - s(4), py + ph);
      ctx.quadraticCurveTo(cx + shoulderW + s(6), bodyY + s(40), cx + shoulderW, bodyY + s(10));
      ctx.quadraticCurveTo(cx, bodyY - s(4), cx - shoulderW, bodyY + s(10));
      ctx.fill();
      // Pauldrons
      ctx.fillStyle = accentCol || accent;
      ctx.beginPath(); ctx.ellipse(cx - shoulderW + s(8), bodyY + s(12), s(14), s(10), -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + shoulderW - s(8), bodyY + s(12), s(14), s(10), 0.3, 0, Math.PI * 2); ctx.fill();
      // Rivets
      ctx.fillStyle = '#d4a017';
      for (let side = -1; side <= 1; side += 2) {
        const psx = cx + side * (shoulderW - s(8));
        ctx.beginPath(); ctx.arc(psx, bodyY + s(8), s(2), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(psx, bodyY + s(16), s(2), 0, Math.PI * 2); ctx.fill();
      }
      // Gorget
      ctx.fillStyle = '#777';
      ctx.beginPath(); ctx.ellipse(cx, bodyY + s(2), s(18), s(8), 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#999';
      ctx.fillRect(cx - s(16), bodyY - s(2), s(32), s(4));
    }

    // ============================================================
    // HELPER: draw light armor / leather shoulders
    // ============================================================
    function drawLightArmor(cloakColor, innerColor) {
      ctx.fillStyle = cloakColor || dark;
      ctx.beginPath();
      ctx.moveTo(cx - s(48), bodyY + s(8));
      ctx.quadraticCurveTo(cx - s(52), bodyY + s(40), cx - s(44), py + ph);
      ctx.lineTo(cx + s(44), py + ph);
      ctx.quadraticCurveTo(cx + s(52), bodyY + s(40), cx + s(48), bodyY + s(8));
      ctx.quadraticCurveTo(cx, bodyY - s(6), cx - s(48), bodyY + s(8));
      ctx.fill();
      // Inner tunic
      ctx.fillStyle = innerColor || primary;
      ctx.beginPath();
      ctx.moveTo(cx - s(20), bodyY + s(2));
      ctx.lineTo(cx - s(24), py + ph);
      ctx.lineTo(cx + s(24), py + ph);
      ctx.lineTo(cx + s(20), bodyY + s(2));
      ctx.fill();
      // Collar
      ctx.fillStyle = cloakColor || dark;
      ctx.beginPath();
      ctx.ellipse(cx, bodyY + s(4), s(22), s(8), 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }

    // ============================================================
    // HELPER: draw a helm
    // ============================================================
    function drawHelm(helmColor, crestColor, helmStyle) {
      const hs = helmStyle !== undefined ? helmStyle : Math.floor(rng() * 3);
      ctx.fillStyle = helmColor || '#888';
      if (hs === 0) {
        // Open face with nose guard
        ctx.beginPath(); ctx.ellipse(cx, headY + s(8), s(24), s(20), 0, Math.PI + 0.3, -0.3); ctx.fill();
        ctx.fillStyle = (helmColor || '#888');
        ctx.fillRect(cx - s(2), headY + s(4), s(4), s(20));
        if (crestColor) { ctx.fillStyle = crestColor; ctx.fillRect(cx - s(2), headY - s(6), s(4), s(16)); }
      } else if (hs === 1) {
        // Kettle helm
        ctx.beginPath(); ctx.ellipse(cx, headY + s(10), s(26), s(14), 0, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = helmColor || '#999';
        ctx.fillRect(cx - s(28), headY + s(8), s(56), s(4));
      } else {
        // Full great helm
        ctx.beginPath(); ctx.ellipse(cx, headY + s(10), s(24), s(20), 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#333';
        ctx.fillRect(cx - s(16), headCY - s(4), s(32), s(3));
        if (crestColor) {
          ctx.fillStyle = crestColor;
          ctx.fillRect(cx - s(2), headY - s(10), s(4), s(16));
        }
      }
    }

    // ============================================================
    // HELPER: draw hair (when no helm)
    // ============================================================
    function drawHair(hairCol) {
      ctx.fillStyle = hairCol || hair;
      if (hairStyle === 0) {
        ctx.globalAlpha = 0.2;
        ctx.beginPath(); ctx.ellipse(cx, headY + s(8), s(22), s(16), 0, Math.PI, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (hairStyle === 1) {
        ctx.beginPath(); ctx.ellipse(cx, headY + s(6), s(23), s(18), 0, Math.PI + 0.5, -0.5); ctx.fill();
      } else if (hairStyle === 2) {
        ctx.beginPath(); ctx.ellipse(cx, headY + s(6), s(24), s(20), 0, Math.PI + 0.3, -0.3); ctx.fill();
        ctx.fillRect(cx - s(24), headCY - s(4), s(4), s(16));
        ctx.fillRect(cx + s(20), headCY - s(4), s(4), s(16));
      } else if (hairStyle === 3) {
        ctx.beginPath(); ctx.ellipse(cx, headY + s(6), s(24), s(20), 0, Math.PI + 0.2, -0.2); ctx.fill();
        ctx.fillRect(cx - s(24), headCY - s(8), s(6), s(40));
        ctx.fillRect(cx + s(18), headCY - s(8), s(6), s(40));
      } else {
        ctx.beginPath(); ctx.ellipse(cx, headY + s(6), s(22), s(16), 0, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillRect(cx - s(3), headY - s(10), s(6), s(22));
      }
    }

    // ============================================================
    // HELPER: draw hood (for ranged units)
    // ============================================================
    function drawHood(hoodColor) {
      const hoodUp = rng() > 0.3;
      ctx.fillStyle = hoodColor || dark;
      if (hoodUp) {
        ctx.beginPath(); ctx.ellipse(cx, headY + s(6), s(28), s(22), 0, Math.PI + 0.3, -0.3); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(cx, headY + s(14), s(22), s(10), 0, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = hoodColor || dark;
        ctx.fillRect(cx - s(26), headCY - s(2), s(6), s(28));
        ctx.fillRect(cx + s(20), headCY - s(2), s(6), s(28));
      } else {
        ctx.beginPath();
        ctx.moveTo(cx - s(30), bodyY + s(14));
        ctx.quadraticCurveTo(cx, bodyY + s(24), cx + s(30), bodyY + s(14));
        ctx.fill();
        drawHair();
      }
    }

    // =================================================================
    //  CREATURE PORTRAITS (non-humanoid units)
    // =================================================================
    if (typeId === 'snow_hawk' || typeId === 'storm_petrel' || typeId === 'war_eagle' || typeId === 'great_eagle') {
      // --- BIRD OF PREY portrait ---
      const birdCY = py + s(80);
      // Feathered body/breast
      const featherBase = typeId === 'snow_hawk' ? '#e0dcd6' : typeId === 'storm_petrel' ? '#4a6068' : typeId === 'great_eagle' ? '#6a5a40' : '#8a7a50';
      const featherDark = typeId === 'snow_hawk' ? '#b0aca6' : typeId === 'storm_petrel' ? '#2a4048' : typeId === 'great_eagle' ? '#4a3a20' : '#6a5a30';
      const featherLight = typeId === 'snow_hawk' ? '#f8f6f2' : typeId === 'storm_petrel' ? '#6a8090' : typeId === 'great_eagle' ? '#8a7a60' : '#aa9a70';
      const beakColor = typeId === 'snow_hawk' ? '#e8c840' : typeId === 'storm_petrel' ? '#cc6644' : '#d4a017';
      const headFeather = typeId === 'snow_hawk' ? '#f4f2ee' : typeId === 'storm_petrel' ? '#3a5058' : typeId === 'great_eagle' ? '#eee8d0' : '#ddd4b0';

      // Breast feathers (lower portion)
      const breastGrad = ctx.createLinearGradient(cx, birdCY, cx, py + ph);
      breastGrad.addColorStop(0, featherBase);
      breastGrad.addColorStop(1, featherDark);
      ctx.fillStyle = breastGrad;
      ctx.beginPath();
      ctx.ellipse(cx, birdCY + s(30), s(48), s(60), 0, 0, Math.PI * 2);
      ctx.fill();
      // Feather texture
      ctx.strokeStyle = featherDark;
      ctx.lineWidth = s(0.5);
      for (let row = 0; row < 6; row++) {
        for (let col = -3; col <= 3; col++) {
          const fx = cx + col * s(10) + (row % 2) * s(5);
          const fy = birdCY + s(10) + row * s(12);
          ctx.beginPath();
          ctx.ellipse(fx, fy, s(6), s(4), 0, 0.2, Math.PI - 0.2);
          ctx.stroke();
        }
      }

      // Head
      ctx.fillStyle = headFeather;
      ctx.beginPath();
      ctx.ellipse(cx, birdCY - s(24), s(22), s(26), 0, 0, Math.PI * 2);
      ctx.fill();
      // Head feather texture
      ctx.fillStyle = featherLight;
      ctx.beginPath();
      ctx.ellipse(cx, birdCY - s(28), s(18), s(16), 0, 0, Math.PI * 2);
      ctx.fill();
      // Crown feathers
      ctx.fillStyle = featherDark;
      ctx.beginPath();
      ctx.ellipse(cx, birdCY - s(46), s(12), s(8), 0, 0, Math.PI * 2);
      ctx.fill();

      // Eyes (fierce, golden)
      for (let side = -1; side <= 1; side += 2) {
        const ex = cx + side * s(10);
        const ey = birdCY - s(26);
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.ellipse(ex, ey, s(6), s(5), side * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd700';
        ctx.beginPath(); ctx.ellipse(ex, ey, s(5), s(4), side * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(ex + side * s(1), ey, s(2), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(ex + side * s(2), ey - s(1), s(1), 0, Math.PI * 2); ctx.fill();
        // Brow ridge
        ctx.fillStyle = featherDark;
        ctx.beginPath();
        ctx.moveTo(ex - side * s(7), ey - s(6));
        ctx.quadraticCurveTo(ex, ey - s(8), ex + side * s(8), ey - s(4));
        ctx.lineTo(ex + side * s(7), ey - s(3));
        ctx.quadraticCurveTo(ex, ey - s(6), ex - side * s(6), ey - s(5));
        ctx.fill();
      }

      // Beak
      ctx.fillStyle = beakColor;
      ctx.beginPath();
      ctx.moveTo(cx, birdCY - s(18));
      ctx.quadraticCurveTo(cx + s(4), birdCY - s(10), cx + s(2), birdCY - s(2));
      ctx.quadraticCurveTo(cx, birdCY, cx - s(2), birdCY - s(2));
      ctx.quadraticCurveTo(cx - s(4), birdCY - s(10), cx, birdCY - s(18));
      ctx.fill();
      // Beak highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.moveTo(cx, birdCY - s(17));
      ctx.quadraticCurveTo(cx + s(2), birdCY - s(12), cx + s(1), birdCY - s(4));
      ctx.lineTo(cx, birdCY - s(5));
      ctx.quadraticCurveTo(cx - s(1), birdCY - s(12), cx, birdCY - s(17));
      ctx.fill();
      // Nostril
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.ellipse(cx + s(2), birdCY - s(14), s(1.5), s(1), 0.3, 0, Math.PI * 2); ctx.fill();

    } else if (typeId === 'young_dragon') {
      // --- DRAGON portrait ---
      const dCY = py + s(70);
      // Neck/chest scales
      const scaleGrad = ctx.createLinearGradient(cx, dCY - s(10), cx, py + ph);
      scaleGrad.addColorStop(0, primary);
      scaleGrad.addColorStop(1, dark);
      ctx.fillStyle = scaleGrad;
      ctx.beginPath();
      ctx.ellipse(cx, dCY + s(20), s(44), s(60), 0, 0, Math.PI * 2);
      ctx.fill();
      // Belly scales
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(cx, dCY + s(24), s(28), s(50), 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = dark;
        ctx.lineWidth = s(0.5);
        ctx.beginPath();
        ctx.ellipse(cx, dCY + s(i * 10), s(24 - i), s(3), 0, 0, Math.PI);
        ctx.stroke();
      }
      // Head
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.ellipse(cx, dCY - s(20), s(24), s(22), 0, 0, Math.PI * 2);
      ctx.fill();
      // Snout
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(cx, dCY - s(8), s(16), s(10), 0, 0, Math.PI * 2);
      ctx.fill();
      // Horns
      ctx.fillStyle = '#555';
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(cx + side * s(14), dCY - s(36));
        ctx.lineTo(cx + side * s(22), dCY - s(56));
        ctx.lineTo(cx + side * s(8), dCY - s(32));
        ctx.fill();
      }
      // Crest
      ctx.fillStyle = accent;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(cx, dCY - s(38) - i * s(4));
        ctx.lineTo(cx - s(3), dCY - s(32) - i * s(4));
        ctx.lineTo(cx + s(3), dCY - s(32) - i * s(4));
        ctx.fill();
      }
      // Eyes
      for (let side = -1; side <= 1; side += 2) {
        const dex = cx + side * s(12);
        const dey = dCY - s(24);
        ctx.fillStyle = '#ffd700';
        ctx.beginPath(); ctx.ellipse(dex, dey, s(6), s(5), side * 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.fillRect(dex - s(0.8), dey - s(4), s(1.6), s(8));
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(dex + side * s(2), dey - s(2), s(1.5), 0, Math.PI * 2); ctx.fill();
      }
      // Nostrils
      ctx.fillStyle = '#ffa500';
      ctx.beginPath(); ctx.arc(cx - s(5), dCY - s(4), s(2.5), 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s(5), dCY - s(4), s(2.5), 0, Math.PI * 2); ctx.fill();
      // Smoke wisps
      ctx.fillStyle = 'rgba(255,120,0,0.25)';
      ctx.beginPath(); ctx.arc(cx, dCY + s(2), s(5), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,80,0,0.15)';
      ctx.beginPath(); ctx.arc(cx + s(6), dCY + s(6), s(4), 0, Math.PI * 2); ctx.fill();

    } else if (typeId === 'wraith') {
      // --- WRAITH portrait (ghostly ethereal) ---
      const wCY = py + s(70);
      // Ethereal body
      ctx.globalAlpha = 0.6;
      const wGrad = ctx.createLinearGradient(cx, py, cx, py + ph);
      wGrad.addColorStop(0, '#2a1a3a');
      wGrad.addColorStop(0.5, primary);
      wGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = wGrad;
      ctx.beginPath();
      ctx.ellipse(cx, wCY, s(44), s(70), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Tattered hood
      ctx.fillStyle = '#1a0a2a';
      ctx.beginPath();
      ctx.ellipse(cx, wCY - s(30), s(30), s(28), 0, Math.PI + 0.3, -0.3);
      ctx.fill();
      ctx.fillRect(cx - s(28), wCY - s(16), s(6), s(40));
      ctx.fillRect(cx + s(22), wCY - s(16), s(6), s(40));
      // Glowing eyes
      for (let side = -1; side <= 1; side += 2) {
        const wex = cx + side * s(10);
        const wey = wCY - s(22);
        ctx.fillStyle = '#aa44ff';
        ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(wex, wey, s(6), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#dd88ff';
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(wex, wey, s(3), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(wex, wey, s(1.5), 0, Math.PI * 2); ctx.fill();
      }
      // Ghostly wisps
      ctx.strokeStyle = 'rgba(170,68,255,0.3)';
      ctx.lineWidth = s(2);
      for (let i = 0; i < 4; i++) {
        const wx = cx + (rng() - 0.5) * s(60);
        const wy = wCY + s(10) + rng() * s(50);
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.quadraticCurveTo(wx + s(10), wy - s(15), wx + s(5), wy - s(30));
        ctx.stroke();
      }

    } else if (typeId === 'bone_colossus') {
      // --- BONE COLOSSUS portrait (massive skull construct) ---
      const bCY = py + s(65);
      // Massive ribcage/bone structure shoulders
      ctx.fillStyle = '#c8c0a8';
      ctx.beginPath();
      ctx.moveTo(cx - s(50), bCY + s(20));
      ctx.quadraticCurveTo(cx - s(55), py + ph, cx - s(30), py + ph);
      ctx.lineTo(cx + s(30), py + ph);
      ctx.quadraticCurveTo(cx + s(55), py + ph, cx + s(50), bCY + s(20));
      ctx.quadraticCurveTo(cx, bCY, cx - s(50), bCY + s(20));
      ctx.fill();
      // Rib lines
      ctx.strokeStyle = '#a09880';
      ctx.lineWidth = s(2);
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - s(4), bCY + s(20 + i * 10));
        ctx.quadraticCurveTo(cx - s(30), bCY + s(18 + i * 10), cx - s(40), bCY + s(24 + i * 10));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + s(4), bCY + s(20 + i * 10));
        ctx.quadraticCurveTo(cx + s(30), bCY + s(18 + i * 10), cx + s(40), bCY + s(24 + i * 10));
        ctx.stroke();
      }
      // Giant skull
      ctx.fillStyle = '#d8d0b8';
      ctx.beginPath();
      ctx.ellipse(cx, bCY - s(16), s(32), s(34), 0, 0, Math.PI * 2);
      ctx.fill();
      // Eye sockets
      for (let side = -1; side <= 1; side += 2) {
        ctx.fillStyle = '#1a0a2a';
        ctx.beginPath(); ctx.ellipse(cx + side * s(12), bCY - s(20), s(10), s(8), side * 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8e44ad';
        ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.arc(cx + side * s(12), bCY - s(20), s(5), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // Nasal cavity
      ctx.fillStyle = '#2a1a0a';
      ctx.beginPath();
      ctx.moveTo(cx, bCY - s(12));
      ctx.lineTo(cx - s(5), bCY - s(2));
      ctx.lineTo(cx + s(5), bCY - s(2));
      ctx.fill();
      // Jaw/teeth
      ctx.fillStyle = '#c8c0a8';
      ctx.fillRect(cx - s(20), bCY + s(4), s(40), s(8));
      ctx.fillStyle = '#d8d0b8';
      for (let i = -4; i <= 4; i++) {
        ctx.fillRect(cx + i * s(4) - s(1.5), bCY + s(2), s(3), s(6));
      }
      // Cracks
      ctx.strokeStyle = '#8a8068';
      ctx.lineWidth = s(1);
      ctx.beginPath(); ctx.moveTo(cx + s(8), bCY - s(40)); ctx.lineTo(cx + s(12), bCY - s(20)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - s(14), bCY - s(36)); ctx.lineTo(cx - s(10), bCY - s(18)); ctx.stroke();

    } else if (typeId === 'treant') {
      // --- TREANT portrait (living tree face) ---
      const tCY = py + s(70);
      // Bark body/trunk
      const barkGrad = ctx.createLinearGradient(cx, py, cx, py + ph);
      barkGrad.addColorStop(0, '#5a4a30');
      barkGrad.addColorStop(0.5, '#4a3a20');
      barkGrad.addColorStop(1, '#3a2a14');
      ctx.fillStyle = barkGrad;
      ctx.beginPath();
      ctx.moveTo(cx - s(40), tCY + s(10));
      ctx.quadraticCurveTo(cx - s(50), py + ph, cx - s(30), py + ph);
      ctx.lineTo(cx + s(30), py + ph);
      ctx.quadraticCurveTo(cx + s(50), py + ph, cx + s(40), tCY + s(10));
      ctx.quadraticCurveTo(cx, tCY - s(6), cx - s(40), tCY + s(10));
      ctx.fill();
      // Bark texture
      ctx.strokeStyle = '#3a2a14';
      ctx.lineWidth = s(1.5);
      for (let i = 0; i < 8; i++) {
        const bx = cx + (rng() - 0.5) * s(60);
        const by = tCY + s(10) + rng() * s(70);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (rng() - 0.5) * s(10), by + s(10 + rng() * 15));
        ctx.stroke();
      }
      // Branch shoulders
      for (let side = -1; side <= 1; side += 2) {
        ctx.fillStyle = '#5a4a30';
        ctx.beginPath();
        ctx.moveTo(cx + side * s(30), tCY + s(14));
        ctx.quadraticCurveTo(cx + side * s(50), tCY - s(10), cx + side * s(55), tCY - s(20));
        ctx.lineTo(cx + side * s(52), tCY - s(16));
        ctx.quadraticCurveTo(cx + side * s(44), tCY + s(0), cx + side * s(28), tCY + s(20));
        ctx.fill();
        // Small leaves
        ctx.fillStyle = '#27ae60';
        for (let l = 0; l < 3; l++) {
          const lx = cx + side * s(40 + l * 6);
          const ly = tCY - s(14 + l * 4);
          ctx.beginPath(); ctx.ellipse(lx, ly, s(4), s(2.5), side * 0.5, 0, Math.PI * 2); ctx.fill();
        }
      }
      // Head (knothole face)
      ctx.fillStyle = '#6a5a3a';
      ctx.beginPath();
      ctx.ellipse(cx, tCY - s(20), s(28), s(30), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a4a2a';
      ctx.beginPath();
      ctx.ellipse(cx, tCY - s(20), s(24), s(26), 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyes (glowing green knotholes)
      for (let side = -1; side <= 1; side += 2) {
        const tex = cx + side * s(10);
        const tey = tCY - s(24);
        ctx.fillStyle = '#1a1008';
        ctx.beginPath(); ctx.ellipse(tex, tey, s(7), s(5), side * 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#27ae60';
        ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(tex, tey, s(4), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#80ff80';
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(tex, tey, s(2), 0, Math.PI * 2); ctx.fill();
      }
      // Mouth (gnarled knothole)
      ctx.fillStyle = '#2a1a08';
      ctx.beginPath();
      ctx.moveTo(cx - s(12), tCY - s(6));
      ctx.quadraticCurveTo(cx, tCY + s(4), cx + s(12), tCY - s(6));
      ctx.quadraticCurveTo(cx, tCY - s(2), cx - s(12), tCY - s(6));
      ctx.fill();
      // Moss/leaves on top
      ctx.fillStyle = '#27ae60';
      for (let i = 0; i < 6; i++) {
        const mx = cx + (rng() - 0.5) * s(40);
        const my = tCY - s(40) - rng() * s(16);
        ctx.beginPath(); ctx.ellipse(mx, my, s(5), s(3), rng() * 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#2a8a40';
      for (let i = 0; i < 4; i++) {
        const mx = cx + (rng() - 0.5) * s(30);
        const my = tCY - s(44) - rng() * s(12);
        ctx.beginPath(); ctx.ellipse(mx, my, s(4), s(2.5), rng() * 2, 0, Math.PI * 2); ctx.fill();
      }

    } else if (typeId === 'void_walker') {
      // --- VOID WALKER portrait (dark ethereal entity) ---
      const vCY = py + s(70);
      // Dark smoky body
      ctx.globalAlpha = 0.7;
      const vGrad = ctx.createRadialGradient(cx, vCY, s(5), cx, vCY, s(60));
      vGrad.addColorStop(0, '#3a1a5a');
      vGrad.addColorStop(0.6, '#1a0a2a');
      vGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = vGrad;
      ctx.beginPath(); ctx.ellipse(cx, vCY, s(50), s(65), 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // Inner form
      ctx.fillStyle = '#2a1040';
      ctx.beginPath(); ctx.ellipse(cx, vCY - s(10), s(30), s(40), 0, 0, Math.PI * 2); ctx.fill();
      // Shoulders
      for (let side = -1; side <= 1; side += 2) {
        ctx.fillStyle = '#3a1a5a';
        ctx.beginPath(); ctx.ellipse(cx + side * s(28), vCY + s(6), s(16), s(12), side * 0.3, 0, Math.PI * 2); ctx.fill();
      }
      // Glowing eyes
      for (let side = -1; side <= 1; side += 2) {
        ctx.fillStyle = '#8844cc';
        ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(cx + side * s(10), vCY - s(20), s(8), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#bb66ff';
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(cx + side * s(10), vCY - s(20), s(4), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx + side * s(10), vCY - s(20), s(1.5), 0, Math.PI * 2); ctx.fill();
      }
      // Dark energy wisps
      ctx.strokeStyle = 'rgba(136,68,204,0.4)';
      ctx.lineWidth = s(2);
      for (let i = 0; i < 5; i++) {
        const wx = cx + (rng() - 0.5) * s(70);
        const wy = vCY + rng() * s(50) - s(20);
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.quadraticCurveTo(wx + (rng()-0.5) * s(20), wy - s(20), wx + (rng()-0.5) * s(15), wy - s(40));
        ctx.stroke();
      }

    } else if (typeId === 'imp') {
      // --- IMP portrait (small demon) ---
      const iCY = py + s(75);
      // Body
      ctx.fillStyle = '#8a2020';
      ctx.beginPath();
      ctx.ellipse(cx, iCY + s(10), s(28), s(40), 0, 0, Math.PI * 2);
      ctx.fill();
      // Shoulders
      ctx.fillStyle = '#6a1010';
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath(); ctx.ellipse(cx + side * s(24), iCY + s(8), s(12), s(8), side * 0.3, 0, Math.PI * 2); ctx.fill();
      }
      // Head
      ctx.fillStyle = '#aa3030';
      ctx.beginPath(); ctx.ellipse(cx, iCY - s(18), s(18), s(20), 0, 0, Math.PI * 2); ctx.fill();
      // Horns
      ctx.fillStyle = '#444';
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(cx + side * s(10), iCY - s(34));
        ctx.lineTo(cx + side * s(18), iCY - s(50));
        ctx.lineTo(cx + side * s(6), iCY - s(30));
        ctx.fill();
      }
      // Pointed ears
      for (let side = -1; side <= 1; side += 2) {
        ctx.fillStyle = '#992828';
        ctx.beginPath();
        ctx.moveTo(cx + side * s(16), iCY - s(20));
        ctx.lineTo(cx + side * s(30), iCY - s(28));
        ctx.lineTo(cx + side * s(18), iCY - s(12));
        ctx.fill();
      }
      // Glowing eyes
      for (let side = -1; side <= 1; side += 2) {
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath(); ctx.ellipse(cx + side * s(7), iCY - s(20), s(5), s(3.5), 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff4400';
        ctx.beginPath(); ctx.arc(cx + side * s(7), iCY - s(20), s(2), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(cx + side * s(7), iCY - s(20), s(1), 0, Math.PI * 2); ctx.fill();
      }
      // Wicked grin
      ctx.strokeStyle = '#440000';
      ctx.lineWidth = s(1.5);
      ctx.beginPath();
      ctx.arc(cx, iCY - s(8), s(8), 0.2, Math.PI - 0.2);
      ctx.stroke();
      // Teeth
      ctx.fillStyle = '#eee';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * s(3), iCY - s(8));
        ctx.lineTo(cx + i * s(3) - s(1), iCY - s(5));
        ctx.lineTo(cx + i * s(3) + s(1), iCY - s(5));
        ctx.fill();
      }

    // =================================================================
    //  SHADOW PRIEST (Undead) faction humanoid portraits
    // =================================================================
    } else if (charId === 'shadow_priest') {

      if (typeId === 'skeleton') {
        // --- SKELETON warrior portrait ---
        // Bone colored armor shoulders
        ctx.fillStyle = '#6a6050';
        ctx.beginPath();
        ctx.moveTo(cx - s(48), bodyY + s(10));
        ctx.quadraticCurveTo(cx - s(50), bodyY + s(40), cx - s(40), py + ph);
        ctx.lineTo(cx + s(40), py + ph);
        ctx.quadraticCurveTo(cx + s(50), bodyY + s(40), cx + s(48), bodyY + s(10));
        ctx.quadraticCurveTo(cx, bodyY - s(4), cx - s(48), bodyY + s(10));
        ctx.fill();
        // Tattered cloth
        ctx.fillStyle = '#3a2a4a';
        ctx.beginPath();
        ctx.moveTo(cx - s(18), bodyY + s(2));
        ctx.lineTo(cx - s(22), py + ph);
        ctx.lineTo(cx + s(22), py + ph);
        ctx.lineTo(cx + s(18), bodyY + s(2));
        ctx.fill();
        // Rusted pauldrons
        ctx.fillStyle = '#8a7060';
        ctx.beginPath(); ctx.ellipse(cx - s(40), bodyY + s(14), s(12), s(8), -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + s(40), bodyY + s(14), s(12), s(8), 0.3, 0, Math.PI * 2); ctx.fill();
        // Spine/neck bones
        ctx.fillStyle = '#c8c0a8';
        ctx.fillRect(cx - s(6), bodyY - s(10), s(12), s(14));
        ctx.fillStyle = '#b0a890';
        ctx.fillRect(cx - s(4), bodyY - s(8), s(8), s(3));
        ctx.fillRect(cx - s(4), bodyY - s(3), s(8), s(3));
        ctx.fillRect(cx - s(4), bodyY + s(2), s(8), s(3));
        // Skull
        ctx.fillStyle = '#d8d0b8';
        ctx.beginPath();
        ctx.ellipse(cx, headCY, s(20), s(24), 0, 0, Math.PI * 2);
        ctx.fill();
        // Cranium highlight
        ctx.fillStyle = '#e8e0c8';
        ctx.beginPath();
        ctx.ellipse(cx, headCY - s(8), s(16), s(14), 0, 0, Math.PI * 2);
        ctx.fill();
        // Eye sockets
        for (let side = -1; side <= 1; side += 2) {
          ctx.fillStyle = '#0a0606';
          ctx.beginPath(); ctx.ellipse(cx + side * s(8), headCY - s(2), s(7), s(6), side * 0.1, 0, Math.PI * 2); ctx.fill();
          // Soul fire in eyes
          ctx.fillStyle = '#8e44ad';
          ctx.globalAlpha = 0.8;
          ctx.beginPath(); ctx.arc(cx + side * s(8), headCY - s(2), s(3.5), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#cc88ff';
          ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(cx + side * s(8), headCY - s(2), s(1.5), 0, Math.PI * 2); ctx.fill();
        }
        // Nasal cavity
        ctx.fillStyle = '#1a1008';
        ctx.beginPath();
        ctx.moveTo(cx, headCY + s(2));
        ctx.lineTo(cx - s(3), headCY + s(8));
        ctx.lineTo(cx + s(3), headCY + s(8));
        ctx.fill();
        // Jaw
        ctx.fillStyle = '#c8c0a8';
        ctx.beginPath();
        ctx.moveTo(cx - s(16), headCY + s(10));
        ctx.quadraticCurveTo(cx, headCY + s(22), cx + s(16), headCY + s(10));
        ctx.fill();
        // Teeth
        ctx.fillStyle = '#d8d0b8';
        for (let i = -3; i <= 3; i++) {
          ctx.fillRect(cx + i * s(3.5) - s(1), headCY + s(10), s(2.5), s(4));
        }
        // Cracks in skull
        ctx.strokeStyle = '#a09880';
        ctx.lineWidth = s(0.8);
        ctx.beginPath(); ctx.moveTo(cx + s(6), headCY - s(20)); ctx.lineTo(cx + s(10), headCY - s(6)); ctx.stroke();

      } else if (typeId === 'plague_archer') {
        // --- PLAGUE ARCHER portrait (rotting undead archer) ---
        drawLightArmor('#2a1a3a', '#3a2a4a');
        // Quiver strap
        ctx.strokeStyle = '#4a3a2a';
        ctx.lineWidth = s(3);
        ctx.beginPath(); ctx.moveTo(cx + s(18), bodyY); ctx.lineTo(cx - s(14), bodyY + s(36)); ctx.stroke();
        // Neck (rotting)
        ctx.fillStyle = skin;
        ctx.fillRect(cx - s(8), bodyY - s(10), s(16), s(14));
        // Head
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.ellipse(cx, headCY, s(20), s(24), 0, 0, Math.PI * 2); ctx.fill();
        // Exposed bone patches
        ctx.fillStyle = '#c8c0a8';
        ctx.beginPath(); ctx.ellipse(cx + s(8), headCY - s(8), s(6), s(5), 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx - s(12), headCY + s(4), s(4), s(3), -0.2, 0, Math.PI * 2); ctx.fill();
        drawHumanEars();
        // One eye normal, one glowing
        const ex1 = cx - eyeSpacing;
        ctx.fillStyle = '#eee';
        ctx.beginPath(); ctx.ellipse(ex1, eyeY, s(5), s(3), 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8e44ad';
        ctx.beginPath(); ctx.arc(ex1, eyeY, s(2), 0, Math.PI * 2); ctx.fill();
        const ex2 = cx + eyeSpacing;
        ctx.fillStyle = '#8e44ad';
        ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.arc(ex2, eyeY, s(5), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#cc88ff';
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(ex2, eyeY, s(2.5), 0, Math.PI * 2); ctx.fill();
        drawBrows('#4a4038');
        drawNose();
        // Rotting mouth
        ctx.fillStyle = '#3a2020';
        ctx.fillRect(cx - s(5), headCY + s(12), s(10), s(3));
        drawHood('#1a0a2a');

      } else if (typeId === 'death_knight') {
        // --- DEATH KNIGHT portrait (armored undead rider) ---
        drawHeavyArmor('#3a3040', '#5a4060', '#1a1020');
        // Neck (bone)
        ctx.fillStyle = '#b0a890';
        ctx.fillRect(cx - s(8), bodyY - s(10), s(16), s(14));
        // Skull head
        ctx.fillStyle = '#d0c8b0';
        ctx.beginPath(); ctx.ellipse(cx, headCY, s(20), s(24), 0, 0, Math.PI * 2); ctx.fill();
        // Dark helm
        ctx.fillStyle = '#2a2030';
        ctx.beginPath(); ctx.ellipse(cx, headY + s(8), s(24), s(20), 0, Math.PI + 0.2, -0.2); ctx.fill();
        // Visor slit
        ctx.fillStyle = '#0a0606';
        ctx.fillRect(cx - s(16), headCY - s(4), s(32), s(4));
        // Glowing eyes through visor
        for (let side = -1; side <= 1; side += 2) {
          ctx.fillStyle = '#8e44ad';
          ctx.globalAlpha = 0.9;
          ctx.beginPath(); ctx.arc(cx + side * s(8), headCY - s(2), s(4), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#cc88ff';
          ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(cx + side * s(8), headCY - s(2), s(2), 0, Math.PI * 2); ctx.fill();
        }
        // Dark plume
        ctx.fillStyle = '#3a1a5a';
        ctx.fillRect(cx - s(2), headY - s(12), s(4), s(18));
        // Jaw bone visible below helm
        ctx.fillStyle = '#c0b8a0';
        ctx.beginPath();
        ctx.moveTo(cx - s(14), headCY + s(8));
        ctx.quadraticCurveTo(cx, headCY + s(18), cx + s(14), headCY + s(8));
        ctx.fill();
      }

    // =================================================================
    //  FOREST WARDEN (Elven) faction portraits
    // =================================================================
    } else if (charId === 'forest_warden') {

      if (typeId === 'sentinel') {
        // --- ELVEN SENTINEL portrait ---
        // Elegant leaf-themed armor
        const ag = ctx.createLinearGradient(cx - s(50), bodyY, cx + s(50), bodyY + s(80));
        ag.addColorStop(0, '#2a6a30');
        ag.addColorStop(0.5, '#1a4a20');
        ag.addColorStop(1, '#0a2a10');
        ctx.fillStyle = ag;
        ctx.beginPath();
        ctx.moveTo(cx - s(48), bodyY + s(10));
        ctx.quadraticCurveTo(cx - s(50), bodyY + s(40), cx - s(40), py + ph);
        ctx.lineTo(cx + s(40), py + ph);
        ctx.quadraticCurveTo(cx + s(50), bodyY + s(40), cx + s(48), bodyY + s(10));
        ctx.quadraticCurveTo(cx, bodyY - s(4), cx - s(48), bodyY + s(10));
        ctx.fill();
        // Leaf-shaped pauldrons
        ctx.fillStyle = accent;
        for (let side = -1; side <= 1; side += 2) {
          ctx.beginPath();
          ctx.moveTo(cx + side * s(30), bodyY + s(4));
          ctx.quadraticCurveTo(cx + side * s(50), bodyY + s(6), cx + side * s(48), bodyY + s(16));
          ctx.quadraticCurveTo(cx + side * s(38), bodyY + s(22), cx + side * s(30), bodyY + s(18));
          ctx.quadraticCurveTo(cx + side * s(34), bodyY + s(12), cx + side * s(30), bodyY + s(4));
          ctx.fill();
        }
        // Golden vine on chest
        ctx.strokeStyle = '#c8a030';
        ctx.lineWidth = s(1.5);
        ctx.beginPath();
        ctx.moveTo(cx, bodyY + s(2));
        ctx.quadraticCurveTo(cx - s(8), bodyY + s(12), cx, bodyY + s(22));
        ctx.quadraticCurveTo(cx + s(8), bodyY + s(32), cx, bodyY + s(42));
        ctx.stroke();
        // Gorget
        ctx.fillStyle = '#3a8a40';
        ctx.beginPath(); ctx.ellipse(cx, bodyY + s(2), s(18), s(8), 0, Math.PI, Math.PI * 2); ctx.fill();
        drawNeckAndHead();
        drawElfEars();
        drawEyes();
        drawBrows();
        drawNose();
        drawMouth();
        drawScar();
        // Elven circlet
        ctx.strokeStyle = '#c8a030';
        ctx.lineWidth = s(2);
        ctx.beginPath();
        ctx.ellipse(cx, headY + s(10), s(23), s(12), 0, Math.PI + 0.3, -0.3);
        ctx.stroke();
        // Gem on circlet
        ctx.fillStyle = '#27ae60';
        ctx.beginPath(); ctx.arc(cx, headY + s(4), s(3), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#80ff80';
        ctx.beginPath(); ctx.arc(cx - s(0.5), headY + s(3), s(1), 0, Math.PI * 2); ctx.fill();
        // Long flowing hair (elves always have beautiful hair)
        const elfHair = ['#c8a860', '#e8d8a0', '#8a6a30', '#f0e8d0', '#aa8840'][Math.floor(rng() * 5)];
        ctx.fillStyle = elfHair;
        ctx.beginPath(); ctx.ellipse(cx, headY + s(6), s(24), s(20), 0, Math.PI + 0.2, -0.2); ctx.fill();
        ctx.fillRect(cx - s(24), headCY - s(8), s(5), s(44));
        ctx.fillRect(cx + s(19), headCY - s(8), s(5), s(44));

      } else if (typeId === 'elven_archer') {
        // --- ELVEN ARCHER portrait ---
        drawLightArmor('#1a4a20', '#27ae60');
        // Quiver strap
        ctx.strokeStyle = '#5a4a2a';
        ctx.lineWidth = s(2.5);
        ctx.beginPath(); ctx.moveTo(cx + s(18), bodyY); ctx.lineTo(cx - s(14), bodyY + s(36)); ctx.stroke();
        ctx.fillStyle = skin;
        ctx.fillRect(cx - s(8), bodyY - s(10), s(16), s(14));
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.ellipse(cx, headCY, s(20), s(24), 0, 0, Math.PI * 2); ctx.fill();
        drawElfEars();
        drawEyes('#228833');
        drawBrows();
        drawNose();
        drawMouth();
        drawScar();
        // Elegant hood
        drawHood('#1a3a14');

      } else if (typeId === 'stag_rider') {
        // --- STAG RIDER portrait ---
        // Light elven plate
        const ag = ctx.createLinearGradient(cx, bodyY, cx, bodyY + s(60));
        ag.addColorStop(0, '#4a8a50');
        ag.addColorStop(1, '#1a4a20');
        ctx.fillStyle = ag;
        ctx.beginPath();
        ctx.moveTo(cx - s(44), bodyY + s(8));
        ctx.quadraticCurveTo(cx - s(46), bodyY + s(40), cx - s(36), py + ph);
        ctx.lineTo(cx + s(36), py + ph);
        ctx.quadraticCurveTo(cx + s(46), bodyY + s(40), cx + s(44), bodyY + s(8));
        ctx.quadraticCurveTo(cx, bodyY - s(4), cx - s(44), bodyY + s(8));
        ctx.fill();
        // Antler motif pauldrons
        ctx.fillStyle = '#6aaa60';
        for (let side = -1; side <= 1; side += 2) {
          ctx.beginPath(); ctx.ellipse(cx + side * s(36), bodyY + s(10), s(12), s(8), side * 0.3, 0, Math.PI * 2); ctx.fill();
          // Antler detail
          ctx.strokeStyle = '#8a7a50';
          ctx.lineWidth = s(2);
          ctx.beginPath();
          ctx.moveTo(cx + side * s(38), bodyY + s(4));
          ctx.lineTo(cx + side * s(44), bodyY - s(8));
          ctx.moveTo(cx + side * s(41), bodyY - s(2));
          ctx.lineTo(cx + side * s(48), bodyY - s(4));
          ctx.stroke();
        }
        drawNeckAndHead();
        drawElfEars();
        drawEyes();
        drawBrows();
        drawNose();
        drawMouth();
        drawBeard();
        // Leafy crown
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.ellipse(cx, headY + s(4), s(22), s(10), 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a8a20';
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.ellipse(cx + i * s(6), headY + s(2), s(4), s(7), 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

    // =================================================================
    //  ORC WARCHIEF faction portraits
    // =================================================================
    } else if (charId === 'orc_warchief') {

      if (typeId === 'half_orc') {
        // --- HALF-ORC warrior portrait ---
        drawHeavyArmor('#4a5a28', '#6a7a38', '#2a3a14');
        drawNeckAndHead(24, 28);
        drawOrcEars();
        // Orc eyes (fierce, yellow-tinted)
        drawEyes('#aa8800');
        drawBrows('#2a3a14');
        drawNose(4);
        // Tusks
        ctx.fillStyle = '#e8e0c8';
        ctx.beginPath();
        ctx.moveTo(cx - s(6), headCY + s(12));
        ctx.lineTo(cx - s(8), headCY + s(4));
        ctx.lineTo(cx - s(4), headCY + s(10));
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + s(6), headCY + s(12));
        ctx.lineTo(cx + s(8), headCY + s(4));
        ctx.lineTo(cx + s(4), headCY + s(10));
        ctx.fill();
        // Wide mouth
        ctx.fillStyle = '#3a2010';
        ctx.fillRect(cx - s(8), headCY + s(12), s(16), s(3));
        drawBeard();
        drawScar();
        // Topknot or helm
        const orcHelm = rng() > 0.5;
        if (orcHelm) {
          ctx.fillStyle = '#555';
          ctx.beginPath(); ctx.ellipse(cx, headY + s(8), s(24), s(18), 0, Math.PI, Math.PI * 2); ctx.fill();
          // Spikes
          ctx.fillStyle = '#666';
          ctx.beginPath();
          ctx.moveTo(cx, headY - s(12));
          ctx.lineTo(cx - s(4), headY + s(2));
          ctx.lineTo(cx + s(4), headY + s(2));
          ctx.fill();
        } else {
          // Dark topknot
          ctx.fillStyle = '#1a1008';
          ctx.beginPath(); ctx.ellipse(cx, headY + s(6), s(20), s(14), 0, Math.PI, Math.PI * 2); ctx.fill();
          ctx.fillRect(cx - s(4), headY - s(10), s(8), s(16));
          ctx.beginPath(); ctx.ellipse(cx, headY - s(10), s(6), s(8), 0, 0, Math.PI * 2); ctx.fill();
        }

      } else if (typeId === 'goblin') {
        // --- GOBLIN portrait (small, green, big nose/ears) ---
        const gHeadY = py + s(40);
        const gBodyY = gHeadY + s(48);
        const gHeadCY = gHeadY + s(22);
        // Scrappy leather armor
        ctx.fillStyle = '#5a4a28';
        ctx.beginPath();
        ctx.moveTo(cx - s(40), gBodyY + s(8));
        ctx.quadraticCurveTo(cx - s(44), gBodyY + s(30), cx - s(34), py + ph);
        ctx.lineTo(cx + s(34), py + ph);
        ctx.quadraticCurveTo(cx + s(44), gBodyY + s(30), cx + s(40), gBodyY + s(8));
        ctx.quadraticCurveTo(cx, gBodyY - s(4), cx - s(40), gBodyY + s(8));
        ctx.fill();
        // Patches
        ctx.fillStyle = '#4a3a18';
        ctx.fillRect(cx - s(20), gBodyY + s(10), s(14), s(12));
        ctx.fillStyle = '#6a5a38';
        ctx.fillRect(cx + s(8), gBodyY + s(16), s(10), s(8));
        // Neck
        ctx.fillStyle = skin;
        ctx.fillRect(cx - s(6), gBodyY - s(8), s(12), s(12));
        // Head (larger proportionally)
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.ellipse(cx, gHeadCY, s(24), s(26), 0, 0, Math.PI * 2); ctx.fill();
        // Giant pointed ears
        for (let side = -1; side <= 1; side += 2) {
          ctx.fillStyle = skinShadow;
          ctx.beginPath();
          ctx.moveTo(cx + side * s(22), gHeadCY - s(2));
          ctx.quadraticCurveTo(cx + side * s(42), gHeadCY - s(20), cx + side * s(48), gHeadCY - s(10));
          ctx.quadraticCurveTo(cx + side * s(38), gHeadCY + s(6), cx + side * s(22), gHeadCY + s(8));
          ctx.fill();
          ctx.fillStyle = skin;
          ctx.beginPath();
          ctx.moveTo(cx + side * s(22), gHeadCY - s(1));
          ctx.quadraticCurveTo(cx + side * s(38), gHeadCY - s(16), cx + side * s(44), gHeadCY - s(9));
          ctx.quadraticCurveTo(cx + side * s(34), gHeadCY + s(4), cx + side * s(22), gHeadCY + s(7));
          ctx.fill();
        }
        // Eyes (large, yellow)
        for (let side = -1; side <= 1; side += 2) {
          const gex = cx + side * s(10);
          const gey = gHeadCY - s(4);
          ctx.fillStyle = '#eeee88';
          ctx.beginPath(); ctx.ellipse(gex, gey, s(8), s(6), 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#886600';
          ctx.beginPath(); ctx.arc(gex + side * s(1), gey, s(3.5), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#111';
          ctx.beginPath(); ctx.arc(gex + side * s(1), gey, s(1.8), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.beginPath(); ctx.arc(gex + side * s(2), gey - s(1.5), s(1), 0, Math.PI * 2); ctx.fill();
        }
        // Big hooked nose
        ctx.fillStyle = skinShadow;
        ctx.beginPath();
        ctx.moveTo(cx, gHeadCY - s(6));
        ctx.quadraticCurveTo(cx + s(2), gHeadCY + s(4), cx + s(6), gHeadCY + s(10));
        ctx.lineTo(cx - s(4), gHeadCY + s(10));
        ctx.quadraticCurveTo(cx - s(2), gHeadCY + s(4), cx, gHeadCY - s(6));
        ctx.fill();
        // Wide grin
        ctx.fillStyle = '#2a1a08';
        ctx.beginPath();
        ctx.moveTo(cx - s(12), gHeadCY + s(14));
        ctx.quadraticCurveTo(cx, gHeadCY + s(20), cx + s(12), gHeadCY + s(14));
        ctx.fill();
        // Pointy teeth
        ctx.fillStyle = '#ddd';
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i * s(3), gHeadCY + s(14));
          ctx.lineTo(cx + i * s(3) + s(1.5), gHeadCY + s(17));
          ctx.lineTo(cx + i * s(3) - s(1.5), gHeadCY + s(17));
          ctx.fill();
        }
        // Scrappy hair
        ctx.fillStyle = '#1a1a08';
        for (let i = 0; i < 5; i++) {
          const hx = cx + (rng() - 0.5) * s(30);
          const hy = gHeadCY - s(24);
          ctx.fillRect(hx, hy, s(2), s(6 + rng() * 10));
        }

      } else if (typeId === 'troll') {
        // --- TROLL portrait (tall, lanky, blue-green tint) ---
        // Troll skin override (blue-green)
        const trollSkin = '#5a8a7a';
        const trollSkinShadow = '#3a6a5a';
        const trollSkinHighlight = '#7aaa9a';
        // Minimal armor, tribal
        ctx.fillStyle = '#4a3a18';
        ctx.beginPath();
        ctx.moveTo(cx - s(44), bodyY + s(10));
        ctx.quadraticCurveTo(cx - s(48), bodyY + s(40), cx - s(36), py + ph);
        ctx.lineTo(cx + s(36), py + ph);
        ctx.quadraticCurveTo(cx + s(48), bodyY + s(40), cx + s(44), bodyY + s(10));
        ctx.quadraticCurveTo(cx, bodyY - s(4), cx - s(44), bodyY + s(10));
        ctx.fill();
        // Tribal shoulder wraps
        ctx.fillStyle = '#6a5a28';
        for (let side = -1; side <= 1; side += 2) {
          ctx.beginPath(); ctx.ellipse(cx + side * s(36), bodyY + s(14), s(12), s(8), side * 0.3, 0, Math.PI * 2); ctx.fill();
        }
        // Bone necklace
        ctx.fillStyle = '#d8d0b8';
        ctx.strokeStyle = '#5a4a28';
        ctx.lineWidth = s(1);
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath(); ctx.ellipse(cx + i * s(6), bodyY + s(4), s(2), s(4), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        // Neck
        ctx.fillStyle = trollSkin;
        ctx.fillRect(cx - s(8), bodyY - s(10), s(16), s(14));
        // Head (elongated)
        ctx.fillStyle = trollSkin;
        ctx.beginPath(); ctx.ellipse(cx, headCY, s(20), s(28), 0, 0, Math.PI * 2); ctx.fill();
        // Long pointed ears
        for (let side = -1; side <= 1; side += 2) {
          ctx.fillStyle = trollSkinShadow;
          ctx.beginPath();
          ctx.moveTo(cx + side * s(18), headCY - s(4));
          ctx.quadraticCurveTo(cx + side * s(38), headCY - s(22), cx + side * s(44), headCY - s(14));
          ctx.quadraticCurveTo(cx + side * s(34), headCY + s(4), cx + side * s(18), headCY + s(8));
          ctx.fill();
        }
        // Eyes (red, menacing)
        for (let side = -1; side <= 1; side += 2) {
          const tex = cx + side * s(8);
          ctx.fillStyle = '#ffcc88';
          ctx.beginPath(); ctx.ellipse(tex, eyeY, s(5), s(3), 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#cc2200';
          ctx.beginPath(); ctx.arc(tex + side * s(1), eyeY, s(2), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#111';
          ctx.beginPath(); ctx.arc(tex + side * s(1), eyeY, s(1), 0, Math.PI * 2); ctx.fill();
        }
        // Long nose
        ctx.fillStyle = trollSkinShadow;
        ctx.beginPath();
        ctx.moveTo(cx, headCY - s(6));
        ctx.quadraticCurveTo(cx + s(3), headCY + s(6), cx + s(2), headCY + s(14));
        ctx.lineTo(cx - s(3), headCY + s(12));
        ctx.quadraticCurveTo(cx - s(2), headCY + s(4), cx, headCY - s(6));
        ctx.fill();
        // Tusks (upward from lower jaw)
        ctx.fillStyle = '#e8e0c8';
        for (let side = -1; side <= 1; side += 2) {
          ctx.beginPath();
          ctx.moveTo(cx + side * s(8), headCY + s(18));
          ctx.lineTo(cx + side * s(10), headCY + s(6));
          ctx.lineTo(cx + side * s(6), headCY + s(16));
          ctx.fill();
        }
        // Wide mouth
        ctx.fillStyle = '#2a1a08';
        ctx.fillRect(cx - s(8), headCY + s(16), s(16), s(3));
        // Wild hair
        ctx.fillStyle = '#cc4400';
        ctx.beginPath(); ctx.ellipse(cx, headY + s(2), s(18), s(12), 0, Math.PI, Math.PI * 2); ctx.fill();
        // Mohawk-style spikes
        for (let i = -2; i <= 2; i++) {
          ctx.fillRect(cx + i * s(5) - s(2), headY - s(8 + Math.abs(i) * 3), s(4), s(12 + Math.abs(i) * 3));
        }

      } else if (typeId === 'thrall') {
        // --- THRALL portrait (orc shaman) ---
        // Robes/ritual garb
        ctx.fillStyle = '#3a4a28';
        ctx.beginPath();
        ctx.moveTo(cx - s(46), bodyY + s(8));
        ctx.quadraticCurveTo(cx - s(50), bodyY + s(40), cx - s(40), py + ph);
        ctx.lineTo(cx + s(40), py + ph);
        ctx.quadraticCurveTo(cx + s(50), bodyY + s(40), cx + s(46), bodyY + s(8));
        ctx.quadraticCurveTo(cx, bodyY - s(4), cx - s(46), bodyY + s(8));
        ctx.fill();
        // Shaman shoulder totems
        for (let side = -1; side <= 1; side += 2) {
          ctx.fillStyle = '#5a4a28';
          ctx.beginPath(); ctx.ellipse(cx + side * s(38), bodyY + s(12), s(14), s(10), side * 0.3, 0, Math.PI * 2); ctx.fill();
          // Feathers on shoulders
          ctx.fillStyle = '#cc4400';
          ctx.fillRect(cx + side * s(40), bodyY, s(3), s(12));
          ctx.fillStyle = '#27ae60';
          ctx.fillRect(cx + side * s(44), bodyY + s(2), s(3), s(10));
        }
        // Beads/fetishes
        ctx.fillStyle = '#d4a017';
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath(); ctx.arc(cx + i * s(6), bodyY + s(4), s(2), 0, Math.PI * 2); ctx.fill();
        }
        // Neck
        ctx.fillStyle = skin;
        ctx.fillRect(cx - s(10), bodyY - s(10), s(20), s(14));
        // Head
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.ellipse(cx, headCY, s(22), s(26), 0, 0, Math.PI * 2); ctx.fill();
        drawOrcEars();
        drawEyes('#44aa00');
        drawBrows('#2a3a14');
        drawNose(3);
        // Small tusks
        ctx.fillStyle = '#e8e0c8';
        for (let side = -1; side <= 1; side += 2) {
          ctx.beginPath();
          ctx.moveTo(cx + side * s(5), headCY + s(12));
          ctx.lineTo(cx + side * s(6), headCY + s(6));
          ctx.lineTo(cx + side * s(3.5), headCY + s(10));
          ctx.fill();
        }
        drawMouth();
        drawBeard();
        // Shaman headdress
        ctx.fillStyle = '#5a4a28';
        ctx.beginPath(); ctx.ellipse(cx, headY + s(6), s(24), s(14), 0, Math.PI, Math.PI * 2); ctx.fill();
        // Ritual markings on face
        ctx.strokeStyle = '#cc4400';
        ctx.lineWidth = s(1.5);
        ctx.beginPath();
        ctx.moveTo(cx - s(16), headCY - s(4));
        ctx.lineTo(cx - s(10), headCY - s(8));
        ctx.lineTo(cx - s(6), headCY - s(4));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + s(6), headCY - s(4));
        ctx.lineTo(cx + s(10), headCY - s(8));
        ctx.lineTo(cx + s(16), headCY - s(4));
        ctx.stroke();

      } else if (typeId === 'warlock') {
        // --- WARLOCK portrait (dark orc spellcaster) ---
        // Dark robes
        ctx.fillStyle = '#1a1a28';
        ctx.beginPath();
        ctx.moveTo(cx - s(46), bodyY + s(8));
        ctx.quadraticCurveTo(cx - s(50), bodyY + s(40), cx - s(40), py + ph);
        ctx.lineTo(cx + s(40), py + ph);
        ctx.quadraticCurveTo(cx + s(50), bodyY + s(40), cx + s(46), bodyY + s(8));
        ctx.quadraticCurveTo(cx, bodyY - s(4), cx - s(46), bodyY + s(8));
        ctx.fill();
        // Arcane shoulder pads
        ctx.fillStyle = '#3a2a5a';
        for (let side = -1; side <= 1; side += 2) {
          ctx.beginPath(); ctx.ellipse(cx + side * s(38), bodyY + s(12), s(14), s(10), side * 0.3, 0, Math.PI * 2); ctx.fill();
          // Glowing rune on shoulder
          ctx.fillStyle = '#8844cc';
          ctx.globalAlpha = 0.6;
          ctx.beginPath(); ctx.arc(cx + side * s(38), bodyY + s(12), s(4), 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
        // Neck
        ctx.fillStyle = skin;
        ctx.fillRect(cx - s(10), bodyY - s(10), s(20), s(14));
        // Head
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.ellipse(cx, headCY, s(22), s(26), 0, 0, Math.PI * 2); ctx.fill();
        drawOrcEars();
        // Glowing purple eyes
        for (let side = -1; side <= 1; side += 2) {
          const wex = cx + side * eyeSpacing;
          ctx.fillStyle = '#3a1a5a';
          ctx.beginPath(); ctx.ellipse(wex, eyeY, s(6), s(3.5), 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#8844cc';
          ctx.beginPath(); ctx.arc(wex + side * s(1), eyeY, s(2.5), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#cc88ff';
          ctx.beginPath(); ctx.arc(wex + side * s(1), eyeY, s(1.2), 0, Math.PI * 2); ctx.fill();
        }
        drawBrows('#1a1a08');
        drawNose(3);
        // Tusks
        ctx.fillStyle = '#e8e0c8';
        for (let side = -1; side <= 1; side += 2) {
          ctx.beginPath();
          ctx.moveTo(cx + side * s(6), headCY + s(12));
          ctx.lineTo(cx + side * s(8), headCY + s(4));
          ctx.lineTo(cx + side * s(4), headCY + s(10));
          ctx.fill();
        }
        drawMouth();
        // Dark hood
        ctx.fillStyle = '#1a1028';
        ctx.beginPath(); ctx.ellipse(cx, headY + s(6), s(28), s(22), 0, Math.PI + 0.3, -0.3); ctx.fill();
        ctx.fillRect(cx - s(26), headCY - s(2), s(5), s(28));
        ctx.fillRect(cx + s(21), headCY - s(2), s(5), s(28));
        // Arcane tattoo
        ctx.strokeStyle = '#8844cc';
        ctx.lineWidth = s(1);
        ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.arc(cx, headCY + s(6), s(6), 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

    // =================================================================
    //  NORTHERN LORD faction portraits
    // =================================================================
    } else if (charId === 'northern_lord') {

      if (typeId === 'shieldwall') {
        // Heavy northern plate with fur collar
        drawHeavyArmor();
        // Fur collar
        ctx.fillStyle = '#8a7a60';
        ctx.beginPath();
        ctx.ellipse(cx, bodyY + s(6), s(34), s(10), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#a09080';
        for (let i = -6; i <= 6; i++) {
          ctx.fillRect(cx + i * s(4), bodyY, s(3), s(8 + Math.abs(i % 3)));
        }
        drawNeckAndHead();
        drawHumanEars();
        drawEyes();
        drawBrows();
        drawNose();
        drawMouth();
        drawBeard();
        drawScar();
        // Helm or hair
        if (rng() > 0.4) {
          drawHelm('#8899aa', primary, 0);
        } else {
          drawHair();
        }

      } else if (typeId === 'longbow') {
        drawLightArmor('#2a3f65', '#4a6fa5');
        // Fur trim on cloak
        ctx.fillStyle = '#8a7a60';
        ctx.fillRect(cx - s(48), bodyY + s(6), s(96), s(4));
        ctx.fillStyle = skin;
        ctx.fillRect(cx - s(8), bodyY - s(10), s(16), s(14));
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.ellipse(cx, headCY, s(20), s(24), 0, 0, Math.PI * 2); ctx.fill();
        drawHumanEars();
        drawEyes();
        drawBrows();
        drawNose();
        drawMouth();
        drawScar();
        drawHood('#2a3f65');

      } else if (typeId === 'warhorse') {
        drawHeavyArmor('#8899aa', '#aabbcc', '#556677');
        drawNeckAndHead();
        drawHumanEars();
        drawEyes();
        drawBrows();
        drawNose();
        drawMouth();
        drawBeard();
        // Great helm
        drawHelm('#8899aa', primary, 2);

      } else if (typeId === 'siege_tower') {
        // Engineer outfit
        ctx.fillStyle = primary;
        ctx.fillRect(cx - s(36), bodyY, s(72), s(60));
        ctx.fillStyle = '#5c4033';
        ctx.fillRect(cx - s(28), bodyY + s(4), s(56), s(50));
        ctx.fillStyle = '#888';
        ctx.fillRect(cx - s(30), bodyY + s(24), s(60), s(5));
        // Arms
        ctx.fillStyle = skin;
        ctx.fillRect(cx - s(42), bodyY + s(4), s(8), s(24));
        ctx.fillRect(cx + s(34), bodyY + s(4), s(8), s(24));
        ctx.fillStyle = '#5c4033';
        ctx.fillRect(cx - s(42), bodyY + s(22), s(8), s(8));
        ctx.fillRect(cx + s(34), bodyY + s(22), s(8), s(8));
        // Neck
        ctx.fillStyle = skin;
        ctx.fillRect(cx - s(8), bodyY - s(10), s(16), s(14));
        // Head
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.ellipse(cx, headCY, s(18), s(22), 0, 0, Math.PI * 2); ctx.fill();
        drawHumanEars();
        // Eyes
        for (let side = -1; side <= 1; side += 2) {
          const ex = cx + side * s(7);
          ctx.fillStyle = '#eee';
          ctx.beginPath(); ctx.ellipse(ex, eyeY, s(4.5), s(3), 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = eyeColor;
          ctx.beginPath(); ctx.arc(ex, eyeY, s(2), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#111';
          ctx.beginPath(); ctx.arc(ex, eyeY, s(1), 0, Math.PI * 2); ctx.fill();
        }
        drawBrows();
        drawNose();
        drawMouth();
        drawBeard();
        // Engineer cap
        ctx.fillStyle = '#5c4033';
        ctx.beginPath(); ctx.ellipse(cx, headY + s(6), s(20), s(14), 0, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillRect(cx - s(20), headY + s(4), s(40), s(4));
      }

    // =================================================================
    //  DRAGON EMPRESS faction portraits
    // =================================================================
    } else if (charId === 'dragon_empress') {

      if (typeId === 'unsullied') {
        // Eastern-style plate armor
        drawHeavyArmor('#8a2020', '#cc4444', '#4a0808');
        // Scaled collar
        ctx.fillStyle = '#aa3030';
        for (let i = -4; i <= 4; i++) {
          ctx.beginPath(); ctx.ellipse(cx + i * s(5), bodyY + s(4), s(4), s(3), 0, 0, Math.PI * 2); ctx.fill();
        }
        drawNeckAndHead();
        drawHumanEars();
        drawEyes();
        drawBrows();
        drawNose();
        drawMouth();
        drawScar();
        // Unsullied helm (rounded with spike)
        ctx.fillStyle = '#999';
        ctx.beginPath(); ctx.ellipse(cx, headY + s(10), s(24), s(18), 0, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#aaa';
        ctx.fillRect(cx - s(24), headY + s(8), s(48), s(3));
        // Spike
        ctx.fillStyle = '#ccc';
        ctx.beginPath();
        ctx.moveTo(cx - s(2), headY + s(2));
        ctx.lineTo(cx, headY - s(14));
        ctx.lineTo(cx + s(2), headY + s(2));
        ctx.fill();

      } else if (typeId === 'fire_mage') {
        drawLightArmor('#4a0808', '#c0392b');
        ctx.fillStyle = skin;
        ctx.fillRect(cx - s(8), bodyY - s(10), s(16), s(14));
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.ellipse(cx, headCY, s(20), s(24), 0, 0, Math.PI * 2); ctx.fill();
        drawHumanEars();
        // Fiery eyes
        drawEyes('#ff4400');
        drawBrows();
        drawNose();
        drawMouth();
        // Ornate headdress
        ctx.fillStyle = '#c0392b';
        ctx.beginPath(); ctx.ellipse(cx, headY + s(6), s(24), s(16), 0, Math.PI, Math.PI * 2); ctx.fill();
        // Jeweled band
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = s(2);
        ctx.beginPath(); ctx.ellipse(cx, headY + s(10), s(23), s(8), 0, Math.PI + 0.3, -0.3); ctx.stroke();
        ctx.fillStyle = '#ff4400';
        ctx.beginPath(); ctx.arc(cx, headY + s(6), s(3), 0, Math.PI * 2); ctx.fill();

      } else if (typeId === 'flame_rider') {
        drawHeavyArmor('#8a2020', '#cc3333', '#4a0808');
        drawNeckAndHead();
        drawHumanEars();
        drawEyes();
        drawBrows();
        drawNose();
        drawMouth();
        drawBeard();
        // Dragon-crested helm
        ctx.fillStyle = '#aa3333';
        ctx.beginPath(); ctx.ellipse(cx, headY + s(8), s(24), s(18), 0, Math.PI, Math.PI * 2); ctx.fill();
        // Dragon wing crests
        ctx.fillStyle = '#cc4444';
        for (let side = -1; side <= 1; side += 2) {
          ctx.beginPath();
          ctx.moveTo(cx + side * s(2), headY - s(4));
          ctx.quadraticCurveTo(cx + side * s(14), headY - s(18), cx + side * s(20), headY - s(6));
          ctx.lineTo(cx + side * s(16), headY + s(2));
          ctx.fill();
        }

      } else if (typeId === 'scorpion') {
        // Siege engineer - eastern style
        ctx.fillStyle = '#8a2020';
        ctx.fillRect(cx - s(36), bodyY, s(72), s(60));
        ctx.fillStyle = '#5c4033';
        ctx.fillRect(cx - s(28), bodyY + s(4), s(56), s(50));
        ctx.fillStyle = skin;
        ctx.fillRect(cx - s(8), bodyY - s(10), s(16), s(14));
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.ellipse(cx, headCY, s(18), s(22), 0, 0, Math.PI * 2); ctx.fill();
        drawHumanEars();
        drawEyes();
        drawBrows();
        drawNose();
        drawMouth();
        drawBeard();
        // Eastern headband
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(cx - s(20), headY + s(6), s(40), s(5));
        ctx.fillStyle = '#ffd700';
        ctx.beginPath(); ctx.arc(cx, headY + s(8), s(3), 0, Math.PI * 2); ctx.fill();
        drawHair();
      }

    // =================================================================
    //  IRON ADMIRAL faction portraits
    // =================================================================
    } else if (charId === 'iron_admiral') {

      if (typeId === 'reaver') {
        drawHeavyArmor('#1a6a5a', '#2a9a8a', '#0a4a3a');
        // Scale mail over chest
        ctx.fillStyle = '#2a8a7a';
        for (let row = 0; row < 3; row++) {
          for (let col = -3; col <= 3; col++) {
            const sx = cx + col * s(6) + (row % 2) * s(3);
            const sy = bodyY + s(14) + row * s(6);
            ctx.beginPath(); ctx.ellipse(sx, sy, s(3.5), s(2.5), 0, 0, Math.PI * 2); ctx.fill();
          }
        }
        drawNeckAndHead();
        drawHumanEars();
        drawEyes();
        drawBrows();
        drawNose();
        drawMouth();
        drawBeard();
        drawScar();
        if (rng() > 0.5) {
          drawHelm('#668888', accent, 1);
        } else {
          drawHair();
          // Bandana
          ctx.fillStyle = primary;
          ctx.fillRect(cx - s(22), headY + s(10), s(44), s(4));
        }

      } else if (typeId === 'crossbowman') {
        drawLightArmor('#0a4a3a', '#1a8a7a');
        // Leather bandolier
        ctx.strokeStyle = '#5c4033';
        ctx.lineWidth = s(3);
        ctx.beginPath(); ctx.moveTo(cx - s(18), bodyY); ctx.lineTo(cx + s(14), bodyY + s(36)); ctx.stroke();
        ctx.fillStyle = skin;
        ctx.fillRect(cx - s(8), bodyY - s(10), s(16), s(14));
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.ellipse(cx, headCY, s(20), s(24), 0, 0, Math.PI * 2); ctx.fill();
        drawHumanEars();
        drawEyes();
        drawBrows();
        drawNose();
        drawMouth();
        drawScar();
        drawHood('#0a4a3a');

      } else if (typeId === 'war_chariot') {
        drawHeavyArmor('#1a6a5a', '#2a9a8a', '#0a4a3a');
        drawNeckAndHead();
        drawHumanEars();
        drawEyes();
        drawBrows();
        drawNose();
        drawMouth();
        drawBeard();
        // Naval officer helm
        ctx.fillStyle = '#2a6a5a';
        ctx.beginPath(); ctx.ellipse(cx, headY + s(8), s(24), s(16), 0, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a8a7a';
        ctx.fillRect(cx - s(26), headY + s(6), s(52), s(4));
        // Plume
        ctx.fillStyle = accent;
        ctx.fillRect(cx + s(14), headY - s(8), s(4), s(14));

      } else if (typeId === 'battering_ram') {
        ctx.fillStyle = primary;
        ctx.fillRect(cx - s(36), bodyY, s(72), s(60));
        ctx.fillStyle = '#5c4033';
        ctx.fillRect(cx - s(28), bodyY + s(4), s(56), s(50));
        ctx.fillStyle = skin;
        ctx.fillRect(cx - s(8), bodyY - s(10), s(16), s(14));
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.ellipse(cx, headCY, s(18), s(22), 0, 0, Math.PI * 2); ctx.fill();
        drawHumanEars();
        drawEyes();
        drawBrows();
        drawNose();
        drawMouth();
        drawBeard();
        // Sea dog bandana
        ctx.fillStyle = '#1a8a7a';
        ctx.beginPath(); ctx.ellipse(cx, headY + s(8), s(20), s(12), 0, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillRect(cx - s(20), headY + s(6), s(40), s(3));
        // Knot
        ctx.fillStyle = primary;
        ctx.fillRect(cx + s(16), headY + s(4), s(6), s(6));
      }

    // =================================================================
    //  GOLDEN LORD faction portraits
    // =================================================================
    } else if (charId === 'golden_lord') {

      if (typeId === 'sellsword') {
        drawHeavyArmor('#b89020', '#d4a017', '#8a6a10');
        // Gold trim chest plate
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(cx - s(6), bodyY + s(4), s(12), s(24));
        ctx.fillStyle = '#d4a017';
        ctx.fillRect(cx - s(1), bodyY + s(2), s(2), s(28));
        drawNeckAndHead();
        drawHumanEars();
        drawEyes();
        drawBrows();
        drawNose();
        drawMouth();
        drawBeard();
        drawScar();
        if (rng() > 0.4) {
          // Golden helm
          ctx.fillStyle = '#d4a017';
          ctx.beginPath(); ctx.ellipse(cx, headY + s(8), s(24), s(18), 0, Math.PI + 0.3, -0.3); ctx.fill();
          ctx.fillStyle = '#ffd700';
          ctx.fillRect(cx - s(2), headY + s(4), s(4), s(16));
        } else {
          drawHair();
        }

      } else if (typeId === 'arbalist') {
        drawLightArmor('#8a6a10', '#d4a017');
        ctx.fillStyle = skin;
        ctx.fillRect(cx - s(8), bodyY - s(10), s(16), s(14));
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.ellipse(cx, headCY, s(20), s(24), 0, 0, Math.PI * 2); ctx.fill();
        drawHumanEars();
        drawEyes();
        drawBrows();
        drawNose();
        drawMouth();
        drawScar();
        drawHood('#8a6a10');

      } else if (typeId === 'mounted_champion') {
        drawHeavyArmor('#c8a020', '#ffd700', '#8a6a10');
        // Ornate gold pauldrons
        ctx.fillStyle = '#ffd700';
        ctx.beginPath(); ctx.arc(cx - s(44), bodyY + s(12), s(5), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + s(44), bodyY + s(12), s(5), 0, Math.PI * 2); ctx.fill();
        drawNeckAndHead();
        drawHumanEars();
        drawEyes();
        drawBrows();
        drawNose();
        drawMouth();
        drawBeard();
        // Champion crown-helm
        ctx.fillStyle = '#d4a017';
        ctx.beginPath(); ctx.ellipse(cx, headY + s(8), s(24), s(18), 0, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(cx - s(24), headY + s(4), s(48), s(5));
        // Crown points
        for (let i = -2; i <= 2; i++) {
          ctx.fillRect(cx + i * s(8) - s(2), headY - s(4 + Math.abs(i) * 2), s(4), s(8 + Math.abs(i) * 2));
        }
        // Gem
        ctx.fillStyle = '#cc2222';
        ctx.beginPath(); ctx.arc(cx, headY + s(1), s(2.5), 0, Math.PI * 2); ctx.fill();

      } else if (typeId === 'golden_trebuchet') {
        ctx.fillStyle = '#d4a017';
        ctx.fillRect(cx - s(36), bodyY, s(72), s(60));
        ctx.fillStyle = '#5c4033';
        ctx.fillRect(cx - s(28), bodyY + s(4), s(56), s(50));
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(cx - s(30), bodyY + s(24), s(60), s(5));
        ctx.fillStyle = skin;
        ctx.fillRect(cx - s(8), bodyY - s(10), s(16), s(14));
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.ellipse(cx, headCY, s(18), s(22), 0, 0, Math.PI * 2); ctx.fill();
        drawHumanEars();
        drawEyes();
        drawBrows();
        drawNose();
        drawMouth();
        drawBeard();
        // Fine hat
        ctx.fillStyle = '#d4a017';
        ctx.beginPath(); ctx.ellipse(cx, headY + s(8), s(22), s(12), 0, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillRect(cx - s(22), headY + s(6), s(44), s(4));
        ctx.fillStyle = '#ffd700';
        ctx.beginPath(); ctx.arc(cx - s(12), headY + s(8), s(3), 0, Math.PI * 2); ctx.fill();
      }

    // =================================================================
    //  FALLBACK (generic portrait for any unmatched unit)
    // =================================================================
    } else {
      drawHeavyArmor();
      drawNeckAndHead();
      drawHumanEars();
      drawEyes();
      drawBrows();
      drawNose();
      drawMouth();
      drawBeard();
      drawScar();
      drawHair();
    }

    // === Ambient particle effects ===
    ctx.fillStyle = 'rgba(201, 168, 76, 0.1)';
    const particleRng = seededRng((unit.id || 1) + 999);
    for (let i = 0; i < 8; i++) {
      const ppx = px + particleRng() * pw;
      const ppy = py + ph * 0.7 + particleRng() * ph * 0.3;
      const ppr = 1 + particleRng() * 3;
      ctx.beginPath(); ctx.arc(ppx, ppy, ppr, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }
  function drawBuildingIcon(ctx, building, px, py, pw, ph) {
    const charData = CHARACTERS[building.characterId];
    const primary = charData ? charData.color : '#666';
    const accent = charData ? charData.accentColor : '#888';
    const dark = charData ? charData.darkColor : '#444';
    const cx = px + pw / 2;
    const scale = pw / 120;
    function s(v) { return v * scale; }

    if (building.typeId === 'gold_mine') {
      // Gold Mine icon
      const baseY = py + ph - s(20);
      // Rocky hill
      ctx.fillStyle = '#5a5045';
      ctx.beginPath();
      ctx.moveTo(cx - s(44), baseY + s(2));
      ctx.lineTo(cx - s(36), baseY - s(30));
      ctx.lineTo(cx - s(14), baseY - s(56));
      ctx.lineTo(cx + s(14), baseY - s(60));
      ctx.lineTo(cx + s(36), baseY - s(36));
      ctx.lineTo(cx + s(44), baseY + s(2));
      ctx.fill();
      // Rock texture
      ctx.fillStyle = '#4a4035';
      ctx.beginPath(); ctx.ellipse(cx - s(16), baseY - s(36), s(10), s(7), -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#554a3e';
      ctx.beginPath(); ctx.ellipse(cx + s(18), baseY - s(30), s(8), s(6), 0.2, 0, Math.PI * 2); ctx.fill();
      // Mine entrance
      ctx.fillStyle = '#0a0806';
      ctx.beginPath();
      ctx.moveTo(cx - s(16), baseY + s(2));
      ctx.lineTo(cx - s(14), baseY - s(16));
      ctx.arc(cx, baseY - s(16), s(14), Math.PI, 0);
      ctx.lineTo(cx + s(16), baseY + s(2));
      ctx.fill();
      // Wooden support beams
      ctx.fillStyle = '#6B4226';
      ctx.fillRect(cx - s(16), baseY - s(16), s(4), s(18));
      ctx.fillRect(cx + s(12), baseY - s(16), s(4), s(18));
      ctx.fillRect(cx - s(16), baseY - s(20), s(32), s(5));
      // Gold nuggets
      ctx.fillStyle = '#ffd700';
      ctx.beginPath(); ctx.arc(cx - s(26), baseY - s(8), s(4), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e6c200';
      ctx.beginPath(); ctx.arc(cx - s(22), baseY + s(0), s(3), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd700';
      ctx.beginPath(); ctx.arc(cx + s(26), baseY - s(4), s(3.5), 0, Math.PI * 2); ctx.fill();
      // Pickaxe
      ctx.strokeStyle = '#8B7355';
      ctx.lineWidth = s(2);
      ctx.beginPath(); ctx.moveTo(cx + s(30), baseY - s(48)); ctx.lineTo(cx + s(36), baseY - s(18)); ctx.stroke();
      ctx.fillStyle = '#888';
      ctx.beginPath(); ctx.moveTo(cx + s(27), baseY - s(52)); ctx.lineTo(cx + s(33), baseY - s(46)); ctx.lineTo(cx + s(30), baseY - s(42)); ctx.fill();
      return;
    } else if (building.isTower) {
      // Faction-themed detailed tower
      const baseY = py + ph - s(20);
      const charId = building.characterId;
      // Faction-specific stone and glow colors
      const stoneColor = charId === 'shadow_priest' ? '#3a3040' : charId === 'forest_warden' ? '#4a5a40' :
        charId === 'orc_warchief' ? '#4a4030' : charId === 'iron_admiral' ? '#4a5a58' : '#5a5550';
      const stoneDark = charId === 'shadow_priest' ? '#2a2030' : charId === 'forest_warden' ? '#3a4a30' :
        charId === 'orc_warchief' ? '#3a3020' : charId === 'iron_admiral' ? '#3a4a48' : '#3a3530';
      const glowColor = charId === 'shadow_priest' ? '#8e44ad' : charId === 'forest_warden' ? '#27ae60' :
        charId === 'dragon_empress' ? '#ff4400' : charId === 'orc_warchief' ? '#88aa44' : '#d4a017';
      // Foundation
      ctx.fillStyle = stoneDark;
      ctx.fillRect(cx - s(36), baseY, s(72), s(20));
      // Tower body
      ctx.fillStyle = stoneColor;
      ctx.fillRect(cx - s(24), baseY - s(70), s(48), s(72));
      // Stone texture
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = s(1);
      for (let row = 0; row < 8; row++) {
        const ry = baseY - s(70) + row * s(9);
        ctx.beginPath(); ctx.moveTo(cx - s(24), ry); ctx.lineTo(cx + s(24), ry); ctx.stroke();
        const off = row % 2 === 0 ? 0 : s(10);
        for (let col = 0; col < 3; col++) {
          const rx = cx - s(24) + off + col * s(20);
          ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, ry + s(9)); ctx.stroke();
        }
      }
      // Upper battlements
      ctx.fillStyle = primary;
      ctx.fillRect(cx - s(28), baseY - s(78), s(56), s(10));
      // Crenellations
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(cx + i * s(10) - s(4), baseY - s(86), s(8), s(10));
      }
      // Faction-specific tower decoration
      if (charId === 'orc_warchief') {
        // Spikes on battlements
        ctx.fillStyle = '#5a4a28';
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i * s(10), baseY - s(94));
          ctx.lineTo(cx + i * s(10) - s(2), baseY - s(86));
          ctx.lineTo(cx + i * s(10) + s(2), baseY - s(86));
          ctx.fill();
        }
      } else if (charId === 'forest_warden') {
        // Vines growing up the tower
        ctx.strokeStyle = '#27ae60';
        ctx.lineWidth = s(2);
        ctx.beginPath();
        ctx.moveTo(cx - s(24), baseY);
        ctx.quadraticCurveTo(cx - s(28), baseY - s(40), cx - s(22), baseY - s(70));
        ctx.stroke();
        ctx.fillStyle = '#27ae60';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath(); ctx.ellipse(cx - s(24), baseY - s(15 + i * 16), s(4), s(2.5), -0.3, 0, Math.PI * 2); ctx.fill();
        }
      } else if (charId === 'shadow_priest') {
        // Skulls on battlements
        ctx.fillStyle = '#c8c0a8';
        for (let i = -1; i <= 1; i += 2) {
          ctx.beginPath(); ctx.arc(cx + i * s(12), baseY - s(82), s(4), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#1a0a2a';
          ctx.beginPath(); ctx.arc(cx + i * s(12) - s(1.5), baseY - s(83), s(1), 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(cx + i * s(12) + s(1.5), baseY - s(83), s(1), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#c8c0a8';
        }
      }
      // Arrow slits
      ctx.fillStyle = '#111';
      ctx.fillRect(cx - s(2), baseY - s(55), s(4), s(12));
      ctx.fillRect(cx - s(2), baseY - s(35), s(4), s(12));
      // Window glow (faction colored)
      ctx.fillStyle = glowColor;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(cx - s(1), baseY - s(54), s(2), s(10));
      ctx.fillRect(cx - s(1), baseY - s(34), s(2), s(10));
      ctx.globalAlpha = 1;
      // Flag
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(cx, baseY - s(100), s(2), s(20));
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.moveTo(cx + s(2), baseY - s(100));
      ctx.lineTo(cx + s(18), baseY - s(94));
      ctx.lineTo(cx + s(2), baseY - s(86));
      ctx.fill();
      // Faction emblem on flag
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(cx + s(8), baseY - s(93), s(3), 0, Math.PI * 2); ctx.fill();
    } else {
      // Faction-themed detailed barracks
      const baseY = py + ph - s(20);
      const charId = building.characterId;
      const wallColor = charId === 'shadow_priest' ? '#3a3040' : charId === 'forest_warden' ? '#4a5a40' :
        charId === 'orc_warchief' ? '#4a3a20' : charId === 'iron_admiral' ? '#4a5a58' : '#5a5045';
      const glowColor = charId === 'shadow_priest' ? '#8e44ad' : charId === 'forest_warden' ? '#27ae60' :
        charId === 'dragon_empress' ? '#ff4400' : charId === 'orc_warchief' ? '#88aa44' : '#d4a017';
      // Foundation
      ctx.fillStyle = '#3a3530';
      ctx.fillRect(cx - s(44), baseY, s(88), s(20));
      // Walls
      ctx.fillStyle = wallColor;
      ctx.fillRect(cx - s(40), baseY - s(50), s(80), s(52));
      // Roof
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(cx - s(46), baseY - s(50));
      ctx.lineTo(cx, baseY - s(78));
      ctx.lineTo(cx + s(46), baseY - s(50));
      ctx.fill();
      // Roof ridge
      ctx.fillStyle = accent;
      ctx.fillRect(cx - s(2), baseY - s(76), s(4), s(28));
      // Wooden beams
      ctx.fillStyle = charId === 'orc_warchief' ? '#3a2a10' : '#4a3520';
      ctx.fillRect(cx - s(38), baseY - s(26), s(76), s(3));
      ctx.fillRect(cx - s(38), baseY - s(48), s(76), s(3));
      // Door
      ctx.fillStyle = charId === 'orc_warchief' ? '#1a1508' : '#2a1f14';
      ctx.fillRect(cx - s(8), baseY - s(22), s(16), s(24));
      ctx.fillStyle = glowColor;
      ctx.fillRect(cx + s(4), baseY - s(12), s(3), s(3));
      // Windows
      ctx.fillStyle = '#111';
      ctx.fillRect(cx - s(28), baseY - s(42), s(10), s(10));
      ctx.fillRect(cx + s(18), baseY - s(42), s(10), s(10));
      ctx.fillStyle = glowColor;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(cx - s(27), baseY - s(41), s(8), s(8));
      ctx.fillRect(cx + s(19), baseY - s(41), s(8), s(8));
      ctx.globalAlpha = 1;
      // Faction-specific barracks decoration
      if (charId === 'orc_warchief') {
        // Skull over door
        ctx.fillStyle = '#c8c0a8';
        ctx.beginPath(); ctx.arc(cx, baseY - s(28), s(5), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a1008';
        ctx.beginPath(); ctx.arc(cx - s(2), baseY - s(29), s(1.5), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + s(2), baseY - s(29), s(1.5), 0, Math.PI * 2); ctx.fill();
        // Spikes on roof
        ctx.fillStyle = '#5a4a28';
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i * s(12), baseY - s(58));
          ctx.lineTo(cx + i * s(12) - s(2), baseY - s(50));
          ctx.lineTo(cx + i * s(12) + s(2), baseY - s(50));
          ctx.fill();
        }
      } else if (charId === 'forest_warden') {
        // Vines and leaves
        ctx.strokeStyle = '#27ae60';
        ctx.lineWidth = s(1.5);
        ctx.beginPath();
        ctx.moveTo(cx - s(40), baseY - s(20));
        ctx.quadraticCurveTo(cx - s(44), baseY - s(40), cx - s(38), baseY - s(48));
        ctx.stroke();
        ctx.fillStyle = '#27ae60';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.ellipse(cx - s(40), baseY - s(25 + i * 10), s(3), s(2), -0.4, 0, Math.PI * 2); ctx.fill();
        }
        // Living roof
        ctx.fillStyle = 'rgba(39,174,96,0.3)';
        ctx.beginPath();
        ctx.moveTo(cx - s(40), baseY - s(50));
        ctx.lineTo(cx, baseY - s(72));
        ctx.lineTo(cx + s(40), baseY - s(50));
        ctx.fill();
      } else if (charId === 'shadow_priest') {
        // Eerie glow from within
        ctx.fillStyle = '#8e44ad';
        ctx.globalAlpha = 0.15;
        ctx.fillRect(cx - s(38), baseY - s(48), s(76), s(48));
        ctx.globalAlpha = 1;
        // Candle in window
        ctx.fillStyle = '#8e44ad';
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(cx - s(23), baseY - s(37), s(3), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + s(23), baseY - s(37), s(3), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // Banner
      ctx.fillStyle = primary;
      ctx.fillRect(cx - s(50), baseY - s(40), s(8), s(20));
      ctx.fillStyle = accent;
      ctx.fillRect(cx - s(49), baseY - s(38), s(6), s(4));
      // Smoke from chimney
      ctx.fillStyle = charId === 'shadow_priest' ? '#3a2a4a' : '#5a5045';
      ctx.fillRect(cx + s(20), baseY - s(70), s(8), s(20));
      ctx.fillStyle = charId === 'shadow_priest' ? 'rgba(100,50,150,0.3)' : 'rgba(150,150,150,0.3)';
      ctx.beginPath(); ctx.arc(cx + s(24), baseY - s(76), s(5), 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s(22), baseY - s(84), s(4), 0, Math.PI * 2); ctx.fill();
    }
  }

  function updateSelectedUnit() {
    if (!gameState) return;

    if (selectedUnitId) {
      const units = gameState.units || [];
      let unit = units.find(u => u.id === selectedUnitId);
      // Also check heroes
      if (!unit) {
        if (gameState.hero1 && gameState.hero1.id === selectedUnitId) unit = gameState.hero1;
        if (gameState.hero2 && gameState.hero2.id === selectedUnitId) unit = gameState.hero2;
      }
      // Generals — DISABLED
      // if (!unit) {
      //   if (gameState.general1 && gameState.general1.id === selectedUnitId) unit = gameState.general1;
      //   if (gameState.general2 && gameState.general2.id === selectedUnitId) unit = gameState.general2;
      // }
      if (!unit || unit.hp <= 0) { deselectAll(); return; }
      const selType = unit.isHero ? 'hero' : 'unit';
      renderBanner(unit, selType);
    } else if (selectedBuildingId && gameState.buildings) {
      const building = gameState.buildings.find(b => b.id === selectedBuildingId);
      if (!building) { deselectAll(); return; }
      renderBanner(building, 'building');
    }
  }

  // ─── Game Loop ────────────────────────────────────────────────
  function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    const dt = Math.min(0.05, (timestamp - lastFrameTime) / 1000);
    lastFrameTime = timestamp;

    if (!gameActive || !gameState) return;

    updateCamera(dt);

    // Update mouse world coords
    const world = Renderer.screenToWorld(mouse.x, mouse.y);
    mouse.worldX = world.x;
    mouse.worldY = world.y;

    // Build character ID map for renderer
    const charIds = {
      left: mySide === 'left' ? myCharacterId : opponentCharacterId,
      right: mySide === 'right' ? myCharacterId : opponentCharacterId
    };

    // Render
    Renderer.render(
      gameState,
      camera,
      dt,
      isPlacing,
      { x: mouse.worldX, y: mouse.worldY },
      selectedBuildingType,
      charIds
    );

    // Minimap
    Renderer.drawMinimap(minimapCanvas, gameState);
  }

  // ─── Title Screen Ambient Particles ────────────────────────────
  function animateTitleParticles() {
    const container = document.getElementById('titleParticles');
    if (!container || titleScreen.classList.contains('hidden')) {
      requestAnimationFrame(animateTitleParticles);
      return;
    }

    // Create floating embers
    if (Math.random() < 0.05) {
      const ember = document.createElement('div');
      ember.style.cssText = `
        position: absolute;
        width: ${2 + Math.random() * 3}px;
        height: ${2 + Math.random() * 3}px;
        background: rgba(201, 168, 76, ${0.2 + Math.random() * 0.3});
        border-radius: 50%;
        left: ${Math.random() * 100}%;
        bottom: -10px;
        pointer-events: none;
        animation: emberFloat ${5 + Math.random() * 5}s linear forwards;
      `;
      container.appendChild(ember);
      setTimeout(() => ember.remove(), 10000);
    }

    requestAnimationFrame(animateTitleParticles);
  }

  // Add ember animation CSS
  const emberStyle = document.createElement('style');
  emberStyle.textContent = `
    @keyframes emberFloat {
      0% { transform: translateY(0) translateX(0); opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 0.5; }
      100% { transform: translateY(-100vh) translateX(${Math.random() * 100 - 50}px); opacity: 0; }
    }
  `;
  document.head.appendChild(emberStyle);

  // ─── Start ────────────────────────────────────────────────────
  init();
  animateTitleParticles();

})();
