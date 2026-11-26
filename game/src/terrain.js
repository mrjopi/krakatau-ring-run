// Krakatau island: one volcano cone rising out of the sea, ringed by beach,
// jungle lowlands, a fishing village, a lighthouse and a runway shelf on the
// south-east beach. terrainHeight(x, z) is the single source of truth for
// both the mesh and the flight model's ground collisions.
import * as THREE from 'three';
import { ISLAND_RADIUS, RUNWAY, SEA_LEVEL, VOLCANO_HEIGHT, WORLD_SIZE, PALETTE } from './config.js';
import { mulberry32, ridgeNoise, valueNoise } from './random.js';

const SEED = 20261126;

/** Ground height in metres at (x, z). Sea floor is below zero. */
export function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  if (r >= ISLAND_RADIUS) return -14;
  const t = r / ISLAND_RADIUS;
  // Volcano cone: steep near the crater, flattening toward the beach.
  const cone = Math.pow(1 - t, 1.6) * VOLCANO_HEIGHT;
  // Crater bowl at the very top.
  const crater = -46 * Math.exp(-((r * r) / (2 * 70 * 70)));
  // Ridges and valleys, strongest mid-slope.
  const ridges = ridgeNoise(x, z, 210, SEED) * 34 * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5);
  const bumps = (valueNoise(x, z, 90, SEED + 7) - 0.5) * 16 * (1 - t);
  // Flatten the runway shelf so the strip sits on level ground.
  const shelf = runwayFlatten(x, z);
  let h = cone + crater + ridges + bumps;
  h = h * (1 - shelf) + 6 * shelf;
  // Beach: ease down to the waterline at the island's edge.
  const beach = Math.max(0, 1 - (r - ISLAND_RADIUS * 0.86) / (ISLAND_RADIUS * 0.14));
  if (t > 0.86) h = Math.min(h, 2.5 * beach + 0.4);
  return h;
}

/** 1 on the runway shelf, 0 away from it, smooth in between. */
function runwayFlatten(x, z) {
  const dx = x - RUNWAY.x;
  const dz = z - RUNWAY.z;
  const along = dx * Math.cos(RUNWAY.heading) + dz * Math.sin(RUNWAY.heading);
  const across = -dx * Math.sin(RUNWAY.heading) + dz * Math.cos(RUNWAY.heading);
  const a = Math.max(0, 1 - Math.abs(along) / (RUNWAY.length * 0.85));
  const b = Math.max(0, 1 - Math.abs(across) / 60);
  return Math.min(1, a * b * 2.0);
}

/** Is (x, z) on the runway strip (for landing checks)? */
export function onRunway(x, z) {
  const dx = x - RUNWAY.x;
  const dz = z - RUNWAY.z;
  const along = dx * Math.cos(RUNWAY.heading) + dz * Math.sin(RUNWAY.heading);
  const across = -dx * Math.sin(RUNWAY.heading) + dz * Math.cos(RUNWAY.heading);
  return Math.abs(along) < RUNWAY.length / 2 && Math.abs(across) < RUNWAY.width / 2;
}

function colourForHeight(h, x, z) {
  const c = new THREE.Color();
  if (h < 1.5) c.set(PALETTE.sand);
  else if (h < 42) c.set(PALETTE.grass);
  else if (h < 130) c.set(PALETTE.jungle);
  else if (h < 225) c.set(PALETTE.rock);
  else c.set(PALETTE.crater);
  // Jungle patches and rock streaks break up the bands.
  const patch = valueNoise(x, z, 60, SEED + 21);
  if (h >= 8 && h < 130 && patch > 0.62) c.lerp(new THREE.Color(PALETTE.jungle), 0.7);
  if (h >= 130 && patch < 0.3) c.lerp(new THREE.Color(PALETTE.rock), 0.5);
  // Slight per-vertex variation so the slopes read as terrain, not plastic.
  const v = (valueNoise(x, z, 24, SEED + 33) - 0.5) * 0.12;
  c.offsetHSL(0, 0, v);
  return c;
}

function buildIsland() {
  const segments = 180;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const c = colourForHeight(h, x, z);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  return new THREE.Mesh(geo, mat);
}

function buildSea() {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(WORLD_SIZE * 2.4, WORLD_SIZE * 2.4, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({
    color: 0x16607f, shininess: 110, specular: 0xaadddd, transparent: true, opacity: 0.96,
  });
  const sea = new THREE.Mesh(geo, mat);
  sea.position.y = SEA_LEVEL;
  group.add(sea);
  // Foam ring where the surf meets the beach.
  const foam = new THREE.Mesh(
    new THREE.RingGeometry(ISLAND_RADIUS - 14, ISLAND_RADIUS + 8, 72),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = 0.4;
  group.add(foam);
  return group;
}

function buildLava() {
  const geo = new THREE.CircleGeometry(34, 24);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: PALETTE.lava });
  const lava = new THREE.Mesh(geo, mat);
  lava.position.set(0, VOLCANO_HEIGHT - 40, 0);
  return lava;
}

