// Krakatau Ring Run: fly the KR-7 bush plane around a volcano island,
// thread twelve glowing rings, mind your fuel, and grease a landing on the
// beach runway. Keyboard + mouse, desktop Chrome, no network.
import * as THREE from 'three';
import {
  BEST_KEY, GAME, PALETTE, PLANE, RUNWAY, STEP, VOLCANO_HEIGHT,
} from './config.js';
import { buildWorld, onRunway, terrainHeight } from './terrain.js';
import { buildPlane } from './plane.js';
import { buildCourse, courseRings, ringHit, RING_RADIUS } from './rings.js';
import {
  CRASH_NONE, CRASH_TERRAIN, CRASH_WATER,
  LANDING_OK, freshState, headingDegrees, stepFlight,
} from './physics.js';
import { buildAudio } from './audio.js';
import { buildHud, flashMessage, updateHud } from './hud.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || 7);

// --- Renderer / scene -------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = false;
document.getElementById('scene').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.skyHorizon);
scene.fog = new THREE.Fog(0xcfe8f2, 700, 2400);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 6000);
camera.position.set(0, 200, 700);

const sun = new THREE.DirectionalLight(0xfff2dd, 2.6);
sun.position.set(400, 700, 300);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfe3f2, 0x4a6b3a, 1.1));

// Sky dome: a big gradient sphere so the horizon never reads as flat colour.
const skyGeo = new THREE.SphereGeometry(4200, 24, 14);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    top: { value: new THREE.Color(PALETTE.skyTop) },
    bottom: { value: new THREE.Color(PALETTE.skyHorizon) },
  },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0, 0.5, h)), 1.0); }',
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

// Sun disc.
const sunDisc = new THREE.Mesh(
  new THREE.CircleGeometry(90, 24),
  new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }),
);
sunDisc.position.set(1500, 1100, -2600);
sunDisc.lookAt(camera.position);
scene.add(sunDisc);

const world = buildWorld();
scene.add(world.group);

const planeParts = buildPlane();
scene.add(planeParts.group);
scene.add(planeParts.shadow);

// --- Game state -------------------------------------------------------------
const START = {
  x: RUNWAY.x - Math.cos(RUNWAY.heading) * 90,
  y: 90,
  z: RUNWAY.z - Math.sin(RUNWAY.heading) * 90,
  // Lined up on the first ring, north-north-east from the runway threshold.
  heading: -0.42,
};

let courseSeed = SEED;
let ringCentres = courseRings(courseSeed);
let course = buildCourse(ringCentres);
scene.add(course.group);

const flight = freshState(START);
const audio = buildAudio();
const hudRefs = buildHud(document.getElementById('hud'));

const game = {
  state: 'title', // title | playing | paused | crashed | over
  score: 0,
  best: Number(window.localStorage.getItem(BEST_KEY) || 0),
  nextRing: 0,
  timeLeft: GAME.sortieSeconds,
  lives: GAME.lives,
  fuel: GAME.fuelMax,
  crashTimer: 0,
  landCooldown: 0,
  crashGrace: 0,
  cameraMode: 0, // 0 chase, 1 cockpit, 2 side
  shake: 0,
  flashRed: 0,
};

const keys = {};
const mouse = { x: 0, y: 0, active: false };

function hudState() {
  return {
    flight,
    score: game.score,
    ringsLeft: Math.max(0, ringCentres.length - game.nextRing),
    timeLeft: game.timeLeft,
    lives: game.lives,
    fuel: game.fuel,
    headingDeg: headingDegrees(flight),
    ringCentres,
    nextRing: game.nextRing,
    runway: RUNWAY,
  };
}

// --- Input ------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === 'p' || e.key === 'Escape') togglePause();
  if (e.key.toLowerCase() === 'm') {
    audio.setMuted(!audio.isMuted());
    flashMessage(hudRefs, audio.isMuted() ? 'SOUND OFF' : 'SOUND ON');
  }
  if (e.key.toLowerCase() === 'c') {
    game.cameraMode = (game.cameraMode + 1) % 3;
    flashMessage(hudRefs, ['CHASE CAMERA', 'COCKPIT CAMERA', 'TRACKING CAMERA'][game.cameraMode]);
  }
  if (e.key.toLowerCase() === 'r' && (game.state === 'playing' || game.state === 'over')) startSortie();
  audio.unlock();
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});
window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  mouse.active = true;
});
window.addEventListener('mousedown', () => audio.unlock());
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function readInput() {
  const pitchKeys = (keys.arrowup ? 1 : 0) - (keys.arrowdown ? 1 : 0);
  const rollKeys = (keys.arrowright ? 1 : 0) - (keys.arrowleft ? 1 : 0);
  let pitch = pitchKeys;
  let roll = rollKeys;
  if (mouse.active && Math.abs(mouse.x) + Math.abs(mouse.y) > 0.12) {
    roll = Math.max(-1, Math.min(1, roll + mouse.x * 1.4));
    pitch = Math.max(-1, Math.min(1, pitch - mouse.y * 1.1));
  }
  let throttleDelta = 0;
  if (keys.w) throttleDelta += 0.55;
  if (keys.s) throttleDelta -= 0.55;
  return { pitch, roll, throttleDelta };
}

