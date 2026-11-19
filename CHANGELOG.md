# Changelog

All notable changes to Neon Hexfall. The v1.0.0 release ships all 60 backlog
items from the 12-hour sprint (Blocks 1–23), plus the core engine from Block 1.

## [1.0.0] — 2026-11-19

The first full release. Play it at https://namdev-muse.github.io/neon-hexfall/

### Release

- Version 1.0.0 everywhere (game, menu footer, service-worker cache,
  screenshots, tests) and the `v1.0.0` GitHub release tag.
- Release notes finalized (`docs/release-notes-v1.0.md`) and this changelog.

### Balance

- Wide-match upgrade re-tuned: pairs of 2 hexes now clear at
  50 / 60 / 70 points per hex for 1 / 2 / 3 picks (was 50 / 75 / 100).
  At max picks a pair used to pay the same 100 points per hex as a real
  3+ match while triggering far more often, which let the auto-play bot
  reach ~2.5M points per game; pairs now always pay less than a real
  match, so the upgrade stays a tradeoff — easier clears, weaker payout.
- Difficulty curve tuned (Block 18): level-1 fall 700ms and an 84s first
  surge; level 11+ falls at the 200ms floor with 34s surges.

### Matching & scoring

- Tri-hex pieces, flood-fill matching of 3+ connected hexes, per-column
  gravity, chain cascades with a `CHAIN ×N` banner and per-cascade score
  popups.
- Match-size bonuses: 4 hexes +200, 5 +400, 6+ +800 (× chain).
- All-clear bonus: emptying the board pays +1000 × level.
- Combo timer: clears within 5s keep a combo going, +25% per step to ×2.
- Score milestones / rank titles: Rookie → Hex Legend (8 rungs), with a
  `RANK UP!` banner that queues behind the live chain banner.

### Powerups & hexes

- Bomb hexes: detonate beside a match, 50 pts per blasted hex, and chain
  into nearby bombs.
- Rainbow hexes: wildcards that bridge colours; 3+ rainbows match alone.
- Slow-tide hexes: freeze the tide for 15s; tide-break hexes clear the
  bottom 2 rows (25 pts/hex × chain) and can expose bombs for a second
  detonation.
- Powerup drop system: specials appear in trios with a level-scaled
  chance and a pity timer every 12 trios.
- Powerup HUD indicators: live bomb/rainbow counts, next-trio specials,
  and active timed-effect countdowns.
- Armored hexes (2 hits to clear), locked hexes (break free beside a
  clear, +50 × chain), and bonus star hexes (+250 × chain).
- Tide-freeze pickups: matched FREEZE hexes bank (up to 3); press `F`
  or the ❄ button to freeze the tide for 10s.

### The tide (signature mechanic)

- Rising tide meter; surges push slag rows up from the bottom.
- Double surge (level 4+, 20% + 10%/level, capped 60%) with a second
  surge 2.5s later that never chains.
- Slag patterns: full rows early, gapped rows from level 3, 3-column
  rises from level 5, all seeded.
- Tide warning: pulsing red waterline, flashing HUD tide bar, and a
  repeating tick in the last 20%, plus a surge-warning alarm at 80%.
- Surge countdown display (`SURGE M:SS` under the tide bar, from the
  real tide rate; pending double surges count down too).

### Modes & meta

- Classic (3 lives, rising tide), Blitz 60s (one-minute score attack),
  Endless (one top-out ends it), Zen (no tide, no lives lost) — each mode
  keeps its own best score.
- Daily challenge: everyone plays the same trios each day, with a
  per-seed daily best and a shareable `?seed=` link.
- Level-up upgrade draft: every 6 clears, pick 1 of 3 — slower tide
  (×1.25 per pick, max ×3), +1 life (max 5), wider matches (pairs clear
  at 50 / 60 / 70 pts per hex); mode-aware offers, with banked freeze /
  bottom-rows break / +500 points as fallbacks. Picks show in the HUD
  and game-over stats and survive a refresh via the autosave.
- Run stats: hexes cleared, matches, best chain, accuracy, plus lifetime
  totals (runs, hexes, matches, best chain, best score, time, freezes,
  surges) on the menu and game-over screen.
- Local top-5 high-score table and a game-over stats screen.

### Juice & game feel

- Hit-stop micro freeze on big clears (40–120ms by size), hex pop
  animations, screen shake scaled to clear size, shockwave rings on 5+
  matches, level-up confetti, and chain fire at ×3 cascades.
- Settings: screen-shake, reduce-motion, and music toggles on the menu,
  persisted and wired into every effect.

### Audio

- Web Audio synth SFX: powerup, bomb, surge warning, all-clear, big
  match, crack, and more — plus a music loop in three styles (Pulse /
  Drift / Drive) that intensifies with chain and level.
- Volume slider (menu + pause overlay), separate music/SFX toggles,
  music-style cycler, all persisted.

### UI & controls

- Start / pause / game-over screens, HUD with score, best, level, lives,
  chain, tide, and per-mode timers; high score in localStorage.
- Full keyboard play: arrows + Enter + Escape navigate every overlay;
  `P` pause, `M` mute, `F` spend a freeze, `1`/`2`/`3` pick draft cards.
- Touch controls: swipe to move, drag down for soft drop, fast flick
  for hard drop, tap board thirds to move/rotate, hold-to-repeat
  buttons, no-scroll page.
- Small-phone responsive layout: safe-area insets, 380px and short-screen
  breakpoints, 56px thumb targets.
- First-visit how-to overlay (dismiss once, never nags again).
- Pause menu with restart + quit-to-menu, both keyboard-reachable.

### Tech & quality

- Save/restore run state: runs bank to `nhx-save` after every lock,
  pause, and tab hide/close; CONTINUE on the menu restores the exact
  run, including the seeded RNG stream. Corrupt saves are rejected.
- Offline support: versioned service-worker cache (`sw.js`), cache-first
  same-origin GETs, `?seed=` links work offline.
- PWA manifest (installable, standalone), favicon + icon set
  (192/512/apple-touch/maskable), and a 1200×630 social preview image.
- Accessibility pass: aria labels, aria-modal overlays, tide
  progressbar, aria-pressed toggles, live canvas label, board
  description, focus rings, and a contrast fix for muted text.
- FPS guard: frame-time EMA drops shadowBlur and halves particles
  under load.
- Board-consistency audit + self-repair every second, with NaN guards
  and stuck-piece replacement.
- Auto-play bot harness (`tests/bot.js`): greedy placement bot, 10 full
  games per run, board audit after every lock, determinism check — it
  caught and fixed real bugs (gaps-surge floating hexes, draft-break
  floating hexes, the wide-match balance issue above).
- Cross-browser check: headless Chromium 159 + Firefox 159, 11 checks
  each, zero console errors; Safari covered by a static checklist in
  `docs/cross-browser.md`.
- Live-site smoke test (`tests/live-smoke.js`) runs after every deploy
  via CI, polling until the new version is live.

### Docs & launch

- README with gameplay screenshot, menu screenshot, and animated GIF —
  real headless-browser captures, regenerable with `tests/screenshot.js`
  and `tests/gif.py`.
- Devlog (`docs/devlog.md`) kept through all 23 blocks; issue templates
  and `CONTRIBUTING.md`; v1.0 release notes in
  `docs/release-notes-v1.0.md`.
