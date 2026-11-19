// Neon Hexfall — smoke test (Block 1).
// Stub-DOM harness: loads game.js in Node, drives it through window.__nhx,
// and checks the core loop without a browser. Exit 0 when all pass.
// Usage: node tests/smoke.js
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; failures.push(name); console.log('  FAIL ' + name + (extra !== undefined ? ' — ' + extra : '')); }
}

// ---------- stubs ----------
function makeCtx() {
  return new Proxy({}, {
    get: function (t, k) {
      if (k === 'measureText') return function () { return { width: 10 }; };
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return function () { return { addColorStop: function () {} }; };
      if (k === 'getImageData') return function () { return { data: [] }; };
      if (typeof k === 'string') return function () {};
      return undefined;
    },
    set: function () { return true; }
  });
}
function makeEl(id) {
  return {
    id: id, textContent: '', innerHTML: '', value: '',
    style: {}, disabled: false, attrs: {},
    classList: {
      _s: new Set(),
      add: function (c) { this._s.add(c); }, remove: function (c) { this._s.delete(c); },
      toggle: function (c, f) { if (f === undefined) { if (this._s.has(c)) this._s.delete(c); else this._s.add(c); } else if (f) this._s.add(c); else this._s.delete(c); },
      contains: function (c) { return this._s.has(c); }
    },
    addEventListener: function () {}, removeEventListener: function () {},
    // Block 14: record attributes so the harness can check aria-pressed,
    // aria-hidden and aria-valuenow the way a screen reader would see them.
    setAttribute: function (k, v) { this.attrs[k] = String(v); },
    getAttribute: function (k) { return k in this.attrs ? this.attrs[k] : null; },
    appendChild: function () {}, focus: function () {}, click: function () {},
    getContext: function () { return makeCtx(); },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 480, height: 640 }; },
    width: 480, height: 640
  };
}
const els = {};
const ids = ['score', 'best', 'level', 'lives', 'chain', 'tideFill', 'muteBtn', 'pauseBtn',
  'playBtn', 'howBtn', 'howCloseBtn', 'howMenuBtn', 'resumeBtn', 'restartBtn', 'quitBtn',
  'againBtn', 'overMenuBtn', 'menuOverlay', 'howOverlay', 'pauseOverlay', 'overOverlay',
  'menuNext', 'seedLine', 'overBadge', 'overStats', 'pauseStats', 'liveRegion',
  'tcLeft', 'tcRotate', 'tcRight', 'tcDown', 'tcDrop', 'game',
  'volSlider', 'menuVolSlider',
  'dailyBestLine', 'rankLine', 'shareBtn', 'shareBtnOver', 'dailyBadge',
  'top5List', 'overTop5', 'top5Badge', 'specialsStrip',
  // Block 14: settings toggles (#45), tide progressbar + board desc (#51).
  'shakeToggle', 'motionToggle', 'musicToggle', 'tideBar', 'boardDesc',
  // Block 15: extra modes (#20/#21/#22).
  'modeClassic', 'modeBlitz', 'modeEndless', 'modeZen', 'modeLine', 'timeBadge', 'livesLabel',
  // Block 17: audio settings panel (#37) + surge countdown (#19).
  'sfxToggle', 'styleBtn', 'pauseSfxToggle', 'surgeEta',
  // Block 18: tide-freeze pickup (#18) + lifetime stats (#25).
  'lifetimeLine', 'tcFreeze',
  // Block 21: save/restore run state (#49) — CONTINUE button.
  'continueBtn',
  // Block 22: level-up upgrade draft (#24) — overlay + three cards.
  'draftOverlay', 'draftBtn0', 'draftBtn1', 'draftBtn2'];
ids.forEach(function (id) { els[id] = makeEl(id); });

const store = {};
global.localStorage = {
  getItem: function (k) { return k in store ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; }
};
global.window = global;
global.document = {
  getElementById: function (id) { return els[id] || makeEl(id); },
  addEventListener: function () {},
  createElement: function () { return makeEl('x'); }
};
global.location = { search: '?seed=TESTSEED' };
global.requestAnimationFrame = function () { return 0; }; // harness drives steps manually
function FakeAudioParam() { this.value = 0; this.setValueAtTime = function () {}; this.exponentialRampToValueAtTime = function () {}; }
function FakeNode() { this.connect = function () {}; this.start = function () {}; this.stop = function () {}; this.frequency = new FakeAudioParam(); this.gain = new FakeAudioParam(); }
global.AudioContext = function () {
  this.currentTime = 0; this.state = 'running'; this.destination = {};
  this.createOscillator = function () { return new FakeNode(); };
  this.createGain = function () { return new FakeNode(); };
  this.resume = function () {};
};
global.window.AudioContext = global.AudioContext;

// ---------- load the game ----------
const src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
eval(src); // defines window.__nhx
const H = global.__nhx;
const S = H.S;

console.log('== boot ==');
check('handle exposed', !!H && H.VERSION === '1.0.0');
check('boots to menu', S.state === 'menu');

console.log('== how-to on first visit (block 20, #40) ==');
// The harness boots with an empty localStorage store, i.e. a first visit.
check('first visit opens the how-to overlay', S.overlay === 'howOverlay', S.overlay);
check('first visit focuses GOT IT', S.kbdFocus === 'howCloseBtn', S.kbdFocus);
check('how-to not yet marked seen', H.hasSeenHowTo() === false);
check('how-to flag key is nhx-seen-howto', H.HOWTO_KEY === 'nhx-seen-howto');
// BACK TO MENU dismisses and records the visit.
H.dismissHowTo(false);
check('dismiss to menu marks seen', S.overlay === 'menuOverlay' && H.hasSeenHowTo() === true && global.localStorage.getItem('nhx-seen-howto') === '1', S.overlay);
// Reopen from the menu and dismiss with GOT IT: starts a run, stays seen.
H.showHowTo();
check('menu HOW TO PLAY reopens the guide', S.overlay === 'howOverlay');
H.dismissHowTo(true);
check('GOT IT starts a run and stays seen', S.state === 'playing' && S.overlay === null && H.hasSeenHowTo() === true, S.state + ' / ' + S.overlay);
// Escape from the how-to also records the visit.
H.quitToMenu();
global.localStorage.removeItem('nhx-seen-howto');
H.showHowTo();
H.handleKey('Escape');
check('Escape from how-to returns to menu and marks seen', S.overlay === 'menuOverlay' && H.hasSeenHowTo() === true, S.overlay);
// Keyboard Enter on GOT IT starts a run and marks seen.
H.quitToMenu();
global.localStorage.removeItem('nhx-seen-howto');
H.showHowTo();
check('how-to keyboard focus starts on GOT IT', S.kbdFocus === 'howCloseBtn', S.kbdFocus);
H.handleKey('Enter');
check('Enter on GOT IT starts a run and marks seen', S.state === 'playing' && H.hasSeenHowTo() === true, S.state);
// Static checks: the in-overlay first-visit note + the finalized v1.0
// release notes (Block 23: the DRAFT banner from Block 20 is gone).
const html20 = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
check('how-to carries a first-visit note', html20.indexOf('how-note') !== -1);
check('how-to note points back to the menu button', html20.indexOf('HOW TO PLAY on the menu') !== -1);
const notes20 = fs.readFileSync(path.join(__dirname, '..', 'docs', 'release-notes-v1.0.md'), 'utf8');
check('v1.0 release notes exist and name v1.0.0', notes20.indexOf('# Neon Hexfall — v1.0.0 release notes') !== -1);
check('release notes are no longer marked draft', notes20.indexOf('DRAFT') === -1);
check('release notes cover all four modes', notes20.indexOf('Blitz 60s') !== -1 && notes20.indexOf('Endless') !== -1 && notes20.indexOf('Zen') !== -1);
check('release notes link the live game', notes20.indexOf('https://namdev-muse.github.io/neon-hexfall/') !== -1);
check('release notes mention the tide and the specials', notes20.indexOf('tide') !== -1 && notes20.indexOf('bomb hexes') !== -1);
check('board empty at boot', S.board.every(function (col) { return col.every(function (v) { return v === null; }); }));
check('board is 8x11', S.board.length === 8 && S.board[0].length === 11);
check('seed from URL', S.seed === 'TESTSEED', S.seed);

console.log('== new game ==');
H.newGame();
check('newGame starts playing', S.state === 'playing');
check('piece spawns with 3 colours', !!S.piece && S.piece.colors.length === 3);
check('next trio queued', !!S.next && S.next.length === 3);
check('3 lives', S.lives === 3);
check('score 0', S.score === 0);

console.log('== movement / rotation ==');
const startCol = S.piece.col;
H.movePiece(-1);
check('move left', S.piece.col === startCol - 1);
H.movePiece(1);
check('move right back', S.piece.col === startCol);
const colsBefore = S.piece.colors.slice();
H.rotatePiece();
check('rotate cycles colours', S.piece.colors[0] === colsBefore[2] && S.piece.colors[1] === colsBefore[0] && S.piece.colors[2] === colsBefore[1]);
// clamp at left edge
for (let i = 0; i < 10; i++) H.movePiece(-1);
check('clamped at left edge', S.piece.col === 0);
for (let i = 0; i < 20; i++) H.movePiece(1);
check('clamped at right edge', S.piece.col === 7);

console.log('== hard drop locks a piece ==');
const piecesBefore = S.pieces;
H.hardDrop();
check('piece locked, count rose', S.pieces === piecesBefore + 1);
check('new piece spawned', !!S.piece);
check('board has 3 locked cells', S.board.flat().filter(function (v) { return v !== null; }).length === 3);

console.log('== match clears score ==');
// Build a guaranteed match: two colour-0 cells adjacent, then drop a trio whose
// bottom cell is colour 0 next to them. Column 0 rows 9,10 = colour 0; drop at col 1.
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0);
H.setPiece(1, 8, [1, 2, 0]); // bottom cell (row 10) is colour 0, adjacent to (0,10)/(0,9)
const scoreBefore = S.score;
H.hardDrop();
check('match cleared: score rose', S.score > scoreBefore, 'score ' + S.score);
check('matched cells gone', H.getCell(0, 10) === null && H.getCell(0, 9) === null);
check('matches counted', S.matches >= 1);

console.log('== chain cascade ==');
// Lower group clears, upper group falls into a new match.
// Col 0: rows 8,9,10 = colour 1 (match). Col 1: rows 7,8 = colour 2 above a
// colour-2 cell at row 10... after the lower clear + gravity, col 1 rows 8,9,10
// must be colour 2. Set col1 rows 6,7 = 2 and row 10 = 2; rows 8,9 = colour 1
// so the level-1 clear removes them too? No — rows 8,9 in col 1 must be part of
// the first match: make them colour 1 as well, extending the first group.
// After clear: col1 has 2s at rows 6,7,10 -> gravity drops 6,7 to 8,9 -> 2,2,2 match.
H.newGame();
H.setCell(0, 8, 1); H.setCell(0, 9, 1); H.setCell(0, 10, 1);
H.setCell(1, 8, 1); H.setCell(1, 9, 1);
H.setCell(1, 6, 2); H.setCell(1, 7, 2); H.setCell(1, 10, 2);
H.setPiece(3, 8, [3, 4, 5]);
H.hardDrop(); // locks somewhere harmless; resolve runs on lock
check('cascade chain reached x2', S.bestChain >= 2, 'bestChain ' + S.bestChain);
check('chain score applied', S.score >= 500, 'score ' + S.score);

console.log('== match-size bonus ==');
// Helper: fresh game, place cells, drop a trio, return the score.
// Piece starts at row 8 with its bottom cell at row 10, so the drop adds 0 points.
function matchScore(cells, piece) {
  H.newGame();
  cells.forEach(function (cell) { H.setCell(cell[0], cell[1], cell[2]); });
  H.setPiece(piece[0], piece[1], piece[2]);
  H.hardDrop();
  return S.score;
}
// 3-match baseline: (0,10),(0,9)=0 + piece bottom 0 at (1,10) -> 300
const s3 = matchScore([[0, 10, 0], [0, 9, 0]], [1, 8, [1, 2, 0]]);
check('3-match scores 300', s3 === 300, 'score ' + s3);
// 4-match: add (0,8)=0 -> 4x100 + 200 bonus = 600
const s4 = matchScore([[0, 10, 0], [0, 9, 0], [0, 8, 0]], [1, 8, [1, 2, 0]]);
check('4-match pays bonus (600)', s4 === 600, 'score ' + s4);
// 5-match: add (0,7)=0 -> 5x100 + 400 bonus = 900
const s5 = matchScore([[0, 10, 0], [0, 9, 0], [0, 8, 0], [0, 7, 0]], [1, 8, [1, 2, 0]]);
check('5-match pays bigger bonus (900)', s5 === 900, 'score ' + s5);
check('biggest match tracked', S.biggestMatch === 5, 'biggest ' + S.biggestMatch);

console.log('== all-clear bonus ==');
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0);
H.setPiece(1, 8, [0, 0, 0]); // all three land as colour 0 -> 5-hex group, board empties
H.hardDrop();
check('all-clear counted', S.allClears === 1, 'allClears ' + S.allClears);
check('all-clear bonus paid (1900)', S.score === 1900, 'score ' + S.score);
check('all-clear banner shown', !!S.banner && /ALL CLEAR/.test(S.banner.text), S.banner && S.banner.text);
check('board empty after all-clear', S.board.every(function (col) { return col.every(function (v) { return v === null; }); }));

console.log('== chain combo display ==');
// Reuse the cascade setup: first clear is a 5-group, second cascade chains x2.
H.newGame();
H.setCell(0, 8, 1); H.setCell(0, 9, 1); H.setCell(0, 10, 1);
H.setCell(1, 8, 1); H.setCell(1, 9, 1);
H.setCell(1, 6, 2); H.setCell(1, 7, 2); H.setCell(1, 10, 2);
H.setPiece(3, 8, [3, 4, 5]);
H.hardDrop();
check('chain banner shown on cascade', !!S.banner && /CHAIN ×2/.test(S.banner.text), S.banner && S.banner.text);
check('chain HUD value updated', S.chain >= 2, 'chain ' + S.chain);
check('score popup floats shown', S.floats.length > 0);
check('last clear recorded', !!S.lastClear && S.lastClear.chain >= 2, JSON.stringify(S.lastClear));

console.log('== gravity ==');
H.newGame();
H.setCell(2, 5, 3);
H.applyGravity();
check('single cell falls to bottom row', H.getCell(2, 10) === 3 && H.getCell(2, 5) === null);
H.setCell(2, 10, 3); H.setCell(2, 8, 4);
H.applyGravity();
check('stack compacts preserving order', H.getCell(2, 10) === 3 && H.getCell(2, 9) === 4);

console.log('== tide surge ==');
H.newGame();
H.setTide(99.5);
H.step(1000); // ~1.3 tide/sec at level 1 -> crosses 100
check('surge inserted slag row', H.getCell(0, 10) === H.SLAG || S.tide < 100, 'tide ' + S.tide);
check('tide reset after surge', S.tide < 60, 'tide ' + S.tide);
// slag crumbles next to a match
H.newGame();
H.setCell(0, 10, H.SLAG); H.setCell(1, 10, 0); H.setCell(1, 9, 0);
H.setPiece(2, 8, [4, 5, 0]); // bottom 0 lands at (2,10), adjacent to (1,10)
H.hardDrop();
check('slag next to a match crumbles', H.getCell(0, 10) === null, 'cell=' + H.getCell(0, 10));

console.log('== top-out / lives / game over ==');
H.newGame();
for (let c = 0; c < 8; c++) { H.setCell(c, 0, 1); H.setCell(c, 1, 2); }
const livesBefore = S.lives;
H.spawnPiece(); // spawn cells blocked -> top-out
check('top-out costs a life', S.lives === livesBefore - 1);
check('top rows cleared by tide break', H.getCell(0, 0) === null && H.getCell(0, 1) === null);
check('still playing with lives left', S.state === 'playing');
// burn remaining lives
for (let c = 0; c < 8; c++) { H.setCell(c, 0, 1); H.setCell(c, 1, 2); }
H.spawnPiece();
for (let c = 0; c < 8; c++) { H.setCell(c, 0, 1); H.setCell(c, 1, 2); }
H.spawnPiece();
check('game over at 0 lives', S.state === 'over' && S.lives === 0);

console.log('== pause / mute / level ==');
H.newGame();
H.togglePause();
check('pause works', S.state === 'paused');
H.togglePause();
check('resume works', S.state === 'playing');
const m0 = S.muted;
H.toggleMute();
check('mute flips', S.muted !== m0);
H.toggleMute();
check('mute flips back', S.muted === m0);
const lvlBefore = S.level;
S.clears = 5; // next clear -> 6 clears -> level 2
H.setCell(0, 10, 0); H.setCell(0, 9, 0);
H.setPiece(1, 8, [1, 2, 0]);
H.hardDrop();
check('level up at 6 clears', S.level === lvlBefore + 1, 'level ' + S.level);
// Block 22 (#24): the level-up pauses the run on the upgrade draft
// instead of spawning the next trio straight away.
check('level up opens the upgrade draft', S.state === 'draft' && S.overlay === 'draftOverlay' && S.draftChoices && S.draftChoices.length === 3, S.state + ' / ' + S.overlay);
check('draft offers tide, life, wide first in classic', S.draftChoices[0].key === 'tide' && S.draftChoices[1].key === 'life' && S.draftChoices[2].key === 'wide', JSON.stringify(S.draftChoices.map(function (u) { return u.key; })));
check('draft focuses the first card', S.kbdFocus === 'draftBtn0', S.kbdFocus);
check('draft pauses the run (no falling piece yet)', S.piece === null);
check('picking +1 life resumes the run', H.pickUpgrade(1) === true && S.state === 'playing' && S.lives === 4 && S.upgrades.life === 1, S.state + ' lives ' + S.lives);
check('a piece spawns after the pick', !!S.piece);
check('fall speeds up with level', H.fallMs() < 700); // Block 18: level-1 fall is 700ms now

