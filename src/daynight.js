import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, lerp, hexLerpColor } from './utils.js';

const SKY = {
  night: 0x0a0e1c,
  dawn: 0xe8a06a,
  day: 0x8ec9ee,
  dusk: 0xd97a5a,
};

export class DayNight {
  constructor(game) {
    this.game = game;
    this.hours = CFG.startHour;
    this.sun = new THREE.DirectionalLight(0xffffff, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -90;
    sc.near = 10; sc.far = 400;
    this.sun.shadow.bias = -0.0006;
    game.scene.add(this.sun);
    game.scene.add(this.sun.target);
    this.moon = new THREE.DirectionalLight(0x8899ff, 0);
    game.scene.add(this.moon);
    game.scene.add(this.moon.target);
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a4a3a, 0.8);
    game.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.12);
    game.scene.add(this.ambient);
    this.skyColor = new THREE.Color(SKY.day);
    this.fogColor = new THREE.Color(SKY.day);
    game.scene.fog = new THREE.Fog(this.fogColor.getHex(), 40, 700);
    game.scene.background = this.skyColor;
    this.night = 0;
    this._c1 = new THREE.Color();
    this._c2 = new THREE.Color();
  }

  reset(hours = CFG.startHour) {
    this.hours = hours;
  }

  isNight() {
    return this.night > 0.55;
  }

  update(dt) {
    this.hours = (this.hours + (dt / CFG.dayLength) * 24) % 24;
    const ang = (this.hours / 24) * Math.PI * 2 - Math.PI / 2;
    const sinE = Math.sin(ang);
    const cosE = Math.cos(ang);
    const day = clamp((sinE + 0.12) / 0.45, 0, 1);
    const duskAmt = clamp(1 - Math.abs(sinE - 0.08) / 0.22, 0, 1);
    this.night = 1 - day;

    const sunDir = new THREE.Vector3(cosE * 0.75, Math.max(sinE, -0.2), 0.42).normalize();
    const p = this.game.camera.position;
    this.sun.position.set(p.x + sunDir.x * 220, p.y + sunDir.y * 220, p.z + sunDir.z * 220);
    this.sun.target.position.set(p.x, 0, p.z);
    this.sun.intensity = day * 2.6;
    this.sun.color.setHex(day > 0.6 ? 0xfff4e0 : 0xffb066);
    this.sun.castShadow = this.game.settings.quality !== 'low';

    this.moon.position.set(p.x - sunDir.x * 200, p.y + Math.max(-sinE, 0.2) * 200, p.z - sunDir.z * 200);
    this.moon.target.position.set(p.x, 0, p.z);
    this.moon.intensity = this.night * 0.4;

    hexLerpColor(SKY.night, SKY.day, day, this._c1);
    hexLerpColor(this._c1.getHex(), duskAmt > 0 ? (sinE > 0 ? SKY.dawn : SKY.dusk) : SKY.day, duskAmt * day, this.skyColor);
    this.fogColor.copy(this.skyColor);
    this.game.scene.fog.color.copy(this.fogColor);
    this.game.scene.background = this.skyColor;

    this.hemi.intensity = 0.18 + day * 0.75;
    this.hemi.color.copy(this.skyColor).lerp(this._c2.setHex(0xffffff), 0.4);
    this.hemi.groundColor.setHex(0x2c3a2c).lerp(this._c2.setHex(0x555a66), day * 0.5);
    this.ambient.intensity = 0.1 + this.night * 0.22;

    this.game.world.setNight(clamp(this.night * 1.25 - 0.15, 0, 1));
  }
}
