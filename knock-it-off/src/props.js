import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { G, MATS } from './constants.js';
import { box, cyl, cone, sph, mk, at, pick } from './gfx.js';

// Everything you can knock off a shelf. Each type has a model, a physics shape,
// how much damage it's worth, and how hard it has to land before it breaks.
const MUG_COLORS = [0xe94f4f, 0x4f8fe9, 0xf2c230, 0x5bbf7a, 0xf4f0e8];

function wrap(build, offsetY) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.y = -offsetY;      // models are built with their base at y = 0
  build(inner);
  g.add(inner);
  return g;
}

export const TYPES = {
  mug: {
    name: 'Mug', value: 50, mass: 0.3, half: [0.065, 0.055, 0.065],
    breakable: true, breakSpeed: 2.2, sound: 'ceramic',
    debris: [0xf4f0e8, 0xe94f4f, 0x4f8fe9], puddle: 0x4a2c17,
    build(g) {
      const c = pick(MUG_COLORS);
      g.add(at(cyl(0.052, 0.05, 0.11, c, 14), 0, 0.055, 0));
      const coffee = at(cyl(0.043, 0.043, 0.004, 0x4a2c17, 14), 0, 0.1, 0);
      coffee.castShadow = false;
      g.add(coffee);
      const h = mk(new THREE.TorusGeometry(0.03, 0.011, 6, 12, Math.PI), c);
      h.rotation.z = -Math.PI / 2;
      h.position.set(0.06, 0.057, 0);
      g.add(h);
    },
  },
  vase: {
    name: 'Vase', value: 150, mass: 0.6, half: [0.11, 0.2, 0.11],
    breakable: true, breakSpeed: 2.6, sound: 'ceramic',
    debris: [0x2fb5a3, 0x26998a, 0xffffff, 0xff7aa8],
    build(g) {
      const c = 0x2fb5a3;
      g.add(at(cyl(0.08, 0.1, 0.08, c, 12), 0, 0.04, 0));
      const belly = at(sph(0.125, c), 0, 0.2, 0);
      belly.scale.set(1, 1.1, 1);
      g.add(belly);
      g.add(at(cyl(0.05, 0.07, 0.14, c, 12), 0, 0.36, 0));
      g.add(at(cyl(0.07, 0.05, 0.03, c, 12), 0, 0.44, 0));
      [[-0.04, 0xff7aa8], [0.03, 0xffd94d], [0, 0xffffff]].forEach(([x, col], i) => {
        const stem = at(cyl(0.006, 0.006, 0.22, 0x3a9d4a, 5), x, 0.55, (i - 1) * 0.03);
        stem.rotation.z = x * 3;
        g.add(stem);
        g.add(at(sph(0.04, col), x * 2.2, 0.67 + i * 0.02, (i - 1) * 0.04));
      });
    },
  },
  plant: {
    name: 'Plant', value: 100, mass: 0.9, half: [0.14, 0.23, 0.14],
    breakable: true, breakSpeed: 3.0, sound: 'ceramic',
    debris: [0xc4622d, 0x3d2b1f, 0x4caf50], puddle: 0x3d2b1f,
    build(g) {
      g.add(at(cyl(0.15, 0.11, 0.2, 0xc4622d, 10), 0, 0.1, 0));
      g.add(at(cyl(0.14, 0.14, 0.02, 0x3d2b1f, 10), 0, 0.2, 0));
      for (let i = 0; i < 7; i++) {
        const pivot = new THREE.Group();
        pivot.position.set(0, 0.2, 0);
        pivot.rotation.y = (i / 7) * Math.PI * 2;
        const leaf = at(cone(0.06, 0.36, 0x3f9d4f, 5), 0.05, 0.18, 0);
        leaf.rotation.z = -0.4 - (i % 2) * 0.25;
        pivot.add(leaf);
        g.add(pivot);
      }
    },
  },
  books: {
    name: 'Books', value: 30, mass: 0.8, half: [0.19, 0.075, 0.14],
    breakable: false, sound: 'thud',
    build(g) {
      [[0xb83b3b, 0.36, 0.05, 0.26, 0.04], [0x3b6bb8, 0.32, 0.045, 0.24, -0.08], [0xd9a935, 0.3, 0.05, 0.22, 0.1]].forEach(([c, w, h, d, r], i) => {
        const b = at(box(w, h, d, c), 0, 0.025 + i * 0.05, 0);
        b.rotation.y = r;
        g.add(b);
      });
    },
  },
  trophy: {
    name: 'Trophy', value: 200, mass: 0.5, half: [0.07, 0.13, 0.07],
    breakable: true, breakSpeed: 2.8, sound: 'metal',
    debris: [0xf2c230, 0xffe58a],
    build(g) {
      const gold = { metalness: 0.7, roughness: 0.3 };
      g.add(at(box(0.12, 0.04, 0.12, 0x4a2f1e), 0, 0.02, 0));
      g.add(at(cyl(0.015, 0.025, 0.1, 0xf2c230, 8, gold), 0, 0.09, 0));
      g.add(at(cyl(0.07, 0.035, 0.1, 0xf2c230, 12, gold), 0, 0.19, 0));
      for (const s of [-1, 1]) {
        const h = mk(new THREE.TorusGeometry(0.035, 0.008, 6, 10, Math.PI), 0xf2c230, gold);
        h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
        h.position.set(s * 0.075, 0.19, 0);
        g.add(h);
      }
    },
  },
  laptop: {
    name: 'Laptop', value: 300, mass: 1.0, half: [0.21, 0.09, 0.15],
    breakable: true, breakSpeed: 3.2, sound: 'tech',
    debris: [0xc9ced4, 0x2a2a2a, 0x6fb8ff],
    build(g) {
      g.add(at(box(0.42, 0.02, 0.3, 0xc9ced4, { metalness: 0.4, roughness: 0.4 }), 0, 0.01, 0));
      const lid = new THREE.Group();
      lid.position.set(0, 0.02, -0.14);
      lid.rotation.x = -0.35;
      lid.add(at(box(0.42, 0.28, 0.012, 0xc9ced4, { metalness: 0.4, roughness: 0.4 }), 0, 0.14, 0));
      lid.add(at(box(0.38, 0.24, 0.004, 0x6fb8ff, { emissive: 0x3a7fd0, emissiveIntensity: 0.7 }), 0, 0.14, 0.008));
      g.add(lid);
    },
  },
  fishbowl: {
    name: 'Fishbowl', value: 400, mass: 0.9, sphere: true, r: 0.17,
    breakable: true, breakSpeed: 2.4, sound: 'glass', fish: true,
    debris: [0xbfe9ff, 0xe8f7ff, 0x4fc3f7], puddle: 0x4fc3f7,
    build(g) {
      const glass = { transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.1, flatShading: false, depthWrite: false };
      const water = { transparent: true, opacity: 0.55, roughness: 0.2, flatShading: false, depthWrite: false };
      g.add(at(sph(0.17, 0xbfe9ff, glass, 18, 12), 0, 0, 0));
      const w = at(sph(0.15, 0x4fc3f7, water, 16, 10), 0, -0.02, 0);
      w.scale.y = 0.85;
      g.add(w);
      g.add(at(cyl(0.1, 0.1, 0.02, 0xe3c58f, 12), 0, -0.13, 0));
      const fish = new THREE.Group();
      const body = sph(0.035, 0xff7a1a, { flatShading: false });
      body.scale.set(1.6, 1, 0.8);
      fish.add(body);
      const tail = cone(0.03, 0.05, 0xff7a1a, 4);
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -0.07;
      fish.add(tail);
      fish.position.set(0.02, 0, 0);
      g.add(fish);
      g.userData.fish = fish;
    },
  },
  cake: {
    name: 'Cake', value: 250, mass: 0.7, half: [0.16, 0.08, 0.16],
    breakable: true, breakSpeed: 2.0, sound: 'splat',
    debris: [0xe9c28a, 0xff8fb1, 0xfff3e0], puddle: 0xff8fb1,
    build(g) {
      g.add(at(cyl(0.18, 0.18, 0.015, 0xf4f0e8, 16), 0, 0.008, 0));
      g.add(at(cyl(0.14, 0.14, 0.1, 0xe9c28a, 14), 0, 0.065, 0));
      g.add(at(cyl(0.145, 0.145, 0.03, 0xff8fb1, 14), 0, 0.13, 0));
      g.add(at(sph(0.025, 0xd62839), 0, 0.16, 0));
    },
  },
  milk: {
    name: 'Milk', value: 75, mass: 0.5, half: [0.045, 0.1, 0.045],
    breakable: true, breakSpeed: 2.2, sound: 'splash',
    debris: [0xffffff, 0x4aa3ff], puddle: 0xffffff,
    build(g) {
      g.add(at(box(0.09, 0.17, 0.09, 0xffffff), 0, 0.085, 0));
      const roof = at(box(0.09, 0.05, 0.045, 0x4aa3ff), 0, 0.195, 0);
      roof.rotation.z = 0.0;
      g.add(roof);
      g.add(at(box(0.092, 0.07, 0.092, 0x4aa3ff), 0, 0.09, 0));
    },
  },
};

