export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineOn = false;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      return true;
    } catch (e) {
      return false;
    }
  }

  resume() {
    if (this.ensure() && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  blip(freq = 440, dur = 0.12, type = 'sine', gain = 0.18, slide = 0) {
    if (!this.ensure()) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  pickup() { this.blip(880, 0.09, 'square', 0.12, 440); this.blip(1320, 0.12, 'sine', 0.1, 220); }
  item() { this.blip(520, 0.1, 'triangle', 0.16, 260); this.blip(780, 0.14, 'triangle', 0.14, 200); }
  jump() { this.blip(300, 0.12, 'sine', 0.1, 240); }
  land() { this.blip(140, 0.08, 'sine', 0.08, -40); }
  crash(strength = 1) { this.blip(90, 0.25, 'sawtooth', Math.min(0.3, 0.1 * strength), -40); this.blip(60, 0.3, 'square', Math.min(0.2, 0.06 * strength), -20); }
  missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.15, 'triangle', 0.16), i * 90)); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.2, 'triangle', 0.18), i * 110)); }
  missionFail() { [400, 300, 200].forEach((f, i) => setTimeout(() => this.blip(f, 0.2, 'sawtooth', 0.12), i * 120)); }
  honk() { this.blip(370, 0.18, 'square', 0.1); this.blip(466, 0.18, 'square', 0.08); }
  click() { this.blip(700, 0.05, 'square', 0.08); }
  enter() { this.blip(500, 0.1, 'triangle', 0.14, 300); }
  denied() { this.blip(180, 0.15, 'square', 0.12, -60); }

  engineStart() {
    if (!this.ensure() || this.engineOn) return;
    this.engineOn = true;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  engineStop() {
    if (!this.engineOn || !this.ctx) return;
    this.engineOn = false;
    try {
      this.engineGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.15);
      const o = this.engineOsc;
      setTimeout(() => { try { o.stop(); } catch (e) { /* ignore */ } }, 300);
    } catch (e) { /* ignore */ }
    this.engineOsc = null;
    this.engineGain = null;
  }

  engineUpdate(speedRatio, throttle) {
    if (!this.engineOn || !this.engineOsc) return;
    const f = 55 + speedRatio * 160 + throttle * 25;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
    this.engineGain.gain.setTargetAtTime(0.05 + throttle * 0.05 + speedRatio * 0.03, this.ctx.currentTime, 0.08);
  }
}
