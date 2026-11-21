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
export const ROWS_PER_PHRASE = 16;

// Stages, from "just the opening phrase" up to the whole carol. The game picks the stage from
// how much of the night's food has been delivered, and the music moves up at phrase boundaries.
//   phrases      which phrases loop in this stage
//   bpm          quarter notes per minute (slow at first, a little faster each stage)
//   voices       which channels play: [lead, harmony, bass, percussion]
//   instruments  what each channel plays
export const STAGES = [
  { phrases: [0],                         bpm: 56, voices: [1, 0, 0, 0], instruments: ['bell',  null,      null,   null] },
  { phrases: [0, 1],                      bpm: 62, voices: [1, 0, 1, 0], instruments: ['bell',  null,      'bass', null] },
  { phrases: [0, 1, 2, 3],                bpm: 68, voices: [1, 1, 1, 0], instruments: ['bell',  'strings', 'bass', null] },
  { phrases: [0, 1, 2, 3, 4, 5, 6, 7],    bpm: 74, voices: [1, 1, 1, 1], instruments: ['bell',  'strings', 'bass', 'perc'] },
  { phrases: [0, 1, 2, 3, 4, 5, 6, 7],    bpm: 80, voices: [1, 1, 1, 1], instruments: ['choir', 'strings', 'bass', 'perc'] },
];

// Food delivered / food needed at which each stage begins.
export const STAGE_THRESHOLDS = [0, 0.2, 0.4, 0.6, 0.8];

export const SONG = { phrases: PHRASES, rowsPerPhrase: ROWS_PER_PHRASE, stages: STAGES, thresholds: STAGE_THRESHOLDS };
