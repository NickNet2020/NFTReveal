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

      item.innerHTML = `
        <div class="building-header">
          <span class="building-name">${b.name}</span>
          <span class="building-cost">${b.cost}g</span>
        </div>
        <div class="building-desc">${b.description}</div>
        <div class="building-stats">
          <span class="building-stat">+${b.income}g/5s</span>
          <span class="building-stat">Spawns: ${unitDef ? unitDef.name : b.unit}</span>
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

    // Try buildings (within 40 world units)
    if (gameState.buildings) {
      for (const b of gameState.buildings) {
        const dx = b.x - wx;
        const dy = b.y - wy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 40 && d < closestDist) { closestDist = d; closest = { type: 'building', data: b }; }
      }
    }

    if (closest) {
      if (closest.type === 'unit' || closest.type === 'hero') {
        selectedUnitId = closest.data.id;
        selectedBuildingId = null;
        selectedUnitName = closest.data.isHero ? closest.data.name : getUnitDisplayName(closest.data);
        Renderer.setSelectedUnit(selectedUnitId);
        showBanner(closest.data, closest.type);
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
      width: 300px; height: 200px; display: none; z-index: 100;
      pointer-events: none; font-family: 'Cinzel', serif;
    `;
    // We draw the banner on a canvas for the medieval sword-themed look
    const c = document.createElement('canvas');
    c.id = 'bannerCanvas';
    c.width = 300;
    c.height = 200;
    c.style.cssText = 'width: 300px; height: 200px;';
    bannerEl.appendChild(c);
    document.getElementById('gameScreen').appendChild(bannerEl);
  }

  function hideBanner() {
    if (bannerEl) bannerEl.style.display = 'none';
  }

  function showBanner(data, selType) {
    if (!bannerEl) createBanner();
    bannerEl.style.display = 'block';
    renderBanner(data, selType);
  }

  function renderBanner(data, selType) {
    const canvas = document.getElementById('bannerCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 300, H = 200;

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
    } else {
      renderUnitBanner(ctx, data, charData, primary, W, H, selType);
    }
  }

  function renderUnitBanner(ctx, unit, charData, primary, W, H, selType) {
    // Portrait area (56x56, drawn from 48x48 source)
    const px = 20, py = 22;
    ctx.fillStyle = '#0a0806';
    ctx.fillRect(px, py, 56, 56);
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px, py, 56, 56);

    // Draw portrait on sub-region
    drawBannerPortrait(ctx, unit, px, py, 56, 56);

    // Name + type + rank stars
    const nameX = 84;
    ctx.font = 'bold 13px Cinzel, serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    const displayName = unit.isHero ? unit.name : (selectedUnitName || 'Unit');
    ctx.fillText(displayName, nameX, 38, W - nameX - 16);

    // Type label
    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = primary;
    const typeLabel = unit.isHero ? 'HERO' : (unit.unitType || '').toUpperCase();
    ctx.fillText(typeLabel, nameX, 52);

    // Rank stars (only for non-heroes)
    if (!unit.isHero && unit.rank > 0) {
      const starColors = ['', '#cd7f32', '#c0c0c0', '#ffd700'];
      const starColor = starColors[Math.min(unit.rank, 3)];
      ctx.font = '12px serif';
      ctx.fillStyle = starColor;
      let stars = '';
      for (let i = 0; i < unit.rank; i++) stars += '\u2605';
      ctx.fillText(stars, nameX, 66);
    }

    // Separator line
    ctx.fillStyle = 'rgba(201, 168, 76, 0.3)';
    ctx.fillRect(20, 84, W - 40, 1);

    // Stats grid
    const statsY = 98;
    const col1 = 24, col2 = 158;
    ctx.font = '11px Cinzel, serif';

    // HP
    ctx.fillStyle = '#888';
    ctx.fillText('HP', col1, statsY);
    ctx.fillStyle = '#4a8c3f';
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillText(`${Math.ceil(unit.hp)} / ${unit.maxHp}`, col1 + 40, statsY);

    // DMG
    ctx.font = '11px Cinzel, serif';
    ctx.fillStyle = '#888';
    ctx.fillText('DMG', col2, statsY);
    ctx.fillStyle = '#c0392b';
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillText(`${unit.damage || '?'}`, col2 + 40, statsY);

    // ATK SPD
    const statsY2 = statsY + 18;
    ctx.font = '11px Cinzel, serif';
    ctx.fillStyle = '#888';
    ctx.fillText('ATK SPD', col1, statsY2);
    ctx.fillStyle = '#d4a017';
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillText(`${unit.attackSpeed || '?'}ms`, col1 + 58, statsY2);

    // MOVE
    ctx.font = '11px Cinzel, serif';
    ctx.fillStyle = '#888';
    ctx.fillText('MOVE', col2, statsY2);
    ctx.fillStyle = '#4a6fa5';
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillText(`${unit.speed || '?'}`, col2 + 40, statsY2);

    // Lane
    if (unit.lane) {
      const statsY3 = statsY2 + 18;
      ctx.font = '11px Cinzel, serif';
      ctx.fillStyle = '#888';
      ctx.fillText('LANE', col1, statsY3);
      ctx.fillStyle = '#c9a84c';
      ctx.font = 'bold 11px Cinzel, serif';
      ctx.fillText(unit.lane.toUpperCase(), col1 + 40, statsY3);
    }

    // XP bar (only for non-heroes)
    if (!unit.isHero) {
      const xpBarY = H - 30;
      const xpBarX = 20;
      const xpBarW = W - 40;
      const xpBarH = 12;
      const xp = unit.xp || 0;
      const xpNeeded = unit.xpToNext || 30;
      const rank = unit.rank || 0;

      // XP label
      ctx.font = '9px Cinzel, serif';
      ctx.fillStyle = '#888';
      ctx.textAlign = 'left';
      ctx.fillText('XP', xpBarX, xpBarY - 3);

      // Rank label on right
      ctx.textAlign = 'right';
      ctx.fillStyle = rank >= 3 ? '#ffd700' : '#888';
      ctx.fillText(rank >= 3 ? 'MAX RANK' : `Rank ${rank}`, xpBarX + xpBarW, xpBarY - 3);

      // XP bar bg
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(xpBarX, xpBarY, xpBarW, xpBarH);

      // XP bar fill
      const xpPct = rank >= 3 ? 1 : Math.min(1, xp / xpNeeded);
      const xpGrad = ctx.createLinearGradient(xpBarX, 0, xpBarX + xpBarW * xpPct, 0);
      xpGrad.addColorStop(0, '#6a5acd');
      xpGrad.addColorStop(1, '#9370db');
      ctx.fillStyle = xpGrad;
      ctx.fillRect(xpBarX, xpBarY, xpBarW * xpPct, xpBarH);

      // XP bar shine
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(xpBarX, xpBarY, xpBarW * xpPct, xpBarH / 2);

      // XP text
      ctx.font = 'bold 9px Cinzel, serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      if (rank >= 3) {
        ctx.fillText('MAX', xpBarX + xpBarW / 2, xpBarY + 9);
      } else {
        ctx.fillText(`${xp} / ${xpNeeded}`, xpBarX + xpBarW / 2, xpBarY + 9);
      }

      // XP bar border
      ctx.strokeStyle = 'rgba(201, 168, 76, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(xpBarX, xpBarY, xpBarW, xpBarH);
    }

    ctx.textAlign = 'left';
  }

  function renderBuildingBanner(ctx, building, charData, primary, W, H) {
    // Building icon area
    const px = 20, py = 22;
    ctx.fillStyle = '#0a0806';
    ctx.fillRect(px, py, 56, 56);
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px, py, 56, 56);

    // Simple building icon
    drawBuildingIcon(ctx, building, px, py, 56, 56);

    // Building name
    const nameX = 84;
    const bDef = charData ? charData.buildings.find(b => b.id === building.typeId) : null;
    ctx.font = 'bold 13px Cinzel, serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(bDef ? bDef.name : 'Building', nameX, 38, W - nameX - 16);

    // Type (tower or barracks)
    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = primary;
    ctx.fillText(building.isTower ? 'DEFENSE TOWER' : 'BARRACKS', nameX, 52);

    // Side
    ctx.font = '10px Cinzel, serif';
    ctx.fillStyle = building.side === mySide ? '#4a8c3f' : '#b22222';
    ctx.fillText(building.side === mySide ? 'FRIENDLY' : 'ENEMY', nameX, 66);

    // Separator line
    ctx.fillStyle = 'rgba(201, 168, 76, 0.3)';
    ctx.fillRect(20, 84, W - 40, 1);

    // Stats
    const statsY = 100;
    const col1 = 24, col2 = 158;

    // HP
    ctx.font = '11px Cinzel, serif';
    ctx.fillStyle = '#888';
    ctx.fillText('HP', col1, statsY);
    ctx.fillStyle = '#4a8c3f';
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillText(`${Math.ceil(building.hp)} / ${building.maxHp}`, col1 + 40, statsY);

    // Income
    if (bDef) {
      ctx.font = '11px Cinzel, serif';
      ctx.fillStyle = '#888';
      ctx.fillText('INCOME', col2, statsY);
      ctx.fillStyle = '#d4a017';
      ctx.font = 'bold 11px Cinzel, serif';
      ctx.fillText(`+${bDef.income}g`, col2 + 52, statsY);
    }

    if (building.isTower) {
      // Tower stats
      const statsY2 = statsY + 20;
      ctx.font = '11px Cinzel, serif';
      ctx.fillStyle = '#888';
      ctx.fillText('STATUS', col1, statsY2);
      ctx.fillStyle = '#c9a84c';
      ctx.font = 'bold 11px Cinzel, serif';
      ctx.fillText(building.constructed ? 'ACTIVE' : 'BUILDING...', col1 + 52, statsY2);
    } else {
      // Spawn progress bar
      const barY = H - 30;
      const barX = 20;
      const barW = W - 40;
      const barH = 12;

      ctx.font = '9px Cinzel, serif';
      ctx.fillStyle = '#888';
      ctx.textAlign = 'left';
      ctx.fillText('SPAWN', barX, barY - 3);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#888';
      const pct = Math.round((building.spawnProgress || 0) * 100);
      ctx.fillText(building.constructed ? `${pct}%` : 'Building...', barX + barW, barY - 3);

      // Bar bg
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barX, barY, barW, barH);

      // Bar fill
      const fillPct = building.constructed ? (building.spawnProgress || 0) : (building.constructionProgress || 0);
      const barGrad = ctx.createLinearGradient(barX, 0, barX + barW * fillPct, 0);
      barGrad.addColorStop(0, building.constructed ? '#4a8c3f' : '#d4a017');
      barGrad.addColorStop(1, building.constructed ? '#6aac5f' : '#e6c766');
      ctx.fillStyle = barGrad;
      ctx.fillRect(barX, barY, barW * fillPct, barH);

      // Bar shine
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(barX, barY, barW * fillPct, barH / 2);

      // Bar border
      ctx.strokeStyle = 'rgba(201, 168, 76, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
    }

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
    const s = pw / 48; // scale factor

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(s, s);

    if (type === 'infantry') {
      ctx.fillStyle = '#777'; ctx.fillRect(14, 4, 20, 14);
      ctx.fillStyle = '#666'; ctx.fillRect(12, 12, 24, 4);
      ctx.fillStyle = '#d4a574'; ctx.fillRect(16, 16, 16, 12);
      ctx.fillStyle = '#222'; ctx.fillRect(18, 19, 4, 3); ctx.fillRect(26, 19, 4, 3);
      ctx.fillStyle = '#fff'; ctx.fillRect(19, 19, 2, 2); ctx.fillRect(27, 19, 2, 2);
      ctx.fillStyle = '#c49464'; ctx.fillRect(22, 22, 4, 4);
      ctx.fillStyle = '#8a6040'; ctx.fillRect(20, 27, 8, 2);
      ctx.fillStyle = primary; ctx.fillRect(12, 30, 24, 14);
      ctx.fillStyle = dark; ctx.fillRect(22, 30, 4, 14);
      ctx.fillStyle = accent; ctx.fillRect(20, 0, 8, 6);
      ctx.fillStyle = dark; ctx.fillRect(2, 28, 10, 16);
      ctx.fillStyle = primary; ctx.fillRect(3, 29, 8, 14);
      ctx.fillStyle = accent; ctx.fillRect(5, 33, 4, 6);
    } else if (type === 'ranged') {
      ctx.fillStyle = dark; ctx.fillRect(10, 2, 28, 18); ctx.fillRect(8, 10, 32, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(14, 8, 20, 6);
      ctx.fillStyle = '#d4a574'; ctx.fillRect(16, 14, 16, 12);
      ctx.fillStyle = '#333'; ctx.fillRect(18, 18, 5, 2); ctx.fillRect(25, 18, 5, 2);
      ctx.fillStyle = '#aad'; ctx.fillRect(20, 18, 2, 2); ctx.fillRect(27, 18, 2, 2);
      ctx.fillStyle = '#c49464'; ctx.fillRect(22, 21, 4, 3);
      ctx.fillStyle = dark; ctx.fillRect(8, 28, 32, 20);
      ctx.fillStyle = primary; ctx.fillRect(10, 30, 28, 16);
      ctx.fillStyle = '#5c4033'; ctx.fillRect(38, 8, 6, 20);
    } else if (type === 'cavalry') {
      ctx.fillStyle = '#999'; ctx.fillRect(14, 2, 20, 18);
      ctx.fillStyle = '#777'; ctx.fillRect(14, 12, 20, 4);
      ctx.fillStyle = '#111'; ctx.fillRect(16, 13, 16, 2);
      ctx.fillStyle = primary; ctx.fillRect(16, 0, 16, 4); ctx.fillRect(12, 22, 24, 10);
      ctx.fillStyle = accent; ctx.fillRect(20, 0, 8, 2);
      ctx.fillStyle = '#5c3a1e'; ctx.fillRect(10, 34, 20, 14);
      ctx.fillStyle = '#4a2e15'; ctx.fillRect(6, 38, 10, 10);
      ctx.fillStyle = '#fff'; ctx.fillRect(10, 41, 3, 2);
      ctx.fillStyle = '#111'; ctx.fillRect(11, 41, 2, 2);
      ctx.fillStyle = '#3a2010'; ctx.fillRect(22, 34, 8, 4);
      ctx.fillStyle = dark; ctx.fillRect(10, 34, 20, 3);
    } else if (type === 'siege') {
      ctx.fillStyle = '#5c4033'; ctx.fillRect(6, 16, 36, 18);
      ctx.fillStyle = '#6B4226'; ctx.fillRect(8, 6, 6, 28);
      ctx.fillStyle = '#4a3520'; ctx.fillRect(4, 22, 40, 4);
      ctx.fillStyle = '#4a3520';
      ctx.beginPath(); ctx.arc(12, 40, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(36, 40, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#555'; ctx.fillRect(6, 18, 36, 2); ctx.fillRect(6, 32, 36, 2);
      ctx.fillStyle = '#888'; ctx.fillRect(10, 0, 2, 8);
      ctx.fillStyle = primary; ctx.fillRect(12, 0, 10, 6);
      ctx.fillStyle = accent; ctx.fillRect(14, 2, 6, 2);
    } else if (type === 'flying') {
      ctx.fillStyle = primary;
      ctx.beginPath(); ctx.arc(22, 22, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = accent; ctx.fillRect(14, 12, 12, 8);
      ctx.fillStyle = '#d4a017'; ctx.fillRect(34, 18, 12, 4); ctx.fillRect(36, 16, 8, 8);
      ctx.fillStyle = '#ffd700'; ctx.fillRect(28, 16, 6, 5);
      ctx.fillStyle = '#111'; ctx.fillRect(30, 17, 3, 3);
      ctx.fillStyle = '#fff'; ctx.fillRect(31, 17, 1, 1);
      ctx.fillStyle = dark; ctx.fillRect(2, 6, 18, 6); ctx.fillRect(2, 34, 18, 6);
      ctx.fillStyle = accent;
      ctx.fillRect(4, 8, 4, 2); ctx.fillRect(10, 8, 4, 2);
      ctx.fillRect(4, 36, 4, 2); ctx.fillRect(10, 36, 4, 2);
    }

    ctx.restore();
  }

  function drawBuildingIcon(ctx, building, px, py, pw, ph) {
    ctx.save();
    ctx.translate(px + pw / 2, py + ph / 2);
    const s = pw / 56;
    ctx.scale(s, s);

    if (building.isTower) {
      // Tower icon
      ctx.fillStyle = '#5a5550';
      ctx.fillRect(-8, -4, 16, 20);
      ctx.fillStyle = '#666';
      ctx.fillRect(-10, -20, 20, 18);
      // Crenellations
      ctx.fillRect(-12, -24, 6, 4);
      ctx.fillRect(6, -24, 6, 4);
      ctx.fillRect(-3, -24, 6, 4);
      // Arrow slit
      ctx.fillStyle = '#111';
      ctx.fillRect(-1, -14, 2, 8);
    } else {
      // Barracks icon
      ctx.fillStyle = '#5a5045';
      ctx.fillRect(-16, -10, 32, 26);
      // Roof
      const charData = CHARACTERS[building.characterId];
      ctx.fillStyle = charData ? charData.darkColor || '#333' : '#333';
      ctx.beginPath();
      ctx.moveTo(-20, -10);
      ctx.lineTo(0, -24);
      ctx.lineTo(20, -10);
      ctx.fill();
      // Door
      ctx.fillStyle = '#2a1f14';
      ctx.fillRect(-4, 4, 8, 12);
    }

    ctx.restore();
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
      if (!unit || unit.hp <= 0) { deselectAll(); return; }
      renderBanner(unit, unit.isHero ? 'hero' : 'unit');
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
