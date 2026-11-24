import assert from 'node:assert';

const { CFG, VEHICLE_TYPES } = await import('../src/config.js');
const grid = await import('../src/citygrid.js');
const { ColliderWorld } = await import('../src/collision.js');
const phys = await import('../src/physics.js');
const { Profile } = await import('../src/profile.js');
const { SaveSystem } = await import('../src/save.js');
const utils = await import('../src/utils.js');

assert.deepStrictEqual(CFG.city.roads, [-120, -60, 0, 60, 120]);
assert.strictEqual(Object.keys(VEHICLE_TYPES).length, 5, 'need 5 vehicle types');

assert.ok(grid.isOnRoad(0, 0), 'center is intersection/road');
assert.ok(grid.isOnRoad(-120, 55), 'on road line');
assert.ok(!grid.isOnRoad(30, 30), 'block center is not road');
assert.strictEqual(grid.groundHeight(0, 0), 0.03, 'road height');
assert.strictEqual(grid.groundHeight(30, 30), 0.07, 'plaza height');
assert.strictEqual(grid.groundHeight(90, 90), 0.09, 'park height');
assert.strictEqual(grid.groundHeight(500, 500), 0, 'outside city');
assert.strictEqual(grid.surfaceType(0, 0), 'road');
assert.strictEqual(grid.surfaceType(30, 30), 'plaza');
assert.strictEqual(grid.surfaceType(90, 90), 'park');
assert.strictEqual(grid.surfaceType(500, 0), 'grass');
assert.ok(grid.inCity(0, 0) && !grid.inCity(200, 0));
const sp = grid.sampleRoadPoint();
assert.ok(grid.isOnRoad(sp.x, sp.z, 3), 'sampled road point is on road');
const sw = grid.sampleSidewalkPoint();
assert.ok(grid.inCity(sw.x, sw.z));

const cw = new ColliderWorld();
cw.addBox(0, 0, 4, 4, 10);
let r = cw.resolveCircle(0, 0, 0.5, 0.1);
assert.ok(r.hit, 'circle inside box collides');
assert.ok(Math.hypot(r.x, r.z) >= 2.4, 'pushed out of box');
r = cw.resolveCircle(0, 0, 0.5, 11);
assert.ok(!r.hit, 'no collision above box top');
r = cw.resolveCircle(10, 10, 0.5, 0.1);
assert.ok(!r.hit, 'far away no collision');
cw.addCylinder(5, 0, 0.5, 3);
r = cw.resolveCircle(5.2, 0, 0.5, 0.1);
assert.ok(r.hit, 'cylinder collider works');

let st = phys.createCarState();
st.x = 0; st.z = 0; st.yaw = 0;
const type = VEHICLE_TYPES.sports;
for (let i = 0; i < 600; i++) phys.stepCar(st, { throttle: 1, brake: 0, steer: 0 }, type, 1 / 60, 1, false);
assert.ok(st.speed > 25, `accelerates (speed=${st.speed.toFixed(1)})`);
assert.ok(st.z > 50, 'moves forward along +z');
for (let i = 0; i < 600; i++) phys.stepCar(st, { throttle: 0, brake: 1, steer: 0 }, type, 1 / 60, 1, false);
assert.ok(Math.abs(st.speed) < 0.5 || st.speed < 0, 'brakes / reverses');
const yaw0 = st.yaw;
st.speed = 12;
for (let i = 0; i < 60; i++) phys.stepCar(st, { throttle: 0, brake: 0, steer: 1 }, type, 1 / 60, 1, false);
assert.ok(st.yaw < yaw0, 'steering right decreases yaw');

const p = new Profile();
p.addMoney(100);
assert.strictEqual(p.money, 350);
assert.ok(p.spend(50) && p.money === 300);
assert.ok(!p.spend(1000));
p.addItem('coffee');
assert.ok(p.useItem('coffee') && !p.useItem('coffee'));

const sv = new SaveSystem();
assert.ok(!sv.hasSave());
sv.writeSave({ profile: p.serialize() });
assert.ok(sv.hasSave());
const back = sv.readSave();
assert.strictEqual(back.profile.money, 300);
sv.writeSettings({ quality: 'high' });
assert.strictEqual(sv.readSettings().quality, 'high');

assert.strictEqual(utils.clamp(5, 0, 3), 3);
assert.strictEqual(utils.fmtTime(75), '1:15');
assert.strictEqual(utils.fmtMoney(1234567), '$1,234,567');

for (const f of ['world', 'daynight', 'weather', 'traffic', 'pedestrians', 'player', 'vehicles', 'camera', 'pickups', 'missions', 'hud', 'ui', 'touch', 'main', 'input', 'audio']) {
  await import(`../src/${f}.js`);
}

console.log('check.mjs: all pure-logic tests passed');
