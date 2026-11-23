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
| `spawn robber\|wolf\|archer\|mary\|frosty\|boleslaus\|nicholas\|page\|food [count]` | Add things to the current night |
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

- **Effects** are 20 sampled sounds in `audio/sfx/` (mono, 8-bit, 11 kHz WAV, Amiga style).
  Seven are trimmed from the CC0 "50 RPG sound effects" pack by Kenney (via OpenGameArt) and thirteen are synthesised.
  Every file is listed with its source, author and licence in `CREDITS.md`.
- **Music** is played by a small four-channel tracker-style player (`js/music.js`) on the Web Audio API. There are no
  music files: the song is pattern data in `js/music-data.js`, and the instrument samples (bell, choir, strings, bass,
  percussion) are generated in code as short 8-bit samples with loop points.
- **Adaptive:** each night starts with just the opening phrase, played slowly on a bell. As food is delivered the music
  adds the bass, then strings, then percussion, then a choir, and plays more of the carol until it plays the whole tune.
  Stages change only at phrase boundaries, and without progress the music keeps looping at its current stage.
- **Stingers and the boss theme:** a stinger is a short phrase played once over the music (`STINGERS` in
  `js/music-data.js`), made from a MIDI file with `node tools/midi-to-stinger.mjs file.mid`. Frosty's arrival stinger
  comes from `frosty-arrive.mid`, Mary's from `mary.mid`, and the other two bosses' from `boleslaus.mid` and `nicholas.mid`. When he arrives the night's music cuts, the stinger plays alone, and the boss theme
  (`BOSS_SONG`) begins just as it ends. The theme is built from the stinger's figure (its first phrase is those same
  eleven notes, an octave up) at the stinger's tempo, and it follows his health: stage 0 at the start, stage 1 (faster,
  with a choir) after he has lost a third of his health, stage 2 (faster again, with a bell) after two thirds. When he
  falls the music stops for the burst of snowballs, then the night-end music plays in the night's own arrangement.
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
- `tests/frosty.mjs`: boss nights and Frosty (which nights, the telegraph and its lock, rolling, resting, only hurtable while dizzy, ten hits to kill, scaling).
- `tests/nicholas.mjs`: St Nicholas (the rotation, hittable except appearing and dying, drifting at a distance, the cast alternation and limits, skeletons rising and hunting, ghosts warning, locking and launching, the ice zones' patterns, timings and two strikes, the lightning timer and ring and cooldown, the ascension, no points for the dead).
- `tests/boleslaus.mjs`: Prince Boleslaus and his guards (the rotation, the guards' post and aggro, the sword's telegraph, lock and fan, the dart-in-and-out timing, the roll and the rare charge, hittable only on foot, the fall).
- `tests/mary.mjs`: the boss Mary (which nights, the ice rising and splitting, the three attacks and their warnings, only hurtable while resting, the freeze-and-sink ending, scaling).
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
  `python3 tools/build_sounds.py --synth-only` rebuilds just the synthesised effects, without the downloaded clips
  (new synthesised effects go at the end of `SYNTH`, so the earlier ones keep coming out exactly the same).
- `node tools/render_music.mjs [dir]` mixes each music stage, a whole night's build-up, each stinger, and the boss
  theme (the stinger running into it, and each stage) to WAV files so you can listen without running the game
  (default folder `music-out/`).

**To deploy,** copy `index.html`, `js/` and `audio/sfx/` to any web server. Everything else (`audio/source/`, `tools/`,
`tests/`, `node_modules/`, `package.json`) is for development only.

## Design decisions (beyond the brief)

- Food is delivered when Wenceslas reaches the old man; carrying pages hand over one item at a time.
- Enemy and supply numbers build up along curves in `js/tuning.js`, read two levels ahead (`NIGHT_OFFSET`) because the first two levels were too easy: night 1 plays like level 3, and night 12 like level 14. The food the old man needs is set separately and rises evenly from 5 on night 1 to 8 on night 12 (`FOOD_NEEDED`). Robber count and spawn rate rise each night; from night 4 some robbers take two hits.
- The sword really reaches 60 pixels, but its arc is drawn at 30 (`swingRange` and `swingDrawnRadius`), so it hits further than it looks. Set them equal for an honest arc.
- Pages are dropped between nights: each night starts with Wenceslas alone.
- Wenceslas has 5 HP (`kingMaxHp`) and recovers just 1 HP between nights (`hpRestoreBetweenNights`). Pages have 2 HP.
- The status line (night, health, food delivered, pages, score) is drawn in large text straight over the ground at the top of the screen, with no background strip. A boss's health bar sits at the bottom.
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
- Every third night (3, 6, 9, 12) ends with a boss, in turn (`CURVES.boss.order`): Frosty on night 3, Mary on 6, Prince Boleslaus on 9, and St Nicholas on 12 (each appears once; if you repeat a boss in `CURVES.boss.order` the repeat is a little tougher). Delivering the last food doesn't end the night: the boss comes, and nothing else spawns
  while they are out (what is already there stays). Frosty, a giant snowman: he
  lumbers in from the edge of the screen, and nothing else spawns while he's out (what's already there stays). He repeats: lean
  back and shake for 1 s with a red "!" (a line of dots on the ground shows where the roll will go; it follows Wenceslas, then
  locks 0.3 s before the roll, so a late sidestep works), roll in a straight line at 210 px/s for up to 300 px, then sit dizzy for
  1.25 s, which is room for 2 or 3 sword swings. He can only be hurt while dizzy; blows at any other time just puff off him. A roll
  that reaches Wenceslas does 2 damage (he has 5), and flattens any page it goes through. It stops at the screen edge or at a
  tree, rock or wall, and hitting scenery leaves him dizzy 0.5 s longer. It takes 10 hits. When he falls he bursts into a
  shower of snowballs over three seconds (`frostyDeathTime`), shedding from the top down in four loud bursts; the night clock
  stops, nothing can hurt Wenceslas, and only when the last of him is gone does the night end and the end-of-night box appear.
  He is worth a 200-point bonus (added to the enemies total, awarded as he falls) and a par time 30 s longer. If he were to come a second time he'd be a little tougher (one more
  hit, 10 px/s faster, 0.1 s less rest, 0.05 s less warning), but not a different fight. Frosty
  isn't on the How to play screen; a short banner appears when he arrives. He has three sounds of his own: a low
  groaning warning as he starts to aim (`frostyWarn`), a rumble as he rolls (`frostyRoll`) and a crash when a roll ends in
  a tree, rock, wall or the edge of the screen (`frostyCrash`); his hits and defeat reuse the hit and kill sounds. His music
  is described under Sound and music. The numbers are in `js/tuning.js` (`CURVES.boss` and `frosty*`).
