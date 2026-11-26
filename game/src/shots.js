// Deterministic screenshot scenes. Each one plays the real rules forward
// from a fresh sortie for a fixed number of steps, steered by a simple
// autopilot (aim at the next ring, climb when the ground is close), so the
// frame is what a short game really looks like and the same seed always
// gives the same frame. Used only with ?shot=<name>&seed=<n>.
import * as THREE from 'three';
import { GAME, PLANE, RUNWAY, STEP } from './config.js';
import { onRunway, terrainHeight } from './terrain.js';
import { CRASH_NONE, stepFlight } from './physics.js';

const SAMPLE = STEP;

/** Steer toward a point: roll to turn, pitch to meet its height. */
function autopilot(flight, target) {
  const dx = target.x - flight.pos.x;
  const dz = target.z - flight.pos.z;
  const wantHeading = Math.atan2(-dx, -dz);
  let diff = wantHeading - flight.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Positive roll decreases heading (a right turn), so steer against diff.
  // Gentle gains: the pilot should look in control, not carve hard banks.
  const roll = Math.max(-0.55, Math.min(0.55, -diff * 1.0));
  // Climb when the terrain ahead is close.
  const aheadX = flight.pos.x - Math.sin(flight.heading) * 70;
  const aheadZ = flight.pos.z - Math.cos(flight.heading) * 70;
  const groundAhead = terrainHeight(aheadX, aheadZ);
  let pitch = Math.max(-1, Math.min(1, (target.y - flight.pos.y) * 0.03));
  if (flight.pos.y < groundAhead + 20) pitch = 1;
  if (flight.pos.y > target.y + 120) pitch = -0.6;
  // Ease off the power on a steep descent so the nose actually drops.
  const throttle = target.y < flight.pos.y - 40 ? 0.4 : 0.62;
  return { pitch, roll, throttle, throttleDelta: 0 };
}

function runSteps(ctx, seconds, steer) {
  const { flight } = ctx;
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const input = steer(flight);
    const result = stepFlight(flight, input, SAMPLE);
    if (result !== CRASH_NONE) break;
    // Collect a ring the autopilot threads, so later scenes sit mid-course.
    if (ctx.game.nextRing < ctx.ringCentres.length) {
      const centre = ctx.ringCentres[ctx.game.nextRing];
      if (flight.pos.distanceTo(centre) < 16) ctx.collectRing();
    }
    ctx.game.timeLeft -= SAMPLE;
  }
}

/** Place the plane on final approach to the runway, lined up and sinking. */
function stageLanding(ctx) {
  const { flight } = ctx;
  // Start 420 m out on the runway's extended centreline, on final.
  const fx = -Math.sin(RUNWAY.heading);
  const fz = -Math.cos(RUNWAY.heading);
  flight.pos.set(RUNWAY.x - fx * 420, 68, RUNWAY.z - fz * 420);
  flight.heading = RUNWAY.heading;
  flight.pitch = -0.12;
  flight.roll = 0;
  flight.speed = 48;
  flight.throttle = 0.4;
  const target = new THREE.Vector3(RUNWAY.x, 12, RUNWAY.z);
  runSteps(ctx, 7, (f) => autopilot(f, target));
  ctx.game.fuel = 62;
}

/**
 * Stage a named scene. Returns nothing; the caller renders one frame after.
 * Scenes: cover (mid-course, volcano + ring ahead), ring (threading a gate),
 * coast (high over the south beach: village + whole volcano), cockpit
 * (from the canopy, next ring ahead with the crater behind it),
 * land (final approach to the runway).
 */
export function stageShot(name, ctx) {
  const { flight, game } = ctx;
  ctx.startSortie();
  game.state = 'playing';
  const steerToNextRing = (f) => {
    const centre = ctx.ringCentres[Math.min(ctx.game.nextRing, ctx.ringCentres.length - 1)];
    return autopilot(f, centre);
  };
  if (name === 'land') {
    stageLanding(ctx);
    return;
  }
  if (name === 'ring') {
    runSteps(ctx, 26, steerToNextRing);
    return;
  }
  if (name === 'cockpit') {
    runSteps(ctx, 12, steerToNextRing);
    // Frame the next ring with the volcano directly behind it: place the
    // plane on the volcano-to-ring line, 220 m past the ring, looking back
    // through the gate at the crater and its smoke.
    const idx = Math.min(ctx.game.nextRing, ctx.ringCentres.length - 1);
    const target = ctx.ringCentres[idx];
    const len = Math.hypot(target.x, target.z) || 1;
    const ux = target.x / len;
    const uz = target.z / len;
    flight.pos.set(target.x + ux * 220, target.y + 8, target.z + uz * 220);
    flight.heading = Math.atan2(-(target.x - flight.pos.x), -(target.z - flight.pos.z));
    flight.pitch = 0;
    flight.roll = 0;
    flight.speed = 55;
    flight.throttle = 0.6;
    game.cameraMode = 1;
    return;
  }
  if (name === 'coast') {
    runSteps(ctx, 34, steerToNextRing);
    // Wide establishing shot from the south-west sea: beach and village
    // mid-frame, the whole volcano cone with crater and smoke behind them,
    // sea in front. Close-in poses filled the frame with one bare slope.
    flight.pos.set(-350, 200, 800);
    flight.heading = -0.41;
    flight.pitch = 0;
    flight.roll = -0.1;
    flight.speed = 55;
    return;
  }
  // cover (default): 9 seconds in, climbing out over the south beach with
  // the volcano ahead and the first ring in frame.
  runSteps(ctx, 9, steerToNextRing);
}
