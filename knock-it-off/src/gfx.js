import * as THREE from 'three';

// Small helpers for building low-poly models out of primitives.
// Materials are cached by colour and options, so hundreds of meshes share a few.
const cache = new Map();

export function M(color, o = {}) {
  const key = color + '|' + JSON.stringify(o);
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, flatShading: true, ...o });
    cache.set(key, m);
  }
  return m;
}

export function mk(geo, color, o) {
  const m = new THREE.Mesh(geo, M(color, o));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export const box = (w, h, d, color, o) => mk(new THREE.BoxGeometry(w, h, d), color, o);
export const cyl = (rt, rb, h, color, seg = 12, o) => mk(new THREE.CylinderGeometry(rt, rb, h, seg), color, o);
export const cone = (r, h, color, seg = 6, o) => mk(new THREE.ConeGeometry(r, h, seg), color, o);
export const sph = (r, color, o, ws = 14, hs = 10) => mk(new THREE.SphereGeometry(r, ws, hs), color, o);

export function at(obj, x, y, z) {
  obj.position.set(x, y, z);
  return obj;
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// Shortest-way angle blend, so turning never spins the long way round
export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
