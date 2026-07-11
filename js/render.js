/* Endless Drive - all canvas drawing. Reads ED.world / ED.view, never mutates game state. */
(() => {
'use strict';
const ED = window.ED;
const D = ED.data;
const shade = ED.util.shade;
const view = ED.view;
const world = ED.world;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

ED.render = { canvas, resizeCanvas, render };

function resizeCanvas() {
  view.DPR = Math.min(window.devicePixelRatio || 1, 2);
  view.W = window.innerWidth;
  view.H = window.innerHeight;
  canvas.width = view.W * view.DPR;
  canvas.height = view.H * view.DPR;
  canvas.style.width = view.W + 'px';
  canvas.style.height = view.H + 'px';
  ctx.setTransform(view.DPR, 0, 0, view.DPR, 0, 0);
  view.layoutRoad();
}

/* Blend between the previous and current environment palette. */
function envColor(key) {
  const a = D.ENVS[world.envPrev][key], b = D.ENVS[world.envIndex][key];
  const t = Math.min(1, world.envBlend);
  return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' +
                  Math.round(a[1] + (b[1] - a[1]) * t) + ',' +
                  Math.round(a[2] + (b[2] - a[2]) * t) + ')';
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

function drawCar(x, y, w, h, color, tiltA, isPlayer, o) {
  const isTruck = o && o.type === 'truck';
  ctx.save();
  ctx.translate(x, y + h / 2);
  ctx.rotate(tiltA || 0);
  ctx.translate(0, -h / 2);

  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(-w / 2 + 3, 6, w, h, w * 0.24);
  ctx.fill();

  drawWheels(w, h, isTruck);

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
  const x = s.side === 0 ? view.roadX * 0.5 : view.roadX + view.roadW + (view.W - view.roadX - view.roadW) * 0.5;
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

  // road with glowing neon edges
  ctx.fillStyle = envColor('road');
  ctx.fillRect(view.roadX, -20, view.roadW, view.H + 40);
  const edge = envColor('edge');
  ctx.save();
  ctx.shadowColor = edge;
  ctx.shadowBlur = motion ? 12 : 0;
  ctx.fillStyle = edge;
  ctx.fillRect(view.roadX, -20, 4, view.H + 40);
  ctx.fillRect(view.roadX + view.roadW - 4, -20, 4, view.H + 40);
  ctx.restore();

  ctx.fillStyle = envColor('dash');
  const dashH = 42;
  for (let l = 1; l < D.LANES; l++) {
    const lx = view.roadX + view.laneW * l - 3;
    for (const sy of world.stripes) ctx.fillRect(lx, sy, 6, dashH);
  }

  // oil slicks: dark puddle with an amber dashed warning ring
  for (const s of world.slicks) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(1.25, 0.8);
    ctx.beginPath();
    ctx.arc(0, 0, s.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 12, 20, 0.85)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-s.r * 0.25, -s.r * 0.2, s.r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120, 140, 200, 0.25)';
    ctx.fill();
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 183, 3, 0.55)';
    ctx.beginPath();
    ctx.arc(0, 0, s.r + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // coins
  for (const c of world.coins) {
    const squeeze = Math.abs(Math.cos(c.spin));
    ctx.save();
    ctx.translate(c.x, c.y);
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
    const pr = pu.r + Math.sin(pu.pulse) * 2;
    ctx.save();
    ctx.shadowColor = PU_COLORS[pu.kind];
    ctx.shadowBlur = motion ? 14 : 0;
    ctx.beginPath();
    ctx.arc(pu.x, pu.y, pr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,14,26,0.9)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = PU_COLORS[pu.kind];
    ctx.stroke();
    ctx.shadowBlur = 0;
    drawPowerupIcon(pu.kind, pu.x, pu.y, pr);
    ctx.restore();
  }

  // traffic
  for (const o of world.obstacles) drawCar(o.x, o.y, o.w, o.h, o.color, 0, false, o);

  // player
  const hiddenStates = state === STATE.MENU || state === STATE.GARAGE || state === STATE.SETTINGS;
  if (!hiddenStates) {
    const car = ED.carById(ED.save.selected);
    const blink = p.invuln > 0 && Math.floor(performance.now() / 120) % 2 === 0;
    if (!blink) {
      if (world.shieldOn) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y + p.h / 2, p.h * 0.72, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(79, 172, 254, 0.7)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.stroke();
        ctx.restore();
      }
      drawCar(p.x, p.y, p.w, p.h, car.color, p.tilt, true, null);
    }
    if (world.magnetT > 0) {
      ctx.beginPath();
      ctx.arc(p.x, p.y + p.h / 2, 130, 0, Math.PI * 2);
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

  ctx.restore();
}
})();
