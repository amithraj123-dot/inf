# Endless Drive 🚗

A never-ending neon driving game built for mobile phones and desktops alike. No downloads, no app store — it runs in the browser and can be installed to your home screen as an app (PWA) that works offline.

## Play it

Serve the folder with any static file server and open it on your phone:

```bash
npx serve .
# or
python3 -m http.server 8000
```

You can also just double-click `index.html` — it's a handful of plain scripts with no build step, so it runs straight off disk.

Or enable **GitHub Pages** on this repo (Settings → Pages → Source: GitHub Actions) and open the URL on your phone. Tap **"Add to Home Screen"** to install it like a native app.

## How to play

**On a phone:** touch & drag anywhere to steer (tilt steering can be enabled in Settings — it calibrates to your grip at "GO!").

**On a laptop/desktop:** steer with **← →** arrow keys or **A/D**, or drag with the mouse. **Enter**/**Space** starts, **P**/**Esc** pauses, **M** mutes.

- Dodge the traffic — one hit and it's over (unless you're holding a shield)
- Each coin is worth **25 points** and goes into your bank
- Squeeze past cars for **near-miss** bonuses (+10)
- Spend banked coins in the **Garage** on six real-world car archetypes, each with its own top speed, acceleration and handling

## Garage roster

Every car shares the same starting speed; top speed and acceleration change how the world-speed ramp climbs while you drive, and handling changes steering response. Stats shown are relative to the Hatch baseline.

| Car | Archetype | Top Speed | Accel | Handling | Perk |
|---|---|---|---|---|---|
| Hatch | Everyday hatchback | +0% | +0% | +0% | Free starter |
| Sport Coupe | Nimble corner-carver | +5% | +10% | +20% | Sharpest low-tier handling |
| Taxi | Heavy sedan/cab | +5% | -10% | +0% | Wide coin pickup radius |
| Muscle Car | Big-engine muscle | +15% | +35% | -15% | Fastest off the line, stiff to steer |
| Supercar | Track-tuned exotic | +35% | +25% | +35% | Highest ceiling of any car |
| Hovercar | Frictionless sci-fi | +30% | +15% | +40% | Glides straight over oil slicks |

## The road evolves as you drive

| Distance | What appears |
|---|---|
| 0 m | Regular traffic, gentle pace |
| 300 m | Trucks — long and slow to pass |
| 400 m | Double-lane blocks |
| 600 m | Cars that signal and change lanes |
| 800 m | New environment every 800 m (Midnight City → Sunset Strip → Pine Hills → Snowfield), each with its own driving challenge |
| 1000 m | Oil slicks that send you skidding |

Power-ups spawn along the way: **Shield** (survive one crash), **Coin Magnet** (6 s), and **Slow-Mo** (4 s).

The road itself never runs straight for long — smooth, continuous S-curves (a different shape every run) genuinely bend the lanes ahead, and your car banks into them. A curve gives a light, physically-grounded pull at the wheel that a car with better handling shrugs off more easily.

## Environment challenges

Every environment is a real gameplay modifier, not just a new coat of paint:

| Environment | Challenge |
|---|---|
| Midnight City | **Rush Hour** — traffic rows arrive closer together |
| Sunset Strip | **Sun Glare** — hazards fade in late, shortening your reaction window |
| Pine Hills | **Winding Road** — the curve amplitude nearly doubles for tighter mountain turns |
| Snowfield | **Icy Roads** — steering grip drops and black-ice patches join the oil slicks |

## Spin the wheel

A bonus challenge wheel spins in on its own timer (first one ~20 seconds into a run, then every 40-65 seconds) and lands on one of seven random modifiers:

| Challenge | Effect |
|---|---|
| Coin Rush | Every coin is worth double for 15s |
| Speed Surge | A real speed and score-rate boost for 12s — genuinely riskier, genuinely faster |
| Ghost Traffic | Pass straight through traffic for 14s |
| Magnet Boost | Coins pulled in from far away for 15s |
| Coin Storm | An instant shower of coins across every lane |
| Free Shield | Survive your next crash, no strings attached |
| Fog Warning | Reduced visibility for 14s — the one "spicy" modifier, weighted rarer than the rest |

## Fairness by construction

Traffic is generated as patterned rows, not random cars:

- Every row keeps at least one lane open, and that lane is always reachable from the previous row's open lanes.
- All vehicles in a row share one speed, so rows can never drift together into an impassable wall.
- Row spacing scales with your speed *and* with the length of the vehicles in the previous row, so a truck always has time to clear before the next pattern arrives.
- Coins and power-ups travel with their traffic row and are placed only in open lanes — grabbing them is a routing choice, never a trap.
- Environment modifiers (denser Rush Hour traffic, Speed Surge's boost) only ever tighten a *soft* difficulty term — the hard spacing-safety floor behind the point above is never touched, so no combination of car, environment and wheel effect can generate an unsurvivable pattern.
- Road curvature is a rendering + light-handling effect layered on top of the same straight lane math everything else uses; it can never itself create an unfair collision, and its amplitude is clamped to the available screen margin so a sharp Pine Hills bend can't push the road off a narrow phone.

## Features

- 🎮 Endless procedural gameplay with milestone-based difficulty phases
- 🛣️ Smooth, never-repeating S-curve roads with real car banking and light cornering drift
- 🌆 4 environments, each a genuine gameplay modifier (traffic density, visibility, curve sharpness, grip) — not just a palette swap
- 🎡 Spin-the-wheel bonus challenges on a timer: 7 random modifiers from coin storms to speed surges
- 🏆 Run stats (distance, coins, near misses), best-score tracking, "New Best" celebrations
- 🚙 Garage with 6 cars, each a distinct silhouette with its own top speed, acceleration and handling stats
- 🔊 Zero-asset synth audio, including an engine tone that rises with speed
- ⚙️ Settings for sound, vibration, tilt steering, and reduced motion (respects `prefers-reduced-motion`)
- 📱 Mobile-first: touch drag, calibrated tilt, haptics, safe-area aware, auto-pause on backgrounding and rotation
- 🔋 Rendering fully idles on static screens to save battery
- 📴 Installable PWA with offline play via service worker
- ⚡ No build step, no frameworks, 60 fps canvas rendering with swept collision detection

## Accessibility

- Fully keyboard-operable: focus follows each screen, Enter/Space activate the focused control, Escape backs out of any screen
- Screen-reader support: described canvas, live announcements for state changes, milestones, hazards, and results
- Pinch-zoom is never blocked outside the play surface; WCAG AA text contrast
- Reduced-motion mode (own toggle, seeded from and responsive to the OS preference)

## Tech

Plain HTML5 canvas + vanilla JavaScript. No frameworks, no build step, no assets to load.

```
index.html        markup + script/style includes (encoding-proof: pure ASCII, symbols as entities)
css/style.css     all styling; per-screen visual identities via CSS custom properties
js/data.js        tuning constants, car catalogue, environment palettes
js/save.js        localStorage persistence
js/audio.js       zero-asset synth SFX, engine tone, haptics
js/engine.js      simulation: traffic patterns, collision, power-ups, scoring
js/render.js      all canvas drawing
js/ui.js          overlays, input, state machine, main loop, accessibility
sw.js             offline cache (PWA)
```

Classic scripts (no ES modules), so the game still runs when `index.html` is opened directly from disk.
