# Endless Drive 🚗

A never-ending driving game built for mobile phones. No downloads, no app store — it runs in the browser and can be installed to your home screen as an app (PWA) that works offline.

## Play it

Serve the folder with any static file server and open it on your phone:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Or enable **GitHub Pages** on this repo (Settings → Pages → deploy from branch) and open the URL on your phone. Tap **"Add to Home Screen"** to install it like a native app.

## How to play

**On a phone:** touch & drag anywhere to steer (or tilt the device).

**On a laptop/desktop:** steer with **← →** arrow keys or **A/D**, or drag with the mouse. **Enter**/**Space** starts or restarts, **P** or **Esc** pauses.

- Dodge the traffic — one hit and it's over
- Grab **coins** for +25 points each
- Squeeze past cars for **near-miss** bonuses (+10)
- The road never ends and the speed never stops climbing — how far can you go?

## Features

- 🎮 Endless procedural gameplay — speed ramps up forever
- 📱 Mobile-first: touch drag steering, tilt steering, haptic feedback, safe-area aware
- 🌗 Slow day/night cycle as you drive
- 🔊 Zero-asset synth sound effects (coin, crash, near-miss)
- 💾 Best score saved locally
- 📴 Full offline play via service worker — installable PWA
- ⚡ Single dependency-free HTML file, 60fps canvas rendering

## Tech

Plain HTML5 canvas + vanilla JavaScript. No frameworks, no build step, no assets to load.
