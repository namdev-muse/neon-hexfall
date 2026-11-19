// Neon Hexfall — auto-play bot harness (Block 11, backlog #46).
// Plays full games headlessly with a greedy placement bot: for every
// rotation and column it scores the landing spot (matches it would form,
// bombs it would set off, stack height), plays the best one, and audits
// the board after every lock. Catches stuck pieces, NaN state, board
// corruption and crashes that random-input soaks never reach, because the
// bot actually clears matches, chains, surges and tops out like a player.
// Usage: node tests/bot.js
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; failures.push(name); console.log('  FAIL ' + name + (extra !== undefined ? ' — ' + extra : '')); }
}

// ---------- stubs (same stub-DOM harness as tests/smoke.js) ----------
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
global.location = { search: '?seed=BOT1' };
global.requestAnimationFrame = function () { return 0; };
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
eval(src);
const H = global.__nhx;
const S = H.S;
const COLS = H.COLS, ROWS = H.ROWS;

// ---------- bot ----------
// odd-q neighbours, same geometry as the game
function neighbours(c, r) {
  if (c % 2 === 1) return [[c + 1, r], [c + 1, r - 1], [c, r - 1], [c - 1, r - 1], [c - 1, r], [c, r + 1]];
  return [[c + 1, r + 1], [c + 1, r], [c, r - 1], [c - 1, r], [c - 1, r + 1], [c, r + 1]];
}
function inBoard(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS; }
// Top row of the trio when dropped in this column: the lowest top whose
// three cells are free and whose bottom cell rests on the stack or floor.
function landingTop(col) {
  for (var top = ROWS - 3; top >= -2; top--) {
    var fits = true;
    for (var i = 0; i < 3; i++) {
      var r = top + i;
      if (r >= 0 && H.getCell(col, r) !== null) { fits = false; break; }
    }
    if (!fits) continue;
    var below = top + 3;
    if (below >= ROWS || H.getCell(col, below) !== null) return top;
  }
  return null;
}
// Flood-fill the group a placed cell would belong to, over the board plus
// the trio's own cells (a cell matches its colour or a rainbow wildcard).
function floodGroup(cell, placed) {
  var v = cell.v;
  var seen = {};
  var stack = [[cell.c, cell.r]];
  var group = [];
  function valAt(c, r) {
    for (var i = 0; i < placed.length; i++) if (placed[i].c === c && placed[i].r === r) return placed[i].v;
    return H.getCell(c, r);
  }
  function lockedAt(c, r) {
    for (var i = 0; i < placed.length; i++) if (placed[i].c === c && placed[i].r === r) return !!placed[i].locked;
    return S.locked[c][r];
  }
  while (stack.length) {
    var cur = stack.pop();
    var key = cur[0] + ',' + cur[1];
    if (seen[key]) continue;
    seen[key] = true;
    group.push(cur);
    var ns = neighbours(cur[0], cur[1]);
    for (var i = 0; i < ns.length; i++) {
      var nc = ns[i][0], nr = ns[i][1];
      if (!inBoard(nc, nr)) continue;
      var nv = valAt(nc, nr);
      if (nv === null || nv === H.SLAG || nv === H.BOMB || nv === H.FREEZE) continue;
      if (lockedAt(nc, nr)) continue;
      if (nv === v || (v !== H.RAINBOW && nv === H.RAINBOW)) stack.push([nc, nr]);
    }
  }
  return group;
}
// Score one candidate placement: matches it forms, bombs it would set
// off, and a penalty for landing high on the stack.
function evalPlacement(col, rot) {
  var colors = S.piece.colors.slice();
  var flags = {
    locked: (S.piece.locked || [false, false, false]).slice(),
    armored: (S.piece.armored || [false, false, false]).slice(),
    star: (S.piece.star || [false, false, false]).slice()
  };
  for (var k = 0; k < rot; k++) {
    colors = [colors[2], colors[0], colors[1]];
    flags.locked = [flags.locked[2], flags.locked[0], flags.locked[1]];
    flags.armored = [flags.armored[2], flags.armored[0], flags.armored[1]];
    flags.star = [flags.star[2], flags.star[0], flags.star[1]];
  }
  var top = landingTop(col);
  if (top === null) return -1e9;
  var placed = [];
  for (var i = 0; i < 3; i++) placed.push({ c: col, r: top + i, v: colors[i], locked: flags.locked[i] });
  var score = 0;
  var seenGroups = {};
  for (var j = 0; j < placed.length; j++) {
    var cell = placed[j];
    if (cell.r < 0 || cell.locked) continue;
    // bombs, rainbows and freeze hexes never start a colour group of their own
    if (cell.v === H.BOMB || cell.v === H.FREEZE) continue;
    var group = floodGroup(cell, placed);
    var gkey = group.map(function (g) { return g[0] + ',' + g[1]; }).sort().join('|');
    if (seenGroups[gkey]) continue;
    seenGroups[gkey] = true;
    if (group.length >= 3) score += group.length * 100;
    else score += group.length * 8;
  }
  // setting off a bomb is worth a lot, and a star in a match pays extra
  for (var m = 0; m < placed.length; m++) {
    var ns = neighbours(placed[m].c, placed[m].r);
    for (var n = 0; n < ns.length; n++) {
      if (inBoard(ns[n][0], ns[n][1]) && H.getCell(ns[n][0], ns[n][1]) === H.BOMB) score += 60;
    }
    if (flags.star[m] && placed[m].r >= 0) score += 25;
  }
  // keep the stack low: landing high up is dangerous
  score -= Math.max(0, 8 - top) * 6;
  // a trio that would poke above the board is nearly a top-out
  if (top < 0) score -= 200;
  return score;
}
function chooseMove() {
  var best = null;
  for (var rot = 0; rot < 3; rot++) {
    for (var col = 0; col < COLS; col++) {
      var sc = evalPlacement(col, rot);
      if (!best || sc > best.score) best = { col: col, rot: rot, score: sc };
    }
  }
  return best;
}

