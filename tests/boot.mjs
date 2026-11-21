// Boots the real main.js under stubbed browser globals (no browser needed) and
// plays through the whole flow with synthetic input:
// title -> night 1 -> pause -> ... -> night 12 -> ending -> initials -> table -> title,
// plus game over. Fails on any thrown error. Run with: node tests/boot.mjs
import { createCanvas } from 'canvas';
import assert from 'node:assert/strict';

const handlers = {};            // window-level listeners
const canvasHandlers = {};      // canvas listeners
let now = 0, raf = null, fullscreenCalls = 0, padNow = null;
const on = (store) => (type, fn) => (store[type] ||= []).push(fn);
const canvas = Object.assign(createCanvas(640, 360), {
  style: {}, addEventListener: on(canvasHandlers),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 360 }),
});
Object.assign(globalThis, {
  window: globalThis, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  location: { search: '' }, addEventListener: on(handlers),
  requestAnimationFrame: (cb) => { raf = cb; },
  document: {
    hidden: false, addEventListener() {}, getElementById: () => canvas,
    documentElement: { requestFullscreen: () => { fullscreenCalls++; return Promise.resolve(); } },
    createElement: (t) => (t === 'canvas' ? createCanvas(1, 1) : {}),
  },
});
const audioLog = { contexts: 0, started: [] };
const gainParam = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} });
globalThis.AudioContext = class {
  constructor() { audioLog.contexts++; this.currentTime = 0; this.state = 'running'; this.destination = {}; }
  resume() {} suspend() {}
  decodeAudioData(bytes, ok) { ok({ sfx: /sfx\/(\w+)\.wav/.exec(new TextDecoder().decode(bytes))[1] }); }
  createBuffer() { return { copyToChannel() {} }; }
  createGain() { return { gain: gainParam(), connect() {} }; }
  createStereoPanner() { return { pan: { value: 0 }, connect() {} }; }
  createBufferSource() {
    const src = { playbackRate: { value: 1 }, connect() {}, stop() {}, start() { audioLog.started.push(src); } };
    return src;
  }
};
globalThis.fetch = async (url) => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode(String(url)).buffer });
const sfxPlayed = () => audioLog.started.filter((s) => s.buffer?.sfx).map((s) => s.buffer.sfx);
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [padNow] }, configurable: true });
Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true });
// An in-memory localStorage, as in a browser. Node 25+ has its own, which warns
// and returns undefined unless given --localstorage-file.
const stored = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k) => (stored.has(k) ? stored.get(k) : null),
    setItem: (k, v) => { stored.set(k, String(v)); },
    removeItem: (k) => { stored.delete(k); },
    clear: () => { stored.clear(); },
  },
  configurable: true,
});

await import('../js/main.js');
const game = globalThis.__wenceslas;

const frames = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const cb = raf; raf = null; cb(); } };
const secs = (s) => frames(Math.round(s * 60));
const fire = (store, type, e = {}) => (store[type] || []).forEach((fn) => fn({ preventDefault() {}, ...e }));
const key = (code) => { fire(handlers, 'keydown', { code, repeat: false }); frames(2); fire(handlers, 'keyup', { code }); frames(1); };
const click = (x = 320, y = 180) => { fire(canvasHandlers, 'pointerdown', { pointerType: 'mouse', button: 0, clientX: x, clientY: y }); frames(2); };
const mouse = (x, y) => { fire(handlers, 'pointermove', { pointerType: 'mouse', clientX: x, clientY: y }); frames(1); };

secs(0.5);
assert.equal(game.state, 'title');

// sound: nothing happens until the first key press or click
assert.equal(audioLog.contexts, 0, 'no audio before a gesture');
assert.equal(game.audio.ready, false);

// scaling: the visible canvas is a whole-number upscale of 640x360, and its CSS
// size fills the window at 16:9
const resizeTo = (w, h, dpr = 1) => {
  Object.assign(globalThis, { innerWidth: w, innerHeight: h, devicePixelRatio: dpr });
  fire(handlers, 'resize'); frames(2);
};
const cssSize = () => [parseFloat(canvas.style.width), parseFloat(canvas.style.height)];
assert.deepEqual([canvas.width, canvas.height], [1280, 720]);       // booted at 1280x720
assert.ok(canvas.getContext('2d').getImageData(5, 5, 1, 1).data[3] === 255, 'buffer is copied to the screen');
resizeTo(1200, 700);                                                 // the "too small" case: 1.875x fit
assert.deepEqual([canvas.width, canvas.height], [1280, 720]);
assert.deepEqual(cssSize(), [1200, 675]);                            // width-limited, 16:9
resizeTo(1920, 1080);
assert.deepEqual([canvas.width, canvas.height], [1920, 1080]);       // exact 3x
assert.deepEqual(cssSize(), [1920, 1080]);
resizeTo(1920, 900);                                                 // height-limited: bars left and right
assert.deepEqual(cssSize(), [1600, 900]);
resizeTo(1920, 1080, 2);                                             // high-DPI screen: 6x in device pixels
assert.deepEqual([canvas.width, canvas.height], [3840, 2160]);
assert.deepEqual(cssSize(), [1920, 1080]);
resizeTo(500, 300);                                                  // smaller than the game: never below 1x
assert.deepEqual([canvas.width, canvas.height], [640, 360]);
assert.ok(cssSize()[0] <= 500 && cssSize()[1] <= 300);
resizeTo(1280, 720);
secs(0.2);

