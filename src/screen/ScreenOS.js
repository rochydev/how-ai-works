import * as THREE from 'three';
import { STAGES } from '../ai/stages.js';
import { VIEWS } from './views.js';
import { C, MONO, SANS, SERIF, text, font, wrap, fillRR, strokeRR, withAlpha } from './draw.js';

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

    g.fillStyle = C.bg;
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    // wallpaper grid
    g.strokeStyle = 'rgba(237,232,223,0.03)';
    g.lineWidth = 1;
    for (let x = 0; x < SCREEN_W; x += 48) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, SCREEN_H);
      g.stroke();
    }
    for (let y = 0; y < SCREEN_H; y += 48) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(SCREEN_W, y);
      g.stroke();
    }

    this.drawTopBar(g, s);
    this.drawChat(g, s);
    this.drawInspector(g, s, hit);

    g.drawImage(this.vignette, 0, 0);
  }

  drawTopBar(g, s) {
    g.fillStyle = 'rgba(8,8,10,0.94)';
    g.fillRect(0, 0, SCREEN_W, 44);
    g.fillStyle = C.line;
    g.fillRect(0, 44, SCREEN_W, 1);
    text(g, 'neural.os', 24, 30, { size: 20, weight: 600, family: MONO, color: C.ink });
    const stage = STAGES[s.stage];
    text(g, `model: toy-llm-32d  ·  ${s.S.stages[stage.id].title}`, SCREEN_W / 2, 30, { size: 19, family: MONO, color: C.dim, align: 'center' });
    const now = new Date();
    const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    text(g, clock, SCREEN_W - 24, 30, { size: 20, family: MONO, align: 'right' });
    text(g, 'wifi  ·  76%', SCREEN_W - 110, 30, { size: 18, family: MONO, color: C.dim, align: 'right' });
  }

  windowFrame(g, R, title, accent) {
    fillRR(g, R.x, R.y, R.w, R.h, 10, 'rgba(17,16,21,0.97)');
    strokeRR(g, R.x, R.y, R.w, R.h, 10, C.line, 1.5);
    g.fillStyle = C.line;
    g.fillRect(R.x, R.y + 52, R.w, 1.5);
    g.strokeStyle = withAlpha(C.dim, 0.6);
    g.lineWidth = 1.5;
    [0, 1, 2].forEach((i) => {
      g.beginPath();
      g.arc(R.x + 26 + i * 22, R.y + 26, 6, 0, Math.PI * 2);
      g.stroke();
    });
    // the window's accent survives as a thin rule under the title bar
    g.fillStyle = withAlpha(accent, 0.7);
    g.fillRect(R.x + 24, R.y + 51, 56, 2.5);
    text(g, title, R.x + 104, R.y + 33, { size: 20, family: MONO, color: C.dim });
  }

  drawChat(g, s) {
    const R = CHAT;
    const S = s.S.screen;
    this.windowFrame(g, R, `${S.chat}.app`, C.violet);
    const p = s.pipeline;
    const inner = { x: R.x + 22, y: R.y + 74, w: R.w - 44, h: R.h - 190 };

    let y = inner.y + 10;
    const sent = s.stage > 0 && p.prompt;
    if (!sent) {
      text(g, s.lang === 'en' ? 'How can I help you?' : '¿En qué puedo ayudarte?', R.x + R.w / 2, R.y + R.h / 2 - 60, {
        size: 46,
        family: SERIF,
        color: C.dim,
        align: 'center',
      });
    } else {
      // user bubble
      font(g, 24, 400, SANS);
      const lines = wrap(g, p.prompt, inner.w - 120);
      const bw = Math.min(inner.w - 60, Math.max(...lines.map((l) => g.measureText(l).width)) + 40);
      const bh = lines.length * 32 + 30;
      text(g, S.you, inner.x + inner.w, y + 10, { size: 16, family: MONO, color: C.dim, align: 'right' });
      y += 22;
      fillRR(g, inner.x + inner.w - bw, y, bw, bh, 12, 'rgba(237,232,223,0.11)');
      lines.forEach((l, i) => text(g, l, inner.x + inner.w - bw + 20, y + 38 + i * 32, { size: 24 }));
      y += bh + 30;

      // assistant bubble
      text(g, S.assistant, inner.x, y + 10, { size: 16, family: MONO, color: C.accent });
      y += 22;
      const generating = s.stage >= 9;
      if (!generating) {
        fillRR(g, inner.x, y, 190, 60, 12, 'rgba(255,255,255,0.05)');
        for (let i = 0; i < 3; i++) {
          const a = 0.3 + 0.7 * Math.max(0, Math.sin(s.t * 5 - i * 0.7));
          g.fillStyle = withAlpha(C.ink, a);
          g.beginPath();
          g.arc(inner.x + 34 + i * 26, y + 30, 8, 0, Math.PI * 2);
          g.fill();
        }
        text(g, S.thinking, inner.x + 118, y + 37, { size: 18, family: MONO, color: C.dim });
      } else {
        font(g, 24, 400, SANS);
        const caret = s.stage === 9 && Math.floor(s.t * 3) % 2 === 0 ? '▌' : '';
        const out = wrap(g, p.outputText + caret, inner.w - 60);
        const maxLines = Math.floor((inner.y + inner.h - y - 30) / 32);
        const shown = out.slice(Math.max(0, out.length - maxLines));
        const bh2 = shown.length * 32 + 30;
        fillRR(g, inner.x, y, inner.w - 20, bh2, 12, 'rgba(255,255,255,0.05)');
        shown.forEach((l, i) => text(g, l, inner.x + 20, y + 38 + i * 32, { size: 24 }));
      }
    }

    // input box
    const ib = { x: R.x + 22, y: R.y + R.h - 96, w: R.w - 44, h: 70 };
    const active = s.stage === 0;
    fillRR(g, ib.x, ib.y, ib.w, ib.h, 10, 'rgba(255,255,255,0.03)');
    strokeRR(g, ib.x, ib.y, ib.w, ib.h, 10, active ? withAlpha(C.ink, 0.45) : C.line, 1.5);
    if (active) {
      const caret = Math.floor(s.t * 2.5) % 2 === 0 ? '▌' : ' ';
      font(g, 24, 400, SANS);
      let shown = s.typed;
      while (shown && g.measureText(shown + caret).width > ib.w - 90) shown = shown.slice(1);
      text(g, s.typed ? shown + caret : caret, ib.x + 22, ib.y + 44, { size: 24, color: s.typed ? C.ink : C.dim });
      if (!s.typed) text(g, s.S.placeholder, ib.x + 46, ib.y + 44, { size: 22, color: C.faint });
      fillRR(g, ib.x + ib.w - 58, ib.y + 13, 44, 44, 8, s.typed ? C.ink : 'rgba(255,255,255,0.08)');
      text(g, '↑', ib.x + ib.w - 36, ib.y + 46, { size: 26, weight: 600, align: 'center', color: s.typed ? C.bg : C.dim });
    } else {
      text(g, `✓ ${S.sent}`, ib.x + 22, ib.y + 44, { size: 22, family: MONO, color: C.dim });
    }
  }

  drawInspector(g, s, hit) {
    const R = INSPECT;
    const stage = STAGES[s.stage];
    const n = String(s.stage + 1).padStart(2, '0');
    this.windowFrame(g, R, `model.inspect()  —  ${n}/${STAGES.length}`, C.cyan);
    text(g, s.S.stages[stage.id].title, R.x + R.w - 28, R.y + 38, { size: 36, family: SERIF, color: C.ink, align: 'right' });

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

export { SANS, MONO, SERIF };
