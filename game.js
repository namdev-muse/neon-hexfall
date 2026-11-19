// Neon Hexfall — v0.7.0 — Block 7: top-5 scores + game-over stats + powerup HUD.
// Falling-hex arcade puzzle: tri-hex pieces fall, match 3+ connected hexes
// of one colour to clear them, chain cascades for multipliers, and outrun
// the rising tide. Vanilla JS + Canvas 2D + Web Audio. No build step.
'use strict';

(function () {
  var VERSION = '0.7.0';
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
      else if (name === 'rainbow') { var rb = [784, 988, 1175, 1568]; for (var q2 = 0; q2 < 4; q2++) this.tone(rb[q2], 0.1, 'sine', 0.14, q2 * 0.05); }
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
    particles: [], floats: [], shake: 0, hitStop: 0, pops: [],
    banner: null, allClears: 0, lastClear: null, biggestMatch: 0,
    specialsSpawned: 0, bombsDetonated: 0, rainbowsCleared: 0, triosSinceSpecial: 0,
    tideWarned: false, rankIdx: 0, dailyBest: 0, pendingRankUp: null,
    top5: [], top5Rank: null, activeFx: [],
    muted: AudioSys.muted
  };
  try { S.best = parseInt(localStorage.getItem('nhx-best') || '0', 10) || 0; } catch (e) {}

  function emptyBoard() {
    var b = [];
    for (var c = 0; c < COLS; c++) { b.push(new Array(ROWS).fill(null)); }
    return b;
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
    ctx.shadowColor = glow; ctx.shadowBlur = 12;
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

  // Powerup HUD indicators (backlog #11): live counts of the special hexes
  // sitting on the board, for the strip under the HUD.
  function countSpecials() {
    var bombs = 0, rainbows = 0;
    for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) {
      if (S.board[c][r] === BOMB) bombs++;
      else if (S.board[c][r] === RAINBOW) rainbows++;
    }
    return { bombs: bombs, rainbows: rainbows };
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
  function spawnPiece() {
    var col = Math.floor(COLS / 2) - 1;
    var colors = S.next || rollColors();
    S.next = rollColors();
    S.piece = { col: col, row: -2, colors: colors }; // row = top cell; starts above board
    S.fallAcc = 0;
    // top-out: spawn cells blocked
    if (cellAt(col, 0) !== null || cellAt(col, 1) !== null) { topOut(); return false; }
    return true;
  }
  function pieceCells(p) {
    p = p || S.piece;
    if (!p) return [];
    var top = Math.floor(p.row);
    return [
      { c: p.col, r: top, color: p.colors[0] },
      { c: p.col, r: top + 1, color: p.colors[1] },
      { c: p.col, r: top + 2, color: p.colors[2] }
    ];
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
      if (cell.r >= 0 && cell.r < ROWS) S.board[cell.c][cell.r] = cell.color;
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
    for (var c = 0; c < COLS; c++) for (var r = 0; r < 4; r++) S.board[c][r] = null;
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
        if (v === null || v === SLAG || v === BOMB || seen[c][r]) continue;
        var stack = [[c, r]], group = [], local = {};
        local[c + ',' + r] = true;
        while (stack.length) {
          var cur = stack.pop();
          group.push(cur);
          var ns = neighbours(cur[0], cur[1]);
          for (var i = 0; i < ns.length; i++) {
            var nc = ns[i][0], nr = ns[i][1];
            if (!inBoard(nc, nr) || local[nc + ',' + nr]) continue;
            if (groupMatches(v, S.board[nc][nr])) { local[nc + ',' + nr] = true; stack.push([nc, nr]); }
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
    for (var c = 0; c < COLS; c++) {
      var col = S.board[c];
      var write = ROWS - 1;
      for (var r = ROWS - 1; r >= 0; r--) {
        if (col[r] !== null) { col[write] = col[r]; if (write !== r) col[r] = null; write--; }
      }
      for (var w = write; w >= 0; w--) col[w] = null;
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
      S.board[bc][br] = null;
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
        S.board[nc][nr] = null;
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
      var sizeBonus = 0, biggest = 0, bigCx = 240, bigCy = 200;
      for (var g = 0; g < groups.length; g++) {
        var sz = groups[g].length;
        if (sz > biggest) {
          biggest = sz;
          var sx = 0, sy = 0;
          for (var m = 0; m < sz; m++) { var cp = hexXY(groups[g][m][0], groups[g][m][1]); sx += cp.x; sy += cp.y; }
          bigCx = sx / sz; bigCy = sy / sz;
        }
        if (sz === 4) sizeBonus += 200 * chain;
        else if (sz === 5) sizeBonus += 400 * chain;
        else if (sz >= 6) sizeBonus += 800 * chain;
      }
      S.biggestMatch = Math.max(S.biggestMatch, biggest);
      var rainbowsThisCascade = 0;
      for (var g2 = 0; g2 < groups.length; g2++) {
        var group = groups[g2];
        for (var i = 0; i < group.length; i++) {
          var cc = group[i][0], rr = group[i][1];
          var cv = S.board[cc][rr];
          if (cv === null) continue; // shared rainbow already cleared by another group
          if (cv === RAINBOW) { S.rainbowsCleared++; rainbowsThisCascade++; }
          var p = hexXY(cc, rr);
          burst(p.x, p.y, cellStyle(cv).glow, 6);
          addPop(p.x, p.y, cellStyle(cv).glow);
          S.board[cc][rr] = null;
          clearedSet[cc + ',' + rr] = true;
          cleared++;
        }
      }
      // bombs next to a cleared cell detonate (50 pts per blasted hex, x chain)
      var bombPts = detonateBombs(clearedSet, chain);
      // slag adjacent to a cleared cell crumbles too
      for (var c = 0; c < COLS; c++) {
        for (var r = 0; r < ROWS; r++) {
          if (S.board[c][r] !== SLAG) continue;
          var ns = neighbours(c, r), adj = false;
          for (var k = 0; k < ns.length; k++) if (clearedSet[ns[k][0] + ',' + ns[k][1]]) { adj = true; break; }
          if (adj) { var q = hexXY(c, r); burst(q.x, q.y, '#9d8fd0', 4); addPop(q.x, q.y, '#9d8fd0'); S.board[c][r] = null; slagCleared++; }
        }
      }
      S.hexesCleared += cleared + slagCleared;
      S.matches++;
      var pts = cleared * 100 * chain + slagCleared * 25 * chain + sizeBonus + bombPts;
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
        announce('Big match of ' + biggest + '! +' + pts + ' points.');
      } else if (chain > 1) { AudioSys.sfx('chain'); addHitStop(60); }
      else AudioSys.sfx('clear');
      if (cleared >= 4 && biggest < 5 && chain === 1) addHitStop(40);
      if (rainbowsThisCascade > 0) AudioSys.sfx('rainbow');
      // chain combo display: big centre banner for cascades
      if (chain > 1) {
        addBanner('CHAIN ×' + chain, '+' + pts + ' PTS', '#ffe14d');
        announce('Chain times ' + chain + '! +' + pts + ' points.');
      }
      addShake(shakeForClear(cleared + slagCleared, chain, biggest));
      applyGravity();
      // level up every 6 clears
      var newLevel = 1 + Math.floor(S.clears / 6);
      if (newLevel > S.level) {
        S.level = newLevel;
        announce('Level ' + S.level + '! The tide rises faster.');
        addFloat(240, 300, 'LEVEL ' + S.level, '#22e6ff');
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
        addShake(8);
        addHitStop(120);
        AudioSys.sfx('allclear');
        announce('All clear! Bonus ' + bonus + ' points.');
      }
    }
    S.chain = Math.max(1, chain);
    AudioSys.applyIntensity(); // music tempo/layers follow level + live chain
  }
  function surgeTide() {
    S.tide = 25;
    S.tideWarned = false;
    AudioSys.sfx('surge');
    addShake(10);
    announce('Tide surge! A row of slag rises from the bottom.');
    addFloat(240, 420, 'TIDE SURGE!', '#8b5cf6');
    for (var c = 0; c < COLS; c++) {
      for (var r = 0; r < ROWS - 1; r++) S.board[c][r] = S.board[c][r + 1];
      S.board[c][ROWS - 1] = SLAG;
    }
    updateHUD();
  }

  // ---------- particles / floats ----------
  function burst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 160;
      S.particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.4, max: 0.9, color: color, size: 2 + Math.random() * 3 });
    }
    if (S.particles.length > 400) S.particles.splice(0, S.particles.length - 400);
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
  // Screen shake scaling (backlog #32): shake grows with clear size, chain
  // depth and big matches instead of a flat amount per cascade.
  function shakeForClear(cleared, chain, biggest) {
    var m = 2 + cleared * 1.2 + (chain - 1) * 3 + (biggest >= 5 ? 2 : 0);
    return Math.min(16, m);
  }

  // ---------- game flow ----------
  function newGame() {
    S.board = emptyBoard();
    S.seed = dailySeed();
    S.rng = mulberry32(hashSeed(S.seed));
    S.score = 0; S.level = 1; S.lives = 3; S.tide = 0; S.chain = 1; S.clears = 0;
    S.pieces = 0; S.hexesCleared = 0; S.matches = 0; S.bestChain = 0;
    S.timeMs = 0; S.fallAcc = 0; S.softDrop = false;
    S.particles = []; S.floats = []; S.shake = 0; S.hitStop = 0; S.pops = [];
    S.banner = null; S.allClears = 0; S.lastClear = null; S.biggestMatch = 0;
    S.specialsSpawned = 0; S.bombsDetonated = 0; S.rainbowsCleared = 0; S.triosSinceSpecial = 0;
    S.tideWarned = false; S.rankIdx = 0; S.pendingRankUp = null;
    S.top5 = loadTop5(); S.top5Rank = null; S.activeFx = [];
    S.dailyBest = loadDailyBest();
    S.next = rollColors();
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
  function showOnly(overlay) {
    var all = [el.menu, el.how, el.pause, el.over];
    for (var i = 0; i < all.length; i++) if (all[i]) all[i].classList.toggle('hidden', all[i] !== overlay);
  }
  var lastTop5Html = ''; // cached menu top-5 render (backlog #44)
  function updateHUD() {
    if (el.score) el.score.textContent = S.score;
    if (el.best) el.best.textContent = S.best;
    if (el.level) el.level.textContent = S.level;
    if (el.lives) el.lives.textContent = '●'.repeat(Math.max(0, S.lives)) + '○'.repeat(Math.max(0, 3 - S.lives));
    if (el.chain) { el.chain.textContent = '×' + S.chain; el.chain.classList.toggle('hot', S.chain >= 2); }
    if (el.tideFill) el.tideFill.style.width = S.tide.toFixed(1) + '%';
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
    // Powerup HUD indicators (backlog #11): live special counts, the next
    // trio's specials, and any active timed effect with its countdown.
    if (el.specialsStrip) {
      var sp = countSpecials();
      var parts = [];
      if (sp.bombs > 0) parts.push('💣 ' + sp.bombs + ' ON BOARD');
      if (sp.rainbows > 0) parts.push('🌈 ' + sp.rainbows + ' ON BOARD');
      if (S.next) {
        var nx = [];
        if (S.next.indexOf(BOMB) !== -1) nx.push('💣');
        if (S.next.indexOf(RAINBOW) !== -1) nx.push('🌈');
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
      var names = S.next.map(function (c) { return cellStyle(c).name; }).join(' · ');
      el.menuNext.textContent = S.state === 'menu' ? 'NEXT TRIO: ' + names : '';
    }
  }

  // ---------- update / render ----------
  function step(dtMs) {
    if (S.state !== 'playing') return;
    // hit-stop: freeze the falling piece and the tide while the freeze lasts
    if (S.hitStop > 0) { S.hitStop = Math.max(0, S.hitStop - dtMs); return; }
    S.timeMs += dtMs;
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
    if (S.tide >= 100) surgeTide();
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
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; p.life -= dt;
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
    // tide waterline at the bottom
    var tideH = (S.tide / 100) * 46;
    if (tideH > 0.5) {
      ctx.fillStyle = 'rgba(139,92,246,0.30)';
      ctx.fillRect(0, h - tideH, w, tideH);
      ctx.fillStyle = 'rgba(167,139,250,0.8)';
      ctx.fillRect(0, h - tideH, w, 2);
    }
    // locked hexes
    for (var c2 = 0; c2 < COLS; c2++) for (var r2 = 0; r2 < ROWS; r2++) {
      var v = S.board[c2][r2];
      if (v === null) continue;
      var p = hexXY(c2, r2);
      var col = cellStyle(v);
      drawHex(p.x, p.y, HEX_R - 2, col.fill, col.glow, 1);
      if (v === BOMB || v === RAINBOW) drawSpecialMark(p.x, p.y, v, 1);
      if (v === SLAG) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✕', p.x, p.y + 1);
      }
    }
    // hex pop animations: cleared hexes scale up and fade out in place
    for (var po = 0; po < S.pops.length; po++) {
      var pop = S.pops[po];
      var pt = clamp(pop.life / pop.max, 0, 1);
      drawHex(pop.x, pop.y, (HEX_R - 2) * (1 + 0.45 * (1 - pt)), pop.color, pop.color, pt);
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
      }
      ctx.fillStyle = '#9d8fd0';
      ctx.textAlign = 'right';
      ctx.fillText('LEVEL ' + S.level, w - 18, 26);
      // current run rank (backlog #5) under the level
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#a6ff3e';
      ctx.fillText(rankFor(S.score).name, w - 18, 44);
    }
    // particles
    for (var pi = 0; pi < S.particles.length; pi++) {
      var pt = S.particles[pi];
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    // floating texts
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var fi = 0; fi < S.floats.length; fi++) {
      var fl = S.floats[fi];
      ctx.globalAlpha = clamp(fl.life, 0, 1);
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = fl.color;
      ctx.shadowColor = fl.color; ctx.shadowBlur = 10;
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
      ctx.shadowColor = b.color; ctx.shadowBlur = 18;
      ctx.fillText(b.text, 0, 0);
      if (b.sub) {
        ctx.font = 'bold 18px sans-serif';
        ctx.shadowBlur = 8;
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
  bind($('tcLeft'), function () { movePiece(-1); });
  bind($('tcRight'), function () { movePiece(1); });
  bind($('tcRotate'), rotatePiece);
  bind($('tcDown'), function () { S.softDrop = true; setTimeout(function () { S.softDrop = false; }, 180); });
  bind($('tcDrop'), hardDrop);

  document.addEventListener('keydown', function (e) {
    if (e.repeat && e.code !== 'ArrowDown') return;
    var k = e.code;
    if (S.state === 'menu') {
      if (k === 'Space' || k === 'Enter') { e.preventDefault(); AudioSys.init(); newGame(); }
      return;
    }
    if (k === 'KeyM') { toggleMute(); return; }
    if (k === 'KeyP' || k === 'Escape') { if (S.state === 'playing' || S.state === 'paused') { e.preventDefault(); togglePause(); } return; }
    if (S.state !== 'playing') {
      if (k === 'Space' || k === 'Enter') {
        if (S.state === 'over') { e.preventDefault(); newGame(); }
        else if (S.state === 'paused') { e.preventDefault(); togglePause(); }
      }
      return;
    }
    if (k === 'ArrowLeft') { e.preventDefault(); movePiece(-1); }
    else if (k === 'ArrowRight') { e.preventDefault(); movePiece(1); }
    else if (k === 'ArrowUp' || k === 'KeyX') { e.preventDefault(); rotatePiece(); }
    else if (k === 'ArrowDown') { e.preventDefault(); S.softDrop = true; }
    else if (k === 'Space') { e.preventDefault(); hardDrop(); }
  });
  document.addEventListener('keyup', function (e) {
    if (e.code === 'ArrowDown') S.softDrop = false;
  });
  canvas.addEventListener('pointerdown', function (e) {
    if (S.state !== 'playing') return;
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width * canvas.width;
    if (x < canvas.width / 3) movePiece(-1);
    else if (x > canvas.width * 2 / 3) movePiece(1);
    else rotatePiece();
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

  // ---------- main loop ----------
  var last = 0;
  function frame(ts) {
    var dt = last ? Math.min(100, ts - last) : 16;
    last = ts;
    step(dt);
    updateFx(dt);
    render();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame);
  }

  // ---------- boot ----------
  S.board = emptyBoard();
  S.seed = dailySeed();
  S.rng = mulberry32(hashSeed(S.seed));
  S.dailyBest = loadDailyBest();
  S.next = rollColors();
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
    rollColors: rollColors, updateFx: updateFx,
    addHitStop: addHitStop, addPop: addPop, shakeForClear: shakeForClear,
    togglePause: togglePause, toggleMute: toggleMute, gameOver: gameOver,
    quitToMenu: quitToMenu, updateHUD: updateHUD,
    rankFor: rankFor, RANKS: RANKS, seedUrl: seedUrl, shareSeed: shareSeed,
    loadDailyBest: loadDailyBest, loadTop5: loadTop5, recordTop5: recordTop5,
    countSpecials: countSpecials, addFx: addFx, removeFx: removeFx,
    audio: AudioSys,
    setCell: function (c, r, v) { if (inBoard(c, r)) S.board[c][r] = v; },
    getCell: function (c, r) { return inBoard(c, r) ? S.board[c][r] : undefined; },
    setPiece: function (col, row, colors) { S.piece = { col: col, row: row, colors: colors.slice() }; },
    setTide: function (v) { S.tide = v; },
    fallMs: fallMs
  };
})();
