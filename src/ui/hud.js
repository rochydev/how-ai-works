import { STAGES } from '../ai/stages.js';
import '../styles/hud.css';

const ICONS = {
  logo: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor"/><rect x="8" y="8" width="8" height="8" rx="2" fill="#1c1c1e"/></svg>',
  appIcon: '<svg viewBox="0 0 64 64" fill="none" stroke-linecap="round"><path d="M16 22h32M16 32h22M16 42h12" stroke="#f5f5f7" stroke-width="4"/><rect x="34" y="38" width="12" height="8" rx="2" fill="#0a84ff"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>',
  bubble: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  restart: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6"/></svg>',
  musicOn: '<svg viewBox="0 0 24 24"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>',
  musicOff: '<svg viewBox="0 0 24 24"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/><path d="M3 3l18 18"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  github: '<svg viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 2.9.8.1-.7.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7 3.6 3.6 0 0 1 .1-2.7s.8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/></svg>',
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** HTML overlay: intro card, stage panel, prompt composer and timeline. */
export class Hud {
  constructor(root, state, api) {
    this.root = root;
    this.state = state;
    this.api = api;
    this.root.innerHTML = this.template();
    this.$ = (sel) => this.root.querySelector(sel);
    this.bind();
    this.render();
  }

  template() {
    const lights = '<span class="lights" aria-hidden="true"><i></i><i></i><i></i></span>';
    return `
      <header class="topbar">
        <div class="brand">
          <span class="logo">${ICONS.logo}</span>
          <span class="brand-title" data-t="title"></span>
          <nav class="views" role="group" aria-label="camera"></nav>
        </div>
        <div class="top-actions">
          <button class="icon-btn" data-action="music" aria-label="music"></button>
          <button class="icon-btn" data-action="sound" aria-label="sound"></button>
          <div class="lang" role="group" aria-label="language">
            <button data-lang="es">ES</button><button data-lang="en">EN</button>
          </div>
          <span class="clock"></span>
        </div>
      </header>

      <aside class="panel window" aria-live="polite">
        <div class="titlebar">${lights}<span class="panel-step"></span></div>
        <div class="window-body">
          <h2 class="panel-title"></h2>
          <p class="panel-body"></p>
          <div class="panel-controls"></div>
          <div class="panel-fact"><b></b><span></span></div>
          <div class="panel-progress"><i></i></div>
        </div>
      </aside>

      <div class="composer">
        <form class="composer-box">
          <div class="spot-row">
            ${ICONS.search}
            <input type="text" maxlength="160" autocomplete="off" spellcheck="false" />
            <button type="submit" class="send" aria-label="send">${ICONS.send}</button>
          </div>
          <div class="suggestions"></div>
        </form>
      </div>

      <footer class="timeline">
        <button class="icon-btn" data-action="prev">${ICONS.prev}</button>
        <button class="icon-btn play" data-action="play"></button>
        <button class="icon-btn" data-action="next">${ICONS.next}</button>
        <ol class="steps">${STAGES.map((s, i) => `<li><button data-step="${i}"><i></i><span></span></button></li>`).join('')}</ol>
        <div class="speed"><button data-speed="0.5">½×</button><button data-speed="1">1×</button><button data-speed="2">2×</button></div>
        <button class="icon-btn" data-action="restart">${ICONS.restart}</button>
      </footer>

      <div class="hint"></div>

      <div class="intro">
        <div class="intro-card window">
          <div class="titlebar">${lights}</div>
          <div class="window-body">
            <div class="app-icon">${ICONS.appIcon}</div>
            <h1 data-t="introLead"></h1>
            <p data-t="introBody"></p>
            <button class="intro-start" data-action="start"><span data-t="start"></span></button>
            <small data-t="disclaimer"></small>
          </div>
        </div>
      </div>`;
  }

  bind() {
    const { api } = this;
    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.action) {
        const a = btn.dataset.action;
        if (a === 'start') api.start();
        if (a === 'prev') api.prev();
        if (a === 'next') api.next();
        if (a === 'play') api.togglePlay();
        if (a === 'restart') api.restart();
        if (a === 'sound') api.toggleSound();
        if (a === 'music') api.toggleMusic();
      }
      if (btn.dataset.step) api.goto(Number(btn.dataset.step));
      if (btn.dataset.lang) api.setLang(btn.dataset.lang);
      if (btn.dataset.view) api.setShot(btn.dataset.view);
      if (btn.dataset.speed) api.setSpeed(Number(btn.dataset.speed));
      if (btn.dataset.head) api.setHead(Number(btn.dataset.head));
      if (btn.dataset.suggest != null) api.autoType(this.state.S.suggestions[Number(btn.dataset.suggest)]);
    });
    const input = this.$('.composer input');
    input.addEventListener('input', () => api.setTyped(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') api.keystroke(e.key);
    });
    this.$('.composer-box').addEventListener('submit', (e) => {
      e.preventDefault();
      api.submit(input.value);
    });
    this.root.addEventListener('input', (e) => {
      if (!e.target.matches('[data-temp]')) return;
      api.setTemperature(Number(e.target.value));
      e.target.style.setProperty('--p', `${(e.target.value / 2) * 100}%`);
    });
    // menu-bar clock, like the real thing
    const tick = () => {
      this.$('.clock').textContent = new Intl.DateTimeFormat(this.state.lang, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        .format(new Date())
        .replace(/,/g, '');
    };
    tick();
    setInterval(tick, 15000);
    this.tickClock = tick;
    // keyboard shortcuts outside the input
    window.addEventListener('keydown', (e) => {
      if (e.target.matches('input')) return;
      if (e.key === 'ArrowRight') api.next();
      if (e.key === 'ArrowLeft') api.prev();
      if (e.key === ' ') {
        e.preventDefault();
        api.togglePlay();
      }
    });
  }

  focusInput() {
    const input = this.$('.composer input');
    setTimeout(() => input.focus({ preventScroll: true }), 50);
  }

  setInput(value) {
    this.$('.composer input').value = value;
  }

  render() {
    const s = this.state;
    const S = s.S;
    const stage = STAGES[s.stage];
    const T = S.stages[stage.id];
    document.documentElement.lang = s.lang;
    this.root.querySelectorAll('[data-t]').forEach((el) => (el.textContent = S[el.dataset.t]));

    this.root.classList.toggle('show-intro', s.intro);
    this.root.classList.toggle('composing', s.stage === 0 && !s.intro);
    this.root.dataset.stage = stage.id;

    this.$('.panel-step').textContent = `${S.stage} ${s.stage + 1} ${S.of} ${STAGES.length}`;
    this.$('.panel-title').textContent = T.title;
    this.$('.panel-body').textContent = T.body;
    this.$('.panel-fact b').textContent = S.fact;
    this.$('.panel-fact span').textContent = T.fact;

    // stage-specific controls
    let controls = '';
    if (['logits', 'sampling', 'generate'].includes(stage.id)) {
      controls += `
        <label class="ctrl">
          <span>${S.temperature} <output>${s.temperature.toFixed(2)}</output></span>
          <input type="range" min="0" max="2" step="0.05" value="${s.temperature}" data-temp style="--p: ${(s.temperature / 2) * 100}%" />
        </label>`;
    }
    if (stage.id === 'attention') {
      controls += `<div class="heads">${S.heads
        .map((h, i) => `<button data-head="${i}" class="${i === s.head ? 'on' : ''}">${S.head} ${i + 1}<small>${esc(h)}</small></button>`)
        .join('')}</div>`;
    }
    const ctrlEl = this.$('.panel-controls');
    if (ctrlEl.dataset.key !== `${stage.id}:${s.lang}:${s.head}`) {
      ctrlEl.innerHTML = controls;
      ctrlEl.dataset.key = `${stage.id}:${s.lang}:${s.head}`;
    }

    this.$('.composer input').placeholder = S.placeholder;
    this.$('.suggestions').innerHTML = S.suggestions.map((q, i) => `<button type="button" data-suggest="${i}">${ICONS.bubble}<span>${esc(q)}</span></button>`).join('');

    this.$('.views').innerHTML = ['room', 'shoulder', 'screen', 'free']
      .map((v) => `<button data-view="${v}" class="${s.shot === v ? 'on' : ''}">${S.views[v]}</button>`)
      .join('');
    this.$('[data-action="sound"]').innerHTML = s.sound ? ICONS.soundOn : ICONS.soundOff;
    this.$('[data-action="sound"]').setAttribute('aria-pressed', String(s.sound));
    this.$('[data-action="sound"]').title = S.sound;
    this.$('[data-action="music"]').innerHTML = s.music ? ICONS.musicOn : ICONS.musicOff;
    this.$('[data-action="music"]').setAttribute('aria-pressed', String(s.music));
    this.$('[data-action="music"]').title = S.music;
    this.root.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === s.lang));
    this.root.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', Number(b.dataset.speed) === s.speed));
    this.$('[data-action="play"]').innerHTML = s.playing ? ICONS.pause : ICONS.play;
    this.$('[data-action="play"]').title = s.playing ? S.pause : S.play;
    this.$('[data-action="prev"]').title = S.prev;
    this.$('[data-action="next"]').title = S.next;
    this.$('[data-action="restart"]').title = S.restart;

    this.root.querySelectorAll('.steps button').forEach((b, i) => {
      b.classList.toggle('done', i < s.stage);
      b.classList.toggle('on', i === s.stage);
      b.querySelector('span').textContent = S.stages[STAGES[i].id].title;
      b.disabled = i > 0 && !s.pipeline.prompt;
    });
    this.$('.hint').textContent = S.hint;
    this.tickClock?.();
  }

  /** Per-frame bits that do not need a full re-render. */
  tick() {
    const s = this.state;
    const stage = STAGES[s.stage];
    let k = 0;
    if (stage.duration) k = Math.min(1, s.stageTime / (stage.duration / s.speed));
    if (stage.id === 'generate') k = s.pipeline.planned.length ? Math.min(1, s.pipeline.history.length / s.pipeline.planned.length) : 0;
    if (stage.id === 'answer') k = 1;
    this.$('.panel-progress i').style.width = `${k * 100}%`;
    const out = this.root.querySelector('.ctrl output');
    if (out) out.textContent = s.temperature.toFixed(2);
  }
}
