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

/** @type {Record<string, Stinger | undefined>} */
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

  // Mary arrives (mary.mid): a chromatic climb that creeps up from E, then long low notes. Voiced like
  // Frosty's: bass as written, strings an octave up, and the bell on the loudest notes.
  maryArrive: {
    bpm: 113,
    notes: [
      [40, 0, 0.74, 100],
      [41, 0.75, 0.24, 90],
      [42, 1, 0.24, 85],
      [43, 1.25, 0.24, 85],
      [44, 1.5, 0.115, 85],
      [43, 1.625, 0.115, 85],
      [42, 1.75, 0.24, 85],
      [44, 2, 0.99, 100],
      [45, 3, 0.99, 100],
      [42, 4, 0.99, 95],
      [42, 5, 0.99, 90],
      [41, 7, 0.74, 95],
      [45, 8, 0.24, 90],
      [40, 8.25, 0.24, 85],
      [38, 8.5, 0.24, 85],
      [41, 8.75, 0.24, 85],
      [45, 9, 0.49, 95],
      [44, 9.5, 0.24, 85],
      [46, 9.75, 0.24, 85],
    ],
    voices: [
      { instrument: 'strings', ch: 1, shift: 12, gain: 2.6 },
      { instrument: 'bass', ch: 2, gain: 2.4 },
      { instrument: 'bell', ch: 0, shift: 24, gain: 0.95, minVel: 95 },
    ],
  },

  // Prince Boleslaus arrives (boleslaus.mid): a heavy tread that climbs and then sinks to a long low A.
  // Voiced like Frosty's: bass as written, strings an octave up, and the bell on the loudest notes.
  boleslausArrive: {
    bpm: 135,
    notes: [
      [42, 0, 0.99, 100],
      [41, 1, 0.115, 95],
      [45, 1.125, 0.115, 95],
      [46, 1.25, 0.24, 100],
      [48, 1.5, 0.115, 100],
      [47, 1.625, 0.365, 100],
      [38, 2, 0.49, 60],
      [40, 2.5, 0.49, 60],
      [40, 3, 0.365, 85],
      [41, 3.375, 0.365, 85],
      [42, 3.75, 0.24, 85],
      [37, 4, 0.99, 50],
      [40, 5, 0.74, 95],
      [41, 5.75, 0.24, 90],
      [43, 6, 0.115, 60],
      [35, 6.125, 0.865, 55],
      [37, 7, 0.74, 65],
      [38, 7.75, 0.24, 65],
      [37, 8, 0.49, 70],
      [35, 8.5, 0.49, 70],
      [38, 9, 0.24, 70],
      [35, 9.25, 0.24, 70],
      [33, 9.5, 0.49, 75],
      [34, 10, 2.49, 75],
    ],
    voices: [
      { instrument: 'strings', ch: 1, shift: 12, gain: 2.6 },
      { instrument: 'bass', ch: 2, gain: 2.4 },
      { instrument: 'bell', ch: 0, shift: 24, gain: 0.95, minVel: 95 },
    ],
  },

  // St Nicholas arrives (nicholas.mid): slow, high and sustained, a descending line. It is higher than the
  // others, so: choir and strings as written, the bass two octaves down for weight, and the bell only an
  // octave up (two would be shrill).
  nicholasArrive: {
    bpm: 143,
    notes: [
      [64, 0, 0.49, 100],
      [70, 1, 0.49, 50],
      [59, 1.5, 1.49, 95],
      [62, 3, 0.99, 95],
      [63, 4, 0.99, 95],
      [61, 5, 0.99, 95],
      [60, 6, 0.99, 90],
      [60, 7, 0.99, 85],
      [66, 8, 0.99, 100],
      [65, 9, 0.99, 95],
      [64, 10, 0.99, 90],
      [64, 11, 2.49, 90],
    ],
    voices: [
      { instrument: 'choir', ch: 3, gain: 1.0 },
      { instrument: 'strings', ch: 1, gain: 2.4 },
      { instrument: 'bass', ch: 2, shift: -24, gain: 2.4 },
      { instrument: 'bell', ch: 0, shift: 12, gain: 0.95, minVel: 95 },
    ],
  },
};

// Frosty's boss theme. (Mary, Prince Boleslaus and St Nicholas each have their own, below.) It grows out of the arrival stinger: that figure (A, D, F#, Bb, C, Ab, Bb, C,
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

