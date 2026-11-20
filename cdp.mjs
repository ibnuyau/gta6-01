// CDP driver for Palmera Bay: serves game/, drives headless Chrome for Testing,
// collects console errors + network requests, runs interaction tests, and takes
// JPEG screenshots. Usage:
//   node cdp.mjs shot <start|play|mission|wanted> <outfile.jpg>
//   node cdp.mjs test
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const NODE = '/home/hatch/workspace/tools/node22/bin/node';
const CHROME = '/home/hatch/workspace/makefun/chrome/chrome-linux64/chrome';
const REPO = '/home/hatch/workspace/makefun/gta6-01';
const PORT = 8931;
const CDP_PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch { /* retry */ }
    await sleep(300);
  }
  return false;
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)); }
      }, 30000);
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result ? r.result.value : undefined;
  }
}

async function main() {
  const mode = process.argv[2];
  const server = spawn(NODE, [`${REPO}/serve.ts`, '--port', String(PORT)], { stdio: 'ignore' });
  await waitFor(`http://127.0.0.1:${PORT}/index.html`);

  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=1280,800', `--remote-debugging-port=${CDP_PORT}`,
    '--user-data-dir=/tmp/palmera-chrome-profile', 'about:blank',
  ], { stdio: 'ignore' });
  const ok = await waitFor(`http://127.0.0.1:${CDP_PORT}/json/version`);
  if (!ok) { console.log(JSON.stringify({ fatal: 'chrome did not start' })); process.exit(1); }

  const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  const cdp = new Cdp(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Network.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

  const result = { mode, consoleErrors: [], failedRequests: [], externalRequests: [], shots: {} };

  const collect = () => {
    for (const ev of cdp.events) {
      if (ev.method === 'Runtime.exceptionThrown') {
        result.consoleErrors.push(ev.params.exceptionDetails?.exception?.description || ev.params.exceptionDetails?.text || 'exception');
      }
      if (ev.method === 'Runtime.consoleAPICalled' && ev.params.type === 'error') {
        result.consoleErrors.push(ev.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      }
      if (ev.method === 'Network.loadingFailed') {
        result.failedRequests.push(ev.params.errorText);
      }
      if (ev.method === 'Network.requestWillBeSent') {
        const url = ev.params.request.url;
        if (!url.startsWith('http://127.0.0.1') && !url.startsWith('data:') && !url.startsWith('blob:')) {
          result.externalRequests.push(url);
        }
      }
    }
    cdp.events.length = 0;
  };

  async function loadPage(query) {
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html${query}` });
    // wait for __shotReady or timeout
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      collect();
      const ready = await cdp.eval('window.__shotReady === true');
      if (ready) return true;
    }
    return false;
  }

  async function shot(name, out) {
    cdp.events.length = 0;
    const ready = await loadPage(`?shot=${name}`);
    await sleep(2500);
    collect();
    const info = await cdp.eval(`JSON.stringify({state: window.__game?.state, wanted: window.__game?.police?.wanted, mission: window.__game?.missions?.missionIndex, step: window.__game?.missions?.stepIndex, race: window.__game?.missions?.raceIndex, errors: window.__errors, money: window.__game?.player?.money, inCar: !!window.__game?.player?.inCar, vehicle: window.__game?.player?.vehicleKind, roadblocks: window.__game?.police?.roadblocks?.length})`);
    const pic = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
    writeFileSync(out, Buffer.from(pic.data, 'base64'));
    result.shots[name] = { ready, info: JSON.parse(info || '{}') };
  }

  // helper: press and release a key through the real input path
  const key = async (type, code, keyName) => cdp.send('Input.dispatchKeyEvent', { type, code, key: keyName, windowsVirtualTimeTicks: false });
  const tap = async (code, keyName) => { await key('keyDown', code, keyName); await key('keyUp', code, keyName); };

  try {
    if (mode === 'shot') {
      const name = process.argv[3];
      const out = process.argv[4];
      await shot(name, out);
    } else if (mode === 'test') {
      await loadPage('');
      await sleep(1000);
      collect();
      const t = {};
      t.menuState = await cdp.eval('window.__game.state');
      t.version = await cdp.eval('window.__game.version');
      // day/night cycle is running and the traffic lights exist
      t.dayNight = await cdp.eval('JSON.stringify({t0: window.__game.dayTime, lights: window.__game.city.trafficLights.length, phase: window.__game.city.trafficLights[0].phase})');
      await sleep(3000);
      t.dayNightLater = await cdp.eval('JSON.stringify({t1: window.__game.dayTime})');
      // click START ENGINE
      await cdp.eval(`document.getElementById('btnStart').click()`);
      await sleep(1200);
      t.afterStart = await cdp.eval('window.__game.state');
      t.mission0 = await cdp.eval('JSON.stringify({m: window.__game.missions.missionIndex, s: window.__game.missions.stepIndex})');
      // walk forward with W for 5s (software rendering runs ~2fps, so hold it)
      await key('keyDown', 'KeyW', 'w');
      await sleep(5000);
      await key('keyUp', 'KeyW', 'w');
      t.walked = await cdp.eval('JSON.stringify({x: Math.round(window.__game.player.x), z: Math.round(window.__game.player.z)})');
      // steal a parked car: teleport right next to the known spot (-75,132)
      await cdp.eval('window.__game.player.x = -75; window.__game.player.z = 131;');
      await sleep(300);
      await tap('KeyE', 'e');
      await sleep(600);
      t.stoleCar = await cdp.eval('JSON.stringify({inCar: !!window.__game.player.inCar, vehicle: window.__game.player.vehicleKind, wanted: window.__game.police.wanted})');
      await sleep(500);
      t.missionAfterSteal = await cdp.eval('JSON.stringify({m: window.__game.missions.missionIndex, s: window.__game.missions.stepIndex})');
      // drive to the garage marker: mission 1 completes, money lands
      await cdp.eval('window.__game.player.x = -160; window.__game.player.z = -152; window.__game.player.inCar.x = -160; window.__game.player.inCar.z = -152;');
      await sleep(800);
      t.mission1done = await cdp.eval('JSON.stringify({m: window.__game.missions.missionIndex, money: window.__game.player.money})');
      // save/load: check localStorage (save key is v2 now)
      t.saveExists = await cdp.eval('!!localStorage.getItem("palmeraBaySaveV2")');
      // garage shop: give Milo cash, open the shop with G, buy an engine tune
      await cdp.eval('window.__game.player.money = 5000; window.__game.player.x = -160; window.__game.player.z = -150;');
      await sleep(300);
      await tap('KeyG', 'g');
      await sleep(500);
      t.shopOpen = await cdp.eval('window.__game.shopOpen');
      await cdp.eval(`document.getElementById('buy-engine').click()`);
      await sleep(400);
      t.shopBuy = await cdp.eval('JSON.stringify({engine: window.__game.player.upgrades.engine, money: window.__game.player.money})');
      await tap('Escape', 'Escape');
      await sleep(300);
      t.shopClosed = await cdp.eval('window.__game.shopOpen');
      // bike: exit the car, walk to a parked bike and steal it
      await tap('KeyE', 'e');
      await sleep(400);
      await cdp.eval('window.__game.player.x = -70; window.__game.player.z = 139;');
      await sleep(300);
      await tap('KeyE', 'e');
      await sleep(600);
      t.stoleBike = await cdp.eval('JSON.stringify({inCar: !!window.__game.player.inCar, vehicle: window.__game.player.vehicleKind})');
      // roadblocks + spike strips at 3 stars
      await cdp.eval('window.__game.police.setWanted(3)');
      await sleep(2500);
      t.roadblock = await cdp.eval('JSON.stringify({wanted: window.__game.police.wanted, roadblocks: window.__game.police.roadblocks.length, copCars: window.__game.police.copCars.length})');
      // drive onto the spike strip: tires should pop
      await cdp.eval('const rb = window.__game.police.roadblocks[0]; if (rb) { window.__game.player.x = rb.spike.x; window.__game.player.z = rb.spike.z; window.__game.player.inCar.x = rb.spike.x; window.__game.player.inCar.z = rb.spike.z; }');
      await sleep(800);
      t.spike = await cdp.eval('JSON.stringify({tireTimer: Math.round(window.__game.player.tireTimer * 10) / 10})');
      // street race: jump to mission 6, race step, run the checkpoints
      await cdp.eval('window.__game.missions.startMission(5); window.__game.missions.stepIndex = 1; window.__game.missions.applyStep(); window.__game.police.clearWanted();');
      await sleep(500);
      t.raceStart = await cdp.eval('JSON.stringify({m: window.__game.missions.missionIndex, s: window.__game.missions.stepIndex, race: window.__game.missions.raceIndex, timer: Math.round(window.__game.missions.raceTimer)})');
      const cps = await cdp.eval('JSON.stringify(window.__game.missions.currentStep().checkpoints)');
      for (const cp of JSON.parse(cps)) {
        await cdp.eval(`window.__game.player.x = ${cp.x}; window.__game.player.z = ${cp.z};`);
        await sleep(2000);
      }
      await sleep(2500);
      t.raceAfter = await cdp.eval('JSON.stringify({m: window.__game.missions.missionIndex, s: window.__game.missions.stepIndex, race: window.__game.missions.raceIndex})');
      // finish line: the race mission completes and pays out
      await cdp.eval('window.__game.player.x = 240; window.__game.player.z = 300;');
      await sleep(2500);
      t.raceDone = await cdp.eval('JSON.stringify({m: window.__game.missions.missionIndex, money: window.__game.player.money, finished: window.__game.missions.finished})');
      // pause via Escape, then resume
      await tap('Escape', 'Escape');
      await sleep(400);
      t.paused = await cdp.eval('window.__game.state');
      await cdp.eval(`document.getElementById('btnResume').click()`);
      await sleep(400);
      t.resumed = await cdp.eval('window.__game.state');
      // minimap zoom toggle with M
      t.zoomBefore = await cdp.eval('window.__game.player ? 1 : 0');
      await tap('KeyM', 'm');
      await sleep(300);
      // exit vehicle, draw pistol
      await tap('KeyE', 'e');
      await sleep(400);
      await tap('KeyQ', 'q');
      await sleep(300);
      t.armed = await cdp.eval('window.__game.player.armed');
      t.errors = await cdp.eval('window.__errors');
      result.test = t;
    } else if (mode === 'focus') {
      await loadPage('');
      await sleep(1000);
      collect();
      const f = {};
      await cdp.eval(`document.getElementById('btnStart').click()`);
      await sleep(800);
      // teleport exactly onto a known parked car spot (-75,132) and steal it
      await cdp.eval('window.__game.player.x = -75; window.__game.player.z = 131;');
      await sleep(300);
      f.before = await cdp.eval('JSON.stringify({wanted: window.__game.police.wanted})');
      await tap('KeyE', 'e');
      await sleep(600);
      f.afterSteal = await cdp.eval('JSON.stringify({inCar: !!window.__game.player.inCar, wanted: window.__game.police.wanted})');
      // mission 4 loseWanted logic: jump to mission 4, set wanted 3, then clear it
      await cdp.eval('window.__game.missions.startMission(3); window.__game.police.setWanted(3);');
      await sleep(600);
      f.m4start = await cdp.eval('JSON.stringify({m: window.__game.missions.missionIndex, s: window.__game.missions.stepIndex, w: window.__game.police.wanted})');
      await cdp.eval('window.__game.police.clearWanted();');
      await sleep(1200);
      f.m4after = await cdp.eval('JSON.stringify({m: window.__game.missions.missionIndex, s: window.__game.missions.stepIndex, w: window.__game.police.wanted})');
      // mission 2 timer: start mission 2, go to kiosk, check timer counts
      await cdp.eval('window.__game.missions.startMission(1); window.__game.player.x = 200; window.__game.player.z = 315;');
      await sleep(1200);
      f.m2 = await cdp.eval('JSON.stringify({m: window.__game.missions.missionIndex, s: window.__game.missions.stepIndex, t: Math.round(window.__game.missions.timerLeft)})');
      f.errors = await cdp.eval('window.__errors');
      result.test = f;
    }
  } finally {
    collect();
    try { ws.close(); } catch { /* ignore */ }
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => { console.log(JSON.stringify({ fatal: String(e && e.stack || e) })); process.exit(1); });
