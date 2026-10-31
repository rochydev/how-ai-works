import { showToken } from '../ai/tokenizer.js';
import { CLUSTERS, mapPosition, seeded, DIM } from '../ai/model.js';
import {
  C,
  MONO,
  SANS,
  text,
  font,
  wrap,
  fillRR,
  strokeRR,
  chip,
  chipWidth,
  tokenColor,
  withAlpha,
  valueColor,
  easeOut,
  easeInOut,
  clamp01,
  glow,
  lerp,
} from './draw.js';

/**
 * One renderer per pipeline stage. Each receives the 2D context, the
 * content rectangle R = {x, y, w, h}, the shared state `s`, and `hit`
 * to register interactive regions on the monitor.
 */

const smooth = new Map();
function approach(key, target, rate = 0.15) {
  const v = smooth.has(key) ? smooth.get(key) : target;
  const n = lerp(v, target, rate);
  smooth.set(key, n);
  return n;
}

function layoutChips(g, labels, R, { size = 26, gap = 12, lineGap = 16, maxRows = 99 } = {}) {
  const h = size * 1.7;
  const pos = [];
  let x = R.x;
  let y = R.y;
  let rows = 1;
  for (const label of labels) {
    const w = chipWidth(g, label, size);
    if (x + w > R.x + R.w && x > R.x) {
      x = R.x;
      y += h + lineGap;
      rows++;
    }
    pos.push({ x, y, w, h, hidden: rows > maxRows });
    x += w + gap;
  }
  return { pos, height: y + h - R.y };
}

function emptyState(g, R, s) {
  const blink = Math.floor(s.t * 2) % 2 === 0;
  text(g, `${blink ? '▌' : ' '} ${s.S.screen.waiting}…`, R.x + R.w / 2, R.y + R.h / 2, {
    size: 40,
    family: MONO,
    color: C.dim,
    align: 'center',
  });
}

// ---------------------------------------------------------------------------
export function viewPrompt(g, R, s) {
  const str = s.typed;
  text(g, s.S.screen.bytes, R.x, R.y + 28, { size: 26, color: C.dim });
  if (!str) return emptyState(g, R, s);
  const enc = new TextEncoder();
  const cw = 70;
  const ch = 104;
  const cols = Math.floor(R.w / (cw + 8));
  const chars = [...str];
  const maxCells = cols * 6;
  const start = Math.max(0, chars.length - maxCells);
  chars.slice(start).forEach((c, k) => {
    const i = start + k;
    const col = k % cols;
    const row = Math.floor(k / cols);
    const x = R.x + col * (cw + 8);
    const y = R.y + 70 + row * (ch + 14);
    const isNew = i === chars.length - 1;
    const color = isNew ? C.cyan : C.violet;
    fillRR(g, x, y, cw, ch, 10, withAlpha(color, isNew ? 0.22 : 0.1));
    strokeRR(g, x, y, cw, ch, 10, withAlpha(color, isNew ? 0.9 : 0.35), 1.5);
    text(g, c === ' ' ? '␣' : c, x + cw / 2, y + 48, { size: 36, family: MONO, weight: 600, align: 'center' });
    const bytes = [...enc.encode(c)];
    const code = bytes.length === 1 ? String(bytes[0]) : bytes.map((b) => b.toString(16).toUpperCase()).join(' ');
    text(g, code, x + cw / 2, y + 86, { size: bytes.length > 2 ? 12 : bytes.length > 1 ? 15 : 20, family: MONO, color: C.cyan, align: 'center' });
  });
  const total = enc.encode(str).length;
  text(g, `${chars.length} ${s.S.screen.chars} · ${total} bytes`, R.x, R.y + R.h - 10, { size: 26, family: MONO, color: C.amber });
}

// ---------------------------------------------------------------------------
export function viewTokens(g, R, s) {
  const p = s.pipeline;
  const st = s.stageTime;
  // raw text
  font(g, 30, 400, MONO);
  const lines = wrap(g, p.prompt, R.w);
  lines.slice(0, 3).forEach((l, i) => text(g, l, R.x, R.y + 36 + i * 40, { size: 30, family: MONO, color: C.dim }));
  const top = R.y + 40 + Math.min(lines.length, 3) * 40 + 30;
  text(g, '↓  tokenizer', R.x, top, { size: 24, family: MONO, color: C.violet });

  const labels = p.tokens.map((t) => showToken(t.text));
  const area = { x: R.x, y: top + 34, w: R.w, h: R.h - (top - R.y) - 150 };
  const size = labels.length > 40 ? 20 : labels.length > 16 ? 28 : 40;
  const { pos } = layoutChips(g, labels, area, { size, maxRows: Math.floor(area.h / (size * 1.7 + 16)) });
  const shown = st * 5;
  pos.forEach((q, i) => {
    if (q.hidden) return;
    const k = clamp01(shown - i);
    if (k <= 0) return;
    chip(g, labels[i], q.x, q.y, tokenColor(i), { size, alpha: k, scale: 0.6 + 0.4 * easeOut(k), glowAmt: k < 1 ? 1 - k : 0 });
  });

  const n = Math.min(p.tokens.length, Math.floor(shown));
  const chars = [...p.prompt].length;
  const by = R.y + R.h - 40;
  const stat = (value, label, x, color) => {
    text(g, String(value), x, by, { size: 56, weight: 700, color });
    text(g, label, x, by + 32, { size: 20, color: C.dim });
  };
  stat(n, s.S.screen.tokens, R.x, C.cyan);
  stat(chars, s.S.screen.chars, R.x + 220, C.violet);
  stat(n ? (chars / Math.max(n, 1)).toFixed(1) : '—', s.S.screen.ratio, R.x + 440, C.amber);
}

