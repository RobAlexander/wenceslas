// Archer behaviour: they keep their distance, draw a bow (the telegraph) and loose one
// inaccurate arrow at Wenceslas only; trees stop arrows, rocks and walls don't; a page in the
// path takes the hit; and an archer is slow enough to be run down.
// Run with: node tests/archers.mjs
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { makeRng } from '../js/rng.js';
import { nightParams, ARCHERS_FROM, CFG, NIGHTS } from '../js/config.js';
import { CURVES } from '../js/tuning.js';

const STILL = { mx: 0, my: 0, ax: 0, ay: 0, swing: false };

// A night with nothing spawning and no pages, so each test controls exactly what is on screen.
function quietWorld(seed = 1, hard = false) {
  const events = [];
  const w = new World({ night: 6, hard, rng: makeRng(seed), events });
  Object.assign(w.p, { maxRobbers: 0, maxWolves: 0, maxArchers: 0, maryChance: 0, maxFood: 0, maxWanderingPages: 0 });
  w.foods = [];
  w.pages = [];
  w.line = [];
  w.obstacles = [];
  w.king.x = 320; w.king.y = 200;
  w.trail = [{ x: w.king.x, y: w.king.y }];
  return { w, events };
}

function addArcher(w, x, y) {
  w.spawnArcher();
  const ar = w.archers.at(-1);
  ar.x = x; ar.y = y; ar.entered = true; ar.cd = 0;
  return ar;
}

function addPage(w, x, y) {
  w.spawnPage(true);
  const pg = w.pages.at(-1);
  pg.x = x; pg.y = y; pg.target = { x, y };
  return pg;
}

const step = (w, secs, inp = STILL, each) => {
  for (let i = 0; i < Math.round(secs * 60); i++) { w.update(1 / 60, inp); each?.(); }
};

// An arrow already in flight, heading east at normal speed.
const arrowAt = (w, x, y) => w.arrows.push({ id: 9000 + w.arrows.length, x, y, vx: CFG.arrowSpeed, vy: 0, angle: 0, life: CFG.arrowLife });

// ---- counts per night: none before ARCHERS_FROM, at least one from then, never more than the most allowed
{
  let last = 0;
  for (let n = 1; n <= NIGHTS; n++) {
    const m = nightParams(n).maxArchers;
    assert.equal(m > 0, n >= ARCHERS_FROM, 'night ' + n);
    assert.ok(m <= CURVES.archers.most, 'night ' + n);
    assert.ok(m >= last, 'never fewer than the night before');
    last = m;
  }
}

// ---- slow enough to be run down, even in hard mode
assert.ok(CFG.archerSpeed * CFG.hardSpeedMul < CFG.kingSpeed * 0.65, 'approach speed');
assert.ok(CFG.archerRetreatSpeed * CFG.hardSpeedMul < CFG.kingSpeed * 0.65, 'retreat speed');

// ---- approach, draw (telegraph), loose
{
  const { w, events } = quietWorld();
  const ar = addArcher(w, 320, 10);                 // off the top: farther than their range
  const seen = [];
  let shot = null;
  step(w, 8, STILL, () => {
    if (seen.at(-1) !== ar.state) seen.push(ar.state);
    if (!shot && events.includes('arrowShoot')) {
      const a = w.arrows[0];
      const toKing = Math.atan2(w.king.y - ar.y, w.king.x - ar.x);
      shot = { spread: Math.abs(a.angle - toKing), range: Math.hypot(w.king.x - ar.x, w.king.y - ar.y) };
    }
  });
  assert.ok(shot, 'they shot at Wenceslas; states: ' + seen.join(' '));
  assert.ok(seen.includes('draw'), 'they drew their bow first');
  assert.ok(shot.range <= CFG.archerRange + 1, 'they came into range before shooting: ' + shot.range.toFixed(0));
  assert.ok(shot.spread <= CFG.archerSpread + 1e-9, 'within the spread: ' + shot.spread.toFixed(3));
}

// ---- an archer is rooted while drawing, and the draw takes the time it says
{
  const { w } = quietWorld();
  const ar = addArcher(w, 320, 60);                 // in range already
  step(w, 0.05);
  assert.equal(ar.state, 'draw');
  const x0 = ar.x, y0 = ar.y;
  step(w, CFG.archerDraw * 0.8);
  assert.equal(ar.state, 'draw');
  assert.ok(Math.hypot(ar.x - x0, ar.y - y0) < 0.5, 'does not move while drawing');
  assert.equal(w.arrows.length, 0, 'no arrow yet');
  step(w, CFG.archerDraw * 0.4);
  assert.equal(ar.state, 'move');
  assert.equal(w.arrows.length, 1, 'then one arrow');
}

// ---- inaccurate: from range, at a king who stands still, some arrows hit and most miss
{
  let hits = 0;
  const shots = 400;
  for (let i = 0; i < shots; i++) {
    const { w } = quietWorld(100 + i);
    const ar = addArcher(w, 320, 200 - CFG.archerRange);
    w.loose(ar);
    step(w, 2, STILL, () => {});
    if (w.king.hp < CFG.kingMaxHp) hits++;
  }
  const rate = hits / shots;
  assert.ok(rate > 0.05 && rate < 0.5, 'hit rate ' + rate.toFixed(2) + ' should be low but not zero');
}