// F toggles fullscreen
key('KeyF'); assert.equal(fullscreenCalls, 1);
assert.equal(audioLog.contexts, 1, 'a key press starts audio');
// M mutes and unmutes
key('KeyM'); assert.equal(game.audio.muted, true);
const heard = sfxPlayed().length;
game.audio.handle(['hit']); assert.equal(sfxPlayed().length, heard, 'no effects while muted');
key('KeyM'); assert.equal(game.audio.muted, false);

// title: start with Enter; first item is START
key('Enter');
assert.equal(game.state, 'play');
assert.equal(game.night, 1);
await new Promise((r) => setImmediate(r));                           // let the effects finish loading
assert.equal(audioLog.contexts, 1, 'audio is only started once');
assert.equal(game.audio.loaded.length, 14, 'all 14 effects loaded');
assert.equal(game.audio.music.running, true);
assert.equal(game.audio.music.stage, 0, 'a night opens with the first phrase');

// play: hold D to walk right, mouse aim, swing
let x0 = game.world.king.x;
fire(handlers, 'keydown', { code: 'KeyD', repeat: false });
mouse(500, 100);
click(500, 100);
secs(1);
fire(handlers, 'keyup', { code: 'KeyD' });
assert.ok(game.world.king.x > x0 + 20, 'king moved right');
assert.ok(sfxPlayed().includes('swing'), 'the click swung the sword, and it made a sound');

// pause with Escape, resume with Escape; then quit via the menu
key('Escape'); assert.equal(game.state, 'paused');
secs(0.3);
key('Escape'); assert.equal(game.state, 'play');
key('Escape'); assert.equal(game.state, 'paused');
key('ArrowDown'); key('Enter'); assert.equal(game.state, 'title');

// title: mouse click on START
mouse(320, 160); click(320, 160);
assert.equal(game.state, 'play');

// window blur pauses
fire(handlers, 'blur'); assert.equal(game.state, 'paused');
key('Enter'); assert.equal(game.state, 'play'); // RESUME is first

// ================= touch =================
// 640x360 window: one CSS pixel is one game pixel, so client coordinates are game coordinates.
resizeTo(640, 360);
assert.equal(game.input.st.lastDevice, 'mouse');
let ts = 1000;
const touchEv = (type, id, x, y, extra = {}) => fire(handlers, type, { pointerType: 'touch', pointerId: id, clientX: x, clientY: y, timeStamp: ts, ...extra });
const tdown = (id, x, y) => { touchEv('pointerdown', id, x, y); frames(1); };
const tmove = (id, x, y) => { touchEv('pointermove', id, x, y); frames(1); };
const tup = (id, x, y, after = 100) => { ts += after; touchEv('pointerup', id, x, y); frames(2); };
secs(0.6);
let king = game.world.king;

// left half: floating joystick moves the king, and stops when released
x0 = king.x;
tdown(1, 150, 200); tmove(1, 200, 200); secs(0.5);
assert.equal(game.input.st.lastDevice, 'touch');
assert.ok(king.x > x0 + 15, 'joystick moved the king right');
tup(1, 200, 200, 600);
assert.equal(fullscreenCalls, 2, 'first touch asks for fullscreen once');
secs(0.3); x0 = king.x; secs(0.3);
assert.ok(Math.abs(king.x - x0) < 0.01, 'king stops when the thumb lifts');

// right half: drag up and release swings upward
tdown(2, 500, 200); tmove(2, 500, 120);
tup(2, 500, 120, 300);
assert.ok(Math.abs(king.swingAngle + Math.PI / 2) < 0.05, 'swung in the dragged direction');
assert.ok(king.cd > 0);
assert.equal(fullscreenCalls, 2, 'fullscreen is only requested the first time');

// right half: a quick tap swings at the nearest robber
secs(0.8);
game.world.robbers.push({ id: 9999, x: king.x - 28, y: king.y, r: 4, hp: 1, maxHp: 1, target: null, retarget: 0, windup: 0,
  atkCd: 9, stun: 0, flash: 0, kbx: 0, kby: 0, walkT: 0, face: 1, side: 1 });
tdown(3, 500, 250); tup(3, 500, 250, 100);
assert.ok(Math.abs(king.swingAngle) > 3, 'turned toward the robber on the left');
assert.equal(game.world.kills, 1, 'the tap killed it');
// a slow press without a drag does nothing
secs(0.8); assert.ok(king.cd <= 0, 'ready to swing');
tdown(4, 500, 250); tup(4, 500, 250, 600);
assert.ok(king.cd <= 0, 'a long press without a drag is not a tap');

