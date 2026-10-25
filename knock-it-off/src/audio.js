// Every sound is synthesised with the Web Audio API, so the game ships no audio files.
const rand = (a, b) => a + Math.random() * (b - a);
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---- the soundtrack: a slow, soft, generative lullaby ----
// Warm pads breathe under a gentle four-chord loop, and a few bell notes are picked fresh in every bar
// from a calm pentatonic scale. Nothing is sharp or percussive, and the melody never repeats exactly,
// so it stays pleasant however long you play.
const BPM = 66;
const CHORDS = [
  { root: 48, tones: [60, 64, 67, 71] },   // C major 7
  { root: 45, tones: [57, 60, 64, 67] },   // A minor 7
  { root: 53, tones: [57, 60, 64, 65] },   // F major 7
  { root: 55, tones: [59, 62, 64, 67] },   // G 6
];
const BELL_NOTES = [67, 69, 72, 74, 76, 79, 81];      // C major pentatonic

// a small seeded random number generator, so each bar's notes are random but repeatable
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.tension = 0;         // 0..1, driven by how suspicious the owner is
    this.music = { step: 0, next: 0, plan: [], last: 3, seed: Math.floor(Math.random() * 1e6) };
    this.lastThud = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(c.destination);
    this.sfxBus = c.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);
    this.musicBus = c.createGain();
    this.musicBus.gain.value = 0.4;
    this.musicBus.connect(this.master);
    this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.music.next = c.currentTime + 0.1;
    this.initMusicBuses();
  }

  // The bell notes go through a soft echo, which makes the music feel spacious and calm
  initMusicBuses() {
    const c = this.ctx;
    this.bellBus = c.createGain();
    this.bellBus.connect(this.musicBus);
    const send = c.createGain(), delay = c.createDelay(2), feedback = c.createGain(), soften = c.createBiquadFilter();
    send.gain.value = 0.5;
    delay.delayTime.value = 0.54;
    feedback.gain.value = 0.42;
    soften.type = 'lowpass';
    soften.frequency.value = 1800;
    this.bellBus.connect(send);
    send.connect(delay);
    delay.connect(soften);
    soften.connect(feedback);
    feedback.connect(delay);
    soften.connect(this.musicBus);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  // ---- building blocks ----
  tone(freq, dur, type = 'sine', vol = 0.1, slide = 1, when = 0, bus = this.sfxBus) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, vol, freq, type = 'lowpass', when = 0, bus = this.sfxBus) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf;
    f.type = type;
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  // ---- sound effects ----
  meow(pitch = 1) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(420 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(780 * pitch, t + 0.14);
    o.frequency.exponentialRampToValueAtTime(520 * pitch, t + 0.5);
    f.type = 'bandpass';
    f.Q.value = 4;
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(1700, t + 0.18);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(f).connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.6);
  }

  swat() { this.noise(0.13, 0.16, 2400, 'highpass'); this.tone(500, 0.1, 'triangle', 0.05, 0.5); }
  jump() { this.tone(380, 0.14, 'triangle', 0.07, 1.9); }
  doubleJump() { this.tone(520, 0.12, 'triangle', 0.06, 2.0); this.noise(0.1, 0.05, 3000, 'highpass'); }

  thud(vol = 0.5) {
    const now = performance.now();
    if (now - this.lastThud < 70) return;
    this.lastThud = now;
    this.tone(95, 0.16, 'sine', 0.22 * vol, 0.45);
    this.noise(0.1, 0.12 * vol, 500);
  }

  crash(kind) {
    switch (kind) {
      case 'glass':
        this.noise(0.5, 0.35, 5000, 'highpass');
        for (let i = 0; i < 7; i++) this.tone(rand(2500, 6000), 0.25, 'sine', 0.07, 0.6, i * 0.035 + Math.random() * 0.05);
        break;
      case 'ceramic':
        this.noise(0.3, 0.3, 2800, 'bandpass');
        this.tone(180, 0.15, 'triangle', 0.2, 0.5);
        for (let i = 0; i < 3; i++) this.tone(rand(1500, 3200), 0.1, 'square', 0.035, 0.7, i * 0.04);
        break;
      case 'metal':
        this.tone(900, 0.9, 'sine', 0.12, 0.9);
        this.tone(1450, 0.7, 'sine', 0.09, 0.9);
        this.tone(2380, 0.5, 'sine', 0.06, 0.9);
        this.noise(0.15, 0.2, 3000, 'highpass');
        break;
      case 'tech':
        this.noise(0.35, 0.25, 1500, 'bandpass');
        this.tone(300, 0.4, 'sawtooth', 0.08, 0.3);
        this.tone(90, 0.3, 'sine', 0.2, 0.4);
        break;
      case 'splat':
        this.noise(0.3, 0.25, 700);
        this.tone(110, 0.2, 'sine', 0.25, 0.5);
        break;
      case 'splash':
        this.noise(0.45, 0.2, 2200, 'bandpass');
        this.tone(260, 0.25, 'sine', 0.08, 0.4);
        break;
    }
  }

  gasp() { this.tone(240, 0.28, 'sawtooth', 0.05, 1.6); this.tone(360, 0.22, 'triangle', 0.05, 1.3, 0.04); }
  chime(i = 0) { this.tone(660 + i * 90, 0.3, 'triangle', 0.07, 1.0); this.tone((660 + i * 90) * 1.5, 0.25, 'sine', 0.04, 1.0, 0.05); }
  click() { this.tone(620, 0.07, 'sine', 0.05, 0.8); }

  caught() {
    // a soft, sinking "oh no" rather than a harsh buzz
    this.tone(392, 0.5, 'sine', 0.12, 0.7);
    this.tone(294, 0.7, 'sine', 0.1, 0.7, 0.18);
    this.noise(0.3, 0.08, 700);
  }

  purr(dur = 3) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), depth = c.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 70;
    f.type = 'lowpass';
    f.frequency.value = 320;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.3);
    g.gain.setValueAtTime(0.06, t + dur - 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lfo.frequency.value = 24;
    depth.gain.value = 0.04;
    lfo.connect(depth).connect(g.gain);
    o.connect(f).connect(g).connect(this.sfxBus);
    o.start(t); lfo.start(t);
    o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }

  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.45, 'triangle', 0.09, 1.0, i * 0.13)); }
  lose() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.08, 0.9, i * 0.25)); }

  // ---- music ----
  // A warm, slow-breathing chord: soft sine and triangle waves that fade in and out over seconds
  pad(notes, dur, off) {
    const c = this.ctx, t = c.currentTime + off;
    const lp = c.createBiquadFilter(), g = c.createGain();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 1.8);
    g.gain.setValueAtTime(0.05, t + dur - 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 2.2);
    lp.connect(g).connect(this.musicBus);
    for (const n of notes) {
      for (const [type, detune, level] of [['sine', -4, 0.5], ['triangle', 5, 0.22]]) {
        const o = c.createOscillator(), og = c.createGain();
        o.type = type;
        o.frequency.value = midi(n);
        o.detune.value = detune;
        og.gain.value = level;
        o.connect(og).connect(lp);
        o.start(t);
        o.stop(t + dur + 2.4);
      }
    }
  }

  // A long, gentle note with a slow fade in (used for the bass)
  soft(freq, dur, vol, off, attack = 0.4) {
    const c = this.ctx, t = c.currentTime + off, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // A soft bell: a pure tone with a long tail and a faint overtone, sent through the echo
  bell(n, off, vol) {
    const f = midi(n);
    this.tone(f, 1.7, 'sine', vol, 0.9995, off, this.bellBus);
    this.tone(f * 2, 0.7, 'sine', vol * 0.25, 0.999, off, this.bellBus);
    this.tone(f * 3.01, 0.25, 'sine', vol * 0.06, 0.999, off, this.bellBus);
  }

  // One step (an eighth note) of the soundtrack. `t` is when it should sound.
  step(s, t, stepDur) {
    const bar = Math.floor(s / 8), i = s % 8;
    const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
    const off = t - this.ctx.currentTime;
    const M = this.music;

    // every two bars a new chord blooms, with a soft bass note held underneath
    if (i === 0 && bar % 2 === 0) {
      this.pad(chord.tones, stepDur * 16, off);
      this.soft(midi(chord.root), stepDur * 16, 0.13, off, 0.6);
      this.soft(midi(chord.root + 12), stepDur * 14, 0.04, off, 0.8);
    }

    // each bar, pick a few bell notes at random, wandering up or down the scale in small steps
    if (i === 0) {
      const rng = seeded(bar * 7919 + M.seed);
      M.plan = new Array(8).fill(null);
      for (const slot of [0, 2, 3, 4, 6]) {
        if (rng() < 0.5) {
          M.last = clamp(M.last + Math.round((rng() - 0.5) * 4), 0, BELL_NOTES.length - 1);
          M.plan[slot] = BELL_NOTES[M.last];
        }
      }
    }
    if (M.plan[i]) this.bell(M.plan[i], off, 0.07);

    // when the owner is on to you, a slow, soft heartbeat: a hint of tension, nothing harsh
    if (this.tension > 0.45 && (i === 0 || i === 3)) this.tone(80, 0.22, 'sine', 0.12 * this.tension, 0.5, off, this.musicBus);
  }

  update(playing) {
    if (!this.ctx) return;
    const c = this.ctx, now = c.currentTime;
    const stepDur = 60 / (BPM + this.tension * 6) / 2;       // barely quickens when the owner is suspicious
    if (this.music.next < now - 0.5) this.music.next = now + 0.05;
    while (this.music.next < now + 0.15) {
      this.step(this.music.step, this.music.next, stepDur);
      this.music.step++;
      this.music.next += stepDur;
    }
    this.musicBus.gain.setTargetAtTime(playing ? 0.8 : 0.45, now, 0.3);
  }
}
