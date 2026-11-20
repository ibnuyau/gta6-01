// The Palmera Bay Police Department: wanted stars, cruiser chases, foot
// officers, roadblocks with spike strips, busted and wasted. They respond
// to crimes and give up when the player stays hidden long enough.
import * as THREE from 'three';
import { TUNING } from './config.js';
import { makeCarMesh, makeCarRecord, syncCarMesh } from './vehicles.js';
import { makePedMesh } from './pedestrians.js';

export class Police {
  constructor(scene, roadLines, colliders) {
    this.scene = scene;
    this.roadLines = roadLines;
    this.colliders = colliders;
    this.wanted = 0;
    this.copCars = [];
    this.footCops = [];
    this.roadblocks = [];
    this.lastCrimeAt = 0;
    this.quietTimer = 0;
    this.spawnTimer = 0;
    this.roadblockTimer = 0;
    this.sirenLight = 0;
  }

  addWanted(stars) {
    this.wanted = Math.max(0, Math.min(5, this.wanted + stars));
    this.lastCrimeAt = performance.now();
    this.quietTimer = 0;
  }

  setWanted(stars) {
    this.wanted = Math.max(0, Math.min(5, stars));
    this.lastCrimeAt = performance.now();
    this.quietTimer = 0;
  }

  clearWanted() {
    this.wanted = 0;
    this.quietTimer = 0;
    this.clearRoadblocks();
    for (const c of this.copCars) this.scene.remove(c.mesh);
    for (const c of this.footCops) this.scene.remove(c.mesh);
    this.copCars = [];
    this.footCops = [];
  }

  clearRoadblocks() {
    for (const rb of this.roadblocks) {
      for (const c of rb.cars) this.scene.remove(c.mesh);
      if (rb.spikeMesh) this.scene.remove(rb.spikeMesh);
    }
    this.roadblocks = [];
  }

  spawnCopCarNear(x, z) {
    const line = this.roadLines[Math.floor(Math.random() * this.roadLines.length)];
    const vertical = Math.random() < 0.5;
    const sx = vertical ? line : x + (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 50);
    const sz = vertical ? z + (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 50) : line;
    const mesh = makeCarMesh(0x1c2733, true);
    const car = makeCarRecord(mesh, sx, sz, Math.random() * Math.PI * 2, 'car');
    car.isCop = true;
    car.speed = 0;
    this.scene.add(mesh);
    syncCarMesh(car);
    this.copCars.push(car);
    return car;
  }

