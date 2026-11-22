// The song, written the way a tracker would: patterns of rows, one string per channel.
//
//   *** DRAFT TUNE ***  The melody in `lead` below is a transcription from memory of the
//   traditional tune (Tempus adest floridum). It has NOT been checked against a score, so
//   some notes are probably wrong. Everything else (engine, stages, instruments) doesn't
//   care what the notes are: fix them here, nowhere else.
//
// Timing: one row is an eighth note. A phrase is 16 rows (two bars of 4/4); `|` is only for
// reading and is ignored. Tokens, separated by spaces:
//   G4  C#5  Bb3   start a note (name, optional # or b, octave; C4 is middle C)
//   .              keep going (sustain or rest)
//   -              note off
//   K  S  H        percussion (kick, snare, hat), on the percussion channel only
//
// Channels:  0 lead   1 harmony   2 bass   3 percussion   (Amiga-style: four channels)

const A = {   // "Good King Wenceslas looked out"
  lead: 'G4 . G4 . G4 . A4 . | G4 . G4 . D4 . . .',
  harm: 'B3 . . . . . . . | B3 . . . A3 . . .',
  bass: 'G2 . . . D3 . . . | G2 . . . D3 . . .',
  perc: 'K . H . S . H . | K . H . S . H .',
};
const B = {   // "On the feast of Stephen"
  lead: 'B4 . B4 . B4 . C5 . | B4 . B4 . G4 . . .',
  harm: 'D4 . . . . . . . | B3 . . . . . . .',
  bass: 'G2 . . . D3 . . . | E2 . . . B2 . . .',
  perc: 'K . H . S . H . | K . H . S . H .',
};
const C = {   // "When the snow lay round about"
  lead: 'D5 . D5 . D5 . E5 . | D5 . D5 . B4 . . .',
  harm: 'E4 . . . . . . . | D4 . . . . . . .',
  bass: 'C3 . . . G2 . . . | G2 . . . D3 . . .',
  perc: 'K . H . S . H . | K . H . S . H .',
};
const D = {   // "Deep and crisp and even"
  lead: 'A4 . B4 . G4 . A4 . | G4 . . . . . . .',
  harm: 'F#4 . . . . . . . | D4 . . . . . . .',
  bass: 'D3 . . . A2 . . . | G2 . . . . . . .',
  perc: 'K . H . S . H . | K . . . S . . .',
};

// The tune is sung twice through a verse, so the second half repeats the first.
export const PHRASES = [A, B, C, D, A, B, C, D];

// The chords under each of the four distinct phrases (A B C D), one per half bar (four rows), in G major.
// js/arrange.js builds the other arrangements from the melody above and these. DRAFT, like the melody:
// they were fitted to the hand-written parts by ear, not checked against a score.
export const CHORDS = [
  ['G', 'D', 'G', 'D'],
  ['G', 'D', 'Em', 'Bm'],
  ['C', 'G', 'G', 'D'],
  ['D', 'D', 'G', 'G'],
];
export const ROWS_PER_PHRASE = 16;

// Stages, from "just the opening phrase" up to the whole carol. The game picks the stage from
// how much of the night's food has been delivered, and the music moves up at phrase boundaries.
//   phrases      which phrases loop in this stage
//   bpm          quarter notes per minute (slow at first, a little faster each stage)
//   voices       which channels play: [lead, harmony, bass, percussion]
//   instruments  what each channel plays
//   gains        (optional) a volume multiplier for each channel, 1 if left out
/** @typedef {'bell' | 'choir' | 'strings' | 'bass' | 'pluck' | 'flute' | 'perc'} Instrument */
/**
 * @type {{ phrases: number[], bpm: number, voices: number[], instruments: (Instrument | null)[], gains?: number[] }[]}
 */
export const STAGES = [
  { phrases: [0],                         bpm: 56, voices: [1, 0, 0, 0], instruments: ['bell',  null,      null,   null] },
  { phrases: [0, 1],                      bpm: 62, voices: [1, 0, 1, 0], instruments: ['bell',  null,      'bass', null] },
  { phrases: [0, 1, 2, 3],                bpm: 68, voices: [1, 1, 1, 0], instruments: ['bell',  'strings', 'bass', null] },
  { phrases: [0, 1, 2, 3, 4, 5, 6, 7],    bpm: 74, voices: [1, 1, 1, 1], instruments: ['bell',  'strings', 'bass', 'perc'] },
  { phrases: [0, 1, 2, 3, 4, 5, 6, 7],    bpm: 80, voices: [1, 1, 1, 1], instruments: ['choir', 'strings', 'bass', 'perc'] },
];

// Food delivered / food needed at which each stage begins.
export const STAGE_THRESHOLDS = [0, 0.2, 0.4, 0.6, 0.8];

// Stingers: short phrases played once, over the music, when something happens in the game (the music
// ducks while one plays). Made from a MIDI file with tools/midi-to-stinger.mjs, which prints the notes.
//   notes   [midi note, start (beats), length (beats), velocity 0-127]
//   voices  what plays each note: instrument, channel (0-3, for left or right), how far it is moved
//           up in semitones (shift), a volume (gain), and minVel: only notes at least this loud
/**
 * @typedef {object} StingerVoice
 * @property {Instrument} instrument
 * @property {number} ch
 * @property {number} [shift]
 * @property {number} [gain]
 * @property {number} [minVel]
 */