// ---------------------------------------------------------------------------
const SYL = ['ab', 'ion', 'er', 'ta', 'ment', 'ul', 'ing', 'ra', 'pre', 'os', 'ci', 'la', 'que', 'th', 'ver', 'ad', 'es', 'ly', 'on', 'man'];
function fakeToken(id) {
  const r = seeded(id * 31 + 7);
  const n = 1 + Math.floor(r() * 2);
  let str = r() > 0.5 ? '·' : '';
  for (let i = 0; i < n; i++) str += SYL[Math.floor(r() * SYL.length)];
  return str;
}

export function viewIds(g, R, s) {
  const p = s.pipeline;
  const st = s.stageTime;
  const listW = 360;
  const area = { x: R.x, y: R.y + 10, w: R.w - listW - 40, h: R.h - 20 };
  const size = p.tokens.length > 30 ? 18 : 24;
  // cards: token on top, id below
  let x = area.x;
  let y = area.y;
  const cardH = size * 3.6;
  const lookupIdx = Math.floor(st / 0.45) % Math.max(p.tokens.length, 1);
  p.tokens.forEach((t, i) => {
    const label = showToken(t.text);
    font(g, size, 600, MONO);
    const w = Math.max(g.measureText(label).width, g.measureText(String(t.id)).width) + 26;
    if (x + w > area.x + area.w) {
      x = area.x;
      y += cardH + 14;
    }
    if (y + cardH > area.y + area.h) return;
    const k = easeOut(clamp01(st * 2.2 - i * 0.12));
    const col = tokenColor(i);
    const active = i === lookupIdx;
    if (active) glow(g, col, 26, () => fillRR(g, x, y, w, cardH, 10, withAlpha(col, 0.28)));
    else fillRR(g, x, y, w, cardH, 10, withAlpha(col, 0.12));
    strokeRR(g, x, y, w, cardH, 10, withAlpha(col, active ? 1 : 0.5), active ? 2.5 : 1.5);
    text(g, label, x + w / 2, y + size * 1.3, { size, family: MONO, weight: 600, align: 'center' });
    const shownId = k < 1 ? Math.floor(t.id * k + seeded(i + Math.floor(st * 20))() * 900 * (1 - k)) : t.id;
    text(g, String(shownId), x + w / 2, y + size * 2.9, { size: size + 2, family: MONO, weight: 800, color: C.cyan, align: 'center' });
    x += w + 12;
  });

  // vocabulary lookup panel
  const lx = R.x + R.w - listW;
  fillRR(g, lx, R.y, listW, R.h, 14, 'rgba(10,9,24,0.9)');
  strokeRR(g, lx, R.y, listW, R.h, 14, C.line, 1.5);
  text(g, `vocab.json · ${s.S.screen.lookup}`, lx + 18, R.y + 36, { size: 18, family: MONO, color: C.dim });
  const tok = p.tokens[lookupIdx];
  if (!tok) return;
  const rowH = 38;
  const rows = Math.floor((R.h - 80) / rowH);
  const mid = Math.floor(rows / 2);
  for (let r = 0; r < rows; r++) {
    const id = tok.id - mid + r;
    if (id < 0) continue;
    const yy = R.y + 70 + r * rowH;
    const isHit = r === mid;
    if (isHit) glow(g, C.cyan, 20, () => fillRR(g, lx + 10, yy - 4, listW - 20, rowH - 4, 8, withAlpha(C.cyan, 0.25)));
    text(g, String(id).padStart(6, ' '), lx + 22, yy + 24, { size: 20, family: MONO, color: isHit ? C.cyan : C.faint });
    text(g, `"${isHit ? showToken(tok.text) : fakeToken(id)}"`, lx + 130, yy + 24, {
      size: 20,
      family: MONO,
      weight: isHit ? 700 : 400,
      color: isHit ? C.ink : C.dim,
    });
  }
}

// ---------------------------------------------------------------------------
let backgroundDots = null;
function vocabDots() {
  if (backgroundDots) return backgroundDots;
  const r = seeded(77);
  backgroundDots = [];
  for (let i = 0; i < 260; i++) {
    const c = Math.floor(r() * (CLUSTERS.length + 1));
    if (c < CLUSTERS.length) {
      const C0 = CLUSTERS[c];
      backgroundDots.push({ x: C0.x + (r() - 0.5) * 0.24, y: C0.y + (r() - 0.5) * 0.22, c });
    } else backgroundDots.push({ x: 0.05 + r() * 0.9, y: 0.08 + r() * 0.84, c: -1 });
  }
  return backgroundDots;
}

