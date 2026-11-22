// Tests for the audio module with a fake AudioContext: effects for events, autoplay rules,
// mute, and which music stage each game state calls for. Run with: node tests/audio.mjs
import assert from 'node:assert/strict';
import { createAudio, musicPlan, SFX } from '../js/audio.js';

globalThis.setInterval = () => 1; globalThis.clearInterval = () => {};   // the music pumps by hand here

const param = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} });
function makeFake() {
  const log = { started: [], contexts: 0, resumes: 0, suspends: 0, ended: [] };
  class FakeCtx {
    constructor() { log.contexts++; this.currentTime = 0; this.state = 'suspended'; this.destination = {}; log.ctx = this; }
    resume() { log.resumes++; this.state = 'running'; }
    suspend() { log.suspends++; }
    createBuffer(ch, len) { return { length: len, copyToChannel() {} }; }
    createGain() { return { gain: param(), connect() {} }; }
    createStereoPanner() { return { pan: { value: 0 }, connect() {} }; }
    createBufferSource() {
      const src = { playbackRate: { value: 1 }, connect() {}, stop() {}, start() { log.started.push(src); } };
      return src;
    }
  }
  return { FakeCtx, log };
}
const fakeStorage = () => { const d = {}; return { d, getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = String(v); } }; };
const tick = () => new Promise((r) => setImmediate(r));
const sfxStarts = (log) => log.started.filter((s) => s.buffer && s.buffer.sfx);

async function setup(opts = {}) {
  const { FakeCtx, log } = makeFake();
  const storage = fakeStorage();
  const loaded = [];
  const load = async (ctx, name) => { loaded.push(name); return { sfx: name, length: 100 }; };
  const audio = createAudio({ AudioContextClass: FakeCtx, load, storage, ...opts });
  return { audio, log, storage, loaded };
}

// ---- before the first gesture, everything is a harmless no-op
{
  const { audio, log } = await setup();
  assert.equal(audio.ready, false);
  audio.handle(['swing', 'hit']);
  audio.onState('play', 'title'); audio.setProgress(0.5); audio.suspend(); audio.resume();
  assert.equal(log.contexts, 0, 'no AudioContext before a gesture');
  assert.equal(log.started.length, 0);
}
// ---- no Web Audio at all
{
  const audio = createAudio({ AudioContextClass: null, storage: fakeStorage() });
  audio.unlock(); audio.handle(['swing']); audio.onState('play', 'title'); audio.setProgress(1);
  assert.equal(audio.ready, false);
  assert.equal(audio.toggleMute(), true);
}
// ---- a constructor that throws doesn't break the game
{
  const audio = createAudio({ AudioContextClass: class { constructor() { throw new Error('blocked'); } }, storage: fakeStorage() });
  audio.unlock(); audio.handle(['swing']);
  assert.equal(audio.ready, false);
}

// ---- unlock loads every effect, then events play them
{
  const { audio, log, loaded } = await setup();
  audio.unlock();
  assert.equal(log.contexts, 1);
  assert.equal(audio.ready, true);
  assert.ok(log.resumes >= 1);
  await tick();
  assert.deepEqual([...loaded].sort(), Object.keys(SFX).sort(), 'every effect is loaded');
  audio.unlock(); audio.unlock();
  assert.equal(log.contexts, 1, 'unlock is idempotent');

  const before = log.started.length;
  audio.handle(['swing', 'hit', 'no-such-event', 'pageHurt']);
  const played = log.started.slice(before);
  assert.deepEqual(played.map((s) => s.buffer.sfx), ['swing', 'hit'], 'unknown and silent events are ignored');
  for (const s of played) assert.ok(s.playbackRate.value > 0.95 && s.playbackRate.value < 1.05, 'slight pitch variation');

  // every event the game emits has a sound
  const emitted = ['swing', 'hit', 'kill', 'hurt', 'recruit', 'pageDie', 'pickup', 'foodDrop', 'deliver', 'nightComplete', 'gameover', 'partridge', 'menuMove', 'menuSelect'];
  for (const e of emitted) {
    const n = log.started.length;
    audio.handle([e]);
    assert.equal(log.started.length - n, 1, e + ' makes a sound');
    assert.equal(log.started.at(-1).buffer.sfx, e);
  }

  // no machine-gunning: at most 4 of one effect at once, and more once they finish
  const n0 = log.started.length;
  audio.handle(Array(8).fill('menuMove'));
  assert.equal(log.started.length - n0, 4 - 1, 'the cap counts the earlier menuMove too');
  log.started.slice(n0 - 1).forEach((s) => s.onended?.());
  const n1 = log.started.length;
  audio.handle(['menuMove']);
  assert.equal(log.started.length - n1, 1, 'plays again once earlier ones have ended');

  // a second gesture after the browser suspended the context resumes it
  log.ctx.state = 'suspended'; const r = log.resumes;
  audio.unlock();
  assert.equal(log.resumes, r + 1);
}

