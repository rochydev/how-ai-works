import * as THREE from 'three';
import { Pipeline } from '../ai/pipeline.js';
import { STAGES, stageIndex } from '../ai/stages.js';
import { STRINGS } from '../i18n.js';

/**
 * The conductor: owns the shared state and moves the story forward —
 * typing, stage changes, autoplay, generation, camera, lights and sound.
 */
export class Experience {
  constructor({ engine, director, character, leds, holo, screen, audio, lang }) {
    Object.assign(this, { engine, director, character, leds, holo, screen, audio });
    this.state = {
      lang,
      S: STRINGS[lang],
      intro: true,
      stage: 0,
      stageTime: 0,
      t: 0,
      typed: '',
      pipeline: new Pipeline(),
      temperature: 0.6,
      head: 0,
      focus: null,
      speed: 1,
      playing: true,
      shot: 'room',
      sound: audio.enabled,
      cameraPosition: engine.camera.position,
      actions: {
        setHead: (h) => this.setHead(h),
        setFocus: (i) => this.setFocus(i),
        goto: (i) => this.goto(i),
      },
    };
    this.focusHoldUntil = 0;
    this.genAcc = 0;
    this.doneFor = 0;
    this.typingJob = null;
    this.hud = null;
    this.headPos = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.bindPicking();
    director.onShotChange = (shot) => {
      this.state.shot = shot;
      this.hud?.render();
    };
  }

  attachHud(hud) {
    this.hud = hud;
    window.addEventListener('resize', () => this.updateLayout());
    this.updateLayout();
  }

  // ---- API used by the HUD ---------------------------------------------------
  start() {
    this.audio.unlock();
    this.state.intro = false;
    this.director.orbitIntro = false;
    this.goto(0, { force: true });
    this.hud.focusInput();
  }

  setTyped(text) {
    if (this.state.stage !== 0) return;
    this.state.typed = text;
  }

  keystroke(key) {
    this.audio.key();
    this.leds.pulse(0.35);
    this.character.type(key === 'Enter' ? '\n' : key === 'Backspace' ? '\b' : key);
  }

  submit(text) {
    const prompt = (text ?? this.state.typed).trim();
    if (!prompt || this.state.stage !== 0) return;
    this.cancelTyping();
    this.state.typed = prompt;
    this.state.pipeline.setPrompt(prompt, this.state.lang);
    this.state.playing = true;
    this.character.nod();
    this.goto(1);
  }

  autoType(text) {
    if (this.state.stage !== 0) this.goto(0);
    this.cancelTyping();
    this.state.typed = '';
    this.hud.setInput('');
    const chars = [...text];
    let i = 0;
    const tick = () => {
      if (i < chars.length) {
        this.state.typed += chars[i];
        this.hud.setInput(this.state.typed);
        this.keystroke(chars[i]);
        i++;
        this.typingJob = setTimeout(tick, 45 + Math.random() * 70 + (chars[i - 1] === ' ' ? 60 : 0));
      } else {
        this.typingJob = setTimeout(() => {
          this.keystroke('Enter');
          this.submit(text);
        }, 450);
      }
    };
    this.typingJob = setTimeout(tick, 300);
  }

  cancelTyping() {
    clearTimeout(this.typingJob);
    this.typingJob = null;
  }

  goto(i, { force = false } = {}) {
    const s = this.state;
    const p = s.pipeline;
    i = Math.max(0, Math.min(STAGES.length - 1, i));
    if (i > 0 && !p.prompt) return;
    if (i === s.stage && !force) return;
    const stage = STAGES[i];

    if (i === 0) {
      this.cancelTyping();
      p.setPrompt('', s.lang);
      s.typed = '';
      this.hud?.setInput('');
      this.hud?.focusInput();
    } else if (i < stageIndex('sampling')) {
      p.resetGeneration();
    } else if (stage.id === 'sampling') {
      p.resetGeneration();
      p.step(s.temperature);
    } else if (stage.id === 'generate') {
      if (!p.history.length) p.step(s.temperature);
    } else if (stage.id === 'answer') {
      let guard = 0;
      while (!p.done && guard++ < 400) p.step(s.temperature);
    }

    const changed = i !== s.stage;
    s.stage = i;
    s.stageTime = 0;
    s.focus = null;
    this.focusHoldUntil = 0;
    this.genAcc = 0;
    this.doneFor = 0;

    if (this.director.shot !== 'free' || force) this.director.go(stage.shot);
    s.shot = this.director.shot;
    this.leds.setMood(stage.mood);
    this.holo.setMode(stage.holo);
    this.character.setPose(stage.id === 'generate' ? 'read' : 'idle');
    if (changed && i > 0) this.audio.whoosh();
    if (stage.id === 'answer') {
      this.audio.chime();
      this.character.nod();
    }
    this.hud?.render();
    this.updateLayout();
  }

