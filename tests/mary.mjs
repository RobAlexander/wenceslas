// Mary: she may turn up on any night; an ice block rises and splits (she can't be hurt yet), then
// she follows Wenceslas slowly, throwing snowballs that fly like arrows; three sword hits kill her.
// Run with: node tests/mary.mjs
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { makeRng } from '../js/rng.js';
import { nightParams, CFG, NIGHTS } from '../js/config.js';
import { CURVES } from '../js/tuning.js';

const STILL = { mx: 0, my: 0, ax: 0, ay: 0, swing: false };

// A quiet night: nothing else spawns and nobody else is about. Mary comes only if asked.
function quietWorld(seed = 1, { chance = 0, night = 6, hard = false } = {}) {
  const events = [];
  const w = new World({ night, hard, rng: makeRng(seed), events });
  Object.assign(w.p, { maxRobbers: 0, maxWolves: 0, maxArchers: 0, maryChance: chance, maxFood: 0, maxWanderingPages: 0 });
  w.foods = []; w.pages = []; w.line = []; w.obstacles = [];
  w.king.x = 320; w.king.y = 200;
  w.trail = [{ x: w.king.x, y: w.king.y }];
  return { w, events };
}
const step = (w, secs, inp = STILL, each) => {
  for (let i = 0; i < Math.round(secs * 60); i++) { w.update(1 / 60, inp); each?.(); }
};
// Mary at a place, already out of her ice
function addMary(w, x, y) {
  w.spawnMary();
  const m = w.maries.at(-1);
  m.x = x; m.y = y; m.state = 'move'; m.cd = 0;
  return m;
}

// ---- any night can have her, and the odds are the same on all of them
for (let n = 1; n <= NIGHTS; n++) assert.equal(nightParams(n).maryChance, CURVES.mary.chance, 'night ' + n);

// ---- chance 0: never; chance 1: always, once, within her window
{
  const { w } = quietWorld(3, { chance: 0 });
  step(w, CURVES.mary.latest + 10);
  assert.equal(w.maries.length, 0, 'chance 0: never');
  assert.equal(w.events.filter((e) => e === 'maryRise').length, 0);
}
for (let seed = 1; seed <= 5; seed++) {
  const { w, events } = quietWorld(seed, { chance: 1, night: 1 });
  w.king.god = true;
  step(w, CURVES.mary.earliest - 1);
  assert.equal(w.maries.length, 0, 'not before the earliest time');
  step(w, CURVES.mary.latest - CURVES.mary.earliest + 3);
  assert.equal(w.maries.length, 1, 'chance 1: she comes, on night 1 as on any other');
  assert.equal(events.filter((e) => e === 'maryRise').length, 1);
  step(w, 30);
  assert.equal(w.maries.length, 1, 'only one comes in a night');
  assert.equal(events.filter((e) => e === 'maryRise').length, 1);
}
// ...and over many nights the share that has her is about the chance
{
  let seen = 0;
  const N = 400, rng = makeRng(99);
  for (let i = 0; i < N; i++) {
    const w = new World({ night: 1 + (i % NIGHTS), hard: false, rng, events: [] });
    w.update(1 / 60, STILL);
    if (w.maryTimer !== Infinity) seen++;
  }
  assert.ok(Math.abs(seen / N - CURVES.mary.chance) < 0.08, `about ${CURVES.mary.chance} of nights have her, got ${seen / N}`);
}

// ---- she rises well away from Wenceslas, then the ice splits, and only then can she be hit
{
  const { w } = quietWorld(2);
  w.spawnMary();
  const m = w.maries[0];
  assert.ok(Math.hypot(m.x - w.king.x, m.y - w.king.y) >= CFG.maryAppearDistance - 1, 'rises away from him');
  assert.equal(m.state, 'rise');
  assert.equal(w.foes().includes(m), false, 'not a target inside the ice');
  // the king stands on her and swings: nothing happens
  w.king.x = m.x - 10; w.king.y = m.y; w.king.god = true;
  w.trail = [{ x: w.king.x, y: w.king.y }];
  step(w, CFG.maryRise / 2, { mx: 0, my: 0, ax: m.x, ay: m.y - 8, swing: true });
  assert.equal(m.hp, CFG.maryHp, 'rising ice: no damage');
  step(w, CFG.maryRise / 2 + 0.05);
  assert.equal(m.state, 'split', 'the block splits');
  assert.equal(w.foes().includes(m), false, 'and she can still not be hit');
  step(w, CFG.marySplit + 0.05);
  assert.equal(m.state, 'move', 'then she is out');
  assert.equal(w.foes().includes(m), true);
  assert.equal(m.hp, CFG.maryHp);
}

// ---- it takes three hits
{
  const { w, events } = quietWorld(4);
  w.king.god = true;
  const m = addMary(w, 360, 200);
  m.cd = 99;                                       // no throwing during this
  const swingAtHer = () => { w.king.cd = 0; w.king.hit.clear(); w.update(1 / 60, { mx: 0, my: 0, ax: m.x, ay: m.y - 8, swing: true }); step(w, 0.5, { mx: 0, my: 0, ax: m.x, ay: m.y - 8, swing: false }); };
  for (let i = 1; i <= CFG.maryHp; i++) {
    m.x = 350; m.y = 200; m.kbx = m.kby = 0; m.stun = 0;
    assert.equal(w.maries.length, 1, 'alive before hit ' + i);
    swingAtHer();
    if (i < CFG.maryHp) assert.equal(m.hp, CFG.maryHp - i, 'hit ' + i);
  }
  assert.equal(w.maries.length, 0, 'dead after ' + CFG.maryHp + ' hits');
  assert.equal(w.kills, 1, 'counts as a kill');
  assert.ok(events.includes('kill'));
}

