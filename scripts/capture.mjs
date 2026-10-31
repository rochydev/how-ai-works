#!/usr/bin/env node
/**
 * Captures the README screenshots (and optionally a demo video) from a
 * running dev/preview server, using a locally installed Edge or Chrome.
 *
 *   npm run dev                      # in another terminal
 *   npm run capture                  # screenshots → docs/screenshots
 *   npm run capture -- --video       # + full walkthrough → docs/video
 *   npm run capture -- --url http://localhost:4173 --browser chrome
 */
import { chromium } from 'playwright-core';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = opt('url', 'http://localhost:5173').replace(/\/$/, '');
const CHANNEL = opt('browser', 'msedge') === 'chrome' ? 'chrome' : 'msedge';
const WIDTH = Number(opt('width', 1600));
const HEIGHT = Number(opt('height', 900));
const OUT = 'docs/screenshots';
const ONLY = opt('only', null);

const PROMPT_ES = 'Escríbeme un poema sobre el café';
const PROMPT_EN = 'What is artificial intelligence?';

const q = (o) => `/?${new URLSearchParams(o).toString()}`;

const SHOTS = [
  { name: '00-hero', url: q({ lang: 'es', prompt: PROMPT_ES, stage: 'attention', paused: '', ui: '0', shot: 'holo' }), wait: 7000 },
  { name: '00b-welcome', url: q({ lang: 'es' }), wait: 2300 },
  { name: '01-intro', url: q({ lang: 'es', splash: '0' }), wait: 5000 },
  { name: '02-prompt', url: q({ lang: 'es', autoplay: '1' }), wait: 3200 },
  { name: '03-tokens', url: q({ lang: 'es', prompt: PROMPT_ES, stage: 'tokens', paused: '' }), wait: 6000 },
  { name: '04-ids', url: q({ lang: 'es', prompt: PROMPT_ES, stage: 'ids', paused: '' }), wait: 5500 },
  { name: '05-embeddings', url: q({ lang: 'es', prompt: PROMPT_ES, stage: 'embeddings', paused: '' }), wait: 6500 },
  { name: '06-position', url: q({ lang: 'es', prompt: PROMPT_ES, stage: 'position', paused: '' }), wait: 6500 },
  { name: '07-attention', url: q({ lang: 'es', prompt: PROMPT_ES, stage: 'attention', paused: '' }), wait: 6000 },
  { name: '07b-attention-screen', url: q({ lang: 'es', prompt: PROMPT_ES, stage: 'attention', paused: '', shot: 'screen' }), wait: 6000 },
  { name: '08-layers', url: q({ lang: 'es', prompt: PROMPT_ES, stage: 'layers', paused: '' }), wait: 6000 },
  { name: '09-logits', url: q({ lang: 'es', prompt: PROMPT_ES, stage: 'logits', paused: '', temp: '1.3' }), wait: 5500 },
  { name: '10-sampling', url: q({ lang: 'es', prompt: PROMPT_ES, stage: 'sampling', paused: '', temp: '1.3' }), wait: 7500 },
  { name: '11-generate', url: q({ lang: 'es', prompt: PROMPT_ES, stage: 'generate', paused: '' }), wait: 9000 },
  { name: '12-answer', url: q({ lang: 'es', prompt: PROMPT_ES, stage: 'answer', paused: '' }), wait: 6000 },
  { name: '13-room', url: q({ lang: 'es', prompt: PROMPT_ES, stage: 'layers', paused: '', shot: 'room', ui: '0' }), wait: 7000 },
  { name: '14-en-embeddings', url: q({ lang: 'en', prompt: PROMPT_EN, stage: 'embeddings', paused: '' }), wait: 6500 },
  { name: '15-en-generate', url: q({ lang: 'en', prompt: PROMPT_EN, stage: 'generate', paused: '' }), wait: 9000 },
];

// Modern Edge/Chrome dropped the old headless mode Playwright asks for, so
// launch "headed" and opt into the new headless mode ourselves.
const headed = args.includes('--headed');
const browser = await chromium.launch({
  channel: CHANNEL,
  headless: false,
  args: [...(headed ? [] : ['--headless=new']), '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});

async function newPage(extra = {}) {
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1, ...extra });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('  page error:', e.message));
  return { context, page };
}

await mkdir(OUT, { recursive: true });

if (!args.includes('--video-only')) {
  for (const shot of SHOTS) {
    if (ONLY && !shot.name.includes(ONLY)) continue;
    const { context, page } = await newPage();
    await page.goto(BASE + shot.url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.getElementById('loader')?.classList.contains('hidden'), null, { timeout: 30000 });
    await page.waitForTimeout(shot.wait);
    const file = join(OUT, `${shot.name}.png`);
    await page.screenshot({ path: file });
    console.log('  ✓', file);
    await context.close();
  }
  // Phone-sized capture for the responsive section
  const { context, page } = await newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE + q({ lang: 'es', prompt: PROMPT_ES, stage: 'tokens', paused: '' }), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('loader')?.classList.contains('hidden'), null, { timeout: 30000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: join(OUT, '16-mobile.png') });
  console.log('  ✓', join(OUT, '16-mobile.png'));
  await context.close();
}

if (args.includes('--video') || args.includes('--video-only')) {
  const dir = 'docs/video';
  await mkdir(dir, { recursive: true });
  const { context, page } = await newPage({ recordVideo: { dir, size: { width: 1280, height: 720 } }, viewport: { width: 1280, height: 720 } });
  await page.goto(BASE + q({ lang: opt('lang', 'es'), autoplay: opt('suggestion', '1') }), { waitUntil: 'networkidle' });
  // full walkthrough: wait for the answer stage, then linger a moment
  await page.waitForFunction(() => window.__haw?.experience.state.stage === 10, null, { timeout: 240000, polling: 500 });
  await page.waitForTimeout(5000);
  const video = page.video();
  await context.close();
  const tmp = await video.path();
  const final = join(dir, `walkthrough-${opt('lang', 'es')}.webm`);
  await rm(final, { force: true });
  await rename(tmp, final);
  for (const f of await readdir(dir)) if (f.endsWith('.webm') && !f.startsWith('walkthrough')) await rm(join(dir, f));
  console.log('  ✓', final);
}

await browser.close();
