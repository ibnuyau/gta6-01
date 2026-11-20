// Pedestrians of Palmera Bay: they stroll the sidewalks, chat, and run
// away from danger. When one leaves town (or gets run over), another
// wanders in after a while, so the streets never go empty.
import * as THREE from 'three';
import { PED_SHIRTS, mulberry32 } from './config.js';

export function makePedMesh(shirtColor, skinColor) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.38, 1.05, 8),
    new THREE.MeshLambertMaterial({ color: shirtColor })
  );
  body.position.y = 0.85;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshLambertMaterial({ color: skinColor || 0xd9a066 })
  );
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x2a2f38 })
  );
  legs.position.y = 0.25;
  group.add(legs);
  return group;
}

const SKINS = [0xd9a066, 0x8a5a3b, 0xf0c8a0, 0x6b4423];

export class Pedestrians {
  constructor(scene, roadLines) {
    this.scene = scene;
    this.roadLines = roadLines;
    this.peds = [];
    this.rand = mulberry32(99);
    this.targetCount = 24;
    this.respawnTimer = 0;
    for (let i = 0; i < this.targetCount; i++) this.spawnPed();
  }

  spawnPed() {
    const shirt = PED_SHIRTS[Math.floor(this.rand() * PED_SHIRTS.length)];
    const mesh = makePedMesh(shirt, SKINS[Math.floor(this.rand() * SKINS.length)]);
    const line = this.roadLines[Math.floor(this.rand() * this.roadLines.length)];
    const along = -320 + this.rand() * 640;
    const vertical = this.rand() < 0.5;
    const x = vertical ? line + 10 : along;
    const z = vertical ? along : line + 10;
    const ped = {
      mesh, x, z, heading: this.rand() * Math.PI * 2,
      speed: 1.2 + this.rand() * 0.8, radius: 0.6,
      flee: 0, target: null, walkPhase: this.rand() * 10,
    };
    ped.target = this.pickTarget(ped);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.peds.push(ped);
    return ped;
  }

  pickTarget(ped) {
    const lines = this.roadLines;
    const line = lines[Math.floor(this.rand() * lines.length)];
    const along = -320 + this.rand() * 640;
    const vertical = this.rand() < 0.5;
    return vertical ? { x: line + 10, z: along } : { x: along, z: line + 10 };
  }

  update(dt, danger, copCars) {
    // keep the streets populated: a fresh pedestrian wanders in every
    // 20 seconds until the crowd is back to full strength
    if (this.peds.length < this.targetCount) {
      this.respawnTimer += dt;
      if (this.respawnTimer > 20) {
        this.respawnTimer = 0;
        this.spawnPed();
      }
    }
    for (const p of this.peds) {
      let speed = p.speed;
      if (danger) {
        const dd = Math.hypot(danger.x - p.x, danger.z - p.z);
        if (dd < danger.radius) {
          p.flee = 2.5;
          const away = Math.atan2(p.x - danger.x, p.z - danger.z);
          p.heading = away;
          speed = 4.2;
        }
      }
      // a speeding cop car scares the crowd just as much as Milo does
      if (copCars && p.flee <= 0) {
        for (const c of copCars) {
          if (Math.abs(c.speed) > 12 && Math.hypot(c.x - p.x, c.z - p.z) < 10) {
            p.flee = 2;
            p.heading = Math.atan2(p.x - c.x, p.z - c.z);
            speed = 4.2;
            break;
          }
        }
      }
      if (p.flee > 0) {
        p.flee -= dt;
      } else {
        if (!p.target) p.target = this.pickTarget(p);
        const dx = p.target.x - p.x, dz = p.target.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 3) { p.target = this.pickTarget(p); continue; }
        const want = Math.atan2(dx, dz);
        let diff = want - p.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
      }
      p.x += Math.sin(p.heading) * speed * dt;
      p.z += Math.cos(p.heading) * speed * dt;
      p.x = Math.max(-360, Math.min(360, p.x));
      p.z = Math.max(-360, Math.min(360, p.z));
      p.walkPhase += dt * speed * 3;
      p.mesh.position.set(p.x, Math.abs(Math.sin(p.walkPhase)) * 0.05, p.z);
      p.mesh.rotation.y = p.heading;
    }
  }

  nearestPed(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const p of this.peds) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  removePed(ped) {
    this.scene.remove(ped.mesh);
    const i = this.peds.indexOf(ped);
    if (i >= 0) this.peds.splice(i, 1);
  }
}