export class Prop {
  constructor(type, x, y, z, rotY = 0) {
    this.type = type;
    const d = (this.def = TYPES[type]);
    const hy = d.sphere ? d.r : d.half[1];
    this.mesh = wrap(d.build, d.sphere ? 0 : d.half[1]);
    this.body = new CANNON.Body({
      mass: d.mass,
      material: MATS.world,
      collisionFilterGroup: G.PROP,
      linearDamping: 0.06,
      angularDamping: 0.12,
      allowSleep: true,
      sleepSpeedLimit: 0.25,
      sleepTimeLimit: 0.4,
    });
    this.body.addShape(d.sphere ? new CANNON.Sphere(d.r) : new CANNON.Box(new CANNON.Vec3(...d.half)));
    this.body.position.set(x, y + hy + 0.003, z);
    this.body.quaternion.setFromEuler(0, rotY, 0);
    this.body.prop = this;
    this.broken = false;
    this.scored = false;
    this.armedAt = 0;
    this.moved = false;
    this.sync();
  }

  sync() {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
  }

  // Has this prop been pushed away from where it started?
  displaced() {
    const p = this.body.position;
    return Math.hypot(p.x - this.start.x, p.z - this.start.z) > 0.35 || p.y < this.start.y - 0.3;
  }
}
