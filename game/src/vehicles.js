// Cars and bikes of Palmera Bay: building them, parking them, and the
// traffic that drives the avenues — now stopping at red lights. Player
// driving physics lives in player.js.
import * as THREE from 'three';
import { CAR_COLORS, BIKE_COLORS, mulberry32 } from './config.js';

export function makeCarMesh(color, isCop) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isCop ? 0x1c2733 : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 4.4), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.6, 2.1),
    new THREE.MeshLambertMaterial({ color: isCop ? 0xe8e8e8 : 0x222831 })
  );
  cabin.position.set(0, 1.25, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  if (isCop) {
    const barRed = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a })
    );
    barRed.position.set(0, 1.65, -0.2);
    group.add(barRed);
    const barBlue = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2a6bff })
    );
    barBlue.position.set(0, 1.65, 0.35);
    group.add(barBlue);
    group.userData.barRed = barRed;
    group.userData.barBlue = barBlue;
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  group.userData.wheels = [];
  for (const [wx, wz] of [[-1.0, 1.4], [1.0, 1.4], [-1.0, -1.4], [1.0, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    group.add(w);
    group.userData.wheels.push(w);
  }
  return group;
}

// A street bike: two wheels, a low tank, a seat and a handlebar. Faster
// than a car, twitchier in the turns, and easier to steal — and to lose.
export function makeBikeMesh(color) {
  const group = new THREE.Group();
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.16, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  group.userData.wheels = [];
  for (const wz of [0.95, -0.95]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(0, 0.36, wz);
    group.add(w);
    group.userData.wheels.push(w);
  }
  const tank = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.4, 1.1),
    new THREE.MeshLambertMaterial({ color })
  );
  tank.position.set(0, 0.72, 0.25);
  tank.castShadow = true;
  group.add(tank);
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.18, 0.8),
    new THREE.MeshLambertMaterial({ color: 0x1c1c1c })
  );
  seat.position.set(0, 0.78, -0.55);
  group.add(seat);
  const bars = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.09, 0.09),
    new THREE.MeshLambertMaterial({ color: 0x888888 })
  );
  bars.position.set(0, 1.05, 0.85);
  group.add(bars);
  const headlight = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 })
  );
  headlight.position.set(0, 0.7, 1.05);
  group.add(headlight);
  return group;
}

export function makeCarRecord(mesh, x, z, heading, kind = 'car') {
  return {
    mesh, x, z, heading, speed: 0, steer: 0, kind,
    radius: kind === 'bike' ? 1.4 : 2.4, driver: null, parked: false,
    isCop: false, isTraffic: false, targetNode: null, stuck: 0,
  };
}

export function syncCarMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * 0.12;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  // cop light bars flash red/blue while the cruiser is on duty
  const { barRed, barBlue } = car.mesh.userData;
  if (barRed && barBlue) {
    const phase = Math.floor(performance.now() / 260) % 2 === 0;
    barRed.material.color.set(phase ? 0xff2a2a : 0x551111);
    barBlue.material.color.set(phase ? 0x112255 : 0x2a6bff);
  }
}

// --- traffic: cars and a couple of bikes that loop the avenue grid ---
export class Traffic {
  constructor(scene, roadLines, colliders, lightAllows) {
    this.scene = scene;
    this.roadLines = roadLines;
    this.cars = [];
    this.lightAllows = lightAllows || null;
    this.rand = mulberry32(777);
    for (let i = 0; i < 12; i++) this.spawnCar(true);
    for (let i = 0; i < 2; i++) this.spawnBike(true);
  }

  randomRoadPoint() {
    const lines = this.roadLines;
    const vertical = this.rand() < 0.5;
    const line = lines[Math.floor(this.rand() * lines.length)];
    const along = -320 + this.rand() * 640;
    return vertical ? { x: line, z: along } : { x: along, z: line };
  }

  spawnCar(anywhere) {
    const p = this.randomRoadPoint();
    const color = CAR_COLORS[Math.floor(this.rand() * CAR_COLORS.length)];
    const mesh = makeCarMesh(color, false);
    const car = makeCarRecord(mesh, p.x, p.z, this.rand() * Math.PI * 2, 'car');
    car.isTraffic = true;
    car.speed = 7 + this.rand() * 4;
    car.targetNode = this.pickNextNode(car);
    this.scene.add(mesh);
    this.cars.push(car);
    return car;
  }

  spawnBike(anywhere) {
    const p = this.randomRoadPoint();
    const color = BIKE_COLORS[Math.floor(this.rand() * BIKE_COLORS.length)];
    const mesh = makeBikeMesh(color);
    const bike = makeCarRecord(mesh, p.x, p.z, this.rand() * Math.PI * 2, 'bike');
    bike.isTraffic = true;
    bike.speed = 10 + this.rand() * 4;
    bike.targetNode = this.pickNextNode(bike);
    this.scene.add(mesh);
    this.cars.push(bike);
    return bike;
  }

