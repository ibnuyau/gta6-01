// Palmera Bay — Streets of the Sun: bootstrap, camera, day/night cycle,
// game loop, garage shop, save/load, busted/wasted, and the ?shot=
// presets used for screenshots.
import * as THREE from 'three';
import { CITY, TUNING, PLAYER_START, MISSIONS, GARAGE, UPGRADES } from './config.js';
import { SoundBank } from './audio.js';
import { buildCity } from './world.js';
import { Traffic, spawnParkedCars, syncCarMesh } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { MissionManager } from './missions.js';
import { Hud } from './hud.js';
import { Input } from './input.js';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
const origConsoleError = console.error.bind(console);
console.error = (...args) => { window.__errors.push(args.map(String).join(' ')); origConsoleError(...args); };

const canvas = document.getElementById('game');
// Screenshot mode (?shot=...) always starts clean: no stale save, no Continue button.
if (new URLSearchParams(location.search).get('shot')) {
  try { localStorage.removeItem(TUNING.saveKey); } catch (e) { /* ignore */ }
}
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87bfe8);
scene.fog = new THREE.Fog(0x9fc8e8, 220, 700);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const sun = new THREE.DirectionalLight(0xfff2d0, 2.4);
sun.position.set(180, 260, 120);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -420; sun.shadow.camera.right = 420;
sun.shadow.camera.top = 420; sun.shadow.camera.bottom = -420;
sun.shadow.camera.far = 800;
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x5a7a4a, 1.1);
scene.add(hemi);
scene.add(new THREE.AmbientLight(0xffffff, 0.35));

// --- world and actors ---
const city = buildCity(scene);
const sounds = new SoundBank();
const input = new Input(canvas);
const traffic = new Traffic(scene, city.roadLines, city.colliders, city.lightAllows);
const parkedCars = spawnParkedCars(scene);
const peds = new Pedestrians(scene, city.roadLines);
const player = new Player(scene, sounds);
const police = new Police(scene, city.roadLines, city.colliders);
const missions = new MissionManager(scene, sounds);
const hud = new Hud();

missions.setWantedGetter(() => police.wanted);
missions.onSetWanted = (stars) => police.setWanted(stars);
missions.onToast = (title, text) => hud.toast(title, text, 6000);
missions.onMissionComplete = (m) => {
  player.money += m.reward;
  hud.toast(`JOB DONE — $${m.reward}`, `Carmen: "Clean work, Milo. $${m.reward} is yours."`, 5000);
  saveGame();
};
missions.onGameComplete = () => {
  saveGame();
  showEndScreen();
};

let state = 'menu'; // menu | playing | paused | over
let shopOpen = false;
let framesRendered = 0;
let lastDragAt = 0;
let saveTimer = 0;
let menuAngle = 0;
let dayTime = 0.32; // fraction of the day cycle: 0.32 = late morning sun

function allCars() {
  return [...traffic.cars, ...parkedCars, ...police.copCars, ...(player.inCar ? [player.inCar] : [])];
}

function onCrime(kind, stars) {
  police.addWanted(stars);
  if (kind === 'theft') hud.toast('VEHICLE STOLEN', 'The owner called it in — the police are looking for that ride.', 3500);
  if (kind === 'pedestrian') hud.toast('HIT AND RUN', 'A pedestrian is down. The police are on their way.', 3500);
  if (kind === 'assault' || kind === 'shooting') hud.toast('ASSAULT', 'Someone saw that. Wanted level rising.', 3000);
  if (kind === 'assaultCop' || kind === 'shootCop') hud.toast('ATTACKED POLICE', 'You just made every cruiser in Palmera Bay your enemy.', 3500);
}

function onCrash() {
  sounds.crash();
  player.takeDamage(4);
  hud.flashDamage();
}

function onBusted() {
  sounds.busted();
  police.clearWanted();
  const fine = Math.min(player.money, Math.max(100, Math.floor(player.money * 0.15)));
  player.money -= fine;
  player.exitCar();
  player.reset(-160, -160, 0);
  player.health = TUNING.maxHealth;
  hud.toast('BUSTED', `The police took you in. Fine: $${fine}. Carmen's garage bailed you out.`, 5000);
  saveGame();
}

function onWasted() {
  sounds.wasted();
  police.clearWanted();
  const lost = Math.min(player.money, 200);
  player.money -= lost;
  player.exitCar();
  player.reset(-280, 280, 0);
  player.health = TUNING.maxHealth;
  hud.toast('WASTED', `You woke up at the Beachside Cafe, $${lost} lighter. Carmen is not impressed.`, 5000);
  saveGame();
}

