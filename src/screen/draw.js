// macOS system fonts (SF Pro / SF Mono); Inter and Roboto Mono stand in elsewhere
export const SANS = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', 'Helvetica Neue', sans-serif";
export const DISPLAY = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Helvetica Neue', sans-serif";
export const MONO = "ui-monospace, 'SF Mono', Menlo, 'Roboto Mono', monospace";

export const C = {
  bg: '#1e1e20',
  panel: '#2a2a2d',
  panel2: '#323236',
  line: 'rgba(255,255,255,0.1)',
  ink: '#f5f5f7',
  dim: '#98989d',
  faint: '#5a5a5f',
  accent: '#0a84ff',
  violet: '#b26bff',
  cyan: '#25f4ee',
  pink: '#ff4fd8',
  amber: '#ffb547',
  green: '#6bffb0',
  blue: '#5b8cff',
};

export const TOKEN_COLORS = ['#b26bff', '#25f4ee', '#ff4fd8', '#ffb547', '#6bffb0', '#5b8cff', '#ff7a6b'];
export const tokenColor = (i) => TOKEN_COLORS[i % TOKEN_COLORS.length];

export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeInOut = (x) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const lerp = (a, b, t) => a + (b - a) * t;

export function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

export function fillRR(g, x, y, w, h, r, fill) {
  rrect(g, x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
}

export function strokeRR(g, x, y, w, h, r, stroke, width = 1.5) {
  rrect(g, x, y, w, h, r);
  g.strokeStyle = stroke;
  g.lineWidth = width;
  g.stroke();
}

export function font(g, size, weight = 400, family = SANS) {
  g.font = `${weight} ${size}px ${family}`;
}

export function text(g, str, x, y, { size = 22, weight = 400, family = SANS, color = C.ink, align = 'left', base = 'alphabetic', alpha = 1 } = {}) {
  font(g, size, weight, family);
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = base;
  g.globalAlpha = alpha;
  g.fillText(str, x, y);
  g.globalAlpha = 1;
}

/** Word-wrap honouring explicit newlines. Returns the lines. */
export function wrap(g, str, maxWidth) {
  const out = [];
  for (const para of String(str).split('\n')) {
    const words = para.split(/(\s+)/);
    let line = '';
    for (const w of words) {
      const test = line + w;
      if (g.measureText(test).width > maxWidth && line.trim()) {
        out.push(line.trimEnd());
        line = w.trimStart();
        // hard-break very long words
        while (g.measureText(line).width > maxWidth) {
          let cut = line.length - 1;
          while (cut > 1 && g.measureText(line.slice(0, cut)).width > maxWidth) cut--;
          out.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

export function glow(g, color, blur, fn) {
  g.save();
  g.shadowColor = color;
  // kept subtle on purpose: highlights, not neon
  g.shadowBlur = blur * 0.4;
  fn();
  g.restore();
}

/** Diverging colour for a vector component: blue (−) → dark → amber (+). */
export function valueColor(v, alpha = 1) {
  const a = Math.min(1, Math.abs(v) * 2.6);
  if (v >= 0) return `rgba(255,${Math.round(150 + 40 * (1 - a))},${Math.round(60 + 60 * (1 - a))},${(0.12 + a * 0.88) * alpha})`;
  return `rgba(${Math.round(80 + 20 * (1 - a))},${Math.round(130 + 30 * (1 - a))},255,${(0.12 + a * 0.88) * alpha})`;
}

export function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** A token chip. Returns its width. */
export function chip(g, label, x, y, color, { size = 26, pad = 12, h = size * 1.7, alpha = 1, scale = 1, glowAmt = 0 } = {}) {
  font(g, size, 600, MONO);
  const w = g.measureText(label).width + pad * 2;
  if (alpha <= 0) return w;
  g.save();
  g.globalAlpha = alpha;
  g.translate(x + w / 2, y + h / 2);
  g.scale(scale, scale);
  if (glowAmt > 0) {
    g.shadowColor = color;
    g.shadowBlur = 24 * glowAmt;
  }
  fillRR(g, -w / 2, -h / 2, w, h, 8, withAlpha(color, 0.2));
  g.shadowBlur = 0;
  strokeRR(g, -w / 2, -h / 2, w, h, 8, withAlpha(color, 0.85), 2);
  g.fillStyle = C.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, 0, 1);
  g.restore();
  return w;
}

export function chipWidth(g, label, size = 26, pad = 12) {
  font(g, size, 600, MONO);
  return g.measureText(label).width + pad * 2;
}
