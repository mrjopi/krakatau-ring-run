// The KR-7 "Krakatau" bush plane, built from primitives: orange fuselage with
// a white cheatline, glass canopy, high wing, tail, a spinning propeller and
// red/green wingtip lights. buildPlane returns { group, prop, gear }.
import * as THREE from 'three';
import { PALETTE } from './config.js';

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25, ...extra });
}

export function buildPlane() {
  const group = new THREE.Group();
  const body = mat(PALETTE.planeBody);
  const trim = mat(PALETTE.planeTrim);
  const glass = mat(0x2a4a5e, { roughness: 0.12, metalness: 0.7 });
  const dark = mat(0x2a2f36, { roughness: 0.8, metalness: 0.1 });

  // Fuselage: nose forward on -Z (the plane flies toward -Z in local space).
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.6, 12), body);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.4, 12), body);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.4;
  group.add(nose);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.2, 12), body);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 3.8;
  group.add(tailCone);

  // White cheatline stripe along the fuselage.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.22, 5.4), trim);
  stripe.position.set(0, 0.12, -0.2);
  group.add(stripe);

  // Canopy.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.78, 14, 10), glass);
  canopy.scale.set(0.85, 0.55, 1.35);
  canopy.position.set(0, 0.62, -1.1);
  group.add(canopy);

  // High wing with slightly rounded tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.22, 1.9), trim);
  wing.position.set(0, 0.72, -0.4);
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.9, 8), body);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(side * 5.2, 0.72, -0.4);
    group.add(tip);
    // Wingtip navigation light.
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff2a22 : 0x2aff66 }),
    );
    light.position.set(side * 5.35, 0.72, -0.4);
    group.add(light);
    // Wing strut.
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.9, 6), dark);
    strut.position.set(side * 2.1, -0.1, -0.4);
    strut.rotation.z = side * 0.5;
    group.add(strut);
  }

  // Tail: vertical fin + horizontal stabiliser.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 1.5), body);
  fin.position.set(0, 0.85, 4.1);
  fin.rotation.x = -0.25;
  group.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 1.1), trim);
  stab.position.set(0, 0.35, 4.3);
  group.add(stab);

  // Propeller: spinner + two blades, spun in the render loop.
  const prop = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 12), trim);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.5;
  prop.add(spinner);
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.4, 0.1), dark);
    blade.position.z = -0.15;
    blade.rotation.z = a;
    blade.rotation.y = 0.35;
    prop.add(blade);
  }
  prop.position.z = -4.1;
  group.add(prop);

  // Fixed landing gear.
  const gear = new THREE.Group();
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), dark);
    leg.position.set(side * 0.85, -0.95, -0.6);
    leg.rotation.z = side * 0.3;
    gear.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.05, -1.45, -0.6);
    gear.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), dark);
  tailWheel.position.set(0, -0.55, 4.2);
  gear.add(tailWheel);
  group.add(gear);

  // Soft blob shadow under the plane (a dark disc that follows the ground).
  // Kept out of the plane group so it can sit flat on the terrain in world
  // space while the plane banks: main.js positions it every frame.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.name = 'groundShadow';

  return { group, prop, gear, shadow };
}
