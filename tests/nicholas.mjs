// St Nicholas, the fourth and final boss (night 12). He appears, then drifts at a distance and can be hit whenever he is
// there. He raises the dead (skeletons, which are robbers, and ghosts, which warn and then launch), calls down an ice
// barrage on about half the field (it strikes twice), and, if Wenceslas stays close too long, lightning strikes
// everything inside a ring of warning signs. Run with: node tests/nicholas.mjs
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { makeRng } from '../js/rng.js';
import { nightParams, bossInfo, nicholasStats, CFG, NIGHTS } from '../js/config.js';

const STILL = { mx: 0, my: 0, ax: 0, ay: 0, swing: false };

// A quiet boss night (12 is his): nothing else spawns and nobody else is about.
function quietWorld(night = 12, seed = 1, hard = false) {
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
// St Nicholas at a place, idle and not about to cast (unless asked)
function nicholasAt(w, x, y, state = 'idle', think = 999) {
  w.spawnNicholas();
  const b = w.boss;
  b.x = x; b.y = y; b.state = state; b.t = 0; b.think = think;
  return b;
}
const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const cellCentre = (c) => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 });

// ---- which night has which boss: Frosty, Mary, Boleslaus, St Nicholas (once each, the last the last)
assert.deepEqual([3, 6, 9, 12].map((n) => bossInfo(nightParams(n).bossNo)), [
  { kind: 'frosty', nth: 1 }, { kind: 'mary', nth: 1 }, { kind: 'boleslaus', nth: 1 }, { kind: 'nicholas', nth: 1 },
]);
assert.equal(bossInfo(0).kind, 'frosty', 'with no boss tonight (the dev console) the first boss is the easiest, Frosty');
for (let n = 1; n <= NIGHTS; n++) assert.equal(nightParams(n).bossNo > 0, n % 3 === 0);
assert.equal(nicholasStats(1).hp, CFG.nicholasHp);

// ---- the last food on night 12 brings him, and the night goes on; nothing else spawns
{
  const { w, events } = quietWorld(12);
  w.king.god = true;
  w.delivered = w.p.foodTarget - 1; w.line = [{ food: 'bread' }];
  w.king.x = w.oldMan.x; w.king.y = w.oldMan.y;
  step(w, 0.5);
  assert.equal(w.boss?.kind, 'nicholas', 'St Nicholas comes on night 12');
  assert.equal(w.boss.state, 'appear');
  assert.equal(w.done, false);
  assert.ok(events.includes('bossStart') && w.bossIntro > 0);
  assert.ok(Math.hypot(w.boss.x - w.king.x, w.boss.y - w.king.y) >= 150, 'appears well away from Wenceslas');
}
{
  const { w } = quietWorld(12, 2);
  Object.assign(w.p, { maxRobbers: 5, maxWolves: 5, maxArchers: 5, maxFood: 5, maxWanderingPages: 5, firstRobber: 0, firstWolf: 0, firstArcher: 0 });
  w.king.god = true;
  w.robberTimer = w.wolfTimer = w.archerTimer = w.foodTimer = w.pageTimer = 0;
  w.spawnNicholas();
  w.boss.think = 999;
  step(w, 5);
  assert.equal(w.robbers.length + w.wolves.length + w.archers.length + w.foods.length + w.pages.length, 0);
}

// ---- he appears (can't be hit yet), then can be hit in every state but dying
{
  const { w } = quietWorld(12, 3);
  w.king.god = true;
  w.spawnNicholas();
  const b = w.boss;
  assert.equal(w.foes().includes(b), false, 'not a target while he appears');
  step(w, CFG.nicholasAppear + 0.1);
  assert.equal(b.state, 'idle', 'then he is there');
  for (const state of ['idle', 'castRaise', 'castIce', 'thunder']) {
    b.state = state;
    assert.equal(w.foes().includes(b), true, 'a target while ' + state);
  }
  b.state = 'dying';
  assert.equal(w.foes().includes(b), false, 'not a target while he dies');
}
{
  // a real swing hurts him
  const { w } = quietWorld(12, 4);
  w.king.god = true; w.king.x = 330; w.king.y = 200;
  const b = nicholasAt(w, 400, 200);
  w.king.cd = 0; w.king.hit.clear();
  w.update(1 / 60, { mx: 0, my: 0, ax: b.x, ay: b.y - 8, swing: true });
  assert.equal(b.hp, b.maxHp - 1);
}