// ---- damage and what stops arrows
{
  // an arrow reaching Wenceslas hurts him
  const { w, events } = quietWorld();
  arrowAt(w, 200, 200);
  step(w, 1);
  assert.equal(w.king.hp, CFG.kingMaxHp - CFG.arrowDamage);
  assert.equal(w.arrows.length, 0, 'the arrow is used up');
  assert.ok(events.includes('hurt'));
}
{
  // a page in the way takes the hit instead
  const { w, events } = quietWorld();
  const pg = addPage(w, 260, 200);
  arrowAt(w, 200, 200);
  step(w, 1);
  assert.equal(pg.hp, CFG.pageMaxHp - CFG.arrowDamage, 'the page is hit');
  assert.equal(w.king.hp, CFG.kingMaxHp, 'and Wenceslas is not');
  assert.ok(events.includes('arrowHit'));
}
{
  // a rock and a low wall don't stop it
  const { w } = quietWorld();
  w.obstacles.push({ kind: 'rock', x: 240, y: 200, r: 7, size: 9 });
  w.obstacles.push({ kind: 'wall', x: 270, y: 200, w: 8, h: 48, size: 24 });
  arrowAt(w, 200, 200);
  step(w, 1);
  assert.equal(w.king.hp, CFG.kingMaxHp - CFG.arrowDamage, 'flew over the rock and the wall');
}
{
  // a tree does
  const { w, events } = quietWorld();
  w.obstacles.push({ kind: 'tree', x: 250, y: 200, r: 5, size: 12, variant: 0 });
  arrowAt(w, 200, 200);
  step(w, 1);
  assert.equal(w.king.hp, CFG.kingMaxHp, 'the tree took it');
  assert.equal(w.arrows.length, 0);
  assert.ok(events.includes('arrowHit'));
}

// ---- archers look only at Wenceslas: a page right next to them is ignored
{
  const { w } = quietWorld(5);
  w.king.x = 500; w.king.y = 100; w.trail = [{ x: 500, y: 100 }];
  const ar = addArcher(w, 100, 100);
  addPage(w, 100, 180);                             // close to the archer, and to the south
  const angles = [];
  const before = new Set();
  step(w, 8, STILL, () => { for (const a of w.arrows) if (!before.has(a.id)) { before.add(a.id); angles.push(a.angle); } });
  assert.ok(angles.length > 0, 'they shot');
  for (const a of angles) assert.ok(Math.abs(a) <= CFG.archerSpread + 1e-9, 'aimed east at the king, not south at the page: ' + a.toFixed(2));
  assert.ok(ar.x > 100, 'they walked toward Wenceslas');
}

// ---- close in, archers back away (and do not walk into him)
{
  const { w } = quietWorld();
  const ar = addArcher(w, 320, 200 - 50);           // inside the keep-away distance
  ar.cd = 99;                                       // not shooting, just moving
  const d0 = Math.hypot(ar.x - w.king.x, ar.y - w.king.y);
  step(w, 1);
  assert.ok(Math.hypot(ar.x - w.king.x, ar.y - w.king.y) > d0 + 20, 'backed away');
}

// ---- and a king who chases them catches them and kills them with the sword, in normal and hard mode
for (const hard of [false, true]) {
  const { w } = quietWorld(7, hard);
  w.king.god = true;                                // the arrows aren't what's being tested here
  w.king.x = 200; w.king.y = 200; w.trail = [{ x: 200, y: 200 }];
  const ar = addArcher(w, 400, 200);
  let t = 0;
  while (w.archers.length && t < 15) {
    const dx = ar.x - w.king.x, dy = ar.y - w.king.y, d = Math.hypot(dx, dy) || 1;
    w.update(1 / 60, { mx: dx / d, my: dy / d, ax: ar.x, ay: ar.y - 6, swing: d < 24 });
    t += 1 / 60;
  }
  assert.equal(w.archers.length, 0, `caught and killed (hard=${hard}) after ${t.toFixed(1)} s`);
  assert.equal(w.kills, 1);
}

// ---- a sword hit during the draw spoils the shot
{
  const { w, events } = quietWorld();
  const ar = addArcher(w, 320, 60);
  ar.hp = 2;                                        // so they survive the hit
  step(w, 0.05);
  assert.equal(ar.state, 'draw');
  w.hitFoe(ar, 0, -1);
  assert.equal(ar.state, 'move');
  step(w, CFG.archerDraw + 0.2);
  assert.ok(!events.includes('arrowShoot'), 'no arrow from the spoiled draw');
}

// ---- arrows in flight are cleared when the night ends
{
  const { w } = quietWorld();
  arrowAt(w, 10, 100);
  w.done = true;
  step(w, 0.05);
  assert.equal(w.arrows.length, 0);
}

console.log('archers: all tests passed');
