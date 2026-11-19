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
