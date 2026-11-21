// A small four-channel sample player in the spirit of an Amiga tracker, on the Web Audio API.
//
//   music-data.js   the song: pattern strings and the stage table
//   Sequencer       decides which phrase plays next and when stages change (pure, no audio)
//   makeSamples()   builds the instrument samples in code: short mono 8-bit samples at a low
//                   sample rate, with loop points for the sustained ones (pure, no audio)
//   createMusic()   plays it: each note is a looped sample at a playback rate, like a tracker's period
//
// The game picks a stage from its progress; the Sequencer only changes stage at a phrase
// boundary, so the music always changes on the beat.

import { SONG } from './music-data.js';

/** @typedef {typeof SONG} Song */
/** @typedef {import('./music-data.js').Instrument} Instrument */
/** @typedef {'K' | 'S' | 'H'} Perc  kick, snare, hi-hat */
/** @typedef {'bell' | 'choir' | 'strings' | 'bass'} Pitched */
/** @typedef {Pitched | Perc} SampleName */

/**
 * One row of one channel in a pattern: null (the previous note carries on), a note-off,
 * a note, or a percussion hit.
 * @typedef {null | { off: true } | { midi: number } | { perc: Perc }} Cell
 */

/**
 * A phrase ready to play, from Sequencer.nextPhrase().
 * @typedef {object} Phrase
 * @property {number} id
 * @property {number} stage
 * @property {number} bpm
 * @property {number} rows
 * @property {Cell[][]} parts                    one list of cells per channel
 * @property {number[]} voices                   1 if that channel plays
 * @property {(Instrument | null)[]} instruments
 */

/**
 * An instrument sample, as mono floats quantised to 8 bits.
 * @typedef {object} Sample
 * @property {Float32Array<ArrayBuffer>} data
 * @property {number} period                    in samples (0: unpitched)
 * @property {[number, number] | null} loop     loop start and end, in samples; null: one shot
 * @property {number} baseFreq                   the pitch it plays at a playback rate of 1
 */

/** @typedef {{ attack: number, release: number, gain: number, ring?: boolean }} Voicing */

/**
 * One note to play.
 * @typedef {object} NoteEvent
 * @property {number} ch
 * @property {SampleName} sample
 * @property {number} when       seconds
 * @property {number} duration
 * @property {number} rate       playback rate
 * @property {number} vol
 * @property {Voicing | null} voicing
 */

/**
 * The parts of an AudioContext the player uses. Old browsers may lack a stereo panner
 * and AudioBuffer.copyToChannel, so those are optional here and checked before use.
 * @typedef {Omit<BaseAudioContext, 'createStereoPanner'> & { createStereoPanner?: BaseAudioContext['createStereoPanner'] }} AudioCtx
 */

export const SAMPLE_RATE = 11025;
export const CHANNELS = 4;

// ---------------------------------------------------------------- notes and patterns
const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// "C#4" -> 61, or null if it isn't a note name.
/** @param {string} name @returns {number | null} */
export function noteToMidi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return null;
  const letter = /** @type {keyof typeof SEMITONE} */ (m[1]);
  return 12 * (Number(m[3]) + 1) + SEMITONE[letter] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
/** @param {number} midi */
export const midiToFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);

// "G4 . . - K" -> one cell per row: null (continue), { off: true }, { midi } or { perc }.
/** @param {string} text @param {number} rows @returns {Cell[]} */
export function parseRow(text, rows, percussion = false) {
  const tokens = text.replace(/\|/g, ' ').trim().split(/\s+/);
  if (tokens.length !== rows) throw new Error(`pattern has ${tokens.length} rows, expected ${rows}: "${text}"`);
  return tokens.map(/** @returns {Cell} */ (t) => {
    if (t === '.') return null;
    if (t === '-') return { off: true };
    if (percussion) {
      if (t === 'K' || t === 'S' || t === 'H') return { perc: t };
      throw new Error(`bad percussion token "${t}"`);
    }
    const midi = noteToMidi(t);
    if (midi === null) throw new Error(`bad note "${t}"`);
    return { midi };
  });
}

// Which stage a night's progress (food delivered / food needed) calls for.
/** @param {number} progress @param {readonly number[]} [thresholds] */
export function stageFor(progress, thresholds = SONG.thresholds) {
  let stage = 0;
  for (let i = 0; i < thresholds.length; i++) if (progress >= thresholds[i]) stage = i;
  return stage;
}

// ---------------------------------------------------------------- the sequencer
export class Sequencer {
  /** @param {Song} [song] */
  constructor(song = SONG) {
    this.song = song;
    this.stage = 0;
    /** @type {number | null} a stage asked for, to start at the next phrase */
    this.pending = null;
    /** @type {number | null} the phrase played last */
    this.lastId = null;
    this.parsed = song.phrases.map((p) => [
      parseRow(p.lead, song.rowsPerPhrase), parseRow(p.harm, song.rowsPerPhrase),
      parseRow(p.bass, song.rowsPerPhrase), parseRow(p.perc, song.rowsPerPhrase, true),
    ]);
    this.reset(0);
  }

