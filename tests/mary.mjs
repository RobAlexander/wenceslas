// Mary, the second boss (nights 6 and 12): an ice block rises and splits; then she repeats warning lines,
// an attack (a shotgun blast, a spiral, or a ring of snowballs) and a rest, which is the only time she can
// be hurt. Beaten, she is frozen into a block that sinks into the ground. Run with: node tests/mary.mjs
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { makeRng } from '../js/rng.js';
import { nightParams, bossInfo, maryStats, CFG, NIGHTS } from '../js/config.js';
import { CURVES } from '../js/tuning.js';

const STILL = { mx: 0, my: 0, ax: 0, ay: 0, swing: false };

// A quiet boss night (6 is Mary's): nothing else spawns and nobody else is about.
function quietWorld(night = 6, seed = 1, hard = false) {
  const events = [];
  const w = new World({ night, hard, rng: makeRng(seed), events });
  Object.assign(w.p, { maxRobbers: 0, maxWolves: 0, maxArchers: 0, maxFood: 0, maxWanderingPages: 0 });
  w.foods = []; w.pages = []; w.line = []; w.obstacles = [];
  w.king.x = 100; w.king.y = 200;
  w.trail = [{ x: w.king.x, y: w.king.y }];
  return { w, events };
}
const step = (w, secs, inp = STILL, each) => {
  for (let i = 0; i < Math.round(secs * 60); i++) { w.update(1 / 60, inp); each?.(); }
};
// Mary out of her ice, in a given state at a given place
function maryAt(w, x, y, state = 'rest', t = 9) {
  w.spawnMary();
  const b = w.boss;
  b.x = x; b.y = y; b.state = state; b.t = t;
  return b;
}
// Put her into the aim for a particular attack (the choice is random, so tests choose)
function aim(w, b, attack) {
  w.startMaryAim(b);
  b.attack = attack; b.last = attack;
  return b;
}
const until = (w, state, max = 6) => {
  for (let i = 0; i < max * 60 && w.boss && w.boss.state !== state; i++) w.update(1 / 60, STILL);
  return w.boss?.state === state;
};
const balls = (w) => w.arrows.filter((a) => a.snow);

// ---- which night has which boss: Frosty, Mary, Frosty, Mary (each a little tougher the second time)
assert.deepEqual([3, 6, 9, 12].map((n) => bossInfo(nightParams(n).bossNo)), [
  { kind: 'frosty', nth: 1 }, { kind: 'mary', nth: 1 }, { kind: 'frosty', nth: 2 }, { kind: 'mary', nth: 2 },
]);
assert.equal(bossInfo(0).kind, 'frosty', 'with no boss tonight (the dev console) she and Frosty are the first, easiest');
for (let n = 1; n <= NIGHTS; n++) assert.equal(nightParams(n).bossNo > 0, n % 3 === 0);

// ---- tougher the second time, but only a little
{
  const a = maryStats(1), b = maryStats(2);
  assert.equal(a.hp, CFG.maryHp);
  assert.ok(b.hp > a.hp && b.rest < a.rest && b.telegraph < a.telegraph && b.ballSpeed > a.ballSpeed);
  assert.ok(b.hp <= a.hp * 1.3 && b.ballSpeed <= 15, 'but subtly');
  assert.ok(b.rest >= 2 * CFG.swingCooldown, 'still room for two swings');
  assert.ok(b.telegraph > CFG.maryLockTime + 0.3, 'and a real warning');
}

// ---- the last food on night 6 brings Mary, not Frosty, and the night goes on
{
  const { w, events } = quietWorld(6);
  w.king.god = true;
  w.delivered = w.p.foodTarget - 1;
  w.line = [{ food: 'bread' }];
  w.king.x = w.oldMan.x; w.king.y = w.oldMan.y;
  step(w, 0.5);
  assert.ok(w.boss && w.boss.kind === 'mary', 'Mary comes on night 6');
  assert.equal(w.boss.state, 'rise');
  assert.equal(w.done, false, 'the night is not over');
  assert.ok(events.includes('bossStart') && w.bossIntro > 0);
}
{
  const { w } = quietWorld(9);
  w.king.god = true; w.delivered = w.p.foodTarget - 1; w.line = [{ food: 'bread' }];
  w.king.x = w.oldMan.x; w.king.y = w.oldMan.y;
  step(w, 0.5);
  assert.equal(w.boss?.kind, 'frosty', 'and Frosty again on night 9');
}

