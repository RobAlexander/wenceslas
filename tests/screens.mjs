// Renders every menu screen to PNG (2x) without a browser, and drives them with
// fake key presses to check the flow. Usage: node tests/screens.mjs outdir
import { createCanvas } from 'canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
globalThis.document = { createElement: () => createCanvas(1, 1) };
const { World } = await import('../js/world.js');
const { NIGHTS } = await import('../js/config.js');
const { loadSprites } = await import('../js/sprites.js');
const { makeRng } = await import('../js/rng.js');
const { makeGround, makeSnow, drawWorld, drawHud } = await import('../js/render.js');
const { createScreens } = await import('../js/screens.js');
const { makeStore } = await import('../js/highscores.js');
const { defaultBindings } = await import('../js/keys.js');

const out = process.argv[2] || 'screens-out';
mkdirSync(out, { recursive: true });

const rng = makeRng(7), spr = loadSprites(), snow = makeSnow(rng), backdrop = makeGround(makeRng(8));
const store = makeStore(() => undefined);
for (const [i, s] of [['ROB', 21300, 12, false], ['AMY', 15800, 9, true], ['JIM', 9400, 7, false], ['KAT', 4200, 5, false], ['ZED', 1500, 3, false]].entries()) {
  store.insert({ name: s[0], score: s[1], night: s[2], hard: s[3] });
}

// Fake input: tests push keys and clicks; mouse position is settable.
const queue = { keys: [], click: null };
const input = {
  st: { mouse: { x: 0, y: 0 }, mouseSeen: false, lastDevice: 'mouse' },
  takeKeys: () => queue.keys.splice(0),
  takeClick: () => { const c = queue.click; queue.click = null; return c; },
};
const events = [];
const log = [];
const env = {
  input, events, spr, scores: store, snow, backdrop,
  go: (name, data) => { log.push('go:' + name); current = screens[name]; current.enter(data); },
  actions: {
    newGame: (h) => log.push('newGame:' + h), resume: () => log.push('resume'), quitToTitle: () => log.push('quit'),
    nextNight: () => log.push('nextNight'), setMouseAim: (m) => { log.push('aim:' + m); store.setMouseAim(m); }, setKeyBindings: (b) => store.setKeyBindings(b), finishRun: (r) => log.push('finishRun:' + r.score),
  },
};
const screens = createScreens(env);
let current;

const world = new World({ night: 5, hard: false, rng: makeRng(3), events: [] });
const ground = makeGround(makeRng(4));
for (let i = 0; i < 60 * 8; i++) world.update(1 / 60, { mx: 0.3, my: 0, ax: 300, ay: 100, swing: false });

function snap(name) {
  const c = createCanvas(640, 360), ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (current.overlay) { drawWorld(ctx, world, spr, ground, snow, 1); drawHud(ctx, world, spr, 1200); }
  current.draw(ctx);
  const big = createCanvas(1280, 720), b = big.getContext('2d');
  b.imageSmoothingEnabled = false;
  b.drawImage(c, 0, 0, 1280, 720);
  writeFileSync(`${out}/${name}.png`, big.toBuffer('image/png'));
}
const run = (secs) => { for (let i = 0; i < secs * 60; i++) current.update(1 / 60); };
const press = (...k) => { queue.keys.push(...k); current.update(1 / 60); };

// title
current = screens.title; current.enter(); run(2.2); snap('title');
press('ArrowDown'); assert.ok(events.includes('menuMove')); events.length = 0;
press('ArrowDown', 'Enter'); assert.deepEqual(log.splice(0), ['go:howto']); // START, OPTIONS, HOW TO PLAY (hard locked)
assert.ok(events.includes('menuSelect')); events.length = 0;
current = screens.title; current.enter();
press('ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter'); assert.deepEqual(log.splice(0), ['go:highscores']);

