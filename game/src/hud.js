// The HUD: DOM readouts plus two small canvases (artificial horizon and a
// top-down minimap), all drawn every frame from the flight state. Nothing
// here touches the 3D scene.
import { PALETTE } from './config.js';

export function buildHud(root) {
  const el = (tag, cls, parent) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    (parent || root).appendChild(n);
    return n;
  };
  const hud = el('div', 'hud');
  const top = el('div', 'hud-top', hud);
  const scoreBox = el('div', 'hud-box', top);
  el('div', 'hud-label', scoreBox).textContent = 'SCORE';
  const score = el('div', 'hud-big', scoreBox);
  const ringsBox = el('div', 'hud-box', top);
  el('div', 'hud-label', ringsBox).textContent = 'RINGS';
  const rings = el('div', 'hud-big', ringsBox);
  const timeBox = el('div', 'hud-box', top);
  el('div', 'hud-label', timeBox).textContent = 'TIME';
  const time = el('div', 'hud-big', timeBox);
  const livesBox = el('div', 'hud-box', top);
  el('div', 'hud-label', livesBox).textContent = 'LIVES';
  const lives = el('div', 'hud-big', livesBox);

  const compass = el('div', 'hud-compass', hud);
  const compassStrip = el('div', 'hud-compass-strip', compass);
  el('div', 'hud-compass-needle', compass);

  const left = el('div', 'hud-left', hud);
  const horizon = document.createElement('canvas');
  horizon.width = 150;
  horizon.height = 150;
  horizon.className = 'hud-horizon';
  left.appendChild(horizon);
  const horizonLabel = el('div', 'hud-label', left);
  horizonLabel.textContent = 'ATTITUDE';

  const right = el('div', 'hud-right', hud);
  const speedBox = el('div', 'hud-box', right);
  el('div', 'hud-label', speedBox).textContent = 'AIRSPEED km/h';
  const speed = el('div', 'hud-big', speedBox);
  const altBox = el('div', 'hud-box', right);
  el('div', 'hud-label', altBox).textContent = 'ALTITUDE m';
  const alt = el('div', 'hud-big', altBox);
  const hdgBox = el('div', 'hud-box', right);
  el('div', 'hud-label', hdgBox).textContent = 'HEADING';
  const hdg = el('div', 'hud-big', hdgBox);

  const bottom = el('div', 'hud-bottom', hud);
  const throttleBox = el('div', 'hud-gauge', bottom);
  el('div', 'hud-label', throttleBox).textContent = 'THROTTLE';
  const throttleBar = el('div', 'hud-bar', throttleBox);
  const throttleFill = el('div', 'hud-fill hud-fill-throttle', throttleBar);
  const fuelBox = el('div', 'hud-gauge', bottom);
  el('div', 'hud-label', fuelBox).textContent = 'FUEL';
  const fuelBar = el('div', 'hud-bar', fuelBox);
  const fuelFill = el('div', 'hud-fill hud-fill-fuel', fuelBar);

  const map = document.createElement('canvas');
  map.width = 150;
  map.height = 150;
  map.className = 'hud-map';
  bottom.appendChild(map);
  const mapLabel = el('div', 'hud-label', bottom);
  mapLabel.textContent = 'KRAKATAU';

  const flash = el('div', 'hud-flash', hud);
  const hint = el('div', 'hud-hint', hud);
  hint.innerHTML = 'ARROWS / MOUSE steer &nbsp;·&nbsp; W/S throttle &nbsp;·&nbsp; C camera &nbsp;·&nbsp; P pause &nbsp;·&nbsp; M sound';
  return {
    score, rings, time, lives, speed, alt, hdg, throttleFill, fuelFill,
    compassStrip, horizon, map, flash, hint, hud,
  };
}