// ---- mute
{
  const { audio, log, storage } = await setup();
  audio.unlock(); await tick();
  assert.equal(audio.muted, false);
  assert.equal(audio.toggleMute(), true);
  assert.equal(storage.d['wenceslas.muted'], '1');
  const n = log.started.length;
  audio.handle(['hit']);
  assert.equal(log.started.length, n, 'no effects while muted');
  assert.equal(audio.toggleMute(), false);
  audio.handle(['hit']);
  assert.equal(log.started.length, n + 1);
  // the setting is remembered, even if it's set before the first gesture
  storage.setItem('wenceslas.muted', '1');
  const again = await setup({ storage });
  assert.equal(again.audio.muted, true);
}

// ---- what the music does in each state
assert.deepEqual(musicPlan('play', 0), { run: true, stage: 0, duck: 1 });
assert.equal(musicPlan('play', 0.5).stage, 2);
assert.equal(musicPlan('play', 0.95).stage, 4);
assert.equal(musicPlan('paused').stage, null, 'pausing leaves the stage alone');
assert.ok(musicPlan('paused').duck < 0.5, 'and turns it down');
assert.equal(musicPlan('nightEnd').stage, 4, 'the whole carol when a night is won');
assert.equal(musicPlan('ending').stage, 4);
assert.equal(musicPlan('gameover').run, false, 'silence for game over');
for (const s of ['title', 'highscores', 'nameEntry']) assert.deepEqual([musicPlan(s).run, musicPlan(s).stage], [true, 1]);

{
  const { audio, log } = await setup();
  audio.onState('title', 'title');          // before the first gesture: remembered
  audio.unlock(); await tick();
  const m = audio.music;
  assert.equal(m.running, true, 'music starts at the first gesture');
  assert.equal(m.stage, 1, 'calm music on the title screen');

  audio.onState('play', 'title');           // a new night
  assert.equal(m.stage, 0, 'every night starts with the opening phrase');
  assert.equal(m.running, true);
  audio.setProgress(0.5);
  assert.equal(m.pendingStage, 2, 'progress asks for a stage, which waits for the boundary');
  assert.equal(m.stage, 0);
  audio.setProgress(0.5);                   // unchanged progress is ignored
  log.ctx.currentTime = 20; m.pump();
  assert.equal(m.stage, 2);

  audio.onState('paused', 'play');
  assert.equal(m.running, true, 'music carries on while paused');
  assert.equal(m.pendingStage, null);
  audio.onState('play', 'paused');          // resuming is not a new night
  assert.equal(m.stage, 2, 'resuming keeps the stage');

  audio.onState('nightEnd', 'play');
  assert.equal(m.pendingStage, 4);
  audio.onState('play', 'nightEnd');        // next night
  assert.equal(m.stage, 0, 'the next night starts over');

  audio.onState('gameover', 'play');
  assert.equal(m.running, false, 'game over stops the music');
  audio.onState('highscores', 'gameover');
  assert.equal(m.running, true, 'and it comes back for the table');
  assert.equal(m.stage, 1);

  audio.onState('title', 'highscores');
  const phrases = m.phrasesScheduled;
  audio.onState('highscores', 'title');
  assert.equal(m.phrasesScheduled, phrases, 'moving between menus does not restart it');

  audio.onState('play', 'title');
  audio.onState('title', 'paused');          // quit from the pause menu
  assert.equal(m.stage, 1, 'back to the calm music');
}

// ---- each night has its own arrangement; the menus keep the classic one
{
  const { arrangement } = await import('../js/arrange.js');
  const { SONG } = await import('../js/music-data.js');
  const { audio } = await setup();
  audio.setNight(3);                         // before the first gesture: remembered
  audio.onState('title', 'title');
  audio.unlock(); await tick();
  assert.equal(audio.music.song, SONG, 'the title plays the classic arrangement');
  audio.onState('play', 'title');
  assert.equal(audio.music.song, arrangement(3), 'night 3 has its own');
  assert.notEqual(arrangement(3), SONG);
  audio.onState('paused', 'play'); audio.onState('play', 'paused');
  assert.equal(audio.music.song, arrangement(3), 'pausing does not change it');
  audio.onState('nightEnd', 'play'); audio.setNight(4); audio.onState('play', 'nightEnd');
  assert.equal(audio.music.song, arrangement(4), 'the next night changes it');
  audio.onState('title', 'paused');
  assert.equal(audio.music.song, SONG, 'back to the classic one on the menus');
}