console.log('== level-up upgrade draft (block 22, #24) ==');
// Offers adapt to the mode: zen has no tide (no slower-tide card),
// endless has no lives (no +1 life card), blitz keeps both.
H.newGame('zen');
var offersZen = H.draftOffers();
check('zen draft drops slower tide', offersZen.map(function (u) { return u.key; }).join(',') === 'wide,freeze,bonus', JSON.stringify(offersZen.map(function (u) { return u.key; })));
H.newGame('endless');
var offersEndless = H.draftOffers();
check('endless draft drops +1 life', offersEndless.map(function (u) { return u.key; }).join(',') === 'tide,wide,freeze', JSON.stringify(offersEndless.map(function (u) { return u.key; })));
H.newGame('blitz');
check('blitz draft keeps tide + life + wide', H.draftOffers().map(function (u) { return u.key; }).join(',') === 'tide,life,wide');
// Maxed upgrades fall out of the offers: with tide and wide maxed and
// 5 lives, the draft is freeze + break + bonus (board has bottom rows).
H.newGame();
S.upgrades.tide = 3; S.upgrades.wide = 3; S.lives = 5;
H.setCell(0, 10, 0);
check('maxed upgrades leave fallbacks only', H.draftOffers().map(function (u) { return u.key; }).join(',') === 'freeze,break,bonus');
// And with a full freeze stock and empty bottom rows, only the bonus
// is left — the draft still opens, with the spare cards hidden.
H.newGame();
S.upgrades.tide = 3; S.upgrades.wide = 3; S.lives = 5; S.freezeHeld = 3;
check('all-maxed draft offers only the bonus', H.draftOffers().map(function (u) { return u.key; }).join(',') === 'bonus');
H.openDraft();
check('one-card draft hides the spare cards', els.draftBtn1.classList.contains('hidden') === true && els.draftBtn2.classList.contains('hidden') === true);
check('one-card draft cycles only the live card', H.overlayButtons().length === 1 && H.overlayButtons()[0].id === 'draftBtn0');
check('picking the bonus pays +500', H.pickUpgrade(0) === true && S.score === 500 && S.upgrades.bonus === 1, 'score ' + S.score);
// Slower tide: each pick divides the tide rate by 1.25.
H.newGame();
S.level = 1; S.upgrades.tide = 0;
var baseTide = H.tidePerSec();
S.upgrades.tide = 1;
check('one tide pick slows the tide by 1.25x', Math.abs(H.tidePerSec() - baseTide / 1.25) < 1e-9, String(H.tidePerSec()));
S.upgrades.tide = 3;
check('three tide picks slow the tide by 1.25^3', Math.abs(H.tidePerSec() - baseTide / Math.pow(1.25, 3)) < 1e-9, String(H.tidePerSec()));
check('surge countdown stretches with slower tide', (function () { S.upgrades.tide = 0; var a = H.surgeEtaMs(); S.upgrades.tide = 1; var b = H.surgeEtaMs(); return b > a; })());
// +1 life: applies now, caps at 5 lives, and is refused at the cap.
H.newGame();
S.lives = 3;
H.applyUpgrade('life');
check('+1 life raises lives to 4', S.lives === 4 && S.upgrades.life === 1);
H.applyUpgrade('life');
check('second +1 life raises lives to 5', S.lives === 5 && S.upgrades.life === 2);
H.applyUpgrade('life');
check('+1 life never exceeds 5 lives', S.lives === 5);
// Wider matches: a 2-hex group clears at 50 pts per hex (60 at ×2,
// 70 at ×3 — pairs always pay less than a real 3+ match at 100).
// while without the upgrade the same pair stays on the board.
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0); H.setCell(5, 10, 1);
H.resolveBoard();
check('a pair does not clear without the upgrade', H.getCell(0, 10) === 0 && H.getCell(0, 9) === 0 && S.score === 0);
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0); H.setCell(5, 10, 1);
S.upgrades.wide = 1;
H.resolveBoard();
check('a pair clears with wide matches', H.getCell(0, 10) === null && H.getCell(0, 9) === null);
check('wide pair pays 50 pts per hex', S.score === 100, 'score ' + S.score);
check('wide pair counts as a clear', S.clears === 1 && S.hexesCleared === 2);
check('wide rate grows with extra picks', H.widePerHex() === 50 && (function () { S.upgrades.wide = 2; var v = H.widePerHex(); S.upgrades.wide = 3; return v === 60 && H.widePerHex() === 70; })());
check('wide rate never reaches the normal 100 pts/hex', (function () { S.upgrades.wide = 3; return H.widePerHex() === 70; })(), 'wide x3 ' + H.widePerHex());
check('min match size is 2 with wide, 3 without', (function () { S.upgrades.wide = 0; var a = H.minMatchSize(); S.upgrades.wide = 1; return a === 3 && H.minMatchSize() === 2; })());
// Freeze fallback: banks a freeze and counts it as collected.
H.newGame();
H.applyUpgrade('freeze');
check('freeze fallback banks a freeze', S.freezeHeld === 1 && S.freezesCollected === 1);
// Break fallback: clears the bottom two rows at 25 pts per hex.
H.newGame();
H.setCell(0, 10, 0); H.setCell(1, 10, 1); H.setCell(2, 9, 2); H.setCell(4, 8, 3);
H.applyUpgrade('break');
check('break fallback clears the bottom two rows', H.getCell(0, 10) === null && H.getCell(1, 10) === null && H.getCell(2, 9) === null);
check('break fallback drops the hex above to the bottom', H.getCell(4, 10) === 3 && H.getCell(4, 8) === null && H.validateBoard().length === 0, H.validateBoard().join('; '));
check('break fallback pays 25 pts per hex', S.score === 75, 'score ' + S.score);
// Keyboard: 1/2/3 pick directly, arrows + Enter navigate, P and
// Escape stay inert on the draft (a pick is required to resume).
H.newGame();
H.openDraft();
var draftT0 = S.timeMs;
H.step(1000);
check('the run clock freezes on the draft', S.timeMs === draftT0);
H.handleKey('Escape');
check('Escape does not dismiss the draft', S.state === 'draft');
H.handleKey('KeyP');
check('P does not pause from the draft', S.state === 'draft');
H.handleKey('Digit3');
check('key 3 picks the third card (wide)', S.state === 'playing' && S.upgrades.wide === 1, S.state + ' wide ' + S.upgrades.wide);
H.openDraft();
H.handleKey('ArrowDown');
check('draft nav moves to the second card', S.kbdFocus === 'draftBtn1', S.kbdFocus);
H.handleKey('Enter');
check('Enter picks the focused card (life)', S.state === 'playing' && S.lives === 4 && S.upgrades.life === 1, S.state + ' lives ' + S.lives);
check('a pick outside the draft refuses', H.pickUpgrade(0) === false);
// A multi-level jump queues a second draft: picking the first opens
// the second, picking again resumes the run.
H.newGame();
S.pendingDrafts = 1;
H.openDraft();
H.pickUpgrade(0);
check('queued draft opens after the first pick', S.state === 'draft' && S.pendingDrafts === 0, S.state);
H.pickUpgrade(0);
check('second pick resumes the run', S.state === 'playing');
// HUD: upgrade chips appear in the specials strip, and the lives
// dots grow with the cap instead of going negative. (Classic mode:
// the lives slot is a countdown in blitz.)
H.newGame('classic');
S.upgrades.tide = 2; S.upgrades.wide = 1; S.upgrades.life = 1; S.lives = 4;
H.updateHUD();
check('HUD shows upgrade chips', els.specialsStrip.textContent.indexOf('SLOW TIDE ×2') !== -1 && els.specialsStrip.textContent.indexOf('WIDE MATCH ×1') !== -1 && els.specialsStrip.textContent.indexOf('+1 LIFE') !== -1, els.specialsStrip.textContent);
check('HUD shows four lives dots at 4 lives', els.lives.textContent === '●●●●', els.lives.textContent);
S.lives = 3;
H.updateHUD();
check('HUD shows three dots at 3 lives (no empty slots added)', els.lives.textContent === '●●●', els.lives.textContent);
// Game-over stats carry the upgrade summary.
H.newGame();
S.upgrades.tide = 2; S.upgrades.wide = 1;
H.gameOver();
check('game-over stats show the upgrade summary', els.overStats.innerHTML.indexOf('UPGRADES') !== -1 && els.overStats.innerHTML.indexOf('TIDE ×2 · WIDE ×1') !== -1, els.overStats.innerHTML);
// Save/restore: upgrades and the draft queue survive a refresh, and
// a run saved mid-draft reopens the same draft on resume.
H.newGame();
S.upgrades.tide = 1; S.upgrades.wide = 1; S.score = 500;
H.saveRun();
var savedDraft = H.loadSave();
check('save carries upgrade picks', savedDraft && savedDraft.upgrades && savedDraft.upgrades.tide === 1 && savedDraft.upgrades.wide === 1 && savedDraft.draftOpen === false);
S.upgrades.tide = 0; S.upgrades.wide = 0; S.score = 0;
check('resume restores upgrade picks', H.resumeSavedRun() === true && S.upgrades.tide === 1 && S.upgrades.wide === 1 && S.score === 500, 'tide ' + S.upgrades.tide + ' score ' + S.score);
H.openDraft();
H.saveRun();
check('save mid-draft flags draftOpen', H.loadSave() !== null && H.loadSave().draftOpen === true);
check('resume mid-draft reopens the draft', H.resumeSavedRun() === true && S.state === 'draft' && S.draftChoices && S.draftChoices.length === 3, S.state);
H.pickUpgrade(0);
check('picking after resume resumes the run', S.state === 'playing');
// A save written by v0.21.0 (no upgrade fields) still loads.
H.newGame(); H.hardDrop();
var oldSave = H.loadSave();
delete oldSave.upgrades; delete oldSave.pendingDrafts; delete oldSave.draftOpen;
global.localStorage.setItem('nhx-save', JSON.stringify(oldSave));
check('v0.21.0 save without upgrade fields still loads', H.loadSave() !== null && H.loadSave().upgrades === undefined);
check('v0.21.0 save resumes with no picks', H.resumeSavedRun() === true && S.upgrades.tide === 0 && S.upgrades.wide === 0 && S.upgrades.life === 0);
H.clearSave();
// Board audit covers the new state: bad upgrades / draft queue repair.
H.newGame();
S.upgrades.tide = 99;
check('audit flags an out-of-range tide pick', H.validateBoard().some(function (i) { return i.indexOf('upgrades') !== -1; }));
H.sanitizeState();
check('sanitize repairs upgrades to zero picks', S.upgrades.tide === 0 && S.upgrades.wide === 0);
S.lives = 9;
check('audit flags lives above the new cap of 5', H.validateBoard().some(function (i) { return i.indexOf('lives') !== -1; }));
H.sanitizeState();
check('sanitize clamps lives to 5', S.lives === 5);
// Static checks: the overlay, the three cards and their styles ship.
var html22 = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
var css22 = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
check('draft overlay exists in the HTML', html22.indexOf('id="draftOverlay"') !== -1 && html22.indexOf('draftBtn0') !== -1 && html22.indexOf('draftBtn2') !== -1);
check('draft overlay is a labelled dialog', html22.indexOf('aria-label="Level up') !== -1 && html22.indexOf('role="dialog"') !== -1);
check('how-to explains the level-up draft', html22.indexOf('pick <b>1 of 3 upgrades</b>') !== -1);
check('draft card styles exist', css22.indexOf('.draft-card') !== -1 && css22.indexOf('.draft-cards') !== -1 && css22.indexOf('.draft-name') !== -1);
check('tall overlays scroll instead of clipping their top', css22.indexOf('.overlay {') !== -1 && css22.indexOf('overflow-y: auto') !== -1 && css22.indexOf('.overlay > :first-child') !== -1);
// Leave the mode on the default: later sections boot expecting classic.
H.setMode('classic');

console.log('== rainbow hex ==');
// A rainbow completes a 2-cell colour group as a wildcard.
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0); H.setCell(0, 8, H.RAINBOW);
H.setPiece(3, 8, [3, 4, 5]);
H.hardDrop();
check('rainbow joins a colour match', H.getCell(0, 8) === null && H.getCell(0, 9) === null && H.getCell(0, 10) === null);
check('rainbow match scores 300', S.score === 300, 'score ' + S.score);
check('rainbow clear counted', S.rainbowsCleared === 1, 'rainbows ' + S.rainbowsCleared);
// A rainbow bridges two same-colour cells that are not adjacent to each other.
H.newGame();
H.setCell(0, 10, 0); H.setCell(1, 10, H.RAINBOW); H.setCell(2, 10, 0);
H.setPiece(4, 8, [3, 4, 5]);
H.hardDrop();
check('rainbow bridges two colour cells', H.getCell(0, 10) === null && H.getCell(1, 10) === null && H.getCell(2, 10) === null);
check('bridged match scores 300', S.score === 300, 'score ' + S.score);

console.log('== bomb hex ==');
// 0-group at col 0 clears; bomb at (1,9) sits next to it and blasts its
// neighbours (1,8)=3, (2,9)=4, (2,8)=5, (1,10)=2 -> 4 x 50 = 200 extra.
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0); H.setCell(0, 8, 0);
H.setCell(1, 9, H.BOMB);
H.setCell(1, 8, 3); H.setCell(2, 9, 4); H.setCell(2, 8, 5); H.setCell(1, 10, 2);
H.setPiece(4, 8, [1, 2, 3]);
H.hardDrop();
check('bomb detonated', S.bombsDetonated === 1, 'bombs ' + S.bombsDetonated);
check('bomb and blast victims cleared',
  H.getCell(1, 9) === null && H.getCell(1, 8) === null && H.getCell(2, 9) === null &&
  H.getCell(2, 8) === null && H.getCell(1, 10) === null);
check('bomb payout 500 (300 match + 200 blast)', S.score === 500, 'score ' + S.score);
// Chain detonation: bomb B sits in bomb A's blast radius; B's own blast
// then clears (3,9)=4, which A could not reach.
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0); H.setCell(0, 8, 0);
H.setCell(1, 9, H.BOMB); H.setCell(2, 9, H.BOMB);
H.setCell(2, 8, 5); H.setCell(3, 9, 4);
H.setPiece(5, 8, [1, 2, 3]);
H.hardDrop();
check('chain detonation: both bombs blew', S.bombsDetonated === 2, 'bombs ' + S.bombsDetonated);
check('second bomb blast victim cleared', H.getCell(3, 9) === null);
check('chain bomb payout 400', S.score === 400, 'score ' + S.score);

console.log('== powerup drops ==');
H.newGame();
S.triosSinceSpecial = 11; // pity timer: next trio must carry a special
const trio = H.rollColors();
check('pity timer forces a special trio', trio.indexOf(H.BOMB) !== -1 || trio.indexOf(H.RAINBOW) !== -1, JSON.stringify(trio));
check('special spawn counted', S.specialsSpawned >= 1, 'spawned ' + S.specialsSpawned);
check('trio still has 3 cells', trio.length === 3);
const trio2 = H.rollColors();
check('trio cells are valid values 0-10', trio2.every(function (v) { return v >= 0 && v <= 10; }), JSON.stringify(trio2));

console.log('== audio: music intensity, new SFX, volume ==');
// music tempo scales with level and chain (backlog #34)
check('music tempo base 460ms', H.audio.musicTempo(1, 1) === 460, H.audio.musicTempo(1, 1));
check('music tempo faster at higher level', H.audio.musicTempo(4, 1) < H.audio.musicTempo(1, 1), H.audio.musicTempo(4, 1));
check('music tempo faster on a big chain', H.audio.musicTempo(1, 3) < H.audio.musicTempo(1, 1), H.audio.musicTempo(1, 3));
check('music tempo floor is 240ms', H.audio.musicTempo(99, 9) === 240, H.audio.musicTempo(99, 9)); // Block 17: floor lowered from 300 so the faster DRIVE style keeps headroom at high levels
// applyIntensity retunes the running loop when the level rises
H.newGame();
const tempoBefore = H.audio.tempoMs;
S.level = 4;
H.audio.applyIntensity();
check('applyIntensity retunes tempo with level', H.audio.tempoMs < tempoBefore, H.audio.tempoMs + ' vs ' + tempoBefore);
// powerup jingle plays when a special hex drops in a trio (backlog #35)
H.newGame();
S.triosSinceSpecial = 11;
H.rollColors();
check('powerup SFX plays on special spawn', (H.audio.played.powerup || 0) >= 1, JSON.stringify(H.audio.played));
// surge warning alarm at 80% tide, once per surge cycle
H.newGame();
H.setTide(79);
H.step(1000); // tide rises ~1.28/s at level 1 -> crosses 80
check('surge warning SFX at 80% tide', (H.audio.played.surgewarn || 0) >= 1, 'tide ' + S.tide);
const warns = H.audio.played.surgewarn;
H.step(500);
check('surge warning fires once per cycle', H.audio.played.surgewarn === warns, H.audio.played.surgewarn + ' vs ' + warns);
check('tide warning flag set', S.tideWarned === true);
// bomb + all-clear SFX are wired
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0); H.setCell(0, 8, 0);
H.setCell(1, 9, H.BOMB);
H.setPiece(4, 8, [1, 2, 3]);
H.hardDrop();
check('bomb SFX plays on detonation', (H.audio.played.bomb || 0) >= 1, JSON.stringify(H.audio.played));
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0);
H.setPiece(1, 8, [0, 0, 0]);
H.hardDrop();
check('all-clear SFX plays on all-clear', (H.audio.played.allclear || 0) >= 1, JSON.stringify(H.audio.played));
// volume slider (backlog #36)
H.audio.setVolume(0.8);
check('volume sets and persists', H.audio.volume === 0.8 && global.localStorage.getItem('nhx-volume') === '0.8', H.audio.volume + ' / ' + global.localStorage.getItem('nhx-volume'));
check('volume syncs both sliders', els.volSlider.value === '0.8' && els.menuVolSlider.value === '0.8', els.volSlider.value + ' / ' + els.menuVolSlider.value);
H.audio.setVolume(2);
check('volume clamps to 1', H.audio.volume === 1, H.audio.volume);
H.audio.setVolume(-1);
check('volume clamps to 0', H.audio.volume === 0, H.audio.volume);
H.audio.setVolume(0.5);
H.toggleMute();
check('mute zeroes master gain', H.audio.master.gain.value === 0, H.audio.master.gain.value);
H.toggleMute();
check('unmute restores volume gain', H.audio.master.gain.value === 0.5, H.audio.master.gain.value);

console.log('== juice pass 1: hit-stop, hex pop, shake scaling ==');
// 5-match triggers a 90ms hit-stop that freezes the falling piece.
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0); H.setCell(0, 8, 0); H.setCell(0, 7, 0);
H.setPiece(1, 8, [1, 2, 0]);
H.hardDrop();
check('5-match sets hit-stop', S.hitStop > 0, 'hitStop ' + S.hitStop);
check('5-match pops spawned', S.pops.length >= 5, 'pops ' + S.pops.length);
check('pop has position, colour and life', S.pops.every(function (p) { return p.x > 0 && p.y > 0 && p.color && p.life > 0 && p.max > 0; }));
// Hit-stop freezes the piece: while it lasts, step() advances nothing.
const rowBefore = S.piece.row;
const hsBefore = S.hitStop;
H.step(50);
check('hit-stop freezes falling piece', S.piece.row === rowBefore, 'row ' + S.piece.row);
check('hit-stop counts down', S.hitStop < hsBefore, 'hitStop ' + S.hitStop);
H.updateFx(300);
check('pops expire after their life', S.pops.length === 0, 'pops ' + S.pops.length);
H.render();
check('render with pops runs clean', true);
// A plain 3-match has no hit-stop.
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0);
H.setPiece(1, 8, [1, 2, 0]);
H.hardDrop();
check('3-match has no hit-stop', S.hitStop === 0, 'hitStop ' + S.hitStop);
check('3-match still pops 3 hexes', S.pops.length === 3, 'pops ' + S.pops.length);
// Shake scales with clear size: a 6-match shakes harder than a 3-match.
// (lockPiece adds +2 first, so both readings include it.)
const shake3 = (function () {
  H.newGame();
  H.setCell(0, 10, 0); H.setCell(0, 9, 0);
  H.setPiece(1, 8, [1, 2, 0]);
  H.hardDrop();
  return S.shake;
})();
const shake6 = (function () {
  H.newGame();
  H.setCell(0, 10, 0); H.setCell(0, 9, 0); H.setCell(0, 8, 0); H.setCell(0, 7, 0); H.setCell(0, 6, 0);
  H.setPiece(1, 8, [1, 2, 0]);
  H.hardDrop();
  return S.shake;
})();
check('shake grows with clear size', shake6 > shake3, '3-match ' + shake3 + ' vs 6-match ' + shake6);
check('shakeForClear scales (3 < 6)', H.shakeForClear(3, 1, 3) < H.shakeForClear(6, 1, 6));
check('shakeForClear caps at 16', H.shakeForClear(30, 5, 9) <= 16);
check('chain adds shake', H.shakeForClear(3, 3, 3) > H.shakeForClear(3, 1, 3));

