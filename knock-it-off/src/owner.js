import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { G } from './constants.js';
import { NAV } from './world.js';
import { box, cyl, sph, at, clamp, lerp, lerpAngle, rand, pick } from './gfx.js';

// What the owner says. Everything here is a reaction to something the cat did.
const LINES = {
  idle: ['Where did my keys go...', 'Why is it so quiet?', "Mr. Biscuit? Where's my little angel?", 'I swear I left my coffee right here.', 'Hmm. Everything looks... fine.'],
  heard: ['Was that... the vase?!', 'What was that noise?!', 'Did something just fall?', 'That did NOT sound good.'],
  suspicious: ['Biscuit... what did you do?', 'You have a very guilty look.', 'Why are you looking at me like that?'],
  caught: ['NOT AGAIN! Bad cat!', "That was my grandmother's! ...Okay, it was ugly. BUT STILL!", 'That is coming out of your allowance!', 'Biscuit!! We talked about this!'],
  aww: ['Aww, such a good boy.', 'Who is the sweetest? You are!', 'Look at that innocent little face.'],
  lure: ['Aww, are you hungry?', 'Okay okay, Daddy is coming.', 'Did you call me, buddy?'],
  pet: ['Who is a good boy? You are!', 'Best cat ever. Never changes.', 'You would never break anything. Right?'],
  petEnd: ['Right. Back to... whatever I was doing.', 'Okay, enough cuddles.'],
  look: ['Hmm. Nothing here.', 'Strange.', 'Must have been the wind.', 'Weird. I could have sworn...'],
  lost: ['Where did you go...', 'Come out, you little menace.'],
};

