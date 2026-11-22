// Tests for the music engine: parsing, the sequencer's stage rules, instrument samples, and
// scheduling against a fake AudioContext. Run with: node tests/music.mjs
import assert from 'node:assert/strict';
import { SONG, STINGERS, BOSS_SONG, BOSS_THRESHOLDS } from '../js/music-data.js';
import { noteToMidi, midiToFreq, parseRow, stageFor, Sequencer, makeSamples, createMusic, phraseEvents, stingerEvents, stingerLength, SAMPLE_RATE } from '../js/music.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

// ---- notes
assert.equal(noteToMidi('C4'), 60);
assert.equal(noteToMidi('A4'), 69);
assert.equal(noteToMidi('F#4'), 66);
assert.equal(noteToMidi('Bb3'), 58);
assert.equal(noteToMidi('H4'), null);
near(midiToFreq(69), 440);
near(midiToFreq(60), 261.6256, 1e-3);

// ---- row parsing
assert.deepEqual(parseRow('G4 . - | A4', 4), [{ midi: 67 }, null, { off: true }, { midi: 69 }]);
assert.deepEqual(parseRow('K . S H', 4, true), [{ perc: 'K' }, null, { perc: 'S' }, { perc: 'H' }]);
assert.throws(() => parseRow('G4 .', 4), /expected 4/);
assert.throws(() => parseRow('G4 . . X', 4), /bad note/);
assert.throws(() => parseRow('G4 . . .', 4, true), /bad percussion/);

// ---- every phrase in the song parses, and stays in a sensible range
const seq = new Sequencer();
assert.equal(seq.parsed.length, SONG.phrases.length);
for (const [i, parts] of seq.parsed.entries()) {
  assert.equal(parts.length, 4);
  for (const cells of parts) assert.equal(cells.length, SONG.rowsPerPhrase, 'phrase ' + i);
  assert.ok(parts[0][0]?.midi, 'phrase ' + i + ' lead starts on a note');
  for (const cell of parts[0].concat(parts[1])) if (cell?.midi) assert.ok(cell.midi >= 48 && cell.midi <= 84);
  for (const cell of parts[2]) if (cell?.midi) assert.ok(cell.midi >= 36 && cell.midi <= 60, 'bass range');
}
// stages only refer to phrases that exist, and each has four voices and four instruments
for (const [i, st] of SONG.stages.entries()) {
  for (const id of st.phrases) assert.ok(id >= 0 && id < SONG.phrases.length, 'stage ' + i);
  assert.equal(st.voices.length, 4); assert.equal(st.instruments.length, 4);
  st.voices.forEach((on, ch) => { if (on) assert.ok(st.instruments[ch], `stage ${i} channel ${ch}`); });
}
// it builds up: each stage has at least the voices of the one before, and never gets slower
for (let i = 1; i < SONG.stages.length; i++) {
  const a = SONG.stages[i - 1], b = SONG.stages[i];
  a.voices.forEach((on, ch) => { if (on) assert.ok(b.voices[ch], 'voices only grow'); });
  assert.ok(b.bpm >= a.bpm, 'tempo never drops');
  assert.ok(b.phrases.length >= a.phrases.length, 'more of the carol each stage');
}
assert.deepEqual(SONG.stages[0].phrases, [0], 'a night starts with just the opening phrase');
assert.deepEqual(SONG.stages[0].voices, [1, 0, 0, 0]);
assert.equal(SONG.stages.at(-1).phrases.length, SONG.phrases.length, 'the last stage is the whole carol');

// ---- stage from progress
assert.equal(stageFor(0), 0);
assert.equal(stageFor(0.19), 0);
assert.equal(stageFor(0.2), 1);
assert.equal(stageFor(0.5), 2);
assert.equal(stageFor(0.7), 3);
assert.equal(stageFor(0.8), 4);
assert.equal(stageFor(1), 4);

