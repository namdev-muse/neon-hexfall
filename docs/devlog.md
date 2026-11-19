# Neon Hexfall — devlog

## Block 1 — Concept + repo + core engine (v0.1.0)

- Concept: falling-hex arcade puzzle. Tri-hex pieces fall; match 3+ connected
  hexes of one colour to clear them; cascades chain for multipliers; a rising
  tide surges slag rows up from the bottom; 3 lives, top-out costs one.
- Core engine (`game.js`, ~700 lines): 8×11 pointy-top hex board (odd-q
  offset neighbours), trio pieces with move / rotate / soft drop / hard drop,
  ghost landing preview, flood-fill match detection, per-column gravity,
  chain multipliers, tide meter + surge, slag that crumbles next to matches,
  levels every 6 clears (fall + tide ramp), daily-seed trio sequence
  (`?seed=` override, same trios for everyone each day), localStorage best,
  Web Audio synth SFX + bass music loop, particles / floating score text /
  screen shake / tide waterline, keyboard + touch buttons + tap-to-move,
  pause / game-over screens, screen-reader announcements.
- Tests: `tests/smoke.js` stub-DOM harness — 42/42 checks PASS (boot, move,
  rotate, hard drop, match scoring, chain cascade ×2, gravity, tide surge,
  slag crumbling, top-out / lives / game over, pause, mute, level-up,
  2000-step random-input soak with board-consistency checks). One harness
  fix during the block: Node 24 forbids assigning `global.navigator`
  (getter-only) — removed; and the music `setInterval` keeps Node alive,
  so the harness now exits explicitly.
- CI: `.github/workflows/ci-pages.yml` (syntax check + smoke test + Pages
  deploy from `main`).
- Repo: https://github.com/namdev-muse/neon-hexfall (created via browser,
  empty). Live: https://namdev-muse.github.io/neon-hexfall/ (pending first
  deploy after the Block 1 upload).

## Block 2 — Match polish + chain scoring + combo display (v0.2.0)

