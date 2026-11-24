import * as THREE from 'three';
import { CFG } from './config.js';
import { canvasTexture } from './utils.js';
import { ColliderWorld } from './collision.js';
import { inCity, blockIsPark, isOnRoad, nearestBlock, sampleSidewalkPoint } from './citygrid.js';

const C = CFG.city;

function roadTexture() {
  return canvasTexture(128, 512, (ctx, w, h) => {
    ctx.fillStyle = '#26292e';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(5, 0, 3, h);
    ctx.fillRect(w - 8, 0, 3, h);
    ctx.fillStyle = '#d8b93a';
    for (let y = 0; y < h; y += 64) ctx.fillRect(w / 2 - 2, y, 4, 34);
  });
}

function sidewalkTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8f959e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.stroke();
  });
}

function grassTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3e7a38';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const g = 90 + Math.random() * 60;
      ctx.fillStyle = `rgb(${g * 0.45},${g},${g * 0.4})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

function plazaTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#7d838c';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo((i * w) / 4, 0); ctx.lineTo((i * w) / 4, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (i * h) / 4); ctx.lineTo(w, (i * h) / 4); ctx.stroke();
    }
  });
}

function lotTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#22252a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#cfcfcf';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const x = 32 + i * 64;
      ctx.strokeRect(x, 20, 44, 90);
      ctx.strokeRect(x, 146, 44, 90);
    }
  });
}

function facadeTextures() {
  const map = canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d9dee4';
    ctx.fillRect(0, 0, w, h);
    const cols = 5, rows = 11;
    const mw = 12, mh = 8;
    const gw = (w - mw * 2) / cols, gh = (h - mh * 2) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const shade = 30 + Math.random() * 25;
        ctx.fillStyle = `rgb(${shade},${shade + 8},${shade + 18})`;
        ctx.fillRect(mw + c * gw + 3, mh + r * gh + 3, gw - 6, gh - 6);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, h - 14, w, 14);
  });
  const emis = canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    const cols = 5, rows = 11;
    const mw = 12, mh = 8;
    const gw = (w - mw * 2) / cols, gh = (h - mh * 2) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.35) continue;
        const warm = Math.random() < 0.75;
        ctx.fillStyle = warm ? '#ffd27a' : '#bfe3ff';
        ctx.fillRect(mw + c * gw + 3, mh + r * gh + 3, gw - 6, gh - 6);
      }
    }
  });
  emis.colorSpace = THREE.SRGBColorSpace;
  return { map, emis };
}

function roofTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#41464e';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

function signTexture(text, bg = '#101418', fg = '#ffd24a') {
  return canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = fg;
    ctx.font = 'bold 34px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

function glowTexture() {
  const tex = new THREE.CanvasTexture((() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return c;
  })());
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class World {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.colliders = new ColliderWorld();
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.parkedSpots = [];
    this.garages = [];
    this.missionPads = {
      m1: { x: 10.5, z: 10.5 },
      m2: { x: -10.5, z: 10.5 },
      m3: { x: 10.5, z: -10.5 },
      m4: { x: -10.5, z: -10.5 },
      m5: { x: 109.5, z: 10.5 },
    };
    this.spawn = { x: 0, z: 24, yaw: Math.PI };
    this.lotBlock = { bx: 90, bz: -30 };
    this.garageBlocks = [{ bx: -90, bz: 30 }, { bx: 30, bz: -90 }];
    this._buildGround();
    this._buildRoads();
    this._buildBlocks();
    this._buildLamps();
    this._buildProps();
    this._buildGarages();
    this._buildParking();
    this._buildStars();
    this.night = 0;
  }

  _buildGround() {
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 1600),
      new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 })
    );
    grass.material.map.repeat.set(60, 60);
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.06;
    grass.receiveShadow = true;
    this.group.add(grass);

    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(C.extent * 2 + 8, C.extent * 2 + 8),
      new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 1 })
    );
    base.rotation.x = -Math.PI / 2;
    base.position.y = 0.0;
    base.receiveShadow = true;
    this.group.add(base);
  }

  _buildRoads() {
    const len = C.extent * 2;
    const texH = roadTexture();
    const texV = roadTexture();
    const matH = new THREE.MeshStandardMaterial({ map: texH, roughness: 0.95 });
    const matV = new THREE.MeshStandardMaterial({ map: texV, roughness: 0.95 });
    matH.map.repeat.set(1, len / 16);
    matV.map.repeat.set(1, len / 16);
    const geoH = new THREE.PlaneGeometry(C.roadWidth, len);
    const geoV = new THREE.PlaneGeometry(len, C.roadWidth);
    for (const r of C.roads) {
      const h = new THREE.Mesh(geoH, matH);
      h.rotation.x = -Math.PI / 2;
      h.rotation.z = Math.PI / 2;
      h.position.set(r, 0.03, 0);
      h.receiveShadow = true;
      this.group.add(h);
      const v = new THREE.Mesh(geoV, matV);
      v.rotation.x = -Math.PI / 2;
      v.position.set(0, 0.032, r);
      v.receiveShadow = true;
      this.group.add(v);
    }
    const interGeo = new THREE.PlaneGeometry(C.roadWidth, C.roadWidth);
    const interMat = new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.95 });
    const crossMat = new THREE.MeshStandardMaterial({ color: 0xd7d7d7, roughness: 0.8 });
    const crossGeo = new THREE.PlaneGeometry(0.55, 3.2);
    const crosses = [];
    for (const ix of C.roads) {
      for (const iz of C.roads) {
        const m = new THREE.Mesh(interGeo, interMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(ix, 0.034, iz);
        m.receiveShadow = true;
        this.group.add(m);
        for (const s of [-1, 1]) {
          for (let i = -2; i <= 2; i++) {
            crosses.push({ x: ix + s * 9.2, z: iz + i * 2.2, rot: 0 });
            crosses.push({ x: ix + i * 2.2, z: iz + s * 9.2, rot: Math.PI / 2 });
          }
        }
      }
    }
    const crossMesh = new THREE.InstancedMesh(crossGeo, crossMat, crosses.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    crosses.forEach((c, i) => {
      q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, c.rot));
      m4.compose(new THREE.Vector3(c.x, 0.036, c.z), q, new THREE.Vector3(1, 1, 1));
      crossMesh.setMatrixAt(i, m4);
    });
    crossMesh.receiveShadow = true;
    this.group.add(crossMesh);
  }

  _buildBlocks() {
    const walkTex = sidewalkTexture();
    const grassTex = grassTexture();
    const plazaTex = plazaTexture();
    const lotTex = lotTexture();
    const walkGeo = new THREE.PlaneGeometry(C.blockSize + C.sidewalk * 2, C.blockSize + C.sidewalk * 2);
    const innerGeo = new THREE.PlaneGeometry(C.blockSize, C.blockSize);

    const facade = facadeTextures();
    const roofTex = roofTexture();
    this.buildingSideMat = new THREE.MeshStandardMaterial({
      map: facade.map, emissiveMap: facade.emis, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.85,
    });
    const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 1 });
    this.roofMat = roofMat;

    const buildings = [];
    const palette = [0xb8c4d0, 0xc7b299, 0x9fb2c8, 0xc4c9cf, 0xb59f8f, 0x8fa3b8, 0xd0c8b8, 0xa8b8a0];

    for (const bx of C.blocks) {
      for (const bz of C.blocks) {
        const walk = new THREE.Mesh(walkGeo, new THREE.MeshStandardMaterial({ map: walkTex.clone(), roughness: 1 }));
        walk.material.map.repeat.set(11, 11);
        walk.rotation.x = -Math.PI / 2;
        walk.position.set(bx, 0.05, bz);
        walk.receiveShadow = true;
        this.group.add(walk);

        const isPark = blockIsPark(bx, bz);
        const isLot = bx === this.lotBlock.bx && bz === this.lotBlock.bz;
        const isGarage = this.garageBlocks.some((g) => g.bx === bx && g.bz === bz);

        let innerMat;
        if (isPark) innerMat = new THREE.MeshStandardMaterial({ map: grassTex.clone(), roughness: 1 });
        else if (isLot) innerMat = new THREE.MeshStandardMaterial({ map: lotTex.clone(), roughness: 0.95 });
        else innerMat = new THREE.MeshStandardMaterial({ map: plazaTex.clone(), roughness: 1 });
        innerMat.map.repeat.set(6, 6);
        const inner = new THREE.Mesh(innerGeo, innerMat);
        inner.rotation.x = -Math.PI / 2;
        inner.position.set(bx, isPark ? 0.09 : 0.07, bz);
        inner.receiveShadow = true;
        this.group.add(inner);

        if (isPark) { this._buildPark(bx, bz); continue; }
        if (isLot) continue;
        if (isGarage) continue;

        const distCenter = Math.max(Math.abs(bx), Math.abs(bz));
        const maxH = distCenter <= 30 ? 58 : distCenter <= 90 ? 34 : 20;
        const lots = Math.random() < 0.45 ? 1 : 2;
        for (let i = 0; i < lots; i++) {
          let w, d, x, z;
          if (lots === 1) {
            w = 16 + Math.random() * 14;
            d = 16 + Math.random() * 14;
            x = bx + (Math.random() * 2 - 1) * 4;
            z = bz + (Math.random() * 2 - 1) * 4;
          } else {
            const splitX = Math.random() < 0.5;
            w = splitX ? 14 : 24 + Math.random() * 8;
            d = splitX ? 24 + Math.random() * 8 : 14;
            x = bx + (splitX ? (i === 0 ? -9 : 9) : 0);
            z = bz + (splitX ? 0 : (i === 0 ? -9 : 9));
          }
          const h = 8 + Math.random() * (maxH - 8);
          buildings.push({ x, z, w, d, h, color: palette[Math.floor(Math.random() * palette.length)] });
          this.colliders.addBox(x, z, w + 0.4, d + 0.4, h, 0.07);
        }
      }
    }

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    boxGeo.translate(0, 0.5, 0);
    this.buildingsMesh = new THREE.InstancedMesh(boxGeo, [this.buildingSideMat, this.buildingSideMat, roofMat, roofMat, this.buildingSideMat, this.buildingSideMat], buildings.length);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    buildings.forEach((b, i) => {
      m4.compose(
        new THREE.Vector3(b.x, 0.07, b.z),
        new THREE.Quaternion(),
        new THREE.Vector3(b.w, b.h, b.d)
      );
      this.buildingsMesh.setMatrixAt(i, m4);
      this.buildingsMesh.setColorAt(i, col.setHex(b.color));
    });
    this.buildingsMesh.castShadow = true;
    this.buildingsMesh.receiveShadow = true;
    this.group.add(this.buildingsMesh);
  }

  _buildPark(bx, bz) {
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6);
    trunkGeo.translate(0, 0.8, 0);
    const leafGeo = new THREE.IcosahedronGeometry(1.5, 1);
    leafGeo.translate(0, 2.6, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const spots = [];
    const fountain = bx === 90 && bz === 90;
    for (let i = 0; i < 12; i++) {
      const x = bx + (Math.random() * 2 - 1) * 15;
      const z = bz + (Math.random() * 2 - 1) * 15;
      if (fountain && Math.hypot(x - bx, z - bz) < 5.5) continue;
      spots.push({ x, z, s: 0.8 + Math.random() * 0.7 });
      this.colliders.addCylinder(x, z, 0.32, 3.4, 0.09);
    }
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, Math.max(1, spots.length));
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, Math.max(1, spots.length));
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    spots.forEach((s, i) => {
      m4.compose(new THREE.Vector3(s.x, 0.09, s.z), new THREE.Quaternion(), new THREE.Vector3(s.s, s.s, s.s));
      trunks.setMatrixAt(i, m4);
      leaves.setMatrixAt(i, m4);
      leaves.setColorAt(i, col.setHSL(0.29 + Math.random() * 0.07, 0.55, 0.32 + Math.random() * 0.12));
    });
    trunks.castShadow = leaves.castShadow = true;
    this.group.add(trunks, leaves);

    const benchGeo = new THREE.BoxGeometry(1.8, 0.12, 0.55);
    benchGeo.translate(0, 0.45, 0);
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
    const benchSpots = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const x = bx + Math.cos(a) * 8;
      const z = bz + Math.sin(a) * 8;
      benchSpots.push({ x, z, yaw: a + Math.PI / 2 });
      this.colliders.addBox(x, z, 1.8, 0.6, 0.6, 0.09);
    }
    const benches = new THREE.InstancedMesh(benchGeo, benchMat, benchSpots.length);
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    benchSpots.forEach((s, i) => {
      q.setFromAxisAngle(up, s.yaw);
      m4.compose(new THREE.Vector3(s.x, 0.09, s.z), q, new THREE.Vector3(1, 1, 1));
      benches.setMatrixAt(i, m4);
    });
    benches.castShadow = true;
    this.group.add(benches);

    if (fountain) {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(3.2, 3.4, 0.7, 20),
        new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.8 })
      );
      base.position.set(bx, 0.09 + 0.35, bz);
      base.castShadow = base.receiveShadow = true;
      const water = new THREE.Mesh(
        new THREE.CircleGeometry(2.9, 20),
        new THREE.MeshStandardMaterial({ color: 0x3a86c8, emissive: 0x1a4a88, emissiveIntensity: 0.6, roughness: 0.15 })
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(bx, 0.09 + 0.72, bz);
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.45, 2.2, 10),
        new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.8 })
      );
      pillar.position.set(bx, 0.09 + 1.1, bz);
      pillar.castShadow = true;
      this.group.add(base, water, pillar);
      this.fountainWater = water;
      this.colliders.addCylinder(bx, bz, 3.4, 0.8, 0.09);
    }
  }

  _buildLamps() {
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 6.4, 6);
    poleGeo.translate(0, 3.2, 0);
    const armGeo = new THREE.BoxGeometry(1.1, 0.12, 0.12);
    armGeo.translate(0.45, 6.3, 0);
    const headGeo = new THREE.BoxGeometry(0.55, 0.14, 0.28);
    headGeo.translate(0.95, 6.22, 0);
    const poolGeo = new THREE.CircleGeometry(4.2, 16);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.6, metalness: 0.4 });
    this.lampHeadMat = new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0xffd9a0, emissiveIntensity: 0 });
    this.lampPoolMat = new THREE.MeshBasicMaterial({ color: 0xffc873, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const spots = [];
    for (const r of C.roads) {
      for (let s = -C.extent + 12; s <= C.extent - 12; s += 26) {
        for (const side of [-1, 1]) {
          const nearInter = C.roads.some((ir) => Math.abs(s - ir) < 9);
          if (nearInter) continue;
          spots.push({ axis: 'z', coord: r, s, side });
          spots.push({ axis: 'x', coord: r, s, side });
        }
      }
    }
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
    const arms = new THREE.InstancedMesh(armGeo, poleMat, spots.length);
    const heads = new THREE.InstancedMesh(headGeo, this.lampHeadMat, spots.length);
    const pools = new THREE.InstancedMesh(poolGeo, this.lampPoolMat, spots.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    this.lampSpots = [];
    spots.forEach((sp, i) => {
      let x, z, yaw;
      if (sp.axis === 'z') {
        x = sp.coord + sp.side * (C.roadWidth / 2 + 0.7);
        z = sp.s;
        yaw = sp.side > 0 ? Math.PI : 0;
      } else {
        x = sp.s;
        z = sp.coord + sp.side * (C.roadWidth / 2 + 0.7);
        yaw = sp.side > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
      q.setFromAxisAngle(up, yaw);
      m4.compose(new THREE.Vector3(x, 0.03, z), q, new THREE.Vector3(1, 1, 1));
      poles.setMatrixAt(i, m4);
      arms.setMatrixAt(i, m4);
      heads.setMatrixAt(i, m4);
      const pq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
      m4.compose(new THREE.Vector3(x + Math.cos(yaw) * 0.95, 0.045, z - Math.sin(yaw) * 0.95), pq, new THREE.Vector3(1, 1, 1));
      pools.setMatrixAt(i, m4);
      this.lampSpots.push({ x, z });
      this.colliders.addCylinder(x, z, 0.22, 6.4, 0.03);
    });
    poles.castShadow = true;
    this.group.add(poles, arms, heads, pools);
  }

  _buildProps() {
    const hydGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.7, 8);
    hydGeo.translate(0, 0.35, 0);
    const hydMat = new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: 0.6 });
    const hydSpots = [];
    for (let i = 0; i < 14; i++) {
      const p = sampleSidewalkPoint();
      hydSpots.push(p);
      this.colliders.addCylinder(p.x, p.z, 0.25, 0.7, 0.05);
    }
    const hyds = new THREE.InstancedMesh(hydGeo, hydMat, hydSpots.length);
    const m4 = new THREE.Matrix4();
    hydSpots.forEach((p, i) => {
      m4.makeTranslation(p.x, 0.05, p.z);
      hyds.setMatrixAt(i, m4);
    });
    hyds.castShadow = true;
    this.group.add(hyds);

    const treeTrunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.1, 6);
    treeTrunkGeo.translate(0, 0.55, 0);
    const treeLeafGeo = new THREE.IcosahedronGeometry(0.95, 1);
    treeLeafGeo.translate(0, 1.8, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const spots = [];
    for (const bx of C.blocks) {
      for (const bz of C.blocks) {
        if (Math.random() < 0.55) {
          const p = sampleSidewalkPoint();
          if (nearestBlock(p.x, p.z).bx === bx && nearestBlock(p.x, p.z).bz === bz) {
            spots.push({ x: p.x, z: p.z, s: 0.9 + Math.random() * 0.5 });
            this.colliders.addCylinder(p.x, p.z, 0.25, 2.6, 0.05);
          }
        }
      }
    }
    const trunks = new THREE.InstancedMesh(treeTrunkGeo, trunkMat, Math.max(1, spots.length));
    const leaves = new THREE.InstancedMesh(treeLeafGeo, leafMat, Math.max(1, spots.length));
    const col = new THREE.Color();
    spots.forEach((s, i) => {
      m4.compose(new THREE.Vector3(s.x, 0.05, s.z), new THREE.Quaternion(), new THREE.Vector3(s.s, s.s, s.s));
      trunks.setMatrixAt(i, m4);
      leaves.setMatrixAt(i, m4);
      leaves.setColorAt(i, col.setHSL(0.3, 0.5, 0.3 + Math.random() * 0.1));
    });
    trunks.castShadow = leaves.castShadow = true;
    this.group.add(trunks, leaves);

    this.glowTex = glowTexture();
  }

  _buildGarages() {
    for (const g of this.garageBlocks) {
      const grp = new THREE.Group();
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x5a6672, roughness: 0.8 });
      const roofMat2 = new THREE.MeshStandardMaterial({ color: 0x39414c, roughness: 1 });
      const back = new THREE.Mesh(new THREE.BoxGeometry(16, 5, 0.6), wallMat);
      back.position.set(g.bx, 2.5, g.bz - 8);
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 16), wallMat);
      left.position.set(g.bx - 8, 2.5, g.bz);
      const right = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 16), wallMat);
      right.position.set(g.bx + 8, 2.5, g.bz);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(17, 0.5, 17), roofMat2);
      roof.position.set(g.bx, 5.2, g.bz);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 2.5),
        new THREE.MeshBasicMaterial({ map: signTexture('GARAGE'), transparent: false })
      );
      sign.position.set(g.bx, 4.4, g.bz + 8.32);
      grp.add(back, left, right, roof, sign);
      back.castShadow = roof.castShadow = true;
      back.receiveShadow = roof.receiveShadow = true;
      this.group.add(grp);
      this.colliders.addBox(g.bx, g.bz - 8, 16, 0.8, 5, 0.07);
      this.colliders.addBox(g.bx - 8, g.bz, 0.8, 16, 5, 0.07);
      this.colliders.addBox(g.bx + 8, g.bz, 0.8, 16, 5, 0.07);
      this.colliders.addBox(g.bx, g.bz, 17, 17, 0.6, 5.2);
      this.garages.push({ x: g.bx, z: g.bz + 11.5, r: 6 });
    }
  }

  _buildParking() {
    const { bx, bz } = this.lotBlock;
    const spots = [];
    for (let i = 0; i < 8; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = bx - 12 + col * 8;
      const z = bz - 6 + row * 12;
      spots.push({ x, z, yaw: row === 0 ? 0 : Math.PI });
    }
    this.parkedSpots = spots;
  }

  _buildStars() {
    const n = 400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 0.5 + 0.08;
      const r = 500;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
    this.scene.add(this.stars);
  }

  setNight(t) {
    this.night = t;
    this.lampHeadMat.emissiveIntensity = t * 1.6;
    this.lampPoolMat.opacity = t * 0.16;
    this.buildingSideMat.emissiveIntensity = t;
    if (this.stars) this.stars.material.opacity = t * 0.9;
  }

  update(dt, time) {
    if (this.fountainWater) {
      const s = 1 + Math.sin(time * 2.2) * 0.03;
      this.fountainWater.scale.set(s, 1, s);
    }
  }
}
