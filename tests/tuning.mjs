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
whole(CFG.hpRestoreBetweenNights, 0, 'CFG.hpRestoreBetweenNights');
whole(CFG.pageMaxHp, 1, 'CFG.pageMaxHp');
whole(CFG.maryHp, 1, 'CFG.maryHp');
whole(CFG.frostyHp, 1, 'CFG.frostyHp');
whole(CURVES.boss.everyNights, 1, 'CURVES.boss.everyNights');
assert.ok(Array.isArray(CURVES.boss.order) && CURVES.boss.order.length >= 1 && CURVES.boss.order.every((k) => [0, 1, 2, 3].includes(k)), 'CURVES.boss.order lists bosses by number: 0 Frosty, 1 Mary, 2 Prince Boleslaus, 3 St Nicholas');
whole(CFG.boleslausHp, 1, 'CFG.boleslausHp');
whole(CFG.boleslausGuards, 1, 'CFG.boleslausGuards');
whole(CFG.nicholasHp, 1, 'CFG.nicholasHp');
for (const k of ['nicholasSkeletons', 'nicholasGhosts', 'nicholasMaxSkeletons', 'nicholasMaxGhosts', 'nicholasIceCols', 'nicholasIceRows']) whole(CFG[k], 1, 'CFG.' + k);
whole(CFG.maryBlastBalls, 1, 'CFG.maryBlastBalls');
whole(CFG.maryBlastVolleys, 1, 'CFG.maryBlastVolleys');
whole(CFG.marySpiralArms, 1, 'CFG.marySpiralArms');
whole(CFG.maryRingBalls, 2, 'CFG.maryRingBalls');
whole(CFG.maryRingWaves, 1, 'CFG.maryRingWaves');
for (const group of ['wolves', 'archers']) {
  whole(CURVES[group].firstNight, 1, `CURVES.${group}.firstNight`);
  whole(CURVES[group].nightsPerExtra, 1, `CURVES.${group}.nightsPerExtra`);
  whole(CURVES[group].most, 1, `CURVES.${group}.most`);
}
whole(CURVES.pages.levelsPerExtra, 1, 'CURVES.pages.levelsPerExtra');
whole(CURVES.foodOnGround.levelsPerExtra, 1, 'CURVES.foodOnGround.levelsPerExtra');
whole(CURVES.robbers.atOnce.max, 1, 'CURVES.robbers.atOnce.max');