// ---- sequencer: stage changes happen only at phrase boundaries, and the tune carries on
{
  const s = new Sequencer();
  const ids = (n) => Array.from({ length: n }, () => s.nextPhrase().id);
  assert.deepEqual(ids(3), [0, 0, 0], 'stage 0 loops the opening phrase');
  s.setStage(1);
  assert.equal(s.stage, 0, 'a request alone changes nothing');
  assert.equal(s.pending, 1);
  assert.equal(s.nextPhrase().stage, 1, 'it applies at the next boundary');
  assert.equal(s.lastId, 1, 'and continues with the phrase after the one just played');
  assert.deepEqual(ids(3), [0, 1, 0]);
  s.setStage(2);
  assert.equal(s.nextPhrase().id, 1, 'after phrase 0 comes phrase 1');
  s.setStage(3);
  assert.deepEqual(ids(1), [2], 'stage 1 -> 2 -> 3 carries on through the tune');
  assert.deepEqual(ids(7), [3, 4, 5, 6, 7, 0, 1], 'the whole carol loops');
  s.setStage(3); assert.equal(s.pending, null, 'asking for the current stage is a no-op');
  s.setStage(4); s.setStage(3);
  assert.equal(s.pending, null, 'a request can be taken back before the boundary');
  s.setStage(99); assert.equal(s.pending, 4, 'out of range is clamped');
  s.setStage(-5); assert.equal(s.pending, 0);
  assert.equal(s.nextPhrase().stage, 0, 'stages can go down too');
  s.reset(2);
  assert.equal(s.nextPhrase().id, 0, 'a fresh start begins at the first phrase of its stage');
  const p = s.nextPhrase();
  assert.equal(p.bpm, SONG.stages[2].bpm);
  assert.deepEqual(p.voices, SONG.stages[2].voices);
}

// ---- instrument samples
{
  const samples = makeSamples();
  assert.deepEqual(Object.keys(samples), ['bell', 'choir', 'strings', 'bass', 'pluck', 'flute', 'K', 'S', 'H']);
  for (const [name, s] of Object.entries(samples)) {
    assert.ok(s.data.length > 100 && s.data.length < 20000, name + ' is short');
    let peak = 0;
    for (const v of s.data) {
      assert.ok(Number.isFinite(v), name + ' has a bad value');
      assert.ok(Math.abs(v * 127 - Math.round(v * 127)) < 1e-4, name + ' is not 8-bit');
      peak = Math.max(peak, Math.abs(v));
    }
    assert.ok(peak > 0.6 && peak <= 1, `${name} peak ${peak}`);
    if (s.loop) {
      const [a, b] = s.loop;
      assert.ok(a >= 0 && b <= s.data.length && b - a >= 2 * s.period, name + ' loop points');
      // seamless: the step from the last sample back to the first is no bigger than the steps inside
      let maxStep = 0;
      for (let i = 1; i < s.data.length; i++) maxStep = Math.max(maxStep, Math.abs(s.data[i] - s.data[i - 1]));
      assert.ok(Math.abs(s.data[b - 1] - s.data[a]) <= maxStep * 1.05 + 0.02, name + ' loop seam');
    }
  }
  // the bass loop holds a whole number of cycles of its base frequency
  const bass = samples.bass;
  near(bass.baseFreq, SAMPLE_RATE / 168, 1e-9);
  let crossings = 0;
  for (let i = 1; i < bass.data.length; i++) if (bass.data[i - 1] < 0 && bass.data[i] >= 0) crossings++;
  assert.ok(Math.abs(crossings - 8) <= 1, 'bass has 8 cycles, got ' + crossings);
  assert.equal(samples.bell.loop, null, 'the bell rings out; it does not loop');
  assert.equal(makeSamples().strings.data[100], samples.strings.data[100], 'samples are deterministic');
}

