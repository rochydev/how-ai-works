/**
 * Generative lo-fi background music, synthesized live (no audio files).
 * A slow four-chord loop on an FM electric piano, a round sine bass, a
 * wandering pentatonic melody, brushed drums and vinyl crackle, all sent
 * through a soft reverb and a tape-ish low-pass. Nothing ever repeats
 * exactly: voicings, velocities, melody and fills are rolled every bar.
 */

const BPM = 68;
const BEAT = 60 / BPM;
const EIGHTH = BEAT / 2;
const SWING = 0.16 * BEAT;
const LOOKAHEAD = 1.5; // seconds; background tabs only tick once a second

// Fmaj9 → Em7 → Dm9 → Cmaj9, two bars each
const CHORDS = [
  { bass: 41, notes: [57, 60, 64, 67] },
  { bass: 40, notes: [55, 59, 62, 64] },
  { bass: 38, notes: [53, 57, 60, 64] },
  { bass: 36, notes: [52, 55, 59, 62] },
];
const SCALE = [72, 74, 76, 79, 81, 84, 86]; // C major pentatonic, upper octave

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

export class Music {
  constructor(ctx, destination, noise) {
    this.ctx = ctx;
    this.noise = noise;
    this.step = 0; // eighth-note counter
    this.melodyIndex = 2;
    this.timer = null;

    this.out = ctx.createGain();
    this.out.gain.value = 0;
    const tape = ctx.createBiquadFilter();
    tape.type = 'lowpass';
    tape.frequency.value = 4200;
    tape.Q.value = 0.4;
    this.out.connect(tape).connect(destination);

    this.dry = ctx.createGain();
    this.dry.connect(this.out);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.42;
    this.reverb.connect(wet).connect(this.out);

    // dotted-eighth echo for the melody
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = EIGHTH * 1.5;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 1800;
    this.delay.connect(dlp).connect(fb).connect(this.delay);
    dlp.connect(this.out);

    this.crackle();
  }

  impulse(seconds) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }

  crackle() {
    const c = this.ctx;
    const len = c.sampleRate * 4;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) if (Math.random() < 0.00035) d[i] = (Math.random() * 2 - 1) * (0.4 + Math.random() * 0.6);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    const g = c.createGain();
    g.gain.value = 0.16;
    src.connect(hp).connect(g).connect(this.out);
    src.start();
  }

  start() {
    if (this.timer) return;
    const c = this.ctx;
    this.out.gain.cancelScheduledValues(c.currentTime);
    this.out.gain.setTargetAtTime(1.2, c.currentTime, 2.5);
    this.next = c.currentTime + 0.2;
    this.timer = setInterval(() => this.schedule(), 200);
    this.schedule();
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.6);
  }

  schedule() {
    const until = this.ctx.currentTime + LOOKAHEAD;
    // if the tab slept for a long time, skip ahead instead of bursting notes
    if (this.next < this.ctx.currentTime - 0.5) this.next = this.ctx.currentTime + 0.05;
    while (this.next < until) {
      this.play(this.step, this.next + (this.step % 2 ? SWING : 0));
      this.next += EIGHTH;
      this.step++;
    }
  }

  /** Everything that happens on one eighth note. */
  play(step, t) {
    const inBar = step % 8;
    const bar = Math.floor(step / 8);
    const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
    const loop = Math.floor(bar / 8);
    const drums = loop % 4 !== 0 || bar % 8 >= 4; // first half of every 4th loop breathes without drums
    const r = Math.random;

    // keys: chord on the downbeat of each chord, a softer push in the second bar
    if (bar % 2 === 0 && inBar === 0) this.strum(chord.notes, t, 0.75 + r() * 0.15);
    if (bar % 2 === 1 && inBar === 3 && r() < 0.7) this.strum(chord.notes.slice(1), t, 0.45 + r() * 0.15);

    // bass
    if (inBar === 0) this.bass(chord.bass, t, bar % 2 === 0 ? 1 : 0.8);
    if (inBar === 5 && r() < 0.45) this.bass(chord.bass + (r() < 0.5 ? 7 : 12), t, 0.55);

    // melody: a slow random walk over the pentatonic scale
    if (bar % 8 >= 2 && r() < (inBar % 2 ? 0.16 : 0.28)) {
      this.melodyIndex = Math.max(0, Math.min(SCALE.length - 1, this.melodyIndex + [-2, -1, -1, 1, 1, 2][Math.floor(r() * 6)]));
      this.bell(SCALE[this.melodyIndex], t, 0.35 + r() * 0.25);
    }

    if (!drums) return;
    if (inBar === 0 || (inBar === 5 && r() < 0.5)) this.kick(t);
    if (inBar === 2 || inBar === 6) this.brush(t, 0.9 + r() * 0.2);
    if (r() < 0.85) this.hat(t, inBar % 2 ? 0.5 : 0.85);
  }

  strum(notes, t, vel) {
    notes.forEach((n, i) => this.piano(n, t + i * (0.025 + Math.random() * 0.02), vel * (0.85 + Math.random() * 0.15)));
  }

  /** FM electric piano: sine carrier, modulator at 1:1 whose index decays. */
  piano(midi, t, vel, { dur = 4.2, level = 0.055, send = this.reverb, bright = 1 } = {}) {
    const c = this.ctx;
    const f = hz(midi);
    const car = c.createOscillator();
    car.frequency.value = f;
    car.detune.value = (Math.random() - 0.5) * 8;
    const mod = c.createOscillator();
    mod.frequency.value = f;
    const idx = c.createGain();
    idx.gain.setValueAtTime(f * 1.6 * bright * vel, t);
    idx.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.9);
    mod.connect(idx).connect(car.frequency);
    const amp = c.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(level * vel, t + 0.012);
    amp.gain.exponentialRampToValueAtTime(level * vel * 0.4, t + 0.6);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(amp);
    amp.connect(this.dry);
    amp.connect(send);
    car.start(t);
    mod.start(t);
    car.stop(t + dur + 0.05);
    mod.stop(t + dur + 0.05);
  }

  bell(midi, t, vel) {
    this.piano(midi, t, vel, { dur: 3, level: 0.04, bright: 1.4 });
    this.piano(midi, t, vel * 0.6, { dur: 3, level: 0.04, send: this.delay, bright: 1.4 });
  }

  bass(midi, t, vel) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = hz(midi);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * vel, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + BEAT * 2.6);
    o.connect(lp).connect(g).connect(this.dry);
    o.start(t);
    o.stop(t + BEAT * 2.7);
  }

  kick(t) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(this.dry);
    o.start(t);
    o.stop(t + 0.35);
  }

  noiseHit(t, { type, freq, q = 1, level, dur, send = 0 }) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.dry);
    if (send) {
      const s = c.createGain();
      s.gain.value = send;
      g.connect(s).connect(this.reverb);
    }
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  brush(t, vel) {
    this.noiseHit(t, { type: 'bandpass', freq: 1900, q: 0.7, level: 0.07 * vel, dur: 0.22, send: 0.5 });
  }

  hat(t, vel) {
    this.noiseHit(t, { type: 'highpass', freq: 5500, level: 0.018 * vel * (0.6 + Math.random() * 0.4), dur: 0.05 });
  }
}
