#!/usr/bin/env node
// Mixes the music to WAV files so it can be listened to (and measured) without running the game.
// It uses the same pattern data, sequencer and note scheduling as the browser, but a simple
// software mixer instead of Web Audio, so it is a close preview rather than an exact copy.
//
//   node tools/render_music.mjs [outdir] [night]     (default: music-out/)
//   With a night, also writes music-night<N>.wav: that night's arrangement, build-up and all.
//
// Writes music-stage0.wav ... music-stage4.wav (each stage on its own) and music-night.wav
// (a whole night's build-up, with the stage changes at phrase boundaries).
import { mkdirSync, writeFileSync } from 'node:fs';
import { Sequencer, makeSamples, phraseEvents, SAMPLE_RATE, PAN, MUSIC_GAIN } from '../js/music.js';
import { SONG } from '../js/music-data.js';
import { arrangement } from '../js/arrange.js';

const OUT_RATE = 22050, BASE_GAIN = MUSIC_GAIN;
const outDir = process.argv[2] || 'music-out';
const nightArg = Number(process.argv[3]) || 0;
mkdirSync(outDir, { recursive: true });
const samples = makeSamples();

function mixEvents(events, seconds) {
  const n = Math.ceil(seconds * OUT_RATE) + OUT_RATE;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (const e of events) {
    const s = samples[e.sample];
    const x = (PAN[e.ch] + 1) / 2, gl = Math.cos((x * Math.PI) / 2), gr = Math.sin((x * Math.PI) / 2);
    const { attack = 0.002, release = 0.05 } = e.voicing || {};
    const end = e.when + Math.max(e.duration, attack + 0.02);
    const step = (e.rate * SAMPLE_RATE) / OUT_RATE;
    const first = Math.floor(e.when * OUT_RATE), last = Math.min(n - 1, Math.ceil((end + 0.02) * OUT_RATE));
    let pos = 0;
    for (let i = first; i <= last; i++, pos += step) {
      const t = i / OUT_RATE;
      let idx = pos;
      if (s.loop) { const [a, b] = s.loop; idx = a + ((pos - a) % (b - a)); }
      else if (idx >= s.data.length - 1) break;
      const i0 = Math.floor(idx), f = idx - i0;
      const v = s.data[i0] * (1 - f) + s.data[Math.min(i0 + 1, s.data.length - 1)] * f;
      // the same envelope as the browser: ramp up, hold, ramp down to the note's end
      let env = t < e.when + attack ? (t - e.when) / attack : 1;
      if (t > end - release) env = Math.min(env, Math.max(0, (end - t) / release));
      const a = v * env * e.vol * BASE_GAIN;
      L[i] += a * gl; R[i] += a * gr;
    }
  }
  return { L, R };
}

function wav(path, { L, R }, seconds) {
  const n = Math.min(L.length, Math.ceil(seconds * OUT_RATE));
  const data = Buffer.alloc(n * 4);
  let peak = 0, clipped = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    for (const [k, ch] of [[0, L], [1, R]]) {
      const v = ch[i];
      peak = Math.max(peak, Math.abs(v)); sum += v * v;
      if (Math.abs(v) >= 1) clipped++;
      data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 4 + k * 2);
    }
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(OUT_RATE, 24); h.writeUInt32LE(OUT_RATE * 4, 28);
  h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([h, data]));
  console.log(`${path}  ${seconds.toFixed(1)}s  peak ${peak.toFixed(2)}  rms ${Math.sqrt(sum / (2 * n)).toFixed(3)}  clipped samples ${clipped}`);
}

// plan: list of [stageToRequestBeforeThisPhrase, count]
function render(name, plan, song = SONG) {
  const seq = new Sequencer(song);
  let t = 0.1; const events = []; const log = [];
  for (const [stage, count] of plan) {
    seq.setStage(stage);
    for (let i = 0; i < count; i++) {
      const p = seq.nextPhrase();
      const { events: ev, length } = phraseEvents(p, t, samples);
      events.push(...ev); log.push(`${p.stage}:${p.id}`); t += length;
    }
  }
  const seconds = t + 1.5;
  wav(`${outDir}/${name}.wav`, mixEvents(events, seconds), seconds);
  return log.join(' ');
}

[[2], [2], [4], [8], [8]].forEach(([count], stage) => {
  const order = render(`music-stage${stage}`, [[stage, count]]);
  console.log('   stage:phrase', order);
});
console.log('   night:', render('music-night', [[0, 2], [1, 2], [2, 4], [3, 8], [4, 8]]));
if (nightArg) {
  const song = arrangement(nightArg);
  console.log(`   night ${nightArg}:`, render(`music-night${nightArg}`, [[0, 2], [1, 2], [2, 4], [3, 8], [4, 8]], song));
}
