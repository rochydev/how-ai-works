import * as THREE from 'three';
import { STAGES } from '../ai/stages.js';
import { VIEWS } from './views.js';
import { C, MONO, SANS, DISPLAY, text, font, wrap, rrect, fillRR, strokeRR, withAlpha } from './draw.js';

export const SCREEN_W = 1920;
export const SCREEN_H = 1080;

const CHAT = { x: 24, y: 64, w: 560, h: 992 };
const INSPECT = { x: 608, y: 64, w: 1288, h: 992 };
const CONTENT = { x: INSPECT.x + 24, y: INSPECT.y + 78, w: INSPECT.w - 48, h: INSPECT.h - 160 };

/**
 * "neural.os": the operating system on the monitor. Everything is drawn on
 * a 2D canvas that becomes the monitor's texture. Pointer events from the
 * 3D scene (via UV raycasting) are routed back to registered hit regions.
 */
export class ScreenOS {
  constructor(mesh, state) {
    this.state = state;
    this.canvas = document.createElement('canvas');
    this.canvas.width = SCREEN_W;
    this.canvas.height = SCREEN_H;
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.anisotropy = 8;
    mesh.material = new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false });
    this.mesh = mesh;
    this.regions = [];
    this.pointer = null;
    this.acc = 0;
    this.vignette = this.makeVignette();
    this.wallpaper = this.makeWallpaper();
  }

  /** Soft macOS-style wallpaper: a few large colour blooms on deep indigo. */
  makeWallpaper() {
    const c = document.createElement('canvas');
    c.width = SCREEN_W;
    c.height = SCREEN_H;
    const g = c.getContext('2d');
    g.fillStyle = '#141220';
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    for (const [x, y, r, col] of [
      [260, 980, 760, 'rgba(94,92,230,0.55)'],
      [1560, 160, 820, 'rgba(191,90,242,0.38)'],
      [1250, 1080, 640, 'rgba(10,132,255,0.32)'],
    ]) {
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, col);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }
    return c;
  }

  makeVignette() {
    const c = document.createElement('canvas');
    c.width = SCREEN_W;
    c.height = SCREEN_H;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(SCREEN_W / 2, SCREEN_H / 2, SCREEN_H * 0.35, SCREEN_W / 2, SCREEN_H / 2, SCREEN_W * 0.65);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = grad;
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    g.fillStyle = 'rgba(0,0,0,0.07)';
    for (let y = 0; y < SCREEN_H; y += 4) g.fillRect(0, y, SCREEN_W, 1.5);
    return c;
  }

  /** u, v in [0,1] from a raycast hit, or null when the pointer leaves. */
  setPointer(uv, click = false) {
    if (!uv) {
      this.pointer = null;
      return false;
    }
    const x = uv.x * SCREEN_W;
    const y = (1 - uv.y) * SCREEN_H;
    this.pointer = { x, y };
    let handled = false;
    for (const r of this.regions) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        if (r.onHover) r.onHover();
        if (click && r.onClick) r.onClick();
        handled = handled || !!(r.onClick || r.onHover);
      }
    }
    return handled;
  }

  update(dt) {
    // 30 fps is plenty for the monitor and halves the canvas cost
    this.acc += dt;
    if (this.acc < 1 / 30) return;
    this.acc = 0;
    this.draw();
    this.texture.needsUpdate = true;
  }

  draw() {
    const g = this.g;
    const s = this.state;
    this.regions = [];
    const hit = (r) => this.regions.push(r);

    g.drawImage(this.wallpaper, 0, 0);

    this.drawTopBar(g, s);
    this.drawChat(g, s);
    this.drawInspector(g, s, hit);

    g.drawImage(this.vignette, 0, 0);
  }

  /** macOS-style menu bar: app name and menus on the left, status items on the right. */
  drawTopBar(g, s) {
    g.fillStyle = 'rgba(28,26,36,0.72)';
    g.fillRect(0, 0, SCREEN_W, 44);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 44, SCREEN_W, 1);
    // app glyph: a little rounded square
    fillRR(g, 26, 12, 20, 20, 5, C.ink);
    fillRR(g, 31, 17, 10, 10, 2, '#1c1a24');
    let x = 66;
    text(g, 'neural.os', x, 30, { size: 19, weight: 700 });
    x += 112;
    const menus = s.lang === 'en' ? ['File', 'Edit', 'View', 'Window', 'Help'] : ['Archivo', 'Edición', 'Visualización', 'Ventana', 'Ayuda'];
    font(g, 19, 400, SANS);
    for (const m of menus) {
      text(g, m, x, 30, { size: 19 });
      x += g.measureText(m).width + 30;
    }

    const now = new Date();
    const clock = new Intl.DateTimeFormat(s.lang, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(now).replace(/,/g, '');
    let rx = SCREEN_W - 26;
    text(g, clock, rx, 30, { size: 19, align: 'right' });
    font(g, 19, 400, SANS);
    rx -= g.measureText(clock).width + 34;
    // battery
    strokeRR(g, rx - 34, 15, 34, 16, 4, withAlpha(C.ink, 0.8), 1.5);
    fillRR(g, rx - 31, 18, 22, 10, 2, C.ink);
    fillRR(g, rx + 1, 20, 3, 6, 1, withAlpha(C.ink, 0.8));
    rx -= 64;
    // wi-fi: three arcs and a dot
    g.strokeStyle = C.ink;
    g.lineWidth = 2.6;
    g.lineCap = 'round';
    for (const r of [6, 11, 16]) {
      g.beginPath();
      g.arc(rx, 32, r, Math.PI * 1.25, Math.PI * 1.75);
      g.stroke();
    }
    g.lineCap = 'butt';
    g.fillStyle = C.ink;
    g.beginPath();
    g.arc(rx, 31, 2.4, 0, Math.PI * 2);
    g.fill();
  }

  /** A macOS window: rounded, deep shadow, traffic lights and a centred title. */
  windowFrame(g, R, title) {
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 50;
    g.shadowOffsetY = 18;
    fillRR(g, R.x, R.y, R.w, R.h, 16, '#1e1e20');
    g.restore();
    g.save();
    rrect(g, R.x, R.y, R.w, R.h, 16);
    g.clip();
    g.fillStyle = '#2a2a2d';
    g.fillRect(R.x, R.y, R.w, 52);
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(R.x, R.y + 52, R.w, 1.5);
    g.restore();
    strokeRR(g, R.x, R.y, R.w, R.h, 16, 'rgba(255,255,255,0.12)', 1.5);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      g.fillStyle = c;
      g.beginPath();
      g.arc(R.x + 28 + i * 26, R.y + 26, 8, 0, Math.PI * 2);
      g.fill();
    });
    text(g, title, R.x + R.w / 2, R.y + 33, { size: 19, weight: 600, color: C.dim, align: 'center' });
  }

  drawChat(g, s) {
    const R = CHAT;
    const S = s.S.screen;
    this.windowFrame(g, R, S.chat);
    const p = s.pipeline;
    const inner = { x: R.x + 22, y: R.y + 74, w: R.w - 44, h: R.h - 190 };

    let y = inner.y + 10;
    const sent = s.stage > 0 && p.prompt;
    if (!sent) {
      text(g, s.lang === 'en' ? 'How can I help you?' : '¿En qué puedo ayudarte?', R.x + R.w / 2, R.y + R.h / 2 - 60, {
        size: 40,
        weight: 600,
        family: DISPLAY,
        color: C.dim,
        align: 'center',
      });
    } else {
      // user bubble, Messages-style
      font(g, 24, 400, SANS);
      const lines = wrap(g, p.prompt, inner.w - 120);
      const bw = Math.min(inner.w - 60, Math.max(...lines.map((l) => g.measureText(l).width)) + 40);
      const bh = lines.length * 32 + 30;
      text(g, S.you, inner.x + inner.w - 8, y + 10, { size: 16, weight: 500, color: C.dim, align: 'right' });
      y += 22;
      fillRR(g, inner.x + inner.w - bw, y, bw, bh, 22, C.accent);
      lines.forEach((l, i) => text(g, l, inner.x + inner.w - bw + 20, y + 38 + i * 32, { size: 24, color: '#ffffff' }));
      y += bh + 30;

      // assistant bubble
      text(g, S.assistant, inner.x + 8, y + 10, { size: 16, weight: 500, color: C.dim });
      y += 22;
      const generating = s.stage >= 9;
      if (!generating) {
        fillRR(g, inner.x, y, 110, 60, 30, '#3a3a3c');
        for (let i = 0; i < 3; i++) {
          const a = 0.35 + 0.65 * Math.max(0, Math.sin(s.t * 5 - i * 0.7));
          g.fillStyle = withAlpha(C.ink, a);
          g.beginPath();
          g.arc(inner.x + 30 + i * 25, y + 30, 8, 0, Math.PI * 2);
          g.fill();
        }
        text(g, S.thinking, inner.x + 128, y + 37, { size: 18, color: C.dim });
      } else {
        font(g, 24, 400, SANS);
        const caret = s.stage === 9 && Math.floor(s.t * 3) % 2 === 0 ? '▌' : '';
        const out = wrap(g, p.outputText + caret, inner.w - 60);
        const maxLines = Math.floor((inner.y + inner.h - y - 30) / 32);
        const shown = out.slice(Math.max(0, out.length - maxLines));
        const bh2 = shown.length * 32 + 30;
        fillRR(g, inner.x, y, inner.w - 20, bh2, 22, '#3a3a3c');
        shown.forEach((l, i) => text(g, l, inner.x + 20, y + 38 + i * 32, { size: 24 }));
      }
    }

    // input box
    const ib = { x: R.x + 22, y: R.y + R.h - 96, w: R.w - 44, h: 70 };
    const active = s.stage === 0;
    fillRR(g, ib.x, ib.y, ib.w, ib.h, ib.h / 2, 'rgba(255,255,255,0.04)');
    strokeRR(g, ib.x, ib.y, ib.w, ib.h, ib.h / 2, active ? 'rgba(255,255,255,0.28)' : C.line, 1.5);
    if (active) {
      const caret = Math.floor(s.t * 2.5) % 2 === 0 ? '▌' : ' ';
      font(g, 24, 400, SANS);
      let shown = s.typed;
      while (shown && g.measureText(shown + caret).width > ib.w - 90) shown = shown.slice(1);
      text(g, s.typed ? shown + caret : caret, ib.x + 22, ib.y + 44, { size: 24, color: s.typed ? C.ink : C.dim });
      if (!s.typed) text(g, s.S.placeholder, ib.x + 46, ib.y + 44, { size: 22, color: C.faint });
      fillRR(g, ib.x + ib.w - 58, ib.y + 13, 44, 44, 22, s.typed ? C.accent : 'rgba(255,255,255,0.1)');
      text(g, '↑', ib.x + ib.w - 36, ib.y + 46, { size: 26, weight: 700, align: 'center', color: s.typed ? '#ffffff' : C.dim });
    } else {
      text(g, `✓ ${S.sent}`, ib.x + 26, ib.y + 44, { size: 21, color: C.dim });
    }
  }

  drawInspector(g, s, hit) {
    const R = INSPECT;
    const stage = STAGES[s.stage];
    const n = String(s.stage + 1).padStart(2, '0');
    this.windowFrame(g, R, `${s.S.stages[stage.id].title}  —  model.inspect()  ${n}/${STAGES.length}`);

    const view = VIEWS[stage.id];
    if (view && (stage.id === 'prompt' || s.pipeline.prompt)) {
      g.save();
      view(g, CONTENT, s, hit);
      g.restore();
    }

    // pipeline progress strip
    const py = R.y + R.h - 58;
    const segW = (R.w - 48) / STAGES.length;
    STAGES.forEach((st, i) => {
      const x = R.x + 24 + i * segW;
      const done = i < s.stage;
      const cur = i === s.stage;
      const col = cur ? C.accent : done ? C.ink : C.faint;
      g.fillStyle = withAlpha(col, cur ? 1 : done ? 0.5 : 0.6);
      g.fillRect(x + 3, py + 2, segW - 6, 3);
      font(g, 14, cur ? 600 : 400, SANS);
      let label = `${i + 1}. ${s.S.stages[st.id].title}`;
      while (g.measureText(label).width > segW - 8 && label.length > 4) label = `${label.slice(0, -2)}…`;
      text(g, label, x + segW / 2, py + 32, { size: 14, family: SANS, weight: cur ? 600 : 400, color: cur ? C.ink : C.dim, align: 'center' });
      hit({ x, y: py - 10, w: segW, h: 50, onClick: () => s.actions.goto?.(i) });
    });
  }
}

export { SANS, MONO, DISPLAY };
