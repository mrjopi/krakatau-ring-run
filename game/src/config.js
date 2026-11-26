// Every tuning number and colour in one place. The island is a square of
// WORLD_SIZE metres centred on the volcano; the sea is y = 0 and the runway
// sits on a flattened shelf on the south-east beach.
export const WORLD_SIZE = 1600;
export const ISLAND_RADIUS = 560;
export const VOLCANO_HEIGHT = 300;
export const SEA_LEVEL = 0;

export const STEP = 1 / 60;

export const PLANE = {
  minSpeed: 26,
  maxSpeed: 95,
  cruiseSpeed: 58,
  accel: 26,
  drag: 0.35,
  climbRate: 26,
  sinkRate: 14,
  bankRate: 1.9,
  maxBank: 1.05,
  pitchRate: 1.15,
  maxPitch: 0.55,
  turnRate: 0.85,
  stallSpeed: 30,
  startAltitude: 130,
};

export const GAME = {
  sortieSeconds: 150,
  ringBonusSeconds: 6,
  ringPoints: 100,
  nearMissPoints: 25,
  landingPoints: 250,
  lives: 3,
  fuelMax: 100,
  fuelBurnPerSecond: 0.55,
  fuelPerRing: 14,
  ringsPerCourse: 12,
};

export const RUNWAY = {
  // Centre of the strip, on the south-east beach shelf.
  x: 330,
  z: 300,
  heading: -0.65,
  length: 260,
  width: 26,
};

export const PALETTE = {
  skyTop: '#4a90d9',
  skyHorizon: '#bfe3f2',
  sea: '#1d6f8f',
  seaDeep: '#14506e',
  sand: '#e8d29a',
  grass: '#5da24a',
  jungle: '#2f7a33',
  rock: '#6e5a4e',
  crater: '#3a3230',
  lava: '#ff7a1a',
  runway: '#33373d',
  runwayMark: '#f5f5e8',
  planeBody: '#ff7a1a',
  planeTrim: '#ffffff',
  planeGlass: '#18242e',
  ring: '#ffb400',
  ringDone: '#37d67a',
  hudAmber: '#ffb400',
  hudCyan: '#7fe7ff',
  hudGreen: '#7dff9e',
  hudRed: '#ff5a4e',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
export const MONO = '"SF Mono", "Cascadia Mono", Consolas, monospace';

export const BEST_KEY = 'krakatau-ring-run.best';
