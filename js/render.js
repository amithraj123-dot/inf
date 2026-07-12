/* Endless Drive - all canvas drawing. Reads ED.world / ED.view, never mutates game state. */
(() => {
'use strict';
const ED = window.ED;
const D = ED.data;
const shade = ED.util.shade;
const view = ED.view;
const world = ED.world;

const canvas = document.getElementById('game');
const mainCtx = canvas.getContext('2d');
// All drawing helpers below read the module-level `ctx`. It normally points
// at the main game canvas; drawCarIcon() swaps it to a garage preview canvas
// for the duration of one synchronous draw, then swaps it back - this never
// overlaps with the rAF render loop since both run on the same JS thread.
let ctx = mainCtx;

ED.render = { canvas, resizeCanvas, render, drawCarIcon, drawWheel };

function resizeCanvas() {
  view.DPR = Math.min(window.devicePixelRatio || 1, 2);
  view.W = window.innerWidth;
  view.H = window.innerHeight;
  canvas.width = view.W * view.DPR;
  canvas.height = view.H * view.DPR;
  canvas.style.width = view.W + 'px';
  canvas.style.height = view.H + 'px';
  mainCtx.setTransform(view.DPR, 0, 0, view.DPR, 0, 0);
  view.layoutRoad();
}

/* Renders a single static car (garage preview) into its own small canvas,
   using the exact same silhouette code the live game uses. */
function drawCarIcon(targetCanvas, car) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = targetCanvas.clientWidth || 44, ch = targetCanvas.clientHeight || 64;
  targetCanvas.width = cw * dpr;
  targetCanvas.height = ch * dpr;
  const prevCtx = ctx;
  ctx = targetCanvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const carW = cw * 0.62, carH = ch * 0.86;
  drawCar(cw / 2, (ch - carH) / 2, carW, carH, car.color, 0, true, null, car.shape);
  ctx = prevCtx;
}

/* Renders the spin-the-wheel challenge selector. rotationDeg is the current
   animated rotation (0 at rest, wound up by ui.js's ease-out spin); slice 0
   is centred at the top when rotationDeg is 0, matching the alignment math
   in ui.js's triggerWheel(). */
function drawWheel(targetCanvas, rotationDeg, challenges) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = targetCanvas.clientWidth || 260, chh = targetCanvas.clientHeight || 260;
  targetCanvas.width = cw * dpr;
  targetCanvas.height = chh * dpr;
  const prevCtx = ctx;
  ctx = targetCanvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, chh);

  const cx = cw / 2, cy = chh / 2, r = Math.min(cw, chh) / 2 - 4;
  const n = challenges.length;
  const segRad = (Math.PI * 2) / n;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0e1a';
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.rotate((rotationDeg * Math.PI) / 180);
  for (let i = 0; i < n; i++) {
    const startA = -Math.PI / 2 + i * segRad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r - 3, startA, startA + segRad);
    ctx.closePath();
    ctx.fillStyle = challenges[i].color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,14,26,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.rotate(startA + segRad / 2);
    ctx.translate(r * 0.6, 0);
    ctx.fillStyle = '#0a0e1a';
    ctx.font = 'bold ' + Math.max(9, Math.round(r * 0.095)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(challenges[i].label, 0, 0);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0e1a';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.stroke();
  ctx.restore();

  ctx = prevCtx;
}

/* Blend between the previous and current environment palette. */
function envColor(key) {
  const a = D.ENVS[world.envPrev][key], b = D.ENVS[world.envIndex][key];
  const t = Math.min(1, world.envBlend);
  return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' +
                  Math.round(a[1] + (b[1] - a[1]) * t) + ',' +
                  Math.round(a[2] + (b[2] - a[2]) * t) + ')';
}

/* ---------- Road curvature (rendering only) ----------
   Converts a screen depth (y) into a lateral offset that traces the curve
   engine.js is sampling ahead of the player. Zero at the player's own row
   (y = view.H, "now"), growing as y decreases toward the top of the screen
   ("ahead") - so everything drawn near the player sits exactly where the
   lane-based collision math expects it, while the road bends visibly into
   the distance. Every element (road, edges, dashes, scenery, traffic, coins,
   player) samples the SAME function, so the whole scene bends as one piece;
   nothing here ever touches stored entity x, so collision fairness is
   completely unaffected. */
