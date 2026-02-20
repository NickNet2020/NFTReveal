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
      // Escape to cancel placement
      if (e.key === 'Escape') {
        selectedBuildingType = null;
        isPlacing = false;
        gameCanvas.classList.remove('placing');
        document.querySelectorAll('.building-item').forEach(i => i.classList.remove('selected'));
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
      if (!gameActive || !isPlacing || !selectedBuildingType) return;

      const world = Renderer.screenToWorld(e.clientX, e.clientY);
      socket.emit('build', {
        buildingTypeId: selectedBuildingType,
        x: world.x,
        y: world.y
      });
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
      enemyCastleLabel.textContent = data.opponentName || (oppChar ? oppChar.name : 'Enemy');
      enemyCastleLabel.style.color = oppChar ? oppChar.color : '#fff';

      // Set passive display
      if (myChar) {
        passiveText.textContent = `${myChar.passive.name}: ${myChar.passive.description}`;
      }

      console.log(`Game started! Playing as ${myChar.name} (${mySide})`);
    });

    socket.on('state', (data) => {
      gameState = data;
      updateHUD(data);
    });

    socket.on('buildResult', (data) => {
      if (data.success) {
        // Keep placing mode for rapid building, but deselect if they want
      } else {
        showToast(data.reason || 'Cannot build there');
      }
    });

    socket.on('rescueStrike', (data) => {
      // Trigger big visual effect
      particles.rescueStrikeEffect(data.x, data.y, data.radius);
    });

    socket.on('rescueStrikeResult', (data) => {
      if (!data.success) {
        showToast('Rescue Strike already used!');
      }
    });

    socket.on('gameOver', (data) => {
      gameActive = false;
      gameScreen.classList.add('hidden');
      gameOverScreen.classList.remove('hidden');

      const won = data.winner === mySide;
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

    // Clamp camera to map bounds
    const GC = GAME_CONSTANTS;
    camera.targetX = Math.max(0, Math.min(GC.MAP_WIDTH, camera.targetX));
    camera.targetY = Math.max(0, Math.min(GC.MAP_HEIGHT, camera.targetY));

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