// the pause button, then tapping RESUME
tdown(5, 620, 10); tup(5, 620, 10);
assert.equal(game.state, 'paused');
tdown(6, 320, 152); tup(6, 320, 152);
assert.equal(game.state, 'play');
// leave through the menu, and start a game by tapping START
key('Escape'); key('ArrowDown'); key('Enter');
assert.equal(game.state, 'title');
tdown(7, 320, 156); tup(7, 320, 156);
assert.equal(game.state, 'play');
const fsAfterTouch = fullscreenCalls;

// a phone held upright pauses play
globalThis.matchMedia = () => ({ matches: true });
resizeTo(360, 640);
assert.equal(game.state, 'paused');
delete globalThis.matchMedia;
resizeTo(640, 360);
key('Escape'); assert.equal(game.state, 'play');

// a mouse move hands control back to the mouse
mouse(300, 100);
assert.equal(game.input.st.lastDevice, 'mouse');
resizeTo(1280, 720);

// ================= gamepad =================
const padBtn = (...down) => Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 }));
const setPad = (axes = [0, 0, 0, 0], ...down) => { padNow = { connected: true, axes, buttons: padBtn(...down) }; frames(2); };
king = game.world.king;
secs(0.5);
x0 = king.x;
setPad([0.9, 0, 0, 0]); secs(0.5);
assert.equal(game.input.st.lastDevice, 'pad');
assert.ok(king.x > x0 + 15, 'left stick moves the king');
setPad([0, 0, 0, -1]);                                  // right stick up: aim up
assert.ok(Math.abs(king.aim + Math.PI / 2) < 0.01, 'right stick aims');
setPad([0, 0, 0, -1], 7); assert.ok(king.cd > 0, 'right trigger swings');
setPad(); secs(0.6);
setPad([0, 0, 0, 0], 9); assert.equal(game.state, 'paused', 'Start pauses');
setPad(); setPad([0, 0, 0, 0], 9); assert.equal(game.state, 'play', 'Start resumes');
setPad();
// menus: d-pad down then A on the pause menu quits to the title; A on the title starts
setPad([0, 0, 0, 0], 9); setPad();
setPad([0, 0, 0, 0], 13); setPad(); setPad([0, 0, 0, 0], 0); setPad();
assert.equal(game.state, 'title');
setPad([0, 0, 0, 0], 0); setPad();
assert.equal(game.state, 'play', 'A starts the game from the title');
padNow = null; frames(2);
mouse(300, 100);

// Win every night: nightEnd -> skip count -> continue -> next night
for (let n = 1; n <= 12; n++) {
  assert.equal(game.night, n);
  game.world.done = true;
  frames(2);
  assert.equal(game.state, 'nightEnd', 'night ' + n);
  assert.ok(game.score > 0 || n > 1 || game.world.delivered === 0);
  secs(0.7);
  key('Enter');      // skip the count-up
  key('Enter');      // continue
  if (n < 12) assert.equal(game.state, 'play');
}
assert.equal(game.state, 'ending');
const score = game.score;
game.score = Math.max(score, 1234); // make sure it qualifies even though the nights were skipped
assert.equal(game.audio.music.pendingStage ?? game.audio.music.stage, 4, 'the whole carol at the ending');
secs(1.7);
assert.ok(sfxPlayed().includes('partridge'), 'the partridge calls');
key('Enter');
assert.equal(game.state, 'initials');
key('KeyF');                                   // a letter here, not fullscreen
assert.equal(fullscreenCalls, fsAfterTouch);
key('KeyM'); assert.equal(game.audio.muted, false);   // nor mute
key('KeyW'); key('KeyE'); key('KeyN');
key('Enter');
assert.equal(game.state, 'highscores');
secs(0.5);
key('Enter');
assert.equal(game.state, 'title');

// hard mode is now unlocked: the title has START, HARD MODE, HIGH SCORES
key('ArrowDown'); key('Enter');
assert.equal(game.state, 'play');
assert.equal(game.hard, true);
assert.equal(game.night, 1);

// game over: the king dies -> game over -> (score 0 doesn't qualify) -> table
game.world.king.hp = 0; game.world.dead = true;
frames(2);
assert.equal(game.state, 'gameover');
assert.equal(game.audio.music.running, false, 'game over stops the music');
secs(1.2);
key('Enter');
assert.equal(game.state, 'highscores');
secs(0.5); key('Enter');
assert.equal(game.state, 'title');

// high scores from the title
key('ArrowDown'); key('ArrowDown'); key('Enter');
assert.equal(game.state, 'highscores');
secs(0.5); click();
assert.equal(game.state, 'title');

console.log('boot: full flow passed');
process.exit(0);   // the music's timer would otherwise keep Node running
