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
    style: {}, disabled: false,
    classList: {
      _s: new Set(),
      add: function (c) { this._s.add(c); }, remove: function (c) { this._s.delete(c); },
      toggle: function (c, f) { if (f === undefined) { if (this._s.has(c)) this._s.delete(c); else this._s.add(c); } else if (f) this._s.add(c); else this._s.delete(c); },
      contains: function (c) { return this._s.has(c); }
    },
    addEventListener: function () {}, removeEventListener: function () {},
    setAttribute: function () {}, getAttribute: function () { return null; },
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
  'top5List', 'overTop5', 'top5Badge', 'specialsStrip'];
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
check('handle exposed', !!H && H.VERSION === '0.11.0');
check('boots to menu', S.state === 'menu');
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
check('fall speeds up with level', H.fallMs() < 650);

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
check('trio cells are valid values 0-8', trio2.every(function (v) { return v >= 0 && v <= 8; }), JSON.stringify(trio2));

console.log('== audio: music intensity, new SFX, volume ==');
// music tempo scales with level and chain (backlog #34)
check('music tempo base 460ms', H.audio.musicTempo(1, 1) === 460, H.audio.musicTempo(1, 1));
check('music tempo faster at higher level', H.audio.musicTempo(4, 1) < H.audio.musicTempo(1, 1), H.audio.musicTempo(4, 1));
check('music tempo faster on a big chain', H.audio.musicTempo(1, 3) < H.audio.musicTempo(1, 1), H.audio.musicTempo(1, 3));
check('music tempo floor is 300ms', H.audio.musicTempo(99, 9) === 300, H.audio.musicTempo(99, 9));
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
check('menu nav wraps to PLAY', S.kbdFocus === 'playBtn', S.kbdFocus);
H.handleKey('ArrowUp');
check('ArrowUp wraps back to SHARE', S.kbdFocus === 'shareBtn', S.kbdFocus);
// Enter on HOW TO PLAY opens the how-to overlay; Escape steps back.
H.handleKey('ArrowUp'); // howBtn
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
check('version bumped to 0.11.0', html.indexOf('v0.11.0') !== -1);

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
check('second hit scores a full 3-match (total 500)', S.score === 500, 'score ' + S.score);
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
  if (v !== null && (v < 0 || v > 8 || Math.floor(v) !== v)) boardOk = false;
}
check('board cells always valid (0-8 or null)', boardOk);
check('score never negative', S.score >= 0);
check('lives in range', S.lives >= 0 && S.lives <= 3);

console.log('\n' + pass + ' PASS, ' + fail + ' FAIL');
// Exit explicitly: the game's music scheduler (setInterval) keeps the Node
// event loop alive after newGame(), which is correct in a browser.
process.exit(fail ? 1 : 0);