export function viewEmbeddings(g, R, s) {
  const p = s.pipeline;
  const st = s.stageTime;
  const tableW = R.w * 0.56;
  const maxRows = 13;
  const rows = p.tokens.slice(0, maxRows);
  const labelW = 150;
  const cell = (tableW - labelW) / DIM;
  const rowH = Math.min(52, (R.h - 70) / Math.max(rows.length, 1));
  const realDims = s.lang === 'en' ? '(×128 in real models)' : '(×128 en modelos reales)';
  text(g, `${DIM} ${s.S.screen.dims} ${realDims}`, R.x, R.y + 26, { size: 20, family: MONO, color: C.dim });
  rows.forEach((t, i) => {
    const y = R.y + 50 + i * rowH;
    text(g, showToken(t.text).slice(0, 10), R.x, y + rowH * 0.62, { size: Math.min(24, rowH * 0.5), family: MONO, weight: 600, color: tokenColor(i) });
    const e = p.embeddings[i];
    for (let d = 0; d < DIM; d++) {
      const k = clamp01(st * 3 - i * 0.18 - d * 0.02);
      if (k <= 0) continue;
      g.fillStyle = valueColor(e[d], k);
      g.fillRect(R.x + labelW + d * cell, y + 4, cell - 2, rowH - 8);
    }
  });
  if (p.tokens.length > maxRows) {
    text(g, `+${p.tokens.length - maxRows} …`, R.x, R.y + 60 + maxRows * rowH, { size: 20, family: MONO, color: C.dim });
  }
  // legend
  const ly = R.y + R.h - 8;
  const grad = g.createLinearGradient(R.x + labelW, 0, R.x + labelW + 260, 0);
  grad.addColorStop(0, 'rgb(90,140,255)');
  grad.addColorStop(0.5, 'rgb(30,28,60)');
  grad.addColorStop(1, 'rgb(255,180,70)');
  g.fillStyle = grad;
  g.fillRect(R.x + labelW, ly - 16, 260, 12);
  text(g, '−', R.x + labelW - 18, ly - 4, { size: 20, family: MONO, color: C.blue });
  text(g, '+', R.x + labelW + 270, ly - 4, { size: 20, family: MONO, color: C.amber });

  // meaning map
  const M = { x: R.x + tableW + 40, y: R.y, w: R.w - tableW - 40, h: R.h };
  fillRR(g, M.x, M.y, M.w, M.h, 16, 'rgba(10,9,24,0.9)');
  strokeRR(g, M.x, M.y, M.w, M.h, 16, C.line, 1.5);
  text(g, s.S.screen.mapTitle, M.x + 18, M.y + 34, { size: 18, family: MONO, color: C.dim });
  const px = (u) => M.x + 24 + u * (M.w - 48);
  const py = (v) => M.y + 60 + v * (M.h - 90);
  for (const d of vocabDots()) {
    g.fillStyle = d.c >= 0 ? withAlpha(tokenColor(d.c), 0.28) : 'rgba(140,137,184,0.18)';
    g.beginPath();
    g.arc(px(d.x), py(d.y), 3, 0, Math.PI * 2);
    g.fill();
  }
  CLUSTERS.forEach((c, i) => {
    text(g, s.S.screen.clusters[c.id], px(c.x), py(c.y) - 46, { size: 17, family: SANS, color: withAlpha(tokenColor(i), 0.85), align: 'center' });
  });
  p.tokens.forEach((t, i) => {
    const k = easeOut(clamp01(st * 1.5 - 0.8 - i * 0.1));
    if (k <= 0) return;
    const m = mapPosition(t);
    const x = px(m.x);
    const y = py(m.y);
    const col = tokenColor(i);
    glow(g, col, 18, () => {
      g.fillStyle = col;
      g.beginPath();
      g.arc(x, y, 7 * k, 0, Math.PI * 2);
      g.fill();
    });
    text(g, showToken(t.text), x + 10, y - 10, { size: 18, family: MONO, weight: 600, alpha: k });
  });
}

