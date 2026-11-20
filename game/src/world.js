// Palmera Bay itself: avenues, buildings, beach, marina, park, props and
// working traffic lights. All geometry is procedural boxes, cylinders and
// canvas textures — no imported art, so the city is entirely original.
import * as THREE from 'three';
import { CITY, TRAFFIC_LIGHT_SPOTS, mulberry32 } from './config.js';

function facadeTexture(base, lit) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  const rows = 10, cols = 5;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const on = Math.random() < lit;
      g.fillStyle = on ? '#ffe9a8' : '#1d2b3a';
      g.fillRect(8 + col * 24, 10 + r * 24, 15, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// One intersection's lights: a pole with two heads (north-south and
// east-west), each a red / yellow / green lamp that the update step flips.
function buildTrafficLight(scene, x, z) {
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 6.4, 6), poleMat);
  pole.position.set(x + 8.5, 3.2, z + 8.5);
  scene.add(pole);
  const headMat = new THREE.MeshLambertMaterial({ color: 0x14181d });

  function lampHead(angle) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.6), headMat);
    head.position.set(x + 8.5, 6.2, z + 8.5);
    head.rotation.y = angle;
    scene.add(head);
    const lamps = {};
    const defs = [
      ['red', 0.75, 0xff2a2a],
      ['yellow', 0, 0xffd23d],
      ['green', -0.75, 0x2aff5a],
    ];
    for (const [name, dy, color] of defs) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x2a0d0d });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mat);
      lamp.position.set(x + 8.5, 6.2 + dy, z + 8.5);
      // push the lamp out of the head box toward the traffic it faces
      lamp.position.x += Math.sin(angle) * 0.32;
      lamp.position.z += Math.cos(angle) * 0.32;
      lamp.userData.onColor = color;
      scene.add(lamp);
      lamps[name] = lamp;
    }
    return lamps;
  }

  return {
    x, z, phase: 'ns', timer: 0,
    nsHead: lampHead(0),
    ewHead: lampHead(Math.PI / 2),
  };
}

function setHead(head, lit) {
  for (const name of ['red', 'yellow', 'green']) {
    const lamp = head[name];
    const on = lit === name;
    lamp.material.color.set(on ? lamp.userData.onColor : 0x2a0d0d);
  }
}