// --- Flow -------------------------------------------------------------------
function showOverlay(which) {
  for (const id of ['title', 'pause', 'over']) {
    document.getElementById(`overlay-${id}`).classList.toggle('visible', id === which);
  }
  document.body.dataset.state = which || 'playing';
}

function startSortie() {
  courseSeed = SEED;
  ringCentres = courseRings(courseSeed);
  scene.remove(course.group);
  course = buildCourse(ringCentres);
  scene.add(course.group);
  Object.assign(flight, freshState(START));
  game.score = 0;
  game.nextRing = 0;
  game.timeLeft = GAME.sortieSeconds;
  game.lives = GAME.lives;
  game.fuel = GAME.fuelMax;
  game.landCooldown = 0;
  game.crashGrace = 0;
  game.state = 'playing';
  showOverlay(null);
  hudRefs.hint.style.display = 'block';
  audio.unlock();
  audio.click();
  flashMessage(hudRefs, 'SORTIE 1 — THREAD ALL 12 RINGS');
}

function togglePause() {
  if (game.state === 'playing') {
    game.state = 'paused';
    showOverlay('pause');
  } else if (game.state === 'paused') {
    game.state = 'playing';
    showOverlay(null);
  }
}

function endSortie(reason) {
  game.state = 'over';
  const best = Math.max(game.best, game.score);
  const isBest = game.score > game.best;
  game.best = best;
  window.localStorage.setItem(BEST_KEY, String(best));
  document.getElementById('final-score').textContent = String(game.score);
  document.getElementById('final-rings').textContent = String(ringCentres.length - Math.max(0, ringCentres.length - game.nextRing));
  document.getElementById('final-best').textContent = String(best);
  document.getElementById('over-title').textContent = reason;
  document.getElementById('over-best').textContent = isBest ? 'NEW BEST SCORE!' : '';
  showOverlay('over');
  audio.update(0, 0, false);
}

function respawn() {
  const at = game.nextRing > 0 ? ringCentres[game.nextRing - 1] : new THREE.Vector3(START.x, START.y, START.z);
  const back = game.nextRing > 0 && game.nextRing < ringCentres.length
    ? ringCentres[game.nextRing]
    : at;
  flight.pos.set(at.x, Math.max(at.y + 30, terrainHeight(at.x, at.z) + 60), at.z);
  flight.heading = Math.atan2(-(back.x - at.x), -(back.z - at.z));
  flight.pitch = 0;
  flight.roll = 0;
  flight.speed = PLANE.cruiseSpeed;
  flight.throttle = 0.6;
  flight.crashed = CRASH_NONE;
  flight.landed = false;
  game.crashGrace = 2.5;
  game.state = 'playing';
  showOverlay(null);
  flashMessage(hudRefs, `BACK IN THE AIR — ${game.lives} ${game.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`, 'warn');
}

function crash(kind) {
  game.state = 'crashed';
  game.crashTimer = 1.4;
  game.shake = 1;
  game.flashRed = 1;
  game.lives -= 1;
  audio.crash();
  audio.update(0, 0, false);
  flashMessage(hudRefs, kind === CRASH_WATER ? 'DITCHED IN THE SEA!' : 'TERRAIN STRIKE!', 'bad');
  document.getElementById('damage').classList.add('show');
  setTimeout(() => document.getElementById('damage').classList.remove('show'), 700);
  if (game.lives <= 0) {
    setTimeout(() => endSortie('OUT OF PLANES'), 1400);
  } else {
    setTimeout(respawn, 1400);
  }
}