function drawHorizon(canvas, roll, pitch) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-roll);
  const pitchPx = Math.max(-50, Math.min(50, pitch * 90));
  ctx.fillStyle = '#2f7fc9';
  ctx.fillRect(-w, -h + pitchPx, w * 2, h);
  ctx.fillStyle = '#5a4632';
  ctx.fillRect(-w, pitchPx, w * 2, h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w, pitchPx);
  ctx.lineTo(w, pitchPx);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  for (const dy of [-30, -15, 15, 30]) {
    ctx.beginPath();
    ctx.moveTo(-22, pitchPx + dy);
    ctx.lineTo(22, pitchPx + dy);
    ctx.stroke();
  }
  ctx.restore();
  // Fixed wings + centre dot.
  ctx.strokeStyle = PALETTE.hudAmber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 34, h / 2);
  ctx.lineTo(w / 2 - 10, h / 2);
  ctx.moveTo(w / 2 + 10, h / 2);
  ctx.lineTo(w / 2 + 34, h / 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();
}

function drawMap(canvas, plane, rings, nextRing, runway) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const scale = w / 1300;
  const toMap = (x, z) => [w / 2 + x * scale, h / 2 + z * scale];
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(10, 30, 44, 0.85)';
  ctx.fillRect(0, 0, w, h);
  // Sea + island.
  ctx.fillStyle = '#1d6f8f';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#4d8a4a';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 560 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6e5a4e';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 130 * scale, 0, Math.PI * 2);
  ctx.fill();
  // Runway.
  ctx.save();
  const [rx, rz] = toMap(runway.x, runway.z);
  ctx.translate(rx, rz);
  ctx.rotate(-runway.heading);
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(-11, -2.5, 22, 5);
  ctx.restore();
  // Rings: done green, next amber, later faint.
  rings.forEach((centre, i) => {
    const [x, y] = toMap(centre.x, centre.z);
    ctx.beginPath();
    ctx.arc(x, y, i === nextRing ? 6 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = i < nextRing ? PALETTE.hudGreen : i === nextRing ? PALETTE.hudAmber : 'rgba(255,255,255,0.5)';
    ctx.fill();
  });
  // Plane arrow.
  const [px, py] = toMap(plane.pos.x, plane.pos.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-plane.heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Compass strip: ticks for N/E/S/W sliding with the heading. */
function drawCompass(strip, headingDeg) {
  const labels = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
  let html = '';
  for (let d = -360; d <= 720; d += 45) {
    const norm = ((d % 360) + 360) % 360;
    const label = labels.find(([deg]) => deg === norm);
    if (!label) continue;
    const offset = ((d - headingDeg + 540) % 360) - 180;
    const x = 50 + offset * 0.9;
    if (x < -4 || x > 104) continue;
    html += `<span style="left:${x}%">${label[1]}</span>`;
  }
  strip.innerHTML = html;
}

let flashTimer = null;

/** Big centre message for a few seconds. */
export function flashMessage(refs, text, kind = '') {
  refs.flash.textContent = text;
  refs.flash.className = `hud-flash show ${kind}`;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    refs.flash.className = 'hud-flash';
  }, 1800);
}

export function updateHud(refs, state) {
  const { flight, score, ringsLeft, timeLeft, lives, fuel, headingDeg } = state;
  refs.score.textContent = String(score);
  refs.rings.textContent = `${ringsLeft}`;
  refs.time.textContent = `${Math.max(0, Math.ceil(timeLeft))}s`;
  refs.lives.textContent = '✈'.repeat(Math.max(0, lives));
  refs.speed.textContent = String(Math.round(flight.speed * 3.6));
  refs.alt.textContent = String(Math.max(0, Math.round(flight.pos.y)));
  refs.hdg.textContent = `${String(Math.round(headingDeg)).padStart(3, '0')}°`;
  refs.throttleFill.style.width = `${Math.round(flight.throttle * 100)}%`;
  refs.fuelFill.style.width = `${Math.round(fuel)}%`;
  refs.fuelFill.classList.toggle('low', fuel < 25);
  drawCompass(refs.compassStrip, headingDeg);
  drawHorizon(refs.horizon, flight.roll, flight.pitch);
  drawMap(refs.map, flight, state.ringCentres, state.nextRing, state.runway);
}