function saveGame() {
  try {
    localStorage.setItem(TUNING.saveKey, JSON.stringify({
      money: player.money, mission: missions.missionIndex, step: missions.stepIndex,
      x: player.x, z: player.z, heading: player.heading, health: player.health,
      upgrades: player.upgrades,
    }));
  } catch (e) { /* storage unavailable */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(TUNING.saveKey);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function showEndScreen() {
  state = 'over';
  hud.hide();
  document.getElementById('endTitle').textContent = 'KING OF PALMERA BAY';
  document.getElementById('endText').textContent =
    `All six jobs done. Milo paid the debt, won the Grand Prix, kept the money ($${player.money.toLocaleString('en-US')}), ` +
    `and the sun never sets on Palmera Bay. Thanks for playing — free-roam the city as long as you like.`;
  document.getElementById('endScreen').style.display = 'flex';
  state = 'playing'; // keep free-roam running behind the end card
  setTimeout(() => { document.getElementById('endScreen').style.display = 'none'; }, 9000);
}

function startGame(fromSave) {
  sounds.unlock();
  sounds.startMusic();
  const save = fromSave ? loadSave() : null;
  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('pauseScreen').style.display = 'none';
  document.getElementById('endScreen').style.display = 'none';
  hud.show();
  state = 'playing';
  if (save) {
    player.money = save.money || 0;
    if (save.upgrades) player.upgrades = { ...player.upgrades, ...save.upgrades };
    player.reset(save.x ?? PLAYER_START.x, save.z ?? PLAYER_START.z, save.heading ?? PLAYER_START.heading);
    player.health = save.health ?? TUNING.maxHealth;
    missions.startMission(Math.min(save.mission || 0, MISSIONS.length - 1));
    missions.stepIndex = save.step || 0;
    missions.applyStep();
    hud.toast('WELCOME BACK', `Carmen: "Milo. Job ${missions.missionIndex + 1} is still waiting."`, 4000);
  } else {
    player.money = 0;
    player.reset(PLAYER_START.x, PLAYER_START.z, PLAYER_START.heading);
    missions.startMission(0);
  }
  input.camYaw = player.heading;
  saveGame();
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  closeShop();
  saveGame();
  sounds.setEngine(false, 0);
  sounds.setSiren(false);
  document.getElementById('pauseScreen').style.display = 'flex';
}

function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  document.getElementById('pauseScreen').style.display = 'none';
}

// --- Tio Ray's garage shop (press G near the garage) ---
function nearGarage() {
  return Math.hypot(player.x - GARAGE.x, player.z - GARAGE.z) < GARAGE.radius;
}

function refreshShop() {
  document.getElementById('shopMoney').textContent = `$${player.money.toLocaleString('en-US')}`;
  for (const up of UPGRADES) {
    const level = player.upgrades[up.id];
    const maxed = level >= up.max;
    const cost = maxed ? 0 : up.costs[level];
    const btn = document.getElementById(`buy-${up.id}`);
    btn.textContent = maxed ? 'MAXED OUT' : `BUY — $${cost}`;
    btn.disabled = maxed || player.money < cost;
    document.getElementById(`level-${up.id}`).textContent = `LEVEL ${level}/${up.max}`;
  }
}

function openShop() {
  if (shopOpen || state !== 'playing') return;
  shopOpen = true;
  refreshShop();
  document.getElementById('shopScreen').style.display = 'flex';
  sounds.click();
}

function closeShop() {
  if (!shopOpen) return;
  shopOpen = false;
  document.getElementById('shopScreen').style.display = 'none';
}

function buyUpgrade(id) {
  const up = UPGRADES.find((u) => u.id === id);
  if (!up) return;
  const level = player.upgrades[id];
  if (level >= up.max) return;
  const cost = up.costs[level];
  if (player.money < cost) {
    hud.toast('NOT ENOUGH CASH', `Tio Ray: "${up.name} costs $${cost}. Go run a job first."`, 3500);
    return;
  }
  player.money -= cost;
  player.upgrades[id] = level + 1;
  sounds.buy();
  hud.toast(`${up.name} — LEVEL ${level + 1}`, `Tio Ray: "She'll feel it now, Milo. $${cost} well spent."`, 4000);
  refreshShop();
  saveGame();
}

// --- one-shot keys ---
input.onKey = (code) => {
  if (code === 'Escape' || code === 'KeyP') {
    if (shopOpen) { closeShop(); return; }
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
    return;
  }
  if (state !== 'playing') return;
  if (code === 'KeyM') {
    hud.cycleZoom();
    sounds.click();
    return;
  }
  if (code === 'KeyG') {
    if (shopOpen) { closeShop(); return; }
    if (nearGarage()) openShop();
    else hud.toast('NO GARAGE NEARBY', 'Tio Ray\'s garage is at Carmen\'s — the orange awning on the west side.', 3500);
    return;
  }
  if (shopOpen) return; // the shop has the player's attention now
  if (code === 'KeyE') {
    if (player.inCar) { player.exitCar(); sounds.click(); return; }
    const near = nearestEnterableCar();
    if (near) {
      if (near.isTraffic) {
        traffic.cars.splice(traffic.cars.indexOf(near), 1);
        near.isTraffic = false;
      }
      player.enterCar(near, onCrime);
      sounds.horn();
      if (near.kind === 'bike') hud.toast('BIKE JACKED', 'Fast, twitchy, and loud. Mind the spike strips.', 3000);
    }
  }
  if (code === 'KeyQ' && !player.inCar) {
    player.armed = !player.armed;
    hud.toast(player.armed ? 'PISTOL DRAWN' : 'PISTOL HOLSTERED', player.armed ? 'Left click to shoot. The police notice gunfire.' : '', 2200);
    sounds.click();
  }
  if (code === 'KeyF') player.punch(peds, police.footCops, onCrime);
  if (code === 'KeyH') sounds.horn();
};

input.onClick = () => {
  if (state !== 'playing' || shopOpen) return;
  player.shoot(peds, police.footCops, allCars(), onCrime);
};

function nearestEnterableCar() {
  let best = null, bd = 4.5;
  for (const c of [...traffic.cars, ...parkedCars]) {
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// --- buttons ---
document.getElementById('btnStart').addEventListener('click', () => startGame(false));
document.getElementById('btnContinue').addEventListener('click', () => startGame(true));
document.getElementById('btnResume').addEventListener('click', resumeGame);
document.getElementById('btnRestart').addEventListener('click', () => {
  try { localStorage.removeItem(TUNING.saveKey); } catch (e) {}
  location.reload();
});
document.getElementById('btnAgain').addEventListener('click', () => {
  document.getElementById('endScreen').style.display = 'none';
});
document.getElementById('btnCloseShop').addEventListener('click', closeShop);
for (const up of UPGRADES) {
  document.getElementById(`buy-${up.id}`).addEventListener('click', () => buyUpgrade(up.id));
}
if (loadSave()) document.getElementById('btnContinue').style.display = 'inline-block';

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- day/night cycle: the sun swings from morning to night and back ---
const daySky = new THREE.Color(0x87bfe8);
const sunsetSky = new THREE.Color(0xe8906a);
const nightSky = new THREE.Color(0x0d1b2e);
function updateDayNight(dt) {
  dayTime = (dayTime + dt / TUNING.dayCycleSeconds) % 1;
  // brightness peaks at midday (0.5), bottoms at midnight (0 / 1)
  const daylight = Math.max(0, Math.sin(dayTime * Math.PI * 2 - Math.PI * 0.35));
  const dusk = Math.max(0, 1 - Math.abs(daylight - 0.45) / 0.45);
  const sky = daySky.clone().lerp(nightSky, 1 - daylight);
  if (dusk > 0.4 && daylight < 0.7) sky.lerp(sunsetSky, dusk * 0.55);
  scene.background.copy(sky);
  scene.fog.color.copy(sky);
  sun.intensity = 0.25 + daylight * 2.2;
  sun.color.setHex(daylight < 0.35 ? 0xff9a5a : 0xfff2d0);
  sun.position.set(Math.cos(dayTime * Math.PI * 2) * 260, 120 + daylight * 180, 120);
  hemi.intensity = 0.35 + daylight * 0.8;
}

// --- ?shot= presets for screenshots ---
const shot = new URLSearchParams(location.search).get('shot');
function applyShotPreset(name) {
  if (name === 'start') return; // menu camera, start screen visible
  startGame(false);
  if (name === 'play') {
    // Milo driving a stolen car down Coral Avenue
    const car = parkedCars[0];
    car.mesh.children[0].material.color.set(0xd23b3b);
    player.x = car.x; player.z = car.z;
    player.enterCar(car, null);
    player.carSpeed = 24;
    car.heading = 0; // drive along the -80 avenue, not across blocks
    player.heading = car.heading;
    input.camYaw = car.heading;
  } else if (name === 'mission') {
    // the Sunset Grand Prix: Milo on a bike at checkpoint one, clock running
    missions.startMission(5);
    missions.stepIndex = 1;
    missions.applyStep();
    const bike = parkedCars.find((c) => c.kind === 'bike');
    player.x = bike.x; player.z = bike.z;
    player.enterCar(bike, null);
    player.carSpeed = 20;
    bike.heading = Math.PI; // race north toward the first checkpoint
    player.heading = bike.heading;
    input.camYaw = bike.heading;
  } else if (name === 'wanted') {
    police.setWanted(3);
    const car = parkedCars[0];
    car.mesh.children[0].material.color.set(0xd23b3b);
    player.x = car.x; player.z = car.z;
    player.enterCar(car, null);
    player.carSpeed = 26;
    car.heading = 0; // drive along the -80 avenue
    player.heading = car.heading;
    input.camYaw = car.heading;
    police.spawnCopCarNear(player.x - 30, player.z - 20);
    police.spawnCopCarNear(player.x + 25, player.z - 35);
    police.spawnCopCarNear(player.x - 10, player.z + 40);
    // a roadblock ahead, spike strip and all, for the shot
    police.spawnRoadblock(player);
    // pull one cruiser into the frame for the shot (ahead, on the avenue)
    const close = police.copCars[0];
    if (close) { close.x = player.x + 16; close.z = player.z + 48; }
  }
}

// --- main loop ---
const clock = new THREE.Clock();
let frameEma = 0.016;
let shadowsOff = false;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  framesRendered++;
  // On very slow machines (software rendering), drop shadows to stay playable.
  frameEma = frameEma * 0.95 + dt * 0.05;
  if (!shadowsOff && framesRendered > 120 && frameEma > 0.045) {
    shadowsOff = true;
    renderer.shadowMap.enabled = false;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  updateDayNight(dt);
  city.updateLights(dt);

  if (state === 'playing' && !shopOpen) {
    const danger = player.inCar && Math.abs(player.carSpeed) > 5
      ? { x: player.x, z: player.z, radius: 9 }
      : (player.armed ? { x: player.x, z: player.z, radius: 7 } : null);
    player.update(dt, input, input.camYaw, city.colliders, allCars(), peds, onCrime, onCrash);
    traffic.update(dt, { x: player.x, z: player.z }, allCars());
    peds.update(dt, danger, police.copCars);
    police.update(dt, player, allCars(), onBusted, () => { hud.flashDamage(); });
    missions.update(dt, player);
    // spike strips: drive over one and the tires are gone
    if (player.inCar && player.tireTimer <= 0) {
      for (const rb of police.roadblocks) {
        if (Math.hypot(rb.spike.x - player.x, rb.spike.z - player.z) < 3.5) {
          player.popTires();
          sounds.spike();
          hud.toast('SPIKE STRIP!', 'Tires shredded — crawl it off or steer around next time.', 4000);
          break;
        }
      }
    }
    sounds.setSiren(police.wanted > 0);
    // slow health regen when calm
    if (police.wanted === 0 && performance.now() - player.lastDamageAt > 10000) {
      player.heal(3 * dt);
    }
    if (player.health <= 0) onWasted();
    saveTimer += dt;
    if (saveTimer > 20) { saveTimer = 0; saveGame(); }
    hud.update({ player, police, missions, traffic, city });
  } else if (state === 'menu') {
    // slow cinematic orbit over the city behind the start screen
    menuAngle += dt * 0.03;
    camera.position.set(Math.sin(menuAngle) * 260, 130, Math.cos(menuAngle) * 260);
    camera.lookAt(0, 0, 60);
    traffic.update(dt, null, allCars());
    peds.update(dt, null, []);
  }

  // chase camera
  if (state === 'playing' || state === 'paused') {
    if (player.inCar && performance.now() - lastDragAt > 2500) {
      let diff = player.heading - input.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      input.camYaw += diff * Math.min(1, dt * 1.2);
    }
    const dist = player.inCar ? 12 : 9;
    const height = player.inCar ? 4.6 : 4.2;
    const cx = player.x - Math.sin(input.camYaw) * dist * Math.cos(input.camPitch);
    const cz = player.z - Math.cos(input.camYaw) * dist * Math.cos(input.camPitch);
    const cy = height + Math.sin(input.camPitch) * dist * 0.9;
    camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 6));
    camera.lookAt(player.x, 2.2, player.z);
  }

  renderer.render(scene, camera);
  if (framesRendered === 40) window.__shotReady = true;
}

// track mouse drags so the driving camera knows when to re-align
window.addEventListener('mousemove', () => { if (input.dragging) lastDragAt = performance.now(); });

if (shot) {
  try { applyShotPreset(shot); } catch (e) { window.__errors.push('shot preset: ' + e.message); }
}

window.__game = {
  get state() { return state; },
  get shopOpen() { return shopOpen; },
  get dayTime() { return dayTime; },
  player, police, missions, traffic, peds, city,
  startGame, openShop, closeShop, buyUpgrade, nearGarage,
  version: 'palmera-bay-2.0',
};

animate();