const adj = {};
for (const [a, b] of NAV.edges) {
  (adj[a] ||= []).push(b);
  (adj[b] ||= []).push(a);
}
function nearestNode(x, z) {
  let best = null, bd = Infinity;
  for (const [n, [nx, nz]] of Object.entries(NAV.nodes)) {
    const d = Math.hypot(nx - x, nz - z);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
function bfs(from, to) {
  const prev = { [from]: null };
  const q = [from];
  while (q.length) {
    const n = q.shift();
    if (n === to) break;
    for (const m of adj[n] || []) if (!(m in prev)) { prev[m] = n; q.push(m); }
  }
  const path = [];
  for (let n = to; n; n = prev[n]) path.unshift(n);
  return path;
}

export class Owner {
  constructor(scene, physics) {
    this.physics = physics;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.build();
    this._from = new CANNON.Vec3();
    this._to = new CANNON.Vec3();
    this._ray = new CANNON.RaycastResult();
    this.reset();
  }

  build() {
    const skin = 0xf1c9a5, robe = 0x7a2e4d, pants = 0x3a4a7a, slipper = 0xf4a6c0;
    const g = this.group;
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.12, 0.88, 0);
      hip.add(at(box(0.15, 0.78, 0.16, pants), 0, -0.39, 0));
      hip.add(at(box(0.17, 0.08, 0.28, slipper), 0, -0.82, 0.05));
      g.add(hip);
      this.legs.push(hip);
    }
    g.add(at(box(0.5, 0.68, 0.28, robe), 0, 1.22, 0));
    g.add(at(box(0.52, 0.07, 0.3, 0xe8d6b8), 0, 1.1, 0));      // belt
    g.add(at(box(0.16, 0.3, 0.03, 0xf4e9d8), 0, 1.42, 0.145)); // robe lapel
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(s * 0.33, 1.5, 0);
      sh.add(at(box(0.12, 0.56, 0.12, robe), 0, -0.28, 0));
      sh.add(at(sph(0.06, skin, { flatShading: false }), 0, -0.6, 0));
      g.add(sh);
      this.arms.push(sh);
    }
    // a coffee mug in the right hand, because of course
    const mug = at(cyl(0.05, 0.045, 0.1, 0xf4f0e8, 10), 0, -0.62, 0.08);
    this.arms[1].add(mug);
    this.head = new THREE.Group();
    this.head.position.set(0, 1.74, 0);
    this.head.add(sph(0.14, skin, { flatShading: false }, 14, 10));
    const hair = at(sph(0.15, 0x3a2a22, { flatShading: true }, 10, 7), 0, 0.05, -0.02);
    hair.scale.set(1, 0.7, 1);
    this.head.add(hair);
    for (const [x, y, z] of [[-0.08, 0.15, 0.05], [0.07, 0.16, 0], [0, 0.17, -0.06]]) this.head.add(at(sph(0.05, 0x3a2a22, { flatShading: true }, 6, 5), x, y, z));
    this.eyes = [];
    for (const s of [-1, 1]) {
      const eye = at(sph(0.022, 0x111111, { flatShading: false }, 8, 6), s * 0.05, 0.02, 0.125);
      this.head.add(eye);
      this.eyes.push(eye);
    }
    g.add(this.head);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }

  reset() {
    const [x, z] = NAV.nodes.door;
    this.x = x; this.z = z;
    this.yaw = Math.PI;
    this.state = 'idle';
    this.timer = 5;            // a few seconds of grace at the start
    this.path = [];
    this.susp = 0;
    this.sees = false;
    this.unseen = 0;
    this.lastSeen = { x: 0, z: 0 };
    this.catchCd = 0;
    this.awwT = -99;
    this.speech = null;
    this.walkPhase = 0;
    this.moving = false;
    this.repath = 0;
    this.dest = 'door';
    this.baseYaw = this.yaw;
    this.speech = null;
    this.syncVisual(0);
  }

  say(text, dur = 2.6) { this.speech = { text, t: dur }; }

  // Where its eyes are, for the line-of-sight check and the speech bubble
  eye(v) { return v.set(this.x, 1.55, this.z); }

  goTo(x, z, direct = true) {
    const a = nearestNode(this.x, this.z), b = nearestNode(x, z);
    this.path = bfs(a, b).map(n => ({ x: NAV.nodes[n][0], z: NAV.nodes[n][1] }));
    // if we're already past the first node, don't walk back to it
    while (this.path.length > 1) {
      const p0 = this.path[0], p1 = this.path[1];
      if (Math.hypot(this.x - p1.x, this.z - p1.z) < Math.hypot(p0.x - p1.x, p0.z - p1.z)) this.path.shift();
      else break;
    }
    if (direct) this.path.push({ x, z });
  }

  moveAlong(dt, speed) {
    this.moving = false;
    const p = this.path[0];
    if (!p) return true;
    const dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz);
    if (d < 0.18) { this.path.shift(); return this.path.length === 0; }
    const step = Math.min(d, speed * dt);
    this.x += (dx / d) * step;
    this.z += (dz / d) * step;
    this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-9 * dt));
    this.moving = true;
    this.walkSpeed = speed;
    return false;
  }

  faceToward(x, z, dt, rate = 6) {
    this.yaw = lerpAngle(this.yaw, Math.atan2(x - this.x, z - this.z), 1 - Math.exp(-rate * dt));
  }

  canSee(cat) {
    const dx = cat.x - this.x, dz = cat.z - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 9.5) return false;
    const dot = (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / (dist || 1);
    if (dist > 1.6 && dot < Math.cos(0.98)) return false;     // a cone of about 56 degrees each side
    this.eye(this._from);
    this._to.set(cat.x, cat.y + 0.1, cat.z);
    this._ray.reset();
    this.physics.raycastClosest(this._from, this._to, { collisionFilterMask: G.STATIC, skipBackfaces: true }, this._ray);
    return !this._ray.hasHit;                                 // furniture blocks the view
  }

  // The cat broke something somewhere: go and have a look
  hear(x, z) {
    if (['chase', 'catching', 'cooldown'].includes(this.state)) return;
    if (Math.hypot(x - this.x, z - this.z) > 14) return;
    this.state = 'investigate';
    this.goTo(x, z);
    this.say(pick(LINES.heard));
    this.heardEvent = true;
  }

  lure(cat) {
    if (['chase', 'catching', 'cooldown', 'lured', 'pet'].includes(this.state)) return false;
    if (Math.hypot(cat.x - this.x, cat.z - this.z) > 12) return false;
    this.state = 'lured';
    this.repath = 0;
    this.say(pick(LINES.lure));
    return true;
  }

  startChase(game) {
    this.state = 'chase';
    this.repath = 0;
    this.say(pick(LINES.suspicious));
    this.noticed = true;
  }

  pickDestination() {
    let d;
    do { d = pick(NAV.spots); } while (d === this.dest && NAV.spots.length > 1);
    this.dest = d;
    this.goTo(...NAV.nodes[d], false);
    this.state = 'patrol';
    if (Math.random() < 0.35) this.say(pick(LINES.idle), 3);
  }

  update(dt, game) {
    const cat = game.cat;
    this.noticed = false;
    this.catchCd = Math.max(0, this.catchCd - dt);
    if (this.speech && (this.speech.t -= dt) <= 0) this.speech = null;

    // ---- what the owner can see, and how suspicious that makes them ----
    const sees = (this.sees = this.canSee(cat));
    if (sees) { this.lastSeen.x = cat.x; this.lastSeen.z = cat.z; this.unseen = 0; } else this.unseen += dt;
    const busy = this.state === 'catching' || this.state === 'cooldown';
    if (!busy) {
      const guilt = game.guilt;
      let rate = -0.35;
      if (sees) {
        rate = guilt > 0.25 ? 0.5 + guilt * 1.1 : -0.4;
        if (cat.sitting && guilt < 0.6) rate -= 0.8;     // sitting still looks innocent
      }
      this.susp = clamp(this.susp + rate * dt, 0, 1);
      if (this.catchCd > 0) this.susp = Math.min(this.susp, 0.3);
      if (this.susp >= 0.35 && this.state !== 'chase' && this.catchCd <= 0) this.startChase(game);
      if (sees && guilt < 0.2 && cat.sitting && game.t - this.awwT > 9 && !['chase', 'pet'].includes(this.state)) {
        this.awwT = game.t;
        this.say(pick(LINES.aww));
        game.sound.chime(3);
        game.ownerShout('aww');
      }
    }

    // ---- behaviour ----
    this.moving = false;
    switch (this.state) {
      case 'idle':
        this.timer -= dt;
        this.yaw = lerpAngle(this.yaw, this.baseYaw + Math.sin(game.t * 1.3) * 0.9, 1 - Math.exp(-4 * dt));
        if (this.timer <= 0) this.pickDestination();
        break;

      case 'patrol':
        if (this.moveAlong(dt, 1.9)) {
          this.state = 'idle';
          this.timer = rand(2.2, 4);
          this.baseYaw = this.yaw;
        }
        break;

      case 'investigate':
        if (this.moveAlong(dt, 2.8)) {
          this.state = 'look';
          this.timer = 3;
          this.baseYaw = this.yaw;
          this.say(pick(LINES.look), 2.4);
        }
        break;

      case 'look':
        this.timer -= dt;
        this.yaw = lerpAngle(this.yaw, this.baseYaw + Math.sin(game.t * 2.2) * 1.4, 1 - Math.exp(-5 * dt));
        if (this.timer <= 0) this.pickDestination();
        break;

      case 'chase': {
        this.repath -= dt;
        if (this.repath <= 0) { this.repath = 0.4; sees ? this.goTo(cat.x, cat.z) : this.goTo(this.lastSeen.x, this.lastSeen.z); }
        this.moveAlong(dt, 3.7);
        const d = Math.hypot(cat.x - this.x, cat.z - this.z);
        if (sees && d < 1.5 && this.susp > 0.5 && this.catchCd <= 0) {
          this.state = 'catching';
          this.say(pick(LINES.caught), 3);
          game.onCaught();
          this.state = 'cooldown';
          this.timer = 3;
          this.catchCd = 6;
          this.susp = 0;
        } else if (this.unseen > 3) {
          this.state = 'investigate';
          this.goTo(this.lastSeen.x, this.lastSeen.z);
          this.say(pick(LINES.lost));
        }
        break;
      }

      case 'cooldown':
        this.timer -= dt;
        this.faceToward(cat.x, cat.z, dt);
        if (this.timer <= 0) { this.state = 'idle'; this.timer = 2; this.baseYaw = this.yaw; this.goTo(...NAV.nodes.door, false); this.pickDestination(); }
        break;

      case 'lured': {
        this.repath -= dt;
        if (this.repath <= 0) { this.repath = 0.5; this.goTo(cat.x, cat.z); }
        this.moveAlong(dt, 2.7);
        if (Math.hypot(cat.x - this.x, cat.z - this.z) < 1.9) {
          if (game.guilt > 0.45) this.susp = Math.max(this.susp, 0.8);
          else {
            this.state = 'pet';
            this.timer = 3.5;
            this.say(pick(LINES.pet), 3);
            game.sound.purr(3.4);
            game.purrCd = 3.6;           // so the sitting purr doesn't pile on top of this one
            game.ownerShout('pet');
          }
        }
        break;
      }

      case 'pet':
        this.timer -= dt;
        this.faceToward(cat.x, cat.z, dt);
        if (this.timer <= 0 || Math.hypot(cat.x - this.x, cat.z - this.z) > 3.4) {
          this.say(pick(LINES.petEnd), 2.4);
          this.state = 'idle';
          this.timer = 1.5;
          this.baseYaw = this.yaw;
        }
        break;
    }

    this.syncVisual(dt);
  }

  syncVisual(dt) {
    this.walkPhase += this.moving ? dt * (this.walkSpeed || 2) * 3.4 : 0;
    const s = this.moving ? Math.sin(this.walkPhase) : 0;
    this.legs[0].rotation.x = s * 0.6;
    this.legs[1].rotation.x = -s * 0.6;
    this.arms[0].rotation.x = -s * 0.5;
    this.arms[1].rotation.x = s * 0.3 - 0.25;           // the mug arm barely swings
    this.group.position.set(this.x, this.moving ? Math.abs(Math.sin(this.walkPhase)) * 0.025 : 0, this.z);
    this.group.rotation.y = this.yaw;
    const alert = this.state === 'chase' || this.state === 'cooldown';
    this.head.rotation.x = alert ? 0.12 : 0;
    this.eyes.forEach(e => e.scale.setScalar(alert ? 1.5 : 1));
  }
}
