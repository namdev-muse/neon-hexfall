# Neon Hexfall — cross-browser check (Block 21, backlog #52)

How the game is verified across browsers, what was found, and what is
still manual. Re-run anytime with:

```
node tests/cross-browser.js           # Chromium + Firefox
node tests/cross-browser.js chromium  # Chromium only
node tests/cross-browser.js firefox   # Firefox only
```

The runner serves the game over local HTTP (so the service worker and
localStorage behave like the live site), then per browser checks: the
menu loads with the current version, the first-visit how-to opens, a
run plays (6 hard-dropped trios lock and score), zero console/page
errors, and the Block 21 save/restore survives a reload (CONTINUE on
the menu resumes the exact score).

## Results — 2026-11-19, v0.21.0

| Browser | Version | Result |
| --- | --- | --- |
| Chromium (headless shell) | 159.0.8154.6 | 11/11 checks PASS |
| Firefox (headless) | 159.0 | 11/11 checks PASS (after the resume fix below) |
| Safari | — | Not runnable on Linux — static checklist below |

## Finding: Firefox `AudioContext.resume()` rejection (fixed)

The Firefox run tripped intermittently on one console error:

```
[JavaScript Error: "InvalidStateError: Navigated away from page"]
```

It fired at reload time, only in Firefox, only when a run was in
progress, and only sometimes. Bisected with throwaway probe scripts
(not shipped): not the service worker (reproduced with `sw.js`
blocked), not the screenshot step, not the music loop — it is
`AudioSys.resume()`. In headless Firefox the `AudioContext` stays
suspended, so the promise `ctx.resume()` returns stays pending; a
navigation rejects it, and the rejection was unhandled, which Firefox
reports to the console. `tone()` was already try/catch-guarded, but
the `resume()` promise was not.

Fix (`game.js`, `AudioSys.resume`): catch the promise rejection the
same way the service-worker registration already does:

```js
var p = this.ctx.resume();
if (p && typeof p.catch === 'function') p.catch(function () {});
```

After the fix the Firefox check passed clean across repeated runs.
Covered by a smoke check (`tests/smoke.js`, "AudioContext resume
rejection is caught") that feeds `resume()` a rejecting promise and
asserts the catch runs.

## Static audit (checked by `tests/smoke.js`)

- The shipped code is ES5-style on purpose: no arrow functions, no
  optional chaining, no nullish coalescing, no spread — so older
  engines never hit a syntax error on load.
- `AudioContext` is created via `window.AudioContext ||
  window.webkitAudioContext` (older Safari prefix).
- `localStorage` is used only inside try/catch (private mode can throw).
- `requestAnimationFrame` and `matchMedia` are feature-guarded.
- CSS `100dvh` is always preceded by a `100vh` fallback;
  `backdrop-filter` carries its `-webkit-` prefix; flex `gap` is the
  only layout feature newer than Safari 14.1.
- Touch uses Pointer Events (`pointerdown`/`pointermove`/`pointerup`,
  Safari 13+) with a `touchmove` handler marked `{ passive: false }`
  so scrolling can be prevented.
- The service worker registers only on http/https with feature
  detection, and a failed registration is caught.

## Safari — static checklist (no macOS here to run it on)

Safari cannot be driven from this Linux VM, so it is covered by the
audit above plus a manual pass before the v1.0 release (Block 23):

- [ ] Menu, how-to, PLAY and a run load with no console errors
- [ ] Audio starts after the first tap (autoplay gesture rule)
- [ ] `100dvh` layout fills the viewport (fallback `100vh` present)
- [ ] Backdrop blur on overlays renders (prefixed)
- [ ] Touch controls respond; no page scroll while swiping
- [ ] PWA manifest + icons install, service worker caches offline
- [ ] Save/restore: reload mid-run, CONTINUE resumes the score

Known Safari notes: `AudioContext` requires the `webkit` prefix on
Safari < 15 (handled); `backdrop-filter` needs `-webkit-` (handled);
Pointer Events shipped in Safari 13.
