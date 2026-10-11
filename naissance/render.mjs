#!/usr/bin/env node
// Rend index.html image par image (Puppeteer) puis assemble out/scene.mp4 (ffmpeg).
//
//   node render.mjs                     toutes les images → out/frames/ → out/scene.mp4 + out/contact.png
//   node render.mjs --frames 0,36,120   seulement ces images → out/keys/ (pas de vidéo)
//   node render.mjs --test              page de test du moteur de pinceau → out/test.png
//
// Variable utile : PUPPETEER_EXECUTABLE_PATH pour utiliser un Chrome/Chromium déjà installé.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const FPS = 24;

const args = process.argv.slice(2);
const argValue = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const framesArg = argValue('--frames');
const testArg = args.includes('--test');

function parseFrames(spec, total) {
  return spec.split(',').flatMap(part => {
    const [a, b] = part.split('-').map(Number);
    if (Number.isNaN(a)) return [];
    return b === undefined ? [a] : Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }).filter(n => n >= 0 && n < total);
}

async function resolveFfmpeg() {
  const probe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (!probe.error && probe.status === 0) return 'ffmpeg';
  try {
    const mod = await import('ffmpeg-static');
    if (mod.default) return mod.default;
  } catch { /* paquet absent : on échoue plus bas avec un message clair */ }
  console.error('ffmpeg introuvable : installez ffmpeg, ou lancez `npm install ffmpeg-static`.');
  process.exit(1);
}

function run(bin, argv) {
  const res = spawnSync(bin, argv, { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`Échec : ${path.basename(bin)} ${argv.join(' ')}`);
    process.exit(1);
  }
}

const pngBuffer = dataUrl => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
const frameName = n => `frame_${String(n).padStart(4, '0')}.png`;

async function openPage(browser, query) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  page.on('pageerror', err => console.error('[page]', err.message));
  page.on('console', msg => { if (msg.type() === 'error') console.error('[console]', msg.text()); });
  const url = `${pathToFileURL(path.join(ROOT, 'index.html')).href}?${query}`;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 90_000 });
  await page.evaluate(() => document.fonts.ready);
  const fontOk = await page.evaluate(() => window.NAISSANCE.ready);
  if (!fontOk) {
    console.error('La police « Caveat » ne s\'est pas chargée (Google Fonts injoignable ?). Rendu annulé.');
    process.exit(1);
  }
  return page;
}

async function main() {
  const launchArgs = ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'];
  if (process.getuid?.() === 0) launchArgs.push('--no-sandbox');
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxy) launchArgs.push(`--proxy-server=${proxy}`);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: launchArgs,
  });
  try {
    await mkdir(OUT, { recursive: true });
    if (testArg) {
      const page = await openPage(browser, 'render&test');
      const n = Number(argValue('--test-frame') ?? 0);
      await writeFile(path.join(OUT, 'test.png'), pngBuffer(await page.evaluate(i => window.NAISSANCE.testDataURL(i), n)));
      console.log('→ out/test.png');
      return;
    }

    const page = await openPage(browser, 'render');
    const total = await page.evaluate(() => window.NAISSANCE.FRAMES);
    const partial = framesArg !== undefined;
    const frames = partial ? parseFrames(framesArg, total) : Array.from({ length: total }, (_, i) => i);
    const dir = path.join(OUT, partial ? 'keys' : 'frames');
    if (!partial) await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });

    const t0 = Date.now();
    for (const [i, n] of frames.entries()) {
      const dataUrl = await page.evaluate(k => window.NAISSANCE.frameDataURL(k), n);
      await writeFile(path.join(dir, frameName(n)), pngBuffer(dataUrl));
      if (partial || (i + 1) % FPS === 0 || i === frames.length - 1) {
        console.log(`image ${String(n).padStart(3, '0')}  (${i + 1}/${frames.length}, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      }
    }
    if (partial) return;

    const ffmpeg = await resolveFfmpeg();
    const mp4 = path.join(OUT, 'scene.mp4');
    run(ffmpeg, [
      '-y', '-loglevel', 'error',
      '-framerate', String(FPS), '-i', path.join(dir, 'frame_%04d.png'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-r', String(FPS), '-movflags', '+faststart', mp4,
    ]);
    console.log('→ out/scene.mp4');
    // Planche contact : 12 images réparties sur toute la durée.
    run(ffmpeg, [
      '-y', '-loglevel', 'error', '-i', mp4,
      '-vf', `select='not(mod(n\\,${total / 12}))',scale=480:-1,tile=4x3:padding=6:color=0x111111`,
      '-frames:v', '1', '-update', '1', path.join(OUT, 'contact.png'),
    ]);
    console.log('→ out/contact.png');
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
