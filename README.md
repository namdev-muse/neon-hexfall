# Neon Hexfall

A fast falling-hex arcade puzzle. Hex trios fall from the top — match **3 or more connected hexes** of the same colour to clear them, chain cascades for big multipliers, and outrun the rising tide.

**Play it live:** https://namdev-muse.github.io/neon-hexfall/

## How to play

- **← →** move the falling trio · **↑** rotate its colours · **↓** soft drop · **Space** hard drop
- **P** pause · **M** mute · touch buttons on mobile, or tap the left / middle / right of the board to move / rotate
- Match 3+ connected hexes of one colour to clear them. Clears that cascade after hexes fall count as chains (×2, ×3, …) and multiply your score.
- The **tide** rises as you play. When it fills, a row of grey **slag** surges up from the bottom. Slag never matches — clear it by matching hexes next to it.
- If the stack reaches the top you lose a life and the tide breaks the top rows away. Lose all 3 lives and the run ends.
- Every 6 clears you level up: trios fall faster and the tide rises faster.
- Everyone plays the same trio sequence each day (daily seed, shown on the menu).

## Features

- Falling tri-hex pieces with rotate / soft drop / hard drop and a ghost landing preview
- Match-3+ flood-fill clears with gravity cascades and chain multipliers
- Chain combo display: big CHAIN ×N banner, per-cascade score popups at the cleared group, gold chain value in the HUD
- Match-size bonuses: 4-hex matches pay +200, 5 pay +400, 6+ pay +800 (× chain); ALL CLEAR bonus (+1000 × level) for emptying the board
- Rising tide pressure mechanic with slag surge rows
- 3 lives with tide-break recovery on top-out
- Levels with speed + tide ramp, best score in localStorage
- Neon Canvas 2D visuals: glowing hexes, particles, floating score text, screen shake, tide waterline
- Web Audio synth SFX + bass music loop, mute persisted
- Keyboard, mouse/touch buttons, and tap-to-move controls; pause / game-over screens; screen-reader announcements

## Tech

Vanilla HTML/CSS/JS, Canvas 2D, Web Audio API. No build step, no dependencies. Deployed to GitHub Pages from `main` via GitHub Actions (`.github/workflows/ci-pages.yml` validates syntax and runs the smoke test on every push).

## Testing

- `node tests/smoke.js` — stub-DOM harness: boot, movement, rotation, hard drop, match clears, chain cascades, tide surge, slag crumbling, top-out / lives / game over, pause, mute, level-up, and a 2000-step random-input soak with board-consistency checks.
- `node --check game.js` — syntax check (also run by CI).

## Development

This is game #2 in a rolling 12-hour sprint cadence (one complete game every 12 hours). Sprint log: `docs/devlog.md`.

## License

MIT — see [LICENSE](LICENSE).