const LOOKAHEAD_M_PER_PX = 0.085;
function curveOffsetForY(y) {
  const metresAhead = Math.max(0, view.H - y) * LOOKAHEAD_M_PER_PX;
  return ED.engine.curveAt(metresAhead) - world.curveNow;
}

/* Reduced-visibility challenges (Sunset Strip glare, the Fog Warning wheel
   effect) fade hazards in over their first `fadeDist` px of travel instead
   of snapping fully visible - the harder of the two active sources wins.
   Coins/power-ups are never faded (rewards, not threats). */
function hazardAlpha(y) {
  const envFade = ED.engine.envChallenge().fadeDist;
  const fogFade = (world.wheelEffect && world.wheelEffect.id === 'fog') ? 240 : 0;
  const fadeDist = Math.max(envFade, fogFade);
  if (fadeDist <= 0) return 1;
  return ED.util.clamp((y + fadeDist) / fadeDist, 0, 1);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- Vehicles ----------
   Strong silhouettes: wheels poking out, dark outline, glass, lights.
   Trucks read as cab + corrugated trailer with rear hazard stripes. */
function drawWheels(w, h, isTruck) {
  ctx.fillStyle = '#0b0d14';
  const ww = w * 0.14, wh = h * (isTruck ? 0.1 : 0.16);
  const xL = -w / 2 - ww * 0.45, xR = w / 2 - ww * 0.55;
  const rows = isTruck ? [0.12, 0.5, 0.62, 0.84] : [0.12, 0.68];
  for (const ry of rows) {
    roundRect(xL, h * ry, ww, wh, 2); ctx.fill();
    roundRect(xR, h * ry, ww, wh, 2); ctx.fill();
  }
}

/* ---------- Player car silhouettes ----------
   Each garage car has a shape id (data.js) that gives it a distinct real-world
   read: hatchback, coupe, sedan/cab, muscle car, supercar, hovercar. All are
   drawn inside the same collision-box footprint (w x h); only decoration and
   roofline vary, so gameplay geometry never changes with cosmetics. */
function drawShapeDecor(shape, w, h, color) {
  if (shape === 'coupe') {
    // lower, wider greenhouse + a small lip spoiler
    ctx.fillStyle = shade(color, -55);
    roundRect(-w * 0.4, h * 0.86, w * 0.8, h * 0.05, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(-w * 0.07, h * 0.02, w * 0.14, h * 0.1);
  } else if (shape === 'sedan') {
    // taxi checker band across the roof
    const bw = w * 0.68, bx = -bw / 2, by = h * 0.38, cell = bw / 6;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#0a0e1a' : '#f1f1f1';
      ctx.fillRect(bx + i * cell, by, cell, h * 0.06);
    }
    ctx.fillStyle = '#fff9c4';
    roundRect(-w * 0.1, h * 0.32, w * 0.2, h * 0.05, 2);
    ctx.fill();
  } else if (shape === 'muscle') {
    // hood scoop + wide dark rear haunches
    ctx.fillStyle = shade(color, -60);
    roundRect(-w * 0.14, h * 0.02, w * 0.28, h * 0.1, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(-w * 0.52, h * 0.62, w * 0.14, h * 0.3, 4);
    ctx.fill();
    roundRect(w * 0.38, h * 0.62, w * 0.14, h * 0.3, 4);
    ctx.fill();
  } else if (shape === 'super') {
    // wedge nose + rear wing on struts
    ctx.fillStyle = shade(color, -35);
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, h * 0.06);
    ctx.lineTo(w * 0.3, h * 0.06);
    ctx.lineTo(0, -h * 0.03);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(color, -50);
    ctx.fillRect(-w * 0.04, h * 0.9, w * 0.08, h * 0.08);
    ctx.fillRect(w * 0.3, h * 0.86, w * 0.08, h * 0.12);
    ctx.fillRect(-w * 0.38, h * 0.86, w * 0.08, h * 0.12);
    ctx.fillRect(-w * 0.38, h * 0.82, w * 0.76, h * 0.045);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillRect(-w * 0.42, h * 0.3, w * 0.06, h * 0.4);
    ctx.fillRect(w * 0.36, h * 0.3, w * 0.06, h * 0.4);
  } else if (shape === 'hover') {
    // translucent panel seams instead of a hood/trunk split
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, h * 0.32);
    ctx.lineTo(w * 0.4, h * 0.32);
    ctx.moveTo(-w * 0.4, h * 0.7);
    ctx.lineTo(w * 0.4, h * 0.7);
    ctx.stroke();
  }
}