console.log('== daily challenge, ranks, shareable seed ==');
// Rank ladder (backlog #5): Rookie -> Hex Legend.
check('rank 0 is ROOKIE', H.rankFor(0).name === 'ROOKIE');
check('rank 999 is still ROOKIE', H.rankFor(999).name === 'ROOKIE');
check('rank at 1000 is HEX CADET', H.rankFor(1000).name === 'HEX CADET');
check('rank at 2500 is HEX RUNNER', H.rankFor(2500).name === 'HEX RUNNER');
check('rank at 9999 is HEX HUNTER', H.rankFor(9999).name === 'HEX HUNTER');
check('rank at 10000 is HEX ACE', H.rankFor(10000).name === 'HEX ACE');
check('rank at 20000 is HEX ELITE', H.rankFor(20000).name === 'HEX ELITE');
check('rank at 35000 is HEX MASTER', H.rankFor(35000).name === 'HEX MASTER');
check('rank at 50000 is HEX LEGEND', H.rankFor(50000).name === 'HEX LEGEND');
check('rank next threshold listed', H.rankFor(0).next && H.rankFor(0).next.name === 'HEX CADET' && H.rankFor(0).next.at === 1000);
check('top rank has no next', H.rankFor(999999).next === null);
// Rank-up banner fires when a run crosses a threshold mid-play.
H.newGame();
S.score = 999;
H.updateHUD();
check('no rank-up below threshold', !S.banner || !/RANK UP/.test(S.banner.text));
S.score = 1000;
H.updateHUD();
check('rank-up banner at 1000', !!S.banner && /RANK UP/.test(S.banner.text) && S.banner.sub === 'HEX CADET', S.banner && S.banner.text + ' / ' + S.banner.sub);
check('rank index tracked', S.rankIdx === 1);
S.score = 1001;
H.updateHUD();
check('rank-up fires once per rank', S.rankIdx === 1 && !!S.banner && S.banner.sub === 'HEX CADET', 'rankIdx ' + S.rankIdx);
// A rank-up behind a live banner queues instead of clobbering it: the
// all-clear here scores 1900, crossing the 1000 threshold mid-clear.
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0);
H.setPiece(1, 8, [0, 0, 0]);
H.hardDrop();
check('all-clear banner wins over rank-up', !!S.banner && /ALL CLEAR/.test(S.banner.text), S.banner && S.banner.text);
check('rank-up queued behind banner', S.pendingRankUp === 'HEX CADET', S.pendingRankUp);
H.updateFx(2000); // banner life is 1.5s
check('queued rank-up shows after banner', !!S.banner && /RANK UP/.test(S.banner.text) && S.banner.sub === 'HEX CADET', S.banner && S.banner.text);
// Daily best (backlog #23): tracked per seed, separate from the all-time best.
H.newGame();
check('daily best starts 0', S.dailyBest === 0);
S.score = 2500;
H.gameOver();
check('daily best saved on game over', S.dailyBest === 2500 && global.localStorage.getItem('nhx-daily-TESTSEED') === '2500', 'dailyBest ' + S.dailyBest);
check('daily best badge shown', els.dailyBadge.classList.contains('hidden') === false);
check('global best badge shown too', els.overBadge.classList.contains('hidden') === false);
check('game-over stats show daily best + rank', /DAILY BEST/.test(els.overStats.innerHTML) && /2,500/.test(els.overStats.innerHTML) && /HEX RUNNER/.test(els.overStats.innerHTML), els.overStats.innerHTML);
H.newGame();
check('daily best loads next run', S.dailyBest === 2500);
S.score = 1000;
H.gameOver();
check('lower score keeps daily best', S.dailyBest === 2500 && global.localStorage.getItem('nhx-daily-TESTSEED') === '2500');
check('daily best badge hidden when not beaten', els.dailyBadge.classList.contains('hidden') === true);
// Menu shows the seed best and the best rank (TESTSEED is a custom seed).
H.quitToMenu();
check('menu shows seed best', /SEED BEST 2,500/.test(els.dailyBestLine.textContent), els.dailyBestLine.textContent);
check('menu shows best rank', /BEST RANK: HEX RUNNER/.test(els.rankLine.textContent) && /HEX HUNTER at 5,000/.test(els.rankLine.textContent), els.rankLine.textContent);
check('menu seed line names the custom seed', /CUSTOM SEED TESTSEED/.test(els.seedLine.textContent), els.seedLine.textContent);
// Shareable seed (backlog #26): the URL replays this seed.
check('seed URL carries the seed', H.seedUrl() === 'https://namdev-muse.github.io/neon-hexfall/?seed=TESTSEED', H.seedUrl());
// No clipboard API in the harness, so shareSeed falls back to showing the link.
H.shareSeed(els.shareBtn);
check('share fallback shows the link', els.seedLine.textContent.indexOf('?seed=TESTSEED') !== -1, els.seedLine.textContent);
H.render();
check('render with rank line runs clean', true);

console.log('== top-5 table, game-over stats, powerup HUD (block 7) ==');
// Top-5 table (backlog #44): a fresh table takes the first run, keeps the
// best five in order, drops a 6th-place run, and highlights the new entry.
global.localStorage.removeItem('nhx-top5');
check('top-5 starts empty', H.loadTop5().length === 0);
H.newGame();
S.score = 1200;
H.gameOver();
check('first run makes top-5 at #1', S.top5Rank === 0, 'rank ' + S.top5Rank);
check('top-5 saved to localStorage', H.loadTop5().length === 1 && H.loadTop5()[0].score === 1200);
check('top-5 badge shown', els.top5Badge.classList.contains('hidden') === false);
check('game-over top-5 shows the run', /1,200/.test(els.overTop5.innerHTML), els.overTop5.innerHTML);
check('game-over top-5 highlights the new entry', /top5-row me/.test(els.overTop5.innerHTML), els.overTop5.innerHTML);
// Fill the table with higher scores, then a low run that misses the cut.
[5000, 4000, 3000, 2000].forEach(function (sc) { H.newGame(); S.score = sc; H.gameOver(); });
check('top-5 holds five runs, best first', H.loadTop5().length === 5 && H.loadTop5()[0].score === 5000 && H.loadTop5()[4].score === 1200);
H.newGame();
S.score = 100;
H.gameOver();
check('6th-place run misses the table', S.top5Rank === null, 'rank ' + S.top5Rank);
check('top-5 badge hidden when the run misses', els.top5Badge.classList.contains('hidden') === true);
check('table unchanged by the miss', H.loadTop5().length === 5 && H.loadTop5()[4].score === 1200);
// A mid-table run slots in at its position and bumps the lowest out.
H.newGame();
S.score = 2500;
H.gameOver();
check('mid run slots in at #4', S.top5Rank === 3, 'rank ' + S.top5Rank);
check('lowest run bumped out', H.loadTop5()[4].score === 2000, JSON.stringify(H.loadTop5().map(function (e) { return e.score; })));
// Menu shows the same table (no highlight on the menu).
H.quitToMenu();
check('menu shows the top-5 table', /5,000/.test(els.top5List.innerHTML) && /2,500/.test(els.top5List.innerHTML), els.top5List.innerHTML);
check('menu table has no highlight', !/top5-row me/.test(els.top5List.innerHTML));
// Corrupt stored data never breaks the game.
global.localStorage.setItem('nhx-top5', 'not-json{');
check('corrupt top-5 loads as empty', H.loadTop5().length === 0);
H.newGame();
S.score = 800;
H.gameOver();
check('record works after corrupt data', S.top5Rank === 0 && H.loadTop5().length === 1);
// Game-over stats screen (backlog #39): structured grid with accuracy.
H.newGame();
S.hexesCleared = 30; S.pieces = 10; S.matches = 4; S.bestChain = 3;
S.score = 900;
H.gameOver();
check('stats grid has labelled rows', /stat-row/.test(els.overStats.innerHTML) && /SCORE/.test(els.overStats.innerHTML) && /BEST CHAIN/.test(els.overStats.innerHTML), els.overStats.innerHTML);
check('stats grid shows accuracy 3.0 hexes / trio', /ACCURACY/.test(els.overStats.innerHTML) && /3\.0 hexes \/ trio/.test(els.overStats.innerHTML), els.overStats.innerHTML);
check('stats grid shows time + level + rank', /TIME/.test(els.overStats.innerHTML) && /LEVEL/.test(els.overStats.innerHTML) && /RANK/.test(els.overStats.innerHTML));
// Powerup HUD indicators (backlog #11): live bomb/rainbow counts on board.
H.newGame();
H.setCell(0, 10, H.BOMB); H.setCell(1, 10, H.BOMB); H.setCell(2, 10, H.RAINBOW);
H.updateHUD();
check('specials strip counts bombs + rainbows', /💣 2 ON BOARD/.test(els.specialsStrip.textContent) && /🌈 1 ON BOARD/.test(els.specialsStrip.textContent), els.specialsStrip.textContent);
check('countSpecials matches the board', H.countSpecials().bombs === 2 && H.countSpecials().rainbows === 1);
H.setCell(0, 10, null); H.setCell(1, 10, null); H.setCell(2, 10, null);
S.specialsSpawned = 0;
H.updateHUD();
check('strip falls back to the hint when empty', /Special hexes drop in trios/.test(els.specialsStrip.textContent), els.specialsStrip.textContent);
// Next-trio specials are flagged in the strip.
H.newGame();
S.next = [H.BOMB, 1, 2];
H.updateHUD();
check('strip flags a bomb in the next trio', /NEXT: 💣/.test(els.specialsStrip.textContent), els.specialsStrip.textContent);
// Active timed effects (backlog #11): countdown renders, then expires.
H.newGame();
H.addFx('slow-tide', 'SLOW TIDE', 15000);
H.updateHUD();
check('active effect shows a 15s countdown', /SLOW TIDE 15s/.test(els.specialsStrip.textContent), els.specialsStrip.textContent);
H.step(5000);
H.updateHUD();
check('countdown ticks down with run time', /SLOW TIDE 10s/.test(els.specialsStrip.textContent), els.specialsStrip.textContent);
H.step(10000);
H.updateHUD();
check('expired effect leaves the strip', !/SLOW TIDE/.test(els.specialsStrip.textContent), els.specialsStrip.textContent);
check('expired effect removed from state', S.activeFx.length === 0);
H.addFx('slow-tide', 'SLOW TIDE', 5000);
H.addFx('slow-tide', 'SLOW TIDE', 9000);
check('re-adding an effect replaces it', S.activeFx.length === 1 && S.activeFx[0].until === S.timeMs + 9000);
H.removeFx('slow-tide');
check('removeFx drops the effect', S.activeFx.length === 0);

console.log('== touch controls: tap, swipe, flick (block 8, #41) ==');
// Tap zones: left third moves left, right third moves right, middle rotates.
H.newGame();
const tapCol = S.piece.col;
H.touchStart(60, 300); H.touchEnd(60, 300);
check('tap left third moves left', S.piece.col === tapCol - 1, 'col ' + S.piece.col);
H.touchStart(420, 300); H.touchEnd(420, 300);
check('tap right third moves right', S.piece.col === tapCol, 'col ' + S.piece.col);
const rotBefore = S.piece.colors.slice();
H.touchStart(240, 300); H.touchEnd(240, 300);
check('tap middle rotates', S.piece.colors[0] === rotBefore[2] && S.piece.colors[1] === rotBefore[0]);
// Horizontal drag: one column per ~45px (COL_W) of travel.
H.newGame();
const dragCol = S.piece.col;
H.touchStart(240, 300);
H.touchMove(240 + 95, 300); // ~2 columns right
check('drag right moves ~2 columns', S.piece.col === dragCol + 2, 'col ' + S.piece.col + ' from ' + dragCol);
H.touchMove(240 + 95 - 50, 300); // ~1 column back left
check('drag back left moves 1 column', S.piece.col === dragCol + 1, 'col ' + S.piece.col);
H.touchEnd(240 + 45, 300);
// Drag down and hold: soft drop while held, released on pointer-up.
H.newGame();
H.touchStart(240, 100);
H.touchMove(240, 170);
check('drag down sets soft drop', S.softDrop === true);
H.touchEnd(240, 170);
check('soft drop clears on release', S.softDrop === false);
// Fast downward flick: hard drop locks the piece.
H.newGame();
const flickPieces = S.pieces;
H.touchStart(240, 100);
S.touch.t0 = Date.now() - 100; // flick happened fast
H.touchEnd(240, 210);
check('fast down flick hard-drops', S.pieces === flickPieces + 1, 'pieces ' + S.pieces);
// Swipes do nothing when not playing.
H.newGame();
H.togglePause();
const pausedCol = S.piece.col;
H.touchStart(60, 300); H.touchEnd(60, 300);
check('tap ignored while paused', S.piece.col === pausedCol);
H.togglePause();
H.quitToMenu();
H.touchStart(60, 300);
check('swipe ignored on menu', S.touch.active === false);

console.log('== keyboard-only play (block 8, #42) ==');
// Boot puts keyboard focus on PLAY and tracks the menu overlay.
check('menu overlay tracked at boot', S.overlay === 'menuOverlay', S.overlay);
check('boot focuses PLAY', S.kbdFocus === 'playBtn', S.kbdFocus);
H.handleKey('ArrowDown');
check('ArrowDown moves focus to HOW TO PLAY', S.kbdFocus === 'howBtn', S.kbdFocus);
H.handleKey('ArrowDown');
check('ArrowDown moves focus to SHARE', S.kbdFocus === 'shareBtn', S.kbdFocus);
H.handleKey('ArrowDown');
check('ArrowDown moves focus to the shake toggle', S.kbdFocus === 'shakeToggle', S.kbdFocus);
H.handleKey('ArrowDown');
check('ArrowDown moves focus to the motion toggle', S.kbdFocus === 'motionToggle', S.kbdFocus);
H.handleKey('ArrowDown');
check('ArrowDown moves focus to the music toggle', S.kbdFocus === 'musicToggle', S.kbdFocus);
// Block 17: the SFX toggle and the style cycler sit after the music
// toggle, before the four mode buttons.
H.handleKey('ArrowDown');
check('ArrowDown moves focus to the SFX toggle', S.kbdFocus === 'sfxToggle', S.kbdFocus);
H.handleKey('ArrowDown');
check('ArrowDown moves focus to the music style button', S.kbdFocus === 'styleBtn', S.kbdFocus);
// Block 15: the four mode buttons sit at the end of the menu cycle.
H.handleKey('ArrowDown');
check('ArrowDown moves focus to the classic mode button', S.kbdFocus === 'modeClassic', S.kbdFocus);
H.handleKey('ArrowDown');
check('ArrowDown moves focus to the blitz mode button', S.kbdFocus === 'modeBlitz', S.kbdFocus);
H.handleKey('ArrowDown');
check('ArrowDown moves focus to the endless mode button', S.kbdFocus === 'modeEndless', S.kbdFocus);
H.handleKey('ArrowDown');
check('ArrowDown moves focus to the zen mode button', S.kbdFocus === 'modeZen', S.kbdFocus);
H.handleKey('ArrowDown');
check('menu nav wraps to PLAY', S.kbdFocus === 'playBtn', S.kbdFocus);
H.handleKey('ArrowUp');
check('ArrowUp wraps back to the zen mode button', S.kbdFocus === 'modeZen', S.kbdFocus);
// Enter on HOW TO PLAY opens the how-to overlay; Escape steps back.
// From the zen button, ten ups walk back past the other mode buttons,
// style, SFX, music, motion, shake and share.
H.handleKey('ArrowUp'); H.handleKey('ArrowUp'); H.handleKey('ArrowUp'); H.handleKey('ArrowUp');
H.handleKey('ArrowUp'); H.handleKey('ArrowUp'); H.handleKey('ArrowUp'); H.handleKey('ArrowUp');
H.handleKey('ArrowUp'); H.handleKey('ArrowUp'); // howBtn
check('ArrowUp lands on HOW TO PLAY', S.kbdFocus === 'howBtn', S.kbdFocus);
H.handleKey('Enter');
check('Enter opens how-to overlay', S.overlay === 'howOverlay', S.overlay);
check('how-to focuses GOT IT first', S.kbdFocus === 'howCloseBtn', S.kbdFocus);
H.handleKey('ArrowDown');
check('how-to nav reaches BACK TO MENU', S.kbdFocus === 'howMenuBtn', S.kbdFocus);
H.handleKey('Escape');
check('Escape returns to menu', S.overlay === 'menuOverlay' && S.kbdFocus === 'playBtn', S.overlay + ' / ' + S.kbdFocus);
// Enter on PLAY starts a run.
H.handleKey('Enter');
check('Enter on PLAY starts a run', S.state === 'playing' && S.overlay === null, S.state + ' / ' + S.overlay);
check('focus cleared in-game', S.kbdFocus === null);
// Pause menu: nav + Enter on QUIT returns to the menu.
H.handleKey('KeyP');
check('P pauses', S.state === 'paused');
check('pause focuses RESUME', S.kbdFocus === 'resumeBtn', S.kbdFocus);
H.handleKey('ArrowDown');
// Block 17: the pause overlay's SFX toggle sits between RESUME and RESTART.
check('pause nav to SFX', S.kbdFocus === 'pauseSfxToggle', S.kbdFocus);
H.handleKey('ArrowDown');
check('pause nav to RESTART', S.kbdFocus === 'restartBtn', S.kbdFocus);
H.handleKey('ArrowDown');
check('pause nav to QUIT', S.kbdFocus === 'quitBtn', S.kbdFocus);
H.handleKey('Enter');
check('Enter on QUIT returns to menu', S.state === 'menu' && S.overlay === 'menuOverlay', S.state + ' / ' + S.overlay);
// Game-over menu: nav + share + menu.
H.newGame();
H.gameOver();
check('game over focuses PLAY AGAIN', S.kbdFocus === 'againBtn', S.kbdFocus);
H.handleKey('ArrowDown');
check('game-over nav to SHARE', S.kbdFocus === 'shareBtnOver', S.kbdFocus);
H.handleKey('Enter');
check('Enter on SHARE shows the seed link', els.seedLine.textContent.indexOf('?seed=TESTSEED') !== -1, els.seedLine.textContent);
H.handleKey('ArrowDown');
check('game-over nav to MENU', S.kbdFocus === 'overMenuBtn', S.kbdFocus);
H.handleKey('Enter');
check('Enter on MENU quits to menu', S.state === 'menu' && S.overlay === 'menuOverlay', S.state + ' / ' + S.overlay);
// A focused volume slider keeps the arrow keys (no menu nav hijack).
H.handleKey('ArrowDown', { preventDefault: function () {}, target: { tagName: 'INPUT' } });
check('arrows on a slider do not move menu focus', S.kbdFocus === 'playBtn', S.kbdFocus);
// Mute still works from the menu.
const mm0 = S.muted;
H.handleKey('KeyM');
check('M mutes from the menu', S.muted !== mm0);
H.handleKey('KeyM');