// ---- he keeps his distance, slowly
{
  const { w } = quietWorld(12, 5);
  w.king.god = true; w.king.x = 300; w.king.y = 200;
  const b = nicholasAt(w, 340, 200);                    // 40 away: too close
  const d0 = Math.hypot(b.x - w.king.x, b.y - w.king.y);
  step(w, 1.5);
  const d1 = Math.hypot(b.x - w.king.x, b.y - w.king.y);
  assert.ok(d1 > d0 + CFG.nicholasWalkSpeed * 1.5 * 0.7, 'backs away from Wenceslas: ' + d0 + ' -> ' + d1);
  assert.ok(CFG.nicholasWalkSpeed < CFG.kingSpeed / 2, 'slowly');
}
{
  const { w } = quietWorld(12, 6);
  w.king.god = true; w.king.x = 100; w.king.y = 200;
  const b = nicholasAt(w, 500, 200);                    // 400 away: too far
  step(w, 4);
  assert.ok(b.x < 500 - CFG.nicholasWalkSpeed * 4 * 0.7, 'drifts closer when he is far');
}

// ---- the casts: raise the dead or an ice strike, never the same twice running, and not past the limits
{
  const { w } = quietWorld(12, 7);
  w.king.god = true; w.king.x = 100; w.king.y = 340;
  const b = nicholasAt(w, 400, 150, 'idle', 0);
  const seen = [];
  for (let i = 0; i < 10; i++) {
    b.state = 'idle'; b.think = 0; w.ice = null; b.thunderCd = 99; b.close = 0;
    w.robbers.length = 0; w.ghosts.length = 0;
    w.update(1 / 60, STILL);
    assert.ok(['castRaise', 'castIce'].includes(b.state), 'casts: ' + b.state);
    seen.push(b.last);
  }
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1], 'not the same cast twice running');
  assert.deepEqual([...new Set(seen)].sort(), ['ice', 'raise']);
}
{
  // already too many dead out: he calls down ice instead
  const { w } = quietWorld(12, 8);
  w.king.god = true; w.king.x = 100; w.king.y = 340;
  const b = nicholasAt(w, 400, 150, 'idle', 0);
  for (let i = 0; i < CFG.nicholasMaxSkeletons; i++) w.raiseSkeleton({ x: 300 + i * 10, y: 100 });
  b.think = 0; b.thunderCd = 99;
  w.update(1 / 60, STILL);
  assert.equal(b.state, 'castIce', 'he does not raise more dead than the limit');
  assert.ok(w.skeletonCount() <= CFG.nicholasMaxSkeletons);
}

