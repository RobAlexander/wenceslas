// Boots the real main.js under stubbed browser globals (no browser needed) and
// plays through the whole flow with synthetic input:
// title -> night 1 -> pause -> ... -> night 12 -> ending -> initials -> table -> title,
// plus game over. Fails on any thrown error. Run with: node tests/boot.mjs
import { createCanvas } from 'canvas';
import assert from 'node:assert/strict';

const handlers = {};            // window-level listeners
const canvasHandlers = {};      // canvas listeners
let now = 0, raf = null, fullscreenCalls = 0;
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
Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true });

await import('../js/main.js');
const game = globalThis.__wenceslas;

const frames = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const cb = raf; raf = null; cb(); } };
const secs = (s) => frames(Math.round(s * 60));
const fire = (store, type, e = {}) => (store[type] || []).forEach((fn) => fn({ preventDefault() {}, ...e }));
const key = (code) => { fire(handlers, 'keydown', { code, repeat: false }); frames(2); fire(handlers, 'keyup', { code }); frames(1); };
const click = (x = 320, y = 180) => { fire(canvasHandlers, 'mousedown', { button: 0, clientX: x, clientY: y }); frames(2); };
const mouse = (x, y) => { fire(handlers, 'mousemove', { clientX: x, clientY: y }); frames(1); };

secs(0.5);
assert.equal(game.state, 'title');

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

// title: start with Enter; first item is START
key('Enter');
assert.equal(game.state, 'play');
assert.equal(game.night, 1);

// play: hold D to walk right, mouse aim, swing
const x0 = game.world.king.x;
fire(handlers, 'keydown', { code: 'KeyD', repeat: false });
mouse(500, 100);
click(500, 100);
secs(1);
fire(handlers, 'keyup', { code: 'KeyD' });
assert.ok(game.world.king.x > x0 + 20, 'king moved right');

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
secs(1.7);
key('Enter');
assert.equal(game.state, 'initials');
key('KeyF');                                   // a letter here, not fullscreen
assert.equal(fullscreenCalls, 1);
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
