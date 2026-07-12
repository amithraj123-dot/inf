/* Endless Drive - simulation: layout, spawning, movement, collision, scoring.
   No DOM access here except through the ED.ui hooks (updateHUD / setState / finishRun). */
(() => {
'use strict';
const ED = window.ED;
const D = ED.data;
const clamp = ED.util.clamp;

ED.STATE = { MENU: 0, COUNTDOWN: 1, PLAYING: 2, CRASHING: 3, PAUSED: 4, GAMEOVER: 5, GARAGE: 6, SETTINGS: 7, WHEEL: 8 };

/* Shared viewport / road geometry. Pixel sizes are written by render.resizeCanvas. */
const view = ED.view = {
  W: 0, H: 0, DPR: 1,
  roadW: 0, laneW: 0, roadX: 0,
  layoutRoad() {
    view.roadW = Math.min(view.W * 0.86, 480);
    view.laneW = view.roadW / D.LANES;
    view.roadX = (view.W - view.roadW) / 2;
  },
  laneCenter: lane => view.roadX + view.laneW * (lane + 0.5),
};

/* All mutable game state lives here; render reads it, ui orchestrates it. */
const world = ED.world = {
  player: { x: 0, targetX: 0, y: 0, w: 0, h: 0, tilt: 0, slip: 0, invuln: 0 },
  speed: 0, distance: 0, paceT: 0,
  runCoins: 0, nearMisses: 0,
  obstacles: [], coins: [], powerups: [], slicks: [],
  particles: [], floatTexts: [], stripes: [], props: [],
  rowTimer: 0, lastOpenLanes: [0, 1, 2], lastRowLen: 0,
  shakeT: 0, shakeMag: 0,
  crashTimer: 0, countdownT: 0,
  magnetT: 0, slowmoT: 0, shieldOn: false,
  announced: {}, newBestShown: false,
  envIndex: 0, envPrev: 0, envBlend: 1, envChallengeAnnounceT: -1,
  curveSeed: 0, curveNow: 0, curveSlope: 0,
  wheelTimer: 0, wheelResult: null, wheelEffect: null,
};

const engine = ED.engine = {
  state: ED.STATE.MENU,
  score: () => Math.floor(world.distance) + world.runCoins * 25 + world.nearMisses * 10,
  timeScale: () => (world.slowmoT > 0 ? 0.55 : 1),
  // Speed Surge multiplier on effective scroll speed - deliberately separate
  // from timeScale() (which governs simulation *time*, e.g. particle motion
  // and row cadence): this only scales how fast the world moves.
  speedMult: () => (world.wheelEffect && world.wheelEffect.id === 'speedsurge' ? 1.2 : 1),
};

function playerDims() {
  const p = world.player;
  p.w = view.laneW * 0.62;
  p.h = p.w * 1.85;
  p.y = view.H - p.h - Math.max(view.H * 0.10, 70);
}
engine.playerDims = playerDims;

function initDecor() {
  world.stripes = [];
  const gap = 90;
  for (let y = -gap; y < view.H + gap; y += gap) world.stripes.push(y);
  world.props = [];
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 6; i++) {
      world.props.push({ side, y: Math.random() * view.H, s: 0.6 + Math.random() * 0.8, seed: Math.random() });
    }
  }
}

engine.reset = function reset() {
  view.layoutRoad();
  playerDims();
  const p = world.player;
  p.x = view.laneCenter(1);
  p.targetX = p.x;
  p.tilt = 0; p.slip = 0; p.invuln = 0;
  world.speed = D.BASE_SPEED;
  world.distance = 0; world.paceT = 0;
  world.runCoins = 0; world.nearMisses = 0;
  world.obstacles = []; world.coins = []; world.powerups = []; world.slicks = [];
  world.particles = []; world.floatTexts = [];
  world.rowTimer = 1.0;
  world.lastOpenLanes = [0, 1, 2];
  world.lastRowLen = 0;
  world.shakeT = 0;
  world.magnetT = 0; world.slowmoT = 0; world.shieldOn = false;
  world.announced = {}; world.newBestShown = false;
  world.envIndex = 0; world.envPrev = 0; world.envBlend = 1; world.envChallengeAnnounceT = -1;
  world.curveSeed = Math.random() * 1000;
  world.curveNow = 0; world.curveSlope = 0;
  world.wheelTimer = D.WHEEL_FIRST_AT_S;
  world.wheelResult = null; world.wheelEffect = null;
  ED.input.neutralGamma = ED.input.tiltX;
  initDecor();
};