// ---- she follows slowly, and keeps her distance short of touching
{
  const { w } = quietWorld(5);
  w.king.god = true;
  const m = addMary(w, 80, 200);
  m.cd = 99;
  const x0 = m.x;
  step(w, 2);
  const moved = m.x - x0;
  assert.ok(moved > CFG.marySpeed * 2 * 0.8 && moved < CFG.marySpeed * 2 * 1.2, 'walks at marySpeed: moved ' + moved);
  assert.ok(CFG.marySpeed < CFG.kingSpeed / 2, 'much slower than the king');
  step(w, 60);
  const d = Math.hypot(m.x - w.king.x, m.y - w.king.y);
  assert.ok(d >= CFG.maryStopDistance - 3 && d <= CFG.maryStopDistance + 3, 'stops about maryStopDistance away: ' + d);
}

// ---- she holds a snowball up, then throws it; it is slower than an arrow and hits for 1
{
  const { w, events } = quietWorld(6);
  const m = addMary(w, 200, 200);
  m.cd = 0;
  step(w, 0.1);
  assert.ok(m.windup > 0, 'holds the snowball up first');
  assert.equal(w.arrows.length, 0);
  step(w, CFG.maryWindup);
  assert.equal(w.arrows.length, 1, 'then throws');
  assert.ok(w.arrows[0].snow);
  assert.ok(events.includes('arrowShoot'));
  assert.ok(Math.hypot(w.arrows[0].vx, w.arrows[0].vy) < CFG.arrowSpeed, 'slower than an arrow');
  // a ball straight at the king hurts him for snowballDamage
  w.arrows.length = 0;
  w.arrows.push({ id: 9001, x: w.king.x - 6, y: w.king.y, vx: CFG.snowballSpeed, vy: 0, angle: 0, life: 3, snow: true });
  const hp = w.king.hp;
  step(w, 0.2);
  assert.equal(w.king.hp, hp - CFG.snowballDamage);
  assert.equal(w.arrows.filter((a) => a.snow && a.x > w.king.x - 6).length, 0, 'the ball is used up');
}

// ---- snowballs behave like arrows: a tree stops one, a rock doesn't, a page in the way takes it
{
  const { w } = quietWorld(7);
  w.king.god = true;
  w.obstacles = [{ kind: 'tree', x: 300, y: 200, r: 4, size: 20, variant: 0 }];
  w.arrows.push({ id: 9002, x: 280, y: 200, vx: CFG.snowballSpeed, vy: 0, angle: 0, life: 3, snow: true });
  step(w, 0.5);
  assert.equal(w.arrows.length, 0, 'stopped by the tree');
  assert.equal(w.king.hp, CFG.kingMaxHp);
}
{
  const { w } = quietWorld(8);
  w.king.god = true;
  w.obstacles = [{ kind: 'rock', x: 300, y: 200, r: 5, size: 10 }];
  w.arrows.push({ id: 9003, x: 280, y: 200, vx: CFG.snowballSpeed, vy: 0, angle: 0, life: 3, snow: true });
  step(w, 0.25);                                   // 30 pixels on: past the rock, short of the king
  assert.ok(w.arrows[0].x > 305, 'is past the rock');
  assert.equal(w.arrows.length, 1, 'flies over the rock');
}
{
  const { w } = quietWorld(9);
  w.spawnPage(true);
  const pg = w.pages[0];
  pg.x = 300; pg.y = 200; pg.target = { x: 300, y: 200 };
  const hp = pg.hp;
  w.arrows.push({ id: 9004, x: 285, y: 200, vx: CFG.snowballSpeed, vy: 0, angle: 0, life: 3, snow: true });
  step(w, 0.3);
  assert.equal(pg.hp, hp - CFG.snowballDamage, 'a page in the way takes it');
}

// ---- a hit spoils the throw
{
  const { w } = quietWorld(10);
  w.king.god = true;
  const m = addMary(w, 340, 200);
  step(w, 0.1);
  assert.ok(m.windup > 0);
  w.hitFoe(m, 1, 0);
  assert.equal(m.windup, 0);
  assert.equal(w.arrows.length, 0);
  assert.ok(m.cd >= CFG.maryCooldown * 0.5 - 1e-9);
}

// ---- hard mode: faster, but still slower than the king (also checked in tests/tuning.mjs)
{
  const { w } = quietWorld(11, { hard: true });
  w.king.god = true;
  const m = addMary(w, 80, 200); m.cd = 99;
  const x0 = m.x; step(w, 2);
  assert.ok(m.x - x0 < CFG.kingSpeed * 2 * 0.6);
  assert.ok(m.x - x0 > CFG.marySpeed * 2 * 1.2, 'hard mode is quicker');
}

// ---- the dev console's "kill" and the end of a night clear the snowballs too
{
  const { w } = quietWorld(12);
  w.done = true;
  w.arrows.push({ id: 9005, x: 100, y: 100, vx: 0, vy: 0, angle: 0, life: 3, snow: true });
  w.update(1 / 60, STILL);
  assert.equal(w.arrows.length, 0);
}

console.log('mary: all tests passed');