function collectRing() {
  game.score += GAME.ringPoints;
  game.timeLeft += GAME.ringBonusSeconds;
  game.fuel = Math.min(GAME.fuelMax, game.fuel + GAME.fuelPerRing);
  course.markPassed(game.nextRing);
  game.nextRing += 1;
  course.setNext(game.nextRing);
  audio.ring();
  if (game.nextRing >= ringCentres.length) {
    game.score += 500;
    flashMessage(hudRefs, 'COURSE COMPLETE! +500 — NEW COURSE', 'good');
    courseSeed += 1;
    ringCentres = courseRings(courseSeed);
    scene.remove(course.group);
    course = buildCourse(ringCentres);
    scene.add(course.group);
    game.nextRing = 0;
  } else {
    flashMessage(hudRefs, `RING ${game.nextRing}/${ringCentres.length}  +${GAME.ringPoints}`, 'good');
  }
}

function landPlane() {
  game.score += GAME.landingPoints;
  game.fuel = GAME.fuelMax;
  game.landCooldown = 4;
  flight.pos.y = terrainHeight(flight.pos.x, flight.pos.z) + 9;
  flight.speed = Math.max(flight.speed, 46);
  flight.pitch = 0.16;
  audio.landing();
  flashMessage(hudRefs, `TOUCH AND GO! +${GAME.landingPoints} · FUEL FULL`, 'good');
}

// --- Camera -----------------------------------------------------------------
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
const lookAt = new THREE.Vector3();

function updateCamera(dt) {
  const forward = new THREE.Vector3(-Math.sin(flight.heading), 0, -Math.cos(flight.heading));
  if (game.cameraMode === 1) {
    // Cockpit: at the canopy, looking along the nose.
    camPos.copy(flight.pos).addScaledVector(forward, 1.2);
    camPos.y += 1.1;
    lookAt.copy(flight.pos).addScaledVector(forward, 60);
    lookAt.y += Math.sin(flight.pitch) * 30;
    camera.position.lerp(camPos, Math.min(1, dt * 14));
    camera.up.set(Math.sin(flight.roll) * -0.6, 1, 0);
    camera.lookAt(lookAt);
    camera.fov = 68;
  } else if (game.cameraMode === 2) {
    // Tracking: a fixed side camera that watches the plane fly past.
    const side = new THREE.Vector3(-forward.z, 0, forward.x);
    camPos.copy(flight.pos).addScaledVector(side, 42).addScaledVector(forward, -26);
    camPos.y = flight.pos.y + 12;
    camera.position.lerp(camPos, Math.min(1, dt * 2.5));
    camera.up.set(0, 1, 0);
    camera.lookAt(flight.pos);
    camera.fov = 58;
  } else {
    // Chase: close behind and just above, eased, with a touch of roll and a
    // slight side offset so the fuselage reads in three-quarter view.
    camPos.copy(flight.pos).addScaledVector(forward, -11.5 - flight.speed * 0.035);
    camPos.add(new THREE.Vector3(Math.cos(flight.heading), 0, -Math.sin(flight.heading)).multiplyScalar(1.8));
    camPos.y = flight.pos.y + 3.1 + flight.speed * 0.008;
    camera.position.lerp(camPos, Math.min(1, dt * 5.5));
    lookAt.copy(flight.pos).addScaledVector(forward, 26);
    lookAt.y += Math.sin(flight.pitch) * 12;
    camera.up.set(Math.sin(flight.roll) * 0.25, 1, 0);
    camera.lookAt(lookAt);
    camera.fov = 58 + flight.speed * 0.08;
  }
  camera.updateProjectionMatrix();
  if (game.shake > 0) {
    game.shake = Math.max(0, game.shake - dt * 1.4);
    camera.position.x += (Math.random() - 0.5) * game.shake * 1.6;
    camera.position.y += (Math.random() - 0.5) * game.shake * 1.6;
  }
}

// --- Per-frame ---------------------------------------------------------------
function placePlaneMesh() {
  planeParts.group.position.copy(flight.pos);
  planeParts.group.rotation.set(0, 0, 0);
  planeParts.group.rotateY(flight.heading);
  planeParts.group.rotateX(-flight.pitch);
  planeParts.group.rotateZ(flight.roll);
  planeParts.prop.rotation.z += 0.35 + flight.throttle * 1.4;
  // Ground shadow: a disc flat on the terrain straight below the plane.
  const ground = terrainHeight(flight.pos.x, flight.pos.z);
  const shadow = planeParts.shadow;
  shadow.position.set(flight.pos.x, ground + 0.4, flight.pos.z);
  const fade = Math.max(0, 1 - (flight.pos.y - ground) / 160);
  shadow.material.opacity = 0.28 * fade;
  shadow.scale.setScalar(Math.max(0.4, fade));
}

