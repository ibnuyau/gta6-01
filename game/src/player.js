// Milo Reyes: walking, sprinting, stealing and driving cars and bikes,
// punching and shooting. Arcade physics on purpose — it should feel good,
// not simulate. Garage upgrades (engine, armor, tires) live here and
// apply to whatever vehicle Milo is driving.
import * as THREE from 'three';
import { TUNING } from './config.js';
import { makePedMesh, } from './pedestrians.js';
import { syncCarMesh } from './vehicles.js';

export class Player {
  constructor(scene, sounds) {
    this.scene = scene;
    this.sounds = sounds;
    this.mesh = makePedMesh(0xe85d2a, 0xd9a066); // Milo: orange jacket
    this.mesh.scale.set(1.05, 1.05, 1.05);
    scene.add(this.mesh);
    this.x = -40; this.z = 120; this.heading = Math.PI / 2;
    this.vx = 0; this.vz = 0;
    this.health = TUNING.maxHealth;
    this.money = 0;
    this.armed = false;
    this.inCar = null;
    this.carSpeed = 0;
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.bustedTimer = 0;
    this.lastDamageAt = 0;
    this.upgrades = { engine: 0, armor: 0, tires: 0 };
    this.tireTimer = 0;      // seconds left of spike-strip slowdown
    this.wobbleTime = 0;
  }

  reset(x, z, heading) {
    this.x = x; this.z = z; this.heading = heading;
    this.health = TUNING.maxHealth;
    this.inCar = null; this.carSpeed = 0; this.armed = false;
    this.bustedTimer = 0;
    this.tireTimer = 0;
  }

  get speed() { return this.inCar ? Math.abs(this.carSpeed) : Math.hypot(this.vx, this.vz); }
  get vehicleKind() { return this.inCar ? this.inCar.kind : null; }

  // Spike strip hit: tires shredded, top speed collapses and the steering
  // wobbles until the timer runs out. Run-flat tires cut the time down.
  popTires() {
    if (this.tireTimer > 0) return false;
    const cut = 1 - TUNING.tireSpikeCut * this.upgrades.tires;
    this.tireTimer = TUNING.spikeSlowSeconds * cut;
    this.wobbleTime = 0;
    return true;
  }

