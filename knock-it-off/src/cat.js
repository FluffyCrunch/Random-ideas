import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { G } from './constants.js';
import { box, sph, cone, cyl, at, clamp, lerp, lerpAngle } from './gfx.js';

const FUR = 0xe8913a, STRIPE = 0xc4631a, BELLY = 0xf8d9ae, PINK = 0xf4a6a0;
const SOFT = { flatShading: false };

export const CAT_RADIUS = 0.3;

export class Cat {
  constructor(scene, physics, catMat) {
    this.physics = physics;
    this.body = new CANNON.Body({
      mass: 4,
      material: catMat,
      collisionFilterGroup: G.CAT,
      collisionFilterMask: G.PROP | G.STATIC,
      fixedRotation: true,
      linearDamping: 0.02,
      allowSleep: false,       // a sleeping body ignores velocity changes, so the cat must never nap physically
    });
    this.body.addShape(new CANNON.Sphere(CAT_RADIUS));
    this.body.updateMassProperties();
    physics.addBody(this.body);

    this.group = new THREE.Group();
    scene.add(this.group);
    this.build();

    this.yaw = 0;
    this.walk = 0;
    this.sit = 0;
    this.sitting = false;
    this.swatT = 0;
    this.meowT = 0;
    this.grounded = false;
    this.wasGrounded = false;
    this.coyote = 0;
    this.jumps = 0;
    this.squash = 0;
    this.blink = 0;
    this.speed = 0;
    this.events = [];      // 'jump' | 'doubleJump' | 'land', collected for the game to react to
    this._ray = new CANNON.RaycastResult();
    this._to = new CANNON.Vec3();
  }

  get x() { return this.body.position.x; }
  get y() { return this.body.position.y; }
  get z() { return this.body.position.z; }

