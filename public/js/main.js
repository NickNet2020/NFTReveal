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
    forest_warden: '&#x1F333;'   // tree
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
      camera.zoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom + zoomDelta));
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
          // Ranged/tower shots vs melee
          const p = data.projectiles[i];
          if (p && p.isTower) AudioManager.playTowerShot();
          else AudioManager.playArrowFire();
        }, i * 40);
      }
    }
    prevProjectileCount = projs;

    // Melee clash: fire when damage numbers appear (non-projectile combat)
    const dmgNums = data.damageNumbers || [];
    if (dmgNums.length > 0) {
      // Sample a few recent damage numbers to play sword sounds
      const recent = dmgNums.filter(d => Date.now() - d.time < 100);
      if (recent.length > 0) {
        AudioManager.playSwordClash();
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

    // Seeded random for per-unit variation
    const rng = seededRng(unit.id || 1);

    // Random traits
    const skinTones = ['#e8c4a0', '#d4a574', '#c49464', '#a0724e', '#7a5535'];
    const skinIdx = Math.floor(rng() * skinTones.length);
    const skin = skinTones[skinIdx];
    const skinShadow = ['#d4a880', '#c09060', '#a87850', '#886040', '#5c3a20'][skinIdx];
    const skinHighlight = ['#f0d4b8', '#e0b888', '#d4a474', '#b08058', '#8a6540'][skinIdx];

    const hairColors = ['#2a1a0a', '#4a3018', '#6b4a2a', '#8b6a3a', '#aa8844', '#c0c0c0', '#881818'];
    const hair = hairColors[Math.floor(rng() * hairColors.length)];
    const hairStyle = Math.floor(rng() * 5); // 0=bald, 1=short, 2=medium, 3=long, 4=mohawk
    const hasBeard = rng() > 0.5;
    const beardStyle = Math.floor(rng() * 3); // 0=stubble, 1=short, 2=full
    const hasScar = rng() > 0.65;
    const scarSide = rng() > 0.5 ? 1 : -1;
    const eyeColors = ['#3a2510', '#2244aa', '#228833', '#666666', '#884400'];
    const eyeColor = eyeColors[Math.floor(rng() * eyeColors.length)];
    const noseWidth = 2 + Math.floor(rng() * 3);
    const earSize = 3 + Math.floor(rng() * 3);
    const browThickness = 1 + Math.floor(rng() * 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();

    // Background atmosphere - subtle color tint based on faction
    const atmGrad = ctx.createLinearGradient(px, py, px, py + ph);
    atmGrad.addColorStop(0, 'rgba(0,0,0,0)');
    atmGrad.addColorStop(0.6, 'rgba(0,0,0,0)');
    atmGrad.addColorStop(1, primary.replace('#', 'rgba(') ? `rgba(${parseInt(primary.slice(1,3),16)},${parseInt(primary.slice(3,5),16)},${parseInt(primary.slice(5,7),16)},0.15)` : 'rgba(0,0,0,0)');
    ctx.fillStyle = atmGrad;
    ctx.fillRect(px, py, pw, ph);

    const cx = px + pw / 2;  // center x
    const scale = pw / 120;  // scale based on portrait width

    // Helper to scale values
    function s(v) { return v * scale; }

    if (type === 'infantry' || type === 'general') {
      // --- INFANTRY / GENERAL: Armored warrior bust portrait ---
      const headY = py + s(28);
      const bodyY = headY + s(52);

      // Shoulders & armor (lower part)
      const shoulderW = s(52);
      const armorGrad = ctx.createLinearGradient(cx - shoulderW, bodyY, cx + shoulderW, bodyY + s(80));
      armorGrad.addColorStop(0, primary);
      armorGrad.addColorStop(0.5, dark);
      armorGrad.addColorStop(1, '#111');
      ctx.fillStyle = armorGrad;
      ctx.beginPath();
      ctx.moveTo(cx - shoulderW, bodyY + s(10));
      ctx.quadraticCurveTo(cx - shoulderW - s(6), bodyY + s(40), cx - shoulderW + s(4), py + ph);
      ctx.lineTo(cx + shoulderW - s(4), py + ph);
      ctx.quadraticCurveTo(cx + shoulderW + s(6), bodyY + s(40), cx + shoulderW, bodyY + s(10));
      ctx.quadraticCurveTo(cx, bodyY - s(4), cx - shoulderW, bodyY + s(10));
      ctx.fill();

      // Pauldrons (shoulder armor)
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(cx - shoulderW + s(8), bodyY + s(12), s(14), s(10), -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + shoulderW - s(8), bodyY + s(12), s(14), s(10), 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Pauldron rivets
      ctx.fillStyle = '#d4a017';
      for (let side = -1; side <= 1; side += 2) {
        const psx = cx + side * (shoulderW - s(8));
        ctx.beginPath(); ctx.arc(psx, bodyY + s(8), s(2), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(psx, bodyY + s(16), s(2), 0, Math.PI * 2); ctx.fill();
      }

      // Chest plate detail
      ctx.fillStyle = accent;
      ctx.fillRect(cx - s(6), bodyY + s(4), s(12), s(20));
      // Center line on chest
      ctx.fillStyle = dark;
      ctx.fillRect(cx - s(1), bodyY + s(2), s(2), s(26));
      // Belt
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(cx - shoulderW + s(10), bodyY + s(28), shoulderW * 2 - s(20), s(6));
      ctx.fillStyle = '#d4a017';
      ctx.fillRect(cx - s(4), bodyY + s(27), s(8), s(8)); // buckle

      // Gorget (neck armor)
      ctx.fillStyle = '#777';
      ctx.beginPath();
      ctx.ellipse(cx, bodyY + s(2), s(18), s(8), 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#999';
      ctx.fillRect(cx - s(16), bodyY - s(2), s(32), s(4));

      // Neck
      ctx.fillStyle = skin;
      ctx.fillRect(cx - s(10), bodyY - s(10), s(20), s(14));
      ctx.fillStyle = skinShadow;
      ctx.fillRect(cx - s(10), bodyY - s(2), s(20), s(4));

      // Head - oval shape
      const headCY = headY + s(22);
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.ellipse(cx, headCY, s(22), s(26), 0, 0, Math.PI * 2);
      ctx.fill();

      // Ears
      ctx.fillStyle = skinShadow;
      ctx.beginPath(); ctx.ellipse(cx - s(22), headCY + s(2), s(earSize), s(earSize + 2), 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + s(22), headCY + s(2), s(earSize), s(earSize + 2), 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.ellipse(cx - s(21), headCY + s(2), s(earSize - 1), s(earSize + 1), 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + s(21), headCY + s(2), s(earSize - 1), s(earSize + 1), 0, 0, Math.PI * 2); ctx.fill();

      // Eyes
      const eyeY = headCY - s(2);
      const eyeSpacing = s(9);
      for (let side = -1; side <= 1; side += 2) {
        const ex = cx + side * eyeSpacing;
        // Eye white
        ctx.fillStyle = '#eee';
        ctx.beginPath(); ctx.ellipse(ex, eyeY, s(6), s(3.5), 0, 0, Math.PI * 2); ctx.fill();
        // Iris
        ctx.fillStyle = eyeColor;
        ctx.beginPath(); ctx.arc(ex + side * s(1), eyeY, s(2.5), 0, Math.PI * 2); ctx.fill();
        // Pupil
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(ex + side * s(1), eyeY, s(1.2), 0, Math.PI * 2); ctx.fill();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.arc(ex + side * s(1) + s(0.8), eyeY - s(0.8), s(0.7), 0, Math.PI * 2); ctx.fill();
        // Upper eyelid / brow
        ctx.fillStyle = skinShadow;
        ctx.fillRect(ex - s(6), eyeY - s(4), s(12), s(browThickness + 1));
      }

      // Eyebrows
      ctx.fillStyle = hair;
      for (let side = -1; side <= 1; side += 2) {
        const bx = cx + side * eyeSpacing;
        ctx.fillRect(bx - s(6), eyeY - s(7), s(12), s(browThickness + 1));
      }

      // Nose
      ctx.fillStyle = skinShadow;
      ctx.beginPath();
      ctx.moveTo(cx - s(1), headCY - s(4));
      ctx.lineTo(cx - s(noseWidth), headCY + s(8));
      ctx.lineTo(cx + s(noseWidth), headCY + s(8));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = skinHighlight;
      ctx.fillRect(cx - s(0.5), headCY - s(3), s(1), s(8));

      // Mouth
      ctx.fillStyle = '#7a3030';
      ctx.fillRect(cx - s(5), headCY + s(12), s(10), s(2));
      ctx.fillStyle = skinShadow;
      ctx.fillRect(cx - s(4), headCY + s(14), s(8), s(1));

      // Beard (if applicable)
      if (hasBeard) {
        ctx.fillStyle = hair;
        if (beardStyle === 0) {
          // Stubble dots
          ctx.globalAlpha = 0.3;
          for (let bx = -8; bx <= 8; bx += 2) {
            for (let by = 10; by <= 18; by += 2) {
              if (rng() > 0.4) {
                ctx.fillRect(cx + s(bx), headCY + s(by), s(1), s(1));
              }
            }
          }
          ctx.globalAlpha = 1;
        } else if (beardStyle === 1) {
          // Short beard
          ctx.beginPath();
          ctx.moveTo(cx - s(14), headCY + s(10));
          ctx.quadraticCurveTo(cx, headCY + s(24), cx + s(14), headCY + s(10));
          ctx.fill();
        } else {
          // Full beard
          ctx.beginPath();
          ctx.moveTo(cx - s(16), headCY + s(6));
          ctx.quadraticCurveTo(cx - s(18), headCY + s(20), cx, headCY + s(30));
          ctx.quadraticCurveTo(cx + s(18), headCY + s(20), cx + s(16), headCY + s(6));
          ctx.fill();
        }
      }

      // Scar
      if (hasScar) {
        ctx.strokeStyle = 'rgba(180,60,60,0.5)';
        ctx.lineWidth = s(1.5);
        ctx.beginPath();
        ctx.moveTo(cx + scarSide * s(4), headCY - s(10));
        ctx.lineTo(cx + scarSide * s(8), headCY + s(6));
        ctx.stroke();
      }

      // Hair / Helmet
      if (type === 'general') {
        // General gets a crown/ornate helm
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.ellipse(cx, headY + s(10), s(24), s(18), 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#999';
        ctx.beginPath();
        ctx.ellipse(cx, headY + s(12), s(26), s(10), 0, Math.PI, Math.PI * 2);
        ctx.fill();
        // Crown
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(cx - s(20), headY - s(2), s(40), s(8));
        // Crown points
        for (let i = -2; i <= 2; i++) {
          ctx.fillRect(cx + i * s(8) - s(3), headY - s(10 + Math.abs(i) * 2), s(6), s(10 + Math.abs(i) * 2));
        }
        // Gems
        ctx.fillStyle = '#cc2222';
        ctx.beginPath(); ctx.arc(cx, headY, s(3), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2244cc';
        ctx.beginPath(); ctx.arc(cx - s(8), headY + s(1), s(2), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + s(8), headY + s(1), s(2), 0, Math.PI * 2); ctx.fill();
        // Cape/cloak behind
        ctx.fillStyle = primary;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(cx - shoulderW - s(4), bodyY + s(14), s(12), py + ph - bodyY - s(14));
        ctx.fillRect(cx + shoulderW - s(8), bodyY + s(14), s(12), py + ph - bodyY - s(14));
        ctx.globalAlpha = 1;
      } else {
        // Infantry - helmet or hair
        const helmType = Math.floor(rng() * 3);
        if (helmType === 0) {
          // Open-face helm
          ctx.fillStyle = '#888';
          ctx.beginPath();
          ctx.ellipse(cx, headY + s(8), s(24), s(20), 0, Math.PI + 0.3, -0.3);
          ctx.fill();
          // Nose guard
          ctx.fillStyle = '#777';
          ctx.fillRect(cx - s(2), headY + s(4), s(4), s(20));
          // Helm crest
          ctx.fillStyle = primary;
          ctx.fillRect(cx - s(2), headY - s(6), s(4), s(16));
        } else if (helmType === 1) {
          // Kettle helm
          ctx.fillStyle = '#888';
          ctx.beginPath();
          ctx.ellipse(cx, headY + s(10), s(26), s(14), 0, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#999';
          ctx.fillRect(cx - s(28), headY + s(8), s(56), s(4));
          // Hair showing below
          if (hairStyle > 0) {
            ctx.fillStyle = hair;
            ctx.fillRect(cx - s(20), headCY - s(6), s(40), s(4));
          }
        } else {
          // Hair only (no helm)
          ctx.fillStyle = hair;
          if (hairStyle === 0) {
            // Bald - just a subtle shadow
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            ctx.ellipse(cx, headY + s(8), s(22), s(16), 0, Math.PI, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          } else if (hairStyle === 1) {
            // Short crop
            ctx.beginPath();
            ctx.ellipse(cx, headY + s(6), s(23), s(18), 0, Math.PI + 0.5, -0.5);
            ctx.fill();
          } else if (hairStyle === 2) {
            // Medium
            ctx.beginPath();
            ctx.ellipse(cx, headY + s(6), s(24), s(20), 0, Math.PI + 0.3, -0.3);
            ctx.fill();
            ctx.fillRect(cx - s(24), headCY - s(4), s(4), s(16));
            ctx.fillRect(cx + s(20), headCY - s(4), s(4), s(16));
          } else if (hairStyle === 3) {
            // Long flowing
            ctx.beginPath();
            ctx.ellipse(cx, headY + s(6), s(24), s(20), 0, Math.PI + 0.2, -0.2);
            ctx.fill();
            ctx.fillRect(cx - s(24), headCY - s(8), s(6), s(40));
            ctx.fillRect(cx + s(18), headCY - s(8), s(6), s(40));
          } else {
            // Mohawk
            ctx.beginPath();
            ctx.ellipse(cx, headY + s(6), s(22), s(16), 0, Math.PI, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(cx - s(3), headY - s(10), s(6), s(22));
          }
        }
      }

      // Weapon in hand (infantry)
      if (type === 'infantry') {
        const weapType = Math.floor(rng() * 3);
        if (weapType === 0) {
          // Sword
          ctx.fillStyle = '#aaa';
          ctx.fillRect(cx + s(36), bodyY - s(10), s(4), s(50));
          ctx.fillStyle = '#ccc';
          ctx.fillRect(cx + s(35), bodyY - s(12), s(6), s(4));
          ctx.fillStyle = '#5c4033';
          ctx.fillRect(cx + s(34), bodyY - s(8), s(8), s(10));
          ctx.fillStyle = '#d4a017';
          ctx.fillRect(cx + s(34), bodyY - s(8), s(8), s(2));
          ctx.fillRect(cx + s(34), bodyY, s(8), s(2));
        } else if (weapType === 1) {
          // Axe
          ctx.fillStyle = '#5c4033';
          ctx.fillRect(cx + s(38), bodyY - s(16), s(3), s(56));
          ctx.fillStyle = '#aaa';
          ctx.beginPath();
          ctx.moveTo(cx + s(38), bodyY - s(14));
          ctx.lineTo(cx + s(30), bodyY - s(6));
          ctx.lineTo(cx + s(38), bodyY + s(2));
          ctx.fill();
        } else {
          // Mace
          ctx.fillStyle = '#5c4033';
          ctx.fillRect(cx + s(38), bodyY - s(10), s(3), s(50));
          ctx.fillStyle = '#888';
          ctx.beginPath();
          ctx.arc(cx + s(39), bodyY - s(8), s(6), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#666';
          for (let a = 0; a < 6; a++) {
            const ang = a * Math.PI / 3;
            ctx.fillRect(cx + s(39) + Math.cos(ang) * s(5) - s(2), bodyY - s(8) + Math.sin(ang) * s(5) - s(2), s(4), s(4));
          }
        }
        // Shield on other side
        ctx.fillStyle = primary;
        ctx.beginPath();
        ctx.moveTo(cx - s(40), bodyY);
        ctx.lineTo(cx - s(50), bodyY + s(10));
        ctx.lineTo(cx - s(46), bodyY + s(40));
        ctx.lineTo(cx - s(36), bodyY + s(46));
        ctx.lineTo(cx - s(26), bodyY + s(40));
        ctx.lineTo(cx - s(22), bodyY + s(10));
        ctx.lineTo(cx - s(32), bodyY);
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(cx - s(38), bodyY + s(10));
        ctx.lineTo(cx - s(42), bodyY + s(18));
        ctx.lineTo(cx - s(36), bodyY + s(32));
        ctx.lineTo(cx - s(30), bodyY + s(18));
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#d4a017';
        ctx.beginPath(); ctx.arc(cx - s(36), bodyY + s(20), s(3), 0, Math.PI * 2); ctx.fill();
      }

    } else if (type === 'ranged') {
      // --- RANGED: Hooded archer bust ---
      const headY = py + s(28);
      const bodyY = headY + s(52);
      const headCY = headY + s(22);

      // Shoulders & cloak
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(cx - s(48), bodyY + s(8));
      ctx.quadraticCurveTo(cx - s(52), bodyY + s(40), cx - s(44), py + ph);
      ctx.lineTo(cx + s(44), py + ph);
      ctx.quadraticCurveTo(cx + s(52), bodyY + s(40), cx + s(48), bodyY + s(8));
      ctx.quadraticCurveTo(cx, bodyY - s(6), cx - s(48), bodyY + s(8));
      ctx.fill();

      // Inner tunic
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.moveTo(cx - s(20), bodyY + s(2));
      ctx.lineTo(cx - s(24), py + ph);
      ctx.lineTo(cx + s(24), py + ph);
      ctx.lineTo(cx + s(20), bodyY + s(2));
      ctx.fill();
      // Belt
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(cx - s(24), bodyY + s(24), s(48), s(5));
      ctx.fillStyle = '#888';
      ctx.fillRect(cx - s(3), bodyY + s(23), s(6), s(7));

      // Quiver strap
      ctx.strokeStyle = '#5c4033';
      ctx.lineWidth = s(3);
      ctx.beginPath();
      ctx.moveTo(cx + s(18), bodyY);
      ctx.lineTo(cx - s(14), bodyY + s(36));
      ctx.stroke();
      // Arrow tips poking out
      ctx.fillStyle = '#aaa';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(cx + s(30 + i * 4), bodyY - s(10 + i * 3), s(2), s(8));
        ctx.fillStyle = '#ccc';
        ctx.beginPath();
        ctx.moveTo(cx + s(31 + i * 4), bodyY - s(12 + i * 3));
        ctx.lineTo(cx + s(28 + i * 4), bodyY - s(10 + i * 3));
        ctx.lineTo(cx + s(34 + i * 4), bodyY - s(10 + i * 3));
        ctx.fill();
        ctx.fillStyle = '#aaa';
      }

      // Neck
      ctx.fillStyle = skin;
      ctx.fillRect(cx - s(8), bodyY - s(10), s(16), s(14));

      // Head
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.ellipse(cx, headCY, s(20), s(24), 0, 0, Math.PI * 2);
      ctx.fill();

      // Hood (always for ranged)
      const hoodUp = rng() > 0.3;
      ctx.fillStyle = dark;
      if (hoodUp) {
        ctx.beginPath();
        ctx.ellipse(cx, headY + s(6), s(28), s(22), 0, Math.PI + 0.3, -0.3);
        ctx.fill();
        // Hood shadow over face
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(cx, headY + s(14), s(22), s(10), 0, Math.PI, Math.PI * 2);
        ctx.fill();
        // Hood drape sides
        ctx.fillStyle = dark;
        ctx.fillRect(cx - s(26), headCY - s(2), s(6), s(28));
        ctx.fillRect(cx + s(20), headCY - s(2), s(6), s(28));
      } else {
        // Hood down around shoulders
        ctx.beginPath();
        ctx.moveTo(cx - s(30), bodyY + s(14));
        ctx.quadraticCurveTo(cx, bodyY + s(24), cx + s(30), bodyY + s(14));
        ctx.fill();
        // Show hair
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.ellipse(cx, headY + s(8), s(21), s(18), 0, Math.PI + 0.4, -0.4);
        ctx.fill();
      }

      // Eyes (narrower, more focused)
      const eyeY = headCY - s(2);
      for (let side = -1; side <= 1; side += 2) {
        const ex = cx + side * s(8);
        ctx.fillStyle = '#ddd';
        ctx.beginPath(); ctx.ellipse(ex, eyeY, s(5), s(2.5), 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = eyeColor;
        ctx.beginPath(); ctx.arc(ex + side * s(1), eyeY, s(2), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(ex + side * s(1), eyeY, s(1), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.arc(ex + side * s(1) + s(0.6), eyeY - s(0.6), s(0.5), 0, Math.PI * 2); ctx.fill();
      }

      // Brows
      ctx.fillStyle = hair;
      ctx.fillRect(cx - s(14), eyeY - s(6), s(12), s(browThickness));
      ctx.fillRect(cx + s(2), eyeY - s(6), s(12), s(browThickness));

      // Nose
      ctx.fillStyle = skinShadow;
      ctx.beginPath();
      ctx.moveTo(cx, headCY - s(2));
      ctx.lineTo(cx - s(noseWidth), headCY + s(6));
      ctx.lineTo(cx + s(noseWidth), headCY + s(6));
      ctx.fill();

      // Mouth
      ctx.fillStyle = '#7a3030';
      ctx.fillRect(cx - s(4), headCY + s(10), s(8), s(2));

      if (hasScar) {
        ctx.strokeStyle = 'rgba(180,60,60,0.4)';
        ctx.lineWidth = s(1.2);
        ctx.beginPath();
        ctx.moveTo(cx + scarSide * s(6), headCY - s(8));
        ctx.lineTo(cx + scarSide * s(10), headCY + s(4));
        ctx.stroke();
      }

      // Bow in hand
      ctx.strokeStyle = '#5c4033';
      ctx.lineWidth = s(3);
      ctx.beginPath();
      ctx.arc(cx - s(44), bodyY + s(10), s(32), -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
      // Bowstring
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = s(1);
      ctx.beginPath();
      ctx.moveTo(cx - s(44) + Math.cos(-Math.PI * 0.4) * s(32), bodyY + s(10) + Math.sin(-Math.PI * 0.4) * s(32));
      ctx.lineTo(cx - s(44) + Math.cos(Math.PI * 0.4) * s(32), bodyY + s(10) + Math.sin(Math.PI * 0.4) * s(32));
      ctx.stroke();

    } else if (type === 'cavalry') {
      // --- CAVALRY: Armored rider with horse visible ---
      const headY = py + s(18);
      const bodyY = headY + s(46);
      const headCY = headY + s(20);

      // Horse head/neck (lower portion)
      const horseColors = ['#5c3a1e', '#3a2010', '#8b6a3a', '#2a1a0a', '#c0c0c0'];
      const horseColor = horseColors[Math.floor(rng() * horseColors.length)];
      const horseDark = '#2a1a0a';

      // Horse body/neck visible below rider
      ctx.fillStyle = horseColor;
      ctx.beginPath();
      ctx.moveTo(px, py + ph - s(10));
      ctx.quadraticCurveTo(cx - s(20), bodyY + s(30), cx - s(10), bodyY + s(16));
      ctx.lineTo(cx + s(10), bodyY + s(16));
      ctx.quadraticCurveTo(cx + s(20), bodyY + s(30), px + pw, py + ph - s(10));
      ctx.lineTo(px + pw, py + ph);
      ctx.lineTo(px, py + ph);
      ctx.fill();

      // Horse mane
      ctx.fillStyle = horseDark;
      ctx.fillRect(cx - s(4), bodyY + s(16), s(8), s(30));

      // Horse armor/barding
      ctx.fillStyle = primary;
      ctx.fillRect(cx - s(30), bodyY + s(30), s(60), s(6));
      ctx.fillStyle = accent;
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(cx + i * s(12) - s(2), bodyY + s(29), s(4), s(8));
      }

      // Rider torso
      const armorGrad = ctx.createLinearGradient(cx, bodyY - s(10), cx, bodyY + s(20));
      armorGrad.addColorStop(0, '#999');
      armorGrad.addColorStop(1, '#666');
      ctx.fillStyle = armorGrad;
      ctx.beginPath();
      ctx.moveTo(cx - s(36), bodyY + s(6));
      ctx.lineTo(cx - s(26), bodyY - s(4));
      ctx.quadraticCurveTo(cx, bodyY - s(10), cx + s(26), bodyY - s(4));
      ctx.lineTo(cx + s(36), bodyY + s(6));
      ctx.lineTo(cx + s(30), bodyY + s(20));
      ctx.lineTo(cx - s(30), bodyY + s(20));
      ctx.fill();

      // Tabard/surcoat over armor
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.moveTo(cx - s(14), bodyY);
      ctx.lineTo(cx - s(18), bodyY + s(22));
      ctx.lineTo(cx + s(18), bodyY + s(22));
      ctx.lineTo(cx + s(14), bodyY);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.fillRect(cx - s(2), bodyY + s(2), s(4), s(16));
      ctx.fillRect(cx - s(8), bodyY + s(8), s(16), s(4));

      // Pauldrons
      ctx.fillStyle = '#aaa';
      ctx.beginPath(); ctx.ellipse(cx - s(34), bodyY + s(2), s(10), s(8), -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + s(34), bodyY + s(2), s(10), s(8), 0.3, 0, Math.PI * 2); ctx.fill();

      // Neck
      ctx.fillStyle = skin;
      ctx.fillRect(cx - s(8), bodyY - s(12), s(16), s(12));

      // Head
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.ellipse(cx, headCY, s(18), s(22), 0, 0, Math.PI * 2);
      ctx.fill();

      // Full helm for cavalry
      const cavalryHelm = Math.floor(rng() * 3);
      ctx.fillStyle = '#999';
      if (cavalryHelm === 0) {
        // Great helm
        ctx.beginPath();
        ctx.ellipse(cx, headY + s(8), s(22), s(18), 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#aaa';
        ctx.fillRect(cx - s(22), headY + s(6), s(44), s(4));
        // Visor slit
        ctx.fillStyle = '#333';
        ctx.fillRect(cx - s(14), headCY - s(4), s(28), s(3));
        // Plume
        ctx.fillStyle = primary;
        ctx.fillRect(cx - s(2), headY - s(12), s(4), s(16));
        ctx.fillStyle = accent;
        ctx.fillRect(cx - s(1), headY - s(10), s(2), s(12));
      } else if (cavalryHelm === 1) {
        // Open face with cheek guards
        ctx.beginPath();
        ctx.ellipse(cx, headY + s(6), s(22), s(18), 0, Math.PI + 0.4, -0.4);
        ctx.fill();
        ctx.fillStyle = '#888';
        ctx.fillRect(cx - s(22), headCY - s(2), s(6), s(16));
        ctx.fillRect(cx + s(16), headCY - s(2), s(6), s(16));
        // Show eyes
        const eyeY = headCY - s(2);
        for (let side = -1; side <= 1; side += 2) {
          const ex = cx + side * s(8);
          ctx.fillStyle = '#eee';
          ctx.beginPath(); ctx.ellipse(ex, eyeY, s(5), s(3), 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = eyeColor;
          ctx.beginPath(); ctx.arc(ex, eyeY, s(2), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#111';
          ctx.beginPath(); ctx.arc(ex, eyeY, s(1), 0, Math.PI * 2); ctx.fill();
        }
      } else {
        // No helm, show hair and face
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.ellipse(cx, headY + s(6), s(20), s(17), 0, Math.PI + 0.3, -0.3);
        ctx.fill();
        // Eyes
        const eyeY = headCY - s(2);
        for (let side = -1; side <= 1; side += 2) {
          const ex = cx + side * s(8);
          ctx.fillStyle = '#eee';
          ctx.beginPath(); ctx.ellipse(ex, eyeY, s(5), s(3), 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = eyeColor;
          ctx.beginPath(); ctx.arc(ex, eyeY, s(2), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#111';
          ctx.beginPath(); ctx.arc(ex, eyeY, s(1), 0, Math.PI * 2); ctx.fill();
        }
        // Nose + mouth
        ctx.fillStyle = skinShadow;
        ctx.beginPath();
        ctx.moveTo(cx, headCY - s(2));
        ctx.lineTo(cx - s(noseWidth), headCY + s(5));
        ctx.lineTo(cx + s(noseWidth), headCY + s(5));
        ctx.fill();
        ctx.fillStyle = '#7a3030';
        ctx.fillRect(cx - s(4), headCY + s(8), s(8), s(2));
      }

      // Lance
      ctx.fillStyle = '#5c4033';
      ctx.save();
      ctx.translate(cx + s(34), bodyY - s(8));
      ctx.rotate(-0.15);
      ctx.fillRect(-s(2), -s(60), s(4), s(80));
      ctx.fillStyle = '#aaa';
      ctx.beginPath();
      ctx.moveTo(0, -s(62));
      ctx.lineTo(-s(4), -s(52));
      ctx.lineTo(s(4), -s(52));
      ctx.fill();
      ctx.fillStyle = primary;
      ctx.fillRect(-s(6), -s(40), s(12), s(8));
      ctx.restore();

    } else if (type === 'siege') {
      // --- SIEGE: Engineer with siege machine ---
      const headY = py + s(30);
      const bodyY = headY + s(42);
      const headCY = headY + s(18);

      // Siege machine background (catapult/trebuchet)
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(px + s(10), py + ph - s(60), s(80), s(12));
      // Frame
      ctx.fillRect(px + s(20), py + ph - s(90), s(8), s(50));
      ctx.fillRect(px + s(70), py + ph - s(90), s(8), s(50));
      // Arm
      ctx.save();
      ctx.translate(px + s(50), py + ph - s(88));
      ctx.rotate(-0.4);
      ctx.fillStyle = '#4a3520';
      ctx.fillRect(-s(4), -s(30), s(8), s(60));
      ctx.fillStyle = '#888';
      ctx.beginPath(); ctx.arc(0, -s(30), s(5), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Wheels
      ctx.fillStyle = '#4a3520';
      ctx.beginPath(); ctx.arc(px + s(24), py + ph - s(42), s(12), 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s(74), py + ph - s(42), s(12), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(px + s(24), py + ph - s(42), s(4), 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s(74), py + ph - s(42), s(4), 0, Math.PI * 2); ctx.fill();
      // Spokes
      ctx.strokeStyle = '#5c4033';
      ctx.lineWidth = s(2);
      for (let a = 0; a < 4; a++) {
        const ang = a * Math.PI / 4;
        for (const wx of [s(24), s(74)]) {
          ctx.beginPath();
          ctx.moveTo(px + wx + Math.cos(ang) * s(4), py + ph - s(42) + Math.sin(ang) * s(4));
          ctx.lineTo(px + wx + Math.cos(ang) * s(11), py + ph - s(42) + Math.sin(ang) * s(11));
          ctx.stroke();
        }
      }

      // Engineer figure (smaller, in front of machine)
      // Body
      ctx.fillStyle = primary;
      ctx.fillRect(cx - s(16), bodyY, s(32), s(30));
      ctx.fillStyle = '#5c4033'; // leather apron
      ctx.fillRect(cx - s(12), bodyY + s(4), s(24), s(24));
      ctx.fillStyle = '#888';
      ctx.fillRect(cx - s(14), bodyY + s(20), s(28), s(4)); // tool belt

      // Arms
      ctx.fillStyle = skin;
      ctx.fillRect(cx - s(22), bodyY + s(2), s(8), s(20));
      ctx.fillRect(cx + s(14), bodyY + s(2), s(8), s(20));
      // Gloves
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(cx - s(22), bodyY + s(18), s(8), s(8));
      ctx.fillRect(cx + s(14), bodyY + s(18), s(8), s(8));

      // Neck
      ctx.fillStyle = skin;
      ctx.fillRect(cx - s(7), bodyY - s(8), s(14), s(12));

      // Head
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.ellipse(cx, headCY, s(16), s(20), 0, 0, Math.PI * 2);
      ctx.fill();

      // Engineer cap or goggles
      const engGear = Math.floor(rng() * 3);
      if (engGear === 0) {
        // Leather cap
        ctx.fillStyle = '#5c4033';
        ctx.beginPath();
        ctx.ellipse(cx, headY + s(6), s(18), s(14), 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(cx - s(18), headY + s(4), s(36), s(4));
      } else if (engGear === 1) {
        // Goggles on forehead
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.ellipse(cx, headY + s(6), s(17), s(14), 0, Math.PI + 0.4, -0.4);
        ctx.fill();
        ctx.fillStyle = '#5c4033';
        ctx.fillRect(cx - s(14), headY + s(6), s(28), s(3));
        ctx.fillStyle = '#888';
        ctx.beginPath(); ctx.arc(cx - s(7), headY + s(7), s(5), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + s(7), headY + s(7), s(5), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#aad';
        ctx.beginPath(); ctx.arc(cx - s(7), headY + s(7), s(3.5), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + s(7), headY + s(7), s(3.5), 0, Math.PI * 2); ctx.fill();
      } else {
        // Bandana
        ctx.fillStyle = primary;
        ctx.beginPath();
        ctx.ellipse(cx, headY + s(8), s(18), s(12), 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.fillRect(cx - s(18), headY + s(6), s(36), s(3));
        // Knot
        ctx.fillStyle = primary;
        ctx.fillRect(cx + s(14), headY + s(6), s(8), s(4));
        ctx.fillRect(cx + s(18), headY + s(4), s(6), s(8));
      }

      // Eyes (determined, focused)
      const eyeY = headCY - s(2);
      for (let side = -1; side <= 1; side += 2) {
        const ex = cx + side * s(7);
        ctx.fillStyle = '#eee';
        ctx.beginPath(); ctx.ellipse(ex, eyeY, s(4.5), s(3), 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = eyeColor;
        ctx.beginPath(); ctx.arc(ex, eyeY, s(2), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(ex, eyeY, s(1), 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = hair;
      ctx.fillRect(cx - s(12), eyeY - s(5), s(10), s(browThickness));
      ctx.fillRect(cx + s(2), eyeY - s(5), s(10), s(browThickness));

      // Nose + mouth
      ctx.fillStyle = skinShadow;
      ctx.beginPath();
      ctx.moveTo(cx, headCY);
      ctx.lineTo(cx - s(noseWidth), headCY + s(6));
      ctx.lineTo(cx + s(noseWidth), headCY + s(6));
      ctx.fill();
      ctx.fillStyle = '#7a3030';
      ctx.fillRect(cx - s(3), headCY + s(9), s(6), s(2));

      if (hasBeard) {
        ctx.fillStyle = hair;
        ctx.globalAlpha = beardStyle === 0 ? 0.3 : 1;
        ctx.beginPath();
        ctx.moveTo(cx - s(10), headCY + s(8));
        ctx.quadraticCurveTo(cx, headCY + s(16 + beardStyle * 4), cx + s(10), headCY + s(8));
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Tool in hand (hammer/wrench)
      ctx.fillStyle = '#888';
      ctx.fillRect(cx + s(18), bodyY + s(12), s(16), s(4));
      ctx.fillRect(cx + s(18), bodyY + s(8), s(4), s(12));

      // Faction banner on machine
      ctx.fillStyle = primary;
      ctx.fillRect(px + s(22), py + ph - s(100), s(2), s(18));
      ctx.fillRect(px + s(24), py + ph - s(100), s(12), s(10));
      ctx.fillStyle = accent;
      ctx.fillRect(px + s(26), py + ph - s(98), s(8), s(6));

    } else if (type === 'flying') {
      // --- FLYING: Eagle/griffin with rider or winged creature ---
      const creatureStyle = Math.floor(rng() * 2); // 0=eagle, 1=dragon

      if (creatureStyle === 0) {
        // Giant eagle with rider
        const bodyY = py + s(50);
        // Wings (spread wide)
        ctx.fillStyle = dark;
        // Left wing
        ctx.beginPath();
        ctx.moveTo(cx - s(10), bodyY);
        ctx.quadraticCurveTo(px - s(10), bodyY - s(40), px + s(4), bodyY - s(30));
        ctx.quadraticCurveTo(px + s(10), bodyY - s(10), cx - s(10), bodyY + s(10));
        ctx.fill();
        // Right wing
        ctx.beginPath();
        ctx.moveTo(cx + s(10), bodyY);
        ctx.quadraticCurveTo(px + pw + s(10), bodyY - s(40), px + pw - s(4), bodyY - s(30));
        ctx.quadraticCurveTo(px + pw - s(10), bodyY - s(10), cx + s(10), bodyY + s(10));
        ctx.fill();

        // Wing feather details
        ctx.fillStyle = primary;
        for (let i = 0; i < 5; i++) {
          const t = i / 4;
          // Left
          const lx = cx - s(10) + (px - cx + s(10)) * t;
          const ly = bodyY + (bodyY - s(30) - bodyY) * t;
          ctx.beginPath();
          ctx.ellipse(lx, ly, s(6), s(14), -0.3 - t * 0.5, 0, Math.PI * 2);
          ctx.fill();
          // Right
          const rx = cx + s(10) + (px + pw - cx - s(10)) * t;
          ctx.beginPath();
          ctx.ellipse(rx, ly, s(6), s(14), 0.3 + t * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Eagle body
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.ellipse(cx, bodyY + s(20), s(24), s(30), 0, 0, Math.PI * 2);
        ctx.fill();

        // Tail
        ctx.fillStyle = '#eee';
        ctx.beginPath();
        ctx.moveTo(cx - s(8), bodyY + s(44));
        ctx.lineTo(cx, py + ph);
        ctx.lineTo(cx + s(8), bodyY + s(44));
        ctx.fill();

        // Eagle head
        ctx.fillStyle = '#eee';
        ctx.beginPath();
        ctx.ellipse(cx, bodyY - s(10), s(14), s(16), 0, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#ffd700';
        ctx.beginPath(); ctx.arc(cx + s(5), bodyY - s(14), s(4), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(cx + s(5), bodyY - s(14), s(2), 0, Math.PI * 2); ctx.fill();

        // Beak
        ctx.fillStyle = '#d4a017';
        ctx.beginPath();
        ctx.moveTo(cx + s(12), bodyY - s(12));
        ctx.lineTo(cx + s(24), bodyY - s(6));
        ctx.lineTo(cx + s(12), bodyY - s(4));
        ctx.fill();

        // Talons
        ctx.fillStyle = '#d4a017';
        for (let side = -1; side <= 1; side += 2) {
          const tx = cx + side * s(12);
          const ty = bodyY + s(46);
          for (let t = -1; t <= 1; t++) {
            ctx.fillRect(tx + t * s(3), ty, s(2), s(8));
            ctx.beginPath();
            ctx.moveTo(tx + t * s(3), ty + s(8));
            ctx.lineTo(tx + t * s(3) + s(3), ty + s(12));
            ctx.lineTo(tx + t * s(3) - s(1), ty + s(8));
            ctx.fill();
          }
        }

        // Rider (small on top)
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.ellipse(cx - s(4), bodyY - s(2), s(6), s(7), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = primary;
        ctx.fillRect(cx - s(10), bodyY + s(4), s(12), s(14));

      } else {
        // Dragon-like creature
        const bodyY = py + s(60);

        // Wings
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(cx, bodyY - s(10));
        ctx.quadraticCurveTo(px - s(5), py + s(10), px + s(8), py + s(20));
        ctx.lineTo(px + s(15), bodyY - s(15));
        ctx.quadraticCurveTo(cx - s(20), bodyY - s(30), cx, bodyY - s(10));
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx, bodyY - s(10));
        ctx.quadraticCurveTo(px + pw + s(5), py + s(10), px + pw - s(8), py + s(20));
        ctx.lineTo(px + pw - s(15), bodyY - s(15));
        ctx.quadraticCurveTo(cx + s(20), bodyY - s(30), cx, bodyY - s(10));
        ctx.fill();

        // Wing membrane veins
        ctx.strokeStyle = primary;
        ctx.lineWidth = s(1);
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(cx, bodyY - s(10));
          ctx.quadraticCurveTo(cx - s(15 + i * 8), bodyY - s(20 + i * 5), px + s(10 + i * 4), py + s(16 + i * 8));
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx, bodyY - s(10));
          ctx.quadraticCurveTo(cx + s(15 + i * 8), bodyY - s(20 + i * 5), px + pw - s(10 + i * 4), py + s(16 + i * 8));
          ctx.stroke();
        }

        // Body
        ctx.fillStyle = primary;
        ctx.beginPath();
        ctx.ellipse(cx, bodyY + s(10), s(22), s(28), 0, 0, Math.PI * 2);
        ctx.fill();
        // Belly scales
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.ellipse(cx, bodyY + s(14), s(14), s(20), 0, 0, Math.PI * 2);
        ctx.fill();
        // Scale pattern
        for (let i = 0; i < 4; i++) {
          ctx.strokeStyle = dark;
          ctx.lineWidth = s(0.5);
          ctx.beginPath();
          ctx.ellipse(cx, bodyY + s(4 + i * 8), s(12 - i), s(3), 0, 0, Math.PI);
          ctx.stroke();
        }

        // Head
        ctx.fillStyle = primary;
        ctx.beginPath();
        ctx.ellipse(cx + s(2), bodyY - s(22), s(16), s(14), 0.1, 0, Math.PI * 2);
        ctx.fill();
        // Horns
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.moveTo(cx - s(8), bodyY - s(32));
        ctx.lineTo(cx - s(16), bodyY - s(48));
        ctx.lineTo(cx - s(4), bodyY - s(30));
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + s(12), bodyY - s(32));
        ctx.lineTo(cx + s(20), bodyY - s(48));
        ctx.lineTo(cx + s(8), bodyY - s(30));
        ctx.fill();
        // Eye
        ctx.fillStyle = '#ffd700';
        ctx.beginPath(); ctx.arc(cx + s(8), bodyY - s(24), s(4), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.fillRect(cx + s(7), bodyY - s(27), s(2), s(6));
        // Snout
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(cx + s(14), bodyY - s(18), s(8), s(6), 0.2, 0, Math.PI * 2);
        ctx.fill();
        // Nostril
        ctx.fillStyle = '#ffa500';
        ctx.beginPath(); ctx.arc(cx + s(18), bodyY - s(19), s(2), 0, Math.PI * 2); ctx.fill();

        // Tail
        ctx.strokeStyle = primary;
        ctx.lineWidth = s(6);
        ctx.beginPath();
        ctx.moveTo(cx, bodyY + s(34));
        ctx.quadraticCurveTo(cx - s(20), py + ph - s(10), cx - s(10), py + ph);
        ctx.stroke();
        // Tail tip
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(cx - s(10), py + ph);
        ctx.lineTo(cx - s(20), py + ph - s(10));
        ctx.lineTo(cx, py + ph - s(6));
        ctx.fill();

        // Claws
        ctx.fillStyle = '#555';
        for (let side = -1; side <= 1; side += 2) {
          const clx = cx + side * s(18);
          const cly = bodyY + s(32);
          for (let t = -1; t <= 1; t++) {
            ctx.beginPath();
            ctx.moveTo(clx + t * s(4), cly);
            ctx.lineTo(clx + t * s(4) + side * s(3), cly + s(8));
            ctx.lineTo(clx + t * s(4) - side * s(1), cly + s(4));
            ctx.fill();
          }
        }

        // Fire breath particles
        ctx.fillStyle = '#ff6600';
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(cx + s(24), bodyY - s(14), s(4), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath(); ctx.arc(cx + s(30), bodyY - s(10), s(3), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Ambient particle effects at bottom
    ctx.fillStyle = 'rgba(201, 168, 76, 0.1)';
    const particleRng = seededRng((unit.id || 1) + 999);
    for (let i = 0; i < 8; i++) {
      const ppx = px + particleRng() * pw;
      const ppy = py + ph * 0.7 + particleRng() * ph * 0.3;
      const pr = 1 + particleRng() * 3;
      ctx.beginPath(); ctx.arc(ppx, ppy, pr, 0, Math.PI * 2); ctx.fill();
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
      // Detailed tower
      const baseY = py + ph - s(20);
      // Foundation
      ctx.fillStyle = '#3a3530';
      ctx.fillRect(cx - s(36), baseY, s(72), s(20));
      // Tower body
      ctx.fillStyle = '#5a5550';
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
      ctx.fillStyle = '#666';
      ctx.fillRect(cx - s(28), baseY - s(78), s(56), s(10));
      // Crenellations
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(cx + i * s(10) - s(4), baseY - s(86), s(8), s(10));
      }
      // Arrow slits
      ctx.fillStyle = '#111';
      ctx.fillRect(cx - s(2), baseY - s(55), s(4), s(12));
      ctx.fillRect(cx - s(2), baseY - s(35), s(4), s(12));
      // Window glow
      ctx.fillStyle = '#d4a017';
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
    } else {
      // Detailed barracks
      const baseY = py + ph - s(20);
      // Foundation
      ctx.fillStyle = '#3a3530';
      ctx.fillRect(cx - s(44), baseY, s(88), s(20));
      // Walls
      ctx.fillStyle = '#5a5045';
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
      ctx.fillStyle = '#4a3520';
      ctx.fillRect(cx - s(38), baseY - s(26), s(76), s(3));
      ctx.fillRect(cx - s(38), baseY - s(48), s(76), s(3));
      // Door
      ctx.fillStyle = '#2a1f14';
      ctx.fillRect(cx - s(8), baseY - s(22), s(16), s(24));
      ctx.fillStyle = '#d4a017';
      ctx.fillRect(cx + s(4), baseY - s(12), s(3), s(3));
      // Windows
      ctx.fillStyle = '#111';
      ctx.fillRect(cx - s(28), baseY - s(42), s(10), s(10));
      ctx.fillRect(cx + s(18), baseY - s(42), s(10), s(10));
      ctx.fillStyle = '#d4a017';
      ctx.globalAlpha = 0.3;
      ctx.fillRect(cx - s(27), baseY - s(41), s(8), s(8));
      ctx.fillRect(cx + s(19), baseY - s(41), s(8), s(8));
      ctx.globalAlpha = 1;
      // Banner
      ctx.fillStyle = primary;
      ctx.fillRect(cx - s(50), baseY - s(40), s(8), s(20));
      ctx.fillStyle = accent;
      ctx.fillRect(cx - s(49), baseY - s(38), s(6), s(4));
      // Smoke from chimney
      ctx.fillStyle = '#5a5045';
      ctx.fillRect(cx + s(20), baseY - s(70), s(8), s(20));
      ctx.fillStyle = 'rgba(150,150,150,0.3)';
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