  reset(stage = 0) {
    this.stage = stage;
    this.pending = null;
    this.lastId = null;
  }

  // Ask for a stage. It takes effect at the next phrase boundary, not before.
  /** @param {number} n */
  setStage(n) {
    n = Math.max(0, Math.min(this.song.stages.length - 1, n | 0));
    this.pending = n === this.stage ? null : n;
  }

  // The phrase to play next. Called once per phrase, at its boundary.
  /** @returns {Phrase} */
  nextPhrase() {
    if (this.pending !== null) { this.stage = this.pending; this.pending = null; }
    const st = this.song.stages[this.stage];
    // Carry on from wherever the tune had got to: the phrase after the last one, in this stage's list.
    let i = 0;
    if (this.lastId !== null) {
      const at = st.phrases.indexOf(this.lastId);
      i = at < 0 ? 0 : (at + 1) % st.phrases.length;
    }
    const id = st.phrases[i];
    this.lastId = id;
    return {
      id, stage: this.stage, bpm: st.bpm, rows: this.song.rowsPerPhrase,
      parts: this.parsed[id], voices: st.voices, instruments: st.instruments,
    };
  }
}

// ---------------------------------------------------------------- instrument samples
const TAU = Math.PI * 2;
/** @param {number} v */
const quantize8 = (v) => Math.round(Math.max(-1, Math.min(1, v)) * 127) / 127;   // 8-bit, as on the Amiga

// A pitched, looped sample: a sum of partials. Every partial completes a whole number of cycles
// over the loop, so the loop is seamless. `chorus` adds partials one cycle either side of each
// partial (about 13 cents apart) for a slow shimmer that still loops cleanly.
/**
 * @param {number} periodSamples @param {number} cycles
 * @param {(f: number, k: number) => number} amp  loudness of partial k, at frequency f
 * @param {boolean} chorus
 * @returns {Sample}
 */
function loopedTone(periodSamples, cycles, amp, chorus) {
  const length = periodSamples * cycles;
  const data = new Float32Array(length);
  const base = SAMPLE_RATE / periodSamples;
  for (let k = 1; base * k < SAMPLE_RATE / 2 - 400; k++) {
    const a = amp(base * k, k);
    if (a < 0.002) continue;
    const partials = chorus ? [[cycles * k, 1], [cycles * k + 1, 0.55], [cycles * k - 1, 0.55]] : [[cycles * k, 1]];
    for (const [c, w] of partials) {
      for (let i = 0; i < length; i++) data[i] += a * w * Math.sin((TAU * c * i) / length + k * 0.7);
    }
  }
  return { data, period: periodSamples, loop: [0, length], baseFreq: base };
}

/** @param {number} f @param {number} centre @param {number} bw */
const formant = (f, centre, bw) => Math.exp(-(((f - centre) / bw) ** 2));

/** @param {Sample} s */
function normalise(s, peak = 0.9) {
  let m = 1e-9;
  for (const v of s.data) m = Math.max(m, Math.abs(v));
  for (let i = 0; i < s.data.length; i++) s.data[i] = quantize8((s.data[i] / m) * peak);
  return s;
}

