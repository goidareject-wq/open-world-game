import * as THREE from 'three';
import { CFG } from './config.js';
import { sampleCityPoint, sampleSidewalkPoint, sampleRoadPoint, groundHeight, isOnRoad } from './citygrid.js';
import { rand, choice, clamp, fmtTime, dampAngle } from './utils.js';
import { makeOrbMesh } from './pickups.js';
import { makeCarMesh } from './vehicles.js';
import { VEHICLE_TYPES } from './config.js';
import { createCarState, stepCar } from './physics.js';

const DEFS = [
  {
    id: 'm1', title: 'First Delivery', reward: 500,
    desc: 'Pick up the package, then deliver it to the drop point before time runs out.',
    objective: 'Go to the package',
  },
  {
    id: 'm2', title: 'Cash Rush', reward: 750,
    desc: 'Collect all 10 marked cash stashes scattered around the city.',
    objective: 'Collect the marked stashes',
  },
  {
    id: 'm3', title: 'Checkpoint Rush', reward: 1000,
    desc: 'Drive through all 6 checkpoints in order before the timer ends.',
    objective: 'Enter a vehicle and hit the checkpoints',
  },
  {
    id: 'm4', title: 'Taxi Service', reward: 1500,
    desc: 'Pick up 3 passengers and drop each one at their destination.',
    objective: 'Pick up the first passenger',
  },
  {
    id: 'm5', title: 'Street Race', reward: 2500,
    desc: 'Beat the rival racer through all 4 gates. First to the finish wins.',
    objective: 'Enter a vehicle and beat the rival to the gates',
  },
];

function makePillar(color) {
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.3, 7, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  cyl.position.y = 3.5;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.0, 0.12, 8, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.12;
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.4, 4),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  arrow.rotation.x = Math.PI;
  arrow.position.y = 8.2;
  g.add(cyl, ring, arrow);
  g.userData.arrow = arrow;
  return g;
}

