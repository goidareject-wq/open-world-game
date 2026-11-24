import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, lerp, rand, choice } from './utils.js';

const TYPES = {
  clear: { fog: 0.0, clouds: 0.12, rain: 0, grip: 1.0, label: 'Clear' },
  cloudy: { fog: 0.28, clouds: 0.75, rain: 0, grip: 0.95, label: 'Cloudy' },
  rain: { fog: 0.55, clouds: 1.0, rain: 1, grip: 0.72, label: 'Rain' },
  fog: { fog: 0.92, clouds: 0.5, rain: 0, grip: 0.85, label: 'Fog' },
};

export class Weather {
  constructor(game) {
    this.game = game;
    this.current = 'clear';
    this.target = 'clear';
    this.blend = 1;
    this.timer = rand(CFG.weather.minTime, CFG.weather.maxTime);
    this.state = { fog: 0, clouds: 0.12, rain: 0, grip: 1 };
    this.wind = new THREE.Vector2(1, 0.4).normalize().multiplyScalar(3);
    this._buildRain();
    this._buildClouds();
    this.flash = new THREE.AmbientLight(0xbfd4ff, 0);
    game.scene.add(this.flash);
    this.lightningTimer = 0;
    this.label = 'Clear';
  }

  _buildRain() {
    const max = CFG.counts.rain.high;
    const pos = new Float32Array(max * 3);
    for (let i = 0; i < max; i++) {
      pos[i * 3] = rand(-35, 35);
      pos[i * 3 + 1] = rand(0, 45);
      pos[i * 3 + 2] = rand(-35, 35);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainMat = new THREE.PointsMaterial({ color: 0xaac4dd, size: 0.14, transparent: true, opacity: 0, depthWrite: false });
    this.rain = new THREE.Points(geo, this.rainMat);
    this.rain.frustumCulled = false;
    this.rainMax = max;
    this.game.scene.add(this.rain);
  }

  _buildClouds() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    this.clouds = [];
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, fog: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(rand(50, 110), rand(24, 46)), mat);
      m.position.set(rand(-400, 400), rand(80, 130), rand(-400, 400));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rand(0, Math.PI * 2);
      this.game.scene.add(m);
      this.clouds.push(m);
    }
  }

  setQuality(level) {
    const count = CFG.counts.rain[level] || CFG.counts.rain.medium;
    this.rain.geometry.setDrawRange(0, count);
  }

  getGrip() {
    return this.state.grip;
  }

  isRaining() {
    return this.state.rain > 0.25;
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) {
      const options = Object.keys(TYPES).filter((t) => t !== this.current);
      this.target = choice(options);
      this.timer = rand(CFG.weather.minTime, CFG.weather.maxTime);
      this.blend = 0;
    }
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / CFG.weather.changeTime);
      const t = this.blend * this.blend * (3 - 2 * this.blend);
      const a = TYPES[this.current];
      const b = TYPES[this.target];
      this.state.fog = lerp(a.fog, b.fog, t);
      this.state.clouds = lerp(a.clouds, b.clouds, t);
      this.state.rain = lerp(a.rain, b.rain, t);
      this.state.grip = lerp(a.grip, b.grip, t);
      if (t >= 1) this.current = this.target;
    } else {
      const s = TYPES[this.current];
      this.state.fog = s.fog;
      this.state.clouds = s.clouds;
      this.state.rain = s.rain;
      this.state.grip = s.grip;
    }
    this.label = TYPES[this.current].label;

    const fog = this.game.scene.fog;
    fog.far = lerp(750, 110, this.state.fog);
    fog.near = lerp(40, 18, this.state.fog);

    const p = this.game.camera.position;
    this.rain.position.set(p.x, 0, p.z);
    this.rainMat.opacity = this.state.rain * 0.75;
    this.rain.visible = this.state.rain > 0.02;
    if (this.rain.visible) {
      const pos = this.rain.geometry.attributes.position;
      const arr = pos.array;
      const n = pos.count;
      const speed = 34 + this.wind.length() * 2;
      for (let i = 0; i < n; i++) {
        arr[i * 3 + 1] -= speed * dt;
        arr[i * 3] += this.wind.x * dt;
        arr[i * 3 + 2] += this.wind.y * dt;
        if (arr[i * 3 + 1] < 0) {
          arr[i * 3 + 1] = 45;
          arr[i * 3] = rand(-35, 35);
          arr[i * 3 + 2] = rand(-35, 35);
        }
      }
      pos.needsUpdate = true;
    }

    for (const cl of this.clouds) {
      cl.position.x += this.wind.x * dt * 1.6;
      cl.position.z += this.wind.y * dt * 1.6;
      if (cl.position.x > 450) cl.position.x = -450;
      if (cl.position.z > 450) cl.position.z = -450;
      const shade = lerp(0.35, 0.95, 1 - this.state.clouds * 0.8);
      cl.material.color.setRGB(shade, shade, shade + 0.03);
      cl.material.opacity = this.state.clouds * 0.85;
    }

    if (this.state.rain > 0.5) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = rand(4, 14);
        this.flash.intensity = 2.4;
        if (this.game.audio) {
          setTimeout(() => this.game.audio.blip(48, 0.6, 'sawtooth', 0.22, -18), 350);
        }
      }
    }
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 6);
  }
}
