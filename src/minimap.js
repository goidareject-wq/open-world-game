import { CFG } from './config.js';
import { blockIsPark } from './citygrid.js';

const C = CFG.city;

export class Minimap {
  constructor(game, canvas) {
    this.game = game;
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = canvas.width;
    this.last = 0;
    this.pad = 8;
  }

  update(dt) {
    this.last -= dt;
    if (this.last > 0) return;
    this.last = 0.12;
    this.draw();
  }

  draw() {
    const g = this.game;
    const ctx = this.ctx;
    const s = this.size;
    const scale = (s - this.pad * 2) / (C.extent * 2 + 24);
    const cx = s / 2;
    const cy = s / 2;
    const toX = (x) => cx + x * scale;
    const toY = (z) => cy + z * scale;
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(8,12,18,0.78)';
    ctx.beginPath();
    ctx.roundRect(0, 0, s, s, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,160,220,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#171d26';
    ctx.fillRect(toX(-C.extent), toY(-C.extent), C.extent * 2 * scale, C.extent * 2 * scale);

    ctx.strokeStyle = '#454f5c';
    ctx.lineWidth = Math.max(2, C.roadWidth * scale);
    ctx.lineCap = 'round';
    for (const r of C.roads) {
      ctx.beginPath();
      ctx.moveTo(toX(-C.extent), toY(r));
      ctx.lineTo(toX(C.extent), toY(r));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(toX(r), toY(-C.extent));
      ctx.lineTo(toX(r), toY(C.extent));
      ctx.stroke();
    }

    const bs = C.blockSize * scale;
    for (const bx of C.blocks) {
      for (const bz of C.blocks) {
        if (blockIsPark(bx, bz)) ctx.fillStyle = '#1d5a26';
        else ctx.fillStyle = '#242c38';
        ctx.fillRect(toX(bx - C.blockSize / 2), toY(bz - C.blockSize / 2), bs, bs);
      }
    }

    ctx.fillStyle = '#c98a2b';
    for (const ga of g.world.garages) {
      ctx.beginPath();
      ctx.arc(toX(ga.x), toY(ga.z), 3.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(53,208,255,0.9)';
    for (const id in g.missions.pads) {
      const p = g.missions.pads[id];
      if (g.missions.status[id] === 'available') {
        ctx.beginPath();
        ctx.arc(toX(p.x), toY(p.z), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = '#ffd24a';
    for (const o of g.pickups.orbs) {
      if (!o.active) continue;
      ctx.fillRect(toX(o.x) - 1.5, toY(o.z) - 1.5, 3, 3);
    }

    ctx.fillStyle = '#ff5a4a';
    for (const car of g.traffic.cars) {
      ctx.fillRect(toX(car.st.x) - 1.6, toY(car.st.z) - 1.6, 3.2, 3.2);
    }

    const mk = g.missions.activeMarker();
    if (mk) {
      const pulse = 4 + Math.sin(performance.now() * 0.006) * 1.6;
      ctx.strokeStyle = '#ffd24a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(toX(mk.x), toY(mk.z), pulse + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.arc(toX(mk.x), toY(mk.z), 3.4, 0, Math.PI * 2);
      ctx.fill();
    }

    const veh = g.vehicleSys.current;
    let px, pz, yaw;
    if (veh) {
      px = veh.st.x; pz = veh.st.z; yaw = veh.st.yaw;
      ctx.fillStyle = '#4aa8ff';
      ctx.beginPath();
      ctx.arc(toX(px), toY(pz), 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      px = g.player.pos.x; pz = g.player.pos.z; yaw = g.player.yaw;
    }
    ctx.save();
    ctx.translate(toX(px), toY(pz));
    ctx.rotate(-yaw);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 6.5);
    ctx.lineTo(-4.2, -4.5);
    ctx.lineTo(0, -1.8);
    ctx.lineTo(4.2, -4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('N', s - 12, 12);
  }
}