// Fractions and angles
for (const [path, v] of /** @type {[string, number][]} */ ([['CURVES.robbers.toughChancePerLevel', CURVES.robbers.toughChancePerLevel]])) {
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
assert.ok(CFG.maryRest >= 2 * CFG.swingCooldown, 'Mary must rest long enough for at least two sword swings (swingCooldown is ' + CFG.swingCooldown + ')');
assert.ok(CFG.maryLockTime < CFG.maryTelegraph, 'maryLockTime is the end part of her warning, so it has to be shorter than maryTelegraph');
assert.ok(CFG.maryBlastSpread < Math.PI / 2, 'CFG.maryBlastSpread is in radians each side of the aim; over 1.57 and the fan wraps round behind her');
assert.ok(CFG.maryDeathFreeze + CFG.maryDeathHold + CFG.maryDeathSink > 1, 'Mary\'s freeze-and-sink needs a moment, or the night ends before it can be seen');
assert.ok(CFG.frostyRollSpeed > CFG.kingSpeed, 'Frosty must roll faster than Wenceslas walks: he is dodged, not outrun');
assert.ok(CFG.frostyRest >= 2 * CFG.swingCooldown, 'Frosty must rest long enough for at least two sword swings (swingCooldown is ' + CFG.swingCooldown + ')');
assert.ok(CFG.frostyLockTime < CFG.frostyTelegraph, 'frostyLockTime is the end part of the telegraph, so it has to be shorter than frostyTelegraph');
assert.ok(CFG.frostyDamage < CFG.kingMaxHp, 'one roll must not kill Wenceslas from full health: frostyDamage has to be less than kingMaxHp');
assert.ok(CFG.frostyWalkSpeed < CFG.kingSpeed, 'Frosty must walk in more slowly than Wenceslas');
assert.ok(CFG.boleslausWalkSpeed < CFG.kingSpeed, 'Boleslaus must walk more slowly than Wenceslas, or he cannot be ducked out of reach');
assert.ok(CFG.boleslausWalkSpeed * CFG.hardSpeedMul < CFG.kingSpeed, 'Boleslaus must walk more slowly than Wenceslas even in hard mode');
assert.ok(CFG.boleslausReach + 4 >= CFG.swingRange + CFG.boleslausRadius + 2, 'Boleslaus\'s blow must reach at least as far as Wenceslas\'s sword (swingRange plus his size), so that being in range to hit him means being in range to be hit: that is the dart-in-and-out fight');
assert.ok(CFG.boleslausWindup >= 2 * CFG.swingCooldown, 'Boleslaus\'s sword windup must leave time for two sword swings (swingCooldown is ' + CFG.swingCooldown + '), or there is no point ducking in');
assert.ok(CFG.boleslausLockTime < CFG.boleslausWindup && CFG.boleslausLockTime < CFG.boleslausRollTelegraph && CFG.boleslausLockTime < CFG.boleslausChargeTelegraph, 'boleslausLockTime is the end part of every telegraph, so it has to be shorter than all of them');
assert.ok(CFG.boleslausRollSpeed > CFG.kingSpeed, 'Boleslaus must roll faster than Wenceslas walks: he is dodged, not outrun');
assert.ok(CFG.boleslausChargeSpeed > CFG.boleslausRollSpeed, 'the lance charge must be faster than the roll');
assert.ok(CFG.boleslausChargeChance <= 0.5, 'the lance charge must be rare: boleslausChargeChance is at most 0.5');
assert.ok(CFG.boleslausSwordDamage < CFG.kingMaxHp && CFG.boleslausRollDamage < CFG.kingMaxHp && CFG.boleslausChargeDamage < CFG.kingMaxHp, 'one of Boleslaus\'s attacks must not kill Wenceslas from full health');
assert.ok(CFG.boleslausArc < Math.PI, 'boleslausArc is in radians each side of the aim; over 3.14 and the blow wraps all the way round');
assert.ok(CFG.boleslausGuardAggro > CFG.boleslausPostRadius, 'the guards must notice Wenceslas before he is in the middle of them: boleslausGuardAggro has to be more than boleslausPostRadius');
assert.ok(CFG.nicholasWalkSpeed < CFG.kingSpeed, 'St Nicholas must drift more slowly than Wenceslas walks, or he could never be caught');
assert.ok(CFG.nicholasKeepNear < CFG.nicholasKeepFar, 'St Nicholas backs away from closer than nicholasKeepNear and drifts closer from beyond nicholasKeepFar, so the near distance has to be the smaller');
assert.ok(CFG.ghostSpeed > 2 * CFG.kingSpeed, 'a launched ghost must be fast: over twice Wenceslas\'s speed (ghostSpeed)');
assert.ok(CFG.ghostLock < CFG.ghostWarn, 'ghostLock is the end part of a ghost\'s warning, so it has to be shorter than ghostWarn');
assert.ok(CFG.nicholasIceGap > CFG.kingInvuln, 'the gap between the two ice strikes (nicholasIceGap) must be longer than Wenceslas\'s invulnerability after a hit (kingInvuln), or standing in a zone the whole time would cost one hit instead of two');
assert.ok(CFG.nicholasIceShare > 0 && CFG.nicholasIceShare <= 0.6, 'the ice zones cover about half the field: nicholasIceShare is at most 0.6, or there is nowhere safe to stand');
assert.ok(CFG.nicholasIceWarn >= 1.0, 'the ice zones must warn for at least a second (nicholasIceWarn) so Wenceslas can leave them');
assert.ok(CFG.nicholasCloseRadius < CFG.nicholasThunderRadius, 'the lightning ring (nicholasThunderRadius) must be bigger than the close radius that sets it off (nicholasCloseRadius), so that someone who has been close is inside it');
assert.ok(CFG.nicholasThunderWarn >= 1.0, 'the lightning must warn for at least a second (nicholasThunderWarn)');
assert.ok(CFG.nicholasMaxSkeletons >= CFG.nicholasSkeletons && CFG.nicholasMaxGhosts >= CFG.nicholasGhosts, 'the limits on the dead (nicholasMaxSkeletons, nicholasMaxGhosts) must allow at least one raising');
assert.ok(CFG.ghostDamage < CFG.kingMaxHp && CFG.nicholasIceDamage < CFG.kingMaxHp && CFG.nicholasThunderDamage < CFG.kingMaxHp, 'one of St Nicholas\'s attacks must not kill Wenceslas from full health');
assert.ok(CFG.archerKeepAway < CFG.archerRange, 'archers back away from closer than archerKeepAway, so it has to be less than archerRange');

// What the curves give for every night
let lastFood = 0;
for (let n = 1; n <= NIGHTS; n++) {
  const p = nightParams(n);
  for (const [k, v] of Object.entries(p)) {
    assert.ok(Number.isFinite(v) && v >= 0, `night ${n}: ${k} came out as ${v}`);
  }
  for (const k of ['foodTarget', 'maxRobbers', 'maxWanderingPages', 'maxFood', 'maxWolves', 'maxArchers', 'bossNo']) {
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