// ---- The other bosses' themes. Each is built like Frosty's: phrase A is its boss's arrival stinger (the notes that
// fall on an eighth-note row), at the stinger's tempo so the stinger runs straight into the theme; B, C and D carry
// it on; and the three stages (by BOSS_THRESHOLDS) get faster and fuller as the boss is hurt.

// Mary (mary.mid, 113 bpm): cold and creeping. A is the chromatic climb from E, an octave up on the strings over a
// trudging bass; B is the quick figure that ends the stinger, ending on a tritone; C is a chromatic spiral, like
// her spinning attack; D is the ring bursting outward, a high held chord.
const MARY = {
  A: {
    lead: 'E3 . F#3 G#3 G#3 . A3 . | F#3 . F#3 . . . F3 .',
    harm: 'B3 . . . . . . . | C4 . . . . . . .',
    bass: 'E2 . . . E2 . E2 . | E2 . . . E2 . E2 .',
    perc: 'K . H . K . H . | K . H . K . H .',
  },
  B: {
    lead: 'A3 E3 D3 F3 A3 G#3 Bb3 . | Bb3 . . . . . E3 .',
    harm: 'E4 . . . . . . . | D4 . . . . . . .',
    bass: 'E2 . F2 . F#2 . G2 . | G#2 . A2 . Bb2 . B2 .',
    perc: 'K . H . S . H H | K . H K S . H H',
  },
  C: {
    lead: 'E3 F3 F#3 G3 G#3 G3 F#3 F3 | F3 F#3 G3 G#3 A3 G#3 G3 F#3',
    harm: 'E4 . . . . . . . | F4 . . . . . . .',
    bass: 'E2 E2 E2 E2 E2 E2 E2 E2 | F2 F2 F2 F2 F2 F2 F2 F2',
    perc: 'K H S H K H S H | K H S H K H S S',
  },
  D: {
    lead: 'A4 . . . . . . . | Bb4 . . . . . . .',
    harm: 'E5 . . . . . . . | E5 . . . . . . .',
    bass: 'E2 . . . E2 . . . | E2 . . . E2 . E2 E2',
    perc: 'K . S . K . S . | K S K S S S S S',
  },
};

// Prince Boleslaus (boleslaus.mid, 135 bpm): a march. A is the heavy opening, an octave up on the strings over a
// dotted pedal on F#; B is the low line that sinks away at the end of the stinger, the bass taking it with the
// lead a fifth above; C is the fight, running eighths over a bass ostinato; D is the lance charge, the flourish
// flung high over a held tritone, then a drum fill.
const BOLESLAUS = {
  A: {
    lead: 'F#3 . F3 C4 D3 E3 E3 . | C#3 . E3 . G3 . C#3 .',
    harm: 'C#4 . . . . . . . | B3 . . . . . . .',
    bass: 'F#2 . . F#2 . . F#2 . | C#2 . . C#2 . . C#2 .',
    perc: 'K . S S K . S . | K . S S K . S .',
  },
  B: {
    lead: 'G#4 . F#4 . A4 . F#4 . | E4 . F4 . . . . .',
    harm: 'C#4 . . . . . . . | E4 . . . . . . .',
    bass: 'C#3 . B2 . D3 . B2 . | A2 . Bb2 . . . . .',
    perc: 'K . S . K . S S | K . S . K S K S',
  },
  C: {
    lead: 'F#3 F#3 G3 F#3 A3 F#3 G3 F#3 | B3 B3 C4 B3 D4 B3 C4 B3',
    harm: 'F#4 . . . . . . . | B4 . . . . . . .',
    bass: 'F#2 F#2 F#2 F#2 F#2 F#2 F#2 F#2 | B2 B2 B2 B2 B2 B2 B2 B2',
    perc: 'K . S . K . S . | K S K S S S S S',
  },
  D: {
    lead: 'F4 A4 Bb4 C5 B4 . . . | A4 . . . . . . .',
    harm: 'C4 . . . . . . . | C4 . . . . . . .',
    bass: 'F#2 . . . . . . . | F#2 . . . F#2 . F#2 F#2',
    perc: 'K . S . K . S . | K S K S S S S S',
  },
};