// ---- nothing else spawns during the fight
{
  const { w } = quietWorld(6, 2);
  Object.assign(w.p, { maxRobbers: 5, maxWolves: 5, maxArchers: 5, maxFood: 5, maxWanderingPages: 5, firstRobber: 0, firstWolf: 0, firstArcher: 0 });
  w.king.god = true;
  w.robberTimer = w.wolfTimer = w.archerTimer = w.foodTimer = w.pageTimer = 0;
  w.spawnMary();
  step(w, 5);
  assert.equal(w.robbers.length + w.wolves.length + w.archers.length + w.foods.length + w.pages.length, 0);
}

// ---- the ice rises well away from Wenceslas and splits; she can't be hurt until she is out
{
  const { w } = quietWorld(6, 3);
  w.spawnMary();
  const b = w.boss;
  assert.ok(Math.hypot(b.x - w.king.x, b.y - w.king.y) >= 150 - 1, 'rises away from him');
  assert.equal(b.state, 'rise');
  assert.equal(w.foes().includes(b), false);
  w.king.x = b.x - 12; w.king.y = b.y; w.king.god = true;
  w.trail = [{ x: w.king.x, y: w.king.y }];
  step(w, CFG.maryRise / 2, { mx: 0, my: 0, ax: b.x, ay: b.y - 8, swing: true });
  assert.equal(b.hp, b.maxHp, 'no damage to rising ice');
  step(w, CFG.maryRise / 2 + 0.05);
  assert.equal(b.state, 'split');
  assert.equal(w.foes().includes(b), false, 'nor to splitting ice');
  step(w, CFG.marySplit + 0.05);
  assert.equal(b.state, 'aim', 'then she is out, and aims at once');
  assert.equal(b.hp, b.maxHp);
}

// ---- the cycle: aim -> attack -> rest -> aim, and never the same attack twice running
{
  const { w } = quietWorld(6, 4);
  w.king.god = true; w.king.x = 20; w.king.y = 330;
  const b = maryAt(w, 400, 150, 'rest', 0.01);
  const seen = new Set();
  let last = null;
  for (let cycle = 0; cycle < 12; cycle++) {
    assert.ok(until(w, 'aim', 4), 'aims');
    assert.notEqual(b.attack, last, 'not the same attack twice in a row');
    last = b.attack; seen.add(b.attack);
    assert.ok(until(w, 'attack', 3), 'attacks');
    assert.ok(until(w, 'rest', 6), 'then rests');
  }
  assert.deepEqual([...seen].sort(), ['blast', 'ring', 'spiral'], 'she uses all three');
}

