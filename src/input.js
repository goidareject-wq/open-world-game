export class Input {
  constructor(target) {
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.pointerLocked = false;
    this.touch = { moveX: 0, moveY: 0, lookDX: 0, lookDY: 0, jump: false, sprint: false, interact: false, brake: false, gas: false };
    this.state = {
      forward: 0, back: 0, left: 0, right: 0,
      jump: false, sprint: false, interact: false, brake: false, handbrake: false,
    };
    this._interactPressed = false;
    this._jumpPressed = false;
    this.pressed = new Set();
    this.onInteract = null;
    this.onJump = null;
    this.onPause = null;
    this.onAnyKey = null;
    if (typeof window !== 'undefined') this.attach(target || window);
  }

  attach(t) {
    t.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'KeyE') this._interactPressed = true;
      if (e.code === 'Space') { this._jumpPressed = true; e.preventDefault(); }
      if (e.code === 'Tab') e.preventDefault();
      if (e.code === 'Escape' && this.onPause) this.onPause();
      if (this.onAnyKey) this.onAnyKey();
    });
    t.addEventListener('keyup', (e) => this.keys.delete(e.code));
    t.addEventListener('blur', () => this.keys.clear());
    t.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    });
    t.addEventListener('wheel', (e) => { this.wheel += e.deltaY; }, { passive: true });
    t.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.onAnyKey) this.onAnyKey();
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement != null;
    });
  }

  consume(code) {
    const v = this.pressed.has(code);
    this.pressed.delete(code);
    return v;
  }

  down(code) { return this.keys.has(code); }

  consumeInteract() {
    const v = this._interactPressed || this.touch.interact;
    this._interactPressed = false;
    this.touch.interact = false;
    return v;
  }

  consumeJump() {
    const v = this._jumpPressed || this.touch.jump;
    this._jumpPressed = false;
    this.touch.jump = false;
    return v;
  }

  consumeMouse() {
    const r = { dx: this.mouseDX, dy: this.mouseDY, wheel: this.wheel };
    this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0;
    return r;
  }

  consumeLook() {
    const r = { dx: this.touch.lookDX, dy: this.touch.lookDY };
    this.touch.lookDX = 0; this.touch.lookDY = 0;
    return r;
  }

  poll() {
    const t = this.touch;
    const k = this;
    this.state.forward = (k.down('KeyW') || k.down('ArrowUp') ? 1 : 0) + (t.gas ? 1 : 0);
    this.state.back = (k.down('KeyS') || k.down('ArrowDown') ? 1 : 0);
    this.state.right = (k.down('KeyD') || k.down('ArrowRight') ? 1 : 0);
    this.state.left = (k.down('KeyA') || k.down('ArrowLeft') ? 1 : 0);
    const mx = t.moveX, my = t.moveY;
    if (Math.abs(mx) > 0.01 || Math.abs(my) > 0.01) {
      this.state.right = Math.max(this.state.right, Math.max(0, mx));
      this.state.left = Math.max(this.state.left, Math.max(0, -mx));
      this.state.forward = Math.max(this.state.forward, Math.max(0, -my));
      this.state.back = Math.max(this.state.back, Math.max(0, my));
    }
    this.state.jump = k.down('Space');
    this.state.sprint = k.down('ShiftLeft') || k.down('ShiftRight') || t.sprint;
    this.state.interact = k.down('KeyE');
    this.state.brake = k.down('KeyS') || k.down('ArrowDown') || k.down('KeyB') || t.brake;
    this.state.handbrake = k.down('Space') && false || k.down('KeyX');
    return this.state;
  }
}