export function buildCity(scene) {
  const rand = mulberry32(20261120);
  const colliders = [];
  const roadLines = [];
  for (let v = -320; v <= 320; v += 80) roadLines.push(v);

  // --- ground: grass, then sand, then sea to the south ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 1100),
    new THREE.MeshLambertMaterial({ color: 0x69a85e })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 90),
    new THREE.MeshLambertMaterial({ color: 0xe8d49a })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, 372);
  sand.receiveShadow = true;
  scene.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 320),
    new THREE.MeshLambertMaterial({ color: 0x2e86c1 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.01, 560);
  scene.add(sea);

  // --- roads and sidewalks on the grid ---
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e3238 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 });
  for (const v of roadLines) {
    const walkV = new THREE.Mesh(new THREE.PlaneGeometry(22, 700), walkMat);
    walkV.rotation.x = -Math.PI / 2; walkV.position.set(v, 0.015, 0);
    scene.add(walkV);
    const roadV = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, 700), roadMat);
    roadV.rotation.x = -Math.PI / 2; roadV.position.set(v, 0.03, 0);
    roadV.receiveShadow = true;
    scene.add(roadV);
    const walkH = new THREE.Mesh(new THREE.PlaneGeometry(700, 22), walkMat);
    walkH.rotation.x = -Math.PI / 2; walkH.position.set(0, 0.015, v);
    scene.add(walkH);
    const roadH = new THREE.Mesh(new THREE.PlaneGeometry(700, CITY.roadWidth), roadMat);
    roadH.rotation.x = -Math.PI / 2; roadH.position.set(0, 0.03, v);
    roadH.receiveShadow = true;
    scene.add(roadH);
  }
  // centre dashes along every avenue
  const dashGeo = new THREE.BoxGeometry(0.7, 0.05, 4);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5e9c8 });
  const dashCount = roadLines.length * 2 * 41;
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
  const m4 = new THREE.Matrix4();
  let di = 0;
  for (const v of roadLines) {
    for (let k = -320; k <= 320; k += 16) {
      m4.makeTranslation(v, 0.06, k); dashes.setMatrixAt(di++, m4);
      m4.makeTranslation(k, 0.06, v); dashes.setMatrixAt(di++, m4);
    }
  }
  dashes.count = di;
  scene.add(dashes);

  // --- central park (the block around 0,0): lawn, pond, benches ---
  const park = new THREE.Mesh(
    new THREE.PlaneGeometry(56, 56),
    new THREE.MeshLambertMaterial({ color: 0x4f9e4a })
  );
  park.rotation.x = -Math.PI / 2; park.position.set(0, 0.04, 0);
  scene.add(park);
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(10, 24),
    new THREE.MeshLambertMaterial({ color: 0x3d9bd6 })
  );
  pond.rotation.x = -Math.PI / 2; pond.position.set(6, 0.06, -4);
  scene.add(pond);
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  for (const [bx, bz, rot] of [[-14, 12, 0], [14, -16, Math.PI], [-18, -14, Math.PI / 2], [18, 14, -Math.PI / 2]]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 1.2), benchMat);
    bench.position.set(bx, 0.5, bz);
    bench.rotation.y = rot;
    scene.add(bench);
    colliders.push({ x: bx, z: bz, hx: 2.2, hz: 1 });
  }

  // --- buildings: one to three per block, facades tinted by district ---
  const facades = [
    facadeTexture('#e8b48a', 0.35),
    facadeTexture('#a8c8d8', 0.3),
    facadeTexture('#d8d0c0', 0.3),
    facadeTexture('#e08a7a', 0.35),
    facadeTexture('#f0e0b8', 0.3),
  ];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  let built = 0;
  for (let bx = -4; bx < 4; bx++) {
    for (let bz = -4; bz < 4; bz++) {
      const cx = bx * 80 + 40, cz = bz * 80 + 40;
      if (bx === -1 && bz === -1) continue; // park block
      if (cz > 300) continue; // beach
      const n = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const w = 16 + rand() * 14, d = 16 + rand() * 14;
        const h = 9 + rand() * rand() * 42;
        const ox = (rand() - 0.5) * (58 - w), oz = (rand() - 0.5) * (58 - d);
        const x = cx + ox, z = cz + oz;
        const mat = new THREE.MeshLambertMaterial({ map: facades[Math.floor(rand() * facades.length)] });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(x, h / 2, z);
        b.castShadow = true; b.receiveShadow = true;
        scene.add(b);
        // rooftop unit
        const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x555c66 }));
        roof.scale.set(4, 1.6, 4);
        roof.position.set(x + w * 0.2, h + 0.8, z);
        scene.add(roof);
        colliders.push({ x, z, hx: w / 2 + 0.6, hz: d / 2 + 0.6 });
        built++;
      }
    }
  }

  // --- landmark buildings (named on the HUD) ---
  function landmark(x, z, w, h, d, color) {
    const mat = new THREE.MeshLambertMaterial({ color });
    const b = new THREE.Mesh(boxGeo, mat);
    b.scale.set(w, h, d);
    b.position.set(x, h / 2, z);
    b.castShadow = true;
    scene.add(b);
    colliders.push({ x, z, hx: w / 2 + 0.6, hz: d / 2 + 0.6 });
    return b;
  }
  landmark(-160, -160, 26, 10, 20, 0xc96a2e);   // Carmen's garage
  landmark(120, -40, 20, 8, 16, 0x3e7d5b);     // safehouse
  landmark(-280, 280, 22, 8, 16, 0xe8a33d);     // Beachside Cafe
  landmark(240, 300, 24, 12, 18, 0x5b7fa6);     // marina office
  landmark(200, 320, 14, 6, 12, 0x8a5a3b);      // marina kiosk
  landmark(40, -280, 30, 7, 22, 0x9b7bb8);      // plaza hall
  landmark(280, 40, 26, 7, 20, 0xb8563e);       // market
  // garage awning: Tio Ray's orange canopy over the shop door
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.8, 6),
    new THREE.MeshLambertMaterial({ color: 0xff8c1a })
  );
  awning.position.set(-160, 4.6, -148);
  scene.add(awning);

  // --- marina docks reaching into the sea ---
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  for (let i = 0; i < 4; i++) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 46), dockMat);
    dock.position.set(160 + i * 40, 0.5, 408);
    scene.add(dock);
  }

  // --- beach umbrellas on the sand ---
  const umbrellaPoleGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.6, 5);
  const umbrellaPoleMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
  const umbrellaTopGeo = new THREE.ConeGeometry(2.4, 1.1, 8);
  const umbrellaCols = [0xe85d2a, 0x2e6fd8, 0xf2c230, 0x37b06a];
  for (let i = 0; i < 10; i++) {
    const ux = -300 + i * 66 + (rand() - 0.5) * 20;
    const uz = 352 + (rand() - 0.5) * 16;
    const pole = new THREE.Mesh(umbrellaPoleGeo, umbrellaPoleMat);
    pole.position.set(ux, 1.3, uz);
    scene.add(pole);
    const top = new THREE.Mesh(
      umbrellaTopGeo,
      new THREE.MeshLambertMaterial({ color: umbrellaCols[i % umbrellaCols.length] })
    );
    top.position.set(ux, 2.9, uz);
    top.castShadow = true;
    scene.add(top);
  }

  // --- palm trees along the beach and avenues ---
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const leafGeo = new THREE.ConeGeometry(3.2, 2.2, 6);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f3a });
  const palms = new THREE.InstancedMesh(trunkGeo, trunkMat, 90);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 90);
  let pi = 0;
  const palmSpots = [];
  for (let x = -360; x <= 360; x += 40) palmSpots.push([x, 348]);
  for (let z = -320; z <= 280; z += 80) { palmSpots.push([-340, z]); palmSpots.push([340, z]); }
  for (const [x, z] of palmSpots) {
    if (pi >= 90) break;
    m4.makeTranslation(x + (rand() - 0.5) * 6, 3.5, z + (rand() - 0.5) * 6);
    palms.setMatrixAt(pi, m4);
    m4.makeTranslation(x + (rand() - 0.5) * 6, 7.6, z + (rand() - 0.5) * 6);
    leaves.setMatrixAt(pi, m4);
    pi++;
  }
  palms.count = pi; leaves.count = pi;
  palms.castShadow = true;
  scene.add(palms); scene.add(leaves);

  // --- streetlights ---
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 7, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
  const lampGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, 60);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, 60);
  let li = 0;
  for (const v of roadLines) {
    for (let k = -280; k <= 280; k += 160) {
      if (li >= 60) break;
      m4.makeTranslation(v + 9, 3.5, k); poles.setMatrixAt(li, m4);
      m4.makeTranslation(v + 9, 7.1, k); lamps.setMatrixAt(li, m4);
      li++;
    }
  }
  poles.count = li; lamps.count = li;
  scene.add(poles); scene.add(lamps);

  // --- traffic lights at the five big intersections ---
  const trafficLights = TRAFFIC_LIGHT_SPOTS.map((s, i) => {
    const light = buildTrafficLight(scene, s.x, s.z);
    light.timer = i * 2.5; // stagger the cycle so the city is not in lockstep
    return light;
  });

  // Cycle: 8s green one way, 2s yellow, then the other way. Returns nothing;
  // the lamp colours are the state traffic reads.
  function updateLights(dt) {
    for (const light of trafficLights) {
      light.timer += dt;
      const cycle = light.timer % 20;
      let phase;
      if (cycle < 8) phase = 'ns';
      else if (cycle < 10) phase = 'nsYellow';
      else if (cycle < 18) phase = 'ew';
      else phase = 'ewYellow';
      if (phase !== light.phase) {
        light.phase = phase;
        setHead(light.nsHead, phase === 'ns' ? 'green' : phase === 'nsYellow' ? 'yellow' : 'red');
        setHead(light.ewHead, phase === 'ew' ? 'green' : phase === 'ewYellow' ? 'yellow' : 'red');
      }
    }
  }
  updateLights(0);

  // Green means go for the axis the light names: 'ns' lets traffic travel
  // along z, 'ew' lets traffic travel along x. Yellow and red both stop.
  function lightAllows(x, z, alongX) {
    for (const light of trafficLights) {
      if (Math.abs(light.x - x) < 20 && Math.abs(light.z - z) < 20) {
        return alongX ? light.phase === 'ew' : light.phase === 'ns';
      }
    }
    return true; // no light at this intersection
  }

  return { colliders, roadLines, buildingsBuilt: built, trafficLights, updateLights, lightAllows };
}