// ---- raising the dead: skeletons climb out (inert) and then hunt like robbers; ghosts warn
{
  const { w, events } = quietWorld(12, 9);
  w.king.x = 260; w.king.y = 200;
  const b = nicholasAt(w, 400, 200, 'idle', 0);
  b.thunderCd = 99;
  b.last = 'ice';
  w.update(1 / 60, STILL);
  assert.equal(b.state, 'castRaise');
  assert.equal(b.skeletonSpots.length, CFG.nicholasSkeletons, 'circles on the ground show where');
  assert.equal(b.ghostSpots.length, CFG.nicholasGhosts);
  assert.ok(events.includes('recruit'));
  assert.equal(w.skeletonCount(), 0, 'nothing has risen yet');
  step(w, CFG.nicholasRaiseCast + 0.05);
  assert.equal(w.skeletonCount(), CFG.nicholasSkeletons, 'skeletons rise');
  assert.equal(w.ghosts.length, CFG.nicholasGhosts, 'and ghosts appear');
  const sk = w.robbers.filter((r) => r.undead);
  for (const r of sk) {
    assert.ok(r.rise > 0, 'climbing out of the ground');
    assert.equal(w.foes().includes(r), false, 'not a target while rising');
  }
  const pos = sk.map((r) => [r.x, r.y]);
  step(w, 0.3);
  sk.forEach((r, i) => assert.deepEqual([r.x, r.y], pos[i], 'and not moving'));
  w.king.god = true;
  step(w, CFG.nicholasRise + 1.5);
  assert.ok(sk.some((r) => Math.hypot(r.x - pos[sk.indexOf(r)][0], r.y - pos[sk.indexOf(r)][1]) > 20), 'then they come for Wenceslas');
  for (const r of sk) assert.equal(w.foes().includes(r), true, 'and can be hit');
}
{
  // skeletons hurt like robbers (a club, 1 damage) and fall at one hit, worth nothing
  const { w } = quietWorld(12, 10);
  const b = nicholasAt(w, 500, 100);
  w.king.x = 200; w.king.y = 200;
  w.raiseSkeleton({ x: 260, y: 200 });
  const sk = w.robbers[0];
  sk.rise = 0;
  step(w, 2.5);
  assert.ok(w.king.hp < CFG.kingMaxHp, 'a skeleton clubs Wenceslas');
  w.king.god = true; w.king.cd = 0; w.king.hit.clear();
  sk.x = w.king.x + 40; sk.y = w.king.y;
  const kills = w.kills, texts = w.texts.length;
  w.update(1 / 60, { mx: 0, my: 0, ax: sk.x, ay: sk.y - 6, swing: true });
  assert.equal(w.robbers.includes(sk), false, 'one hit');
  assert.equal(w.kills, kills, 'a raised skeleton is not a kill');
  assert.equal(w.bonus, 0);
  assert.ok(w.texts.length === texts, 'and is worth no points');
  void b;
}

// ---- ghosts: they glare, track Wenceslas until the lock, then launch fast and scream
{
  const { w, events } = quietWorld(12, 11);
  w.king.god = true;
  const b = nicholasAt(w, 500, 100);
  w.king.x = 100; w.king.y = 200;
  w.raiseGhost({ x: 400, y: 200 });
  const gh = w.ghosts[0];
  assert.equal(gh.state, 'warn');
  step(w, 0.2);
  assert.ok(gh.dx < -0.99, 'aims at him');
  w.king.x = 400; w.king.y = 40;
  step(w, 0.2);
  assert.ok(gh.dy < -0.5, 'still following while it glares');
  step(w, CFG.ghostWarn - 0.4 - CFG.ghostLock + 0.03);
  assert.equal(gh.locked, true, 'locked for the last ' + CFG.ghostLock + ' s');
  const dx = gh.dx, dy = gh.dy;
  w.king.x = 100; w.king.y = 330;
  step(w, 0.1);
  assert.equal(gh.dx, dx); assert.equal(gh.dy, dy);
  assert.equal(events.includes('ghostScream'), false, 'no scream before the launch');
  step(w, CFG.ghostLock + 0.05);
  assert.equal(gh.state, 'fly');
  assert.ok(events.includes('ghostScream'), 'it screams as it launches');
  const x0 = gh.x, y0 = gh.y;
  step(w, 0.2);
  const speed = Math.hypot(gh.x - x0, gh.y - y0) / 0.2;
  assert.ok(Math.abs(speed - CFG.ghostSpeed) < 20, 'it flies at ghostSpeed: ' + speed);
  assert.ok(Math.abs(Math.atan2(gh.y - y0, gh.x - x0) - Math.atan2(dy, dx)) < 0.01, 'along the locked line');
  assert.equal(w.king.hp, CFG.kingMaxHp, 'the sidestep worked');
  void b;
}
{
  // it hits for 2, over scenery, and then it is gone; it kills a page
  const { w } = quietWorld(12, 12);
  nicholasAt(w, 500, 60);
  w.king.x = 300; w.king.y = 200;
  w.obstacles = [{ kind: 'tree', x: 200, y: 200, r: 4, size: 20, variant: 0 }, { kind: 'wall', x: 240, y: 200, w: 10, h: 60, size: 30 }];
  w.raiseGhost({ x: 140, y: 200 });
  const gh = w.ghosts[0];
  gh.state = 'fly'; gh.dx = 1; gh.dy = 0; gh.locked = true;
  step(w, 1);
  assert.equal(w.king.hp, CFG.kingMaxHp - CFG.ghostDamage, 'a ghost costs ' + CFG.ghostDamage);
  assert.equal(w.ghosts.length, 0, 'it dissipates');
  assert.ok(CFG.ghostSpeed > 2 * CFG.kingSpeed, 'and it is fast');
}
{
  const { w } = quietWorld(12, 13);
  w.king.god = true; w.king.x = 20; w.king.y = 340;
  nicholasAt(w, 500, 60);
  w.spawnPage(true);
  const pg = w.pages[0];
  pg.x = 300; pg.y = 200; pg.target = { x: 300, y: 200 };
  w.raiseGhost({ x: 200, y: 200 });
  const gh = w.ghosts[0];
  gh.state = 'fly'; gh.dx = 1; gh.dy = 0;
  step(w, 0.8);
  assert.equal(w.pages.length, 0, 'it kills a page in its path');
}
{
  // one hit kills a ghost, glaring or flying, and a ghost that misses leaves the screen
  const { w } = quietWorld(12, 14);
  w.king.god = true; w.king.x = 300; w.king.y = 200;
  nicholasAt(w, 500, 60);
  w.raiseGhost({ x: 360, y: 200 });
  const gh = w.ghosts[0];
  const kills = w.kills;
  w.king.cd = 0; w.king.hit.clear();
  w.update(1 / 60, { mx: 0, my: 0, ax: gh.x, ay: gh.y - 6, swing: true });
  assert.equal(w.ghosts.length, 0, 'one hit while it glares');
  assert.equal(w.kills, kills);
  w.raiseGhost({ x: 360, y: 200 });
  const g2 = w.ghosts[0];
  g2.state = 'fly'; g2.dx = 0; g2.dy = -1;
  step(w, 3);
  assert.equal(w.ghosts.length, 0, 'a ghost that misses leaves the screen');
}

