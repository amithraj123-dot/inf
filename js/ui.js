/* Endless Drive - DOM overlays, input wiring, state machine, main loop, a11y. */
(() => {
'use strict';
const ED = window.ED;
const D = ED.data;
const STATE = ED.STATE;
const view = ED.view;
const world = ED.world;
const engine = ED.engine;
const $ = id => document.getElementById(id);

const menuOverlay = $('menuOverlay'), gameOverOverlay = $('gameOverOverlay'),
      pauseOverlay = $('pauseOverlay'), garageOverlay = $('garageOverlay'),
      settingsOverlay = $('settingsOverlay'),
      hud = $('hud'), pauseBtn = $('pauseBtn'), countdownEl = $('countdown'),
      distVal = $('distVal'), coinVal = $('coinVal'), speedVal = $('speedVal'),
      srStatus = $('srStatus');

const ALL_OVERLAYS = [menuOverlay, gameOverOverlay, pauseOverlay, garageOverlay, settingsOverlay];
let staticDrawn = false;

/* ---------- Accessibility: live announcements ---------- */
let announceTimer = 0;
function announce(text) {
  // Clear-then-set (via timeout, which also fires in hidden tabs, unlike rAF)
  // so repeated identical messages are still announced.
  srStatus.textContent = '';
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => { srStatus.textContent = text; }, 30);
}
const STATE_ANNOUNCEMENTS = {
  [STATE.MENU]: 'Main menu',
  [STATE.COUNTDOWN]: 'Get ready',
  [STATE.PLAYING]: 'Driving',
  [STATE.CRASHING]: 'Crashed',
  [STATE.PAUSED]: 'Paused',
  [STATE.GARAGE]: 'Garage',
  [STATE.SETTINGS]: 'Settings',
};

const ui = ED.ui = {
  announce,
  setState(s) {
    engine.state = s;
    staticDrawn = false;
    ED.audio.engineSync(s === STATE.PLAYING);
    if (STATE_ANNOUNCEMENTS[s]) announce(STATE_ANNOUNCEMENTS[s]);
  },
  updateHUD() {
    const d = world.distance;
    distVal.textContent = d >= 1000 ? (d / 1000).toFixed(2) + ' km' : Math.floor(d) + ' m';
    coinVal.textContent = world.runCoins;
    speedVal.textContent = Math.round((world.speed * engine.timeScale() / D.PX_PER_M) * 3.6);
  },
};

function showOverlay(el) {
  for (const o of ALL_OVERLAYS) {
    const show = o === el;
    o.classList.toggle('hidden', !show);
    o.setAttribute('aria-hidden', String(!show));
  }
  // Keyboard focus follows the visible screen instead of stranding on a
  // hidden element (which drops it to <body>). Deferred: the overlay is mid
  // visibility-transition this tick and can't receive focus yet.
  const primary = el.querySelector('button:not([disabled])');
  if (primary) setTimeout(() => { if (!el.classList.contains('hidden')) primary.focus({ preventScroll: true }); }, 80);
}
function hideAllOverlays() {
  for (const o of ALL_OVERLAYS) { o.classList.add('hidden'); o.setAttribute('aria-hidden', 'true'); }
}

function refreshMenuStats() {
  $('menuBest').textContent = ED.save.bestScore.toLocaleString();
  $('menuBestDist').textContent = fmtDist(ED.save.bestDist);
  $('menuBank').textContent = ED.save.bank.toLocaleString();
}

function fmtDist(d) {
  return d >= 1000 ? (d / 1000).toFixed(2) + ' km' : Math.floor(d) + ' m';
}

/* ---------- Run lifecycle ---------- */
function startGame() {
  ED.audio.ensure();
  if (ED.save.settings.tilt && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().catch(() => {});
  }
  engine.reset();
  hideAllOverlays();
  // Drop focus so a habitual Space press mid-game can't re-activate the last button
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  hud.classList.add('visible');
  pauseBtn.classList.add('visible');
  world.countdownT = 3;
  countdownEl.textContent = '3';
  countdownEl.classList.add('visible');
  ui.setState(STATE.COUNTDOWN);
}

function pauseGame() {
  if (engine.state !== STATE.PLAYING && engine.state !== STATE.COUNTDOWN) return;
  if (engine.state === STATE.COUNTDOWN) countdownEl.classList.remove('visible');
  world.countdownT = Math.max(world.countdownT, 1); // resume gives you a beat to get ready
  pauseBtn.classList.remove('visible'); // don't leave a focusable control under the overlay
  ui.setState(STATE.PAUSED);
  showOverlay(pauseOverlay);
}
function resumeGame() {
  if (engine.state !== STATE.PAUSED) return;
  hideAllOverlays();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  pauseBtn.classList.add('visible');
  lastT = performance.now();
  countdownEl.textContent = String(Math.ceil(world.countdownT));
  countdownEl.classList.add('visible');
  ui.setState(STATE.COUNTDOWN);
}
function backToMenu() {
  refreshMenuStats();
  hud.classList.remove('visible');
  pauseBtn.classList.remove('visible');
  countdownEl.classList.remove('visible');
  ui.setState(STATE.MENU);
  showOverlay(menuOverlay);
}

function finishRun() {
  const finalScore = engine.score();
  const isBest = finalScore > ED.save.bestScore;
  if (isBest) ED.save.bestScore = finalScore;
  if (world.distance > ED.save.bestDist) ED.save.bestDist = world.distance;
  ED.save.bank += world.runCoins;
  ED.persist();

  $('finalScore').textContent = finalScore.toLocaleString();
  $('statDist').textContent = fmtDist(world.distance);
  $('statCoins').textContent = world.runCoins + ' (+' + world.runCoins + ' banked)';
  $('statNear').textContent = world.nearMisses;
  $('statBest').textContent = ED.save.bestScore.toLocaleString();
  $('newBestBadge').classList.toggle('hidden', !isBest);

  ui.setState(STATE.GAMEOVER);
  showOverlay(gameOverOverlay);
  hud.classList.remove('visible');
  pauseBtn.classList.remove('visible');
  announce('Game over. Final score ' + finalScore + '. Distance ' + fmtDist(world.distance) + '.' + (isBest ? ' New best score!' : ''));
}

/* ---------- Main loop ---------- */
const STATIC_STATES = new Set([STATE.MENU, STATE.PAUSED, STATE.GAMEOVER, STATE.GARAGE, STATE.SETTINGS]);
let lastT = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min((t - lastT) / 1000, 0.05);
  lastT = t;

  // Skip work entirely on static screens (battery friendly): draw once, then idle
  if (STATIC_STATES.has(engine.state)) {
    if (!staticDrawn) { ED.render.render(); staticDrawn = true; }
    return;
  }

  if (engine.state === STATE.COUNTDOWN) {
    world.countdownT -= dt;
    const n = Math.ceil(world.countdownT);
    const label = world.countdownT <= 0 ? 'GO!' : String(n);
    if (countdownEl.textContent !== label) {
      countdownEl.textContent = label;
      if (world.countdownT > 0) ED.audio.sfx.tick();
    }
    if (world.countdownT <= -0.5) {
      countdownEl.classList.remove('visible');
      ED.audio.sfx.go();
      ED.input.neutralGamma = ED.input.tiltX; // tilt calibrates to how you hold the phone right now
      ui.setState(STATE.PLAYING);
    }
  } else if (engine.state === STATE.PLAYING) {
    engine.update(dt);
  } else if (engine.state === STATE.CRASHING) {
    if (engine.tickCrash(dt)) { finishRun(); return; }
  }
  ED.render.render();
}

