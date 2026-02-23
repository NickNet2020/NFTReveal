// ═══════════════════════════════════════════════════════════════════════
// Castle Fight - Procedural Audio System (Web Audio API)
// Enhanced medieval sounds with battle cries, improved arrows, coin chimes
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

  // Utility: play a short noise burst with bandpass filter
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

  // Utility: play a tone with envelope
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

  // Utility: frequency sweep (for whoosh effects)
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

  // Utility: highpass noise burst (for impact/thud sounds)
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

  // ─── Sound Effects ──────────────────────────────────────────────

  function playSwordClash() {
    if (!ctx || !enabled) return;
    // Metallic ring: high-frequency noise with resonance
    noiseBurst(0.08, 3500 + Math.random() * 2500, 5, 0.35);
    // Metal impact tone
    playTone(900 + Math.random() * 600, 0.06, 'sawtooth', 0.12);
    // Secondary clang
    setTimeout(() => {
      noiseBurst(0.04, 4000 + Math.random() * 1000, 8, 0.15);
    }, 20);
    // Low thud of bodies colliding
    playTone(120 + Math.random() * 40, 0.08, 'sine', 0.06);
  }

  function playArrowFire() {
    if (!ctx || !enabled) return;
    // Arrow whoosh: frequency sweep from high to low
    freqSweep(2000 + Math.random() * 500, 400, 0.15, 'sine', 0.06);
    // Bowstring snap: quick high-freq noise
    noiseBurst(0.03, 6000 + Math.random() * 2000, 8, 0.15);
    // Air rush: filtered noise swooping down
    const bufSize = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(4000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
    filter.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.setValueAtTime(0.14, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    src.start();
    // Distant thwack on impact
    setTimeout(() => {
      impactNoise(0.04, 1500, 0.08);
      playTone(300 + Math.random() * 100, 0.04, 'triangle', 0.04);
    }, 80 + Math.random() * 40);
  }

  function playBuildingPlace() {
    if (!ctx || !enabled) return;
    // Heavy stone placement thud
    playTone(100, 0.4, 'sine', 0.25);
    noiseBurst(0.2, 300, 1.5, 0.2);
    // Wooden creak
    setTimeout(() => {
      freqSweep(180, 220, 0.15, 'sawtooth', 0.06);
    }, 80);
    // Settling stones
    setTimeout(() => {
      noiseBurst(0.12, 500, 2, 0.1);
      playTone(160, 0.2, 'sine', 0.1);
    }, 150);
  }

  function playBuildingDestroy() {
    if (!ctx || !enabled) return;
    // Massive crash
    noiseBurst(0.6, 500, 0.8, 0.5);
    playTone(60, 0.8, 'sawtooth', 0.3);
    // Crumbling
    setTimeout(() => noiseBurst(0.4, 250, 1, 0.35), 100);
    // Debris settling
    setTimeout(() => {
      noiseBurst(0.3, 800, 2, 0.15);
      playTone(50, 0.5, 'sine', 0.1);
    }, 300);
  }

  function playUnitDeath() {
    if (!ctx || !enabled) return;
    // Body fall thud
    noiseBurst(0.08, 1200, 2, 0.15);
    playTone(250, 0.1, 'sawtooth', 0.08);
    // Armor clatter
    setTimeout(() => noiseBurst(0.06, 3000, 4, 0.06), 40);

    // 1/100 chance for death cry — a vocalized wail
    if (Math.random() < 0.01) {
      setTimeout(() => {
        if (!ctx || !enabled) return;
        // Simulate a human cry with multiple formant-like tones
        const baseFreq = 180 + Math.random() * 120;
        // Fundamental cry
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

        // Second harmonic (vocal quality)
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

        // Breathy noise layer
        noiseBurst(0.35, baseFreq * 3, 3, 0.06);
      }, 60);
    }
  }

  function playGoldGain() {
    if (!ctx || !enabled) return;
    // Subtle coin chime — very quiet metallic clink
    // First coin
    const t = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 2800;
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.03, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc1.connect(g1);
    g1.connect(sfxGain);
    osc1.start(t);
    osc1.stop(t + 0.08);

    // Second coin (slightly different pitch, delayed)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 3200;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.025, t + 0.05);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc2.connect(g2);
    g2.connect(sfxGain);
    osc2.start(t + 0.05);
    osc2.stop(t + 0.12);

    // Tiny metallic shimmer noise
    const bufSize = Math.floor(ctx.sampleRate * 0.06);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 5000;
    filter.Q.value = 10;
    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0.02, t + 0.03);
    g3.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    src.connect(filter);
    filter.connect(g3);
    g3.connect(sfxGain);
    src.start(t + 0.03);
  }

  function playHeroAttack() {
    if (!ctx || !enabled) return;
    // Heavy weapon swing
    freqSweep(600, 200, 0.12, 'sawtooth', 0.15);
    noiseBurst(0.1, 2500, 3, 0.4);
    // Impact
    setTimeout(() => {
      playTone(150, 0.15, 'sine', 0.2);
      noiseBurst(0.08, 1500, 2, 0.2);
    }, 50);
  }

  function playRescueStrike() {
    if (!ctx || !enabled) return;
    // Deep rumble buildup
    playTone(80, 1.2, 'sine', 0.35);
    freqSweep(60, 200, 0.8, 'sawtooth', 0.2);
    // Massive shockwave
    noiseBurst(1.0, 800, 0.8, 0.5);
    setTimeout(() => {
      playTone(120, 0.8, 'sine', 0.3);
      noiseBurst(0.5, 400, 1, 0.3);
    }, 200);
    // Echoing aftermath
    setTimeout(() => {
      noiseBurst(0.6, 300, 1.5, 0.15);
      playTone(60, 1.0, 'sine', 0.1);
    }, 500);
  }

  function playTowerShot() {
    if (!ctx || !enabled) return;
    // Mechanical launch
    noiseBurst(0.04, 3000, 6, 0.15);
    // Projectile whoosh
    freqSweep(800 + Math.random() * 200, 400, 0.12, 'triangle', 0.1);
    // String tension release
    playTone(500 + Math.random() * 200, 0.06, 'sawtooth', 0.06);
  }

  function playHeroDeath() {
    if (!ctx || !enabled) return;
    // Dramatic death
    playTone(250, 0.6, 'sawtooth', 0.3);
    playTone(180, 0.8, 'sine', 0.2);
    noiseBurst(0.5, 700, 1, 0.25);
    // Death wail
    setTimeout(() => {
      freqSweep(350, 120, 0.6, 'sawtooth', 0.15);
      noiseBurst(0.3, 1200, 2, 0.1);
    }, 200);
    // Heavy armor fall
    setTimeout(() => {
      playTone(80, 0.5, 'sine', 0.15);
      noiseBurst(0.2, 2000, 3, 0.1);
    }, 400);
  }

  function playVictory() {
    if (!ctx || !enabled) return;
    // Triumphant fanfare
    const notes = [392, 494, 587, 784, 988]; // G B D G B
    notes.forEach((n, i) => {
      setTimeout(() => {
        playTone(n, 0.5, 'sine', 0.2);
        playTone(n * 0.5, 0.5, 'sine', 0.08); // octave below
      }, i * 180);
    });
    // Final chord
    setTimeout(() => {
      playTone(784, 1.0, 'sine', 0.2);
      playTone(988, 1.0, 'sine', 0.15);
      playTone(1175, 1.0, 'sine', 0.12);
    }, notes.length * 180);
  }

  function playDefeat() {
    if (!ctx || !enabled) return;
    // Mournful descending tones
    const notes = [350, 300, 260, 220, 175];
    notes.forEach((n, i) => {
      setTimeout(() => {
        playTone(n, 0.6, 'sawtooth', 0.15);
        playTone(n * 0.5, 0.6, 'sine', 0.06);
      }, i * 250);
    });
    // Final low drone
    setTimeout(() => {
      playTone(100, 1.5, 'sine', 0.1);
      noiseBurst(0.8, 200, 1, 0.05);
    }, notes.length * 250);
  }

  // ─── Background Music (Medieval Atmospheric Soundtrack) ────────
  function startMusic() {
    if (!ctx || !enabled) return;
    stopMusic();

    // === Layer 1: Deep drone foundation ===
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

    // Octave drone with slight detune for richness
    const drone3 = ctx.createOscillator();
    drone3.type = 'sine';
    drone3.frequency.value = 74.2; // slightly detuned for phasing
    const droneGain3 = ctx.createGain();
    droneGain3.gain.value = 0.06;
    drone3.connect(droneGain3);
    droneGain3.connect(musicGain);
    drone3.start();
    musicNodes.push(drone3, droneGain3);

    // === Layer 2: Ambient wind ===
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

    // Wind modulation (slow breathing effect)
    const windLfo = ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.value = 0.08;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 150;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);
    windLfo.start();
    musicNodes.push(windLfo, windLfoGain);

    // Wind volume swell
    const windVolLfo = ctx.createOscillator();
    windVolLfo.type = 'sine';
    windVolLfo.frequency.value = 0.03;
    const windVolLfoGain = ctx.createGain();
    windVolLfoGain.gain.value = 0.02;
    windVolLfo.connect(windVolLfoGain);
    windVolLfoGain.connect(windGain.gain);
    windVolLfo.start();
    musicNodes.push(windVolLfo, windVolLfoGain);

    // === Layer 3: War drums (periodic) ===
    playDrumLoop();

    // === Layer 4: Melodic phrases (periodic haunting melody) ===
    playMelodyLoop();

    // === Layer 5: Distant battle ambience ===
    playBattleAmbience();
  }

  let drumInterval = null;
  function playDrumLoop() {
    if (drumInterval) clearInterval(drumInterval);
    let beatPhase = 0;

    drumInterval = setInterval(() => {
      if (!ctx || !enabled) return;
      beatPhase = (beatPhase + 1) % 4;

      // Vary the drum pattern for interest
      if (beatPhase === 0) {
        // Heavy hit
        playTone(55, 0.5, 'sine', 0.1, musicGain);
        noiseBurst(0.08, 120, 1, 0.06, musicGain);
      } else if (beatPhase === 1) {
        // Lighter hit
        playTone(65, 0.3, 'sine', 0.06, musicGain);
      } else if (beatPhase === 2) {
        // Double hit
        playTone(55, 0.4, 'sine', 0.08, musicGain);
        setTimeout(() => {
          if (!ctx || !enabled) return;
          playTone(70, 0.25, 'sine', 0.05, musicGain);
        }, 300);
      } else {
        // Accent with rim hit
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
    // Medieval minor scale phrases in D minor
    // D E F G A Bb C D = 293 330 349 392 440 466 523 587
    const phrases = [
      [293, 349, 330, 293],         // D F E D
      [440, 392, 349, 293],         // A G F D
      [293, 330, 392, 349],         // D E G F
      [466, 440, 392, 349, 293],    // Bb A G F D
      [587, 523, 466, 440],         // D5 C Bb A
      [293, 392, 440, 349]          // D G A F
    ];
    let phraseIdx = 0;

    melodyInterval = setInterval(() => {
      if (!ctx || !enabled) return;
      const phrase = phrases[phraseIdx % phrases.length];
      phraseIdx++;

      phrase.forEach((note, i) => {
        setTimeout(() => {
          if (!ctx || !enabled) return;
          // Soft flute-like tone (sine + quiet triangle overtone)
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

          // Subtle overtone
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
    }, 12000); // New phrase every 12 seconds
  }

  let ambienceInterval = null;
  function playBattleAmbience() {
    if (ambienceInterval) clearInterval(ambienceInterval);

    ambienceInterval = setInterval(() => {
      if (!ctx || !enabled) return;
      const r = Math.random();
      if (r < 0.3) {
        // Distant horn
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
        // Distant crow caw
        freqSweep(800, 500, 0.15, 'sawtooth', 0.008, musicGain);
        setTimeout(() => {
          if (!ctx || !enabled) return;
          freqSweep(750, 450, 0.12, 'sawtooth', 0.006, musicGain);
        }, 200);
      } else if (r < 0.7) {
        // Thunder-like rumble in distance
        noiseBurst(1.2, 100, 0.5, 0.02, musicGain);
      }
      // Otherwise silence (for variety)
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
    playSwordClash, playArrowFire, playBuildingPlace, playBuildingDestroy,
    playUnitDeath, playGoldGain, playHeroAttack, playRescueStrike,
    playTowerShot, playHeroDeath, playVictory, playDefeat,
    startMusic, stopMusic
  };
})();
