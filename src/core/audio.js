/**
 * Tiny synthesized soundscape (no audio files): mechanical key clicks,
 * a soft rain + synth pad ambience, whooshes between stages and blips
 * for every generated token.
 */
export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    try {
      this.enabled = localStorage.getItem('haw-sound') !== 'off';
    } catch {
      /* storage unavailable */
    }
  }

  /** Must be called from a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.8 : 0;
    this.master.connect(this.ctx.destination);
    this.noise = this.makeNoise();
    this.startAmbience();
  }

  setEnabled(on) {
    this.enabled = on;
    try {
      localStorage.setItem('haw-sound', on ? 'on' : 'off');
    } catch {
      /* storage unavailable */
    }
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.1);
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  startAmbience() {
    const c = this.ctx;
    // rain on the window
    const rain = c.createBufferSource();
    rain.buffer = this.noise;
    rain.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const rg = c.createGain();
    rg.gain.value = 0.035;
    rain.connect(lp).connect(rg).connect(this.master);
    rain.start();
    // warm pad
    const pad = c.createGain();
    pad.gain.value = 0.0;
    pad.gain.setTargetAtTime(0.03, c.currentTime, 3);
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 2;
    pad.connect(filter).connect(this.master);
    for (const [f, det] of [
      [110, -7],
      [164.81, 5],
      [220, 3],
      [277.18, -4],
    ]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      const g = c.createGain();
      g.gain.value = 0.25;
      o.connect(g).connect(pad);
      o.start();
    }
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
  }

  key() {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2500 + Math.random() * 2500;
    bp.Q.value = 3;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5, 0.06);
    // low "thock"
    const o = c.createOscillator();
    o.frequency.setValueAtTime(180 + Math.random() * 40, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.04);
    const og = c.createGain();
    og.gain.setValueAtTime(0.12, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 0.06);
  }

  whoosh() {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.35);
    bp.frequency.exponentialRampToValueAtTime(600, t + 0.7);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, 0, 0.8);
  }

  blip(pitch = 0) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'triangle';
    const scale = [0, 3, 5, 7, 10, 12];
    o.frequency.value = 660 * Math.pow(2, scale[pitch % scale.length] / 12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.13);
  }

  chime() {
    if (!this.ctx || !this.enabled) return;
    [0, 4, 7, 12].forEach((s, i) => setTimeout(() => this.blip(s === 12 ? 5 : i), i * 90));
  }
}
