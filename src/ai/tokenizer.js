/**
 * A toy, deterministic sub-word tokenizer that behaves like the real ones
 * (GPT-style pre-tokenization + greedy longest-match over a small vocabulary).
 * Frequent words become one token, rare words split into pieces, and the
 * leading space sticks to the next word — exactly the quirks people notice
 * in real tokenizers. It is NOT a real BPE vocabulary.
 */

export const VOCAB_SIZE = 100_256;

const WORDS = `
de la que el en y a los se del las un por con no una su para es al lo como más pero sus le ya o este sí porque
esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra
otros ese eso ante ellos esto antes algunos qué unos yo otro otras otra él tanto esa estos mucho nada muchos cual
poco ella estar estas algo nosotros mi mis tú te ti tu tus soy eres son era fue ser hola cómo funciona funcionas
puedes puede hacer explica dime escribe cuéntame inteligencia modelo lenguaje palabra palabras token tokens texto
respuesta pregunta poema café chiste código mundo día hoy gracias bien buen buena noche vida amor tiempo casa
cada vez cosa forma parte manera ejemplo red datos número números probabilidad siguiente entonces así aquí
the of and to in is it you that he was for on are with as his they be at one have this from or had by not but
what all were we when your can said there use an each which she do how their if will up other about out many
then them these so some her would make like him into time has look two more write go see no way could people my
than first been who its now find long down day did get come made may part hello hi explain tell me poem coffee
joke code world model language works work answer question next word words text every just very
`
  .trim()
  .split(/\s+/);

const PIECES = `
ción ciones mente ando iendo ado ada ados idas ido ida ar er ir os as es ía ente ancia encia idad ista ismo ble
able ible ing ed ly tion ment ness est re un in des pre con com tra inter intel igen cia art ific ial fun cion gen
ent ica ico mod elo len gua je pal abra pro gram ador ores ción tok en iza ción emb ed ding pos ici ón aten cap
trans form er neur onal red sam ple log it prob abil idad res pues ta pre gun ent end ter ate ing ers ure ous
ive ize ise al el il ol ul an on in ar or ur ra re ri ro ru la le li lo lu ma me mi mo mu na ne ni no nu ta te
ti to tu da de di do du ca ce ci co cu pa pe pi po pu sa se si so su qu gu ch ll rr th sh ph wh st sp tr br cr dr
fr gr pr pl bl cl fl gl sl
`
  .trim()
  .split(/\s+/);

const WORD_SET = new Set(WORDS);
const PIECE_SET = new Set(PIECES);
const WORD_INDEX = new Map(WORDS.map((w, i) => [w, i]));
const MAX_PIECE = 6;

// GPT-like pre-tokenizer: optional leading space + letters | numbers (≤3) | symbols | whitespace
const PRE = /\s?[\p{L}\p{M}]+|\s?\p{N}{1,3}|\s?[^\s\p{L}\p{M}\p{N}]+|\s+/gu;

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function tokenId(text) {
  const bare = text.trim().toLowerCase();
  const spaced = text.startsWith(' ');
  if (WORD_INDEX.has(bare)) return 220 + WORD_INDEX.get(bare) * 17 + (spaced ? 1 : 0);
  return 1000 + (hash(text) % (VOCAB_SIZE - 1100));
}

function splitWord(piece) {
  const lead = piece.startsWith(' ') ? ' ' : '';
  const word = lead ? piece.slice(1) : piece;
  const lower = word.toLowerCase();
  if (WORD_SET.has(lower) || word.length <= 3) return [piece];

  const out = [];
  let i = 0;
  while (i < word.length) {
    let len = Math.min(MAX_PIECE, word.length - i);
    // keep the first chunk a bit longer: real BPE tends to merge word starts
    for (; len > 1; len--) {
      const chunk = lower.slice(i, i + len);
      if (PIECE_SET.has(chunk) || (i === 0 && len >= 4 && WORD_SET.has(chunk))) break;
    }
    out.push(word.slice(i, i + len));
    i += len;
  }
  // merge single letters into their neighbour so splits look natural
  const merged = [];
  for (const p of out) {
    const prev = merged[merged.length - 1];
    if (prev !== undefined && (p.length === 1 || prev.length === 1) && prev.length + p.length <= 5) {
      merged[merged.length - 1] = prev + p;
    } else merged.push(p);
  }
  merged[0] = lead + merged[0];
  return merged;
}

/** @returns {{text: string, id: number, start: number, end: number}[]} */
export function tokenize(input) {
  const tokens = [];
  let cursor = 0;
  for (const match of input.matchAll(PRE)) {
    const piece = match[0];
    const parts = /[\p{L}\p{M}]/u.test(piece) ? splitWord(piece) : [piece];
    for (const text of parts) {
      tokens.push({ text, id: tokenId(text), start: cursor, end: cursor + text.length });
      cursor += text.length;
    }
  }
  return tokens;
}

export function detokenize(tokens) {
  return tokens.map((t) => t.text).join('');
}

/** How a token should be displayed: make the leading space visible. */
export function showToken(text) {
  if (text === '\n') return '↵';
  return text.replace(/^ /, '·').replace(/\n/g, '↵');
}
