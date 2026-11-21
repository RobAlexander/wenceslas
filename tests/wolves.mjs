// Wolf behaviour: circling while nobody carries food, crouch-then-leap at a carrier,
// stealing (and biting) on contact, running off, and dropping the food when killed.
// Run with: node tests/wolves.mjs
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { makeRng } from '../js/rng.js';
import { nightParams, WOLVES_FROM, CFG } from '../js/config.js';

const STILL = { mx: 0, my: 0, ax: 0, ay: 0, swing: false };

// A night with nothing spawning, so each test controls exactly what is on screen.
function quietWorld(seed = 1) {
  const events = [];
  const w = new World({ night: 6, hard: false, rng: makeRng(seed), events });
  Object.assign(w.p, { maxRobbers: 0, maxWolves: 0, maxFood: 0, maxWanderingPages: 0 });
  w.foods = [];
  w.king.x = 320; w.king.y = 200;
  w.obstacles = [];
  w.trail = [{ x: w.king.x, y: w.king.y }];
  return { w, events };
}

// Recruit the starting page and hand it some food.
function carrier(w, food = 'bread') {
  const pg = w.pages[0];
  pg.state = 'follow';
  pg.x = w.king.x - CFG.pageSpacing; pg.y = w.king.y;
  w.line.push(pg);
  pg.food = food;
  return pg;
}

function addWolf(w, x, y) {
  w.spawnWolf();
  const wf = w.wolves.at(-1);
  wf.x = x; wf.y = y; wf.entered = true;
  w.startCircling(wf);
  return wf;
}

const step = (w, secs, inp = STILL, each) => {
  for (let i = 0; i < Math.round(secs * 60); i++) { w.update(1 / 60, inp); each?.(); }
};

// No wolves before WOLVES_FROM; at least one from then on.
for (let n = 1; n <= 12; n++) assert.equal(nightParams(n).maxWolves > 0, n >= WOLVES_FROM, 'night ' + n);

// Circling: with no food carried, a wolf prowls round the king at a distance and never attacks.
{
  const { w, events } = quietWorld();
  w.pages.length = 0;
  const wf = addWolf(w, 40, 60);
  step(w, 3);
  let turned = 0, last = Math.atan2(wf.y - w.king.y, wf.x - w.king.x), minD = Infinity, maxD = 0;
  step(w, 8, STILL, () => {
    const a = Math.atan2(wf.y - w.king.y, wf.x - w.king.x);
    let d = a - last;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    turned += d; last = a;
    const r = Math.hypot(wf.x - w.king.x, wf.y - w.king.y);
    minD = Math.min(minD, r); maxD = Math.max(maxD, r);
  });
  assert.equal(wf.state, 'circle');
  assert.ok(Math.abs(turned) > Math.PI * 2, 'goes round at least once in 8 s, turned ' + turned.toFixed(2));
  assert.ok(minD > 25 && maxD < 110, `keeps its distance (${minD.toFixed(0)}..${maxD.toFixed(0)})`);
  assert.equal(w.king.hp, CFG.kingMaxHp, 'circling wolves do no harm');
  assert.ok(!events.includes('wolfSteal'));
}

// Stealing: crouch (the telegraph), then leap; the page loses its food and some health,
// and the wolf runs off the screen with it.
{
  const { w, events } = quietWorld(2);
  const pg = carrier(w, 'meat');
  const wf = addWolf(w, 320, 300);
  const seen = [];
  step(w, 3, STILL, () => { if (seen.at(-1) !== wf.state) seen.push(wf.state); });
  assert.ok(events.includes('wolfSteal'), 'stole the food; states: ' + seen.join(' '));
  const ci = seen.indexOf('crouch');
  assert.ok(ci >= 0 && seen.indexOf('leap') === ci + 1, 'crouches before it leaps: ' + seen.join(' '));
  assert.equal(pg.food, null);
  assert.equal(pg.hp, CFG.pageMaxHp - CFG.wolfBite, 'the page is bitten');
  assert.equal(wf.food, 'meat');
  assert.equal(wf.state, 'flee');
  step(w, 6);
  assert.equal(w.wolves.length, 0, 'gone off the screen');
  assert.ok(events.includes('wolfEscape'));
  assert.equal(w.foods.length, 0, 'the food went with it');
}

// A bite that kills a page doesn't also drop the food: the wolf has it.
{
  const { w } = quietWorld(3);
  const pg = carrier(w, 'wine');
  pg.hp = 1;
  const wf = addWolf(w, 320, 290);
  step(w, 3);
  assert.ok(!w.pages.includes(pg), 'the page died of the bite');
  assert.equal(w.foods.length, 0);
  assert.equal(wf.food, 'wine');
}

// Killing a wolf as it runs off drops the food where it falls.
{
  const { w, events } = quietWorld(4);
  const wf = addWolf(w, 345, 192);
  wf.food = 'bread'; wf.state = 'flee'; wf.exit = { x: 700, y: 192 };
  step(w, 0.1, { ...STILL, ax: wf.x, ay: wf.y - 6, swing: true });
  assert.equal(w.wolves.length, 0, 'one hit kills a wolf');
  assert.equal(w.kills, 1);
  assert.ok(events.includes('foodDrop'));
  assert.equal(w.foods.length, 1);
  assert.equal(w.foods[0].kind, 'bread');
}

// A sword hit during the crouch cancels the leap.
{
  const { w, events } = quietWorld(6);
  const pg = carrier(w);
  const wf = addWolf(w, pg.x + 20, pg.y + 20);
  wf.hp = 2;                                    // tough, so it survives the hit
  for (let i = 0; i < 120 && wf.state !== 'crouch'; i++) w.update(1 / 60, STILL);
  assert.equal(wf.state, 'crouch');
  w.hitFoe(wf, 1, 0);
  assert.equal(wf.state, 'circle', 'knocked out of the crouch');
  step(w, 0.2);
  assert.ok(!events.includes('wolfSteal'));
}

// The quick-tap auto-aim turns toward wolves too.
{
  const { w } = quietWorld(7);
  w.pages.length = 0;
  const wf = addWolf(w, w.king.x - 40, w.king.y);
  w.king.aim = 0;
  w.snapAim();
  assert.ok(Math.cos(w.king.aim) < -0.9, 'aims left at the wolf');
  assert.ok(w.foes().includes(wf));
}

console.log('wolves: all tests passed');
