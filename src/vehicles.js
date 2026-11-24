import * as THREE from 'three';
import { VEHICLE_TYPES } from './config.js';
import { createCarState, stepCar, impactDamage } from './physics.js';
import { surfaceType, groundHeight } from './citygrid.js';
import { clamp } from './utils.js';

export function makeCarMesh(type) {
  const { l, w, h } = type.size;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.35, metalness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2530, roughness: 0.1, metalness: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
  const bodyH = h * 0.52;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, l), bodyMat);
  body.position.y = 0.32 + bodyH / 2;
  body.castShadow = true;
  g.add(body);
  const cabH = h * 0.42;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, cabH, l * 0.48), glassMat);
  cab.position.set(0, 0.32 + bodyH + cabH / 2 - 0.02, -l * 0.06);
  cab.castShadow = true;
  g.add(cab);
  if (type === VEHICLE_TYPES.truck) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h * 0.3, l * 0.34), bodyMat);
    bed.position.set(0, 0.32 + h * 0.15, l * 0.32);
    bed.castShadow = true;
    g.add(bed);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  const wpos = [
    [-w / 2 + 0.14, l / 2 - 0.75],
    [w / 2 - 0.14, l / 2 - 0.75],
    [-w / 2 + 0.14, -l / 2 + 0.75],
    [w / 2 - 0.14, -l / 2 + 0.75],
  ];
  for (const [wx, wz] of wpos) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.position.set(wx, 0.34, wz);
    wheel.castShadow = true;
    g.add(wheel);
    wheels.push(wheel);
  }
  const headMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, emissive: 0xfff6d8, emissiveIntensity: 0 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2211, emissiveIntensity: 0.6 });
  const headlights = [];
  for (const hx of [-w / 4, w / 4]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(w / 5, 0.12, 0.06), headMat);
    hl.position.set(hx, 0.55, l / 2 + 0.01);
    g.add(hl);
    headlights.push(hl);
  }
  for (const hx of [-w / 4, w / 4]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(w / 5, 0.1, 0.06), tailMat);
    tl.position.set(hx, 0.58, -l / 2 - 0.01);
    g.add(tl);
  }
  g.userData = { wheels, headMat, tailMat, bodyMat };
  return g;
}