/* ---------- Road curvature ----------
   Two summed sine waves in metres-of-distance give a smooth, never-repeating
   S-curve. Purely additive and continuous (no jumps), so it's safe to sample
   at any distance for both "now" (player row) and "ahead" (render lookahead)
   without ever affecting the lane-based collision system below. */
function curveShapeAt(distanceM) {
  const d = distanceM + world.curveSeed;
  const a = Math.sin((2 * Math.PI * d) / D.CURVE_PERIOD_A_M);
  const b = Math.sin((2 * Math.PI * d) / D.CURVE_PERIOD_B_M + 1.3);
  return a * 0.7 + b * 0.3; // roughly [-1, 1]
}

engine.envChallenge = () => D.ENVS[world.envIndex].challenge;

/* Curve offset (px) at a given lookahead distance ahead of the player's
   current position. metresAhead = 0 is "now" (the player's row). Amplitude
   is clamped to a fraction of the available roadside margin so the curve can
   never push the road itself off the edge of a narrow phone screen. */
engine.curveAt = function curveAt(metresAhead) {
  const maxAmp = Math.max(10, view.roadX * 0.82);
  const amp = Math.min(D.CURVE_BASE_AMP * engine.envChallenge().curveAmpMult, maxAmp);
  return curveShapeAt(world.distance + metresAhead) * amp;
};

/* The eased x position of a lane-changing car for its current progress.
   Used by both the per-frame update and the resize remap, so a rotation
   mid-change lands the car exactly where the new layout says it should be. */
function changerX(o) {
  const t = o.changeProg < 0.4 ? 0 : (o.changeProg - 0.4) / 0.6; // blink first, then move
  const ease = t * t * (3 - 2 * t);
  return view.laneCenter(o.fromLane) + (view.laneCenter(o.toLane) - view.laneCenter(o.fromLane)) * ease;
}

/* Remap every in-flight object onto new lane geometry after a resize/rotation. */
engine.remap = function remap(oldRoadX, oldRoadW) {
  if (!oldRoadW) return;
  const ratio = x => view.roadX + ((x - oldRoadX) / oldRoadW) * view.roadW;
  const p = world.player;
  playerDims();
  p.x = ratio(p.x);
  p.targetX = ratio(p.targetX);
  for (const o of world.obstacles) {
    o.w = view.laneW * (o.type === 'truck' ? 0.68 : 0.62);
    o.h = o.w * (o.type === 'truck' ? 3.1 : 1.85);
    o.x = (o.toLane !== undefined && o.changeProg >= 0 && o.changeProg < 1)
      ? changerX(o)
      : view.laneCenter(o.lane);
  }
  for (const c of world.coins) { c.x = view.laneCenter(c.lane); c.r = Math.min(view.laneW * 0.16, 15); }
  for (const pu of world.powerups) { pu.x = view.laneCenter(pu.lane); pu.r = Math.min(view.laneW * 0.2, 19); }
  for (const s of world.slicks) { s.x = view.laneCenter(s.lane); s.r = view.laneW * 0.34; }
  // Lane dashes are seeded for a specific viewport height; re-seed so a taller
  // viewport doesn't scroll a permanent dash-free band.
  world.stripes = [];
  for (let y = -90; y < view.H + 90; y += 90) world.stripes.push(y);
};

/* ---------- Traffic pattern generator ----------
   Traffic arrives in "rows". Every row keeps >=1 lane open, and that open lane
   is always reachable (same or adjacent) from the previous row's open lanes,
   so a survivable path always exists. Row cadence is time-based (~1s of
   reaction at any speed) so spawn distance grows automatically with speed. */
function pickRowLanes(nBlocks) {
  for (let tries = 0; tries < 24; tries++) {
    const blocked = [];
    while (blocked.length < nBlocks) {
      const l = Math.floor(Math.random() * D.LANES);
      if (!blocked.includes(l)) blocked.push(l);
    }
    const open = [0, 1, 2].filter(l => !blocked.includes(l));
    const reachable = open.some(o => world.lastOpenLanes.some(pl => Math.abs(o - pl) <= 1));
    if (reachable) return { blocked, open };
  }
  return { blocked: [1], open: [0, 2] }; // safe fallback
}