- Mary, the second boss (night 6), is the Mary in the close-fitting Santa suit at twice the size. Her ice block rises at
  least 150 pixels from Wenceslas (2.4 s) and splits open (1.3 s); she can't be hurt until she is out. Then she repeats: **warning
  lines** (1 s, shorter later; a red "!" and a raised snowball), one of three **attacks**, and a **rest**, never the same attack
  twice running. A *blast* is a wide fan of 9 snowballs, twice, 0.4 s apart: the fan's edges show on the ground, follow Wenceslas
  and lock 0.3 s before it fires. A *spiral* has her plant her feet and spin for 2 s, firing from two arms (spokes and a
  turn-direction arc show first). A *ring* sends 16 snowballs outward in two waves, the second turned half a gap from the first,
  so you have to find the gaps (ticks on the ground show the first wave). Snowballs are arrows that are white: slower than an
  arrow, 1 damage, they hit the first of Wenceslas or a page, trees stop them and rocks and walls don't. After each attack she rests
  for 1.8 s, trudging toward Wenceslas at 26 pixels a second (stopping 55 pixels away) with stars round her head: that is the only
  time she can be hurt, and it is room for 3 or 4 swings. It takes 12 hits (13 a second time, with faster snowballs, a 0.1 s shorter
  rest and a 0.05 s shorter warning). When she falls she is frozen: ice grows over her (0.9 s), holds (0.6 s), and the block sinks
  into the ground (1.5 s); only then does the night end. As with Frosty the 200-point bonus is awarded as she falls, the night clock
  stops and nothing can hurt Wenceslas. Her arrival stinger (`mary.mid`, 5.3 s) plays alone as the ice rises, and the boss theme starts as it ends; the entrance (rise, split and the first warning) is timed to come out about as long, so the theme arrives as she first attacks (`maryRise` and `marySplit` set that). She has no sounds of
  her own yet (her throws reuse the sword-swing sound and her hits the hit sound), and she isn't on the How to play screen. The
  numbers are in `js/tuning.js` (`mary*` and `snowball*`).
