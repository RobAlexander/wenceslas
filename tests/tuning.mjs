// Sanity checks for js/tuning.js, so a slip while editing it (a negative speed, a typo that makes
// something not a number, a food range the wrong way round) is caught with a message that names the
// number. Run with: node tests/tuning.mjs
import assert from 'node:assert/strict';
import { CFG, NIGHTS, NIGHT_OFFSET, FOOD_NEEDED, CURVES } from '../js/tuning.js';
import { nightParams, parTime } from '../js/config.js';

// Every number in the file must be a real number, not negative.
function walk(value, path) {
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, path + '.' + k);
    return;
  }
  assert.ok(typeof value === 'number' && Number.isFinite(value), `${path} must be a number (it is ${JSON.stringify(value)})`);
  assert.ok(value >= 0, `${path} can't be negative (it is ${value})`);
}
walk(CFG, 'CFG');
walk(CURVES, 'CURVES');
walk(FOOD_NEEDED, 'FOOD_NEEDED');
walk(NIGHTS, 'NIGHTS');
walk(NIGHT_OFFSET, 'NIGHT_OFFSET');

const whole = (v, min, path) => assert.ok(Number.isInteger(v) && v >= min, `${path} must be a whole number, at least ${min} (it is ${v})`);
whole(NIGHTS, 1, 'NIGHTS');
whole(NIGHT_OFFSET, 0, 'NIGHT_OFFSET');
whole(FOOD_NEEDED.firstNight, 1, 'FOOD_NEEDED.firstNight');
whole(FOOD_NEEDED.lastNight, 1, 'FOOD_NEEDED.lastNight');
whole(CFG.kingMaxHp, 1, 'CFG.kingMaxHp');
whole(CFG.pageMaxHp, 1, 'CFG.pageMaxHp');
whole(CFG.maryHp, 1, 'CFG.maryHp');
for (const group of ['wolves', 'archers']) {
  whole(CURVES[group].firstNight, 1, `CURVES.${group}.firstNight`);
  whole(CURVES[group].nightsPerExtra, 1, `CURVES.${group}.nightsPerExtra`);
  whole(CURVES[group].most, 1, `CURVES.${group}.most`);
}
whole(CURVES.pages.levelsPerExtra, 1, 'CURVES.pages.levelsPerExtra');
whole(CURVES.foodOnGround.levelsPerExtra, 1, 'CURVES.foodOnGround.levelsPerExtra');
whole(CURVES.robbers.atOnce.max, 1, 'CURVES.robbers.atOnce.max');

// Fractions and angles
for (const [path, v] of [['CFG.hpRestoreBetweenNights', CFG.hpRestoreBetweenNights], ['CURVES.robbers.toughChancePerLevel', CURVES.robbers.toughChancePerLevel], ['CURVES.mary.chance', CURVES.mary.chance]]) {
  assert.ok(v <= 1, `${path} is a fraction between 0 and 1 (it is ${v})`);
}
assert.ok(CFG.swingHalfArc <= Math.PI, 'CFG.swingHalfArc is in radians and can be at most 3.14 (a full half circle each side)');
assert.ok(CFG.archerSpread <= Math.PI / 2, 'CFG.archerSpread is in radians; over 1.57 and archers shoot backwards');

// Things that must be more than zero or the game stops working
for (const k of ['kingSpeed', 'swingCooldown', 'swingRange', 'swingDrawnRadius', 'pageFollowSpeed', 'robberSpeed', 'arrowSpeed', 'arrowLife', 'deliverInterval', 'hardSpeedMul', 'pointsFood']) {
  assert.ok(CFG[k] > 0, `CFG.${k} must be more than zero`);
}

// Design intent (change these on purpose, not by accident)
assert.ok(CFG.pageFollowSpeed > CFG.kingSpeed, 'pages must be faster than Wenceslas or the line can\'t keep up');
assert.ok(CFG.archerRetreatSpeed * CFG.hardSpeedMul < CFG.kingSpeed, 'archers must back away more slowly than Wenceslas walks, even in hard mode, so he can run them down');
assert.ok(CFG.archerSpeed * CFG.hardSpeedMul < CFG.kingSpeed, 'archers must walk more slowly than Wenceslas, even in hard mode');
assert.ok(CFG.marySpeed * CFG.hardSpeedMul < CFG.kingSpeed, 'Mary must walk more slowly than Wenceslas, even in hard mode');
assert.ok(CURVES.mary.earliest <= CURVES.mary.latest, 'CURVES.mary.earliest must not be later than CURVES.mary.latest');
assert.ok(CFG.maryStopDistance < CFG.maryRange, 'Mary stops walking closer than maryStopDistance, so it has to be less than maryRange');
assert.ok(CFG.archerKeepAway < CFG.archerRange, 'archers back away from closer than archerKeepAway, so it has to be less than archerRange');

// What the curves give for every night
let lastFood = 0;
for (let n = 1; n <= NIGHTS; n++) {
  const p = nightParams(n);
  for (const [k, v] of Object.entries(p)) {
    assert.ok(Number.isFinite(v) && v >= 0, `night ${n}: ${k} came out as ${v}`);
  }
  for (const k of ['foodTarget', 'maxRobbers', 'maxWanderingPages', 'maxFood', 'maxWolves', 'maxArchers']) {
    assert.ok(Number.isInteger(p[k]), `night ${n}: ${k} must be a whole number (it is ${p[k]})`);
  }
  assert.ok(p.foodTarget >= 1, `night ${n}: the old man needs at least one food`);
  assert.ok(p.robberInterval > 0 && p.pageInterval > 0 && p.foodInterval > 0, `night ${n}: gaps between spawns must be more than zero`);
  assert.ok(parTime(p.foodTarget) > 0);
  if (FOOD_NEEDED.lastNight >= FOOD_NEEDED.firstNight) assert.ok(p.foodTarget >= lastFood, `night ${n}: food needed should never fall from one night to the next`);
  lastFood = p.foodTarget;
}
assert.equal(nightParams(1).foodTarget, FOOD_NEEDED.firstNight, 'the first night asks for FOOD_NEEDED.firstNight');
assert.equal(nightParams(NIGHTS).foodTarget, NIGHTS > 1 ? FOOD_NEEDED.lastNight : FOOD_NEEDED.firstNight, 'the last night asks for FOOD_NEEDED.lastNight');

console.log('tuning: all numbers look sensible');