function hazardsUnlocked() {
  return {
    trucks: world.distance >= 300,
    changers: world.distance >= 600,
    oil: world.distance >= 1000,
    doubles: world.distance >= 400,
  };
}

function announce(key, text) {
  if (world.announced[key]) return;
  world.announced[key] = true;
  world.floatTexts.push({ text, t: 0, dur: 2.2, color: '#ffd166', big: true });
  ED.ui.announce(text); // mirror one-shot hazard intros to assistive tech
}

function spawnRow() {
  const hz = hazardsUnlocked();
  const rowVy = world.speed * (0.34 + Math.random() * 0.02); // one speed per row -> rows never merge into walls

  // Occasionally an oil-slick row instead of traffic (skims under you, causes a skid)
  if (hz.oil && Math.random() < 0.13) {
    const lane = Math.floor(Math.random() * D.LANES);
    world.slicks.push({ lane, x: view.laneCenter(lane), y: -80, r: view.laneW * 0.34, kind: 'oil' });
    announce('oil', 'OIL SLICKS AHEAD');
    world.lastOpenLanes = [0, 1, 2];
    world.lastRowLen = 0;
    return;
  }

  const doubleChance = Math.min(0.55, 0.2 + world.distance / 6000);
  const nBlocks = hz.doubles && Math.random() < doubleChance ? 2 : 1;
  const { blocked, open } = pickRowLanes(nBlocks);
  world.lastOpenLanes = open;
  world.lastRowLen = 0;

  // Snowfield-only black ice: layered into an open lane alongside normal
  // traffic (never replaces the row), same skid behaviour as an oil slick.
  const envCh = engine.envChallenge();
  if (envCh.iceChance > 0 && Math.random() < envCh.iceChance) {
    const iceLane = open[Math.floor(Math.random() * open.length)];
    world.slicks.push({ lane: iceLane, x: view.laneCenter(iceLane), y: -140, r: view.laneW * 0.34, kind: 'ice' });
  }

  for (const lane of blocked) {
    const isTruck = hz.trucks && Math.random() < 0.22;
    const isChanger = !isTruck && hz.changers && nBlocks === 1 && Math.random() < 0.22;
    const w = view.laneW * (isTruck ? 0.68 : 0.62);
    const h = w * (isTruck ? 3.1 : 1.85);
    const o = {
      lane, x: view.laneCenter(lane), y: -h - 24, w, h,
      vy: rowVy,
      color: isTruck ? '#7d8597' : D.TRAFFIC_COLORS[Math.floor(Math.random() * D.TRAFFIC_COLORS.length)],
      type: isTruck ? 'truck' : 'car',
      passed: false,
    };
    if (isChanger) {
      const targets = open.filter(l => Math.abs(l - lane) === 1);
      if (targets.length) {
        o.toLane = targets[Math.floor(Math.random() * targets.length)];
        o.fromLane = lane;
        // Stored as a FRACTION of screen height so rotation/resize can never
        // leave a stale pixel threshold that fires beside the player.
        o.changeFrac = 0.12 + Math.random() * 0.15;
        o.changeProg = -1; // -1 = not started, 0..1 = lerping
        announce('changer', 'TRAFFIC CHANGES LANES');
      }
    }
    if (isTruck) announce('truck', 'TRUCKS ON THE ROAD');
    world.lastRowLen = Math.max(world.lastRowLen, h);
    world.obstacles.push(o);
  }

  // Coins ride WITH the row, placed in an open lane - collecting them is a
  // deliberate routing choice, never an accidental death trap.
  if (Math.random() < 0.55) {
    const lane = open[Math.floor(Math.random() * open.length)];
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      world.coins.push({ lane, x: view.laneCenter(lane), y: -40 - i * 64, r: Math.min(view.laneW * 0.16, 15), spin: Math.random() * Math.PI, vy: rowVy });
    }
  }

  // Occasional power-up in an open lane
  if (Math.random() < 0.11) {
    const lane = open[Math.floor(Math.random() * open.length)];
    const kinds = ['shield', 'magnet', 'slowmo'];
    world.powerups.push({ lane, x: view.laneCenter(lane), y: -140, r: Math.min(view.laneW * 0.2, 19), kind: kinds[Math.floor(Math.random() * kinds.length)], vy: rowVy, pulse: 0 });
  }
}