  pickNextNode(car) {
    // snap to nearest avenue, then pick a neighbouring intersection — so
    // traffic visibly turns at crossings instead of driving in straight lines
    const lines = this.roadLines;
    let best = lines[0], bd = 1e9;
    for (const l of lines) { const d = Math.abs(l - car.x); if (d < bd) { bd = d; best = l; } }
    const vertical = bd < 12;
    const line = vertical ? best : lines[Math.floor(this.rand() * lines.length)];
    const step = (Math.floor(this.rand() * 3) - 1) * 80;
    if (vertical) {
      const nz = Math.max(-320, Math.min(320, Math.round(car.z / 80) * 80 + step));
      return { x: line, z: nz };
    }
    const nx = Math.max(-320, Math.min(320, Math.round(car.x / 80) * 80 + step));
    return { x: nx, z: line };
  }

  // Is this vehicle about to run a red light? Checks the next intersection
  // on its current avenue: if a light there is red (or yellow) for its
  // direction of travel, it must stop at the line.
  redLightAhead(car) {
    if (!this.lightAllows) return false;
    const alongX = Math.abs(Math.sin(car.heading)) > Math.abs(Math.cos(car.heading));
    const dir = alongX ? Math.sign(Math.sin(car.heading)) : Math.sign(Math.cos(car.heading));
    for (const line of this.roadLines) {
      const ahead = alongX ? (line - car.x) * dir : (line - car.z) * dir;
      if (ahead > 4 && ahead < 18) {
        const ix = alongX ? line : car.x;
        const iz = alongX ? car.z : line;
        if (!this.lightAllows(ix, iz, alongX)) return true;
      }
    }
    return false;
  }

  update(dt, playerPos, allCars) {
    for (const car of this.cars) {
      if (!car.targetNode) car.targetNode = this.pickNextNode(car);
      const dx = car.targetNode.x - car.x, dz = car.targetNode.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) { car.targetNode = this.pickNextNode(car); continue; }
      const want = Math.atan2(dx, dz);
      let diff = want - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnRate = car.kind === 'bike' ? 2.4 : 1.6;
      car.heading += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
      // slow down for the player, a car ahead, or a red light
      let targetSpeed = car.speed;
      if (this.redLightAhead(car)) targetSpeed = 0;
      if (playerPos) {
        const pd = Math.hypot(playerPos.x - car.x, playerPos.z - car.z);
        if (pd < 9) targetSpeed = Math.min(targetSpeed, 2.5);
      }
      for (const other of allCars) {
        if (other === car || other.isTraffic) continue;
        const od = Math.hypot(other.x - car.x, other.z - car.z);
        if (od < 8) targetSpeed = Math.min(targetSpeed, 2);
      }
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.x = Math.max(-330, Math.min(330, car.x));
      car.z = Math.max(-330, Math.min(330, car.z));
      syncCarMesh(car);
    }
  }

  nearestCar(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const c of this.cars) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
}

// Parked cars and bikes the player can steal, placed along avenues.
export function spawnParkedCars(scene) {
  const rand = mulberry32(4242);
  const cars = [];
  const spots = [
    // [x, z, headingAlongRoad] — parked at the edge of an avenue (road lines are multiples of 80)
    [-75, 132, 0], [5, 120, 0], [-155, 40, 0], [85, -120, 1], [165, 120, 0],
    [-235, -120, 1], [5, 240, 0], [-75, -240, 1], [165, -40, 0], [-155, 200, 1],
    [245, -120, 0], [5, -80, 1], [85, 200, 0], [-155, 80, 1], [325, 40, 0],
    [5, -200, 1], [245, -200, 0], [-315, -200, 1],
  ];
  for (const [x, z, dir] of spots) {
    const color = CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)];
    const mesh = makeCarMesh(color, false);
    const car = makeCarRecord(mesh, x, z, dir ? 0 : Math.PI / 2, 'car');
    car.parked = true;
    scene.add(mesh);
    syncCarMesh(car);
    cars.push(car);
  }
  // three parked bikes near the beach avenue — the fast way around town
  const bikeSpots = [[-70, 140, 0], [10, 130, 1], [170, 130, 0]];
  for (const [x, z, dir] of bikeSpots) {
    const color = BIKE_COLORS[Math.floor(rand() * BIKE_COLORS.length)];
    const mesh = makeBikeMesh(color);
    const bike = makeCarRecord(mesh, x, z, dir ? 0 : Math.PI / 2, 'bike');
    bike.parked = true;
    scene.add(mesh);
    syncCarMesh(bike);
    cars.push(bike);
  }
  return cars;
}
