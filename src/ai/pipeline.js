import { tokenize, tokenId, VOCAB_SIZE } from './tokenizer.js';
import { embedding, positional, normalize, attention, softmax, seeded, HEADS } from './model.js';
import { buildResponse, detectLang, DISTRACTORS, EOS } from './responder.js';

export const TOP_K = 6;

function hashStr(s) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 2654435761);
  return h >>> 0;
}

/**
 * Everything the visualisation needs for one prompt: tokens, vectors,
 * attention maps, and an autoregressive generator.
 */
export class Pipeline {
  constructor() {
    this.setPrompt('', 'es');
  }

  setPrompt(text, uiLang) {
    this.prompt = text;
    this.lang = detectLang(text, uiLang);
    this.tokens = tokenize(text);
    this.embeddings = this.tokens.map(embedding);
    this.positions = this.tokens.map((_, i) => positional(i));
    this.hidden = this.embeddings.map((e, i) => normalize(e.map((x, d) => x + this.positions[i][d] * 0.35)));
    this.attention = Array.from({ length: HEADS }, (_, h) => attention(this.tokens, this.hidden, h));

    this.responseText = text ? buildResponse(text, this.lang, this.tokens.length) : '';
    const eosText = EOS[this.lang];
    this.eos = { text: eosText, id: VOCAB_SIZE - 1, eos: true };
    this.planned = [...tokenize(this.responseText), this.eos];
    this.seed = hashStr(text);
    this.resetGeneration();
  }

  resetGeneration() {
    this.generated = [];
    this.history = []; // one record per generated token
    this.cursor = 0; // index into planned
    this.done = false;
    this.cache = new Map();
  }

  /** The top-k candidates and their logits for the current position. */
  candidates(cursor = this.cursor) {
    const key = `${cursor}:${this.generated.length}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const r = seeded(this.seed + cursor * 7919 + this.generated.length * 31);
    const truth = this.planned[Math.min(cursor, this.planned.length - 1)];
    const pool = [
      ...DISTRACTORS[this.lang],
      ...this.planned.slice(cursor + 1, cursor + 8).map((t) => t.text),
    ];
    const seen = new Set([truth.text]);
    const list = [{ ...truth, truth: true, logit: 7 + r() * 0.8 }];
    const base = [4.3, 3.7, 3.2, 2.7, 2.3];
    let guard = 0;
    while (list.length < TOP_K && guard++ < 200) {
      const text = pool[Math.floor(r() * pool.length)];
      if (seen.has(text) || text === this.eos.text) continue;
      seen.add(text);
      list.push({ text, id: tokenId(text), logit: base[list.length - 1] + (r() - 0.5) * 0.5 });
    }
    // the end-of-sequence token is a real candidate near the end
    if (!truth.eos && cursor >= this.planned.length - 4) {
      list[list.length - 1] = { ...this.eos, logit: 2.5 };
    }
    list.sort((a, b) => b.logit - a.logit);
    this.cache.set(key, list);
    return list;
  }

  probabilities(temperature, cursor = this.cursor) {
    const c = this.candidates(cursor);
    if (temperature <= 0.01) return c.map((_, i) => (i === 0 ? 1 : 0));
    return softmax(
      c.map((x) => x.logit),
      temperature,
    );
  }

  /** Probability mass left for the other ~100k tokens (display only). */
  restMass(temperature) {
    return Math.min(0.08, 0.012 * Math.max(temperature, 0.05) ** 2);
  }

  sampleIndex(temperature, random = Math.random()) {
    const p = this.probabilities(temperature);
    let acc = 0;
    for (let i = 0; i < p.length; i++) {
      acc += p[i];
      if (random <= acc) return i;
    }
    return p.length - 1;
  }

  /** Append candidate `index` to the output. */
  commit(index, temperature, random) {
    const cands = this.candidates();
    const token = cands[index];
    this.history.push({
      cursor: this.cursor,
      candidates: cands,
      probs: this.probabilities(temperature),
      chosen: index,
      random,
    });
    if (token.eos) {
      this.done = true;
      return token;
    }
    this.generated.push(token);
    // A sampled "wrong" token is inserted and the model carries on with what
    // it meant to say next — the text drifts, like a high-temperature model.
    if (token.truth) this.cursor = Math.min(this.cursor + 1, this.planned.length - 1);
    if (this.generated.length > this.planned.length * 1.6 + 4) this.done = true;
    return token;
  }

  /** One full step: sample + commit. */
  step(temperature) {
    const random = Math.random();
    const index = this.sampleIndex(temperature, random);
    return { token: this.commit(index, temperature, random), index, random };
  }

  get outputText() {
    return this.generated.map((t) => t.text).join('');
  }
}
