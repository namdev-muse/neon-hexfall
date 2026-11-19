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