// ---- scheduling, against a fake AudioContext
{
  const realSetInterval = globalThis.setInterval, realClear = globalThis.clearInterval;
  globalThis.setInterval = () => 1; globalThis.clearInterval = () => {};   // we pump by hand

  const starts = [];   // every note started: { t, inst, rate, chan }
  let bufCount = 0;
  const INSTRUMENTS = ['bell', 'choir', 'strings', 'bass', 'pluck', 'flute', 'K', 'S', 'H'];
  const param = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} });
  const ctx = {
    currentTime: 0,
    createBuffer: (ch, len) => ({ inst: INSTRUMENTS[bufCount++], length: len, copyToChannel() {} }),
    createGain: () => ({ gain: param(), connect(n) { this.to = n; } }),
    createStereoPanner: () => ({ pan: { value: 0 }, connect(n) { this.to = n; } }),
    createBufferSource() {
      const src = {
        playbackRate: { value: 1 }, connect(n) { src.gainNode = n; }, stop() {},
        start(t) { starts.push({ t, inst: src.buffer.inst, rate: src.playbackRate.value, loop: src.loop }); },
      };
      return src;
    },
  };
  const music = createMusic(ctx, { connect() {} });
  const bpm0 = SONG.stages[0].bpm, row0 = 60 / bpm0 / 2;

  music.restart(0);
  // stage 0: only the bell lead plays, on the rows where P0's lead has notes
  const lead = SONG.phrases[0].lead.replace(/\|/g, ' ').trim().split(/\s+/);
  const expected = lead.map((t, r) => (t !== '.' && t !== '-' ? { r, midi: noteToMidi(t) } : null)).filter(Boolean);
  assert.equal(starts.length, expected.length, 'stage 0 plays only the lead');
  const t0 = 0.12;
  expected.forEach((e, i) => {
    near(starts[i].t, t0 + e.r * row0, 1e-9);
    assert.equal(starts[i].inst, 'bell');
    near(starts[i].rate, midiToFreq(e.midi) / (SAMPLE_RATE / 42), 1e-9);
  });
  const phraseLen0 = 16 * row0;

  // nothing more is scheduled until the next phrase is about to start
  ctx.currentTime = 2; music.pump();
  assert.equal(starts.length, expected.length);
  // ask for stage 1 in the middle of the phrase: still nothing changes
  music.setStage(1);
  assert.equal(music.pendingStage, 1);
  ctx.currentTime = 5; music.pump();
  assert.equal(starts.length, expected.length, 'nothing is scheduled early');
  // as the boundary approaches, the next phrase is scheduled with the new stage
  const boundary = t0 + phraseLen0;
  ctx.currentTime = boundary - 0.2; music.pump();
  assert.equal(music.stage, 1, 'the stage changed at the boundary');
  assert.equal(music.pendingStage, null);
  const fresh = starts.slice(expected.length);
  assert.ok(fresh.length > 0);
  for (const n of fresh) assert.ok(n.t >= boundary - 1e-9, 'no new-stage note starts before the boundary');
  assert.equal(fresh[0].inst, 'bell');
  near(fresh[0].t, boundary, 1e-9);
  near(fresh[0].rate, midiToFreq(noteToMidi('B4')) / (SAMPLE_RATE / 42), 1e-9);   // phrase 1 follows phrase 0
  assert.ok(fresh.some((n) => n.inst === 'bass'), 'stage 1 adds the bass');
  assert.ok(!fresh.some((n) => n.inst === 'strings' || n.inst === 'K'), 'but not the later voices');
  const bass = fresh.find((n) => n.inst === 'bass');
  assert.equal(bass.loop, true, 'sustained instruments loop');
  near(bass.rate, midiToFreq(noteToMidi('G2')) / (SAMPLE_RATE / 168), 1e-9);

  // the following phrase starts one stage-1 phrase length later (the tempo changed too)
  const row1 = 60 / SONG.stages[1].bpm / 2;
  const before = starts.length;
  ctx.currentTime = boundary + 16 * row1 - 0.2; music.pump();
  assert.ok(starts.length > before);
  near(starts[before].t, boundary + 16 * row1, 1e-9);

  // climb to the last stage, and the choir and percussion join in at the boundary
  music.setStage(4);
  const b2 = boundary + 16 * row1;
  const phraseNow = 16 * row1;
  ctx.currentTime = b2 + phraseNow - 0.2; music.pump();     // phrase after this one
  assert.equal(music.stage, 4);
  const late = starts.filter((n) => n.t >= b2 + phraseNow - 1e-9);
  assert.ok(late.some((n) => n.inst === 'choir') && late.some((n) => n.inst === 'strings') && late.some((n) => n.inst === 'K' || n.inst === 'H'));
  assert.ok(!late.some((n) => n.inst === 'bell'), 'the choir takes over the lead');

  // a restart cuts to a fresh start at stage 0
  ctx.currentTime = 100; starts.length = 0;
  music.restart(0);
  assert.equal(music.stage, 0);
  assert.equal(starts.length, expected.length);
  near(starts[0].t, 100.12, 1e-9);
  assert.equal(music.running, true);
  music.stop(0);
  assert.equal(music.running, false);
  music.pump(); assert.equal(starts.length, expected.length, 'nothing is scheduled after stop');

  globalThis.setInterval = realSetInterval; globalThis.clearInterval = realClear;
}

