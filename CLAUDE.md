# Wenceslas: notes for Claude

## Ideas for next time
Candidates we discussed (as of 2026-11-23), roughly in the order to pick them up.

1. **Check that key rebinds survive a reload.** The owner said they'd test this by hand. If they don't survive, look at
   `setKeyBindings` and `keyBindings` in `js/highscores.js` (stored under `wenceslas.keys.v1`, read through
   `cleanBindings` in `js/keys.js`).
2. **Grow the `noUncheckedIndexedAccess` slice** (`tsconfig.index.json`). `input.js`, `gamepad.js` and `touch.js` can't
   join yet because they import `world.js` (13 errors) and `sprites.js` (4 errors). Fix `sprites.js` first (small), then
   `world.js` (big), then add files to the list. Fix by restructuring, never with `!` or casts.
3. **Shrink the test exclude list** in `tests/tsconfig.json`. `audio.mjs` and `music.mjs` are the best candidates: the
   real errors are an un-narrowed union (`MusicPlan` in audio, `Cell` in music), and the rest is the fake
   `AudioContext` and replaced timers, which is the hard part. `boot`, `screens`, `snapshot` and `smoke` fake the DOM
   canvas.
4. **Gamepad rebinding.** The keys editor (Options, then Keys, in `js/screens.js`) is keyboard-only.
5. **A first-night hint for the swing keys**, so keyboard players learn that the arrows and numeric keypad swing. Keep
   the how-to text free of spoilers (see the instructions-keep-spoilers-secret memory).
6. **typescript-eslint's type-aware `no-unsafe-*` rules**, once it supports TypeScript 7.1. It can't run on 7.0.2 (no JS
   compiler API), which is why `eslint.config.js` uses eslint-plugin-jsdoc plus core rules.

## Reminders
- `npm test` runs the three type-check passes, lint, and every test. Run it before calling work done.
- Commit when asked; push only when asked.