function addParticles(x, y, color, n, force) {
  if (!ED.save.settings.motion) n = Math.ceil(n / 4);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (0.3 + Math.random() * 0.7) * (force || 200);
    world.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.5, maxLife: 0.9, color, size: 2 + Math.random() * 4 });
  }
}

/* ---------- Spin-the-wheel challenges ---------- */
engine.pickWheelChallenge = function pickWheelChallenge(forceId) {
  const list = D.WHEEL_CHALLENGES;
  if (forceId) return list.find(c => c.id === forceId) || list[0];
  const total = list.reduce((sum, c) => sum + c.weight, 0);
  let r = Math.random() * total;
  for (const c of list) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return list[list.length - 1];
};

function spawnCoinStorm() {
  for (let row = 0; row < 4; row++) {
    for (let lane = 0; lane < D.LANES; lane++) {
      world.coins.push({
        lane, x: view.laneCenter(lane), y: -80 - row * 70,
        r: Math.min(view.laneW * 0.16, 15), spin: Math.random() * Math.PI, vy: world.speed * 0.35,
      });
    }
  }
}

/* Applies the chosen challenge's effect. Timed effects (coinrush/speedsurge/
   ghost/fog) are tracked as a single world.wheelEffect - only one can be
   active at a time, which is fine since the wheel itself won't retrigger
   until the previous run of gameplay resumes. Instant effects (magnet reuses
   the existing power-up timer, shield/coinstorm) apply immediately. */
engine.applyWheelChallenge = function applyWheelChallenge(challenge) {
  switch (challenge.id) {
    case 'coinrush':
    case 'speedsurge':
    case 'ghost':
    case 'fog':
      world.wheelEffect = { id: challenge.id, timer: challenge.durSec };
      break;
    case 'magnet':
      world.magnetT = Math.max(world.magnetT, challenge.durSec);
      break;
    case 'shield':
      world.shieldOn = true;
      break;
    case 'coinstorm':
      spawnCoinStorm();
      break;
  }
};

/* Runs during PLAYING *and* CRASHING so crash particles/shake always animate. */
engine.updateEffects = function updateEffects(dt) {
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const p = world.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt + world.speed * engine.timeScale() * dt * 0.5;
    p.life -= dt;
    if (p.life <= 0) world.particles.splice(i, 1);
  }
  for (let i = world.floatTexts.length - 1; i >= 0; i--) {
    world.floatTexts[i].t += dt;
    if (world.floatTexts[i].t > world.floatTexts[i].dur) world.floatTexts.splice(i, 1);
  }
  if (world.shakeT > 0) world.shakeT -= dt;
  if (world.envBlend < 1) world.envBlend = Math.min(1, world.envBlend + dt / 1.6);
};