export class VehicleSystem {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.current = null;
    this.nitroTime = 0;
    this.shake = 0;
    const types = ['sedan', 'sports', 'suv', 'truck', 'van', 'sedan', 'suv', 'van'];
    game.world.parkedSpots.forEach((spot, i) => {
      this.addVehicle(types[i % types.length], spot.x, spot.z, spot.yaw);
    });
  }

  addVehicle(typeKey, x, z, yaw) {
    const type = VEHICLE_TYPES[typeKey];
    const mesh = makeCarMesh(type);
    mesh.position.set(x, 0.03, z);
    mesh.rotation.y = yaw;
    this.game.scene.add(mesh);
    const v = {
      kind: 'parked', typeKey, type, mesh, x, z, yaw,
      homeX: x, homeZ: z, homeYaw: yaw,
      st: { ...createCarState(), x, z, yaw },
      entered: false,
    };
    this.list.push(v);
    return v;
  }

  nearestTo(x, z, maxDist) {
    let best = null;
    let bd = maxDist;
    const all = this.list.concat(this.game.traffic ? this.game.traffic.cars : []);
    for (const v of all) {
      const d = Math.hypot(v.st.x - x, v.st.z - z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  enter(v) {
    if (this.current) return;
    if (Math.abs(v.st.speed) > 6) return false;
    this.current = v;
    v.entered = true;
    this.game.player.mesh.visible = false;
    this.game.audio.engineStart();
    this.game.audio.enter();
    this.game.hud.setMode('vehicle');
    return true;
  }

  exit() {
    const v = this.current;
    if (!v) return;
    const p = this.game.player;
    const type = v.type;
    const side = Math.cos(v.st.yaw) * (type.size.w / 2 + 0.8);
    const sideZ = -Math.sin(v.st.yaw) * (type.size.w / 2 + 0.8);
    let nx = v.st.x + side;
    let nz = v.st.z + sideZ;
    const res = this.game.world.colliders.resolveCircle(nx, nz, p.radius, 0.1);
    if (res.hit) {
      nx = v.st.x - side;
      nz = v.st.z - sideZ;
    }
    p.pos.set(nx, groundHeight(nx, nz), nz);
    p.vel.set(0, 0, 0);
    p.mesh.visible = true;
    this.current = null;
    v.entered = false;
    this.game.audio.engineStop();
    this.game.hud.setMode('foot');
  }

  toggleEnter() {
    if (this.current) { this.exit(); return; }
    const p = this.game.player;
    const v = this.nearestTo(p.pos.x, p.pos.z, 3.4);
    if (v) this.enter(v);
    else this.game.audio.denied();
  }

  useNitro() {
    if (!this.current) return false;
    if (!this.game.profile.useItem('nitro')) return false;
    this.current.st.speed = Math.min(this.current.type.topSpeed * 1.35, this.current.st.speed + 15);
    this.nitroTime = 1.2;
    this.game.audio.blip(200, 0.4, 'sawtooth', 0.2, 500);
    return true;
  }

  repairCurrent() {
    if (this.current) this.current.st.damage = 0;
  }

  getSpeedKmh() {
    return this.current ? Math.abs(this.current.st.speed) * 3.6 : 0;
  }

  update(dt) {
    const g = this.game;
    for (const v of this.list) this.syncMesh(v, dt);
    if (g.traffic) for (const c of g.traffic.cars) this.syncMesh(c, dt);

    const v = this.current;
    if (!v) return;
    const st = v.st;
    const inp = g.input.state;
    const offroad = surfaceType(st.x, st.z) === 'plaza' || surfaceType(st.x, st.z) === 'park' || surfaceType(st.x, st.z) === 'grass';
    const grip = g.weather.getGrip();
    const prevSpeed = st.speed;
    const throttle = this.nitroTime > 0 ? 1 : inp.forward;
    const input = { throttle, brake: inp.brake || inp.handbrake ? 1 : 0, steer: inp.right - inp.left };
    stepCar(st, input, v.type, dt, grip, offroad);
    if (this.nitroTime > 0) {
      this.nitroTime -= dt;
      st.speed = Math.min(v.type.topSpeed * 1.35, st.speed + v.type.accel * 1.4 * dt);
    }

    const res = g.world.colliders.resolveOBB(st.x, st.z, st.yaw, v.type.size.l, v.type.size.w, 0.2);
    if (res.hit) {
      st.x = res.x;
      st.z = res.z;
      const impact = Math.abs(prevSpeed - st.speed) + Math.abs(st.speed) * 0.5;
      st.damage = impactDamage(st, prevSpeed, v.type.mass);
      st.speed = -st.speed * 0.25;
      if (impact > 2) {
        g.audio.crash(impact / 8);
        g.profile.stats.crashes++;
        this.shake = Math.min(1, impact / 10);
      }
    }

    const all = this.list.concat(g.traffic ? g.traffic.cars : []);
    for (const o of all) {
      if (o === v) continue;
      const dx = st.x - o.st.x;
      const dz = st.z - o.st.z;
      const rr = (v.type.size.l + o.type.size.l) / 4 + 0.4;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 0.01;
        const push = (rr - d);
        st.x += (dx / d) * push;
        st.z += (dz / d) * push;
        st.damage = impactDamage(st, prevSpeed, v.type.mass);
        st.speed *= 0.4;
        o.st.speed *= 0.4;
        if (Math.abs(st.speed) > 3) {
          g.audio.crash(Math.abs(st.speed) / 10);
          g.profile.stats.crashes++;
          this.shake = Math.min(1, Math.abs(st.speed) / 12);
        }
      }
    }

    if (g.peds) {
      for (const ped of g.peds.list) {
        if (ped.state !== 'walk') continue;
        const dx = st.x - ped.x;
        const dz = st.z - ped.z;
        if (dx * dx + dz * dz < 2.2 && Math.abs(st.speed) > 2) {
          ped.knockDown(st.speed);
          g.audio.crash(0.6);
        }
      }
    }

    g.profile.stats.distanceDriven += Math.abs(st.speed) * dt;
    g.profile.stats.topSpeed = Math.max(g.profile.stats.topSpeed, Math.abs(st.speed) * 3.6);
    g.audio.engineUpdate(clamp(Math.abs(st.speed) / v.type.topSpeed, 0, 1), throttle);
    const night = g.daynight.night;
    const lights = night > 0.35 || g.weather.state.rain > 0.3;
    v.mesh.userData.headMat.emissiveIntensity = lights ? 2.2 : 0;
  }

  syncMesh(v, dt) {
    const st = v.st;
    const gy = groundHeight(st.x, st.z);
    v.mesh.position.set(st.x, gy + 0.02, st.z);
    v.mesh.rotation.y = st.yaw;
    const ud = v.mesh.userData;
    if (ud && ud.wheels) {
      const spin = (st.speed * dt) / 0.34;
      for (let i = 0; i < ud.wheels.length; i++) {
        ud.wheels[i].rotation.x += spin;
        if (i < 2) ud.wheels[i].rotation.y = -st.steer * 0.5;
      }
    }
  }
}
