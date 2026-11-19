# Neon Hexfall — v1.0 release notes (DRAFT)

> **DRAFT — prepared in Block 20 of the sprint for the real v1.0 release
> (Block 23).** Do not publish as the release yet: the version tag,
> changelog freeze and final deploy check still land in Block 23.

## What it is

Neon Hexfall is a fast falling-hex arcade puzzle. Tri-hex pieces fall
from the top of an 8×11 board — match 3 or more connected hexes of one
colour to clear them, chain cascades for multipliers, and outrun the
rising tide before the slag swallows the board.

Play it free in the browser, no install needed:
https://namdev-muse.github.io/neon-hexfall/

## What's in v1.0

- **Core loop:** tri-hex pieces, move / rotate / soft drop / hard drop,
  flood-fill matching, per-column gravity, chain cascades with a
  `CHAIN ×N` banner and per-cascade score popups.
- **Scoring depth:** match-size bonuses (4 hexes +200, 5 +400, 6+ +800),
  a 5-second combo timer that adds up to double points, and a big
  all-clear bonus for emptying the board.
- **Special hexes:** bomb hexes that detonate beside a match (and chain
  into nearby bombs), rainbow wildcards, slow-tide and tide-break
  powerups, and bankable tide freezes — hold up to 3, spend one with
  `F` exactly when the tide is about to crest.
- **Elite hexes (level 2+):** armored hexes that take two hits, locked
  hexes that only break free beside a clear, and star hexes worth
  +250 on clear.
- **The tide:** a rising meter that surges slag rows up from the
  bottom — full rows early, gapped rows and slag columns at higher
  levels, double surges from level 4, a pulsing red waterline and
  warning tick in the last 20%, and a live surge countdown under the
  tide bar.
- **Four modes:** Classic (3 lives, rising tide), Blitz 60s (one-minute
  score attack), Endless (one top-out ends it), and Zen (no tide, no
  lives lost). Each mode keeps its own best score.
- **Daily challenge:** everyone plays the same trios each day — beat
  the daily best, share your seed link to challenge a friend to the
  same board, and climb the ranks from Rookie to Hex Legend.
- **Meta:** local top-5 score table, lifetime run stats, game-over
  stats screen, and a first-visit how-to guide that opens
  automatically for new players. Your run is saved automatically —
  refresh or close the tab and CONTINUE on the menu picks it back up
  exactly where it stopped.
- **Feel:** hit-stop on big clears, hex pop animations, screen shake
  scaled to clear size, shockwave rings on 5+ matches, level-up
  confetti, chain fire at ×3 cascades — plus a Web Audio synth
  soundtrack in three styles (Pulse / Drift / Drive) that intensifies
  with your chain and level.
- **Access anywhere:** installable PWA with an offline service worker,
  full keyboard play, touch swipe + hold-to-repeat buttons, responsive
  small-phone layout, screen-reader labels and a reduce-motion
  setting.

## Controls

- ← → move · ↑ rotate · ↓ soft drop · Space hard drop
- F spend a banked tide freeze · P pause · M mute
- Touch: drag to move, flick down to hard-drop, tap the board thirds
  to move / rotate; on-screen buttons for everything else.

## Tech

Vanilla HTML / CSS / JS, Canvas 2D, Web Audio API — no build step,
no dependencies at runtime. Verified in headless Chromium and
Firefox (menu, live play, zero console errors, save/restore across a
reload); Safari covered by a static checklist in
`docs/cross-browser.md`. Source, devlog and issue templates:
https://github.com/namdev-muse/neon-hexfall

## Thanks

Built in a 12-hour sprint, one 30-minute block at a time, with a
bot harness playtesting every build. If the tide gets you, blame the
slag — then beat your best.
