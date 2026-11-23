// Prince Boleslaus of Bohemia, the third boss (night 9): he walks at Wenceslas and can be hit whenever he is on
// foot; he makes heavily telegraphed sword blows (dart in, hit, dart out), rolls like Frosty, and rarely charges
// with a lance; three robber guards stay by him. Run with: node tests/boleslaus.mjs
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { makeRng } from '../js/rng.js';
import { pageHolding } from './helpers.mjs';
import { nightParams, bossInfo, boleslausStats, CFG, NIGHTS } from '../js/config.js';

const STILL = { mx: 0, my: 0, ax: 0, ay: 0, swing: false };

// A quiet boss night (9 is his): nothing else spawns and nobody else is about.
function quietWorld(night = 9, seed = 1, hard = false) {
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
// Boleslaus on foot at a place, with no guards unless asked
function princeAt(w, x, y, state = 'walk', { guards = false } = {}) {
  w.spawnBoleslaus();
  if (!guards) w.robbers.length = 0;
  const b = w.boss;
  b.x = x; b.y = y; b.state = state; b.t = 0; b.think = 99;
  return b;
}
const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

// ---- which night has which boss: Frosty, Mary, Boleslaus, St Nicholas
assert.deepEqual([3, 6, 9, 12].map((n) => bossInfo(nightParams(n).bossNo)), [
  { kind: 'frosty', nth: 1 }, { kind: 'mary', nth: 1 }, { kind: 'boleslaus', nth: 1 }, { kind: 'nicholas', nth: 1 },
]);
assert.equal(bossInfo(0).kind, 'frosty', 'with no boss tonight (the dev console) the first boss is the easiest, Frosty');
for (let n = 1; n <= NIGHTS; n++) assert.equal(nightParams(n).bossNo > 0, n % 3 === 0);
assert.equal(boleslausStats(1).hp, CFG.boleslausHp);
assert.ok(boleslausStats(2).hp > boleslausStats(1).hp, 'a later time would be a little tougher');

// ---- the last food on night 9 brings Boleslaus, with his three guards, and the night goes on
{
  const { w, events } = quietWorld(9);
  w.king.god = true;
  w.delivered = w.p.foodTarget - 1;
  w.line = [pageHolding('bread')];
  w.king.x = w.oldMan.x; w.king.y = w.oldMan.y;
  step(w, 0.5);
  assert.equal(w.boss?.kind, 'boleslaus', 'Boleslaus comes on night 9');
  assert.equal(w.boss.state, 'arrive');
  assert.equal(w.done, false);
  assert.ok(events.includes('bossStart') && w.bossIntro > 0);
  const guards = w.robbers.filter((r) => r.guard);
  assert.equal(guards.length, CFG.boleslausGuards, 'three guards come with him');
  assert.deepEqual(guards.map((g) => g.name), ['Tira', 'Česta', 'Hněvsa'], 'with their names, kept in the data');
  for (const g of guards) assert.equal(g.hp, 1, 'ordinary robbers');
}
{
  const { w } = quietWorld(12);
  w.king.god = true; w.delivered = w.p.foodTarget - 1; w.line = [pageHolding('bread')];
  w.king.x = w.oldMan.x; w.king.y = w.oldMan.y;
  step(w, 0.5);
  assert.equal(w.boss?.kind, 'nicholas', 'and St Nicholas on night 12');
}

// ---- nothing else spawns during the fight
{
  const { w } = quietWorld(9, 2);
  Object.assign(w.p, { maxRobbers: 5, maxWolves: 5, maxArchers: 5, maxFood: 5, maxWanderingPages: 5, firstRobber: 0, firstWolf: 0, firstArcher: 0 });
  w.king.god = true;
  w.robberTimer = w.wolfTimer = w.archerTimer = w.foodTimer = w.pageTimer = 0;
  w.spawnBoleslaus();
  step(w, 5);
  assert.equal(w.robbers.filter((r) => !r.guard).length + w.wolves.length + w.archers.length + w.foods.length + w.pages.length, 0);
}

// ---- he strides in, then walks at Wenceslas, slower than Wenceslas
{
  const { w } = quietWorld(9, 3);
  w.king.god = true;
  w.spawnBoleslaus();
  const b = w.boss;
  assert.ok(b.x < 0 || b.x > 640 || b.y < 16 || b.y > 360, 'starts off screen');
  for (let i = 0; i < 10 * 60 && b.state === 'arrive'; i++) w.update(1 / 60, STILL);
  assert.equal(b.state, 'walk', 'arrives and walks');
  assert.ok(b.x > 0 && b.x < 640 && b.y > 16 && b.y < 360);
}
{
  const { w } = quietWorld(9, 4);
  w.king.god = true; w.king.x = 600; w.king.y = 200;
  const b = princeAt(w, 100, 200);
  const x0 = b.x;
  step(w, 2);
  const moved = b.x - x0;
  assert.ok(Math.abs(moved - CFG.boleslausWalkSpeed * 2) < CFG.boleslausWalkSpeed * 0.2, 'walks at boleslausWalkSpeed: ' + moved);
  assert.ok(CFG.boleslausWalkSpeed < CFG.kingSpeed, 'slower than Wenceslas, so he can always be ducked out of reach');
  assert.equal(b.state, 'walk');
}
{
  const { w } = quietWorld(9, 5, true);
  w.king.god = true; w.king.x = 600; w.king.y = 200;
  const b = princeAt(w, 100, 200);
  const x0 = b.x; step(w, 2);
  assert.ok(b.x - x0 > CFG.boleslausWalkSpeed * 2 * 1.2 && b.x - x0 < CFG.kingSpeed * 2, 'hard mode is quicker, but still slower than Wenceslas');
}

// ---- Wenceslas standing right where he comes in does not keep him passive: the arrival ends as soon as he is in reach
{
  const { w } = quietWorld(9, 23);
  w.king.god = true;
  w.spawnBoleslaus();
  const b = w.boss;
  w.king.x = Math.max(8, Math.min(632, b.x)); w.king.y = Math.max(40, Math.min(340, b.y));   // as near the entrance as the screen allows
  for (let i = 0; i < 20 * 60 && b.state === 'arrive'; i++) w.update(1 / 60, STILL);
  assert.notEqual(b.state, 'arrive', 'he stops arriving and starts fighting: ' + b.state);
  assert.ok(b.t < 8, 'without waiting for the time-out');
}

// ---- he can be hit whenever he is on foot, but not while he rolls or charges or dies
{
  const { w } = quietWorld(9, 6);
  const b = princeAt(w, 300, 200);
  for (const state of ['arrive', 'walk', 'windup', 'swing', 'recover', 'aim', 'rest']) {
    b.state = state;
    assert.equal(w.foes().includes(b), true, 'a target while ' + state);
  }
  for (const state of ['roll', 'charge', 'dying']) {
    b.state = state;
    assert.equal(w.foes().includes(b), false, 'not a target while ' + state);
  }
  // a real swing at him on foot hurts; one while he rolls only puffs
  w.king.god = true; w.king.x = 250; w.king.y = 200;
  b.state = 'walk';
  w.king.cd = 0; w.king.hit.clear();
  w.update(1 / 60, { mx: 0, my: 0, ax: b.x, ay: b.y - 8, swing: true });
  assert.equal(b.hp, b.maxHp - 1);
  step(w, 0.5);
  b.state = 'roll'; b.dx = 0; b.dy = 0; b.rolled = -99;   // (rolling on the spot, harmlessly)
  w.king.cd = 0; w.king.hit.clear();
  w.update(1 / 60, { mx: 0, my: 0, ax: b.x, ay: b.y - 8, swing: true });
  assert.equal(b.hp, b.maxHp - 1, 'no damage while he rolls');
}

// ---- the sword: a long telegraph, a lock, then a blow across a fan
{
  const { w, events } = quietWorld(9, 7);
  w.king.god = false;
  const b = princeAt(w, 400, 200);
  w.king.x = 345; w.king.y = 200;             // 55 px in front of him: inside his reach
  b.think = 0;
  step(w, 0.05);
  assert.equal(b.state, 'windup', 'with Wenceslas in reach he winds up');
  assert.ok(events.includes('frostyWarn'), 'with a warning sound');
  assert.equal(w.king.hp, CFG.kingMaxHp);
  // he tracks Wenceslas, then locks for the last moments, so a late sidestep works
  w.king.x = 400; w.king.y = 130;
  step(w, 0.3);
  assert.ok(b.dy < -0.5, 'follows him while the telegraph runs');
  step(w, CFG.boleslausWindup - 0.35 - CFG.boleslausLockTime + 0.05);
  assert.equal(b.locked, true, 'locked for the last ' + CFG.boleslausLockTime + ' s');
  const dx = b.dx, dy = b.dy;
  w.king.x = 345; w.king.y = 200;             // a late sidestep: out of where he aimed
  step(w, 0.05);
  assert.equal(b.dx, dx); assert.equal(b.dy, dy, 'no longer follows');
  assert.equal(b.state, 'windup');
  assert.equal(w.king.hp, CFG.kingMaxHp, 'no damage while the sword is up');
  step(w, CFG.boleslausLockTime);
  assert.ok(['swing', 'recover'].includes(b.state), 'then the blow: ' + b.state);
  assert.ok(events.includes('swing'));
  // aimed upward (at where Wenceslas was), the blow misses a Wenceslas who stepped aside
  assert.equal(w.king.hp, CFG.kingMaxHp, 'the sidestep worked');
  step(w, CFG.boleslausRecover + 0.1);
  assert.equal(b.state, 'walk', 'recovers, then walks on');
}

// ---- the blow's fan: in front and in reach hits for 2; behind, to the side, or too far does not
{
  const blow = (kx, ky) => {
    const { w } = quietWorld(9, 8);
    const b = princeAt(w, 400, 200);
    w.king.x = kx; w.king.y = ky;
    b.dx = -1; b.dy = 0; b.state = 'windup'; b.t = 0.01; b.locked = true;
    w.update(1 / 60, STILL);
    w.update(1 / 60, STILL);
    return CFG.kingMaxHp - w.king.hp;
  };
  assert.equal(blow(350, 200), CFG.boleslausSwordDamage, 'in front and close: hit for ' + CFG.boleslausSwordDamage);
  assert.equal(blow(400 - CFG.boleslausReach, 200), CFG.boleslausSwordDamage, 'at the end of his reach: hit');
  assert.equal(blow(400 - CFG.boleslausReach - 14, 200), 0, 'just past his reach: safe');
  assert.equal(blow(450, 200), 0, 'behind him: safe');
  assert.equal(blow(400, 140), 0, 'to the side: safe');
  assert.equal(blow(400 - 50, 200 - 50 * Math.tan(CFG.boleslausArc - 0.1)) > 0, true, 'inside the edge of the fan: hit');
  assert.equal(blow(400 - 50, 200 - 50 * Math.tan(CFG.boleslausArc + 0.25)), 0, 'outside the edge of the fan: safe');
  // a page in the fan is hurt too
  const { w } = quietWorld(9, 9);
  const b = princeAt(w, 400, 200);
  w.king.x = 100;
  w.spawnPage(true);
  const pg = w.pages[0];
  pg.x = 350; pg.y = 200; pg.target = { x: 350, y: 200 };
  const hp = pg.hp;
  b.dx = -1; b.dy = 0; b.state = 'windup'; b.t = 0.01; b.locked = true;
  w.update(1 / 60, STILL); w.update(1 / 60, STILL);
  assert.ok(w.pages.length === 0 || pg.hp < hp, 'a page in the fan is hit');
}

// ---- duck in, hit, duck out: his reach is past Wenceslas's, and a windup leaves time for two or three swings
assert.ok(CFG.boleslausReach + 4 >= CFG.swingRange + CFG.boleslausRadius + 2, 'whoever can hit him is in reach of his blow');
{
  const { w } = quietWorld(9, 10);
  const b = princeAt(w, 400, 200);
  w.king.x = 330; w.king.y = 200;           // 70 away: in range to hit him, and inside his reach
  b.think = 0;
  step(w, 0.05);
  assert.equal(b.state, 'windup');
  const aimAt = { mx: 0, my: 0, ax: b.x, ay: b.y - 8 };
  let t = 0;
  // swing as fast as the sword allows...
  step(w, 0.8, { ...aimAt, swing: true }, () => { t += 1 / 60; });
  const hits = b.maxHp - b.hp;
  assert.ok(hits >= 2, 'time for at least two swings in the windup: ' + hits);
  // ...then duck out before the blow
  step(w, 0.3, { mx: -1, my: 0, ax: b.x, ay: b.y - 8, swing: false });
  assert.ok(Math.hypot(w.king.x - b.x, w.king.y - b.y) > CFG.boleslausReach + 4, 'out of reach in time');
  step(w, 0.6);
  assert.equal(w.king.hp, CFG.kingMaxHp, 'and unhurt: the dance works');
}
{
  // standing still to trade blows costs 2
  const { w } = quietWorld(9, 11);
  const b = princeAt(w, 400, 200);
  w.king.x = 330; w.king.y = 200;
  b.think = 0;
  step(w, 0.05);
  step(w, CFG.boleslausWindup + 0.1, { mx: 0, my: 0, ax: b.x, ay: b.y - 8, swing: true });
  assert.equal(w.king.hp, CFG.kingMaxHp - CFG.boleslausSwordDamage, 'standing your ground costs ' + CFG.boleslausSwordDamage);
}

// ---- far away he rolls, and rarely charges; the charge is faster than the roll
{
  const { w } = quietWorld(9, 12);
  w.king.god = true; w.king.x = 40; w.king.y = 330;
  const b = princeAt(w, 600, 100);
  let rolls = 0, charges = 0;
  const N = 800;
  for (let i = 0; i < N; i++) {
    b.state = 'walk'; b.think = 0; b.x = 600; b.y = 100;
    w.update(1 / 60, STILL);
    assert.equal(b.state, 'aim', 'far from Wenceslas he rolls or charges');
    if (b.attack === 'charge') charges++; else rolls++;
  }
  const share = charges / N;
  assert.ok(Math.abs(share - CFG.boleslausChargeChance) < 0.05, 'charges are about ' + CFG.boleslausChargeChance + ' of them: ' + share);
  assert.ok(CFG.boleslausChargeChance <= 0.5, 'and rare');
  assert.ok(rolls > charges * 2);
}
{
  const dist = (attack, secs) => {
    const { w } = quietWorld(9, 13);
    w.king.god = true; w.king.x = 20; w.king.y = 340;
    const b = princeAt(w, 100, 150);
    b.state = attack; b.attack = attack; b.dx = 1; b.dy = 0; b.rolled = 0;
    step(w, secs);
    return b.x - 100;
  };
  const roll = dist('roll', 0.3), charge = dist('charge', 0.3);
  near(roll, CFG.boleslausRollSpeed * 0.3, 3);
  near(charge, CFG.boleslausChargeSpeed * 0.3, 3);
  assert.ok(charge > roll * 1.5, 'the charge is much faster than the roll');
  assert.ok(CFG.boleslausRollSpeed > CFG.kingSpeed, 'and the roll is faster than Wenceslas');
}

// ---- a roll and a charge: hurt for 2 and 3, flatten pages, stop at their distance, in a tree or at the edge
{
  for (const [attack, dmg, distance] of /** @type {[string, number, number][]} */ ([['roll', CFG.boleslausRollDamage, CFG.boleslausRollDistance], ['charge', CFG.boleslausChargeDamage, CFG.boleslausChargeDistance]])) {
    const { w } = quietWorld(9, 14);
    const b = princeAt(w, 60, 200);
    b.state = attack; b.attack = attack; b.dx = 1; b.dy = 0; b.rolled = 0;
    w.king.x = 160; w.king.y = 200;
    step(w, 0.8);
    assert.equal(w.king.hp, CFG.kingMaxHp - dmg, `a ${attack} costs ${dmg}`);
  }
  {
    const { w } = quietWorld(9, 15);
    w.king.god = true; w.king.x = 20; w.king.y = 340;
    w.spawnPage(true);
    const pg = w.pages[0];
    pg.x = 150; pg.y = 200; pg.target = { x: 150, y: 200 };
    const b = princeAt(w, 60, 200);
    b.state = 'roll'; b.attack = 'roll'; b.dx = 1; b.dy = 0; b.rolled = 0;
    step(w, 0.8);
    assert.equal(w.pages.length, 0, 'a page in the way is flattened');
  }
  {
    const { w } = quietWorld(9, 16);
    w.king.god = true; w.king.x = 20; w.king.y = 340;
    const b = princeAt(w, 60, 150);
    b.state = 'roll'; b.attack = 'roll'; b.dx = 1; b.dy = 0; b.rolled = 0;
    step(w, 2);
    assert.equal(b.state, 'rest');
    near(b.x, 60 + CFG.boleslausRollDistance, 4);
    assert.equal(b.crashed, false);
  }
  {
    const { w, events } = quietWorld(9, 17);
    w.king.god = true; w.king.x = 20; w.king.y = 340;
    w.obstacles = [{ kind: 'tree', x: 250, y: 150, r: 4, size: 20, variant: 0 }];
    const b = princeAt(w, 100, 150);
    b.state = 'charge'; b.attack = 'charge'; b.dx = 1; b.dy = 0; b.rolled = 0;
    for (let i = 0; i < 3 * 60 && b.state === 'charge'; i++) w.update(1 / 60, STILL);
    assert.equal(b.state, 'rest', 'stopped by the tree');
    assert.equal(b.crashed, true);
    assert.ok(b.x < 250, 'did not go through it');
    near(b.t, CFG.boleslausChargeRest + CFG.boleslausCrashBonus, 0.05);
    assert.ok(events.includes('frostyCrash'), 'with a crash sound');
  }
  {
    const { w, events } = quietWorld(9, 18);
    w.king.god = true; w.king.x = 20; w.king.y = 340;
    const b = princeAt(w, 500, 150);
    b.state = 'charge'; b.attack = 'charge'; b.dx = 1; b.dy = 0; b.rolled = 0;
    for (let i = 0; i < 3 * 60 && b.state === 'charge'; i++) w.update(1 / 60, STILL);
    assert.equal(b.state, 'rest', 'stopped by the edge of the screen');
    assert.ok(events.includes('frostyCrash'));
  }
}

// ---- the guards stay by him until Wenceslas is close; then they go for Wenceslas; then they go back
{
  const { w } = quietWorld(9, 19);
  w.king.x = 20; w.king.y = 340;
  w.king.god = true;
  const b = princeAt(w, 400, 150, 'walk', { guards: true });
  b.think = 999;
  b.x = 400; b.y = 150;
  w.king.x = 400; w.king.y = 340;             // far: more than the guards' aggro radius from him
  const guards = w.robbers.filter((r) => r.guard);
  for (const g of guards) { g.x = 330; g.y = 260; }   // scattered
  // freeze Boleslaus so only the guards move
  const freeze = () => { b.x = 400; b.y = 150; };
  step(w, 6, STILL, freeze);
  for (const g of guards) {
    const d = Math.hypot(g.x - b.x, g.y - b.y);
    assert.ok(Math.abs(d - CFG.boleslausPostRadius) < 6, 'a guard loiters at his post by him: ' + d);
  }
  assert.equal(w.king.hp, CFG.kingMaxHp, 'and does no harm while Wenceslas is far');
  // Wenceslas comes close to Boleslaus: they go for him
  w.king.x = 400; w.king.y = 150 + CFG.boleslausGuardAggro - 10;
  const before = guards.map((g) => Math.hypot(g.x - w.king.x, g.y - w.king.y));
  step(w, 1, STILL, freeze);
  const after = guards.map((g) => Math.hypot(g.x - w.king.x, g.y - w.king.y));
  assert.ok(after.every((d, i) => d < before[i] + 1) && after.some((d, i) => d < before[i] - 5), 'they close in on Wenceslas');
  w.king.god = false;
  step(w, 3, STILL, freeze);
  assert.ok(w.king.hp < CFG.kingMaxHp, 'and strike with their clubs');
  // he leaves: they go back to their posts
  w.king.god = true;
  w.king.x = 20; w.king.y = 340;
  step(w, 8, STILL, freeze);
  for (const g of guards) assert.ok(Math.abs(Math.hypot(g.x - b.x, g.y - b.y) - CFG.boleslausPostRadius) < 8, 'back at their posts');
}
// ...killing a guard is an ordinary kill: one hit, ordinary points
{
  const { w } = quietWorld(9, 20);
  w.king.god = true; w.king.x = 100; w.king.y = 200;
  const b = princeAt(w, 500, 150, 'walk', { guards: true });
  b.think = 999;
  const g = w.robbers[0];
  g.x = 160; g.y = 200; g.stun = 0;
  w.king.cd = 0; w.king.hit.clear();
  w.update(1 / 60, { mx: 0, my: 0, ax: g.x, ay: g.y - 6, swing: true });
  assert.equal(w.robbers.includes(g), false, 'one hit kills a guard');
  assert.equal(w.kills, 1);
}

// ---- sixteen hits kill him; he staggers, kneels and topples; the guards run; then, and only then, the night ends
{
  const { w, events } = quietWorld(9, 21);
  const b = princeAt(w, 400, 200, 'walk', { guards: true });
  b.think = 999;
  w.king.x = 345; w.king.y = 200;
  assert.equal(b.maxHp, CFG.boleslausHp);
  for (let i = 1; i <= b.maxHp; i++) {
    assert.equal(w.victory, false);
    b.state = 'walk'; b.think = 999; b.x = 400; b.y = 200; w.king.hp = CFG.kingMaxHp; w.king.inv = 0;
    w.king.cd = 0; w.king.hit.clear();
    w.update(1 / 60, { mx: 0, my: 0, ax: b.x, ay: b.y - 8, swing: true });
    if (i < b.maxHp) w.update(1 / 60, STILL);
  }
  assert.equal(b.state, 'dying', 'the last hit fells him');
  assert.equal(w.boss, b, 'he is still there, on the ground');
  assert.equal(w.done, false, 'and the night is not over');
  assert.equal(w.kills >= 1, true);
  assert.equal(w.bonus, CFG.pointsBoss);
  assert.ok(events.includes('kill') && !events.includes('nightComplete'));
  assert.equal(w.foes().includes(b), false);
  assert.ok(w.robbers.every((r) => !r.guard || r.flee), 'the guards lose heart');
  const total = CFG.boleslausDeathStagger + CFG.boleslausDeathKneel + CFG.boleslausDeathFall + CFG.boleslausDeathLie;
  near(b.t, total, 0.05);
  const t0 = w.time;
  step(w, total - 0.1);
  assert.equal(w.done, false, 'not over before ' + total + ' s');
  assert.equal(w.time, t0, 'the clock stops when he falls');
  w.damage(w.king, { x: 0, y: 0 }, 3);
  assert.equal(w.king.hp, CFG.kingMaxHp, 'nothing hurts Wenceslas meanwhile');
  assert.equal(w.robbers.filter((r) => r.guard).length, 0, 'the guards have run off the screen');
  step(w, 0.2);
  assert.equal(w.boss, null);
  assert.equal(w.done, true);
  assert.ok(events.includes('nightComplete'));
}

// ---- a long fight against a king who dodges about: no NaN, nothing stuck, and a king who chases him wins
{
  const { w } = quietWorld(9, 22);
  w.king.god = true;
  w.spawnBoleslaus();
  for (let i = 0; i < 60 * 120; i++) {
    const b = w.boss;
    const hittable = b && w.foes().includes(b);
    const mx = hittable ? Math.sign(b.x - w.king.x) : Math.cos(i / 41), my = hittable ? Math.sign(b.y - w.king.y) : Math.sin(i / 29);
    w.update(1 / 60, { mx, my, ax: b?.x ?? 0, ay: (b?.y ?? 0) - 8, swing: true });
    if (b?.kind === 'boleslaus') for (const v of [b.x, b.y, b.t, b.dx, b.dy, b.think]) assert.ok(Number.isFinite(v));
    for (const r of w.robbers) assert.ok(Number.isFinite(r.x) && Number.isFinite(r.y));
    if (w.done) break;
  }
  assert.equal(w.done, true, 'a king who chases him beats him');
}

console.log('boleslaus: all tests passed');
