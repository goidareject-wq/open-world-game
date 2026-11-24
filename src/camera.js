import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, damp, dampAngle, lerp } from './utils.js';
import { groundHeight } from './citygrid.js';

const C = CFG.cam;

export class CameraRig {
  constructor(game) {
    this.game = game;
    this.yaw = Math.PI;
    this.pitch = 0.32;
    this.dist = 7;
    this.fov = C.fov;
    this.shake = 0;
    this.pos = new THREE.Vector3(0, 5, -10);
  }

  update(dt) {
    const g = this.game;
    const m = g.input.consumeMouse();
    const t = g.input.consumeLook();
    const s = g.settings;
    const sens = C.sens * s.sensitivity * (s.invertY ? -1 : 1);
    this.yaw -= m.dx * C.sens * s.sensitivity;
    this.pitch = clamp(this.pitch + m.dy * sens, C.pitchMin, C.pitchMax);
    this.yaw -= t.dx * 0.06;
    this.pitch = clamp(this.pitch + t.dy * 0.004 * (s.invertY ? -1 : 1), C.pitchMin, C.pitchMax);
    const veh = g.vehicleSys.current;
    const minD = veh ? C.vMin : C.minDist;
    const maxD = veh ? C.vMax : C.maxDist;
    this.dist = clamp(this.dist * (1 + m.wheel * 0.0011), minD, maxD);
    this.dist = damp(this.dist, clamp(this.dist, minD, maxD), 20, dt);

    let target;
    let targetFov = s.fov;
    if (veh) {
      target = new THREE.Vector3(veh.st.x, veh.st.y, veh.st.z).add(new THREE.Vector3(0, 1.9, 0));
      targetFov = s.fov + clamp(Math.abs(veh.st.speed) * 0.55, 0, 16);
    } else {
      target = g.player.pos.clone().add(new THREE.Vector3(0, 1.62, 0));
    }
    const cp = Math.cos(this.pitch);
    const off = new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    let d = this.dist;
    const cam = this.game.camera;
    for (let i = 0; i < 5; i++) {
      const p = target.clone().addScaledVector(off, d);
      p.y = Math.max(p.y, groundHeight(p.x, p.z) + 0.35);
      if (!g.world.colliders.pointInside(p.x, p.y, p.z)) {
        this.pos.copy(p);
        break;
      }
      d *= 0.72;
      if (i === 4) this.pos.copy(target.clone().addScaledVector(off, d));
    }
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const shk = this.shake * this.shake;
    if (shk > 0.001) {
      this.pos.x += (Math.random() - 0.5) * shk * 0.5;
      this.pos.y += (Math.random() - 0.5) * shk * 0.4;
      this.pos.z += (Math.random() - 0.5) * shk * 0.5;
    }
    cam.position.copy(this.pos);
    cam.lookAt(target.x, target.y + (veh ? 0.4 : 0), target.z);
    this.fov = damp(this.fov, targetFov, 5, dt);
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
  }

  menuOrbit(dt, time) {
    const cam = this.game.camera;
    const r = 95;
    const a = time * 0.05;
    this.pos.set(Math.sin(a) * r, 55, Math.cos(a) * r);
    cam.position.copy(this.pos);
    cam.lookAt(0, 8, 0);
    if (Math.abs(cam.fov - 55) > 0.01) {
      cam.fov = 55;
      cam.updateProjectionMatrix();
    }
  }
}
