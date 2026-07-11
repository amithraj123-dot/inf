/* Endless Drive - persistence (localStorage). */
(() => {
'use strict';
const ED = window.ED;

const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEFAULT_SAVE = {
  bestScore: 0, bestDist: 0, bank: 0,
  owned: ['hatch'], selected: 'hatch',
  settings: { sound: true, vibration: true, tilt: false, motion: !prefersReducedMotion },
};

let save;
try {
  save = Object.assign({}, DEFAULT_SAVE, JSON.parse(localStorage.getItem('endlessDrive') || '{}'));
  save.settings = Object.assign({}, DEFAULT_SAVE.settings, save.settings);
  // Migrate the v1 best-score key
  const oldBest = parseInt(localStorage.getItem('endlessDriveBest') || '0', 10);
  if (oldBest > save.bestScore) save.bestScore = oldBest;
} catch (e) {
  save = JSON.parse(JSON.stringify(DEFAULT_SAVE));
}

ED.save = save;
ED.persist = () => {
  try { localStorage.setItem('endlessDrive', JSON.stringify(save)); } catch (e) {}
};
ED.carById = id => ED.data.CARS.find(c => c.id === id) || ED.data.CARS[0];
})();
