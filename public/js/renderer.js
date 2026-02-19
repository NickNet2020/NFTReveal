// ═══════════════════════════════════════════════════════════════════
//  RENDERER.JS - Canvas Rendering Engine
//  Handles camera, terrain, entity rendering, particles, and effects
// ═══════════════════════════════════════════════════════════════════

const Renderer = (() => {
  let canvas, ctx;
  let width, height;

  // Camera
  let camX = 0, camY = 0;
  let camTargetX = 0, camTargetY = 0;
  let screenShake = 0;

  // Particles
  const particles = [];

  // Pre-rendered sprites cache
  const spriteCache = {};

  // Decorations from server
  let decorations = [];

  // Time tracking
  let time = 0;

  // ─── Initialize ──────────────────────────────────────────────
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = false;
  }

  function setDecorations(decs) {
    decorations = decs;
  }

  // ─── Camera ──────────────────────────────────────────────────
  function updateCamera(targetX, targetY, dt) {
    camTargetX = targetX - width / 2;
    camTargetY = targetY - height / 2;
    camX += (camTargetX - camX) * 0.08;
    camY += (camTargetY - camY) * 0.08;

    // Screen shake
    if (screenShake > 0) {
      screenShake *= 0.9;
      if (screenShake < 0.5) screenShake = 0;
    }
  }

  function shake(amount) {
    screenShake = Math.min(screenShake + amount, 12);
  }

  function worldToScreen(wx, wy) {
    const shakeX = screenShake > 0 ? (Math.random() - 0.5) * screenShake : 0;
    const shakeY = screenShake > 0 ? (Math.random() - 0.5) * screenShake : 0;
    return {
      x: wx - camX + shakeX,
      y: wy - camY + shakeY
    };
  }

  function isOnScreen(wx, wy, margin = 100) {
    const sx = wx - camX;
    const sy = wy - camY;
    return sx > -margin && sx < width + margin && sy > -margin && sy < height + margin;
  }

  // ─── Sprite Rendering ───────────────────────────────────────
  function getSprite(name, data, palette, teamColor, scale) {
    const key = name + '_' + teamColor + '_' + scale;
    if (spriteCache[key]) return spriteCache[key];
    const modPalette = { ...palette, 'T': teamColor || '#e74c3c' };
    const sprite = Sprites.renderSprite(data, modPalette, scale);
    spriteCache[key] = sprite;
    return sprite;
  }

  // ─── Draw Terrain ────────────────────────────────────────────
  function drawTerrain(mapSize) {
    // Background
    ctx.fillStyle = '#3a7d44';
    ctx.fillRect(0, 0, width, height);

    // Grid pattern for grass
    const gridSize = 64;
    const startX = Math.floor(camX / gridSize) * gridSize;
    const startY = Math.floor(camY / gridSize) * gridSize;

    ctx.strokeStyle = 'rgba(46, 125, 50, 0.3)';
    ctx.lineWidth = 1;

    for (let x = startX; x < camX + width + gridSize; x += gridSize) {
      const sx = x - camX;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
      ctx.stroke();
    }
    for (let y = startY; y < camY + height + gridSize; y += gridSize) {
      const sy = y - camY;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();
    }

    // Grass detail dots
    const detailSize = 128;
    const dStartX = Math.floor(camX / detailSize) * detailSize;
    const dStartY = Math.floor(camY / detailSize) * detailSize;

    for (let x = dStartX; x < camX + width + detailSize; x += detailSize) {
      for (let y = dStartY; y < camY + height + detailSize; y += detailSize) {
        // Deterministic "random" based on position
        const hash = ((x * 73856093) ^ (y * 19349663)) & 0xFFFF;
        if (hash % 3 === 0) {
          const sx = x - camX + (hash % 40);
          const sy = y - camY + ((hash >> 4) % 40);
          ctx.fillStyle = hash % 5 === 0 ? '#4a9d54' : '#2d6d34';
          ctx.fillRect(sx, sy, 3, 3);
          if (hash % 7 === 0) {
            ctx.fillRect(sx + 6, sy + 3, 2, 2);
          }
        }
      }
    }

    // Map borders
    const border = worldToScreen(0, 0);
    const borderEnd = worldToScreen(mapSize, mapSize);
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 4;
    ctx.strokeRect(border.x, border.y, borderEnd.x - border.x, borderEnd.y - border.y);

    // Dark outside border
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    if (border.x > 0) ctx.fillRect(0, 0, border.x, height);
    if (borderEnd.x < width) ctx.fillRect(borderEnd.x, 0, width - borderEnd.x, height);
    if (border.y > 0) ctx.fillRect(0, 0, width, border.y);
    if (borderEnd.y < height) ctx.fillRect(0, borderEnd.y, width, height - borderEnd.y);
  }

  // ─── Draw Decorations ───────────────────────────────────────
  function drawDecorations() {
    for (const dec of decorations) {
      if (!isOnScreen(dec.x, dec.y, 80)) continue;
      const pos = worldToScreen(dec.x, dec.y);

      if (dec.type === 'tree') {
        const variant = dec.variant % Sprites.TREE_VARIANTS.length;
        const sprite = getSprite('tree' + variant, Sprites.TREE_VARIANTS[variant], Sprites.TREE_PALETTE, null, 3);
        ctx.drawImage(sprite, pos.x - sprite.width / 2, pos.y - sprite.height + 10);
      } else if (dec.type === 'rock') {
        const variant = dec.variant % Sprites.ROCK_VARIANTS.length;
        const sprite = getSprite('rock' + variant, Sprites.ROCK_VARIANTS[variant], Sprites.ROCK_PALETTE, null, 3);
        ctx.drawImage(sprite, pos.x - sprite.width / 2, pos.y - sprite.height / 2);
      }
    }
  }

  // ─── Draw Gold Coins ────────────────────────────────────────
  function drawGoldCoins(coins) {
    const frameIdx = Math.floor(time * 3) % Sprites.COIN_FRAMES.length;

    for (const coin of coins) {
      if (!isOnScreen(coin.x, coin.y)) continue;
      const pos = worldToScreen(coin.x, coin.y);

      // Coin glow
      const glowAlpha = 0.15 + Math.sin(time * 4 + coin.id) * 0.08;
      ctx.fillStyle = `rgba(241, 196, 15, ${glowAlpha})`;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 16, 0, Math.PI * 2);
      ctx.fill();

      // Coin sprite
      const sprite = getSprite('coin' + frameIdx, Sprites.COIN_FRAMES[frameIdx], Sprites.COIN_PALETTE, null, 3);
      ctx.drawImage(sprite, pos.x - sprite.width / 2, pos.y - sprite.height / 2);

      // Sparkle effect
      if (Math.sin(time * 5 + coin.id * 7) > 0.8) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(pos.x - 8 + Math.sin(time * 3) * 4, pos.y - 10, 2, 2);
      }
    }
  }

  // ─── Draw Buildings ─────────────────────────────────────────
  function drawBuildings(buildingsList, myId) {
    // Sort by Y for proper overlap
    const sorted = [...buildingsList].sort((a, b) => a.y - b.y);

    for (const b of sorted) {
      if (!isOnScreen(b.x, b.y, 60)) continue;
      const pos = worldToScreen(b.x, b.y);
      const isMine = b.ownerId === myId;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y + 20, 28, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      if (b.type === 'house') {
        const sprite = getSprite('house', Sprites.HOUSE_DATA, Sprites.HOUSE_PALETTE, null, 3);
        ctx.drawImage(sprite, pos.x - sprite.width / 2, pos.y - sprite.height + 20);
      } else if (b.type === 'goldmine') {
        const sprite = getSprite('goldmine', Sprites.GOLDMINE_DATA, Sprites.GOLDMINE_PALETTE, null, 3);
        ctx.drawImage(sprite, pos.x - sprite.width / 2, pos.y - sprite.height + 15);

        // Gold sparkle animation
        if (Math.sin(time * 3 + b.id) > 0.5) {
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(pos.x - 5 + Math.sin(time * 4) * 8, pos.y - 12, 3, 3);
          ctx.fillRect(pos.x + 3 + Math.cos(time * 5) * 6, pos.y - 8, 2, 2);
        }
      }

      // Health bar
      drawHealthBar(pos.x, pos.y - 48, 40, b.hp, b.maxHp, isMine);

      // Owner indicator
      if (isMine) {
        ctx.fillStyle = 'rgba(46, 204, 113, 0.15)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 30, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ─── Draw Units ─────────────────────────────────────────────
  function drawUnits(unitsList, playerMap, myId) {
    const sorted = [...unitsList].sort((a, b) => a.y - b.y);

    for (const u of sorted) {
      if (!isOnScreen(u.x, u.y)) continue;
      const pos = worldToScreen(u.x, u.y);
      const owner = playerMap[u.ownerId];
      const teamColor = owner ? owner.color : '#888';
      const isMine = u.ownerId === myId;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      const shadowSize = u.type === 'dragon' ? 20 : u.type === 'horse' ? 14 : 10;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y + 6, shadowSize, shadowSize / 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Unit sprite
      let sprite;
      const scale = 2;
      switch (u.type) {
        case 'soldier':
          sprite = getSprite('soldier', Sprites.SOLDIER_DATA, Sprites.SOLDIER_PALETTE, teamColor, scale);
          ctx.drawImage(sprite, pos.x - sprite.width / 2, pos.y - sprite.height + 6);
          break;
        case 'horse':
          sprite = getSprite('horse', Sprites.HORSE_DATA, Sprites.HORSE_PALETTE, teamColor, scale);
          ctx.drawImage(sprite, pos.x - sprite.width / 2, pos.y - sprite.height + 6);
          break;
        case 'wizard':
          sprite = getSprite('wizard', Sprites.WIZARD_DATA, Sprites.WIZARD_PALETTE, teamColor, scale);
          ctx.drawImage(sprite, pos.x - sprite.width / 2, pos.y - sprite.height + 6);
          // Magic particles
          if (u.state === 'attack') {
            spawnParticle(pos.x + (Math.random() - 0.5) * 20, pos.y - 10, '#9b59b6', 0.5, 3);
          }
          break;
        case 'dragon':
          sprite = getSprite('dragon', Sprites.DRAGON_DATA, Sprites.DRAGON_PALETTE, teamColor, 3);
          // Hover effect
          const hover = Math.sin(time * 3 + u.id) * 4;
          ctx.drawImage(sprite, pos.x - sprite.width / 2, pos.y - sprite.height + 6 + hover);
          // Fire particles when attacking
          if (u.state === 'attack') {
            for (let i = 0; i < 2; i++) {
              spawnParticle(
                pos.x + (Math.random() - 0.5) * 15,
                pos.y - 15 + hover,
                Math.random() > 0.5 ? '#ff4400' : '#ff8800',
                0.6, 4
              );
            }
          }
          break;
      }

      // Health bar
      const barY = u.type === 'dragon' ? pos.y - 55 : pos.y - 35;
      const barW = u.type === 'dragon' ? 40 : 24;
      drawHealthBar(pos.x, barY, barW, u.hp, u.maxHp, isMine);

      // Attack indicator
      if (u.state === 'attack') {
        const attackPulse = Math.sin(time * 8) * 0.3 + 0.3;
        ctx.strokeStyle = `rgba(255, 0, 0, ${attackPulse})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y - 10, 18, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // ─── Draw Players ───────────────────────────────────────────
  function drawPlayers(playersList, myId, myLevel) {
    const sorted = [...playersList].sort((a, b) => a.y - b.y);

    for (const p of sorted) {
      if (!p.alive) continue;
      if (!isOnScreen(p.x, p.y)) continue;
      const pos = worldToScreen(p.x, p.y);
      const isMe = p.id === myId;

      // Aura for leveled players
      if (p.level >= 1) {
        drawAura(pos.x, pos.y - 10, p.level, p.color);
      }

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y + 8, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Player sprite
      const scale = 3;
      let sprite;
      if (p.level >= 4) {
        sprite = getSprite('playerCrown', Sprites.PLAYER_CROWN_DATA, Sprites.PLAYER_CROWN_PALETTE, p.color, scale);
      } else {
        sprite = getSprite('player', Sprites.PLAYER_DATA, Sprites.PLAYER_PALETTE, p.color, scale);
      }
      ctx.drawImage(sprite, pos.x - sprite.width / 2, pos.y - sprite.height + 8);

      // Selection ring for self
      if (isMe) {
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + 6, 20, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Name tag
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      const nameY = p.level >= 4 ? pos.y - 70 : pos.y - 58;

      // Name background
      const nameWidth = ctx.measureText(p.name).width + 10;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(pos.x - nameWidth / 2, nameY - 8, nameWidth, 14);

      // Name text
      ctx.fillStyle = isMe ? '#f1c40f' : '#fff';
      ctx.fillText(p.name, pos.x, nameY + 3);

      // Level badge
      if (p.level > 0) {
        ctx.font = '7px "Press Start 2P", monospace';
        const lvlText = 'Lv' + p.level;
        ctx.fillStyle = '#2ecc71';
        ctx.fillText(lvlText, pos.x, nameY + 14);
      }

      // Health bar
      drawHealthBar(pos.x, nameY + 18, 36, p.hp, p.maxHp, isMe);
    }
  }

  // ─── Draw Aura Effect ───────────────────────────────────────
  function drawAura(x, y, level, color) {
    const radius = 30 + level * 5;
    const alpha = 0.08 + Math.sin(time * 2) * 0.04;
    const rings = Math.min(level, 5);

    for (let i = 0; i < rings; i++) {
      const r = radius - i * 6;
      const a = alpha - i * 0.015;
      if (a <= 0) continue;

      ctx.strokeStyle = color;
      ctx.globalAlpha = a;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + Math.sin(time * 3 + i) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Floating particles for high levels
    if (level >= 3) {
      const particleCount = Math.min(level, 8);
      for (let i = 0; i < particleCount; i++) {
        const angle = (time * 1.5 + (i / particleCount) * Math.PI * 2) % (Math.PI * 2);
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * (radius * 0.4);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.4 + Math.sin(time * 4 + i) * 0.2;
        ctx.fillRect(px - 2, py - 2, 4, 4);
      }
    }

    // Special aura for level 9+
    if (level >= 9) {
      ctx.globalAlpha = 0.05 + Math.sin(time * 1.5) * 0.03;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius + 20);
      gradient.addColorStop(0, '#f1c40f');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius + 20, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  // ─── Draw Health Bar ────────────────────────────────────────
  function drawHealthBar(x, y, w, hp, maxHp, isFriendly) {
    const pct = Math.max(0, hp / maxHp);
    const halfW = w / 2;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - halfW - 1, y - 1, w + 2, 6);

    // Bar
    let barColor;
    if (pct > 0.6) barColor = isFriendly ? '#2ecc71' : '#e74c3c';
    else if (pct > 0.3) barColor = '#f39c12';
    else barColor = '#e74c3c';

    ctx.fillStyle = barColor;
    ctx.fillRect(x - halfW, y, w * pct, 4);

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - halfW - 1, y - 1, w + 2, 6);
  }

  // ─── Draw Projectiles ───────────────────────────────────────
  function drawProjectiles(projectilesList) {
    const now = Date.now();
    for (const p of projectilesList) {
      const elapsed = (now - p.time) / 500; // 0 to 1
      if (elapsed > 1) continue;

      const px = p.x + (p.tx - p.x) * elapsed;
      const py = p.y + (p.ty - p.y) * elapsed - Math.sin(elapsed * Math.PI) * 20;

      if (!isOnScreen(px, py)) continue;
      const pos = worldToScreen(px, py);

      // Magic orb
      const sprite = getSprite('magic', Sprites.MAGIC_DATA, Sprites.MAGIC_PALETTE, null, 2);
      ctx.drawImage(sprite, pos.x - sprite.width / 2, pos.y - sprite.height / 2);

      // Trail
      ctx.fillStyle = `rgba(155, 89, 182, ${0.3 * (1 - elapsed)})`;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ─── Draw Damage Numbers ────────────────────────────────────
  function drawDamageNumbers(dmgNums) {
    const now = Date.now();
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';

    for (const d of dmgNums) {
      const elapsed = (now - d.time) / 1200;
      if (elapsed > 1) continue;

      const pos = worldToScreen(d.x, d.y - elapsed * 40);
      if (!isOnScreen(d.x, d.y)) continue;

      ctx.globalAlpha = 1 - elapsed;
      ctx.fillStyle = '#fff';
      ctx.fillText('-' + d.value, pos.x + 1, pos.y + 1);
      ctx.fillStyle = '#e74c3c';
      ctx.fillText('-' + d.value, pos.x, pos.y);
      ctx.globalAlpha = 1;
    }
  }

  // ─── Particles System ──────────────────────────────────────
  function spawnParticle(x, y, color, life, size) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 60,
      vy: -Math.random() * 40 - 20,
      color, life, maxLife: life,
      size: size || 3
    });
  }

  function spawnGoldParticles(wx, wy) {
    const pos = worldToScreen(wx, wy);
    for (let i = 0; i < 6; i++) {
      spawnParticle(pos.x, pos.y, i % 2 === 0 ? '#f1c40f' : '#ffe066', 0.6, 3);
    }
  }

  function updateAndDrawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt; // gravity
      p.life -= dt;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // ─── Draw Minimap ───────────────────────────────────────────
  function drawMinimap(minimapCanvas, minimapData, selfX, selfY, mapSize) {
    const mCtx = minimapCanvas.getContext('2d');
    const mW = minimapCanvas.width;
    const mH = minimapCanvas.height;

    // Background
    mCtx.fillStyle = '#1a3d1a';
    mCtx.fillRect(0, 0, mW, mH);

    // Grid
    mCtx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 5; i++) {
      const p = (i / 4) * mW;
      mCtx.beginPath();
      mCtx.moveTo(p, 0);
      mCtx.lineTo(p, mH);
      mCtx.stroke();
      mCtx.beginPath();
      mCtx.moveTo(0, p);
      mCtx.lineTo(mW, p);
      mCtx.stroke();
    }

    // Entities
    for (const entity of minimapData) {
      const mx = (entity.x / mapSize) * mW;
      const my = (entity.y / mapSize) * mH;

      if (entity.type === 'building') {
        mCtx.fillStyle = entity.color;
        mCtx.fillRect(mx - 1, my - 1, 3, 3);
      } else {
        mCtx.fillStyle = entity.color;
        mCtx.fillRect(mx - 2, my - 2, 4, 4);
      }
    }

    // Self (blinking)
    if (Math.floor(time * 3) % 2 === 0) {
      const sx = (selfX / mapSize) * mW;
      const sy = (selfY / mapSize) * mH;
      mCtx.fillStyle = '#fff';
      mCtx.fillRect(sx - 3, sy - 3, 6, 6);
      mCtx.strokeStyle = '#f1c40f';
      mCtx.lineWidth = 1;
      mCtx.strokeRect(sx - 3, sy - 3, 6, 6);
    }

    // Viewport rectangle
    const vx = (camX / mapSize) * mW;
    const vy = (camY / mapSize) * mH;
    const vw = (width / mapSize) * mW;
    const vh = (height / mapSize) * mH;
    mCtx.strokeStyle = 'rgba(255,255,255,0.4)';
    mCtx.lineWidth = 1;
    mCtx.strokeRect(vx, vy, vw, vh);

    // Border
    mCtx.strokeStyle = 'rgba(241, 196, 15, 0.5)';
    mCtx.lineWidth = 2;
    mCtx.strokeRect(0, 0, mW, mH);
  }

  // ─── Main Render ────────────────────────────────────────────
  function render(state, dt) {
    if (!state || !state.self) return;
    time += dt;

    const self = state.self;
    updateCamera(self.x, self.y, dt);

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Terrain
    drawTerrain(state.mapSize);

    // Decorations (behind entities)
    drawDecorations();

    // Gold coins
    drawGoldCoins(state.goldCoins || []);

    // Buildings
    const playerMap = {};
    for (const p of state.players || []) {
      playerMap[p.id] = p;
    }
    drawBuildings(state.buildings || [], self.id);

    // Units
    drawUnits(state.units || [], playerMap, self.id);

    // Players
    drawPlayers(state.players || [], self.id, self.level);

    // Projectiles
    drawProjectiles(state.projectiles || []);

    // Damage numbers
    drawDamageNumbers(state.damageNumbers || []);

    // Particles
    updateAndDrawParticles(dt);

    // Vignette effect
    drawVignette();
  }

  function drawVignette() {
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, height * 0.3,
      width / 2, height / 2, height * 0.8
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  return {
    init, render, setDecorations,
    shake, spawnGoldParticles, spawnParticle,
    worldToScreen, isOnScreen
  };
})();
