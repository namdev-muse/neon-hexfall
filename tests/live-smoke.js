// Neon Hexfall — live-site smoke test (Block 14, backlog #59).
// Runs after every deploy (CI job `live-smoke`, needs: deploy) and checks
// the game that players actually get from GitHub Pages — not just the
// files in the repo. Polls until the new version shows up (Pages can lag
// a deploy by a minute or two), then:
//   1. index.html serves HTTP 200 and names the current version
//   2. game.js serves HTTP 200 and carries the same VERSION
//   3. a headless browser loads the live page, the menu shows the version,
//      PLAY starts a run, trios fall and hard-drop, and zero console
//      errors / page errors appear
// Usage: node tests/live-smoke.js [url]
//   (default https://namdev-muse.github.io/neon-hexfall/)
// Needs playwright-core + a Chromium headless shell:
//   npx playwright-core install chromium --only-shell
// Exit 0 when every check passes, 1 otherwise.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFAULT_URL = 'https://namdev-muse.github.io/neon-hexfall/';
const rawUrl = process.argv[2] || DEFAULT_URL;
const URL = rawUrl.endsWith('/') ? rawUrl : rawUrl + '/';
const POLL_MS = 180000;   // wait up to 3 minutes for the new version to go live
const POLL_EVERY = 10000;

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; failures.push(name); console.log('  FAIL ' + name + (extra !== undefined ? ' — ' + extra : '')); }
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  return { status: res.status, text: text };
}

const CANDIDATES = [
  path.join(os.homedir(), '.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'),
  '/opt/meta-chromium/chrome'
];

(async () => {
  // The version we expect live: read it from the shipped game.js, so this
  // script never needs a version bump of its own.
  const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
  const m = src.match(/var VERSION = '([^']+)'/);
  const version = m ? m[1] : null;
  if (!version) { console.error('could not read VERSION from game.js'); process.exit(1); }
  console.log('== live-site smoke test for v' + version + ' at ' + URL + ' ==');

  // ---------- HTTP checks (poll until the deploy propagates) ----------
  console.log('== HTTP ==');
  let indexText = null, gameText = null, live = false;
  const deadline = Date.now() + POLL_MS;
  while (Date.now() < deadline) {
    try {
      const idx = await fetchText(URL);
      const gm = await fetchText(URL + 'game.js');
      if (idx.status === 200 && gm.status === 200 &&
          idx.text.indexOf('v' + version) !== -1 &&
          gm.text.indexOf("var VERSION = '" + version + "'") !== -1) {
        indexText = idx.text; gameText = gm.text; live = true; break;
      }
      console.log('  ... live site not on v' + version + ' yet (index ' + idx.status +
        ', game.js ' + gm.status + '), retrying');
    } catch (e) { console.log('  ... fetch failed (' + e.message + '), retrying'); }
    await sleep(POLL_EVERY);
  }
  check('live index.html serves the new version', live, live ? '' : 'v' + version + ' not live after ' + (POLL_MS / 1000) + 's');
  if (!live) { console.log('\n' + pass + ' PASS, ' + fail + ' FAIL'); process.exit(1); }
  check('live index.html is a real page', indexText.indexOf('Neon Hexfall') !== -1 && indexText.indexOf('<canvas') !== -1);
  check('live game.js serves HTTP 200', gameText.length > 10000, gameText.length + ' bytes');
  check('live game.js carries the same VERSION', gameText.indexOf("var VERSION = '" + version + "'") !== -1);
  check('live style.css serves HTTP 200', (await fetchText(URL + 'style.css')).status === 200);

  // ---------- headless browser check ----------
  console.log('== browser ==');
  let chromium;
  try { chromium = require('playwright-core').chromium; }
  catch (e) {
    console.error('playwright-core is not installed — run: npm install playwright-core');
    process.exit(1);
  }
  const exe = CANDIDATES.find(function (p) { return fs.existsSync(p); });
  let browser;
  try {
    browser = exe
      ? await chromium.launch({ executablePath: exe, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'] })
      : await chromium.launch({ args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
  } catch (e) {
    console.error('No headless Chromium found — run: npx playwright-core install chromium --only-shell');
    process.exit(1);
  }
  const page = await browser.newPage({ viewport: { width: 560, height: 980 } });
  const errors = [];
  page.on('pageerror', function (e) { errors.push('pageerror: ' + e.message); });
  page.on('console', function (m) { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#playBtn', { timeout: 15000 });
    const menuVersion = (await page.textContent('.version') || '').trim();
    check('live menu shows v' + version, menuVersion === 'v' + version, menuVersion);
    // Settings toggles (#45) and tide progressbar (#51) are on the live page.
    check('settings toggles present on the live menu',
      (await page.$('#shakeToggle')) !== null && (await page.$('#motionToggle')) !== null && (await page.$('#musicToggle')) !== null);
    check('tide progressbar present on the live HUD',
      (await page.$('#tideBar')) !== null &&
      (await page.getAttribute('#tideBar', 'role')) === 'progressbar');
    await page.click('#playBtn');
    await page.waitForTimeout(800);
    const state = await page.evaluate(function () {
      const h = window.__nhx;
      return h ? { state: h.S.state, piece: !!h.S.piece, lives: h.S.lives } : null;
    });
    check('PLAY starts a run on the live site', !!state && state.state === 'playing' && state.piece && state.lives === 3,
      JSON.stringify(state));
    // Play a few trios: move, rotate, hard-drop.
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(800);
    const after = await page.evaluate(function () {
      const h = window.__nhx;
      return h ? { state: h.S.state, pieces: h.S.pieces, score: h.S.score } : null;
    });
    check('live run locks trios and keeps score', !!after && after.pieces >= 5 && after.score >= 0 && after.state === 'playing',
      JSON.stringify(after));
    check('zero console / page errors on the live site', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
  }

  console.log('\n' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('LIVE SMOKE FAILED:', e.message); process.exit(1); });
