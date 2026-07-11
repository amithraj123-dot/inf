/* Endless Drive - static data, tuning constants and pure helpers.
   Load order: data -> save -> audio -> engine -> render -> ui */
(() => {
'use strict';
const ED = window.ED = {};

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

ED.util = {
  rgb,
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
  shade(hex, amt) {
    const [r, g, b] = rgb(hex).map(c => Math.max(0, Math.min(255, c + amt)));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  },
};

ED.data = {
  LANES: 3,
  PX_PER_M: 15,          // world pixels per metre - HUD speed/distance derive from this
  BASE_SPEED: 360,
  SPEED_CAP: 1500,
  SPEED_RATE: 7.5,
  ENV_EVERY_M: 800,

  TRAFFIC_COLORS: ['#e63946', '#f4a261', '#8ecae6', '#a8dadc', '#cdb4db', '#90be6d', '#f9c74f', '#ff7096'],

  /* Each car is a distinct real-world archetype with its own top speed,
     acceleration and handling multiplier (1.0 = baseline Hatch).
     topSpeed scales how high the world-speed ramp is allowed to climb;
     accel scales how fast it climbs there; steer is handling/control
     response. shape drives the silhouette in render.js. */
  CARS: [
    { id: 'hatch',  name: 'Hatch',      shape: 'hatch',  color: '#4facfe', price: 0,
      topSpeed: 1.00, accel: 1.00, steer: 1.00, magnet: 0,  oilProof: false,
      desc: 'Balanced everyday runabout' },
    { id: 'sport',  name: 'Sport Coupe', shape: 'coupe',  color: '#ef476f', price: 150,
      topSpeed: 1.05, accel: 1.10, steer: 1.20, magnet: 0,  oilProof: false,
      desc: 'Nimble, tuned for corners' },
    { id: 'taxi',   name: 'Taxi',       shape: 'sedan',  color: '#ffd166', price: 400,
      topSpeed: 1.05, accel: 0.90, steer: 1.00, magnet: 34, oilProof: false,
      desc: 'Heavy cruiser, wide coin pickup' },
    { id: 'muscle', name: 'Muscle Car', shape: 'muscle', color: '#f77f00', price: 700,
      topSpeed: 1.15, accel: 1.35, steer: 0.85, magnet: 0,  oilProof: false,
      desc: 'Brutal acceleration, stiff handling' },
    { id: 'super',  name: 'Supercar',   shape: 'super',  color: '#b465ff', price: 1200,
      topSpeed: 1.35, accel: 1.25, steer: 1.35, magnet: 0,  oilProof: false,
      desc: 'Elite in every stat' },
    { id: 'hover',  name: 'Hovercar',   shape: 'hover',  color: '#06ffa5', price: 2000,
      topSpeed: 1.30, accel: 1.15, steer: 1.40, magnet: 0,  oilProof: true,
      desc: 'Frictionless drive, glides over oil' },
  ],

  /* Environments rotate every ENV_EVERY_M metres. Colors pre-parsed to [r,g,b]. */
  ENVS: [
    { name: 'MIDNIGHT CITY', skyT: rgb('#0a0e1a'), skyB: rgb('#161c30'), ground: rgb('#0e1322'), road: rgb('#20242f'), edge: rgb('#00e5ff'), dash: rgb('#5a6a8a'), prop: 'building', propCol: rgb('#1b2340') },
    { name: 'SUNSET STRIP',  skyT: rgb('#2b1533'), skyB: rgb('#7a2f4a'), ground: rgb('#26142b'), road: rgb('#2a2331'), edge: rgb('#ff9e64'), dash: rgb('#b98aa5'), prop: 'palm',     propCol: rgb('#1a0f21') },
    { name: 'PINE HILLS',    skyT: rgb('#0d1f16'), skyB: rgb('#1e4034'), ground: rgb('#143323'), road: rgb('#2d3138'), edge: rgb('#d8f3dc'), dash: rgb('#9fb7a8'), prop: 'tree',     propCol: rgb('#2d6a4f') },
    { name: 'SNOWFIELD',     skyT: rgb('#1d2735'), skyB: rgb('#3f5878'), ground: rgb('#aebfd2'), road: rgb('#39414e'), edge: rgb('#ffffff'), dash: rgb('#c9d6df'), prop: 'snowtree', propCol: rgb('#274156') },
  ],

  SETTING_DEFS: [
    { key: 'sound', name: 'Sound', sub: 'Effects and engine (M to mute)' },
    { key: 'vibration', name: 'Vibration', sub: 'Haptic feedback on supported phones' },
    { key: 'tilt', name: 'Tilt steering', sub: 'Calibrates to your grip at "GO!"' },
    { key: 'motion', name: 'Full motion', sub: 'Screen shake, glow and speed lines' },
  ],
};
})();