- Chain combo display (backlog #1): cascades now flash a big centre
  `CHAIN ×N` banner (gold, pop-in scale, 1.5s fade) plus a `+pts` score
  popup at the cleared group's centre; the HUD chain value turns gold
  while a chain is live; chains are announced to screen readers.
- Match-size bonus (backlog #2): 4-hex groups pay +200, 5 pay +400,
  6+ pay +800 (× chain). 5+ matches also flash a `BIG MATCH ×N!` popup
  with a new rising SFX and extra shake.
- All-clear bonus (backlog #3): a clear that empties the whole board pays
  +1000 × level, with an `ALL CLEAR!` banner, confetti bursts, a new
  arpeggio SFX, and an `All clears` / `Biggest match` line on the
  game-over stats screen. State tracks `allClears`, `biggestMatch`,
  `lastClear` (exposed via `window.__nhx` for tests).
- Tests: smoke harness grew to 54 checks (was 42) — exact-score checks
  for 3/4/5-matches (300 / 600 / 900), all-clear payout (1900),
  banner + float + lastClear assertions. 54/54 PASS, plus a headless
  Chromium render of the local build (menu + v0.2.0, zero console errors).

## Block 3 — Powerups: bomb hex, rainbow hex, powerup drops (v0.3.0)

- Bomb hex (backlog #6): dark hex with a vector bomb glyph. Never matches
  by colour; detonates when any adjacent cell is cleared by a match,
  blasting its 6 neighbours for 50 pts each (× chain) and
  chain-detonating bombs caught in the blast or next to a blasted cell.
  Blasted cells join the cleared set, so adjacent slag crumbles too.
  New boom SFX, shake, and a `💥 BOMB! +pts` popup.
- Rainbow hex (backlog #7): hue-cycling hex with a ✦ mark. Wildcard —
  joins any colour group in the flood fill (and bridges two colours
  through itself); 3+ rainbows match together. New shimmer SFX when one
  clears. Shared rainbows are counted once even if two groups overlap.
- Powerup drop system (backlog #10): `rollColors()` sometimes swaps one
  slot of a trio for a bomb or rainbow — chance grows with level
  (bomb ~5% + 0.5%/level, rainbow ~4% + 0.5%/level, capped 15% each),
  with a pity timer guaranteeing a special at least every 12 trios.
  Specials render in the falling trio, the ghost column's source, and
  the next-trio preview. Game-over stats now show bombs detonated,
  rainbows cleared, and specials spawned.
- Tests: smoke harness grew to 69 checks — rainbow wildcard match,
  rainbow bridging two colours, bomb detonation payout (500), bomb
  chain-detonation (400), pity-timer forced special, board validity
  extended to values 0–8. All PASS.

## Block 4 — Juice pass 1: hit-stop, hex pop, shake scaling (v0.4.0)
- Hit-stop (backlog #28): big clears freeze gameplay briefly — 5+ match
  90ms, chain cascade 60ms, 4-match 40ms, bomb detonation 70ms, all-clear
  120ms. `step()` consumes the freeze; rendering and particles keep running,
  so the pause reads as impact, not a stall. Plain 3-matches don't freeze.
- Hex pop animation (backlog #29): every cleared hex (match, bomb blast,
  crumbled slag) spawns a pop that scales up ~1.45x and fades out over
  0.28s, drawn in place on the board. Capped at 64 live pops.
- Screen shake scaling (backlog #32): new `shakeForClear(cleared, chain,
  biggest)` — base 2 + 1.2 per cleared hex + 3 per extra chain link + 2 for
  5+ matches, capped at 16; overall shake cap raised 14 → 18. A 6-match now
  shakes about twice as hard as a 3-match. All-clear adds +8 shake.
- Tests: smoke harness grew to 82 checks — hit-stop set on 5-match and
  freezing the falling piece, pop spawn/expiry, shake scaling and caps.
  All PASS.

## Block 5 — Audio deepening: music intensity, new SFX, volume slider (v0.5.0)
- Music intensity (backlog #34): the bass loop now retunes with the run —
  tempo quickens from 460ms toward a 300ms floor as the level rises and
  while big chains are live (`musicTempo()`), and layers stack on top: a
  hat tick at level 2+, a harmony fifth at level 4+, and a sparkle
  arpeggio while a chain is live. `applyIntensity()` restarts the loop
  only when the tempo actually changes.
- New SFX (backlog #35): a powerup sparkle jingle when a bomb/rainbow hex
  drops inside a trio, and a two-tone surge-warning alarm (once per cycle)
  when the tide crosses 80%, with a `TIDE RISING!` popup and a screen
  reader announcement. Bomb and all-clear SFX deepened (sub-bass boom,
  high shimmer tail). `AudioSys.played` counts every SFX for tests.
- Volume slider (backlog #36): range sliders on the main menu and in the
  pause overlay, 0–1 in 0.05 steps, persisted to localStorage
  (`nhx-volume`), synced both ways, and respected by mute (mute zeroes
  the master gain while the stored volume is remembered).
- Tests: smoke harness grew to 99 checks — tempo scaling with level /
  chain, tempo floor, retune on level-up, powerup / surge-warning /
  bomb / all-clear SFX wiring, warning fires once per cycle, volume
  set/persist/clamp/slider sync, mute/unmute gain. All PASS.

## Block 6 — Daily challenge + ranks + shareable seed (v0.6.0)

- Daily challenge (backlog #23): every seed now has its own daily best,
  stored in localStorage under `nhx-daily-<seed>` and shown on the menu
  (`DAILY BEST` for today's seed, `SEED BEST` for a custom seed) and on
  the game-over screen, with a `★ NEW DAILY BEST ★` badge when beaten.
  The all-time best (`nhx-best`) is tracked separately.
- Rank titles (backlog #5): score milestones climb Rookie → Hex Cadet
  (1,000) → Hex Runner (2,500) → Hex Hunter (5,000) → Hex Ace (10,000) →
  Hex Elite (20,000) → Hex Master (35,000) → Hex Legend (50,000). A
  `RANK UP!` banner + jingle fires when a run crosses a threshold (once
  per rank); the current rank shows under LEVEL on the board, the best
  rank and next threshold show on the menu, and both appear in the
  game-over and pause stats.
- Shareable seed (backlog #26): `SHARE THIS SEED` buttons on the menu
  and the game-over screen copy a `?seed=` link (clipboard API, with a
  manual-copy fallback that prints the link on the menu). Custom seeds
  get their own menu wording (`CUSTOM SEED … — same trios for anyone
  with this link`), and the how-to overlay now explains the daily
  challenge and ranks.
- Tests: smoke harness grew to 131 checks — full rank ladder, rank-up
  banner firing once per threshold, rank-up queueing behind a live
  all-clear banner, daily-best save / load / keep, badges, menu lines,
  seed URL and share fallback. All PASS. The harness caught a real bug
  pre-push: the rank-up banner was clobbering the CHAIN / ALL CLEAR
  banner on the same clear — rank-ups now queue behind a live banner
  and show when it expires.

## Block 7 — UI: top-5 scores, game-over stats, powerup HUD (v0.7.0)

- Top-5 high-score table (backlog #44): the five best runs ever, stored
  in localStorage under `nhx-top5` as {score, seed, rank, date} entries,
  best first. Shown on the main menu and on the game-over screen; a run
  that makes the table is highlighted in its row and earns a
  `★ TOP 5 ★` badge. Runs that miss the cut leave the table untouched,
  and corrupt stored data loads as an empty table instead of breaking.
- Game-over stats screen (backlog #39): the old plain-text block is now a
  labelled stat grid — score, best, daily best, seed, rank, level, time,
  hexes cleared, matches, best chain, biggest match, all clears, bombs,
  rainbows, specials spawned, and accuracy (hexes cleared per trio).
- Powerup HUD indicators (backlog #11): a strip under the HUD shows live
  bomb / rainbow counts on the board, specials carried by the next trio,
  and specials spawned this run (with a hint when the board is empty).
  It also renders active timed effects with a live countdown — the
  `activeFx` registry (`addFx` / `removeFx`, expired in `step()`) is
  empty until the timed powerups (slow-tide #8, tide freeze #18) land.
- Tests: smoke harness grew to 160 checks (29 new) — top-5 insert /
  order / bump-out / miss / corrupt-data recovery, menu vs game-over
  rendering, stats grid rows + accuracy, specials counts, next-trio
  flag, effect countdown ticking and expiry. All PASS.

## Block 8 — Touch swipe + keyboard-only menus + small-phone responsive (v0.8.0)

- Touch controls polish (backlog #41): swipe sideways on the board to move
  column by column (one column per ~45px of travel), drag down and hold for
  a soft drop, flick down fast for a hard drop; tap left / middle / right
  thirds still move / rotate. The ◀ ▶ ▼ buttons are now hold-to-repeat
  (260ms delay, then every 110ms) so long shifts need no dozens of taps;
  DROP and ⟳ stay single taps. Pull-to-refresh and scroll chaining are
  blocked while swiping the board.
- Full keyboard-only play (backlog #42): every overlay is navigable with
  Up/Down + Enter — menu, how-to, pause and game-over — with Escape stepping
  back (how-to -> menu) and focus landing on the first button whenever an
  overlay opens. A focused volume slider keeps the arrow keys natively.
  Keyboard handling is factored into `handleKey()` and exposed on `__nhx`
  so the harness drives it directly. One fix found while wiring it: the
  game-over MENU button must call `quitToMenu()` (state reset), not just
  show the menu overlay.
- Small-phone responsive pass (backlog #43): safe-area insets on the shell,
  380px narrow-phone breakpoint (tighter type, spacing, touch targets),
  short-screen compact rhythm below 760px height (footer hints hidden —
  they live in the how-to overlay), short-landscape chrome reduction, and
  56px thumb-sized touch buttons on coarse pointers.
- Tests: smoke harness grew to 203 checks (43 new) — tap zones, drag
  distance, drag-down soft drop + release, fast-flick hard drop, swipes
  ignored while paused / on the menu, menu / how-to / pause / game-over
  keyboard navigation and activation, slider arrow-key guard, mute from the
  menu, and static checks that the responsive CSS rules exist. All PASS.

## Block 9 — Signature tide surge variants (v0.9.0)

- Double surge (backlog #15): from level 4 a surge can schedule a second
  one 2.5s later — 20% chance at level 4, +10% per level, capped at 60%.
  A "⚠ DOUBLE SURGE INCOMING!" float + alarm warns the player, and the
  second surge can never schedule a third. Surges and double surges are
  counted and shown on the game-over stats screen.
- Slag patterns (backlog #16): surges stop being plain full rows once the
  level climbs. Levels 1-2 always surge a full row; from level 3 a row may
  rise with 1-2 gaps; from level 5 the tide may instead rise as 3 random
  columns of slag, two rows tall. Patterns are picked from the seeded rng,
  so daily runs stay identical for everyone. The surge float names the
  pattern ("TIDE SURGE — GAPS!" / "— COLUMNS!").
- Tide warning (backlog #17): in the last 20% of the tide the waterline on
  the board pulses red, the HUD tide bar flashes red (`.tide-fill.warn`),
  and a soft low tick repeats every 1.5s — on top of the existing one-off
  alarm at 80%. The how-to overlay now explains double surges, patterns
  and the warning.
- Tests: smoke harness grew to 230 checks (27 new) — double-surge chance
  ladder + cap, pattern pick at low level, full/gaps/columns surge shapes
  and board shift, forced-roll double scheduling + on-time second surge +
  no third, warning alarm + HUD flash + repeating tick + warning clearing
  after the surge, surge stats on the game-over screen. All PASS.

## Block 10 — Elite hexes (v0.10.0)

- Armored hexes (backlog #12): a steel-ringed hex takes two match hits to
  clear — the first hit only cracks it (grey burst + "CRACK!" float +
  crunch SFX), the second clears it. A match that only cracks pays nothing
  and doesn't count as a chain step, so an all-armored group cracks in one
  pass and clears in the next at chain ×1.
- Locked hexes (backlog #13): a gold-padlocked hex never joins a match
  until a clear next to it breaks the lock (+50 × chain, "UNLOCKED +50"
  float + rising-tone SFX). The hex stays on the board as a normal colour
  hex and can match in the next cascade.
- Bonus star hexes (backlog #14): a gold-starred hex matches normally and
  pays +250 × chain when it clears, with a bright chime and a "★ +250"
  float. A star cleared in a chain ×2 cascade pays 500.
- Difficulty balance: elites are level-gated — stars and armor from level
  2, locks from level 3 — with chances that grow slowly with level (star
  ~5-8%, armor ~7-12%, lock ~6-10%), at most one elite per trio, and never
  on a bomb/rainbow slot. Elite flags ride with their hexes through
  rotation, gravity, surges and top-outs (parallel flag boards moved
  together with the colour board, and a shared `clearCell()` keeps flags
  from going stale on emptied cells).
- HUD + stats: the specials strip counts armored / locked / star hexes on
  the board and flags elites in the next trio; the menu names them in the
  next-trio preview; the game-over screen lists armor cracked / armored
  cleared / locks broken / stars. The how-to overlay explains all three.
- Tests: smoke harness grew to 285 checks (55 new) — level gating, forced
  elite rolls, no elite on special slots, one elite per trio, crack then
  clear, all-armored chain behaviour, locked non-matching + unlock +
  re-matching, star payouts at chain ×1 and ×2, rotation carrying flags,
  lock writing flags, flags travelling through gravity / surge / top-out,
  HUD strip + menu + stats, render with elites. Two failures on the first
  run were test-expectation bugs (6 cracks for 3 hexes × 2 hits; gravity
  refills a cleared cell) — fixed in the tests, game code untouched.
  All PASS.

## Block 11 — Playtest + bugfix pass 1 (v0.11.0)

- Auto-play bot harness (backlog #46): new `tests/bot.js` — a greedy bot
  that plays full games headlessly, scoring every rotation × column
  placement by the matches it would form, bombs it would set off and
  stack height, then playing the best one. It plays 10 games on different
  seeds (up to 600 locks each), audits the board after every lock, and
  checks the bot scores, clears, chains, survives surges and reaches
  level 2 — plus a determinism check that the same seed replays to the
  same score. Wired into CI after the smoke test.
- Board-consistency audit + self-repair (backlog #48): `validateBoard()`
  scans the board, elite flag boards and numeric run state (bad cell
  values, floating hexes, stale elite flags on empty/special cells, NaN
  score / level / lives / tide / time, stuck piece) and returns a list
  of issues; `sanitizeState()` repairs them — clearing bad cells,
  dropping stale flags, clamping numbers, compacting floating hexes and
  replacing a stuck piece with a fresh spawn — and counts repairs in
  `S.repairs`. `step()` runs the audit once a second while playing, and
  ignores NaN or negative clock steps outright so a bad frame time can
  never poison the run clock, tide or fall accumulator.
- FPS guard (backlog #47): `noteFrame()` tracks a rolling frame-time
  average (fed by `frame()` every frame); sustained slow frames over
  40ms trip low-FX mode — `drawHex` and the banner/float glow skip
  `shadowBlur` (the most expensive per-frame cost) and `burst()` halves
  particle spawns with a 200 cap instead of 400 — until the average
  recovers under 25ms. Exposed as `setLowFx()` / `frameStats()` for the
  harness.
- Tests: smoke harness grew to 319 checks (34 new) — audit flags and
  repairs for bad cells, floating hexes, stale flags, elite flags on
  slag, NaN score and a NaN piece row, the in-step audit repairing a bad
  cell by itself, NaN/negative step guards, and the FPS guard tripping on
  slow frames, halving particles, recovering on fast frames and ignoring
  bad frame times. Bot harness: 10 games, 0 audit failures, 0 repairs.
  All PASS.
- Bug found by the bot, fixed in this block: the gaps surge cleared the
  bottom cell after shifting the board up, leaving the whole gap column
  suspended in mid-air (floating hexes). Gap columns now skip the shift
  entirely, so the stack stands and the board stays compact. A smoke
  regression test surges gaps 10 times over a filled board and asserts
  the audit stays clean.
## Block 12 — Visual polish: shockwave rings, confetti, chain fire (v0.12.0)

- Shockwave rings (backlog #30): a 5+ match fires an expanding neon ring
  in the matched colour from the cleared group's centre (radius scales
  with match size); 6+ matches add a second, wider white ring, and an
  all-clear fires a big cyan ring. Rings live in `S.rings` (capped at 8),
  expand and fade over 0.55s, and skip `shadowBlur` in low-FX mode.
- Level-up confetti (backlog #31): `spawnConfetti()` rains ~70 fluttering
  neon shards down the board on every level-up — each shard has its own
  fall speed, spin, sway phase and colour from the game palette, and
  expires after ~2.4s or off the bottom of the canvas.
- Chain fire (backlog #33): a x3+ cascade ignites the board — a burst of
  rising flame particles at the clear plus a 1.2s burn during which
  flames keep rising from the bottom of the board (rate scales with the
  chain) and the board edge glows pulsing orange. Flames live in the
  shared particle array with `flame:true` so the FPS-guard caps still
  apply; they render as glowing circles and rise (buoyant) instead of
  falling like sparks. x2 cascades stay fire-free.
- Tests: smoke harness grew to 341 checks (22 new) — ring on 5-match,
  double ring on 6-match, no ring on 3-match, ring fade/expiry/cap,
  confetti burst on level-up with fall + expiry, chain-fire ignition,
  flame spawning/ rising / burnout, no fire on x2, and a new-game reset
  of all three FX systems. Bot harness still 12/12 (10 games, 0 audit
  failures, 0 repairs).

## Block 13 — README + screenshots + repo polish (v0.13.0)

- README screenshots (backlog #55): real gameplay shots, not mockups —
  `tests/screenshot.js` drives the game in a headless Chromium shell
  (playwright-core + the cached `chromium_headless_shell`, falling back
  to the system Chromium), clicks PLAY, hard-drops ten trios, and saves
  `docs/screenshot-menu.png` and `docs/screenshot-gameplay.png` (a
  mid-run board: score 120, a bomb hex on the board, tide bar and
  specials strip live, zero console errors). `tests/gif.py` stitches 12
  frames from the same run into `docs/gameplay.gif` (480px, 1.3MB).
  The README now has a Screenshots section with all three images and
  the Testing section documents how to regenerate them. A `.gitignore`
  keeps the scratch frame dir and `node_modules/` out of the repo.
- Devlog (backlog #56): this file, kept updated every block — Block 13
  entry included, with the capture setup and the numbers.
- Issue templates + CONTRIBUTING (backlog #58): `.github/ISSUE_TEMPLATE/`
  gains a bug report (repro steps, environment, game version, daily
  seed) and a feature request (idea, why it fits, how it could work),
  plus a `config.yml` linking to the live game. New `CONTRIBUTING.md`
  covers playing first, filing an issue before big changes, the test
  commands (`node --check`, smoke, bot, screenshot regeneration), and
  the vanilla-JS code style. CI's required-files check now also asserts
  the screenshots, `CONTRIBUTING.md` and both templates exist.
- Tests: smoke harness grew to 351 checks (10 new) — README references
  all three screenshots, the PNG/GIF files exist and are non-empty, the
  GIF has a real GIF89a header, both issue templates carry their
  front-matter + section headers, CONTRIBUTING names the test commands,
  and the version pins moved to 0.13.0. Bot harness still 12/12.
  The screenshot script itself is a test of sorts: it failed loudly on
  any page error, and the run that produced the shipped images reported
  none.

## Block 14 — GitHub Pages verify + perf + accessibility (v0.14.0)

- Settings toggles (backlog #45): three toggles on the menu — SCREEN
  SHAKE, REDUCE MOTION, MUSIC — as buttons with `aria-pressed`, persisted
  as one JSON object under `nhx-settings`. Shake-off zeroes the shake
  value; reduce-motion also skips hex pops, shockwave rings, confetti
  bursts and the chain-fire burn (scoring and banners still work), steadies
  the tide waterline pulse and the banner pop-in, and adds a
  `body.reduced-motion` class that switches the CSS animations off. It
  defaults to the OS `prefers-reduced-motion` setting when nothing was
  saved. Music-off stops the loop (and `startMusic` now refuses to start
  one while music is off). The toggles sit in the menu's Up/Down keyboard
  cycle, so keyboard-only players can reach them.
- Accessibility pass (backlog #51): hidden overlays now get
  `aria-hidden="true"` (visible one `false`) in `showOnly`, all four
  overlays carry `aria-modal="true"`, the tide bar is a real
  `role="progressbar"` with a live `aria-valuenow`, mute/pause expose
  `aria-pressed`, the canvas label carries the live run status (score,
  level, lives, tide percent) and the board gets an `aria-describedby`
  controls summary. Pause/resume announce through the live region.
  Contrast: muted text lightened `#9d8fd0` → `#b3a6dd` in CSS and the
  canvas NEXT/LEVEL labels; volume sliders get a `:focus-visible` ring.
- Live-site smoke test (backlog #59): new `tests/live-smoke.js` reads the
  expected version from `game.js`, polls the live Pages URL up to 3 minutes
  for the new version, checks index/game.js/style.css over HTTP, then
  drives the live site in a headless browser (menu version, settings
  toggles + tide progressbar present, PLAY starts a run, five hard drops,
  zero console/page errors). CI gains a `live-smoke` job (`needs: deploy`)
  that installs a headless Chromium and runs it after every deploy, and
  CONTRIBUTING documents the command.
- Tests: smoke harness grew to 391 checks (40 new) — settings defaults,
  persistence, shake/reduce-motion/music behaviour, keyboard nav through
  the six-button menu cycle (the old 3-button wrap test updated),
  aria-hidden/progressbar/aria-pressed/canvas-label checks, CSS contrast
  and reduced-motion rules, and live-smoke + CI-job static checks. The
  harness stub now records element attributes so aria state is testable.
  Bot harness still 12/12. Headless render check on the local files:
  menu v0.14.0, toggles synced, reduce-motion toggle flips the body class
  and a run still plays (6 trios, score 82, shake 0, pops 0, zero errors).

## Block 15 — Extra modes: blitz, endless, zen (v0.15.0)

- Extra modes (backlog #20/#21/#22): a four-button mode selector on the
  menu (CLASSIC / BLITZ 60s / ENDLESS / ZEN) with a mode line describing
  the selected mode and its best. The selection persists in localStorage
  (`nhx-mode`) and the buttons sit at the end of the menu's Up/Down
  keyboard cycle, after the music toggle.
- Blitz 60s: a 60-second countdown replaces the lives counter in the HUD
  (TIME 1:00 → 0:00), a soft tick sounds once a second in the last 10
  seconds, and zero ends the run with a ⏱ TIME UP! badge on the game-over
  screen. Lives still apply inside the minute.
- Endless: no lives — a top-out ends the run immediately instead of
  costing a life. Zen: no tide (nothing rises, nothing surges) and no
  life lost on a top-out, so the run only ends when the player quits.
- Per-mode bests (`nhx-best-<mode>`) shown on the menu mode line and the
  game-over stats (MODE + MODE BEST rows); the top-5 table records the
  mode on each entry and shows it next to the rank. The canvas level line
  and the board's aria-label name the mode too, and the how-to overlay
  explains all three modes.
- Tests: smoke harness grew to 444 checks (53 new) — mode defaults and
  persistence, button sync + aria-pressed, blitz countdown / HUD / tick /
  TIME UP badge / mode best, endless top-out ends the run, zen tide stays
  0 and top-outs cost nothing, classic behaviour untouched, per-mode
  bests stay separate, top-5 entries record the mode, keyboard nav
  through the new 10-button menu cycle (the Block 8 wrap test updated
  for the four extra buttons), and mode HTML/CSS static checks. Two
  first-run failures were test-expectation bugs (an earlier section had
  already saved a classic best of 16654 and a top-5 entry) — fixed in
  the tests, game code untouched. Bot harness still 12/12. Headless
  render check on the local files: menu v0.15.0, mode buttons synced,
  blitz run counts down 1:00 → 0:58 with score 48 after 5 hard drops,
  zen run tide 0 with ∞ lives, endless run starts with ∞ lives, zero
  console errors.

## Block 16 — Combo timer + tide powerups (v0.16.0)
- Combo timer (#4): clears within 5 seconds of each other keep a combo
  going — each step adds +25% to that lock's clear points, capped at ×2.
  The HUD strip shows 🔥 COMBO ×N with the seconds left to keep it alive,
  a COMBO ×N +bonus float pops on each combo clear, and the best combo is
  recorded on the game-over stats screen.
- Slow-tide powerup (#8): a new ⏳ hex (sky blue) drops in trios, rarer
  than bombs and rainbows. When a match clears next to it, the tide
  freezes for 15 seconds — no rise, no surge warning, no surge — and the
  waterline turns icy blue while the freeze lasts. A pending double surge
  waits out the freeze instead of firing into it. The active freeze shows
  in the HUD strip with a countdown (⏳ SLOW TIDE 15s).
- Tide-break powerup (#9): a new ✂ hex (orange) drops in trios, also rare.
  When a match clears next to it, the whole bottom two rows clear away
  (25 pts per hex, × chain), and any bomb the break exposes detonates
  afterwards. Both new specials never match by colour, never carry elite
  flags, and show their counts in the HUD strip and in the next-trio
  preview; the how-to overlay explains all three mechanics.
- Tests: smoke harness grew to 488 checks (40 new) — combo multiplier
  ladder, exact combo payouts (300 / 375 / 450), 5s expiry and restart,
  strip countdown, best combo on the game-over screen; slow-tide trigger,
  15s freeze, tide held at 50 and no surge at 99% while frozen, double
  surge delayed by the freeze, tide rising again after expiry, slow hexes
  never matching; tide-break trigger, exact 400 payout, victims counted,
  distant break stays put; slow/break drops in trios, HUD counts, how-to
  and stats static checks. Two pre-existing checks needed updating for the
  new mechanics (the armored second-hit total is now 575 with its combo
  bonus; board cells are valid 0-10). Bot harness still 12/12, same-seed
  determinism holds. Headless render check on the local files: menu
  v0.16.0, 10-trio spread run plays (score 490, 3 lives), combo ×2 → ×3,
  slow tide freezes (tide held at 50), tide break clears its victims,
  zero console errors.

## Block 18 — Playtest pass 2 + balance (v0.18.0)
- Tide-freeze pickup (#18): a rare ❄ freeze hex now drops in trios (2% +
  level, capped at 5%). Unlike the slow-tide hex it does not fire at once —
  a match clearing next to it banks it into a held stock of up to 3, and
  the player spends one with **F** (or the ❄ touch button) to freeze the
  tide for 10s. It reuses the slow-tide freeze clock, so a frozen tide
  holds the surge, the warnings and any pending double surge; spending
  while a slow freeze is running extends rather than shortens it. The HUD
  strip shows the held stock with its key hint, the next trio previews ❄,
  the touch button is disabled with an empty stock, and the game-over
  screen records freezes collected / used. New pickup + spend SFX, how-to
  and footer updated.
- Difficulty curve tuning (#27): the Block 18 playtest pass retuned the
  ramp — level 1 is gentler (700ms falls, 84s to the first surge) so new
  players can learn the board, and the late game is harder (200ms fall
  floor, 34s surges from level 11) so long runs keep pressing. Level-up
  stays at 6 clears per level. The surge countdown follows the new rate
  (1:24 at tide 0, level 1).
- Run stats tracking (#25): lifetime totals across every run persist in
  localStorage under nhx-lifetime (runs, hexes cleared, matches, best
  chain, best score, time played, freezes used, surges) with corrupt /
  partial data falling back to zeros. The menu shows a LIFETIME totals
  line, and the game-over screen adds lifetime runs / hexes / best chain
  rows.
- Pause menu restart + quit (#38): built in Block 7 but never checked off
  — verified in this playtest pass (RESTART starts a fresh run with score
  0 and 3 lives, QUIT returns to the menu, both reachable by keyboard)
  and marked done.
- Tests: smoke harness grew to 571 checks (46 new) — freeze never
  matches, banking + stock cap, spend + 10s freeze + tide hold + lapse,
  F key, paused refusal, HUD strip / NEXT preview / touch-button state,
  freeze drops, the full fall + tide curve ladders, lifetime defaults /
  corrupt-data recovery / merge across two runs / menu line, pause
  RESTART behaviour, and static HTML + CSS checks. Two pre-existing
  checks needed updating for the retune (surge countdown 1:18 → 1:24,
  0:07 → 0:08; level-2 fall is 650ms, under the new 700ms level-1 base).
  Bot harness still 14/14 — but the old "bot survived a surge" check had
  to go: the bot advances only 50ms of run time per lock, so one slow-tide
  freeze (15s = 300 locks) chains across most of a game and the tide
  almost never reaches 100 in bot time. It is replaced by a deterministic
  forced-surge test (tide parked at 99 surges within 4s, tide resets to
  25, slag lands). Same-seed determinism holds. Headless render check on
  the local files: menu v0.18.0, lifetime line present, freeze button
  present, freeze pickup banks in the browser, F spends it (❄ TIDE FROZEN
  10s in the strip, button disables), pause RESTART starts a fresh run,
  zero console errors.

## Block 17 — Audio polish + music variation (v0.17.0)
- Audio settings panel (#37): the menu gains a bordered AUDIO panel with
  separate MUSIC and SFX toggles, a music style cycler and the volume
  slider. The SFX toggle silences sound effects only — the music keeps
  playing, and the master mute still silences everything. Both toggles
  persist in nhx-settings, and the pause overlay gets its own SFX toggle
  (between RESUME and RESTART) so effects can be killed mid-run. All three
  new controls sit in the keyboard Up/Down cycle with aria-pressed state.
- Music variation: three styles — PULSE (the original A-minor line),
  DRIFT (slower, dreamy, half-note bass with rests) and DRIVE (faster,
  off-beat square-wave bass, hat on every step). Each has its own 16-step
  bass line walking a chord progression across two bars, its own arpeggio
  scale, tempo multiplier and hat pattern. The style is persisted, cycles
  from the menu button, and a live switch mid-run restarts the loop at the
  top of the new bar. The tempo floor drops from 300ms to 240ms so DRIVE
  keeps its headroom at high levels.
- Surge countdown (#19): the HUD now shows SURGE M:SS under the tide bar,
  counting down to the next surge from the real tide rate; a pending
  double surge counts down to its scheduled time instead, a frozen tide
  reads ❄ TIDE FROZEN, and zen mode shows nothing. The how-to explains
  the audio panel and the countdown.
- Tests: smoke harness grew to 525 checks (37 new) — SFX toggle persists
  and updates both buttons, SFX off silences effects while music plays on,
  master mute still wins, the three styles' tempos (DRIFT 644 / PULSE 460
  / DRIVE 359 at level 1), style cycling and wrap, unknown styles rejected,
  live style switch restarts the loop, keyboard nav to the style button and
  both SFX toggles, the pause SFX toggle, surge countdown values at tide 0
  (1:18) and 90 (0:07), frozen / pending-double / zen states, and static
  HTML + CSS checks. Two pre-existing checks needed updating (the tempo
  floor is now 240ms; the pause cycle gained the SFX step). Bot harness
  still 12/12, same-seed determinism holds. Headless render check on the
  local files: menu v0.17.0, audio panel present, run plays (score 76,
  tide 21.2%, surge countdown ticking 1:18 → 1:01), pause SFX flips,
  style cycles PULSE → DRIFT → DRIVE, zero console errors.

## Block 19 — Favicon / meta / PWA-lite polish (v0.19.0)
- Favicon + meta + social preview (#53): the hex logo is now a full icon
  set — `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180×180)
  and a `maskable-512.png` with the logo shrunk into the maskable safe
  zone — all drawn from `favicon.svg` by `tests/make-icons.py` (Pillow,
  no external assets). The 1200×630 `docs/social-preview.png` shows the
  logo, title and tagline; `index.html` now carries `og:image` (+ width,
  height, alt) and a `summary_large_image` Twitter card with image.
- PWA manifest (#54): `manifest.webmanifest` names the game (short name
  Hexfall), standalone display, portrait orientation, `#0b0620` theme /
  background, start URL `.`, and the 192 / 512 / maskable icons; linked
  from `index.html` next to the new apple-touch-icon link.
- Offline support (#50): `sw.js` precaches the whole game (index, CSS,
  JS, manifest, favicon, all icons) under a versioned cache
  (`neon-hexfall-v0.19.0`), serves same-origin GETs cache-first with a
  network fallback, ignores the query string so `?seed=` share links work
  offline, and deletes old caches on activate (`skipWaiting` +
  `clients.claim`). The game registers it on http/https only — file://
  and no-SW environments silently no-op — via `registerServiceWorker()`,
  which takes an injectable navigator so the harness can test it (Node 24
  forbids assigning `global.navigator`).
- Also fixed the Block 18 nit: the `game.js` header comment still said
  v0.17.0 / Block 17; it now says v0.19.0 / Block 19.
- Tests: smoke harness grew to 595 checks (24 new) — manifest parses and
  names the game, display / start URL / colours, 192 + 512 + maskable
  icons all exist on disk, each PNG is a real PNG at the promised size,
  social preview is 1200×630, og/twitter/apple-touch/manifest tags in the
  HTML, the worker's versioned cache name, precache list, skipWaiting /
  claim / old-cache cleanup, same-origin GET-only fetch guard, and the
  registration paths (registers `sw.js` on https, refuses without SW
  support, on file: and with no protocol). Bot harness still 14/14.
  Headless render check over local HTTP: menu v0.19.0, manifest fetches
  (4 icons), service worker registered and active, 6 hard drops score 82
  with 3 lives, then offline reload serves v0.19.0 from the cache
  (game.js 200), zero console errors.

## Block 20 — Launch copy drafts (v0.20.0)

- How-to overlay on first visit (backlog #40): the game now opens the
  how-to guide instead of the menu the first time it loads, so a new
  player learns the rules before their first run. Dismissing it any
  way — GOT IT — PLAY, BACK TO MENU, Escape, or Enter — records the
  visit under `nhx-seen-howto`, so returning players go straight to
  the menu. Reopening the guide from the menu's HOW TO PLAY button
  still works and never clears the flag. A short note inside the
  guide says it opens on first visit and where to find it again.
- Release notes v1.0, draft (backlog #57): `docs/release-notes-v1.0.md`
  is ready for the real release — what the game is, every feature
  (core loop, scoring depth, specials, elites, tide, four modes,
  daily challenge, ranks, meta, game feel, PWA), controls, tech, and
  links. Marked DRAFT at the top; the version tag, changelog freeze
  and final deploy check still land in Block 23.
- Tests: smoke harness grew to 616 checks (21 new) — first-visit boot
  shows the how-to with GOT IT focused, dismiss-to-menu / GOT IT /
  Escape / Enter all record the visit, a re-boot with the flag seeded
  lands on the menu with PLAY focused, a fresh boot shows the guide
  again, plus static checks for the in-overlay note and the draft
  release notes. Bot harness still 14/14.

## Block 21 — Final bugfix + cross-browser check (v0.21.0)

- Save/restore run state (backlog #49): a run in progress is banked
  to localStorage under `nhx-save` after every locked trio, on pause,
  and when the tab hides or closes, so a refresh or a closed tab never
  loses the run. The menu shows a teal CONTINUE button — `▶ CONTINUE
  — LV n · score PTS · MODE` — while a valid save waits; PLAY starts
  fresh, and game over / quit abandon the run and clear the save.
  The save carries the whole run: board + armor/lock/star flags, the
  falling piece, the queued trio + elite flags, score/level/lives/
  tide, combo, slow-tide clock, banked freezes, active effects,
  pending double surge, blitz clock — and the seeded rng state, so
  the daily-seed trio stream continues exactly where it stopped
  (`mulberry32` now exposes getState/setState). Corrupt, wrong-version
  or wrong-shaped saves are rejected and cleared, never resumed; a
  restored board still goes through the #48 audit + self-repair.
  The how-to explains the autosave, and CONTINUE joins the menu
  keyboard cycle (right after PLAY) only while a save waits.
- Cross-browser check (backlog #52): new `tests/cross-browser.js`
  drives the real game in headless Chromium 159 and headless Firefox
  159 over local HTTP — menu version, first-visit how-to, a run that
  plays and scores, zero console/page errors, and a reload that
  offers CONTINUE and resumes the exact score. Both browsers 11/11
  PASS. Findings doc: `docs/cross-browser.md` (static audit + Safari
  checklist, since Safari can't run on Linux).
- Real bug found live by the Firefox run: `AudioSys.resume()` ignored
  the promise `ctx.resume()` returns. In headless Firefox the context
  stays suspended, the promise stays pending, and a navigation rejects
  it — `InvalidStateError: Navigated away from page` — as an unhandled
  rejection in the console. It fired at reload in about half the
  Firefox runs (Chromium clean). Bisected with throwaway probes: not
  the service worker (reproduced with `sw.js` blocked), not the
  screenshot, not the music loop — the pending resume promise.
  Fixed by catching the rejection like the SW registration already
  does; `tone()` was already try/catch-guarded. Firefox then passed
  clean 3× in a row plus the full both-browser run.
- Tests: smoke harness grew to 665 checks (49 new) — save/load/
  resume exactness (board, elite flags, piece, next trio, blitz
  clock, combo, freezes, active effects), rng-stream continuation,
  lock/pause banking, game-over/quit/new-game clearing, corrupt-save
  rejection (garbage, wrong version, wrong board shape, bad score),
  re-boot CONTINUE button + label + keyboard nav + Enter resume,
  the resume-promise catch, and the static cross-browser audit
  (ES5-style code, webkit prefix, 100vh fallback). Bot harness
  still 14/14, determinism holds.
