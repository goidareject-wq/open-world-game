import { CFG, ITEM_INFO } from './config.js';
import { fmtMoney, fmtTime, fmtClock, clamp } from './utils.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: $('hud'),
      money: $('money-val'),
      tracker: $('tracker'),
      trackerTitle: $('tracker-title'),
      trackerObj: $('tracker-obj'),
      trackerTime: $('tracker-time'),
      trackerFill: $('tracker-time-fill'),
      prompt: $('prompt'),
      speedo: $('speedo'),
      speedVal: $('speed-val'),
      speedGear: $('speed-gear'),
      dmgFill: $('dmg-fill'),
      dmgWrap: $('dmg-wrap'),
      slots: [...document.querySelectorAll('.slot')],
      buff: $('buff'),
      clock: $('clock'),
      weather: $('weather-label'),
      fps: $('fps'),
      vignette: $('vignette'),
      banner: $('banner'),
      bannerTitle: $('banner-title'),
      bannerSub: $('banner-sub'),
      toasts: $('toasts'),
    };
    this.mode = 'foot';
    this._money = -1;
    this._bannerT = 0;
    this.el.slots.forEach((slot, i) => {
      const type = CFG.itemTypes[i];
      slot.dataset.type = type;
      slot.querySelector('.slot-dot').style.background = ITEM_INFO[type].color;
      slot.addEventListener('click', () => game.useItem(type));
    });
    this.el.hud.style.display = 'none';
  }

  show() { this.el.hud.style.display = 'block'; }
  hide() { this.el.hud.style.display = 'none'; }

  setMode(m) {
    this.mode = m;
    this.el.speedo.classList.toggle('visible', m === 'vehicle');
  }

  toast(msg, type = 'info') {
    const d = document.createElement('div');
    d.className = `toast ${type}`;
    d.textContent = msg;
    this.el.toasts.appendChild(d);
    setTimeout(() => d.classList.add('show'), 16);
    setTimeout(() => {
      d.classList.remove('show');
      setTimeout(() => d.remove(), 400);
    }, 3400);
    while (this.el.toasts.children.length > 5) this.el.toasts.firstChild.remove();
  }

  flashMoney(v) {
    const f = document.createElement('div');
    f.className = 'money-flash';
    f.textContent = `+$${v}`;
    $('money').appendChild(f);
    setTimeout(() => f.remove(), 1200);
  }

  showMissionBanner(title, reward) {
    this.el.bannerTitle.textContent = title.toUpperCase();
    this.el.bannerSub.textContent = `COMPLETED  +$${reward}`;
    this.el.banner.classList.add('show');
    this._bannerT = 3.2;
  }

  update(dt) {
    const g = this.game;
    if (this._bannerT > 0) {
      this._bannerT -= dt;
      if (this._bannerT <= 0) this.el.banner.classList.remove('show');
    }
    const money = Math.round(g.profile.money);
    if (money !== this._money) {
      this._money = money;
      this.el.money.textContent = fmtMoney(money);
    }
    const tr = g.missions.getTracker();
    if (this.el.trackerTitle.textContent !== tr.title) this.el.trackerTitle.textContent = tr.title;
    if (this.el.trackerObj.textContent !== tr.objective) this.el.trackerObj.textContent = tr.objective;
    if (tr.timeLeft != null) {
      this.el.trackerTime.style.display = 'flex';
      this.el.trackerFill.style.width = `${clamp(tr.timeLeft / 300 * 100, 0, 100)}%`;
      this.el.trackerTime.querySelector('span').textContent = fmtTime(tr.timeLeft);
    } else {
      this.el.trackerTime.style.display = 'none';
    }
    const prompt = g.getPrompt();
    if (prompt) {
      this.el.prompt.style.display = 'block';
      if (this.el.prompt.textContent !== prompt) this.el.prompt.textContent = prompt;
    } else {
      this.el.prompt.style.display = 'none';
    }
    if (this.mode === 'vehicle' && g.vehicleSys.current) {
      const v = g.vehicleSys.current;
      const kmh = Math.round(Math.abs(v.st.speed) * 3.6);
      if (this.el.speedVal.textContent != kmh) this.el.speedVal.textContent = kmh;
      this.el.speedGear.textContent = v.st.speed >= -0.5 ? 'D' : 'R';
      const dmg = clamp(v.st.damage, 0, 100);
      this.el.dmgFill.style.width = `${dmg}%`;
      this.el.dmgFill.style.background = dmg > 70 ? '#ff3b30' : dmg > 40 ? '#ffb02e' : '#4ad17a';
      this.el.dmgWrap.style.display = 'block';
      this.el.vignette.style.opacity = dmg > 55 ? String(clamp((dmg - 55) / 45, 0, 0.75) * (0.6 + Math.sin(g.time * 6) * 0.4)) : '0';
    } else {
      this.el.dmgWrap.style.display = 'none';
      this.el.vignette.style.opacity = '0';
    }
    CFG.itemTypes.forEach((type, i) => {
      const slot = this.el.slots[i];
      const n = g.profile.inventory[type] || 0;
      const c = slot.querySelector('.slot-count');
      if (c.textContent != n) c.textContent = n;
      slot.classList.toggle('has', n > 0);
    });
    const boost = g.player.boost;
    if (boost > 0) {
      this.el.buff.style.display = 'block';
      this.el.buff.textContent = `COFFEE BOOST ${Math.ceil(boost)}s`;
    } else {
      this.el.buff.style.display = 'none';
    }
    const clock = fmtClock(g.daynight.hours);
    if (this.el.clock.textContent !== clock) this.el.clock.textContent = clock;
    const w = `${g.weather.label} ${g.daynight.isNight() ? '· Night' : '· Day'}`;
    if (this.el.weather.textContent !== w) this.el.weather.textContent = w;
    if (g.settings.showFps) {
      this.el.fps.style.display = 'block';
      this.el.fps.textContent = `${Math.round(g.fps || 0)} FPS`;
    } else {
      this.el.fps.style.display = 'none';
    }
  }
}
