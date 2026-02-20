// ═══════════════════════════════════════════════════════════════════
//  MAIN.JS - Game Client Entry Point
//  Networking, Input, UI, Game Loop
// ═══════════════════════════════════════════════════════════════════

(() => {
  'use strict';

  // ─── DOM Elements ────────────────────────────────────────────
  const menuScreen = document.getElementById('menu-screen');
  const deathScreen = document.getElementById('death-screen');
  const deathScore = document.getElementById('death-score');
  const gameHud = document.getElementById('game-hud');
  const canvas = document.getElementById('game-canvas');
  const playBtn = document.getElementById('play-btn');
  const nameInput = document.getElementById('player-name');

  // HUD elements
  const hudName = document.getElementById('hud-name');
  const hudLevel = document.getElementById('hud-level');
  const hudGold = document.getElementById('hud-gold');
  const hudPop = document.getElementById('hud-pop');
  const hudXp = document.getElementById('hud-xp');
  const xpBarFill = document.getElementById('xp-bar-fill');
  const xpBarText = document.getElementById('xp-bar-text');
  const hpBarFill = document.getElementById('hp-bar-fill');
  const leaderboardList = document.getElementById('leaderboard-list');
  const minimapCanvas = document.getElementById('minimap');
  const levelUpNotification = document.getElementById('level-up-notification');
  const levelUpName = document.getElementById('level-up-name');
  const levelUpBonus = document.getElementById('level-up-bonus');

  // ─── Game State ──────────────────────────────────────────────
  let socket;
  let gameState = null;
  let myId = null;
  let running = false;
  let lastTime = 0;
  let lastLevel = 0;
  let wasAlive = true;
  let levelUpTimeout = null;

  // Input state
  const keys = {};
  let mouseX = 0, mouseY = 0;

  // Server config received on join
  let serverConfig = {};

  // ─── Level XP thresholds (synced with server) ────────────────
  const LEVEL_XP = [0, 100, 300, 600, 1000, 1800, 2800, 4200, 6500, 10000];

  // ─── Connect and Join ────────────────────────────────────────
  function connect() {
    socket = io();

    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('joined', (data) => {
      myId = data.id;
      serverConfig = data;
      Renderer.setDecorations(data.decorations || []);
      menuScreen.classList.add('hidden');
      gameHud.classList.remove('hidden');
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(gameLoop);
      Audio8Bit.init();
    });

    socket.on('state', (state) => {
      gameState = state;
    });

    socket.on('buildResult', (data) => {
      if (data.success) {
        Audio8Bit.build();
      } else {
        Audio8Bit.error();
        showToast(data.reason || 'Cannot build here');
      }
    });

    socket.on('unitResult', (data) => {
      if (data.success) {
        Audio8Bit.buyUnit();
        if (data.type === 'dragon') Audio8Bit.dragonRoar();
      } else {
        Audio8Bit.error();
        showToast(data.reason || 'Cannot recruit unit');
      }
    });

    // ─── Doom Phase Events ──────────────────────────────────────
    socket.on('doomCastleDestroyed', (data) => {
      showDoomToast('\u2620 DOOM CASTLE DESTROYED! \u2620', data.destroyerName + ' saved the realm!');
    });

    socket.on('gameWon', (data) => {
      showGameEndScreen(data.winnerId, data.winnerName);
    });

    socket.on('gameReset', () => {
      hideGameEndScreen();
      lastLevel = 0;
      lastGold = 0;
      showToast('New round starting!');
    });

    socket.on('disconnect', () => {
      running = false;
      menuScreen.classList.remove('hidden');
      gameHud.classList.add('hidden');
      deathScreen.classList.add('hidden');
      hideGameEndScreen();
      showToast('Disconnected from server');
    });
  }

  // ─── Join Game ───────────────────────────────────────────────
  function joinGame() {
    const name = nameInput.value.trim() || undefined;
    connect();
    // Wait for connection then join
    const waitForConnect = setInterval(() => {
      if (socket && socket.connected) {
        socket.emit('join', { name });
        clearInterval(waitForConnect);
      }
    }, 100);
  }

  // ─── Input Handling ──────────────────────────────────────────
  function setupInput() {
    window.addEventListener('keydown', (e) => {
      keys[e.key.toLowerCase()] = true;

      if (!running || !gameState) return;

      // Unit purchases
      switch (e.key) {
        case '1': socket.emit('buyUnit', { type: 'soldier' }); break;
        case '2': socket.emit('buyUnit', { type: 'horse' }); break;
        case '3': socket.emit('buyUnit', { type: 'wizard' }); break;
        case '4': socket.emit('buyUnit', { type: 'dragon' }); break;
        case '5':
          // Doom Castle (only available at level 9+)
          if (gameState.self && gameState.self.level >= 9) {
            socket.emit('build', { type: 'castle', x: gameState.self.x, y: gameState.self.y });
          } else if (gameState.self) {
            showToast('Must be Legend rank (Lv.9) to build Doom Castle!');
          }
          break;
        case 'q': case 'Q':
          if (gameState.self) {
            socket.emit('build', { type: 'house', x: gameState.self.x, y: gameState.self.y });
          }
          break;
        case 'e': case 'E':
          if (gameState.self) {
            socket.emit('build', { type: 'goldmine', x: gameState.self.x, y: gameState.self.y });
          }
          break;
        case 'm': case 'M':
          Audio8Bit.toggleMute();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.key.toLowerCase()] = false;
    });

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    // Click shop items
    document.querySelectorAll('.shop-item').forEach(item => {
      item.addEventListener('click', () => {
        if (!running || !gameState || !gameState.self) return;
        const action = item.dataset.action;
        const type = item.dataset.type;
        if (action === 'buyUnit') {
          socket.emit('buyUnit', { type });
        } else if (action === 'build') {
          socket.emit('build', { type, x: gameState.self.x, y: gameState.self.y });
        }
      });
    });
  }

  function getMovementInput() {
    let x = 0, y = 0;
    if (keys['w'] || keys['arrowup']) y -= 1;
    if (keys['s'] || keys['arrowdown']) y += 1;
    if (keys['a'] || keys['arrowleft']) x -= 1;
    if (keys['d'] || keys['arrowright']) x += 1;
    return { x, y };
  }

  // ─── UI Updates ──────────────────────────────────────────────
  function updateUI() {
    if (!gameState || !gameState.self) return;
    const self = gameState.self;

    // Player info
    hudName.textContent = self.name;
    hudLevel.textContent = 'Lv.' + self.level + ' ' + self.levelName;

    // Resources
    hudGold.textContent = Math.floor(self.gold);
    hudPop.textContent = self.currentPop + '/' + self.maxPop;
    hudXp.textContent = self.xp;

    // XP bar
    const currentLevelXp = LEVEL_XP[self.level] || 0;
    const nextLevelXp = LEVEL_XP[self.level + 1] || LEVEL_XP[LEVEL_XP.length - 1];
    const xpProgress = self.level >= 9 ? 1 : (self.xp - currentLevelXp) / (nextLevelXp - currentLevelXp);
    xpBarFill.style.width = (xpProgress * 100) + '%';
    xpBarText.textContent = self.level >= 9 ? 'MAX LEVEL' : `${self.xp - currentLevelXp} / ${nextLevelXp - currentLevelXp} XP`;

    // HP bar
    const hpPct = self.hp / self.maxHp;
    hpBarFill.style.width = (hpPct * 100) + '%';
    if (hpPct < 0.3) hpBarFill.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
    else if (hpPct < 0.6) hpBarFill.style.background = 'linear-gradient(90deg, #f39c12, #e67e22)';
    else hpBarFill.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';

    // Level up detection
    if (self.level > lastLevel && lastLevel > 0) {
      onLevelUp(self.level, self.levelName);
    }
    lastLevel = self.level;

    // Death detection
    if (!self.alive && wasAlive) {
      onDeath(self.score);
    }
    if (self.alive && !wasAlive) {
      onRespawn();
    }
    wasAlive = self.alive;

    // Update shop affordability
    updateShopAffordability(self.gold, self.currentPop, self.maxPop, self.level);

    // Show/hide castle button based on level
    const castleItem = document.getElementById('castle-shop-item');
    if (castleItem) {
      castleItem.style.display = self.level >= 9 ? 'flex' : 'none';
    }

    // Leaderboard
    updateLeaderboard(gameState.leaderboard || []);

    // Minimap
    if (gameState.minimap) {
      Renderer.drawMinimap(minimapCanvas, gameState.minimap, self.x, self.y, gameState.mapSize);
    }
  }

  function updateShopAffordability(gold, pop, maxPop, level) {
    const costs = {
      soldier: { gold: 10, pop: 1 },
      horse: { gold: 30, pop: 2 },
      wizard: { gold: 50, pop: 2 },
      dragon: { gold: 100, pop: 5 },
      house: { gold: 50, pop: 0 },
      goldmine: { gold: 100, pop: 0 },
      castle: { gold: 5000, pop: 0, levelReq: 9 }
    };

    document.querySelectorAll('.shop-item').forEach(item => {
      const type = item.dataset.type;
      const cost = costs[type];
      if (!cost) return;

      const meetsLevel = !cost.levelReq || (level || 0) >= cost.levelReq;
      const canAfford = gold >= cost.gold && (cost.pop === 0 || pop + cost.pop <= maxPop) && meetsLevel;
      item.classList.toggle('cant-afford', !canAfford);
    });
  }

  function updateLeaderboard(lb) {
    leaderboardList.innerHTML = '';
    lb.forEach((entry, i) => {
      const div = document.createElement('div');
      div.className = 'lb-entry' + (entry.id === myId ? ' self' : '');
      div.innerHTML = `
        <span class="lb-rank">${i + 1}.</span>
        <span class="lb-color" style="background:${entry.color}"></span>
        <span class="lb-name">${escapeHtml(entry.name)}</span>
        <span class="lb-score">${entry.score}</span>
      `;
      leaderboardList.appendChild(div);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Game Events ─────────────────────────────────────────────
  function onLevelUp(level, name) {
    Audio8Bit.levelUp();
    levelUpName.textContent = name;

    const descs = [
      '', 'Battle Cry: +8% troop damage!',
      'Swift Boots: +10% troop speed!',
      'Fortify: +15% building HP!',
      'War Drums: +12% damage aura!',
      'Gold Rush: +25% gold income!',
      "Dragon's Might: +18% dragon power!",
      'Iron Will: +12% troop HP!',
      'Regeneration: troops heal over time!',
      'LEGENDARY: Doom Castle unlocked!'
    ];
    levelUpBonus.textContent = descs[level] || '';

    levelUpNotification.classList.remove('hidden');
    if (levelUpTimeout) clearTimeout(levelUpTimeout);
    levelUpTimeout = setTimeout(() => {
      levelUpNotification.classList.add('hidden');
    }, 3500);
  }

  function onDeath(score) {
    Audio8Bit.death();
    deathScore.textContent = 'Score: ' + score;
    deathScreen.classList.remove('hidden');
  }

  function onRespawn() {
    Audio8Bit.respawn();
    deathScreen.classList.add('hidden');
  }

  // ─── Toast Notifications ────────────────────────────────────
  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  // ─── Doom Phase UI ─────────────────────────────────────────
  function showDoomToast(title, subtitle) {
    const toast = document.createElement('div');
    toast.className = 'doom-toast';
    toast.innerHTML = `<div class="doom-toast-title">${title}</div><div class="doom-toast-sub">${subtitle}</div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  function showGameEndScreen(winnerId, winnerName) {
    let overlay = document.getElementById('game-end-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'game-end-overlay';
      document.body.appendChild(overlay);
    }
    const isWinner = winnerId === myId;
    overlay.innerHTML = `
      <div class="game-end-content ${isWinner ? 'victory' : 'defeat'}">
        <h1>${isWinner ? '\u2655 VICTORY \u2655' : '\u2620 DEFEAT \u2620'}</h1>
        <p class="game-end-text">${isWinner ? 'Your Doom Castle stood the test of time!' : winnerName + "'s Doom Castle survived! The realm has fallen."}</p>
        <p class="game-end-sub">Game resetting in 10 seconds...</p>
      </div>
    `;
    overlay.style.display = 'flex';
  }

  function hideGameEndScreen() {
    const overlay = document.getElementById('game-end-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  // ─── Gold Collection Detection ──────────────────────────────
  let lastCoinCount = 0;
  let lastGold = 0;

  function detectGoldCollection() {
    if (!gameState || !gameState.self) return;

    // Detect gold increase (rough approximation for coin collect sound)
    const currentGold = gameState.self.gold;
    if (currentGold > lastGold + 2) {
      Audio8Bit.coinCollect();
      Renderer.spawnGoldParticles(gameState.self.x, gameState.self.y);
    }
    lastGold = currentGold;
  }

  // ─── Combat Detection (for sound/screen shake) ─────────────
  let lastDmgNumCount = 0;

  function detectCombat() {
    if (!gameState || !gameState.damageNumbers) return;

    const currentCount = gameState.damageNumbers.length;
    if (currentCount > lastDmgNumCount) {
      // New damage happened nearby
      const newDmg = gameState.damageNumbers.slice(lastDmgNumCount);
      for (const d of newDmg) {
        Renderer.shake(2);
        // Check if it's wizard magic
        if (gameState.projectiles && gameState.projectiles.length > 0) {
          Audio8Bit.magicCast();
        } else {
          Audio8Bit.swordHit();
        }
      }
    }
    lastDmgNumCount = currentCount;
  }

  // ─── Game Loop ───────────────────────────────────────────────
  function gameLoop(timestamp) {
    if (!running) return;

    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    // Send input
    const input = getMovementInput();
    if (socket && socket.connected) {
      socket.emit('input', input);
    }

    // Render
    if (gameState) {
      Renderer.render(gameState, dt);
      updateUI();
      detectGoldCollection();
      detectCombat();
    }

    requestAnimationFrame(gameLoop);
  }

  // ─── Initialization ─────────────────────────────────────────
  function init() {
    Renderer.init(canvas);
    setupInput();

    playBtn.addEventListener('click', joinGame);
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') joinGame();
    });

    // Focus name input
    nameInput.focus();

    // Draw animated background on menu
    drawMenuBackground();
  }

  // ─── Animated Menu Background ───────────────────────────────
  function drawMenuBackground() {
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    bgCanvas.style.position = 'fixed';
    bgCanvas.style.top = '0';
    bgCanvas.style.left = '0';
    bgCanvas.style.zIndex = '999';
    bgCanvas.style.pointerEvents = 'none';
    menuScreen.style.position = 'relative';
    menuScreen.insertBefore(bgCanvas, menuScreen.firstChild);

    const bgCtx = bgCanvas.getContext('2d');
    const stars = [];
    for (let i = 0; i < 50; i++) {
      stars.push({
        x: Math.random() * bgCanvas.width,
        y: Math.random() * bgCanvas.height,
        size: Math.random() * 3 + 1,
        speed: Math.random() * 0.5 + 0.1,
        alpha: Math.random()
      });
    }

    function animateBg() {
      if (!menuScreen.classList.contains('hidden')) {
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        for (const star of stars) {
          star.alpha = 0.3 + Math.sin(Date.now() / 1000 * star.speed) * 0.4;
          bgCtx.fillStyle = `rgba(241, 196, 15, ${star.alpha})`;
          bgCtx.fillRect(star.x, star.y, star.size, star.size);
        }
        requestAnimationFrame(animateBg);
      }
    }
    animateBg();
  }

  // Start
  init();
})();
