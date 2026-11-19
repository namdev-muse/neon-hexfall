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
