// Boss nights: every third night ends with Frosty, a giant snowman who telegraphs, rolls, then rests
// (the only time he can be hurt). Run with: node tests/frosty.mjs
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { makeRng } from '../js/rng.js';
import { pageHolding } from './helpers.mjs';
import { nightParams, parTime, frostyStats, CFG, NIGHTS } from '../js/config.js';

const STILL = { mx: 0, my: 0, ax: 0, ay: 0, swing: false };

// A quiet night: nothing else spawns, and nobody else is about.
function quietWorld(night = 3, seed = 1, hard = false) {
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
// Frosty already in place, in a given state, with the king out of the way unless told otherwise
function bossAt(w, x, y, state, t = 0) {
  w.spawnFrosty();
  const b = w.boss;
  b.x = x; b.y = y; b.state = state; b.t = t; b.dx = 1; b.dy = 0; b.locked = false;
  return b;
}
const untilState = (w, state, max = 6) => {
  for (let i = 0; i < max * 60 && w.boss && w.boss.state !== state; i++) w.update(1 / 60, STILL);
  return w.boss?.state === state;
};

// ---- which nights have a boss: every third one
for (let n = 1; n <= NIGHTS; n++) assert.equal(nightParams(n).bossNo > 0, n % 3 === 0, 'night ' + n);
assert.deepEqual([3, 6, 9, 12].map((n) => nightParams(n).bossNo), [1, 2, 3, 4]);

// ---- tougher each time, but only a little
{
  const s = [1, 2, 3, 4].map(frostyStats);
  assert.equal(s[0].hp, 10, 'ten hits on the first boss night');
  for (let i = 1; i < 4; i++) {
    assert.ok(s[i].hp > s[i - 1].hp && s[i].rollSpeed > s[i - 1].rollSpeed, 'a bit tougher each time');
    assert.ok(s[i].rest < s[i - 1].rest && s[i].telegraph < s[i - 1].telegraph);
  }
  assert.ok(s[3].hp <= s[0].hp * 1.4 && s[3].rollSpeed <= s[0].rollSpeed * 1.2, 'but subtly');
  assert.ok(s[3].rest >= 2 * CFG.swingCooldown, 'even the last still leaves time for two swings');
  assert.ok(s[3].telegraph > CFG.frostyLockTime + 0.3, 'and a real warning');
}
assert.equal(parTime(5, 1), parTime(5) + CFG.parBoss, 'a boss night has extra par time');

// ---- the last food does not end a boss night: Frosty arrives instead
{
  const { w, events } = quietWorld(3);
  w.king.god = true;
  w.delivered = w.p.foodTarget - 1;
  w.line = [pageHolding('bread')]; // one more item to hand over
  w.king.x = w.oldMan.x; w.king.y = w.oldMan.y;
  step(w, 0.5);
  assert.equal(w.delivered, w.p.foodTarget);
  assert.ok(w.boss, 'Frosty arrives');
  assert.equal(w.done, false, 'the night is not over');
  assert.ok(events.includes('bossStart'));
  assert.ok(w.bossIntro > 0, 'with a banner');
}
// ...and a normal night is over at once
{
  const { w } = quietWorld(2);
  w.delivered = w.p.foodTarget - 1;
  w.line = [pageHolding('bread')];
  w.king.god = true; w.king.x = w.oldMan.x; w.king.y = w.oldMan.y;
  step(w, 0.5);
  assert.equal(w.done, true);
  assert.equal(w.boss, null);
}

// ---- nothing else spawns during the fight
{
  const { w } = quietWorld(3, 2);
  Object.assign(w.p, { maxRobbers: 5, maxWolves: 5, maxArchers: 5, maxFood: 5, maxWanderingPages: 5, firstRobber: 0, firstWolf: 0, firstArcher: 0 });
  w.king.god = true;
  w.robberTimer = w.wolfTimer = w.archerTimer = w.foodTimer = w.pageTimer = 0;
  w.spawnFrosty();
  step(w, 5);
  assert.equal(w.robbers.length + w.wolves.length + w.archers.length + w.foods.length + w.pages.length, 0);
}

// ---- he lumbers in from off screen, then the cycle: aim -> roll -> rest -> aim
{
  const { w } = quietWorld(3, 3);
  w.king.god = true;
  w.spawnFrosty();
  const b = w.boss;
  assert.equal(b.state, 'arrive');
  assert.ok(b.x < 0 || b.x > 640 || b.y < 16 || b.y > 360, 'starts off screen');
  step(w, 0.5);
  assert.equal(b.state, 'arrive');
  assert.ok(untilState(w, 'aim', 10), 'comes on screen and starts to aim');
  assert.ok(b.x > 0 && b.x < 640 && b.y > 16 && b.y < 360);
  assert.ok(untilState(w, 'roll', 3), 'rolls');
  assert.ok(untilState(w, 'rest', 3), 'then rests');
  assert.ok(untilState(w, 'aim', 3), 'then aims again');
}

// ---- sound events: a warning as he winds up, a rumble as he rolls, a crash into scenery or the edge
{
  const { w, events } = quietWorld(3, 19);
  w.king.god = true; w.king.x = 620; w.king.y = 150;   // far off to the east: a clear run, 300 pixels, no edge
  const b = bossAt(w, 100, 150, 'rest', 0.05);
  step(w, 0.1);
  assert.equal(b.state, 'aim');
  assert.equal(events.filter((e) => e === 'frostyWarn').length, 1, 'a warning as he starts to aim');
  assert.equal(events.includes('frostyRoll'), false);
  assert.ok(untilState(w, 'roll', 3));
  assert.equal(events.filter((e) => e === 'frostyRoll').length, 1, 'a rumble as he starts to roll');
  assert.ok(untilState(w, 'rest', 3));
  assert.equal(events.includes('frostyCrash'), false, 'a roll that just runs its distance is not a crash');
}
{
  const { w, events } = quietWorld(3, 20);
  w.king.god = true; w.king.x = 20; w.king.y = 340;
  w.obstacles = [{ kind: 'tree', x: 250, y: 150, r: 4, size: 20, variant: 0 }];
  bossAt(w, 100, 150, 'roll');
  assert.ok(untilState(w, 'rest', 3));
  assert.equal(events.filter((e) => e === 'frostyCrash').length, 1, 'a crash into a tree');
}
{
  const { w, events } = quietWorld(3, 21);
  w.king.god = true; w.king.x = 20; w.king.y = 340;
  bossAt(w, 500, 150, 'roll');
  assert.ok(untilState(w, 'rest', 3));
  assert.equal(events.filter((e) => e === 'frostyCrash').length, 1, 'and into the edge of the world');
}

// ---- the telegraph tracks Wenceslas, then locks for the last moments so a sidestep works
{
  const { w } = quietWorld(3, 4);
  w.king.god = true;
  const b = bossAt(w, 400, 200, 'aim', CFG.frostyTelegraph);
  b.stats = { ...b.stats, telegraph: CFG.frostyTelegraph };
  w.king.x = 100; w.king.y = 200;
  step(w, 0.2);
  assert.ok(b.dx < -0.99, 'aims at him: ' + b.dx);
  w.king.x = 400; w.king.y = 50;                           // he moves away while Frosty is still tracking
  step(w, 0.2);
  assert.ok(b.dy < -0.5, 'still tracking while the telegraph runs');
  step(w, CFG.frostyTelegraph - 0.4 - CFG.frostyLockTime + 0.02);
  assert.equal(b.locked, true, 'locked for the last ' + CFG.frostyLockTime + ' s');
  const dx = b.dx, dy = b.dy;
  w.king.x = 100; w.king.y = 300;                          // a sidestep after the lock
  step(w, 0.1);
  assert.equal(b.dx, dx); assert.equal(b.dy, dy, 'direction no longer follows him');
  assert.equal(b.state, 'aim');
  assert.ok(untilState(w, 'roll'));
  const x0 = b.x, y0 = b.y;
  step(w, 0.2);
  const heading = Math.atan2(b.y - y0, b.x - x0), want = Math.atan2(dy, dx);
  assert.ok(Math.abs(heading - want) < 0.01, 'rolls the way it was locked');
}

// ---- a roll: fast, straight, a fixed distance
{
  const { w } = quietWorld(3, 5);
  w.king.god = true; w.king.x = 20; w.king.y = 340;       // far from the path
  const b = bossAt(w, 100, 150, 'roll');
  b.dx = 1; b.dy = 0; b.rolled = 0;
  step(w, 0.5);
  assert.ok(Math.abs(b.x - (100 + b.stats.rollSpeed * 0.5)) < 3, 'rolls at rollSpeed: ' + b.x);
  assert.equal(Math.round(b.y), 150, 'in a straight line');
  assert.ok(CFG.frostyRollSpeed > CFG.kingSpeed * 1.5, 'much faster than Wenceslas');
  assert.ok(untilState(w, 'rest', 3));
  assert.ok(Math.abs(b.x - (100 + CFG.frostyRollDistance)) < 4, 'stops after frostyRollDistance: ' + b.x);
  assert.equal(b.crashed, false);
  assert.ok(Math.abs(b.t - b.stats.rest) < 0.05, 'rests for the usual time');
}

// ---- he stops at the edge of the screen, and at a tree with a longer rest
{
  const { w } = quietWorld(3, 6);
  w.king.god = true; w.king.x = 20; w.king.y = 340;
  const b = bossAt(w, 500, 150, 'roll');
  step(w, 1.2);
  assert.equal(b.state, 'rest', 'stopped by the edge');
  assert.ok(b.x <= 640 - b.r + 0.01);
  assert.equal(b.crashed, false);
}
{
  const { w } = quietWorld(3, 7);
  w.king.god = true; w.king.x = 20; w.king.y = 340;
  w.obstacles = [{ kind: 'tree', x: 250, y: 150, r: 4, size: 20, variant: 0 }];
  const b = bossAt(w, 100, 150, 'roll');
  assert.ok(untilState(w, 'rest', 3), 'stopped by the tree');
  assert.equal(b.crashed, true);
  assert.ok(b.x < 250, 'did not go through it');
  assert.ok(Math.abs(b.t - (b.stats.rest + CFG.frostyCrashBonus)) < 0.05, 'and is dizzy for longer: ' + b.t);
}

// ---- rolling over Wenceslas hurts; over a page kills; standing about does nothing
{
  const { w, events } = quietWorld(3, 8);
  const b = bossAt(w, 60, 200, 'roll');
  w.king.x = 140; w.king.y = 200;
  const hp = w.king.hp;
  step(w, 0.6);
  assert.equal(w.king.hp, hp - CFG.frostyDamage, 'a roll costs ' + CFG.frostyDamage);
  assert.ok(events.includes('hurt'));
  assert.ok(CFG.kingMaxHp > CFG.frostyDamage, 'and one roll cannot kill from full health');
  void b;
}
{
  const { w } = quietWorld(3, 9);
  w.king.god = true; w.king.x = 20; w.king.y = 340;
  w.spawnPage(true);
  const pg = w.pages[0];
  pg.x = 150; pg.y = 200; pg.target = { x: 150, y: 200 };
  bossAt(w, 60, 200, 'roll');
  step(w, 0.8);
  assert.equal(w.pages.length, 0, 'a page in the way is flattened');
}
for (const state of ['arrive', 'aim', 'rest']) {
  const { w } = quietWorld(3, 10);
  const b = bossAt(w, 100, 200, state, 1);
  b.t = state === 'arrive' ? 0 : 1;
  w.king.x = 100; w.king.y = 200;                          // right on top of him
  step(w, 0.4);
  assert.equal(w.king.hp, CFG.kingMaxHp, 'harmless while ' + state);
}

// ---- he can be hurt only while he rests
{
  const swing = (w, b) => {
    w.king.cd = 0; w.king.hit.clear();
    w.update(1 / 60, { mx: 0, my: 0, ax: b.x, ay: b.y - 8, swing: true });
    step(w, 0.45, { mx: 0, my: 0, ax: b.x, ay: b.y - 8, swing: false });
  };
  for (const state of ['arrive', 'aim']) {
    const { w } = quietWorld(3, 11);
    w.king.god = true;
    const b = bossAt(w, 150, 200, state, 5);
    b.t = state === 'arrive' ? 0 : 5;
    b.locked = true;                                       // keep it from rolling during this
    assert.equal(w.foes().includes(b), false, 'not a target while ' + state);
    const hp = b.hp;
    swing(w, b);
    assert.equal(b.hp, hp, 'no damage while ' + state);
  }
  const { w, events } = quietWorld(3, 12);
  w.king.god = true;
  const b = bossAt(w, 150, 200, 'rest', 5);
  assert.equal(w.foes().includes(b), true, 'a target while resting');
  swing(w, b);
  assert.equal(b.hp, b.maxHp - 1, 'one hit, one point');
  assert.ok(events.includes('hit'));
  assert.equal(b.x, 150, 'not knocked back');
  assert.equal(b.state, 'rest', 'and still dizzy');
}

// ---- a rest leaves room for 2 or 3 swings (a player who swings the instant the sword is ready gets 3 or 4)
{
  const { w } = quietWorld(3, 13);
  w.king.god = true; w.king.x = 100; w.king.y = 200;
  const b = bossAt(w, 150, 200, 'rest', 0);
  b.t = b.stats.rest;
  for (let i = 0; i < Math.round((b.stats.rest - 0.02) * 60); i++) {
    w.update(1 / 60, { mx: 0, my: 0, ax: b.x, ay: b.y - 8, swing: true });
  }
  const hits = b.maxHp - b.hp;
  assert.ok(hits >= 2 && hits <= 4, 'a rest allows 2 to 4 hits even for a perfect player: ' + hits);
}

// ---- ten hits kill him; he bursts into snowballs for three seconds, and only then is the night won
{
  const { w, events } = quietWorld(3, 14);
  const b = bossAt(w, 150, 200, 'rest', 0);
  w.king.x = 100; w.king.y = 200;
  for (let i = 1; i <= b.maxHp; i++) {
    assert.equal(w.victory, false);
    b.t = 5; b.state = 'rest';
    w.king.cd = 0; w.king.hit.clear();
    w.update(1 / 60, { mx: 0, my: 0, ax: b.x, ay: b.y - 8, swing: true });
    if (i < b.maxHp) w.update(1 / 60, STILL);
  }
  assert.equal(b.state, 'dying', 'the tenth hit starts the burst');
  assert.equal(w.boss, b, 'he is still there, coming apart');
  assert.equal(w.done, false, 'and the night is not over yet');
  assert.equal(w.kills, 1);
  assert.equal(w.bonus, CFG.pointsBoss, 'the points are his straight away');
  assert.ok(events.includes('kill'));
  assert.equal(events.includes('nightComplete'), false);
  assert.equal(w.foes().includes(b), false, 'not a target any more');
  assert.ok(w.shower.length >= 20, 'a first burst of snowballs: ' + w.shower.length);
  const t0 = w.time;
  let peak = 0, hits = 0;
  for (let i = 0; i < Math.round((CFG.frostyDeathTime - 0.05) * 60); i++) {
    w.update(1 / 60, STILL);
    peak = Math.max(peak, w.shower.length);
    assert.equal(w.done, false, 'not over before ' + CFG.frostyDeathTime + ' s (at step ' + i + ')');
  }
  hits = events.filter((e) => e === 'hit').length;
  assert.ok(peak > 100, 'a real shower: ' + peak + ' snowballs at once');
  assert.ok(hits >= 3, 'the bursts have sounds: ' + hits);
  assert.equal(w.time, t0, 'the night clock stops when he falls');
  assert.equal(w.king.hp, CFG.kingMaxHp, 'and nothing hurts Wenceslas');
  step(w, 0.2);
  assert.equal(w.boss, null, 'he is gone');
  assert.equal(w.done, true, 'and the night is won after ' + CFG.frostyDeathTime + ' s');
  assert.ok(events.includes('nightComplete'));
  // the snowballs carry on for a while behind the end-of-night screen, then are all gone
  assert.ok(w.shower.length > 0);
  step(w, 4);
  assert.equal(w.shower.length, 0, 'every snowball has gone');
  for (const c of w.shower) assert.ok(Number.isFinite(c.x));
}
// ...nothing can hurt Wenceslas while he dies, even a roll's worth of damage
{
  const { w } = quietWorld(3, 18);
  const b = bossAt(w, 150, 200, 'rest', 0);
  b.hp = 1;
  w.king.x = 100; w.king.y = 200;
  w.update(1 / 60, { mx: 0, my: 0, ax: b.x, ay: b.y - 8, swing: true });
  assert.equal(b.state, 'dying');
  w.damage(w.king, { x: 0, y: 0 }, 3);
  assert.equal(w.king.hp, CFG.kingMaxHp, 'not hurt while he dies');
}
// ...he comes once, on night 3 (St Nicholas has 12); a second time would be a little tougher, and the dev console's
// spawn on another night gives his first, easiest form
{
  const { w } = quietWorld(12, 15);
  w.spawnFrosty();
  assert.equal(w.boss.maxHp, frostyStats(1).hp);
  assert.ok(frostyStats(2).hp > frostyStats(1).hp);
}

// ---- hard mode is quicker
{
  const { w } = quietWorld(3, 16, true);
  w.king.x = 20; w.king.y = 340; w.king.god = true;
  const b = bossAt(w, 100, 150, 'roll');
  step(w, 0.3);
  assert.ok(b.x - 100 > b.stats.rollSpeed * 0.3 * 1.2, 'hard mode rolls faster');
}

// ---- no NaN anywhere through a long fight against a king who dodges about
{
  const { w } = quietWorld(6, 17);
  w.king.god = true;
  w.spawnFrosty();
  for (let i = 0; i < 60 * 60; i++) {
    const a = i / 40;
    w.update(1 / 60, { mx: Math.cos(a), my: Math.sin(a * 1.3), ax: w.boss?.x ?? 0, ay: w.boss?.y ?? 0, swing: i % 25 === 0 });
    const b = w.boss;
    if (b?.kind === 'frosty') for (const v of [b.x, b.y, b.dx, b.dy, b.t]) assert.ok(Number.isFinite(v));
    if (w.done) break;
  }
}

console.log('frosty: all tests passed');
