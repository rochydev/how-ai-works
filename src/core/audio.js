import { Music } from './music.js';

const stored = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const store = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
};

/**
 * Tiny synthesized soundscape (no audio files): mechanical key clicks,
 * rain on the window, generative lo-fi music, whooshes between stages and
 * blips for every generated token.
 */
export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = stored('haw-sound') !== 'off';
    this.musicEnabled = stored('haw-music') !== 'off';
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
    this.music = new Music(this.ctx, this.master, this.noise);
    if (this.enabled && this.musicEnabled) this.music.start();
  }

  setEnabled(on) {
    this.enabled = on;
    store('haw-sound', on ? 'on' : 'off');
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.1);
    // no point scheduling notes nobody can hear
    if (this.music) on && this.musicEnabled ? this.music.start() : this.music.stop();
  }

  setMusic(on) {
    this.musicEnabled = on;
    store('haw-music', on ? 'on' : 'off');
    if (!this.music) return;
    if (on && this.enabled) this.music.start();
    else this.music.stop();
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
