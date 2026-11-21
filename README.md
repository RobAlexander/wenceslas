# Wenceslas

A top-down action game based on *Good King Wenceslas*. Plain JavaScript, no build step:
deploy by copying `index.html`, `js/` and `audio/sfx/` to any web server.

**Play it online: https://robalexander.github.io/wenceslas/**

## Run locally

    npm run serve        # python3 -m http.server 8000, then open http://localhost:8000

Opening `index.html` straight from disk won't work, because ES modules need a web server.

Optional URL parameters for testing, ignored in normal play:
`?seed=123` (repeatable layouts), `?night=5` (skip the title and start on that night),
`?screen=NAME` (show one screen: `title`, `howto`, `paused`, `nightEnd`, `gameover`, `ending`, `nameEntry`, `highscores`), `?debug` (shows the seed).

## Controls

### PC

WASD to move, mouse to aim, left-click to swing. Esc or P to pause. F toggles fullscreen, M mutes (and remembers it).
The game scales to fill the window, keeping 16:9 (with bars if needed).
In menus: W/S or the arrow keys to move, Enter or Space to choose, or just use the mouse.
Name entry (up to 8 characters: letters, digits, space, - and .): type, or use the arrow keys (or click the arrows on screen); Enter to confirm. The last name used is offered again, and typing replaces it.

### Phone or tablet (landscape)
Twin-stick touch controls, shown only once the screen has been touched:
- **Left half:** drag to move. The joystick appears wherever your thumb lands and follows it if you drag further.
- **Right half:** drag to aim, then let go to swing. A quick tap swings at the nearest robber (within 90 pixels).
- **Pause:** the button at the top right. Menus work by tapping.
- The first tap asks the browser for fullscreen and a landscape lock (Android Chrome; iPhone Safari ignores both).
  Held upright, the page asks you to turn the device, and play pauses.

### Gamepad
Left stick or d-pad to move, right stick to aim, RT, RB or A to swing, Start to pause.
In menus: d-pad or left stick to move, A to choose, B to go back, Start to choose (or resume).
This is untested on real hardware; it follows the standard gamepad layout.

The game aims with whichever device you used last, so you can switch between mouse, touch and gamepad at any time.

**How to play** on the title menu explains the goal, shows each sprite with what it does, and lists the controls for
the device you're using.

## Tuning

Every number that changes how the game plays is in one file, [js/tuning.js](js/tuning.js): how many nights there are, how much
food each needs, how enemies build up from night to night, and the speed, health, damage and timing of everything. It's plain
numbers with a comment on each. Edit one, save, and reload the page. Then run `npm test`: it checks the numbers are sane and
names the one that isn't. A few checks are about design intent (for example, archers must stay slower than Wenceslas so he
can run them down), so change those on purpose.

## Dev console

Press the <kbd>`</kbd> key (the one with ~ on it, below Esc) to open a console at the top of the screen. The game waits
while it's open. Type a command and press Enter. Up and Down recall earlier commands, and <kbd>`</kbd> or Esc closes it.

| Command | What it does |
|---|---|
| `night N` / `night N hard` | Start a run on night N (1 to 12) |
| `win` | Finish the current night |
| `spawn robber\|wolf\|archer\|page\|food [count]` | Add things to the current night |
| `kill` | Remove every enemy and arrow, with no points |
| `hp N` | Set Wenceslas's health |
| `god` | Toggle: Wenceslas takes no damage |
| `screen NAME` | Show a screen, like `?screen=` |
| `seed` | Show the random seed |
| `help`, `clear` | List the commands, clear the log |

A run that uses any command that changes the game is marked **DEV** in the corner, and can still enter the high score table.
Commands are defined in `js/main.js`, and the console itself is `js/devconsole.js`.

## Sound and music

Sound starts at the first key press or click, because browsers don't allow it sooner.

- **Effects** are 14 sampled sounds in `audio/sfx/` (mono, 8-bit, 11 kHz WAV, Amiga style).
  Seven are trimmed from the CC0 "50 RPG sound effects" pack by Kenney (via OpenGameArt) and seven are synthesised.
  Every file is listed with its source, author and licence in `CREDITS.md`.
- **Music** is played by a small four-channel tracker-style player (`js/music.js`) on the Web Audio API. There are no
  music files: the song is pattern data in `js/music-data.js`, and the instrument samples (bell, choir, strings, bass,
  percussion) are generated in code as short 8-bit samples with loop points.
- **Adaptive:** each night starts with just the opening phrase, played slowly on a bell. As food is delivered the music
  adds the bass, then strings, then percussion, then a choir, and plays more of the carol until it plays the whole tune.
  Stages change only at phrase boundaries, and without progress the music keeps looping at its current stage.
- **The tune is a draft.** The melody in `js/music-data.js` is a transcription from memory and hasn't been checked
  against a score. To correct it, edit the `lead` strings there; nothing else depends on the notes.

## Development

- `npm test` runs all of the checks below. None of them needs a browser.
- `npm run typecheck` type-checks the game code in `js/` with TypeScript, in strict mode. The game is still plain
  JavaScript with no build step: TypeScript only reads the `.js` files, and types are given in JSDoc comments such as
  `/** @param {number} n */`. It runs first in `npm test` and in the Pages workflow. `tests/` and `tools/` aren't checked.
  Every file in `js/` must pass, including new ones.
