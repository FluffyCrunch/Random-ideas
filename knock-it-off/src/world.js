import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { G, ROOM, MATS } from './constants.js';
import { M, box, cyl, sph, at } from './gfx.js';

// The cat's bed: where each round begins, and where the owner puts you back when you're caught.
// There's open floor behind it, so the camera can start low and right behind the cat.
export const CAT_SPAWN = { x: -1.8, y: 0.4, z: 1.4 };
export const CAT_FACING = Math.PI / 2;     // facing east, toward the kitchen and dining table

// A small walkway graph for the owner, drawn so every straight line between
// two connected points clears the furniture
export const NAV = {
  nodes: {
    door: [0.2, 4.3], mid: [0.2, 2.8], center: [0.2, 0.4], tvLane: [-2.5, 0],
    sofaLane: [-2.3, -2.7], sofaFront: [-4.5, -2.7], tvSpot: [-5.0, 0.3],
    deskSpot: [-0.8, -3.6], deskLane: [1.8, -1.5], kitchen: [3.5, -1.6],
    counter: [5.3, -1.0], eastMid: [5.3, 1.0], diningE: [5.0, 2.5],
    seA: [5.0, 4.2], dining: [2.5, 4.2],
  },
  edges: [
    ['door', 'mid'], ['mid', 'center'], ['center', 'tvLane'], ['tvLane', 'sofaLane'], ['sofaLane', 'sofaFront'],
    ['tvLane', 'tvSpot'], ['center', 'deskLane'], ['deskLane', 'kitchen'], ['kitchen', 'counter'],
    ['counter', 'eastMid'], ['eastMid', 'diningE'], ['diningE', 'seA'], ['seA', 'dining'], ['dining', 'door'],
    ['mid', 'dining'], ['deskSpot', 'sofaLane'], ['deskSpot', 'deskLane'],
  ],
  // Places the owner likes to stand and stare at
  spots: ['kitchen', 'tvSpot', 'deskSpot', 'dining', 'sofaFront', 'counter', 'center'],
};

// What sits where: [type, x, surface height, z, rotation]
export const PLACEMENTS = [
  // coffee table
  ['mug', -3.95, 0.45, -1.8, 0.4], ['books', -5.05, 0.45, -1.45, 0.2], ['cake', -4.55, 0.45, -1.65, 0],
  // TV stand
  ['trophy', -6.75, 0.55, -0.72, 0], ['vase', -6.75, 0.55, 0.72, 0],
  // bookshelf
  ['books', -6.75, 0.525, 1.95, 0.1], ['plant', -6.75, 0.525, 3.0, 0],
  ['trophy', -6.75, 1.075, 2.0, 0], ['vase', -6.75, 1.075, 2.7, 0],
  ['mug', -6.75, 1.625, 2.3, 0.5], ['books', -6.75, 1.625, 3.0, -0.2],
  ['plant', -6.75, 2.175, 2.5, 0],
  // desk
  ['laptop', 0.4, 0.75, -4.55, 0], ['mug', 1.1, 0.75, -4.35, 0.8], ['trophy', -0.1, 0.75, -4.5, 0],
  // kitchen island
  ['milk', 3.0, 0.96, -3.0, 0], ['mug', 3.8, 0.96, -3.2, 0.3], ['cake', 4.2, 0.96, -2.8, 0],
  // kitchen counter
  ['mug', 6.6, 0.96, -4.0, 0.2], ['milk', 6.6, 0.96, -3.0, 0], ['plant', 6.6, 0.96, -1.6, 0], ['vase', 6.6, 0.96, -0.6, 0],
  // dining table
  ['vase', 2.5, 0.78, 2.5, 0], ['cake', 3.0, 0.78, 2.15, 0], ['mug', 1.9, 0.78, 2.85, 0.6], ['milk', 3.1, 0.78, 2.9, 0],
  // side table and plant stand
  ['fishbowl', -1.0, 0.75, 3.8, 0], ['plant', 6.4, 0.7, 4.4, 0],
];

function plankTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const cols = ['#b9824f', '#c28c58', '#ad774a', '#bf8854', '#b27c4b'];
  const rows = 8, h = 512 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -((r * 173) % 256);
    while (x < 512) {
      const w = 220 + ((r * 97 + x * 13) % 120);
      g.fillStyle = cols[(r * 3 + Math.floor((x + 512) / 100)) % cols.length];
      g.fillRect(x, r * h, w, h);
      g.strokeStyle = 'rgba(70,40,20,0.28)';
      g.lineWidth = 3;
      g.strokeRect(x, r * h, w, h);
      g.strokeStyle = 'rgba(70,40,20,0.12)';
      g.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = r * h + 6 + ((i * 11 + x) % (h - 12));
        g.beginPath(); g.moveTo(x + 6, y); g.lineTo(x + w - 6, y + ((i % 2) * 2 - 1) * 2); g.stroke();
      }
      x += w;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7, 5);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function rugTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 340;
  const g = c.getContext('2d');
  g.fillStyle = '#9c3d4a'; g.fillRect(0, 0, 512, 340);
  g.fillStyle = '#f2d9a8'; g.fillRect(20, 20, 472, 300);
  g.fillStyle = '#9c3d4a'; g.fillRect(34, 34, 444, 272);
  g.fillStyle = '#2f5d6b';
  for (let i = 0; i < 6; i++) {
    const x = 80 + i * 70;
    g.beginPath(); g.moveTo(x, 170); g.lineTo(x + 35, 110); g.lineTo(x + 70, 170); g.lineTo(x + 35, 230); g.closePath(); g.fill();
  }
  g.fillStyle = '#f2d9a8';
  for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(115 + i * 70, 170, 9, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildWorld(scene, physics) {
  // ---- helpers: a solid piece has a mesh and a physics body, a deco piece only a mesh ----
  function solid(cx, cy, cz, w, h, d, color, o = {}) {
    const m = at(box(w, h, d, color, o.mat), cx, cy, cz);
    m.castShadow = o.cast !== false;
    scene.add(m);
    const b = new CANNON.Body({ mass: 0, material: MATS.world, collisionFilterGroup: G.STATIC, collisionFilterMask: -1 });
    b.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
    b.position.set(cx, cy, cz);
    physics.addBody(b);
    return m;
  }
  function deco(cx, cy, cz, w, h, d, color, o = {}) {
    const m = at(box(w, h, d, color, o.mat), cx, cy, cz);
    m.castShadow = o.cast !== false;
    if (o.rz) m.rotation.z = o.rz;
    if (o.ry) m.rotation.y = o.ry;
    scene.add(m);
    return m;
  }
  const legs = (cx, cz, w, d, h, color, t = 0.06) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) solid(cx + sx * (w / 2 - t), h / 2, cz + sz * (d / 2 - t), t, h, t, color, { cast: true });
  };

  // ---- floor, walls, ceiling ----
  const floor = new CANNON.Body({ mass: 0, material: MATS.world, shape: new CANNON.Plane(), collisionFilterGroup: G.STATIC });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  // the plane's bounding box was worked out before it was rotated flat, which made
  // raycasts think the floor only exists where z < 0
  floor.aabbNeedsUpdate = true;
  floor.updateAABB();
  floor.tag = 'floor';
  physics.addBody(floor);

  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.65 }));
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  const wallColor = 0xf0e1cc, accent = 0xd9a38a;
  const wall = (cx, cy, cz, w, h, d, color) => solid(cx, cy, cz, w, h, d, color, { cast: false });
  wall(0, ROOM.h / 2, -5.15, 14.6, ROOM.h, 0.3, accent);   // north
  wall(0, ROOM.h / 2, 5.15, 14.6, ROOM.h, 0.3, wallColor);  // south
  wall(-7.15, ROOM.h / 2, 0, 0.3, ROOM.h, 10, wallColor);   // west
  wall(7.15, ROOM.h / 2, 0, 0.3, ROOM.h, 10, wallColor);    // east
  const ceiling = new CANNON.Body({ mass: 0, material: MATS.world, collisionFilterGroup: G.STATIC });
  ceiling.addShape(new CANNON.Box(new CANNON.Vec3(8, 0.5, 6)));
  ceiling.position.set(0, ROOM.h + 0.5, 0);
  physics.addBody(ceiling);

  // a ceiling you only see when the camera tilts up (it casts no shadow, so the sun still comes in)
  const ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(14.6, 10.3), new THREE.MeshStandardMaterial({ color: 0xf6ecdc, roughness: 1 }));
  ceilMesh.rotation.x = Math.PI / 2;
  ceilMesh.position.y = ROOM.h;
  scene.add(ceilMesh);

  // baseboards
  const bb = 0x8a6a4e;
  deco(0, 0.06, -4.97, 14, 0.12, 0.06, bb, { cast: false });
  deco(0, 0.06, 4.97, 14, 0.12, 0.06, bb, { cast: false });
  deco(-6.97, 0.06, 0, 0.06, 0.12, 10, bb, { cast: false });
  deco(6.97, 0.06, 0, 0.06, 0.12, 10, bb, { cast: false });

  // the cat's bed
  const bed = at(cyl(0.52, 0.52, 0.12, 0xe08aa6, 18), CAT_SPAWN.x, 0.06, CAT_SPAWN.z);
  bed.castShadow = false;
  scene.add(bed);
  const bedIn = at(cyl(0.38, 0.38, 0.13, 0xf6d3dc, 18), CAT_SPAWN.x, 0.07, CAT_SPAWN.z);
  bedIn.castShadow = false;
  scene.add(bedIn);

  // rug
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.5), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.95 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-4.5, 0.012, -1.6);
  rug.receiveShadow = true;
  scene.add(rug);

  // ---- living room ----
  // sofa
  solid(-4.5, 0.2, -4.15, 3.0, 0.4, 0.95, 0x6d8aa0);
  solid(-4.5, 0.46, -4.0, 2.6, 0.12, 0.7, 0x86a7be);
  solid(-4.5, 0.8, -4.7, 3.0, 0.7, 0.3, 0x6d8aa0);
  solid(-5.85, 0.5, -4.15, 0.25, 0.55, 0.95, 0x5f7d93);
  solid(-3.15, 0.5, -4.15, 0.25, 0.55, 0.95, 0x5f7d93);
  deco(-5.3, 0.74, -4.4, 0.45, 0.45, 0.14, 0xe9b44c, { rz: 0.3 });
  deco(-3.7, 0.72, -4.45, 0.4, 0.4, 0.14, 0xe9695c, { rz: -0.25 });
  // coffee table
  solid(-4.5, 0.42, -1.6, 1.6, 0.06, 0.8, 0x8a5a3c);
  legs(-4.5, -1.6, 1.6, 0.8, 0.39, 0x6e4529);
  // TV on its stand
  solid(-6.75, 0.275, 0, 0.5, 0.55, 2.0, 0x4a3a30);
  solid(-6.85, 0.95, 0, 0.08, 0.66, 1.2, 0x15151b);
  const tv = deco(-6.8, 0.95, 0, 0.01, 0.56, 1.1, 0x1c2a3a, { mat: { emissive: 0x2a5d9a, emissiveIntensity: 0.55 }, cast: false });
  // bookshelf
  solid(-6.95, 1.1, 2.5, 0.05, 2.2, 2.0, 0x6e4529);
  solid(-6.75, 1.1, 1.525, 0.45, 2.2, 0.05, 0x6e4529);
  solid(-6.75, 1.1, 3.475, 0.45, 2.2, 0.05, 0x6e4529);
  for (const y of [0.5, 1.05, 1.6, 2.15]) solid(-6.75, y, 2.5, 0.45, 0.05, 2.0, 0x8a5a3c);
  // floor lamp
  deco(-2.7, 0.75, -4.4, 0.05, 1.5, 0.05, 0x2a2a2a);
  deco(-2.7, 0.03, -4.4, 0.4, 0.06, 0.4, 0x2a2a2a);
  const shade = at(cyl(0.2, 0.28, 0.32, 0xffe2a8, 14, { emissive: 0xffc46b, emissiveIntensity: 0.9 }), -2.7, 1.55, -4.4);
  shade.castShadow = false;
  scene.add(shade);

  // ---- desk corner ----
  solid(0.5, 0.72, -4.5, 1.6, 0.06, 0.7, 0x7a5a42);
  legs(0.5, -4.5, 1.6, 0.7, 0.69, 0x5c4331);
  solid(0.5, 0.42, -3.6, 0.5, 0.06, 0.5, 0xc4623a);
  solid(0.5, 0.72, -3.35, 0.5, 0.5, 0.06, 0xc4623a);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) deco(0.5 + sx * 0.2, 0.2, -3.6 + sz * 0.2, 0.04, 0.4, 0.04, 0x4a3a30);

  // ---- kitchen ----
  solid(3.5, 0.45, -3.0, 2.4, 0.9, 1.0, 0xd9cbb5);
  solid(3.5, 0.93, -3.0, 2.5, 0.06, 1.1, 0x6b6b70);
  solid(6.65, 0.45, -2.4, 0.7, 0.9, 4.8, 0xd9cbb5);
  solid(6.65, 0.93, -2.4, 0.75, 0.06, 4.85, 0x6b6b70);
  deco(6.8, 2.1, -2.4, 0.4, 0.8, 4.8, 0xcdbfa8);
  solid(5.5, 0.95, -4.5, 0.9, 1.9, 0.8, 0xe8edf0);   // fridge
  deco(5.05, 1.2, -4.08, 0.04, 0.5, 0.04, 0x999999);

  // ---- dining area ----
  solid(2.5, 0.75, 2.5, 2.0, 0.06, 1.1, 0x9a6a45);
  legs(2.5, 2.5, 2.0, 1.1, 0.72, 0x7a5233, 0.08);
  for (const [cx, bx] of [[0.95, 0.72], [4.05, 4.28]]) {
    solid(cx, 0.42, 2.5, 0.5, 0.06, 0.5, 0xd7b46a);
    solid(bx, 0.7, 2.5, 0.06, 0.5, 0.5, 0xd7b46a);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) deco(cx + sx * 0.2, 0.2, 2.5 + sz * 0.2, 0.04, 0.4, 0.04, 0x8a6a3a);
  }
  // side table and plant stand
  solid(-1.0, 0.72, 3.8, 0.6, 0.06, 0.6, 0x8a5a3c);
  legs(-1.0, 3.8, 0.6, 0.6, 0.69, 0x6e4529, 0.05);
  solid(6.4, 0.67, 4.4, 0.5, 0.06, 0.5, 0x8a5a3c);
  legs(6.4, 4.4, 0.5, 0.5, 0.64, 0x6e4529, 0.05);

  // ---- walls: window, door, pictures ----
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshBasicMaterial({ color: 0xd8ecff }));
  glass.position.set(3.0, 1.9, -4.985);
  scene.add(glass);
  deco(3.0, 2.62, -4.97, 2.4, 0.1, 0.08, 0xf4f0e8, { cast: false });
  deco(3.0, 1.18, -4.97, 2.4, 0.1, 0.1, 0xf4f0e8, { cast: false });
  deco(1.85, 1.9, -4.97, 0.1, 1.5, 0.08, 0xf4f0e8, { cast: false });
  deco(4.15, 1.9, -4.97, 0.1, 1.5, 0.08, 0xf4f0e8, { cast: false });
  deco(3.0, 1.9, -4.97, 0.05, 1.4, 0.06, 0xf4f0e8, { cast: false });
  deco(1.55, 1.9, -4.93, 0.3, 1.8, 0.1, 0xc9626a, { cast: false });
  deco(4.45, 1.9, -4.93, 0.3, 1.8, 0.1, 0xc9626a, { cast: false });
  deco(0.2, 1.05, 4.97, 1.1, 2.1, 0.06, 0x7a5233, { cast: false });
  deco(0.2, 1.05, 4.94, 0.95, 1.95, 0.06, 0xa87a50, { cast: false });
  deco(0.55, 1.0, 4.9, 0.06, 0.06, 0.06, 0xf2c230, { cast: false });
  [[-5.4, 0xe9b44c, 0.7, 0.5], [-4.4, 0x6fa8a0, 0.5, 0.65], [-3.5, 0xd9695c, 0.6, 0.45]].forEach(([x, c, w, h]) => {
    deco(x, 2.0, -4.97, w + 0.1, h + 0.1, 0.04, 0x4a3a30, { cast: false });
    deco(x, 2.0, -4.95, w, h, 0.03, c, { cast: false });
  });
  // a cat tree you can climb
  solid(-2.0, 0.55, 4.2, 0.12, 1.1, 0.12, 0xb59a74);
  solid(-2.0, 0.08, 4.2, 0.7, 0.16, 0.7, 0x8f7a58);
  solid(-2.0, 1.1, 4.2, 0.65, 0.1, 0.65, 0xa9855f);
  solid(-2.0, 0.6, 4.2, 0.5, 0.08, 0.5, 0xa9855f);

  // ---- lights ----
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x6b5846, 1.0));
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
  sun.position.set(6, 9, -7);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -11; sc.right = 11; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 32;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const lamp = new THREE.PointLight(0xffd29a, 14, 10, 2);
  lamp.position.set(-2.7, 1.5, -4.2);
  scene.add(lamp);
  const ceil = new THREE.PointLight(0xfff2dd, 20, 16, 2);
  ceil.position.set(0, 3.2, 0.5);
  scene.add(ceil);

  return { tv };
}