console.log('== small-phone responsive pass (block 8, #43) ==');
const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
check('narrow-phone breakpoint exists', css.indexOf('@media (max-width: 380px)') !== -1);
check('short-screen compact breakpoint exists', css.indexOf('@media (max-height: 760px)') !== -1);
check('safe-area insets used', css.indexOf('env(safe-area-inset') !== -1);
check('overscroll disabled', css.indexOf('overscroll-behavior: none') !== -1);
check('thumb-sized touch buttons on coarse pointers', /@media \(pointer: coarse\)[\s\S]*?\.tc-btn \{ height: 56px/.test(css), 'coarse tc-btn height');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
check('viewport blocks pinch-zoom on the board', html.indexOf('user-scalable=no') !== -1 && html.indexOf('maximum-scale=1.0') !== -1);
check('touch controls present', html.indexOf('tcLeft') !== -1 && html.indexOf('tcDrop') !== -1);
check('version bumped to 1.0.0', html.indexOf('v1.0.0') !== -1);

console.log('== tide surge variants (block 9, #15/#16/#17) ==');
// Double-surge chance (backlog #15): none below level 4, 20% at 4,
// +10% per level, capped at 60%.
check('no double surge below level 4', H.doubleSurgeChance(1) === 0 && H.doubleSurgeChance(3) === 0);
check('double surge 20% at level 4', H.doubleSurgeChance(4) === 0.2, H.doubleSurgeChance(4));
check('double surge 30% at level 5', H.doubleSurgeChance(5) === 0.3, H.doubleSurgeChance(5));
check('double surge caps at 60%', H.doubleSurgeChance(10) === 0.6 && H.doubleSurgeChance(99) === 0.6);
// Slag patterns (backlog #16): levels 1-2 always surge a full row.
H.newGame();
check('level 1-2 pattern is always full', H.pickSurgePattern() === 'full', H.pickSurgePattern());
// Full surge: bottom row all slag, cells above shift up one row.
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 1);
H.surgeTide('full');
check('full surge fills the bottom row with slag', [0, 1, 2, 3, 4, 5, 6, 7].every(function (c) { return H.getCell(c, 10) === H.SLAG; }));
check('full surge shifts the board up one row', H.getCell(0, 9) === 0 && H.getCell(0, 8) === 1, H.getCell(0, 9) + '/' + H.getCell(0, 8));
check('surge counted + pattern tracked', S.surges === 1 && S.lastSurgePattern === 'full', S.surges + '/' + S.lastSurgePattern);
check('tide resets to 25 after a surge', S.tide === 25, 'tide ' + S.tide);
// Gaps surge: bottom row is slag except 1-2 gaps.
H.newGame();
H.surgeTide('gaps');
const gapRow = [0, 1, 2, 3, 4, 5, 6, 7].map(function (c) { return H.getCell(c, 10); });
const gapSlag = gapRow.filter(function (v) { return v === H.SLAG; }).length;
check('gaps surge leaves 1-2 gaps in the slag row', gapSlag === 6 || gapSlag === 7, 'slag ' + gapSlag + '/8');
check('gaps pattern tracked', S.lastSurgePattern === 'gaps', S.lastSurgePattern);
// Regression (block 11, #46): the old gaps code cleared the bottom cell
// after shifting, leaving the whole column suspended in mid-air. Gap
// columns must stay compact — no floating hexes, on any board.
H.newGame();
for (let c = 0; c < 8; c++) for (let r = 7; r < 11; r++) H.setCell(c, r, (c + r) % 6);
let gapsClean = true;
for (let i = 0; i < 10; i++) {
  H.surgeTide('gaps');
  if (H.validateBoard().length) { gapsClean = false; break; }
}
check('gaps surges never leave floating hexes', gapsClean, JSON.stringify(H.validateBoard()));
// Columns surge: exactly 3 columns rise two rows of slag, others untouched.
H.newGame();
H.surgeTide('columns');
const colSlag10 = [0, 1, 2, 3, 4, 5, 6, 7].filter(function (c) { return H.getCell(c, 10) === H.SLAG; });
const colSlag9 = [0, 1, 2, 3, 4, 5, 6, 7].filter(function (c) { return H.getCell(c, 9) === H.SLAG; });
check('columns surge raises exactly 3 columns', colSlag10.length === 3 && colSlag9.length === 3, colSlag10 + ' / ' + colSlag9);
check('columns surge hits the same 3 columns on both rows', JSON.stringify(colSlag10) === JSON.stringify(colSlag9));
check('columns pattern tracked', S.lastSurgePattern === 'columns', S.lastSurgePattern);
// Double surge (backlog #15): force a favourable roll at level 4, then the
// second surge fires 2.5s later and cannot schedule a third.
H.newGame();
S.level = 4;
S.rng = function () { return 0; }; // every roll succeeds
H.surgeTide('full');
check('double surge scheduled at level 4', S.pendingSurgeAt !== null && S.pendingSurgeAt === S.timeMs + 2500, 'pending ' + S.pendingSurgeAt);
check('double surge counted', S.doubleSurges === 1, 'doubles ' + S.doubleSurges);
check('double surge warning float shown', S.floats.some(function (f) { return /DOUBLE SURGE/.test(f.text); }));
S.pendingSurgeAt = S.timeMs + 100; // bring the second surge forward
H.step(200);
check('second surge fired on schedule', S.pendingSurgeAt === null, 'pending ' + S.pendingSurgeAt);
check('second surge added a second slag row', H.getCell(0, 9) === H.SLAG && H.getCell(0, 10) === H.SLAG, H.getCell(0, 9) + '/' + H.getCell(0, 10));
check('second surge did not schedule a third', S.pendingSurgeAt === null && S.doubleSurges === 1, 'doubles ' + S.doubleSurges);
// Tide warning (backlog #17): in the last 20% the HUD bar flashes red and
// a soft pulse tick repeats every 1.5s; after the surge the warning clears.
H.newGame();
const warnBefore = H.audio.played.surgewarn || 0;
H.setTide(79);
H.step(1000); // crosses 80
check('surge warning alarm at 80% tide', (H.audio.played.surgewarn || 0) > warnBefore, 'tide ' + S.tide);
check('HUD tide bar flashes red in the last 20%', els.tideFill.classList.contains('warn') === true);
const tickBefore = H.audio.played.tidepulse || 0;
H.step(2000);
check('tide warning tick repeats while tide is high', (H.audio.played.tidepulse || 0) > tickBefore, JSON.stringify(H.audio.played));
H.render();
check('render with pulsing waterline runs clean', true);
const surgesBefore = S.surges;
H.setTide(99.5);
H.step(1000); // surge fires, tide resets
check('surge fires from the warning zone', S.surges === surgesBefore + 1, 'surges ' + S.surges);
check('warning clears after the surge', els.tideFill.classList.contains('warn') === false, 'tide ' + S.tide);
// Game-over stats list surges and double surges.
H.newGame();
S.surges = 2; S.doubleSurges = 1;
H.gameOver();
check('stats grid shows surges + double surges', /SURGES/.test(els.overStats.innerHTML) && /DOUBLE SURGES/.test(els.overStats.innerHTML), els.overStats.innerHTML);

console.log('== elite hexes: armored, locked, bonus star (block 10, #12/#13/#14) ==');
// Helper: fresh game, place cells with optional elite flags, drop a trio
// with optional elite flags, return the score.
function matchElite(cells, piece) {
  H.newGame();
  cells.forEach(function (cell) {
    H.setCell(cell[0], cell[1], cell[2]);
    if (cell[3]) {
      if (cell[3].armor) H.setArmor(cell[0], cell[1], cell[3].armor);
      if (cell[3].locked) H.setLocked(cell[0], cell[1], true);
      if (cell[3].star) H.setStar(cell[0], cell[1], true);
    }
  });
  H.setPiece(piece[0], piece[1], piece[2], piece[3]);
  H.hardDrop();
  return S.score;
}
// Elite drops are level-gated (backlog #12/#13/#14): nothing at level 1,
// stars/armor from level 2, locks from level 3.
check('no elites at level 1', H.eliteChance(1).star === 0 && H.eliteChance(1).armor === 0 && H.eliteChance(1).lock === 0);
check('stars + armor open at level 2, locks not yet', H.eliteChance(2).star > 0 && H.eliteChance(2).armor > 0 && H.eliteChance(2).lock === 0);
check('locks open at level 3', H.eliteChance(3).lock > 0);
check('elite chances grow with level', H.eliteChance(5).armor > H.eliteChance(2).armor);
// rollEliteFlags with a forced rng: 0 -> star, 0.06 -> armor (L2),
// 0.15 -> lock (L3), 0.99 -> none.
H.newGame();
S.level = 2;
S.rng = function () { return 0; };
let ef = H.rollEliteFlags([0, 1, 2]);
check('forced roll 0 drops a star', ef.star[0] === true && ef.armored.every(function (v) { return !v; }) && ef.locked.every(function (v) { return !v; }), JSON.stringify(ef));
S.rng = function () { return 0.06; };
ef = H.rollEliteFlags([0, 1, 2]);
check('forced roll 0.06 drops an armored hex', ef.armored[0] === true && ef.star.every(function (v) { return !v; }), JSON.stringify(ef));
S.level = 3;
S.rng = function () { return 0.15; };
ef = H.rollEliteFlags([0, 1, 2]);
check('forced roll 0.15 drops a locked hex', ef.locked[0] === true, JSON.stringify(ef));
S.rng = function () { return 0.99; };
ef = H.rollEliteFlags([0, 1, 2]);
check('forced roll 0.99 drops no elite', ef.star.every(function (v) { return !v; }) && ef.armored.every(function (v) { return !v; }) && ef.locked.every(function (v) { return !v; }));
// An elite never lands on a bomb/rainbow slot — it moves to a normal slot.
S.level = 2;
S.rng = function () { return 0; };
ef = H.rollEliteFlags([H.BOMB, 1, 2]);
check('elite skips a bomb slot', ef.star[1] === true && ef.star[0] === false, JSON.stringify(ef));
// At most one elite per trio, across many random rolls.
let oneMax = true;
let seed2 = 999;
const rnd2 = function () { seed2 = (seed2 * 1103515245 + 12345) & 0x7fffffff; return seed2 / 0x7fffffff; };
H.newGame();
S.level = 5;
for (let i = 0; i < 200; i++) {
  S.rng = rnd2;
  const f = H.rollEliteFlags([0, 1, 2]);
  const n = f.star.filter(Boolean).length + f.armored.filter(Boolean).length + f.locked.filter(Boolean).length;
  if (n > 1) { oneMax = false; break; }
}
check('at most one elite per trio', oneMax);

// Armored hex (backlog #12): first match cracks it (armor 2 -> 1), the
// other two cells clear for 200; the cracked hex stays on the board.
const sc1 = matchElite([[0, 10, 0, { armor: 2 }], [0, 9, 0]], [1, 8, [1, 2, 0]]);
check('armored hex cracks instead of clearing', H.getCell(0, 10) === 0 && H.getArmor(0, 10) === 1, 'cell ' + H.getCell(0, 10) + ' armor ' + H.getArmor(0, 10));
check('crack pays only for the two cleared hexes (200)', sc1 === 200, 'score ' + sc1);
check('crack counted', S.armorCracked === 1, 'cracked ' + S.armorCracked);
check('crack SFX played', (H.audio.played.crack || 0) >= 1, JSON.stringify(H.audio.played));
check('cracked hex shows a CRACK float', S.floats.some(function (f) { return /CRACK/.test(f.text); }));
// Second hit clears it: re-form the match around the cracked hex.
H.setCell(0, 9, 0); H.setCell(1, 10, 0);
H.setPiece(3, 8, [3, 4, 5]);
H.hardDrop();
check('second hit clears the armored hex', H.getCell(0, 10) === null && H.getArmor(0, 10) === 0);
check('armored clear counted', S.armoredCleared === 1, 'cleared ' + S.armoredCleared);
// The second hit lands within 5s of the first clear, so the combo timer
// (backlog #4) pays +25% on it: 200 + (300 + 75) = 575.
check('second hit scores a full 3-match + combo bonus (total 575)', S.score === 575, 'score ' + S.score);
// An all-armored group cracks in one pass and clears in the next, without
// inflating the chain: 3 armored hexes pay a plain 300 at chain x1.
const sc2 = matchElite(
  [[0, 10, 0, { armor: 2 }], [0, 9, 0, { armor: 2 }]],
  [1, 8, [1, 2, 0], { armored: [false, false, true] }]);
check('all-armored group clears after cracking', H.getCell(0, 10) === null && H.getCell(0, 9) === null && H.getArmor(1, 10) === 0,
  'cells ' + H.getCell(0, 10) + '/' + H.getCell(0, 9) + '/' + H.getCell(1, 10) + ' armor ' + H.getArmor(1, 10));
check('all-armored group scores a plain 300', sc2 === 300, 'score ' + sc2);
check('armor-only pass does not inflate the chain', S.chain === 1 && S.bestChain === 1, 'chain ' + S.chain);
check('six cracks (3 hexes x 2 hits) + three clears counted', S.armorCracked === 6 && S.armoredCleared === 3, S.armorCracked + '/' + S.armoredCleared);

// Locked hex (backlog #13): it never joins a match — two colour-0 cells
// next to a locked 0 are only a pair, so nothing clears.
const sc3 = matchElite([[0, 10, 0, { locked: true }], [0, 9, 0]], [1, 8, [1, 2, 0]]);
check('locked hex does not join a match', sc3 === 0, 'score ' + sc3);
check('locked hex stays on the board', H.getCell(0, 10) === 0 && S.locked[0][10] === true);
check('no group found through a locked hex', H.findGroups().length === 0);
// A match clearing next to it breaks the lock (+50); the hex stays.
H.newGame();
H.setCell(0, 10, 0); H.setLocked(0, 10, true);
H.setCell(0, 9, 1); H.setCell(1, 9, 1); H.setCell(1, 10, 1);
H.setPiece(4, 8, [3, 4, 5]);
H.hardDrop();
check('adjacent clear unlocks the hex', S.locked[0][10] === false && H.getCell(0, 10) === 0, 'locked ' + S.locked[0][10]);
check('lock broken counted', S.lockedUnlocked === 1, 'unlocked ' + S.lockedUnlocked);
check('unlock pays 300 match + 50 unlock (350)', S.score === 350, 'score ' + S.score);
check('unlock SFX played', (H.audio.played.unlock || 0) >= 1, JSON.stringify(H.audio.played));
// Once unlocked, the hex can match normally.
H.setCell(0, 9, 0); H.setCell(1, 10, 0);
const groups = H.findGroups();
check('unlocked hex joins a group again', groups.some(function (g) { return g.some(function (cell) { return cell[0] === 0 && cell[1] === 10; }); }), JSON.stringify(groups));

// Bonus star (backlog #14): a star in a 3-match pays 300 + 250.
const sc4 = matchElite([[0, 10, 0, { star: true }], [0, 9, 0]], [1, 8, [1, 2, 0]]);
check('star match pays 300 + 250 bonus (550)', sc4 === 550, 'score ' + sc4);
check('star clear counted', S.starsCleared === 1, 'stars ' + S.starsCleared);
check('star flag cleared with the hex', S.star[0][10] === false && H.getCell(0, 10) === null);
check('star SFX played', (H.audio.played.star || 0) >= 1, JSON.stringify(H.audio.played));
// A star cleared in a chain x2 cascade pays 250 x 2.
H.newGame();
H.setCell(0, 8, 1); H.setCell(0, 9, 1); H.setCell(0, 10, 1);
H.setCell(1, 8, 1); H.setCell(1, 9, 1);
H.setCell(1, 6, 2); H.setCell(1, 7, 2); H.setCell(1, 10, 2); H.setStar(1, 10, true);
H.setPiece(3, 8, [3, 4, 5]);
H.hardDrop();
check('star in a chain x2 cascade pays 250 x 2 (total 2000)', S.score === 2000, 'score ' + S.score);
check('cascade star counted once', S.starsCleared === 1, 'stars ' + S.starsCleared);

// Rotation cycles elite flags with their hexes.
H.newGame();
H.setPiece(3, 8, [0, 1, 2], { armored: [true, false, false], locked: [false, true, false], star: [false, false, true] });
H.rotatePiece();
check('rotate cycles colours', S.piece.colors[0] === 2 && S.piece.colors[1] === 0 && S.piece.colors[2] === 1);
check('rotate carries elite flags with the hexes', S.piece.armored[1] === true && S.piece.locked[2] === true && S.piece.star[0] === true,
  JSON.stringify({ a: S.piece.armored, l: S.piece.locked, s: S.piece.star }));
// Locking writes the flags onto the board.
H.newGame();
H.setPiece(3, 8, [0, 1, 2], { armored: [true, false, false], locked: [false, true, false], star: [false, false, true] });
H.hardDrop();
check('lock writes armor 2 to the board', H.getCell(3, 8) === 0 && H.getArmor(3, 8) === 2, 'cell ' + H.getCell(3, 8) + ' armor ' + H.getArmor(3, 8));
check('lock writes the locked flag', S.locked[3][9] === true && H.getCell(3, 9) === 1);
check('lock writes the star flag', S.star[3][10] === true && H.getCell(3, 10) === 2);