// ---------------------------------------------------------------------------
export function viewPosition(g, R, s) {
  const p = s.pipeline;
  const st = s.stageTime;
  const n = Math.min(p.tokens.length, 16);
  const waveH = R.h * 0.42;
  text(g, s.S.screen.waves, R.x, R.y + 24, { size: 20, family: MONO, color: C.dim });
  const top = R.y + 50;
  const colW = R.w / Math.max(n, 1);
  const freqs = [0, 1, 2, 4, 6, 9];
  const band = (waveH - 50) / freqs.length;
  // token columns
  for (let i = 0; i < n; i++) {
    const x = R.x + colW * (i + 0.5);
    g.strokeStyle = 'rgba(178,107,255,0.12)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, top);
    g.lineTo(x, top + waveH - 40);
    g.stroke();
    text(g, `${i}`, x, top + waveH - 14, { size: 16, family: MONO, color: C.dim, align: 'center' });
  }
  const sweep = clamp01(st / 2.5);
  freqs.forEach((fi, k) => {
    const cy = top + band * (k + 0.5);
    const freq = 1 / Math.pow(10000, fi / DIM);
    const col = tokenColor(k + 1);
    g.strokeStyle = withAlpha(col, 0.85);
    g.lineWidth = 2;
    g.beginPath();
    const steps = 200;
    for (let j = 0; j <= steps * sweep; j++) {
      const pos = (j / steps) * n - 0.5;
      const x = R.x + (j / steps) * R.w;
      const y = cy - Math.sin(pos * freq + st * 0.3 * (k === 0 ? 1 : 0)) * band * 0.38;
      j === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
    for (let i = 0; i < n; i++) {
      if ((i + 0.5) / n > sweep) break;
      const x = R.x + colW * (i + 0.5);
      const y = cy - Math.sin(i * freq) * band * 0.38;
      g.fillStyle = col;
      g.beginPath();
      g.arc(x, y, 4, 0, Math.PI * 2);
      g.fill();
    }
  });

  // embedding + position = input
  const by = R.y + waveH + 40;
  text(g, s.S.screen.plus, R.x, by, { size: 20, family: MONO, color: C.dim });
  const rows = p.tokens.slice(0, 7);
  const rowH = Math.min(56, (R.h - waveH - 70) / Math.max(rows.length, 1));
  const labelW = 130;
  const stripW = (R.w - labelW - 120) / 3;
  const cell = stripW / DIM;
  rows.forEach((t, i) => {
    const y = by + 20 + i * rowH;
    const k = clamp01(st * 1.4 - 1 - i * 0.15);
    text(g, showToken(t.text).slice(0, 9), R.x, y + rowH * 0.6, { size: 20, family: MONO, weight: 600, color: tokenColor(i) });
    const strips = [p.embeddings[i], p.positions[i], p.hidden[i]];
    strips.forEach((vec, sIdx) => {
      const sx = R.x + labelW + sIdx * (stripW + 60);
      const a = sIdx === 2 ? k : 1;
      for (let d = 0; d < DIM; d++) {
        g.fillStyle = valueColor(sIdx === 1 ? vec[d] * 0.4 : vec[d], a);
        g.fillRect(sx + d * cell, y + 6, cell - 1.5, rowH - 14);
      }
      if (sIdx < 2) text(g, sIdx === 0 ? '+' : '=', sx + stripW + 30, y + rowH * 0.62, { size: 28, weight: 700, color: C.ink, align: 'center' });
    });
  });
}

// ---------------------------------------------------------------------------
export function viewAttention(g, R, s, hit) {
  const p = s.pipeline;
  const W = p.attention[s.head];
  const n = p.tokens.length;
  const maxN = 16;
  const off = Math.max(0, n - maxN);
  const idx = [...Array(Math.min(n, maxN)).keys()].map((i) => i + off);

  // head selector
  let hx = R.x;
  s.S.heads.forEach((name, h) => {
    const label = `${s.S.head} ${h + 1} · ${name}`;
    font(g, 20, 600, SANS);
    const w = g.measureText(label).width + 32;
    const active = h === s.head;
    fillRR(g, hx, R.y, w, 42, 21, active ? withAlpha(C.cyan, 0.25) : 'rgba(255,255,255,0.04)');
    strokeRR(g, hx, R.y, w, 42, 21, active ? C.cyan : C.line, 1.5);
    text(g, label, hx + w / 2, R.y + 28, { size: 20, weight: 600, align: 'center', color: active ? C.ink : C.dim });
    hit({ x: hx, y: R.y, w, h: 42, onClick: () => s.actions.setHead(h) });
    hx += w + 12;
  });

  const focus = s.focus;
  const top = R.y + 80;
  const L = { x: R.x, y: top, w: R.w * 0.52, h: R.h - 90 };
  const rowH = Math.min(46, L.h / Math.max(idx.length, 1));
  const qx = L.x + 170;
  const kx = L.x + L.w - 170;
  text(g, 'Query', qx, top - 8, { size: 18, family: MONO, color: C.dim, align: 'right' });
  text(g, 'Key', kx, top - 8, { size: 18, family: MONO, color: C.dim });

  // faint lines for every pair, strong lines for the focused token
  idx.forEach((i, a) => {
    idx.forEach((j, b) => {
      const w = W[i][j];
      if (w < 0.02 || j > i) return;
      const strong = i === focus;
      g.strokeStyle = withAlpha(strong ? C.cyan : C.violet, strong ? 0.25 + w * 0.75 : w * 0.18);
      g.lineWidth = strong ? 1.5 + w * 12 : 1 + w * 3;
      g.beginPath();
      const y1 = top + a * rowH + rowH / 2;
      const y2 = top + b * rowH + rowH / 2;
      g.moveTo(qx + 10, y1);
      g.bezierCurveTo((qx + kx) / 2, y1, (qx + kx) / 2, y2, kx - 10, y2);
      g.stroke();
    });
  });
  idx.forEach((i, a) => {
    const y = top + a * rowH;
    const label = showToken(p.tokens[i].text).slice(0, 12);
    const isF = i === focus;
    const size = Math.min(22, rowH * 0.5);
    text(g, label, qx, y + rowH * 0.62, { size, family: MONO, weight: isF ? 800 : 500, color: isF ? C.cyan : C.ink, align: 'right' });
    hit({ x: L.x, y, w: 180, h: rowH, onHover: () => s.actions.setFocus(i) });
    const w = focus != null && i <= focus ? W[focus][i] : 0;
    text(g, label, kx, y + rowH * 0.62, { size, family: MONO, weight: 500, color: w > 0.15 ? C.ink : C.dim });
    if (focus != null && i <= focus) {
      text(g, `${Math.round(w * 100)}%`, kx + chipWidth(g, label, size, 0) + 14, y + rowH * 0.62, { size: 17, family: MONO, color: C.amber });
    }
  });

  // matrix
  const M = { x: R.x + R.w * 0.58, y: top, size: Math.min(R.w * 0.42, R.h - 130) };
  const cell = M.size / Math.max(idx.length, 1);
  text(g, s.S.screen.matrix, M.x, top - 8, { size: 18, family: MONO, color: C.dim });
  idx.forEach((i, a) => {
    idx.forEach((j, b) => {
      const x = M.x + b * cell;
      const y = M.y + a * cell;
      if (j > i) {
        g.fillStyle = 'rgba(255,255,255,0.025)';
        g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        return;
      }
      const w = W[i][j];
      g.fillStyle = `rgba(37,244,238,${0.06 + w * 0.94})`;
      g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    });
    if (i === focus) strokeRR(g, M.x - 2, M.y + a * cell - 1, cell * idx.length + 4, cell + 2, 4, C.amber, 2.5);
    hit({ x: M.x, y: M.y + a * cell, w: cell * idx.length, h: cell, onHover: () => s.actions.setFocus(i) });
  });
  text(g, `▨ ${s.S.screen.causal}`, M.x, M.y + M.size + 34, { size: 18, family: MONO, color: C.dim });
}

// ---------------------------------------------------------------------------
export function viewLayers(g, R, s) {
  const p = s.pipeline;
  const st = s.stageTime;
  const L = 6;
  const n = Math.min(p.tokens.length, 12);
  const left = R.x + 40;
  const width = R.w - 330;
  const topY = R.y + 70;
  const bottomY = R.y + R.h - 60;
  const blockH = (bottomY - topY) / L - 18;
  const lane = (i) => left + 40 + (i + 0.5) * ((width - 80) / Math.max(n, 1));
  const cycle = 3.2;
  const phase = (st % cycle) / cycle; // 0..1 bottom → top
  const activeLayer = Math.floor(phase * L);

  text(g, s.S.screen.input, left, bottomY + 44, { size: 20, family: MONO, color: C.dim });
  text(g, `↑ ${s.S.screen.finalVec}`, left, R.y + 30, { size: 20, family: MONO, color: C.dim });

  for (let l = 0; l < L; l++) {
    const y = bottomY - (l + 1) * (blockH + 18);
    const active = l === activeLayer;
    const glowA = active ? 1 : 0;
    const halfW = (width - 20) / 2;
    [s.S.screen.attn, s.S.screen.mlp].forEach((name, k) => {
      const x = left + k * (halfW + 20);
      const col = k === 0 ? C.cyan : C.pink;
      if (active) glow(g, col, 30, () => fillRR(g, x, y, halfW, blockH, 12, withAlpha(col, 0.18)));
      else fillRR(g, x, y, halfW, blockH, 12, withAlpha(col, 0.06));
      strokeRR(g, x, y, halfW, blockH, 12, withAlpha(col, 0.35 + glowA * 0.6), 1.5);
      text(g, name, x + 18, y + 30, { size: 20, weight: 600, color: withAlpha(col, 0.6 + glowA * 0.4) });
    });
    text(g, `${s.S.screen.layer} ${l + 1}`, left + width + 24, y + blockH / 2 + 8, {
      size: 22,
      family: MONO,
      weight: active ? 800 : 400,
      color: active ? C.ink : C.dim,
    });
  }
  // residual stream
  const rx = left + width + 150;
  g.strokeStyle = withAlpha(C.amber, 0.5);
  g.lineWidth = 3;
  g.setLineDash([8, 8]);
  g.lineDashOffset = -st * 40;
  g.beginPath();
  g.moveTo(rx, bottomY);
  g.lineTo(rx, topY - 10);
  g.stroke();
  g.setLineDash([]);
  text(g, s.S.screen.residual, rx + 14, (topY + bottomY) / 2, { size: 18, family: MONO, color: C.amber });

  // token lanes with pulses
  for (let i = 0; i < n; i++) {
    const x = lane(i);
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, bottomY + 10);
    g.lineTo(x, topY - 20);
    g.stroke();
    const y = lerp(bottomY + 10, topY - 20, (phase + i * 0.012) % 1);
    const col = tokenColor(i);
    glow(g, col, 20, () => {
      g.fillStyle = col;
      g.beginPath();
      g.arc(x, y, 6, 0, Math.PI * 2);
      g.fill();
    });
    text(g, showToken(p.tokens[i].text).slice(0, 6), x, bottomY + 20, { size: 15, family: MONO, color: C.dim, align: 'center', base: 'top' });
  }
  // final vector
  const last = p.hidden[p.hidden.length - 1];
  if (last) {
    const cw = 9;
    for (let d = 0; d < DIM; d++) {
      g.fillStyle = valueColor(last[(d + Math.floor(st * 3)) % DIM] * (0.6 + 0.4 * Math.sin(st + d)));
      g.fillRect(left + 400 + d * cw, R.y + 12, cw - 2, 24);
    }
  }
  text(g, s.S.screen.realModel, R.x + R.w, R.y + 30, { size: 18, family: SANS, color: C.amber, align: 'right' });
}