// options: from the title; toggles the mouse aim, Escape and BACK both return to the menu
current = screens.title; current.enter(); press('ArrowDown', 'Enter'); assert.deepEqual(log, []);
run(0.3); snap('title-options');
assert.equal(store.mouseAim(), 'move');
press('Enter'); assert.deepEqual(log.splice(0), ['aim:pointer']); assert.equal(store.mouseAim(), 'pointer');
run(0.3); snap('title-options-cursor');
press('Enter'); assert.deepEqual(log.splice(0), ['aim:move']);
press('ArrowDown', 'ArrowDown', 'Enter');          // BACK (after KEYS)
press('Enter'); assert.deepEqual(log.splice(0), [], 'back on the menu: the highlight is still on OPTIONS');
press('Escape');                                   // Escape closes the options
press('ArrowUp', 'Enter'); assert.deepEqual(log.splice(0), ['newGame:false']);   // the menu is live again
// key bindings editor: OPTIONS, then KEYS (the second item)
current = screens.title; current.enter(); press('ArrowDown', 'Enter'); press('ArrowDown', 'Enter');
run(0.3); snap('keys');
assert.deepEqual(log, [], 'nothing happens outside the panel');
press('ArrowRight', 'Enter'); run(0.1); snap('keys-listening');             // MOVE UP, second key: waiting for a key
press('KeyI'); assert.deepEqual(store.keyBindings().up, ['KeyW', 'KeyI', '']);
press('Enter', 'Escape'); assert.deepEqual(store.keyBindings().up, ['KeyW', 'KeyI', ''], 'Escape stops waiting and changes nothing');
press('Enter', 'Backquote'); assert.deepEqual(store.keyBindings().up, ['KeyW', 'KeyI', ''], 'the dev console key is refused, and it keeps waiting');
press('KeyU'); assert.deepEqual(store.keyBindings().up, ['KeyW', 'KeyU', ''], 'and then a good key is taken');
press('ArrowLeft', 'Enter', 'ArrowUp');                                        // the first slot takes the up arrow...
assert.deepEqual(store.keyBindings().up, ['ArrowUp', 'KeyU', '']);
assert.deepEqual(store.keyBindings().atkN, ['', 'Numpad8', ''], '...from the function that had it');
run(0.1); snap('keys-changed');
press('Backspace'); assert.deepEqual(store.keyBindings().up, ['', 'KeyU', ''], 'Backspace clears the slot');
press('ArrowUp', 'ArrowUp', 'Enter');                                          // up from the first row wraps to BACK; then RESET
assert.deepEqual(store.keyBindings(), defaultBindings(), 'reset puts the usual keys back');
assert.deepEqual(log, []);
press('Escape');                                                               // leaves the editor, not the options
press('Enter'); run(0.1);                                                      // the highlight is on KEYS: back in the editor
press('ArrowUp', 'Enter');                                                     // BACK, the last row of the editor
press('ArrowDown', 'Enter');                                                   // BACK in the options
press('ArrowUp', 'Enter'); assert.deepEqual(log.splice(0), ['newGame:false'], 'back on the title menu');
// the editor by mouse: click a slot, then press a key
current = screens.title; current.enter(); press('ArrowDown', 'Enter'); press('ArrowDown', 'Enter'); run(0.1);
queue.click = { x: 300, y: 32 + 3 * 13 + 3 }; current.update(1 / 60); run(0.1);   // MOVE RIGHT, first key
press('KeyK'); assert.deepEqual(store.keyBindings().right, ['KeyK', '', '']);
store.setKeyBindings(defaultBindings());
press('Escape'); press('Escape');
assert.deepEqual(log.splice(0), [], 'Escape closes the editor, then the options');
press('ArrowUp', 'Enter'); assert.deepEqual(log.splice(0), ['newGame:false']);
current = screens.title; current.enter(); press('ArrowDown', 'Enter'); press('Escape'); press('ArrowUp', 'Enter');
assert.deepEqual(log.splice(0), ['newGame:false']);
current = screens.title; current.enter();
press('Enter'); assert.deepEqual(log.splice(0), ['newGame:false']);
store.unlockHard();
current.enter(); press('ArrowDown'); press('Enter'); assert.deepEqual(log.splice(0), ['newGame:true']);
// mouse: click on an item (START, HARD MODE, OPTIONS, HOW TO PLAY, HIGH SCORES)
current.enter(); queue.click = { x: 320, y: 230 }; current.update(1 / 60);
assert.deepEqual(log.splice(0), ['go:highscores']);
snap('title-hard-unlocked');

// how to play: one page per device's controls; any confirm or click returns to the title
current = screens.howto; current.enter(); run(0.4); snap('howto');
for (const dev of ['touch', 'pad']) { input.st.lastDevice = dev; snap('howto-' + dev); }
input.st.lastDevice = 'mouse';
press('Enter'); assert.deepEqual(log.splice(0), ['go:title']);
current = screens.howto; current.enter(); press('Escape'); assert.deepEqual(log, [], 'ignored for the first moment');
run(0.4); queue.click = { x: 10, y: 10 }; current.update(1 / 60); assert.deepEqual(log.splice(0), ['go:title']);

// pause
current = screens.paused; current.enter(); run(0.5); snap('paused');
press('Escape'); assert.deepEqual(log.splice(0), ['resume']);
current.enter(); press('ArrowDown', 'ArrowDown', 'Enter'); assert.deepEqual(log.splice(0), ['quit']);
// pause options: Escape closes the options first, and only then resumes
current.enter(); press('ArrowDown', 'Enter'); run(0.3); snap('paused-options');
press('Escape'); assert.deepEqual(log, []);
press('Escape'); assert.deepEqual(log.splice(0), ['resume']);

