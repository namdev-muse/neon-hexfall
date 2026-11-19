// Neon Hexfall — cross-browser check (Block 21, backlog #52).
// Drives the real game in headless Chromium AND headless Firefox via
// playwright-core, over a local HTTP server (so the service worker and
// localStorage behave like the live site). Per browser it checks: the
// menu loads with the current version, a run plays (hard drops score),
// zero console/page errors, and the Block 21 save/restore survives a
// reload (CONTINUE resumes the same score). Safari cannot run on Linux
// — see docs/cross-browser.md for its static checklist.
// Usage: node tests/cross-browser.js [chromium|firefox]
// (no argument checks both browsers).
'use strict';
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VERSION = '1.0.0';
const SHOTS = path.join(os.tmpdir(), 'cross-browser');
const ONLY = (process.argv[2] || '').toLowerCase();
if (ONLY && ONLY !== 'chromium' && ONLY !== 'firefox') {
  console.error('usage: node tests/cross-browser.js [chromium|firefox]');
  process.exit(2);
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
  '.json': 'application/json', '.md': 'text/markdown'
};

function serve() {
  return new Promise(function (resolve) {
    const server = http.createServer(function (req, res) {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', function () { resolve({ server: server, port: server.address().port }); });
  });
}

function findExe(candidates) {
  return candidates.find(function (p) { return fs.existsSync(p); }) || null;
}

async function checkBrowser(name, launch) {
  const result = { name: name, ok: false, checks: [], errors: [], version: '' };
  function check(label, cond, extra) {
    result.checks.push((cond ? 'PASS ' : 'FAIL ') + label + (extra !== undefined && !cond ? ' — ' + extra : ''));
    if (!cond) result.ok = false;
  }
  result.ok = true;
  let browser = null;
  try {
    browser = await launch();
    result.version = await browser.version();
    const ctx = await browser.newContext({ viewport: { width: 560, height: 980 } });
    const page = await ctx.newPage();
    const t0 = Date.now();
    function mark(label) { console.log('  [' + name + ' ' + ((Date.now() - t0) / 1000).toFixed(1) + 's] ' + label); }
    page.on('pageerror', function (e) { result.errors.push(((Date.now() - t0) / 1000).toFixed(1) + 's pageerror: ' + e.message); });
    page.on('console', function (m) { if (m.type() === 'error') result.errors.push(((Date.now() - t0) / 1000).toFixed(1) + 's console: ' + m.text()); });

    await page.goto('http://127.0.0.1:' + global.__port + '/index.html');
    await page.waitForTimeout(800);
    mark('menu loaded');
    const menuVersion = (await page.textContent('.version') || '').trim();
    check('menu shows v' + VERSION, menuVersion === 'v' + VERSION, menuVersion);
    const state0 = await page.evaluate(function () {
      const h = window.__nhx;
      return h ? { state: h.S.state, overlay: h.S.overlay } : null;
    });
    check('first visit opens the how-to', state0 && state0.overlay === 'howOverlay', JSON.stringify(state0));

    // GOT IT starts a run; hard-drop trios across the board.
    await page.click('#howCloseBtn');
    await page.waitForTimeout(500);
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowUp'];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press(keys[i % keys.length]);
      await page.waitForTimeout(120);
      await page.keyboard.press('Space');
      await page.waitForTimeout(350);
      // Block 22 (#24): a level-up mid-run pauses on the upgrade draft —
      // pick the first card so the run keeps playing.
      await page.evaluate(function () {
        const h = window.__nhx;
        if (h && h.S.state === 'draft') h.pickUpgrade(0);
      });
    }
    const mid = await page.evaluate(function () {
      const h = window.__nhx;
      return h ? { state: h.S.state, score: h.S.score, pieces: h.S.pieces, lives: h.S.lives } : null;
    });
    check('run plays (6 trios locked)', mid && mid.pieces >= 6, JSON.stringify(mid));
    check('hard drops score', mid && mid.score > 0, JSON.stringify(mid));
    check('run still playing with lives left', mid && mid.state === 'playing' && mid.lives === 3, JSON.stringify(mid));
    await page.screenshot({ path: path.join(SHOTS, name + '-gameplay.png') });
    mark('gameplay screenshot taken');

    // Save/restore (#49): reload — the menu must offer CONTINUE, and
    // resuming must bring back the exact score.
    const savedScore = mid.score;
    await page.reload();
    mark('reload returned');
    await page.waitForTimeout(700);
    const afterReload = await page.evaluate(function () {
      const h = window.__nhx;
      const btn = document.getElementById('continueBtn');
      return h ? {
        state: h.S.state, overlay: h.S.overlay, hasSave: h.S.hasSave,
        btnHidden: btn ? btn.classList.contains('hidden') : null,
        btnLabel: btn ? btn.textContent : null
      } : null;
    });
    check('reload lands on the menu', afterReload && afterReload.overlay === 'menuOverlay', JSON.stringify(afterReload));
    check('save waits after reload', afterReload && afterReload.hasSave === true, JSON.stringify(afterReload));
    check('CONTINUE shown after reload', afterReload && afterReload.btnHidden === false, JSON.stringify(afterReload));
    check('CONTINUE label carries the saved score', afterReload && afterReload.btnLabel.indexOf(String(savedScore)) !== -1, afterReload && afterReload.btnLabel);
    await page.click('#continueBtn');
    mark('CONTINUE clicked');
    await page.waitForTimeout(500);
    const resumed = await page.evaluate(function () {
      const h = window.__nhx;
      return h ? { state: h.S.state, score: h.S.score } : null;
    });
    check('CONTINUE resumes the same score', resumed && resumed.state === 'playing' && resumed.score === savedScore, JSON.stringify(resumed));
    check('no console/page errors', result.errors.length === 0, result.errors.join(' | '));

    await browser.close();
  } catch (e) {
    result.ok = false;
    result.errors.push('launch/run failed: ' + e.message);
    if (browser) { try { await browser.close(); } catch (ignored) {} }
  }
  result.ok = result.ok && result.checks.every(function (c) { return c.indexOf('PASS ') === 0; });
  return result;
}

(async () => {
  const { server, port } = await serve();
  global.__port = port;
  fs.mkdirSync(SHOTS, { recursive: true });
  let chromium;
  try { chromium = require('playwright-core').chromium; }
  catch (e) { console.error('playwright-core is not installed — run: npm install playwright-core'); process.exit(1); }
  const firefox = require('playwright-core').firefox;

  const chromeExe = findExe([
    path.join(os.homedir(), '.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'),
    '/opt/meta-chromium/chrome'
  ]);
  const firefoxExe = findExe([
    path.join(os.homedir(), '.cache/ms-playwright/firefox-1572/firefox/firefox')
  ]);

  const results = [];
  if ((!ONLY || ONLY === 'chromium') && chromeExe) {
    results.push(await checkBrowser('chromium', function () {
      return chromium.launch({ executablePath: chromeExe, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
    }));
  } else if (!ONLY || ONLY === 'chromium') {
    results.push({ name: 'chromium', ok: false, checks: ['FAIL no Chromium executable found'], errors: [], version: '' });
  }
  if ((!ONLY || ONLY === 'firefox') && firefoxExe) {
    results.push(await checkBrowser('firefox', function () {
      return firefox.launch({ executablePath: firefoxExe, args: ['--mute-audio'] });
    }));
  } else if (!ONLY || ONLY === 'firefox') {
    results.push({ name: 'firefox', ok: false, checks: ['FAIL no Firefox executable found (npx playwright-core install firefox)'], errors: [], version: '' });
  }

  server.close();
  let allOk = true;
  results.forEach(function (r) {
    console.log('\n== ' + r.name + ' ' + (r.version || '') + ' ==');
    r.checks.forEach(function (c) { console.log('  ' + c); });
    if (r.errors.length) console.log('  errors: ' + r.errors.join(' | '));
    console.log('  => ' + (r.ok ? 'PASS' : 'FAIL'));
    if (!r.ok) allOk = false;
  });
  console.log('\nscreenshots in ' + SHOTS);
  process.exit(allOk ? 0 : 1);
})().catch(function (e) { console.error('CROSS-BROWSER FAILED:', e.message); process.exit(1); });
