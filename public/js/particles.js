// ═══════════════════════════════════════════════════════════════════════
// Castle Fight - Particle Effects System
// ═══════════════════════════════════════════════════════════════════════

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.emitters = [];
  }

  // ─── Create individual particles ────────────────────────────────
  emit(config) {
    const count = config.count || 1;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: config.x + (Math.random() - 0.5) * (config.spread || 0),
        y: config.y + (Math.random() - 0.5) * (config.spread || 0),
        vx: (config.vx || 0) + (Math.random() - 0.5) * (config.vxSpread || 0),
        vy: (config.vy || 0) + (Math.random() - 0.5) * (config.vySpread || 0),
        life: config.life || 1000,
        maxLife: config.life || 1000,
        size: config.size || 3,
        sizeEnd: config.sizeEnd !== undefined ? config.sizeEnd : 0,
        color: config.color || '#ffaa00',
        colorEnd: config.colorEnd || null,
        alpha: config.alpha || 1,
        alphaEnd: config.alphaEnd !== undefined ? config.alphaEnd : 0,
        gravity: config.gravity || 0,
        friction: config.friction || 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (config.rotationSpeed || 0) * (Math.random() - 0.5),
        shape: config.shape || 'circle', // circle, square, spark, smoke
        glow: config.glow || false,
        glowSize: config.glowSize || 10,
        born: Date.now()
      });
    }
  }

  // ─── Persistent emitters ────────────────────────────────────────
  addEmitter(config) {
    const emitter = {
      id: Math.random().toString(36).substr(2, 9),
      x: config.x,
      y: config.y,
      rate: config.rate || 100, // ms between emissions
      lastEmit: 0,
      config: config.particle,
      active: true
    };
    this.emitters.push(emitter);
    return emitter.id;
  }

  removeEmitter(id) {
    this.emitters = this.emitters.filter(e => e.id !== id);
  }

  // ─── Preset effects ────────────────────────────────────────────
  fireEffect(x, y, intensity = 1) {
    this.emit({
      x, y,
      count: Math.ceil(3 * intensity),
      spread: 8 * intensity,
      vx: 0, vy: -30,
      vxSpread: 15, vySpread: 20,
      life: 600 + Math.random() * 400,
      size: 4 * intensity, sizeEnd: 1,
      color: '#ff6600',
      alpha: 0.8, alphaEnd: 0,
      gravity: -20,
      shape: 'circle',
      glow: true, glowSize: 12
    });
    // Embers
    this.emit({
      x, y: y - 5,
      count: Math.ceil(1 * intensity),
      spread: 5,
      vx: 0, vy: -50,
      vxSpread: 25, vySpread: 15,
      life: 800,
      size: 2, sizeEnd: 0,
      color: '#ffcc00',
      alpha: 1, alphaEnd: 0,
      gravity: -10,
      shape: 'spark',
      glow: true, glowSize: 6
    });
  }

  smokeEffect(x, y, color = '#555555') {
    this.emit({
      x, y,
      count: 2,
      spread: 10,
      vx: 0, vy: -15,
      vxSpread: 8, vySpread: 5,
      life: 1500,
      size: 6, sizeEnd: 20,
      color: color,
      alpha: 0.3, alphaEnd: 0,
      gravity: -5,
      shape: 'smoke'
    });
  }

  bloodEffect(x, y) {
    this.emit({
      x, y,
      count: 6,
      spread: 5,
      vx: 0, vy: -20,
      vxSpread: 40, vySpread: 30,
      life: 500,
      size: 3, sizeEnd: 1,
      color: '#8b0000',
      alpha: 0.9, alphaEnd: 0,
      gravity: 80,
      shape: 'circle'
    });
  }

  dustEffect(x, y) {
    this.emit({
      x, y,
      count: 4,
      spread: 15,
      vx: 0, vy: -8,
      vxSpread: 20, vySpread: 10,
      life: 800,
      size: 4, sizeEnd: 8,
      color: '#8B7355',
      alpha: 0.4, alphaEnd: 0,
      gravity: -3,
      shape: 'smoke'
    });
  }

  constructionEffect(x, y) {
    this.emit({
      x, y,
      count: 8,
      spread: 30,
      vx: 0, vy: -25,
      vxSpread: 30, vySpread: 20,
      life: 600,
      size: 3, sizeEnd: 0,
      color: '#d4a574',
      alpha: 0.7, alphaEnd: 0,
      gravity: 30,
      shape: 'square'
    });
  }

  deathEffect(x, y, unitType) {
    if (unitType === 'flying') {
      // Feathers
      this.emit({
        x, y, count: 12, spread: 20,
        vx: 0, vy: 10, vxSpread: 40, vySpread: 30,
        life: 1200, size: 3, sizeEnd: 1,
        color: '#aaa', alpha: 0.8, alphaEnd: 0,
        gravity: 20, shape: 'spark', rotationSpeed: 5
      });
    } else if (unitType === 'siege') {
      // Debris
      this.emit({
        x, y, count: 15, spread: 25,
        vx: 0, vy: -30, vxSpread: 60, vySpread: 40,
        life: 800, size: 4, sizeEnd: 2,
        color: '#6B4226', alpha: 0.9, alphaEnd: 0,
        gravity: 80, shape: 'square'
      });
      this.smokeEffect(x, y, '#444');
    } else {
      this.bloodEffect(x, y);
      this.dustEffect(x, y);
    }
  }

  buildingDestroyEffect(x, y) {
    // Big explosion of debris
    this.emit({
      x, y, count: 25, spread: 30,
      vx: 0, vy: -40, vxSpread: 80, vySpread: 50,
      life: 1000, size: 5, sizeEnd: 2,
      color: '#6B4226', alpha: 0.9, alphaEnd: 0,
      gravity: 60, shape: 'square', rotationSpeed: 8
    });
    // Fire
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.fireEffect(x + (Math.random()-0.5)*40, y + (Math.random()-0.5)*30, 2);
      }, i * 100);
    }
    // Smoke plume
    this.emit({
      x, y: y - 10, count: 8, spread: 25,
      vx: 0, vy: -30, vxSpread: 15, vySpread: 10,
      life: 2000, size: 10, sizeEnd: 30,
      color: '#333', alpha: 0.5, alphaEnd: 0,
      gravity: -8, shape: 'smoke'
    });
  }

  rescueStrikeEffect(x, y, radius) {
    // Massive shockwave particles
    const count = 60;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 100 + Math.random() * 80;
      this.emit({
        x, y, count: 1, spread: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vxSpread: 10, vySpread: 10,
        life: 1200, size: 6, sizeEnd: 1,
        color: '#ffd700', alpha: 1, alphaEnd: 0,
        gravity: 0, friction: 0.97,
        shape: 'spark', glow: true, glowSize: 15
      });
    }
    // Central flash
    this.emit({
      x, y, count: 20, spread: 40,
      vx: 0, vy: -20, vxSpread: 50, vySpread: 50,
      life: 800, size: 8, sizeEnd: 0,
      color: '#ffffff', alpha: 1, alphaEnd: 0,
      gravity: 0, shape: 'circle', glow: true, glowSize: 20
    });
  }

  goldEffect(x, y) {
    this.emit({
      x, y, count: 3, spread: 10,
      vx: 0, vy: -25, vxSpread: 10, vySpread: 5,
      life: 800, size: 3, sizeEnd: 0,
      color: '#ffd700', alpha: 0.8, alphaEnd: 0,
      gravity: -5, shape: 'spark', glow: true, glowSize: 8
    });
  }

  // ─── Update & Render ───────────────────────────────────────────
  update(dt) {
    const now = Date.now();

    // Update emitters
    for (const emitter of this.emitters) {
      if (!emitter.active) continue;
      if (now - emitter.lastEmit >= emitter.rate) {
        emitter.lastEmit = now;
        this.emit({ ...emitter.config, x: emitter.x, y: emitter.y });
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const elapsed = now - p.born;

      if (elapsed >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      const dtSec = dt / 1000;
      p.vy += p.gravity * dtSec;
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.rotation += p.rotationSpeed * dtSec;
    }
  }

  render(ctx, camera) {
    const now = Date.now();

    for (const p of this.particles) {
      const t = (now - p.born) / p.maxLife; // 0 to 1
      const alpha = p.alpha + (p.alphaEnd - p.alpha) * t;
      const size = p.size + (p.sizeEnd - p.size) * t;

      if (alpha <= 0 || size <= 0) continue;

      const sx = (p.x - camera.x) * camera.zoom + camera.screenW / 2;
      const sy = (p.y - camera.y) * camera.zoom + camera.screenH / 2;
      const sSize = size * camera.zoom;

      if (sx < -50 || sx > camera.screenW + 50 || sy < -50 || sy > camera.screenH + 50) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(sx, sy);
      ctx.rotate(p.rotation);

      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.glowSize * camera.zoom;
      }

      ctx.fillStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, sSize, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'square') {
        ctx.fillRect(-sSize, -sSize, sSize * 2, sSize * 2);
      } else if (p.shape === 'spark') {
        ctx.beginPath();
        ctx.moveTo(0, -sSize * 2);
        ctx.lineTo(sSize * 0.5, 0);
        ctx.lineTo(0, sSize * 0.5);
        ctx.lineTo(-sSize * 0.5, 0);
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === 'smoke') {
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, sSize);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, sSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  clear() {
    this.particles = [];
    this.emitters = [];
  }
}

// Global instance
const particles = new ParticleSystem();
