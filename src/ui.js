import { CFG, ITEM_INFO } from './config.js';
import { fmtMoney } from './utils.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(game) {
    this.game = game;
    this.returnTo = 'menu';
    this.inventoryOpen = false;
    this.screens = ['menu', 'pause', 'settings', 'help', 'inventory'];

    $('btn-new').addEventListener('click', () => { game.audio.resume(); game.audio.click(); game.newGame(); });
    $('btn-continue').addEventListener('click', () => { game.audio.resume(); game.audio.click(); game.continueGame(); });
    $('btn-settings').addEventListener('click', () => { game.audio.click(); this.openSettings('menu'); });
    $('btn-help').addEventListener('click', () => { game.audio.click(); this.returnTo = 'menu'; this.show('help'); });
    $('btn-resume').addEventListener('click', () => { game.audio.click(); game.resume(); });
    $('btn-save').addEventListener('click', () => { game.audio.click(); game.saveGame(); });
    $('btn-pause-settings').addEventListener('click', () => { game.audio.click(); this.openSettings('pause'); });
    $('btn-pause-help').addEventListener('click', () => { game.audio.click(); this.returnTo = 'pause'; this.show('help'); });
    $('btn-quit').addEventListener('click', () => { game.audio.click(); game.quitToMenu(); });
    $('btn-back-settings').addEventListener('click', () => { game.audio.click(); this.applySettingsInputs(); game.applySettings(); this.show(this.returnTo); });
    $('btn-back-help').addEventListener('click', () => { game.audio.click(); this.show(this.returnTo); });
    $('btn-close-inv').addEventListener('click', () => { game.audio.click(); this.toggleInventory(false); });
    document.querySelectorAll('.inv-use').forEach((b) => {
      b.addEventListener('click', () => { game.useItem(b.dataset.type); this.buildInventory(); });
    });

    const bindRange = (id, key, fmt) => {
      const el = $(id);
      const out = $(id + '-val');
      el.addEventListener('input', () => {
        game.settings[key] = parseFloat(el.value);
        if (out) out.textContent = fmt ? fmt(game.settings[key]) : game.settings[key];
        game.applySettings();
      });
    };
    bindRange('in-volume', 'volume', (v) => Math.round(v * 100) + '%');
    bindRange('in-sens', 'sensitivity', (v) => v.toFixed(2) + 'x');
    bindRange('in-fov', 'fov', (v) => Math.round(v) + '°');
    $('sel-quality').addEventListener('change', (e) => { game.settings.quality = e.target.value; game.applySettings(); });
    $('chk-invert').addEventListener('change', (e) => { game.settings.invertY = e.target.checked; game.applySettings(); });
    $('chk-fps').addEventListener('change', (e) => { game.settings.showFps = e.target.checked; game.applySettings(); });

    this.fillSettingsInputs();
  }

  fillSettingsInputs() {
    const s = this.game.settings;
    $('sel-quality').value = s.quality;
    $('in-volume').value = s.volume;
    $('in-volume-val').textContent = Math.round(s.volume * 100) + '%';
    $('in-sens').value = s.sensitivity;
    $('in-sens-val').textContent = s.sensitivity.toFixed(2) + 'x';
    $('in-fov').value = s.fov;
    $('in-fov-val').textContent = Math.round(s.fov) + '°';
    $('chk-invert').checked = !!s.invertY;
    $('chk-fps').checked = !!s.showFps;
  }

  applySettingsInputs() {
    const s = this.game.settings;
    s.quality = $('sel-quality').value;
    s.volume = parseFloat($('in-volume').value);
    s.sensitivity = parseFloat($('in-sens').value);
    s.fov = parseFloat($('in-fov').value);
    s.invertY = $('chk-invert').checked;
    s.showFps = $('chk-fps').checked;
  }

  openSettings(from) {
    this.returnTo = from;
    this.fillSettingsInputs();
    this.show('settings');
  }

  show(name) {
    for (const s of this.screens) {
      const el = $('screen-' + s);
      if (el) el.classList.toggle('visible', s === name);
    }
    if (name === 'menu') {
      $('btn-continue').disabled = !this.game.save.hasSave();
    }
    if (name === 'inventory') this.buildInventory();
  }

  toggleInventory(force) {
    const want = force !== undefined ? force : !this.inventoryOpen;
    if (want === this.inventoryOpen) return;
    this.inventoryOpen = want;
    if (want) this.show('inventory');
    else this.show(this.game.state === 'paused' ? 'pause' : null);
  }

  buildInventory() {
    const p = this.game.profile;
    const stats = [
      ['Money', fmtMoney(p.money)],
      ['Missions completed', p.stats.missionsCompleted],
      ['Total earned', fmtMoney(p.stats.totalEarned)],
      ['Distance driven', (p.stats.distanceDriven / 1000).toFixed(2) + ' km'],
      ['Distance walked', (p.stats.distanceWalked / 1000).toFixed(2) + ' km'],
      ['Cash orbs collected', p.stats.orbsCollected],
      ['Fares completed', p.stats.faresCompleted],
      ['Races won', p.stats.racesWon],
      ['Jumps', p.stats.jumps],
      ['Crashes', p.stats.crashes],
      ['Top speed', Math.round(p.stats.topSpeed) + ' km/h'],
    ];
    $('inv-stats').innerHTML = stats.map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    const rows = CFG.itemTypes.map((t, i) => {
      const n = p.inventory[t] || 0;
      return `<div class="inv-item">
        <span class="slot-dot" style="background:${ITEM_INFO[t].color}"></span>
        <span class="inv-name">${ITEM_INFO[t].name} <i>[${i + 1}]</i></span>
        <span class="inv-desc">${ITEM_INFO[t].desc}</span>
        <span class="inv-count">x${n}</span>
        <button class="inv-use" data-type="${t}" ${n <= 0 ? 'disabled' : ''}>Use</button>
      </div>`;
    }).join('');
    $('inv-items').innerHTML = rows;
    document.querySelectorAll('.inv-use').forEach((b) => {
      b.addEventListener('click', () => { this.game.useItem(b.dataset.type); this.buildInventory(); });
    });
  }
}
