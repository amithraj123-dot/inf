# Endless Drive 🚗

A never-ending neon driving game built for mobile phones and desktops alike. No downloads, no app store — it runs in the browser and can be installed to your home screen as an app (PWA) that works offline.

## Play it

Serve the folder with any static file server and open it on your phone:

```bash
npx serve .
# or
python3 -m http.server 8000
```

You can also just double-click `index.html` — the whole game is one self-contained file.

Or enable **GitHub Pages** on this repo (Settings → Pages → Source: GitHub Actions) and open the URL on your phone. Tap **"Add to Home Screen"** to install it like a native app.

## How to play

**On a phone:** touch & drag anywhere to steer (tilt steering can be enabled in Settings — it calibrates to your grip at "GO!").

**On a laptop/desktop:** steer with **← →** arrow keys or **A/D**, or drag with the mouse. **Enter**/**Space** starts, **P**/**Esc** pauses, **M** mutes.

- Dodge the traffic — one hit and it's over (unless you're holding a shield)
- Each coin is worth **25 points** and goes into your bank
- Squeeze past cars for **near-miss** bonuses (+10)
- Spend banked coins in the **Garage** on six cars with different handling perks

## The road evolves as you drive

| Distance | What appears |
|---|---|
| 0 m | Regular traffic, gentle pace |
| 300 m | Trucks — long and slow to pass |
| 400 m | Double-lane blocks |
| 600 m | Cars that signal and change lanes |
| 800 m | New environment every 800 m (Midnight City → Sunset Strip → Pine Hills → Snowfield) |
| 1000 m | Oil slicks that send you skidding |

Power-ups spawn along the way: **Shield** (survive one crash), **Coin Magnet** (6 s), and **Slow-Mo** (4 s).

## Fairness by construction

Traffic is generated as patterned rows, not random cars:

- Every row keeps at least one lane open, and that lane is always reachable from the previous row's open lanes.
- All vehicles in a row share one speed, so rows can never drift together into an impassable wall.
- Row spacing scales with your speed *and* with the length of the vehicles in the previous row, so a truck always has time to clear before the next pattern arrives.
- Coins and power-ups travel with their traffic row and are placed only in open lanes — grabbing them is a routing choice, never a trap.

## Features

- 🎮 Endless procedural gameplay with milestone-based difficulty phases
- 🏆 Run stats (distance, coins, near misses), best-score tracking, "New Best" celebrations
- 🚙 Garage with 6 unlockable cars: steering, coin-magnet, and oil-immunity perks
- 🌆 4 rotating neon environments with animated scenery
- 🔊 Zero-asset synth audio, including an engine tone that rises with speed
- ⚙️ Settings for sound, vibration, tilt steering, and reduced motion (respects `prefers-reduced-motion`)
- 📱 Mobile-first: touch drag, calibrated tilt, haptics, safe-area aware, auto-pause on backgrounding and rotation
- 🔋 Rendering fully idles on static screens to save battery
- 📴 Installable PWA with offline play via service worker
- ⚡ Single dependency-free HTML file, 60 fps canvas rendering with swept collision detection

## Tech

Plain HTML5 canvas + vanilla JavaScript. No frameworks, no build step, no assets to load.