/** @typedef {{ bpm: number, notes: [number, number, number, number][], voices: StingerVoice[] }} Stinger */

/** @type {Record<string, Stinger>} */
export const STINGERS = {
  // Frosty arrives (frosty-arrive.mid): a low, uneasy figure. The bass plays it as written (A2 and
  // below), the strings an octave up so it is heard on small speakers, and a cold bell two octaves
  // up rings on the loudest notes.
  frostyArrive: {
    bpm: 149,
    notes: [
      [45, 0, 0.979, 100],
      [38, 1, 0.479, 60],
      [42, 1.5, 0.479, 90],
      [46, 2, 0.979, 100],
      [36, 3, 0.479, 60],
      [44, 3.5, 0.479, 95],
      [46, 4, 0.479, 95],
      [48, 4.5, 0.479, 110],
      [45, 5, 0.479, 100],
      [37, 5.5, 0.479, 60],
      [45, 6, 0.979, 100],
    ],
    voices: [
      { instrument: 'strings', ch: 1, shift: 12, gain: 2.6 },
      { instrument: 'bass', ch: 2, gain: 2.4 },
      { instrument: 'bell', ch: 0, shift: 24, gain: 0.95, minVel: 95 },
    ],
  },
};

// The boss theme, for Frosty. It grows out of the arrival stinger: that figure (A, D, F#, Bb, C, Ab, Bb, C,
// A, C#, A) fills two bars exactly, so it is phrase A; phrase B is the same figure a tritone away; C builds
// on it in running eighths; D is the turnaround. The same tempo as the stinger (149 bpm), so the stinger runs
// straight into the theme. The game picks the stage from how much of Frosty's health has gone: the more
// damage, the faster and fuller it gets.
const BOSS = {
  A: {   // the stinger's own figure, an octave up on the strings; the bass sits on A
    lead: 'A3 . D3 F#3 Bb3 . C3 Ab3 | Bb3 C4 A3 C#3 A3 . . .',
    harm: 'E4 . . . . . . . | D#4 . . . . . . .',
    bass: 'A2 . A2 . A2 . A2 . | A2 . A2 . A2 . G#2 .',
    perc: 'K . H . S . H H | K . H K S . H H',
  },
  B: {   // the figure again, a tritone higher over D#
    lead: 'D#4 . G#3 C4 E4 . F#3 D4 | E4 F#4 D#4 G3 D#4 . . .',
    harm: 'A3 . . . . . . . | G#3 . . . . . . .',
    bass: 'D#2 . D#2 . D#2 . D#2 . | D#2 . D#2 . D#2 . D2 .',
    perc: 'K . H . S . H H | K . H K S . H H',
  },
  C: {   // the build: running eighths climbing from A to D
    lead: 'A3 A3 Bb3 A3 C4 A3 Bb3 A3 | D4 D4 D#4 D4 F4 D4 D#4 D4',
    harm: 'A3 . . . . . . . | D4 . . . . . . .',
    bass: 'A2 A2 A2 A2 A2 A2 A2 A2 | D3 D3 D3 D3 D3 D3 D3 D3',
    perc: 'K H S H K H S H | K H S H K S K S',
  },
  D: {   // the turnaround: the figure's high bell-like peak, then a drum fill into A again
    lead: 'A4 . . C5 Bb4 . G#4 A4 | E4 . . . . . . .',
    harm: 'C5 . . . . . . . | Bb4 . . . . . . .',
    bass: 'A2 . . . E2 . . . | E2 . . . E2 . E2 E2',
    perc: 'K . S . K . S . | K S K S S S S S',
  },
};

/**
 * Stages: 0 at the start of the fight, 1 once Frosty has lost about a third of his health, 2 after two thirds.
 * @type {{ phrases: number[], bpm: number, voices: number[], instruments: (Instrument | null)[], gains?: number[] }[]}
 */
const BOSS_STAGES = [
  // (strings are voiced quietly for harmony, so the lead is brought forward here)
  { phrases: [0, 1],       bpm: 149, voices: [1, 0, 1, 1], instruments: ['strings', null,    'bass', 'perc'], gains: [2.4, 1, 1.3, 1] },
  { phrases: [0, 1, 2, 3], bpm: 156, voices: [1, 1, 1, 1], instruments: ['strings', 'choir', 'bass', 'perc'], gains: [2.4, 1, 1.3, 1] },
  { phrases: [0, 1, 2, 3], bpm: 164, voices: [1, 1, 1, 1], instruments: ['strings', 'bell',  'bass', 'perc'], gains: [2.4, 1, 1.3, 1] },
];

// Damage taken (0 to 1) at which each boss stage begins.
export const BOSS_THRESHOLDS = [0, 0.35, 0.7];

export const BOSS_SONG = {
  phrases: [BOSS.A, BOSS.B, BOSS.C, BOSS.D],
  rowsPerPhrase: ROWS_PER_PHRASE,
  stages: BOSS_STAGES,
  thresholds: BOSS_THRESHOLDS,
};

export const SONG = { phrases: PHRASES, rowsPerPhrase: ROWS_PER_PHRASE, stages: STAGES, thresholds: STAGE_THRESHOLDS };
