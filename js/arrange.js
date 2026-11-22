// Arrangements: the same carol, dressed differently each night.
//
// music-data.js holds the melody, a chord chart, and SONG, the classic hymn arrangement (used by the
// menus and the first night). arrangement(n) builds a whole Song for night n from the melody and the
// chords, in the same shape as SONG, so the sequencer and player need no changes. A night is
// settled by three things:
//   style    how the harmony, bass and drums play (hymn, arpeggio, march or descant); the first half
//            of the carol and its repeat can use different ones
//   key      the carol is moved up or down a few semitones
//   sound    which instrument carries the melody and which the harmony, and the tempo
// The presets and keys cycle at different lengths (6 and 5), so no night repeats another for 30 nights.

import { SONG, PHRASES, CHORDS } from './music-data.js';
import { noteToMidi, parseRow } from './music.js';

/** @typedef {import('./music.js').Song} Song */
/** @typedef {import('./music-data.js').Instrument} Instrument */
/** @typedef {{ root: number, minor: boolean }} Chord  root: pitch class, 0 = C */
/** @typedef {{ lead: string, harm: string, bass: string, perc: string }} Phrase */
/** @typedef {'hymn' | 'arpeggio' | 'march' | 'descant'} StyleName */

const ROWS = SONG.rowsPerPhrase;
const PER_CHORD = 4;   // rows under each chord

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** @param {number} midi */
const midiToName = (midi) => NAMES[midi % 12] + (Math.floor(midi / 12) - 1);

// Move every note in a row of pattern text by some semitones. Rests, holds and drum hits stay as they are.
/** @param {string} text @param {number} shift */
export function shiftRow(text, shift) {
  return text.split(' ').map((t) => {
    const m = noteToMidi(t);
    return m === null ? t : midiToName(m + shift);
  }).join(' ');
}