// ---- the ice barrage: about half the field, in a pattern, never boxing anyone in
{
  const cols = CFG.nicholasIceCols, rows = CFG.nicholasIceRows;
  const patterns = new Set();
  for (let seed = 1; seed <= 120; seed++) {
    const { w } = quietWorld(12, seed);
    const cells = w.pickIceCells();
    assert.equal(cells.length, Math.round(cols * rows * CFG.nicholasIceShare), 'half the cells: ' + cells.length);
    const key = (c) => Math.round(c.x / (640 / cols)) + ',' + Math.round((c.y - 16) / ((360 - 16) / rows));
    const set = new Set(cells.map(key));
    assert.equal(set.size, cells.length, 'no cell twice');
    for (const c of cells) {
      assert.ok(c.x >= 0 && c.x + c.w <= 640.001 && c.y >= 16 - 0.001 && c.y + c.h <= 360.001, 'on the field');
      const [cx, cy] = key(c).split(',').map(Number);
      const free = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = cx + dx, ny = cy + dy;
        return nx >= 0 && nx < cols && ny >= 0 && ny < rows && !set.has(nx + ',' + ny);
      });
      assert.ok(free, 'every zone has a free cell beside it: there is always somewhere to step');
    }
    const area = cells.reduce((a, c) => a + c.w * c.h, 0), total = 640 * (360 - 16);
    near(area / total, CFG.nicholasIceShare, 0.001);
    const checker = cells.every((c) => { const [cx, cy] = key(c).split(',').map(Number); return (cx + cy) % 2 === (cells[0] && ((Number(key(cells[0]).split(',')[0]) + Number(key(cells[0]).split(',')[1])) % 2)); });
    const columns = cells.every((c) => Number(key(c).split(',')[0]) % 2 === Number(key(cells[0]).split(',')[0]) % 2);
    patterns.add(checker ? 'checker' : columns ? 'columns' : 'scatter');
  }
  assert.equal(patterns.size, 3, 'all three patterns turn up: ' + [...patterns]);
}
{
  const { w, events } = quietWorld(12, 15);
  w.king.god = false;
  const b = nicholasAt(w, 500, 80, 'idle', 0);
  b.thunderCd = 99; b.last = 'raise';
  w.update(1 / 60, STILL);
  assert.equal(b.state, 'castIce');
  assert.equal(w.ice, null, 'the zones are not up during the cast');
  step(w, CFG.nicholasIceCast + 0.05);
  assert.ok(w.ice, 'the zones appear');
  assert.equal(w.ice.struck, 0);
  assert.equal(w.king.hp, CFG.kingMaxHp, 'no damage while the zones warn');
  assert.equal(events.includes('iceStrike'), false);
  const inZone = w.ice.cells[0];
  const free = (() => {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
      const cell = { x: c * 80, y: 16 + r * 86, w: 80, h: 86 };
      if (!w.ice.cells.some((z) => z.x === cell.x && z.y === cell.y)) return cell;
    }
  })();
  // a page in a zone, a skeleton in a zone and one outside, and Wenceslas outside
  w.spawnPage(true);
  const pg = w.pages[0];
  pg.x = cellCentre(inZone).x; pg.y = cellCentre(inZone).y; pg.target = { x: pg.x, y: pg.y };
  w.raiseSkeleton(cellCentre(inZone)); w.robbers[0].rise = 99;
  w.raiseSkeleton(cellCentre(free)); w.robbers[1].rise = 99;
  w.king.x = cellCentre(free).x + 5; w.king.y = cellCentre(free).y + 5;
  const hpPage = pg.hp;
  // the first strike
  step(w, CFG.nicholasIceWarn - 0.1);
  assert.equal(w.ice.struck, 0);
  step(w, 0.15);
  assert.equal(w.ice.struck, 1, 'strikes after ' + CFG.nicholasIceWarn + ' s');
  assert.equal(events.filter((e) => e === 'iceStrike').length, 1);
  assert.equal(w.king.hp, CFG.kingMaxHp, 'Wenceslas outside the zones is unhurt');
  assert.ok(w.pages.length === 0 || pg.hp < hpPage, 'a page in a zone is hurt');
  assert.equal(w.skeletonCount(), 1, 'a skeleton in a zone is destroyed, the other is not');
  assert.equal(w.boss, b); assert.equal(b.hp, b.maxHp, 'he is not hurt by his own ice');
  // the second strike
  step(w, CFG.nicholasIceGap);
  assert.equal(w.ice.struck, 2, 'strikes again ' + CFG.nicholasIceGap + ' s later');
  assert.equal(events.filter((e) => e === 'iceStrike').length, 2);
  step(w, CFG.nicholasIceLinger + 0.1);
  assert.equal(w.ice, null, 'and then the ice is gone');
}
{
  // standing in a zone for the whole barrage costs two hits
  const { w } = quietWorld(12, 16);
  const b = nicholasAt(w, 500, 80, 'idle', 0);
  b.thunderCd = 99; b.last = 'raise';
  w.update(1 / 60, STILL);
  step(w, CFG.nicholasIceCast + 0.05);
  const c = cellCentre(w.ice.cells[0]);
  w.king.x = c.x; w.king.y = c.y;
  step(w, CFG.nicholasIceWarn + CFG.nicholasIceGap + CFG.nicholasIceLinger + 0.2);
  assert.equal(w.king.hp, CFG.kingMaxHp - 2 * CFG.nicholasIceDamage, 'staying costs two hits');
  assert.ok(CFG.nicholasIceGap > CFG.kingInvuln, 'because the gap is longer than the invulnerability after a hit');
}
{
  // stepping out of a zone between the warning and the first strike avoids it all; no cast starts during the barrage
  const { w } = quietWorld(12, 17);
  const b = nicholasAt(w, 500, 80, 'idle', 0);
  b.thunderCd = 99; b.last = 'raise';
  w.update(1 / 60, STILL);
  step(w, CFG.nicholasIceCast + 0.05);
  const barrageLength = CFG.nicholasIceWarn + CFG.nicholasIceGap + CFG.nicholasIceLinger;
  assert.ok(b.think >= barrageLength, 'he waits out the barrage before casting again: ' + b.think);
}