  spawnFootCopNear(x, z) {
    const mesh = makePedMesh(0x1c2733, 0xd9a066);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.27, 0.14, 8),
      new THREE.MeshLambertMaterial({ color: 0x0e1620 })
    );
    cap.position.y = 1.85;
    mesh.add(cap);
    const a = Math.random() * Math.PI * 2;
    const cop = {
      mesh, x: x + Math.sin(a) * 18, z: z + Math.cos(a) * 18,
      heading: 0, health: 100, radius: 0.7, holdTime: 0,
    };
    mesh.position.set(cop.x, 0, cop.z);
    this.scene.add(mesh);
    this.footCops.push(cop);
    return cop;
  }

  // A roadblock: two cruisers parked across the road ahead of the player,
  // with a spike strip between them. Drive through the strip and your
  // tires are shredded — slow down, steer around, or go off-road.
  spawnRoadblock(player) {
    const ahead = 70;
    let bx = player.x + Math.sin(player.heading) * ahead;
    let bz = player.z + Math.cos(player.heading) * ahead;
    // snap the block onto the nearest avenue so it sits on a real road
    let bestLine = this.roadLines[0], bd = 1e9;
    for (const l of this.roadLines) {
      const d = Math.min(Math.abs(l - bx), Math.abs(l - bz));
      if (d < bd) { bd = d; bestLine = l; }
    }
    if (Math.abs(bestLine - bx) <= Math.abs(bestLine - bz)) bx = bestLine;
    else bz = bestLine;
    bx = Math.max(-320, Math.min(320, bx));
    bz = Math.max(-320, Math.min(320, bz));
    const across = player.heading + Math.PI / 2;
    const cars = [];
    for (const off of [-4.5, 4.5]) {
      const mesh = makeCarMesh(0x1c2733, true);
      const car = makeCarRecord(
        mesh,
        bx + Math.sin(across) * off, bz + Math.cos(across) * off,
        across, 'car'
      );
      car.isCop = true;
      car.speed = 0;
      this.scene.add(mesh);
      syncCarMesh(car);
      cars.push(car);
    }
    // spike strip: a dark mat with steel teeth across the gap
    const strip = new THREE.Group();
    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(7, 0.18, 1.4),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    mat.position.y = 0.1;
    strip.add(mat);
    const spikeGeo = new THREE.ConeGeometry(0.14, 0.5, 4);
    const spikeMat = new THREE.MeshLambertMaterial({ color: 0xc8c8c8 });
    for (let i = -3; i <= 3; i++) {
      const s = new THREE.Mesh(spikeGeo, spikeMat);
      s.position.set(i, 0.4, 0);
      strip.add(s);
    }
    strip.position.set(bx, 0, bz);
    strip.rotation.y = across;
    this.scene.add(strip);
    const rb = {
      x: bx, z: bz, heading: across, cars, spikeMesh: strip,
      spike: { x: bx, z: bz },
      ttl: TUNING.roadblockLifetimeSeconds,
    };
    this.roadblocks.push(rb);
    return rb;
  }

  update(dt, player, cars, onBusted, onCopRam) {
    // wanted decay: quiet + unseen = stars fade
    if (this.wanted > 0) {
      let nearestCop = 1e9;
      for (const c of this.copCars) nearestCop = Math.min(nearestCop, Math.hypot(c.x - player.x, c.z - player.z));
      for (const c of this.footCops) nearestCop = Math.min(nearestCop, Math.hypot(c.x - player.x, c.z - player.z));
      const quietFor = (performance.now() - this.lastCrimeAt) / 1000;
      if (quietFor > TUNING.wantedDecaySeconds && nearestCop > 40) {
        this.quietTimer += dt;
        if (this.quietTimer > 5) {
          this.wanted -= 1;
          this.quietTimer = 0;
          if (this.wanted <= 0) this.clearWanted();
        }
      } else {
        this.quietTimer = 0;
      }
    }

    // roadblocks: at 3 stars and up the department blocks the road ahead
    if (this.wanted >= TUNING.roadblockMinWanted) {
      this.roadblockTimer -= dt;
      if (this.roadblockTimer <= 0 && this.roadblocks.length === 0) {
        this.spawnRoadblock(player);
        this.roadblockTimer = TUNING.roadblockIntervalSeconds;
      }
    } else {
      this.roadblockTimer = 0;
    }
    for (const rb of [...this.roadblocks]) {
      rb.ttl -= dt;
      if (rb.ttl <= 0 || this.wanted === 0) {
        for (const c of rb.cars) this.scene.remove(c.mesh);
        if (rb.spikeMesh) this.scene.remove(rb.spikeMesh);
        this.roadblocks.splice(this.roadblocks.indexOf(rb), 1);
      }
    }

    // keep the right number of cruisers on the street (four at 4-5 stars)
    const wantCars = this.wanted === 0 ? 0 : Math.min(4, this.wanted);
    this.spawnTimer -= dt;
    if (this.copCars.length < wantCars && this.spawnTimer <= 0) {
      this.spawnCopCarNear(player.x, player.z);
      this.spawnTimer = 2;
    }
    if (this.copCars.length > wantCars) {
      const extra = this.copCars.pop();
      this.scene.remove(extra.mesh);
    }
    const wantFoot = this.wanted >= 2 && !player.inCar ? Math.min(3, this.wanted - 1) : 0;
    if (this.footCops.length < wantFoot && this.spawnTimer <= 0) {
      this.spawnFootCopNear(player.x, player.z);
      this.spawnTimer = 2;
    }
    if (this.footCops.length > wantFoot) {
      const extra = this.footCops.pop();
      this.scene.remove(extra.mesh);
    }

    // cruiser chase: steer at the player, ram to slow them down
    for (const car of this.copCars) {
      const dx = player.x - car.x, dz = player.z - car.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const targetSpeed = dist > 60 ? TUNING.copCarSpeed : Math.min(TUNING.copCarSpeed, 14 + dist * 0.35);
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      // bounce off buildings
      for (const c of this.colliders) {
        const cx = Math.max(c.x - c.hx, Math.min(c.x + c.hx, car.x));
        const cz = Math.max(c.z - c.hz, Math.min(c.z + c.hz, car.z));
        const d = Math.hypot(car.x - cx, car.z - cz);
        if (d < 2.4) { car.heading += Math.PI * 0.6; car.speed *= 0.5; }
      }
      syncCarMesh(car);
      if (dist < 4.6) {
        onCopRam && onCopRam(dist);
        if (player.inCar) {
          player.carSpeed *= 0.82;
        } else {
          player.bustedTimer += dt;
          if (player.bustedTimer > TUNING.bustedHoldSeconds) {
            onBusted && onBusted();
            player.bustedTimer = 0;
          }
        }
      } else if (!player.inCar) {
        player.bustedTimer = Math.max(0, player.bustedTimer - dt);
      }
    }

    // foot officers chase and punch
    for (const cop of [...this.footCops]) {
      if (cop.health <= 0) {
        this.scene.remove(cop.mesh);
        this.footCops.splice(this.footCops.indexOf(cop), 1);
        continue;
      }
      const dx = player.x - cop.x, dz = player.z - cop.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      cop.heading = want;
      if (dist > 1.6) {
        cop.x += Math.sin(want) * TUNING.copFootSpeed * dt;
        cop.z += Math.cos(want) * TUNING.copFootSpeed * dt;
      } else {
        player.takeDamage(14 * dt);
        player.bustedTimer += dt * 0.8;
        if (player.bustedTimer > TUNING.bustedHoldSeconds) {
          onBusted && onBusted();
          player.bustedTimer = 0;
        }
      }
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
    }
  }
}