/** @param {string} name  e.g. 'G', 'Em', 'F#m' @returns {Chord} */
function parseChord(name) {
  const m = /^([A-G][#b]?)(m?)$/.exec(name);
  const root = m && noteToMidi(m[1] + '4');
  if (!m || root === null) throw new Error('bad chord ' + name);
  return { root: root % 12, minor: m[2] === 'm' };
}

/** @param {Chord} c */
const tones = (c) => [c.root, (c.root + (c.minor ? 3 : 4)) % 12, (c.root + 7) % 12];
/** the lowest note at or above `min` with this pitch class @param {number} pc @param {number} min */
const atOrAbove = (pc, min) => min + ((((pc - min) % 12) + 12) % 12);

// G major, the key everything is written in before it is moved.
const SCALE = new Set([7, 9, 11, 0, 2, 4, 6]);
/** the scale note a diatonic third below @param {number} m */
function thirdBelow(m) {
  let n = 0;
  for (let x = m - 1; ; x--) if (SCALE.has(x % 12) && ++n === 2) return x;
}

/**
 * @typedef {object} StyleInput
 * @property {Chord[]} chords   one per four rows
 * @property {(number | null)[]} lead   the melody's note starting on each row, or null
 * @property {boolean} last     the last phrase of a half: a fill into what follows
 * @property {Phrase} hymn      the hand-written parts of this phrase
 */

// 16 rows of '.', with notes put in at rows.
/** @param {[number, number | string][]} notes  [row, midi or drum] */
function rowsOf(notes) {
  const out = Array(ROWS).fill('.');
  for (const [row, v] of notes) out[row] = typeof v === 'number' ? midiToName(v) : v;
  return out.join(' ');
}

// Bass notes sit between D2 and C3 (before the key moves them), a fifth above stays under C4.
/** @param {Chord} c */
const bassRoot = (c) => atOrAbove(c.root, 38);

/** the melody's pitch sounding on a row @param {StyleInput} s @param {number} row */
function melodyAt(s, row) {
  for (let r = row; r >= 0; r--) { const v = s.lead[r]; if (v != null) return v; }
  return 67;
}

/** @type {Record<StyleName, (s: StyleInput) => { harm: string, bass: string, perc: string }>} */
const STYLES = {
  // The classic parts, as written.
  hymn: (s) => ({ harm: s.hymn.harm, bass: s.hymn.bass, perc: s.hymn.perc }),

  // Broken chords in the harmony, the bass holding the root, drums light.
  arpeggio: (s) => {
    /** @type {[number, number][]} */
    const harm = [];
    /** @type {[number, number][]} */
    const bass = [];
    s.chords.forEach((c, i) => {
      const r = atOrAbove(c.root, 55), third = r + (c.minor ? 3 : 4);
      [r, third, r + 7, third].forEach((m, k) => harm.push([i * PER_CHORD + k, m]));
      bass.push([i * PER_CHORD, bassRoot(c)]);
    });
    return {
      harm: rowsOf(harm), bass: rowsOf(bass),
      perc: s.last ? 'K . . . H . . . | K . . . H . S .' : 'K . . . H . . . | H . . . H . . .',
    };
  },

  // The harmony shadows the melody a third below, the bass walks root and fifth, a steady backbeat.
  march: (s) => {
    /** @type {[number, number][]} */
    const harm = [];
    /** @type {[number, number][]} */
    const bass = [];
    s.lead.forEach((m, row) => { if (m != null) harm.push([row, thirdBelow(m)]); });
    s.chords.forEach((c, i) => {
      bass.push([i * PER_CHORD, bassRoot(c)], [i * PER_CHORD + 2, bassRoot(c) + 7]);
    });
    return {
      harm: rowsOf(harm), bass: rowsOf(bass),
      perc: s.last ? 'K . S . K . S . | K . S . K . S S' : 'K . S . K . S . | K . S . K . S .',
    };
  },

  // A held counter-melody above the tune, the bass rocking root and fifth in eighths, hats ticking.
  descant: (s) => {
    /** @type {[number, number][]} */
    const harm = [];
    /** @type {[number, number][]} */
    const bass = [];
    s.chords.forEach((c, i) => {
      const row = i * PER_CHORD, set = tones(c);
      let x = melodyAt(s, row) + 3;
      while (!set.includes(x % 12)) x++;
      harm.push([row, x > 78 ? x - 12 : x]);   // not so high that the key change takes it out of range
      const root = bassRoot(c);
      for (let k = 0; k < PER_CHORD; k++) bass.push([row + k, k % 2 ? root + 7 : root]);
    });
    return {
      harm: rowsOf(harm), bass: rowsOf(bass),
      perc: s.last ? 'K H H H K H H H | K H H H K H S S' : 'K H H H K H H H | K H H H K H H H',
    };
  },
};

/**
 * @typedef {object} Preset
 * @property {[StyleName, StyleName]} styles   for the first half of the carol, and for its repeat
 * @property {Instrument[]} lead               the melody's instrument at each of the five stages
 * @property {Instrument} harm
 * @property {number} bpm                      added to each stage's tempo
 */
/** @type {Preset[]} */
export const PRESETS = [
  { styles: ['arpeggio', 'descant'], lead: ['bell', 'bell', 'bell', 'bell', 'choir'], harm: 'pluck', bpm: 0 },
  { styles: ['march', 'arpeggio'], lead: ['flute', 'flute', 'flute', 'flute', 'choir'], harm: 'strings', bpm: 4 },
  { styles: ['descant', 'march'], lead: ['pluck', 'pluck', 'bell', 'bell', 'choir'], harm: 'strings', bpm: -2 },
  { styles: ['hymn', 'arpeggio'], lead: ['flute', 'flute', 'bell', 'bell', 'flute'], harm: 'pluck', bpm: 6 },
  { styles: ['march', 'descant'], lead: ['bell', 'flute', 'flute', 'pluck', 'choir'], harm: 'choir', bpm: -4 },
  { styles: ['descant', 'hymn'], lead: ['pluck', 'bell', 'flute', 'bell', 'choir'], harm: 'strings', bpm: 2 },
];
// Semitones up or down, from night 2 on.
export const KEYS = [2, -2, 3, -1, 4];

/** @type {Map<number, Song>} */
const cache = new Map();

// The arrangement for a night. Night 1 and the menus (night 0) get the classic one.
/** @param {number} night @returns {Song} */
export function arrangement(night) {
  if (night <= 1) return SONG;
  const hit = cache.get(night);
  if (hit) return hit;
  const k = night - 2;
  const preset = PRESETS[k % PRESETS.length];
  const shift = KEYS[k % KEYS.length];

  const phrases = PHRASES.map((p, i) => {
    const cells = parseRow(p.lead, ROWS);
    const out = STYLES[preset.styles[i < PHRASES.length / 2 ? 0 : 1]]({
      chords: CHORDS[i % CHORDS.length].map(parseChord),
      lead: cells.map((c) => (c && 'midi' in c ? c.midi : null)),
      last: i % CHORDS.length === CHORDS.length - 1,
      hymn: p,
    });
    return { lead: shiftRow(p.lead, shift), harm: shiftRow(out.harm, shift), bass: shiftRow(out.bass, shift), perc: out.perc };
  });

  const stages = SONG.stages.map((st, i) => ({
    phrases: st.phrases,
    bpm: st.bpm + preset.bpm,
    voices: st.voices,
    // the voices that play stay the same; only the instruments change
    instruments: [preset.lead[i], st.instruments[1] ? preset.harm : null, st.instruments[2], st.instruments[3]],
  }));

  /** @type {Song} */
  const song = { ...SONG, phrases, stages };
  cache.set(night, song);
  return song;
}
