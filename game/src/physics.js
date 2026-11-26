// Arcade flight model with just enough discipline to be a game: throttle sets
// speed, banking turns the plane, pitching trades speed for height, and
// below stall speed the nose drops. All angles in radians, speeds in m/s.
import * as THREE from 'three';
import { PLANE, STEP } from './config.js';
import { onRunway, terrainHeight } from './terrain.js';

export const CRASH_NONE = 0;
export const CRASH_TERRAIN = 1;
export const CRASH_WATER = 2;
export const LANDING_OK = 3;

/** Fresh flight state at the runway threshold, lined up for take-off. */
export function freshState(start) {
  return {
    pos: new THREE.Vector3(start.x, start.y, start.z),
    heading: start.heading,
    pitch: 0,
    roll: 0,
    speed: PLANE.minSpeed,
    throttle: 0.55,
    verticalSpeed: 0,
    crashed: CRASH_NONE,
    landed: false,
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * One fixed step. `input` is { pitch: -1..1 (up positive), roll: -1..1
 * (right positive), throttle: 0..1, throttleDelta }. Returns a crash code
 * (CRASH_NONE while flying, LANDING_OK on a gentle runway touchdown).
 */
export function stepFlight(state, input, dt = STEP) {
  if (input.throttle !== undefined) state.throttle = clamp(input.throttle, 0, 1);
  if (input.throttleDelta) state.throttle = clamp(state.throttle + input.throttleDelta * dt, 0, 1);

  // Speed chases the throttle's target; drag grows with speed.
  const targetSpeed = PLANE.minSpeed + state.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
  const accel = (targetSpeed - state.speed) * (state.speed < targetSpeed ? 0.9 : 1.4);
  state.speed = clamp(state.speed + accel * dt - state.speed * PLANE.drag * 0.06 * dt, 0, PLANE.maxSpeed + 12);

  // Bank and pitch ease toward the pilot's input.
  const wantRoll = clamp(input.roll * PLANE.maxBank, -PLANE.maxBank, PLANE.maxBank);
  const wantPitch = clamp(input.pitch * PLANE.maxPitch, -PLANE.maxPitch, PLANE.maxPitch);
  state.roll += (wantRoll - state.roll) * Math.min(1, PLANE.bankRate * dt * 2.2);
  state.pitch += (wantPitch - state.pitch) * Math.min(1, PLANE.pitchRate * dt * 2.2);

  // A banked plane turns; the turn tightens with speed.
  state.heading += -state.roll * PLANE.turnRate * (0.35 + state.speed / PLANE.maxSpeed) * dt;

  // Climb from pitch and lift; stall below stall speed.
  let climb = Math.sin(state.pitch) * PLANE.climbRate * (state.speed / PLANE.cruiseSpeed);
  if (state.speed < PLANE.stallSpeed) {
    climb -= (PLANE.stallSpeed - state.speed) * 0.55;
    state.pitch += (0 - state.pitch) * 0.4 * dt;
  }
  // Level flight at cruise bleeds a little height without power; throttle holds it.
  climb += (state.throttle - 0.5) * 6;
  state.verticalSpeed = climb;

  const dir = new THREE.Vector3(-Math.sin(state.heading), 0, -Math.cos(state.heading));
  state.pos.addScaledVector(dir, state.speed * Math.cos(state.pitch) * dt);
  state.pos.y += climb * dt;

  // Ground and water.
  const ground = terrainHeight(state.pos.x, state.pos.z);
  if (state.pos.y <= ground + 1.6) {
    const gentle = Math.abs(climb) < 7 && state.speed < 52 && onRunway(state.pos.x, state.pos.z);
    if (gentle) {
      state.pos.y = ground + 1.6;
      state.landed = true;
      return LANDING_OK;
    }
    state.crashed = ground <= 0.5 ? CRASH_WATER : CRASH_TERRAIN;
    return state.crashed;
  }
  if (state.pos.y < 1.2) {
    state.crashed = CRASH_WATER;
    return CRASH_WATER;
  }
  // Ceiling.
  if (state.pos.y > 520) state.pos.y = 520;
  return CRASH_NONE;
}

/** Heading in degrees, 0 = north (-Z), clockwise. The flight model's
 * heading grows counter-clockwise, so negate it for the compass. */
export function headingDegrees(state) {
  return ((-THREE.MathUtils.radToDeg(state.heading) % 360) + 360) % 360;
}

/** Compass point for a heading in degrees. */
export function compassPoint(deg) {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(deg / 45) % 8];
}
