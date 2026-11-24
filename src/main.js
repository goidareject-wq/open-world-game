import * as THREE from 'three';
import { CFG } from './config.js';
import { SaveSystem } from './save.js';
import { Profile } from './profile.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { World } from './world.js';
import { DayNight } from './daynight.js';
import { Weather } from './weather.js';
import { CameraRig } from './camera.js';
import { Player } from './player.js';
import { VehicleSystem } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Pickups } from './pickups.js';
import { MissionManager } from './missions.js';
import { HUD } from './hud.js';
import { Minimap } from './minimap.js';
import { UI } from './ui.js';
import { TouchControls } from './touch.js';
import { groundHeight } from './citygrid.js';
import { createCarState } from './physics.js';
import { clamp } from './utils.js';

const NULL_HUD = {
  show() {}, hide() {}, setMode() {}, toast() {}, flashMoney() {}, showMissionBanner() {}, update() {},
};

export class Game {
  constructor(opts = {}) {
    this.headless = !!opts.headless;
    this.save = new SaveSystem();
    const savedSettings = this.save.readSettings();
    const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0));
    this.settings = Object.assign(
      { quality: isTouch ? 'low' : 'medium', volume: 0.7, sensitivity: 1, invertY: false, fov: CFG.cam.fov, showFps: false },
      savedSettings || {}
    );
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, 1, 0.1, 1400);
    this.camera.position.set(0, 40, 90);
    this.renderer = null;
    if (!this.headless) {
      const canvas = document.getElementById('game');
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      window.addEventListener('resize', () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      });
    }

    this.profile = new Profile();
    this.input = new Input();
    this.audio = new AudioSys();
    this.audio.setVolume(this.settings.volume);
    this.world = new World(this);
    this.daynight = new DayNight(this);
    this.weather = new Weather(this);
    this.cam = new CameraRig(this);
    this.player = new Player(this);
    this.vehicleSys = new VehicleSystem(this);
    this.traffic = new Traffic(this);
    this.peds = new Pedestrians(this);
    this.pickups = new Pickups(this);
    this.missions = new MissionManager(this);

    if (!this.headless) {
      this.hud = new HUD(this);
      this.minimap = new Minimap(this, document.getElementById('minimap'));
      this.ui = new UI(this);
      this.touch = new TouchControls(this);
    } else {
      this.hud = NULL_HUD;
      this.minimap = null;
      this.ui = null;
      this.touch = null;
    }

    this.state = 'menu';
    this.time = 0;
    this.fps = 0;
    this._fpsAcc = 0;
    this._fpsN = 0;
    this.autosave = 30;

    this.input.onPause = () => this.onEscape();
    this.input.onAnyKey = () => this.audio.resume();

    if (!this.headless) {
      const canvas = document.getElementById('game');
      canvas.addEventListener('click', () => {
        this.audio.resume();
        if (this.state === 'playing') this.lockPointer();
      });
      document.addEventListener('pointerlockchange', () => {
        if (!document.pointerLockElement && this.state === 'playing') this.pause();
      });
      this.ui.show('menu');
      document.getElementById('loading').classList.add('hidden');
      let last = performance.now();
      const loop = (now) => {
        const dt = clamp((now - last) / 1000, 0.0001, 0.05);
        last = now;
        this.update(dt);
        this.render();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
    this.applySettings();
  }

  lockPointer() {
    if (typeof document === 'undefined') return;
    const c = document.getElementById('game');
    if (c && typeof c.requestPointerLock === 'function' && document.pointerLockElement == null) c.requestPointerLock();
  }

  applySettings() {
    const q = CFG.quality[this.settings.quality] || CFG.quality.medium;
    if (this.renderer) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
      this.renderer.shadowMap.enabled = q.shadows;
      if (this.scene) this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    }
    this.weather.setQuality(this.settings.quality);
    this.traffic.setCount(CFG.counts.traffic[this.settings.quality] || 10);
    this.peds.setCount(CFG.counts.peds[this.settings.quality] || 16);
    this.audio.setVolume(this.settings.volume);
    this.save.writeSettings(this.settings);
  }

  resetVehicles() {
    for (const v of this.vehicleSys.list) {
      if (v.kind !== 'parked') continue;
      v.st = { ...createCarState(), x: v.homeX, z: v.homeZ, yaw: v.homeYaw };
      v.entered = false;
      v.mesh.visible = true;
    }
    if (this.vehicleSys.current) this.vehicleSys.exit();
    this.vehicleSys.current = null;
    this.player.mesh.visible = true;
  }

  newGame() {
    this.profile.reset();
    this.missions.reset();
    this.pickups.reset();
    this.player.reset();
    this.resetVehicles();
    this.daynight.reset();
    this.weather.timer = 60;
    this.time = 0;
    this.state = 'playing';
    if (this.hud !== NULL_HUD) {
      this.hud.show();
      this.hud.setMode('foot');
      this.hud.toast('Welcome to Project Life! Visit a cyan marker to start a mission', 'info');
      this.ui.show(null);
      this.lockPointer();
    }
    this.saveGame(true);
  }

  continueGame() {
    const d = this.save.readSave();
    if (!d) { this.newGame(); return; }
    this.profile.deserialize(d.profile);
    this.missions.deserialize(d.missions);
    if (d.player) {
      this.player.pos.set(d.player.x, groundHeight(d.player.x, d.player.z), d.player.z);
      this.player.yaw = d.player.yaw || 0;
    }
    if (d.hour != null) this.daynight.hours = d.hour;
    this.resetVehicles();
    this.state = 'playing';
    if (this.hud !== NULL_HUD) {
      this.hud.show();
      this.hud.setMode('foot');
      this.hud.toast('Game loaded', 'success');
      this.ui.show(null);
      this.lockPointer();
    }
  }

  saveGame(silent = false) {
    const ok = this.save.writeSave({
      profile: this.profile.serialize(),
      missions: this.missions.serialize(),
      player: { x: this.player.pos.x, z: this.player.pos.z, yaw: this.player.yaw },
      hour: this.daynight.hours,
      time: this.time,
    });
    if (!silent && this.hud !== NULL_HUD) {
      this.hud.toast(ok ? 'Game saved' : 'Save failed', ok ? 'success' : 'fail');
    }
    return ok;
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.pressed.clear();
    this.input._interactPressed = false;
    this.input._jumpPressed = false;
    this.audio.engineStop();
    if (this.ui) this.ui.show('pause');
    if (typeof document !== 'undefined' && document.exitPointerLock) document.exitPointerLock();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    if (this.ui) this.ui.show(null);
    if (this.vehicleSys.current) this.audio.engineStart();
    this.lockPointer();
  }

  onEscape() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  quitToMenu() {
    if (this.vehicleSys.current) this.vehicleSys.exit();
    this.audio.engineStop();
    this.state = 'menu';
    if (this.hud !== NULL_HUD) {
      this.hud.hide();
      this.ui.show('menu');
    }
    if (typeof document !== 'undefined' && document.exitPointerLock) document.exitPointerLock();
  }

  useItem(type) {
    if (this.state !== 'playing') return;
    if (type === 'coffee') {
      if (this.player.useCoffee()) this.hud.toast('Coffee! Speed boost for 20s', 'item');
    } else if (type === 'nitro') {
      if (!this.vehicleSys.current) { this.hud.toast('Get in a vehicle to use Nitro', 'fail'); return; }
      if (this.vehicleSys.useNitro()) this.hud.toast('NITRO BOOST!', 'item');
    } else if (type === 'repair') {
      if (!this.vehicleSys.current) { this.hud.toast('Get in a vehicle to use Repair Kit', 'fail'); return; }
      if (this.profile.useItem('repair')) {
        this.vehicleSys.repairCurrent();
        this.audio.item();
        this.hud.toast('Vehicle fully repaired', 'success');
      }
    }
  }

  repairAtGarage() {
    if (this.profile.spend(200)) {
      this.vehicleSys.repairCurrent();
      this.audio.item();
      this.hud.toast('Vehicle repaired for $200', 'success');
    } else {
      this.audio.denied();
      this.hud.toast('Not enough money — repair costs $200', 'fail');
    }
  }

  getPrompt() {
    if (this.state !== 'playing') return null;
    const p = this.player.pos;
    const veh = this.vehicleSys.current;
    if (veh) {
      const ga = this.world.garages.find((g) => Math.hypot(veh.st.x - g.x, veh.st.z - g.z) < g.r);
      if (ga) return this.profile.canAfford(200) ? 'E — Repair vehicle ($200)' : 'Repair costs $200 (not enough money)';
      return 'E — Exit vehicle';
    }
    const near = this.vehicleSys.nearestTo(p.x, p.z, 3.4);
    if (near) return `E — Enter ${near.type.name}`;
    const pad = this.missions.padNear(p.x, p.z, 2.8);
    if (pad) return `E — Start mission: ${pad.def.title}`;
    return null;
  }

  handleInteract() {
    const p = this.player.pos;
    const veh = this.vehicleSys.current;
    if (veh) {
      const ga = this.world.garages.find((g) => Math.hypot(veh.st.x - g.x, veh.st.z - g.z) < g.r);
      if (ga) { this.repairAtGarage(); return; }
      this.vehicleSys.exit();
      return;
    }
    const near = this.vehicleSys.nearestTo(p.x, p.z, 3.4);
    if (near) { this.vehicleSys.enter(near); return; }
    const pad = this.missions.padNear(p.x, p.z, 2.8);
    if (pad) this.missions.start(pad.def.id);
  }

  update(dt) {
    this.time += dt;
    this._fpsAcc += dt;
    this._fpsN++;
    if (this._fpsAcc >= 0.5) {
      this.fps = this._fpsN / this._fpsAcc;
      this._fpsAcc = 0;
      this._fpsN = 0;
    }
    this.input.poll();
    const playing = this.state === 'playing';

    if (playing || this.state === 'menu') {
      this.daynight.update(dt);
      this.weather.update(dt);
      this.world.update(dt, this.time);
      this.traffic.update(dt);
      this.peds.update(dt);
    }

    if (playing) {
      this.player.update(dt);
      this.vehicleSys.update(dt);
      this.pickups.update(dt, this.time);
      this.missions.update(dt, this.time);
      this.cam.update(dt);
      if (this.vehicleSys.shake > 0) this.cam.shake = Math.max(this.cam.shake, this.vehicleSys.shake);
      if (this.input.consumeInteract()) this.handleInteract();
      CFG.itemTypes.forEach((t, i) => {
        if (this.input.consume('Digit' + (i + 1))) this.useItem(t);
      });
      if (this.input.consume('KeyI') || this.input.consume('Tab')) {
        if (this.ui) this.ui.toggleInventory();
      }
      this.autosave -= dt;
      if (this.autosave <= 0) {
        this.autosave = 30;
        this.saveGame(true);
      }
      if (this.hud !== NULL_HUD) {
        this.hud.update(dt);
        if (this.minimap) this.minimap.update(dt);
      }
    } else if (this.state === 'menu') {
      this.cam.menuOrbit(dt, this.time);
    }
  }

  render() {
    if (this.renderer) this.renderer.render(this.scene, this.camera);
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const boot = () => {
    if (!window.game) window.game = new Game();
  };
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
  else boot();
}