function makeGate() {
  const g = new THREE.Group();
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(5, 0.35, 10, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  torus.position.y = 4.2;
  g.add(torus);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(5.4, 5.4, 0.18, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  base.position.y = 0.1;
  g.add(base);
  return g;
}

function randomRoute(count) {
  const roads = CFG.city.roads;
  const pts = [];
  let ri = Math.floor(rand(0, roads.length));
  let rj = Math.floor(rand(0, roads.length));
  for (let i = 0; i < count; i++) {
    pts.push({ x: roads[ri], z: roads[rj] });
    if (Math.random() < 0.5) ri = clamp(ri + choice([-1, 1]), 0, roads.length - 1);
    else rj = clamp(rj + choice([-1, 1]), 0, roads.length - 1);
  }
  return pts;
}

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.defs = DEFS;
    this.status = {};
    this.pads = {};
    this.active = null;
    this.timer = 0;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    for (const d of DEFS) {
      this.status[d.id] = 'available';
      const p = game.world.missionPads[d.id];
      const m = makePillar(0x35d0ff);
      m.position.set(p.x, groundHeight(p.x, p.z), p.z);
      this.group.add(m);
      this.pads[d.id] = { mesh: m, x: p.x, z: p.z, def: d };
    }
    this.obj = null;
    this.orbs = [];
    this.gates = [];
    this.rival = null;
  }

  reset() {
    for (const d of this.defs) this.status[d.id] = 'available';
    this.clearActive();
    for (const id in this.pads) this.pads[id].mesh.visible = true;
  }

  serialize() {
    return { status: { ...this.status } };
  }

  deserialize(d) {
    this.reset();
    if (!d || !d.status) return;
    for (const id in d.status) {
      if (d.status[id] === 'done') {
        this.status[id] = 'done';
        if (this.pads[id]) this.pads[id].mesh.visible = false;
      }
    }
  }

  clearActive() {
    if (this.obj) {
      this.group.remove(this.obj.mesh);
      this.obj = null;
    }
    for (const o of this.orbs) this.group.remove(o.mesh);
    this.orbs = [];
    for (const gt of this.gates) this.group.remove(gt.mesh);
    this.gates = [];
    if (this.rival) {
      this.game.scene.remove(this.rival.mesh);
      this.rival = null;
    }
    this.active = null;
    this.timer = 0;
  }

  start(id) {
    if (this.active || this.status[id] !== 'available') return false;
    const def = this.defs.find((d) => d.id === id);
    this.status[id] = 'active';
    this.pads[id].mesh.visible = false;
    this.active = { def, stage: 0, data: {} };
    const g = this.game;
    g.audio.missionStart();
    g.hud.toast(`Mission started: ${def.title}`, 'mission');
    if (id === 'm1') {
      const a = sampleCityPoint();
      const b = sampleCityPoint();
      this.active.data = { a, b, stage: 0 };
      this.timer = 100;
      this.setObjective(a.x, a.z, 0xffd24a, 'Go to the package');
    } else if (id === 'm2') {
      this.active.data = { collected: 0, total: 10 };
      this.timer = 240;
      for (let i = 0; i < 10; i++) {
        const p = sampleCityPoint();
        const mesh = makeOrbMesh(0x7dff5a);
        mesh.position.set(p.x, groundHeight(p.x, p.z) + 0.7, p.z);
        this.group.add(mesh);
        this.orbs.push({ mesh, x: p.x, z: p.z, taken: false });
      }
      this.setObjective(this.orbs[0].x, this.orbs[0].z, 0x7dff5a, 'Collect the stashes (0/10)');
    } else if (id === 'm3') {
      const route = randomRoute(6);
      this.active.data = { route, idx: 0 };
      this.timer = 130;
      for (const p of route) {
        const mesh = makeGate();
        mesh.position.set(p.x, 0.03, p.z);
        this.group.add(mesh);
        this.gates.push({ mesh, x: p.x, z: p.z, done: false });
      }
      this.setObjective(route[0].x, route[0].z, 0xffd24a, 'Hit checkpoint 1/6');
    } else if (id === 'm4') {
      this.active.data = { fare: 0, total: 3, pickup: null, dest: null, carrying: false };
      this.timer = 300;
      this.nextFare();
    } else if (id === 'm5') {
      const route = randomRoute(4);
      this.active.data = { route, idx: 0, rivalIdx: 0, rivalDone: false };
      this.timer = 160;
      for (const p of route) {
        const mesh = makeGate();
        mesh.position.set(p.x, 0.03, p.z);
        this.group.add(mesh);
        this.gates.push({ mesh, x: p.x, z: p.z, done: false });
      }
      const start = sampleRoadPoint();
      const mesh = makeCarMesh(VEHICLE_TYPES.sports);
      mesh.position.set(start.x, 0.03, start.z);
      this.game.scene.add(mesh);
      this.rival = { mesh, st: { ...createCarState(), x: start.x, z: start.z, yaw: start.yaw }, type: VEHICLE_TYPES.sports };
      this.setObjective(route[0].x, route[0].z, 0xffd24a, 'Beat the rival — gate 1/4');
    }
    return true;
  }

  nextFare() {
    const a = this.active;
    if (!a) return;
    const pickup = sampleSidewalkPoint();
    let dest = sampleSidewalkPoint();
    let guard = 0;
    while (Math.hypot(dest.x - pickup.x, dest.z - pickup.z) < 50 && guard++ < 20) dest = sampleSidewalkPoint();
    a.data.pickup = pickup;
    a.data.dest = dest;
    a.data.carrying = false;
    this.setObjective(pickup.x, pickup.z, 0x35d0ff, `Pick up passenger ${a.data.fare + 1}/3`);
  }

  setObjective(x, z, color, text) {
    const g = this.game;
    if (this.obj) this.group.remove(this.obj.mesh);
    const mesh = makePillar(color);
    mesh.position.set(x, groundHeight(x, z), z);
    this.group.add(mesh);
    this.obj = { mesh, x, z, text };
  }

  complete() {
    const a = this.active;
    if (!a) return;
    const g = this.game;
    g.profile.addMoney(a.def.reward);
    g.profile.stats.missionsCompleted++;
    if (a.def.id === 'm5') g.profile.stats.racesWon++;
    this.status[a.def.id] = 'done';
    g.audio.missionDone();
    g.hud.toast(`Mission complete: ${a.def.title}  +$${a.def.reward}`, 'success');
    g.hud.showMissionBanner(a.def.title, a.def.reward);
    this.clearActive();
    g.saveGame(true);
  }

  fail(reason) {
    const a = this.active;
    if (!a) return;
    const g = this.game;
    this.status[a.def.id] = 'available';
    if (this.pads[a.def.id]) this.pads[a.def.id].mesh.visible = true;
    g.audio.missionFail();
    g.hud.toast(`Mission failed: ${a.def.title} — ${reason}`, 'fail');
    this.clearActive();
  }

  getTracker() {
    if (!this.active) {
      const avail = this.defs.filter((d) => this.status[d.id] === 'available');
      if (avail.length) return { title: 'Missions available', objective: `${avail.length} mission${avail.length > 1 ? 's' : ''} — visit a cyan marker`, timeLeft: null };
      return { title: 'All missions complete!', objective: 'Enjoy the city', timeLeft: null };
    }
    const a = this.active;
    let objective = a.def.objective;
    let timeLeft = this.timer > 0 ? this.timer : null;
    if (a.def.id === 'm1') {
      objective = a.data.stage === 0 ? 'Go to the package' : 'Deliver the package before time runs out';
    } else if (a.def.id === 'm2') {
      objective = `Collect the stashes (${a.data.collected}/${a.data.total})`;
    } else if (a.def.id === 'm3') {
      const inVeh = !!this.game.vehicleSys.current;
      objective = inVeh ? `Hit checkpoint ${Math.min(a.data.idx + 1, 6)}/6` : 'Enter a vehicle (E) to start the run';
    } else if (a.def.id === 'm4') {
      const d = a.data;
      objective = d.carrying ? `Drop off passenger ${d.fare + 1}/3 at the marker` : `Pick up passenger ${d.fare + 1}/3 (drive close)`;
    } else if (a.def.id === 'm5') {
      const inVeh = !!this.game.vehicleSys.current;
      objective = inVeh ? `Gate ${Math.min(a.data.idx + 1, 4)}/4 — beat the rival` : 'Enter a vehicle (E) to race';
    }
    if (this.obj && this.obj.text && (a.def.id === 'm1' || a.def.id === 'm4')) objective = this.obj.text;
    return { title: a.def.title, objective, timeLeft };
  }

  activeMarker() {
    if (this.obj) return { x: this.obj.x, z: this.obj.z, color: '#ffd24a' };
    return null;
  }

  padNear(x, z, maxDist = 2.6) {
    for (const id in this.pads) {
      const p = this.pads[id];
      if (this.status[id] === 'available' && Math.hypot(p.x - x, p.z - z) < maxDist) return p;
    }
    return null;
  }

  update(dt, time) {
    for (const id in this.pads) {
      const p = this.pads[id];
      if (p.mesh.visible) {
        p.mesh.userData.arrow.position.y = 8.2 + Math.sin(time * 3 + p.x) * 0.5;
        p.mesh.rotation.y += dt * 0.8;
      }
    }
    const a = this.active;
    if (!a) return;
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) { this.fail('time ran out'); return; }
    }
    const g = this.game;
    const p = g.vehicleSys.current ? { x: g.vehicleSys.current.st.x, z: g.vehicleSys.current.st.z } : { x: g.player.pos.x, z: g.player.pos.z };
    const inVeh = !!g.vehicleSys.current;

    if (a.def.id === 'm1') {
      const d = a.data;
      if (d.stage === 0) {
        if (Math.hypot(p.x - d.a.x, p.z - d.a.z) < 3) {
          d.stage = 1;
          g.audio.item();
          this.setObjective(d.b.x, d.b.z, 0xff8c42, 'Deliver the package');
          g.hud.toast('Package picked up! Deliver it to the orange marker', 'mission');
        }
      } else if (Math.hypot(p.x - d.b.x, p.z - d.b.z) < 3) {
        this.complete();
        return;
      }
    } else if (a.def.id === 'm2') {
      for (const o of this.orbs) {
        if (o.taken) continue;
        if (Math.hypot(p.x - o.x, p.z - o.z) < 2.2) {
          o.taken = true;
          o.mesh.visible = false;
          a.data.collected++;
          g.profile.addMoney(50);
          g.profile.stats.orbsCollected++;
          g.audio.pickup();
          if (a.data.collected >= a.data.total) { this.complete(); return; }
          const next = this.orbs.find((o2) => !o2.taken);
          if (next) this.setObjective(next.x, next.z, 0x7dff5a, `Collect the stashes (${a.data.collected}/${a.data.total})`);
        }
      }
    } else if (a.def.id === 'm3' || a.def.id === 'm5') {
      if (inVeh) {
        const gate = this.gates[a.data.idx];
        if (gate && Math.hypot(p.x - gate.x, p.z - gate.z) < 6.5) {
          gate.done = true;
          gate.mesh.visible = false;
          a.data.idx++;
          g.audio.pickup();
          if (a.def.id === 'm3') {
            if (a.data.idx >= this.gates.length) { this.complete(); return; }
            const nx = this.gates[a.data.idx];
            this.setObjective(nx.x, nx.z, 0xffd24a, `Hit checkpoint ${a.data.idx + 1}/6`);
          } else {
            if (a.data.idx >= this.gates.length) { this.complete(); return; }
            const nx = this.gates[a.data.idx];
            this.setObjective(nx.x, nx.z, 0xffd24a, `Gate ${a.data.idx + 1}/4 — beat the rival`);
          }
        }
      }
      if (a.def.id === 'm5' && this.rival) {
        const r = this.rival;
        if (a.data.rivalIdx < this.gates.length) {
          const target = this.gates[a.data.rivalIdx];
          const dx = target.x - r.st.x;
          const dz = target.z - r.st.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 7) {
            a.data.rivalIdx++;
            if (a.data.rivalIdx >= this.gates.length) { a.data.rivalDone = true; this.fail('the rival finished first'); return; }
          } else {
            const desired = Math.atan2(dx, dz);
            let diff = desired - r.st.yaw;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const steer = clamp(-diff * 2.2, -1, 1);
            const onRoad = isOnRoad(r.st.x, r.st.z, 1);
            stepCar(r.st, { throttle: Math.abs(diff) > 1.2 ? 0.3 : 1, brake: 0, steer }, r.type, dt, 0.95, !onRoad);
          }
        }
      }
    } else if (a.def.id === 'm4') {
      const d = a.data;
      if (!d.carrying && inVeh && Math.hypot(p.x - d.pickup.x, p.z - d.pickup.z) < 4) {
        d.carrying = true;
        g.audio.item();
        this.setObjective(d.dest.x, d.dest.z, 0xff8c42, `Drop off passenger ${d.fare + 1}/3`);
        g.hud.toast('Passenger aboard! Follow the orange marker', 'mission');
      } else if (d.carrying && inVeh && Math.hypot(p.x - d.dest.x, p.z - d.dest.z) < 4) {
        d.carrying = false;
        d.fare++;
        g.profile.stats.faresCompleted++;
        g.profile.addMoney(150);
        g.audio.pickup();
        if (d.fare >= d.total) { this.complete(); return; }
        this.nextFare();
      }
    }

    if (this.obj) {
      this.obj.mesh.userData.arrow.position.y = 8.2 + Math.sin(time * 3.4) * 0.5;
      this.obj.mesh.rotation.y += dt * 1.2;
    }
  }
}