- `tests/highscores.mjs`: unit tests for the high score store (ordering, top-10 cut-off, corrupt or unavailable storage).
- `tests/wolves.mjs`: wolf behaviour (circling, crouch then leap, stealing and biting, running off, dropping food when killed).
- `tests/archers.mjs`: archer behaviour (range, the draw telegraph, spread and hit rate, what stops arrows, backing away, being run down).
- `tests/sword.mjs`: the sword's real reach against the arc that's drawn. `tests/tuning.mjs`: sanity checks on every number in `js/tuning.js`.
- `tests/boot.mjs`: boots the real `main.js` under stubbed browser globals and plays the whole flow with synthetic input: title, how to play, nights, pause, ending, name entry, high scores, game over, plus touch gestures, a fake gamepad, the portrait pause and the dev console.
- `tests/gamepad.mjs`: unit tests for the gamepad module with a fake pad (deadzones, press-only swings, menu repeat).
- `tests/screens.mjs`: renders every menu screen to PNG in `screens-out/` (`npm run screens`) and checks their key handling.
- `npm run smoke`: headless simulation of 24 nights with a simple bot, to catch runtime errors in the logic and drawing code.
- `node tests/snapshot.mjs out.png [seed] [night] [seconds]`: renders a gameplay frame to PNG.

- `tests/music.mjs`, `tests/audio.mjs`, `tests/sfx.mjs`: the music engine and its stage rules, the audio module against a fake
  AudioContext, and the shipped sound files against the brief (mono, 8-bit, low rate, credited).
- `tools/fetch_audio.sh` downloads the third-party source clips into `audio/source/` (not kept in git), and
  `tools/build_sounds.py` rebuilds every file in `audio/sfx/` and `CREDITS.md` from them. It needs ffmpeg and SoX.
- `node tools/render_music.mjs [dir]` mixes each music stage, and a whole night's build-up, to WAV files so you can
  listen without running the game (default folder `music-out/`).

**To deploy,** copy `index.html`, `js/` and `audio/sfx/` to any web server. Everything else (`audio/source/`, `tools/`,
`tests/`, `node_modules/`, `package.json`) is for development only.

## Design decisions (beyond the brief)

- Food is delivered when Wenceslas reaches the old man; carrying pages hand over one item at a time.
- Enemy and supply numbers build up along curves in `js/tuning.js`, read two levels ahead (`NIGHT_OFFSET`) because the first two levels were too easy: night 1 plays like level 3, and night 12 like level 14. The food the old man needs is set separately and rises evenly from 5 on night 1 to 8 on night 12 (`FOOD_NEEDED`). Robber count and spawn rate rise each night; from night 4 some robbers take two hits.
- The sword really reaches 60 pixels, but its arc is drawn at 30 (`swingRange` and `swingDrawnRadius`), so it hits further than it looks. Set them equal for an honest arc.
- Pages are dropped between nights: each night starts with Wenceslas alone.
- Wenceslas has 10 HP and recovers half his maximum between nights. Pages have 2 HP.
- The sword doesn't hurt pages.
- Hard mode resets the score and doubles all points.
- Picking up food: Wenceslas or any page in the line can touch it, and it goes to the first empty-handed page.
- High scores: top 10, easy and hard runs share one table (hard runs are marked), stored in localStorage. Names are up to 8 characters and the last one is remembered for next time (older 3-letter entries still load). A run that ends in defeat counts the points earned in the unfinished night, and the GAME OVER screen says NEW HIGH SCORE! when that score makes the table, before moving on to name entry. A score of 0 never makes the table.
- Touch: the joystick floats, and a tap's auto-aim reaches 90 pixels (`autoAimRange` in `js/tuning.js`); beyond that the king swings the way he's facing.
- Hard mode is unlocked, and stays unlocked, once night 12 has been cleared.
- Quitting from the pause menu doesn't record a score.
- Robbers raise their club (with a red "!") for 0.35 s before a blow lands, so attacks can be read and interrupted.
- Wolves are there from night 1: one at a time on nights 1 to 3, rising to four from night 10. They're faster than Wenceslas.
  A wolf goes for the nearest page carrying food, crouches (with a red "!") for 0.3 s, then leaps. If it reaches the page,
  it takes the food, bites the page for 1 HP and runs for the nearest edge. Killing it before it gets away drops the food.
  With no food being carried, wolves circle loosely round Wenceslas and do no harm. One sword hit kills a wolf, for the
  same points as a robber, and the end-of-night breakdown counts robbers and wolves together as "enemies".
  A stolen item makes the food-dropped sound; there's no wolf sound of its own yet. Wolf numbers and speeds are in
  `js/tuning.js`.
- Archers appear from night 3: one at a time on nights 3 to 5, two on 6 to 8, three from 9, on top of the robbers. Archers
  look only at Wenceslas. They walk to within 150 pixels, then plant their feet and draw their bow for 0.8 s (a red "!" shows
  they're about to shoot) and loose one arrow at where he is at that moment, with up to about 33 pixels of random error at that
  range, so a standing king is hit roughly one time in five and a moving one rarely. An arrow hits the first of Wenceslas
  or a page that it reaches, for 1 damage. Trees stop arrows; rocks and walls don't (they're low). Closer than 70 pixels,
  archers back away between shots, but at 34 pixels a second to Wenceslas's 85, so he can run them down; one hit kills.
  Arrows reuse the sword-swing and hit sounds (archers have no sound of their own yet). The numbers are in
  `js/tuning.js` (`archer*` and `arrow*`).

## Licence

The code is released under the [MIT licence](LICENSE). The sound effects and music are credited in
[CREDITS.md](CREDITS.md): some clips come from a CC0 pack by Kenney, and the rest are synthesised in this repository.