// ---- the boss theme: a valid song, in range, that really grows out of the arrival stinger
{
  const seq = new Sequencer(BOSS_SONG);
  assert.equal(seq.parsed.length, BOSS_SONG.phrases.length);
  for (const [i, parts] of seq.parsed.entries()) {
    for (const cells of parts) assert.equal(cells.length, BOSS_SONG.rowsPerPhrase, 'boss phrase ' + i);
    assert.ok(parts[0][0]?.midi, 'boss phrase ' + i + ' starts on a note');
    for (const cell of parts[0].concat(parts[1])) if (cell?.midi) assert.ok(cell.midi >= 48 && cell.midi <= 84, 'lead and harmony range');
    for (const cell of parts[2]) if (cell?.midi) assert.ok(cell.midi >= 36 && cell.midi <= 60, 'bass range');
  }
  for (const [i, st] of BOSS_SONG.stages.entries()) {
    for (const id of st.phrases) assert.ok(id >= 0 && id < BOSS_SONG.phrases.length, 'boss stage ' + i);
    st.voices.forEach((on, ch) => { if (on) assert.ok(st.instruments[ch], `boss stage ${i} channel ${ch}`); });
    if (i) {
      const a = BOSS_SONG.stages[i - 1];
      assert.ok(st.bpm > a.bpm, 'it gets faster as Frosty is hurt');
      a.voices.forEach((on, ch) => { if (on) assert.ok(st.voices[ch], 'and fuller'); });
    }
  }
  assert.equal(BOSS_SONG.stages.length, BOSS_THRESHOLDS.length);
  assert.deepEqual(BOSS_SONG.stages[0].phrases.slice(0, 1), [0], 'the fight opens on the stinger\'s own figure');
  assert.equal(BOSS_SONG.stages[0].bpm, STINGERS.frostyArrive.bpm, 'at the stinger\'s tempo, so the stinger runs straight into it');
  // phrase A's lead is the stinger's notes, on the same beats (a row is half a beat), an octave up
  const lead = seq.parsed[0][0];
  const motif = STINGERS.frostyArrive.notes;
  for (const [midi, beat] of motif) {
    const cell = lead[Math.round(beat * 2)];
    assert.ok(cell && cell.midi === midi + 12, `the stinger's note ${midi} at beat ${beat} is in the theme (an octave up)`);
  }
  assert.equal(lead.filter((c) => c && c.midi).length, motif.length, 'and nothing else is in that phrase');
  // the boss theme's lead is brought forward with a per-channel gain
  {
    const samples = makeSamples();
    const phrase = new Sequencer(BOSS_SONG).nextPhrase();
    const lead = phraseEvents(phrase, 0, samples).events.find((e) => e.ch === 0);
    near(lead.vol, 0.30 * BOSS_SONG.stages[0].gains[0], 1e-9);
    const plain = new Sequencer(SONG).nextPhrase();
    assert.equal(plain.gains, undefined, 'the carol has no gains, so its balance is unchanged');
  }
  assert.equal(stageFor(0, BOSS_THRESHOLDS), 0);
  assert.equal(stageFor(0.5, BOSS_THRESHOLDS), 1);
  assert.equal(stageFor(0.9, BOSS_THRESHOLDS), 2);
  assert.ok(stingerLength('frostyArrive') > 2.7 && stingerLength('frostyArrive') < 2.9, 'the stinger lasts about 2.8 s');
  assert.equal(stingerLength('nope'), 0);
}

// ---- stingers: the note data
{
  const samples = makeSamples();
  const st = STINGERS.frostyArrive;
  assert.equal(st.bpm, 149, 'the tempo of frosty-arrive.mid');
  assert.equal(st.notes.length, 11, 'its eleven notes');
  const { events, length } = stingerEvents(st, 10, samples);
  const loud = st.notes.filter((n) => n[3] >= 95).length;
  assert.equal(events.length, 11 + 11 + loud, 'strings and bass on every note, the bell on the loud ones');
  const beat = 60 / 149;
  near(events[0].when, 10);
  near(length, (6 + 0.979) * beat, 1e-9);
  const strings = events.filter((e) => e.sample === 'strings');
  near(strings[0].rate, midiToFreq(45 + 12) / samples.strings.baseFreq, 1e-9);         // the first note is A2, played an octave up
  near(strings[3].when, 10 + 2 * beat, 1e-9);
  const bells = events.filter((e) => e.sample === 'bell');
  assert.equal(bells.length, loud);
  near(bells[0].rate, midiToFreq(45 + 24) / samples.bell.baseFreq, 1e-9);               // two octaves up
  for (const e of events) {
    assert.ok(Number.isFinite(e.rate) && e.rate > 0.3 && e.rate < 6, 'rate ' + e.rate);
    assert.ok(e.vol > 0 && e.vol < 3 && e.duration > 0 && e.ch >= 0 && e.ch < 4);
  }
  // quieter notes are quieter
  const bass = events.filter((e) => e.sample === 'bass');
  near(bass[0].rate, midiToFreq(45) / samples.bass.baseFreq, 1e-9);                        // the bass plays it as written
  assert.ok(bass[1].vol < bass[0].vol, 'a velocity 60 note is softer than a velocity 100 one');
}