// ---- the boss: his stinger plays alone and the boss theme starts as it ends; the theme follows his health
{
  const { BOSS_SONG } = await import('../js/music-data.js');
  const { arrangement } = await import('../js/arrange.js');
  const { audio, log } = await setup();
  audio.setBoss(1);
  assert.equal(log.started.length, 0, 'no audio before a gesture');
  audio.setBoss(null);
  audio.onState('play', 'title');
  audio.unlock(); await tick();
  audio.setNight(3);
  audio.onState('play', 'title');
  const m = audio.music;
  assert.equal(m.song, arrangement(3));
  const before = log.started.length;
  audio.setBoss(1);
  assert.equal(m.song, BOSS_SONG, 'the boss theme replaces the night music');
  assert.equal(m.stage, 0);
  assert.ok(log.started.length - before > 20, 'with the arrival stinger played: ' + (log.started.length - before));
  // the theme waits for the stinger: nothing from the song itself starts for the first couple of seconds
  const notes = log.started.length;
  log.ctx.currentTime = 1.5; m.pump();
  assert.equal(log.started.length, notes, 'the theme holds back until the stinger has ended');
  log.ctx.currentTime = 2.9; m.pump();
  assert.ok(log.started.length > notes, 'and then starts');
  // it gets fuller as he is hurt, and the food progress no longer matters
  audio.setBoss(0.5);
  assert.equal(m.pendingStage, 1);
  audio.setBoss(0.2);
  assert.equal(m.pendingStage, 2);
  audio.setProgress(1); audio.setProgress(0.2); audio.setProgress(1);
  assert.equal(m.pendingStage, 2, 'delivering food does not move the boss theme');
  audio.onState('paused', 'play');
  assert.equal(m.running, true, 'it carries on while paused');
  assert.equal(m.song, BOSS_SONG);
  audio.onState('play', 'paused');
  assert.equal(m.song, BOSS_SONG, 'and resuming keeps the boss theme');
  // he falls: silence for the burst, then the night-end music comes back in the night's own arrangement
  audio.setBoss(null);
  assert.equal(m.running, false, 'the music stops when he falls');
  audio.onState('nightEnd', 'play');
  assert.equal(m.running, true);
  assert.equal(m.song, arrangement(3), 'and the celebration is the night\'s music, not the boss theme');
  assert.equal(m.stage, 4);
  // leaving the fight by the pause menu puts the calm music back
  audio.onState('play', 'nightEnd'); audio.setBoss(1);
  assert.equal(m.song, BOSS_SONG);
  audio.onState('paused', 'play'); audio.onState('title', 'paused');
  audio.setBoss(null);
  assert.equal(m.running, true, 'quitting mid-fight does not leave silence');
  assert.equal(m.song.phrases.length, 8);
}
// ---- Mary's arrival: her stinger plays alone and the boss theme starts as it ends
{
  const { BOSS_SONG } = await import('../js/music-data.js');
  const { stingerLength } = await import('../js/music.js');
  const { audio, log } = await setup();
  audio.unlock(); await tick();
  audio.setNight(6);
  audio.onState('play', 'title');
  const m = audio.music;
  const before = log.started.length;
  audio.setBoss(1, 'mary');
  assert.equal(m.song, BOSS_SONG, 'the boss theme plays for her too');
  assert.ok(log.started.length - before > 30, 'her stinger is played: ' + (log.started.length - before));
  const notes = log.started.length;
  log.ctx.currentTime = 4; m.pump();
  assert.equal(log.started.length, notes, 'the theme holds back while the stinger plays');
  log.ctx.currentTime = stingerLength('maryArrive') + 0.1; m.pump();
  assert.ok(log.started.length > notes, 'and starts as it ends');
  audio.setBoss(0.4, 'mary');
  assert.equal(m.pendingStage, 1, 'and follows her health like his');
  audio.setBoss(null, 'mary');
  assert.equal(m.running, false, 'it stops when she falls');
}
// ...and a boss with no stinger (Prince Boleslaus, for now) gets the theme at once
{
  const { BOSS_SONG } = await import('../js/music-data.js');
  const { audio, log } = await setup();
  audio.unlock(); await tick();
  audio.onState('play', 'title');
  const before = log.started.length;
  audio.setBoss(1, 'boleslaus');   // (no stinger yet)
  assert.equal(audio.music.song, BOSS_SONG);
  assert.ok(log.started.length - before > 10, 'the first phrase is scheduled at once: ' + (log.started.length - before));
}
assert.equal(musicPlan('play', 1, 0.5).stage, 1, 'boss plan: half his health gone is stage 1');
assert.equal(musicPlan('play', 1, 0.9).stage, 0);
assert.equal(musicPlan('play', 1, null).stage, 4, 'no boss: the food decides');

// ---- tab hidden / shown
{
  const { audio, log } = await setup();
  audio.unlock();
  audio.suspend(); assert.equal(log.suspends, 1);
  const r = log.resumes; audio.resume(); assert.equal(log.resumes, r + 1);
}

console.log('audio: all tests passed');
