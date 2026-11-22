#!/usr/bin/env node
// Turns a MIDI file into the note list the game plays as a "stinger" (a short phrase over the music).
//
//   node tools/midi-to-stinger.mjs frosty-arrive.mid
//
// Prints a JavaScript object to paste into STINGERS in js/music-data.js:
//   { bpm, notes: [[midi note, start in beats, length in beats, velocity 0-127], ...] }
// Every channel and track is merged, in time order. Percussion (channel 10) is skipped. Instruments are
// ignored: the voices that play it are chosen in music-data.js. The tempo is the first tempo event.
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: node tools/midi-to-stinger.mjs file.mid'); process.exit(1); }
const b = readFileSync(file);
if (b.toString('latin1', 0, 4) !== 'MThd') { console.error('not a MIDI file'); process.exit(1); }

let p = 8 + b.readUInt32BE(4);
const tracks = b.readUInt16BE(10), division = b.readUInt16BE(12);
if (division & 0x8000) { console.error('SMPTE timing is not supported'); process.exit(1); }
let tempo = 500000;   // microseconds per quarter note; 120 bpm unless the file says otherwise
let tempoSet = false;
/** @type {number[][]} */
const notes = [];

for (let t = 0; t < tracks; t++) {
  if (b.toString('latin1', p, p + 4) !== 'MTrk') { console.error('bad track ' + t); process.exit(1); }
  const end = p + 8 + b.readUInt32BE(p + 4);
  p += 8;
  let tick = 0, running = 0;
  /** @type {Map<string, [number, number]>} sounding notes: "channel:note" -> [start tick, velocity] */
  const on = new Map();
  const vlq = () => { let v = 0, c; do { c = b[p++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80); return v; };
  while (p < end) {
    tick += vlq();
    let status = b[p];
    if (status === 0xff) {
      p++;
      const type = b[p++], len = vlq();
      if (type === 0x51 && !tempoSet) { tempo = (b[p] << 16) | (b[p + 1] << 8) | b[p + 2]; tempoSet = true; }
      p += len;
      continue;
    }
    if (status === 0xf0 || status === 0xf7) { p++; p += vlq(); continue; }
    if (status & 0x80) { running = status; p++; } else status = running;
    const kind = status >> 4, ch = status & 15;
    if (kind === 0x9 || kind === 0x8) {
      const note = b[p++], vel = b[p++], key = ch + ':' + note;
      if (kind === 0x9 && vel > 0) { if (ch !== 9) on.set(key, [tick, vel]); }
      else if (on.has(key)) {
        const [start, v] = /** @type {[number, number]} */ (on.get(key));
        notes.push([note, start / division, (tick - start) / division, v]);
        on.delete(key);
      }
    } else if (kind === 0xc || kind === 0xd) p++;
    else p += 2;
  }
  p = end;
}

notes.sort((x, y) => x[1] - y[1] || x[0] - y[0]);
const r = (/** @type {number} */ v) => Math.round(v * 1000) / 1000;
const bpm = Math.round((60000000 / tempo) * 100) / 100;
console.log('{');
console.log(`  bpm: ${bpm},`);
console.log('  notes: [');
for (const [n, start, len, vel] of notes) console.log(`    [${n}, ${r(start)}, ${r(len)}, ${vel}],`);
console.log('  ],');
console.log('}');
