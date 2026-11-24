import * as THREE from 'three';
import { CFG, VEHICLE_TYPES } from './config.js';
import { sampleRoadPoint, laneOffset, isOnRoad } from './citygrid.js';
import { makeCarMesh } from './vehicles.js';
import { rand, choice, clamp } from './utils.js';

const C = CFG.city;

export class Traffic {
  constructor(game) {
    this.game = game;
    this.cars = [];
    this.types = ['sedan', 'suv', 'van', 'truck', 'sports'];
    this._spawnInitial();
  }

  setCount(n) {
    while (this.cars.length < n) this._spawnCar();
    if (this.cars.length > n) {
      for (let i = this.cars.length - 1; i >= n; i--) {
        this.game.scene.remove(this.cars[i].mesh);
      }
      this.cars.length = n;
    }
  }

  _spawnInitial() {
    const q = this.game.settings.quality;
    const n = CFG.counts.traffic[q] || 10;
    for (let i = 0; i < n; i++) this._spawnCar();
  }

  _spawnCar() {
    const p = sampleRoadPoint();
    const typeKey = choice(this.types);
    const type = VEHICLE_TYPES[typeKey];
    const mesh = makeCarMesh(type);
    this.game.scene.add(mesh);
    const car = {
      kind: 'traffic',
      typeKey, type, mesh,
      axis: p.axis, dir: p.dir, road: p.road, s: p.axis === 'z' ? p.z : p.x,
      st: { x: p.x, z: p.z, yaw: p.yaw, speed: 0, steer: 0, damage: 0 },
      speed: rand(6, 11),
      maxSpeed: rand(8, 13),
      wait: 0,
      decided: false,
    };
    this.cars.push(car);
  }

  _lanePos(car) {
    const lane = laneOffset(car.axis, car.dir, car.road);
    if (car.axis === 'z') return { x: lane.x, z: car.s };
    return { x: car.s, z: lane.z };
  }

  _yawFor(car) {
    if (car.axis === 'z') return car.dir > 0 ? 0 : Math.PI;
    return car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  _nextIntersection(car) {
    let best = null;
    let bd = Infinity;
    for (const r of C.roads) {
      const ahead = car.dir > 0 ? r - car.s : car.s - r;
      if (ahead > 2 && ahead < bd) { bd = ahead; best = r; }
    }
    return best === null ? null : { coord: best, dist: bd };
  }

  _turnAt(car, interCoord) {
    const roll = Math.random();
    if (roll < 0.55 || Math.abs(car.s) > C.extent - 14) {
      if (Math.abs(car.s) > C.extent - 14 && Math.abs(car.s - interCoord) < 14) {
        this._startTurn(car, interCoord);
      }
      return;
    }
    this._startTurn(car, interCoord);
  }

  _startTurn(car, interCoord) {
    const newAxis = car.axis === 'z' ? 'x' : 'z';
    const newDir = Math.random() < 0.5 ? 1 : -1;
    const pos = this._lanePos(car);
    car.axis = newAxis;
    car.dir = newDir;
    car.road = interCoord;
    car.s = newAxis === 'z' ? pos.z : pos.x;
  }

  update(dt) {
    const g = this.game;
    const player = g.player;
    const pveh = g.vehicleSys.current;
    for (const car of this.cars) {
      if (car.wait > 0) { car.wait -= dt; car.st.speed = 0; continue; }
      let target = car.maxSpeed;
      for (const o of this.cars) {
        if (o === car || o.axis !== car.axis || o.road !== car.road || o.dir !== car.dir) continue;
        const ahead = car.dir > 0 ? o.s - car.s : car.s - o.s;
        if (ahead > 0 && ahead < 10) target = Math.min(target, (o.speed * ahead) / 10);
      }
      const aheadX = car.axis === 'z' ? car.st.x : car.s + car.dir * 7;
      const aheadZ = car.axis === 'z' ? car.s + car.dir * 7 : car.st.z;
      if (player.mesh.visible && Math.hypot(player.pos.x - aheadX, player.pos.z - aheadZ) < 6 && isOnRoad(aheadX, aheadZ, 2)) target = 0;
      if (pveh) {
        const pv = pveh.st;
        const dAhead = car.dir > 0 ? (car.axis === 'z' ? pv.z - car.s : pv.x - car.s) : (car.axis === 'z' ? car.s - pv.z : car.s - pv.x);
        if (dAhead > 0 && dAhead < 9 && Math.abs((car.axis === 'z' ? pv.x : pv.z) - (car.axis === 'z' ? car.st.x : car.st.z)) < 4) {
          target = Math.min(target, Math.abs(pv.speed) * 0.5);
        }
      }
      car.speed = clamp(car.speed + (target - car.speed) * Math.min(1, dt * 2.5), 0, car.maxSpeed);
      car.s += car.dir * car.speed * dt;
      const inter = this._nextIntersection(car);
      if (!inter || inter.dist < 1.2) {
        const edge = Math.abs(car.s) > C.extent - 12;
        const atInter = C.roads.some((r) => Math.abs(car.s - r) < 1.4);
        if ((atInter && Math.random() < 0.5) || edge) {
          const coord = C.roads.reduce((a, b) => (Math.abs(b - car.s) < Math.abs(a - car.s) ? b : a));
          if (edge || Math.abs(coord - car.s) < 2) this._turnAt(car, coord);
        }
      }
      const pos = this._lanePos(car);
      car.st.x = pos.x;
      car.st.z = pos.z;
      car.st.yaw = this._yawFor(car);
      car.st.speed = car.speed;
      const lights = g.daynight.night > 0.35 || g.weather.state.rain > 0.3;
      car.mesh.userData.headMat.emissiveIntensity = lights ? 2.0 : 0;
    }
  }
}
