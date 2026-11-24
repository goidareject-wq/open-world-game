export class ColliderWorld {
  constructor() {
    this.boxes = [];
  }

  addBox(cx, cz, w, d, h, y0 = 0) {
    const b = {
      minX: cx - w / 2, maxX: cx + w / 2,
      minZ: cz - d / 2, maxZ: cz + d / 2,
      y0, y1: y0 + h,
    };
    this.boxes.push(b);
    return b;
  }

  addCylinder(cx, cz, r, h, y0 = 0) {
    return this.addBox(cx, cz, r * 2, r * 2, h, y0);
  }

  clear() {
    this.boxes.length = 0;
  }

  resolveCircle(x, z, r, y) {
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      let pushed = false;
      for (const b of this.boxes) {
        if (y > b.y1 - 0.05 || y + 1.6 < b.y0) continue;
        const cx = Math.max(b.minX, Math.min(x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
        let dx = x - cx;
        let dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        pushed = true;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          z = cz + (dz / d) * r;
        } else {
          const overlapX = Math.min(x - b.minX + r, b.maxX - x + r);
          const overlapZ = Math.min(z - b.minZ + r, b.maxZ - z + r);
          if (overlapX < overlapZ) {
            x = (x - b.minX < b.maxX - x) ? b.minX - r : b.maxX + r;
          } else {
            z = (z - b.minZ < b.maxZ - z) ? b.minZ - r : b.maxZ + r;
          }
        }
      }
      if (!pushed) break;
    }
    return { x, z, hit };
  }

  pointInside(x, y, z) {
    for (const b of this.boxes) {
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && y >= b.y0 && y <= b.y1) return b;
    }
    return null;
  }

  obbCorners(x, z, yaw, l, w) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const hl = l / 2, hw = w / 2;
    const pts = [];
    for (const [lx, lz] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw]]) {
      pts.push({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
    }
    return pts;
  }

  resolveOBB(x, z, yaw, l, w, y) {
    let hit = false;
    let px = 0, pz = 0;
    const corners = this.obbCorners(x, z, yaw, l, w);
    const r = Math.min(w, l) * 0.42;
    for (const p of corners) {
      const res = this.resolveCircle(p.x, p.z, r, y);
      if (res.hit) {
        hit = true;
        px += res.x - p.x;
        pz += res.z - p.z;
      }
    }
    return { x: x + px / Math.max(1, corners.length / 2), z: z + pz / Math.max(1, corners.length / 2), hit };
  }
}
