export class TouchControls {
  constructor(game) {
    this.game = game;
    const touchable = (typeof window !== 'undefined') && ('ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0));
    if (!touchable) return;
    this.active = true;
    const ui = document.createElement('div');
    ui.id = 'touch-ui';
    ui.innerHTML = `
      <div id="move-zone"></div>
      <div id="look-zone"></div>
      <div id="joy-base"><div id="joy-knob"></div></div>
      <div class="tbtns-top"><button class="tbtn small" id="tb-pause">II</button></div>
      <div class="tbtns">
        <button class="tbtn" id="tb-jump">JUMP</button>
        <button class="tbtn" id="tb-sprint">RUN</button>
        <button class="tbtn wide" id="tb-act">E</button>
      </div>
      <div class="tbtns drive">
        <button class="tbtn" id="tb-brake">BRK</button>
        <button class="tbtn gas" id="tb-gas">GAS</button>
      </div>
    `;
    document.body.appendChild(ui);
    ui.classList.add('active');
    ui.addEventListener('contextmenu', (e) => e.preventDefault());
    const t = game.input.touch;
    const joyBase = ui.querySelector('#joy-base');
    const joyKnob = ui.querySelector('#joy-knob');
    let joyId = null;
    let lookId = null;
    let joyCenter = null;
    const R = 44;
    let audioResumed = false;

    const setKnob = (dx, dy) => {
      joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    ui.addEventListener('touchstart', (e) => {
      if (!audioResumed) {
        audioResumed = true;
        game.audio.resume();
      }
      for (const touch of e.changedTouches) {
        const x = touch.clientX;
        const y = touch.clientY;
        if (x < window.innerWidth * 0.45 && y > window.innerHeight * 0.35 && joyId === null) {
          joyId = touch.identifier;
          joyCenter = { x, y };
          joyBase.style.left = (x - 60) + 'px';
          joyBase.style.top = (y - 60) + 'px';
          joyBase.style.opacity = '0.9';
        } else if (lookId === null) {
          lookId = touch.identifier;
          this._lastLook = { x, y };
        }
      }
      e.preventDefault();
    }, { passive: false });

    ui.addEventListener('touchmove', (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === joyId && joyCenter) {
          let dx = touch.clientX - joyCenter.x;
          let dy = touch.clientY - joyCenter.y;
          const d = Math.hypot(dx, dy);
          if (d > R) {
            dx = (dx / d) * R;
            dy = (dy / d) * R;
          }
          setKnob(dx, dy);
          t.moveX = dx / R;
          t.moveY = dy / R;
        } else if (touch.identifier === lookId && this._lastLook) {
          t.lookDX += touch.clientX - this._lastLook.x;
          t.lookDY += touch.clientY - this._lastLook.y;
          this._lastLook = { x: touch.clientX, y: touch.clientY };
        }
      }
      e.preventDefault();
    }, { passive: false });

    const endTouch = (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === joyId) {
          joyId = null;
          joyCenter = null;
          t.moveX = 0;
          t.moveY = 0;
          setKnob(0, 0);
          joyBase.style.opacity = '0.4';
        }
        if (touch.identifier === lookId) lookId = null;
      }
    };
    ui.addEventListener('touchend', endTouch);
    ui.addEventListener('touchcancel', endTouch);

    const bindBtn = (id, on, off) => {
      const el = ui.querySelector(id);
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!audioResumed) { audioResumed = true; game.audio.resume(); }
        on();
        el.classList.add('on');
      }, { passive: false });
      const end = (e) => {
        e.preventDefault();
        off();
        el.classList.remove('on');
      };
      el.addEventListener('touchend', end, { passive: false });
      el.addEventListener('touchcancel', end, { passive: false });
    };
    bindBtn('#tb-jump', () => { t.jump = true; }, () => {});
    bindBtn('#tb-act', () => { t.interact = true; }, () => {});
    bindBtn('#tb-sprint', () => { t.sprint = !t.sprint; }, () => {});
    bindBtn('#tb-gas', () => { t.gas = true; }, () => { t.gas = false; });
    bindBtn('#tb-brake', () => { t.brake = true; }, () => { t.brake = false; });
    bindBtn('#tb-pause', () => { game.onEscape(); }, () => {});
  }
}
