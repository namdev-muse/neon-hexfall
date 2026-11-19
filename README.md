# Neon Hexfall

A fast falling-hex arcade puzzle. Hex trios fall from the top — match **3 or more connected hexes** of the same colour to clear them, chain cascades for big multipliers, and outrun the rising tide.

**Play it live:** https://namdev-muse.github.io/neon-hexfall/

## How to play

- **← →** move the falling trio · **↑** rotate its colours · **↓** soft drop · **Space** hard drop
- **P** pause · **M** mute · touch buttons on mobile, or swipe the board to move, drag down to soft-drop, flick down to hard-drop, tap the left / middle / right of the board to move / rotate
- Menus are fully keyboard-playable: **↑ ↓** move between buttons, **Enter** activates, **Esc** steps back
- Match 3+ connected hexes of one colour to clear them. Clears that cascade after hexes fall count as chains (×2, ×3, …) and multiply your score.
- The **tide** rises as you play. When it fills, a row of grey **slag** surges up from the bottom. Slag never matches — clear it by matching hexes next to it.
- If the stack reaches the top you lose a life and the tide breaks the top rows away. Lose all 3 lives and the run ends.
- Every 6 clears you level up: trios fall faster and the tide rises faster.
- Everyone plays the same trio sequence each day (daily seed, shown on the menu).
- Daily challenge: each seed has its own daily best, shown on the menu and the game-over screen.
- Rank titles: climb from Rookie to Hex Legend as your score grows; rank-ups flash in-game.
- Shareable seeds: copy a link from the menu or the game-over screen and anyone opening it plays the exact same trio sequence.
- Local top-5 high-score table on the menu and the game-over screen (new entries highlighted, with a ★ TOP 5 ★ badge).
- Game-over stats screen: score, best, daily best, rank, level, time, hexes cleared, matches, best chain, biggest match, all clears, bombs, rainbows, and accuracy (hexes cleared per trio).
- Powerup HUD indicators: live bomb / rainbow counts on the board, specials in the next trio, and countdowns for active timed effects.

## Features

- Falling tri-hex pieces with rotate / soft drop / hard drop and a ghost landing preview
- Match-3+ flood-fill clears with gravity cascades and chain multipliers
- Chain combo display: big CHAIN ×N banner, per-cascade score popups at the cleared group, gold chain value in the HUD
- Match-size bonuses: 4-hex matches pay +200, 5 pay +400, 6+ pay +800 (× chain); ALL CLEAR bonus (+1000 × level) for emptying the board
- Powerups: bomb hexes detonate when a match clears next to them (50 pts per blasted hex, chain-detonating nearby bombs); rainbow hexes match any colour; specials drop inside trios (chance grows with level, guaranteed at least every 12 trios)
- Rising tide pressure mechanic with slag surge rows
- 3 lives with tide-break recovery on top-out
- Levels with speed + tide ramp, best score in localStorage
- Neon Canvas 2D visuals: glowing hexes, particles, floating score text, screen shake, tide waterline
- Web Audio synth SFX + bass music loop, mute persisted
- Keyboard, mouse/touch buttons, and swipe/tap controls; pause / game-over screens; screen-reader announcements
- Small-phone responsive layout: safe-area insets, compact short-screen rhythm, thumb-sized touch targets, no pull-to-refresh while swiping the board

## Tech

Vanilla HTML/CSS/JS, Canvas 2D, Web Audio API. No build step, no dependencies. Deployed to GitHub Pages from `main` via GitHub Actions (`.github/workflows/ci-pages.yml` validates syntax and runs the smoke test on every push).

## Testing

- `node tests/smoke.js` — stub-DOM harness: boot, movement, rotation, hard drop, match clears, chain cascades, tide surge, slag crumbling, top-out / lives / game over, pause, mute, level-up, daily challenge / ranks / shareable seed, top-5 table, game-over stats, powerup HUD indicators, touch tap / swipe / flick, keyboard-only menu navigation, responsive CSS checks, and a 2000-step random-input soak with board-consistency checks.
- `node --check game.js` — syntax check (also run by CI).

## Development

This is game #2 in a rolling 12-hour sprint cadence (one complete game every 12 hours). Sprint log: `docs/devlog.md`.

## License

MIT — see [LICENSE](LICENSE).
