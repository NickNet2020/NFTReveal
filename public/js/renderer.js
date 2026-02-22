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
    forest_warden:  { primary: '#27ae60', secondary: '#58d68d', dark: '#1a7a42', banner: '#a3e4be' }
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
    drawBuildingStructure(ctx, bData.typeId, z, palette, bData.characterId);

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
  }

  function drawBuildingStructure(ctx, typeId, z, palette, charId) {
    // Generic building with character color accents
    // Categorize by what unit it produces - find the building def
    const charData = CHARACTERS[charId];
    const bDef = charData ? charData.buildings.find(b => b.id === typeId) : null;
    const unitDef = charData && bDef ? charData.units.find(u => u.id === bDef.unit) : null;
    const unitType = unitDef ? unitDef.type : 'infantry';

    // Building style varies by unit type produced
    if (unitType === 'infantry') {
      drawBarracksBuilding(ctx, z, palette);
    } else if (unitType === 'ranged') {
      drawRangedBuilding(ctx, z, palette);
    } else if (unitType === 'cavalry') {
      drawStablesBuilding(ctx, z, palette);
    } else if (unitType === 'siege') {
      drawSiegeBuilding(ctx, z, palette);
    } else if (unitType === 'flying') {
      drawFlyingBuilding(ctx, z, palette);
    } else {
      drawBarracksBuilding(ctx, z, palette);
    }
  }

  function drawBarracksBuilding(ctx, z, palette) {
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
  }

  function drawRangedBuilding(ctx, z, palette) {
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
  }

  function drawStablesBuilding(ctx, z, palette) {
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
  }

  function drawSiegeBuilding(ctx, z, palette) {
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
  }

  function drawFlyingBuilding(ctx, z, palette) {
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

    // Draw based on unit type
    if (uData.unitType === 'infantry') {
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

    ctx.restore();

    // Health bar
    const barY = pos.y + yOffset - (vis.size + 8) * z;
    if (uData.hp < uData.maxHp) {
      drawHealthBar(pos.x, barY, 20 * z, uData.hp, uData.maxHp,
        isMySide ? 'friendly' : 'enemy');
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

      // Shadow
      ctx.fillStyle = '#000';
      ctx.fillText('-' + d.value, pos.x + 1, pos.y + 1);
      // Text
      ctx.fillStyle = '#ff4444';
      ctx.fillText('-' + d.value, pos.x, pos.y);

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

    // Command outposts
    if (state.outposts) {
      if (state.outposts.north) drawOutpost(state.outposts.north, true);
      if (state.outposts.south) drawOutpost(state.outposts.south, false);
    }

    // Units (sorted by Y)
    const allUnits = state.units || [];
    const sortedUnits = [...allUnits].sort((a, b) => a.y - b.y);
    for (const u of sortedUnits) {
      drawUnit(u);
    }

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