// ---- lightning: staying close fills a timer; at the limit a ring of signs warns, then strikes everything inside
{
  const { w } = quietWorld(12, 18);
  w.king.x = 360; w.king.y = 200;
  const b = nicholasAt(w, 400, 200);                  // 40 away: close
  b.state = 'castRaise'; b.t = 9999;                  // (keep him from drifting off or casting, so only the timer moves)
  step(w, 1);
  near(b.close, 1, 0.05);
  w.king.x = 100;                                      // far
  step(w, 0.4);
  near(b.close, 1 - CFG.nicholasCloseDrain * 0.4, 0.05);   // it drains faster than it fills
  step(w, 2);
  assert.equal(b.close, 0, 'and empties');
  w.king.x = 100; step(w, 5);
  assert.equal(b.state, 'castRaise', 'staying far never brings it');
}
{
  const { w, events } = quietWorld(12, 19);
  w.king.x = 345; w.king.y = 200;
  const b = nicholasAt(w, 400, 200);
  b.think = 999;
  const close = CFG.nicholasCloseRadius;
  assert.ok(Math.hypot(b.x - w.king.x, b.y - w.king.y) < close, 'start inside the close radius');
  // keep Nicholas where he is, so the king stays close
  const hold = () => { b.x = 400; b.y = 200; };
  step(w, CFG.nicholasCloseTime - 0.1, STILL, hold);
  assert.equal(b.state, 'idle', 'not yet');
  assert.equal(w.thunder, null);
  step(w, 0.2, STILL, hold);
  assert.equal(b.state, 'thunder', 'after ' + CFG.nicholasCloseTime + ' s close, the signs go up');
  assert.ok(w.thunder && w.thunder.r === CFG.nicholasThunderRadius, 'in a ring of the right size');
  assert.ok(events.includes('frostyWarn'), 'with a warning sound');
  assert.equal(w.king.hp, CFG.kingMaxHp, 'no damage while the signs show');
  // run out of the ring before the strike
  w.king.x = 400 - CFG.nicholasThunderRadius - 20;
  step(w, CFG.nicholasThunderWarn + 0.1, STILL, hold);
  assert.ok(events.includes('lightning'), 'the lightning strikes');
  assert.equal(w.king.hp, CFG.kingMaxHp, 'Wenceslas outside the ring is safe');
  assert.equal(b.state, 'idle'); assert.equal(b.close, 0, 'the timer is reset');
  assert.ok(b.thunderCd > 0, 'and there is a cooldown');
}
{
  // inside the ring at the strike: hurt; so are skeletons; a ghost too
  const { w } = quietWorld(12, 20);
  w.king.x = 360; w.king.y = 200;
  const b = nicholasAt(w, 400, 200);
  b.think = 999;
  b.close = CFG.nicholasCloseTime;
  const hold = () => { b.x = 400; b.y = 200; };
  w.raiseSkeleton({ x: 430, y: 200 }); w.robbers[0].rise = 99;
  w.raiseSkeleton({ x: 400, y: 330 }); w.robbers[1].rise = 99;      // outside the ring
  w.raiseGhost({ x: 400, y: 150 }); w.ghosts[0].t = 99;
  step(w, 0.05, STILL, hold);
  assert.equal(b.state, 'thunder');
  step(w, CFG.nicholasThunderWarn + 0.1, STILL, hold);
  assert.equal(w.king.hp, CFG.kingMaxHp - CFG.nicholasThunderDamage, 'inside the ring: hurt for ' + CFG.nicholasThunderDamage);
  assert.equal(w.skeletonCount(), 1, 'a skeleton inside is destroyed; the one outside is not');
  assert.equal(w.ghosts.length, 0, 'so is the ghost inside');
  assert.ok(w.bolts.length > 0, 'and the bolts show');
}
{
  // after the strike the cooldown holds it off, then it can come again
  const { w, events } = quietWorld(12, 21);
  w.king.god = true; w.king.x = 360; w.king.y = 200;
  const b = nicholasAt(w, 400, 200);
  b.think = 999;
  const hold = () => { b.x = 400; b.y = 200; };
  b.close = CFG.nicholasCloseTime;
  step(w, CFG.nicholasThunderWarn + 0.2, STILL, hold);
  assert.equal(events.filter((e) => e === 'lightning').length, 1, 'the first strike');
  assert.ok(b.thunderCd > 0);
  step(w, 3.5, STILL, hold);                                         // close for over 3 s again, but the cooldown is still running
  assert.equal(b.state, 'idle', 'not again during the cooldown');
  assert.equal(events.filter((e) => e === 'lightning').length, 1);
  step(w, CFG.nicholasThunderCooldown + CFG.nicholasThunderWarn, STILL, hold);
  assert.equal(events.filter((e) => e === 'lightning').length, 2, 'but it comes again once the cooldown is up');
}

