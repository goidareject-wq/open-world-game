import assert from 'node:assert';

const ctxStub = new Proxy({}, {
  get: (t, p) => (...args) => {
    if (p === 'createRadialGradient' || p === 'createLinearGradient') return { addColorStop() {} };
    if (p === 'measureText') return { width: 10 };
    return undefined;
  },
  set: () => true,
});

globalThis.document = {
  readyState: 'complete',
  createElement: (tag) => {
    if (tag === 'canvas') return { width: 0, height: 0, style: {}, getContext: () => ctxStub };
    return { style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], dataset: {}, set textContent(v) {}, get textContent() { return ''; } };
  },
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  body: { appendChild() {} },
};

const { Game } = await import('../src/main.js');
const { groundHeight } = await import('../src/citygrid.js');

const game = new Game({ headless: true });
assert.strictEqual(game.state, 'menu');
assert.ok(game.world.colliders.boxes.length > 40, 'city colliders generated');
assert.strictEqual(game.vehicleSys.list.length, 8, '8 parked vehicles');
assert.ok(game.traffic.cars.length >= 6, 'traffic spawned');
assert.ok(game.peds.list.length >= 10, 'pedestrians spawned');
assert.strictEqual(Object.keys(game.missions.status).length, 5, '5 missions');

game.newGame();
assert.strictEqual(game.state, 'playing');
const spawn = { x: game.player.pos.x, z: game.player.pos.z };

game.input.keys.add('KeyW');
for (let i = 0; i < 600; i++) game.update(1 / 60);
const walked = Math.hypot(game.player.pos.x - spawn.x, game.player.pos.z - spawn.z);
assert.ok(walked > 10, `player walked ${walked.toFixed(1)}m`);
assert.ok(game.profile.stats.distanceWalked > 10);
game.input.keys.delete('KeyW');

game.input.touch.jump = true;
game.update(1 / 60);
assert.ok(game.profile.stats.jumps >= 1, 'jump counted');

const veh = game.vehicleSys.list[0];
game.player.pos.set(veh.st.x + 1.2, groundHeight(veh.st.x + 1.2, veh.st.z), veh.st.z);
const prompt = game.getPrompt();
assert.ok(prompt && prompt.includes('Enter'), `prompt: ${prompt}`);
game.handleInteract();
assert.strictEqual(game.vehicleSys.current, veh, 'entered vehicle');
assert.ok(!game.player.mesh.visible, 'player hidden in vehicle');

veh.st.x = -63.5; veh.st.z = -110; veh.st.yaw = 0; veh.st.speed = 0;
game.input.keys.add('KeyW');
let maxSpeed = 0;
for (let i = 0; i < 600; i++) {
  game.update(1 / 60);
  maxSpeed = Math.max(maxSpeed, Math.abs(veh.st.speed));
}
game.input.keys.delete('KeyW');
assert.ok(maxSpeed > 8, `vehicle accelerated (max ${maxSpeed.toFixed(1)} m/s)`);
assert.ok(game.profile.stats.distanceDriven > 50, `drove ${game.profile.stats.distanceDriven.toFixed(1)}m`);
assert.ok(game.vehicleSys.getSpeedKmh() >= 0 && game.profile.stats.topSpeed > 0);

for (let i = 0; i < 120; i++) game.update(1 / 60);
game.handleInteract();
assert.strictEqual(game.vehicleSys.current, null, 'exited vehicle');
assert.ok(game.player.mesh.visible);

async function playMission(id, steps) {
  assert.ok(game.missions.status[id] === 'available', `${id} available`);
  assert.ok(game.missions.start(id), `${id} started`);
  await steps();
  assert.strictEqual(game.missions.status[id], 'done', `${id} completed`);
}

await playMission('m1', async () => {
  const d = game.missions.active.data;
  game.player.pos.set(d.a.x, groundHeight(d.a.x, d.a.z), d.a.z);
  game.update(1 / 60);
  assert.strictEqual(d.stage, 1, 'package picked up');
  game.player.pos.set(d.b.x, groundHeight(d.b.x, d.b.z), d.b.z);
  game.update(1 / 60);
});

await playMission('m2', async () => {
  const before = game.missions.active.data.collected;
  for (const o of game.missions.orbs) {
    if (o.taken) continue;
    game.player.pos.set(o.x, groundHeight(o.x, o.z), o.z);
    game.update(1 / 60);
  }
  assert.ok(game.missions.status.m2 === 'done');
});

