// Checks the shipped sound effect files against the brief: mono, 8-bit, low sample rate,
// WAV, one per effect the game uses, all credited. Run with: node tests/sfx.mjs
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { SFX } from '../js/audio.js';

const dir = new URL('../audio/sfx/', import.meta.url);
const credits = readFileSync(new URL('../CREDITS.md', import.meta.url), 'utf8');

// the sounds the brief asks for, at least
const REQUIRED = ['swing', 'hit', 'kill', 'hurt', 'recruit', 'pageDie', 'pickup', 'foodDrop', 'deliver',
  'nightComplete', 'gameover', 'partridge', 'menuMove', 'menuSelect', 'frostyWarn', 'frostyRoll', 'frostyCrash'];
for (const name of REQUIRED) assert.ok(name in SFX, `${name} has a mix level`);

const files = readdirSync(dir).filter((f) => f.endsWith('.wav')).map((f) => f.slice(0, -4)).sort();
assert.deepEqual(files, Object.keys(SFX).sort(), 'one file per effect, and no strays');

for (const name of files) {
  const b = readFileSync(new URL(`${name}.wav`, dir));
  assert.equal(b.toString('ascii', 0, 4), 'RIFF', name);
  assert.equal(b.toString('ascii', 8, 12), 'WAVE', name);
  // walk the chunks to find "fmt " and "data"
  let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(p + 8), channels: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') data = b.subarray(p + 8, p + 8 + size);
    p += 8 + size + (size & 1);
  }
  assert.ok(fmt && data, name + ' has fmt and data');
  assert.equal(fmt.format, 1, name + ' is PCM');
  assert.equal(fmt.channels, 1, name + ' is mono');
  assert.equal(fmt.bits, 8, name + ' is 8-bit');
  assert.ok(fmt.rate >= 8000 && fmt.rate <= 16000, `${name} is ${fmt.rate} Hz`);
  const secs = data.length / fmt.rate;
  assert.ok(secs > 0.05 && secs < 3, `${name} is ${secs.toFixed(2)}s`);
  let lo = 255, hi = 0;
  for (const v of data) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  assert.ok(hi - lo > 100, name + ' is not silent');
  assert.ok(lo > 0 && hi < 255, name + ' does not clip');
  assert.ok(credits.includes(`audio/sfx/${name}.wav`), name + ' is listed in CREDITS.md');
}

// every credited file exists, and every licence is one we can ship
assert.ok(!/\b(NC|ND)\b|non-?commercial|no-?derivatives/i.test(credits.replace(/No file is under a non-commercial \(NC\) or no-derivatives \(ND\) licence\./, '')), 'no NC/ND licences');
for (const m of credits.matchAll(/`(audio\/sfx\/[^`]+)`/g)) assert.ok(existsSync(new URL(`../${m[1]}`, import.meta.url)), m[1] + ' exists');

console.log(`sfx: ${files.length} files checked`);
