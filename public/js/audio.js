// ═══════════════════════════════════════════════════════════════════════
// Castle Fight - Procedural Audio System (Web Audio API)
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

  // Utility: play a short noise burst
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

  // Utility: play a tone
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

  // ─── Sound Effects ──────────────────────────────────────────────
  function playSwordClash() {
    if (!ctx || !enabled) return;
    noiseBurst(0.12, 3000 + Math.random() * 2000, 3, 0.5);
    playTone(800 + Math.random() * 400, 0.08, 'sawtooth', 0.15);
  }

  function playArrowFire() {
    if (!ctx || !enabled) return;
    noiseBurst(0.06, 5000, 5, 0.3);
    playTone(1200 + Math.random() * 300, 0.1, 'sine', 0.08);
  }

  function playBuildingPlace() {
    if (!ctx || !enabled) return;
    playTone(150, 0.3, 'sine', 0.3);
    noiseBurst(0.15, 400, 2, 0.25);
    setTimeout(() => playTone(200, 0.2, 'sine', 0.15), 100);
  }

  function playBuildingDestroy() {
    if (!ctx || !enabled) return;
    noiseBurst(0.5, 600, 1, 0.6);
    playTone(80, 0.6, 'sawtooth', 0.3);
    setTimeout(() => noiseBurst(0.3, 300, 1, 0.4), 100);
  }

  function playUnitDeath() {
    if (!ctx || !enabled) return;
    noiseBurst(0.1, 1500, 2, 0.2);
    playTone(400, 0.15, 'sawtooth', 0.1);
    // 1/100 chance for death cry
    if (Math.random() < 0.01) {
      setTimeout(() => {
        if (!ctx || !enabled) return;
        const cryFreq = 200 + Math.random() * 150;
        playTone(cryFreq, 0.3, 'sawtooth', 0.2);
      }, 100);
    }
  }

  function playGoldGain() {
    if (!ctx || !enabled) return;
    playTone(880, 0.08, 'sine', 0.12);
    setTimeout(() => playTone(1100, 0.08, 'sine', 0.1), 60);
    setTimeout(() => playTone(1320, 0.1, 'sine', 0.08), 120);
  }

  function playHeroAttack() {
    if (!ctx || !enabled) return;
    noiseBurst(0.15, 2000, 4, 0.5);
    playTone(600, 0.12, 'square', 0.2);
    playTone(400, 0.15, 'sawtooth', 0.15);
  }

  function playRescueStrike() {
    if (!ctx || !enabled) return;
    playTone(200, 1.0, 'sine', 0.4);
    playTone(300, 0.8, 'sine', 0.3);
    noiseBurst(0.8, 1000, 1, 0.5);
    setTimeout(() => {
      playTone(150, 0.6, 'sawtooth', 0.25);
      noiseBurst(0.4, 500, 1, 0.3);
    }, 200);
  }

  function playTowerShot() {
    if (!ctx || !enabled) return;
    playTone(600 + Math.random() * 200, 0.12, 'triangle', 0.15);
    noiseBurst(0.06, 4000, 4, 0.2);
  }

  function playHeroDeath() {
    if (!ctx || !enabled) return;
    playTone(300, 0.5, 'sawtooth', 0.35);
    playTone(200, 0.7, 'sine', 0.25);
    noiseBurst(0.4, 800, 1, 0.3);
    setTimeout(() => playTone(100, 0.8, 'sine', 0.2), 300);
  }

  function playVictory() {
    if (!ctx || !enabled) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => {
      setTimeout(() => playTone(n, 0.4, 'sine', 0.25), i * 150);
    });
  }

  function playDefeat() {
    if (!ctx || !enabled) return;
    const notes = [400, 350, 300, 200];
    notes.forEach((n, i) => {
      setTimeout(() => playTone(n, 0.5, 'sawtooth', 0.2), i * 200);
    });
  }

  // ─── Background Music ───────────────────────────────────────────
  function startMusic() {
    if (!ctx || !enabled) return;
    stopMusic();

    // Low drone
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 55;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.15;
    drone.connect(droneGain);
    droneGain.connect(musicGain);
    drone.start();
    musicNodes.push(drone, droneGain);

    // Second drone (fifth interval)
    const drone2 = ctx.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.value = 82;
    const droneGain2 = ctx.createGain();
    droneGain2.gain.value = 0.08;
    drone2.connect(droneGain2);
    droneGain2.connect(musicGain);
    drone2.start();
    musicNodes.push(drone2, droneGain2);

    // Ambient filtered noise (wind)
    const windBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const windData = windBuf.getChannelData(0);
    for (let i = 0; i < windData.length; i++) windData[i] = Math.random() * 2 - 1;
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = windBuf;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 400;
    windFilter.Q.value = 1;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.06;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(musicGain);
    windSrc.start();
    musicNodes.push(windSrc, windFilter, windGain);

    // Slowly modulate wind frequency for atmosphere
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 200;
    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);
    lfo.start();
    musicNodes.push(lfo, lfoGain);

    // Periodic deep war drums
    playDrumLoop();
  }

  let drumInterval = null;
  function playDrumLoop() {
    if (drumInterval) clearInterval(drumInterval);
    drumInterval = setInterval(() => {
      if (!ctx || !enabled) return;
      playTone(60, 0.5, 'sine', 0.12, musicGain);
      setTimeout(() => playTone(55, 0.3, 'sine', 0.08, musicGain), 400);
      setTimeout(() => {
        playTone(65, 0.4, 'sine', 0.1, musicGain);
        playTone(50, 0.3, 'sine', 0.06, musicGain);
      }, 1200);
    }, 4000);
  }

  function stopMusic() {
    musicNodes.forEach(n => {
      try { n.stop && n.stop(); } catch (e) {}
      try { n.disconnect(); } catch (e) {}
    });
    musicNodes = [];
    if (drumInterval) { clearInterval(drumInterval); drumInterval = null; }
  }

  return {
    init, resume, toggle, isEnabled,
    playSwordClash, playArrowFire, playBuildingPlace, playBuildingDestroy,
    playUnitDeath, playGoldGain, playHeroAttack, playRescueStrike,
    playTowerShot, playHeroDeath, playVictory, playDefeat,
    startMusic, stopMusic
  };
})();