function drawCar(x, y, w, h, color, tiltA, isPlayer, o, shape) {
  const isTruck = o && o.type === 'truck';
  const isHover = isPlayer && shape === 'hover';
  ctx.save();
  ctx.translate(x, y + h / 2);
  ctx.rotate(tiltA || 0);
  ctx.translate(0, -h / 2);

  // ground shadow (a soft glow disc for the hovercar instead of a hard shadow)
  if (isHover) {
    const glow = ctx.createRadialGradient(0, h * 0.55, 2, 0, h * 0.55, w * 0.6);
    glow.addColorStop(0, 'rgba(6,255,165,0.55)');
    glow.addColorStop(1, 'rgba(6,255,165,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.58, w * 0.6, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(-w / 2 + 3, 6, w, h, w * 0.24);
    ctx.fill();
  }

  if (!isHover) drawWheels(w, h, isTruck);

  // body with side shading + dark outline for silhouette clarity
  const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  grad.addColorStop(0, shade(color, -30));
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, shade(color, -30));
  ctx.fillStyle = grad;
  roundRect(-w / 2, 0, w, h, w * 0.24);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(5, 8, 16, 0.65)';
  ctx.stroke();

  if (isTruck) {
    // cab glass
    ctx.fillStyle = 'rgba(15, 25, 45, 0.85)';
    roundRect(-w * 0.34, h * 0.05, w * 0.68, h * 0.09, w * 0.1);
    ctx.fill();
    // trailer: darker box with corrugation lines
    ctx.fillStyle = shade(color, -45);
    roundRect(-w * 0.44, h * 0.2, w * 0.88, h * 0.76, w * 0.1);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    for (let ln = 1; ln < 5; ln++) {
      ctx.beginPath();
      ctx.moveTo(-w * 0.44, h * (0.2 + 0.152 * ln));
      ctx.lineTo(w * 0.44, h * (0.2 + 0.152 * ln));
      ctx.stroke();
    }
    // rear hazard stripes (red/white chevrons)
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#ff5252' : '#f1f1f1';
      ctx.fillRect(-w * 0.44 + (w * 0.88 / 4) * i, h * 0.93, w * 0.88 / 4, h * 0.04);
    }
  } else {
    // windshield + rear glass with a roof band between them
    ctx.fillStyle = 'rgba(15, 25, 45, 0.85)';
    roundRect(-w * 0.34, h * 0.16, w * 0.68, h * 0.2, w * 0.1);
    ctx.fill();
    roundRect(-w * 0.34, h * 0.66, w * 0.68, h * 0.16, w * 0.1);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(-w * 0.36, h * 0.4, w * 0.72, h * 0.22, w * 0.08);
    ctx.fill();
  }

  if (isPlayer) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-w * 0.07, h * 0.02, w * 0.14, h * 0.13);
    ctx.fillRect(-w * 0.07, h * 0.4, w * 0.14, h * 0.24);
    ctx.fillRect(-w * 0.07, h * 0.85, w * 0.14, h * 0.12);
    ctx.fillStyle = '#fff9c4';
    ctx.fillRect(-w * 0.36, 1, w * 0.18, 4);
    ctx.fillRect(w * 0.18, 1, w * 0.18, 4);
    if (shape) drawShapeDecor(shape, w, h, color);
  } else {
    ctx.fillStyle = '#ff5252';
    ctx.fillRect(-w * 0.36, h - 5, w * 0.18, 4);
    ctx.fillRect(w * 0.18, h - 5, w * 0.18, 4);
    // indicator blink while preparing/executing a lane change
    if (o && o.toLane !== undefined && o.changeProg >= 0 && o.changeProg < 1 && Math.floor(performance.now() / 160) % 2 === 0) {
      ctx.fillStyle = '#ffb703';
      const side = o.toLane > o.fromLane ? 1 : -1;
      ctx.fillRect(side * w * 0.38 - 4, h * 0.1, 8, 8);
      ctx.fillRect(side * w * 0.38 - 4, h * 0.82, 8, 8);
    }
  }
  ctx.restore();
}

