// HUD and minimap: money, health, wanted stars, mission objective,
// speed and vehicle, toasts, and the top-down map of Palmera Bay —
// now zoomable (M), with garage, roadblock, traffic-light and bike marks.
import { CITY, GARAGE } from './config.js';

export class Hud {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      money: document.getElementById('moneyBox'),
      healthBar: document.getElementById('healthBar'),
      wanted: document.getElementById('wantedBox'),
      objTitle: document.getElementById('objectiveTitle'),
      objText: document.getElementById('objectiveText'),
      objDist: document.getElementById('objectiveDist'),
      minimap: document.getElementById('minimap'),
      speed: document.getElementById('speedBox'),
      speedUnit: document.getElementById('speedUnit'),
      hint: document.getElementById('hintBox'),
      toast: document.getElementById('toast'),
      crosshair: document.getElementById('crosshair'),
      damage: document.getElementById('damageFlash'),
      status: document.getElementById('status'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.toastTimer = null;
    this.lastWanted = -1;
    this.mapZoom = 1; // 1 = whole city, 2 = close-up around Milo (M toggles)
  }

  show() { this.el.hud.classList.add('on'); }
  hide() { this.el.hud.classList.remove('on'); }

  cycleZoom() {
    this.mapZoom = this.mapZoom === 1 ? 2 : 1;
    return this.mapZoom;
  }