// A tiny deterministic noise source, so the samples are the same every time.
function noiseSource(seed = 12345) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/** @returns {Record<SampleName, Sample>} */
export function makeSamples() {
  const P = 42;   // period in samples: 262.5 Hz at 11025 Hz, a hair above middle C

  // choir "aah": harmonics shaped by three vowel formants, with chorus
  const choir = loopedTone(P, 128, (f, k) => (formant(f, 800, 280) + 0.7 * formant(f, 1200, 300) + 0.25 * formant(f, 2800, 500)) / Math.pow(k, 0.55), true);

  // strings: a bowed saw (partials fall off gently), with chorus
  const strings = loopedTone(P, 128, (f, k) => 1 / Math.pow(k, 1.15) * (f < 3500 ? 1 : 0.4), true);

  // bass: warm and round, one octave and a bit lower (65.6 Hz)
  const bass = loopedTone(168, 8, (f, k) => (k === 1 ? 1 : k === 2 ? 0.55 : k === 3 ? 0.25 : k === 4 ? 0.1 : 0), false);

  // bell: FM, one shot (no loop), ringing for 1.4 s
  const n = Math.floor(1.4 * SAMPLE_RATE), f0 = SAMPLE_RATE / P;
  const bellData = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE, env = Math.exp(-3.2 * t) * Math.min(1, t / 0.002), idx = 3.5 * Math.exp(-2.6 * t);
    bellData[i] = env * (0.7 * Math.sin(TAU * f0 * t + idx * Math.sin(TAU * f0 * 3.5 * t)) + 0.3 * Math.sin(TAU * f0 * 2 * t));
  }
  /** @type {Sample} */
  const bell = { data: bellData, period: P, loop: null, baseFreq: f0 };

  // percussion: unpitched one-shots, played at their natural rate
  const rand = noiseSource();
  const kickData = new Float32Array(Math.floor(0.22 * SAMPLE_RATE));
  for (let i = 0, ph = 0; i < kickData.length; i++) {
    const t = i / SAMPLE_RATE;
    ph += (48 + 110 * Math.exp(-t * 28)) / SAMPLE_RATE;
    kickData[i] = Math.sin(TAU * ph) * Math.exp(-t * 16);
  }
  const snareData = new Float32Array(Math.floor(0.17 * SAMPLE_RATE));
  for (let i = 0, y = 0; i < snareData.length; i++) {
    const t = i / SAMPLE_RATE;
    y += 0.55 * (rand() - y);
    snareData[i] = (0.75 * y + 0.35 * Math.sin(TAU * 190 * t)) * Math.exp(-t * 24);
  }
  const hatData = new Float32Array(Math.floor(0.05 * SAMPLE_RATE));
  for (let i = 0, y = 0, z = 0; i < hatData.length; i++) {
    const t = i / SAMPLE_RATE;
    const x = rand(); y += 0.9 * (x - y); z += 0.2 * (y - z);   // crude high-pass
    hatData[i] = (y - z) * Math.exp(-t * 70);
  }
  /** @param {Float32Array<ArrayBuffer>} data @returns {Sample} */
  const unpitched = (data) => ({ data, period: 0, loop: null, baseFreq: 0 });

  return {
    bell: normalise(bell), choir: normalise(choir), strings: normalise(strings), bass: normalise(bass),
    K: normalise(unpitched(kickData)), S: normalise(unpitched(snareData)), H: normalise(unpitched(hatData), 0.7),
  };
}

// How each instrument is shaped over a note's length, and how loud and where it sits.
/** @type {Record<Pitched, Voicing>} */
export const VOICING = {
  bell:    { attack: 0.002, release: 0.18, gain: 1.0,  ring: true },   // rings out on its own
  choir:   { attack: 0.18,  release: 0.35, gain: 0.85 },
  strings: { attack: 0.14,  release: 0.30, gain: 0.30 },
  bass:    { attack: 0.01,  release: 0.10, gain: 0.30 },
};
/** @type {Record<Perc, number>} */
export const PERC_GAIN = { K: 0.5, S: 0.28, H: 0.15 };
export const MUSIC_GAIN = 0.6;   // overall music level; sound effects sit on top of it
export const PAN = [-0.55, 0.55, 0.55, -0.55];   // Amiga style: channels 0 and 3 left, 1 and 2 right

// Every note of one phrase, as plain data: { ch, sample, when, duration, rate, vol, voicing }.
// The player below turns these into Web Audio nodes; tools/render_music.mjs mixes them to a file.
/** @param {Phrase} phrase @param {number} t0 @param {Record<SampleName, Sample>} samples */
export function phraseEvents(phrase, t0, samples) {
  const rowDur = 60 / phrase.bpm / 2;
  /** @type {NoteEvent[]} */
  const events = [];
  for (let ch = 0; ch < CHANNELS; ch++) {
    if (!phrase.voices[ch]) continue;
    const cells = phrase.parts[ch];
    const name = phrase.instruments[ch];
    for (let r = 0; r < phrase.rows; r++) {
      const cell = cells[r];
      if (!cell || 'off' in cell) continue;
      const when = t0 + r * rowDur;
      if ('perc' in cell) { events.push({ ch, sample: cell.perc, when, duration: 0.25, rate: 1, vol: PERC_GAIN[cell.perc], voicing: null }); continue; }
      if (!name || name === 'perc') continue;         // a note on a channel with no pitched instrument
      let e = r + 1;                                  // the note lasts until the next event on this channel
      while (e < phrase.rows && !cells[e]) e++;
      const v = VOICING[name];
      const dur = (e - r) * rowDur;
      events.push({
        ch, sample: name, when, duration: v.ring ? Math.min(dur + 0.25, 1.4) : dur,
        rate: midiToFreq(cell.midi) / samples[name].baseFreq, vol: v.gain, voicing: v,
      });
    }
  }
  return { events, length: phrase.rows * rowDur };
}