// night complete: mid-count, skip, then continue
const summary = { food: 400, foodCount: 4, kills: 100, killCount: 4, time: 52, par: 70, bonus: 180 };
current = screens.nightEnd; current.enter({ summary, night: 3, score: 2400 });
run(1.4); snap('night-end-counting');
press('Enter'); assert.equal(log.length, 0); // too early: ignored? (t>0.5 so this skips the count)
assert.ok(current.done());
snap('night-end-done');
press('Enter'); assert.deepEqual(log.splice(0), ['nextNight']);
current.enter({ summary, night: NIGHTS, score: 18000 }); run(3.2); snap('night-end-final');

// game over
current = screens.gameover; current.enter({ score: 4200, night: 7, hard: false });
assert.equal(current.invited(), true, 'a score that makes the table is announced');
press('Enter'); assert.equal(log.length, 0); // locked for the first second
run(1.2); snap('gameover-high-score'); press('Enter'); assert.deepEqual(log.splice(0), ['finishRun:4200']);
current.enter({ score: 0, night: 2, hard: false });
assert.equal(current.invited(), false, 'no points, no high score');
current.enter({ score: 1, night: 2, hard: false });
assert.equal(current.invited(), true, 'any points qualify while the table has room');
current.enter({ score: 700, night: 2, hard: false });
run(1.2); snap('gameover');

// ending, with the partridge landing
current = screens.ending; current.enter({ score: 21800, night: 12, hard: false });
run(0.5); snap('ending-falling'); run(2); snap('ending');
press('Enter'); assert.deepEqual(log.splice(0), ['finishRun:21800']);

// name entry: up to 8 characters; the last name is offered, and the first typed character replaces it
current = screens.nameEntry; current.enter({ score: 5000, night: 8, hard: true });
run(0.3); snap('name-default');
assert.equal(current.name(), 'AAA', 'offered the last name (AAA before there is one)');
press('KeyR', 'KeyO', 'KeyB'); assert.equal(current.name(), 'ROB', 'typing replaces the offered name');
press('KeyE', 'KeyR', 'KeyT', 'KeyA', 'Digit7'); assert.equal(current.name(), 'ROBERTA7', 'letters and digits');
press('KeyX'); assert.equal(current.name().length, 8, 'never more than 8'); assert.equal(current.name(), 'ROBERTAX');
press('Backspace'); assert.equal(current.name(), 'ROBERTA', 'backspace deletes');
press('Backspace'); assert.equal(current.name(), 'ROBERT');
press('Space', 'Minus'); assert.equal(current.name(), 'ROBERT -', 'space and punctuation');
press('Backspace', 'Backspace'); assert.equal(current.name(), 'ROBERT', 'the dash, then the space');
press('Backspace', 'Backspace'); assert.equal(current.name(), 'ROBE');
press('ArrowLeft', 'ArrowUp'); assert.equal(current.name(), 'ROBF', 'left moves to the E, up changes it');
press('ArrowDown', 'ArrowDown'); assert.equal(current.name(), 'ROBD', 'down goes the other way');
press('ArrowRight', 'KeyB'); assert.equal(current.name(), 'ROBDB', 'typing carries on from the cursor');
queue.click = { x: 180, y: 146 }; current.update(1 / 60);        // the up arrow over the first slot
assert.equal(current.name(), 'SOBDB', 'clicking an arrow changes that slot');
queue.click = { x: 180, y: 205 }; current.update(1 / 60);        // the down arrow under it
assert.equal(current.name(), 'ROBDB');
snap('name-typed');
press('Enter');
assert.deepEqual(log.splice(0), ['go:highscores']);
assert.equal(store.load().find((e) => e.score === 5000).name, 'ROBDB');
assert.equal(store.lastName(), 'ROBDB');
// the saved name is offered next time, and a different one replaces it whole
current = screens.nameEntry; current.enter({ score: 10, night: 1, hard: false });
assert.equal(current.name(), 'ROBDB');
press('KeyK'); assert.equal(current.name(), 'K');
// there has to be a name: with nothing in any slot, Enter and OK do nothing
press('Backspace'); assert.equal(current.name(), '');
snap('name-empty');
events.length = 0;
press('Enter'); queue.click = { x: 320, y: 252 }; current.update(1 / 60);
assert.deepEqual(log.splice(0), [], 'no empty names');
assert.ok(!events.includes('menuSelect'));
press('KeyZ'); queue.click = { x: 320, y: 252 }; current.update(1 / 60);   // the OK button
assert.deepEqual(log.splice(0), ['go:highscores']);
assert.equal(store.lastName(), 'Z');
// a long name fits the table
current = screens.nameEntry; current.enter({ score: 5100, night: 9, hard: false });
press(...'LONGNAME'.split('').map((c) => 'Key' + c)); press('Enter'); log.splice(0);
snap('highscores-new');  // 'current' is now the high score screen
run(0.4); snap('highscores-new-b');

// empty table
const empty = createScreens({ ...env, scores: makeStore(() => undefined) });
current = empty.highscores; current.enter({ highlight: 0 }); run(0.5); snap('highscores-empty');
press('Enter'); assert.deepEqual(log.splice(0), ['go:title']);

console.log('screens: all checks passed, images in', out);
