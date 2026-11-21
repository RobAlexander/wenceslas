# Wenceslas

A top-down action game based on *Good King Wenceslas*. Plain JavaScript, no build step:
deploy by copying `index.html` and `js/` to any web server.

## Run locally

    npm run serve        # python3 -m http.server 8000, then open http://localhost:8000

Opening `index.html` straight from disk won't work, because ES modules need a web server.

Optional URL parameters for testing: `?seed=123` (repeatable layouts), `?night=5` (start on that night), `?debug` (shows the seed).

## Controls (PC)

WASD to move, mouse to aim, left-click to swing. Esc or P to pause.

## Development

- `npm run smoke`: headless simulation of 24 nights with a simple bot. It catches runtime errors in the logic and drawing code.
- `node tests/snapshot.mjs out.png [seed] [night] [seconds]`: renders a frame to PNG without a browser.

`node_modules/`, `tests/` and `package.json` are for development only; don't deploy them.

## Design decisions (beyond the brief)

- Food is delivered when Wenceslas reaches the old man; carrying pages hand over one item at a time.
- Food target is 2 + night number (3 on night 1, 14 on night 12). Robber count and spawn rate rise each night; from night 6 some robbers take two hits.
- Pages are dropped between nights: each night starts with Wenceslas alone.
- Wenceslas has 10 HP and recovers half his maximum between nights. Pages have 2 HP.
- The sword doesn't hurt pages.
- Hard mode resets the score and doubles all points.
- Picking up food: Wenceslas or any page in the line can touch it, and it goes to the first empty-handed page.
- Robbers raise their club (with a red "!") for 0.35 s before a blow lands, so attacks can be read and interrupted.
