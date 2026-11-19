// Neon Hexfall — v0.13.0 — Block 13: README + screenshots + repo polish —
// real gameplay screenshots and an animated GIF in the README, a
// screenshot capture script (Playwright headless shell), issue templates
// and a CONTRIBUTING guide.
// Falling-hex arcade puzzle: tri-hex pieces fall, match 3+ connected hexes
// of one colour to clear them, chain cascades for multipliers, and outrun
// the rising tide. Vanilla JS + Canvas 2D + Web Audio. No build step.
'use strict';

(function () {
  var VERSION = '0.13.0';
  var COLS = 8, ROWS = 11, SLAG = 6, BOMB = 7, RAINBOW = 8;
  var COLORS = [
    { name: 'CYAN',   fill: '#22e6ff', glow: '#22e6ff' },
    { name: 'PINK',   fill: '#ff2d95', glow: '#ff2d95' },
    { name: 'LIME',   fill: '#a6ff3e', glow: '#a6ff3e' },
    { name: 'AMBER',  fill: '#ffb020', glow: '#ffb020' },
    { name: 'VIOLET', fill: '#8b5cf6', glow: '#8b5cf6' },
    { name: 'TEAL',   fill: '#2dd4bf', glow: '#2dd4bf' }
  ];
  var SLAG_COLOR = { name: 'SLAG', fill: '#5b5470', glow: '#3a3350' };
  var BOMB_COLOR = { name: 'BOMB', fill: '#2b2135', glow: '#ff3b5c' };
  // Score milestones / rank titles (backlog #5): Rookie -> Hex Legend.
  var RANKS = [
    { name: 'ROOKIE', at: 0 },
    { name: 'HEX CADET', at: 1000 },
    { name: 'HEX RUNNER', at: 2500 },
    { name: 'HEX HUNTER', at: 5000 },
    { name: 'HEX ACE', at: 10000 },
    { name: 'HEX ELITE', at: 20000 },
    { name: 'HEX MASTER', at: 35000 },
    { name: 'HEX LEGEND', at: 50000 }
  ];
  function rankFor(score) {
    var idx = 0;
    for (var i = 0; i < RANKS.length; i++) if (score >= RANKS[i].at) idx = i;
    return { idx: idx, name: RANKS[idx].name, next: RANKS[idx + 1] || null };
  }
  var HEX_R = 26;
  var COL_W = Math.sqrt(3) * HEX_R;      // horizontal spacing, pointy-top hexes
  var ROW_H = 1.5 * HEX_R;               // vertical spacing
  var BOARD_W = (COLS - 1) * COL_W + 2 * HEX_R;
  var X0 = (480 - BOARD_W) / 2 + HEX_R;
  var Y0 = 92;

  // ---------- tiny utils ----------
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function todaySeed() {
    var d = new Date();
    return '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  }
  function dailySeed() {
    var q = {};
    (window.location.search || '').replace(/[?&]([^=]+)=([^&]*)/g, function (m, k, v) { q[k] = v; });
    if (q.seed) return String(q.seed);
    return todaySeed();
  }
  function isTodaySeed() { return S.seed === todaySeed(); }
  function hashSeed(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // Shareable seed (backlog #26): anyone opening this link plays the exact
  // same trio sequence. Falls back to the Pages URL when the page was not
  // loaded over http(s) (e.g. the Node test harness).
  function seedUrl() {
    var href = (window.location && window.location.href) || '';
    var base = href ? href.split('?')[0].split('#')[0] : 'https://namdev-muse.github.io/neon-hexfall/';
    return base + '?seed=' + encodeURIComponent(S.seed);
  }
  function shareSeed(btn) {
    var url = seedUrl();
    function done() {
      if (btn) {
        var old = btn.textContent;
        btn.textContent = '✓ LINK COPIED';
        setTimeout(function () { btn.textContent = old; }, 2000);
      }
      announce('Seed link copied. Anyone opening it plays the same trios.');
    }
    function fallback() {
      // No clipboard API: show the link on the menu so it can be copied by hand.
      if (el.seedLine) el.seedLine.textContent = 'SEED LINK: ' + url;
      if (btn) {
        var old2 = btn.textContent;
        btn.textContent = 'LINK SHOWN BELOW';
        setTimeout(function () { btn.textContent = old2; }, 2000);
      }
      announce('Copy this seed link: ' + url);
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        var p = navigator.clipboard.writeText(url);
        if (p && typeof p.then === 'function') { p.then(done, fallback); return; }
        done(); return;
      }
    } catch (e) { /* fall through to the manual-copy path */ }
    fallback();
  }
  // Daily best (backlog #23): best score per seed, so today's challenge has
  // its own leaderboard entry separate from the all-time best.
  function dailyBestKey() { return 'nhx-daily-' + S.seed; }
  function loadDailyBest() {
    try { return parseInt(localStorage.getItem(dailyBestKey()) || '0', 10) || 0; } catch (e) { return 0; }
  }
  function saveDailyBest(v) {
    try { localStorage.setItem(dailyBestKey(), String(v)); } catch (e) {}
  }
  // Top-5 high-score table (backlog #44): the five best runs ever, kept in
  // localStorage under nhx-top5 as {score, seed, rank, date} entries, newest
  // best first. recordTop5() returns the 0-based table position of this
  // run's entry, or null when the run did not make the table.
  function loadTop5() {
    try {
      var raw = localStorage.getItem('nhx-top5');
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr.filter(function (e) { return e && typeof e.score === 'number'; })
        .sort(function (a, b) { return b.score - a.score; }).slice(0, 5);
    } catch (e) { return []; }
  }
  function saveTop5(list) {
    try { localStorage.setItem('nhx-top5', JSON.stringify(list.slice(0, 5))); } catch (e) {}
  }
  function recordTop5() {
    var list = loadTop5();
    var entry = {
      score: S.score, seed: S.seed, rank: rankFor(S.score).name,
      date: new Date().toISOString().slice(0, 10)
    };
    list.push(entry);
    list.sort(function (a, b) { return b.score - a.score; });
    list = list.slice(0, 5);
    saveTop5(list);
    var idx = list.indexOf(entry);
    return idx === -1 ? null : idx;
  }
  function top5RowsHTML(list, highlightIdx) {
    if (!list.length) return '<div class="top5-empty">No runs yet — be the first!</div>';
    return list.map(function (e, i) {
      return '<div class="top5-row' + (i === highlightIdx ? ' me' : '') + '">' +
        '<span class="top5-pos">' + (i + 1) + '.</span>' +
        '<span class="top5-score">' + e.score.toLocaleString() + '</span>' +
        '<span class="top5-rank">' + e.rank + '</span>' +
        '<span class="top5-date">' + e.date + '</span></div>';
    }).join('');
  }

  // ---------- DOM ----------
  var canvas = $('game');
  var ctx = canvas.getContext('2d');
  var el = {
    score: $('score'), best: $('best'), level: $('level'), lives: $('lives'),
    chain: $('chain'), tideFill: $('tideFill'),
    menu: $('menuOverlay'), how: $('howOverlay'), pause: $('pauseOverlay'), over: $('overOverlay'),
    playBtn: $('playBtn'), howBtn: $('howBtn'), howCloseBtn: $('howCloseBtn'), howMenuBtn: $('howMenuBtn'),
    resumeBtn: $('resumeBtn'), restartBtn: $('restartBtn'), quitBtn: $('quitBtn'),
    againBtn: $('againBtn'), overMenuBtn: $('overMenuBtn'),
    muteBtn: $('muteBtn'), pauseBtn: $('pauseBtn'),
    overBadge: $('overBadge'), overStats: $('overStats'), pauseStats: $('pauseStats'),
    liveRegion: $('liveRegion'), seedLine: $('seedLine'), menuNext: $('menuNext'),
    volSlider: $('volSlider'), menuVolSlider: $('menuVolSlider'),
    dailyBestLine: $('dailyBestLine'), rankLine: $('rankLine'),
    shareBtn: $('shareBtn'), shareBtnOver: $('shareBtnOver'), dailyBadge: $('dailyBadge'),
    top5List: $('top5List'), overTop5: $('overTop5'), top5Badge: $('top5Badge'),
    specialsStrip: $('specialsStrip')
  };

  // ---------- audio ----------
  var AudioSys = {
    ctx: null, master: null, muted: false, musicOn: true, musicTimer: null, musicStep: 0,
    volume: 0.5, played: {}, tempoMs: 460,
    init: function () {
      if (this.ctx) return;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },
    resume: function () { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    // Volume slider (backlog #36): 0..1, persisted, mute keeps gain at 0
    // while the stored volume is remembered.
    setVolume: function (v) {
      v = clamp(+v || 0, 0, 1);
      this.volume = v;
      if (this.master) this.master.gain.value = this.muted ? 0 : v;
      try { localStorage.setItem('nhx-volume', String(v)); } catch (e) {}
      if (el.volSlider) el.volSlider.value = String(v);
      if (el.menuVolSlider) el.menuVolSlider.value = String(v);
    },
    tone: function (freq, dur, type, vol, when) {
      if (!this.ctx || this.muted) return;
      try {
        var t0 = this.ctx.currentTime + (when || 0);
        var o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(vol || 0.25, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        o.connect(g); g.connect(this.master);
        o.start(t0); o.stop(t0 + dur + 0.02);
      } catch (e) { /* audio is best-effort */ }
    },
    sfx: function (name) {
      if (!this.ctx || this.muted) return;
      this.played[name] = (this.played[name] || 0) + 1;
      if (name === 'place') this.tone(180, 0.08, 'square', 0.12);
      else if (name === 'move') this.tone(320, 0.04, 'sine', 0.08);
      else if (name === 'rotate') this.tone(520, 0.05, 'triangle', 0.12);
      else if (name === 'clear') { this.tone(523, 0.12, 'sine', 0.2); this.tone(784, 0.14, 'sine', 0.18, 0.06); this.tone(1046, 0.18, 'sine', 0.16, 0.12); }
      else if (name === 'chain') { this.tone(660, 0.1, 'sine', 0.2); this.tone(880, 0.1, 'sine', 0.2, 0.05); this.tone(1318, 0.2, 'sine', 0.18, 0.1); }
      else if (name === 'surge') { this.tone(98, 0.5, 'sawtooth', 0.2); this.tone(65, 0.6, 'sawtooth', 0.18, 0.1); }
      else if (name === 'levelup') { var n = [392, 523, 659, 784]; for (var i = 0; i < 4; i++) this.tone(n[i], 0.14, 'triangle', 0.2, i * 0.07); }
      else if (name === 'bigmatch') { this.tone(440, 0.08, 'square', 0.18); this.tone(660, 0.08, 'square', 0.18, 0.06); this.tone(880, 0.16, 'square', 0.18, 0.12); }
      else if (name === 'allclear') { var a = [523, 659, 784, 1046, 1318]; for (var k = 0; k < 5; k++) this.tone(a[k], 0.16, 'triangle', 0.2, k * 0.08); this.tone(2093, 0.3, 'sine', 0.12, 0.4); }
      else if (name === 'bomb') { this.tone(70, 0.4, 'sawtooth', 0.28); this.tone(45, 0.5, 'sine', 0.28, 0.05); this.tone(180, 0.12, 'square', 0.15); this.tone(35, 0.6, 'sine', 0.3, 0.02); }
      // New SFX (backlog #35): powerup spawn jingle + tide-surge warning alarm.
      else if (name === 'powerup') { var pu = [880, 1174, 1568, 2093]; for (var q3 = 0; q3 < 4; q3++) this.tone(pu[q3], 0.1, 'sine', 0.16, q3 * 0.05); }
      else if (name === 'surgewarn') { this.tone(196, 0.18, 'sawtooth', 0.2); this.tone(147, 0.22, 'sawtooth', 0.2, 0.2); }
      // Tide warning tick (backlog #17): a soft low blip that repeats while
      // the tide sits in the last 20%, so the danger stays audible.
      else if (name === 'tidepulse') this.tone(150, 0.12, 'sine', 0.09);
      else if (name === 'rainbow') { var rb = [784, 988, 1175, 1568]; for (var q2 = 0; q2 < 4; q2++) this.tone(rb[q2], 0.1, 'sine', 0.14, q2 * 0.05); }
      // Elite hex SFX (backlog #12/#13/#14): a bright chime for a star
      // bonus, a short crunch for an armor crack, a rising pair for a lock.
      else if (name === 'star') { var st = [1568, 2093, 2637]; for (var q4 = 0; q4 < 3; q4++) this.tone(st[q4], 0.12, 'sine', 0.16, q4 * 0.05); }
      else if (name === 'crack') { this.tone(140, 0.08, 'square', 0.15); this.tone(90, 0.1, 'sawtooth', 0.12, 0.02); }
      else if (name === 'unlock') { this.tone(523, 0.1, 'triangle', 0.18); this.tone(784, 0.14, 'triangle', 0.18, 0.08); }
      else if (name === 'topout') { this.tone(220, 0.3, 'sawtooth', 0.22); this.tone(110, 0.45, 'sawtooth', 0.2, 0.12); }
      else if (name === 'gameover') { var m = [330, 262, 196, 131]; for (var j = 0; j < 4; j++) this.tone(m[j], 0.35, 'triangle', 0.2, j * 0.18); }
      else if (name === 'drop') this.tone(240, 0.06, 'square', 0.14);
    },
    // Music intensity (backlog #34): the loop gets faster with level and
    // chain, and gains layers — a hat tick at level 2+, a harmony fifth at
    // level 4+, and a sparkle arpeggio while a chain is live.
    musicTempo: function (level, chain) {
      return Math.max(300, 460 - (level - 1) * 25 - (chain >= 3 ? 40 : chain >= 2 ? 20 : 0));
    },
    applyIntensity: function () {
      var t = this.musicTempo(S.level, S.chain);
      if (t === this.tempoMs) return;
      this.tempoMs = t;
      if (this.musicTimer) { this.stopMusic(); this.startMusic(); }
    },
    startMusic: function () {
      if (!this.ctx || this.musicTimer) return;
      var self = this;
      var bass = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42]; // A1 A1 C2 G1 ...
      this.tempoMs = this.musicTempo(S.level, S.chain);
      this.musicTimer = setInterval(function () {
        if (self.muted || !self.musicOn) return;
        var f = bass[self.musicStep % bass.length];
        self.tone(f, 0.42, 'triangle', 0.07);
        if (self.musicStep % 2 === 0) self.tone(f * 4, 0.12, 'sine', 0.03);
        if (S.level >= 2 && self.musicStep % 2 === 1) self.tone(2400, 0.03, 'square', 0.015);
        if (S.level >= 4 && self.musicStep % 4 === 0) self.tone(f * 1.5, 0.3, 'sine', 0.04);
        if (S.chain >= 2) {
          var arp = [1046.5, 1318.5, 1568];
          self.tone(arp[self.musicStep % arp.length], 0.1, 'sine', 0.035);
        }
        self.musicStep++;
      }, this.tempoMs);
    },
    stopMusic: function () { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }
  };
  try { AudioSys.muted = localStorage.getItem('nhx-muted') === '1'; } catch (e) {}
  try {
    var savedVol = parseFloat(localStorage.getItem('nhx-volume'));
    if (!isNaN(savedVol)) AudioSys.volume = clamp(savedVol, 0, 1);
  } catch (e) {}

  // ---------- state ----------
  var S = {
    state: 'menu',           // menu | playing | paused | over
    board: [],               // board[col][row] = colour index 0..5, SLAG(6), or null
    piece: null,             // {col, row(float, top cell), colors:[c,c,c]}
    next: null,              // next piece colours [c,c,c]
    rng: null, seed: '',
    score: 0, best: 0, level: 1, lives: 3,
    tide: 0, chain: 1, clears: 0,
    pieces: 0, hexesCleared: 0, matches: 0, bestChain: 0,
    timeMs: 0, fallAcc: 0, softDrop: false,
    particles: [], floats: [], shake: 0, hitStop: 0, pops: [], rings: [], confetti: [],
    chainFire: 0, chainFireT: 0, chainFireAcc: 0,
    banner: null, allClears: 0, lastClear: null, biggestMatch: 0,
    specialsSpawned: 0, bombsDetonated: 0, rainbowsCleared: 0, triosSinceSpecial: 0,
    tideWarned: false, rankIdx: 0, dailyBest: 0, pendingRankUp: null,
    top5: [], top5Rank: null, activeFx: [],
    // Block 9: surge variants — a pending double surge fires at this run
    // time, plus surge stats and the repeating tide-warning tick.
    pendingSurgeAt: null, surges: 0, doubleSurges: 0,
    lastSurgePattern: 'full', lastTideTick: 0,
    // Block 10: elite hexes — parallel board flags (armor hits left,
    // locked, star bonus) plus the queued trio's elite flags and stats.
    armor: [], locked: [], star: [], nextElite: null,
    armorCracked: 0, armoredCleared: 0, lockedUnlocked: 0, starsCleared: 0,
    muted: AudioSys.muted,
    // Block 8: keyboard focus (button id) + touch drag state.
    kbdFocus: null, overlay: null, touch: { active: false },
    // Block 11: playtest + bugfix — self-repair counter, frame-time
    // average + low-FX flag for the FPS guard, and the last audit time.
    repairs: 0, frameEma: 16, frameCount: 0, lowFx: false, lastAudit: 0
  };
  try { S.best = parseInt(localStorage.getItem('nhx-best') || '0', 10) || 0; } catch (e) {}

  function emptyBoard() {
    var b = [];
    for (var c = 0; c < COLS; c++) { b.push(new Array(ROWS).fill(null)); }
    return b;
  }
  // Elite flags live in parallel boards so the main board keeps holding
  // plain colour values. clearCell empties a cell in all four boards at
  // once, so a flag can never go stale on a cell that is gone.
  function emptyFlags(fill) {
    var f = [];
    for (var c = 0; c < COLS; c++) { f.push(new Array(ROWS).fill(fill)); }
    return f;
  }
  function clearCell(c, r) {
    S.board[c][r] = null;
    S.armor[c][r] = 0;
    S.locked[c][r] = false;
    S.star[c][r] = false;
  }
  // Board-consistency audit + self-repair (backlog #48): validateBoard
  // scans the board, the elite flag boards and the numeric run state and
  // returns a list of issue strings (empty when everything is sound).
  // sanitizeState repairs what it can — clearing invalid cells, dropping
  // stale elite flags, clamping run numbers back into range, compacting
  // floating hexes, and replacing a stuck piece — and counts the repairs
  // in S.repairs, so a silent corruption never hides. step() runs the
  // audit once a second while playing; the bot harness runs it after
  // every lock.
  function validateBoard() {
    var issues = [];
    for (var c = 0; c < COLS; c++) {
      var seenEmpty = false;
      for (var r = ROWS - 1; r >= 0; r--) {
        var v = S.board[c][r];
        if (v === null) { seenEmpty = true; continue; }
        if (typeof v !== 'number' || Math.floor(v) !== v || v < 0 || v > RAINBOW) {
          issues.push('bad cell (' + c + ',' + r + ')=' + v);
          continue;
        }
        if (seenEmpty) issues.push('floating hex at (' + c + ',' + r + ')');
        if (typeof S.armor[c][r] !== 'number' || Math.floor(S.armor[c][r]) !== S.armor[c][r] || S.armor[c][r] < 0 || S.armor[c][r] > 2)
          issues.push('bad armor (' + c + ',' + r + ')=' + S.armor[c][r]);
        if (typeof S.locked[c][r] !== 'boolean') issues.push('bad lock flag (' + c + ',' + r + ')');
        if (typeof S.star[c][r] !== 'boolean') issues.push('bad star flag (' + c + ',' + r + ')');
        if ((S.armor[c][r] > 0 || S.locked[c][r] || S.star[c][r]) && (v === SLAG || v === BOMB || v === RAINBOW))
          issues.push('elite flag on a special (' + c + ',' + r + ')');
      }
    }
    if (!isFinite(S.score) || S.score < 0) issues.push('bad score ' + S.score);
    if (!isFinite(S.best) || S.best < 0) issues.push('bad best ' + S.best);
    if (!isFinite(S.level) || S.level < 1 || Math.floor(S.level) !== S.level) issues.push('bad level ' + S.level);
    if (!isFinite(S.lives) || S.lives < 0 || S.lives > 3) issues.push('bad lives ' + S.lives);
    if (!isFinite(S.tide) || S.tide < 0 || S.tide > 110) issues.push('bad tide ' + S.tide);
    if (!isFinite(S.timeMs) || S.timeMs < 0) issues.push('bad time ' + S.timeMs);
    if (!isFinite(S.fallAcc) || S.fallAcc < 0) issues.push('bad fallAcc ' + S.fallAcc);
    if (!isFinite(S.chain) || S.chain < 1) issues.push('bad chain ' + S.chain);
    if (S.piece) {
      if (!isFinite(S.piece.row) || S.piece.row < -3 || S.piece.row >= ROWS) issues.push('bad piece row ' + S.piece.row);
      if (typeof S.piece.col !== 'number' || S.piece.col < 0 || S.piece.col >= COLS) issues.push('bad piece col ' + S.piece.col);
      if (!S.piece.colors || S.piece.colors.length !== 3 ||
          S.piece.colors.some(function (cv) { return typeof cv !== 'number' || Math.floor(cv) !== cv || cv < 0 || cv > RAINBOW; }))
        issues.push('bad piece colors ' + JSON.stringify(S.piece.colors));
    }
    return issues;
  }
  function sanitizeState() {
    var fixed = 0;
    for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) {
      var v = S.board[c][r];
      if (v === null) {
        // a flag on an empty cell is stale — drop it
        if (S.armor[c][r] !== 0 || S.locked[c][r] || S.star[c][r]) { S.armor[c][r] = 0; S.locked[c][r] = false; S.star[c][r] = false; fixed++; }
        continue;
      }
      if (typeof v !== 'number' || Math.floor(v) !== v || v < 0 || v > RAINBOW) { clearCell(c, r); fixed++; continue; }
      if (v === SLAG || v === BOMB || v === RAINBOW) {
        if (S.armor[c][r] !== 0 || S.locked[c][r] || S.star[c][r]) { S.armor[c][r] = 0; S.locked[c][r] = false; S.star[c][r] = false; fixed++; }
      }
      if (typeof S.armor[c][r] !== 'number' || S.armor[c][r] < 0 || S.armor[c][r] > 2) { S.armor[c][r] = 0; fixed++; }
      if (typeof S.locked[c][r] !== 'boolean') { S.locked[c][r] = false; fixed++; }
      if (typeof S.star[c][r] !== 'boolean') { S.star[c][r] = false; fixed++; }
    }
    // floating hexes (an empty cell below a filled one) are compacted
    var floating = false;
    for (var fc = 0; fc < COLS && !floating; fc++) {
      var seenEmpty = false;
      for (var fr = ROWS - 1; fr >= 0; fr--) {
        if (S.board[fc][fr] === null) seenEmpty = true;
        else if (seenEmpty) { floating = true; break; }
      }
    }
    if (floating) { applyGravity(); fixed++; }
    if (!isFinite(S.score) || S.score < 0) { S.score = 0; fixed++; }
    if (!isFinite(S.best) || S.best < 0) { S.best = 0; fixed++; }
    if (!isFinite(S.level) || S.level < 1 || Math.floor(S.level) !== S.level) { S.level = Math.max(1, Math.floor(S.level) || 1); fixed++; }
    if (!isFinite(S.lives)) { S.lives = 3; fixed++; }
    else if (S.lives < 0 || S.lives > 3) { S.lives = clamp(Math.floor(S.lives), 0, 3); fixed++; }
    if (!isFinite(S.tide)) { S.tide = 0; fixed++; }
    else S.tide = clamp(S.tide, 0, 100);
    if (!isFinite(S.timeMs) || S.timeMs < 0) { S.timeMs = 0; fixed++; }
    if (!isFinite(S.fallAcc) || S.fallAcc < 0) { S.fallAcc = 0; fixed++; }
    if (!isFinite(S.chain) || S.chain < 1) { S.chain = 1; fixed++; }
    // a stuck piece (bad row / column / colours) is dropped and a fresh
    // one spawns, instead of freezing the run forever
    if (S.piece && (!isFinite(S.piece.row) || S.piece.row < -3 || S.piece.row >= ROWS ||
        typeof S.piece.col !== 'number' || S.piece.col < 0 || S.piece.col >= COLS ||
        !S.piece.colors || S.piece.colors.length !== 3 ||
        S.piece.colors.some(function (cv) { return typeof cv !== 'number' || Math.floor(cv) !== cv || cv < 0 || cv > RAINBOW; }))) {
      S.piece = null;
      fixed++;
      if (S.state === 'playing') spawnPiece();
    }
    if (fixed > 0) S.repairs += fixed;
    return fixed;
  }
  function fallMs() { return Math.max(220, 650 - (S.level - 1) * 45); }
  function tidePerSec() { return 100 / Math.max(38, 78 - (S.level - 1) * 5); }

  // odd-q offset neighbours (pointy-top, odd columns shifted down half a row)
  function neighbours(c, r) {
    var odd = (c % 2) === 1;
    if (odd) return [[c + 1, r], [c + 1, r - 1], [c, r - 1], [c - 1, r - 1], [c - 1, r], [c, r + 1]];
    return [[c + 1, r + 1], [c + 1, r], [c, r - 1], [c - 1, r], [c - 1, r + 1], [c, r + 1]];
  }
  function inBoard(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS; }
  function cellAt(c, r) { return inBoard(c, r) ? S.board[c][r] : undefined; }

  function hexXY(c, r) {
    return { x: X0 + c * COL_W, y: Y0 + r * ROW_H + (c % 2 ? ROW_H / 2 : 0) };
  }
  function drawHex(x, y, r, fill, glow, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 180 * (60 * i - 90);
      var px = x + r * Math.cos(a), py = y + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    // FPS guard (backlog #47): shadowBlur is the most expensive thing in
    // the frame (every hex glows) — skip it entirely in low-FX mode.
    ctx.shadowColor = glow; ctx.shadowBlur = S.lowFx ? 0 : 12;
    ctx.fillStyle = fill; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }

  // Style for any board value: colours 0-5, SLAG (6), BOMB (7), RAINBOW (8).
  // Rainbows cycle hue over time so they read as "any colour".
  function cellStyle(v) {
    if (v === SLAG) return SLAG_COLOR;
    if (v === BOMB) return BOMB_COLOR;
    if (v === RAINBOW) {
      var hue = (S.timeMs / 12) % 360;
      var c = 'hsl(' + hue + ',100%,62%)';
      return { name: 'RAINBOW', fill: c, glow: c };
    }
    return COLORS[v];
  }
  function drawBombGlyph(x, y, s) {
    ctx.save();
    ctx.fillStyle = '#14101f';
    ctx.beginPath(); ctx.arc(x, y + 2 * s, 8 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(x + 5 * s, y - 4 * s); ctx.lineTo(x + 10 * s, y - 9 * s); ctx.stroke();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(x + 11 * s, y - 10 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawSpecialMark(x, y, v, s) {
    if (v === BOMB) drawBombGlyph(x, y, s);
    else if (v === RAINBOW) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = 'bold ' + Math.round(14 * s) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✦', x, y + 1);
      ctx.restore();
    }
  }
  function strokeHex(x, y, r, color, width) {
    ctx.save();
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 180 * (60 * i - 90);
      var px = x + r * Math.cos(a), py = y + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    ctx.restore();
  }
  // Elite hex marks (backlog #12/#13/#14): armored hexes wear a steel ring
  // (cracked with dark zigzags when one hit remains), locked hexes wear a
  // gold padlock, and bonus stars carry a gold star.
  function drawEliteMark(x, y, armor, locked, star, s) {
    if (armor > 0) {
      strokeHex(x, y, HEX_R - 4, '#d7dce6', 3 * s);
      strokeHex(x, y, HEX_R - 9, 'rgba(138,147,166,0.9)', 1.5 * s);
      if (armor === 1) {
        ctx.save();
        ctx.strokeStyle = '#2a2f3a'; ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(x - 9 * s, y - 7 * s); ctx.lineTo(x - 2 * s, y); ctx.lineTo(x + 3 * s, y - 5 * s); ctx.lineTo(x + 9 * s, y + 2 * s);
        ctx.moveTo(x - 7 * s, y + 8 * s); ctx.lineTo(x, y + 2 * s); ctx.lineTo(x + 8 * s, y + 8 * s);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (locked) {
      ctx.save();
      ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 2.5 * s;
      ctx.beginPath(); ctx.arc(x, y - 3 * s, 6 * s, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#ffd23e';
      ctx.fillRect(x - 8 * s, y - 3 * s, 16 * s, 12 * s);
      ctx.fillStyle = '#2a1f00';
      ctx.beginPath(); ctx.arc(x, y + 3 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (star) {
      ctx.save();
      ctx.fillStyle = '#ffe14d';
      ctx.font = 'bold ' + Math.round(17 * s) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('★', x, y + 1);
      ctx.restore();
    }
  }

  function announce(msg) { if (el.liveRegion) el.liveRegion.textContent = msg; }

  // Rank-up (backlog #5): when the run's score crosses a rank threshold,
  // flash a banner. Called from updateHUD, which runs after every lock and
  // every frame while playing. If a chain / all-clear banner is live, the
  // rank-up queues behind it instead of clobbering the more urgent feedback.
  function showRankUp(name) {
    addBanner('RANK UP!', name, '#a6ff3e');
    addFloat(240, 330, name, '#a6ff3e');
    AudioSys.sfx('levelup');
    announce('Rank up! You are now ' + name + '.');
  }
  function checkRankUp() {
    if (S.state !== 'playing') return;
    var r = rankFor(S.score);
    if (r.idx > S.rankIdx) {
      S.rankIdx = r.idx;
      if (S.banner) S.pendingRankUp = r.name;
      else showRankUp(r.name);
    }
  }

  // Powerup HUD indicators (backlog #11): live counts of the special and
  // elite hexes sitting on the board, for the strip under the HUD.
  function countSpecials() {
    var bombs = 0, rainbows = 0, armored = 0, locked = 0, stars = 0;
    for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) {
      if (S.board[c][r] === BOMB) bombs++;
      else if (S.board[c][r] === RAINBOW) rainbows++;
      if (S.armor[c][r] > 0) armored++;
      if (S.locked[c][r]) locked++;
      if (S.star[c][r]) stars++;
    }
    return { bombs: bombs, rainbows: rainbows, armored: armored, locked: locked, stars: stars };
  }
  // Active timed effects (backlog #11): the strip renders each live effect
  // with a countdown in seconds. The registry is empty until the timed
  // powerups (slow-tide #8, tide freeze #18) land and call addFx.
  function addFx(key, label, ms) {
    removeFx(key);
    S.activeFx.push({ key: key, label: label, until: S.timeMs + ms });
  }
  function removeFx(key) {
    S.activeFx = S.activeFx.filter(function (f) { return f.key !== key; });
  }
  function expireFx() {
    S.activeFx = S.activeFx.filter(function (f) { return f.until > S.timeMs; });
  }

  // ---------- pieces ----------
  function rollColors() {
    var out = [];
    for (var i = 0; i < 3; i++) out.push(Math.floor(S.rng() * COLORS.length));
    // Powerup drops: a trio sometimes carries one special hex (bomb or
    // rainbow) in a random slot. Chance grows slightly with level, and a
    // pity timer guarantees a special at least every 12 trios.
    S.triosSinceSpecial++;
    var bombP = Math.min(0.15, 0.05 + S.level * 0.005);
    var rainP = Math.min(0.15, 0.04 + S.level * 0.005);
    var roll = S.rng(), special = null;
    if (S.triosSinceSpecial >= 12) special = roll < 0.5 ? BOMB : RAINBOW;
    else if (roll < bombP) special = BOMB;
    else if (roll < bombP + rainP) special = RAINBOW;
    if (special !== null) {
      out[Math.floor(S.rng() * 3)] = special;
      S.triosSinceSpecial = 0;
      S.specialsSpawned++;
      AudioSys.sfx('powerup'); // a special hex dropped in — sparkle jingle
    }
    return out;
  }
  // Elite hexes (backlog #12/#13/#14): a trio sometimes carries one elite
  // hex — armored (2 hits to clear), locked (unlock by matching next to
  // it), or a bonus star (+250 on clear). Level-gated so the early game
  // stays clean, never on a bomb/rainbow slot, one elite per trio at most.
  // Difficulty balance: elites ramp in slowly with level (stars/armor
  // from level 2, locks from level 3) instead of arriving all at once.
  function eliteChance(level) {
    return {
      star: level >= 2 ? Math.min(0.08, 0.05 + level * 0.002) : 0,
      armor: level >= 2 ? Math.min(0.12, 0.07 + level * 0.003) : 0,
      lock: level >= 3 ? Math.min(0.10, 0.06 + level * 0.003) : 0
    };
  }
  function rollEliteFlags(colors) {
    var flags = { armored: [false, false, false], locked: [false, false, false], star: [false, false, false] };
    var ch = eliteChance(S.level);
    var total = ch.star + ch.armor + ch.lock;
    if (total <= 0) return flags;
    var roll = S.rng(), kind = null;
    if (roll < ch.star) kind = 'star';
    else if (roll < ch.star + ch.armor) kind = 'armored';
    else if (roll < total) kind = 'locked';
    if (!kind) return flags;
    // pick a normal colour slot; a bomb/rainbow slot can't be elite
    var slot = Math.floor(S.rng() * 3);
    if (colors[slot] === BOMB || colors[slot] === RAINBOW) {
      slot = -1;
      for (var i = 0; i < 3; i++) if (colors[i] !== BOMB && colors[i] !== RAINBOW) { slot = i; break; }
      if (slot === -1) return flags;
    }
    flags[kind][slot] = true;
    return flags;
  }
  function spawnPiece() {
    var col = Math.floor(COLS / 2) - 1;
    var colors = S.next || rollColors();
    var elite = S.nextElite || rollEliteFlags(colors);
    S.next = rollColors();
    S.nextElite = rollEliteFlags(S.next);
    S.piece = { col: col, row: -2, colors: colors, armored: elite.armored, locked: elite.locked, star: elite.star }; // row = top cell; starts above board
    S.fallAcc = 0;
    // top-out: spawn cells blocked
    if (cellAt(col, 0) !== null || cellAt(col, 1) !== null) { topOut(); return false; }
    return true;
  }
  function pieceCells(p) {
    p = p || S.piece;
    if (!p) return [];
    var top = Math.floor(p.row);
    var out = [];
    for (var i = 0; i < 3; i++) {
      out.push({
        c: p.col, r: top + i, color: p.colors[i],
        armored: !!(p.armored && p.armored[i]),
        locked: !!(p.locked && p.locked[i]),
        star: !!(p.star && p.star[i])
      });
    }
    return out;
  }
  function pieceFits(col, topRow) {
    for (var i = 0; i < 3; i++) {
      var r = topRow + i;
      if (r >= ROWS) return false;
      if (r >= 0 && S.board[col][r] !== null) return false;
    }
    return true;
  }
  function movePiece(dc) {
    if (S.state !== 'playing' || !S.piece) return false;
    var nc = S.piece.col + dc;
    if (nc < 0 || nc >= COLS) return false;
    if (!pieceFits(nc, Math.floor(S.piece.row))) return false;
    S.piece.col = nc; AudioSys.sfx('move'); return true;
  }
  function rotatePiece() {
    if (S.state !== 'playing' || !S.piece) return false;
    var c = S.piece.colors;
    S.piece.colors = [c[2], c[0], c[1]];
    // Elite flags ride along with the hexes they belong to.
    ['armored', 'locked', 'star'].forEach(function (k) {
      var f = S.piece[k];
      if (f) S.piece[k] = [f[2], f[0], f[1]];
    });
    AudioSys.sfx('rotate'); return true;
  }
  function hardDrop() {
    if (S.state !== 'playing' || !S.piece) return;
    var rows = 0;
    while (pieceFits(S.piece.col, Math.floor(S.piece.row) + 1)) { S.piece.row += 1; rows++; }
    S.score += rows * 2;
    AudioSys.sfx('drop');
    lockPiece();
  }
  function lockPiece() {
    var cells = pieceCells();
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (cell.r >= 0 && cell.r < ROWS) {
        S.board[cell.c][cell.r] = cell.color;
        S.armor[cell.c][cell.r] = cell.armored ? 2 : 0;
        S.locked[cell.c][cell.r] = !!cell.locked;
        S.star[cell.c][cell.r] = !!cell.star;
      }
    }
    S.piece = null;
    S.pieces++;
    S.tide = clamp(S.tide + 3, 0, 100);
    AudioSys.sfx('place');
    addShake(2);
    resolveBoard();
    if (S.state === 'playing') spawnPiece();
    updateHUD();
  }
  function topOut() {
    S.piece = null;
    S.lives--;
    AudioSys.sfx('topout');
    addShake(14);
    burst(240, 120, '#ff3b5c', 40);
    announce('Stack reached the top — a life lost, the tide breaks the top rows away.');
    // tide break: clear the top 4 rows
    for (var c = 0; c < COLS; c++) for (var r = 0; r < 4; r++) clearCell(c, r);
    S.tide = 25;
    updateHUD();
    if (S.lives <= 0) gameOver();
    else spawnPiece();
  }

  // ---------- matching / gravity ----------
  // A cell matches group colour v when it is that colour, or a rainbow
  // wildcard (rainbows also match each other as their own colour).
  function groupMatches(v, cell) {
    return cell === v || (v !== RAINBOW && cell === RAINBOW);
  }
  function findGroups() {
    var seen = [];
    for (var c = 0; c < COLS; c++) seen.push(new Array(ROWS).fill(false));
    var groups = [];
    for (var c = 0; c < COLS; c++) {
      for (var r = 0; r < ROWS; r++) {
        var v = S.board[c][r];
        // Locked hexes (backlog #13) never match — they sit out of groups
        // until a clear next to them breaks the lock.
        if (v === null || v === SLAG || v === BOMB || S.locked[c][r] || seen[c][r]) continue;
        var stack = [[c, r]], group = [], local = {};
        local[c + ',' + r] = true;
        while (stack.length) {
          var cur = stack.pop();
          group.push(cur);
          var ns = neighbours(cur[0], cur[1]);
          for (var i = 0; i < ns.length; i++) {
            var nc = ns[i][0], nr = ns[i][1];
            if (!inBoard(nc, nr) || local[nc + ',' + nr]) continue;
            if (groupMatches(v, S.board[nc][nr]) && !S.locked[nc][nr]) { local[nc + ',' + nr] = true; stack.push([nc, nr]); }
          }
        }
        // Mark plain cells seen so a component is flooded once; rainbow
        // cells stay unmarked — one rainbow can bridge two colour groups.
        for (var m = 0; m < group.length; m++) {
          if (S.board[group[m][0]][group[m][1]] !== RAINBOW) seen[group[m][0]][group[m][1]] = true;
        }
        if (group.length >= 3) groups.push(group);
      }
    }
    return groups;
  }
  function applyGravity() {
    // Elite flags travel with their hexes, so armor / locks / stars stay
    // attached to the right colour as the column compacts.
    for (var c = 0; c < COLS; c++) {
      var col = S.board[c];
      var write = ROWS - 1;
      for (var r = ROWS - 1; r >= 0; r--) {
        if (col[r] !== null) {
          col[write] = col[r];
          S.armor[c][write] = S.armor[c][r];
          S.locked[c][write] = S.locked[c][r];
          S.star[c][write] = S.star[c][r];
          if (write !== r) { col[r] = null; S.armor[c][r] = 0; S.locked[c][r] = false; S.star[c][r] = false; }
          write--;
        }
      }
      for (var w = write; w >= 0; w--) { col[w] = null; S.armor[c][w] = 0; S.locked[c][w] = false; S.star[c][w] = false; }
    }
  }
  // Bombs never match by colour. A bomb detonates when any cell next to it
  // is cleared, blasting its 6 neighbours (50 pts per blasted hex, x chain)
  // and chain-detonating any bomb caught in the blast or next to a cell the
  // blast cleared. clearedSet grows with every blasted cell so adjacent
  // slag crumbles too. Returns the bonus points earned.
  function detonateBombs(clearedSet, chain) {
    var pts = 0, detonated = {};
    var queue = [];
    function queueBomb(c, r) {
      if (S.board[c][r] === BOMB && !detonated[c + ',' + r]) queue.push([c, r]);
    }
    for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) {
      if (S.board[c][r] !== BOMB) continue;
      var ns = neighbours(c, r);
      for (var i = 0; i < ns.length; i++) if (clearedSet[ns[i][0] + ',' + ns[i][1]]) { queueBomb(c, r); break; }
    }
    while (queue.length) {
      var b = queue.shift();
      var bc = b[0], br = b[1];
      if (S.board[bc][br] !== BOMB || detonated[bc + ',' + br]) continue;
      detonated[bc + ',' + br] = true;
      S.bombsDetonated++;
      var bp = hexXY(bc, br);
      burst(bp.x, bp.y, '#ff3b5c', 18);
      burst(bp.x, bp.y, '#ffd23e', 10);
      addPop(bp.x, bp.y, '#ff3b5c');
      clearCell(bc, br);
      clearedSet[bc + ',' + br] = true;
      var ns2 = neighbours(bc, br);
      for (var j = 0; j < ns2.length; j++) {
        var nc = ns2[j][0], nr = ns2[j][1];
        if (!inBoard(nc, nr)) continue;
        var nv = S.board[nc][nr];
        if (nv === null) continue;
        if (nv === BOMB) { queueBomb(nc, nr); continue; }
        var qp = hexXY(nc, nr);
        burst(qp.x, qp.y, cellStyle(nv).glow, 6);
        addPop(qp.x, qp.y, cellStyle(nv).glow);
        clearCell(nc, nr);
        clearedSet[nc + ',' + nr] = true;
        S.hexesCleared++;
        pts += 50 * chain;
        // a bomb next to a freshly blasted cell detonates too
        var ns3 = neighbours(nc, nr);
        for (var k = 0; k < ns3.length; k++) {
          if (inBoard(ns3[k][0], ns3[k][1])) queueBomb(ns3[k][0], ns3[k][1]);
        }
      }
    }
    if (Object.keys(detonated).length > 0) {
      AudioSys.sfx('bomb');
      addShake(6);
      addHitStop(70);
      if (pts > 0) addFloat(240, 200, '💥 BOMB! +' + pts, '#ff3b5c');
      announce('Bomb detonated! +' + pts + ' points.');
    }
    return pts;
  }
  function resolveBoard() {
    var chain = 0;
    for (;;) {
      var groups = findGroups();
      if (!groups.length) break;
      chain++;
      var cleared = 0, slagCleared = 0;
      var clearedSet = {};
      // match-size bonus: 4-hex groups pay +200, 5 pay +400, 6+ pay +800 (x chain)
      var sizeBonus = 0, biggest = 0, bigCx = 240, bigCy = 200, bigColor = '#ff2d95';
      for (var g = 0; g < groups.length; g++) {
        var sz = groups[g].length;
        if (sz > biggest) {
          biggest = sz;
          var sx = 0, sy = 0;
          for (var m = 0; m < sz; m++) { var cp = hexXY(groups[g][m][0], groups[g][m][1]); sx += cp.x; sy += cp.y; }
          bigCx = sx / sz; bigCy = sy / sz;
          bigColor = cellStyle(S.board[groups[g][0][0]][groups[g][0][1]]).glow;
        }
        if (sz === 4) sizeBonus += 200 * chain;
        else if (sz === 5) sizeBonus += 400 * chain;
        else if (sz >= 6) sizeBonus += 800 * chain;
      }
      S.biggestMatch = Math.max(S.biggestMatch, biggest);
      var rainbowsThisCascade = 0;
      var cracked = 0, starPts = 0;
      for (var g2 = 0; g2 < groups.length; g2++) {
        var group = groups[g2];
        for (var i = 0; i < group.length; i++) {
          var cc = group[i][0], rr = group[i][1];
          var cv = S.board[cc][rr];
          if (cv === null) continue; // shared rainbow already cleared by another group
          // Armored hex (backlog #12): a match hit cracks it; it only
          // clears once its armor is gone. A crack is not a clear — no
          // points, no clearedSet entry, so adjacent slag and bombs stay.
          if (S.armor[cc][rr] > 0) {
            S.armor[cc][rr]--;
            S.armorCracked++;
            var ap = hexXY(cc, rr);
            burst(ap.x, ap.y, '#c8ccd4', 5);
            if (S.armor[cc][rr] === 0) S.armoredCleared++;
            else {
              cracked++;
              addFloat(ap.x, ap.y - 20, 'CRACK!', '#c8ccd4');
              continue;
            }
          }
          if (cv === RAINBOW) { S.rainbowsCleared++; rainbowsThisCascade++; }
          // Bonus star (backlog #14): clearing a star hex pays +250 x chain.
          if (S.star[cc][rr]) {
            starPts += 250 * chain;
            S.starsCleared++;
            var sp2 = hexXY(cc, rr);
            addFloat(sp2.x, sp2.y - 22, '★ +' + (250 * chain), '#ffe14d');
            burst(sp2.x, sp2.y, '#ffe14d', 10);
          }
          var p = hexXY(cc, rr);
          burst(p.x, p.y, cellStyle(cv).glow, 6);
          addPop(p.x, p.y, cellStyle(cv).glow);
          clearCell(cc, rr);
          clearedSet[cc + ',' + rr] = true;
          cleared++;
        }
      }
      // bombs next to a cleared cell detonate (50 pts per blasted hex, x chain)
      var setBefore = Object.keys(clearedSet).length;
      var bombPts = detonateBombs(clearedSet, chain);
      var bombCleared = Object.keys(clearedSet).length - setBefore;
      // slag adjacent to a cleared cell crumbles too
      for (var c = 0; c < COLS; c++) {
        for (var r = 0; r < ROWS; r++) {
          if (S.board[c][r] !== SLAG) continue;
          var ns = neighbours(c, r), adj = false;
          for (var k = 0; k < ns.length; k++) if (clearedSet[ns[k][0] + ',' + ns[k][1]]) { adj = true; break; }
          if (adj) { var q = hexXY(c, r); burst(q.x, q.y, '#9d8fd0', 4); addPop(q.x, q.y, '#9d8fd0'); clearCell(c, r); slagCleared++; }
        }
      }
      // Locked hex (backlog #13): a lock breaks when a match clears next
      // to it — the hex stays, becomes a normal colour hex, and can join
      // a match in the next cascade. +50 x chain per lock broken.
      var unlocked = 0, unlockPts = 0;
      for (var uc = 0; uc < COLS; uc++) for (var ur = 0; ur < ROWS; ur++) {
        if (!S.locked[uc][ur]) continue;
        var uns = neighbours(uc, ur), adj2 = false;
        for (var k2 = 0; k2 < uns.length; k2++) if (clearedSet[uns[k2][0] + ',' + uns[k2][1]]) { adj2 = true; break; }
        if (adj2) {
          S.locked[uc][ur] = false;
          S.lockedUnlocked++;
          unlocked++;
          unlockPts += 50 * chain;
          var up = hexXY(uc, ur);
          burst(up.x, up.y, '#ffd23e', 8);
          addFloat(up.x, up.y - 20, 'UNLOCKED +50', '#ffd23e');
        }
      }
      // Armor-only pass: nothing cleared, only cracks — don't count it as
      // a chain step or award points. The loop re-scans and the cracked
      // hexes clear (or crack again) on the next pass, so it terminates.
      if (cleared + slagCleared + bombCleared === 0) {
        chain--;
        if (cracked > 0) AudioSys.sfx('crack');
        continue;
      }
      S.hexesCleared += cleared + slagCleared;
      S.matches++;
      var pts = cleared * 100 * chain + slagCleared * 25 * chain + sizeBonus + bombPts + starPts + unlockPts;
      S.score += pts;
      S.bestChain = Math.max(S.bestChain, chain);
      S.clears++;
      S.lastClear = { chain: chain, cleared: cleared, pts: pts, sizeBonus: sizeBonus, biggest: biggest, allClear: false };
      // per-cascade score popup at the cleared group's centre
      addFloat(bigCx, bigCy, '+' + pts, chain > 1 ? '#ffe14d' : '#eaf6ff');
      if (biggest >= 5) {
        addFloat(bigCx, bigCy - 34, 'BIG MATCH ×' + biggest + '!', '#ff2d95');
        AudioSys.sfx('bigmatch');
        addHitStop(90);
        // shockwave rings (backlog #30): one ring in the match colour,
        // plus a white outer ring on 6+ matches.
        addRing(bigCx, bigCy, bigColor, 120 + biggest * 12);
        if (biggest >= 6) addRing(bigCx, bigCy, '#ffffff', 170 + biggest * 12);
        announce('Big match of ' + biggest + '! +' + pts + ' points.');
      } else if (chain > 1) { AudioSys.sfx('chain'); addHitStop(60); }
      else AudioSys.sfx('clear');
      if (cleared >= 4 && biggest < 5 && chain === 1) addHitStop(40);
      if (rainbowsThisCascade > 0) AudioSys.sfx('rainbow');
      if (cracked > 0) AudioSys.sfx('crack');
      if (starPts > 0) AudioSys.sfx('star');
      if (unlocked > 0) AudioSys.sfx('unlock');
      // chain combo display: big centre banner for cascades
      if (chain > 1) {
        addBanner('CHAIN ×' + chain, '+' + pts + ' PTS', '#ffe14d');
        announce('Chain times ' + chain + '! +' + pts + ' points.');
      }
      // chain fire (backlog #33): x3+ cascades set the board alight.
      if (chain >= 3) igniteChainFire(chain, bigCx, bigCy);
      addShake(shakeForClear(cleared + slagCleared, chain, biggest));
      applyGravity();
      // level up every 6 clears
      var newLevel = 1 + Math.floor(S.clears / 6);
      if (newLevel > S.level) {
        S.level = newLevel;
        announce('Level ' + S.level + '! The tide rises faster.');
        addFloat(240, 300, 'LEVEL ' + S.level, '#22e6ff');
        spawnConfetti(); // level-up confetti burst (backlog #31)
        AudioSys.sfx('levelup');
      }
    }
    // all-clear bonus: a clear that empties the whole board pays big
    if (chain > 0) {
      var boardEmpty = true;
      for (var ec = 0; ec < COLS && boardEmpty; ec++)
        for (var er = 0; er < ROWS; er++) if (S.board[ec][er] !== null) { boardEmpty = false; break; }
      if (boardEmpty) {
        var bonus = 1000 * S.level;
        S.score += bonus;
        S.allClears++;
        if (S.lastClear) S.lastClear.allClear = true;
        addBanner('ALL CLEAR!', '+' + bonus + ' BONUS', '#22e6ff');
        burst(240, 320, '#22e6ff', 30); burst(120, 320, '#ff2d95', 20); burst(360, 320, '#a6ff3e', 20);
        addRing(240, 320, '#22e6ff', 200);
        addShake(8);
        addHitStop(120);
        AudioSys.sfx('allclear');
        announce('All clear! Bonus ' + bonus + ' points.');
      }
    }
    S.chain = Math.max(1, chain);
    AudioSys.applyIntensity(); // music tempo/layers follow level + live chain
  }
  // Slag patterns (backlog #16): surges stop being plain full rows once
  // the level climbs. Levels 1-2 always surge a full row; from level 3 a
  // row may rise with 1-2 gaps; from level 5 the tide may instead rise as
  // 3 columns of slag, two rows tall. Uses the seeded rng so daily runs
  // stay identical for everyone.
  function pickSurgePattern() {
    var roll = S.rng();
    if (S.level >= 5) return roll < 0.3 ? 'full' : roll < 0.7 ? 'gaps' : 'columns';
    if (S.level >= 3) return roll < 0.6 ? 'full' : 'gaps';
    return 'full';
  }
  // Double surge (backlog #15): from level 4 a surge can schedule a second
  // one 2.5s later. Chance grows with level and caps at 60%.
  function doubleSurgeChance(level) {
    if (level < 4) return 0;
    return Math.min(0.6, Math.round((0.2 + (level - 4) * 0.1) * 100) / 100);
  }
  function surgeTide(pattern, isDouble) {
    pattern = pattern || pickSurgePattern();
    S.lastSurgePattern = pattern;
    S.surges++;
    S.tide = 25;
    S.tideWarned = false;
    AudioSys.sfx('surge');
    addShake(10);
    var label = pattern === 'gaps' ? 'TIDE SURGE — GAPS!'
      : pattern === 'columns' ? 'TIDE SURGE — COLUMNS!' : 'TIDE SURGE!';
    announce('Tide surge! ' + (pattern === 'full' ? 'A row of slag rises from the bottom.'
      : pattern === 'gaps' ? 'A slag row with gaps rises from the bottom.'
      : 'Columns of slag rise from the bottom.'));
    addFloat(240, 420, label, '#8b5cf6');
    if (pattern === 'columns') {
      // 3 random distinct columns rise two rows of slag; other columns
      // are untouched. Each rising column shifts up two rows first.
      // Elite flags shift with their hexes; the new slag carries none.
      var cols = [];
      while (cols.length < 3) {
        var cc = Math.floor(S.rng() * COLS);
        if (cols.indexOf(cc) === -1) cols.push(cc);
      }
      for (var i = 0; i < cols.length; i++) {
        var c = cols[i];
        for (var r = 0; r < ROWS - 2; r++) {
          S.board[c][r] = S.board[c][r + 2];
          S.armor[c][r] = S.armor[c][r + 2];
          S.locked[c][r] = S.locked[c][r + 2];
          S.star[c][r] = S.star[c][r + 2];
        }
        S.board[c][ROWS - 2] = SLAG;
        S.board[c][ROWS - 1] = SLAG;
        S.armor[c][ROWS - 2] = 0; S.armor[c][ROWS - 1] = 0;
        S.locked[c][ROWS - 2] = false; S.locked[c][ROWS - 1] = false;
        S.star[c][ROWS - 2] = false; S.star[c][ROWS - 1] = false;
      }
    } else {
      // Gaps (backlog #16): the slag row skips 1-2 columns entirely — the
      // stack in a gap column is left standing instead of shifting up and
      // leaving a hole underneath it. (The old code cleared the bottom
      // cell after shifting, which left the whole column suspended in
      // mid-air — the Block 11 bot harness caught it as floating hexes,
      // and the in-step audit was silently compacting it away.)
      var gapSet = {};
      if (pattern === 'gaps') {
        var nGaps = S.rng() < 0.5 ? 1 : 2;
        while (Object.keys(gapSet).length < nGaps) gapSet[Math.floor(S.rng() * COLS)] = true;
      }
      for (var c2 = 0; c2 < COLS; c2++) {
        if (gapSet[c2]) continue;
        for (var r2 = 0; r2 < ROWS - 1; r2++) {
          S.board[c2][r2] = S.board[c2][r2 + 1];
          S.armor[c2][r2] = S.armor[c2][r2 + 1];
          S.locked[c2][r2] = S.locked[c2][r2 + 1];
          S.star[c2][r2] = S.star[c2][r2 + 1];
        }
        S.board[c2][ROWS - 1] = SLAG;
        S.armor[c2][ROWS - 1] = 0; S.locked[c2][ROWS - 1] = false; S.star[c2][ROWS - 1] = false;
      }
    }
    // A double surge (backlog #15) is scheduled, never chained: the second
    // surge fires from step() 2.5s later and cannot schedule a third.
    if (!isDouble && S.rng() < doubleSurgeChance(S.level)) {
      S.pendingSurgeAt = S.timeMs + 2500;
      S.doubleSurges++;
      addFloat(240, 380, '⚠ DOUBLE SURGE INCOMING!', '#ff3b5c');
      AudioSys.sfx('surgewarn');
      announce('Warning: a double surge is coming!');
    }
    updateHUD();
  }

  // ---------- particles / floats ----------
  function burst(x, y, color, n) {
    // FPS guard (backlog #47): half the particles and a lower cap while
    // low-FX mode is on, so a slow device recovers instead of drowning.
    if (S.lowFx) n = Math.ceil(n / 2);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 160;
      S.particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.4, max: 0.9, color: color, size: 2 + Math.random() * 3 });
    }
    var cap = S.lowFx ? 200 : 400;
    if (S.particles.length > cap) S.particles.splice(0, S.particles.length - cap);
  }
  function addFloat(x, y, text, color) {
    S.floats.push({ x: x, y: y, text: text, color: color, life: 1.1 });
    if (S.floats.length > 12) S.floats.shift();
  }
  function addBanner(text, sub, color) {
    S.banner = { text: text, sub: sub || '', color: color || '#ffe14d', life: 1.5, max: 1.5 };
  }
  function addShake(m) { S.shake = Math.min(18, S.shake + m); }
  // Hit-stop (backlog #28): freeze gameplay for a few frames on big clears
  // so the impact lands. step() consumes it; rendering/FX keep running.
  function addHitStop(ms) { S.hitStop = Math.max(S.hitStop, ms); }
  // Hex pop (backlog #29): a cleared hex scales up and fades out in place.
  function addPop(x, y, color) {
    S.pops.push({ x: x, y: y, color: color, life: 0.28, max: 0.28 });
    if (S.pops.length > 64) S.pops.splice(0, S.pops.length - 64);
  }
  // Shockwave rings (backlog #30): an expanding neon ring on a 5+ match,
  // centred on the cleared group. A second white ring rides along on 6+.
  function addRing(x, y, color, maxR) {
    S.rings.push({ x: x, y: y, color: color, life: 0.55, max: 0.55, maxR: maxR || 130 });
    if (S.rings.length > 8) S.rings.splice(0, S.rings.length - 8);
  }
  // Level-up confetti (backlog #31): a burst of fluttering neon shards
  // that rains down the board when the level rises.
  var CONFETTI_COLORS = ['#22e6ff', '#ff2d95', '#a6ff3e', '#ffb020', '#8b5cf6', '#ffe14d', '#2dd4bf'];
  function spawnConfetti() {
    for (var i = 0; i < 70; i++) {
      S.confetti.push({
        x: X0 - HEX_R + Math.random() * BOARD_W,
        y: 60 + Math.random() * 90,
        vx: (Math.random() - 0.5) * 60,
        vy: 60 + Math.random() * 90,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 12,
        ph: Math.random() * Math.PI * 2,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 5 + Math.random() * 5,
        life: 1.6 + Math.random() * 0.8, max: 2.4
      });
    }
    if (S.confetti.length > 120) S.confetti.splice(0, S.confetti.length - 120);
  }
  // Chain fire (backlog #33): while a x3+ cascade is burning, flames rise
  // from the bottom of the board and the board edge glows hot. Flame
  // particles live in S.particles with flame:true so the shared cap and
  // the low-FX halving still apply; they rise (negative vy, buoyant)
  // instead of falling like sparks.
  var FLAME_COLORS = ['#ff9a3d', '#ff5a2a', '#ffd23e', '#ff3b5c'];
  function spawnFlame(x, y) {
    S.particles.push({
      x: x, y: y, vx: (Math.random() - 0.5) * 50, vy: -(60 + Math.random() * 110),
      life: 0.5 + Math.random() * 0.4, max: 0.9,
      color: FLAME_COLORS[Math.floor(Math.random() * FLAME_COLORS.length)],
      size: 3 + Math.random() * 3, flame: true
    });
    var cap = S.lowFx ? 200 : 400;
    if (S.particles.length > cap) S.particles.splice(0, S.particles.length - cap);
  }
  function igniteChainFire(chain, x, y) {
    S.chainFire = Math.max(S.chainFire, chain);
    S.chainFireT = 1.2;
    var n = 10 + chain * 4;
    for (var i = 0; i < n; i++)
      spawnFlame(x + (Math.random() - 0.5) * 90, y + (Math.random() - 0.5) * 50);
  }
  // Screen shake scaling (backlog #32): shake grows with clear size, chain
  // depth and big matches instead of a flat amount per cascade.
  function shakeForClear(cleared, chain, biggest) {
    var m = 2 + cleared * 1.2 + (chain - 1) * 3 + (biggest >= 5 ? 2 : 0);
    return Math.min(16, m);
  }
  // FPS guard (backlog #47): track a rolling frame-time average; when the
  // game runs slow for a sustained stretch, drop the expensive glow
  // (shadowBlur) and halve particle spawns until frames recover. frame()
  // feeds it every frame; the harness drives it directly.
  function noteFrame(dt) {
    if (!isFinite(dt) || dt < 0) return;
    S.frameEma = S.frameEma * 0.9 + dt * 0.1;
    S.frameCount++;
    if (!S.lowFx && S.frameEma > 40) S.lowFx = true;
    else if (S.lowFx && S.frameEma < 25) S.lowFx = false;
  }
  function setLowFx(v) { S.lowFx = !!v; }
  function frameStats() {
    return { ema: Math.round(S.frameEma * 10) / 10, lowFx: S.lowFx, frames: S.frameCount };
  }

  // ---------- game flow ----------
  function newGame() {
    S.board = emptyBoard();
    S.armor = emptyFlags(0); S.locked = emptyFlags(false); S.star = emptyFlags(false);
    S.armorCracked = 0; S.armoredCleared = 0; S.lockedUnlocked = 0; S.starsCleared = 0;
    S.seed = dailySeed();
    S.rng = mulberry32(hashSeed(S.seed));
    S.score = 0; S.level = 1; S.lives = 3; S.tide = 0; S.chain = 1; S.clears = 0;
    S.pieces = 0; S.hexesCleared = 0; S.matches = 0; S.bestChain = 0;
    S.timeMs = 0; S.fallAcc = 0; S.softDrop = false;
    S.particles = []; S.floats = []; S.shake = 0; S.hitStop = 0; S.pops = [];
    S.rings = []; S.confetti = []; S.chainFire = 0; S.chainFireT = 0; S.chainFireAcc = 0;
    S.banner = null; S.allClears = 0; S.lastClear = null; S.biggestMatch = 0;
    S.specialsSpawned = 0; S.bombsDetonated = 0; S.rainbowsCleared = 0; S.triosSinceSpecial = 0;
    S.tideWarned = false; S.rankIdx = 0; S.pendingRankUp = null;
    S.top5 = loadTop5(); S.top5Rank = null; S.activeFx = [];
    S.pendingSurgeAt = null; S.surges = 0; S.doubleSurges = 0;
    S.lastSurgePattern = 'full'; S.lastTideTick = 0;
    S.touch = { active: false }; S.softDrop = false;
    S.repairs = 0; S.frameEma = 16; S.frameCount = 0; S.lowFx = false; S.lastAudit = 0;
    S.dailyBest = loadDailyBest();
    S.next = rollColors();
    S.nextElite = rollEliteFlags(S.next);
    S.state = 'playing';
    AudioSys.init(); AudioSys.resume(); AudioSys.startMusic();
    spawnPiece();
    showOnly(null);
    announce('Run started. Match 3 or more hexes of the same colour.');
    updateHUD();
  }
  function gameOver() {
    S.state = 'over';
    AudioSys.sfx('gameover');
    AudioSys.stopMusic();
    var isBest = S.score > S.best;
    if (isBest) { S.best = S.score; try { localStorage.setItem('nhx-best', String(S.best)); } catch (e) {} }
    // Daily challenge (backlog #23): this seed's best is tracked separately.
    var isDailyBest = S.score > S.dailyBest;
    if (isDailyBest) { S.dailyBest = S.score; saveDailyBest(S.score); }
    // Top-5 table (backlog #44): record the run, keep the table for the
    // game-over screen, and flag the new entry for highlighting.
    S.top5Rank = recordTop5();
    S.top5 = loadTop5();
    if (el.overBadge) el.overBadge.classList.toggle('hidden', !isBest);
    if (el.dailyBadge) el.dailyBadge.classList.toggle('hidden', !isDailyBest);
    if (el.top5Badge) el.top5Badge.classList.toggle('hidden', S.top5Rank === null);
    // Game-over stats screen (backlog #39): a labelled stat grid instead of
    // the old plain-text block, including accuracy (hexes cleared per trio).
    if (el.overStats) {
      var acc = S.pieces > 0 ? (S.hexesCleared / S.pieces).toFixed(1) : '—';
      var rows = [
        ['SCORE', S.score.toLocaleString()], ['BEST', S.best.toLocaleString()],
        ['DAILY BEST', S.dailyBest.toLocaleString()], ['SEED', S.seed],
        ['RANK', rankFor(S.score).name], ['LEVEL', String(S.level)],
        ['TIME', fmtTime(S.timeMs)], ['HEXES CLEARED', String(S.hexesCleared)],
        ['MATCHES', String(S.matches)], ['BEST CHAIN', '×' + S.bestChain],
        ['BIGGEST MATCH', '×' + S.biggestMatch], ['ALL CLEARS', String(S.allClears)],
        ['BOMBS', String(S.bombsDetonated)], ['RAINBOWS', String(S.rainbowsCleared)],
        ['SPECIALS SPAWNED', String(S.specialsSpawned)],
        ['ARMORED CRACKED', String(S.armorCracked)], ['ARMORED CLEARED', String(S.armoredCleared)],
        ['LOCKS BROKEN', String(S.lockedUnlocked)], ['STARS', String(S.starsCleared)],
        ['SURGES', String(S.surges)], ['DOUBLE SURGES', String(S.doubleSurges)],
        ['ACCURACY', acc + ' hexes / trio']
      ];
      el.overStats.innerHTML = rows.map(function (row) {
        return '<div class="stat-row"><span class="stat-label">' + row[0] +
          '</span><span class="stat-value">' + row[1] + '</span></div>';
      }).join('');
    }
    if (el.overTop5) el.overTop5.innerHTML = top5RowsHTML(S.top5, S.top5Rank);
    showOnly(el.over);
    announce('Run over. Score ' + S.score + '.');
    updateHUD();
  }
  function fmtTime(ms) {
    var s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function togglePause() {
    if (S.state === 'playing') {
      S.state = 'paused';
      if (el.pauseStats) el.pauseStats.textContent =
        'Score ' + S.score + '   Level ' + S.level + '   Lives ' + S.lives + '\nRank ' + rankFor(S.score).name + '   Hexes cleared ' + S.hexesCleared + '   Time ' + fmtTime(S.timeMs);
      showOnly(el.pause);
    } else if (S.state === 'paused') {
      S.state = 'playing';
      showOnly(null);
    }
  }
  function quitToMenu() {
    S.state = 'menu';
    AudioSys.stopMusic();
    showOnly(el.menu);
    updateHUD();
  }
  function toggleMute() {
    S.muted = !S.muted;
    AudioSys.muted = S.muted;
    if (AudioSys.master) AudioSys.master.gain.value = S.muted ? 0 : AudioSys.volume;
    try { localStorage.setItem('nhx-muted', S.muted ? '1' : '0'); } catch (e) {}
    if (el.muteBtn) el.muteBtn.textContent = S.muted ? '🔇' : '🔊';
    updateHUD();
  }
  // showOnly also tracks which overlay is up (S.overlay) and moves keyboard
  // focus to its first button, so keyboard-only players (backlog #42) can
  // start navigating immediately without a mouse.
  function showOnly(overlay) {
    var all = [el.menu, el.how, el.pause, el.over];
    for (var i = 0; i < all.length; i++) if (all[i]) all[i].classList.toggle('hidden', all[i] !== overlay);
    S.overlay = overlay ? overlay.id : null;
    if (overlay) {
      var btns = overlayButtons().filter(function (b) { return !!b; });
      setKbdFocus(btns[0] || null);
    } else setKbdFocus(null);
  }
  // Keyboard-only play (backlog #42): the buttons of the visible overlay, in
  // the order Up/Down cycles through them.
  function overlayButtons() {
    if (S.overlay === 'menuOverlay') return [el.playBtn, el.howBtn, el.shareBtn];
    if (S.overlay === 'howOverlay') return [el.howCloseBtn, el.howMenuBtn];
    if (S.overlay === 'pauseOverlay') return [el.resumeBtn, el.restartBtn, el.quitBtn];
    if (S.overlay === 'overOverlay') return [el.againBtn, el.shareBtnOver, el.overMenuBtn];
    return [];
  }
  function setKbdFocus(btn) {
    S.kbdFocus = btn ? btn.id : null;
    if (btn && typeof btn.focus === 'function') { try { btn.focus(); } catch (e) {} }
  }
  function kbdNav(dir) {
    var btns = overlayButtons().filter(function (b) { return !!b; });
    if (!btns.length) return;
    var idx = -1;
    for (var i = 0; i < btns.length; i++) if (btns[i].id === S.kbdFocus) idx = i;
    if (idx === -1) idx = dir > 0 ? -1 : 0; // start before first / after last
    idx = (idx + dir + btns.length) % btns.length;
    setKbdFocus(btns[idx]);
  }
  // Activate the focused button by calling the same action its click handler
  // calls, so keyboard play works identically in the harness (no real DOM
  // click) and in the browser. With no focus yet, the overlay's default
  // action runs (PLAY / resume / play again).
  function kbdActivate() {
    var id = S.kbdFocus;
    if (id === 'playBtn' || id === 'howCloseBtn' || id === 'againBtn') { AudioSys.init(); newGame(); return; }
    if (id === 'howBtn') { showOnly(el.how); return; }
    if (id === 'howMenuBtn') { showOnly(el.menu); return; }
    if (id === 'overMenuBtn' || id === 'quitBtn') { quitToMenu(); return; }
    if (id === 'resumeBtn') { togglePause(); return; }
    if (id === 'restartBtn') { newGame(); return; }
    if (id === 'shareBtn') { shareSeed(el.shareBtn); return; }
    if (id === 'shareBtnOver') { shareSeed(el.shareBtnOver); return; }
    if (S.overlay === 'menuOverlay' || S.overlay === 'howOverlay') { AudioSys.init(); newGame(); }
    else if (S.overlay === 'pauseOverlay') togglePause();
    else if (S.overlay === 'overOverlay') newGame();
  }
  var lastTop5Html = ''; // cached menu top-5 render (backlog #44)
  function updateHUD() {
    if (el.score) el.score.textContent = S.score;
    if (el.best) el.best.textContent = S.best;
    if (el.level) el.level.textContent = S.level;
    if (el.lives) el.lives.textContent = '●'.repeat(Math.max(0, S.lives)) + '○'.repeat(Math.max(0, 3 - S.lives));
    if (el.chain) { el.chain.textContent = '×' + S.chain; el.chain.classList.toggle('hot', S.chain >= 2); }
    if (el.tideFill) {
      el.tideFill.style.width = S.tide.toFixed(1) + '%';
      // Tide warning (backlog #17): the HUD bar flashes red while the tide
      // sits in the last 20% (the .warn animation lives in style.css).
      el.tideFill.classList.toggle('warn', S.tide >= 80);
    }
    if (el.muteBtn) el.muteBtn.textContent = S.muted ? '🔇' : '🔊';
    // Daily challenge (backlog #23) + ranks (backlog #5) on the menu.
    if (el.seedLine) el.seedLine.textContent = isTodaySeed()
      ? 'DAILY SEED ' + S.seed + ' — same trios for everyone today'
      : 'CUSTOM SEED ' + S.seed + ' — same trios for anyone with this link';
    if (el.dailyBestLine) el.dailyBestLine.textContent =
      (isTodaySeed() ? 'DAILY BEST ' : 'SEED BEST ') + S.dailyBest.toLocaleString();
    if (el.rankLine) {
      var br = rankFor(S.best);
      el.rankLine.textContent = 'BEST RANK: ' + br.name +
        (br.next ? ' — next ' + br.next.name + ' at ' + br.next.at.toLocaleString() : ' — top rank!');
    }
    checkRankUp();
    if (el.volSlider) el.volSlider.value = String(AudioSys.volume);
    if (el.menuVolSlider) el.menuVolSlider.value = String(AudioSys.volume);
    // Top-5 table on the menu (backlog #44): re-render only when the table
    // actually changed, so this per-frame call stays cheap.
    if (el.top5List) {
      var t5 = loadTop5();
      var t5html = top5RowsHTML(t5, null);
      if (t5html !== lastTop5Html) { el.top5List.innerHTML = t5html; lastTop5Html = t5html; }
    }
    // Powerup HUD indicators (backlog #11): live special + elite counts,
    // the next trio's specials/elites, and any active timed effect with
    // its countdown.
    if (el.specialsStrip) {
      var sp = countSpecials();
      var parts = [];
      if (sp.bombs > 0) parts.push('💣 ' + sp.bombs + ' ON BOARD');
      if (sp.rainbows > 0) parts.push('🌈 ' + sp.rainbows + ' ON BOARD');
      if (sp.armored > 0) parts.push('🛡 ' + sp.armored + ' ARMORED');
      if (sp.locked > 0) parts.push('🔒 ' + sp.locked + ' LOCKED');
      if (sp.stars > 0) parts.push('★ ' + sp.stars + ' STARS');
      if (S.next) {
        var nx = [];
        if (S.next.indexOf(BOMB) !== -1) nx.push('💣');
        if (S.next.indexOf(RAINBOW) !== -1) nx.push('🌈');
        if (S.nextElite) {
          if (S.nextElite.armored.indexOf(true) !== -1) nx.push('🛡');
          if (S.nextElite.locked.indexOf(true) !== -1) nx.push('🔒');
          if (S.nextElite.star.indexOf(true) !== -1) nx.push('★');
        }
        if (nx.length) parts.push('NEXT: ' + nx.join(' '));
      }
      for (var fi = 0; fi < S.activeFx.length; fi++) {
        var fx = S.activeFx[fi];
        parts.push(fx.label + ' ' + Math.max(0, Math.ceil((fx.until - S.timeMs) / 1000)) + 's');
      }
      if (S.specialsSpawned > 0) parts.push('✦ ' + S.specialsSpawned + ' SPAWNED');
      el.specialsStrip.textContent = parts.length
        ? parts.join('  ·  ')
        : 'Special hexes drop in trios — match beside a 💣 to blast it, 🌈 matches any colour';
    }
    if (el.menuNext && S.next) {
      var names = S.next.map(function (c, i) {
        var n = cellStyle(c).name;
        if (S.nextElite) {
          if (S.nextElite.star[i]) n += ' ★';
          else if (S.nextElite.armored[i]) n += ' 🛡';
          else if (S.nextElite.locked[i]) n += ' 🔒';
        }
        return n;
      }).join(' · ');
      el.menuNext.textContent = S.state === 'menu' ? 'NEXT TRIO: ' + names : '';
    }
  }

  // ---------- update / render ----------
  function step(dtMs) {
    if (S.state !== 'playing') return;
    // NaN guard (backlog #48): a bad clock value must never poison the
    // run clock, the tide or the fall accumulator — ignore the frame.
    if (!isFinite(dtMs) || dtMs < 0) return;
    // hit-stop: freeze the falling piece and the tide while the freeze lasts
    if (S.hitStop > 0) { S.hitStop = Math.max(0, S.hitStop - dtMs); return; }
    S.timeMs += dtMs;
    // Board audit (backlog #48): once a second, scan for corruption and
    // repair it in place instead of letting it fester into a stuck run.
    if (S.timeMs - S.lastAudit >= 1000) {
      S.lastAudit = S.timeMs;
      if (validateBoard().length) sanitizeState();
    }
    expireFx(); // timed powerup effects count down with run time
    // tide rises over time
    S.tide += tidePerSec() * (dtMs / 1000);
    // surge warning (backlog #35): one alarm + popup when the tide crosses 80%
    if (S.tide >= 80 && !S.tideWarned) {
      S.tideWarned = true;
      AudioSys.sfx('surgewarn');
      addFloat(240, 420, 'TIDE RISING!', '#ff3b5c');
      announce('Warning: the tide is about to surge.');
    }
    // Tide warning (backlog #17): while the tide sits in the last 20%, a
    // soft pulse ticks every 1.5s so the danger stays audible, not just a
    // one-off alarm at 80%.
    if (S.tide >= 80 && S.timeMs - S.lastTideTick >= 1500) {
      S.lastTideTick = S.timeMs;
      AudioSys.sfx('tidepulse');
    }
    if (S.tide >= 100) surgeTide();
    // A scheduled double surge (backlog #15) fires 2.5s after the first one.
    if (S.pendingSurgeAt !== null && S.timeMs >= S.pendingSurgeAt) {
      S.pendingSurgeAt = null;
      surgeTide(null, true);
    }
    // falling piece
    if (S.piece) {
      var ms = S.softDrop ? fallMs() / 6 : fallMs();
      S.fallAcc += dtMs;
      while (S.fallAcc >= ms) {
        S.fallAcc -= ms;
        if (pieceFits(S.piece.col, Math.floor(S.piece.row) + 1)) S.piece.row += 1;
        else { lockPiece(); break; }
      }
    }
    updateHUD();
  }
  function updateFx(dtMs) {
    var dt = dtMs / 1000;
    for (var i = S.particles.length - 1; i >= 0; i--) {
      var p = S.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      // flames rise (buoyant) while sparks fall (backlog #33)
      if (p.flame) p.vy -= 60 * dt; else p.vy += 220 * dt;
      p.life -= dt;
      if (p.life <= 0) S.particles.splice(i, 1);
    }
    for (var j = S.floats.length - 1; j >= 0; j--) {
      S.floats[j].y -= 34 * dt; S.floats[j].life -= dt;
      if (S.floats[j].life <= 0) S.floats.splice(j, 1);
    }
    for (var k = S.pops.length - 1; k >= 0; k--) {
      S.pops[k].life -= dt;
      if (S.pops[k].life <= 0) S.pops.splice(k, 1);
    }
    // shockwave rings (backlog #30): expand and fade over 0.55s.
    for (var rg = S.rings.length - 1; rg >= 0; rg--) {
      S.rings[rg].life -= dt;
      if (S.rings[rg].life <= 0) S.rings.splice(rg, 1);
    }
    // level-up confetti (backlog #31): flutter down with a sideways sway.
    for (var cf = S.confetti.length - 1; cf >= 0; cf--) {
      var f = S.confetti[cf];
      f.x += (f.vx + Math.sin(f.ph + (2.4 - f.life) * 6) * 20) * dt;
      f.y += f.vy * dt; f.vy += 30 * dt;
      f.rot += f.vr * dt;
      f.life -= dt;
      if (f.life <= 0 || f.y > 660) S.confetti.splice(cf, 1);
    }
    // chain fire (backlog #33): while it burns, flames keep rising from
    // the bottom of the board. The timer runs down even while paused, but
    // no new flames spawn outside play.
    if (S.chainFireT > 0) {
      S.chainFireT -= dt;
      if (S.chainFireT <= 0) { S.chainFire = 0; S.chainFireT = 0; }
      else if (S.state === 'playing') {
        S.chainFireAcc += dt * (40 + S.chainFire * 25);
        while (S.chainFireAcc >= 1) {
          S.chainFireAcc -= 1;
          spawnFlame(X0 - HEX_R + Math.random() * BOARD_W,
            Y0 + (ROWS - 1) * ROW_H + HEX_R - Math.random() * 20);
        }
      }
    }
    if (S.banner) {
      S.banner.life -= dt;
      if (S.banner.life <= 0) {
        S.banner = null;
        // queued rank-up (backlog #5): show it once the banner it waited
        // behind has cleared, unless the run has already ended.
        if (S.pendingRankUp) {
          var rn = S.pendingRankUp;
          S.pendingRankUp = null;
          if (S.state === 'playing') showRankUp(rn);
        }
      }
    }
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 26);
  }
  function render() {
    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (S.shake > 0) ctx.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
    // backdrop: faint hex grid
    ctx.globalAlpha = 0.10;
    for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) {
      var g = hexXY(c, r);
      drawHex(g.x, g.y, HEX_R - 3, '#1a1140', '#1a1140', 1);
    }
    ctx.globalAlpha = 1;
    // tide waterline at the bottom — it pulses red while the tide sits in
    // the last 20% (backlog #17), so the danger is visible on the board
    // itself, not just in the HUD bar.
    var tideH = (S.tide / 100) * 46;
    if (tideH > 0.5) {
      var tideWarn = S.tide >= 80;
      var tideAlpha = tideWarn ? 0.30 + 0.16 * Math.sin(S.timeMs / 130) : 0.30;
      ctx.fillStyle = tideWarn ? 'rgba(255,59,92,' + tideAlpha.toFixed(2) + ')' : 'rgba(139,92,246,0.30)';
      ctx.fillRect(0, h - tideH, w, tideH);
      ctx.fillStyle = tideWarn ? 'rgba(255,120,140,0.9)' : 'rgba(167,139,250,0.8)';
      ctx.fillRect(0, h - tideH, w, tideWarn ? 3 : 2);
    }
    // board hexes, with elite marks (armor ring / padlock / star)
    for (var c2 = 0; c2 < COLS; c2++) for (var r2 = 0; r2 < ROWS; r2++) {
      var v = S.board[c2][r2];
      if (v === null) continue;
      var p = hexXY(c2, r2);
      var col = cellStyle(v);
      drawHex(p.x, p.y, HEX_R - 2, col.fill, col.glow, 1);
      if (v === BOMB || v === RAINBOW) drawSpecialMark(p.x, p.y, v, 1);
      if (S.armor[c2][r2] > 0 || S.locked[c2][r2] || S.star[c2][r2])
        drawEliteMark(p.x, p.y, S.armor[c2][r2], S.locked[c2][r2], S.star[c2][r2], 1);
      if (v === SLAG) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✕', p.x, p.y + 1);
      }
    }
    // chain fire (backlog #33): while a x3+ cascade burns, the board edge
    // glows hot orange and pulses.
    if (S.chainFireT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(S.timeMs / 90);
      ctx.strokeStyle = '#ff7a2a';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff5a2a'; ctx.shadowBlur = S.lowFx ? 0 : 16;
      ctx.strokeRect(X0 - HEX_R - 6, Y0 - HEX_R - 6,
        BOARD_W + 12, (ROWS - 1) * ROW_H + ROW_H / 2 + 2 * HEX_R + 12);
      ctx.restore();
    }
    // hex pop animations: cleared hexes scale up and fade out in place
    for (var po = 0; po < S.pops.length; po++) {
      var pop = S.pops[po];
      var pt = clamp(pop.life / pop.max, 0, 1);
      drawHex(pop.x, pop.y, (HEX_R - 2) * (1 + 0.45 * (1 - pt)), pop.color, pop.color, pt);
    }
    // shockwave rings (backlog #30): expanding circles fading out
    for (var ri = 0; ri < S.rings.length; ri++) {
      var ring = S.rings[ri];
      var rp = 1 - ring.life / ring.max;
      ctx.save();
      ctx.globalAlpha = clamp(ring.life / ring.max, 0, 1);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 1 + 5 * (ring.life / ring.max);
      ctx.shadowColor = ring.color; ctx.shadowBlur = S.lowFx ? 0 : 14;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.maxR * (0.25 + 0.75 * rp), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // ghost landing column
    if (S.piece && S.state === 'playing') {
      var ghost = Math.floor(S.piece.row);
      while (pieceFits(S.piece.col, ghost + 1)) ghost++;
      var cells = pieceCells();
      for (var i = 0; i < cells.length; i++) {
        var gp = hexXY(cells[i].c, ghost + i);
        ctx.globalAlpha = 0.18;
        drawHex(gp.x, gp.y, HEX_R - 2, '#ffffff', '#ffffff', 1);
        ctx.globalAlpha = 1;
      }
      // falling trio
      var smooth = S.piece.row - Math.floor(S.piece.row);
      for (var j = 0; j < cells.length; j++) {
        var fp = hexXY(cells[j].c, Math.floor(S.piece.row) + j);
        fp.y += smooth * ROW_H;
        var fc = cellStyle(cells[j].color);
        drawHex(fp.x, fp.y, HEX_R - 2, fc.fill, fc.glow, 1);
        if (cells[j].color === BOMB || cells[j].color === RAINBOW) drawSpecialMark(fp.x, fp.y, cells[j].color, 1);
        if (cells[j].armored || cells[j].locked || cells[j].star)
          drawEliteMark(fp.x, fp.y, cells[j].armored ? 2 : 0, cells[j].locked, cells[j].star, 1);
      }
    }
    // next trio preview (top)
    if (S.next && S.state !== 'menu') {
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#9d8fd0';
      ctx.fillText('NEXT', 18, 26);
      for (var k = 0; k < 3; k++) {
        var nx = 66 + k * 30, ny = 26;
        var nc = cellStyle(S.next[k]);
        drawHex(nx, ny, 11, nc.fill, nc.glow, 1);
        if (S.next[k] === BOMB || S.next[k] === RAINBOW) drawSpecialMark(nx, ny, S.next[k], 0.5);
        if (S.nextElite && (S.nextElite.armored[k] || S.nextElite.locked[k] || S.nextElite.star[k]))
          drawEliteMark(nx, ny, S.nextElite.armored[k] ? 2 : 0, S.nextElite.locked[k], S.nextElite.star[k], 0.5);
      }
      ctx.fillStyle = '#9d8fd0';
      ctx.textAlign = 'right';
      ctx.fillText('LEVEL ' + S.level, w - 18, 26);
      // current run rank (backlog #5) under the level
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#a6ff3e';
      ctx.fillText(rankFor(S.score).name, w - 18, 44);
    }
    // particles — flames (backlog #33) draw as glowing circles, sparks as squares
    for (var pi = 0; pi < S.particles.length; pi++) {
      var pt = S.particles[pi];
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
      ctx.fillStyle = pt.color;
      if (pt.flame) {
        ctx.shadowColor = pt.color; ctx.shadowBlur = S.lowFx ? 0 : 10;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(1, pt.size * (pt.life / pt.max)), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      }
    }
    ctx.globalAlpha = 1;
    // level-up confetti (backlog #31): fluttering neon shards
    for (var ci = 0; ci < S.confetti.length; ci++) {
      var cfp = S.confetti[ci];
      ctx.save();
      ctx.globalAlpha = clamp(cfp.life / 0.6, 0, 1);
      ctx.translate(cfp.x, cfp.y);
      ctx.rotate(cfp.rot);
      ctx.fillStyle = cfp.color;
      ctx.fillRect(-cfp.size / 2, -cfp.size / 4, cfp.size, cfp.size / 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // floating texts
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var fi = 0; fi < S.floats.length; fi++) {
      var fl = S.floats[fi];
      ctx.globalAlpha = clamp(fl.life, 0, 1);
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = fl.color;
      ctx.shadowColor = fl.color; ctx.shadowBlur = S.lowFx ? 0 : 10;
      ctx.fillText(fl.text, fl.x, fl.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    // chain / all-clear banner (big centre pop)
    if (S.banner) {
      var b = S.banner;
      var prog = 1 - b.life / b.max;
      var scale = prog < 0.12 ? 0.7 + (prog / 0.12) * 0.3 : 1;
      ctx.save();
      ctx.translate(240, 290);
      ctx.scale(scale, scale);
      ctx.globalAlpha = clamp(b.life / 0.35, 0, 1);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '900 36px sans-serif';
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color; ctx.shadowBlur = S.lowFx ? 0 : 18;
      ctx.fillText(b.text, 0, 0);
      if (b.sub) {
        ctx.font = 'bold 18px sans-serif';
        ctx.shadowBlur = S.lowFx ? 0 : 8;
        ctx.fillText(b.sub, 0, 34);
      }
      ctx.restore();
    }
    ctx.restore();
    // menu backdrop hint
    if (S.state === 'menu') {
      ctx.fillStyle = 'rgba(11,6,32,0.25)';
      ctx.fillRect(0, 0, w, h);
    }
  }

  // ---------- input ----------
  function bind(btn, fn) { if (btn) btn.addEventListener('click', fn); }
  bind(el.playBtn, function () { AudioSys.init(); newGame(); });
  bind(el.howBtn, function () { showOnly(el.how); });
  bind(el.howCloseBtn, function () { AudioSys.init(); newGame(); });
  bind(el.howMenuBtn, function () { showOnly(el.menu); });
  bind(el.resumeBtn, togglePause);
  bind(el.restartBtn, function () { newGame(); });
  bind(el.quitBtn, quitToMenu);
  bind(el.againBtn, function () { newGame(); });
  bind(el.overMenuBtn, quitToMenu);
  bind(el.muteBtn, toggleMute);
  bind(el.pauseBtn, togglePause);
  // shareable seed (backlog #26): copy a link that replays this seed
  bind(el.shareBtn, function () { shareSeed(el.shareBtn); });
  bind(el.shareBtnOver, function () { shareSeed(el.shareBtnOver); });
  // volume sliders (backlog #36): one on the menu, one in the pause overlay
  function bindVol(slider) {
    if (!slider) return;
    slider.addEventListener('input', function () { AudioSys.setVolume(parseFloat(slider.value)); });
  }
  bindVol(el.volSlider);
  bindVol(el.menuVolSlider);
  // Hold-to-repeat touch buttons (backlog #41): holding ◀ ▶ repeats the
  // move so a long shift needs no dozens of taps; holding ▼ soft-drops until
  // released. DROP and ⟳ stay single taps. A keyboard Enter/Space on a
  // focused button fires click with detail 0, so that path still works.
  function bindHold(btn, onDown, onUp) {
    if (!btn) return;
    var timer = null, iv = null;
    function start(e) {
      if (e && e.preventDefault) e.preventDefault();
      onDown();
      timer = setTimeout(function () { iv = setInterval(onDown, 110); }, 260);
    }
    function stop() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (iv) { clearInterval(iv); iv = null; }
      if (onUp) onUp();
    }
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('click', function (e) { if (e.detail === 0) { onDown(); if (onUp) onUp(); } });
  }
  bindHold($('tcLeft'), function () { movePiece(-1); });
  bindHold($('tcRight'), function () { movePiece(1); });
  bindHold($('tcDown'), function () { S.softDrop = true; }, function () { S.softDrop = false; });
  bind($('tcRotate'), rotatePiece);
  bind($('tcDrop'), hardDrop);

  // Swipe controls (backlog #41): drag sideways to move column by column
  // (one column per COL_W of travel), drag down and hold for a soft drop,
  // flick down fast for a hard drop, and tap to move/rotate by board third
  // (left third / middle / right third). Distances are canvas pixels.
  function touchStart(x, y) {
    if (S.state !== 'playing') return;
    S.touch = { active: true, x0: x, y0: y, lastX: x, moved: false, t0: Date.now() };
  }
  function touchMove(x, y) {
    var t = S.touch;
    if (!t || !t.active || S.state !== 'playing') return;
    var dx = x - t.lastX;
    while (dx >= COL_W) { if (movePiece(1)) t.moved = true; t.lastX += COL_W; dx -= COL_W; }
    while (dx <= -COL_W) { if (movePiece(-1)) t.moved = true; t.lastX -= COL_W; dx += COL_W; }
    if (y - t.y0 > 30) { S.softDrop = true; t.moved = true; }
  }
  function touchEnd(x, y) {
    var t = S.touch;
    if (!t || !t.active) return;
    S.touch = { active: false };
    S.softDrop = false;
    if (S.state !== 'playing') return;
    var dx = x - t.x0, dy = y - t.y0;
    var dt = Date.now() - t.t0;
    // fast downward flick: hard drop
    if (dy > 90 && dt < 220 && Math.abs(dx) < 40) { hardDrop(); return; }
    if (t.moved) return;
    // tap: thirds of the board
    if (x < canvas.width / 3) movePiece(-1);
    else if (x > canvas.width * 2 / 3) movePiece(1);
    else rotatePiece();
  }
  function canvasPos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width * canvas.width,
      y: (e.clientY - rect.top) / rect.height * canvas.height
    };
  }
  canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); var p = canvasPos(e); touchStart(p.x, p.y); });
  canvas.addEventListener('pointermove', function (e) { var p = canvasPos(e); touchMove(p.x, p.y); });
  canvas.addEventListener('pointerup', function (e) { var p = canvasPos(e); touchEnd(p.x, p.y); });
  canvas.addEventListener('pointercancel', function () { S.touch = { active: false }; S.softDrop = false; });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

  // Keyboard input, factored so the harness can drive it (backlog #42).
  // Menus are fully keyboard-navigable: Up/Down cycles the overlay's
  // buttons, Enter/Space activates the focused one, Escape steps back
  // (how-to -> menu). A focused volume slider keeps the arrows natively.
  function handleKey(k, e) {
    e = e || { preventDefault: function () {}, target: null };
    var onInput = e.target && e.target.tagName === 'INPUT';
    if (k === 'KeyM') { toggleMute(); return; }
    if (k === 'KeyP' || k === 'Escape') {
      if (k === 'Escape' && S.overlay === 'howOverlay') { showOnly(el.menu); return; }
      if (S.state === 'playing' || S.state === 'paused') { e.preventDefault(); togglePause(); }
      return;
    }
    if (S.state === 'menu') {
      if (onInput) return;
      if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); kbdNav(k === 'ArrowDown' ? 1 : -1); }
      else if (k === 'Space' || k === 'Enter') { e.preventDefault(); kbdActivate(); }
      return;
    }
    if (S.state === 'paused' || S.state === 'over') {
      if (onInput) return;
      if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); kbdNav(k === 'ArrowDown' ? 1 : -1); }
      else if (k === 'Space' || k === 'Enter') { e.preventDefault(); kbdActivate(); }
      return;
    }
    if (S.state !== 'playing') return;
    if (k === 'ArrowLeft') { e.preventDefault(); movePiece(-1); }
    else if (k === 'ArrowRight') { e.preventDefault(); movePiece(1); }
    else if (k === 'ArrowUp' || k === 'KeyX') { e.preventDefault(); rotatePiece(); }
    else if (k === 'ArrowDown') { e.preventDefault(); S.softDrop = true; }
    else if (k === 'Space') { e.preventDefault(); hardDrop(); }
  }
  document.addEventListener('keydown', function (e) {
    if (e.repeat && e.code !== 'ArrowDown') return;
    handleKey(e.code, e);
  });
  document.addEventListener('keyup', function (e) {
    if (e.code === 'ArrowDown') S.softDrop = false;
  });

  // ---------- main loop ----------
  var last = 0;
  function frame(ts) {
    var dt = last ? Math.min(100, ts - last) : 16;
    last = ts;
    noteFrame(dt); // FPS guard (backlog #47): feed the frame-time average
    step(dt);
    updateFx(dt);
    render();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame);
  }

  // ---------- boot ----------
  S.board = emptyBoard();
  S.armor = emptyFlags(0); S.locked = emptyFlags(false); S.star = emptyFlags(false);
  S.seed = dailySeed();
  S.rng = mulberry32(hashSeed(S.seed));
  S.dailyBest = loadDailyBest();
  S.next = rollColors();
  S.nextElite = rollEliteFlags(S.next);
  showOnly(el.menu);
  updateHUD();
  render();
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame);

  // test / debug handle
  window.__nhx = {
    S: S, COLS: COLS, ROWS: ROWS, SLAG: SLAG, BOMB: BOMB, RAINBOW: RAINBOW, COLORS: COLORS, VERSION: VERSION,
    newGame: newGame, spawnPiece: spawnPiece, movePiece: movePiece, rotatePiece: rotatePiece,
    hardDrop: hardDrop, lockPiece: lockPiece, findGroups: findGroups, resolveBoard: resolveBoard,
    applyGravity: applyGravity, surgeTide: surgeTide, step: step, render: render,
    pickSurgePattern: pickSurgePattern, doubleSurgeChance: doubleSurgeChance,
    rollColors: rollColors, updateFx: updateFx,
    addHitStop: addHitStop, addPop: addPop, shakeForClear: shakeForClear,
    // Block 12: visual polish — shockwave rings, confetti, chain fire.
    addRing: addRing, spawnConfetti: spawnConfetti,
    igniteChainFire: igniteChainFire, spawnFlame: spawnFlame,
    togglePause: togglePause, toggleMute: toggleMute, gameOver: gameOver,
    quitToMenu: quitToMenu, updateHUD: updateHUD,
    rankFor: rankFor, RANKS: RANKS, seedUrl: seedUrl, shareSeed: shareSeed,
    loadDailyBest: loadDailyBest, loadTop5: loadTop5, recordTop5: recordTop5,
    countSpecials: countSpecials, addFx: addFx, removeFx: removeFx,
    // Block 10: elite hexes (armored / locked / star).
    eliteChance: eliteChance, rollEliteFlags: rollEliteFlags, clearCell: clearCell,
    // Block 11: playtest + bugfix — board audit, self-repair, FPS guard.
    validateBoard: validateBoard, sanitizeState: sanitizeState,
    noteFrame: noteFrame, setLowFx: setLowFx, frameStats: frameStats,
    // Block 8: keyboard + touch entry points for the harness.
    handleKey: function (k, ev) { handleKey(k, ev || { preventDefault: function () {}, target: null }); },
    kbdNav: kbdNav, kbdActivate: kbdActivate, overlayButtons: overlayButtons,
    touchStart: touchStart, touchMove: touchMove, touchEnd: touchEnd,
    audio: AudioSys,
    setCell: function (c, r, v) { if (inBoard(c, r)) S.board[c][r] = v; },
    getCell: function (c, r) { return inBoard(c, r) ? S.board[c][r] : undefined; },
    setArmor: function (c, r, v) { if (inBoard(c, r)) S.armor[c][r] = v; },
    getArmor: function (c, r) { return inBoard(c, r) ? S.armor[c][r] : undefined; },
    setLocked: function (c, r, v) { if (inBoard(c, r)) S.locked[c][r] = !!v; },
    setStar: function (c, r, v) { if (inBoard(c, r)) S.star[c][r] = !!v; },
    setPiece: function (col, row, colors, elite) {
      elite = elite || {};
      S.piece = {
        col: col, row: row, colors: colors.slice(),
        armored: (elite.armored || [false, false, false]).slice(),
        locked: (elite.locked || [false, false, false]).slice(),
        star: (elite.star || [false, false, false]).slice()
      };
    },
    setTide: function (v) { S.tide = v; },
    fallMs: fallMs
  };
})();
