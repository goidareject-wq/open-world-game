import * as THREE from 'three';
import { CFG } from './config.js';
import { sampleCityPoint, groundHeight } from './citygrid.js';
import { rand, choice } from './utils.js';

export function makeOrbMesh(color = 0xffd24a) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.6 })
  );
  g.add(core);
  return g;
}

const ITEM_SPOTS = [
  { x: 33, z: -33, type: 'coffee' },
  { x: -33, z: 33, type: 'nitro' },
  { x: 33, z: 33, type: 'repair' },
  { x: -33, z: -33, type: 'coffee' },
  { x: 94, z: 94, type: 'nitro' },
  { x: -94, z: 94, type: 'repair' },
];

const ITEM_COLORS = { coffee: 0x8a5a2b, nitro: 0x2bd1c8, repair: 0xd1a02b };

export class Pickups {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.orbs = [];
    this.items = [];
    for (let i = 0; i < CFG.counts.orbs; i++) this.spawnOrb();
    for (const s of ITEM_SPOTS) this.spawnItem(s.x, s.z, s.type);
  }

  reset() {
    for (const o of this.orbs) this.group.remove(o.mesh);
    for (const it of this.items) this.group.remove(it.mesh);
    this.orbs = [];
    this.items = [];
    for (let i = 0; i < CFG.counts.orbs; i++) this.spawnOrb();
    for (const s of ITEM_SPOTS) this.spawnItem(s.x, s.z, s.type);
  }

  spawnOrb() {
    const p = sampleCityPoint();
    const mesh = makeOrbMesh();
    const y = groundHeight(p.x, p.z);
    mesh.position.set(p.x, y + 0.7, p.z);
    this.group.add(mesh);
    this.orbs.push({ mesh, x: p.x, z: p.z, y, value: choice([25, 50, 50, 75, 100]), active: true, timer: 0 });
  }

  spawnItem(x, z, type) {
    const mesh = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.55, 0.55),
      new THREE.MeshStandardMaterial({ color: ITEM_COLORS[type], emissive: ITEM_COLORS[type], emissiveIntensity: 0.7, roughness: 0.4 })
    );
    mesh.add(box);
    const y = groundHeight(x, z);
    mesh.position.set(x, y + 0.8, z);
    this.group.add(mesh);
    this.items.push({ mesh, x, z, y, type, active: true, timer: 0 });
  }

  collectPoint() {
    const g = this.game;
    if (g.vehicleSys.current) {
      const st = g.vehicleSys.current.st;
      return { x: st.x, z: st.z };
    }
    return { x: g.player.pos.x, z: g.player.pos.z };
  }

  update(dt, time) {
    const g = this.game;
    const p = this.collectPoint();
    for (const o of this.orbs) {
      if (!o.active) {
        o.timer -= dt;
        if (o.timer <= 0) {
          const np = sampleCityPoint();
          o.x = np.x; o.z = np.z;
          o.y = groundHeight(np.x, np.z);
          o.value = choice([25, 50, 50, 75, 100]);
          o.mesh.position.set(o.x, o.y + 0.7, o.z);
          o.active = true;
          o.mesh.visible = true;
        }
        continue;
      }
      o.mesh.rotation.y += dt * 2.4;
      o.mesh.position.y = o.y + 0.7 + Math.sin(time * 2 + o.x) * 0.15;
      const dx = p.x - o.x;
      const dz = p.z - o.z;
      if (dx * dx + dz * dz < 2.6) {
        o.active = false;
        o.mesh.visible = false;
        o.timer = 25;
        g.profile.addMoney(o.value);
        g.profile.stats.orbsCollected++;
        g.audio.pickup();
        g.hud.flashMoney(o.value);
      }
    }
    for (const it of this.items) {
      if (!it.active) {
        it.timer -= dt;
        if (it.timer <= 0) {
          it.active = true;
          it.mesh.visible = true;
          it.timer = 0;
        }
        continue;
      }
      it.mesh.rotation.y += dt * 1.8;
      it.mesh.position.y = it.y + 0.8 + Math.sin(time * 2.4 + it.z) * 0.12;
      const dx = p.x - it.x;
      const dz = p.z - it.z;
      if (dx * dx + dz * dz < 2.2) {
        it.active = false;
        it.mesh.visible = false;
        it.timer = 40;
        g.profile.addItem(it.type);
        g.audio.item();
        g.hud.toast(`Picked up ${g.profile.itemName(it.type)} — press ${CFG.itemTypes.indexOf(it.type) + 1} to use`, 'item');
      }
    }
  }
}