// ---------------------------------------------------------------------------
function contextTail(p, k = 4) {
  const ctx = [...p.tokens, ...p.generated];
  return ctx
    .slice(-k)
    .map((t) => t.text)
    .join('')
    .replace(/\n/g, ' ')
    .trim();
}

export function viewLogits(g, R, s) {
  const p = s.pipeline;
  const T = s.temperature;
  const cands = p.candidates(0);
  const probs = p.probabilities(T, 0);
  const rest = p.restMass(T);
  text(g, `${s.S.screen.nextFor} «…${contextTail({ tokens: p.tokens, generated: [] })}»`, R.x, R.y + 30, { size: 26, family: SANS, color: C.ink });
  text(g, 'p = softmax(logits / T)', R.x + R.w, R.y + 30, { size: 22, family: MONO, color: C.violet, align: 'right' });
  const top = R.y + 80;
  const rowH = 82;
  const labelW = 250;
  const barMax = R.w - labelW - 230;
  cands.forEach((c, i) => {
    const y = top + i * rowH;
    const pr = approach(`lg${i}`, probs[i] * (1 - rest));
    const col = c.eos ? C.amber : tokenColor(i);
    text(g, c.eos ? c.text : `"${showToken(c.text)}"`, R.x + labelW - 20, y + 44, { size: 28, family: MONO, weight: 700, align: 'right' });
    fillRR(g, R.x + labelW, y + 14, barMax, 44, 10, 'rgba(255,255,255,0.04)');
    const w = Math.max(4, barMax * pr);
    glow(g, col, i === 0 ? 24 : 8, () => fillRR(g, R.x + labelW, y + 14, w, 44, 10, withAlpha(col, 0.75)));
    text(g, `${(pr * 100).toFixed(1)}%`, R.x + labelW + barMax + 20, y + 46, { size: 30, family: MONO, weight: 800, color: C.ink });
    text(g, `logit ${c.logit.toFixed(2)}`, R.x + labelW + barMax + 20, y + 72, { size: 15, family: MONO, color: C.dim });
  });
  const ry = top + cands.length * rowH;
  text(g, `… ${s.S.screen.rest} (100.250)`, R.x + labelW - 20, ry + 44, { size: 22, family: MONO, color: C.dim, align: 'right' });
  fillRR(g, R.x + labelW, ry + 18, Math.max(4, barMax * approach('rest', rest)), 36, 8, 'rgba(140,137,184,0.35)');
  text(g, `${(approach('rest2', rest) * 100).toFixed(1)}%`, R.x + labelW + barMax + 20, ry + 46, { size: 24, family: MONO, color: C.dim });

  // temperature gauge
  const gy = R.y + R.h - 40;
  const gx = R.x + labelW;
  const gw = barMax;
  fillRR(g, gx, gy - 8, gw, 16, 8, 'rgba(255,255,255,0.06)');
  const tNorm = clamp01(T / 2);
  const grad = g.createLinearGradient(gx, 0, gx + gw, 0);
  grad.addColorStop(0, C.blue);
  grad.addColorStop(0.5, C.violet);
  grad.addColorStop(1, '#ff5a5a');
  fillRR(g, gx, gy - 8, Math.max(16, gw * tNorm), 16, 8, grad);
  glow(g, C.ink, 16, () => {
    g.fillStyle = C.ink;
    g.beginPath();
    g.arc(gx + gw * tNorm, gy, 14, 0, Math.PI * 2);
    g.fill();
  });
  text(g, `${s.S.screen.temp}`, gx - 20, gy + 8, { size: 22, family: SANS, color: C.dim, align: 'right' });
  text(g, `T = ${T.toFixed(2)}`, gx + gw + 20, gy + 10, { size: 30, family: MONO, weight: 800, color: T < 0.05 ? C.blue : T > 1.3 ? '#ff6b6b' : C.ink });
  if (T < 0.05) text(g, s.S.screen.greedy, gx, gy - 24, { size: 18, family: MONO, color: C.blue });
}

