import * as THREE from 'three';
import { ease } from './util.js';

// Shards, splashes, sparks and puddles. All the flying bits share one
// InstancedMesh, so hundreds of them cost a single draw call.
const MAX = 520;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true }),
      MAX,
    );
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < MAX; i++) this.mesh.setColorAt(i, white);
    scene.add(this.mesh);

    this.p = Array.from({ length: MAX }, () => ({
      life: 0, max: 1, vis: true, size: 0.05, grav: 14,
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(),
    }));
    this.next = 0;
    this.dummy = new THREE.Object3D();
    this.tmp = new THREE.Color();

    this.puddles = [];
    this.puddleN = 0;
    this.puddleGeo = new THREE.CircleGeometry(1, 20);
    this.puddleGeo.rotateX(-Math.PI / 2);
    this.puddleMats = new Map();
  }

  // A burst of little cubes: glass shards, splashes, soil, crumbs, sparks
  burst({ pos, colors, count = 14, speed = 3, size = 0.05, life = 1.6, up = 2.2, grav = 14 }) {
    for (let i = 0; i < count; i++) {
      const idx = this.next;
      this.next = (this.next + 1) % MAX;
      const p = this.p[idx];
      p.life = p.max = life * (0.6 + Math.random() * 0.8);
      p.size = size * (0.5 + Math.random());
      p.grav = grav;
      p.vis = true;
      p.pos.set(pos.x + (Math.random() - 0.5) * 0.12, pos.y + (Math.random() - 0.2) * 0.12, pos.z + (Math.random() - 0.5) * 0.12);
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.9);
      p.vel.set(Math.cos(a) * s, up * (0.4 + Math.random() * 0.9), Math.sin(a) * s);
      p.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      this.mesh.setColorAt(idx, this.tmp.set(colors[(Math.random() * colors.length) | 0]));
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  // A flat splat on the floor that grows outward
  puddle(x, z, color, radius = 0.35) {
    let mat = this.puddleMats.get(color);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color, roughness: 0.25, transparent: true, opacity: 0.85,
        polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false,
      });
      this.puddleMats.set(color, mat);
    }
    const m = new THREE.Mesh(this.puddleGeo, mat);
    m.position.set(x, 0.006 + (this.puddleN++ % 40) * 0.0003, z);
    m.rotation.y = Math.random() * 6;
    m.scale.set(0.01, 1, 0.01);
    m.receiveShadow = true;
    this.scene.add(m);
    this.puddles.push({ m, t: 0, r: radius * (0.8 + Math.random() * 0.5), sx: 0.8 + Math.random() * 0.5 });
    if (this.puddles.length > 30) this.scene.remove(this.puddles.shift().m);
  }

  clear() {
    for (const p of this.p) p.life = 0;
    for (const q of this.puddles) this.scene.remove(q.m);
    this.puddles = [];
  }

  update(dt) {
    let dirty = false;
    const d = this.dummy;
    for (let i = 0; i < MAX; i++) {
      const p = this.p[i];
      if (p.life <= 0) {
        if (p.vis) {
          d.position.set(0, -50, 0);
          d.scale.setScalar(0);
          d.updateMatrix();
          this.mesh.setMatrixAt(i, d.matrix);
          p.vis = false;
          dirty = true;
        }
        continue;
      }
      p.life -= dt;
      p.vel.y -= p.grav * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < p.size * 0.5) {
        p.pos.y = p.size * 0.5;
        p.vel.y *= -0.35;
        p.vel.x *= 0.72;
        p.vel.z *= 0.72;
        p.spin.multiplyScalar(0.7);
      }
      p.rot.x += p.spin.x * dt;
      p.rot.y += p.spin.y * dt;
      p.rot.z += p.spin.z * dt;
      d.position.copy(p.pos);
      d.rotation.copy(p.rot);
      d.scale.setScalar(p.size * Math.min(1, p.life * 3));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
      p.vis = true;
      dirty = true;
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;

    for (const q of this.puddles) {
      if (q.t >= 1) continue;
      q.t = Math.min(1, q.t + dt / 0.45);
      const s = q.r * ease(q.t);
      q.m.scale.set(s * q.sx, 1, s);
    }
  }
}