await playMission('m3', async () => {
  const v = game.vehicleSys.list[1];
  game.player.pos.set(v.st.x + 1, 0.1, v.st.z);
  game.handleInteract();
  assert.ok(game.vehicleSys.current, 'in vehicle for m3');
  for (const gt of game.missions.gates) {
    game.vehicleSys.current.st.x = gt.x;
    game.vehicleSys.current.st.z = gt.z;
    game.update(1 / 60);
  }
  game.handleInteract();
});

await playMission('m4', async () => {
  const v = game.vehicleSys.list[2];
  game.player.pos.set(v.st.x + 1, 0.1, v.st.z);
  game.handleInteract();
  for (let f = 0; f < 3; f++) {
    const d = game.missions.active.data;
    const cur = game.vehicleSys.current;
    cur.st.x = d.pickup.x; cur.st.z = d.pickup.z;
    game.update(1 / 60);
    assert.ok(d.carrying, `fare ${f} picked up`);
    cur.st.x = d.dest.x; cur.st.z = d.dest.z;
    game.update(1 / 60);
  }
  game.handleInteract();
});

await playMission('m5', async () => {
  const v = game.vehicleSys.list[3];
  game.player.pos.set(v.st.x + 1, 0.1, v.st.z);
  game.handleInteract();
  for (const gt of game.missions.gates) {
    game.vehicleSys.current.st.x = gt.x;
    game.vehicleSys.current.st.z = gt.z;
    game.update(1 / 60);
  }
  game.handleInteract();
});

assert.strictEqual(game.profile.stats.missionsCompleted, 5, 'all 5 missions completed');
assert.ok(game.profile.money > 250 + 500 + 750 + 1000 + 1500 + 2500 - 1, `money earned (${game.profile.money})`);

if (game.vehicleSys.current) game.vehicleSys.exit();
const v0 = game.vehicleSys.list[0];
v0.st.damage = 60;
v0.st.speed = 0;
game.player.pos.set(v0.st.x + 1, 0.1, v0.st.z);
game.vehicleSys.enter(v0);
assert.ok(game.vehicleSys.current === v0, 'entered v0 for garage test');
const gpos = game.world.garages[0];
game.vehicleSys.current.st.x = gpos.x;
game.vehicleSys.current.st.z = gpos.z;
const moneyBefore = game.profile.money;
game.handleInteract();
assert.strictEqual(game.vehicleSys.current.st.damage, 0, 'garage repaired');
assert.strictEqual(game.profile.money, moneyBefore - 200, 'garage charged $200');
game.handleInteract();

game.saveGame(true);
const saved = game.save.readSave();
assert.ok(saved && saved.profile.money === game.profile.money, 'save roundtrip');
assert.deepStrictEqual(Object.keys(saved.missions.status).length, 5);

game.weather.target = 'rain';
game.weather.blend = 0;
for (let i = 0; i < 600; i++) game.update(1 / 60);
assert.ok(game.weather.state.rain > 0.5, `rain active (${game.weather.state.rain.toFixed(2)})`);
assert.ok(game.weather.getGrip() < 0.9, 'rain reduces grip');

game.daynight.hours = 0;
for (let i = 0; i < 10; i++) game.update(1 / 60);
assert.ok(game.daynight.isNight(), 'night detected');
assert.ok(game.world.night > 0.4, 'lamps/windows on at night');

game.settings.quality = 'low';
game.applySettings();
assert.strictEqual(game.traffic.cars.length, 6, 'low quality traffic count');
assert.strictEqual(game.peds.list.length, 10, 'low quality ped count');
game.settings.quality = 'high';
game.applySettings();
assert.strictEqual(game.traffic.cars.length, 14);

for (let i = 0; i < 1200; i++) game.update(1 / 60);
for (const c of game.traffic.cars) {
  assert.ok(Math.abs(c.st.x) < 140 && Math.abs(c.st.z) < 140, 'traffic stays in city');
}
assert.ok(game.time > 40, 'simulated time advanced');

const game2 = new Game({ headless: true });
game2.continueGame();
assert.strictEqual(game2.state, 'playing');
assert.strictEqual(game2.profile.money, game.profile.money, 'loaded money');
assert.strictEqual(game2.profile.stats.missionsCompleted, 5, 'loaded missions');

