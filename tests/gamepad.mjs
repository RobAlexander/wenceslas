// Unit tests for the gamepad module, using a fake pad. Run with: node tests/gamepad.mjs
import assert from 'node:assert/strict';
import { createGamepad } from '../js/gamepad.js';

const calls = [];
const input = {
  setDevice: (d) => calls.push(['device', d]),
  setStick: (s, x, y) => calls.push(['stick', s, x, y]),
  setAim: (s, a) => calls.push(['aim', s, a]),
  pressSwing: (a) => calls.push(['swing', a]),
  pushKey: (k) => calls.push(['key', k]),
  requestPause: () => calls.push(['pause']),
};
let pad = null;
const gp = createGamepad(input, () => [null, pad]);   // getGamepads() often has null slots
const mk = (axes = [0, 0, 0, 0], ...down) => ({
  connected: true, axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 })),
});
const take = () => calls.splice(0);
const last = (kind, list) => list.filter((c) => c[0] === kind).at(-1);
const A = 0, B = 1, RB = 5, RT = 7, START = 9, UP = 12, DOWN = 13;

// no pad: nothing happens
gp.update(1 / 60, 'play'); assert.deepEqual(take(), []);

// movement: radial deadzone, rescaled
pad = mk([0.1, 0.1, 0, 0]); gp.update(1 / 60, 'play');
assert.deepEqual(last('stick', take()), ['stick', 'pad', 0, 0]);                 // inside the deadzone
pad = mk([0.6, 0, 0, 0]); gp.update(1 / 60, 'play');
let c = take();
assert.ok(Math.abs(last('stick', c)[2] - 0.5) < 1e-9);                           // (0.6-0.2)/0.8
assert.ok(c.some((x) => x[0] === 'device' && x[1] === 'pad'));
pad = mk([1, 1, 0, 0]); gp.update(1 / 60, 'play');
const [, , sx, sy] = last('stick', take());
assert.ok(Math.abs(Math.hypot(sx, sy) - 1) < 1e-9);                              // never longer than 1
pad = mk([0, 0, 0, 0], 15); gp.update(1 / 60, 'play');                            // d-pad right also moves
assert.deepEqual(last('stick', take()), ['stick', 'pad', 1, 0]);

// aiming: right stick must be pushed past the threshold
pad = mk([0, 0, 0.2, 0.2]); gp.update(1 / 60, 'play');
assert.deepEqual(last('aim', take()), ['aim', 'pad', null]);
pad = mk([0, 0, 0, -0.8]); gp.update(1 / 60, 'play');
assert.ok(Math.abs(last('aim', take())[2] + Math.PI / 2) < 1e-9);
pad = mk([0, 0, 0.9, 0]); gp.update(1 / 60, 'play');
assert.equal(last('aim', take())[2], 0);

// swinging: on the press only, from RT, RB or A
pad = mk(); gp.update(1 / 60, 'play'); take();
for (const b of [RT, RB, A]) {
  pad = mk([0, 0, 0, 0], b); gp.update(1 / 60, 'play');
  assert.equal(take().filter((x) => x[0] === 'swing').length, 1, 'press ' + b);
  gp.update(1 / 60, 'play');                                                      // still held
  assert.equal(take().filter((x) => x[0] === 'swing').length, 0, 'held ' + b);
  pad = mk(); gp.update(1 / 60, 'play'); take();                                  // released
}
// an analogue trigger counts once it's mostly pressed
pad = mk(); pad.buttons[RT] = { pressed: false, value: 0.8 }; gp.update(1 / 60, 'play');
assert.equal(take().filter((x) => x[0] === 'swing').length, 1);
pad = mk(); gp.update(1 / 60, 'play'); take();

// Start pauses
pad = mk([0, 0, 0, 0], START); gp.update(1 / 60, 'play');
assert.equal(take().filter((x) => x[0] === 'pause').length, 1);
pad = mk(); gp.update(1 / 60, 'play'); take();

// a button held while the game changes state doesn't fire again (no accidental menu skips)
pad = mk([0, 0, 0, 0], A); gp.update(1 / 60, 'play'); take();
gp.update(1 / 60, 'nightEnd');
assert.deepEqual(take().filter((x) => x[0] === 'key'), []);
pad = mk(); gp.update(1 / 60, 'nightEnd'); take();

// menus: sticks are released, keys are sent, directions repeat after a delay
pad = mk([0, 0, 0, 0], DOWN); gp.update(1 / 60, 'title');
c = take();
assert.deepEqual(c.filter((x) => x[0] === 'key'), [['key', 'ArrowDown']]);
assert.deepEqual(last('stick', c), ['stick', 'pad', 0, 0]);
for (let i = 0; i < 20; i++) gp.update(1 / 60, 'title');                          // 0.33s: not yet
assert.equal(take().filter((x) => x[0] === 'key').length, 0);
for (let i = 0; i < 10; i++) gp.update(1 / 60, 'title');                          // past 0.4s: repeats
assert.equal(take().filter((x) => x[0] === 'key').length, 1);
for (let i = 0; i < 15; i++) gp.update(1 / 60, 'title');                          // then every 0.12s
assert.equal(take().filter((x) => x[0] === 'key').length, 2);
pad = mk(); gp.update(1 / 60, 'title'); take();
pad = mk([0, -0.9, 0, 0]); gp.update(1 / 60, 'title');                            // left stick also navigates
assert.deepEqual(take().filter((x) => x[0] === 'key'), [['key', 'ArrowUp']]);
pad = mk(); gp.update(1 / 60, 'title'); take();

// A = Enter, B = Escape, Start = Enter (but Escape on the pause menu)
const keyFor = (state, ...btn) => {
  pad = mk(); gp.update(1 / 60, state); take();
  pad = mk([0, 0, 0, 0], ...btn); gp.update(1 / 60, state);
  const k = take().filter((x) => x[0] === 'key').map((x) => x[1]);
  pad = mk(); gp.update(1 / 60, state); take();
  return k;
};
assert.deepEqual(keyFor('title', A), ['Enter']);
assert.deepEqual(keyFor('title', B), ['Escape']);
assert.deepEqual(keyFor('title', START), ['Enter']);
assert.deepEqual(keyFor('paused', START), ['Escape']);
assert.deepEqual(keyFor('nameEntry', UP), ['ArrowUp']);

// unplugging in play zeroes the pad's contribution
pad = mk([0.9, 0, 0, 0]); gp.update(1 / 60, 'play'); take();
pad = null; gp.update(1 / 60, 'play');
c = take();
assert.deepEqual(last('stick', c), ['stick', 'pad', 0, 0]);
assert.deepEqual(last('aim', c), ['aim', 'pad', null]);

console.log('gamepad: all tests passed');
