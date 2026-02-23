// ═══════════════════════════════════════════════════════════════════════
// Castle Fight - Canvas Renderer
// Hyper-realistic Game of Thrones aesthetic with detailed terrain,
// castles, buildings, units, effects, and atmospheric rendering
// ═══════════════════════════════════════════════════════════════════════

const Renderer = (() => {
  let canvas, ctx;
  let screenW, screenH;
  let camera = { x: 0, y: 0, zoom: 1, screenW: 0, screenH: 0 };
  let terrainCanvas, terrainCtx;
  let terrainDirty = true;
  let decorations = [];
  let time = 0;
  let mySide = 'left';
  let selectedUnitId = null;

  // Color palettes per character
  const CHAR_PALETTES = {
    northern_lord: { primary: '#4a6fa5', secondary: '#8fb8de', dark: '#2a3f65', banner: '#c0d8ef' },
    dragon_empress: { primary: '#c0392b', secondary: '#e74c3c', dark: '#7b241c', banner: '#f5a6a0' },
    iron_admiral:   { primary: '#1a8a7a', secondary: '#2ecc71', dark: '#0e524a', banner: '#7ddfb8' },
    golden_lord:    { primary: '#d4a017', secondary: '#f1c40f', dark: '#7d6010', banner: '#fae68c' },
    shadow_priest:  { primary: '#8e44ad', secondary: '#bb6bd9', dark: '#5b2c6f', banner: '#d4a5e8' },
    forest_warden:  { primary: '#27ae60', secondary: '#58d68d', dark: '#1a7a42', banner: '#a3e4be' },
    orc_warchief:   { primary: '#5a7a2e', secondary: '#8fbc3b', dark: '#344a1a', banner: '#b5d76e' }
  };

  // Unit type visual configs
  const UNIT_VISUALS = {
    infantry: { size: 10, shape: 'soldier', yOff: 0 },
    ranged:   { size: 9,  shape: 'archer', yOff: 0 },
    cavalry:  { size: 14, shape: 'horse', yOff: -2 },
    siege:    { size: 18, shape: 'siege', yOff: 0 },
    flying:   { size: 12, shape: 'flying', yOff: -20 }
  };

  // ─── Initialize ─────────────────────────────────────────────────
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    // Pre-render terrain
    terrainCanvas = document.createElement('canvas');
    terrainCtx = terrainCanvas.getContext('2d');
    terrainDirty = true;
  }

  function resize() {
    screenW = window.innerWidth;
    screenH = window.innerHeight;
    canvas.width = screenW;
    canvas.height = screenH;
    camera.screenW = screenW;
    camera.screenH = screenH;
    terrainDirty = true;
  }

  function setDecorations(decs) { decorations = decs || []; terrainDirty = true; }
  function setSide(side) { mySide = side; }
  function setSelectedUnit(id) { selectedUnitId = id; }

  // ─── Camera helpers ─────────────────────────────────────────────
  function worldToScreen(wx, wy) {
    return {
      x: (wx - camera.x) * camera.zoom + screenW / 2,
      y: (wy - camera.y) * camera.zoom + screenH / 2
    };
  }

  function screenToWorld(sx, sy) {
    return {
      x: (sx - screenW / 2) / camera.zoom + camera.x,
      y: (sy - screenH / 2) / camera.zoom + camera.y
    };
  }

  function isVisible(wx, wy, margin) {
    margin = margin || 80;
    const s = worldToScreen(wx, wy);
    return s.x > -margin && s.x < screenW + margin && s.y > -margin && s.y < screenH + margin;
  }

  // ─── Pre-render terrain ─────────────────────────────────────────
  function renderTerrain(mapW, mapH) {
    const scale = 0.25;
    const tw = Math.ceil(mapW * scale);
    const th = Math.ceil(mapH * scale);
    terrainCanvas.width = tw;
    terrainCanvas.height = th;
    const tc = terrainCtx;
    const GC = GAME_CONSTANTS;

    // ─── Base ground - dark earth/grass (middle area) ────────────
    const groundGrad = tc.createLinearGradient(0, 0, 0, th);
    groundGrad.addColorStop(0, '#2a3a1e');
    groundGrad.addColorStop(0.3, '#334422');
    groundGrad.addColorStop(0.5, '#2e3d20');
    groundGrad.addColorStop(0.7, '#334422');
    groundGrad.addColorStop(1, '#2a3a1e');
    tc.fillStyle = groundGrad;
    tc.fillRect(0, 0, tw, th);

    // Ground noise
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * tw;
      const y = Math.random() * th;
      const brightness = Math.random() * 20 - 10;
      tc.fillStyle = `rgb(${46 + brightness},${60 + brightness + Math.random() * 10},${30 + brightness})`;
      tc.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }

    // ─── Lane paths (cobblestone roads through the middle) ───────
    const laneTopY = GC.LANE_TOP_Y * scale;
    const laneBotY = GC.LANE_BOT_Y * scale;
    const laneW = GC.LANE_WIDTH * scale;
    const p1MaxX = GC.P1_BASE_MAX_X * scale;
    const p2MinX = GC.P2_BASE_MIN_X * scale;

    function drawBrickArea(x, y, w, h) {
      tc.fillStyle = '#4a4035';
      tc.fillRect(x, y, w, h);
      for (let bx = x; bx < x + w; bx += 6) {
        for (let by = y; by < y + h; by += 4) {
          const row = Math.floor((by - y) / 4);
          const offset = (row % 2) * 3;
          const brightness = Math.random() * 15 - 5;
          tc.fillStyle = `rgb(${74 + brightness},${64 + brightness},${53 + brightness})`;
          tc.fillRect(bx + offset, by, 5, 3);
          tc.strokeStyle = 'rgba(0,0,0,0.15)';
          tc.lineWidth = 0.3;
          tc.strokeRect(bx + offset, by, 5, 3);
        }
      }
    }

    function drawLane(cy) {
      drawBrickArea(p1MaxX, cy - laneW / 2, p2MinX - p1MaxX, laneW);
      // Road edges
      tc.fillStyle = '#3a3028';
      tc.fillRect(p1MaxX, cy - laneW / 2, p2MinX - p1MaxX, 2);
      tc.fillRect(p1MaxX, cy + laneW / 2 - 2, p2MinX - p1MaxX, 2);
    }

    drawLane(laneTopY);
    drawLane(laneBotY);

    // ─── Elevated home territory platforms (brick) ───────────────
    const baseMinY = GC.BASE_MIN_Y * scale;
    const baseMaxY = GC.BASE_MAX_Y * scale;
    const p1MinX = GC.P1_BASE_MIN_X * scale;
    const p2MaxX = GC.P2_BASE_MAX_X * scale;

    // Left base platform
    drawBrickArea(p1MinX, baseMinY, p1MaxX - p1MinX, baseMaxY - baseMinY);
    // Right base platform
    drawBrickArea(p2MinX, baseMinY, p2MaxX - p2MinX, baseMaxY - baseMinY);

    // ─── Elevation drop shadows (south and east edges) ───────────
    tc.fillStyle = 'rgba(0,0,0,0.4)';
    // Left base south shadow
    tc.fillRect(p1MinX, baseMaxY, p1MaxX - p1MinX, 4);
    // Left base east shadow (cliff face)
    tc.fillRect(p1MaxX, baseMinY, 4, baseMaxY - baseMinY);
    // Right base south shadow
    tc.fillRect(p2MinX, baseMaxY, p2MaxX - p2MinX, 4);
    // Right base west shadow (cliff face)
    tc.fillRect(p2MinX - 4, baseMinY, 4, baseMaxY - baseMinY);

    // ─── Cliff edges (non-lane borders of the platforms) ─────────
    const stairW = laneW + 6;
    tc.fillStyle = '#3a3530';
    tc.strokeStyle = '#2a2520';
    tc.lineWidth = 1;

    // Left base east cliff face (with gaps for stairs)
    function drawCliffEdge(edgeX, minY, maxY, laneYs, isRight) {
      const segments = [];
      let lastY = minY;
      for (const ly of laneYs) {
        const stairTop = ly - stairW / 2;
        const stairBot = ly + stairW / 2;
        if (stairTop > lastY) segments.push({ y1: lastY, y2: stairTop });
        lastY = stairBot;
      }
      if (lastY < maxY) segments.push({ y1: lastY, y2: maxY });

      for (const seg of segments) {
        const cx = isRight ? edgeX - 6 : edgeX;
        const cw = 6;
        // Cliff face
        tc.fillStyle = '#4a4540';
        tc.fillRect(cx, seg.y1, cw, seg.y2 - seg.y1);
        // Dark line
        tc.fillStyle = '#2a2520';
        tc.fillRect(isRight ? edgeX - 1 : edgeX, seg.y1, 1, seg.y2 - seg.y1);
        // Stone pattern on cliff
        for (let cy = seg.y1; cy < seg.y2; cy += 5) {
          const brightness = Math.random() * 10 - 5;
          tc.fillStyle = `rgb(${60 + brightness},${55 + brightness},${48 + brightness})`;
          tc.fillRect(cx + 1, cy, cw - 2, 4);
        }
      }
    }

    drawCliffEdge(p1MaxX, baseMinY, baseMaxY, [laneTopY, laneBotY], false);
    drawCliffEdge(p2MinX, baseMinY, baseMaxY, [laneTopY, laneBotY], true);

    // ─── Stairs where lanes meet base platforms ──────────────────
    function drawStairs(x, laneY, isRight) {
      const stairTop = laneY - stairW / 2;
      const stairBot = laneY + stairW / 2;
      const stairDepth = 10;
      const numSteps = 4;
      const stepH = (stairBot - stairTop) / 1;
      const stepW = stairDepth / numSteps;

      for (let i = 0; i < numSteps; i++) {
        const sx = isRight ? x - stairDepth + i * stepW : x + i * stepW;
        const brightness = 50 + i * 8;
        tc.fillStyle = `rgb(${brightness + 20},${brightness + 15},${brightness + 10})`;
        tc.fillRect(sx, stairTop, stepW, stairBot - stairTop);
        tc.strokeStyle = 'rgba(0,0,0,0.3)';
        tc.lineWidth = 0.5;
        tc.strokeRect(sx, stairTop, stepW, stairBot - stairTop);
      }
    }

    drawStairs(p1MaxX, laneTopY, false);
    drawStairs(p1MaxX, laneBotY, false);
    drawStairs(p2MinX, laneTopY, true);
    drawStairs(p2MinX, laneBotY, true);

    // ─── Base tint overlays ──────────────────────────────────────
    tc.fillStyle = 'rgba(30, 50, 80, 0.12)';
    tc.fillRect(p1MinX, baseMinY, p1MaxX - p1MinX, baseMaxY - baseMinY);
    tc.fillStyle = 'rgba(80, 30, 30, 0.12)';
    tc.fillRect(p2MinX, baseMinY, p2MaxX - p2MinX, baseMaxY - baseMinY);

    // ─── Outpost markers on terrain ──────────────────────────────
    const opNorthX = (GC.MAP_WIDTH / 2) * scale;
    const opNorthY = (GC.LANE_TOP_Y - 80) * scale;
    const opSouthX = opNorthX;
    const opSouthY = (GC.LANE_BOT_Y + 80) * scale;

    function drawOutpostBase(ox, oy) {
      tc.fillStyle = '#5a5550';
      tc.beginPath();
      tc.arc(ox, oy, 10, 0, Math.PI * 2);
      tc.fill();
      tc.strokeStyle = '#888';
      tc.lineWidth = 1;
      tc.stroke();
      tc.fillStyle = '#666';
      tc.fillRect(ox - 2, oy - 12, 4, 14);
    }

    drawOutpostBase(opNorthX, opNorthY);
    drawOutpostBase(opSouthX, opSouthY);

    // ─── Trees (grassy middle area only) ─────────────────────────
    for (const dec of decorations) {
      if (dec.type === 'tree') {
        const dx = dec.x * scale;
        const dy = dec.y * scale;
        const s = dec.scale * 0.8;
        tc.fillStyle = 'rgba(0,0,0,0.15)';
        tc.beginPath();
        tc.ellipse(dx, dy + 4 * s, 8 * s, 3 * s, 0, 0, Math.PI * 2);
        tc.fill();
        tc.fillStyle = '#3d2b1f';
        tc.fillRect(dx - 1.5 * s, dy - 8 * s, 3 * s, 12 * s);
        const greens = ['#1a4d1a', '#266326', '#1f5420', '#2d7a2d'];
        for (let l = 0; l < 3; l++) {
          tc.fillStyle = greens[dec.variant % greens.length];
          tc.beginPath();
          tc.arc(dx, dy - 10 * s - l * 5 * s, (7 - l * 1.5) * s, 0, Math.PI * 2);
          tc.fill();
        }
      } else if (dec.type === 'rock') {
        const dx = dec.x * scale;
        const dy = dec.y * scale;
        const s = dec.scale;
        tc.fillStyle = '#555';
        tc.beginPath();
        tc.ellipse(dx, dy, 4 * s, 3 * s, 0, 0, Math.PI * 2);
        tc.fill();
        tc.fillStyle = '#666';
        tc.beginPath();
        tc.ellipse(dx - 1, dy - 1, 3 * s, 2 * s, 0, 0, Math.PI * 2);
        tc.fill();
      }
    }

    terrainDirty = false;
  }

  // ─── Draw Castle ────────────────────────────────────────────────
  function drawCastle(castleData, side, charId) {
    if (!isVisible(castleData.x, castleData.y, 200)) return;
    const pos = worldToScreen(castleData.x, castleData.y);
    const z = camera.zoom;
    const palette = CHAR_PALETTES[charId] || CHAR_PALETTES.northern_lord;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Large shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 50 * z, 70 * z, 18 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Castle base/foundation
    const grad1 = ctx.createLinearGradient(-50 * z, 20 * z, 50 * z, 50 * z);
    grad1.addColorStop(0, '#3a3a3a');
    grad1.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = grad1;
    roundRect(ctx, -55 * z, 10 * z, 110 * z, 40 * z, 3 * z);
    ctx.fill();

    // Main wall
    const wallGrad = ctx.createLinearGradient(0, -60 * z, 0, 20 * z);
    wallGrad.addColorStop(0, '#606060');
    wallGrad.addColorStop(0.5, '#505050');
    wallGrad.addColorStop(1, '#3a3a3a');
    ctx.fillStyle = wallGrad;
    roundRect(ctx, -45 * z, -40 * z, 90 * z, 60 * z, 2 * z);
    ctx.fill();

    // Stone texture on wall
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5 * z;
    for (let row = 0; row < 6; row++) {
      const ry = (-38 + row * 10) * z;
      const offset = (row % 2) * 15 * z;
      for (let col = 0; col < 4; col++) {
        const rx = (-42 + col * 22 + offset) * z;
        ctx.strokeRect(rx, ry, 20 * z, 9 * z);
      }
    }

    // Gate
    const gateGrad = ctx.createLinearGradient(0, -10 * z, 0, 20 * z);
    gateGrad.addColorStop(0, '#1a1a1a');
    gateGrad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = gateGrad;
    ctx.beginPath();
    ctx.moveTo(-12 * z, 20 * z);
    ctx.lineTo(-12 * z, -5 * z);
    ctx.arc(0, -5 * z, 12 * z, Math.PI, 0);
    ctx.lineTo(12 * z, 20 * z);
    ctx.fill();

    // Gate portcullis lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5 * z;
    for (let i = -8; i <= 8; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i * z, -5 * z);
      ctx.lineTo(i * z, 18 * z);
      ctx.stroke();
    }

    // Left tower
    drawTower(ctx, -50 * z, -30 * z, 20 * z, 70 * z, z, palette);
    // Right tower
    drawTower(ctx, 30 * z, -30 * z, 20 * z, 70 * z, z, palette);

    // Center tower (taller)
    drawTower(ctx, -10 * z, -55 * z, 20 * z, 50 * z, z, palette);

    // Banners on towers
    drawBanner(ctx, -40 * z, -65 * z, z, palette.primary);
    drawBanner(ctx, 40 * z, -65 * z, z, palette.primary);

    // Torch lights
    const flicker = 0.7 + Math.sin(time * 8) * 0.15 + Math.sin(time * 13) * 0.1;
    drawTorchGlow(ctx, -25 * z, -5 * z, z, flicker);
    drawTorchGlow(ctx, 25 * z, -5 * z, z, flicker);

    ctx.restore();

    // Health bar above castle
    drawHealthBar(pos.x, pos.y - 80 * z, 100 * z, castleData.hp, castleData.maxHp,
      side === mySide ? 'friendly' : 'enemy');

    // HP text
    ctx.font = `bold ${11 * z}px Cinzel, serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(`${Math.ceil(castleData.hp)} / ${castleData.maxHp}`, pos.x, pos.y - 82 * z - 4);
    ctx.shadowBlur = 0;
  }

  function drawTower(ctx, x, y, w, h, z, palette) {
    // Tower body
    const tGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    tGrad.addColorStop(0, '#585858');
    tGrad.addColorStop(0.5, '#4a4a4a');
    tGrad.addColorStop(1, '#383838');
    ctx.fillStyle = tGrad;
    ctx.fillRect(x, y, w, h);

    // Stone lines
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.5 * z;
    for (let i = 0; i < h / (8 * z); i++) {
      ctx.beginPath();
      ctx.moveTo(x, y + i * 8 * z);
      ctx.lineTo(x + w, y + i * 8 * z);
      ctx.stroke();
    }

    // Crenellations
    ctx.fillStyle = '#555';
    const crenW = 4 * z;
    for (let i = 0; i < w / crenW; i += 2) {
      ctx.fillRect(x + i * crenW, y - 5 * z, crenW, 5 * z);
    }

    // Roof/cap
    ctx.fillStyle = palette.dark;
    ctx.beginPath();
    ctx.moveTo(x - 2 * z, y - 5 * z);
    ctx.lineTo(x + w / 2, y - 18 * z);
    ctx.lineTo(x + w + 2 * z, y - 5 * z);
    ctx.fill();
  }

  function drawBanner(ctx, x, y, z, color) {
    // Pole
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5 * z;
    ctx.beginPath();
    ctx.moveTo(x, y + 15 * z);
    ctx.lineTo(x, y - 5 * z);
    ctx.stroke();

    // Banner cloth with wave
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 5 * z);
    const wave = Math.sin(time * 3 + x) * 2 * z;
    ctx.lineTo(x + 10 * z + wave, y - 2 * z);
    ctx.lineTo(x + 8 * z + wave * 0.5, y + 5 * z);
    ctx.lineTo(x, y + 8 * z);
    ctx.fill();

    // Banner edge highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.5 * z;
    ctx.stroke();
  }

  function drawTorchGlow(ctx, x, y, z, flicker) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 25 * z * flicker);
    grad.addColorStop(0, `rgba(255, 180, 50, ${0.3 * flicker})`);
    grad.addColorStop(0.5, `rgba(255, 120, 20, ${0.1 * flicker})`);
    grad.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 25 * z * flicker, 0, Math.PI * 2);
    ctx.fill();

    // Torch flame
    ctx.fillStyle = `rgba(255, 200, 50, ${flicker})`;
    ctx.beginPath();
    ctx.arc(x, y - 3 * z, 2.5 * z, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── Draw Building ──────────────────────────────────────────────
  function drawBuilding(bData) {
    if (!isVisible(bData.x, bData.y, 100)) return;
    const pos = worldToScreen(bData.x, bData.y);
    const z = camera.zoom;
    const palette = CHAR_PALETTES[bData.characterId] || CHAR_PALETTES.northern_lord;
    const isMySide = bData.side === mySide;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Construction state
    if (!bData.constructed) {
      ctx.globalAlpha = 0.4 + bData.constructionProgress * 0.6;
      // Scaffolding effect
      ctx.strokeStyle = '#8B7355';
      ctx.lineWidth = 1.5 * z;
      const progress = bData.constructionProgress;
      const h = 30 * z * progress;
      ctx.strokeRect(-15 * z, -h, 30 * z, h);
      ctx.beginPath();
      ctx.moveTo(-15 * z, 0);
      ctx.lineTo(15 * z, -h);
      ctx.stroke();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 20 * z, 22 * z, 7 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw building based on the unit type it produces
    drawBuildingStructure(ctx, bData.typeId, z, palette, bData.characterId, bData.level || 1);

    // Ownership indicator
    if (isMySide) {
      ctx.strokeStyle = 'rgba(100, 200, 100, 0.3)';
      ctx.lineWidth = 1 * z;
      ctx.setLineDash([3 * z, 3 * z]);
      ctx.beginPath();
      ctx.arc(0, 5 * z, 28 * z, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.globalAlpha = 1;
    ctx.restore();

    // Health bar
    if (bData.constructed) {
      drawHealthBar(pos.x, pos.y - 35 * z, 36 * z, bData.hp, bData.maxHp,
        isMySide ? 'friendly' : 'enemy');
    }

    // L2/L3 upgraded building visual enhancements (no badge)
    if (bData.level && bData.level >= 2 && bData.constructed) {
      // L3 golden glow around entire building
      if (bData.level === 3) {
        const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 35 * z);
        glow.addColorStop(0, 'rgba(255, 215, 0, 0.12)');
        glow.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 35 * z, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBuildingStructure(ctx, typeId, z, palette, charId, level) {
    // Generic building with character color accents
    // Categorize by what unit it produces - find the building def
    const charData = CHARACTERS[charId];
    const bDef = charData ? charData.buildings.find(b => b.id === typeId) : null;
    const unitDef = charData && bDef ? charData.units.find(u => u.id === bDef.unit) : null;
    const unitType = unitDef ? unitDef.type : 'infantry';
    const lvl = level || 1;

    // Scale factor for upgraded buildings (slightly bigger)
    const upgScale = lvl >= 3 ? 1.12 : lvl >= 2 ? 1.06 : 1.0;
    if (upgScale > 1) {
      ctx.scale(upgScale, upgScale);
    }

    // Gold Mine special case
    if (typeId === 'gold_mine') {
      drawGoldMineBuilding(ctx, z, palette, lvl);
      if (upgScale > 1) ctx.scale(1/upgScale, 1/upgScale);
      return;
    }

    // Building style varies by unit type produced
    if (unitType === 'infantry') {
      drawBarracksBuilding(ctx, z, palette, lvl);
    } else if (unitType === 'ranged') {
      drawRangedBuilding(ctx, z, palette, lvl);
    } else if (unitType === 'cavalry') {
      drawStablesBuilding(ctx, z, palette, lvl);
    } else if (unitType === 'siege') {
      drawSiegeBuilding(ctx, z, palette, lvl);
    } else if (unitType === 'flying') {
      drawFlyingBuilding(ctx, z, palette, lvl);
    } else {
      drawBarracksBuilding(ctx, z, palette, lvl);
    }

    // Upgraded building accents
    if (lvl >= 2) {
      // Reinforced trim on building
      const trimColor = lvl === 3 ? '#d4a017' : '#999';
      ctx.strokeStyle = trimColor;
      ctx.lineWidth = 1 * z;
      ctx.beginPath();
      ctx.arc(0, -5 * z, 24 * z, 0, Math.PI * 2);
      ctx.stroke();

      // L3 banner flags on corners
      if (lvl === 3) {
        ctx.fillStyle = palette.primary;
        ctx.fillRect(16 * z, -30 * z, 2 * z, 10 * z);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(18 * z, -30 * z, 6 * z, 4 * z);
        ctx.fillRect(-24 * z, -30 * z, 2 * z, 10 * z);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(-30 * z, -30 * z, 6 * z, 4 * z);
      }
    }

    if (upgScale > 1) ctx.scale(1/upgScale, 1/upgScale);
  }

  function drawBarracksBuilding(ctx, z, palette, lvl) {
    // Stone barracks with wooden door
    const wallG = ctx.createLinearGradient(-18 * z, -25 * z, 18 * z, 15 * z);
    wallG.addColorStop(0, '#5a5045');
    wallG.addColorStop(1, '#45392e');
    ctx.fillStyle = wallG;
    ctx.fillRect(-18 * z, -18 * z, 36 * z, 33 * z);

    // Stone texture
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 0.5 * z;
    for (let r = 0; r < 4; r++) {
      const ry = (-16 + r * 8) * z;
      for (let c = 0; c < 3; c++) {
        ctx.strokeRect((-16 + c * 11 + (r % 2) * 5) * z, ry, 10 * z, 7 * z);
      }
    }

    // Roof
    ctx.fillStyle = palette.dark;
    ctx.beginPath();
    ctx.moveTo(-22 * z, -18 * z);
    ctx.lineTo(0, -32 * z);
    ctx.lineTo(22 * z, -18 * z);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.moveTo(0, -32 * z);
    ctx.lineTo(22 * z, -18 * z);
    ctx.lineTo(0, -18 * z);
    ctx.fill();

    // Door
    ctx.fillStyle = '#2a1f14';
    ctx.fillRect(-5 * z, 2 * z, 10 * z, 13 * z);

    // Weapon rack beside door
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1.2 * z;
    ctx.beginPath();
    ctx.moveTo(12 * z, -5 * z);
    ctx.lineTo(12 * z, 10 * z);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10 * z, -3 * z);
    ctx.lineTo(14 * z, -3 * z);
    ctx.stroke();

    // Banner
    ctx.fillStyle = palette.primary;
    ctx.fillRect(-20 * z, -28 * z, 5 * z, 10 * z);

    // L2+ stone crenellations on top
    if (lvl >= 2) {
      ctx.fillStyle = '#5a5045';
      ctx.fillRect(-20 * z, -20 * z, 5 * z, 3 * z);
      ctx.fillRect(-10 * z, -20 * z, 5 * z, 3 * z);
      ctx.fillRect(5 * z, -20 * z, 5 * z, 3 * z);
      ctx.fillRect(15 * z, -20 * z, 5 * z, 3 * z);
    }
  }

  function drawRangedBuilding(ctx, z, palette, lvl) {
    // Open archery range / tower
    ctx.fillStyle = '#4d4234';
    ctx.fillRect(-16 * z, -12 * z, 32 * z, 27 * z);

    // Open front (darker interior)
    ctx.fillStyle = '#1a1510';
    ctx.fillRect(-10 * z, -2 * z, 20 * z, 17 * z);

    // Pillars
    ctx.fillStyle = '#5a5045';
    ctx.fillRect(-12 * z, -10 * z, 4 * z, 25 * z);
    ctx.fillRect(8 * z, -10 * z, 4 * z, 25 * z);

    // Slanted roof
    ctx.fillStyle = palette.dark;
    ctx.beginPath();
    ctx.moveTo(-20 * z, -12 * z);
    ctx.lineTo(0, -24 * z);
    ctx.lineTo(20 * z, -12 * z);
    ctx.fill();

    // Target
    ctx.fillStyle = '#b22222';
    ctx.beginPath();
    ctx.arc(0, 5 * z, 4 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 5 * z, 2 * z, 0, Math.PI * 2);
    ctx.fill();

    // Arrow slits
    ctx.fillStyle = '#111';
    ctx.fillRect(-14 * z, -7 * z, 1.5 * z, 6 * z);
    ctx.fillRect(12.5 * z, -7 * z, 1.5 * z, 6 * z);

    // L2+ extra arrow slits and wider pillars
    if (lvl >= 2) {
      ctx.fillStyle = '#111';
      ctx.fillRect(-6 * z, -7 * z, 1.5 * z, 6 * z);
      ctx.fillRect(4.5 * z, -7 * z, 1.5 * z, 6 * z);
    }
  }

  function drawStablesBuilding(ctx, z, palette, lvl) {
    // Barn-like stables
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(-20 * z, -10 * z, 40 * z, 25 * z);

    // Barn doors (open)
    ctx.fillStyle = '#3a2618';
    ctx.fillRect(-15 * z, 0 * z, 12 * z, 15 * z);
    ctx.fillRect(3 * z, 0 * z, 12 * z, 15 * z);

    // Gambrel roof
    ctx.fillStyle = palette.dark;
    ctx.beginPath();
    ctx.moveTo(-24 * z, -10 * z);
    ctx.lineTo(-12 * z, -22 * z);
    ctx.lineTo(0, -28 * z);
    ctx.lineTo(12 * z, -22 * z);
    ctx.lineTo(24 * z, -10 * z);
    ctx.fill();

    // Hay detail
    ctx.fillStyle = '#c4a03a';
    ctx.fillRect(-13 * z, 5 * z, 8 * z, 4 * z);

    // Horse head silhouette peeking out
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath();
    ctx.arc(8 * z, 3 * z, 3 * z, 0, Math.PI * 2);
    ctx.fill();

    // Fence
    ctx.strokeStyle = '#6B4226';
    ctx.lineWidth = 1.2 * z;
    ctx.beginPath();
    ctx.moveTo(-22 * z, 15 * z);
    ctx.lineTo(-22 * z, 8 * z);
    ctx.lineTo(22 * z, 8 * z);
    ctx.lineTo(22 * z, 15 * z);
    ctx.stroke();

    // L2+ reinforced fence with iron posts
    if (lvl >= 2) {
      ctx.fillStyle = '#666';
      ctx.fillRect(-22 * z, 8 * z, 2 * z, 7 * z);
      ctx.fillRect(20 * z, 8 * z, 2 * z, 7 * z);
      ctx.fillRect(-1 * z, 8 * z, 2 * z, 7 * z);
    }
  }

  function drawSiegeBuilding(ctx, z, palette, lvl) {
    // Heavy stone forge/workshop
    ctx.fillStyle = '#4a4240';
    ctx.fillRect(-22 * z, -15 * z, 44 * z, 30 * z);

    // Reinforced look
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5 * z;
    ctx.strokeRect(-22 * z, -15 * z, 44 * z, 30 * z);

    // Flat heavy roof
    ctx.fillStyle = '#333';
    ctx.fillRect(-25 * z, -18 * z, 50 * z, 5 * z);

    // Chimney with smoke
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(12 * z, -28 * z, 8 * z, 13 * z);

    // Anvil silhouette
    ctx.fillStyle = '#222';
    ctx.fillRect(-5 * z, 5 * z, 10 * z, 5 * z);
    ctx.fillRect(-3 * z, 0 * z, 6 * z, 5 * z);

    // Gear/wheel
    ctx.strokeStyle = palette.primary;
    ctx.lineWidth = 1.5 * z;
    ctx.beginPath();
    ctx.arc(-12 * z, 2 * z, 5 * z, 0, Math.PI * 2);
    ctx.stroke();

    // Fire glow inside
    const flicker = 0.5 + Math.sin(time * 6) * 0.2;
    const fireG = ctx.createRadialGradient(0, 5 * z, 0, 0, 5 * z, 15 * z);
    fireG.addColorStop(0, `rgba(255, 120, 20, ${0.3 * flicker})`);
    fireG.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = fireG;
    ctx.fillRect(-20 * z, -10 * z, 40 * z, 25 * z);

    // L2+ second chimney and extra reinforcement
    if (lvl >= 2) {
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(-16 * z, -28 * z, 7 * z, 13 * z);
      // Metal bands
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1.5 * z;
      ctx.beginPath();
      ctx.moveTo(-25 * z, -10 * z);
      ctx.lineTo(25 * z, -10 * z);
      ctx.stroke();
    }
  }

  function drawFlyingBuilding(ctx, z, palette, lvl) {
    // Tall tower / roost / nest
    ctx.fillStyle = '#4d4540';
    ctx.fillRect(-10 * z, -10 * z, 20 * z, 25 * z);

    // Taller section
    ctx.fillStyle = '#555045';
    ctx.fillRect(-8 * z, -30 * z, 16 * z, 22 * z);

    // Pointed roof
    ctx.fillStyle = palette.dark;
    ctx.beginPath();
    ctx.moveTo(-12 * z, -30 * z);
    ctx.lineTo(0, -45 * z);
    ctx.lineTo(12 * z, -30 * z);
    ctx.fill();

    // Window/opening at top
    ctx.fillStyle = '#1a1510';
    ctx.beginPath();
    ctx.arc(0, -22 * z, 4 * z, 0, Math.PI * 2);
    ctx.fill();

    // Nest/perch
    ctx.fillStyle = '#6B4226';
    ctx.beginPath();
    ctx.ellipse(0, -30 * z, 12 * z, 3 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bird silhouette on perch (animated)
    const bob = Math.sin(time * 2) * 2 * z;
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.ellipse(3 * z, -33 * z + bob, 4 * z, 2.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wing
    const wingAngle = Math.sin(time * 4) * 0.3;
    ctx.beginPath();
    ctx.moveTo(3 * z, -34 * z + bob);
    ctx.lineTo(8 * z, -37 * z + bob + wingAngle * 5 * z);
    ctx.lineTo(6 * z, -33 * z + bob);
    ctx.fill();

    // L2+ second bird and taller structure
    if (lvl >= 2) {
      ctx.fillStyle = palette.primary;
      ctx.beginPath();
      ctx.ellipse(-4 * z, -34 * z + bob * 0.8, 3.5 * z, 2 * z, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGoldMineBuilding(ctx, z, palette, lvl) {
    // Mine entrance - rocky hill
    ctx.fillStyle = '#5a5045';
    ctx.beginPath();
    ctx.moveTo(-24 * z, 15 * z);
    ctx.lineTo(-20 * z, -8 * z);
    ctx.lineTo(-8 * z, -18 * z);
    ctx.lineTo(8 * z, -20 * z);
    ctx.lineTo(20 * z, -10 * z);
    ctx.lineTo(24 * z, 15 * z);
    ctx.fill();

    // Rock texture
    ctx.fillStyle = '#4a4035';
    ctx.beginPath();
    ctx.ellipse(-10 * z, -10 * z, 6 * z, 4 * z, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#554a3e';
    ctx.beginPath();
    ctx.ellipse(10 * z, -8 * z, 5 * z, 3 * z, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Mine entrance (dark opening)
    ctx.fillStyle = '#0a0806';
    ctx.beginPath();
    ctx.moveTo(-10 * z, 15 * z);
    ctx.lineTo(-8 * z, -2 * z);
    ctx.arc(0, -2 * z, 8 * z, Math.PI, 0);
    ctx.lineTo(10 * z, 15 * z);
    ctx.fill();

    // Wooden support beams
    ctx.fillStyle = '#6B4226';
    ctx.fillRect(-10 * z, -2 * z, 3 * z, 17 * z);
    ctx.fillRect(7 * z, -2 * z, 3 * z, 17 * z);
    // Top beam
    ctx.fillRect(-10 * z, -4 * z, 20 * z, 3 * z);

    // Gold nuggets
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(-14 * z, 8 * z, 2 * z, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e6c200';
    ctx.beginPath(); ctx.arc(-12 * z, 12 * z, 1.5 * z, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(14 * z, 10 * z, 1.8 * z, 0, Math.PI * 2); ctx.fill();

    // Pickaxe
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 1.5 * z;
    ctx.beginPath();
    ctx.moveTo(16 * z, -12 * z);
    ctx.lineTo(20 * z, 2 * z);
    ctx.stroke();
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.moveTo(14 * z, -14 * z);
    ctx.lineTo(18 * z, -11 * z);
    ctx.lineTo(16 * z, -9 * z);
    ctx.fill();

    // Gold sparkle effect
    const sparkle = 0.5 + Math.sin(time * 5) * 0.3;
    ctx.fillStyle = `rgba(255, 215, 0, ${sparkle * 0.4})`;
    ctx.beginPath(); ctx.arc(-2 * z, 6 * z, 1.5 * z, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255, 215, 0, ${(1 - sparkle) * 0.3})`;
    ctx.beginPath(); ctx.arc(3 * z, 3 * z, 1 * z, 0, Math.PI * 2); ctx.fill();

    // L2 upgraded gold mine: ore cart, extra nuggets, reinforced beams
    if (lvl >= 2) {
      // Additional gold piles
      ctx.fillStyle = '#ffd700';
      ctx.beginPath(); ctx.arc(-16 * z, 5 * z, 2.5 * z, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(16 * z, 7 * z, 2 * z, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-18 * z, 10 * z, 1.8 * z, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e6c200';
      ctx.beginPath(); ctx.arc(12 * z, 12 * z, 2.2 * z, 0, Math.PI * 2); ctx.fill();
      // Mining cart
      ctx.fillStyle = '#555';
      ctx.fillRect(15 * z, 0 * z, 8 * z, 5 * z);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(16 * z, 0 * z);
      ctx.lineTo(19 * z, -3 * z);
      ctx.lineTo(22 * z, 0 * z);
      ctx.fill();
      // Cart wheels
      ctx.fillStyle = '#444';
      ctx.beginPath(); ctx.arc(17 * z, 5 * z, 1.5 * z, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(21 * z, 5 * z, 1.5 * z, 0, Math.PI * 2); ctx.fill();
      // Iron-reinforced beams
      ctx.fillStyle = '#777';
      ctx.fillRect(-11 * z, -4 * z, 1.5 * z, 19 * z);
      ctx.fillRect(9.5 * z, -4 * z, 1.5 * z, 19 * z);
      // Extra sparkles
      const sparkle2 = 0.3 + Math.cos(time * 7) * 0.3;
      ctx.fillStyle = `rgba(255, 215, 0, ${sparkle2 * 0.5})`;
      ctx.beginPath(); ctx.arc(5 * z, 8 * z, 1.5 * z, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255, 215, 0, ${(1 - sparkle2) * 0.4})`;
      ctx.beginPath(); ctx.arc(-6 * z, 10 * z, 1.2 * z, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ─── Draw General ──────────────────────────────────────────────
  function drawGeneral(gData) {
    if (!gData || gData.hp <= 0) return;
    if (!isVisible(gData.x, gData.y, 80)) return;
    const pos = worldToScreen(gData.x, gData.y);
    const z = camera.zoom;
    const palette = CHAR_PALETTES[gData.characterId] || CHAR_PALETTES.northern_lord;
    const isMySide = gData.side === mySide;
    const facingRight = gData.side === 'left';
    const scale = 1.6; // Generals are larger

    // Selection ring
    if (selectedUnitId === gData.id) {
      const pulse = 0.7 + Math.sin(time * 4) * 0.3;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 215, 0, ${(0.8 * pulse).toFixed(2)})`;
      ctx.lineWidth = 3 * z;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y + 12 * z * scale, (14 + 5) * z, (14 * 0.3 + 3) * z, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 12 * z * scale, 14 * z * scale, 4 * z * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    const dir = facingRight ? 1 : -1;
    ctx.scale(dir, 1);

    const sz = z * scale;
    const bob = Math.sin(time * 4 + gData.id * 2) * 1.5 * z;

    // Cape (flowing behind)
    ctx.fillStyle = palette.primary;
    ctx.globalAlpha = 0.8;
    const capeWave = Math.sin(time * 3) * 3 * z;
    ctx.beginPath();
    ctx.moveTo(-2 * sz, -6 * sz + bob);
    ctx.lineTo(-8 * sz + capeWave, 8 * sz + bob);
    ctx.lineTo(-12 * sz + capeWave * 1.5, 14 * sz + bob);
    ctx.lineTo(-4 * sz + capeWave * 0.5, 10 * sz + bob);
    ctx.lineTo(2 * sz, 4 * sz + bob);
    ctx.fill();
    // Cape inner highlight
    ctx.fillStyle = palette.secondary;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(-2 * sz, -4 * sz + bob);
    ctx.lineTo(-6 * sz + capeWave, 6 * sz + bob);
    ctx.lineTo(-3 * sz + capeWave * 0.5, 8 * sz + bob);
    ctx.lineTo(0, 2 * sz + bob);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Legs (armored)
    ctx.fillStyle = '#4a4040';
    ctx.fillRect(-4 * sz, 4 * sz + bob, 3 * sz, 7 * sz);
    ctx.fillRect(1 * sz, 4 * sz + bob, 3 * sz, 7 * sz);
    // Leg armor shine
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(-4 * sz, 4 * sz + bob, 1.5 * sz, 7 * sz);
    ctx.fillRect(1 * sz, 4 * sz + bob, 1.5 * sz, 7 * sz);

    // Body armor (large plate armor)
    const armorGrad = ctx.createLinearGradient(-5 * sz, -10 * sz, 5 * sz, 4 * sz);
    armorGrad.addColorStop(0, palette.primary);
    armorGrad.addColorStop(0.5, palette.dark);
    armorGrad.addColorStop(1, palette.primary);
    ctx.fillStyle = armorGrad;
    ctx.fillRect(-5 * sz, -10 * sz + bob, 10 * sz, 14 * sz);

    // Armor detail - belt
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(-5 * sz, 1 * sz + bob, 10 * sz, 2 * sz);
    // Belt buckle
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(-1 * sz, 0.5 * sz + bob, 2 * sz, 2.5 * sz);

    // Shoulder pauldrons
    ctx.fillStyle = palette.dark;
    ctx.beginPath();
    ctx.ellipse(-5.5 * sz, -8 * sz + bob, 3 * sz, 2.5 * sz, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5.5 * sz, -8 * sz + bob, 3 * sz, 2.5 * sz, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Pauldron gold trim
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 0.5 * sz;
    ctx.beginPath();
    ctx.ellipse(-5.5 * sz, -8 * sz + bob, 3 * sz, 2.5 * sz, -0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(5.5 * sz, -8 * sz + bob, 3 * sz, 2.5 * sz, 0.3, 0, Math.PI * 2);
    ctx.stroke();

    // Head
    ctx.fillStyle = '#d4a574';
    ctx.beginPath();
    ctx.arc(0, -14 * sz + bob, 4 * sz, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#222';
    ctx.fillRect(-2 * sz, -14.5 * sz + bob, 1.2 * sz, 1 * sz);
    ctx.fillRect(1 * sz, -14.5 * sz + bob, 1.2 * sz, 1 * sz);

    // Crown (faction colored)
    ctx.fillStyle = palette.primary;
    ctx.fillRect(-4.5 * sz, -19.5 * sz + bob, 9 * sz, 4 * sz);
    // Crown points
    ctx.fillRect(-4 * sz, -22 * sz + bob, 2 * sz, 3 * sz);
    ctx.fillRect(-1 * sz, -23 * sz + bob, 2 * sz, 4 * sz);
    ctx.fillRect(2 * sz, -22 * sz + bob, 2 * sz, 3 * sz);
    // Crown gold trim
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(-4.5 * sz, -19.5 * sz + bob, 9 * sz, 1.5 * sz);
    // Crown gems
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(0, -21.5 * sz + bob, 0.8 * sz, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3366ff';
    ctx.beginPath();
    ctx.arc(-3 * sz, -20.5 * sz + bob, 0.6 * sz, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3 * sz, -20.5 * sz + bob, 0.6 * sz, 0, Math.PI * 2);
    ctx.fill();

    // Sword (larger than infantry)
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1.8 * sz;
    const swordSwing = gData.state === 'fighting' ? Math.sin(time * 10) * 0.5 : 0;
    ctx.save();
    ctx.rotate(swordSwing);
    ctx.beginPath();
    ctx.moveTo(6 * sz, -6 * sz + bob);
    ctx.lineTo(14 * sz, -18 * sz + bob);
    ctx.stroke();
    // Sword guard
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 2 * sz;
    ctx.beginPath();
    ctx.moveTo(4 * sz, -7 * sz + bob);
    ctx.lineTo(8 * sz, -5 * sz + bob);
    ctx.stroke();
    ctx.restore();

    // Shield (on other arm)
    ctx.fillStyle = palette.dark;
    ctx.beginPath();
    ctx.ellipse(-6 * sz, -4 * sz + bob, 4 * sz, 6 * sz, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.secondary;
    ctx.lineWidth = 0.8 * sz;
    ctx.stroke();
    // Shield emblem
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.arc(-6 * sz, -4 * sz + bob, 2 * sz, 0, Math.PI * 2);
    ctx.fill();

    // Aura glow based on rank
    if (gData.rank > 0) {
      ctx.scale(dir, 1); // Reset scale for aura
      const auraColors = ['', 'rgba(100,200,100,0.08)', 'rgba(200,180,50,0.10)', 'rgba(255,215,0,0.12)'];
      const auraR = (gData.auraRange || 200) * z / scale; // Scale to screen
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.min(auraR, 120 * z));
      grad.addColorStop(0, auraColors[Math.min(gData.rank, 3)]);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(auraR, 120 * z), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Health bar
    if (gData.hp < gData.maxHp) {
      drawHealthBar(pos.x, pos.y - 28 * z * scale, 30 * z, gData.hp, gData.maxHp,
        isMySide ? 'friendly' : 'enemy');
    }

    // Rank indicator above
    if (gData.rank > 0) {
      drawRankIndicator(pos.x, pos.y - 32 * z * scale, z, gData.rank);
    }
  }

  // ─── Draw Unit ──────────────────────────────────────────────────
  function drawUnit(uData) {
    if (!isVisible(uData.x, uData.y, 60)) return;
    const pos = worldToScreen(uData.x, uData.y);
    const z = camera.zoom;
    const vis = UNIT_VISUALS[uData.unitType] || UNIT_VISUALS.infantry;
    const palette = CHAR_PALETTES[uData.characterId] || CHAR_PALETTES.northern_lord;
    const isMySide = uData.side === mySide;
    const facingRight = uData.side === 'left';
    const yOffset = vis.yOff * z;

    // Yellow selection ring on the ground
    if (selectedUnitId === uData.id) {
      const pulse = 0.7 + Math.sin(time * 4) * 0.3;
      const ringY = pos.y + (uData.unitType === 'flying' ? 20 * z : vis.size * 0.6 * z);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 215, 0, ${(0.8 * pulse).toFixed(2)})`;
      ctx.lineWidth = 2.5 * z;
      ctx.beginPath();
      ctx.ellipse(pos.x, ringY, (vis.size + 5) * z, (vis.size * 0.3 + 3) * z, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 215, 0, ${(0.25 * pulse).toFixed(2)})`;
      ctx.lineWidth = 5 * z;
      ctx.beginPath();
      ctx.ellipse(pos.x, ringY, (vis.size + 8) * z, (vis.size * 0.3 + 4) * z, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(pos.x, pos.y + yOffset);

    // Shadow (on ground, not for flying offset)
    if (uData.unitType === 'flying') {
      // Shadow on ground below
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(0, 20 * z, 8 * z, 3 * z, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(0, vis.size * 0.6 * z, vis.size * 0.7 * z, vis.size * 0.2 * z, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const dir = facingRight ? 1 : -1;
    ctx.scale(dir, 1);

    // Draw based on unit type — Orc-specific sprites override generic ones
    const isOrc = uData.characterId === 'orc_warchief';
    if (isOrc && uData.typeId === 'half_orc') {
      drawHalfOrcUnit(ctx, z, palette, uData);
    } else if (isOrc && uData.typeId === 'goblin') {
      drawGoblinUnit(ctx, z, palette, uData);
    } else if (isOrc && uData.typeId === 'troll') {
      drawTrollUnit(ctx, z, palette, uData);
    } else if (isOrc && uData.typeId === 'thrall') {
      drawThrallUnit(ctx, z, palette, uData);
    } else if (isOrc && uData.typeId === 'warlock') {
      drawWarlockUnit(ctx, z, palette, uData);
    } else if (isOrc && uData.typeId === 'void_walker') {
      drawVoidWalkerUnit(ctx, z, palette, uData);
    } else if (isOrc && uData.typeId === 'imp') {
      drawImpUnit(ctx, z, palette, uData);
    } else if (uData.unitType === 'infantry') {
      drawInfantryUnit(ctx, z, palette, uData);
    } else if (uData.unitType === 'ranged') {
      drawRangedUnit(ctx, z, palette, uData);
    } else if (uData.unitType === 'cavalry') {
      drawCavalryUnit(ctx, z, palette, uData);
    } else if (uData.unitType === 'siege') {
      drawSiegeUnit(ctx, z, palette, uData);
    } else if (uData.unitType === 'flying') {
      drawFlyingUnit(ctx, z, palette, uData);
    }

    // Slowed feet effect — orange liquidy feet
    if (uData.slowed && uData.unitType !== 'flying') {
      ctx.scale(dir, 1); // Undo mirror for symmetric feet
      const feetY = vis.size * 0.4 * z;
      const drip = Math.sin(time * 6 + uData.id) * 1.5 * z;
      ctx.fillStyle = 'rgba(210, 140, 40, 0.7)';
      ctx.beginPath();
      ctx.ellipse(-3 * z, feetY + 2 * z, 4 * z, 2.5 * z + drip * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(3 * z, feetY + 2 * z, 4 * z, 2.5 * z - drip * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Drip streaks
      ctx.fillStyle = 'rgba(210, 140, 40, 0.4)';
      ctx.beginPath();
      ctx.ellipse(-2 * z, feetY + 4 * z + drip, 1.5 * z, 2 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(4 * z, feetY + 3.5 * z - drip * 0.5, 1 * z, 1.5 * z, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Health bar
    const barY = pos.y + yOffset - (vis.size + 8) * z;
    if (uData.hp < uData.maxHp) {
      drawHealthBar(pos.x, barY, 20 * z, uData.hp, uData.maxHp,
        isMySide ? 'friendly' : 'enemy');
    }

    // Debuff icons above unit
    let debuffY = barY - 6 * z;
    if (uData.poisoned && uData.poisoned > 0) {
      drawPoisonIcon(pos.x - 5 * z, debuffY, z, uData.poisoned);
      debuffY -= 10 * z;
    }
    if (uData.burning && uData.burning > 0) {
      drawBurnIcon(pos.x + 5 * z, debuffY + (uData.poisoned ? 10 * z : 0), z, uData.burning);
    }

    // Spell shield glow
    if (uData.spellShield && uData.spellShield > 0) {
      const shieldPulse = 0.5 + Math.sin(time * 4) * 0.3;
      ctx.strokeStyle = `rgba(100, 180, 255, ${shieldPulse.toFixed(2)})`;
      ctx.lineWidth = 1.5 * z;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y + yOffset, (vis.size + 3) * z, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Rank cosmetic indicator above unit
    if (uData.rank && uData.rank > 0) {
      drawRankIndicator(pos.x, pos.y + yOffset - (vis.size + 14) * z, z, uData.rank);
    }
  }

  function drawRankIndicator(x, y, z, rank) {
    if (rank === 1) {
      // Bronze star
      drawStarShape(x, y, 4 * z, '#cd7f32', 'rgba(205,127,50,0.3)');
    } else if (rank === 2) {
      // Silver star
      drawStarShape(x, y, 5 * z, '#c0c0c0', 'rgba(192,192,192,0.4)');
    } else if (rank >= 3) {
      // Gold crown with glow
      const glowR = 8 * z;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      glow.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
      glow.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Crown
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(x - 5 * z, y + 2 * z);
      ctx.lineTo(x - 5 * z, y - 2 * z);
      ctx.lineTo(x - 3 * z, y);
      ctx.lineTo(x, y - 4 * z);
      ctx.lineTo(x + 3 * z, y);
      ctx.lineTo(x + 5 * z, y - 2 * z);
      ctx.lineTo(x + 5 * z, y + 2 * z);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 0.5 * z;
      ctx.stroke();

      // Gems on crown tips
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(x, y - 3.5 * z, 0.8 * z, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStarShape(cx, cy, r, fillColor, glowColor) {
    // Small glow behind star
    const glowR = r * 2;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    glow.addColorStop(0, glowColor);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fill();

    // 5-pointed star
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI / 5);
      const innerAngle = angle + Math.PI / 5;
      const ox = cx + Math.cos(angle) * r;
      const oy = cy + Math.sin(angle) * r;
      const ix = cx + Math.cos(innerAngle) * r * 0.4;
      const iy = cy + Math.sin(innerAngle) * r * 0.4;
      if (i === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
      ctx.lineTo(ix, iy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  function drawInfantryUnit(ctx, z, palette, uData) {
    const bob = Math.sin(time * 6 + uData.id * 2) * 1.5 * z;
    // Body armor
    ctx.fillStyle = palette.primary;
    ctx.fillRect(-4 * z, -8 * z + bob, 8 * z, 10 * z);
    // Head
    ctx.fillStyle = '#d4a574';
    ctx.beginPath();
    ctx.arc(0, -11 * z + bob, 3.5 * z, 0, Math.PI * 2);
    ctx.fill();
    // Helmet
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(0, -12 * z + bob, 3.5 * z, Math.PI, 0);
    ctx.fill();
    // Shield
    ctx.fillStyle = palette.dark;
    ctx.beginPath();
    ctx.ellipse(-5 * z, -4 * z + bob, 3 * z, 5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.secondary;
    ctx.lineWidth = 0.5 * z;
    ctx.stroke();
    // Sword
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1.2 * z;
    const swordSwing = uData.state === 'fighting' ? Math.sin(time * 10) * 0.4 : 0;
    ctx.save();
    ctx.rotate(swordSwing);
    ctx.beginPath();
    ctx.moveTo(5 * z, -6 * z + bob);
    ctx.lineTo(10 * z, -14 * z + bob);
    ctx.stroke();
    ctx.restore();
    // Legs
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(-3 * z, 2 * z + bob, 2.5 * z, 5 * z);
    ctx.fillRect(0.5 * z, 2 * z + bob, 2.5 * z, 5 * z);
  }

  function drawRangedUnit(ctx, z, palette, uData) {
    const bob = Math.sin(time * 5 + uData.id * 3) * 1 * z;
    // Cloak
    ctx.fillStyle = palette.dark;
    ctx.beginPath();
    ctx.moveTo(-4 * z, -6 * z + bob);
    ctx.lineTo(-6 * z, 4 * z + bob);
    ctx.lineTo(4 * z, 4 * z + bob);
    ctx.lineTo(3 * z, -6 * z + bob);
    ctx.fill();
    // Body
    ctx.fillStyle = palette.primary;
    ctx.fillRect(-3 * z, -7 * z + bob, 6 * z, 9 * z);
    // Head
    ctx.fillStyle = '#d4a574';
    ctx.beginPath();
    ctx.arc(0, -10 * z + bob, 3 * z, 0, Math.PI * 2);
    ctx.fill();
    // Hood
    ctx.fillStyle = palette.dark;
    ctx.beginPath();
    ctx.arc(0, -11 * z + bob, 3.2 * z, Math.PI + 0.3, -0.3);
    ctx.fill();
    // Bow
    ctx.strokeStyle = '#6B4226';
    ctx.lineWidth = 1.2 * z;
    ctx.beginPath();
    ctx.arc(6 * z, -4 * z + bob, 7 * z, -1.2, 1.2);
    ctx.stroke();
    // Bowstring
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 0.5 * z;
    const bx = 6 * z + 7 * z * Math.cos(-1.2);
    const by1 = -4 * z + bob + 7 * z * Math.sin(-1.2);
    const by2 = -4 * z + bob + 7 * z * Math.sin(1.2);
    ctx.beginPath();
    ctx.moveTo(bx, by1);
    ctx.lineTo(bx, by2);
    ctx.stroke();
    // Legs
    ctx.fillStyle = '#3a3020';
    ctx.fillRect(-2 * z, 2 * z + bob, 2 * z, 5 * z);
    ctx.fillRect(1 * z, 2 * z + bob, 2 * z, 5 * z);
  }

  function drawCavalryUnit(ctx, z, palette, uData) {
    const gallop = Math.sin(time * 8 + uData.id) * 2 * z;
    // Horse body
    ctx.fillStyle = '#5c3a1e';
    ctx.beginPath();
    ctx.ellipse(0, 0 + gallop, 10 * z, 5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    // Horse head
    ctx.fillStyle = '#4a2e15';
    ctx.beginPath();
    ctx.ellipse(9 * z, -4 * z + gallop, 4 * z, 3 * z, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Horse legs
    ctx.strokeStyle = '#4a2e15';
    ctx.lineWidth = 1.5 * z;
    const legPhase = Math.sin(time * 8 + uData.id);
    ctx.beginPath();
    ctx.moveTo(-6 * z, 5 * z + gallop);
    ctx.lineTo(-7 * z, 10 * z + legPhase * 2 * z);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2 * z, 5 * z + gallop);
    ctx.lineTo(-1 * z, 10 * z - legPhase * 2 * z);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4 * z, 5 * z + gallop);
    ctx.lineTo(3 * z, 10 * z + legPhase * 2 * z);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8 * z, 5 * z + gallop);
    ctx.lineTo(9 * z, 10 * z - legPhase * 2 * z);
    ctx.stroke();
    // Rider body
    ctx.fillStyle = palette.primary;
    ctx.fillRect(-3 * z, -10 * z + gallop, 6 * z, 8 * z);
    // Rider head
    ctx.fillStyle = '#d4a574';
    ctx.beginPath();
    ctx.arc(0, -13 * z + gallop, 2.5 * z, 0, Math.PI * 2);
    ctx.fill();
    // Helmet
    ctx.fillStyle = '#777';
    ctx.beginPath();
    ctx.arc(0, -14 * z + gallop, 2.5 * z, Math.PI, 0);
    ctx.fill();
    // Lance
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.2 * z;
    ctx.beginPath();
    ctx.moveTo(4 * z, -8 * z + gallop);
    ctx.lineTo(16 * z, -16 * z + gallop);
    ctx.stroke();
    // Lance tip
    ctx.fillStyle = '#ccc';
    ctx.beginPath();
    ctx.moveTo(16 * z, -18 * z + gallop);
    ctx.lineTo(17 * z, -16 * z + gallop);
    ctx.lineTo(15 * z, -16 * z + gallop);
    ctx.fill();
    // Horse armor (barding)
    ctx.fillStyle = palette.dark;
    ctx.fillRect(-2 * z, -3 * z + gallop, 8 * z, 3 * z);
  }

  function drawSiegeUnit(ctx, z, palette, uData) {
    const rumble = Math.sin(time * 12 + uData.id) * 0.8 * z;
    // Wheels
    ctx.fillStyle = '#4a3520';
    ctx.beginPath();
    ctx.arc(-8 * z, 6 * z + rumble, 4 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8 * z, 6 * z + rumble, 4 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1 * z;
    ctx.stroke();
    // Platform
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(-12 * z, -2 * z + rumble, 24 * z, 6 * z);
    // Main structure (varies - tower/ram/catapult)
    ctx.fillStyle = '#6B4226';
    ctx.fillRect(-8 * z, -16 * z + rumble, 16 * z, 14 * z);
    // Metal reinforcement
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.5 * z;
    ctx.strokeRect(-8 * z, -16 * z + rumble, 16 * z, 14 * z);
    // Cross braces
    ctx.beginPath();
    ctx.moveTo(-8 * z, -16 * z + rumble);
    ctx.lineTo(8 * z, -2 * z + rumble);
    ctx.stroke();
    // Flag on top
    ctx.fillStyle = palette.primary;
    ctx.fillRect(-1 * z, -22 * z + rumble, 2 * z, 8 * z);
    ctx.fillRect(1 * z, -22 * z + rumble, 6 * z, 4 * z);
  }

  function drawFlyingUnit(ctx, z, palette, uData) {
    const hover = Math.sin(time * 3 + uData.id * 1.5) * 4 * z;
    const wingFlap = Math.sin(time * 6 + uData.id) * 0.4;
    // Body
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.ellipse(0, hover, 6 * z, 3.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.fillStyle = palette.secondary;
    ctx.beginPath();
    ctx.ellipse(5 * z, -2 * z + hover, 3 * z, 2.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eye
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(6.5 * z, -2.5 * z + hover, 0.8 * z, 0, Math.PI * 2);
    ctx.fill();
    // Beak
    ctx.fillStyle = '#d4a017';
    ctx.beginPath();
    ctx.moveTo(8 * z, -2 * z + hover);
    ctx.lineTo(11 * z, -1.5 * z + hover);
    ctx.lineTo(8 * z, -1 * z + hover);
    ctx.fill();
    // Wings
    ctx.fillStyle = palette.dark;
    ctx.save();
    ctx.translate(0, hover);
    // Left wing
    ctx.save();
    ctx.rotate(-wingFlap);
    ctx.beginPath();
    ctx.moveTo(-2 * z, 0);
    ctx.lineTo(-12 * z, -8 * z);
    ctx.lineTo(-5 * z, -1 * z);
    ctx.fill();
    ctx.restore();
    // Right wing
    ctx.save();
    ctx.rotate(wingFlap);
    ctx.beginPath();
    ctx.moveTo(-2 * z, 0);
    ctx.lineTo(-12 * z, 8 * z);
    ctx.lineTo(-5 * z, 1 * z);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // Tail
    ctx.fillStyle = palette.dark;
    ctx.beginPath();
    ctx.moveTo(-6 * z, hover);
    ctx.lineTo(-12 * z, -2 * z + hover);
    ctx.lineTo(-12 * z, 2 * z + hover);
    ctx.fill();
  }

  // ─── Orc Unit: Half Orc (infantry with axe) ────────────────────
  function drawHalfOrcUnit(ctx, z, palette, uData) {
    const bob = Math.sin(time * 6 + uData.id * 2) * 1.5 * z;
    // Body armor (heavier, greenish-brown)
    ctx.fillStyle = palette.primary;
    ctx.fillRect(-4.5 * z, -9 * z + bob, 9 * z, 11 * z);
    // Chest plate detail
    ctx.fillStyle = palette.dark;
    ctx.fillRect(-3 * z, -7 * z + bob, 6 * z, 4 * z);
    // Head (greenish tint)
    ctx.fillStyle = '#8a9a5a';
    ctx.beginPath();
    ctx.arc(0, -12 * z + bob, 3.8 * z, 0, Math.PI * 2);
    ctx.fill();
    // Helmet (iron with horn nubs)
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(0, -13 * z + bob, 3.8 * z, Math.PI, 0);
    ctx.fill();
    // Small horn nubs
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(-3 * z, -16 * z + bob);
    ctx.lineTo(-4.5 * z, -19 * z + bob);
    ctx.lineTo(-1.5 * z, -16 * z + bob);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(3 * z, -16 * z + bob);
    ctx.lineTo(4.5 * z, -19 * z + bob);
    ctx.lineTo(1.5 * z, -16 * z + bob);
    ctx.fill();
    // Eyes (angry)
    ctx.fillStyle = '#cc3300';
    ctx.fillRect(-2 * z, -12.5 * z + bob, 1.2 * z, 0.8 * z);
    ctx.fillRect(1 * z, -12.5 * z + bob, 1.2 * z, 0.8 * z);
    // Shield
    ctx.fillStyle = palette.dark;
    ctx.beginPath();
    ctx.ellipse(-5.5 * z, -4 * z + bob, 3 * z, 5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.secondary;
    ctx.lineWidth = 0.5 * z;
    ctx.stroke();
    // AXE (distinctive from sword)
    const swingAng = uData.state === 'fighting' ? Math.sin(time * 10) * 0.5 : 0;
    ctx.save();
    ctx.rotate(swingAng);
    // Axe handle
    ctx.strokeStyle = '#6B4226';
    ctx.lineWidth = 1.5 * z;
    ctx.beginPath();
    ctx.moveTo(5 * z, -4 * z + bob);
    ctx.lineTo(11 * z, -16 * z + bob);
    ctx.stroke();
    // Axe head (curved blade)
    ctx.fillStyle = '#999';
    ctx.beginPath();
    ctx.moveTo(10 * z, -14 * z + bob);
    ctx.quadraticCurveTo(15 * z, -17 * z + bob, 13 * z, -20 * z + bob);
    ctx.lineTo(9 * z, -17 * z + bob);
    ctx.fill();
    // Axe edge highlight
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 0.5 * z;
    ctx.beginPath();
    ctx.moveTo(10 * z, -14 * z + bob);
    ctx.quadraticCurveTo(15 * z, -17 * z + bob, 13 * z, -20 * z + bob);
    ctx.stroke();
    ctx.restore();
    // Legs (thick)
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(-3.5 * z, 2 * z + bob, 3 * z, 5.5 * z);
    ctx.fillRect(0.5 * z, 2 * z + bob, 3 * z, 5.5 * z);
  }

  // ─── Orc Unit: Goblin (smaller, with sack) ───────────────────
  function drawGoblinUnit(ctx, z, palette, uData) {
    const scl = 0.7; // Smaller than normal infantry
    const bob = Math.sin(time * 8 + uData.id * 3) * 1.2 * z;
    // Body (hunched)
    ctx.fillStyle = '#5a6a2a';
    ctx.fillRect(-3 * z * scl, -5 * z * scl + bob, 6 * z * scl, 7 * z * scl);
    // Head (large relative to body)
    ctx.fillStyle = '#7a8a3a';
    ctx.beginPath();
    ctx.arc(0, -8 * z * scl + bob, 3 * z * scl, 0, Math.PI * 2);
    ctx.fill();
    // Pointed ears
    ctx.fillStyle = '#6a7a2a';
    ctx.beginPath();
    ctx.moveTo(-3 * z * scl, -9 * z * scl + bob);
    ctx.lineTo(-6 * z * scl, -11 * z * scl + bob);
    ctx.lineTo(-2 * z * scl, -7 * z * scl + bob);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(3 * z * scl, -9 * z * scl + bob);
    ctx.lineTo(6 * z * scl, -11 * z * scl + bob);
    ctx.lineTo(2 * z * scl, -7 * z * scl + bob);
    ctx.fill();
    // Eyes (beady, yellow)
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(-1.2 * z * scl, -8 * z * scl + bob, 0.7 * z * scl, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(1.2 * z * scl, -8 * z * scl + bob, 0.7 * z * scl, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-1.2 * z * scl, -8 * z * scl + bob, 0.3 * z * scl, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(1.2 * z * scl, -8 * z * scl + bob, 0.3 * z * scl, 0, Math.PI * 2);
    ctx.fill();
    // Snaggle tooth
    ctx.fillStyle = '#eee';
    ctx.fillRect(-0.5 * z * scl, -5.5 * z * scl + bob, 1 * z * scl, 1.2 * z * scl);
    // Small dagger
    const swg = uData.state === 'fighting' ? Math.sin(time * 12) * 0.4 : 0;
    ctx.save();
    ctx.rotate(swg);
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 0.8 * z;
    ctx.beginPath();
    ctx.moveTo(4 * z * scl, -4 * z * scl + bob);
    ctx.lineTo(7 * z * scl, -9 * z * scl + bob);
    ctx.stroke();
    ctx.restore();
    // SACK on back (burlap colored)
    ctx.fillStyle = '#8B7355';
    ctx.beginPath();
    ctx.ellipse(-3 * z * scl, -2 * z * scl + bob, 3 * z * scl, 3.5 * z * scl, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Sack tie
    ctx.strokeStyle = '#6B5335';
    ctx.lineWidth = 0.6 * z;
    ctx.beginPath();
    ctx.moveTo(-3 * z * scl, -5.5 * z * scl + bob);
    ctx.lineTo(-4 * z * scl, -6 * z * scl + bob);
    ctx.stroke();
    // Sack texture lines
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.3 * z;
    ctx.beginPath();
    ctx.moveTo(-5 * z * scl, -3 * z * scl + bob);
    ctx.lineTo(-1 * z * scl, -1 * z * scl + bob);
    ctx.stroke();
    // Legs (short)
    ctx.fillStyle = '#5a6a2a';
    ctx.fillRect(-2.5 * z * scl, 2 * z * scl + bob, 2 * z * scl, 4 * z * scl);
    ctx.fillRect(0.5 * z * scl, 2 * z * scl + bob, 2 * z * scl, 4 * z * scl);
  }

  // ─── Orc Unit: Troll Javelineer (holding javelins, purple tips) ─
  function drawTrollUnit(ctx, z, palette, uData) {
    const bob = Math.sin(time * 5 + uData.id * 3) * 1 * z;
    // Body (large, lean, bluish-green)
    ctx.fillStyle = '#4a6a5a';
    ctx.fillRect(-4 * z, -10 * z + bob, 8 * z, 13 * z);
    // Loincloth
    ctx.fillStyle = '#5c4033';
    ctx.beginPath();
    ctx.moveTo(-4 * z, 2 * z + bob);
    ctx.lineTo(0, 5 * z + bob);
    ctx.lineTo(4 * z, 2 * z + bob);
    ctx.fill();
    // Head
    ctx.fillStyle = '#5a8a6a';
    ctx.beginPath();
    ctx.ellipse(0, -13 * z + bob, 3.5 * z, 4 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    // Long nose
    ctx.fillStyle = '#5a8a6a';
    ctx.beginPath();
    ctx.moveTo(2 * z, -13 * z + bob);
    ctx.lineTo(5 * z, -12 * z + bob);
    ctx.lineTo(2 * z, -11.5 * z + bob);
    ctx.fill();
    // Eyes (mean, narrow)
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(-2 * z, -14 * z + bob, 1.5 * z, 0.8 * z);
    ctx.fillRect(0.5 * z, -14 * z + bob, 1.5 * z, 0.8 * z);
    // Tusks
    ctx.fillStyle = '#ddd';
    ctx.beginPath();
    ctx.moveTo(-1.5 * z, -10 * z + bob);
    ctx.lineTo(-2 * z, -8 * z + bob);
    ctx.lineTo(-0.5 * z, -10 * z + bob);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(1.5 * z, -10 * z + bob);
    ctx.lineTo(2 * z, -8 * z + bob);
    ctx.lineTo(0.5 * z, -10 * z + bob);
    ctx.fill();
    // Javelin bundle (held in off-hand, 2-3 javelins on back)
    ctx.strokeStyle = '#6B4226';
    ctx.lineWidth = 1 * z;
    ctx.beginPath();
    ctx.moveTo(-5 * z, -6 * z + bob);
    ctx.lineTo(-3 * z, -20 * z + bob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4 * z, -5 * z + bob);
    ctx.lineTo(-1 * z, -19 * z + bob);
    ctx.stroke();
    // Purple tips on back javelins
    ctx.fillStyle = '#8844aa';
    ctx.beginPath();
    ctx.moveTo(-3 * z, -20 * z + bob);
    ctx.lineTo(-3.8 * z, -22 * z + bob);
    ctx.lineTo(-2.2 * z, -22 * z + bob);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-1 * z, -19 * z + bob);
    ctx.lineTo(-1.8 * z, -21 * z + bob);
    ctx.lineTo(-0.2 * z, -21 * z + bob);
    ctx.fill();
    // Throwing javelin (active, in attack hand)
    const throwAng = uData.state === 'fighting' ? Math.sin(time * 10) * 0.6 : 0.3;
    ctx.save();
    ctx.rotate(throwAng - 0.3);
    ctx.strokeStyle = '#6B4226';
    ctx.lineWidth = 1.2 * z;
    ctx.beginPath();
    ctx.moveTo(4 * z, -2 * z + bob);
    ctx.lineTo(12 * z, -18 * z + bob);
    ctx.stroke();
    // Purple poison drop on javelin tip
    ctx.fillStyle = '#9955cc';
    ctx.beginPath();
    ctx.moveTo(12 * z, -18 * z + bob);
    ctx.lineTo(11 * z, -21 * z + bob);
    ctx.lineTo(13 * z, -21 * z + bob);
    ctx.fill();
    // Poison drip
    const drip = Math.sin(time * 4 + uData.id) * 0.5 * z;
    ctx.fillStyle = 'rgba(153, 85, 204, 0.6)';
    ctx.beginPath();
    ctx.ellipse(12 * z, -17 * z + bob + drip, 0.8 * z, 1.2 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Legs (long, lanky)
    ctx.fillStyle = '#4a6a5a';
    ctx.fillRect(-3 * z, 3 * z + bob, 2.5 * z, 6 * z);
    ctx.fillRect(0.5 * z, 3 * z + bob, 2.5 * z, 6 * z);
  }

  // ─── Orc Unit: Thrall (large siege unit with hammer + armor) ──
  function drawThrallUnit(ctx, z, palette, uData) {
    const rumble = Math.sin(time * 4 + uData.id) * 1 * z;
    const scale = 1.3; // Larger than normal
    const sz = z * scale;
    // Legs (heavy armored)
    ctx.fillStyle = '#3a3a30';
    ctx.fillRect(-4 * sz, 4 * sz + rumble, 3.5 * sz, 7 * sz);
    ctx.fillRect(0.5 * sz, 4 * sz + rumble, 3.5 * sz, 7 * sz);
    // Leg armor plates
    ctx.fillStyle = '#555';
    ctx.fillRect(-4 * sz, 4 * sz + rumble, 3.5 * sz, 2 * sz);
    ctx.fillRect(0.5 * sz, 4 * sz + rumble, 3.5 * sz, 2 * sz);
    // Body (massive armored torso)
    const armorGrad = ctx.createLinearGradient(-6 * sz, -12 * sz, 6 * sz, 4 * sz);
    armorGrad.addColorStop(0, '#4a5a2a');
    armorGrad.addColorStop(0.5, '#3a4a1a');
    armorGrad.addColorStop(1, '#4a5a2a');
    ctx.fillStyle = armorGrad;
    ctx.fillRect(-6 * sz, -12 * sz + rumble, 12 * sz, 16 * sz);
    // Big armor plates on chest
    ctx.fillStyle = '#666';
    ctx.fillRect(-5 * sz, -10 * sz + rumble, 4 * sz, 6 * sz);
    ctx.fillRect(1 * sz, -10 * sz + rumble, 4 * sz, 6 * sz);
    // Metal rivets
    ctx.fillStyle = '#888';
    ctx.beginPath(); ctx.arc(-3 * sz, -9 * sz + rumble, 0.5 * sz, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3 * sz, -9 * sz + rumble, 0.5 * sz, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-3 * sz, -6 * sz + rumble, 0.5 * sz, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3 * sz, -6 * sz + rumble, 0.5 * sz, 0, Math.PI * 2); ctx.fill();
    // Belt
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(-6 * sz, 1 * sz + rumble, 12 * sz, 2.5 * sz);
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(-1 * sz, 0.5 * sz + rumble, 2 * sz, 3 * sz);
    // Shoulder pauldrons (big)
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.ellipse(-7 * sz, -10 * sz + rumble, 4 * sz, 3 * sz, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(7 * sz, -10 * sz + rumble, 4 * sz, 3 * sz, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Pauldron spikes
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(-8 * sz, -13 * sz + rumble);
    ctx.lineTo(-9 * sz, -16 * sz + rumble);
    ctx.lineTo(-7 * sz, -13 * sz + rumble);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8 * sz, -13 * sz + rumble);
    ctx.lineTo(9 * sz, -16 * sz + rumble);
    ctx.lineTo(7 * sz, -13 * sz + rumble);
    ctx.fill();
    // Head (orcish, strong jaw)
    ctx.fillStyle = '#7a8a4a';
    ctx.beginPath();
    ctx.arc(0, -16 * sz + rumble, 4.5 * sz, 0, Math.PI * 2);
    ctx.fill();
    // Eyes (glowing blue-white, storm magic)
    ctx.fillStyle = '#aaddff';
    ctx.beginPath();
    ctx.arc(-1.5 * sz, -16.5 * sz + rumble, 1 * sz, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(1.5 * sz, -16.5 * sz + rumble, 1 * sz, 0, Math.PI * 2);
    ctx.fill();
    // Eye glow
    ctx.fillStyle = 'rgba(170, 220, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(0, -16.5 * sz + rumble, 3 * sz, 0, Math.PI * 2);
    ctx.fill();
    // War paint lines under eyes
    ctx.strokeStyle = '#3a4a1a';
    ctx.lineWidth = 0.6 * sz;
    ctx.beginPath();
    ctx.moveTo(-3 * sz, -15 * sz + rumble);
    ctx.lineTo(-4 * sz, -13 * sz + rumble);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3 * sz, -15 * sz + rumble);
    ctx.lineTo(4 * sz, -13 * sz + rumble);
    ctx.stroke();
    // HAMMER (massive war hammer)
    const hammerSwing = uData.state === 'fighting' ? Math.sin(time * 8) * 0.7 : 0;
    ctx.save();
    ctx.rotate(hammerSwing);
    // Handle
    ctx.strokeStyle = '#6B4226';
    ctx.lineWidth = 2 * sz;
    ctx.beginPath();
    ctx.moveTo(7 * sz, -6 * sz + rumble);
    ctx.lineTo(16 * sz, -22 * sz + rumble);
    ctx.stroke();
    // Hammer head (blocky iron)
    ctx.fillStyle = '#666';
    ctx.fillRect(13 * sz, -26 * sz + rumble, 7 * sz, 8 * sz);
    // Hammer face detail
    ctx.fillStyle = '#888';
    ctx.fillRect(18 * sz, -25 * sz + rumble, 2 * sz, 6 * sz);
    // Lightning rune on hammer
    ctx.strokeStyle = '#aaddff';
    ctx.lineWidth = 0.5 * sz;
    const runePulse = 0.5 + Math.sin(time * 5) * 0.5;
    ctx.globalAlpha = runePulse;
    ctx.beginPath();
    ctx.moveTo(15 * sz, -25 * sz + rumble);
    ctx.lineTo(16.5 * sz, -22.5 * sz + rumble);
    ctx.lineTo(15 * sz, -22.5 * sz + rumble);
    ctx.lineTo(17 * sz, -20 * sz + rumble);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ─── Orc Unit: Warlock (wizard with hat, gown, staff) ─────────
  function drawWarlockUnit(ctx, z, palette, uData) {
    const bob = Math.sin(time * 3 + uData.id * 2) * 1 * z;
    const float = Math.sin(time * 2) * 2 * z;
    // Gown (long flowing robe)
    const gownGrad = ctx.createLinearGradient(0, -8 * z, 0, 8 * z);
    gownGrad.addColorStop(0, '#2a1a3a');
    gownGrad.addColorStop(1, '#1a0a2a');
    ctx.fillStyle = gownGrad;
    ctx.beginPath();
    ctx.moveTo(-4 * z, -6 * z + bob + float);
    ctx.lineTo(-6 * z, 7 * z + bob + float);
    ctx.lineTo(6 * z, 7 * z + bob + float);
    ctx.lineTo(4 * z, -6 * z + bob + float);
    ctx.fill();
    // Gown trim (glowing purple)
    ctx.strokeStyle = '#8844aa';
    ctx.lineWidth = 0.6 * z;
    ctx.beginPath();
    ctx.moveTo(-6 * z, 7 * z + bob + float);
    ctx.lineTo(6 * z, 7 * z + bob + float);
    ctx.stroke();
    // Body/chest
    ctx.fillStyle = '#3a2a4a';
    ctx.fillRect(-3.5 * z, -6 * z + bob + float, 7 * z, 8 * z);
    // Rune emblem on chest
    ctx.strokeStyle = '#9966cc';
    ctx.lineWidth = 0.4 * z;
    ctx.beginPath();
    ctx.arc(0, -3 * z + bob + float, 2 * z, 0, Math.PI * 2);
    ctx.stroke();
    // Head (shadowed face)
    ctx.fillStyle = '#7a8a4a';
    ctx.beginPath();
    ctx.arc(0, -10 * z + bob + float, 3 * z, 0, Math.PI * 2);
    ctx.fill();
    // Glowing eyes
    ctx.fillStyle = '#aa44ff';
    ctx.beginPath();
    ctx.arc(-1 * z, -10.5 * z + bob + float, 0.7 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(1.5 * z, -10.5 * z + bob + float, 0.7 * z, 0, Math.PI * 2);
    ctx.fill();
    // BIG WIZARD HAT
    ctx.fillStyle = '#2a1a3a';
    ctx.beginPath();
    ctx.moveTo(-5 * z, -12 * z + bob + float);
    ctx.lineTo(0, -28 * z + bob + float);
    ctx.lineTo(5 * z, -12 * z + bob + float);
    ctx.fill();
    // Hat brim
    ctx.fillStyle = '#3a2a4a';
    ctx.beginPath();
    ctx.ellipse(0, -12 * z + bob + float, 6 * z, 1.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hat band with rune
    ctx.fillStyle = '#8844aa';
    ctx.fillRect(-4.5 * z, -14 * z + bob + float, 9 * z, 1.5 * z);
    // Hat tip star
    const starPulse = 0.5 + Math.sin(time * 4) * 0.5;
    ctx.fillStyle = `rgba(170, 100, 255, ${starPulse.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(0, -28 * z + bob + float, 1.5 * z, 0, Math.PI * 2);
    ctx.fill();
    // STAFF (held in right hand)
    ctx.strokeStyle = '#5a4a3a';
    ctx.lineWidth = 1.5 * z;
    ctx.beginPath();
    ctx.moveTo(5 * z, -4 * z + bob + float);
    ctx.lineTo(7 * z, -22 * z + bob + float);
    ctx.stroke();
    // Staff orb
    ctx.fillStyle = '#7733aa';
    ctx.beginPath();
    ctx.arc(7 * z, -23 * z + bob + float, 2 * z, 0, Math.PI * 2);
    ctx.fill();
    // Staff orb glow
    const orbPulse = 0.3 + Math.sin(time * 3 + 1) * 0.2;
    const orbGlow = ctx.createRadialGradient(7 * z, -23 * z + bob + float, 0, 7 * z, -23 * z + bob + float, 5 * z);
    orbGlow.addColorStop(0, `rgba(140, 80, 200, ${orbPulse.toFixed(2)})`);
    orbGlow.addColorStop(1, 'rgba(140, 80, 200, 0)');
    ctx.fillStyle = orbGlow;
    ctx.beginPath();
    ctx.arc(7 * z, -23 * z + bob + float, 5 * z, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── Orc Unit: Void Walker (big purple genie with armor) ──────
  function drawVoidWalkerUnit(ctx, z, palette, uData) {
    const hover = Math.sin(time * 2 + uData.id) * 3 * z;
    const scale = 1.4;
    const sz = z * scale;
    // Ghostly lower body (genie tail — wispy, no legs)
    const tailGrad = ctx.createLinearGradient(0, 0 + hover, 0, 12 * sz + hover);
    tailGrad.addColorStop(0, 'rgba(120, 60, 180, 0.8)');
    tailGrad.addColorStop(1, 'rgba(120, 60, 180, 0)');
    ctx.fillStyle = tailGrad;
    ctx.beginPath();
    ctx.moveTo(-5 * sz, 0 + hover);
    const tailWave = Math.sin(time * 3 + uData.id) * 3 * sz;
    ctx.quadraticCurveTo(-3 * sz, 6 * sz + hover, tailWave, 12 * sz + hover);
    ctx.quadraticCurveTo(3 * sz, 6 * sz + hover, 5 * sz, 0 + hover);
    ctx.fill();
    // Torso (large, purple, muscular)
    const bodyGrad = ctx.createLinearGradient(-6 * sz, -14 * sz, 6 * sz, 0);
    bodyGrad.addColorStop(0, '#7733aa');
    bodyGrad.addColorStop(0.5, '#9955cc');
    bodyGrad.addColorStop(1, '#7733aa');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(-6 * sz, -12 * sz + hover, 12 * sz, 12 * sz);
    // Armor chest plate
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(-4 * sz, -10 * sz + hover);
    ctx.lineTo(0, -12 * sz + hover);
    ctx.lineTo(4 * sz, -10 * sz + hover);
    ctx.lineTo(3 * sz, -4 * sz + hover);
    ctx.lineTo(-3 * sz, -4 * sz + hover);
    ctx.fill();
    // Armor detail lines
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 0.5 * sz;
    ctx.beginPath();
    ctx.moveTo(0, -12 * sz + hover);
    ctx.lineTo(0, -4 * sz + hover);
    ctx.stroke();
    // Shoulder guards
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.ellipse(-7 * sz, -10 * sz + hover, 3 * sz, 2 * sz, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(7 * sz, -10 * sz + hover, 3 * sz, 2 * sz, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Arms (big, purple)
    ctx.fillStyle = '#8844bb';
    ctx.fillRect(-8 * sz, -9 * sz + hover, 3 * sz, 8 * sz);
    ctx.fillRect(5 * sz, -9 * sz + hover, 3 * sz, 8 * sz);
    // Fists
    ctx.fillStyle = '#9955cc';
    ctx.beginPath();
    ctx.arc(-7 * sz, 0 + hover, 2 * sz, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6 * sz, 0 + hover, 2 * sz, 0, Math.PI * 2);
    ctx.fill();
    // Head (bald, fierce)
    ctx.fillStyle = '#9955cc';
    ctx.beginPath();
    ctx.arc(0, -16 * sz + hover, 4 * sz, 0, Math.PI * 2);
    ctx.fill();
    // Eyes (glowing yellow-white)
    ctx.fillStyle = '#ffffaa';
    ctx.beginPath();
    ctx.ellipse(-1.5 * sz, -16.5 * sz + hover, 1.2 * sz, 0.7 * sz, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(1.5 * sz, -16.5 * sz + hover, 1.2 * sz, 0.7 * sz, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ethereal glow around body
    ctx.globalAlpha = 0.15 + Math.sin(time * 2) * 0.08;
    const auraGrad = ctx.createRadialGradient(0, -6 * sz + hover, 0, 0, -6 * sz + hover, 14 * sz);
    auraGrad.addColorStop(0, 'rgba(140, 80, 220, 0.3)');
    auraGrad.addColorStop(1, 'rgba(140, 80, 220, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, -6 * sz + hover, 14 * sz, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ─── Orc Unit: Imp (small red skinned with horns) ─────────────
  function drawImpUnit(ctx, z, palette, uData) {
    const scl = 0.6;
    const bob = Math.sin(time * 10 + uData.id * 4) * 1.5 * z;
    // Body (small, red)
    ctx.fillStyle = '#cc3322';
    ctx.fillRect(-3 * z * scl, -5 * z * scl + bob, 6 * z * scl, 7 * z * scl);
    // Head (round, red)
    ctx.fillStyle = '#dd4433';
    ctx.beginPath();
    ctx.arc(0, -8 * z * scl + bob, 3 * z * scl, 0, Math.PI * 2);
    ctx.fill();
    // Horns (curved, dark)
    ctx.fillStyle = '#441111';
    ctx.beginPath();
    ctx.moveTo(-2 * z * scl, -10 * z * scl + bob);
    ctx.quadraticCurveTo(-5 * z * scl, -14 * z * scl + bob, -3 * z * scl, -15 * z * scl + bob);
    ctx.lineTo(-1.5 * z * scl, -11 * z * scl + bob);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2 * z * scl, -10 * z * scl + bob);
    ctx.quadraticCurveTo(5 * z * scl, -14 * z * scl + bob, 3 * z * scl, -15 * z * scl + bob);
    ctx.lineTo(1.5 * z * scl, -11 * z * scl + bob);
    ctx.fill();
    // Eyes (glowing yellow, mischievous)
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(-1 * z * scl, -8.5 * z * scl + bob, 0.8 * z * scl, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(1 * z * scl, -8.5 * z * scl + bob, 0.8 * z * scl, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-1 * z * scl, -8.5 * z * scl + bob, 0.3 * z * scl, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(1 * z * scl, -8.5 * z * scl + bob, 0.3 * z * scl, 0, Math.PI * 2);
    ctx.fill();
    // Grin
    ctx.strokeStyle = '#881100';
    ctx.lineWidth = 0.4 * z;
    ctx.beginPath();
    ctx.arc(0, -7 * z * scl + bob, 1.5 * z * scl, 0.2, Math.PI - 0.2);
    ctx.stroke();
    // Claws
    const swg = uData.state === 'fighting' ? Math.sin(time * 14) * 0.3 : 0;
    ctx.save();
    ctx.rotate(swg);
    ctx.strokeStyle = '#aa2211';
    ctx.lineWidth = 0.6 * z;
    ctx.beginPath();
    ctx.moveTo(4 * z * scl, -4 * z * scl + bob);
    ctx.lineTo(6 * z * scl, -6 * z * scl + bob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4 * z * scl, -3 * z * scl + bob);
    ctx.lineTo(6.5 * z * scl, -4 * z * scl + bob);
    ctx.stroke();
    ctx.restore();
    // Legs (tiny, red)
    ctx.fillStyle = '#bb2211';
    ctx.fillRect(-2 * z * scl, 2 * z * scl + bob, 1.5 * z * scl, 3.5 * z * scl);
    ctx.fillRect(0.5 * z * scl, 2 * z * scl + bob, 1.5 * z * scl, 3.5 * z * scl);
    // Fire wisps around body
    const fireAlpha = 0.3 + Math.sin(time * 6 + uData.id) * 0.2;
    ctx.fillStyle = `rgba(255, 100, 0, ${fireAlpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(3 * z * scl, -3 * z * scl + bob + Math.sin(time * 8) * z, 1 * z * scl, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 200, 0, ${(fireAlpha * 0.7).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(-3 * z * scl, -1 * z * scl + bob + Math.cos(time * 7) * z, 0.8 * z * scl, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── Debuff Icons ─────────────────────────────────────────────
  function drawPoisonIcon(x, y, z, stacks) {
    // Poison skull/droplet icon
    ctx.fillStyle = '#44bb44';
    ctx.beginPath();
    ctx.arc(x, y, 4 * z, 0, Math.PI * 2);
    ctx.fill();
    // Skull face
    ctx.fillStyle = '#115511';
    ctx.beginPath();
    ctx.arc(x - 1 * z, y - 0.5 * z, 0.6 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 1 * z, y - 0.5 * z, 0.6 * z, 0, Math.PI * 2);
    ctx.fill();
    // Drip
    ctx.fillStyle = '#44bb44';
    ctx.beginPath();
    ctx.moveTo(x, y + 4 * z);
    ctx.lineTo(x - 1 * z, y + 6 * z);
    ctx.lineTo(x + 1 * z, y + 6 * z);
    ctx.fill();
    // Stack count
    if (stacks > 1) {
      ctx.font = `bold ${6 * z}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(stacks, x, y + 2.5 * z);
    }
  }

  function drawBurnIcon(x, y, z, stacks) {
    // Fire icon
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(x, y - 4 * z);
    ctx.quadraticCurveTo(x + 3 * z, y - 1 * z, x + 2 * z, y + 2 * z);
    ctx.quadraticCurveTo(x, y + 4 * z, x - 2 * z, y + 2 * z);
    ctx.quadraticCurveTo(x - 3 * z, y - 1 * z, x, y - 4 * z);
    ctx.fill();
    // Inner flame
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(x, y - 2 * z);
    ctx.quadraticCurveTo(x + 1.5 * z, y, x + 1 * z, y + 1.5 * z);
    ctx.quadraticCurveTo(x, y + 2.5 * z, x - 1 * z, y + 1.5 * z);
    ctx.quadraticCurveTo(x - 1.5 * z, y, x, y - 2 * z);
    ctx.fill();
    // Stack count
    if (stacks > 1) {
      ctx.font = `bold ${6 * z}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(stacks, x, y + 2 * z);
    }
  }

  // ─── Health Bar ─────────────────────────────────────────────────
  function drawHealthBar(x, y, w, hp, maxHp, type) {
    const pct = Math.max(0, hp / maxHp);
    const halfW = w / 2;
    const h = 4 * camera.zoom;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - halfW - 1, y - 1, w + 2, h + 2);

    // Bar color
    let color;
    if (type === 'friendly') {
      color = pct > 0.5 ? '#4a8c3f' : pct > 0.25 ? '#c4a03a' : '#b22222';
    } else {
      color = pct > 0.5 ? '#b22222' : pct > 0.25 ? '#c4a03a' : '#8b1a1a';
    }

    ctx.fillStyle = color;
    ctx.fillRect(x - halfW, y, w * pct, h);

    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x - halfW, y, w * pct, h / 2);

    // Border
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.3)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x - halfW - 1, y - 1, w + 2, h + 2);
  }

  // ─── Draw Projectiles ──────────────────────────────────────────
  function drawProjectiles(projectiles) {
    const now = Date.now();
    for (const p of projectiles) {
      const elapsed = (now - p.time) / 350;
      if (elapsed > 1) continue;

      const px = p.x + (p.tx - p.x) * elapsed;
      const py = p.y + (p.ty - p.y) * elapsed - Math.sin(elapsed * Math.PI) * 30;

      if (!isVisible(px, py, 20)) continue;
      const pos = worldToScreen(px, py);
      const z = camera.zoom;

      const palette = CHAR_PALETTES[p.characterId] || CHAR_PALETTES.northern_lord;

      // Glow trail
      ctx.fillStyle = palette.secondary;
      ctx.globalAlpha = 0.6 * (1 - elapsed);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3 * z, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.globalAlpha = 1 - elapsed * 0.5;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 1.5 * z, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
    }
  }

  // ─── Draw Damage Numbers ───────────────────────────────────────
  function drawDamageNumbers(dmgNums) {
    const now = Date.now();
    for (const d of dmgNums) {
      const elapsed = (now - d.time) / 1200;
      if (elapsed > 1) continue;

      const wx = d.x + (Math.sin(d.x) * 10) * elapsed;
      const wy = d.y - elapsed * 50;
      if (!isVisible(wx, wy, 20)) continue;
      const pos = worldToScreen(wx, wy);
      const z = camera.zoom;

      ctx.globalAlpha = 1 - elapsed;
      ctx.font = `bold ${Math.max(10, 13 * z)}px Cinzel, serif`;
      ctx.textAlign = 'center';

      if (d.isHeal) {
        // Green heal numbers
        ctx.fillStyle = '#000';
        ctx.fillText('+' + d.value, pos.x + 1, pos.y + 1);
        ctx.fillStyle = '#44dd44';
        ctx.fillText('+' + d.value, pos.x, pos.y);
      } else {
        // Shadow
        ctx.fillStyle = '#000';
        ctx.fillText('-' + d.value, pos.x + 1, pos.y + 1);
        // Text
        ctx.fillStyle = '#ff4444';
        ctx.fillText('-' + d.value, pos.x, pos.y);
      }

      ctx.globalAlpha = 1;
    }
  }

  // ─── Draw Effects ──────────────────────────────────────────────
  function drawEffects(effects) {
    const now = Date.now();
    for (const e of effects) {
      const elapsed = now - e.time;
      const progress = Math.min(1, elapsed / e.duration);

      if (e.type === 'rescue_strike') {
        if (!isVisible(e.x, e.y, e.radius + 100)) continue;
        const pos = worldToScreen(e.x, e.y);
        const z = camera.zoom;
        const r = e.radius * z;

        // Expanding shockwave ring
        const ringR = r * Math.min(1, progress * 2);
        ctx.strokeStyle = `rgba(255, 215, 0, ${1 - progress})`;
        ctx.lineWidth = (8 - progress * 8) * z;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ringR, 0, Math.PI * 2);
        ctx.stroke();

        // Inner flash
        if (progress < 0.3) {
          const flashAlpha = (0.3 - progress) / 0.3;
          const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, ringR);
          grad.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha * 0.8})`);
          grad.addColorStop(0.5, `rgba(255, 215, 0, ${flashAlpha * 0.3})`);
          grad.addColorStop(1, 'rgba(255, 200, 0, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, ringR, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (e.type === 'construction') {
        if (!isVisible(e.x, e.y, 40)) continue;
        const pos = worldToScreen(e.x, e.y);
        particles.constructionEffect(e.x, e.y);
      } else if (e.type === 'building_destroy') {
        if (elapsed < 100) {
          particles.buildingDestroyEffect(e.x, e.y);
        }
      } else if (e.type === 'death') {
        if (elapsed < 100) {
          particles.deathEffect(e.x, e.y, e.unitType);
          // Goblin death: orange ooze puddle effect
          if (e.typeId === 'goblin') {
            particles.emit({
              x: e.x, y: e.y, count: 8, spread: 15,
              vx: 0, vy: 5, vxSpread: 20, vySpread: 10,
              life: 500, size: 3, sizeEnd: 1,
              color: '#d48c28', alpha: 0.8, alphaEnd: 0,
              gravity: 20, shape: 'circle'
            });
          }
        }
      } else if (e.type === 'chain_lightning') {
        // Draw lightning bolt between two points
        if (!isVisible(e.x, e.y, 200)) continue;
        const fromPos = worldToScreen(e.x, e.y);
        const toPos = worldToScreen(e.tx, e.ty);
        const z = camera.zoom;
        const alpha = 1 - progress;
        ctx.strokeStyle = `rgba(170, 220, 255, ${alpha.toFixed(2)})`;
        ctx.lineWidth = (3 - progress * 2) * z;
        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        // Jagged lightning path (3 segments)
        const midX1 = fromPos.x + (toPos.x - fromPos.x) * 0.33 + (Math.sin(time * 20 + e.x) * 8 * z);
        const midY1 = fromPos.y + (toPos.y - fromPos.y) * 0.33 + (Math.cos(time * 20 + e.y) * 8 * z);
        const midX2 = fromPos.x + (toPos.x - fromPos.x) * 0.66 + (Math.cos(time * 20 + e.tx) * 6 * z);
        const midY2 = fromPos.y + (toPos.y - fromPos.y) * 0.66 + (Math.sin(time * 20 + e.ty) * 6 * z);
        ctx.lineTo(midX1, midY1);
        ctx.lineTo(midX2, midY2);
        ctx.lineTo(toPos.x, toPos.y);
        ctx.stroke();
        // Glow
        ctx.strokeStyle = `rgba(255, 255, 255, ${(alpha * 0.5).toFixed(2)})`;
        ctx.lineWidth = (1.5 - progress) * z;
        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.lineTo(midX1, midY1);
        ctx.lineTo(midX2, midY2);
        ctx.lineTo(toPos.x, toPos.y);
        ctx.stroke();
      } else if (e.type === 'heal_particle') {
        // Green healing particles rising up
        if (!isVisible(e.x, e.y, 40)) continue;
        const pos = worldToScreen(e.x, e.y);
        const z = camera.zoom;
        const alpha = 1 - progress;
        for (let i = 0; i < 3; i++) {
          const px = pos.x + Math.sin(time * 5 + i * 2.1 + e.x) * 6 * z;
          const py = pos.y - progress * 25 * z - i * 5 * z;
          ctx.fillStyle = `rgba(80, 220, 80, ${(alpha * 0.6).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(px, py, (2 - progress * 1.5) * z, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (e.type === 'summon') {
        // Purple void rift summoning animation
        if (!isVisible(e.x, e.y, 60)) continue;
        const pos = worldToScreen(e.x, e.y);
        const z = camera.zoom;
        const alpha = 1 - progress;
        const riftR = (5 + progress * 15) * z;
        // Rift circle
        ctx.strokeStyle = `rgba(140, 60, 200, ${alpha.toFixed(2)})`;
        ctx.lineWidth = (3 - progress * 2) * z;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, riftR, riftR * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Inner glow
        const riftGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, riftR);
        riftGrad.addColorStop(0, `rgba(100, 40, 180, ${(alpha * 0.4).toFixed(2)})`);
        riftGrad.addColorStop(1, 'rgba(100, 40, 180, 0)');
        ctx.fillStyle = riftGrad;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, riftR, riftR * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'slow_pool') {
        // Orange ooze puddle on ground
        if (!isVisible(e.x, e.y, 80)) continue;
        const pos = worldToScreen(e.x, e.y);
        const z = camera.zoom;
        const alpha = Math.min(1, (1 - progress) * 2);
        const poolR = 60 * z * Math.min(1, progress * 5 + 0.5);
        // Puddle
        const puddleGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, poolR);
        puddleGrad.addColorStop(0, `rgba(210, 140, 40, ${(0.35 * alpha).toFixed(2)})`);
        puddleGrad.addColorStop(0.6, `rgba(180, 110, 30, ${(0.25 * alpha).toFixed(2)})`);
        puddleGrad.addColorStop(1, 'rgba(180, 110, 30, 0)');
        ctx.fillStyle = puddleGrad;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, poolR, poolR * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Bubbles
        const bubbleAlpha = alpha * 0.5;
        ctx.fillStyle = `rgba(230, 160, 50, ${bubbleAlpha.toFixed(2)})`;
        for (let i = 0; i < 3; i++) {
          const bx = pos.x + Math.sin(time * 2 + i * 2.5) * poolR * 0.4;
          const by = pos.y + Math.cos(time * 1.5 + i * 3.2) * poolR * 0.2;
          ctx.beginPath();
          ctx.arc(bx, by, (1 + Math.sin(time * 3 + i)) * z, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (e.type === 'spell_shield') {
        // Blue shield effect
        if (!isVisible(e.x, e.y, 40)) continue;
        const pos = worldToScreen(e.x, e.y);
        const z = camera.zoom;
        const alpha = 1 - progress;
        ctx.strokeStyle = `rgba(100, 180, 255, ${alpha.toFixed(2)})`;
        ctx.lineWidth = 2 * z;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, (8 + progress * 5) * z, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.type === 'spell_shield_break') {
        // Shield shattering
        if (!isVisible(e.x, e.y, 40)) continue;
        const pos = worldToScreen(e.x, e.y);
        const z = camera.zoom;
        const alpha = 1 - progress;
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const dist = progress * 15 * z;
          ctx.fillStyle = `rgba(100, 180, 255, ${(alpha * 0.6).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(pos.x + Math.cos(angle) * dist, pos.y + Math.sin(angle) * dist, (2 - progress * 1.5) * z, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // ─── Draw Base Area Highlight ──────────────────────────────────
  function drawBaseHighlight(isPlacing) {
    if (!isPlacing) return;
    const GC = GAME_CONSTANTS;
    const z = camera.zoom;

    let minX, maxX;
    if (mySide === 'left') {
      minX = GC.P1_BASE_MIN_X;
      maxX = GC.P1_BASE_MAX_X;
    } else {
      minX = GC.P2_BASE_MIN_X;
      maxX = GC.P2_BASE_MAX_X;
    }

    const tl = worldToScreen(minX, GC.BASE_MIN_Y);
    const br = worldToScreen(maxX, GC.BASE_MAX_Y);
    const w = br.x - tl.x;
    const h = br.y - tl.y;

    ctx.fillStyle = 'rgba(100, 200, 100, 0.08)';
    ctx.fillRect(tl.x, tl.y, w, h);

    ctx.strokeStyle = 'rgba(100, 200, 100, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(tl.x, tl.y, w, h);
    ctx.setLineDash([]);

    // Grid
    ctx.strokeStyle = 'rgba(100, 200, 100, 0.1)';
    ctx.lineWidth = 0.5;
    const gridSize = GC.BUILDING_GRID_SIZE;
    const startX = Math.ceil(minX / gridSize) * gridSize;
    const startY = Math.ceil(GC.BASE_MIN_Y / gridSize) * gridSize;

    for (let gx = startX; gx <= maxX; gx += gridSize) {
      const sp = worldToScreen(gx, GC.BASE_MIN_Y);
      const ep = worldToScreen(gx, GC.BASE_MAX_Y);
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(ep.x, ep.y);
      ctx.stroke();
    }
    for (let gy = startY; gy <= GC.BASE_MAX_Y; gy += gridSize) {
      const sp = worldToScreen(minX, gy);
      const ep = worldToScreen(maxX, gy);
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(ep.x, ep.y);
      ctx.stroke();
    }
  }

  // ─── Draw Build Ghost ─────────────────────────────────────────
  function drawBuildGhost(mouseWorld, selectedBuilding) {
    if (!mouseWorld || !selectedBuilding) return;
    const GC = GAME_CONSTANTS;
    const gx = Math.round(mouseWorld.x / GC.BUILDING_GRID_SIZE) * GC.BUILDING_GRID_SIZE;
    const gy = Math.round(mouseWorld.y / GC.BUILDING_GRID_SIZE) * GC.BUILDING_GRID_SIZE;

    const pos = worldToScreen(gx, gy);
    const z = camera.zoom;

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(100, 200, 100, 0.3)';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 25 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100, 200, 100, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ─── Draw Minimap ─────────────────────────────────────────────
  function drawMinimap(minimapCanvas, state) {
    const mCtx = minimapCanvas.getContext('2d');
    const mW = minimapCanvas.width;
    const mH = minimapCanvas.height;
    const GC = GAME_CONSTANTS;

    // Background
    mCtx.fillStyle = '#1a2a14';
    mCtx.fillRect(0, 0, mW, mH);

    // Lanes
    mCtx.fillStyle = '#3a3228';
    const laneH = 6;
    mCtx.fillRect(0, (GC.LANE_TOP_Y / GC.MAP_HEIGHT) * mH - laneH / 2, mW, laneH);
    mCtx.fillRect(0, (GC.LANE_BOT_Y / GC.MAP_HEIGHT) * mH - laneH / 2, mW, laneH);

    // Base areas
    mCtx.fillStyle = 'rgba(70, 130, 180, 0.15)';
    mCtx.fillRect(0, 0, (GC.P1_BASE_MAX_X / GC.MAP_WIDTH) * mW, mH);
    mCtx.fillStyle = 'rgba(180, 70, 70, 0.15)';
    const p2Start = (GC.P2_BASE_MIN_X / GC.MAP_WIDTH) * mW;
    mCtx.fillRect(p2Start, 0, mW - p2Start, mH);

    // Castles
    if (state.castle1) {
      const cx = (state.castle1.x / GC.MAP_WIDTH) * mW;
      const cy = (state.castle1.y / GC.MAP_HEIGHT) * mH;
      mCtx.fillStyle = mySide === 'left' ? '#4a8c3f' : '#b22222';
      mCtx.fillRect(cx - 4, cy - 5, 8, 10);
    }
    if (state.castle2) {
      const cx = (state.castle2.x / GC.MAP_WIDTH) * mW;
      const cy = (state.castle2.y / GC.MAP_HEIGHT) * mH;
      mCtx.fillStyle = mySide === 'right' ? '#4a8c3f' : '#b22222';
      mCtx.fillRect(cx - 4, cy - 5, 8, 10);
    }

    // Buildings
    if (state.buildings) {
      for (const b of state.buildings) {
        const bx = (b.x / GC.MAP_WIDTH) * mW;
        const by = (b.y / GC.MAP_HEIGHT) * mH;
        mCtx.fillStyle = b.side === mySide ? '#5a9a4f' : '#9a4f4f';
        mCtx.fillRect(bx - 2, by - 2, 4, 4);
      }
    }

    // Units
    if (state.units) {
      for (const u of state.units) {
        const ux = (u.x / GC.MAP_WIDTH) * mW;
        const uy = (u.y / GC.MAP_HEIGHT) * mH;
        mCtx.fillStyle = u.side === mySide ? '#7acc6a' : '#cc6a6a';
        mCtx.fillRect(ux - 1, uy - 1, 2, 2);
      }
    }

    // Generals — DISABLED (minimap dots)
    // const generals = [state.general1, state.general2].filter(g => g && g.hp > 0);
    // for (const g of generals) { ... }

    // Camera viewport
    const vx = ((camera.x - screenW / (2 * camera.zoom)) / GC.MAP_WIDTH) * mW;
    const vy = ((camera.y - screenH / (2 * camera.zoom)) / GC.MAP_HEIGHT) * mH;
    const vw = (screenW / camera.zoom / GC.MAP_WIDTH) * mW;
    const vh = (screenH / camera.zoom / GC.MAP_HEIGHT) * mH;
    mCtx.strokeStyle = 'rgba(201, 168, 76, 0.6)';
    mCtx.lineWidth = 1;
    mCtx.strokeRect(vx, vy, vw, vh);

    // Border
    mCtx.strokeStyle = 'rgba(201, 168, 76, 0.4)';
    mCtx.lineWidth = 1;
    mCtx.strokeRect(0, 0, mW, mH);
  }

  // ─── Atmospheric Effects ───────────────────────────────────────
  function drawAtmosphere() {
    // Edge vignette
    const grad = ctx.createRadialGradient(
      screenW / 2, screenH / 2, screenH * 0.35,
      screenW / 2, screenH / 2, screenH * 0.85
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, screenW, screenH);

    // Ambient dust motes
    ctx.fillStyle = 'rgba(200, 180, 140, 0.15)';
    for (let i = 0; i < 20; i++) {
      const x = (Math.sin(time * 0.3 + i * 7.3) * 0.5 + 0.5) * screenW;
      const y = (Math.cos(time * 0.2 + i * 4.7) * 0.5 + 0.5) * screenH;
      const size = 1 + Math.sin(time + i) * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ─── Draw Command Outpost ──────────────────────────────────────
  function drawOutpost(outpost, isNorth) {
    if (!isVisible(outpost.x, outpost.y, 120)) return;
    const pos = worldToScreen(outpost.x, outpost.y);
    const z = camera.zoom;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Tower base
    ctx.fillStyle = '#5a5550';
    ctx.beginPath();
    ctx.arc(0, 0, 16 * z, 0, Math.PI * 2);
    ctx.fill();

    // Tower structure
    const towerColor = outpost.controlledBy === 'left' ? '#4a8c3f' :
                       outpost.controlledBy === 'right' ? '#b22222' : '#666';
    ctx.fillStyle = towerColor;
    ctx.fillRect(-6 * z, -24 * z, 12 * z, 24 * z);

    // Crenellations
    ctx.fillRect(-8 * z, -28 * z, 4 * z, 4 * z);
    ctx.fillRect(4 * z, -28 * z, 4 * z, 4 * z);
    ctx.fillRect(-2 * z, -28 * z, 4 * z, 4 * z);

    // Flag on top
    const flagColor = outpost.controlledBy === 'left' ? '#5cb85c' :
                      outpost.controlledBy === 'right' ? '#d9534f' : '#aaa';
    ctx.fillStyle = '#888';
    ctx.fillRect(-1 * z, -38 * z, 2 * z, 12 * z);
    ctx.fillStyle = flagColor;
    const wave = Math.sin(time * 3 + (isNorth ? 0 : 3)) * 2 * z;
    ctx.beginPath();
    ctx.moveTo(1 * z, -38 * z);
    ctx.lineTo(10 * z + wave, -35 * z);
    ctx.lineTo(8 * z + wave * 0.5, -30 * z);
    ctx.lineTo(1 * z, -32 * z);
    ctx.fill();

    // Label
    ctx.font = `bold ${9 * z}px Cinzel, serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(201, 168, 76, 0.7)';
    ctx.fillText('OUTPOST', 0, 20 * z);

    ctx.restore();

    // ─── Capture progress bar ────────────────────────────────────
    const barW = 50 * z;
    const barH = 5 * z;
    const barY = isNorth ? pos.y - 44 * z : pos.y + 24 * z;
    const barX = pos.x - barW / 2;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    // Left (blue/green) side progress
    const leftProg = Math.min(1, (outpost.captureProgress.left || 0) / 10);
    if (leftProg > 0) {
      ctx.fillStyle = mySide === 'left' ? '#4a8c3f' : '#b22222';
      ctx.fillRect(barX, barY, barW * leftProg, barH);
    }

    // Right side progress
    const rightProg = Math.min(1, (outpost.captureProgress.right || 0) / 10);
    if (rightProg > 0) {
      ctx.fillStyle = mySide === 'right' ? '#4a8c3f' : '#b22222';
      ctx.fillRect(barX + barW * (1 - rightProg), barY, barW * rightProg, barH);
    }

    // Captured indicator
    if (outpost.controlledBy) {
      const controlColor = outpost.controlledBy === mySide ? 'rgba(100,200,100,0.3)' : 'rgba(200,100,100,0.3)';
      ctx.fillStyle = controlColor;
      ctx.fillRect(barX, barY, barW, barH);
    }

    // Border
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.4)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);
  }

  // ─── Lane labels ──────────────────────────────────────────────
  function drawLaneLabels() {
    const GC = GAME_CONSTANTS;
    const z = camera.zoom;
    const midX = GC.MAP_WIDTH / 2;

    // Top lane label
    if (isVisible(midX, GC.LANE_TOP_Y - 60)) {
      const pos = worldToScreen(midX, GC.LANE_TOP_Y - 50);
      ctx.font = `${11 * z}px Cinzel, serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(201, 168, 76, 0.25)';
      ctx.fillText('— North Road —', pos.x, pos.y);
    }

    // Bottom lane label
    if (isVisible(midX, GC.LANE_BOT_Y + 60)) {
      const pos = worldToScreen(midX, GC.LANE_BOT_Y + 60);
      ctx.font = `${11 * z}px Cinzel, serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(201, 168, 76, 0.25)';
      ctx.fillText('— South Road —', pos.x, pos.y);
    }
  }

  // ─── Utility ──────────────────────────────────────────────────
  function roundRect(ctx, x, y, w, h, r) {
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

  // ─── Main Render ──────────────────────────────────────────────
  function render(state, cam, dt, isPlacing, mouseWorld, selectedBuilding, charIds) {
    time += dt;
    camera = cam;

    ctx.clearRect(0, 0, screenW, screenH);

    const GC = GAME_CONSTANTS;

    // Draw pre-rendered terrain
    if (terrainDirty) {
      renderTerrain(GC.MAP_WIDTH, GC.MAP_HEIGHT);
    }

    // Draw terrain (scaled from pre-rendered)
    const tl = worldToScreen(0, 0);
    const br = worldToScreen(GC.MAP_WIDTH, GC.MAP_HEIGHT);
    ctx.drawImage(terrainCanvas, tl.x, tl.y, br.x - tl.x, br.y - tl.y);

    // Dark outside map
    ctx.fillStyle = '#0a0c08';
    if (tl.x > 0) ctx.fillRect(0, 0, tl.x, screenH);
    if (br.x < screenW) ctx.fillRect(br.x, 0, screenW - br.x, screenH);
    if (tl.y > 0) ctx.fillRect(0, 0, screenW, tl.y);
    if (br.y < screenH) ctx.fillRect(0, br.y, screenW, screenH - br.y);

    // Lane labels
    drawLaneLabels();

    // Base area highlight when placing
    drawBaseHighlight(isPlacing);

    // Castles
    if (state.castle1) drawCastle(state.castle1, 'left', charIds.left);
    if (state.castle2) drawCastle(state.castle2, 'right', charIds.right);

    // Buildings (sorted by Y)
    const allBuildings = state.buildings || [];
    const sortedBuildings = [...allBuildings].sort((a, b) => a.y - b.y);
    for (const b of sortedBuildings) {
      drawBuilding(b);
    }

    // Slow pools (goblin death puddles) — drawn before units so they appear on ground
    if (state.slowPools) {
      const now = Date.now();
      for (const pool of state.slowPools) {
        if (!isVisible(pool.x, pool.y, pool.radius + 20)) continue;
        const pos = worldToScreen(pool.x, pool.y);
        const z = camera.zoom;
        const poolR = (pool.radius || 60) * z;
        const timeLeft = pool.expireTime - now;
        const fadeAlpha = Math.min(1, timeLeft / 500); // Fade in last 500ms
        // Orange ooze puddle
        const puddleGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, poolR);
        puddleGrad.addColorStop(0, `rgba(210, 140, 40, ${(0.35 * fadeAlpha).toFixed(3)})`);
        puddleGrad.addColorStop(0.5, `rgba(180, 110, 30, ${(0.25 * fadeAlpha).toFixed(3)})`);
        puddleGrad.addColorStop(1, 'rgba(180, 110, 30, 0)');
        ctx.fillStyle = puddleGrad;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, poolR, poolR * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Surface bubbles
        const bAlpha = fadeAlpha * 0.4;
        ctx.fillStyle = `rgba(230, 160, 50, ${bAlpha.toFixed(3)})`;
        for (let i = 0; i < 4; i++) {
          const bx = pos.x + Math.sin(time * 1.5 + i * 2.1) * poolR * 0.35;
          const by = pos.y + Math.cos(time * 1.2 + i * 2.8) * poolR * 0.15;
          ctx.beginPath();
          ctx.arc(bx, by, (1.2 + Math.sin(time * 3 + i) * 0.5) * z, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Command outposts
    if (state.outposts) {
      if (state.outposts.north) drawOutpost(state.outposts.north, true);
      if (state.outposts.south) drawOutpost(state.outposts.south, false);
    }

    // Units (sorted by Y for proper draw order)
    const allUnits = state.units || [];
    const sortedUnits = [...allUnits].sort((a, b) => a.y - b.y);
    for (const u of sortedUnits) {
      drawUnit(u);
    }

    // Generals — DISABLED
    // if (state.general1) drawGeneral(state.general1);
    // if (state.general2) drawGeneral(state.general2);

    // Projectiles
    drawProjectiles(state.projectiles || []);

    // Damage numbers
    drawDamageNumbers(state.damageNumbers || []);

    // Effects
    drawEffects(state.effects || []);

    // Particles
    particles.update(dt * 1000);
    particles.render(ctx, camera);

    // Build ghost
    if (isPlacing) {
      drawBuildGhost(mouseWorld, selectedBuilding);
    }

    // Atmospheric overlay
    drawAtmosphere();
  }

  return {
    init, resize, render, setDecorations, setSide, setSelectedUnit,
    worldToScreen, screenToWorld, isVisible, drawMinimap
  };
})();