// ---------------------------------------------------------------------------
export function viewSampling(g, R, s) {
  const p = s.pipeline;
  const rec = p.history[0];
  if (!rec) return;
  const st = s.stageTime;
  const probs = rec.probs;
  const cands = rec.candidates;
  const bx = R.x + 20;
  const bw = R.w - 40;
  const by = R.y + 170;
  const bh = 120;
  text(g, 'top-k = 6', R.x + 20, R.y + 40, { size: 24, family: MONO, color: C.violet });
  text(g, `T = ${s.temperature.toFixed(2)}`, R.x + R.w - 20, R.y + 40, { size: 24, family: MONO, color: C.dim, align: 'right' });

  let acc = 0;
  cands.forEach((c, i) => {
    const w = probs[i] * bw;
    const x = bx + acc * bw;
    const col = c.eos ? C.amber : tokenColor(i);
    const chosen = i === rec.chosen && st > 3.3;
    if (chosen) glow(g, col, 40, () => fillRR(g, x + 2, by, Math.max(w - 4, 2), bh, 10, withAlpha(col, 0.85)));
    else fillRR(g, x + 2, by, Math.max(w - 4, 2), bh, 10, withAlpha(col, 0.45));
    if (w > 70) {
      text(g, showToken(c.text), x + w / 2, by + bh / 2 + 4, { size: w > 160 ? 30 : 20, family: MONO, weight: 700, align: 'center' });
      text(g, `${Math.round(probs[i] * 100)}%`, x + w / 2, by + bh / 2 + 36, { size: 18, family: MONO, color: C.ink, align: 'center', alpha: 0.75 });
    }
    acc += probs[i];
  });
  // ticks
  for (let k = 0; k <= 10; k++) {
    const x = bx + (k / 10) * bw;
    g.fillStyle = C.faint;
    g.fillRect(x - 1, by + bh + 10, 2, k % 5 === 0 ? 16 : 8);
    if (k % 5 === 0) text(g, (k / 10).toFixed(1), x, by + bh + 48, { size: 16, family: MONO, color: C.dim, align: 'center' });
  }
  // needle: spins over the bar a few times and decelerates onto the random number
  const spin = 3.2;
  const k = easeOut(st / spin);
  const travel = 3 + rec.random;
  const pos = (k * travel) % 1;
  const nx = bx + (st >= spin ? rec.random : pos) * bw;
  glow(g, C.ink, 20, () => {
    g.fillStyle = C.ink;
    g.beginPath();
    g.moveTo(nx, by - 6);
    g.lineTo(nx - 16, by - 34);
    g.lineTo(nx + 16, by - 34);
    g.closePath();
    g.fill();
    g.fillRect(nx - 2, by - 6, 4, bh + 12);
  });
  text(g, `${s.S.screen.roll}: ${(st >= spin ? rec.random : pos).toFixed(3)}`, Math.min(Math.max(nx, bx + 150), bx + bw - 150), by - 48, { size: 22, family: MONO, weight: 700, align: 'center' });

  if (st > spin + 0.1) {
    const a = easeOut((st - spin - 0.1) * 2);
    const c = cands[rec.chosen];
    const cy = by + bh + 130;
    text(g, `${s.S.screen.picked} →`, R.x + R.w / 2 - 20, cy + 50, { size: 30, align: 'right', alpha: a, color: C.dim });
    chip(g, showToken(c.text), R.x + R.w / 2, cy, c.eos ? C.amber : tokenColor(rec.chosen), { size: 48, alpha: a, scale: 0.7 + 0.3 * a, glowAmt: 1 });
    text(g, `id ${c.id}`, R.x + R.w / 2, cy + 130, { size: 22, family: MONO, color: C.cyan, alpha: a });
  }
}