// ---- twenty hits fell him; he rises into the light for a few seconds, the dead crumble, then the night ends
{
  const { w, events } = quietWorld(12, 22);
  const b = nicholasAt(w, 400, 200);
  w.king.x = 330; w.king.y = 200;
  assert.equal(b.maxHp, CFG.nicholasHp);
  w.raiseSkeleton({ x: 300, y: 100 }); w.raiseGhost({ x: 320, y: 90 });
  w.ice = { cells: [{ x: 0, y: 16, w: 80, h: 86 }], t: 0, struck: 0 };
  w.thunder = { x: 400, y: 200, r: 95, t: 1 };
  for (let i = 1; i <= b.maxHp; i++) {
    assert.equal(w.victory, false);
    b.state = 'idle'; b.think = 999; b.x = 400; b.y = 200; b.close = 0; w.king.hp = CFG.kingMaxHp; w.king.inv = 0;
    w.king.cd = 0; w.king.hit.clear();
    w.update(1 / 60, { mx: 0, my: 0, ax: b.x, ay: b.y - 8, swing: true });
    if (i < b.maxHp) w.update(1 / 60, STILL);
  }
  assert.equal(b.state, 'dying', 'the last hit fells him');
  assert.equal(w.boss, b);
  assert.equal(w.done, false, 'the night is not over');
  assert.equal(w.kills, 1, 'one kill: him, not his dead');
  assert.equal(w.bonus, CFG.pointsBoss);
  assert.ok(events.includes('kill') && !events.includes('nightComplete'));
  assert.equal(w.foes().includes(b), false);
  assert.equal(w.skeletonCount() + w.ghosts.length, 0, 'the dead crumble');
  assert.equal(w.ice, null, 'the ice is gone'); assert.equal(w.thunder, null, 'and the lightning');
  near(b.t, CFG.nicholasDeathTime, 0.05);
  const t0 = w.time;
  step(w, CFG.nicholasDeathTime - 0.1);
  assert.equal(w.done, false, 'not over before ' + CFG.nicholasDeathTime + ' s');
  assert.equal(w.time, t0, 'the clock stops when he falls');
  w.damage(w.king, { x: 0, y: 0 }, 3);
  assert.equal(w.king.hp, CFG.kingMaxHp, 'nothing hurts Wenceslas meanwhile');
  step(w, 0.2);
  assert.equal(w.boss, null);
  assert.equal(w.done, true);
  assert.ok(events.includes('nightComplete'));
}