function buildRunway() {
  const group = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.length, RUNWAY.width),
    new THREE.MeshStandardMaterial({ color: PALETTE.runway, roughness: 0.9 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.rotation.z = -RUNWAY.heading;
  strip.position.set(RUNWAY.x, 7.0, RUNWAY.z);
  group.add(strip);
  // Centre dashes.
  const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.runwayMark });
  for (let d = -RUNWAY.length / 2 + 18; d < RUNWAY.length / 2 - 10; d += 26) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.6), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.rotation.z = -RUNWAY.heading;
    dash.position.set(
      RUNWAY.x + Math.cos(RUNWAY.heading) * d,
      7.1,
      RUNWAY.z + Math.sin(RUNWAY.heading) * d,
    );
    group.add(dash);
  }
  // Windsock at the strip's near end.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.35, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xdddddd }),
  );
  pole.position.set(RUNWAY.x - Math.cos(RUNWAY.heading) * (RUNWAY.length / 2 + 14), 12, RUNWAY.z - Math.sin(RUNWAY.heading) * (RUNWAY.length / 2 + 14));
  group.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 5, 10),
    new THREE.MeshStandardMaterial({ color: PALETTE.planeBody, emissive: 0x903a00, emissiveIntensity: 0.4 }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.copy(pole.position).y += 17;
  group.add(sock);
  return group;
}

function buildPalm(x, z, rng) {
  const group = new THREE.Group();
  const h = 9 + rng() * 5;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.6, h, 7),
    new THREE.MeshStandardMaterial({ color: 0x8a6b46, roughness: 1 }),
  );
  trunk.position.y = h / 2;
  trunk.rotation.z = (rng() - 0.5) * 0.16;
  group.add(trunk);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e8b3a, roughness: 1, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i += 1) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(1.1, 6.5, 4), frondMat);
    const a = (i / 6) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 2.1, h + 0.6, Math.sin(a) * 2.1);
    frond.rotation.z = Math.cos(a) * 1.1;
    frond.rotation.x = -Math.sin(a) * 1.1;
    group.add(frond);
  }
  group.position.set(x, terrainHeight(x, z), z);
  return group;
}

function buildHut(x, z, rng) {
  const group = new THREE.Group();
  const w = 6 + rng() * 3;
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(w, 3.4, w * 0.8),
    new THREE.MeshStandardMaterial({ color: 0xd9b98a, roughness: 1 }),
  );
  walls.position.y = 1.7;
  group.add(walls);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(w * 0.85, 3, 4),
    new THREE.MeshStandardMaterial({ color: 0xa44a28, roughness: 1 }),
  );
  roof.position.y = 4.9;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);
  group.position.set(x, terrainHeight(x, z), z);
  group.rotation.y = rng() * Math.PI;
  return group;
}

function buildLighthouse() {
  const group = new THREE.Group();
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3.2, 22, 12),
    new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.8 }),
  );
  tower.position.y = 11;
  group.add(tower);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.5, 3, 12),
    new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: 0.8 }),
  );
  band.position.y = 15;
  group.add(band);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
  );
  lamp.position.y = 23.4;
  group.add(lamp);
  group.position.set(-370, terrainHeight(-370, -320), -320);
  return group;
}

function buildClouds(rng) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 26; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p += 1) {
      const s = 10 + rng() * 16;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), mat);
      puff.position.set((rng() - 0.5) * 46, (rng() - 0.5) * 7, (rng() - 0.5) * 22);
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    const a = rng() * Math.PI * 2;
    const r = 420 + rng() * 560;
    cloud.position.set(Math.cos(a) * r, 210 + rng() * 130, Math.sin(a) * r);
    group.add(cloud);
  }
  return group;
}

function buildSmoke() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a8580, transparent: true, opacity: 0.5, roughness: 1 });
  for (let i = 0; i < 9; i += 1) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(7 + i * 1.6, 10, 8), mat);
    puff.position.set((i % 3 - 1) * 6, VOLCANO_HEIGHT - 30 + i * 13, ((i * 7) % 5 - 2) * 5);
    puff.scale.y = 0.7;
    group.add(puff);
  }
  return group;
}

/** Build the whole static world. Returns { group, smoke, clouds } for animation. */
export function buildWorld() {
  const rng = mulberry32(SEED);
  const group = new THREE.Group();
  group.add(buildIsland());
  group.add(buildSea());
  group.add(buildLava());
  group.add(buildRunway());
  group.add(buildLighthouse());
  // Palms on the lowlands, clear of the runway shelf.
  let placed = 0;
  let tries = 0;
  while (placed < 70 && tries < 600) {
    tries += 1;
    const a = rng() * Math.PI * 2;
    const r = 200 + rng() * 330;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = terrainHeight(x, z);
    if (h < 4 || h > 90) continue;
    if (Math.hypot(x - RUNWAY.x, z - RUNWAY.z) < 120) continue;
    group.add(buildPalm(x, z, rng));
    placed += 1;
  }
  // Fishing village on the south beach.
  for (let i = 0; i < 12; i += 1) {
    const x = -40 + i * 22 + (rng() - 0.5) * 10;
    const z = 430 + (rng() - 0.5) * 36;
    if (terrainHeight(x, z) < 1) continue;
    group.add(buildHut(x, z, rng));
  }
  const smoke = buildSmoke();
  group.add(smoke);
  const clouds = buildClouds(rng);
  group.add(clouds);
  return { group, smoke, clouds };
}
