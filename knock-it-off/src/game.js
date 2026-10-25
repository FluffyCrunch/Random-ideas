import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RULES, ROOM, MATS } from './constants.js';
import { clamp, lerp, rand, pick, sph, cone, at } from './gfx.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { UI, money } from './ui.js';
import { Effects } from './effects.js';
import { Prop } from './props.js';
import { buildWorld, PLACEMENTS, CAT_SPAWN } from './world.js';
import { Cat } from './cat.js';
import { Owner } from './owner.js';

const WORDS = ['CRASH!', 'Oops. (Not sorry.)', 'Gravity works!', 'Smashing!', 'Cat-astrophe!', 'Purrfect!', 'Whoopsie!', 'Nailed it!', 'That was fragile.'];
// What the owner yells. Each one is spoken aloud and pops up over his head.
const SHOUTS = {
  crash: ['Ack!', 'Whoa!', 'Oh no!', 'Hey!', 'What was that?!', 'Gah!'],
  notice: ['Hey!', 'Biscuit?!', 'Oi!', 'What did you do?!'],
  caught: ['Bad cat!', 'Biscuit!', 'Not again!', 'Seriously?!'],
  aww: ['Aww!', 'Awww, good boy!'],
  pet: ["Who's a good boy?", 'Aww, hello!'],
};
const NO_INPUT = { isDown: () => false, take: () => false };
const _v = new THREE.Vector3();

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1d1713);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 60);

    // physics: gravity a little stronger than real, which feels snappier for a cat game
    this.physics = new CANNON.World({ gravity: new CANNON.Vec3(0, -18, 0) });
    this.physics.allowSleep = true;
    // props and furniture grip a little and bounce a little; the cat slides smoothly along everything
    this.physics.addContactMaterial(new CANNON.ContactMaterial(MATS.world, MATS.world, { friction: 0.35, restitution: 0.15 }));
    this.physics.addContactMaterial(new CANNON.ContactMaterial(MATS.cat, MATS.world, { friction: 0, restitution: 0 }));
    this.catMat = MATS.cat;

    this.input = new Input(canvas);
    this.sound = new Sound();
    this.ui = new UI();
    this.effects = new Effects(this.scene);
    this.world = buildWorld(this.scene, this.physics);
    this.cat = new Cat(this.scene, this.physics, this.catMat);
    this.owner = new Owner(this.scene, this.physics);

    this.props = [];
    this.fish = [];
    this.pendingBreaks = [];
    this.pendingThuds = [];
    this.cam = { yaw: 0.3, pitch: 0.42, dist: 5.4 };
    this.shake = 0;
    this.t = 0;
    this.state = 'menu';
    this.pendingEnd = null;

    this.resize();
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });
    // Esc releases a captured mouse without the page seeing the key, so pause when that happens
    this.input.onLockChange = locked => { if (!locked && this.state === 'playing') this.pause(); };
    const on = (id, fn) => document.getElementById(id).addEventListener('click', () => { this.sound.unlock(); this.sound.click(); fn(); });
    on('playBtn', () => this.begin());
    on('resumeBtn', () => this.resume());
    on('againBtn', () => this.begin());
    on('muteBtn', () => this.toggleMute());

    this.resetRound();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- round lifecycle ----------
  resetRound() {
    for (const p of this.props) if (!p.broken) { this.physics.removeBody(p.body); this.scene.remove(p.mesh); }
    this.props = [];
    for (const f of this.fish) this.scene.remove(f.mesh);
    this.fish = [];
    this.effects.clear();
    this.pendingBreaks.length = 0;
    this.pendingThuds.length = 0;

    for (const [type, x, y, z, rot] of PLACEMENTS) {
      const p = new Prop(type, x, y, z, rot);
      p.start = p.body.position.clone();
      p.armedAt = this.t + 0.8;
      p.body.addEventListener('collide', e => this.onPropCollide(p, e));
      this.physics.addBody(p.body);
      this.scene.add(p.mesh);
      p.body.sleep();
      this.props.push(p);
    }

    this.cat.teleport(CAT_SPAWN.x, CAT_SPAWN.y, CAT_SPAWN.z);
    this.cat.yaw = 0;
    this.owner.reset();
    this.score = 0;
    this.strikes = 0;
    this.timeLeft = RULES.time;
    this.guilt = 0;
    this.combo = { count: 0, t: 0, best: 0 };
    this.stats = { broken: 0, thuds: 0 };
    this.lureCd = 0;
    this.meowCd = 0;
    this.sitT = 0;
    this.purrCd = 0;
    this.lastBreak = null;
    this.pendingEnd = null;
    this.endDelay = 0;
  }

  // The owner yells something: you hear it, and it pops up over his head
  ownerShout(kind) {
    const text = SHOUTS[kind] ? pick(SHOUTS[kind]) : kind;
    this.sound.shout(text, { pitch: rand(0.72, 0.9), rate: rand(1.15, 1.3) });
    this.ui.worldPop(text, _v.set(this.owner.x, 2.25, this.owner.z), this.camera, 'word');
  }

  begin() {
    this.sound.unlock();
    this.resetRound();
    this.state = 'playing';
    this.input.wantLock = true;
    this.input.lock();
    for (const n of ['start', 'pause', 'end']) this.ui.hide(n);
    this.ui.show('hud');
    this.ui.el.hint.classList.remove('fade');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.ui.el.hint.classList.add('fade'), 14000);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.wantLock = false;
    this.input.unlock();
    this.ui.show('pause');
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.input.wantLock = true;
    this.input.lock();
    this.ui.hide('pause');
  }
  toggleMute() { this.sound.setMuted(!this.sound.muted); this.ui.setMuted(this.sound.muted); }

  finish(reason) {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.input.wantLock = false;
    this.input.unlock();     // give the cursor back for the end screen
    const win = reason === 'win';
    const goal = RULES.goal;
    const total = PLACEMENTS.length;
    const rating = this.score >= goal * 1.5 ? 'Legendary Menace'
      : this.score >= goal ? 'Little Terror'
      : this.score >= goal * 0.5 ? 'Mild Nuisance'
      : 'Suspiciously Well-Behaved';
    const copy = {
      win: ['CHAOS COMPLETE', 'The living room will never recover.'],
      grounded: ['GROUNDED', 'Three strikes. No treats for a week.'],
      time: ["TIME'S UP", 'The house survives. Barely.'],
    }[reason];
    this.sound[win ? 'win' : 'lose']();
    this.ui.showEnd({
      title: copy[0], sub: copy[1], rating, win,
      stats: [
        ['Damage', money(this.score)],
        ['Items destroyed', `${this.stats.broken} / ${total}`],
        ['Times caught', `${this.strikes} / ${RULES.strikes}`],
        ['Best combo', `x${(1 + Math.min(this.combo.best, 8) * 0.25).toFixed(2)}`],
        ['Time left', `${Math.floor(this.timeLeft)}s`],
      ],
    });
  }

  // ---------- gameplay events ----------
  onPropCollide(p, e) {
    if (p.broken || p.queued || this.t < p.armedAt) return;
    const other = e.body, d = p.def;
    const speed = Math.abs(e.contact.getImpactVelocityAlongNormal());
    const byCat = other === this.cat.body;
    // a cat shoulder-barging a mug has to really mean it
    if (d.breakable && speed >= d.breakSpeed + (byCat ? 1.8 : 0)) {
      p.queued = true;
      this.pendingBreaks.push(p);
      return;
    }
    if (!d.breakable && !byCat && other.tag === 'floor' && !p.scored && p.displaced() && speed > 1) {
      p.scored = true;
      this.pendingThuds.push(p);
    }
    if (speed > 1.3) this.sound.thud(Math.min(1, speed / 7));
  }

  comboMult() { return 1 + Math.min(this.combo.count, 8) * 0.25; }

  award(p, label) {
    const mult = this.comboMult();
    const pts = Math.round(p.def.value * mult);
    this.score += pts;
    this.combo.count++;
    this.combo.t = 3;
    this.combo.best = Math.max(this.combo.best, this.combo.count);
    this.ui.worldPop(`+${money(pts)}`, p.body.position, this.camera, 'money');
    if (label) {
      _v.copy(p.body.position); _v.y += 0.35;
      this.ui.worldPop(label, _v, this.camera, 'word');
    }
    if (this.combo.count >= 3) this.sound.chime(Math.min(this.combo.count, 8));
  }

  breakProp(p) {
    p.broken = true;
    this.physics.removeBody(p.body);
    this.scene.remove(p.mesh);
    const pos = p.body.position, d = p.def;
    this.stats.broken++;
    this.effects.burst({ pos, colors: d.debris, count: d.fish ? 26 : 22, speed: 2.6, size: 0.055, up: 3 });
    if (d.fish) this.effects.burst({ pos, colors: [0x4fc3f7, 0xbfe9ff], count: 40, speed: 3, size: 0.035, up: 3.5, grav: 10 });
    if (d.puddle && pos.y < 0.5) this.effects.puddle(pos.x, pos.z, d.puddle, d.fish ? 0.55 : 0.32);
    this.sound.crash(d.sound);
    this.award(p, pick(WORDS));
    this.lastBreak = d;
    this.guilt = Math.min(1, this.guilt + 0.5);
    this.owner.hear(pos.x, pos.z);
    this.shake = Math.max(this.shake, 0.18);
    if (d.fish) this.spawnFish(pos);
  }

  thudScore(p) {
    this.stats.thuds++;
    this.lastBreak = p.def;
    this.award(p, 'Thud.');
    this.guilt = Math.min(1, this.guilt + 0.15);
    this.owner.hear(p.body.position.x, p.body.position.z);
  }

  spawnFish(pos) {
    const g = new THREE.Group();
    const body = sph(0.05, 0xff7a1a, { flatShading: false });
    body.scale.set(1.7, 1, 0.7);
    g.add(body);
    const tail = cone(0.045, 0.08, 0xff7a1a, 4);
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -0.1;
    g.add(tail);
    g.position.set(pos.x, Math.max(0.1, pos.y), pos.z);
    this.scene.add(g);
    this.fish.push({ mesh: g, vy: 2.5, t: 0, vx: rand(-0.6, 0.6), vz: rand(-0.6, 0.6) });
    this.ui.worldPop('Gerald!', _v.set(pos.x, pos.y + 0.5, pos.z), this.camera, 'word');
  }

  updateFish(dt) {
    for (const f of this.fish) {
      f.t += dt;
      const m = f.mesh;
      f.vy -= 14 * dt;
      m.position.y += f.vy * dt;
      m.position.x = clamp(m.position.x + f.vx * dt, ROOM.x0 + 0.3, ROOM.x1 - 0.3);
      m.position.z = clamp(m.position.z + f.vz * dt, ROOM.z0 + 0.3, ROOM.z1 - 0.3);
      if (m.position.y < 0.03) {
        m.position.y = 0.03;
        f.vy = 1.4 + Math.random() * 1.2;
        f.vx = rand(-0.7, 0.7);
        f.vz = rand(-0.7, 0.7);
        m.rotation.set(rand(-0.3, 0.3), rand(0, 6), Math.random() < 0.5 ? 0 : Math.PI);
      }
      if (f.t > 5) m.scale.setScalar(Math.max(0.001, m.scale.x - dt * 2));
    }
    this.fish = this.fish.filter(f => {
      if (f.t > 6) { this.scene.remove(f.mesh); return false; }
      return true;
    });
  }

  doSwat() {
    const c = this.cat;
    if (!c.swat()) return;
    this.sound.swat();
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    let hit = 0;
    for (const p of this.props) {
      if (p.broken) continue;
      const b = p.body;
      const dx = b.position.x - c.x, dz = b.position.z - c.z, dy = b.position.y - c.y;
      const dist = Math.hypot(dx, dz) || 1e-6;
      if (dist > 1.5 || Math.abs(dy) > 1.1) continue;
      if ((dx * fx + dz * fz) / dist < 0.2) continue;
      let ax = fx * 0.6 + (dx / dist) * 0.4, az = fz * 0.6 + (dz / dist) * 0.4;
      const l = Math.hypot(ax, az) || 1;
      ax /= l; az /= l;
      b.wakeUp();
      b.velocity.set(ax * 4.6, 2.4, az * 4.6);
      b.angularVelocity.set(rand(-6, 6), rand(-4, 4), rand(-6, 6));
      hit++;
    }
    if (hit) {
      this.guilt = Math.min(1, this.guilt + 0.14 * Math.min(hit, 2));
      this.shake = Math.max(this.shake, 0.08);
    }
  }

  doMeow() {
    if (this.meowCd > 0) return;
    this.meowCd = 1.2;
    this.cat.meow();
    this.sound.meow(pick(['meow', 'meow', 'mew', 'trill']), rand(0.92, 1.1));
    this.ui.worldPop('MEOW!', _v.set(this.cat.x, this.cat.y + 0.9, this.cat.z), this.camera, 'word');
    if (this.lureCd <= 0 && this.owner.lure(this.cat)) {
      this.lureCd = 10;
      this.ui.callout('Your human is coming...');
    }
  }

  onCaught() {
    this.strikes++;
    this.sound.caught();
    this.sound.meow('yowl', rand(0.92, 1.05));     // the indignant cat
    this.ownerShout('caught');
    this.ui.flash();
    const fine = Math.round(this.score * 0.1);
    this.score -= fine;
    this.guilt = 0;
    this.combo.count = 0;
    this.ui.callout(fine ? `CAUGHT!  -${money(fine)}` : 'CAUGHT!', 'bad');
    this.cat.teleport(CAT_SPAWN.x, CAT_SPAWN.y, CAT_SPAWN.z);
    if (this.strikes >= RULES.strikes) { this.pendingEnd = 'grounded'; this.endDelay = 1.6; }
  }

  // ---------- the loop ----------
  start() {
    this.last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  frame(dt) {
    const input = this.input;
    if (input.take('KeyM')) this.toggleMute();
    if (input.take('Escape')) { this.state === 'playing' ? this.pause() : this.resume(); }
    if (input.take('Enter') && (this.state === 'menu' || this.state === 'over')) this.begin();

    if (this.state === 'playing') this.step(dt);
    else if (this.state === 'menu' || this.state === 'over') this.idle(dt);

    this.world.tv.material.emissiveIntensity = 0.5 + Math.sin(this.t * 3) * 0.12;
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.sound.update(this.state === 'playing');
    input.endFrame();
  }

  // The menu and end screen: the cat naps on the sofa while the world carries on
  idle(dt) {
    this.t += dt;
    this.cat.update(dt, NO_INPUT, 0, true);
    this.physics.step(1 / 60, dt, 3);
    this.owner.update(dt, this);
    this.effects.update(dt);
    this.updateFish(dt);
    this.syncProps();
  }

  syncProps() {
    for (const p of this.props) if (!p.broken) p.sync();
  }

  step(dt) {
    const input = this.input;
    this.t += dt;
    this.timeLeft -= dt;
    this.meowCd = Math.max(0, this.meowCd - dt);
    this.lureCd = Math.max(0, this.lureCd - dt);

    // camera control: right-drag or arrow keys to orbit, wheel to zoom
    const cam = this.cam;
    const sens = input.locked ? 0.0026 : 0.005;     // a captured mouse sends far more movement per swipe
    cam.yaw -= input.orbit.dx * sens;
    cam.pitch = clamp(cam.pitch + input.orbit.dy * sens * 0.8, 0.12, 1.15);
    cam.yaw += ((input.isDown('ArrowLeft') ? 1 : 0) - (input.isDown('ArrowRight') ? 1 : 0)) * 1.9 * dt;
    cam.pitch = clamp(cam.pitch + ((input.isDown('ArrowDown') ? 1 : 0) - (input.isDown('ArrowUp') ? 1 : 0)) * 1.1 * dt, 0.12, 1.15);
    cam.dist = clamp(cam.dist + input.wheel * 0.45, 3, 8.5);

    if (input.take('Mouse0') || input.take('KeyF')) this.doSwat();
    if (input.take('KeyQ')) this.doMeow();

    const petting = this.owner.state === 'pet';
    this.cat.update(dt, input, cam.yaw, petting);
    for (const ev of this.cat.events) {
      if (ev === 'jump') this.sound.jump();
      else if (ev === 'doubleJump') {
        this.sound.doubleJump();
        this.effects.burst({ pos: _v.set(this.cat.x, this.cat.y - 0.25, this.cat.z), colors: [0xffffff, 0xf8d9ae], count: 6, speed: 1.2, size: 0.05, up: 0.5, life: 0.5, grav: 2 });
      } else if (ev === 'land') this.sound.thud(0.3);
    }

    this.physics.step(1 / 60, dt, 3);
    for (const p of this.pendingBreaks) this.breakProp(p);
    for (const p of this.pendingThuds) this.thudScore(p);
    this.pendingBreaks.length = 0;
    this.pendingThuds.length = 0;
    this.syncProps();

    // a purr while the cat sits there looking sweet
    this.purrCd = Math.max(0, this.purrCd - dt);
    this.sitT = this.cat.sitting ? this.sitT + dt : 0;
    if (this.sitT > 1.1 && this.purrCd <= 0) { this.sound.purr(3, 0.7); this.purrCd = 3.4; }

    this.owner.update(dt, this);
    if (this.owner.heardEvent) {
      this.owner.heardEvent = false;
      const d = this.lastBreak;
      this.ownerShout(d && d.fish ? 'GERALD!' : d && Math.random() < 0.3 ? `My ${d.name.toLowerCase()}!` : 'crash');
    }
    if (this.owner.noticed) this.ownerShout('notice');
    this.effects.update(dt);
    this.updateFish(dt);

    // guilt fades faster if the cat sits still and looks sweet
    this.guilt = Math.max(0, this.guilt - (this.cat.sitting ? 0.5 : 0.12) * dt);
    if (this.combo.t > 0 && (this.combo.t -= dt) <= 0) this.combo.count = 0;
    this.sound.tension = this.owner.state === 'chase' ? 1 : this.owner.susp;

    this.ui.update({
      score: this.score, goal: RULES.goal, timeLeft: this.timeLeft, strikes: this.strikes,
      susp: this.owner.susp, guilt: this.guilt, comboCount: this.combo.count, mult: this.comboMult(),
    });
    this.ui.owner(this.owner.speech, this.owner.eye(_v.set(0, 0, 0)).setY(2.1), _v.clone().set(this.owner.x, 1.2, this.owner.z), this.camera, this.owner.state);

    if (this.pendingEnd) { if ((this.endDelay -= dt) <= 0) this.finish(this.pendingEnd); }
    else if (this.score >= RULES.goal) this.finish('win');
    else if (this.timeLeft <= 0) this.finish('time');
  }

  updateCamera(dt) {
    const cam = this.cam, c = this.cat;
    let target, yaw = cam.yaw, pitch = cam.pitch, dist = cam.dist;
    if (this.state === 'playing' || this.state === 'paused') {
      target = _v.set(c.x, c.y + 0.5, c.z);
    } else {
      // menu: a slow lap around the room
      cam.yaw += dt * 0.12;
      yaw = cam.yaw; pitch = 0.4; dist = 10.5;
      target = _v.set(0, 1.0, 0);
    }
    const cp = Math.cos(pitch);
    const want = new THREE.Vector3(target.x + Math.sin(yaw) * cp * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * cp * dist);
    // keep the camera inside the room
    want.x = clamp(want.x, ROOM.x0 + 0.5, ROOM.x1 - 0.5);
    want.z = clamp(want.z, ROOM.z0 + 0.5, ROOM.z1 - 0.5);
    want.y = clamp(want.y, 0.6, ROOM.h - 0.25);
    if (!this.camPos) this.camPos = want.clone();
    this.camPos.lerp(want, 1 - Math.exp(-9 * dt));
    this.shake = Math.max(0, this.shake - dt * 0.8);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) this.camera.position.add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(this.shake * 0.35));
    this.camera.lookAt(target);
  }
}
