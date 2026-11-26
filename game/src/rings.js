// The ring course: twelve glowing gates strung around Krakatau — over the
// beach, through the crater rim, down the ridge valleys and back to the
// runway. A course is built from a seed, so every sortie flies a new line.
import * as THREE from 'three';
import { GAME, PALETTE, RUNWAY } from './config.js';
import { mulberry32 } from './random.js';
import { terrainHeight } from './terrain.js';

export const RING_RADIUS = 15;

/** Ring centres for a course, in world space. The gates flow clockwise
 * around the island, each turn gentle, each gate at least 55 m clear of the
 * ground beneath it, and the last gate sits low over the runway's south-west
 * threshold, lined up with the strip, so a pilot can thread the whole course
 * without ever cutting back across the volcano. */
export function courseRings(seed, count = GAME.ringsPerCourse) {
  const rng = mulberry32(seed);
  const stops = [
    [300, 260], [430, 60], [470, -180], [330, -380], [60, -470],
    [-260, -420], [-450, -180], [-480, 120], [-380, 380], [-260, 470],
    [-80, 480],
  ];
  const rings = stops.map(([x, z]) => {
    const h = Math.max(95, terrainHeight(x, z) + 58 + rng() * 22);
    return new THREE.Vector3(x, h, z);
  });
  // Final gate: low over the beach, lined up with the runway for a landing.
  rings.push(new THREE.Vector3(251, 60, 403));
  while (rings.length > count) rings.pop();
  return rings;
}

function ringMesh(radius, color) {
  const group = new THREE.Group();
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 1.1, 12, 40),
    new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 1.4, roughness: 0.4, metalness: 0.2,
    }),
  );
  group.add(torus);
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.45, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  group.add(inner);
  // Chevrons on the rim so the gate reads at a distance.
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const bead = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    bead.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    group.add(bead);
  }
  return group;
}

/** Build the visible course. Returns { group, setNext, markPassed, reset }. */
export function buildCourse(ringCentres) {
  const group = new THREE.Group();
  const meshes = ringCentres.map((centre) => {
    const mesh = ringMesh(RING_RADIUS, PALETTE.ring);
    mesh.position.copy(centre);
    // Face the gate toward the previous ring so the pilot flies through it.
    group.add(mesh);
    return mesh;
  });
  // A light pillar on the next gate so it is findable from anywhere.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 220, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: PALETTE.ring, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  group.add(beacon);

  let next = 0;
  function faceGates() {
    for (let i = 0; i < meshes.length; i += 1) {
      const from = i === 0 ? new THREE.Vector3(RUNWAY.x, 80, RUNWAY.z) : ringCentres[i - 1];
      meshes[i].lookAt(from.x, from.y, from.z);
    }
  }
  faceGates();

  function setNext(index) {
    next = index;
    meshes.forEach((mesh, i) => {
      const done = i < index;
      const active = i === index;
      mesh.children[0].material.emissive.set(done ? PALETTE.ringDone : PALETTE.ring);
      mesh.children[0].material.color.set(done ? PALETTE.ringDone : PALETTE.ring);
      mesh.children[0].material.emissiveIntensity = active ? 2.2 : 1.0;
      mesh.visible = true;
    });
    if (index < ringCentres.length) {
      beacon.visible = true;
      beacon.position.set(ringCentres[index].x, ringCentres[index].y + 80, ringCentres[index].z);
    } else {
      beacon.visible = false;
    }
  }
  function markPassed(index) {
    if (index >= 0 && index < meshes.length) {
      meshes[index].children[0].material.emissive.set(PALETTE.ringDone);
      meshes[index].children[0].material.color.set(PALETTE.ringDone);
    }
  }
  function reset() {
    setNext(0);
  }
  setNext(0);
  return { group, setNext, markPassed, reset };
}

/** True when the plane's nose is inside the ring's disc. */
export function ringHit(planePos, centre, radius = RING_RADIUS) {
  return planePos.distanceTo(centre) < radius + 1;
}
