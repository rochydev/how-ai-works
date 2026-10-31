/**
 * There is no real model behind this demo: the "intended" answer comes
 * from a small bank of templates. What IS simulated faithfully is how the
 * answer gets produced — one sampled token at a time, where temperature
 * can make the model deviate from the most likely continuation.
 */

const STOP = new Set(
  `que qué como cómo para por con sobre una uno unos unas este esta esto eso las los del the and what how about with this that from your you are puedes podrías dime explica explícame escribe escríbeme cuéntame tell write explain please por favor hola hello`.split(
    ' ',
  ),
);

export function detectLang(text, fallback = 'es') {
  const t = ` ${text.toLowerCase()} `;
  let es = (t.match(/[¿¡ñáéíóú]/g) || []).length * 2;
  let en = 0;
  for (const w of [' que ', ' el ', ' la ', ' de ', ' es ', ' por ', ' cómo ', ' qué ', ' una ', ' un ', ' hola ', ' y ']) if (t.includes(w)) es++;
  for (const w of [' the ', ' is ', ' what ', ' how ', ' you ', ' and ', ' a ', ' hello ', ' hi ', ' do ', ' can ']) if (t.includes(w)) en++;
  if (es === en) return fallback;
  return es > en ? 'es' : 'en';
}

function topicOf(text, lang) {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
  words.sort((a, b) => b.length - a.length);
  return words[0] || (lang === 'es' ? 'esto' : 'this');
}

const BANK = {
  es: {
    poem: (topic) =>
      `Escribes «${topic}» y se rompe en tokens,\nviaja entre capas de pura atención,\ny palabra a palabra, sin saber por qué,\nnace un poema hecho de predicción.`,
    joke: () =>
      '¿Por qué el programador dejó su trabajo? Porque no le daban arrays. Y sí: elegí ese final token a token, por probabilidad.',
    code: () =>
      'Claro, aquí tienes:\n\nprint("Hola, mundo")\n\nUna línea de Python generada igual que el texto: «print», «(», «"Hola»… token a token.',
    ai: () =>
      'Soy un modelo de lenguaje: he leído muchísimo texto y aprendí a predecir el siguiente token. Repetir esa predicción una y otra vez es lo que parece pensar.',
    greet: () =>
      '¡Hola! No leo como tú: troceo tu texto en tokens, los convierto en vectores y predigo, uno a uno, cuál es el siguiente más probable.',
    default: (topic, n) =>
      `Buena pregunta sobre «${topic}». Para responder, convertí tu mensaje en ${n} tokens, los pasé por muchas capas de atención y elegí cada palabra por probabilidad.`,
  },
  en: {
    poem: (topic) =>
      `You type "${topic}" and it breaks into tokens,\nit travels through layers of attention and light,\nand word after word, not knowing why,\na poem is born out of prediction.`,
    joke: () =>
      "Why did the programmer quit their job? Because they didn't get arrays. And yes: I picked that punchline token by token, by probability.",
    code: () =>
      'Sure, here you go:\n\nprint("Hello, world")\n\nOne line of Python, generated just like text: "print", "(", "\\"Hello"… token by token.',
    ai: () =>
      "I'm a language model: I read a huge amount of text and learned to predict the next token. Repeating that prediction over and over is what looks like thinking.",
    greet: () =>
      "Hi! I don't read like you do: I split your text into tokens, turn them into vectors and predict, one by one, the most likely next token.",
    default: (topic, n) =>
      `Good question about "${topic}". To answer, I turned your message into ${n} tokens, ran them through many attention layers and picked every word by probability.`,
  },
};

export function intentOf(text) {
  const t = text.toLowerCase();
  if (/(poema|poem|poes[ií]a|verso|rima)/.test(t)) return 'poem';
  if (/(chiste|joke|broma|funny)/.test(t)) return 'joke';
  if (/(c[oó]digo|\bcode\b|python|javascript|programa\b|script)/.test(t)) return 'code';
  if (/(inteligencia artificial|\bias?\b|\bai\b|llm|modelo de lenguaje|language model|funcionas|chatgpt|claude|how do you work|qu[eé] eres|who are you|transformer)/.test(t))
    return 'ai';
  if (/^\s*(hola|hello|hi|hey|buenas|qu[eé] tal)\b/.test(t)) return 'greet';
  return 'default';
}

export function buildResponse(prompt, lang, promptTokens) {
  const bank = BANK[lang] || BANK.es;
  const intent = intentOf(prompt);
  return bank[intent](topicOf(prompt, lang), promptTokens);
}

export const DISTRACTORS = {
  es: [' el', ' la', ' de', ' que', ' y', ' un', ' una', ',', '.', ' es', ' en', ' lo', ' muy', ' no', ' más', ' por', ' se', ' mi', ' tu', ' todo'],
  en: [' the', ' a', ' of', ' and', ' to', ',', '.', ' is', ' it', ' that', ' you', ' in', ' I', ' this', ' so', ' my', ' just', ' very'],
};

export const EOS = { es: '<|fin|>', en: '<|end|>' };