function tick(dt, elapsed) {
  // Ambient motion, whatever the state.
  world.clouds.children.forEach((cloud, i) => {
    cloud.position.x += dt * (1.5 + (i % 3));
    if (cloud.position.x > 1200) cloud.position.x = -1200;
  });
  world.smoke.children.forEach((puff, i) => {
    puff.position.y += dt * 2.2;
    if (puff.position.y > VOLCANO_HEIGHT + 120) puff.position.y = VOLCANO_HEIGHT - 30;
    puff.material.opacity = 0.32 + 0.18 * Math.sin(elapsed * 0.7 + i);
  });

  if (game.state === 'title') {
    // Attract orbit around the volcano; the plane waits on the runway.
    const a = elapsed * 0.045;
    camera.position.set(Math.cos(a) * 760, 250 + Math.sin(elapsed * 0.1) * 30, Math.sin(a) * 760);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 150, 0);
    camera.fov = 58;
    camera.updateProjectionMatrix();
    flight.pos.set(START.x, terrainHeight(START.x, START.z) + 1.6, START.z);
    flight.heading = RUNWAY.heading;
    placePlaneMesh();
    planeParts.prop.rotation.z += 0.05;
    return;
  }

  if (game.state === 'paused' || game.state === 'over') {
    placePlaneMesh();
    return;
  }

  if (game.state === 'crashed') {
    game.crashTimer -= dt;
    // Tumble: the wreck slides and the camera holds.
    flight.pos.y = Math.max(terrainHeight(flight.pos.x, flight.pos.z) + 1.2, flight.pos.y - dt * 8);
    flight.roll += dt * 1.2;
    placePlaneMesh();
    updateCamera(dt);
    return;
  }

  // Playing.
  if (game.crashGrace > 0) game.crashGrace -= dt;
  if (game.landCooldown > 0) game.landCooldown -= dt;
  game.timeLeft -= dt;
  game.fuel -= GAME.fuelBurnPerSecond * (0.4 + flight.throttle) * dt;
  if (game.fuel <= 0) {
    game.fuel = 0;
    flight.throttle = Math.min(flight.throttle, 0.18);
    if (Math.floor(elapsed * 2) % 2 === 0) flashMessage(hudRefs, 'LOW FUEL — FIND A RING', 'warn');
  }
  if (game.timeLeft <= 0) {
    endSortie('TIME UP');
    return;
  }

  const input = readInput();
  const result = stepFlight(flight, input, dt);
  if (result === LANDING_OK && game.landCooldown <= 0 && game.crashGrace <= 0) {
    landPlane();
  } else if ((result === CRASH_TERRAIN || result === CRASH_WATER) && game.crashGrace <= 0) {
    crash(result);
    placePlaneMesh();
    updateCamera(dt);
    return;
  }

  // Ring collection + near miss.
  if (game.nextRing < ringCentres.length) {
    const centre = ringCentres[game.nextRing];
    if (ringHit(flight.pos, centre)) {
      collectRing();
    } else if (flight.pos.distanceTo(centre) < RING_RADIUS + 9) {
      // Skimmed the rim without going through: small consolation, once.
      if (!centre._skimmed) {
        centre._skimmed = true;
        game.score += GAME.nearMissPoints;
        flashMessage(hudRefs, `NEAR MISS +${GAME.nearMissPoints}`, 'warn');
      }
    }
  }

  placePlaneMesh();
  updateCamera(dt);
  updateHud(hudRefs, hudState());
  audio.update(flight.throttle, flight.speed, true);
}

// --- Boot -------------------------------------------------------------------
document.getElementById('start-btn').addEventListener('click', startSortie);
document.getElementById('again-btn').addEventListener('click', startSortie);
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('best-title').textContent = String(game.best);
document.getElementById('best-over').textContent = String(game.best);

const clock = new THREE.Clock();
let elapsed = 0;

if (SHOT) {
  // Deterministic screenshot scene: simulate with the autopilot, then freeze.
  const staged = stageShot(SHOT, {
    flight, game, ringCentres, course, scene, startSortie, collectRing, landPlane,
  });
  game.state = 'playing';
  showOverlay(null);
  hudRefs.hint.style.display = 'none';
  hudRefs.flash.className = 'hud-flash';
  updateHud(hudRefs, hudState());
  placePlaneMesh();
  // Settle the eased chase camera on the staged pose before the one render.
  for (let i = 0; i < 150; i += 1) updateCamera(STEP);
  renderer.render(scene, camera);
  window.__shotReady = true;
  document.title = `shot:${SHOT}`;
} else {
  showOverlay('title');
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    tick(dt, elapsed);
    renderer.render(scene, camera);
  });
}

export { game, flight };
