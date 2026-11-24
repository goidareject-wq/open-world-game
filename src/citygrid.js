import { CFG } from './config.js';

const C = CFG.city;
const ROADS = C.roads;
const BLOCKS = C.blocks;
const HALF_ROAD = C.roadWidth / 2;
const HALF_BLOCK = C.blockSize / 2;
const HALF_WALK = HALF_BLOCK + C.sidewalk;

export function nearestRoadCoord(v) {
  let best = ROADS[0];
  let bd = Math.abs(v - best);
  for (const r of ROADS) {
    const d = Math.abs(v - r);
    if (d < bd) { bd = d; best = r; }
  }
  return { coord: best, dist: bd };
}

export function isOnRoad(x, z, margin = 0) {
  const rx = nearestRoadCoord(x);
  const rz = nearestRoadCoord(z);
  return rx.dist < HALF_ROAD - margin || rz.dist < HALF_ROAD - margin;
}

export function nearestBlock(x, z) {
  let best = null;
  let bd = Infinity;
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      const d = Math.max(Math.abs(x - bx), Math.abs(z - bz));
      if (d < bd) { bd = d; best = { bx, bz }; }
    }
  }
  return { bx: best.bx, bz: best.bz, dist: bd };
}

export function inCity(x, z) {
  return Math.abs(x) <= C.extent && Math.abs(z) <= C.extent;
}

export function groundHeight(x, z) {
  if (!inCity(x, z)) return 0;
  if (isOnRoad(x, z, 0.4)) return 0.03;
  const b = nearestBlock(x, z);
  if (b.dist <= HALF_BLOCK) {
    const park = C.parkBlocks.some(([px, pz]) => px === b.bx && pz === b.bz);
    return park ? 0.09 : 0.07;
  }
  if (b.dist <= HALF_WALK) return 0.05;
  return 0.03;
}

export function surfaceType(x, z) {
  if (!inCity(x, z)) return 'grass';
  if (isOnRoad(x, z, 0.4)) return 'road';
  const b = nearestBlock(x, z);
  if (b.dist <= HALF_BLOCK) {
    const park = C.parkBlocks.some(([px, pz]) => px === b.bx && pz === b.bz);
    return park ? 'park' : 'plaza';
  }
  if (b.dist <= HALF_WALK) return 'sidewalk';
  return 'road';
}

export function laneOffset(axis, dir, roadCoord) {
  if (axis === 'z') return { x: roadCoord - dir * 3.5, z: null };
  return { x: null, z: roadCoord + dir * 3.5 };
}

export function sampleRoadPoint(rng = Math.random) {
  const axis = rng() < 0.5 ? 'x' : 'z';
  const ri = Math.floor(rng() * ROADS.length);
  const r = ROADS[ri];
  const s = (rng() * 2 - 1) * (C.extent - 12);
  const dir = rng() < 0.5 ? 1 : -1;
  const lane = laneOffset(axis, dir, r);
  if (axis === 'z') return { x: lane.x, z: s, axis, dir, road: r, yaw: dir > 0 ? 0 : Math.PI };
  return { x: s, z: lane.z, axis, dir, road: r, yaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
}

export function sampleSidewalkPoint(rng = Math.random) {
  const bi = Math.floor(rng() * BLOCKS.length);
  const bj = Math.floor(rng() * BLOCKS.length);
  const bx = BLOCKS[bi];
  const bz = BLOCKS[bj];
  const half = HALF_BLOCK + C.sidewalk / 2;
  const side = Math.floor(rng() * 4);
  const t = (rng() * 2 - 1) * half;
  if (side === 0) return { x: bx + t, z: bz - half };
  if (side === 1) return { x: bx + t, z: bz + half };
  if (side === 2) return { x: bx - half, z: bz + t };
  return { x: bx + half, z: bz + t };
}

export function sampleCityPoint(rng = Math.random) {
  return rng() < 0.6 ? sampleRoadPoint(rng) : sampleSidewalkPoint(rng);
}

export function blockIsPark(bx, bz) {
  return C.parkBlocks.some(([px, pz]) => px === bx && pz === bz);
}

export function isIntersection(x, z, tol = 6.5) {
  return nearestRoadCoord(x).dist < tol && nearestRoadCoord(z).dist < tol;
}
