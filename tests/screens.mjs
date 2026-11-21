// Renders every menu screen to PNG (2x) without a browser, and drives them with
// fake key presses to check the flow. Usage: node tests/screens.mjs outdir
import { createCanvas } from 'canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
globalThis.document = { createElement: () => createCanvas(1, 1) };
const { World } = await import('../js/world.js');
const { loadSprites } = await import('../js/sprites.js');
const { makeRng } = await import('../js/rng.js');
const { makeGround, makeSnow, drawWorld, drawHud } = await import('../js/render.js');
const { createScreens } = await import('../js/screens.js');
const { makeStore } = await import('../js/highscores.js');

const out = process.argv[2] || 'screens-out';
mkdirSync(out, { recursive: true });

const rng = makeRng(7), spr = loadSprites(), snow = makeSnow(rng), backdrop = makeGround(makeRng(8));
const store = makeStore(() => undefined);
for (const [i, s] of [['ROB', 21300, 12, false], ['AMY', 15800, 9, true], ['JIM', 9400, 7, false], ['KAT', 4200, 5, false], ['ZED', 1500, 3, false]].entries()) {
  store.insert({ initials: s[0], score: s[1], night: s[2], hard: s[3] });
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
    nextNight: () => log.push('nextNight'), finishRun: (r) => log.push('finishRun:' + r.score),
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
press('Enter'); assert.deepEqual(log.splice(0), ['go:howto']); // second item is HOW TO PLAY (hard locked)
assert.ok(events.includes('menuSelect')); events.length = 0;
current = screens.title; current.enter();
press('ArrowDown', 'ArrowDown', 'Enter'); assert.deepEqual(log.splice(0), ['go:highscores']);
current = screens.title; current.enter();
press('Enter'); assert.deepEqual(log.splice(0), ['newGame:false']);
store.unlockHard();
current.enter(); press('ArrowDown'); press('Enter'); assert.deepEqual(log.splice(0), ['newGame:true']);
// mouse: click on an item (START, HARD MODE, HOW TO PLAY, HIGH SCORES)
current.enter(); queue.click = { x: 320, y: 210 }; current.update(1 / 60);
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
current.enter(); press('ArrowDown', 'Enter'); assert.deepEqual(log.splice(0), ['quit']);

// night complete: mid-count, skip, then continue
const summary = { food: 400, foodCount: 4, kills: 100, killCount: 4, time: 52, par: 70, bonus: 180 };
current = screens.nightEnd; current.enter({ summary, night: 3, score: 2400 });
run(1.4); snap('night-end-counting');
press('Enter'); assert.equal(log.length, 0); // too early: ignored? (t>0.5 so this skips the count)
assert.ok(current.done());
snap('night-end-done');
press('Enter'); assert.deepEqual(log.splice(0), ['nextNight']);
current.enter({ summary, night: 12, score: 18000 }); run(3.2); snap('night-end-final');

// game over
current = screens.gameover; current.enter({ score: 4200, night: 7, hard: false });
press('Enter'); assert.equal(log.length, 0); // locked for the first second
run(1.2); snap('gameover'); press('Enter'); assert.deepEqual(log.splice(0), ['finishRun:4200']);

// ending, with the partridge landing
current = screens.ending; current.enter({ score: 21800, night: 12, hard: false });
run(0.5); snap('ending-falling'); run(2); snap('ending');
press('Enter'); assert.deepEqual(log.splice(0), ['finishRun:21800']);

// initials: type, arrows, backspace, click arrows, confirm
current = screens.initials; current.enter({ score: 5000, night: 8, hard: true });
run(0.3); snap('initials-default');
press('KeyR', 'KeyO', 'KeyB'); assert.deepEqual(current.letters, [17, 14, 1]);
press('Backspace', 'ArrowUp'); assert.deepEqual(current.letters, [17, 15, 1]);   // cursor moved back to slot 2
press('ArrowRight', 'ArrowDown'); assert.deepEqual(current.letters, [17, 15, 0]); // slot 3, wraps A <- B
queue.click = { x: 320 + 40, y: 168 - 22 }; current.update(1 / 60); // click the up arrow above slot 3
assert.deepEqual(current.letters, [17, 15, 1]);
snap('initials-typed');
press('Enter');
assert.deepEqual(log.splice(0), ['go:highscores']);
assert.equal(store.load().find((e) => e.score === 5000).initials, 'RPB');
assert.equal(store.lastInitials(), 'RPB');
snap('highscores-new');  // 'current' is now the high score screen
run(0.4); snap('highscores-new-b');

// empty table
const empty = createScreens({ ...env, scores: makeStore(() => undefined) });
current = empty.highscores; current.enter({ highlight: 0 }); run(0.5); snap('highscores-empty');
press('Enter'); assert.deepEqual(log.splice(0), ['go:title']);

console.log('screens: all checks passed, images in', out);