/* ---------- Input ---------- */
const input = ED.input = { keys: {}, touching: false, tiltX: null, neutralGamma: null };
let touchStartX = 0, playerStartX = 0;

function pointerDown(x) {
  if (engine.state !== STATE.PLAYING) return;
  input.touching = true;
  touchStartX = x;
  playerStartX = world.player.targetX;
}
function pointerMove(x) {
  if (!input.touching || engine.state !== STATE.PLAYING) return;
  world.player.targetX = playerStartX + (x - touchStartX) * 1.6;
}
function pointerUp() { input.touching = false; }

const canvas = ED.render.canvas;
canvas.addEventListener('touchstart', e => { e.preventDefault(); pointerDown(e.touches[0].clientX); }, { passive: false });
canvas.addEventListener('touchmove',  e => { e.preventDefault(); pointerMove(e.touches[0].clientX); }, { passive: false });
canvas.addEventListener('touchend',   e => { e.preventDefault(); pointerUp(); }, { passive: false });
canvas.addEventListener('mousedown', e => pointerDown(e.clientX));
window.addEventListener('mousemove', e => pointerMove(e.clientX));
window.addEventListener('mouseup', pointerUp);
window.addEventListener('blur', pointerUp);

window.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key) && engine.state === STATE.PLAYING) e.preventDefault();
  input.keys[e.key] = true;
  if (e.repeat) return;
  // When a button has keyboard focus, Enter/Space must activate THAT button -
  // never the global start/resume shortcut (a keyboard user tabbing to GARAGE
  // and pressing Enter should open the garage, not start a run).
  const onButton = e.target instanceof Element && e.target.closest('button, a, input, select, [role="switch"]');
  if ((e.key === 'Enter' || e.key === ' ') && !onButton) {
    if (engine.state === STATE.MENU || engine.state === STATE.GAMEOVER) { e.preventDefault(); startGame(); }
    else if (engine.state === STATE.PAUSED) { e.preventDefault(); resumeGame(); }
  }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (engine.state === STATE.PLAYING || engine.state === STATE.COUNTDOWN) pauseGame();
    else if (engine.state === STATE.PAUSED) resumeGame();
    else if (engine.state === STATE.GARAGE || engine.state === STATE.SETTINGS || engine.state === STATE.GAMEOVER) backToMenu();
  }
  if (e.key === 'm' || e.key === 'M') {
    ED.save.settings.sound = !ED.save.settings.sound;
    ED.persist();
    ED.audio.applyVolume();
    buildSettings();
    announce(ED.save.settings.sound ? 'Sound on' : 'Sound muted');
  }
});
window.addEventListener('keyup', e => { input.keys[e.key] = false; });