  collide(pos, colliders, radius) {
    for (const c of colliders) {
      const dx = pos.x - Math.max(c.x - c.hx, Math.min(c.x + c.hx, pos.x));
      const dz = pos.z - Math.max(c.z - c.hz, Math.min(c.z + c.hz, pos.z));
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        const d = Math.sqrt(d2) || 0.001;
        pos.x += (dx / d) * (radius - d);
        pos.z += (dz / d) * (radius - d);
        return true;
      }
    }
    return false;
  }

  update(dt, input, camYaw, colliders, cars, peds, onCrime, onCrash) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (this.tireTimer > 0) this.tireTimer = Math.max(0, this.tireTimer - dt);
    if (this.inCar) {
      this.updateDriving(dt, input, colliders, cars, peds, onCrime, onCrash);
    } else {
      this.updateWalking(dt, input, camYaw, colliders);
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  updateWalking(dt, input, camYaw, colliders) {
    const sprint = input.keys['ShiftLeft'] || input.keys['ShiftRight'];
    const speed = sprint ? TUNING.sprintSpeed : TUNING.walkSpeed;
    let fx = 0, fz = 0;
    if (input.keys['KeyW']) { fx += Math.sin(camYaw); fz += Math.cos(camYaw); }
    if (input.keys['KeyS']) { fx -= Math.sin(camYaw); fz -= Math.cos(camYaw); }
    if (input.keys['KeyA']) { fx += Math.sin(camYaw - Math.PI / 2); fz += Math.cos(camYaw - Math.PI / 2); }
    if (input.keys['KeyD']) { fx += Math.sin(camYaw + Math.PI / 2); fz += Math.cos(camYaw + Math.PI / 2); }
    const len = Math.hypot(fx, fz);
    if (len > 0) {
      fx /= len; fz /= len;
      this.vx = fx * speed; this.vz = fz * speed;
      this.heading = Math.atan2(fx, fz);
    } else {
      this.vx = 0; this.vz = 0;
    }
    const pos = { x: this.x + this.vx * dt, z: this.z + this.vz * dt };
    this.collide(pos, colliders, 0.7);
    this.x = Math.max(-380, Math.min(380, pos.x));
    this.z = Math.max(-380, Math.min(380, pos.z));
  }

  updateDriving(dt, input, colliders, cars, peds, onCrime, onCrash) {
    const car = this.inCar;
    const isBike = car.kind === 'bike';
    const accel = (isBike ? TUNING.bikeAccel : TUNING.carAccel)
      + TUNING.engineAccelBonus * this.upgrades.engine;
    let maxSpeed = (isBike ? TUNING.bikeMaxSpeed : TUNING.carMaxSpeed)
      + TUNING.engineSpeedBonus * this.upgrades.engine;
    const reverseSpeed = isBike ? TUNING.bikeReverseSpeed : TUNING.carReverseSpeed;
    const turnRate = isBike ? TUNING.bikeTurn : TUNING.carTurn;
    // shredded tires: crawl speed and a wobble in the steering
    if (this.tireTimer > 0) {
      maxSpeed = Math.min(maxSpeed, 12);
      this.wobbleTime += dt;
      car.heading += Math.sin(this.wobbleTime * 7) * 0.35 * dt;
    }
    const forward = input.keys['KeyW'] || input.keys['ArrowUp'];
    const back = input.keys['KeyS'] || input.keys['ArrowDown'];
    const left = input.keys['KeyA'] || input.keys['ArrowLeft'];
    const right = input.keys['KeyD'] || input.keys['ArrowRight'];
    const brake = input.keys['Space'];
    if (forward) this.carSpeed += accel * dt;
    else if (back) this.carSpeed -= (this.carSpeed > 0.5 ? accel * 1.4 : accel * 0.8) * dt;
    else this.carSpeed *= Math.pow(0.4, dt);
    if (brake) this.carSpeed *= Math.pow(0.05, dt);
    this.carSpeed = Math.max(-reverseSpeed, Math.min(maxSpeed, this.carSpeed));
    // off-road (beach / grass) is slower — bikes suffer less on sand
    const onRoad = this.isOnRoad(this.x, this.z);
    if (!onRoad) {
      const cap = isBike ? 24 : 16;
      this.carSpeed = Math.max(-8, Math.min(cap, this.carSpeed));
    }
    const steerDir = this.carSpeed >= 0 ? 1 : -1;
    if (left) car.heading += turnRate * steerDir * dt * Math.min(1, Math.abs(this.carSpeed) / 8 + 0.25);
    if (right) car.heading -= turnRate * steerDir * dt * Math.min(1, Math.abs(this.carSpeed) / 8 + 0.25);
    const nx = this.x + Math.sin(car.heading) * this.carSpeed * dt;
    const nz = this.z + Math.cos(car.heading) * this.carSpeed * dt;
    const pos = { x: nx, z: nz };
    if (this.collide(pos, colliders, isBike ? 1.4 : 2.2)) {
      if (Math.abs(this.carSpeed) > 12) { onCrash && onCrash(); }
      this.carSpeed *= -0.25;
    }
    this.x = Math.max(-380, Math.min(380, pos.x));
    this.z = Math.max(-380, Math.min(380, pos.z));
    // bump into other cars
    for (const other of cars) {
      if (other === car) continue;
      const d = Math.hypot(other.x - this.x, other.z - this.z);
      if (d < 4.4 && d > 0.01) {
        const push = (4.4 - d) / 2;
        const ux = (this.x - other.x) / d, uz = (this.z - other.z) / d;
        this.x += ux * push; this.z += uz * push;
        if (!other.isTraffic) { other.x -= ux * push; other.z -= uz * push; syncCarMesh(other); }
        if (Math.abs(this.carSpeed) > 14) { this.carSpeed *= 0.5; onCrash && onCrash(); }
      }
    }
    // running over a pedestrian is a crime (and a tragedy)
    for (const ped of [...peds.peds]) {
      const d = Math.hypot(ped.x - this.x, ped.z - this.z);
      if (d < 2.2 && Math.abs(this.carSpeed) > 3) {
        peds.removePed(ped);
        onCrime && onCrime('pedestrian', 1);
      }
    }
    car.x = this.x; car.z = this.z;
    car.speed = this.carSpeed;
    this.heading = car.heading;
    syncCarMesh(car);
    this.sounds.setEngine(true, Math.abs(this.carSpeed) / maxSpeed, isBike);
  }

  isOnRoad(x, z) {
    // roads run along the grid lines every 80 units, plus the beach strip
    const near = (v) => Math.abs(((v + 40) % 80 + 80) % 80 - 40) <= 11;
    if (z > 330) return false;
    return near(x) || near(z);
  }

  enterCar(car, onCrime) {
    if (this.inCar) return false;
    const stolen = car.isTraffic || car.parked;
    this.inCar = car;
    car.parked = false;
    this.carSpeed = 0;
    this.mesh.visible = false;
    if (stolen) onCrime && onCrime('theft', 1);
    return true;
  }

  exitCar() {
    if (!this.inCar) return;
    const car = this.inCar;
    this.inCar = null;
    this.carSpeed = 0;
    this.x = car.x + Math.sin(car.heading + Math.PI / 2) * 3;
    this.z = car.z + Math.cos(car.heading + Math.PI / 2) * 3;
    this.mesh.visible = true;
    this.sounds.setEngine(false, 0);
  }

  punch(peds, cops, onCrime, onHit) {
    if (this.punchCooldown > 0 || this.inCar) return false;
    this.punchCooldown = 0.45;
    this.sounds.punch();
    const range = 2.4;
    const hx = this.x + Math.sin(this.heading) * 1.4;
    const hz = this.z + Math.cos(this.heading) * 1.4;
    for (const ped of [...peds.peds]) {
      if (Math.hypot(ped.x - hx, ped.z - hz) < range) {
        peds.removePed(ped);
        onCrime && onCrime('assault', 1);
        onHit && onHit();
        return true;
      }
    }
    for (const cop of cops) {
      if (Math.hypot(cop.x - hx, cop.z - hz) < range) {
        cop.health -= 40;
        onCrime && onCrime('assaultCop', 2);
        onHit && onHit();
        return true;
      }
    }
    return false;
  }

  shoot(peds, cops, cars, onCrime, onHit) {
    if (this.shootCooldown > 0 || !this.armed || this.inCar) return false;
    this.shootCooldown = 0.35;
    this.sounds.gunshot();
    onCrime && onCrime('shooting', 1);
    // hitscan: nearest target roughly in front within 40 units and 12 degrees
    const dirX = Math.sin(this.heading), dirZ = Math.cos(this.heading);
    let best = null, bestD = 40, bestKind = null;
    const consider = (x, z, kind, ref) => {
      const dx = x - this.x, dz = z - this.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD || d < 0.5) return;
      const dot = (dx * dirX + dz * dirZ) / d;
      if (dot > 0.975) { bestD = d; best = ref; bestKind = kind; }
    };
    for (const p of peds.peds) consider(p.x, p.z, 'ped', p);
    for (const c of cops) consider(c.x, c.z, 'cop', c);
    for (const c of cars) consider(c.x, c.z, 'car', c);
    if (bestKind === 'ped') { peds.removePed(best); onHit && onHit(); }
    else if (bestKind === 'cop') { best.health -= 50; onCrime && onCrime('shootCop', 1); onHit && onHit(); }
    else if (bestKind === 'car') { onHit && onHit(); }
    return true;
  }

  takeDamage(amount) {
    // armor plating from Tio Ray's garage cuts every hit
    const cut = 1 - TUNING.armorDamageCut * this.upgrades.armor;
    this.health = Math.max(0, this.health - amount * cut);
    this.lastDamageAt = performance.now();
    return this.health <= 0;
  }

  heal(amount) { this.health = Math.min(TUNING.maxHealth, this.health + amount); }
}
