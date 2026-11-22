// Sound for the game: sampled effects, plus the adaptive music from music.js.
//
// Nothing here touches the Web Audio API until the first key press or click, because browsers
// refuse to play sound before then. Until that moment every call is a harmless no-op.
// The game talks to it through a few calls: handle(events), onState(...), setProgress(...).

import { createMusic, stageFor, stingerLength } from './music.js';
import { SONG, BOSS_SONG, BOSS_THRESHOLDS } from './music-data.js';
import { arrangement } from './arrange.js';

// Effects in audio/sfx/, with how loud each plays (the files are all normalised, but not equally loud to the ear).
export const SFX = {
  swing: 0.55, hit: 0.85, kill: 0.9, hurt: 1.0, recruit: 0.8, pageDie: 0.9, pickup: 0.75,
  foodDrop: 0.75, deliver: 0.85, nightComplete: 0.9, gameover: 1.0, partridge: 0.9,
  menuMove: 0.6, menuSelect: 0.7,
  frostyWarn: 0.85, frostyRoll: 0.7, frostyCrash: 1.0,
  ghostScream: 0.8, iceStrike: 0.9, lightning: 1.0,
};
/** @typedef {keyof typeof SFX} SfxName */
const SFX_NAMES = /** @type {SfxName[]} */ (Object.keys(SFX));

// Game event -> effect. Events without an entry (such as 'pageHurt') are silent.
/** @type {Record<string, SfxName | undefined>} */
const EVENT_SFX = {
  ...Object.fromEntries(SFX_NAMES.map(/** @returns {[string, SfxName]} */ (n) => [n, n])),   // each effect's own event
  wolfSteal: 'foodDrop',   // the food is lost
  arrowShoot: 'swing',     // an archer looses an arrow
  arrowHit: 'hit',         // an arrow hits a page or a tree (Wenceslas has his own hurt sound)
};
const VARIED = new Set(['swing', 'hit', 'pickup', 'foodDrop', 'deliver']);   // a touch of pitch variation
// Each boss's arrival stinger (see STINGERS in music-data.js); a boss with none gets the theme at once.
/** @type {Record<string, string | undefined>} */
const BOSS_STINGER = { frosty: 'frostyArrive', mary: 'maryArrive' };
const MAX_AT_ONCE = 4;                                                       // per effect, so nothing machine-guns

const MUTE_KEY = 'wenceslas.muted';

/** @typedef {{ run: false } | { run: true, stage: number | null, duck: number }} MusicPlan */

// What the music should be doing in each game state. stage: null leaves the current stage alone.
// boss: while Frosty is out, how much of his health is left (0 to 1), else null. Then the boss theme
// plays, and the more damage he has taken the later its stage.
/** @param {string} state @param {number} [progress] @param {number | null} [boss] @returns {MusicPlan} */
export function musicPlan(state, progress = 0, boss = null) {
  switch (state) {
    case 'play':     return { run: true, stage: boss === null ? stageFor(progress) : stageFor(1 - boss, BOSS_THRESHOLDS), duck: 1 };
    case 'paused':   return { run: true, stage: null, duck: 0.3 };
    case 'nightEnd': return { run: true, stage: 4, duck: 0.8 };      // the whole carol, in celebration
    case 'ending':   return { run: true, stage: 4, duck: 1 };
    case 'gameover': return { run: false };
    default:         return { run: true, stage: 1, duck: 0.7 };      // title, high scores, name entry: calm
  }
}

/** @param {BaseAudioContext} ctx @param {SfxName} name @returns {Promise<AudioBuffer>} */
async function defaultLoad(ctx, name) {
  const res = await fetch(new URL(`../audio/sfx/${name}.wav`, import.meta.url));
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const bytes = await res.arrayBuffer();
  return new Promise((resolve, reject) => {
    // The callback form works in every browser, including old Safari.
    // Old Safari returns nothing here rather than a promise.
    const p = /** @type {Promise<AudioBuffer> | undefined} */ (ctx.decodeAudioData(bytes, resolve, reject));
    p?.then(resolve, reject);
  });
}

/**
 * Everything is injectable, so the module can be tested with a fake AudioContext.
 * @typedef {object} AudioOptions
 * @property {(new () => AudioContext) | undefined} [AudioContextClass]  undefined: no audio here
 * @property {(ctx: AudioContext, name: SfxName) => Promise<AudioBuffer> | AudioBuffer} [load]
 * @property {Pick<Storage, 'getItem' | 'setItem'> | null} [storage]       for the mute setting
 */

