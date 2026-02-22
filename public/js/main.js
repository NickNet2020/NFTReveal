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
    maxZoom: 1.2,
    screenW: window.innerWidth,
    screenH: window.innerHeight
  };

  // Input
  let keys = {};
  let mouse = { x: 0, y: 0, worldX: 0, worldY: 0 };
  let isPlacing = false;
  let selectedBuildingType = null;

  // Unit selection
  let selectedUnitId = null;
  let selectedUnitName = null;
  let unitCardEl = null;

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

  // ─── Unit Selection & Card ──────────────────────────────────
  function trySelectUnit(wx, wy) {
    if (!gameState || !gameState.units) { deselectUnit(); return; }

    let closest = null;
    let closestDist = 30; // click radius in world units

    for (const u of gameState.units) {
      const dx = u.x - wx;
      const dy = u.y - wy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < closestDist) { closestDist = d; closest = u; }
    }

    if (closest) {
      selectedUnitId = closest.id;
      selectedUnitName = getUnitDisplayName(closest);
      Renderer.setSelectedUnit(selectedUnitId);
      showUnitCard(closest);
    } else {
      deselectUnit();
    }
  }

  function deselectUnit() {
    selectedUnitId = null;
    selectedUnitName = null;
    Renderer.setSelectedUnit(null);
    hideUnitCard();
  }

  function createUnitCard() {
    unitCardEl = document.createElement('div');
    unitCardEl.id = 'unitCard';
    unitCardEl.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(28, 22, 14, 0.95); border: 2px solid rgba(201, 168, 76, 0.6);
      border-radius: 4px; padding: 12px 16px; display: none; z-index: 100;
      font-family: 'Cinzel', serif; color: #e6c766; min-width: 280px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6); pointer-events: auto;
    `;
    unitCardEl.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <canvas id="unitPortrait" width="48" height="48" style="border: 2px solid rgba(201,168,76,0.4); image-rendering: pixelated; background: #0a0806; flex-shrink: 0;"></canvas>
        <div style="flex: 1; min-width: 0;">
          <div id="ucName" style="font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
          <div id="ucType" style="font-size: 10px; color: rgba(201,168,76,0.7); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;"></div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-top: 10px; font-size: 11px;">
        <div style="display: flex; justify-content: space-between;"><span style="color: #888;">HP</span><span id="ucHp" style="color: #4a8c3f; font-weight: 600;"></span></div>
        <div style="display: flex; justify-content: space-between;"><span style="color: #888;">DMG</span><span id="ucDmg" style="color: #c0392b; font-weight: 600;"></span></div>
        <div style="display: flex; justify-content: space-between;"><span style="color: #888;">ATK SPD</span><span id="ucAtkSpd" style="color: #d4a017; font-weight: 600;"></span></div>
        <div style="display: flex; justify-content: space-between;"><span style="color: #888;">MOVE</span><span id="ucMoveSpd" style="color: #4a6fa5; font-weight: 600;"></span></div>
      </div>
    `;
    document.getElementById('gameScreen').appendChild(unitCardEl);
  }

  function showUnitCard(unit) {
    if (!unitCardEl) createUnitCard();
    unitCardEl.style.display = 'block';
    document.getElementById('ucName').textContent = selectedUnitName;
    document.getElementById('ucType').textContent = unit.unitType;
    updateUnitCardStats(unit);
    drawUnitPortrait(unit);
  }

  function hideUnitCard() {
    if (unitCardEl) unitCardEl.style.display = 'none';
  }

  function updateUnitCardStats(unit) {
    if (!unitCardEl) return;
    document.getElementById('ucHp').textContent = `${Math.ceil(unit.hp)} / ${unit.maxHp}`;
    document.getElementById('ucDmg').textContent = unit.damage || '?';
    document.getElementById('ucAtkSpd').textContent = (unit.attackSpeed || '?') + 'ms';
    document.getElementById('ucMoveSpd').textContent = unit.speed || '?';
  }

  function updateSelectedUnit() {
    if (!selectedUnitId || !gameState || !gameState.units) return;
    const unit = gameState.units.find(u => u.id === selectedUnitId);
    if (!unit) { deselectUnit(); return; }
    updateUnitCardStats(unit);
  }

  function drawUnitPortrait(unit) {
    const canvas = document.getElementById('unitPortrait');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const charData = CHARACTERS[unit.characterId];
    const primary = charData ? charData.color : '#666';
    const accent = charData ? charData.accentColor : '#888';
    const dark = charData ? charData.darkColor : '#444';

    ctx.clearRect(0, 0, 48, 48);
    ctx.imageSmoothingEnabled = false;

    // Dark background
    ctx.fillStyle = '#0a0806';
    ctx.fillRect(0, 0, 48, 48);

    const type = unit.unitType;

    if (type === 'infantry') {
      // Helmet top
      ctx.fillStyle = '#777';
      ctx.fillRect(14, 4, 20, 14);
      // Helmet brim
      ctx.fillStyle = '#666';
      ctx.fillRect(12, 12, 24, 4);
      // Face
      ctx.fillStyle = '#d4a574';
      ctx.fillRect(16, 16, 16, 12);
      // Eyes
      ctx.fillStyle = '#222';
      ctx.fillRect(18, 19, 4, 3);
      ctx.fillRect(26, 19, 4, 3);
      ctx.fillStyle = '#fff';
      ctx.fillRect(19, 19, 2, 2);
      ctx.fillRect(27, 19, 2, 2);
      // Nose
      ctx.fillStyle = '#c49464';
      ctx.fillRect(22, 22, 4, 4);
      // Mouth
      ctx.fillStyle = '#8a6040';
      ctx.fillRect(20, 27, 8, 2);
      // Armor collar
      ctx.fillStyle = primary;
      ctx.fillRect(12, 30, 24, 14);
      // Armor detail
      ctx.fillStyle = dark;
      ctx.fillRect(22, 30, 4, 14);
      // Helmet crest
      ctx.fillStyle = accent;
      ctx.fillRect(20, 0, 8, 6);
      // Shield edge
      ctx.fillStyle = dark;
      ctx.fillRect(2, 28, 10, 16);
      ctx.fillStyle = primary;
      ctx.fillRect(3, 29, 8, 14);
      ctx.fillStyle = accent;
      ctx.fillRect(5, 33, 4, 6);
    } else if (type === 'ranged') {
      // Hood
      ctx.fillStyle = dark;
      ctx.fillRect(10, 2, 28, 18);
      ctx.fillRect(8, 10, 32, 12);
      // Hood shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(14, 8, 20, 6);
      // Face in shadow
      ctx.fillStyle = '#d4a574';
      ctx.fillRect(16, 14, 16, 12);
      // Narrow eyes
      ctx.fillStyle = '#333';
      ctx.fillRect(18, 18, 5, 2);
      ctx.fillRect(25, 18, 5, 2);
      ctx.fillStyle = '#aad';
      ctx.fillRect(20, 18, 2, 2);
      ctx.fillRect(27, 18, 2, 2);
      // Nose
      ctx.fillStyle = '#c49464';
      ctx.fillRect(22, 21, 4, 3);
      // Cloak body
      ctx.fillStyle = dark;
      ctx.fillRect(8, 28, 32, 20);
      ctx.fillStyle = primary;
      ctx.fillRect(10, 30, 28, 16);
      // Bow on right side
      ctx.strokeStyle = '#6B4226';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(42, 26, 16, -1.2, 1.2);
      ctx.stroke();
      // Quiver hint
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(38, 8, 6, 20);
    } else if (type === 'cavalry') {
      // Visor helmet
      ctx.fillStyle = '#999';
      ctx.fillRect(14, 2, 20, 18);
      // Visor detail
      ctx.fillStyle = '#777';
      ctx.fillRect(14, 12, 20, 4);
      // Eye slit
      ctx.fillStyle = '#111';
      ctx.fillRect(16, 13, 16, 2);
      // Plume
      ctx.fillStyle = primary;
      ctx.fillRect(16, 0, 16, 4);
      ctx.fillStyle = accent;
      ctx.fillRect(20, 0, 8, 2);
      // Neck armor
      ctx.fillStyle = primary;
      ctx.fillRect(12, 22, 24, 10);
      // Horse head below
      ctx.fillStyle = '#5c3a1e';
      ctx.fillRect(10, 34, 20, 14);
      ctx.fillStyle = '#4a2e15';
      ctx.fillRect(6, 38, 10, 10);
      // Horse eye
      ctx.fillStyle = '#fff';
      ctx.fillRect(10, 41, 3, 2);
      ctx.fillStyle = '#111';
      ctx.fillRect(11, 41, 2, 2);
      // Mane
      ctx.fillStyle = '#3a2010';
      ctx.fillRect(22, 34, 8, 4);
      // Barding
      ctx.fillStyle = dark;
      ctx.fillRect(10, 34, 20, 3);
    } else if (type === 'siege') {
      // War machine frame
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(6, 16, 36, 18);
      // Beam/arm
      ctx.fillStyle = '#6B4226';
      ctx.fillRect(8, 6, 6, 28);
      // Crossbar
      ctx.fillStyle = '#4a3520';
      ctx.fillRect(4, 22, 40, 4);
      // Wheels
      ctx.fillStyle = '#4a3520';
      ctx.beginPath();
      ctx.arc(12, 40, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(36, 40, 6, 0, Math.PI * 2);
      ctx.fill();
      // Wheel spokes
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(12, 40, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(36, 40, 6, 0, Math.PI * 2);
      ctx.stroke();
      // Metal bands
      ctx.fillStyle = '#555';
      ctx.fillRect(6, 18, 36, 2);
      ctx.fillRect(6, 32, 36, 2);
      // Flag
      ctx.fillStyle = '#888';
      ctx.fillRect(10, 0, 2, 8);
      ctx.fillStyle = primary;
      ctx.fillRect(12, 0, 10, 6);
      ctx.fillStyle = accent;
      ctx.fillRect(14, 2, 6, 2);
    } else if (type === 'flying') {
      // Bird/dragon head - larger
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.arc(22, 22, 14, 0, Math.PI * 2);
      ctx.fill();
      // Head highlight
      ctx.fillStyle = accent;
      ctx.fillRect(14, 12, 12, 8);
      // Beak
      ctx.fillStyle = '#d4a017';
      ctx.fillRect(34, 18, 12, 4);
      ctx.fillRect(36, 16, 8, 8);
      // Eye
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(28, 16, 6, 5);
      ctx.fillStyle = '#111';
      ctx.fillRect(30, 17, 3, 3);
      ctx.fillStyle = '#fff';
      ctx.fillRect(31, 17, 1, 1);
      // Wing hints
      ctx.fillStyle = dark;
      ctx.fillRect(2, 6, 18, 6);
      ctx.fillRect(2, 34, 18, 6);
      // Feather details
      ctx.fillStyle = accent;
      ctx.fillRect(4, 8, 4, 2);
      ctx.fillRect(10, 8, 4, 2);
      ctx.fillRect(4, 36, 4, 2);
      ctx.fillRect(10, 36, 4, 2);
    }

    // Frame border
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 48, 48);
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