// St Nicholas (nicholas.mid, 143 bpm): a solemn chant. A is the stinger itself, sung by the choir as written over
// open fifths and a low E; B is its answer, F#, F, E, with the bass stepping down; C is a chant climbing the
// chromatic cell in quarter notes, building toward the lightning; D is the lightning: the E and the Bb a tritone
// above it, struck high, then a crash.
const NICHOLAS = {
  A: {
    lead: 'E4 . Bb4 B3 . . D4 . | D#4 . C#4 . C4 . C4 .',
    harm: 'B3 . . . . . . . | G#3 . . . . . . .',
    bass: 'E2 . . . E2 . . . | E2 . . . E2 . . .',
    perc: 'K . . . H . . . | H . . . H . . .',
  },
  B: {
    lead: 'F#4 . F4 . E4 . E4 . | . . . . . . B3 .',
    harm: 'A3 . . . . . . . | G#3 . . . . . . .',
    bass: 'E2 . . . D#2 . . . | D2 . . . C#2 . . .',
    perc: 'K . . . H . H . | H . . . H . K .',
  },
  C: {
    lead: 'B3 . C4 . C#4 . D4 . | D#4 . E4 . F4 . F#4 .',
    harm: 'B3 . . . . . . . | B3 . . . . . . .',
    bass: 'E2 E2 E2 E2 E2 E2 E2 E2 | E2 E2 E2 E2 F2 F2 F2 F2',
    perc: 'K . H . K . H . | K . H . K H K K',
  },
  D: {
    lead: 'E5 . . . Bb5 . . . | E5 . . . . . . .',
    harm: 'Bb4 . . . . . . . | E4 . . . . . . .',
    bass: 'E2 . . . . . . . | E2 . . . E2 . E2 E2',
    perc: 'K . S . K . S . | K S K S S S S S',
  },
};

// The stages of those themes: stage 0 at the stinger's tempo, then about 5% faster each time and fuller. (Strings
// are voiced quietly for harmony, so the lead is brought forward with a gain, as in Frosty's.)
/**
 * @param {number} bpm @param {Instrument} lead @param {Instrument} harmony @param {Instrument} harmony2
 * @param {number[]} gains @param {number[]} [phrases]  the phrases the later stages play
 * @returns {{ phrases: number[], bpm: number, voices: number[], instruments: (Instrument | null)[], gains?: number[] }[]}
 */
const bossStages = (bpm, lead, harmony, harmony2, gains, phrases = [0, 1, 2, 3]) => [
  { phrases: [0, 1], bpm, voices: [1, 0, 1, 1], instruments: [lead, null, 'bass', 'perc'], gains },
  { phrases, bpm: Math.round(bpm * 1.05), voices: [1, 1, 1, 1], instruments: [lead, harmony, 'bass', 'perc'], gains },
  { phrases, bpm: Math.round(bpm * 1.1), voices: [1, 1, 1, 1], instruments: [lead, harmony2, 'bass', 'perc'], gains },
];

export const MARY_SONG = {
  phrases: [MARY.A, MARY.B, MARY.C, MARY.D],
  rowsPerPhrase: ROWS_PER_PHRASE,
  stages: bossStages(113, 'strings', 'choir', 'bell', [2.4, 1, 1.3, 1]),
  thresholds: BOSS_THRESHOLDS,
};

export const BOLESLAUS_SONG = {
  phrases: [BOLESLAUS.A, BOLESLAUS.B, BOLESLAUS.C, BOLESLAUS.D],
  rowsPerPhrase: ROWS_PER_PHRASE,
  stages: bossStages(135, 'strings', 'choir', 'bell', [2.4, 1, 1.3, 1]),
  thresholds: BOSS_THRESHOLDS,
};

export const NICHOLAS_SONG = {
  phrases: [NICHOLAS.A, NICHOLAS.B, NICHOLAS.C, NICHOLAS.D],
  rowsPerPhrase: ROWS_PER_PHRASE,
  stages: bossStages(143, 'choir', 'strings', 'bell', [2.0, 1.6, 1.3, 1]),
  thresholds: BOSS_THRESHOLDS,
};

export const SONG = { phrases: PHRASES, rowsPerPhrase: ROWS_PER_PHRASE, stages: STAGES, thresholds: STAGE_THRESHOLDS };