/* ---------- Power-up icons: vector shapes, no font glyphs ---------- */
const PU_COLORS = { shield: '#4facfe', magnet: '#ffd166', slowmo: '#b465ff' };

function drawPowerupIcon(kind, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = PU_COLORS[kind];
  ctx.fillStyle = PU_COLORS[kind];
  ctx.lineWidth = Math.max(2, r * 0.18);
  const s = r * 0.62;
  if (kind === 'shield') {
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.85, -s * 0.45);
    ctx.lineTo(s * 0.7, s * 0.35);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.7, s * 0.35);
    ctx.lineTo(-s * 0.85, -s * 0.45);
    ctx.closePath();
    ctx.stroke();
  } else if (kind === 'magnet') {
    ctx.beginPath();
    ctx.arc(0, -s * 0.15, s * 0.75, Math.PI, 0, false);
    ctx.stroke();
    ctx.fillRect(-s * 0.75 - ctx.lineWidth / 2, -s * 0.15, ctx.lineWidth, s * 0.75);
    ctx.fillRect(s * 0.75 - ctx.lineWidth / 2, -s * 0.15, ctx.lineWidth, s * 0.75);
  } else { // slowmo: clock
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -s * 0.55);
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 0.4, s * 0.15);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- Roadside scenery ---------- */
function drawProp(s) {
  const x = (s.side === 0 ? view.roadX * 0.5 : view.roadX + view.roadW + (view.W - view.roadX - view.roadW) * 0.5) + curveOffsetForY(s.y);
  const env = D.ENVS[world.envIndex];
  const col = envColor('propCol');
  const r = 22 * s.s;
  if (env.prop === 'building') {
    const bw = r * 2, bh = r * 3.2;
    ctx.fillStyle = col;
    ctx.fillRect(x - bw / 2, s.y - bh / 2, bw, bh);
    ctx.fillStyle = 'rgba(0,229,255,0.5)';
    for (let wy = 0; wy < 4; wy++) for (let wx = 0; wx < 2; wx++) {
      if ((s.seed * 37 + wy * 2 + wx) % 3 < 1.6) ctx.fillRect(x - bw / 2 + 4 + wx * (bw / 2), s.y - bh / 2 + 5 + wy * (bh / 4.4), bw / 4, bh / 9);
    }
  } else if (env.prop === 'palm') {
    ctx.strokeStyle = col;
    ctx.lineWidth = 4 * s.s;
    ctx.beginPath();
    ctx.moveTo(x, s.y + r);
    ctx.quadraticCurveTo(x + 5, s.y, x, s.y - r);
    ctx.stroke();
    ctx.lineWidth = 3 * s.s;
    for (let f = 0; f < 5; f++) {
      const a = (f / 4) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(x, s.y - r);
      ctx.quadraticCurveTo(x + Math.cos(a) * r, s.y - r - 6, x + Math.cos(a) * r * 1.3, s.y - r + Math.sin(a) * r * 0.5);
      ctx.stroke();
    }
  } else { // tree / snowtree
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(x - 3, s.y, 6, r * 0.9);
    ctx.beginPath();
    ctx.arc(x, s.y - r * 0.2, r, 0, Math.PI * 2);
    ctx.arc(x - r * 0.5, s.y + r * 0.25, r * 0.7, 0, Math.PI * 2);
    ctx.arc(x + r * 0.5, s.y + r * 0.25, r * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    if (env.prop === 'snowtree') {
      ctx.beginPath();
      ctx.arc(x, s.y - r * 0.55, r * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();
    }
  }
}

/* ---------- Frame ---------- */
function render() {
  const STATE = ED.STATE;
  const state = ED.engine.state;
  const motion = ED.save.settings.motion;
  const p = world.player;

  ctx.save();
  if (world.shakeT > 0 && motion) {
    const m = world.shakeMag * (world.shakeT / 0.5);
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }

  // background
  const bg = ctx.createLinearGradient(0, 0, 0, view.H);
  bg.addColorStop(0, envColor('skyT'));
  bg.addColorStop(1, envColor('skyB'));
  ctx.fillStyle = bg;
  ctx.fillRect(-20, -20, view.W + 40, view.H + 40);

  ctx.fillStyle = envColor('ground');
  ctx.fillRect(-20, -20, view.roadX + 20, view.H + 40);
  ctx.fillRect(view.roadX + view.roadW, -20, view.W - view.roadX - view.roadW + 20, view.H + 40);

  for (const s of world.props) drawProp(s);

  // Road body + edges: drawn as a bent path so the turn ahead is genuinely
  // visible, not just implied. Sampled once per frame and reused for the
  // fill and both edge strokes.
  const roadYs = [];
  for (let y = -20; y < view.H + 20; y += 26) roadYs.push(y);
  roadYs.push(view.H + 20);
  const roadOff = roadYs.map(curveOffsetForY);

  ctx.fillStyle = envColor('road');
  ctx.beginPath();
  for (let i = 0; i < roadYs.length; i++) {
    const lx = view.roadX + roadOff[i];
    if (i === 0) ctx.moveTo(lx, roadYs[i]); else ctx.lineTo(lx, roadYs[i]);
  }
  for (let i = roadYs.length - 1; i >= 0; i--) {
    ctx.lineTo(view.roadX + view.roadW + roadOff[i], roadYs[i]);
  }
  ctx.closePath();
  ctx.fill();

  const edge = envColor('edge');
  ctx.save();
  ctx.shadowColor = edge;
  ctx.shadowBlur = motion ? 12 : 0;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < roadYs.length; i++) {
    const lx = view.roadX + roadOff[i];
    if (i === 0) ctx.moveTo(lx, roadYs[i]); else ctx.lineTo(lx, roadYs[i]);
  }
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < roadYs.length; i++) {
    const rx = view.roadX + view.roadW + roadOff[i];
    if (i === 0) ctx.moveTo(rx, roadYs[i]); else ctx.lineTo(rx, roadYs[i]);
  }
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = envColor('dash');
  const dashH = 42;
  for (let l = 1; l < D.LANES; l++) {
    for (const sy of world.stripes) {
      const lx = view.roadX + view.laneW * l - 3 + curveOffsetForY(sy);
      ctx.fillRect(lx, sy, 6, dashH);
    }
  }

  // oil/ice slicks: dark puddle (or pale icy patch) with a dashed warning
  // ring. Environment/wheel visibility challenges (glare, fog) fade hazards
  // in as they approach, shortening the reaction window.
  for (const s of world.slicks) {
    const dx = curveOffsetForY(s.y);
    const isIce = s.kind === 'ice';
    ctx.save();
    ctx.globalAlpha = hazardAlpha(s.y);
    ctx.translate(s.x + dx, s.y);
    ctx.scale(1.25, 0.8);
    ctx.beginPath();
    ctx.arc(0, 0, s.r, 0, Math.PI * 2);
    ctx.fillStyle = isIce ? 'rgba(200, 230, 255, 0.6)' : 'rgba(10, 12, 20, 0.85)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-s.r * 0.25, -s.r * 0.2, s.r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = isIce ? 'rgba(255, 255, 255, 0.6)' : 'rgba(120, 140, 200, 0.25)';
    ctx.fill();
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = isIce ? 'rgba(150, 210, 255, 0.75)' : 'rgba(255, 183, 3, 0.55)';
    ctx.beginPath();
    ctx.arc(0, 0, s.r + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // coins
  for (const c of world.coins) {
    const dx = curveOffsetForY(c.y);
    const squeeze = Math.abs(Math.cos(c.spin));
    ctx.save();
    ctx.translate(c.x + dx, c.y);
    ctx.scale(squeeze, 1);
    ctx.beginPath();
    ctx.arc(0, 0, c.r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd166';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#e09f3e';
    ctx.stroke();
    ctx.fillStyle = '#e09f3e';
    ctx.font = 'bold ' + (c.r * 1.1) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 1);
    ctx.restore();
  }

  // power-ups
  for (const pu of world.powerups) {
    const dx = curveOffsetForY(pu.y);
    const pr = pu.r + Math.sin(pu.pulse) * 2;
    ctx.save();
    ctx.shadowColor = PU_COLORS[pu.kind];
    ctx.shadowBlur = motion ? 14 : 0;
    ctx.beginPath();
    ctx.arc(pu.x + dx, pu.y, pr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,14,26,0.9)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = PU_COLORS[pu.kind];
    ctx.stroke();
    ctx.shadowBlur = 0;
    drawPowerupIcon(pu.kind, pu.x + dx, pu.y, pr);
    ctx.restore();
  }

  // traffic - Ghost Traffic (wheel effect) reads as translucent, matching
  // that it can't touch you while active
  const ghostActive = world.wheelEffect && world.wheelEffect.id === 'ghost';
  for (const o of world.obstacles) {
    const dx = curveOffsetForY(o.y);
    ctx.globalAlpha = hazardAlpha(o.y) * (ghostActive ? 0.4 : 1);
    drawCar(o.x + dx, o.y, o.w, o.h, o.color, 0, false, o);
  }
  ctx.globalAlpha = 1;

  // player
  const hiddenStates = state === STATE.MENU || state === STATE.GARAGE || state === STATE.SETTINGS;
  if (!hiddenStates) {
    const car = ED.carById(ED.save.selected);
    const pdx = curveOffsetForY(p.y);
    const blink = p.invuln > 0 && Math.floor(performance.now() / 120) % 2 === 0;
    if (!blink) {
      if (world.shieldOn) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x + pdx, p.y + p.h / 2, p.h * 0.72, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(79, 172, 254, 0.7)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.stroke();
        ctx.restore();
      }
      drawCar(p.x + pdx, p.y, p.w, p.h, car.color, p.tilt, true, null, car.shape);
    }
    if (world.magnetT > 0) {
      ctx.beginPath();
      ctx.arc(p.x + pdx, p.y + p.h / 2, 130, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // particles
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;

  // floating announcements
  for (const f of world.floatTexts) {
    const prog = f.t / f.dur;
    ctx.globalAlpha = prog < 0.15 ? prog / 0.15 : 1 - Math.max(0, (prog - 0.6) / 0.4);
    ctx.fillStyle = f.color;
    ctx.textAlign = 'center';
    if (f.atPlayer) {
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(f.text, p.x, p.y - 16 - prog * 24);
    } else {
      ctx.font = '800 ' + (f.big ? 30 : 22) + 'px sans-serif';
      ctx.fillText(f.text, view.W / 2, view.H * 0.3 - prog * 20);
    }
  }
  ctx.globalAlpha = 1;

  // speed lines
  if (world.speed > 700 && (state === STATE.PLAYING || state === STATE.CRASHING) && motion) {
    const intensity = Math.min(1, (world.speed - 700) / 500);
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.12 * intensity) + ')';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const lx = (i * 97 + (performance.now() * 0.7 * (1 + i * 0.13)) % (view.H + 120)) % view.W;
      const ly = ((performance.now() * (0.9 + i * 0.11)) % (view.H + 120)) - 60;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx, ly + 50 + intensity * 60);
      ctx.stroke();
    }
  }

  // slow-mo vignette
  if (world.slowmoT > 0) {
    ctx.fillStyle = 'rgba(180, 101, 255, 0.07)';
    ctx.fillRect(0, 0, view.W, view.H);
  }

  // active wheel-challenge ambience: a soft edge glow in the challenge's
  // color for constant peripheral feedback, plus a physical haze band while
  // Fog Warning specifically is active.
  if (world.wheelEffect) {
    const activeChallenge = D.WHEEL_CHALLENGES.find(c => c.id === world.wheelEffect.id);
    if (activeChallenge) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      const vg = ctx.createRadialGradient(
        view.W / 2, view.H / 2, Math.min(view.W, view.H) * 0.35,
        view.W / 2, view.H / 2, Math.max(view.W, view.H) * 0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, activeChallenge.color);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, view.W, view.H);
      ctx.restore();
    }
    if (world.wheelEffect.id === 'fog') {
      ctx.fillStyle = 'rgba(180, 190, 210, 0.16)';
      ctx.fillRect(0, 0, view.W, view.H * 0.42);
    }
  }

  ctx.restore();
}
})();
