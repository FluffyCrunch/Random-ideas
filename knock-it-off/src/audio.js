// Every sound is synthesised with the Web Audio API, so the game ships no audio files.
const rand = (a, b) => a + Math.random() * (b - a);
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

// A sneaky walking-bass loop in A minor, two bars per pass
const BASS = [0, null, null, 0, null, null, 7, null, 0, null, null, 5, null, null, 3, null];
const ROOTS = [45, 45, 48, 43];
const PENTA = [69, 72, 74, 76, 79, 81];

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.tension = 0;         // 0..1, driven by how suspicious the owner is
    this.music = { step: 0, next: 0 };
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
  click() { this.tone(620, 0.06, 'square', 0.04, 0.8); }

  caught() {
    this.tone(150, 0.9, 'sawtooth', 0.09, 0.7);
    this.tone(158, 0.9, 'sawtooth', 0.09, 0.7);
    this.noise(0.4, 0.15, 900);
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
  lose() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.55, 'sawtooth', 0.07, 0.85, i * 0.22)); }

  // ---- music ----
  step(s, t) {
    const bar = Math.floor(s / 16) % 4, i = s % 16;
    const root = ROOTS[bar];
    const bus = this.musicBus;
    const c = this.ctx;
    const off = t - c.currentTime;

    if (BASS[i] !== null) this.tone(midi(root + BASS[i]), 0.3, 'triangle', 0.16, 0.92, off, bus);
    if (i % 4 === 2) this.tone(midi(PENTA[(bar * 2 + (i >> 2) + (i & 1)) % PENTA.length]), 0.18, 'sine', 0.045, 0.9, off, bus);
    if (i === 4 || i === 12) this.noise(0.04, 0.06, 1800, 'bandpass', off, bus);
    if (i % 2 === 0) this.noise(0.025, 0.018, 7500, 'highpass', off, bus);
    // when the owner is getting suspicious, strings creep in with a clashing semitone
    if (this.tension > 0.2 && i === 0) {
      const v = this.tension * 0.05;
      this.tone(midi(57), 1.9, 'sawtooth', v, 1.0, off, bus);
      this.tone(midi(58), 1.9, 'sawtooth', v, 1.0, off, bus);
    }
  }

  update(playing) {
    if (!this.ctx) return;
    const c = this.ctx, now = c.currentTime;
    const stepDur = 60 / (118 + this.tension * 18) / 2;
    if (this.music.next < now - 0.5) this.music.next = now + 0.05;
    while (this.music.next < now + 0.15) {
      this.step(this.music.step, this.music.next);
      this.music.step++;
      this.music.next += stepDur;
    }
    this.musicBus.gain.setTargetAtTime(playing ? 0.45 : 0.25, now, 0.3);
  }
}