window.addEventListener('deviceorientation', e => { if (e.gamma !== null) input.tiltX = e.gamma; });

/* ---------- Resize / rotation ---------- */
function handleResize() {
  const oldRoadX = view.roadX, oldRoadW = view.roadW;
  ED.render.resizeCanvas();
  engine.remap(oldRoadX, oldRoadW);
  staticDrawn = false;
  // A mid-run resize (rotation, window drag) pauses so the player can reorient
  if (engine.state === STATE.PLAYING || engine.state === STATE.COUNTDOWN) pauseGame();
}
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => setTimeout(handleResize, 120));

/* ---------- Buttons ---------- */
$('startBtn').addEventListener('click', startGame);
$('restartBtn').addEventListener('click', startGame);
$('menuBtn').addEventListener('click', backToMenu);
$('quitBtn').addEventListener('click', backToMenu);
pauseBtn.addEventListener('click', pauseGame);
$('resumeBtn').addEventListener('click', resumeGame);

/* ---------- Garage ---------- */
function buildGarage(focusCarId) {
  $('garageBank').textContent = ED.save.bank.toLocaleString();
  const list = $('garageList');
  list.innerHTML = '';
  for (const car of D.CARS) {
    const owned = ED.save.owned.includes(car.id);
    const selected = ED.save.selected === car.id;
    const row = document.createElement('div');
    row.className = 'car-row' + (selected ? ' selected' : '');
    const btnLabel = selected ? 'SELECTED' : owned ? 'SELECT' : '&#129689; ' + car.price;
    const btnClass = selected ? 'car-btn owned' : owned ? 'car-btn' : 'car-btn locked';
    const btnName = selected ? car.name + ' selected' : owned ? 'Select ' + car.name : 'Buy ' + car.name + ' for ' + car.price + ' coins';
    const canAfford = ED.save.bank >= car.price;
    const statPct = m => Math.round((m - 1) * 100);
    const statRow = (label, mult) => {
      const pct = statPct(mult);
      const pctLabel = (pct > 0 ? '+' : '') + pct + '%';
      const barPct = ED.util.clamp(50 + pct, 6, 100);
      return '<div class="stat-row"><span class="stat-label">' + label + '</span>' +
        '<span class="stat-bar" aria-hidden="true"><span class="stat-fill" style="width:' + barPct + '%"></span></span>' +
        '<span class="stat-val">' + pctLabel + '</span></div>';
    };
    row.innerHTML =
      '<canvas class="car-swatch" aria-hidden="true"></canvas>' +
      '<div class="car-info"><div class="car-name">' + car.name + '</div><div class="car-desc">' + car.desc + '</div>' +
      '<div class="car-stats">' + statRow('Top Speed', car.topSpeed) + statRow('Accel', car.accel) + statRow('Handling', car.steer) + '</div></div>' +
      '<button class="' + btnClass + '" aria-label="' + btnName + '" ' + ((!owned && !canAfford) || selected ? 'disabled' : '') + '>' + btnLabel + '</button>';
    const btn = row.querySelector('button');
    btn.addEventListener('click', () => {
      if (owned) {
        ED.save.selected = car.id;
        announce(car.name + ' selected');
      } else if (ED.save.bank >= car.price) {
        ED.save.bank -= car.price;
        ED.save.owned.push(car.id);
        ED.save.selected = car.id;
        ED.audio.sfx.power();
        announce(car.name + ' purchased and selected');
      }
      ED.persist();
      buildGarage(car.id); // rebuild, keeping keyboard focus on this car's row
    });
    if (focusCarId === car.id) {
      const target = btn.disabled ? $('garageBackBtn') : btn;
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }
    list.appendChild(row);
    ED.render.drawCarIcon(row.querySelector('.car-swatch'), car);
  }
}
$('garageBtn').addEventListener('click', () => { buildGarage(); ui.setState(STATE.GARAGE); showOverlay(garageOverlay); });
$('garageBackBtn').addEventListener('click', backToMenu);