// Elite flags travel with their hexes through gravity, surges and top-outs.
H.newGame();
H.setCell(2, 5, 3); H.setArmor(2, 5, 2);
H.setCell(2, 4, 4); H.setLocked(2, 4, true);
H.setCell(2, 3, 5); H.setStar(2, 3, true);
H.applyGravity();
check('gravity moves armor with its hex', H.getCell(2, 10) === 3 && H.getArmor(2, 10) === 2, 'cell ' + H.getCell(2, 10) + ' armor ' + H.getArmor(2, 10));
check('gravity moves the lock with its hex', H.getCell(2, 9) === 4 && S.locked[2][9] === true);
check('gravity moves the star with its hex', H.getCell(2, 8) === 5 && S.star[2][8] === true);
check('gravity clears flags left behind', H.getArmor(2, 5) === 0 && S.locked[2][4] === false && S.star[2][3] === false);
// Surge shifts flags up with the board; the new slag carries none.
H.newGame();
H.setCell(0, 10, 0); H.setArmor(0, 10, 2);
H.surgeTide('full');
check('surge shifts armor up with its hex', H.getCell(0, 9) === 0 && H.getArmor(0, 9) === 2, 'cell ' + H.getCell(0, 9) + ' armor ' + H.getArmor(0, 9));
check('surge slag carries no armor', H.getCell(0, 10) === H.SLAG && H.getArmor(0, 10) === 0);
// Top-out tide break clears flags in the top rows.
H.newGame();
H.setCell(0, 0, 1); H.setArmor(0, 0, 2);
H.setCell(0, 1, 2); H.setLocked(0, 1, true);
for (let c = 0; c < 8; c++) { H.setCell(c, 0, 1); H.setCell(c, 1, 2); }
H.spawnPiece();
check('top-out clears armor flags', H.getArmor(0, 0) === 0 && H.getCell(0, 0) === null);
check('top-out clears lock flags', S.locked[0][1] === false && H.getCell(0, 1) === null);

// HUD strip shows elite counts; menu names the next trio's elites.
H.newGame();
H.setCell(0, 10, 0); H.setArmor(0, 10, 2);
H.setCell(1, 10, 1); H.setLocked(1, 10, true);
H.setCell(2, 10, 2); H.setStar(2, 10, true);
H.updateHUD();
check('strip counts armored + locked + stars', /🛡 1 ARMORED/.test(els.specialsStrip.textContent) && /🔒 1 LOCKED/.test(els.specialsStrip.textContent) && /★ 1 STARS/.test(els.specialsStrip.textContent), els.specialsStrip.textContent);
check('countSpecials returns elite counts', H.countSpecials().armored === 1 && H.countSpecials().locked === 1 && H.countSpecials().stars === 1);
H.newGame();
H.quitToMenu();
S.nextElite = { armored: [true, false, false], locked: [false, false, false], star: [false, false, true] };
H.updateHUD();
check('menu names the next trio elites', /🛡/.test(els.menuNext.textContent) && /★/.test(els.menuNext.textContent), els.menuNext.textContent);
check('strip flags elites in the next trio', /NEXT:.*🛡/.test(els.specialsStrip.textContent) && /★/.test(els.specialsStrip.textContent), els.specialsStrip.textContent);
// Game-over stats list the elite counters.
H.newGame();
S.armorCracked = 2; S.armoredCleared = 1; S.lockedUnlocked = 3; S.starsCleared = 2;
H.gameOver();
check('stats grid shows elite counters', /ARMORED CRACKED/.test(els.overStats.innerHTML) && /LOCKS BROKEN/.test(els.overStats.innerHTML) && /STARS/.test(els.overStats.innerHTML), els.overStats.innerHTML);
// Rendering with elites on the board, in the falling trio and in the next
// preview runs clean.
H.newGame();
H.setCell(0, 10, 0); H.setArmor(0, 10, 2);
H.setCell(1, 10, 1); H.setLocked(1, 10, true);
H.setCell(2, 10, 2); H.setStar(2, 10, true);
H.setPiece(3, 8, [0, 1, 2], { armored: [true, false, false], locked: [false, true, false], star: [false, false, true] });
H.render();
check('render with elites runs clean', true);

console.log('== board audit + NaN guards + self-repair (block 11, #48) ==');
// A clean board passes the audit with no issues.
H.newGame();
check('clean board passes the audit', H.validateBoard().length === 0, JSON.stringify(H.validateBoard()));
check('repairs counter starts at 0', S.repairs === 0);
// A planted invalid cell value is found and cleared.
H.setCell(0, 10, 99);
check('audit flags an out-of-range cell value', H.validateBoard().some(function (i) { return /bad cell/.test(i); }), JSON.stringify(H.validateBoard()));
const fixedBad = H.sanitizeState();
check('repair clears the bad cell', H.getCell(0, 10) === null && fixedBad >= 1, 'fixed ' + fixedBad);
check('board passes again after repair', H.validateBoard().length === 0);
// A floating hex (empty cell below a filled one) is found and compacted.
H.newGame();
H.setCell(2, 5, 3);
check('audit flags a floating hex', H.validateBoard().some(function (i) { return /floating hex/.test(i); }), JSON.stringify(H.validateBoard()));
H.sanitizeState();
check('repair compacts the floating hex to the bottom', H.getCell(2, 10) === 3 && H.getCell(2, 5) === null, 'cell(2,10)=' + H.getCell(2, 10));
check('board passes after the gravity repair', H.validateBoard().length === 0);
// A stale elite flag on an empty cell is dropped.
H.newGame();
H.setArmor(4, 10, 2);
check('audit does not flag a bare flag cell directly, repair drops it', H.sanitizeState() >= 1 && H.getArmor(4, 10) === 0, 'armor ' + H.getArmor(4, 10));
// An elite flag on slag is found and dropped.
H.newGame();
H.setCell(0, 10, H.SLAG); H.setArmor(0, 10, 2);
check('audit flags an elite flag on slag', H.validateBoard().some(function (i) { return /elite flag on a special/.test(i); }), JSON.stringify(H.validateBoard()));
H.sanitizeState();
check('repair drops the flag, keeps the slag', H.getCell(0, 10) === H.SLAG && H.getArmor(0, 10) === 0);
// NaN run numbers are found and reset.
H.newGame();
S.score = NaN;
check('audit flags a NaN score', H.validateBoard().some(function (i) { return /bad score/.test(i); }));
H.sanitizeState();
check('repair resets a NaN score to 0', S.score === 0);
check('repairs were counted', S.repairs > 0, 'repairs ' + S.repairs);
// A NaN clock step is ignored, never poisoning time / tide / fall.
H.newGame();
const t0 = S.timeMs, tide0 = S.tide, row0 = S.piece.row;
H.step(NaN);
check('NaN step leaves time untouched', S.timeMs === t0, 'time ' + S.timeMs);
check('NaN step leaves the tide untouched', S.tide === tide0);
check('NaN step leaves the piece untouched', S.piece.row === row0);
H.step(-100);
check('negative step is ignored too', S.timeMs === t0);
// A stuck piece (NaN row) is dropped and a fresh one spawns.
H.newGame();
S.piece.row = NaN;
check('audit flags a NaN piece row', H.validateBoard().some(function (i) { return /bad piece row/.test(i); }));
H.sanitizeState();
check('repair replaces the stuck piece', !!S.piece && isFinite(S.piece.row), 'row ' + (S.piece && S.piece.row));
check('repaired piece is in bounds', S.piece.col >= 0 && S.piece.col < 8);
// The once-a-second audit inside step() repairs corruption on its own.
H.newGame();
H.setCell(0, 10, 99);
S.lastAudit = 0;
H.step(1000); // audit fires at 1000ms of run time
check('step audit repairs a bad cell by itself', H.getCell(0, 10) === null, 'cell ' + H.getCell(0, 10));
check('step audit counted the repair', S.repairs >= 1, 'repairs ' + S.repairs);
H.render();
check('render after repairs runs clean', true);

console.log('== FPS guard: frame-time EMA + low-FX mode (block 11, #47) ==');
H.newGame();
const fs0 = H.frameStats();
check('frame stats start at 16ms EMA, low-FX off', fs0.ema === 16 && fs0.lowFx === false && fs0.frames === 0, JSON.stringify(fs0));
// 30 slow frames (100ms each) push the EMA over the 40ms trip point.
for (let i = 0; i < 30; i++) H.noteFrame(100);
const fsSlow = H.frameStats();
check('sustained slow frames trip low-FX mode', fsSlow.lowFx === true && fsSlow.ema > 40, JSON.stringify(fsSlow));
check('slow frames counted', fsSlow.frames === 30, 'frames ' + fsSlow.frames);
// Low-FX mode halves particle spawns.
S.particles = [];
H.render(); // render once in low-FX to prove the no-glow path runs clean
// burst() is internal; exercise it through a clear that bursts particles.
H.setCell(0, 10, 0); H.setCell(0, 9, 0);
H.setPiece(1, 8, [1, 2, 0]);
H.hardDrop();
const lowFxParticles = S.particles.length;
check('low-FX clear spawns fewer particles', lowFxParticles > 0 && lowFxParticles <= 200, 'particles ' + lowFxParticles);
// Back to fast frames: 100 frames at 16ms pull the EMA under 25ms.
for (let i = 0; i < 100; i++) H.noteFrame(16);
const fsFast = H.frameStats();
check('fast frames restore full FX', fsFast.lowFx === false && fsFast.ema < 25, JSON.stringify(fsFast));
// A direct toggle works both ways.
H.setLowFx(true);
check('setLowFx(true) forces low-FX mode', H.frameStats().lowFx === true);
H.setLowFx(false);
check('setLowFx(false) restores full FX', H.frameStats().lowFx === false);
// Bad frame times are ignored, never poisoning the average.
const emaBefore = H.frameStats().ema;
H.noteFrame(NaN);
H.noteFrame(-50);
check('NaN / negative frame times ignored', H.frameStats().ema === emaBefore, H.frameStats().ema + ' vs ' + emaBefore);
H.render();
check('render in full-FX mode runs clean', true);

console.log('== visual polish: shockwave rings, confetti, chain fire ==');
// 5-match spawns exactly one shockwave ring (stray cell blocks all-clear)
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0); H.setCell(0, 8, 0); H.setCell(0, 7, 0);
H.setCell(7, 10, 3);
H.setPiece(1, 8, [1, 2, 0]);
H.hardDrop();
check('5-match spawns a shockwave ring', S.rings.length === 1, 'rings ' + S.rings.length);
check('ring has position, colour and radius', S.rings.length === 1 && S.rings[0].x > 0 && S.rings[0].y > 0 && S.rings[0].color && S.rings[0].maxR >= 120 && S.rings[0].life > 0 && S.rings[0].max > 0);
// 6-match spawns a second white ring
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0); H.setCell(0, 8, 0); H.setCell(0, 7, 0); H.setCell(0, 6, 0);
H.setCell(7, 10, 3);
H.setPiece(1, 8, [1, 2, 0]);
H.hardDrop();
check('6-match spawns two rings', S.rings.length === 2, 'rings ' + S.rings.length);
check('second ring is white and wider', S.rings.some(function (g) { return g.color === '#ffffff' && g.maxR > 170; }));
// 3-match spawns no ring
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0);
H.setCell(7, 10, 3);
H.setPiece(1, 8, [1, 2, 0]);
H.hardDrop();
check('3-match spawns no ring', S.rings.length === 0, 'rings ' + S.rings.length);
// ring lifecycle through updateFx
H.newGame();
H.addRing(240, 300, '#ff2d95', 150);
check('addRing spawns a ring', S.rings.length === 1);
H.updateFx(300);
check('ring fades over time', S.rings.length === 1 && S.rings[0].life < S.rings[0].max, 'life ' + (S.rings[0] && S.rings[0].life));
H.updateFx(400);
check('ring expires', S.rings.length === 0);
H.newGame();
for (let i = 0; i < 12; i++) H.addRing(240, 300, '#ffffff', 120);
check('rings capped at 8', S.rings.length === 8, 'rings ' + S.rings.length);
// level-up confetti
H.newGame();
S.clears = 5;
H.setCell(0, 10, 0); H.setCell(0, 9, 0);
H.setPiece(1, 8, [1, 2, 0]);
H.hardDrop();
check('level-up reached', S.level === 2, 'level ' + S.level);
check('level-up bursts confetti', S.confetti.length > 0, 'confetti ' + S.confetti.length);
check('confetti pieces have colour, fall speed and spin', S.confetti.every(function (f) { return f.color && f.vy > 0 && f.vr !== 0 && f.life > 0; }));
const cy0 = S.confetti[0].y;
H.updateFx(500);
check('confetti falls', S.confetti.length > 0 && S.confetti[0].y > cy0, 'y ' + (S.confetti[0] && S.confetti[0].y) + ' vs ' + cy0);
H.updateFx(3000);
check('confetti expires', S.confetti.length === 0, 'confetti ' + S.confetti.length);
// chain fire
H.newGame();
H.igniteChainFire(3, 240, 300);
check('chain fire ignites at x3', S.chainFire === 3 && S.chainFireT > 0, 'fire ' + S.chainFire + ' t ' + S.chainFireT);
check('ignition bursts flames at the clear', S.particles.some(function (p) { return p.flame; }), 'particles ' + S.particles.length);
const flames0 = S.particles.filter(function (p) { return p.flame; }).length;
const fy0 = S.particles.filter(function (p) { return p.flame; })[0].y;
H.updateFx(100);
const flames1 = S.particles.filter(function (p) { return p.flame; }).length;
check('chain fire keeps spawning flames', flames1 > flames0, flames1 + ' vs ' + flames0);
const fy1 = S.particles.filter(function (p) { return p.flame; })[0].y;
check('flames rise', fy1 < fy0, fy1 + ' vs ' + fy0);
H.render();
check('render with rings and fire runs clean', true);
H.updateFx(1500);
check('chain fire burns out', S.chainFire === 0 && S.chainFireT === 0, 'fire ' + S.chainFire + ' t ' + S.chainFireT);
// x2 cascade shows a banner but does not ignite
H.newGame();
H.setCell(0, 8, 1); H.setCell(0, 9, 1); H.setCell(0, 10, 1);
H.setCell(1, 8, 1); H.setCell(1, 9, 1);
H.setCell(1, 6, 2); H.setCell(1, 7, 2); H.setCell(1, 10, 2);
H.setPiece(3, 8, [3, 4, 5]);
H.hardDrop();
check('chain x2 shows banner but no fire', !!S.banner && /CHAIN ×2/.test(S.banner.text) && S.chainFire === 0, 'banner ' + (S.banner && S.banner.text) + ' fire ' + S.chainFire);
// new game resets all three FX
H.newGame();
check('new game resets rings, confetti and fire', S.rings.length === 0 && S.confetti.length === 0 && S.chainFire === 0 && S.chainFireT === 0);

console.log('== soak: 2000 random steps ==');
H.newGame();
let threw = null;
const acts = ['left', 'right', 'rot', 'drop', 'none'];
try {
  let seed = 12345;
  const rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 2000; i++) {
    const a = acts[Math.floor(rnd() * acts.length)];
    if (a === 'left') H.movePiece(-1);
    else if (a === 'right') H.movePiece(1);
    else if (a === 'rot') H.rotatePiece();
    else if (a === 'drop') H.hardDrop();
    H.step(50);
    if (S.state === 'over') H.newGame();
  }
} catch (e) { threw = e; }
check('soak ran without throwing', threw === null, threw && threw.stack);
let boardOk = true;
for (let c = 0; c < 8; c++) for (let r = 0; r < 11; r++) {
  const v = H.getCell(c, r);
  if (v !== null && (v < 0 || v > 10 || Math.floor(v) !== v)) boardOk = false;
}
check('board cells always valid (0-10 or null)', boardOk);
check('score never negative', S.score >= 0);
check('lives in range', S.lives >= 0 && S.lives <= 3);

console.log('== README screenshots + repo polish (block 13, #55/#56/#58) ==');
const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
check('README shows the gameplay screenshot', readme.indexOf('docs/screenshot-gameplay.png') !== -1);
check('README shows the gameplay GIF', readme.indexOf('docs/gameplay.gif') !== -1);
check('README shows the menu screenshot', readme.indexOf('docs/screenshot-menu.png') !== -1);
function fileOk(rel, minBytes) {
  try { const st = fs.statSync(path.join(__dirname, '..', rel)); return st.isFile() && st.size >= minBytes; }
  catch (e) { return false; }
}
check('gameplay screenshot exists and is a real image', fileOk('docs/screenshot-gameplay.png', 50000), 'docs/screenshot-gameplay.png');
check('menu screenshot exists and is a real image', fileOk('docs/screenshot-menu.png', 50000), 'docs/screenshot-menu.png');
const gifBuf = fs.readFileSync(path.join(__dirname, '..', 'docs/gameplay.gif'));
check('gameplay GIF exists and has a GIF89a header', gifBuf.length > 50000 && gifBuf.slice(0, 6).toString() === 'GIF89a', gifBuf.length + ' bytes');
const bugTpl = fs.readFileSync(path.join(__dirname, '..', '.github/ISSUE_TEMPLATE/bug_report.md'), 'utf8');
check('bug template has front-matter + repro steps', bugTpl.indexOf('name: Bug report') !== -1 && bugTpl.indexOf('How to reproduce') !== -1);
const featTpl = fs.readFileSync(path.join(__dirname, '..', '.github/ISSUE_TEMPLATE/feature_request.md'), 'utf8');
check('feature template has front-matter + idea section', featTpl.indexOf('name: Feature request') !== -1 && featTpl.indexOf('The idea') !== -1);
const contrib = fs.readFileSync(path.join(__dirname, '..', 'CONTRIBUTING.md'), 'utf8');
check('CONTRIBUTING names the test commands', contrib.indexOf('node --check game.js') !== -1 && contrib.indexOf('tests/smoke.js') !== -1 && contrib.indexOf('tests/bot.js') !== -1);
const shotJs = fs.readFileSync(path.join(__dirname, '..', 'tests/screenshot.js'), 'utf8');
check('screenshot capture script uses a headless browser', shotJs.indexOf('playwright-core') !== -1 && shotJs.indexOf('screenshot-gameplay.png') !== -1);

console.log('== settings toggles (block 14, #45) ==');
// Defaults: shake on, music on, reduce motion off (no OS preference saved).
// Block 17 (#37): SFX on and the PULSE music style by default.
check('settings default to shake + music on, motion off',
  S.settings.shake === true && S.settings.music === true && S.settings.reduceMotion === false &&
  S.settings.sfx === true && S.settings.musicStyle === 'pulse', JSON.stringify(S.settings));
check('settings buttons synced at boot',
  els.shakeToggle.textContent === '✓ SCREEN SHAKE' && els.motionToggle.textContent === '○ REDUCE MOTION' && els.musicToggle.textContent === '✓ MUSIC',
  els.shakeToggle.textContent + ' / ' + els.motionToggle.textContent + ' / ' + els.musicToggle.textContent);
check('settings buttons expose aria-pressed',
  els.shakeToggle.getAttribute('aria-pressed') === 'true' && els.motionToggle.getAttribute('aria-pressed') === 'false' && els.musicToggle.getAttribute('aria-pressed') === 'true');
H.setSetting('shake', false);
check('shake toggle persists + updates its button',
  S.settings.shake === false && els.shakeToggle.textContent === '○ SCREEN SHAKE' &&
  JSON.parse(store['nhx-settings']).shake === false);
