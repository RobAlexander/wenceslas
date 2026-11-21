# Wenceslas

A top-down action game based on *Good King Wenceslas*. Plain JavaScript, no build step:
deploy by copying `index.html` and `js/` to any web server.

## Run locally

    npm run serve        # python3 -m http.server 8000, then open http://localhost:8000

Opening `index.html` straight from disk won't work, because ES modules need a web server.

Optional URL parameters for testing, ignored in normal play:
`?seed=123` (repeatable layouts), `?night=5` (skip the title and start on that night),
`?screen=NAME` (show one screen: `title`, `paused`, `nightEnd`, `gameover`, `ending`, `initials`, `highscores`), `?debug` (shows the seed).

## Controls (PC)

WASD to move, mouse to aim, left-click to swing. Esc or P to pause. F toggles fullscreen.
The game scales to fill the window, keeping 16:9 (with bars if needed).
In menus: W/S or the arrow keys to move, Enter or Space to choose, or just use the mouse.
Initials entry: type letters, or use the arrow keys (or click the arrows on screen); Enter to confirm.

## Development

- `npm test` runs all of the checks below. None of them needs a browser.
- `tests/highscores.mjs`: unit tests for the high score store (ordering, top-10 cut-off, corrupt or unavailable storage).
- `tests/boot.mjs`: boots the real `main.js` under stubbed browser globals and plays the whole flow with synthetic input: title, nights, pause, ending, initials, high scores, game over.
- `tests/screens.mjs`: renders every menu screen to PNG in `screens-out/` (`npm run screens`) and checks their key handling.
- `npm run smoke`: headless simulation of 24 nights with a simple bot, to catch runtime errors in the logic and drawing code.
- `node tests/snapshot.mjs out.png [seed] [night] [seconds]`: renders a gameplay frame to PNG.

`node_modules/`, `tests/` and `package.json` are for development only; don't deploy them.

## Design decisions (beyond the brief)

- Food is delivered when Wenceslas reaches the old man; carrying pages hand over one item at a time.
- Food target is 2 + night number (3 on night 1, 14 on night 12). Robber count and spawn rate rise each night; from night 6 some robbers take two hits.
- Pages are dropped between nights: each night starts with Wenceslas alone.
- Wenceslas has 10 HP and recovers half his maximum between nights. Pages have 2 HP.
- The sword doesn't hurt pages.
- Hard mode resets the score and doubles all points.
- Picking up food: Wenceslas or any page in the line can touch it, and it goes to the first empty-handed page.
- High scores: top 10, easy and hard runs share one table (hard runs are marked), stored in localStorage. Initials are remembered for next time. A run that ends in defeat counts the points earned in the unfinished night.
- Hard mode is unlocked, and stays unlocked, once night 12 has been cleared.
- Quitting from the pause menu doesn't record a score.
- Robbers raise their club (with a red "!") for 0.35 s before a blow lands, so attacks can be read and interrupted.
