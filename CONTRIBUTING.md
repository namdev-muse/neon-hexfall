# Contributing to Neon Hexfall

Thanks for wanting to help! Neon Hexfall is a small vanilla JS game —
no build step, no dependencies — so contributing is deliberately low-friction.

## Play it first

Play a few runs at https://namdev-muse.github.io/neon-hexfall/ and read
the [README](README.md) and the sprint log in [docs/devlog.md](docs/devlog.md).
Most design decisions (tide, chains, ranks, daily seeds) are explained there.

## How to contribute

1. **File an issue first** for anything bigger than a typo — use the bug
   report or feature request template. Small fixes (typos, README
   wording) can go straight to a pull request.
2. **Fork the repo**, create a branch off `main`, and make your change.
3. **Keep the game playable at all times** — one small, complete change
   per pull request is better than a big one.
4. **Test before you open the PR:**
   - `node --check game.js`
   - `node tests/smoke.js` (stub-DOM harness, must be all green)
   - `node tests/bot.js` (auto-play bot; must stay green if you touched gameplay)
   - If you changed how the game looks or plays, regenerate the README
     screenshots: `node tests/screenshot.js` + `python3 tests/gif.py`
5. **Describe the change** in the PR: what it does, why, and what you
   tested. Screenshots help for visual changes.

## Code style

- Vanilla HTML/CSS/JS, Canvas 2D, Web Audio API. No frameworks, no build step.
- Keep `game.js` readable: short functions, comments where the intent
  isn't obvious, no clever one-liners.
- Game state lives in `S`; anything the tests need is exposed on
  `window.__nhx`. Don't break the smoke harness — extend it instead.
- No credentials, API keys, or tracking in the code, ever.

## What we're looking for

Ideas that fit the game: new hex types, tide variants, modes, juice,
accessibility, and balance. See the backlog in
[docs/devlog.md](docs/devlog.md) and the open issues for direction.

## License

By contributing you agree your work is released under the MIT license —
see [LICENSE](LICENSE).