// ---- Mary's stinger: from mary.mid
{
  const samples = makeSamples();
  const st = STINGERS.maryArrive;
  assert.equal(st.bpm, 113, 'the tempo of mary.mid');
  assert.equal(st.notes.length, 19, 'its nineteen notes');
  const { events, length } = stingerEvents(st, 0, samples);
  near(length, (9.75 + 0.24) * (60 / 113), 0.02);
  assert.ok(length > 5 && length < 5.6, 'about 5.3 s: ' + length);
  const loud = st.notes.filter((n) => n[3] >= 95).length;
  assert.equal(events.length, 19 + 19 + loud);
  for (const e of events) assert.ok(Number.isFinite(e.rate) && e.rate > 0.3 && e.rate < 6 && e.vol > 0 && e.vol < 4, 'rate ' + e.rate + ' vol ' + e.vol);
  assert.equal(stingerLength('maryArrive'), length);
  for (const [midi] of st.notes) assert.ok(midi >= 36 && midi <= 48, 'low, like Frosty\'s: ' + midi);
}

// ---- stingers: played over the music, which ducks and then comes back
{
  const realSetInterval = globalThis.setInterval, realClear = globalThis.clearInterval, realTimeout = globalThis.setTimeout, realClearT = globalThis.clearTimeout;
  globalThis.setInterval = () => 1; globalThis.clearInterval = () => {};
  const timers = [];
  globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  globalThis.clearTimeout = () => {};
  const starts = [], ramps = [];
  let bufCount = 0;
  const INSTRUMENTS = ['bell', 'choir', 'strings', 'bass', 'pluck', 'flute', 'K', 'S', 'H'];
  const param = (log) => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime(v) { log?.push(v); }, cancelScheduledValues() {} });
  let gains = 0;
  const ctx = {
    currentTime: 5,
    createBuffer: () => ({ inst: INSTRUMENTS[bufCount++], copyToChannel() {} }),
    createGain: () => ({ gain: param(gains++ === 0 ? ramps : null), connect() {} }),   // the first gain made is the music bus
    createStereoPanner: () => ({ pan: { value: 0 }, connect() {} }),
    createBufferSource() {
      const src = { playbackRate: { value: 1 }, connect() {}, stop() {}, start(t) { starts.push({ t, inst: src.buffer.inst }); } };
      return src;
    },
  };
  const music = createMusic(ctx, { connect() {} }, { baseGain: 0.6 });
  music.stinger('frostyArrive');
  assert.equal(starts.length, 0, 'nothing while the music is not running');
  music.restart(0);
  const before = starts.length;
  ramps.length = 0; timers.length = 0;
  music.stinger('nope');
  assert.equal(starts.length, before, 'an unknown stinger does nothing');
  music.stinger('frostyArrive');
  const added = starts.slice(before);
  assert.ok(added.length > 20, 'the stinger plays its notes: ' + added.length);
  near(added[0].t, 5.05, 1e-9);
  assert.ok(added.some((n) => n.inst === 'strings') && added.some((n) => n.inst === 'bass') && added.some((n) => n.inst === 'bell'));
  near(ramps.at(-1), 0.6 * 0.35, 1e-9);                                  // the music ducks
  assert.equal(timers.length, 1);
  assert.ok(timers[0].ms > 3000 && timers[0].ms < 3600, 'and comes back after the stinger: ' + timers[0].ms);
  timers[0].fn();
  near(ramps.at(-1), 0.6, 1e-9);
  music.setDuck(0.3);
  near(ramps.at(-1), 0.6 * 0.3, 1e-9);
  music.stop(0);
  globalThis.setInterval = realSetInterval; globalThis.clearInterval = realClear;
  globalThis.setTimeout = realTimeout; globalThis.clearTimeout = realClearT;
}

console.log('music: all tests passed');
