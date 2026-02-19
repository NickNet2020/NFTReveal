// ═══════════════════════════════════════════════════════════════════
//  AUDIO.JS - Procedural 8-Bit Sound Effects using Web Audio API
// ═══════════════════════════════════════════════════════════════════

const Audio8Bit = (() => {
  let ctx;
  let masterGain;
  let muted = false;

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.3;
      masterGain.connect(ctx.destination);
    } catch (e) {
      console.warn('Web Audio not supported');
    }
  }

  function ensureContext() {
    if (!ctx) init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function playTone(freq, duration, type = 'square', volume = 0.3) {
    ensureContext();
    if (!ctx || muted) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  function playNoise(duration, volume = 0.1) {
    ensureContext();
    if (!ctx || muted) return;

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(masterGain);
    source.start();
  }

  // ─── Sound Effects ───────────────────────────────────────────

  function coinCollect() {
    playTone(880, 0.08, 'square', 0.2);
    setTimeout(() => playTone(1100, 0.08, 'square', 0.15), 60);
    setTimeout(() => playTone(1320, 0.12, 'square', 0.12), 120);
  }

  function swordHit() {
    playNoise(0.08, 0.15);
    playTone(200, 0.06, 'sawtooth', 0.12);
  }

  function build() {
    playTone(220, 0.06, 'square', 0.15);
    setTimeout(() => playTone(330, 0.06, 'square', 0.12), 80);
    setTimeout(() => playTone(440, 0.1, 'square', 0.1), 160);
  }

  function buyUnit() {
    playTone(440, 0.05, 'square', 0.15);
    setTimeout(() => playTone(550, 0.05, 'square', 0.12), 50);
    setTimeout(() => playTone(660, 0.08, 'square', 0.1), 100);
  }

  function error() {
    playTone(200, 0.1, 'square', 0.2);
    setTimeout(() => playTone(150, 0.15, 'square', 0.18), 120);
  }

  function levelUp() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.15, 'square', 0.18 - i * 0.03), i * 120);
    });
    setTimeout(() => playTone(1047, 0.3, 'triangle', 0.15), 480);
  }

  function death() {
    playTone(440, 0.15, 'sawtooth', 0.2);
    setTimeout(() => playTone(330, 0.15, 'sawtooth', 0.18), 150);
    setTimeout(() => playTone(220, 0.2, 'sawtooth', 0.15), 300);
    setTimeout(() => playTone(110, 0.4, 'sawtooth', 0.12), 450);
  }

  function dragonRoar() {
    playNoise(0.3, 0.12);
    playTone(80, 0.2, 'sawtooth', 0.15);
    setTimeout(() => playTone(100, 0.15, 'sawtooth', 0.12), 100);
    setTimeout(() => playTone(60, 0.3, 'sawtooth', 0.1), 200);
  }

  function magicCast() {
    playTone(600, 0.05, 'sine', 0.12);
    setTimeout(() => playTone(800, 0.05, 'sine', 0.1), 40);
    setTimeout(() => playTone(1200, 0.1, 'sine', 0.08), 80);
    setTimeout(() => playTone(1600, 0.15, 'triangle', 0.06), 120);
  }

  function respawn() {
    const notes = [262, 330, 392, 523];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.12, 'triangle', 0.12), i * 100);
    });
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  return {
    init, coinCollect, swordHit, build, buyUnit, error,
    levelUp, death, dragonRoar, magicCast, respawn, toggleMute
  };
})();
