// Fixed settings, and the calculations built on the numbers in tuning.js.
// To change how the game plays, edit tuning.js, not this file.

import { CFG, NIGHTS, NIGHT_OFFSET, FOOD_NEEDED, CURVES } from './tuning.js';

export { CFG, NIGHTS, NIGHT_OFFSET };

// The screen. These aren't gameplay settings: the art is drawn for exactly this size.
export const W = 640;
export const H = 360;
export const HUD_H = 16; // the top of the play area: the status text is drawn over the ground above it

export const WOLVES_FROM = CURVES.wolves.firstNight;
export const ARCHERS_FROM = CURVES.archers.firstNight;

/** value = start - shrinkPerLevel * level, never below min @param {{ start: number, shrinkPerLevel: number, min: number }} c @param {number} level */
const shrinking = (c, level) => Math.max(c.min, c.start - c.shrinkPerLevel * level);

/**
 * How many of a group may be on screen on night n: none before firstNight, then one, plus one more
 * every nightsPerExtra nights, up to `most`.
 * @param {{ firstNight: number, nightsPerExtra: number, most: number }} c @param {number} n
 */
const groupSize = (c, n) => (n < c.firstNight ? 0 : Math.min(1 + Math.floor((n - c.firstNight) / c.nightsPerExtra), c.most));

// What a night is like. n is the night, 1 to NIGHTS; the curves run on level = n + NIGHT_OFFSET.
/** @param {number} n */
export function nightParams(n) {
  const lv = n + NIGHT_OFFSET;
  const { robbers, pages, foodOnGround, wolves, archers, boss } = CURVES;
  const lastStep = Math.max(1, NIGHTS - 1);
  return {
    foodTarget: Math.max(1, Math.round(FOOD_NEEDED.firstNight + ((FOOD_NEEDED.lastNight - FOOD_NEEDED.firstNight) * (n - 1)) / lastStep)),
    maxRobbers: Math.min(Math.floor(robbers.atOnce.start + robbers.atOnce.perLevel * lv), robbers.atOnce.max),
    robberInterval: shrinking(robbers.gap, lv),
    firstRobber: shrinking(robbers.firstDelay, lv),
    toughRobberChance: Math.max(0, (lv - robbers.toughAfterLevel) * robbers.toughChancePerLevel),
    maxWanderingPages: pages.wanderingBase + Math.floor(lv / pages.levelsPerExtra),
    pageInterval: pages.gap,
    maxFood: foodOnGround.base + Math.floor(lv / foodOnGround.levelsPerExtra),
    foodInterval: foodOnGround.gap,
    maxWolves: groupSize(wolves, n),
    wolfInterval: shrinking(wolves.gap, lv),
    firstWolf: shrinking(wolves.firstDelay, lv),
    maxArchers: groupSize(archers, n),
    archerInterval: shrinking(archers.gap, lv),
    firstArcher: shrinking(archers.firstDelay, lv),
    bossNo: n % boss.everyNights === 0 ? n / boss.everyNights : 0,   // 1 for the first boss night, 2 for the next... 0 for none
  };
}

// Par time for a night. A boss night's fight is on top of the food.
/** @param {number} foodTarget @param {number} [bossNo]  from nightParams; 0 for no boss */
export function parTime(foodTarget, bossNo = 0) {
  return CFG.parBase + CFG.parPerFood * foodTarget + (bossNo > 0 ? CFG.parBoss : 0);
}

// Which boss a boss night has, and which time that boss has come (1 the first time, 2 the next...), so each
// repeat can be a little tougher. bossNo is from nightParams: 1 for the first boss night, 2 for the next.
/** @param {number} bossNo @returns {{ kind: 'frosty' | 'mary', nth: number }} */
export function bossInfo(bossNo) {
  const every = CURVES.boss.maryEvery;
  const marys = every > 0 ? Math.floor(bossNo / every) : 0;
  if (every > 0 && bossNo > 0 && bossNo % every === 0) return { kind: 'mary', nth: marys };
  return { kind: 'frosty', nth: Math.max(1, bossNo - marys) };
}

// How tough Frosty is the nth time he comes (1 is the first), each a little more than the one before.
/** @param {number} nth */
export function frostyStats(nth) {
  const k = Math.max(0, nth - 1);
  return {
    hp: CFG.frostyHp + CFG.frostyHpStep * k,
    rollSpeed: CFG.frostyRollSpeed + CFG.frostyRollSpeedStep * k,
    rest: Math.max(0.6, CFG.frostyRest - CFG.frostyRestStep * k),
    telegraph: Math.max(0.5, CFG.frostyTelegraph - CFG.frostyTelegraphStep * k),
  };
}

// The same for Mary.
/** @param {number} nth */
export function maryStats(nth) {
  const k = Math.max(0, nth - 1);
  return {
    hp: CFG.maryHp + CFG.maryHpStep * k,
    rest: Math.max(0.8, CFG.maryRest - CFG.maryRestStep * k),
    telegraph: Math.max(0.5, CFG.maryTelegraph - CFG.maryTelegraphStep * k),
    ballSpeed: CFG.maryBallSpeedStep * k,   // added to the speed of every snowball
  };
}
