/* Endless Drive - zero-asset synth audio and haptics. */
(() => {
'use strict';
const ED = window.ED;

let audioCtx = null, masterGain = null, engineOsc = null;

function ensure() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.connect(audioCtx.destination);
      applyVolume();
    } catch (e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function applyVolume() {
  if (masterGain) masterGain.gain.value = ED.save.settings.sound ? 1 : 0;
}

function beep(freq, dur, type, vol) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type || 'square';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol || 0.08, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  o.connect(g).connect(masterGain);
  o.start();
  o.stop(audioCtx.currentTime + dur);
}

/* Continuous engine tone; pitch is set per frame from the current speed. */
function engineSync(shouldRun) {
  if (shouldRun && audioCtx && !engineOsc) {
    engineOsc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    engineOsc.type = 'sawtooth';
    g.gain.value = 0.02;
    engineOsc.connect(g).connect(masterGain);
    engineOsc.start();
  } else if (!shouldRun && engineOsc) {
    try { engineOsc.stop(); } catch (e) {}
    engineOsc = null;
  }
}

function engineFreq(f) {
  if (engineOsc) engineOsc.frequency.value = f;
}

ED.audio = {
  ensure, applyVolume, engineSync, engineFreq,
  vibrate(pattern) { if (ED.save.settings.vibration && navigator.vibrate) navigator.vibrate(pattern); },
  sfx: {
    coin()   { beep(880, 0.08, 'sine', 0.1); setTimeout(() => beep(1320, 0.1, 'sine', 0.08), 60); },
    crash()  { beep(90, 0.4, 'sawtooth', 0.2); beep(60, 0.5, 'square', 0.15); },
    near()   { beep(500, 0.05, 'triangle', 0.05); },
    power()  { beep(520, 0.09, 'sine', 0.1); setTimeout(() => beep(780, 0.12, 'sine', 0.1), 70); },
    shield() { beep(300, 0.15, 'sawtooth', 0.14); setTimeout(() => beep(200, 0.2, 'square', 0.1), 60); },
    slip()   { beep(180, 0.25, 'sawtooth', 0.08); },
    tick()   { beep(660, 0.07, 'square', 0.07); },
    go()     { beep(990, 0.18, 'square', 0.1); },
  },
};
})();
