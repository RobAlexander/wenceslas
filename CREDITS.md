# Credits

Every audio file in the game, with its source, author and licence.
No file is under a non-commercial (NC) or no-derivatives (ND) licence.

## Sound effects (`audio/sfx/`)

Built by `tools/build_sounds.py`; the originals are downloaded by `tools/fetch_audio.sh`.
Every file is converted to mono, 8-bit, 11025 Hz WAV.

| File | Used for | Origin | Source URL | Author | Licence |
|---|---|---|---|---|---|
| `audio/sfx/deliver.wav` | food delivered to the old man | trimmed from `handleCoins2.ogg` in "50 RPG sound effects" | https://opengameart.org/content/50-rpg-sound-effects | Kenney Vleugels (kenney.nl) | CC0 1.0 |
| `audio/sfx/foodDrop.wav` | food dropped | trimmed from `dropLeather.ogg` in "50 RPG sound effects" | https://opengameart.org/content/50-rpg-sound-effects | Kenney Vleugels (kenney.nl) | CC0 1.0 |
| `audio/sfx/frostyCrash.wav` | Frosty crashes into something | synthesised by `tools/build_sounds.py` | this repository | the project | CC0 1.0 (dedicated to the public domain) |
| `audio/sfx/frostyRoll.wav` | Frosty rolling | synthesised by `tools/build_sounds.py` | this repository | the project | CC0 1.0 (dedicated to the public domain) |
| `audio/sfx/frostyWarn.wav` | Frosty winds up to roll (the warning) | synthesised by `tools/build_sounds.py` | this repository | the project | CC0 1.0 (dedicated to the public domain) |
| `audio/sfx/gameover.wav` | game over | synthesised by `tools/build_sounds.py` | this repository | the project | CC0 1.0 (dedicated to the public domain) |
| `audio/sfx/ghostScream.wav` | a ghost raised by St Nicholas launches (the scream) | synthesised by `tools/build_sounds.py` | this repository | the project | CC0 1.0 (dedicated to the public domain) |
| `audio/sfx/hit.wav` | sword hits a robber | trimmed from `chop.ogg` in "50 RPG sound effects" | https://opengameart.org/content/50-rpg-sound-effects | Kenney Vleugels (kenney.nl) | CC0 1.0 |
| `audio/sfx/hurt.wav` | Wenceslas hurt | synthesised by `tools/build_sounds.py` | this repository | the project | CC0 1.0 (dedicated to the public domain) |
| `audio/sfx/iceStrike.wav` | St Nicholas's ice zones strike | synthesised by `tools/build_sounds.py` | this repository | the project | CC0 1.0 (dedicated to the public domain) |
| `audio/sfx/kill.wav` | robber killed | synthesised by `tools/build_sounds.py` | this repository | the project | CC0 1.0 (dedicated to the public domain) |
| `audio/sfx/lightning.wav` | St Nicholas's lightning strikes | synthesised by `tools/build_sounds.py` | this repository | the project | CC0 1.0 (dedicated to the public domain) |
| `audio/sfx/menuMove.wav` | menu cursor moves | trimmed from `metalClick.ogg` in "50 RPG sound effects" | https://opengameart.org/content/50-rpg-sound-effects | Kenney Vleugels (kenney.nl) | CC0 1.0 |
| `audio/sfx/menuSelect.wav` | menu choice | trimmed from `metalLatch.ogg` in "50 RPG sound effects" | https://opengameart.org/content/50-rpg-sound-effects | Kenney Vleugels (kenney.nl) | CC0 1.0 |
| `audio/sfx/nightComplete.wav` | night complete | synthesised by `tools/build_sounds.py` | this repository | the project | CC0 1.0 (dedicated to the public domain) |
| `audio/sfx/pageDie.wav` | page killed | synthesised by `tools/build_sounds.py` | this repository | the project | CC0 1.0 (dedicated to the public domain) |
| `audio/sfx/partridge.wav` | the partridge | synthesised by `tools/build_sounds.py` | this repository | the project | CC0 1.0 (dedicated to the public domain) |
| `audio/sfx/pickup.wav` | food picked up | trimmed from `handleSmallLeather.ogg` in "50 RPG sound effects" | https://opengameart.org/content/50-rpg-sound-effects | Kenney Vleugels (kenney.nl) | CC0 1.0 |
| `audio/sfx/recruit.wav` | page recruited | synthesised by `tools/build_sounds.py` | this repository | the project | CC0 1.0 (dedicated to the public domain) |
| `audio/sfx/swing.wav` | sword swing | trimmed from `knifeSlice2.ogg` in "50 RPG sound effects" | https://opengameart.org/content/50-rpg-sound-effects | Kenney Vleugels (kenney.nl) | CC0 1.0 |

## Music

There are no music files. The music is written as tracker-style pattern data in `js/music-data.js`,
and its instrument samples (bell, choir, strings, bass, pluck, flute, percussion) are synthesised in the browser by `js/music.js`.

- Tune: *Tempus adest floridum*, from *Piae Cantiones* (1582), the traditional melody of "Good King Wenceslas".
  It is in the public domain.
- Arrangement and instrument synthesis: original to this project, dedicated to the public domain (CC0 1.0).
- Frosty's arrival stinger: the notes of `frosty-arrive.mid`, by the project's author, converted by
  `tools/midi-to-stinger.mjs`. Dedicated to the public domain (CC0 1.0).
- Mary's arrival stinger: the notes of `mary.mid`, by the project's author, converted the same way. Dedicated to
  the public domain (CC0 1.0).
- Prince Boleslaus's arrival stinger: the notes of `boleslaus.mid`, by the project's author, converted the same way.
  Dedicated to the public domain (CC0 1.0).
- St Nicholas's arrival stinger: the notes of `nicholas.mid`, by the project's author, converted the same way.
  Dedicated to the public domain (CC0 1.0).
- The boss theme: an original piece built from Frosty's stinger's motif, also dedicated to the public domain (CC0 1.0).
