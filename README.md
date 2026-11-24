# PROJECT LIFE — 3D Open-World Browser Game

A complete 3D open-world city game built with Three.js (vendored locally, works offline).

## Launch

Any static file server works. From this directory:

```bash
python3 -m http.server 8000
# or: npx serve .
```

Then open **http://localhost:8000** in a modern browser (Chrome/Edge/Firefox/Safari).

No build step, no external network needed — Three.js is vendored in `lib/`.

## How to play

- **Goal:** explore the city, collect cash orbs, start missions at the cyan light pillars (5 missions), earn money, buy nothing — spend it at garages to repair your car.
- **On foot:** WASD/arrows move · Shift sprint · Space jump · mouse camera (click canvas to lock pointer) · wheel zoom · E interact (enter/exit vehicles, start missions, repair at garage) · 1/2/3 use items · I/Tab inventory & stats · Esc/P pause.
- **In a vehicle:** W/S throttle & brake/reverse · A/D steer · mouse chase camera · wheel zoom · E exit.
- **Touch devices:** left virtual stick to move/steer, drag right side for camera, on-screen buttons (JUMP/RUN/E/GAS/BRK).

## Features

- Small modern city: 5×5 road grid, intersections with crosswalks, sidewalks, ~30 buildings with lit windows at night, 2 parks (trees, benches, fountain), streetlights, parking lot, 2 garages, props (hydrants, trees).
- Day/night cycle (240 s), dynamic weather (clear/cloudy/rain/fog + lightning), rain reduces grip, night turns on streetlights, building windows and headlights.
- Traffic AI (cars follow lanes, brake for you, turn at intersections) and pedestrians walking the sidewalks.
- Third-person character with procedural walk/jump animation, collision vs buildings/props/vehicles.
- 5 drivable vehicle types (sedan, sports coupe, SUV, pickup, van) with different acceleration/top speed/steering/off-road/damage; enter any parked or traffic car (when slow).
- Economy: cash orbs, mission rewards, garage repairs ($200); inventory items (Coffee = speed boost, Nitro = vehicle burst, Repair Kit).
- 5 missions: First Delivery, Cash Rush, Checkpoint Rush, Taxi Service, Street Race (vs AI rival) — with timers, trackers and rewards.
- Stats (distance, orbs, fares, jumps, crashes, top speed…), minimap, speedometer + damage gauge, HUD, main menu, pause menu, settings (quality/volume/sensitivity/FOV/invert-Y/FPS), help, inventory screen.
- Save/load via localStorage (autosave every 30 s + manual save in pause menu; Continue on main menu).

## Project structure

```
index.html          entry + UI DOM
css/style.css       UI styling
lib/three.module.js vendored Three.js r160
src/
  main.js           Game class, loop, state machine, interactions
  config.js         all tuning constants + vehicle/item definitions
  citygrid.js       pure city-layout math (roads, blocks, surfaces)
  collision.js      AABB/OBB collision world
  physics.js        arcade car physics (pure)
  world.js          city generation (roads, buildings, parks, lamps, props)
  daynight.js       sun/moon, sky, fog, lights, clock
  weather.js        weather states, rain particles, clouds, lightning
  traffic.js        traffic AI
  pedestrians.js    pedestrian walkers
  player.js         third-person controller + animation
  vehicles.js       vehicle meshes, driving, enter/exit, damage
  camera.js         orbit/chase camera with collision
  pickups.js        cash orbs + item pickups
  missions.js       5 missions, markers, gates, rival AI
  profile.js        money/stats/inventory
  save.js           localStorage persistence
  hud.js  minimap.js  ui.js  touch.js  input.js  audio.js
tests/              node test suites (no browser needed)
```

## Tests

```bash
npm install        # only needed for tests (resolves 'three' in Node); the game itself uses lib/
npm run check      # pure-logic unit tests
npm test           # headless integration test: boots the whole game in Node and plays it
```
