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

  CARS: [
    { id: 'hatch',  name: 'Hatch',    color: '#4facfe', price: 0,    steer: 1.0,  magnet: 0,  oilProof: false, desc: 'Balanced starter' },
    { id: 'sport',  name: 'Sport',    color: '#ef476f', price: 150,  steer: 1.2,  magnet: 0,  oilProof: false, desc: '+20% steering response' },
    { id: 'taxi',   name: 'Taxi',     color: '#ffd166', price: 400,  steer: 1.05, magnet: 34, oilProof: false, desc: 'Wider coin pickup' },
    { id: 'muscle', name: 'Muscle',   color: '#f77f00', price: 700,  steer: 1.15, magnet: 16, oilProof: false, desc: 'Quick and grabby' },
    { id: 'super',  name: 'Supercar', color: '#b465ff', price: 1200, steer: 1.35, magnet: 16, oilProof: false, desc: 'Razor-sharp steering' },
    { id: 'hover',  name: 'Hover',    color: '#06ffa5', price: 2000, steer: 1.25, magnet: 50, oilProof: true,  desc: 'Glides over oil slicks' },
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
