// ═══════════════════════════════════════════════════════════════════════
// Castle Fight - Procedural Audio System (Web Audio API)
// Unit-type-specific combat sounds, cha-ching gold, medieval soundtrack
// ═══════════════════════════════════════════════════════════════════════

const AudioManager = (() => {
  let ctx;
  let masterGain, musicGain, sfxGain;
  let enabled = true;
  let musicNodes = [];
  let initialized = false;

  function init() {
    if (initialized) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      musicGain = ctx.createGain();
      sfxGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      musicGain.connect(masterGain);
      sfxGain.connect(masterGain);
      masterGain.gain.value = 0.6;
      musicGain.gain.value = 0.25;
      sfxGain.gain.value = 0.4;
      initialized = true;
    } catch (e) {
      console.warn('Web Audio not available');
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function toggle() {
    enabled = !enabled;
    if (masterGain) masterGain.gain.value = enabled ? 0.6 : 0;
    return enabled;
  }

  function isEnabled() { return enabled; }

  // ─── Utility helpers ───────────────────────────────────────────

  function noiseBurst(duration, freq, Q, gainVal, dest) {
    if (!ctx || !enabled) return;
    const bufSize = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = Q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest || sfxGain);
    src.start();
  }

  function playTone(freq, duration, type, gainVal, dest) {
    if (!ctx || !enabled) return;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal || 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(dest || sfxGain);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function freqSweep(startFreq, endFreq, duration, type, gainVal, dest) {
    if (!ctx || !enabled) return;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal || 0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(dest || sfxGain);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function impactNoise(duration, freq, gainVal, dest) {
    if (!ctx || !enabled) return;
    const bufSize = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.5;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration * 0.8);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest || sfxGain);
    src.start();
  }

  // ─── Combat Sounds (by unit type) ──────────────────────────────

  // Infantry: deep small grunts with rare sword clash
  function playInfantryAttack() {
    if (!ctx || !enabled) return;
    // Low-pitched grunt: short sawtooth burst with formant filter
    const baseFreq = 90 + Math.random() * 40;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, ctx.currentTime + 0.1);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(filter);
    filter.connect(g);
    g.connect(sfxGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);

    // Low thud of melee impact
    playTone(60 + Math.random() * 30, 0.06, 'sine', 0.06);

    // Rare sword clash (1 in 8 chance)
    if (Math.random() < 0.125) {
      setTimeout(() => {
        noiseBurst(0.06, 3500 + Math.random() * 2000, 6, 0.15);
        playTone(800 + Math.random() * 400, 0.04, 'sawtooth', 0.06);
      }, 30);
    }
  }

  // Cavalry: spear hitting metal — sharp metallic clang
  function playCavalryAttack() {
    if (!ctx || !enabled) return;
    // Sharp metallic impact: high-pitched resonant ping
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200 + Math.random() * 600, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);

    // Metal-on-metal noise burst
    noiseBurst(0.05, 4000 + Math.random() * 2000, 8, 0.2);

    // Heavy impact thud (horse momentum)
    playTone(80 + Math.random() * 30, 0.1, 'sine', 0.08);
  }

  // Siege: heavy crushing impact
  function playSiegeAttack() {
    if (!ctx || !enabled) return;
    // Deep thud
    playTone(50 + Math.random() * 20, 0.2, 'sine', 0.15);
    // Wood/stone crunch
    noiseBurst(0.1, 600, 1.5, 0.2);
    setTimeout(() => {
      noiseBurst(0.08, 300, 1, 0.1);
    }, 50);
  }

  // Flying (dragons/eagles): growl/screech + fire breath
  function playFlyingAttack() {
    if (!ctx || !enabled) return;
    const r = Math.random();
    if (r < 0.5) {
      // Growl/screech: sawtooth sweep up then down
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200 + Math.random() * 100, t);
      osc.frequency.linearRampToValueAtTime(500 + Math.random() * 200, t + 0.06);
      osc.frequency.exponentialRampToValueAtTime(150, t + 0.2);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      filter.Q.value = 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.setValueAtTime(0.12, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(filter);
      filter.connect(g);
      g.connect(sfxGain);
      osc.start(t);
      osc.stop(t + 0.2);
    } else {
      // Fire breath / peck: noise burst with sharp attack
      const t = ctx.currentTime;
      const bufSize = Math.floor(ctx.sampleRate * 0.15);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2000, t);
      filter.frequency.exponentialRampToValueAtTime(600, t + 0.15);
      filter.Q.value = 1.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      src.connect(filter);
      filter.connect(g);
      g.connect(sfxGain);
      src.start(t);

      // Accompanying low rumble (fire)
      playTone(80 + Math.random() * 40, 0.12, 'sawtooth', 0.06);
    }
  }

  // Ranged/Arrow: low-pitched whoosh soaring through the air
  function playArrowFire() {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    // Low-pitched whoosh: swept filtered noise
    const bufSize = Math.floor(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    // Low pitch sweep: start at mid, sweep down
    filter.frequency.setValueAtTime(800 + Math.random() * 200, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.25);
    filter.Q.value = 1.5;
    const g = ctx.createGain();
    // Fade in slightly then out — soaring effect
    g.gain.setValueAtTime(0.02, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.04);
    g.gain.setValueAtTime(0.14, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    src.connect(filter);
    filter.connect(g);
    g.connect(sfxGain);
    src.start(t);

    // Subtle low-frequency body to the whoosh
    freqSweep(300 + Math.random() * 100, 100, 0.2, 'sine', 0.04);
  }

  // Generic melee (fallback — used for heroes, etc.)
  function playSwordClash() {
    if (!ctx || !enabled) return;
    noiseBurst(0.08, 3500 + Math.random() * 2500, 5, 0.25);
    playTone(900 + Math.random() * 600, 0.06, 'sawtooth', 0.1);
    playTone(120 + Math.random() * 40, 0.08, 'sine', 0.05);
  }

  // ─── Other Sound Effects ───────────────────────────────────────

  function playBuildingPlace() {
    if (!ctx || !enabled) return;
    playTone(100, 0.4, 'sine', 0.25);
    noiseBurst(0.2, 300, 1.5, 0.2);
    setTimeout(() => {
      freqSweep(180, 220, 0.15, 'sawtooth', 0.06);
    }, 80);
    setTimeout(() => {
      noiseBurst(0.12, 500, 2, 0.1);
      playTone(160, 0.2, 'sine', 0.1);
    }, 150);
  }

  function playBuildingDestroy() {
    if (!ctx || !enabled) return;
    noiseBurst(0.6, 500, 0.8, 0.5);
    playTone(60, 0.8, 'sawtooth', 0.3);
    setTimeout(() => noiseBurst(0.4, 250, 1, 0.35), 100);
    setTimeout(() => {
      noiseBurst(0.3, 800, 2, 0.15);
      playTone(50, 0.5, 'sine', 0.1);
    }, 300);
  }

  function playUnitDeath() {
    if (!ctx || !enabled) return;
    noiseBurst(0.08, 1200, 2, 0.15);
    playTone(250, 0.1, 'sawtooth', 0.08);
    setTimeout(() => noiseBurst(0.06, 3000, 4, 0.06), 40);

    // 1/100 chance for death cry
    if (Math.random() < 0.01) {
      setTimeout(() => {
        if (!ctx || !enabled) return;
        const baseFreq = 180 + Math.random() * 120;
        const osc1 = ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(baseFreq * 1.5, ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, ctx.currentTime + 0.5);
        const g1 = ctx.createGain();
        g1.gain.setValueAtTime(0.0, ctx.currentTime);
        g1.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.03);
        g1.gain.setValueAtTime(0.18, ctx.currentTime + 0.15);
        g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc1.connect(g1);
        g1.connect(sfxGain);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.5);

        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(baseFreq * 2.5, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(baseFreq, ctx.currentTime + 0.4);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.0, ctx.currentTime);
        g2.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.03);
        g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc2.connect(g2);
        g2.connect(sfxGain);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.4);

        noiseBurst(0.35, baseFreq * 3, 3, 0.06);
      }, 60);
    }
  }

  // Gold income: cha-ching cash register sound
  function playGoldGain() {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;

    // Initial bell ding (cash register bell)
    const bell = ctx.createOscillator();
    bell.type = 'sine';
    bell.frequency.value = 3200;
    const bellG = ctx.createGain();
    bellG.gain.setValueAtTime(0.06, t);
    bellG.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    bell.connect(bellG);
    bellG.connect(sfxGain);
    bell.start(t);
    bell.stop(t + 0.15);

    // Second harmonic bell
    const bell2 = ctx.createOscillator();
    bell2.type = 'sine';
    bell2.frequency.value = 4800;
    const bellG2 = ctx.createGain();
    bellG2.gain.setValueAtTime(0.03, t);
    bellG2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    bell2.connect(bellG2);
    bellG2.connect(sfxGain);
    bell2.start(t);
    bell2.stop(t + 0.1);

    // Mechanical clack (the drawer opening) — short noise click
    const clackSize = Math.floor(ctx.sampleRate * 0.02);
    const clackBuf = ctx.createBuffer(1, clackSize, ctx.sampleRate);
    const clackData = clackBuf.getChannelData(0);
    for (let i = 0; i < clackSize; i++) clackData[i] = Math.random() * 2 - 1;
    const clackSrc = ctx.createBufferSource();
    clackSrc.buffer = clackBuf;
    const clackFilter = ctx.createBiquadFilter();
    clackFilter.type = 'highpass';
    clackFilter.frequency.value = 3000;
    const clackG = ctx.createGain();
    clackG.gain.setValueAtTime(0.05, t + 0.01);
    clackG.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    clackSrc.connect(clackFilter);
    clackFilter.connect(clackG);
    clackG.connect(sfxGain);
    clackSrc.start(t + 0.01);

    // Coin jingle follow-up
    setTimeout(() => {
      if (!ctx || !enabled) return;
      const t2 = ctx.currentTime;
      // Two quick coin clinks
      const c1 = ctx.createOscillator();
      c1.type = 'sine';
      c1.frequency.value = 5000;
      const cg1 = ctx.createGain();
      cg1.gain.setValueAtTime(0.02, t2);
      cg1.gain.exponentialRampToValueAtTime(0.001, t2 + 0.04);
      c1.connect(cg1);
      cg1.connect(sfxGain);
      c1.start(t2);
      c1.stop(t2 + 0.04);

      const c2 = ctx.createOscillator();
      c2.type = 'sine';
      c2.frequency.value = 5800;
      const cg2 = ctx.createGain();
      cg2.gain.setValueAtTime(0.015, t2 + 0.03);
      cg2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.06);
      c2.connect(cg2);
      cg2.connect(sfxGain);
      c2.start(t2 + 0.03);
      c2.stop(t2 + 0.06);
    }, 60);
  }

  function playHeroAttack() {
    if (!ctx || !enabled) return;
    freqSweep(600, 200, 0.12, 'sawtooth', 0.15);
    noiseBurst(0.1, 2500, 3, 0.4);
    setTimeout(() => {
      playTone(150, 0.15, 'sine', 0.2);
      noiseBurst(0.08, 1500, 2, 0.2);
    }, 50);
  }

  function playRescueStrike() {
    if (!ctx || !enabled) return;
    playTone(80, 1.2, 'sine', 0.35);
    freqSweep(60, 200, 0.8, 'sawtooth', 0.2);
    noiseBurst(1.0, 800, 0.8, 0.5);
    setTimeout(() => {
      playTone(120, 0.8, 'sine', 0.3);
      noiseBurst(0.5, 400, 1, 0.3);
    }, 200);
    setTimeout(() => {
      noiseBurst(0.6, 300, 1.5, 0.15);
      playTone(60, 1.0, 'sine', 0.1);
    }, 500);
  }

  function playTowerShot() {
    if (!ctx || !enabled) return;
    noiseBurst(0.04, 3000, 6, 0.15);
    freqSweep(800 + Math.random() * 200, 400, 0.12, 'triangle', 0.1);
    playTone(500 + Math.random() * 200, 0.06, 'sawtooth', 0.06);
  }

  function playHeroDeath() {
    if (!ctx || !enabled) return;
    playTone(250, 0.6, 'sawtooth', 0.3);
    playTone(180, 0.8, 'sine', 0.2);
    noiseBurst(0.5, 700, 1, 0.25);
    setTimeout(() => {
      freqSweep(350, 120, 0.6, 'sawtooth', 0.15);
      noiseBurst(0.3, 1200, 2, 0.1);
    }, 200);
    setTimeout(() => {
      playTone(80, 0.5, 'sine', 0.15);
      noiseBurst(0.2, 2000, 3, 0.1);
    }, 400);
  }

  function playVictory() {
    if (!ctx || !enabled) return;
    const notes = [392, 494, 587, 784, 988];
    notes.forEach((n, i) => {
      setTimeout(() => {
        playTone(n, 0.5, 'sine', 0.2);
        playTone(n * 0.5, 0.5, 'sine', 0.08);
      }, i * 180);
    });
    setTimeout(() => {
      playTone(784, 1.0, 'sine', 0.2);
      playTone(988, 1.0, 'sine', 0.15);
      playTone(1175, 1.0, 'sine', 0.12);
    }, notes.length * 180);
  }

  function playDefeat() {
    if (!ctx || !enabled) return;
    const notes = [350, 300, 260, 220, 175];
    notes.forEach((n, i) => {
      setTimeout(() => {
        playTone(n, 0.6, 'sawtooth', 0.15);
        playTone(n * 0.5, 0.6, 'sine', 0.06);
      }, i * 250);
    });
    setTimeout(() => {
      playTone(100, 1.5, 'sine', 0.1);
      noiseBurst(0.8, 200, 1, 0.05);
    }, notes.length * 250);
  }

  // ─── Background Music (Medieval Atmospheric Soundtrack) ────────
  function startMusic() {
    if (!ctx || !enabled) return;
    stopMusic();

    // Root drone (D2 = 73.4 Hz)
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 73.4;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.12;
    drone.connect(droneGain);
    droneGain.connect(musicGain);
    drone.start();
    musicNodes.push(drone, droneGain);

    // Fifth drone (A2 = 110 Hz)
    const drone2 = ctx.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.value = 110;
    const droneGain2 = ctx.createGain();
    droneGain2.gain.value = 0.06;
    drone2.connect(droneGain2);
    droneGain2.connect(musicGain);
    drone2.start();
    musicNodes.push(drone2, droneGain2);

    // Detuned drone for phasing richness
    const drone3 = ctx.createOscillator();
    drone3.type = 'sine';
    drone3.frequency.value = 74.2;
    const droneGain3 = ctx.createGain();
    droneGain3.gain.value = 0.06;
    drone3.connect(droneGain3);
    droneGain3.connect(musicGain);
    drone3.start();
    musicNodes.push(drone3, droneGain3);

    // Ambient wind
    const windBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const windData = windBuf.getChannelData(0);
    for (let i = 0; i < windData.length; i++) windData[i] = Math.random() * 2 - 1;
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = windBuf;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 350;
    windFilter.Q.value = 0.7;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.05;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(musicGain);
    windSrc.start();
    musicNodes.push(windSrc, windFilter, windGain);

    const windLfo = ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.value = 0.08;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 150;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);
    windLfo.start();
    musicNodes.push(windLfo, windLfoGain);

    const windVolLfo = ctx.createOscillator();
    windVolLfo.type = 'sine';
    windVolLfo.frequency.value = 0.03;
    const windVolLfoGain = ctx.createGain();
    windVolLfoGain.gain.value = 0.02;
    windVolLfo.connect(windVolLfoGain);
    windVolLfoGain.connect(windGain.gain);
    windVolLfo.start();
    musicNodes.push(windVolLfo, windVolLfoGain);

    playDrumLoop();
    playMelodyLoop();
    playBattleAmbience();
  }

  let drumInterval = null;
  function playDrumLoop() {
    if (drumInterval) clearInterval(drumInterval);
    let beatPhase = 0;
    drumInterval = setInterval(() => {
      if (!ctx || !enabled) return;
      beatPhase = (beatPhase + 1) % 4;
      if (beatPhase === 0) {
        playTone(55, 0.5, 'sine', 0.1, musicGain);
        noiseBurst(0.08, 120, 1, 0.06, musicGain);
      } else if (beatPhase === 1) {
        playTone(65, 0.3, 'sine', 0.06, musicGain);
      } else if (beatPhase === 2) {
        playTone(55, 0.4, 'sine', 0.08, musicGain);
        setTimeout(() => {
          if (!ctx || !enabled) return;
          playTone(70, 0.25, 'sine', 0.05, musicGain);
        }, 300);
      } else {
        playTone(50, 0.5, 'sine', 0.09, musicGain);
        noiseBurst(0.03, 3000, 6, 0.03, musicGain);
        setTimeout(() => {
          if (!ctx || !enabled) return;
          playTone(60, 0.2, 'sine', 0.04, musicGain);
        }, 500);
      }
    }, 2500);
  }

  let melodyInterval = null;
  function playMelodyLoop() {
    if (melodyInterval) clearInterval(melodyInterval);
    const phrases = [
      [293, 349, 330, 293],
      [440, 392, 349, 293],
      [293, 330, 392, 349],
      [466, 440, 392, 349, 293],
      [587, 523, 466, 440],
      [293, 392, 440, 349]
    ];
    let phraseIdx = 0;
    melodyInterval = setInterval(() => {
      if (!ctx || !enabled) return;
      const phrase = phrases[phraseIdx % phrases.length];
      phraseIdx++;
      phrase.forEach((note, i) => {
        setTimeout(() => {
          if (!ctx || !enabled) return;
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = note;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, ctx.currentTime);
          g.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.08);
          g.gain.setValueAtTime(0.04, ctx.currentTime + 0.3);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
          osc.connect(g);
          g.connect(musicGain);
          osc.start();
          osc.stop(ctx.currentTime + 0.8);
          const osc2 = ctx.createOscillator();
          osc2.type = 'triangle';
          osc2.frequency.value = note * 2;
          const g2 = ctx.createGain();
          g2.gain.setValueAtTime(0, ctx.currentTime);
          g2.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.08);
          g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          osc2.connect(g2);
          g2.connect(musicGain);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.5);
        }, i * 600);
      });
    }, 12000);
  }

  let ambienceInterval = null;
  function playBattleAmbience() {
    if (ambienceInterval) clearInterval(ambienceInterval);
    ambienceInterval = setInterval(() => {
      if (!ctx || !enabled) return;
      const r = Math.random();
      if (r < 0.3) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 130 + Math.random() * 50;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 600;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 0.3);
        g.gain.setValueAtTime(0.015, ctx.currentTime + 1.0);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
        osc.connect(filter);
        filter.connect(g);
        g.connect(musicGain);
        osc.start();
        osc.stop(ctx.currentTime + 1.8);
      } else if (r < 0.5) {
        freqSweep(800, 500, 0.15, 'sawtooth', 0.008, musicGain);
        setTimeout(() => {
          if (!ctx || !enabled) return;
          freqSweep(750, 450, 0.12, 'sawtooth', 0.006, musicGain);
        }, 200);
      } else if (r < 0.7) {
        noiseBurst(1.2, 100, 0.5, 0.02, musicGain);
      }
    }, 8000);
  }

  function stopMusic() {
    musicNodes.forEach(n => {
      try { n.stop && n.stop(); } catch (e) {}
      try { n.disconnect(); } catch (e) {}
    });
    musicNodes = [];
    if (drumInterval) { clearInterval(drumInterval); drumInterval = null; }
    if (melodyInterval) { clearInterval(melodyInterval); melodyInterval = null; }
    if (ambienceInterval) { clearInterval(ambienceInterval); ambienceInterval = null; }
  }

  return {
    init, resume, toggle, isEnabled,
    playSwordClash, playArrowFire, playInfantryAttack, playCavalryAttack,
    playSiegeAttack, playFlyingAttack,
    playBuildingPlace, playBuildingDestroy,
    playUnitDeath, playGoldGain, playHeroAttack, playRescueStrike,
    playTowerShot, playHeroDeath, playVictory, playDefeat,
    startMusic, stopMusic
  };
})();
