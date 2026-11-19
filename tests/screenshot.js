// Neon Hexfall — gameplay screenshot capture (Block 13).
// Drives the real game in a headless browser and saves genuine gameplay
// screenshots + GIF frames for the README. Regenerate with:
//   node tests/screenshot.js        (then stitch frames with tests/gif.py)
// Needs playwright-core (npm install playwright-core) and a Chromium
// headless shell — it uses the Playwright cache if present, else the
// system Chromium. Exit 0 when all shots are saved.
// Usage: node tests/screenshot.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs');
const FRAMES = path.join(__dirname, '..', '.shot-frames');
const os = require('os');
const CANDIDATES = [
  path.join(os.homedir(), '.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'),
  '/opt/meta-chromium/chrome'
];

(async () => {
  let chromium;
  try { chromium = require('playwright-core').chromium; }
  catch (e) {
    console.error('playwright-core is not installed — run: npm install playwright-core');
    process.exit(1);
  }
  const exe = CANDIDATES.find(function (p) { return fs.existsSync(p); });
  if (!exe) { console.error('No headless Chromium found (tried ' + CANDIDATES.join(', ') + ')'); process.exit(1); }
  fs.mkdirSync(FRAMES, { recursive: true });
  const browser = await chromium.launch({
    executablePath: exe,
    args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--no-sandbox']
  });
  const page = await browser.newPage({ viewport: { width: 560, height: 980 } });
  const errors = [];
  page.on('pageerror', function (e) { errors.push('pageerror: ' + e.message); });
  page.on('console', function (m) { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForTimeout(800);
  console.log('menu version:', (await page.textContent('.version') || '').trim());
  await page.screenshot({ path: path.join(OUT, 'screenshot-menu.png') });

  // Start a run and play: alternate columns, hard-drop trios to build a board.
  await page.click('#playBtn');
  await page.waitForTimeout(600);
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowUp'];
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press(keys[i % keys.length]);
    await page.waitForTimeout(120);
    await page.keyboard.press('Space'); // hard drop
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(1200);
  const state = await page.evaluate(function () {
    const h = window.__nhx;
    return h ? { score: h.S.score, level: h.S.level, lives: h.S.lives, over: h.S.over } : null;
  });
  console.log('game state after drops:', JSON.stringify(state));
  await page.screenshot({ path: path.join(OUT, 'screenshot-gameplay.png') });

  // GIF frames: keep playing, one frame every ~180ms for ~2.2s.
  for (let i = 0; i < 12; i++) {
    if (i % 3 === 0) await page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight');
    if (i % 4 === 2) await page.keyboard.press('Space');
    await page.waitForTimeout(180);
    await page.screenshot({ path: path.join(FRAMES, 'f' + String(i).padStart(2, '0') + '.png') });
  }
  console.log('errors:', errors.length ? errors.join(' | ') : 'none');
  if (errors.length) process.exit(1);
  await browser.close();
  console.log('shots saved to docs/ + frames in .shot-frames/ (stitch with tests/gif.py)');
})().catch(function (e) { console.error('SHOT FAILED:', e.message); process.exit(1); });
