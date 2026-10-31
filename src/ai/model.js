/**
 * Toy transformer maths with deterministic fake weights.
 * The numbers are not trained, but every operation is the real one:
 * embedding lookup, sinusoidal positions, scaled dot-product attention
 * with a causal mask, softmax with temperature.
 */

export const DIM = 32;
export const HEADS = 4;

export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(r) {
  return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
}

// --- Semantic clusters for the 2D "meaning map" ----------------------------
export const CLUSTERS = [
  { id: 'greet', words: ['hola', 'hello', 'hi', 'buenas', 'hey', 'gracias', 'thanks'], x: 0.18, y: 0.22 },
  { id: 'ai', words: ['ia', 'ai', 'inteligencia', 'artificial', 'modelo', 'model', 'lenguaje', 'language', 'red', 'neuronal', 'token', 'tokens', 'transform', 'gpt', 'llm', 'datos', 'funciona', 'funcionas', 'works', 'work', 'aprende'], x: 0.74, y: 0.26 },
  { id: 'food', words: ['café', 'coffee', 'pizza', 'comida', 'té', 'pan', 'cena', 'taza'], x: 0.2, y: 0.74 },
  { id: 'code', words: ['código', 'code', 'python', 'javascript', 'función', 'programa', 'programadores', 'bug', 'html', 'git'], x: 0.8, y: 0.72 },
  { id: 'feel', words: ['amor', 'love', 'feliz', 'triste', 'poema', 'poem', 'chiste', 'joke', 'vida', 'life', 'noche'], x: 0.48, y: 0.84 },
  { id: 'func', words: ['de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'un', 'una', 'es', 'the', 'of', 'and', 'to', 'is', 'a', 'qué', 'what', 'how', 'cómo', 'me', 'sobre', 'about'], x: 0.46, y: 0.47 },
];

const CLUSTER_OF = new Map();
CLUSTERS.forEach((c, i) => c.words.forEach((w) => CLUSTER_OF.set(w, i)));

export function clusterOf(text) {
  const w = text.trim().toLowerCase().replace(/[¿?¡!.,;:]/g, '');
  if (!w) return -1;
  if (CLUSTER_OF.has(w)) return CLUSTER_OF.get(w);
  for (const [k, i] of CLUSTER_OF) if (k.length > 3 && w.startsWith(k.slice(0, 4))) return i;
  return -1;
}

/** Embedding lookup: id → vector (L2-normalised), nudged toward its cluster. */
export function embedding(token) {
  const r = seeded(token.id * 2654435761);
  const v = new Float32Array(DIM);
  for (let i = 0; i < DIM; i++) v[i] = gauss(r) * 0.5;
  const c = clusterOf(token.text);
  if (c >= 0) {
    const cr = seeded(1000 + c * 7919);
    for (let i = 0; i < DIM; i++) v[i] += gauss(cr) * 0.9;
  }
  return normalize(v);
}

/** Position of a token on the 2D meaning map (0..1). */
export function mapPosition(token) {
  const r = seeded(token.id * 97 + 13);
  const c = clusterOf(token.text);
  if (c >= 0) {
    const C = CLUSTERS[c];
    return { x: C.x + (r() - 0.5) * 0.16, y: C.y + (r() - 0.5) * 0.14, cluster: c };
  }
  if (/^[^\p{L}\p{N}]+$/u.test(token.text.trim())) {
    return { x: 0.08 + r() * 0.1, y: 0.45 + (r() - 0.5) * 0.2, cluster: -2 };
  }
  return { x: 0.25 + r() * 0.5, y: 0.3 + r() * 0.4, cluster: -1 };
}

export function positional(pos) {
  const v = new Float32Array(DIM);
  for (let i = 0; i < DIM; i += 2) {
    const freq = 1 / Math.pow(10000, i / DIM);
    v[i] = Math.sin(pos * freq);
    v[i + 1] = Math.cos(pos * freq);
  }
  return v;
}

export function normalize(v) {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

export function softmax(logits, temperature = 1) {
  const T = Math.max(temperature, 1e-3);
  const m = Math.max(...logits);
  const e = logits.map((l) => Math.exp((l - m) / T));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

// --- Attention -------------------------------------------------------------
function matrix(seed, rows, cols) {
  const r = seeded(seed);
  return Array.from({ length: rows }, () => Float32Array.from({ length: cols }, () => gauss(r) / Math.sqrt(rows)));
}

function project(v, W) {
  const out = new Float32Array(W[0].length);
  for (let i = 0; i < v.length; i++) for (let j = 0; j < out.length; j++) out[j] += v[i] * W[i][j];
  return out;
}

const D_HEAD = 8;
const WQ = Array.from({ length: HEADS }, (_, h) => matrix(101 + h, DIM, D_HEAD));
const WK = Array.from({ length: HEADS }, (_, h) => matrix(202 + h, DIM, D_HEAD));

/**
 * Scaled dot-product attention with a causal mask.
 * Each head also gets a small structural bias so the four heads show the
 * classic patterns found in real models (previous-token, attention sink,
 * semantic, content words).
 * @returns {number[][]} weights[i][j] = how much token i looks at token j
 */
export function attention(tokens, vectors, head) {
  const n = vectors.length;
  const Q = vectors.map((v) => project(v, WQ[head]));
  const K = vectors.map((v) => project(v, WK[head]));
  const scale = 1 / Math.sqrt(D_HEAD);
  return Q.map((q, i) => {
    const scores = [];
    for (let j = 0; j <= i; j++) {
      let s = 0;
      for (let d = 0; d < D_HEAD; d++) s += q[d] * K[j][d];
      s *= scale * 3;
      if (head === 0 && j === i - 1) s += 3.2; // previous token head
      if (head === 1 && j === 0) s += 2.6; // attention sink / BOS
      if (head === 2) s += cosine(vectors[i], vectors[j]) * 4; // semantic similarity
      if (head === 3) s += /[\p{L}]{4,}/u.test(tokens[j].text) ? 2 : -1; // content words
      scores.push(s);
    }
    const w = softmax(scores);
    return Array.from({ length: n }, (_, j) => (j <= i ? w[j] : 0));
  });
}

function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