// ---- the blast: follows Wenceslas, locks the last moments, then a wide fan, in volleys
{
  const { w, events } = quietWorld(6, 5);
  w.king.god = true;
  const b = maryAt(w, 400, 200, 'rest', 0);
  w.king.x = 100; w.king.y = 200;
  aim(w, b, 'blast');
  step(w, 0.2);
  assert.ok(b.dx < -0.99, 'aims at him');
  w.king.x = 400; w.king.y = 40;
  step(w, 0.2);
  assert.ok(b.dy < -0.5, 'still following while the warning runs');
  step(w, b.stats.telegraph - 0.4 - CFG.maryLockTime + 0.02);
  assert.equal(b.locked, true);
  const dx = b.dx, dy = b.dy;
  w.king.x = 100; w.king.y = 330;
  step(w, 0.1);
  assert.equal(b.dx, dx); assert.equal(b.dy, dy, 'locked: a sidestep after the warning works');
  assert.equal(balls(w).length, 0, 'nothing fired during the warning');
  assert.ok(until(w, 'attack', 2));
  step(w, 0.02);
  const first = balls(w);
  assert.equal(first.length, CFG.maryBlastBalls, 'a volley of ' + CFG.maryBlastBalls);
  const base = Math.atan2(dy, dx);
  const offs = first.map((a) => Math.atan2(Math.sin(a.angle - base), Math.cos(a.angle - base))).sort((p, q) => p - q);
  near(offs[0], -CFG.maryBlastSpread, 1e-6); near(offs.at(-1), CFG.maryBlastSpread, 1e-6);
  for (const a of first) {
    const sp = Math.hypot(a.vx, a.vy);
    assert.ok(sp > CFG.maryBlastSpeed * 0.93 && sp < CFG.maryBlastSpeed * 1.07, 'speed ' + sp);
  }
  assert.ok(events.includes('arrowShoot'));
  step(w, CFG.maryVolleyGap);
  assert.equal(balls(w).length >= CFG.maryBlastBalls * CFG.maryBlastVolleys - 2, true, 'a second volley follows');
  assert.ok(until(w, 'rest', 3));
}
function near(a, b, eps) { assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`); }

// ---- the spiral: she spins, firing from each arm; it turns steadily and then stops
{
  const { w } = quietWorld(6, 6);
  w.king.god = true; w.king.x = 20; w.king.y = 330;
  const b = maryAt(w, 400, 150, 'rest', 0);
  aim(w, b, 'spiral');
  b.angle = 0; b.spin = 1;
  assert.ok(until(w, 'attack', 2));
  const shots = [];
  step(w, CFG.marySpiralTime + 0.2, STILL, () => { for (const a of balls(w)) if (!shots.includes(a.id)) shots.push(a.id); });
  const expected = Math.floor(CFG.marySpiralTime / CFG.marySpiralInterval) + 1;
  assert.ok(Math.abs(shots.length / CFG.marySpiralArms - expected) <= 2, `about ${expected} shots from each arm, got ${shots.length / CFG.marySpiralArms}`);
  assert.ok(until(w, 'rest', 1), 'it ends, and she rests');
  // the angle advances at the spin rate: shots one interval apart differ by spin * interval
  const { w: w2 } = quietWorld(6, 6);
  w2.king.god = true; w2.king.x = 20; w2.king.y = 330;
  const b2 = maryAt(w2, 400, 150, 'rest', 0);
  aim(w2, b2, 'spiral'); b2.angle = 0; b2.spin = -1;
  assert.ok(until(w2, 'attack', 2));
  step(w2, CFG.marySpiralInterval * 4.5);
  const arm0 = balls(w2).filter((a, i) => i % CFG.marySpiralArms === 0).map((a) => a.angle);
  near(arm0[1] - arm0[0], -CFG.marySpiralSpin * CFG.marySpiralInterval, 1e-6);
  assert.ok(CFG.marySpiralTime > 1 && CFG.marySpiralTime < 4, 'long enough to matter, short enough to survive');
}

// ---- the ring: snowballs every way at once, in waves turned half a gap from each other
{
  const { w } = quietWorld(6, 7);
  w.king.god = true; w.king.x = 20; w.king.y = 330;
  const b = maryAt(w, 400, 150, 'rest', 0);
  aim(w, b, 'ring'); b.angle = 0;
  assert.ok(until(w, 'attack', 2));
  step(w, 0.02);
  const one = balls(w);
  assert.equal(one.length, CFG.maryRingBalls, 'one wave');
  const gap = (Math.PI * 2) / CFG.maryRingBalls;
  const angs = one.map((a) => ((a.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).sort((p, q) => p - q);
  for (let i = 1; i < angs.length; i++) near(angs[i] - angs[i - 1], gap, 1e-6);
  step(w, CFG.maryRingGap);
  const two = balls(w).slice(CFG.maryRingBalls).map((a) => ((a.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).sort((p, q) => p - q);
  assert.equal(two.length, CFG.maryRingBalls, 'the next wave');
  near(two[0], gap / 2, 1e-6);                          // turned half a gap: the gaps in one wave are the balls of the next
}

// ---- snowballs hit for 1; trees stop them, rocks don't; a page in the way takes it
{
  const { w } = quietWorld(6, 8);
  w.arrows.push({ id: 9001, x: w.king.x - 6, y: w.king.y, vx: 120, vy: 0, angle: 0, life: 3, snow: true });
  step(w, 0.2);
  assert.equal(w.king.hp, CFG.kingMaxHp - CFG.snowballDamage, 'a snowball costs ' + CFG.snowballDamage);
}
{
  const { w } = quietWorld(6, 9);
  w.king.god = true;
  w.obstacles = [{ kind: 'tree', x: 300, y: 200, r: 4, size: 20, variant: 0 }];
  w.arrows.push({ id: 9002, x: 280, y: 200, vx: 120, vy: 0, angle: 0, life: 3, snow: true });
  step(w, 0.5);
  assert.equal(w.arrows.length, 0, 'a tree stops it');
}
{
  const { w } = quietWorld(6, 10);
  w.spawnPage(true);
  const pg = w.pages[0];
  pg.x = 300; pg.y = 200; pg.target = { x: 300, y: 200 };
  const hp = pg.hp;
  w.arrows.push({ id: 9003, x: 285, y: 200, vx: 120, vy: 0, angle: 0, life: 3, snow: true });
  step(w, 0.3);
  assert.equal(pg.hp, hp - CFG.snowballDamage, 'a page in the way takes it');
}

// ---- she can be hurt only while she rests
{
  const swing = (w, b) => {
    w.king.cd = 0; w.king.hit.clear();
    w.update(1 / 60, { mx: 0, my: 0, ax: b.x, ay: b.y - 8, swing: true });
    step(w, 0.45, { mx: 0, my: 0, ax: b.x, ay: b.y - 8, swing: false });
  };
  for (const state of ['aim', 'attack']) {
    const { w } = quietWorld(6, 11);
    w.king.god = true; w.king.x = 330; w.king.y = 200;
    const b = maryAt(w, 400, 200, state, 99);
    b.attack = 'ring'; b.clock = -99;               // keep the attack from ending during the test
    assert.equal(w.foes().includes(b), false, 'not a target while ' + state);
    swing(w, b);
    assert.equal(b.hp, b.maxHp, 'no damage while ' + state);
  }
  const { w, events } = quietWorld(6, 12);
  w.king.god = true; w.king.x = 330; w.king.y = 200;
  const b = maryAt(w, 400, 200, 'rest', 99);
  assert.equal(w.foes().includes(b), true);
  swing(w, b);
  assert.equal(b.hp, b.maxHp - 1, 'one hit, one point');
  assert.ok(events.includes('hit'));
  assert.equal(b.state, 'rest', 'and she stays put');
}

// ---- resting, she trudges after Wenceslas slowly, and stops short of him
{
  const { w } = quietWorld(6, 13);
  w.king.god = true;
  const b = maryAt(w, 80, 200, 'rest', 99);
  w.king.x = 600; w.king.y = 200;
  const x0 = b.x;
  step(w, 2);
  const moved = b.x - x0;
  assert.ok(moved > CFG.marySpeed * 2 * 0.8 && moved < CFG.marySpeed * 2 * 1.2, 'walks at marySpeed: ' + moved);
  assert.ok(CFG.marySpeed < CFG.kingSpeed / 2);
  w.king.x = 200; w.king.y = 200; b.x = 400;
  b.t = 99;
  step(w, 20);
  const d = Math.hypot(b.x - w.king.x, b.y - w.king.y);
  assert.ok(Math.abs(d - CFG.maryStopDistance) < 3, 'stops about maryStopDistance away: ' + d);
}
{
  const { w } = quietWorld(6, 14, true);
  w.king.god = true; w.king.x = 600; w.king.y = 200;
  const b = maryAt(w, 80, 200, 'rest', 99);
  const x0 = b.x; step(w, 2);
  assert.ok(b.x - x0 > CFG.marySpeed * 2 * 1.2 && b.x - x0 < CFG.kingSpeed * 2, 'hard mode is quicker, but still slower than the king');
}

// ---- the end: 12 hits freeze her; the ice grows, holds, sinks into the ground, and only then the night ends
{
  const { w, events } = quietWorld(6, 15);
  const b = maryAt(w, 400, 200, 'rest', 0);
  w.king.x = 330; w.king.y = 200;
  assert.equal(b.maxHp, CFG.maryHp);
  w.arrows.push({ id: 9004, x: 100, y: 100, vx: 0, vy: 0, angle: 0, life: 3, snow: true });
  for (let i = 1; i <= b.maxHp; i++) {
    assert.equal(w.victory, false);
    b.t = 5; b.state = 'rest';
    w.king.cd = 0; w.king.hit.clear();
    w.update(1 / 60, { mx: 0, my: 0, ax: b.x, ay: b.y - 8, swing: true });
    if (i < b.maxHp) w.update(1 / 60, STILL);
  }
  assert.equal(b.state, 'dying', 'the last hit freezes her');
  assert.equal(w.boss, b, 'she is still there, in the ice');
  assert.equal(w.done, false, 'and the night is not over');
  assert.equal(w.arrows.length, 0, 'her snowballs are gone');
  assert.equal(w.kills, 1);
  assert.equal(w.bonus, CFG.pointsBoss);
  assert.ok(events.includes('kill') && !events.includes('nightComplete'));
  assert.equal(w.foes().includes(b), false);
  const total = CFG.maryDeathFreeze + CFG.maryDeathHold + CFG.maryDeathSink;
  assert.ok(Math.abs(b.t - total) < 0.05, 'the death takes ' + total + ' s');
  const t0 = w.time;
  step(w, total - 0.1);
  assert.equal(w.done, false, 'not over before the block has gone into the ground');
  assert.equal(w.time, t0, 'the clock stops when she falls');
  w.damage(w.king, { x: 0, y: 0 }, 3);
  assert.equal(w.king.hp, CFG.kingMaxHp, 'nothing hurts Wenceslas meanwhile');
  step(w, 0.2);
  assert.equal(w.boss, null, 'she is gone');
  assert.equal(w.done, true);
  assert.ok(events.includes('nightComplete'));
}

// ---- the second time (night 12) she has a little more health
{
  const { w } = quietWorld(12, 16);
  w.spawnMary();
  assert.equal(w.boss.maxHp, maryStats(2).hp);
  assert.ok(w.boss.maxHp > CFG.maryHp);
  assert.equal(w.boss.stats.ballSpeed, maryStats(2).ballSpeed);
}
// ...and the dev console's spawn on a night that isn't hers gives the first, easiest one
{
  const { w } = quietWorld(2, 17);
  w.spawnMary();
  assert.equal(w.boss.maxHp, CFG.maryHp);
}

// ---- a long fight against a king who dodges about: no NaN, nothing stuck, and the king can win
{
  const { w } = quietWorld(6, 18);
  w.king.god = true;
  w.spawnMary();
  for (let i = 0; i < 60 * 90; i++) {
    const a = i / 37, b = w.boss;
    const toward = b && b.state === 'rest' ? { x: b.x, y: b.y } : null;
    const mx = toward ? Math.sign(toward.x - w.king.x) : Math.cos(a), my = toward ? Math.sign(toward.y - w.king.y) : Math.sin(a * 1.3);
    w.update(1 / 60, { mx, my, ax: b?.x ?? 0, ay: (b?.y ?? 0) - 8, swing: true });
    if (b) for (const v of [b.x, b.y, b.t, b.dx, b.dy]) assert.ok(Number.isFinite(v));
    for (const s of w.arrows) assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y));
    if (w.done) break;
  }
  assert.equal(w.done, true, 'a king who chases her while she rests beats her');
}

assert.ok(CURVES.boss.maryEvery >= 0);
console.log('mary: all tests passed');