H.newGame();
H.addShake(10);
check('shake off means no shake value', S.shake === 0, 'shake ' + S.shake);
H.setSetting('shake', true);
H.addShake(10);
check('shake on restores shake', S.shake > 0, 'shake ' + S.shake);
H.setSetting('reduceMotion', true);
H.addPop(100, 100, '#fff');
check('reduce motion skips hex pops', S.pops.length === 0);
H.addRing(100, 100, '#fff');
check('reduce motion skips shockwave rings', S.rings.length === 0);
H.spawnConfetti();
check('reduce motion skips confetti bursts', S.confetti.length === 0);
H.igniteChainFire(3, 100, 100);
check('reduce motion skips the chain-fire burn (chain still tracked)', S.chainFireT === 0 && S.chainFire === 3, S.chainFireT + '/' + S.chainFire);
H.setSetting('reduceMotion', false);
H.addPop(100, 100, '#fff');
check('pops resume once reduce motion is off', S.pops.length === 1);
H.setSetting('music', false);
check('music toggle stops the music loop', H.audio.musicOn === false);
H.setSetting('music', true);
check('music toggle restores the music loop', H.audio.musicOn === true);
check('setSetting rejects unknown keys', H.setSetting('nope', true) === false);
// The toggles sit in the menu's keyboard cycle (after SHARE THIS SEED).
H.setSetting('shake', true);
H.quitToMenu();
H.handleKey('ArrowDown'); H.handleKey('ArrowDown'); H.handleKey('ArrowDown');
check('keyboard nav reaches the shake toggle', S.kbdFocus === 'shakeToggle', S.kbdFocus);
H.handleKey('Enter');
check('Enter on the shake toggle flips it', S.settings.shake === false && els.shakeToggle.textContent === '○ SCREEN SHAKE');
H.setSetting('shake', true);

console.log('== accessibility pass (block 14, #51) ==');
H.newGame(); // showOnly(null): every overlay hidden
check('hidden overlays get aria-hidden=true',
  els.menuOverlay.getAttribute('aria-hidden') === 'true' && els.pauseOverlay.getAttribute('aria-hidden') === 'true' &&
  els.overOverlay.getAttribute('aria-hidden') === 'true');
H.quitToMenu();
check('visible menu overlay gets aria-hidden=false, the rest stay hidden',
  els.menuOverlay.getAttribute('aria-hidden') === 'false' && els.howOverlay.getAttribute('aria-hidden') === 'true');
H.newGame();
H.setTide(42); H.updateHUD();
check('tide bar reports its value to assistive tech', els.tideBar.getAttribute('aria-valuenow') === '42', els.tideBar.getAttribute('aria-valuenow'));
H.toggleMute();
check('mute button exposes aria-pressed=true when muted', els.muteBtn.getAttribute('aria-pressed') === 'true');
H.toggleMute();
check('mute button exposes aria-pressed=false when unmuted', els.muteBtn.getAttribute('aria-pressed') === 'false');
H.updateHUD();
check('canvas label carries score, level, lives and tide',
  els.game.getAttribute('aria-label').indexOf('Score 0') !== -1 &&
  els.game.getAttribute('aria-label').indexOf('level 1') !== -1 &&
  els.game.getAttribute('aria-label').indexOf('3 lives') !== -1 &&
  els.game.getAttribute('aria-label').indexOf('tide 42 percent') !== -1,
  els.game.getAttribute('aria-label'));
check('overlays carry aria-modal in the HTML', (html.match(/aria-modal="true"/g) || []).length === 5); // Block 22: menu, how-to, pause, game-over + draft
check('tide bar is a progressbar in the HTML',
  html.indexOf('role="progressbar"') !== -1 && html.indexOf('aria-valuemin="0"') !== -1 && html.indexOf('aria-valuemax="100"') !== -1);
check('canvas describes itself via the board description',
  html.indexOf('aria-describedby="boardDesc"') !== -1 && html.indexOf('id="boardDesc"') !== -1);
check('settings toggles exist in the HTML',
  html.indexOf('id="shakeToggle"') !== -1 && html.indexOf('id="motionToggle"') !== -1 && html.indexOf('id="musicToggle"') !== -1);
check('muted text lightened for contrast', css.indexOf('--muted: #b3a6dd') !== -1);
check('reduced-motion body class switches the CSS animations off',
  css.indexOf('body.reduced-motion .badge') !== -1 && css.indexOf('body.reduced-motion .tide-fill.warn') !== -1);
check('volume sliders get a visible focus ring', css.indexOf('input[type=range]:focus-visible') !== -1);

console.log('== live-site smoke test (block 14, #59) ==');
const liveJs = fs.readFileSync(path.join(__dirname, 'live-smoke.js'), 'utf8');
check('live-smoke script reads the version from game.js', liveJs.indexOf("var VERSION = '") !== -1);
check('live-smoke polls until the new version is live', liveJs.indexOf('POLL_MS') !== -1 && liveJs.indexOf('not on v') !== -1);
check('live-smoke checks index + game.js + style.css over HTTP',
  liveJs.indexOf("fetchText(URL + 'game.js')") !== -1 && liveJs.indexOf("fetchText(URL + 'style.css')") !== -1);
check('live-smoke plays the live game in a headless browser',
  liveJs.indexOf("page.click('#playBtn')") !== -1 && liveJs.indexOf("keyboard.press('Space')") !== -1);
check('live-smoke fails on console / page errors',
  liveJs.indexOf('pageerror') !== -1 && liveJs.indexOf("m.type() === 'error'") !== -1);
const ci = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/ci-pages.yml'), 'utf8');
check('CI runs a live-smoke job after the deploy job',
  ci.indexOf('live-smoke:') !== -1 && ci.indexOf('needs: deploy') !== -1 && ci.indexOf('node tests/live-smoke.js') !== -1);
check('CI installs a headless browser for the live check', ci.indexOf('playwright-core install chromium') !== -1);
check('CONTRIBUTING documents the live-site check', contrib.indexOf('tests/live-smoke.js') !== -1);

console.log('== extra modes: blitz, endless, zen (block 15, #20/#21/#22) ==');
// Defaults: classic mode, 60s blitz clock, mode buttons synced at boot.
check('mode defaults to classic', S.mode === 'classic', S.mode);
check('blitz clock starts at 60s', S.blitzMs === 60000, 'blitzMs ' + S.blitzMs);
check('mode buttons synced at boot',
  els.modeClassic.textContent === '✓ CLASSIC' && els.modeBlitz.textContent === '○ BLITZ 60s' &&
  els.modeEndless.textContent === '○ ENDLESS' && els.modeZen.textContent === '○ ZEN',
  els.modeClassic.textContent + ' / ' + els.modeBlitz.textContent);
check('mode buttons expose aria-pressed',
  els.modeClassic.getAttribute('aria-pressed') === 'true' && els.modeBlitz.getAttribute('aria-pressed') === 'false');
check('mode line describes the selected mode',
  els.modeLine.textContent.indexOf('classic run') !== -1, els.modeLine.textContent);
check('setMode rejects unknown modes', H.setMode('nope') === false && S.mode === 'classic');
// Selecting a mode persists it and updates the buttons + mode line.
check('setMode switches to blitz', H.setMode('blitz') === true && S.mode === 'blitz');
check('blitz button flips on, classic flips off',
  els.modeBlitz.textContent === '✓ BLITZ 60s' && els.modeClassic.textContent === '○ CLASSIC' &&
  els.modeBlitz.getAttribute('aria-pressed') === 'true');
check('mode selection persists', store['nhx-mode'] === 'blitz', store['nhx-mode']);
check('mode line follows the selection', els.modeLine.textContent.indexOf('60 seconds') !== -1, els.modeLine.textContent);

// Blitz (backlog #20): the clock runs down with run time, the HUD shows
// the countdown in the lives slot, and zero ends the run with TIME UP!
H.newGame('blitz');
check('newGame(blitz) starts a blitz run', S.mode === 'blitz' && S.state === 'playing');
check('blitz HUD shows the countdown', els.livesLabel.textContent === 'TIME' && els.lives.textContent === '1:00',
  els.livesLabel.textContent + '/' + els.lives.textContent);
S.piece = null; // no falling piece: pure clock + tide, deterministic
H.step(30000);
check('blitz clock counts down', S.blitzMs === 30000, 'blitzMs ' + S.blitzMs);
H.updateHUD();
check('HUD countdown reads 0:30', els.lives.textContent === '0:30', els.lives.textContent);
check('canvas label reports the blitz countdown, not lives',
  els.game.getAttribute('aria-label').indexOf('0:30 left') !== -1, els.game.getAttribute('aria-label'));
H.togglePause();
check('pause dialog reports the blitz clock', els.pauseStats.textContent.indexOf('Time 0:30') !== -1, els.pauseStats.textContent);
H.togglePause();
const tideTicks0 = H.audio.played.tidepulse || 0;
H.step(25000); // 5s left: inside the last-10s window, a tick sounds
check('blitz last-10s tick sounds', (H.audio.played.tidepulse || 0) > tideTicks0,
  (H.audio.played.tidepulse || 0) + ' vs ' + tideTicks0);
S.score = 1500; // a score for the mode-best check below
H.step(5000); // clock hits zero
check('blitz ends the run at zero', S.state === 'over' && S.blitzMs === 0, S.state + '/' + S.blitzMs);
check('blitz timeout flagged', S.blitzTimeout === true);
check('TIME UP badge shown', els.timeBadge.classList.contains('hidden') === false);
check('game-over stats name the mode',
  els.overStats.innerHTML.indexOf('MODE') !== -1 && els.overStats.innerHTML.indexOf('BLITZ 60s') !== -1,
  els.overStats.innerHTML);
check('blitz best saved under its own key', store['nhx-best-blitz'] !== undefined, store['nhx-best-blitz']);
// A classic run afterwards does not show the TIME UP badge.
H.newGame('classic');
H.gameOver();
check('classic game over hides TIME UP', els.timeBadge.classList.contains('hidden') === true);
check('classic game over names classic mode', els.overStats.innerHTML.indexOf('CLASSIC') !== -1);

// Endless (backlog #21): no lives to lose — a top-out ends the run.
H.newGame('endless');
check('endless HUD shows no lives', els.livesLabel.textContent === 'LIVES' && els.lives.textContent === '∞',
  els.livesLabel.textContent + '/' + els.lives.textContent);
H.setCell(3, 0, 0); H.setCell(3, 1, 1); // block the spawn cells
S.piece = null;
H.spawnPiece(); // top-out fires
check('endless top-out ends the run', S.state === 'over', S.state);
check('endless top-out costs no life', S.lives === 3, 'lives ' + S.lives);
check('endless game over names the mode', els.overStats.innerHTML.indexOf('ENDLESS') !== -1);

// Zen (backlog #22): no tide, no lives lost — the run never ends itself.
H.newGame('zen');
check('zen HUD shows no lives', els.lives.textContent === '∞', els.lives.textContent);
check('canvas label reports no lives in zen',
  els.game.getAttribute('aria-label').indexOf('no lives') !== -1, els.game.getAttribute('aria-label'));
H.togglePause();
check('pause dialog reports infinite lives in zen', els.pauseStats.textContent.indexOf('Lives ∞') !== -1, els.pauseStats.textContent);
H.togglePause();
S.piece = null;
H.step(60000);
check('zen tide never rises', S.tide === 0, 'tide ' + S.tide);
check('zen never surges', S.surges === 0, 'surges ' + S.surges);
H.setCell(3, 0, 0); H.setCell(3, 1, 1);
S.piece = null;
H.spawnPiece(); // top-out fires
check('zen top-out keeps the run going', S.state === 'playing', S.state);
check('zen top-out costs no life', S.lives === 3, 'lives ' + S.lives);
check('zen top-out clears the top rows', H.getCell(3, 0) === null && H.getCell(3, 1) === null);
check('zen game over names the mode', (function () { H.gameOver(); return els.overStats.innerHTML.indexOf('ZEN') !== -1; })());

// Classic is untouched: top-out still costs a life, tide still rises.
H.newGame('classic');
check('classic HUD shows lives dots', els.livesLabel.textContent === 'LIVES' && els.lives.textContent === '●●●',
  els.livesLabel.textContent + '/' + els.lives.textContent);
S.piece = null;
H.step(10000);
check('classic tide rises', S.tide > 0, 'tide ' + S.tide);
H.setCell(3, 0, 0); H.setCell(3, 1, 1);
S.piece = null;
H.spawnPiece();
check('classic top-out costs a life', S.lives === 2 && S.state === 'playing', 'lives ' + S.lives + '/' + S.state);

// Per-mode bests stay separate: a blitz best does not become the classic best.
H.newGame('classic');
const classicBestBefore = H.loadModeBest();
H.newGame('blitz');
S.score = 4200;
H.gameOver();
check('blitz best recorded separately', H.loadModeBest() === 4200, 'modeBest ' + H.loadModeBest());
H.newGame('classic');
check('classic best untouched by the blitz run', H.loadModeBest() === classicBestBefore, 'classic modeBest ' + H.loadModeBest());
check('top-5 entry records the mode',
  (function () { H.newGame('blitz'); S.score = 99999; H.gameOver(); var top = H.loadTop5(); return top.length > 0 && top[0].score === 99999 && top[0].mode === 'blitz'; })(),
  JSON.stringify(H.loadTop5()[0]));

// Keyboard: the mode buttons sit at the end of the menu cycle (after the
// style button), so the earlier 3-step nav to the shake toggle still works.
H.setMode('classic');
H.quitToMenu();
for (let i = 0; i < 9; i++) H.handleKey('ArrowDown');
check('keyboard nav reaches the blitz mode button', S.kbdFocus === 'modeBlitz', S.kbdFocus);
H.handleKey('Enter');
check('Enter on the blitz button selects blitz', S.mode === 'blitz', S.mode);
H.handleKey('ArrowDown'); H.handleKey('ArrowDown');
check('keyboard nav reaches the zen button', S.kbdFocus === 'modeZen', S.kbdFocus);
H.handleKey('Enter');
check('Enter on the zen button selects zen', S.mode === 'zen', S.mode);
H.setMode('classic'); // restore classic for anything after this section

// Static checks: the mode UI exists in the HTML + CSS, the how-to explains it.
check('mode buttons exist in the HTML',
  html.indexOf('id="modeClassic"') !== -1 && html.indexOf('id="modeBlitz"') !== -1 &&
  html.indexOf('id="modeEndless"') !== -1 && html.indexOf('id="modeZen"') !== -1);
check('mode row is a labelled group', html.indexOf('aria-label="Game mode"') !== -1);
check('TIME UP badge exists in the HTML', html.indexOf('id="timeBadge"') !== -1);
check('how-to overlay explains the modes', html.indexOf('BLITZ 60s') !== -1 && html.indexOf('ENDLESS') !== -1 && html.indexOf('ZEN') !== -1);
check('mode-row CSS exists', css.indexOf('.mode-row') !== -1 && css.indexOf('.btn.mode-btn') !== -1);
check('unselected mode buttons read dimmer', css.indexOf('.btn.mode-btn[aria-pressed="false"]') !== -1);

console.log('== combo timer + tide powerups ==');
// Helper: wipe the board, then clear one 3-match at (col,10),(col,9) plus
// the piece's bottom cell at (col+1,10). The board is wiped between clears
// so the combo state (which lives outside the board) is the only thing
// carried from one clear to the next.
function comboClear(col) {
  for (let c = 0; c < 8; c++) for (let r = 0; r < 11; r++) H.setCell(c, r, null);
  H.setCell(col, 10, 0); H.setCell(col, 9, 0);
  H.setPiece(col + 1, 8, [1, 2, 0]);
  H.hardDrop();
}
H.newGame();
check('combo starts at 0', S.combo === 0 && S.bestCombo === 0);
check('combo multiplier ladder', H.comboMult(1) === 1 && H.comboMult(2) === 1.25 && H.comboMult(5) === 2 && H.comboMult(9) === 2,
  H.comboMult(1) + '/' + H.comboMult(2) + '/' + H.comboMult(5) + '/' + H.comboMult(9));
comboClear(0); // first 3-match: 300, no bonus
check('first clear starts combo x1 with no bonus', S.combo === 1 && S.score === 300, 'combo ' + S.combo + ' score ' + S.score);
S.timeMs = 2000;
comboClear(2); // within 5s: 300 + 25% = 375
check('second clear within 5s pays combo bonus (375)', S.score === 675, 'score ' + S.score);
check('combo is x2', S.combo === 2 && S.bestCombo === 2, 'combo ' + S.combo);
check('combo shows in the HUD strip with a countdown', /COMBO ×2 · 5s/.test(els.specialsStrip.textContent), els.specialsStrip.textContent);
S.timeMs = 4000;
comboClear(4); // 300 + 50% = 450
check('third clear pays combo x3 bonus (450)', S.score === 1125, 'score ' + S.score);
check('combo is x3', S.combo === 3 && S.bestCombo === 3, 'combo ' + S.combo);
S.timeMs = 9500; // 5s after the last clear (comboUntil was 9000)
H.step(16); // step() expires the combo
check('combo expires after 5s with no clear', S.combo === 0, 'combo ' + S.combo);
check('expired combo leaves the strip', !/COMBO/.test(els.specialsStrip.textContent), els.specialsStrip.textContent);
comboClear(0); // fresh combo, no bonus
check('clear after expiry restarts at x1', S.combo === 1 && S.score === 1425, 'combo ' + S.combo + ' score ' + S.score);
H.gameOver();
check('game-over stats show the best combo', /BEST COMBO/.test(els.overStats.innerHTML) && /×3/.test(els.overStats.innerHTML), els.overStats.innerHTML);

console.log('== slow-tide powerup ==');
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0); H.setCell(2, 10, H.SLOW);
H.setPiece(1, 8, [3, 4, 0]); // bottom 0 at (1,10) completes the match
H.hardDrop();
check('slow hex next to a match freezes the tide', S.slowTides === 1, 'slowTides ' + S.slowTides);
check('slow hex cleared by the trigger', H.getCell(2, 10) === null);
check('freeze lasts 15s', S.slowTideUntil === 15000, 'until ' + S.slowTideUntil);
check('freeze shows in the HUD strip', /SLOW TIDE 15s/.test(els.specialsStrip.textContent), els.specialsStrip.textContent);
check('tide is frozen', H.isTideFrozen() === true);
check('slow-tide SFX plays', (H.audio.played.slowtide || 0) >= 1, JSON.stringify(H.audio.played));
H.setTide(50);
H.step(1000);
check('tide does not rise while frozen', S.tide === 50, 'tide ' + S.tide);
H.setTide(99);
H.step(1000);
check('no surge while frozen at 99%', S.surges === 0 && S.tide === 99, 'tide ' + S.tide + ' surges ' + S.surges);
// A pending double surge waits out the freeze instead of firing into it.
H.newGame();
H.setTide(50);
S.pendingSurgeAt = S.timeMs + 100; // due almost immediately
S.slowTideUntil = S.timeMs + 15000; // frozen
H.step(1000);
check('pending double surge waits out the freeze', S.pendingSurgeAt !== null && S.surges === 0 && S.pendingSurgeAt > S.timeMs,
  'pending ' + S.pendingSurgeAt + ' surges ' + S.surges);