// ---- a long fight against a king who dodges about: nothing goes wrong, and a king who chases him beats him
{
  const { w } = quietWorld(12, 23);
  w.king.god = true;
  w.spawnNicholas();
  for (let i = 0; i < 60 * 150; i++) {
    const b = w.boss;
    const mx = b && b.state !== 'appear' ? Math.sign(b.x - w.king.x) : Math.cos(i / 41), my = b && b.state !== 'appear' ? Math.sign(b.y - w.king.y) : Math.sin(i / 29);
    w.update(1 / 60, { mx, my, ax: b?.x ?? 0, ay: (b?.y ?? 0) - 8, swing: true });
    if (b) for (const v of [b.x, b.y, b.t, b.think, b.close]) assert.ok(Number.isFinite(v), 'finite: ' + v);
    for (const r of w.robbers) assert.ok(Number.isFinite(r.x) && Number.isFinite(r.y));
    for (const g of w.ghosts) assert.ok(Number.isFinite(g.x) && Number.isFinite(g.y));
    assert.ok(w.skeletonCount() <= CFG.nicholasMaxSkeletons + CFG.nicholasSkeletons && w.ghosts.length <= CFG.nicholasMaxGhosts + CFG.nicholasGhosts, 'the dead stay within limits');
    if (w.done) break;
  }
  assert.equal(w.done, true, 'a king who chases him beats him');
}

console.log('nicholas: all tests passed');