/** @param {AudioOptions} [opts] */
export function createAudio({
  AudioContextClass = globalThis.AudioContext || /** @type {{ webkitAudioContext?: typeof AudioContext }} */ (globalThis).webkitAudioContext,
  load = defaultLoad,
  storage = (() => { try { return globalThis.localStorage; } catch { return null; } })(),
} = {}) {
  // All made at the first key press or click (see unlock), and null until then.
  /** @type {AudioContext | null} */
  let ctx = null;
  /** @type {GainNode | null} */
  let master = null;
  /** @type {GainNode | null} */
  let sfxBus = null;
  /** @type {ReturnType<typeof createMusic> | null} */
  let music = null;
  /** @type {Partial<Record<SfxName, AudioBuffer>>} */
  const buffers = {};
  /** @type {Partial<Record<SfxName, number>>} how many of each effect are sounding */
  const playing = {};
  /** @type {{ state: string, progress: number, boss: number | null }} boss: Frosty's health left (0 to 1) while he is out */
  const cur = { state: 'title', progress: 0, boss: null };
  let nightSong = SONG;   // the arrangement for the night being played; the menus always use SONG
  // The arrangement a state plays: the night's own while playing it, the classic one around the menus.
  /** @param {string} state */
  const songFor = (state) => (state === 'play' || state === 'paused' || state === 'nightEnd' || state === 'ending' ? nightSong : SONG);
  let muted = false;
  try { muted = storage?.getItem(MUTE_KEY) === '1'; } catch { /* storage unavailable */ }

  function applyMute() { if (master) master.gain.value = muted ? 0 : 1; }

  function applyPlan() {
    if (!music) return;
    const plan = musicPlan(cur.state, cur.progress, cur.boss);
    if (!plan.run) { music.stop(0.4); return; }
    if (!music.running) music.restart(plan.stage ?? 1, songFor(cur.state));
    else if (plan.stage !== null) music.setStage(plan.stage);
    music.setDuck(plan.duck);
  }

  function unlock() {
    if (!AudioContextClass) return;
    if (ctx) { if (ctx.state !== 'running') ctx.resume?.(); return; }
    try {
      ctx = new AudioContextClass();
      ctx.resume?.();
      master = ctx.createGain();
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(master);
      applyMute();
      music = createMusic(ctx, master);
      applyPlan();
      for (const name of SFX_NAMES) {
        Promise.resolve(load(ctx, name)).then((b) => { buffers[name] = b; }).catch(() => { /* that effect stays silent */ });
      }
    } catch {
      ctx = null;   // audio isn't available here; carry on without it
    }
  }

  /** @param {SfxName} name */
  function playSfx(name) {
    const buf = buffers[name];
    if (!ctx || !sfxBus || muted || !buf) return;
    if ((playing[name] || 0) >= MAX_AT_ONCE) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (VARIED.has(name)) src.playbackRate.value = 0.96 + Math.random() * 0.08;
    const g = ctx.createGain();
    g.gain.value = SFX[name];
    src.connect(g);
    g.connect(sfxBus);
    playing[name] = (playing[name] || 0) + 1;
    src.onended = () => { playing[name] = (playing[name] || 1) - 1; };
    src.start();
  }

  return {
    unlock,

    // Play the effects for this frame's game events.
    /** @param {string[]} events */
    handle(events) {
      for (const e of events) {
        const name = EVENT_SFX[e];
        if (name) playSfx(name);
      }
    },

    // The game changed state (from `prev`). A new night starts the music from the opening phrase.
    /** @param {string} state @param {string} prev */
    onState(state, prev) {
      cur.state = state;
      if ((state !== 'play' && state !== 'paused') || (state === 'play' && prev !== 'paused')) cur.boss = null;   // no boss between nights
      if (state === 'play' && prev !== 'paused') { cur.progress = 0; if (music) music.restart(0, nightSong); }
      else if ((state === 'title' || state === 'highscores' || state === 'nameEntry') && (prev === 'play' || prev === 'paused')) music?.restart(1, SONG);
      applyPlan();
    },

    // The night about to be played: it picks the arrangement, which starts with the night itself.
    /** @param {number} n */
    setNight(n) { nightSong = arrangement(n); },

    // A boss's health left, 0 to 1, or null when no boss is out (call it every frame). When a boss arrives its
    // arrival stinger plays alone and the boss theme starts as it ends. While the boss fights, the theme gets faster and
    // fuller as it is hurt; when it falls the music stops (for the snowball burst, or the ice), and the
    // night-end music comes after.
    /** @param {number | null} frac @param {string} [kind]  which boss: 'frosty' or 'mary' */
    setBoss(frac, kind = 'frosty') {
      const was = cur.boss;
      if (frac === was) return;
      cur.boss = frac;
      if (!music) return;
      if (was === null && frac !== null) {
        const stinger = BOSS_STINGER[kind];
        if (stinger) {
          music.restart(0, BOSS_SONG, stingerLength(stinger) - 0.07);
          music.stinger(stinger, false);
        } else music.restart(0, BOSS_SONG);
        applyPlan();
      } else if (frac === null) music.stop(0.4);
      else applyPlan();
    },

    // How far through the night's food target we are, 0 to 1.
    /** @param {number} frac */
    setProgress(frac) {
      if (frac === cur.progress) return;
      cur.progress = frac;
      if (cur.state === 'play') applyPlan();
    },

    toggleMute() {
      muted = !muted;
      applyMute();
      try { storage?.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* not saved */ }
      return muted;
    },
    get muted() { return muted; },

    // For when the page is hidden.
    suspend() { ctx?.suspend?.(); },
    resume() { if (ctx) ctx.resume?.(); },

    // For tests.
    get ready() { return !!ctx; },
    get music() { return music; },
    get loaded() { return Object.keys(buffers); },
  };
}