// The freeze ends: the tide rises again.
H.newGame();
S.slowTideUntil = S.timeMs + 100;
H.setTide(50);
H.step(1000); // timeMs 1000 > slowTideUntil 100 -> unfrozen
check('tide is unfrozen after 15s', H.isTideFrozen() === false);
H.step(1000);
check('tide rises again after the freeze ends', S.tide > 50, 'tide ' + S.tide);
// Three adjacent slow hexes never match by colour.
H.newGame();
H.setCell(0, 10, H.SLOW); H.setCell(0, 9, H.SLOW); H.setCell(1, 10, H.SLOW);
H.setPiece(3, 8, [1, 2, 3]);
H.hardDrop();
check('three adjacent slow hexes never match', H.getCell(0, 10) === H.SLOW && H.getCell(0, 9) === H.SLOW && H.getCell(1, 10) === H.SLOW);
check('no score from a specials-only board', S.score === 0, 'score ' + S.score);
// Slow-tide and tide-break hexes drop in trios over many rolls.
H.newGame();
let seenSlow = false, seenBreak = false;
for (let i = 0; i < 300; i++) { const t = H.rollColors(); if (t.indexOf(H.SLOW) !== -1) seenSlow = true; if (t.indexOf(H.BREAK) !== -1) seenBreak = true; }
check('slow-tide hexes drop in trios', seenSlow);
check('tide-break hexes drop in trios', seenBreak);
// The HUD strip counts slow/break hexes sitting on the board.
H.newGame();
H.setCell(0, 10, H.SLOW); H.setCell(1, 10, H.BREAK);
H.updateHUD();
check('HUD strip counts slow/break hexes on board', /⏳ 1 ON BOARD/.test(els.specialsStrip.textContent) && /✂ 1 ON BOARD/.test(els.specialsStrip.textContent), els.specialsStrip.textContent);

console.log('== tide-break powerup ==');
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0); H.setCell(2, 10, H.BREAK);
H.setCell(5, 10, 3); H.setCell(5, 9, 4); H.setCell(7, 10, 5);
H.setPiece(1, 8, [3, 4, 0]); // bottom 0 at (1,10) completes the match
H.hardDrop();
check('break hex next to a match triggers', S.tideBreaks === 1, 'breaks ' + S.tideBreaks);
check('break clears the bottom-row victims', H.getCell(5, 10) === null && H.getCell(5, 9) === null && H.getCell(7, 10) === null);
check('break hex itself is gone', H.getCell(2, 10) === null);
check('break payout: 300 match + 100 rows', S.score === 400, 'score ' + S.score);
check('tide-break SFX plays', (H.audio.played.tidebreak || 0) >= 1, JSON.stringify(H.audio.played));
check('break victims count as cleared hexes', S.hexesCleared === 8, 'hexes ' + S.hexesCleared);
// A break hex far from any clear stays put.
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0); H.setCell(7, 10, H.BREAK);
H.setPiece(1, 8, [3, 4, 0]);
H.hardDrop();
check('distant break hex does not trigger', S.tideBreaks === 0 && H.getCell(7, 10) === H.BREAK);
check('match still scores 300 without a break', S.score === 300, 'score ' + S.score);
// Static checks: the how-to explains the new mechanics, the game-over
// stats record them, and the new values are real board values.
check('how-to explains the combo timer', html.indexOf('5 seconds') !== -1 && html.indexOf('COMBO') !== -1);
check('how-to explains the tide powerups', html.indexOf('slow-tide hex') !== -1 && html.indexOf('tide-break hex') !== -1);
check('game-over stats record slow tides + tide breaks', src.indexOf("'SLOW TIDES'") !== -1 && src.indexOf("'TIDE BREAKS'") !== -1);
check('board accepts the new special values', H.getCell(0, 0) === null && (function () { H.setCell(0, 10, H.SLOW); H.setCell(0, 9, H.BREAK); return H.validateBoard().length === 0; })());

console.log('== audio settings panel + music variation + surge countdown (block 17, #37/#19) ==');
// --- #37: the SFX toggle ---
H.setSetting('sfx', false);
check('SFX toggle persists + updates both SFX buttons',
  S.settings.sfx === false && els.sfxToggle.textContent === '○ SFX' &&
  els.pauseSfxToggle.textContent === '○ SFX' &&
  els.sfxToggle.getAttribute('aria-pressed') === 'false' &&
  JSON.parse(store['nhx-settings']).sfx === false);
H.audio.init();
var clearPlayed = H.audio.played.clear || 0;
H.audio.sfx('clear');
check('SFX off silences effects', (H.audio.played.clear || 0) === clearPlayed, 'played ' + (H.audio.played.clear || 0));
H.setSetting('sfx', true);
H.audio.sfx('clear');
check('SFX back on plays effects', (H.audio.played.clear || 0) === clearPlayed + 1, 'played ' + (H.audio.played.clear || 0));
H.toggleMute();
var mutedPlayed = H.audio.played.clear || 0;
H.audio.sfx('clear');
check('master mute still silences SFX', (H.audio.played.clear || 0) === mutedPlayed);
H.toggleMute();
H.setSetting('sfx', false);
check('SFX off leaves music on (toggles are independent)', H.audio.musicOn === true);
H.setSetting('sfx', true);
// --- music variation: three styles ---
check('three music styles exist with 16-step bass lines',
  Object.keys(H.MUSIC_STYLES).length === 3 &&
  H.MUSIC_STYLES.pulse.bass.length === 16 && H.MUSIC_STYLES.drift.bass.length === 16 &&
  H.MUSIC_STYLES.drive.bass.length === 16);
check('style button shows the current style', els.styleBtn.textContent === '♪ STYLE: PULSE', els.styleBtn.textContent);
H.setMusicStyle('drift');
check('setMusicStyle switches to DRIFT + persists + updates the button',
  S.settings.musicStyle === 'drift' && els.styleBtn.textContent === '♪ STYLE: DRIFT' &&
  JSON.parse(store['nhx-settings']).musicStyle === 'drift');
check('DRIFT tempo is slower than PULSE', H.audio.musicTempo(1, 1) === 644, 'tempo ' + H.audio.musicTempo(1, 1));
H.setMusicStyle('drive');
check('DRIVE tempo is faster than PULSE', H.audio.musicTempo(1, 1) === 359, 'tempo ' + H.audio.musicTempo(1, 1));
check('cycleMusicStyle wraps DRIVE back to PULSE', H.cycleMusicStyle() === 'pulse' && S.settings.musicStyle === 'pulse');
check('setMusicStyle rejects unknown styles', H.setMusicStyle('nope') === false && S.settings.musicStyle === 'pulse');
check('DRIFT bass rests on half the steps (breathing bass line)',
  H.MUSIC_STYLES.drift.bass.filter(function (f) { return f === 0; }).length === 8);
check('PULSE bass walks a chord progression (four distinct roots)',
  new Set(H.MUSIC_STYLES.pulse.bass.filter(function (f) { return f > 0; })).size >= 4);
check('styles have distinct arpeggios', H.MUSIC_STYLES.drift.arp.join() !== H.MUSIC_STYLES.drive.arp.join());
// A live style switch restarts the music loop mid-run.
H.newGame();
var timerBefore = H.audio.musicTimer;
H.setMusicStyle('drift');
check('style switch restarts the music loop mid-run',
  H.audio.musicTimer !== null && H.audio.musicTimer !== timerBefore);
H.setMusicStyle('pulse');
// Keyboard: the style button cycles and the SFX toggle flips from the menu.
H.quitToMenu();
for (let i = 0; i < 7; i++) H.handleKey('ArrowDown');
check('keyboard nav reaches the style button', S.kbdFocus === 'styleBtn', S.kbdFocus);
H.handleKey('Enter');
check('Enter on the style button cycles to DRIFT', S.settings.musicStyle === 'drift', S.settings.musicStyle);
H.handleKey('ArrowUp');
check('keyboard nav reaches the SFX toggle', S.kbdFocus === 'sfxToggle', S.kbdFocus);
H.handleKey('Enter');
check('Enter on the SFX toggle flips it off', S.settings.sfx === false && els.sfxToggle.textContent === '○ SFX');
H.setSetting('sfx', true);
H.setMusicStyle('pulse');
// The pause overlay's SFX toggle sits between RESUME and RESTART.
H.newGame();
H.togglePause();
check('pause overlay focuses RESUME first', S.kbdFocus === 'resumeBtn', S.kbdFocus);
H.handleKey('ArrowDown');
check('pause nav reaches the SFX toggle', S.kbdFocus === 'pauseSfxToggle', S.kbdFocus);
H.handleKey('Enter');
check('Enter on the pause SFX toggle flips it off', S.settings.sfx === false);
H.setSetting('sfx', true);
H.togglePause();
// --- #19: surge countdown ---
H.newGame('classic');
H.setTide(0); H.updateHUD();
check('surge countdown at tide 0, level 1 reads 1:24', els.surgeEta.textContent === 'SURGE 1:24', els.surgeEta.textContent); // Block 18: tide retuned to 84s at level 1
H.setTide(90); H.updateHUD();
check('surge countdown at tide 90 reads 0:08', els.surgeEta.textContent === 'SURGE 0:08', els.surgeEta.textContent);
check('surgeEtaMs matches the tide math', Math.abs(H.surgeEtaMs() - 8400) < 1, String(H.surgeEtaMs()));
S.slowTideUntil = S.timeMs + 15000; H.updateHUD();
check('frozen tide reads TIDE FROZEN', els.surgeEta.textContent === '❄ TIDE FROZEN', els.surgeEta.textContent);
check('surgeEtaMs is null while frozen', H.surgeEtaMs() === null);
S.slowTideUntil = 0;
S.pendingSurgeAt = S.timeMs + 2500; H.updateHUD();
check('pending double surge counts down to it', els.surgeEta.textContent === 'SURGE 0:02', els.surgeEta.textContent);
S.pendingSurgeAt = null;
H.setMode('zen'); H.newGame('zen'); H.updateHUD();
check('zen mode shows no surge countdown', els.surgeEta.textContent === '', JSON.stringify(els.surgeEta.textContent));
check('surgeEtaMs is null in zen', H.surgeEtaMs() === null);
H.setMode('classic');
// Static checks: the audio panel, the new controls and the countdown
// exist in the HTML + CSS, and the how-to explains them.
check('audio panel + toggles + style button + countdown exist in the HTML',
  html.indexOf('id="sfxToggle"') !== -1 && html.indexOf('id="styleBtn"') !== -1 &&
  html.indexOf('id="pauseSfxToggle"') !== -1 && html.indexOf('id="surgeEta"') !== -1 &&
  html.indexOf('aria-label="Audio settings"') !== -1);
check('audio panel + surge countdown styles exist in the CSS',
  css.indexOf('.audio-panel') !== -1 && css.indexOf('.surge-eta') !== -1);
check('how-to explains the audio panel + surge countdown',
  html.indexOf('music style') !== -1 && html.indexOf('next surge') !== -1);

console.log('== block 18: tide-freeze pickup (#18) + difficulty curve (#27) + lifetime stats (#25) + pause restart/quit (#38) ==');
// --- #18: freeze hexes never match, and one banked on a match beside them ---
H.newGame();
H.setCell(0, 10, H.FREEZE); H.setCell(0, 9, H.FREEZE); H.setCell(1, 10, H.FREEZE);
check('three freeze hexes form no match group', H.findGroups().length === 0);
H.resolveBoard();
check('freeze hexes survive a resolve with no match', H.getCell(0, 10) === H.FREEZE && H.getCell(0, 9) === H.FREEZE && H.getCell(1, 10) === H.FREEZE);
H.newGame();
H.setCell(0, 10, 0); H.setCell(0, 9, 0); H.setCell(0, 8, 0); H.setCell(1, 9, H.FREEZE);
H.resolveBoard();
check('match beside a freeze banks it', S.freezeHeld === 1 && S.freezesCollected === 1, 'held ' + S.freezeHeld);
check('banked freeze leaves the board', H.getCell(1, 9) === null);
check('freeze pickup sfx played', (H.audio.played['freezepickup'] || 0) >= 1);
check('board with a freeze audits clean', H.validateBoard().length === 0, H.validateBoard().join(';'));
H.setCell(3, 10, 12);
check('value 12 is still flagged by the audit', H.validateBoard().length > 0);
H.setCell(3, 10, null);
check('countSpecials counts freezes on board', (function () { H.setCell(2, 10, H.FREEZE); return H.countSpecials().freezes; })() === 1);
// --- #18: spending a freeze ---
H.newGame();
check('useFreeze with an empty stock returns false', H.useFreeze() === false && S.freezeHeld === 0);
S.freezeHeld = 2; H.setTide(50);
check('useFreeze spends one and freezes the tide', H.useFreeze() === true && S.freezeHeld === 1 && S.freezesUsed === 1 && H.isTideFrozen());
check('freeze lasts 10s', S.slowTideUntil - S.timeMs === 10000, String(S.slowTideUntil - S.timeMs));
check('freeze sfx played', (H.audio.played['freeze'] || 0) >= 1);
H.step(5000);
check('tide holds while frozen', S.tide === 50, 'tide ' + S.tide);
H.step(6000);
check('freeze has lapsed after 11s of run time', H.isTideFrozen() === false);
var tideAfter = S.tide;
H.step(2000);
check('tide rises again once the freeze lapses', S.tide > tideAfter, 'tide ' + S.tide);
// F key spends a banked freeze; nothing happens while paused.
H.newGame(); S.freezeHeld = 1;
H.handleKey('KeyF');
check('F key spends a banked freeze', S.freezeHeld === 0 && H.isTideFrozen());
H.togglePause();
check('useFreeze refuses while paused', H.useFreeze() === false);
H.togglePause();
// Stock caps at 3 — a fourth pickup is still collected, just not banked.
H.newGame(); S.freezeHeld = 3;
H.setCell(0, 10, 0); H.setCell(0, 9, 0); H.setCell(0, 8, 0); H.setCell(1, 9, H.FREEZE);
H.resolveBoard();
check('freeze stock caps at 3', S.freezeHeld === 3 && S.freezesCollected === 1);
// HUD: held stock, NEXT preview, and the touch button's disabled state.
H.newGame(); S.freezeHeld = 1; H.updateHUD();
check('strip shows the held freeze + F hint', els.specialsStrip.textContent.indexOf('❄ HELD ×1 — F TO FREEZE') !== -1, els.specialsStrip.textContent);
check('freeze touch button enabled with stock', els.tcFreeze.disabled === false && els.tcFreeze.textContent === '❄×1');
H.useFreeze(); // useFreeze calls updateHUD itself
check('freeze touch button disabled with empty stock', els.tcFreeze.disabled === true && els.tcFreeze.textContent === '❄');
H.newGame(); S.next = [H.FREEZE, 0, 1]; H.updateHUD();
check('strip previews a freeze in the next trio', els.specialsStrip.textContent.indexOf('NEXT: ❄') !== -1, els.specialsStrip.textContent);
// Freeze hexes do drop from rollColors (rare — force a high level to see one).
S.level = 99;
var sawFreeze = false;
for (var fi = 0; fi < 200; fi++) if (H.rollColors().indexOf(H.FREEZE) !== -1) sawFreeze = true;
S.level = 1;
check('rollColors can drop a freeze hex', sawFreeze);
// --- #27: difficulty curve ---
S.level = 1;
check('fall is 700ms at level 1', H.fallMs() === 700, String(H.fallMs()));
S.level = 5;
check('fall is 500ms at level 5', H.fallMs() === 500, String(H.fallMs()));
S.level = 9;
check('fall is 300ms at level 9', H.fallMs() === 300, String(H.fallMs()));
S.level = 11;
check('fall floors at 200ms from level 11', H.fallMs() === 200, String(H.fallMs()));
S.level = 99;
check('fall stays floored at 200ms', H.fallMs() === 200, String(H.fallMs()));
S.level = 1;
check('first surge takes 84s at level 1', Math.abs(100 / H.tidePerSec() - 84) < 0.01, String(100 / H.tidePerSec()));
S.level = 5;
check('surge takes 64s at level 5', Math.abs(100 / H.tidePerSec() - 64) < 0.01, String(100 / H.tidePerSec()));
S.level = 11;
check('surge floors at 34s from level 11', Math.abs(100 / H.tidePerSec() - 34) < 0.01, String(100 / H.tidePerSec()));
S.level = 1;
// --- #25: lifetime run stats ---
global.localStorage.removeItem('nhx-lifetime');
check('lifetime defaults to zeros', H.loadLifetime().runs === 0 && H.loadLifetime().hexes === 0);
global.localStorage.setItem('nhx-lifetime', 'not-json{{{');
check('corrupt lifetime data falls back to zeros', H.loadLifetime().runs === 0 && H.loadLifetime().bestChain === 0);
global.localStorage.setItem('nhx-lifetime', JSON.stringify({ runs: 5, hexes: 'oops', bestChain: 3 }));
check('partial lifetime data keeps only valid numbers', H.loadLifetime().runs === 5 && H.loadLifetime().hexes === 0 && H.loadLifetime().bestChain === 3);
global.localStorage.removeItem('nhx-lifetime');
S.lifetime = H.loadLifetime();
H.newGame();
S.hexesCleared = 10; S.matches = 3; S.bestChain = 2; S.score = 500; S.timeMs = 60000; S.surges = 1; S.freezesUsed = 1;
H.gameOver();
check('game over folds the run into lifetime totals',
  S.lifetime.runs === 1 && S.lifetime.hexes === 10 && S.lifetime.matches === 3 &&
  S.lifetime.bestChain === 2 && S.lifetime.bestScore === 500 && S.lifetime.timeMs === 60000 &&
  S.lifetime.freezesUsed === 1 && S.lifetime.surges === 1, JSON.stringify(S.lifetime));
check('lifetime persists to localStorage', global.localStorage.getItem('nhx-lifetime').indexOf('"runs":1') !== -1);
check('game-over stats show lifetime + freeze rows',
  els.overStats.innerHTML.indexOf('LIFETIME RUNS') !== -1 && els.overStats.innerHTML.indexOf('FREEZES USED') !== -1);
H.newGame();
S.hexesCleared = 5; S.score = 100; S.timeMs = 30000;
H.gameOver();
check('second run accumulates, bests keep their max',
  S.lifetime.runs === 2 && S.lifetime.hexes === 15 && S.lifetime.bestScore === 500 && S.lifetime.timeMs === 90000,
  JSON.stringify(S.lifetime));
H.quitToMenu(); H.updateHUD();
check('menu shows the lifetime totals line',
  els.lifetimeLine.textContent === 'LIFETIME — 2 RUNS · 15 HEXES · BEST CHAIN ×2 · BEST 500', els.lifetimeLine.textContent);
// --- #38: pause menu restart + quit (built in Block 7, verified here) ---
check('pause overlay has RESTART + QUIT buttons in the HTML',
  html.indexOf('id="restartBtn"') !== -1 && html.indexOf('id="quitBtn"') !== -1 &&
  html.indexOf('RESTART RUN') !== -1 && html.indexOf('QUIT TO MENU') !== -1);
