import * as THREE from 'three';

/** Tiny seeded PRNG so procedural textures look identical on every load. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvasTexture(w, h, draw, { srgb = true, repeat = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

export function woodFloorTexture() {
  return canvasTexture(
    1024,
    1024,
    (g, w, h) => {
      const r = rng(7);
      const plankH = h / 8;
      for (let row = 0; row < 8; row++) {
        let x = -r() * 300;
        while (x < w) {
          const len = 260 + r() * 340;
          const tone = 34 + r() * 18;
          g.fillStyle = `hsl(${22 + r() * 8}, ${32 + r() * 10}%, ${tone * 0.45}%)`;
          g.fillRect(x, row * plankH, len, plankH);
          // grain
          for (let i = 0; i < 26; i++) {
            g.strokeStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`;
            g.lineWidth = 1 + r() * 2;
            g.beginPath();
            const y = row * plankH + r() * plankH;
            g.moveTo(x, y);
            g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 8, x + len * 0.6, y + (r() - 0.5) * 8, x + len, y);
            g.stroke();
          }
          g.fillStyle = 'rgba(0,0,0,0.55)';
          g.fillRect(x, row * plankH, 3, plankH);
          x += len;
        }
        g.fillStyle = 'rgba(0,0,0,0.6)';
        g.fillRect(0, row * plankH, w, 3);
      }
    },
    { repeat: [3, 2.5] },
  );
}

export function wallTexture(base = '#15142a') {
  return canvasTexture(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      const r = rng(3);
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = `rgba(255,255,255,${r() * 0.025})`;
        g.fillRect(r() * w, r() * h, 1.5, 1.5);
      }
      for (let i = 0; i < 4000; i++) {
        g.fillStyle = `rgba(0,0,0,${r() * 0.05})`;
        g.fillRect(r() * w, r() * h, 2, 2);
      }
    },
    { repeat: [3, 2] },
  );
}

/** Night skyline with lit windows, moon and a pink haze. */
export function skylineTexture() {
  return canvasTexture(1024, 768, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#04051a');
    sky.addColorStop(0.55, '#1b0f3d');
    sky.addColorStop(0.85, '#5a1e5e');
    sky.addColorStop(1, '#ff5ea8');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    const r = rng(11);
    // stars
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`;
      g.fillRect(r() * w, r() * h * 0.5, 1.6, 1.6);
    }
    // moon
    const mg = g.createRadialGradient(780, 150, 10, 780, 150, 120);
    mg.addColorStop(0, 'rgba(230,235,255,1)');
    mg.addColorStop(0.35, 'rgba(200,210,255,0.9)');
    mg.addColorStop(0.4, 'rgba(160,170,255,0.25)');
    mg.addColorStop(1, 'rgba(120,120,255,0)');
    g.fillStyle = mg;
    g.fillRect(600, 0, 400, 320);
    // buildings, three depth layers
    const layers = [
      { base: 0.5, var: 0.25, col: '#160d2c', win: 0.08 },
      { base: 0.62, var: 0.22, col: '#0e0820', win: 0.16 },
      { base: 0.75, var: 0.18, col: '#07040f', win: 0.22 },
    ];
    for (const L of layers) {
      let x = -20;
      while (x < w) {
        const bw = 40 + r() * 90;
        const top = h * (L.base + (r() - 0.5) * L.var);
        g.fillStyle = L.col;
        g.fillRect(x, top, bw, h - top);
        if (r() > 0.7) g.fillRect(x + bw * 0.45, top - 30, 3, 30); // antenna
        for (let wy = top + 8; wy < h - 6; wy += 11) {
          for (let wx = x + 5; wx < x + bw - 6; wx += 9) {
            if (r() < L.win) {
              const hue = r() > 0.75 ? '#ff9ef0' : r() > 0.5 ? '#9ff6ff' : '#ffd9a0';
              g.fillStyle = hue;
              g.globalAlpha = 0.5 + r() * 0.5;
              g.fillRect(wx, wy, 4, 5);
              g.globalAlpha = 1;
            }
          }
        }
        x += bw + 2;
      }
    }
  });
}

/** Rain streaks drawn on a transparent canvas, scrolled in the shader via offset. */
export function rainTexture() {
  return canvasTexture(
    256,
    512,
    (g, w, h) => {
      const r = rng(5);
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < 140; i++) {
        const x = r() * w;
        const y = r() * h;
        const len = 10 + r() * 30;
        g.strokeStyle = `rgba(190,210,255,${0.12 + r() * 0.25})`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - 2, y + len);
        g.stroke();
      }
    },
    { repeat: [2, 1] },
  );
}

export function neonSignTexture(text, sub) {
  return canvasTexture(1024, 384, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const draw = (str, y, font, color) => {
      g.font = font;
      g.shadowColor = color;
      for (const blur of [40, 22, 10]) {
        g.shadowBlur = blur;
        g.fillStyle = color;
        g.fillText(str, w / 2, y);
      }
      g.shadowBlur = 0;
      g.fillStyle = '#ffffff';
      g.globalAlpha = 0.45;
      g.fillText(str, w / 2, y);
      g.globalAlpha = 1;
    };
    draw(text, h * 0.42, "600 170px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Helvetica Neue', sans-serif", '#ff4fd8');
    if (sub) draw(sub, h * 0.82, "500 46px ui-monospace, 'SF Mono', Menlo, 'Roboto Mono', monospace", '#25f4ee');
  });
}

export function posterTexture(kind) {
  return canvasTexture(512, 720, (g, w, h) => {
    const r = rng(kind.length * 31);
    if (kind === 'attention') {
      g.fillStyle = '#f2ead8';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#16122a';
      g.font = "700 66px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Helvetica Neue', sans-serif";
      g.textAlign = 'left';
      ['Attention', 'is all', 'you need.'].forEach((l, i) => g.fillText(l, 36, 120 + i * 70));
      // attention-like arcs
      for (let i = 0; i < 26; i++) {
        g.strokeStyle = `rgba(${120 + r() * 130},${40 + r() * 60},${200 + r() * 55},${0.25 + r() * 0.5})`;
        g.lineWidth = 1 + r() * 6;
        g.beginPath();
        const a = 50 + r() * 410;
        const b = 50 + r() * 410;
        g.moveTo(a, 620);
        g.quadraticCurveTo((a + b) / 2, 620 - Math.abs(a - b) * 0.9 - 40, b, 620);
        g.stroke();
      }
      g.fillStyle = '#16122a';
      for (let i = 0; i < 10; i++) g.fillRect(48 + i * 44, 626, 30, 30);
      g.font = "500 20px ui-monospace, 'SF Mono', Menlo, 'Roboto Mono', monospace";
      g.fillText('Q · Kᵀ / √d', 36, 360);
    } else if (kind === 'synth') {
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#1a0638');
      sky.addColorStop(0.6, '#7a1d7a');
      sky.addColorStop(1, '#ff8a3d');
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      const sun = g.createLinearGradient(0, 160, 0, 460);
      sun.addColorStop(0, '#ffe066');
      sun.addColorStop(1, '#ff3d9a');
      g.fillStyle = sun;
      g.beginPath();
      g.arc(w / 2, 330, 150, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1a0638';
      for (let i = 0; i < 7; i++) g.fillRect(0, 330 + i * 22, w, 4 + i * 1.6);
      g.strokeStyle = '#25f4ee';
      g.lineWidth = 2;
      for (let i = 0; i <= 12; i++) {
        g.beginPath();
        g.moveTo(w / 2, 480);
        g.lineTo(-300 + i * 92, h);
        g.stroke();
      }
      for (let i = 0; i < 8; i++) {
        const y = 480 + Math.pow(i / 8, 1.8) * 240;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      g.fillStyle = '#ffffff';
      g.font = "700 52px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Helvetica Neue', sans-serif";
      g.textAlign = 'center';
      g.fillText('next token', w / 2, 96);
    } else {
      g.fillStyle = '#0b0b14';
      g.fillRect(0, 0, w, h);
      g.font = "600 30px ui-monospace, 'SF Mono', Menlo, 'Roboto Mono', monospace";
      g.textAlign = 'center';
      const rows = ['01101000', '01101111', '01101100', '01100001'];
      rows.forEach((row, i) => {
        g.fillStyle = i % 2 ? '#25f4ee' : '#b26bff';
        g.fillText(row, w / 2, 160 + i * 70);
      });
      g.fillStyle = '#ffffff';
      g.font = "700 72px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Helvetica Neue', sans-serif";
      g.fillText('hola', w / 2, 520);
      g.font = "400 22px ui-monospace, 'SF Mono', Menlo, 'Roboto Mono', monospace";
      g.fillStyle = '#a29fc4';
      g.fillText('= [70, 8083]', w / 2, 580);
    }
  });
}

export function rugTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#1d1638';
    g.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    for (let i = 12; i > 0; i--) {
      g.strokeStyle = i % 2 ? 'rgba(178,107,255,0.35)' : 'rgba(37,244,238,0.18)';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(cx, cy, i * 20, 0, Math.PI * 2);
      g.stroke();
    }
    const r = rng(19);
    for (let i = 0; i < 6000; i++) {
      g.fillStyle = `rgba(255,255,255,${r() * 0.04})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
  });
}

/** Scrolling code for the secondary monitor. */
export function codeLines() {
  return [
    'def forward(x):',
    '    h = embed(tokens) + pos(len(tokens))',
    '    for layer in model.layers:',
    '        h = h + layer.attn(norm(h))',
    '        h = h + layer.mlp(norm(h))',
    '    logits = h @ W_vocab.T',
    '    return softmax(logits / T)',
    '',
    'def attn(q, k, v, mask):',
    '    s = q @ k.T / sqrt(d_k)',
    '    s = s.masked_fill(mask, -inf)',
    '    return softmax(s) @ v',
    '',
    'while not done:',
    '    p = forward(context)[-1]',
    '    tok = sample(p, top_p=0.9)',
    '    context.append(tok)',
    '    stream(decode(tok))',
    '',
    '# loss: 1.732  lr: 3e-4  step 81k',
    '# tokens/s: 128   ctx: 8192',
  ];
}
