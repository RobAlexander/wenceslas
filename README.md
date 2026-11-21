# Wenceslas

A top-down action game based on *Good King Wenceslas*. Plain JavaScript, no build step:
deploy by copying `index.html`, `js/` and `audio/sfx/` to any web server.

**Play it online: https://robalexander.github.io/wenceslas/**

## Run locally

    npm run serve        # python3 -m http.server 8000, then open http://localhost:8000

Opening `index.html` straight from disk won't work, because ES modules need a web server.

Optional URL parameters for testing, ignored in normal play:
`?seed=123` (repeatable layouts), `?night=5` (skip the title and start on that night),
`?screen=NAME` (show one screen: `title`, `paused`, `nightEnd`, `gameover`, `ending`, `initials`, `highscores`), `?debug` (shows the seed).

## Controls

### PC

WASD to move, mouse to aim, left-click to swing. Esc or P to pause. F toggles fullscreen, M mutes (and remembers it).
The game scales to fill the window, keeping 16:9 (with bars if needed).
In menus: W/S or the arrow keys to move, Enter or Space to choose, or just use the mouse.
Initials entry: type letters, or use the arrow keys (or click the arrows on screen); Enter to confirm.

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
- `tests/highscores.mjs`: unit tests for the high score store (ordering, top-10 cut-off, corrupt or unavailable storage).
- `tests/boot.mjs`: boots the real `main.js` under stubbed browser globals and plays the whole flow with synthetic input: title, nights, pause, ending, initials, high scores, game over, plus touch gestures, a fake gamepad and the portrait pause.
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
- Food target is 2 + night number (3 on night 1, 14 on night 12). Robber count and spawn rate rise each night; from night 6 some robbers take two hits.
- Pages are dropped between nights: each night starts with Wenceslas alone.
- Wenceslas has 10 HP and recovers half his maximum between nights. Pages have 2 HP.
- The sword doesn't hurt pages.
- Hard mode resets the score and doubles all points.
- Picking up food: Wenceslas or any page in the line can touch it, and it goes to the first empty-handed page.
- High scores: top 10, easy and hard runs share one table (hard runs are marked), stored in localStorage. Initials are remembered for next time. A run that ends in defeat counts the points earned in the unfinished night.
- Touch: the joystick floats, and a tap's auto-aim reaches 90 pixels (`autoAimRange` in `js/config.js`); beyond that the king swings the way he's facing.
- Hard mode is unlocked, and stays unlocked, once night 12 has been cleared.
- Quitting from the pause menu doesn't record a score.
- Robbers raise their club (with a red "!") for 0.35 s before a blow lands, so attacks can be read and interrupted.

## Licence

The code is released under the [MIT licence](LICENSE). The sound effects and music are credited in
[CREDITS.md](CREDITS.md): some clips come from a CC0 pack by Kenney, and the rest are synthesised in this repository.
