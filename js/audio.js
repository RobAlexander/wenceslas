// Sound for the game: sampled effects, plus the adaptive music from music.js.
//
// Nothing here touches the Web Audio API until the first key press or click, because browsers
// refuse to play sound before then. Until that moment every call is a harmless no-op.
// The game talks to it through a few calls: handle(events), onState(...), setProgress(...).

import { createMusic, stageFor } from './music.js';

// Effects in audio/sfx/, with how loud each plays (the files are all normalised, but not equally loud to the ear).
export const SFX = {
  swing: 0.55, hit: 0.85, kill: 0.9, hurt: 1.0, recruit: 0.8, pageDie: 0.9, pickup: 0.75,
  foodDrop: 0.75, deliver: 0.85, nightComplete: 0.9, gameover: 1.0, partridge: 0.9,
  menuMove: 0.6, menuSelect: 0.7,
};
// Game event -> effect. Events without an entry (such as 'pageHurt') are silent.
const EVENT_SFX = Object.fromEntries(Object.keys(SFX).map((n) => [n, n]));
const VARIED = new Set(['swing', 'hit', 'pickup', 'foodDrop', 'deliver']);   // a touch of pitch variation
const MAX_AT_ONCE = 4;                                                       // per effect, so nothing machine-guns

const MUTE_KEY = 'wenceslas.muted';

// What the music should be doing in each game state. stage: null leaves the current stage alone.
export function musicPlan(state, progress = 0) {
  switch (state) {
    case 'play':     return { run: true, stage: stageFor(progress), duck: 1 };
    case 'paused':   return { run: true, stage: null, duck: 0.3 };
    case 'nightEnd': return { run: true, stage: 4, duck: 0.8 };      // the whole carol, in celebration
    case 'ending':   return { run: true, stage: 4, duck: 1 };
    case 'gameover': return { run: false };
    default:         return { run: true, stage: 1, duck: 0.7 };      // title, high scores, initials: calm
  }
}

async function defaultLoad(ctx, name) {
  const res = await fetch(new URL(`../audio/sfx/${name}.wav`, import.meta.url));
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const bytes = await res.arrayBuffer();
  return new Promise((resolve, reject) => {
    // The callback form works in every browser, including old Safari.
    const p = ctx.decodeAudioData(bytes, resolve, reject);
    if (p && p.then) p.then(resolve, reject);
  });
}

export function createAudio({
  AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
  load = defaultLoad,
  storage = (() => { try { return globalThis.localStorage; } catch { return null; } })(),
} = {}) {
  let ctx = null, master = null, sfxBus = null, music = null;
  const buffers = {};
  const playing = {};
  const cur = { state: 'title', progress: 0 };
  let muted = false;
  try { muted = storage?.getItem(MUTE_KEY) === '1'; } catch { /* storage unavailable */ }

  function applyMute() { if (master) master.gain.value = muted ? 0 : 1; }

  function applyPlan() {
    if (!music) return;
    const plan = musicPlan(cur.state, cur.progress);
    if (!plan.run) { music.stop(0.4); return; }
    if (!music.running) music.restart(plan.stage ?? 1);
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
      for (const name of Object.keys(SFX)) {
        Promise.resolve(load(ctx, name)).then((b) => { buffers[name] = b; }).catch(() => { /* that effect stays silent */ });
      }
    } catch {
      ctx = null;   // audio isn't available here; carry on without it
    }
  }

  function playSfx(name) {
    const buf = buffers[name];
    if (!ctx || muted || !buf) return;
    if ((playing[name] || 0) >= MAX_AT_ONCE) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (VARIED.has(name)) src.playbackRate.value = 0.96 + Math.random() * 0.08;
    const g = ctx.createGain();
    g.gain.value = SFX[name];
    src.connect(g);
    g.connect(sfxBus);
    playing[name] = (playing[name] || 0) + 1;
    src.onended = () => { playing[name]--; };
    src.start();
  }

  return {
    unlock,

    // Play the effects for this frame's game events.
    handle(events) {
      for (const e of events) {
        const name = EVENT_SFX[e];
        if (name) playSfx(name);
      }
    },

    // The game changed state (from `prev`). A new night starts the music from the opening phrase.
    onState(state, prev) {
      cur.state = state;
      if (state === 'play' && prev !== 'paused') { cur.progress = 0; if (music) music.restart(0); }
      else if ((state === 'title' || state === 'highscores' || state === 'initials') && (prev === 'play' || prev === 'paused')) music?.restart(1);
      applyPlan();
    },

    // How far through the night's food target we are, 0 to 1.
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