H.newGame(); S.score = 123;
H.togglePause();
check('pause menu opens from a run', S.state === 'paused');
H.handleKey('ArrowDown'); H.handleKey('ArrowDown'); // resume -> SFX -> RESTART
check('pause nav reaches RESTART', S.kbdFocus === 'restartBtn', S.kbdFocus);
H.handleKey('Enter');
check('RESTART starts a fresh run', S.state === 'playing' && S.score === 0 && S.lives === 3, S.state + ' score ' + S.score);
// Static checks: the new controls, the freeze button, and the how-to text.
check('freeze button + lifetime line exist in the HTML',
  html.indexOf('id="tcFreeze"') !== -1 && html.indexOf('id="lifetimeLine"') !== -1);
check('lifetime line + disabled freeze button styles exist in the CSS',
  css.indexOf('.lifetime-line') !== -1 && css.indexOf('.tc-btn:disabled') !== -1);
check('how-to explains the freeze hex + F key',
  html.indexOf('❄ freeze hex') !== -1 && html.indexOf('F freeze tide') !== -1);

console.log('== favicon / meta / PWA-lite (block 19, #53/#54/#50) ==');
function pngSize(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4E || buf[3] !== 0x47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
function pngIs(buf, w, h) { var s = pngSize(buf); return !!s && s.w === w && s.h === h; }
// Manifest (#54): parses, names the game, standalone, colours match the theme.
var manifest = null;
try { manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.webmanifest'), 'utf8')); } catch (e) { manifest = null; }
check('manifest parses as JSON', !!manifest);
check('manifest names the game + short name', !!manifest && manifest.name === 'Neon Hexfall' && manifest.short_name === 'Hexfall');
check('manifest standalone + start_url + colours', !!manifest && manifest.display === 'standalone' && manifest.start_url === '.' && manifest.theme_color === '#0b0620' && manifest.background_color === '#0b0620');
check('manifest has 192 + 512 any icons and a maskable icon', !!manifest && Array.isArray(manifest.icons) &&
  manifest.icons.some(function (i) { return i.sizes === '192x192' && (i.purpose || 'any') === 'any'; }) &&
  manifest.icons.some(function (i) { return i.sizes === '512x512' && (i.purpose || 'any') === 'any'; }) &&
  manifest.icons.some(function (i) { return i.sizes === '512x512' && i.purpose === 'maskable'; }),
  manifest ? JSON.stringify(manifest.icons) : 'no manifest');
check('every manifest icon file exists on disk', !!manifest && manifest.icons.every(function (i) {
  return fs.existsSync(path.join(__dirname, '..', i.src));
}));
// Icons (#53/#54): real PNGs at the sizes the manifest promises.
check('icon-192.png is a 192x192 PNG', pngIs(fs.readFileSync(path.join(__dirname, '..', 'icon-192.png')), 192, 192));
check('icon-512.png is a 512x512 PNG', pngIs(fs.readFileSync(path.join(__dirname, '..', 'icon-512.png')), 512, 512));
check('apple-touch-icon.png is a 180x180 PNG', pngIs(fs.readFileSync(path.join(__dirname, '..', 'apple-touch-icon.png')), 180, 180));
check('maskable-512.png is a 512x512 PNG', pngIs(fs.readFileSync(path.join(__dirname, '..', 'maskable-512.png')), 512, 512));
// Social preview (#53): 1200x630, referenced by the meta tags.
check('social-preview.png is a 1200x630 PNG', pngIs(fs.readFileSync(path.join(__dirname, '..', 'docs', 'social-preview.png')), 1200, 630));
check('og:image + dimensions + alt in the HTML',
  html.indexOf('property="og:image" content="https://namdev-muse.github.io/neon-hexfall/docs/social-preview.png"') !== -1 &&
  html.indexOf('property="og:image:width" content="1200"') !== -1 &&
  html.indexOf('property="og:image:height" content="630"') !== -1 &&
  html.indexOf('property="og:image:alt"') !== -1);
check('twitter large-card + image in the HTML',
  html.indexOf('name="twitter:card" content="summary_large_image"') !== -1 &&
  html.indexOf('name="twitter:image" content="https://namdev-muse.github.io/neon-hexfall/docs/social-preview.png"') !== -1);
check('apple-touch-icon + manifest linked in the HTML',
  html.indexOf('rel="apple-touch-icon" href="apple-touch-icon.png"') !== -1 &&
  html.indexOf('rel="manifest" href="manifest.webmanifest"') !== -1);
// Service worker (#50): versioned cache, precaches the game, cleans up old caches.
var sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
check('service worker cache name carries the current version', sw.indexOf("neon-hexfall-v1.0.0") !== -1);
check('service worker precaches the whole game', ['index.html', 'style.css', 'game.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'favicon.svg'].every(function (f) { return sw.indexOf("'" + f + "'") !== -1; }));
check('service worker skips waiting + claims clients + deletes old caches',
  sw.indexOf('skipWaiting') !== -1 && sw.indexOf('clients.claim') !== -1 && sw.indexOf('caches.delete') !== -1);
check('service worker fetch handler is same-origin GET only',
  sw.indexOf("event.request.method !== 'GET'") !== -1 && sw.indexOf('url.origin !== self.location.origin') !== -1);
check('game.js header comment says v1.0.0 / Block 23', src.indexOf('// Neon Hexfall — v1.0.0 — Block 23') !== -1);
// Registration: exposed on the handle, registers sw.js on https, refuses otherwise.
check('registerServiceWorker exposed on the handle', typeof H.registerServiceWorker === 'function');
check('boot calls registerServiceWorker', src.indexOf('registerServiceWorker();') !== -1);
var registeredUrl = null;
var fakeNav = { serviceWorker: { register: function (url) { registeredUrl = url; return { catch: function () {} }; } } };
global.location.protocol = 'https:';
check('registers sw.js on https', H.registerServiceWorker(fakeNav) === true && registeredUrl === 'sw.js', String(registeredUrl));
check('refuses without serviceWorker support', H.registerServiceWorker({}) === false);
global.location.protocol = 'file:';
check('refuses on file: protocol', H.registerServiceWorker(fakeNav) === false);
delete global.location.protocol;
check('refuses with no protocol (not http/https)', H.registerServiceWorker(fakeNav) === false);

console.log('== v1.0 release (block 23, #60) ==');
// CHANGELOG.md: exists, opens on the v1.0.0 release, and records the
// wide-match balance change from this block.
var changelog = '';
try { changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8'); } catch (e) { changelog = ''; }
check('CHANGELOG.md exists and opens on v1.0.0', changelog.indexOf('# Changelog') === 0 && changelog.indexOf('## [1.0.0]') !== -1);
check('changelog records the wide-match balance fix', changelog.indexOf('wide') !== -1 && changelog.indexOf('50 / 60 / 70') !== -1);
check('changelog lists all 60 backlog items as shipped', changelog.indexOf('60 backlog') !== -1 || changelog.indexOf('60 items') !== -1);
// Release notes: the DRAFT banner from Block 20 is gone — this is the real v1.0.
var relNotes = fs.readFileSync(path.join(__dirname, '..', 'docs', 'release-notes-v1.0.md'), 'utf8');
check('release notes are no longer marked DRAFT', relNotes.indexOf('DRAFT') === -1);
check('release notes name v1.0.0', relNotes.indexOf('v1.0.0') !== -1 && relNotes.indexOf('1.0.0') !== -1);
check('release notes carry the wide-match balance', relNotes.indexOf('50 / 60 / 70') !== -1);
// README: wide-match wording matches the new rate, and the smoke-test
// count in the testing section matches this run's harness size.
var readme23 = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
check('README wide-match wording matches the new rate', readme23.indexOf('50 pts each, +10 per pick, max 70') !== -1);
check('README testing section names the current smoke count', readme23.indexOf('735 checks') !== -1);

console.log('== save/restore run state (block 21, #49) ==');
// No save waits on a fresh start; a fresh run clears any old one.
H.clearSave();
check('no save waiting at first', H.loadSave() === null && S.hasSave === false);
check('CONTINUE hidden with no save', (function () { H.syncContinueUI(); return els.continueBtn.classList.contains('hidden'); })());
check('save key is nhx-save', H.SAVE_KEY === 'nhx-save');
check('save version is 1', H.SAVE_VERSION === 1);
H.newGame('blitz');
check('newGame clears the old save', H.loadSave() === null, String(H.loadSave()));
check('nothing saved before the first lock', H.loadSave() === null);
// Build a distinctive run to save: blitz clock, board + elite flags,
// a mid-air piece, queued trio, combo, a slow-tide freeze and a banked
// freeze — then bank it and prove the exact state comes back.
S.score = 1234; S.level = 3; S.lives = 2; S.tide = 47.5;
S.freezeHeld = 2; S.slowTideUntil = S.timeMs + 9000; S.blitzMs = 45000;
S.combo = 3; S.comboUntil = S.timeMs + 4000; S.bestCombo = 3;
H.setCell(0, 10, 0); H.setCell(0, 9, 1); H.setCell(1, 10, 2);
H.setArmor(0, 10, 2); H.setStar(1, 10, true);
H.setPiece(3, -1, [4, 5, 0], { armored: [true, false, false] });
S.next = [1, 2, 3];
H.addFx('slow', 'SLOW TIDE', 9000);
check('saveRun banks a run in progress', H.saveRun() === true);
var saved = H.loadSave();
check('saved run carries version + mode + seed', saved && saved.v === 1 && saved.mode === 'blitz' && saved.seed === S.seed);
check('saved run carries score + level + lives + tide', saved && saved.score === 1234 && saved.level === 3 && saved.lives === 2 && saved.tide === 47.5);
check('saved run carries blitz clock + combo + freezes', saved && saved.blitzMs === 45000 && saved.combo === 3 && saved.freezeHeld === 2 && saved.slowTideUntil === S.timeMs + 9000);
check('saved run carries the board + elite flags', saved && saved.board[0][10] === 0 && saved.board[0][9] === 1 && saved.armor[0][10] === 2 && saved.star[1][10] === true);
check('saved run carries the piece + next trio', saved && saved.piece && saved.piece.col === 3 && saved.piece.colors.join(',') === '4,5,0' && saved.piece.armored[0] === true && saved.next.join(',') === '1,2,3');
check('saved run carries the active effect', saved && saved.activeFx.length === 1 && saved.activeFx[0].key === 'slow' && saved.activeFx[0].until === S.timeMs + 9000);
// The rng stream must continue exactly where it stopped: draw three
// values now, resume, and draw the same three again.
var r1 = S.rng(), r2 = S.rng(), r3 = S.rng();
// Mutate everything, then resume and check every field came back.
S.score = 0; S.level = 1; S.lives = 3; S.tide = 0; S.freezeHeld = 0; S.blitzMs = 60000;
S.combo = 0; S.slowTideUntil = 0;
H.setCell(0, 10, null); H.setCell(0, 9, null); H.setCell(1, 10, null);
H.setArmor(0, 10, 0); H.setStar(1, 10, false);
H.setPiece(0, -2, [0, 0, 0]);
S.next = [0, 0, 0];
check('resumeSavedRun restores the banked run', H.resumeSavedRun() === true);
check('resume restores state + score + level + lives', S.state === 'playing' && S.score === 1234 && S.level === 3 && S.lives === 2, S.state + '/' + S.score + '/' + S.level + '/' + S.lives);
check('resume restores tide + combo + blitz clock', S.tide === 47.5 && S.combo === 3 && S.blitzMs === 45000, S.tide + '/' + S.combo + '/' + S.blitzMs);
check('resume restores the board + elite flags', S.board[0][10] === 0 && S.board[0][9] === 1 && S.armor[0][10] === 2 && S.star[1][10] === true);
check('resume restores the piece + next trio', S.piece && S.piece.col === 3 && S.piece.colors.join(',') === '4,5,0' && S.piece.armored[0] === true && S.next.join(',') === '1,2,3');
check('resume restores freezes + slow tide + effect', S.freezeHeld === 2 && S.slowTideUntil === S.timeMs + 9000 && S.activeFx.length === 1 && S.activeFx[0].key === 'slow');
check('restored board passes the audit', H.validateBoard().length === 0, H.validateBoard().join('; '));
check('rng stream continues exactly after resume', S.rng() === r1 && S.rng() === r2 && S.rng() === r3);
// The lock path banks the run too: a hard drop writes a fresh save.
H.newGame();
check('fresh run has no save before locking', H.loadSave() === null);
H.hardDrop();
var afterDrop = H.loadSave();
check('hard drop banks the run', afterDrop !== null && afterDrop.score === S.score && afterDrop.pieces === S.pieces, String(afterDrop && afterDrop.score));
// Pause banks the run; game over and quit abandon it.
H.togglePause();
check('pausing banks the run', H.loadSave() !== null && H.loadSave().score === S.score);
H.togglePause();
H.gameOver();
check('game over clears the save', H.loadSave() === null);
H.quitToMenu();
H.newGame(); H.hardDrop();
check('save exists mid-run', H.loadSave() !== null);
H.quitToMenu();
check('quitting to the menu clears the save', H.loadSave() === null);
// Corrupt saves are rejected and cleared, never resumed.
global.localStorage.setItem('nhx-save', 'not json at all');
check('garbage save is rejected + cleared', H.loadSave() === null && global.localStorage.getItem('nhx-save') === null);
H.newGame(); H.hardDrop();
var good = H.loadSave(); good.v = 99;
global.localStorage.setItem('nhx-save', JSON.stringify(good));
check('wrong-version save is rejected + cleared', H.loadSave() === null && global.localStorage.getItem('nhx-save') === null);
H.newGame(); H.hardDrop();
var badBoard = H.loadSave(); badBoard.board = badBoard.board.slice(0, 7);
global.localStorage.setItem('nhx-save', JSON.stringify(badBoard));
check('wrong-shape board is rejected + cleared', H.loadSave() === null && global.localStorage.getItem('nhx-save') === null);
H.newGame(); H.hardDrop();
var badScore = H.loadSave(); badScore.score = 'lots';
global.localStorage.setItem('nhx-save', JSON.stringify(badScore));
check('non-numeric score is rejected + cleared', H.loadSave() === null && global.localStorage.getItem('nhx-save') === null);
check('resume refuses when no save waits', H.resumeSavedRun() === false);
// CONTINUE on the menu: bank a run, re-boot (same store, like a
// refresh), and the menu offers the run back with its level + score.
H.setMode('classic');
H.newGame(); S.score = 777; S.level = 2; H.saveRun();
eval(src);
var H4 = global.__nhx;
check('re-boot with a save lands on the menu', H4.S.overlay === 'menuOverlay', H4.S.overlay);
check('re-boot sees the waiting save', H4.S.hasSave === true);
check('CONTINUE button is shown after re-boot', els.continueBtn.classList.contains('hidden') === false);
check('CONTINUE label carries level + score + mode', els.continueBtn.textContent.indexOf('LV 2') !== -1 && els.continueBtn.textContent.indexOf('777') !== -1 && els.continueBtn.textContent.indexOf('CLASSIC') !== -1, els.continueBtn.textContent);
check('CONTINUE has an accessible label', (els.continueBtn.getAttribute('aria-label') || '').indexOf('level 2') !== -1);
H4.handleKey('ArrowDown');
check('menu nav reaches CONTINUE after PLAY', H4.S.kbdFocus === 'continueBtn', H4.S.kbdFocus);
H4.handleKey('Enter');
check('Enter on CONTINUE resumes the run', H4.S.state === 'playing' && H4.S.score === 777 && H4.S.level === 2, H4.S.state + '/' + H4.S.score + '/' + H4.S.level);
H4.clearSave();
H.setMode('classic');
// Static checks: the button, the how-to note and the teal style.
check('CONTINUE button exists in the HTML', html.indexOf('id="continueBtn"') !== -1);
check('CONTINUE hides when no save waits', css.indexOf('.btn.continue.hidden') !== -1); // Block 22: the button rendered on fresh menus without this rule
check('how-to explains automatic saving', html.indexOf('saved automatically') !== -1 && html.indexOf('CONTINUE') !== -1);
check('CONTINUE has its own teal style', css.indexOf('.btn.continue') !== -1);

console.log('== cross-browser check (block 21, #52) ==');
// Firefox rejects a still-pending AudioContext.resume() promise when
// the page navigates away ("Navigated away from page") — resume() now
// catches that rejection instead of letting it surface as an unhandled
// rejection in the console. Found live: the cross-browser run tripped
// on it intermittently in Firefox (Chromium clean) until this fix.
H.audio.init();
var _actx = H.audio.ctx;
var _resumeCaught = false, _oldResume = null, _oldState = null;
if (_actx) {
  _oldResume = _actx.resume; _oldState = _actx.state;
  _actx.state = 'suspended';
  _actx.resume = function () { return { catch: function () { _resumeCaught = true; } }; };
  H.audio.resume();
  check('AudioContext resume rejection is caught', _resumeCaught === true);
  _actx.resume = _oldResume; _actx.state = _oldState;
} else {
  check('AudioContext resume rejection is caught', false, 'no audio context in harness');
}
H.audio.stopMusic();
// Static audit: the shipped code stays ES5-style (no arrows, optional
// chaining or nullish coalescing), the webkit AudioContext prefix is
// present for older Safari, and 100dvh has its 100vh fallback.
check('no arrow functions in shipped game code', src.indexOf('=>') === -1);
check('no optional chaining in shipped game code', src.indexOf('?.') === -1);
check('no nullish coalescing in shipped game code', src.indexOf('??') === -1);
check('webkit AudioContext prefix present', src.indexOf('webkitAudioContext') !== -1);
check('100dvh has a 100vh fallback', css.indexOf('100vh') !== -1 && css.indexOf('100dvh') !== -1);
check('cross-browser runner exists', fs.existsSync(path.join(__dirname, 'cross-browser.js')));
check('cross-browser doc exists', fs.existsSync(path.join(__dirname, '..', 'docs', 'cross-browser.md')));

console.log('== first-visit boot paths (block 20, #40) ==');
// Re-boot the game with the flag seeded: returning players get the menu.
// (Re-eval replaces the handle; these checks run last, after every other
// test, so the fresh handle cannot disturb them.)
global.localStorage.setItem('nhx-seen-howto', '1');
eval(src);
var H2 = global.__nhx;
check('returning visit boots to the menu', H2.S.overlay === 'menuOverlay', H2.S.overlay);
check('returning visit focuses PLAY', H2.S.kbdFocus === 'playBtn', H2.S.kbdFocus);
// And with the flag cleared, a fresh boot shows the how-to again.
global.localStorage.removeItem('nhx-seen-howto');
eval(src);
var H3 = global.__nhx;
check('fresh boot shows the how-to overlay again', H3.S.overlay === 'howOverlay', H3.S.overlay);
check('fresh boot focuses GOT IT', H3.S.kbdFocus === 'howCloseBtn', H3.S.kbdFocus);

console.log('\n' + pass + ' PASS, ' + fail + ' FAIL');
// Exit explicitly: the game's music scheduler (setInterval) keeps the Node
// event loop alive after newGame(), which is correct in a browser.
process.exit(fail ? 1 : 0);
