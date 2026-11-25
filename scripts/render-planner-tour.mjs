#!/usr/bin/env node
/**
 * Re-render the 27-second tour from native HTML text and SVG icons, not old MP4 frames.
 * Run the local site first, then:
 * NODE_PATH=/path/to/node_modules node scripts/render-planner-tour.mjs \
 *   --width 2560 --output /tmp/planner-tour-2560.mp4 --ffmpeg /path/to/ffmpeg
 * Preview a native-resolution frame without encoding: --preview 15 --output /tmp/map.png
 * Requires Node, Playwright with Chromium, and FFmpeg with libx264. No npm install needed
 * when Playwright is already supplied by the host runtime.
 */
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const values = Object.create(null);
for (let i = 2; i < process.argv.length; i += 2) {
  const name = process.argv[i];
  if (!['--width', '--output', '--ffmpeg', '--base-url', '--preview', '--frames-dir', '--fps', '--map-url'].includes(name) || process.argv[i + 1] == null) {
    throw new Error(`Expected --width, --output, --ffmpeg, --base-url, --preview, --frames-dir, --fps, or --map-url; got ${name}`);
  }
  values[name.slice(2)] = process.argv[i + 1];
}
const width = Number(values.width || 2560);
const fps = Number(values.fps || 24);
if (!Number.isInteger(width) || width < 1000 || width % 10 !== 0) throw new Error('--width must be a multiple of 10, at least 1000 (5:4 and even pixels).');
if (!Number.isInteger(fps) || fps < 1 || fps > 60) throw new Error('--fps must be an integer between 1 and 60.');
const preview = values.preview == null ? null : Number(values.preview);
if (preview !== null && (!Number.isFinite(preview) || preview < 0 || preview >= 27)) throw new Error('--preview must be a time from 0 to less than 27 seconds.');
const output = resolve(values.output || `/tmp/planner-tour-${width}.${preview === null ? 'mp4' : 'png'}`);
const framesDir = values['frames-dir'] && resolve(values['frames-dir']);
const baseURL = new URL(values['base-url'] || 'http://127.0.0.1:4187/');
if (!baseURL.pathname.endsWith('/')) baseURL.pathname += '/';
const sourcePath = fileURLToPath(new URL('./planner-tour-scene.html', import.meta.url));
let html = await readFile(sourcePath, 'utf8');
html = html.replace('<head>', `<head><base href="${baseURL.href.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">`);
await mkdir(dirname(output), { recursive: true });
if (framesDir) await mkdir(framesDir, { recursive: true });

let browser;
let encoder;
let failure;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: width / 1000, reducedMotion: 'reduce' });
  page.on('pageerror', error => { failure ||= error; });
  page.on('requestfailed', request => { failure ||= new Error(`${request.url()}: ${request.failure()?.errorText}`); });
  // Give the generated document the site's origin so font/icon fetches stay same-origin.
  const sceneURL = new URL('__planner-tour-render-source__', baseURL).href;
  await page.route(sceneURL, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto(sceneURL, { waitUntil: 'networkidle' });
  if (values['map-url']) await page.locator('#map-art').evaluate((image, src) => { image.src = src; }, new URL(values['map-url'], baseURL).href);
  await page.evaluate(() => window.ready);
  await page.evaluate(async () => { await Promise.all([...document.images].map(image => image.decode())); });
  if (failure) throw failure;
  if (preview !== null) {
    await page.evaluate(time => window.renderFrame(time), preview);
    await page.screenshot({ path: output, type: 'png', scale: 'device' });
    console.log(`Preview ${preview}s: ${output} (${width}×${width * .8})`);
  } else {
    encoder = spawn(values.ffmpeg || process.env.FFMPEG_BIN || 'ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps),
      '-vcodec', 'png', '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-threads', '4', '-preset', 'medium', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(fps), output,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const completed = new Promise((resolve, reject) => {
      encoder.once('error', reject);
      encoder.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code ?? signal}`)));
    });
    // Attach an immediate handler so early FFmpeg failures cannot become unhandled rejections.
    completed.catch(error => { failure ||= error; });
    encoder.stdin.on('error', error => { failure ||= error; });
    const cache = new Map();
    const frameCount = 27 * fps;
    for (let index = 0; index < frameCount; index++) {
      if (failure) throw failure;
      const key = await page.evaluate(time => window.renderFrame(time), index / fps);
      let frame = cache.get(key);
      if (!frame) {
        frame = await page.screenshot({ type: 'png', scale: 'device' });
        // Only static holds repeat. Moving cursor/route frames are written once.
        if (!/:(?:\d{2,})$/.test(key)) cache.set(key, frame);
      }
      if (framesDir) await writeFile(resolve(framesDir, `${String(index).padStart(5, '0')}.png`), frame);
      if (!encoder.stdin.write(frame)) await once(encoder.stdin, 'drain');
      if (index % fps === 0) console.log(`Rendered ${index / fps}/27s (${width}×${width * .8})`);
    }
    encoder.stdin.end();
    await completed;
    console.log(`Rendered ${output}: ${width}×${width * .8}, ${fps}fps, 27s`);
  }
} finally {
  if (encoder && encoder.exitCode == null) encoder.kill('SIGTERM');
  await browser?.close();
}