// ---------------------------------------------------------------------------
export function viewGenerate(g, R, s) {
  const p = s.pipeline;
  const side = 400;
  const A = { x: R.x, y: R.y + 40, w: R.w - side - 40, h: R.h - 50 };
  text(g, s.S.screen.context, R.x, R.y + 22, { size: 20, family: MONO, color: C.dim });
  const all = [...p.tokens.map((t) => ({ t, gen: false })), ...p.generated.map((t) => ({ t, gen: true }))];
  const size = 22;
  const labels = all.map(({ t }) => showToken(t.text));
  const { pos, height } = layoutChips(g, labels, { ...A, y: 0 }, { size, gap: 8, lineGap: 10 });
  const scroll = Math.max(0, height - A.h);
  g.save();
  g.beginPath();
  g.rect(A.x - 10, A.y - 4, A.w + 20, A.h + 8);
  g.clip();
  pos.forEach((q, i) => {
    const y = A.y + q.y - approach('genScroll', scroll, 0.08);
    if (y < A.y - 50) return;
    const { gen } = all[i];
    const isLast = i === all.length - 1 && gen;
    chip(g, labels[i], q.x, y, gen ? tokenColor(i) : '#6d6a96', { size, alpha: gen ? 1 : 0.55, glowAmt: isLast ? 1 : 0 });
  });
  g.restore();

  // side panel: last step distribution
  const sx = R.x + R.w - side;
  fillRR(g, sx, R.y, side, R.h, 16, 'rgba(10,9,24,0.9)');
  strokeRR(g, sx, R.y, side, R.h, 16, C.line, 1.5);
  text(g, `${s.S.screen.step} ${p.history.length}`, sx + 24, R.y + 60, { size: 46, weight: 700 });
  const rec = p.history[p.history.length - 1];
  if (rec) {
    rec.candidates.slice(0, 5).forEach((c, i) => {
      const y = R.y + 100 + i * 64;
      const chosen = i === rec.chosen;
      const col = c.eos ? C.amber : tokenColor(i);
      const w = (side - 140) * rec.probs[i];
      fillRR(g, sx + 24, y + 28, side - 140, 14, 7, 'rgba(255,255,255,0.05)');
      fillRR(g, sx + 24, y + 28, Math.max(w, 4), 14, 7, withAlpha(col, chosen ? 0.95 : 0.45));
      text(g, showToken(c.text).slice(0, 14), sx + 24, y + 20, { size: 20, family: MONO, weight: chosen ? 800 : 400, color: chosen ? C.ink : C.dim });
      text(g, `${Math.round(rec.probs[i] * 100)}%`, sx + side - 24, y + 42, { size: 20, family: MONO, align: 'right', color: chosen ? C.ink : C.dim });
      if (chosen) text(g, '◀', sx + side - 80, y + 42, { size: 18, color: col });
    });
  }
  const stat = (v, label, y, col) => {
    text(g, String(v), sx + 24, y, { size: 40, weight: 700, color: col });
    text(g, label, sx + 24, y + 28, { size: 18, color: C.dim });
  };
  stat(p.generated.length, s.S.screen.generated, R.y + R.h - 150, C.cyan);
  stat(p.history.length, s.S.screen.passes, R.y + R.h - 60, C.violet);
  text(g, `T = ${s.temperature.toFixed(2)}`, sx + side - 24, R.y + 60, { size: 22, family: MONO, color: C.dim, align: 'right' });
}

