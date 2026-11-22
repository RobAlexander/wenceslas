// Tests for the arrangements: every night's song is valid, in range and in key, and nights differ.
// Run with: node tests/arrange.mjs
import assert from 'node:assert/strict';
import { SONG, PHRASES } from '../js/music-data.js';
import { arrangement, shiftRow, PRESETS, KEYS } from '../js/arrange.js';
import { Sequencer, noteToMidi } from '../js/music.js';
import { NIGHTS } from '../js/config.js';

// shifting notes
assert.equal(shiftRow('G4 . F#4 | K - Bb3', 2), 'A4 . G#4 | K - C4');
assert.equal(shiftRow('G4 . .', 0), 'G4 . .');

// night 1 and the menus are the classic arrangement
assert.equal(arrangement(0), SONG);
assert.equal(arrangement(1), SONG);
assert.equal(arrangement(5), arrangement(5), 'cached');

const noteMidis = (text) => text.split(/[\s|]+/).map(noteToMidi).filter((m) => m !== null);
const firstNote = (text) => noteToMidi(text.split(/\s+/).find((t) => noteToMidi(t) !== null));

const seen = new Set();
const fingerprints = new Set();
for (let n = 1; n <= Math.max(NIGHTS, 31); n++) {
  const song = arrangement(n);
  assert.deepEqual(arrangement(n), song, 'deterministic');
  // parses, and has the same shape as the classic song
  const seq = new Sequencer(song);
  assert.equal(seq.parsed.length, PHRASES.length);
  assert.equal(song.rowsPerPhrase, SONG.rowsPerPhrase);
  assert.deepEqual(song.thresholds, SONG.thresholds);
  for (const parts of seq.parsed) for (const cells of parts) assert.equal(cells.length, song.rowsPerPhrase);

  // stages follow the same rules as the classic song
  assert.equal(song.stages.length, SONG.stages.length);
  song.stages.forEach((st, i) => {
    assert.deepEqual(st.phrases, SONG.stages[i].phrases);
    assert.deepEqual(st.voices, SONG.stages[i].voices);
    st.voices.forEach((on, ch) => { if (on) assert.ok(st.instruments[ch], `night ${n} stage ${i} channel ${ch}`); });
    if (i) assert.ok(st.bpm >= song.stages[i - 1].bpm, 'tempo never drops');
    assert.ok(st.bpm >= 50 && st.bpm <= 90, 'tempo ' + st.bpm);
  });

  // the key: how far the melody was moved
  const shift = firstNote(song.phrases[0].lead) - firstNote(PHRASES[0].lead);
  const key = new Set([7, 9, 11, 0, 2, 4, 6].map((pc) => (pc + shift + 120) % 12));
  song.phrases.forEach((p, i) => {
    assert.equal(p.lead, shiftRow(PHRASES[i].lead, shift), 'the melody is only moved, never changed');
    for (const m of noteMidis(p.lead).concat(noteMidis(p.harm))) assert.ok(m >= 48 && m <= 84, `night ${n} phrase ${i}: note ${m}`);
    for (const m of noteMidis(p.bass)) assert.ok(m >= 36 && m <= 60, `night ${n} phrase ${i}: bass ${m}`);
    for (const m of noteMidis(p.harm).concat(noteMidis(p.bass))) assert.ok(key.has(m % 12), `night ${n} phrase ${i}: ${m} is out of key`);
    assert.ok(noteMidis(p.harm).length > 0 && noteMidis(p.bass).length > 0, 'something to play');
  });

  if (n >= 2) { seen.add(((n - 2) % PRESETS.length) + ':' + KEYS[(n - 2) % KEYS.length]); }
  fingerprints.add(JSON.stringify(song));
}

// nights differ: no two of the first 12 are alike, and consecutive ones differ in key or style
const first12 = Array.from({ length: NIGHTS }, (_, i) => JSON.stringify(arrangement(i + 1)));
assert.equal(new Set(first12).size, NIGHTS, 'every night sounds different');
for (let n = 1; n < NIGHTS; n++) assert.notEqual(first12[n - 1], first12[n]);
assert.ok(new Set(KEYS).size >= 4, 'several keys');
assert.equal(new Set(PRESETS.flatMap((p) => p.styles)).size, 4, 'all four styles are used');
assert.ok(PRESETS.some((p) => p.styles[0] !== p.styles[1]), 'the repeat can change style');
assert.ok(PRESETS.length * KEYS.length >= 30 && 30 === seen.size, 'a night and its key do not repeat for 30 nights');

console.log('arrange: all tests passed');