  build() {
    const rig = (this.rig = new THREE.Group());
    this.group.add(rig);

    const torso = at(sph(0.3, FUR, SOFT, 16, 12), 0, 0.36, 0);
    torso.scale.set(0.88, 0.74, 1.3);
    rig.add(torso);
    const bib = at(sph(0.2, BELLY, SOFT), 0, 0.3, 0.27);
    bib.scale.set(0.9, 0.85, 0.7);
    rig.add(bib);
    for (let i = 0; i < 3; i++) {
      const s = at(box(0.22 - i * 0.03, 0.02, 0.05, STRIPE), 0, 0.575 - i * 0.012, -0.12 + i * 0.14);
      rig.add(s);
    }

    const head = (this.head = new THREE.Group());
    head.position.set(0, 0.52, 0.4);
    rig.add(head);
    const skull = sph(0.2, FUR, SOFT, 16, 12);
    skull.scale.set(1.1, 0.95, 1);
    head.add(skull);
    const muzzle = at(sph(0.09, BELLY, SOFT), 0, -0.06, 0.16);
    muzzle.scale.set(1.1, 0.8, 1);
    head.add(muzzle);
    head.add(at(sph(0.028, 0xff8fa3, SOFT), 0, -0.01, 0.245));
    for (const s of [-1, 1]) {
      const ear = at(cone(0.085, 0.17, FUR, 4), s * 0.13, 0.2, -0.02);
      ear.rotation.z = -s * 0.3;
      head.add(ear);
      const inner = at(cone(0.05, 0.12, PINK, 4), s * 0.13, 0.19, 0.005);
      inner.rotation.z = -s * 0.3;
      head.add(inner);
      const eye = at(sph(0.05, 0x9be15d, SOFT, 10, 8), s * 0.09, 0.04, 0.165);
      head.add(eye);
      head.add(at(box(0.018, 0.06, 0.012, 0x111111), s * 0.09, 0.04, 0.212));
      for (let w = -1; w <= 1; w++) {
        const whisker = at(box(0.2, 0.004, 0.004, 0xffffff), s * 0.2, -0.04 + w * 0.025, 0.2);
        whisker.rotation.z = s * w * 0.12;
        head.add(whisker);
      }
    }
    for (let i = -1; i <= 1; i++) head.add(at(box(0.015, 0.06, 0.01, STRIPE), i * 0.04, 0.16, 0.14));
    this.mouth = at(sph(0.04, 0x5a1d24, SOFT, 8, 6), 0, -0.08, 0.2);
    this.mouth.scale.set(1, 0.001, 1);
    head.add(this.mouth);

    // four legs, each hinged at the hip so it can swing
    this.legs = {};
    for (const [name, x, z] of [['fl', -0.15, 0.3], ['fr', 0.15, 0.3], ['bl', -0.16, -0.3], ['br', 0.16, -0.3]]) {
      const hip = new THREE.Group();
      hip.position.set(x, 0.32, z);
      hip.add(at(cyl(0.055, 0.045, 0.3, FUR, 8, SOFT), 0, -0.15, 0));
      const paw = at(sph(0.06, BELLY, SOFT, 8, 6), 0, -0.3, 0.02);
      paw.scale.set(1, 0.7, 1.3);
      hip.add(paw);
      rig.add(hip);
      this.legs[name] = hip;
    }

    // tail: a chain of segments, each bending a little more than the last
    this.tail = [];
    let parent = rig;
    for (let i = 0; i < 7; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, i === 0 ? 0.4 : 0, i === 0 ? -0.38 : -0.1);
      seg.add(at(sph(0.058 - i * 0.003, i % 2 ? STRIPE : FUR, SOFT, 8, 6), 0, 0, 0));
      parent.add(seg);
      this.tail.push(seg);
      parent = seg;
    }
    // a little halo that appears when the cat is sitting innocently
    this.halo = at(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.016, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffe27a })), 0, 0.45, 0);
    this.halo.rotation.x = Math.PI / 2;
    this.head.add(this.halo);
    this.group.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    this.halo.castShadow = false;
  }

  teleport(x, y, z) {
    this.body.position.set(x, y, z);
    this.body.velocity.set(0, 0, 0);
    this.body.wakeUp();
  }

  swat() {
    if (this.swatT > 0) return false;
    this.swatT = 0.3;
    return true;
  }

  meow() { this.meowT = 0.55; }

  // Move relative to the camera, jump, sit and animate
  update(dt, input, camYaw, forceSit = false) {
    const b = this.body;
    this.events.length = 0;

    // ground check: a short ray straight down that ignores the cat's own body
    this._to.set(b.position.x, b.position.y - (CAT_RADIUS + 0.14), b.position.z);
    this._ray.reset();
    this.physics.raycastClosest(b.position, this._to, { collisionFilterMask: G.STATIC | G.PROP, skipBackfaces: true }, this._ray);
    this.wasGrounded = this.grounded;
    this.grounded = this._ray.hasHit && b.velocity.y < 1.5;
    if (this.grounded) { this.coyote = 0.1; this.jumps = 0; } else this.coyote = Math.max(0, this.coyote - dt);
    if (this.grounded && !this.wasGrounded) { this.squash = 1; this.events.push('land'); }

    this.sitting = (input.isDown('KeyC') || forceSit) && this.grounded;
    const fwd = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
    const side = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
    let mx = 0, mz = 0;
    if (fwd || side) {
      // camera-relative: forward is away from the camera, right is to its right
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      mx = fx * fwd + rx * side;
      mz = fz * fwd + rz * side;
      const l = Math.hypot(mx, mz);
      mx /= l; mz /= l;
    }

    const sprint = input.isDown('ShiftLeft', 'ShiftRight');
    const top = this.sitting ? 0 : sprint ? 8.2 : 5.2;
    const k = Math.min(1, (this.grounded ? 14 : 5) * dt);
    b.velocity.x += (mx * top - b.velocity.x) * k;
    b.velocity.z += (mz * top - b.velocity.z) * k;
    this.speed = Math.hypot(b.velocity.x, b.velocity.z);
    if (mx || mz) this.yaw = lerpAngle(this.yaw, Math.atan2(mx, mz), 1 - Math.exp(-14 * dt));

    if (input.take('Space') && !this.sitting) {
      if (this.coyote > 0) {
        b.velocity.y = 7.6;
        this.coyote = 0;
        this.jumps = 1;
        this.grounded = false;
        this.events.push('jump');
      } else if (this.jumps < 2) {
        b.velocity.y = 6.4;
        this.jumps = 2;
        this.events.push('doubleJump');
      }
    }
    if (b.position.y < -3) this.teleport(0, 1, 0);

    this.animate(dt);
  }

  animate(dt) {
    const t = performance.now() / 1000;
    this.swatT = Math.max(0, this.swatT - dt);
    this.meowT = Math.max(0, this.meowT - dt);
    this.squash = Math.max(0, this.squash - dt * 4);
    this.sit = lerp(this.sit, this.sitting ? 1 : 0, 1 - Math.exp(-9 * dt));

    this.group.position.set(this.x, this.y - CAT_RADIUS, this.z);
    this.group.rotation.y = this.yaw;

    const moving = this.grounded && this.speed > 0.6 && this.sit < 0.3;
    if (moving) this.walk += dt * (6 + this.speed * 1.9);
    const swing = moving ? Math.min(1, this.speed / 5) * 0.85 : 0;
    const s = Math.sin(this.walk) * swing;
    const air = this.grounded ? 0 : 1;
    const L = this.legs;
    const sit = this.sit;
    L.fl.rotation.x = lerp(s * (1 - air) - air * 0.9, 0.55, sit);
    L.fr.rotation.x = lerp(-s * (1 - air) - air * 0.9, 0.55, sit);
    L.bl.rotation.x = lerp(-s * (1 - air) + air * 0.9, -1.15, sit);
    L.br.rotation.x = lerp(s * (1 - air) + air * 0.9, -1.15, sit);
    if (this.swatT > 0) {
      const u = 1 - this.swatT / 0.3;
      L.fr.rotation.x = -2.1 * Math.sin(Math.PI * Math.min(1, u * 1.1));
    }

    const rig = this.rig;
    rig.rotation.x = -0.75 * sit - air * 0.12;
    rig.position.set(0, -0.06 * sit + (moving ? Math.abs(Math.sin(this.walk)) * 0.025 : 0), -0.14 * sit);
    const sq = Math.sin(this.squash * Math.PI) * 0.18;
    rig.scale.set(1 + sq, 1 - sq, 1 + sq);

    // head: bob while running, lift while meowing, blink now and then
    this.head.rotation.x = -this.meowT * 0.55 + (this.swatT > 0 ? 0.25 : 0) + sit * 0.35;
    this.head.position.y = 0.52 + (moving ? Math.sin(this.walk * 2) * 0.012 : 0);
    this.mouth.scale.y = this.meowT > 0 ? 0.4 + Math.abs(Math.sin(this.meowT * 24)) * 0.8 : 0.001;
    this.blink = (t % 4) < 0.12 ? 1 : 0;
    this.halo.visible = sit > 0.85;
    this.halo.position.y = 0.46 + Math.sin(t * 3) * 0.015;

    // tail: gentle wag, stiff and high while sprinting
    const wag = Math.sin(t * (sit > 0.5 ? 2.2 : 3.2)) * 0.22;
    const base = lerp(0.35 + (this.speed > 6.5 ? 0.35 : 0), 0.05, sit);
    this.tail.forEach((seg, i) => {
      seg.rotation.x = base * (i === 0 ? 1.2 : 0.55) + Math.sin(t * 3 - i * 0.7) * 0.07;
      seg.rotation.y = wag * (i === 0 ? 0.4 : 0.6) + sit * 0.22;
    });
  }
}
