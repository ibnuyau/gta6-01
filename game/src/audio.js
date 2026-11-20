// Synthesized sound for Palmera Bay: engine hum (cars and bikes), sirens,
// gunshots, pickups, race beeps, spike strips, the garage cash register,
// mission jingles and a laid-back bass loop. Everything is WebAudio, no files.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenTimer = null;
    this.sirenOn = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.engineIsBike = false;
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { /* audio is best-effort */ }
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  _noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    } catch (e) { /* ignore */ }
  }

  click() { this._tone(660, 0.07, 'square', 0.08); }
  pickup() { this._tone(880, 0.09, 'sine', 0.22); setTimeout(() => this._tone(1318, 0.14, 'sine', 0.22), 80); }
  cash() { this._tone(1046, 0.08, 'triangle', 0.25); setTimeout(() => this._tone(1568, 0.16, 'triangle', 0.25), 70); }
  punch() { this._noise(0.12, 0.35, 500); this._tone(120, 0.1, 'sine', 0.3, 60); }
  gunshot() { this._noise(0.16, 0.5, 2600); this._tone(180, 0.1, 'square', 0.2, 50); }
  crash() { this._noise(0.3, 0.4, 700); this._tone(90, 0.25, 'sine', 0.3, 40); }
  horn() { this._tone(370, 0.25, 'square', 0.12); this._tone(466, 0.25, 'square', 0.1); }
  // one checkpoint down in the street race: a quick two-note chirp
  raceBeep() { this._tone(1174, 0.09, 'square', 0.16); setTimeout(() => this._tone(1568, 0.12, 'square', 0.16), 90); }
  // spike strip under the tires: a metallic rip and a low thud
  spike() { this._noise(0.25, 0.5, 3200); this._tone(70, 0.3, 'sine', 0.35, 35); }
  // buying an upgrade at the garage: cash-register cha-ching
  buy() { [1318, 1760, 2093].forEach((f, i) => setTimeout(() => this._tone(f, 0.12, 'triangle', 0.22), i * 70)); }
  skid() { this._noise(0.2, 0.2, 4000); }
  missionComplete() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._tone(f, 0.22, 'triangle', 0.25), i * 110));
  }
  busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => this._tone(f, 0.3, 'sawtooth', 0.15), i * 160)); }
  wasted() { [330, 262, 196, 131].forEach((f, i) => setTimeout(() => this._tone(f, 0.35, 'sawtooth', 0.16), i * 180)); }

  setEngine(running, speedRatio, isBike) {
    if (!this.ctx || this.muted) return;
    try {
      if (running && !this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.0;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 700;
        this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      if (!this.engineOsc) return;
      if (!running) {
        this.engineGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.1);
      } else {
        // bikes whine higher than cars at the same speed
        const base = isBike ? 95 : 55;
        const span = isBike ? 210 : 130;
        this.engineOsc.frequency.setTargetAtTime(base + speedRatio * span, this.ctx.currentTime, 0.08);
        this.engineGain.gain.setTargetAtTime(0.05 + speedRatio * 0.05, this.ctx.currentTime, 0.1);
      }
    } catch (e) { /* ignore */ }
  }

  setSiren(on) {
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (this.sirenTimer) { clearInterval(this.sirenTimer); this.sirenTimer = null; }
    if (on && this.ctx && !this.muted) {
      let high = false;
      this.sirenTimer = setInterval(() => {
        high = !high;
        this._tone(high ? 950 : 700, 0.42, 'sine', 0.05);
      }, 430);
    }
  }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    // A slow, sunny bassline: Am - F - C - G, one note per beat.
    const bass = [110, 87.3, 130.8, 98];
    const lead = [440, 523.25, 659.25, 392];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const bar = Math.floor(this.musicStep / 4) % 4;
      if (this.musicStep % 4 === 0) this._tone(bass[bar], 0.9, 'triangle', 0.1);
      if (this.musicStep % 2 === 1) this._tone(lead[(bar + this.musicStep) % 4], 0.4, 'sine', 0.045);
      this.musicStep++;
    }, 480);
  }
}