  next() {
    if (this.state.stage === 0) return this.submit(this.state.typed);
    this.goto(this.state.stage + 1);
  }

  prev() {
    this.goto(this.state.stage - 1);
  }

  togglePlay() {
    this.state.playing = !this.state.playing;
    this.hud.render();
  }

  restart() {
    this.goto(0, { force: true });
  }

  setTemperature(T) {
    this.state.temperature = T;
  }

  setHead(h) {
    this.state.head = h;
    this.hud.render();
  }

  setFocus(i) {
    this.state.focus = i;
    this.focusHoldUntil = this.state.t + 3;
  }

  setSpeed(x) {
    this.state.speed = x;
    this.hud.render();
  }

  setLang(lang) {
    this.state.lang = lang;
    this.state.S = STRINGS[lang];
    try {
      localStorage.setItem('haw-lang', lang);
    } catch {
      /* storage unavailable */
    }
    this.hud.render();
  }

  setShot(name) {
    this.director.go(name);
    this.state.shot = name;
    this.hud.render();
  }

  toggleSound() {
    this.audio.unlock();
    this.state.sound = !this.state.sound;
    this.audio.setEnabled(this.state.sound);
    this.hud.render();
  }

  // ---- layout, picking -------------------------------------------------------
  updateLayout() {
    if (!this.hud) return;
    const w = innerWidth;
    const h = innerHeight;
    const panel = this.hud.$('.panel').getBoundingClientRect();
    if (w > 760) {
      this.director.setLayout({ panelRight: panel.width ? (w - panel.left + 8) / w : 0, top: 72 / h, bottom: 96 / h, panelBottom: 0 });
    } else {
      const panelBottom = panel.height ? (h - panel.top) / h - 84 / h : 0;
      this.director.setLayout({ panelRight: 0, top: 60 / h, bottom: 84 / h, panelBottom: Math.max(0, panelBottom) });
    }
  }

  bindPicking() {
    const dom = this.engine.renderer.domElement;
    const ndc = new THREE.Vector2();
    let down = null;
    const pick = (e) => {
      ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.engine.camera);
      const hit = this.raycaster.intersectObject(this.screen.mesh, false)[0];
      return hit?.uv || null;
    };
    dom.addEventListener('pointermove', (e) => {
      const uv = pick(e);
      const interactive = this.screen.setPointer(uv);
      dom.style.cursor = interactive ? 'pointer' : uv && this.director.shot !== 'screen' ? 'zoom-in' : '';
    });
    dom.addEventListener('pointerleave', () => this.screen.setPointer(null));
    dom.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    dom.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      down = null;
      const uv = pick(e);
      if (!uv) return;
      if (this.director.shot !== 'screen' && !this.state.intro) this.setShot('screen');
      else this.screen.setPointer(uv, true);
    });
  }

  // ---- frame -----------------------------------------------------------------
  update(dt, t) {
    const s = this.state;
    const p = s.pipeline;
    const stage = STAGES[s.stage];
    s.t = t;
    s.stageTime += dt;

    if (stage.id === 'attention' && p.tokens.length > 1 && t > this.focusHoldUntil) {
      s.focus = 1 + (Math.floor(s.stageTime / 1.5) % (p.tokens.length - 1));
    }

    if (!s.intro && s.playing && stage.duration && s.stageTime > stage.duration / s.speed) this.goto(s.stage + 1);

    if (stage.id === 'generate') {
      if (!p.done) {
        this.genAcc += dt * s.speed;
        const interval = p.history.length < 3 ? 0.45 : 0.17;
        if (this.genAcc > interval) {
          this.genAcc = 0;
          const { token } = p.step(s.temperature);
          if (!token.eos) this.holo.spark(token, p.generated.length);
          this.audio.blip(p.generated.length);
          this.leds.pulse(0.5);
        }
      } else {
        this.doneFor += dt;
        if (s.playing && this.doneFor > 1.8) this.goto(stageIndex('answer'));
      }
    }

    // never clip the camera through the character's head
    this.character.headWorldPosition(this.headPos);
    this.character.root.visible = !this.director.nearHead(this.headPos);

    const bloom = this.engine.bloom;
    const targetBloom = this.director.shot === 'screen' ? 0.32 : s.intro ? 1.0 : 0.85;
    bloom.strength += (targetBloom - bloom.strength) * (1 - Math.exp(-dt * 3));

    this.holo.update(dt, t, s);
    this.screen.update(dt);
    this.hud?.tick();
  }
}