engine.update = function update(dt) {
  const input = ED.input;
  const car = ED.carById(ED.save.selected);
  const ts = engine.timeScale();
  const p = world.player;
  world.paceT += dt;

  // Spin-the-wheel challenge: fires on its own timer, independent of
  // distance, so it can't stack unfairly with a hazard milestone. Bails out
  // of the rest of this frame's simulation - the world stays frozen while
  // the wheel overlay is up (same pattern as pause/countdown).
  world.wheelTimer -= dt;
  if (world.wheelTimer <= 0) { ED.ui.triggerWheel(); return; }
  if (world.wheelEffect) {
    world.wheelEffect.timer -= dt;
    if (world.wheelEffect.timer <= 0) world.wheelEffect = null;
  }
  const wheelId = world.wheelEffect && world.wheelEffect.id;

  // Speed: clean curve toward a real cap, scaled by the selected car's own
  // top speed and acceleration. This underlying ramp stays smooth and
  // monotonic at all times (including through a Speed Surge) so nothing
  // whiplashes when a timed effect starts or ends - only the *effective*
  // scroll speed (eff) gets a temporary multiplier, mirroring how slow-mo
  // already works via timeScale(). All cars share the same starting speed,
  // so the traffic fairness math (speed-relative, not constant-tied) still
  // holds regardless of which car is driven or whether a surge is active.
  world.speed = Math.min(D.SPEED_CAP * car.topSpeed, D.BASE_SPEED + world.paceT * D.SPEED_RATE * car.accel);
  const eff = world.speed * ts * engine.speedMult(); // effective world speed this frame
  world.distance += (eff * dt) / D.PX_PER_M;

  // Road curvature: smooth, continuous, environment-flavoured (Pine Hills
  // winds tighter). Sampled fresh each frame from world.distance, so it
  // never needs remapping on resize the way stored entity positions do.
  world.curveNow = engine.curveAt(0);
  const rawSlope = engine.curveAt(1) - world.curveNow; // px per metre-ahead
  const normSlope = clamp(rawSlope / 3, -1, 1);
  world.curveSlope = normSlope;

  // Environment changes every ENV_EVERY_M metres
  const wantEnv = Math.floor(world.distance / D.ENV_EVERY_M) % D.ENVS.length;
  if (wantEnv !== world.envIndex) {
    world.envPrev = world.envIndex;
    world.envIndex = wantEnv;
    world.envBlend = 0;
    world.floatTexts.push({ text: D.ENVS[world.envIndex].name, t: 0, dur: 2.4, color: '#8ecae6', big: true });
    world.envChallengeAnnounceT = 1.1; // stagger the challenge sub-text behind the env name
  }
  if (world.envChallengeAnnounceT > 0) {
    world.envChallengeAnnounceT -= dt;
    if (world.envChallengeAnnounceT <= 0) {
      world.floatTexts.push({ text: engine.envChallenge().label, t: 0, dur: 2.2, color: '#ffd166' });
      ED.ui.announce(engine.envChallenge().label);
    }
  }

  // Distance milestones
  const km = Math.floor(world.distance / 1000);
  if (km > 0 && !world.announced['km' + km]) {
    world.announced['km' + km] = true;
    world.floatTexts.push({ text: km + ' KM!', t: 0, dur: 1.8, color: '#06ffa5', big: true });
    ED.audio.vibrate(20);
    ED.ui.announce(km + ' kilometres');
  }
  if (!world.newBestShown && ED.save.bestScore > 0 && engine.score() > ED.save.bestScore) {
    world.newBestShown = true;
    world.floatTexts.push({ text: 'NEW BEST', t: 0, dur: 2.2, color: '#ffd166', big: true });
    ED.audio.vibrate([20, 30, 20]);
    ED.ui.announce('New best score');
  }

  // Steering
  const steerMult = car.steer;
  const gripMult = engine.envChallenge().gripMult; // e.g. Snowfield ice
  if (!input.touching) {
    if (input.keys.ArrowLeft || input.keys.a || input.keys.A)  p.targetX -= 560 * steerMult * dt;
    if (input.keys.ArrowRight || input.keys.d || input.keys.D) p.targetX += 560 * steerMult * dt;
    if (ED.save.settings.tilt && input.tiltX !== null && input.neutralGamma !== null) {
      const delta = input.tiltX - input.neutralGamma;
      const dead = 2.5;
      if (Math.abs(delta) > dead) p.targetX += (delta - Math.sign(delta) * dead) * 58 * steerMult * dt;
    }
  }
  // A winding road pulls gently at the wheel like real cornering force -
  // small, bounded, and easier to resist with better handling.
  p.targetX += normSlope * D.CURVE_DRIFT * dt / steerMult;
  const minX = view.roadX + p.w / 2 + 6;
  const maxX = view.roadX + view.roadW - p.w / 2 - 6;
  p.targetX = clamp(p.targetX, minX, maxX);
  const prevX = p.x;
  const grip = (p.slip > 0 ? 3.5 : 14 * steerMult) * gripMult;
  let tx = p.targetX;
  if (p.slip > 0) {
    tx += Math.sin(world.paceT * 22) * view.laneW * 0.16; // skid wobble
    p.slip -= dt;
  }
  p.x += (tx - p.x) * Math.min(1, grip * dt);
  p.x = clamp(p.x, minX, maxX);
  // Banking: steering-input tilt plus a softer lean into the curve ahead,
  // giving cars a more realistic weighted, cornering feel.
  p.tilt = clamp((p.x - prevX) * 0.045 + normSlope * 0.13, -0.34, 0.34);
  if (p.invuln > 0) p.invuln -= dt;

  // Timed power-ups
  if (world.magnetT > 0) world.magnetT -= dt;
  if (world.slowmoT > 0) world.slowmoT -= dt;

  // Decor scroll
  const gap = 90;
  for (let i = 0; i < world.stripes.length; i++) {
    world.stripes[i] += eff * dt;
    if (world.stripes[i] > view.H + gap) world.stripes[i] -= Math.ceil((view.H + 2 * gap) / gap) * gap;
  }
  for (const s of world.props) {
    s.y += eff * dt * 0.85;
    if (s.y > view.H + 80) { s.y = -80 - Math.random() * 120; s.s = 0.6 + Math.random() * 0.8; s.seed = Math.random(); }
  }

  // Row cadence: constant reaction time regardless of speed, with a floor that
  // guarantees on-screen spacing > one "interaction zone" (player + previous
  // row's longest vehicle + margin) so two rows can never flank the player.
  // Ticks on world time (ts) so slow-mo can't bunch rows into unfair walls.
  world.rowTimer -= dt * ts;
  if (world.rowTimer <= 0) {
    spawnRow();
    const approach = world.speed * 0.65; // px/s the traffic closes on the player
    // spacingFloor is the hard safety guarantee (untouched by any density
    // modifier); cadenceMult (e.g. Midnight City rush hour) only tightens
    // the "soft" difficulty terms, so an environment can never make the
    // game unfair - only busier when there was slack to spare.
    const spacingFloor = (p.h + Math.max(world.lastRowLen, p.h) + 160) / approach;
    const cadenceMult = engine.envChallenge().cadenceMult;
    const cadence = Math.max(0.72 * cadenceMult, (1.05 - world.distance / 12000) * cadenceMult, spacingFloor);
    world.rowTimer = cadence * (0.9 + Math.random() * 0.35);
  }

  // Obstacles: move, lane changes, swept collision, near-miss
  const px = p.x, py = p.y + p.h / 2;
  const pw = p.w * 0.82, ph = p.h * 0.9;
  for (let i = world.obstacles.length - 1; i >= 0; i--) {
    const o = world.obstacles[i];
    const dy = (eff - o.vy * ts) * dt;

    // Lane-change behaviour: blink, then drift to the target lane
    if (o.toLane !== undefined) {
      if (o.changeProg < 0 && o.y > view.H * o.changeFrac) o.changeProg = 0;
      if (o.changeProg >= 0 && o.changeProg < 1) {
        o.changeProg = Math.min(1, o.changeProg + dt / 0.9);
        o.x = changerX(o);
        if (o.changeProg >= 1) o.lane = o.toLane;
      }
    }

    // Swept collision: sub-step the frame movement so high speed can't tunnel
    let hit = false;
    if (p.invuln <= 0 && wheelId !== 'ghost') {
      const steps = Math.max(1, Math.ceil(dy / 14));
      for (let s2 = 1; s2 <= steps; s2++) {
        const oy = o.y + (dy * s2) / steps + o.h / 2;
        if (Math.abs(o.x - px) < (pw + o.w * 0.82) / 2 && Math.abs(oy - py) < (ph + o.h * 0.9) / 2) { hit = true; break; }
      }
    }
    o.y += dy;

    if (hit) {
      if (world.shieldOn) {
        world.shieldOn = false;
        p.invuln = 1.4;
        addParticles(o.x, o.y + o.h / 2, o.color, 18, 260);
        addParticles(px, py, '#4facfe', 14, 220);
        world.floatTexts.push({ text: 'SHIELD SAVED YOU', t: 0, dur: 1.4, color: '#4facfe' });
        world.obstacles.splice(i, 1);
        ED.audio.sfx.shield();
        ED.audio.vibrate(40);
        continue;
      }
      engine.beginCrash(o);
      return;
    }

    if (o.y > view.H + o.h) { world.obstacles.splice(i, 1); continue; }

    if (!o.passed && o.y + o.h / 2 > py) {
      o.passed = true;
      if (Math.abs(o.x - px) < (pw + o.w) / 2 + view.laneW * 0.22) {
        world.nearMisses++;
        world.floatTexts.push({ text: 'NEAR MISS +10', t: 0, dur: 0.7, color: '#ffd166', atPlayer: true });
        ED.audio.sfx.near();
        ED.audio.vibrate(10);
      }
    }
  }

  // Oil slicks
  for (let i = world.slicks.length - 1; i >= 0; i--) {
    const s = world.slicks[i];
    s.y += eff * dt;
    if (s.y > view.H + 60) { world.slicks.splice(i, 1); continue; }
    if (p.slip <= 0 && !(car.oilProof && s.kind === 'oil') &&
        Math.abs(s.x - px) < s.r + pw * 0.4 && Math.abs(s.y - py) < s.r + ph * 0.4) {
      p.slip = 1.1;
      ED.audio.sfx.slip();
      ED.audio.vibrate(30);
      world.floatTexts.push({ text: 'SKID!', t: 0, dur: 0.8, color: '#ff7096', atPlayer: true });
    }
  }

  // Coins (magnet pulls them in)
  const pickupR = (world.magnetT > 0 ? 130 : 0) + car.magnet;
  for (let i = world.coins.length - 1; i >= 0; i--) {
    const c = world.coins[i];
    c.y += (eff - c.vy * ts) * dt;
    c.spin += dt * 6;
    if (c.y > view.H + 40) { world.coins.splice(i, 1); continue; }
    const dx = c.x - px, dyc = c.y - py;
    const d2 = dx * dx + dyc * dyc;
    if (pickupR > 0 && d2 < Math.pow(pickupR + pw / 2, 2)) {
      c.x -= dx * Math.min(1, 10 * dt);
      c.y -= dyc * Math.min(1, 10 * dt);
    }
    if (d2 < Math.pow(c.r + pw / 2, 2)) {
      world.coins.splice(i, 1);
      world.runCoins += wheelId === 'coinrush' ? 2 : 1;
      addParticles(c.x, c.y, '#ffd166', wheelId === 'coinrush' ? 14 : 8, 160);
      ED.audio.sfx.coin();
      ED.audio.vibrate(15);
    }
  }

  // Power-ups
  for (let i = world.powerups.length - 1; i >= 0; i--) {
    const pu = world.powerups[i];
    pu.y += (eff - pu.vy * ts) * dt;
    pu.pulse += dt * 5;
    if (pu.y > view.H + 40) { world.powerups.splice(i, 1); continue; }
    const dx = pu.x - px, dyp = pu.y - py;
    if (dx * dx + dyp * dyp < Math.pow(pu.r + pw / 2, 2)) {
      world.powerups.splice(i, 1);
      if (pu.kind === 'shield') { world.shieldOn = true; world.floatTexts.push({ text: 'SHIELD', t: 0, dur: 1.2, color: '#4facfe', atPlayer: true }); }
      if (pu.kind === 'magnet') { world.magnetT = 6; world.floatTexts.push({ text: 'COIN MAGNET', t: 0, dur: 1.2, color: '#ffd166', atPlayer: true }); }
      if (pu.kind === 'slowmo') { world.slowmoT = 4; world.floatTexts.push({ text: 'SLOW-MO', t: 0, dur: 1.2, color: '#b465ff', atPlayer: true }); }
      addParticles(pu.x, pu.y, '#ffffff', 12, 200);
      ED.audio.sfx.power();
      ED.audio.vibrate(25);
    }
  }

  engine.updateEffects(dt);

  // Engine pitch follows speed
  ED.audio.engineFreq(42 + (eff / D.PX_PER_M) * 3.6 * 1.1);

  ED.ui.updateHUD();
};

engine.beginCrash = function beginCrash(o) {
  const p = world.player;
  addParticles(p.x, p.y + p.h / 2, '#ff6b35', 30, 320);
  addParticles(p.x, p.y + p.h / 2, '#ffd166', 20, 260);
  if (o) addParticles(o.x, o.y + o.h / 2, o.color, 16, 240);
  if (ED.save.settings.motion) { world.shakeT = 0.5; world.shakeMag = 14; }
  ED.audio.sfx.crash();
  ED.audio.vibrate([60, 40, 80]);
  world.crashTimer = 0.9;
  ED.ui.setState(ED.STATE.CRASHING);
};

/* Crash effects keep animating; the world eases to a halt.
   Returns true once the sequence is over. */
engine.tickCrash = function tickCrash(dt) {
  world.speed = Math.max(0, world.speed - dt * 1800);
  engine.updateEffects(dt);
  world.crashTimer -= dt;
  return world.crashTimer <= 0;
};
})();