// ---------------------------------------------------------------- the player
// ctx: an AudioContext (or anything shaped like one). out: the node to connect to.
/** @param {AudioCtx} ctx @param {AudioNode} out @param {{ song?: Song, baseGain?: number }} [opts] */
export function createMusic(ctx, out, { song = SONG, baseGain = MUSIC_GAIN } = {}) {
  const seq = new Sequencer(song);
  const samples = makeSamples();
  /** @type {Partial<Record<SampleName, AudioBuffer>>} */
  const buffers = {};
  for (const name of /** @type {SampleName[]} */ (Object.keys(samples))) {
    const s = samples[name];
    const b = ctx.createBuffer(1, s.data.length, SAMPLE_RATE);
    if (typeof b.copyToChannel === 'function') b.copyToChannel(s.data, 0); else b.getChannelData(0).set(s.data);
    buffers[name] = b;
  }

  const bus = ctx.createGain();
  bus.gain.value = baseGain;
  bus.connect(out);
  /** @type {GainNode[]} one gain per channel */
  const chan = [];
  for (let c = 0; c < CHANNELS; c++) {
    const g = ctx.createGain();
    /** @type {AudioNode} */
    let node = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = PAN[c];
      g.connect(p);
      node = p;
    }
    node.connect(bus);
    chan.push(g);
  }

  const LOOKAHEAD = 0.3, TICK_MS = 60;
  /** @type {ReturnType<typeof setInterval> | null} */
  let timer = null;
  let nextTime = 0, running = false, duck = 1, phraseCount = 0;
  /** @type {Set<{ src: AudioBufferSourceNode, g: GainNode }>} */
  let live = new Set();   // notes that may still be sounding, so we can cut them on restart or stop

  /**
   * @param {SampleName} sampleName @param {number} when @param {number} duration @param {number} rate
   * @param {number} vol @param {number} ch @param {Voicing | null} voicing
   */
  function voice(sampleName, when, duration, rate, vol, ch, voicing) {
    const src = ctx.createBufferSource();
    src.buffer = buffers[sampleName] ?? null;
    src.playbackRate.value = rate;
    const s = samples[sampleName];
    if (s.loop) {
      src.loop = true;
      src.loopStart = s.loop[0] / SAMPLE_RATE;
      src.loopEnd = s.loop[1] / SAMPLE_RATE;
    }
    const g = ctx.createGain();
    const { attack = 0.002, release = 0.05 } = voicing || {};
    const end = when + Math.max(duration, attack + 0.02);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + attack);
    g.gain.setValueAtTime(vol, Math.max(when + attack, end - release));
    g.gain.linearRampToValueAtTime(0, end);
    src.connect(g);
    g.connect(chan[ch]);
    src.start(when);
    src.stop(end + 0.02);
    const note = { src, g };
    live.add(note);
    src.onended = () => live.delete(note);
  }

  // Schedule every note of one phrase, starting at time t0. Returns the phrase's length in seconds.
  /** @param {Phrase} phrase @param {number} t0 */
  function schedule(phrase, t0) {
    const { events, length } = phraseEvents(phrase, t0, samples);
    for (const e of events) voice(e.sample, e.when, e.duration, e.rate, e.vol, e.ch, e.voicing);
    return length;
  }

  function pump() {
    while (running && nextTime < ctx.currentTime + LOOKAHEAD) {
      const phrase = seq.nextPhrase();   // a pending stage change is applied here, at the boundary
      nextTime += schedule(phrase, nextTime);
      phraseCount++;
    }
  }

  /** @param {number} value */
  function setBus(value, seconds = 0.15) {
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues?.(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(value, t + seconds);
  }

  function cutAll(seconds = 0.05) {
    const t = ctx.currentTime;
    for (const { src, g } of live) {
      try { g.gain.cancelScheduledValues?.(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + seconds); src.stop(t + seconds + 0.01); } catch { /* already ended */ }
    }
    live = new Set();
  }

  return {
    // Start (or restart) from the beginning of a stage, at once.
    restart(stage = 0) {
      cutAll(0.08);
      seq.reset(stage);
      nextTime = ctx.currentTime + 0.12;
      running = true;
      setBus(baseGain * duck, 0.05);
      if (!timer) timer = setInterval(pump, TICK_MS);
      pump();
    },
    // Ask for a stage; it begins at the next phrase boundary.
    /** @param {number} n */
    setStage(n) { seq.setStage(n); },
    /** @param {number} v  music level while ducked, 0..1 */
    setDuck(v) { duck = v; if (running) setBus(baseGain * duck, 0.25); },
    stop(seconds = 0.6) {
      if (!running) return;
      running = false;
      setBus(0, seconds);
      if (timer) clearInterval(timer);
      timer = null;
      setTimeout(() => cutAll(0.02), seconds * 1000 + 30);
    },
    pump,   // exposed for tests
    get running() { return running; },
    get stage() { return seq.stage; },
    get pendingStage() { return seq.pending; },
    get phrasesScheduled() { return phraseCount; },
  };
}