  toast(title, text, ms) {
    this.el.toast.innerHTML = `${title}<br><span style="font-size:15px;color:#fff;font-weight:normal">${text || ''}</span>`;
    this.el.toast.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.el.toast.style.opacity = '0'; }, ms || 4200);
  }

  flashDamage() {
    this.el.damage.style.opacity = '1';
    setTimeout(() => { this.el.damage.style.opacity = '0'; }, 180);
  }

  update(game) {
    const p = game.player;
    this.el.money.firstChild.textContent = `$${p.money.toLocaleString('en-US')}`;
    this.el.healthBar.style.width = `${Math.max(0, p.health)}%`;
    if (game.police.wanted !== this.lastWanted) {
      this.lastWanted = game.police.wanted;
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < game.police.wanted ? '★' : '<span class="dim">★</span>';
      this.el.wanted.innerHTML = stars;
    }
    const m = game.missions.currentMission();
    const step = game.missions.currentStep();
    if (m && step) {
      this.el.objTitle.textContent = `MISSION ${m.id} · ${m.title}`;
      this.el.objText.textContent = step.text;
      let dist = '';
      if (step.kind === 'race') {
        const cp = step.checkpoints[game.missions.raceIndex];
        const d = cp ? Math.round(Math.hypot(cp.x - p.x, cp.z - p.z)) : 0;
        dist = `CHECKPOINT ${Math.min(game.missions.raceIndex + 1, step.checkpoints.length)}/${step.checkpoints.length} · ${d}m · TIME LEFT: ${Math.ceil(game.missions.raceTimer)}s`;
      } else {
        if (step.x !== undefined) {
          const d = Math.round(Math.hypot(step.x - p.x, step.z - p.z));
          dist = `${d}m ${d > 60 ? '— follow the yellow beacon' : ''}`;
        }
        if (step.time) dist = `TIME LEFT: ${Math.ceil(game.missions.timerLeft)}s ${dist}`;
        if (step.kind === 'loseWanted') dist = `WANTED: ${game.police.wanted}★ — stay hidden`;
      }
      this.el.objDist.textContent = dist;
    } else if (game.missions.finished) {
      this.el.objTitle.textContent = 'PALMERA BAY · COMPLETE';
      this.el.objText.textContent = 'All six jobs done. The city is yours, Milo.';
      this.el.objDist.textContent = '';
    }
    if (p.inCar) {
      this.el.speed.style.display = 'block';
      this.el.speed.firstChild.textContent = `${Math.round(Math.abs(p.carSpeed) * 3.2)}`;
      const kind = p.inCar.kind === 'bike' ? 'BIKE' : 'CAR';
      const eng = p.upgrades.engine > 0 ? ` · ENG ${p.upgrades.engine}` : '';
      const tires = p.tireTimer > 0 ? ' · TIRES SHREDDED!' : '';
      this.el.speedUnit.textContent = `KM/H · ${kind}${eng}${tires}`;
    } else {
      this.el.speed.style.display = 'none';
    }
    this.el.crosshair.style.display = p.armed && !p.inCar ? 'block' : 'none';
    const nearGarage = Math.hypot(p.x - GARAGE.x, p.z - GARAGE.z) < GARAGE.radius;
    this.el.hint.textContent = p.inCar
      ? 'W/S drive · A/D steer · Space handbrake · E exit · M map zoom · Esc pause'
      : nearGarage
        ? 'WASD move · E enter car · G open Tio Ray\'s garage · Q pistol · F punch · Esc pause'
        : 'WASD move · E enter car · Q pistol · Click shoot · F punch · Shift run · Esc pause';
    this.drawMinimap(game);
  }

  drawMinimap(game) {
    const ctx = this.mapCtx;
    const S = 190, half = CITY.half;
    const zoom = this.mapZoom;
    const px = game.player.x, pz = game.player.z;
    // zoom 1: whole city; zoom 2: 400-unit window centred on Milo
    const viewHalf = zoom === 1 ? half : 200;
    const cx = zoom === 1 ? 0 : px;
    const cz = zoom === 1 ? 0 : pz;
    const toMap = (x, z) => [((x - cx + viewHalf) / (viewHalf * 2)) * S, ((z - cz + viewHalf) / (viewHalf * 2)) * S];
    ctx.fillStyle = '#0d2733';
    ctx.fillRect(0, 0, S, S);
    // sea and sand
    ctx.fillStyle = '#2e86c1';
    const [, seaY] = toMap(0, 385);
    ctx.fillRect(0, seaY, S, S - seaY);
    ctx.fillStyle = '#e8d49a';
    const [, sandY] = toMap(0, 330);
    ctx.fillRect(0, sandY, S, seaY - sandY);
    // land
    ctx.fillStyle = '#3d6b34';
    ctx.fillRect(0, 0, S, sandY);
    // roads
    ctx.strokeStyle = '#565d66';
    ctx.lineWidth = 3;
    for (let v = -320; v <= 320; v += 80) {
      const [x1] = toMap(v, 0); const [, z1] = toMap(0, v);
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, z1); ctx.lineTo(S, z1); ctx.stroke();
    }
    // park
    ctx.fillStyle = '#4f9e4a';
    const [parkX, parkY] = toMap(-28, -28);
    ctx.fillRect(parkX, parkY, 56 / (viewHalf * 2) * S, 56 / (viewHalf * 2) * S);
    // garage marker: green square with a G
    const [gx, gy] = toMap(GARAGE.x, GARAGE.z);
    ctx.fillStyle = '#37d67a';
    ctx.fillRect(gx - 4, gy - 4, 8, 8);
    ctx.fillStyle = '#08202e';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('G', gx, gy + 0.5);
    // traffic lights: green or red dots at the five intersections
    for (const light of game.city.trafficLights) {
      const [lx, ly] = toMap(light.x, light.z);
      ctx.fillStyle = light.phase === 'ns' || light.phase === 'ew' ? '#2aff5a' : '#ff2a2a';
      ctx.beginPath(); ctx.arc(lx, ly, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // mission marker (race checkpoint is orange, the rest yellow)
    const step = game.missions.currentStep();
    let marker = null;
    if (step && step.kind === 'race') {
      marker = step.checkpoints[game.missions.raceIndex];
    } else if (step && step.x !== undefined) {
      marker = step;
    }
    if (marker) {
      const [mx, my] = toMap(marker.x, marker.z);
      ctx.fillStyle = step.kind === 'race' ? '#ff8c1a' : '#ffd23d';
      ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.stroke();
    }
    // roadblocks: red X marks
    ctx.strokeStyle = '#ff2a2a';
    ctx.lineWidth = 2;
    for (const rb of game.police.roadblocks) {
      const [rx, ry] = toMap(rb.x, rb.z);
      ctx.beginPath();
      ctx.moveTo(rx - 4, ry - 4); ctx.lineTo(rx + 4, ry + 4);
      ctx.moveTo(rx + 4, ry - 4); ctx.lineTo(rx - 4, ry + 4);
      ctx.stroke();
    }
    // traffic: white dots for cars, cyan for bikes; police blue/red
    for (const c of game.traffic.cars) {
      const [cx2, cy2] = toMap(c.x, c.z);
      ctx.fillStyle = c.kind === 'bike' ? '#3ec6c6' : '#ffffff';
      ctx.fillRect(cx2 - 1, cy2 - 1, 2, 2);
    }
    for (const c of game.police.copCars) {
      const [cx2, cy2] = toMap(c.x, c.z);
      ctx.fillStyle = '#4a90ff';
      ctx.beginPath(); ctx.arc(cx2, cy2, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow
    const [ux, uy] = toMap(game.player.x, game.player.z);
    ctx.save();
    ctx.translate(ux, uy);
    ctx.rotate(-game.player.heading);
    ctx.fillStyle = '#ff5a2a';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    // north arrow
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('N ↑', 6, 5);
    if (zoom === 2) {
      ctx.fillStyle = '#9fe8ff';
      ctx.font = '9px sans-serif';
      ctx.fillText('ZOOM ×2', 6, S - 13);
    }
  }
}