/* ---------- Settings ---------- */
function buildSettings(focusKey) {
  const list = $('settingsList');
  list.innerHTML = '';
  for (const def of D.SETTING_DEFS) {
    const on = ED.save.settings[def.key];
    const row = document.createElement('div');
    row.className = 'setting-row';
    // Name comes from the labelled text (Label in Name); the visible ON/OFF is
    // decorative - screen readers read state from aria-checked.
    row.innerHTML =
      '<div><div class="setting-name" id="setname-' + def.key + '">' + def.name + '</div><div class="setting-sub">' + def.sub + '</div></div>' +
      '<button class="toggle ' + (on ? 'on' : 'off') + '" role="switch" aria-checked="' + on + '" aria-labelledby="setname-' + def.key + '"><span aria-hidden="true">' + (on ? 'ON' : 'OFF') + '</span></button>';
    const btn = row.querySelector('button');
    btn.addEventListener('click', () => {
      ED.save.settings[def.key] = !ED.save.settings[def.key];
      if (def.key === 'tilt' && ED.save.settings.tilt &&
          typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().catch(() => {});
      }
      ED.persist();
      ED.audio.applyVolume();
      announce(def.name + (ED.save.settings[def.key] ? ' on' : ' off'));
      buildSettings(def.key); // rebuild, keeping keyboard focus on this switch
    });
    if (focusKey === def.key) requestAnimationFrame(() => btn.focus({ preventScroll: true }));
    list.appendChild(row);
  }
}
$('settingsBtn').addEventListener('click', () => { buildSettings(); ui.setState(STATE.SETTINGS); showOverlay(settingsOverlay); });
$('settingsBackBtn').addEventListener('click', backToMenu);

/* Desktop-appropriate menu hint */
if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) {
  $('menuHint').innerHTML =
    'Steer with <b>&larr; &rarr;</b> arrow keys (or A/D), or drag with the mouse.<br>' +
    '<b>Enter</b>&thinsp;/&thinsp;<b>Space</b> starts &middot; <b>P</b>/<b>Esc</b> pauses &middot; <b>M</b> mutes.<br>' +
    'Coins are worth 25 points and bank up to unlock cars.';
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

// If the OS reduced-motion preference turns on mid-session, honor it live
// (the settings toggle can always re-enable full motion explicitly).
if (window.matchMedia) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMotionPref = e => {
    if (e.matches && ED.save.settings.motion) {
      ED.save.settings.motion = false;
      ED.persist();
      buildSettings();
    }
  };
  if (mq.addEventListener) mq.addEventListener('change', onMotionPref);
}

/* ---------- Boot ---------- */
ED.render.resizeCanvas();
refreshMenuStats();
requestAnimationFrame(loop);

/* Minimal hooks for automated testing */
window.__ED = {
  get state() { return engine.state; },
  get score() { return engine.score(); },
  get distance() { return world.distance; },
  get speedKmh() { return Math.round((world.speed * engine.timeScale() / D.PX_PER_M) * 3.6); },
  openLanes() { return world.lastOpenLanes.slice(); },
  snapshot() {
    return {
      px: world.player.x, py: world.player.y, ph: world.player.h,
      laneW: view.laneW, roadX: view.roadX, lanes: D.LANES,
      obstacles: world.obstacles.map(o => ({ x: o.x, y: o.y, h: o.h, to: (o.toLane !== undefined && o.changeProg < 1) ? o.toLane : null })),
    };
  },
  steerTo(lane) { world.player.targetX = view.laneCenter(lane); },
  forceCrash() { if (engine.state === STATE.PLAYING) engine.beginCrash(null); },
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
})();