// Play one full game with the bot. Returns run stats, or throws on a
// board-audit violation (the harness treats that as a failure).
function playGame(seed, maxLocks) {
  global.location.search = '?seed=' + seed;
  H.newGame();
  var locks = 0, stall = 0, auditFails = 0;
  while (S.state === 'playing' && locks < maxLocks) {
    if (!S.piece) {
      stall++;
      if (stall > 20) throw new Error('bot stalled: no falling piece for 20 steps');
      H.step(50);
      continue;
    }
    stall = 0;
    var mv = chooseMove();
    if (!mv) throw new Error('bot found no legal move');
    for (var r = 0; r < mv.rot; r++) H.rotatePiece();
    while (S.piece && S.piece.col < mv.col) { if (!H.movePiece(1)) break; }
    while (S.piece && S.piece.col > mv.col) { if (!H.movePiece(-1)) break; }
    H.hardDrop();
    locks++;
    H.step(50);
    var issues = H.validateBoard();
    if (issues.length) {
      auditFails++;
      if (auditFails <= 3) console.log('    audit issue after lock ' + locks + ': ' + issues.join('; '));
    }
    if (locks % 100 === 0) H.render(); // exercise the render path mid-game
  }
  return {
    seed: seed, score: S.score, level: S.level, locks: locks,
    clears: S.clears, bestChain: S.bestChain, allClears: S.allClears,
    surges: S.surges, pieces: S.pieces, hexesCleared: S.hexesCleared,
    repairs: S.repairs, auditFails: auditFails, over: S.state === 'over'
  };
}

// ---------- run ----------
console.log('== bot plays 10 full games ==');
check('handle exposed', !!H && H.VERSION === '0.18.0');
const results = [];
let threw = null;
try {
  for (let g = 1; g <= 10; g++) {
    const res = playGame('BOT' + g, 600);
    results.push(res);
    console.log('  game ' + g + ' (' + res.seed + '): score ' + res.score +
      ' level ' + res.level + ' locks ' + res.locks + ' clears ' + res.clears +
      ' bestChain x' + res.bestChain + ' surges ' + res.surges +
      ' repairs ' + res.repairs + ' auditFails ' + res.auditFails +
      (res.over ? ' (game over)' : ' (lock cap)'));
  }
} catch (e) { threw = e; }
check('bot played 10 games without throwing', threw === null, threw && threw.stack);
check('every game ended (top-out) or hit the lock cap cleanly',
  results.length === 10 && results.every(function (r) { return r.over || r.locks >= 600; }),
  results.length + ' games');
check('no board-audit failures in any game',
  results.every(function (r) { return r.auditFails === 0; }),
  JSON.stringify(results.map(function (r) { return r.auditFails; })));
check('no self-repairs needed in any game',
  results.every(function (r) { return r.repairs === 0; }),
  JSON.stringify(results.map(function (r) { return r.repairs; })));
check('bot scored in at least 8 of 10 games',
  results.filter(function (r) { return r.score > 0; }).length >= 8,
  results.map(function (r) { return r.score; }).join(','));
check('bot cleared matches in most games',
  results.filter(function (r) { return r.clears > 0; }).length >= 8,
  results.map(function (r) { return r.clears; }).join(','));
check('bot chained at least once across the games',
  results.some(function (r) { return r.bestChain >= 2; }),
  'best chains ' + results.map(function (r) { return r.bestChain; }).join(','));
// Block 18: the old "bot survived a surge" check was fragile — the bot
// advances only 50ms of run time per lock, so one slow-tide freeze (15s
// of run time = 300 locks) chains across most of a game and the tide
// almost never reaches 100 in bot time. The surge itself is now tested
// deterministically instead: park the tide at 99 and let it rise.
console.log('== tide surge fires on schedule ==');
H.newGame();
H.setTide(99);
var surgesBefore = S.surges;
for (var si = 0; si < 40 && S.surges === surgesBefore; si++) H.step(100);
check('tide at 99 surges within 4s of run time', S.surges === surgesBefore + 1, 'surges ' + S.surges);
check('surge resets the tide to 25', S.tide === 25, 'tide ' + S.tide);
check('surge pushes slag onto the board', S.board.some(function (col) { return col.indexOf(H.SLAG) !== -1; }));
check('bot reached level 2 in at least one game',
  results.some(function (r) { return r.level >= 2; }),
  'levels ' + results.map(function (r) { return r.level; }).join(','));
const totalScore = results.reduce(function (a, r) { return a + r.score; }, 0);
console.log('  total bot score across 10 games: ' + totalScore);

console.log('== determinism: same seed, same bot, same score ==');
let scoreA = 0, scoreB = 0, detThrew = null;
try {
  scoreA = playGame('BOT1', 600).score;
  scoreB = playGame('BOT1', 600).score;
} catch (e) { detThrew = e; }
check('determinism run did not throw', detThrew === null, detThrew && detThrew.stack);
check('same seed replays to the same score', scoreA === scoreB && scoreA > 0, scoreA + ' vs ' + scoreB);

console.log('\n' + pass + ' PASS, ' + fail + ' FAIL');
// Exit explicitly: the game's music scheduler (setInterval) keeps the Node
// event loop alive after newGame(), which is correct in a browser.
process.exit(fail ? 1 : 0);