- Prince Boleslaus of Bohemia, the third boss (night 9), strides in from the edge with three guards and walks at Wenceslas at
  62 pixels a second (he walks at 85), and **can be hit whenever he is on foot**: only his roll, his charge and his fall are
  untouchable. Every 0.5 to 1.1 s he decides: if Wenceslas is in reach he swings his sword; if Wenceslas is far (over 130 pixels)
  he rolls (like Frosty, at 190 pixels a second for up to 280 pixels, a rest of 1.6 s after) or, rarely (15% of the time), charges
  with a lance (330 pixels a second for up to 520, 3 damage, a 2 s rest). The **sword** is heavily telegraphed: he raises it for
  1.2 s while a fan on the ground (dotted edges and an arc, red) shows where the blow will fall. It follows Wenceslas, then locks
  0.35 s before the blow (bolder and orange), so a late sidestep works. The blow covers about 100 degrees and **reaches 80 pixels,
  which is farther than Wenceslas's own sword**, so being near enough to hit him means being near enough to be hit: dart in, hit
  him two or three times during the windup, and dart out before it falls. A blow does 2 damage (and hurts a page in the fan), and
  he is open for 0.9 s after it. Hits don't interrupt him. His roll and charge are like Frosty's: a line shows the path, they hurt
  Wenceslas and flatten pages, and scenery or the edge stops them with a longer rest. It takes 16 hits. His **guards**, Tira, Česta
  and Hněvsa, are ordinary robbers (one hit, an ordinary club) that stay within about 48 pixels of him, facing Wenceslas, and only
  go for Wenceslas when he comes within 70 pixels of them or of Boleslaus; then they return to their posts. Killing them first is
  sensible but not required. Their names are kept in the data, but not shown: the 3x5 font has no accented letters. When Boleslaus
  falls he staggers, kneels and topples over (2.6 s), the guards run off, and only then does the night end; as with the other bosses
  the 200-point bonus comes as he falls, the clock stops and nothing can hurt Wenceslas. He uses the boss theme with no arrival
  stinger yet, and the existing sounds (the Frosty warning for his windups, the sword swing for the blow, the rolling rumble and the
  crash). The numbers are in `js/tuning.js` (`boleslaus*`).
- St Nicholas, the fourth and final boss (night 12), is about 48 pixels tall (the tallest): a bishop with a halo, a white beard,
  crimson and gold robes, a white stole marked with gold crosses, a book in one arm and the other hand raised in blessing. He
  appears in a golden light (1.5 s, not yet hittable), then **can be hit whenever he is there**. He drifts slowly (30 pixels a
  second) to keep 90 to 150 pixels from Wenceslas, and every 1.2 to 2.0 s casts one of two things, never the same twice running.
  **Raise the dead** (1 s of casting, with circles on the ground): 3 skeletons climb out of the ground (0.8 s, inert and
  untouchable while they do) and then hunt Wenceslas exactly like robbers; 2 ghosts appear and glare for 0.9 s (shaking, red eyes,
  a "!" and a line toward Wenceslas, tracking him and locking 0.3 s before the launch), then launch in a straight line at
  250 pixels a second, screaming, over scenery. A ghost that reaches Wenceslas does 2 damage and flattens a page; a ghost or a
  skeleton falls at one hit. He won't raise more than 6 skeletons or 3 ghosts at once, and the dead are worth no points and don't
  count as kills, so they can't be farmed. **Ice strike** (0.8 s cast): the field is a grid of 8 by 4 cells and half of them, in
  a checkerboard, alternate columns or a scatter that always leaves a free cell beside every zone, are marked in blue with a red
  dotted border for 1.2 s, then strike, and strike again 1.0 s later (longer than Wenceslas's 0.8 s invulnerability, so standing
  in one zone throughout costs two hits), 1 damage each. The strikes hurt everything inside, pages and his own undead too. He
  doesn't cast again during a barrage. **Lightning:** while Wenceslas is within 70 pixels of him a closeness timer fills (his halo
  flickers faster as it does); it empties 1.5 times faster when Wenceslas is away. At 3 s, once he is idle and a 5 s cooldown is
  up, a ring of warning signs forms round him (95 pixels out, 1.3 s), then lightning strikes everything inside it: 2 damage, and
  it destroys the undead there. Dart in, hit, and dart out. It takes 20 hits. When he falls, the dead crumble, any ice or
  lightning clears, and he rises into a column of light and fades (3.2 s) before the night ends; as with the other bosses the
  200-point bonus comes as he falls, the clock stops and nothing can hurt Wenceslas. He uses the boss theme with no arrival
  stinger yet. His sounds: `ghostScream`, `iceStrike` and `lightning` are new; raising the dead reuses the recruit bell and the
  warnings the Frosty groan. The numbers are in `js/tuning.js` (`nicholas*` and `ghost*`).

## Licence

The code is released under the [MIT licence](LICENSE). The sound effects and music are credited in
[CREDITS.md](CREDITS.md): some clips come from a CC0 pack by Kenney, and the rest are synthesised in this repository.
