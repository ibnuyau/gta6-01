// Carmen's six jobs: the story chain, objective markers, timers, pickups,
// the street-race checkpoints, and rewards. One mission at a time, steps
// in order, money on completion.
import * as THREE from 'three';
import { MISSIONS } from './config.js';

export class MissionManager {
  constructor(scene, sounds) {
    this.scene = scene;
    this.sounds = sounds;
    this.missionIndex = 0;
    this.stepIndex = 0;
    this.finished = false;
    this.timerLeft = 0;
    this.raceIndex = 0;
    this.raceTimer = 0;
    this.marker = null;
    this.pickupMesh = null;
    this.onMissionComplete = null;
    this.onGameComplete = null;
    this.onToast = null;
    this.onSetWanted = null;
    this.beacon = this.makeBeacon();
    this.beacon.visible = false;
    scene.add(this.beacon);
  }

  makeBeacon() {
    const group = new THREE.Group();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
    );
    pillar.position.y = 30;
    group.add(pillar);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.22, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23d })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4;
    group.add(ring);
    return group;
  }

  currentMission() { return MISSIONS[this.missionIndex] || null; }
  currentStep() {
    const m = this.currentMission();
    return m ? m.steps[this.stepIndex] : null;
  }

  startMission(index) {
    this.missionIndex = index;
    this.stepIndex = 0;
    this.finished = index >= MISSIONS.length;
    this.timerLeft = 0;
    this.raceIndex = 0;
    this.raceTimer = 0;
    this.clearPickup();
    const m = this.currentMission();
    if (m) {
      this.onToast && this.onToast(`MISSION ${m.id}: ${m.title}`, m.intro);
      this.applyStep();
    } else {
      this.beacon.visible = false;
    }
  }

  applyStep() {
    const step = this.currentStep();
    this.clearPickup();
    if (!step) { this.completeMission(); return; }
    if (step.wantedOnStart) this.onSetWanted && this.onSetWanted(step.wantedOnStart);
    if (step.time && step.kind !== 'race') this.timerLeft = step.time;
    if (step.kind === 'pickup') this.spawnPickup(step.x, step.z, step.text.includes('briefcase') ? 0x8a5fd0 : 0x37d67a);
    if (step.kind === 'race') {
      this.raceIndex = 0;
      this.raceTimer = step.time || 120;
      const cp = step.checkpoints[0];
      this.beacon.position.set(cp.x, 0, cp.z);
      this.beacon.visible = true;
      return;
    }
    if (step.x !== undefined) {
      this.beacon.position.set(step.x, 0, step.z);
      this.beacon.visible = true;
    } else {
      this.beacon.visible = false;
    }
  }

  spawnPickup(x, z, color) {
    const group = new THREE.Group();
    const bag = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.8, 0.7),
      new THREE.MeshLambertMaterial({ color })
    );
    bag.position.y = 0.9;
    bag.castShadow = true;
    group.add(bag);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 10, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25 })
    );
    glow.position.y = 0.9;
    group.add(glow);
    group.position.set(x, 0, z);
    this.scene.add(group);
    this.pickupMesh = group;
  }

  clearPickup() {
    if (this.pickupMesh) { this.scene.remove(this.pickupMesh); this.pickupMesh = null; }
  }

  stepDone() {
    this.stepIndex++;
    this.sounds.pickup();
    const m = this.currentMission();
    if (this.stepIndex >= m.steps.length) this.completeMission();
    else this.applyStep();
  }

  completeMission() {
    const m = this.currentMission();
    this.sounds.missionComplete();
    this.clearPickup();
    this.beacon.visible = false;
    this.onMissionComplete && this.onMissionComplete(m);
    this.missionIndex++;
    if (this.missionIndex >= MISSIONS.length) {
      this.finished = true;
      this.onGameComplete && this.onGameComplete();
    } else {
      this.startMission(this.missionIndex);
    }
  }

  // called every frame; returns nothing, fires callbacks on progress
  update(dt, player) {
    if (this.finished || !this.currentMission()) return;
    const step = this.currentStep();
    if (!step) return;
    if (this.beacon.visible) {
      this.beacon.rotation.y += dt;
      const ring = this.beacon.children[1];
      ring.position.y = 0.4 + Math.sin(performance.now() / 300) * 0.25;
    }
    if (this.pickupMesh) this.pickupMesh.rotation.y += dt * 1.5;
    if (step.time && step.kind !== 'race') {
      this.timerLeft -= dt;
      if (this.timerLeft <= 0) {
        this.timerLeft = 0;
        this.onToast && this.onToast('TOO LATE', 'Carmen: "The buyer walked. Get back to the kiosk and take the package again."');
        this.stepIndex = Math.max(0, this.stepIndex - 1);
        this.applyStep();
        return;
      }
    }
    if (step.kind === 'race') {
      this.raceTimer -= dt;
      const cp = step.checkpoints[this.raceIndex];
      if (this.raceTimer <= 0) {
        this.raceTimer = step.time;
        this.raceIndex = 0;
        this.onToast && this.onToast('TOO SLOW', 'Tio Ray: "Clock beat you, Milo. Back to checkpoint one — run it again."');
        this.beacon.position.set(step.checkpoints[0].x, 0, step.checkpoints[0].z);
        return;
      }
      const d = Math.hypot(cp.x - player.x, cp.z - player.z);
      if (d < cp.radius) {
        this.raceIndex++;
        this.sounds.raceBeep();
        if (this.raceIndex >= step.checkpoints.length) {
          this.stepDone();
        } else {
          const next = step.checkpoints[this.raceIndex];
          this.beacon.position.set(next.x, 0, next.z);
        }
      }
      return;
    }
    const px = player.x, pz = player.z;
    if (step.kind === 'stealCar') {
      if (player.inCar) this.stepDone();
      return;
    }
    if (step.kind === 'loseWanted') {
      if (this.policeWanted() === 0) this.stepDone();
      return;
    }
    if (step.x !== undefined) {
      const d = Math.hypot(step.x - px, step.z - pz);
      if (d < step.radius) this.stepDone();
    }
  }

  policeWanted() { return this._wantedFn ? this._wantedFn() : 0; }
  setWantedGetter(fn) { this._wantedFn = fn; }
}
