import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, damp, dampAngle, choice } from './utils.js';
import { groundHeight } from './citygrid.js';

const P = CFG.player;

function makePlayerMesh() {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.8 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x2f7fd1, roughness: 0.9 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), shirtMat);
  body.position.y = 0.98;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), skinMat);
  head.position.y = 1.47;
  head.castShadow = true;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.34), new THREE.MeshStandardMaterial({ color: 0xd13438, roughness: 0.7 }));
  cap.position.y = 1.66;
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.18), cap.material);
  brim.position.set(0, 1.63, 0.22);
  g.add(body, head, cap, brim);
  const armGeo = new THREE.BoxGeometry(0.13, 0.58, 0.13);
  armGeo.translate(0, -0.28, 0);
  const legGeo = new THREE.BoxGeometry(0.17, 0.66, 0.17);
  legGeo.translate(0, -0.33, 0);
  const armL = new THREE.Group();
  armL.position.set(-0.33, 1.26, 0);
  armL.add(new THREE.Mesh(armGeo, shirtMat));
  const armR = new THREE.Group();
  armR.position.set(0.33, 1.26, 0);
  armR.add(new THREE.Mesh(armGeo, shirtMat));
  const legL = new THREE.Group();
  legL.position.set(-0.13, 0.66, 0);
  legL.add(new THREE.Mesh(legGeo, pantsMat));
  const legR = new THREE.Group();
  legR.position.set(0.13, 0.66, 0);
  legR.add(new THREE.Mesh(legGeo, pantsMat));
  g.add(armL, armR, legL, legR);
  g.userData = { armL, armR, legL, legR, body, head };
  return g;
}

export class Player {
  constructor(game) {
    this.game = game;
    this.mesh = makePlayerMesh();
    this.game.scene.add(this.mesh);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.yaw = 0;
    this.onGround = true;
    this.radius = P.radius;
    this.boost = 0;
    this.phase = 0;
    this.landed = false;
    const s = game.world.spawn;
    this.pos.set(s.x, groundHeight(s.x, s.z), s.z);
    this.yaw = s.yaw;
  }

  reset() {
    const s = this.game.world.spawn;
    this.pos.set(s.x, groundHeight(s.x, s.z), s.z);
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.yaw = s.yaw;
    this.boost = 0;
    this.mesh.visible = true;
  }

  useCoffee() {
    if (!this.game.profile.useItem('coffee')) return false;
    this.boost = CFG.player.boostTime;
    this.game.audio.item();
    return true;
  }

  update(dt) {
    const g = this.game;
    if (g.vehicleSys.current) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    const st = g.input.state;
    const camYaw = g.cam.yaw;
    let ix = st.right - st.left;
    let iz = st.forward - st.back;
    const len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; }
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    const mx = sin * iz - cos * ix;
    const mz = cos * iz + sin * ix;
    const boostMul = this.boost > 0 ? P.boostMult : 1;
    if (this.boost > 0) this.boost -= dt;
    const speed = (st.sprint ? P.sprint : P.walk) * boostMul;
    const accel = this.onGround ? P.accel : P.airAccel;
    this.vel.x = damp(this.vel.x, mx * speed, accel / Math.max(1, speed) * 4, dt);
    this.vel.z = damp(this.vel.z, mz * speed, accel / Math.max(1, speed) * 4, dt);
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (hSpeed > 0.4) {
      const targetYaw = Math.atan2(this.vel.x, this.vel.z);
      this.yaw = dampAngle(this.yaw, targetYaw, 14, dt);
    }
    if (g.input.consumeJump() && this.onGround) {
      this.vy = P.jumpVel;
      this.onGround = false;
      g.profile.stats.jumps++;
      g.audio.jump();
    }
    this.vy -= P.gravity * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vy * dt;
    const ground = groundHeight(this.pos.x, this.pos.z);
    if (this.pos.y <= ground) {
      if (!this.onGround && this.vy < -6) g.audio.land();
      this.pos.y = ground;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = this.pos.y - ground < 0.02;
    }
    const res = g.world.colliders.resolveCircle(this.pos.x, this.pos.z, this.radius, this.pos.y);
    if (res.hit) {
      this.pos.x = res.x;
      this.pos.z = res.z;
    }
    const all = g.vehicleSys.list.concat(g.traffic ? g.traffic.cars : []);
    for (const veh of all) {
      if (veh === g.vehicleSys.current) continue;
      const dx = this.pos.x - veh.st.x;
      const dz = this.pos.z - veh.st.z;
      const rr = veh.type.size.w * 0.62 + this.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        this.pos.x = veh.st.x + (dx / d) * rr;
        this.pos.z = veh.st.z + (dz / d) * rr;
      }
    }
    g.profile.stats.distanceWalked += hSpeed * dt;
    this.phase += hSpeed * dt * 2.4;
    const s = Math.sin(this.phase);
    const ud = this.mesh.userData;
    const moving = hSpeed > 0.6;
    ud.legL.rotation.x = moving ? s * 0.8 : 0;
    ud.legR.rotation.x = moving ? -s * 0.8 : 0;
    ud.armL.rotation.x = moving ? -s * 0.6 : Math.sin(performance.now() * 0.0016) * 0.06;
    ud.armR.rotation.x = moving ? s * 0.6 : -Math.sin(performance.now() * 0.0016) * 0.06;
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.mesh.rotation.y = this.yaw;
  }
}
