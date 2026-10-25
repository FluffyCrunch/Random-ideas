// Every sound is synthesised with the Web Audio API, so the game needs no audio files.
// (If you do drop real cat recordings into public/sounds, they are used instead.)
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

// A sneaky walking-bass loop in A minor, two bars per pass
const BASS = [0, null, null, 0, null, null, 7, null, 0, null, null, 5, null, null, 3, null];
const ROOTS = [45, 45, 48, 43];
const PENTA = [69, 72, 74, 76, 79, 81];

// Cat voices. The sound is a buzzy source pushed through vowel-like resonances (formants)
// that glide between "ee", "ah" and "oo", which is what shapes a meow.
// f0: pitch contour in Hz, at: when each point lands (0..1 of the sound), form: [F1, F2] at start, middle and end.
const VOICES = {
  meow:  { dur: 0.8,  f0: [520, 780, 600, 400], at: [0, 0.22, 0.55, 1], form: [[420, 2500], [900, 1500], [520, 1050]], vib: 6, vibD: 0.025 },
  mew:   { dur: 0.34, f0: [860, 1180, 920],     at: [0, 0.4, 1],        form: [[500, 2700], [820, 2200], [650, 1900]], vib: 7, vibD: 0.02 },
  trill: { dur: 0.72, f0: [480, 740, 540, 380], at: [0, 0.25, 0.6, 1],  form: [[420, 2400], [880, 1500], [500, 1000]], vib: 6, vibD: 0.03, trill: 26 },
  yowl:  { dur: 1.35, f0: [340, 540, 660, 430, 290], at: [0, 0.2, 0.45, 0.8, 1], form: [[500, 1800], [920, 1400], [650, 1000]], vib: 5, vibD: 0.05 },
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.tension = 0;         // 0..1, driven by how suspicious the owner is
    this.music = { step: 0, next: 0 };
    this.lastThud = 0;
    this.samples = { meow: [], purr: [] };
    this.voice = null;
    this.initVoice();
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.attach(new AC());
    this.loadSamples();
  }

  // Wire up the mixer buses to an audio context (also used to render sounds offline for testing)
  attach(c) {
    this.ctx = c;
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
    if (m) window.speechSynthesis?.cancel();
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

  // ---- real recordings, if the player adds some ----
  async loadSamples() {
    try {
      const base = import.meta.env.BASE_URL;
      const res = await fetch(`${base}sounds/manifest.json`, { cache: 'no-cache' });
      if (!res.ok) return;
      const manifest = await res.json();
      for (const kind of ['meow', 'purr']) {
        for (const file of manifest[kind] || []) {
          try {
            const r = await fetch(`${base}sounds/${file}`);
            if (r.ok) this.samples[kind].push(await this.ctx.decodeAudioData(await r.arrayBuffer()));
          } catch { /* a bad file just gets skipped */ }
        }
      }
    } catch { /* no manifest: use the synthesised voices */ }
  }

  playSample(kind, dur = 0, vol = 1) {
    const list = this.samples[kind];
    if (!list.length || !this.ctx) return false;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = pick(list);
    s.playbackRate.value = kind === 'meow' ? rand(0.95, 1.06) : 1;
    g.gain.setValueAtTime(vol, t);
    s.connect(g).connect(this.sfxBus);
    s.start(t);
    if (kind === 'purr') {
      // a purr recording is looped for as long as it's needed, with a soft fade in and out
      s.loop = true;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.4);
      g.gain.setValueAtTime(vol, t + Math.max(0.4, dur - 0.5));
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      s.stop(t + dur + 0.05);
    }
    return true;
  }

  // ---- the cat ----
  meow(kind = 'meow', pitch = 1) {
    if (!this.ctx) return;
    if (this.playSample('meow')) return;
    const c = this.ctx, t = c.currentTime, V = VOICES[kind] || VOICES.meow;
    const d = V.dur * rand(0.92, 1.08);
    const f0 = V.f0.map(f => f * pitch);

    // the voice: two slightly detuned sawtooth waves, so it buzzes like a throat
    const voice = c.createGain();
    const oscs = [-9, 9].map(detune => {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = detune;
      o.frequency.setValueAtTime(f0[0], t);
      for (let i = 1; i < f0.length; i++) o.frequency.linearRampToValueAtTime(f0[i], t + V.at[i] * d);
      o.connect(voice);
      o.start(t);
      o.stop(t + d + 0.1);
      return o;
    });
    // a little wobble in the pitch that fades in, the way a held note settles
    const lfo = c.createOscillator(), depth = c.createGain();
    lfo.frequency.value = V.vib;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f0[1] * V.vibD, t + 0.3);
    lfo.connect(depth);
    oscs.forEach(o => depth.connect(o.frequency));
    lfo.start(t);
    lfo.stop(t + d + 0.1);

    // the throat and mouth: three resonances whose pitch glides "ee" -> "ah" -> "oo"
    const env = c.createGain();
    [[0, 1.0, 8], [1, 0.75, 9], [-1, 0.3, 10]].forEach(([idx, gain, q]) => {
      const f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass';
      f.Q.value = q;
      if (idx === -1) f.frequency.value = 3400;
      else {
        f.frequency.setValueAtTime(V.form[0][idx], t);
        f.frequency.linearRampToValueAtTime(V.form[1][idx], t + d * 0.45);
        f.frequency.linearRampToValueAtTime(V.form[2][idx], t + d);
      }
      g.gain.value = gain;
      voice.connect(f).connect(g).connect(env);
    });
    // a breath of air on top
    const n = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain();
    n.buffer = this.noiseBuf;
    nf.type = 'highpass';
    nf.frequency.value = 2600;
    ng.gain.value = 0.05;
    n.connect(nf).connect(ng).connect(env);
    n.start(t, Math.random() * 0.4);
    n.stop(t + d + 0.1);

    // loudness: a quick attack, a held middle, and a soft tail
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.7, t + 0.05);
    env.gain.setValueAtTime(0.7, t + d * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t + d);
    let out = env;
    if (V.trill) {
      // the rolled "r" in "mrrow": the voice flutters on and off about 26 times a second
      const fl = c.createGain(), flfo = c.createOscillator(), fd = c.createGain();
      fl.gain.value = 0.55;
      fd.gain.value = 0.45;
      flfo.frequency.value = V.trill;
      flfo.connect(fd).connect(fl.gain);
      flfo.start(t);
      flfo.stop(t + d + 0.1);
      env.connect(fl);
      out = fl;
    }
    out.connect(this.sfxBus);
  }

  // A purr is about 25 rough little pulses a second, swelling and fading with each breath
  purr(dur = 3, vol = 1) {
    if (!this.ctx) return;
    if (this.playSample('purr', dur, vol)) return;
    const c = this.ctx, t0 = c.currentTime;
    const gate = c.createGain();
    gate.gain.value = 0.3;

    // the rumble: a low buzzy tone plus noise, with resonances at 120, 300 and 600 Hz
    // so small laptop speakers can reproduce it
    const body = c.createGain();
    const saw = c.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = 52;
    saw.connect(body);
    saw.start(t0);
    saw.stop(t0 + dur + 0.1);
    const n = c.createBufferSource(), ng = c.createGain();
    n.buffer = this.noiseBuf;
    n.loop = true;
    ng.gain.value = 0.55;
    n.connect(ng).connect(body);
    n.start(t0);
    n.stop(t0 + dur + 0.1);
    [[120, 1, 0.9], [300, 1.2, 1.0], [600, 1.5, 0.6]].forEach(([freq, q, gain]) => {
      const f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q;
      g.gain.value = gain;
      body.connect(f).connect(g).connect(gate);
    });

    // breathing: louder on the exhale, quieter on the inhale
    const swell = c.createGain();
    swell.gain.setValueAtTime(0.0001, t0);
    swell.gain.exponentialRampToValueAtTime(0.6 * vol, t0 + 0.4);
    swell.gain.setValueAtTime(0.6 * vol, t0 + Math.max(0.4, dur - 0.5));
    swell.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    gate.connect(swell).connect(this.sfxBus);

    // the pulses themselves, slightly uneven like a real animal
    let t = t0 + 0.02;
    while (t < t0 + dur - 0.05) {
      const breath = 0.78 + 0.22 * Math.sin(((t - t0) / 2.3) * Math.PI * 2);
      gate.gain.setValueAtTime(0.3, t);
      gate.gain.linearRampToValueAtTime(breath, t + 0.007);
      gate.gain.exponentialRampToValueAtTime(0.3, t + 0.034);
      t += (1 / 25) * rand(0.94, 1.06);
    }
  }

  // ---- the owner's voice ----
  initVoice() {
    const ss = window.speechSynthesis;
    if (!ss) return;
    const choose = () => {
      const voices = ss.getVoices().filter(v => /^en/i.test(v.lang));
      this.voice =
        voices.find(v => /\b(male|david|mark|daniel|james|george|alex|fred|guy)\b/i.test(v.name) && !/female/i.test(v.name)) ||
        voices.find(v => /^en-(us|gb)/i.test(v.lang)) ||
        voices[0] || null;
    };
    choose();
    ss.addEventListener?.('voiceschanged', choose);
  }

  // Shout a word or two using the browser's built-in voice, falling back to a grunt
  shout(text, { pitch = 0.8, rate = 1.25 } = {}) {
    if (this.muted) return;
    const ss = window.speechSynthesis;
    if (!ss || typeof SpeechSynthesisUtterance === 'undefined') { this.grunt(); return; }
    try {
      ss.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.pitch = pitch;
      u.rate = rate;
      u.volume = 1;
      if (this.voice) u.voice = this.voice;
      ss.speak(u);
    } catch { this.grunt(); }
  }

  // A synthesised "ack!": a short grunt through an "a" vowel, ending in a click of the throat
  grunt() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, d = 0.24;
    const src = c.createOscillator(), env = c.createGain();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(150, t);
    src.frequency.exponentialRampToValueAtTime(95, t + d);
    [[700, 8, 1], [1700, 9, 0.6]].forEach(([freq, q, g]) => {
      const f = c.createBiquadFilter(), gg = c.createGain();
      f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; gg.gain.value = g;
      src.connect(f).connect(gg).connect(env);
    });
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1.6, t + 0.03);
    env.gain.setValueAtTime(1.6, t + d * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, t + d);
    env.connect(this.sfxBus);
    src.start(t);
    src.stop(t + d + 0.02);
    this.noise(0.04, 0.2, 2800, 'bandpass', d * 0.85);
  }

  // ---- sound effects ----
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