console.log('headless.mjs: full game simulation passed');
console.log(`  missions: 5/5 done, money: $${game.profile.money}, stats:`, JSON.stringify(game.profile.stats));
console.log(`  world colliders: ${game.world.colliders.boxes.length}, vehicles: ${game.vehicleSys.list.length}, traffic: ${game.traffic.cars.length}, peds: ${game.peds.list.length}`);

// --- soak: random inputs, weather cycles, fail paths, items ---
const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE'];
for (let i = 0; i < 3000; i++) {
  if (Math.random() < 0.03) game.input.keys.add(keys[Math.floor(Math.random() * keys.length)]);
  if (Math.random() < 0.03) for (const k of [...game.input.keys]) game.input.keys.delete(k);
  if (Math.random() < 0.01) game.input.touch.jump = true;
  if (Math.random() < 0.005) game.input.touch.interact = true;
  game.update(1 / 60);
}
assert.ok(game.time > 90, 'soak ran');

for (const w of ['cloudy', 'rain', 'fog', 'clear']) {
  game.weather.target = w;
  game.weather.blend = 0;
  for (let i = 0; i < 500; i++) { game.weather.timer = 9999; game.update(1 / 60); }
  assert.strictEqual(game.weather.current, w, `weather reached ${w}`);
}

game.missions.status.m1 = 'available';
game.missions.pads.m1.mesh.visible = true;
assert.ok(game.missions.start('m1'));
game.missions.timer = 0.5;
for (let i = 0; i < 60; i++) game.update(1 / 60);
assert.strictEqual(game.missions.status.m1, 'available', 'timeout fails mission back to available');
assert.ok(!game.missions.active);

game.missions.status.m5 = 'available';
game.missions.pads.m5.mesh.visible = true;
assert.ok(game.missions.start('m5'));
const rival = game.missions.rival;
assert.ok(rival, 'rival spawned');
for (const gt of game.missions.gates) {
  rival.st.x = gt.x; rival.st.z = gt.z;
  game.update(1 / 60);
}
assert.strictEqual(game.missions.status.m5, 'available', 'rival finishing first fails the race');

game.profile.addItem('coffee');
game.profile.addItem('nitro');
game.profile.addItem('repair');
game.useItem('coffee');
assert.ok(game.player.boost > 0, 'coffee boost active');
if (game.vehicleSys.current) game.vehicleSys.exit();
const v5 = game.vehicleSys.list[4];
v5.st.speed = 0;
game.vehicleSys.enter(v5);
game.useItem('nitro');
assert.ok(v5.st.speed > 10, 'nitro boosted speed');
v5.st.damage = 80;
game.useItem('repair');
assert.strictEqual(v5.st.damage, 0, 'repair kit works');
game.vehicleSys.exit();

console.log('headless.mjs: soak + fail-path tests passed');

// --- touch input simulation (mobile controls) ---
for (const k of [...game.input.keys]) game.input.keys.delete(k);
if (game.vehicleSys.current) game.vehicleSys.exit();
const tp0 = { x: game.player.pos.x, z: game.player.pos.z };
game.input.touch.moveY = -1;
for (let i = 0; i < 120; i++) game.update(1 / 60);
game.input.touch.moveY = 0;
const tMoved = Math.hypot(game.player.pos.x - tp0.x, game.player.pos.z - tp0.z);
assert.ok(tMoved > 2, `touch joystick moved player ${tMoved.toFixed(1)}m`);
const tyaw0 = game.cam.yaw;
game.input.touch.lookDX = 60;
game.update(1 / 60);
assert.ok(Math.abs(game.cam.yaw - tyaw0) > 0.05, 'touch drag rotates camera');
const tv = game.vehicleSys.list[5];
tv.st.speed = 0;
game.player.pos.set(tv.st.x + 1, 0.1, tv.st.z);
game.input.touch.interact = true;
game.update(1 / 60);
assert.strictEqual(game.vehicleSys.current, tv, 'touch E button enters vehicle');
game.input.touch.gas = true;
for (let i = 0; i < 180; i++) game.update(1 / 60);
game.input.touch.gas = false;
assert.ok(Math.abs(tv.st.speed) > 3 || game.profile.stats.distanceDriven > 300, 'touch GAS drives the car');
console.log('headless.mjs: touch input tests passed');
