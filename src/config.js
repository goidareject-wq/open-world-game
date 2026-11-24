export const CFG = {
  city: {
    roads: [-120, -60, 0, 60, 120],
    blocks: [-90, -30, 30, 90],
    blockSize: 36,
    roadWidth: 14,
    sidewalk: 5,
    extent: 127,
    parkBlocks: [[90, 90], [-90, -90]],
  },
  player: {
    walk: 4.6,
    sprint: 8.4,
    accel: 42,
    airAccel: 12,
    radius: 0.42,
    jumpVel: 7.6,
    gravity: 23,
    height: 1.78,
    boostMult: 1.55,
    boostTime: 20,
  },
  cam: {
    minDist: 3.2,
    maxDist: 13,
    vMin: 6.5,
    vMax: 17,
    sens: 0.0026,
    pitchMin: -1.15,
    pitchMax: 0.6,
    fov: 62,
  },
  dayLength: 240,
  startHour: 9,
  weather: { minTime: 45, maxTime: 95, changeTime: 6 },
  counts: {
    traffic: { low: 6, medium: 10, high: 14 },
    peds: { low: 10, medium: 16, high: 24 },
    rain: { low: 500, medium: 1000, high: 1700 },
    orbs: 14,
  },
  quality: {
    low: { pixelRatio: 0.75, shadows: false, rain: 'low', traffic: 'low', peds: 'low' },
    medium: { pixelRatio: 1, shadows: true, rain: 'medium', traffic: 'medium', peds: 'medium' },
    high: { pixelRatio: 1.5, shadows: true, rain: 'high', traffic: 'high', peds: 'high' },
  },
  saveKey: 'projectlife_save_v1',
  settingsKey: 'projectlife_settings_v1',
  itemTypes: ['coffee', 'nitro', 'repair'],
};

export const VEHICLE_TYPES = {
  sedan: {
    name: 'Sedan', accel: 14, topSpeed: 34, brake: 26, reverseSpeed: 10,
    steer: 2.4, grip: 1.0, offroad: 0.55, mass: 1.0,
    size: { l: 4.6, w: 2.0, h: 1.5 }, color: 0x3d6fd1, price: 0,
  },
  sports: {
    name: 'Sports Coupe', accel: 22, topSpeed: 46, brake: 32, reverseSpeed: 12,
    steer: 3.0, grip: 1.15, offroad: 0.4, mass: 0.85,
    size: { l: 4.4, w: 2.0, h: 1.25 }, color: 0xd13438, price: 0,
  },
  suv: {
    name: 'SUV', accel: 11, topSpeed: 28, brake: 22, reverseSpeed: 9,
    steer: 2.0, grip: 0.9, offroad: 0.85, mass: 1.4,
    size: { l: 4.9, w: 2.1, h: 1.9 }, color: 0x2f3a45, price: 0,
  },
  truck: {
    name: 'Pickup Truck', accel: 9, topSpeed: 25, brake: 18, reverseSpeed: 8,
    steer: 1.7, grip: 0.85, offroad: 0.95, mass: 1.8,
    size: { l: 5.4, w: 2.2, h: 1.9 }, color: 0xc07a2a, price: 0,
  },
  van: {
    name: 'Van', accel: 10, topSpeed: 26, brake: 20, reverseSpeed: 9,
    steer: 1.9, grip: 0.85, offroad: 0.6, mass: 1.5,
    size: { l: 5.0, w: 2.2, h: 2.2 }, color: 0xd8d8d8, price: 0,
  },
};

export const ITEM_INFO = {
  coffee: { name: 'Coffee', desc: 'Run 55% faster for 20s', color: '#8a5a2b' },
  nitro: { name: 'Nitro Boost', desc: 'Instant speed burst in a vehicle', color: '#2bd1c8' },
  repair: { name: 'Repair Kit', desc: 'Fully repairs your vehicle', color: '#d1a02b' },
};