// ---------------------------------------------------------------------------
export function viewAnswer(g, R, s) {
  const p = s.pipeline;
  const st = s.stageTime;
  const a = easeOut(st * 1.5);
  glow(g, C.green, 30, () => text(g, `✓ ${s.S.screen.done}`, R.x, R.y + 50, { size: 44, weight: 700, color: C.green, alpha: a }));
  const cards = [
    [p.tokens.length, s.S.screen.inTokens, C.violet],
    [p.generated.length, s.S.screen.outTokens, C.cyan],
    [p.history.length, s.S.screen.passes, C.pink],
    [`~${(p.history.length * 6 * 2 * 7e9 / 1e12).toFixed(1)}T`, s.lang === 'en' ? 'FLOPs (7B model)' : 'operaciones (modelo 7B)', C.amber],
  ];
  const cw = (R.w - 3 * 20) / 4;
  cards.forEach(([v, label, col], i) => {
    const x = R.x + i * (cw + 20);
    const y = R.y + 90;
    const k = easeOut(st * 2 - i * 0.2);
    fillRR(g, x, y, cw, 140, 16, withAlpha(col, 0.1 * k));
    strokeRR(g, x, y, cw, 140, 16, withAlpha(col, 0.6 * k), 1.5);
    text(g, String(v), x + 24, y + 74, { size: 52, weight: 700, color: col, alpha: k });
    text(g, label, x + 24, y + 112, { size: 19, color: C.dim, alpha: k });
  });
  const y0 = R.y + 290;
  text(g, s.S.screen.detok, R.x, y0, { size: 22, family: MONO, color: C.dim });
  font(g, 20, 400, MONO);
  const ids = `[${p.generated.map((t) => t.id).join(', ')}]`;
  const idLines = wrap(g, ids, R.w);
  idLines.slice(0, 4).forEach((l, i) => text(g, l, R.x, y0 + 40 + i * 30, { size: 20, family: MONO, color: C.cyan }));
  const ty = y0 + 60 + Math.min(idLines.length, 4) * 30;
  text(g, '↓', R.x, ty + 10, { size: 30, color: C.violet });
  font(g, 26, 400, SANS);
  const lines = wrap(g, p.outputText, R.w);
  lines.slice(0, 8).forEach((l, i) => text(g, l, R.x, ty + 60 + i * 36, { size: 26, color: C.ink }));
}

export const VIEWS = {
  prompt: viewPrompt,
  tokens: viewTokens,
  ids: viewIds,
  embeddings: viewEmbeddings,
  position: viewPosition,
  attention: viewAttention,
  layers: viewLayers,
  logits: viewLogits,
  sampling: viewSampling,
  generate: viewGenerate,
  answer: viewAnswer,
};
