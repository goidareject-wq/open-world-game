import * as THREE from 'three';
import { CFG } from './config.js';
import { sampleSidewalkPoint } from './citygrid.js';
import { rand, choice, clamp, dampAngle } from './utils.js';

const C = CFG.city;
const RING_HALF = C.blockSize / 2 + C.sidewalk / 2;

function ringPoint(bx, bz, t) {
  const per = RING_HALF * 8;
  t = ((t % per) + per) % per;
  const side = Math.floor(t / (RING_HALF * 2));
  const o = t % (RING_HALF * 2);
  if (side === 0) return { x: bx - RING_HALF + o, z: bz - RING_HALF, dx: 1, dz: 0 };
  if (side === 1) return { x: bx + RING_HALF, z: bz - RING_HALF + o, dx: 0, dz: 1 };
  if (side === 2) return { x: bx + RING_HALF - o, z: bz + RING_HALF, dx: -1, dz: 0 };
  return { x: bx - RING_HALF, z: bz + RING_HALF - o, dx: 0, dz: -1 };
}

const SKIN = [0xe8b88a, 0xc98d5e, 0x8a5a3a, 0xf0c8a0, 0x6a4526];
const SHIRT = [0xd1544a, 0x4a76d1, 0x4ad17a, 0xd1b44a, 0x8a4ad1, 0xd16a9a, 0xdddddd, 0x3a3f45];
const PANTS = [0x2a3040, 0x4a3a2a, 0x303030, 0x3a4a5a];

function makePedMesh() {
  const g = new THREE.Group();
  const skin = choice(SKIN);
  const shirt = choice(SHIRT);
  const pants = choice(PANTS);
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.62, 0.26), shirtMat);
  body.position.y = 0.98;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), skinMat);
  head.position.y = 1.45;
  head.castShadow = true;
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), new THREE.MeshStandardMaterial({ color: choice([0x201812, 0x4a3a20, 0x777777, 0x2a2a2a]) }));
  hair.position.y = 1.62;
  g.add(body, head, hair);
  const armGeo = new THREE.BoxGeometry(0.12, 0.55, 0.12);
  armGeo.translate(0, -0.26, 0);
  const legGeo = new THREE.BoxGeometry(0.16, 0.66, 0.16);
  legGeo.translate(0, -0.33, 0);
  const armL = new THREE.Group();
  armL.position.set(-0.29, 1.26, 0);
  armL.add(new THREE.Mesh(armGeo, shirtMat));
  const armR = new THREE.Group();
  armR.position.set(0.29, 1.26, 0);
  armR.add(new THREE.Mesh(armGeo, shirtMat));
  const legL = new THREE.Group();
  legL.position.set(-0.12, 0.66, 0);
  legL.add(new THREE.Mesh(legGeo, pantsMat));
  const legR = new THREE.Group();
  legR.position.set(0.12, 0.66, 0);
  legR.add(new THREE.Mesh(legGeo, pantsMat));
  g.add(armL, armR, legL, legR);
  g.userData = { armL, armR, legL, legR, body, head };
  return g;
}

export class Pedestrians {
  constructor(game) {
    this.game = game;
    this.list = [];
    this._spawnInitial();
  }

  setCount(n) {
    while (this.list.length < n) this._spawnPed();
    if (this.list.length > n) {
      for (let i = this.list.length - 1; i >= n; i--) this.game.scene.remove(this.list[i].mesh);
      this.list.length = n;
    }
  }

  _spawnInitial() {
    const q = this.game.settings.quality;
    const n = CFG.counts.peds[q] || 16;
    for (let i = 0; i < n; i++) this._spawnPed();
  }

  _spawnPed() {
    const mesh = makePedMesh();
    this.game.scene.add(mesh);
    const p = sampleSidewalkPoint();
    const bi = C.blocks[Math.floor(Math.random() * C.blocks.length)];
    const bj = C.blocks[Math.floor(Math.random() * C.blocks.length)];
    const ped = {
      mesh, x: p.x, z: p.z, yaw: 0,
      bx: bi, bz: bj,
      t: rand(0, RING_HALF * 8),
      dir: Math.random() < 0.5 ? 1 : -1,
      speed: rand(1.0, 1.9),
      phase: rand(0, 6),
      state: 'walk',
      downTimer: 0,
      respawnTimer: 0,
    };
    this.list.push(ped);
  }

  respawn(ped) {
    const p = sampleSidewalkPoint();
    ped.x = p.x;
    ped.z = p.z;
    ped.bx = C.blocks[Math.floor(Math.random() * C.blocks.length)];
    ped.bz = C.blocks[Math.floor(Math.random() * C.blocks.length)];
    ped.t = rand(0, RING_HALF * 8);
    ped.dir = Math.random() < 0.5 ? 1 : -1;
    ped.state = 'walk';
    ped.mesh.rotation.set(0, 0, 0);
    ped.mesh.visible = true;
    ped.mesh.material = null;
  }

  update(dt) {
    const player = this.game.player;
    for (const ped of this.list) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        ped.mesh.rotation.z = Math.min(Math.PI / 2, ped.mesh.rotation.z + dt * 6);
        if (ped.downTimer <= 0) {
          ped.respawnTimer += dt;
          if (ped.respawnTimer > 3) { ped.respawnTimer = 0; this.respawn(ped); }
        }
        continue;
      }
      ped.t += ped.dir * ped.speed * dt;
      const rp = ringPoint(ped.bx, ped.bz, ped.t);
      ped.x = rp.x;
      ped.z = rp.z;
      const targetYaw = Math.atan2(rp.dx, rp.dz);
      ped.yaw = dampAngle(ped.yaw, targetYaw, 8, dt);
      if (player.mesh.visible) {
        const dx = ped.x - player.pos.x;
        const dz = ped.z - player.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 1.1 && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          ped.x += (dx / d) * dt * 2;
          ped.z += (dz / d) * dt * 2;
        }
      }
      ped.phase += ped.speed * dt * 4.2;
      const s = Math.sin(ped.phase);
      const ud = ped.mesh.userData;
      ud.legL.rotation.x = s * 0.65;
      ud.legR.rotation.x = -s * 0.65;
      ud.armL.rotation.x = -s * 0.5;
      ud.armR.rotation.x = s * 0.5;
      ped.mesh.position.set(ped.x, 0.05, ped.z);
      ped.mesh.rotation.y = ped.yaw;
    }
  }
}
