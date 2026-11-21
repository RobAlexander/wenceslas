// Tunable values. Starting points from the brief; tune in playtesting.

export const W = 640;
export const H = 360;
export const HUD_H = 14; // height of the status strip at the top

export const CFG = {
  // Wenceslas
  kingSpeed: 85,
  kingMaxHp: 10,
  kingInvuln: 0.8,          // seconds of invulnerability after a hit
  hpRestoreBetweenNights: 0.5, // fraction of max HP restored after each night

  // Sword
  swingCooldown: 0.4,
  swingDuration: 0.14,
  swingRange: 30,           // reach from the hand, in pixels
  swingHalfArc: 1.25,       // radians either side of the aim direction
  swingBuffer: 0.12,        // a click this close to the end of the cooldown is remembered
  swingKnockback: 170,
  autoAimRange: 90,         // a touch tap turns the sword toward the nearest robber this close

  // Pages
  pageMaxHp: 2,
  pageWanderSpeed: 22,
  pageFollowSpeed: 115,     // faster than the king so the line keeps up
  pageSpacing: 13,          // distance between people in the line
  pageInvuln: 0.5,
  recruitRadius: 12,

  // Food
  pickupRadius: 11,
  deliverRadius: 24,
  deliverInterval: 0.18,    // pages hand over food one at a time
  dropPickupDelay: 0.6,

  // Robbers
  robberSpeed: 50,
  robberAggroRadius: 55,    // they switch to Wenceslas when he's this close
  robberWindup: 0.35,       // telegraph before a blow lands
  robberAttackCooldown: 1.0,
  robberDamage: 1,

  // Wolves: they come for food, not for people
  wolfRunSpeed: 150,        // closing in on a page, or arriving from the edge
  wolfCircleSpeed: 95,      // prowling round Wenceslas while nobody carries food
  wolfFleeSpeed: 125,       // running off with stolen food
  wolfCircleRadius: 62,     // average distance of the prowl from Wenceslas
  wolfLeapRange: 34,        // starts its crouch this close to the page
  wolfCrouch: 0.3,          // telegraph before the leap
  wolfLeapTime: 0.28,
  wolfRecover: 0.45,        // pause after a leap that misses
  wolfBite: 1,              // damage to the page it steals from

  // Hard mode
  hardSpeedMul: 1.35,

  // Scoring
  pointsFood: 100,
  pointsKill: 25,
  parBase: 30,
  parPerFood: 10,
  pointsPerSecondUnderPar: 10,
  hardPointsMul: 2,
};

export const NIGHTS = 12;

// The difficulty table below was written for a game that opened gently. The first
// nights proved too easy, so night 1 now plays like the table's level 3, night 2 like
// level 4, and so on: the table is read NIGHT_OFFSET levels ahead of the night number.
export const NIGHT_OFFSET = 2;

const WOLVES_FROM_LEVEL = 3;
export const WOLVES_FROM = Math.max(1, WOLVES_FROM_LEVEL - NIGHT_OFFSET); // first night with wolves

// Per-night difficulty. n is the night, 1 to NIGHTS; the table runs on level = n + NIGHT_OFFSET.
/** @param {number} n */
export function nightParams(n) {
  const lv = n + NIGHT_OFFSET;
  return {
    foodTarget: 2 + lv,                          // 5 .. 16
    maxRobbers: Math.min(1 + Math.floor(lv * 0.75), 10),
    robberInterval: Math.max(1.6, 7 - lv * 0.45),
    firstRobber: Math.max(2.5, 7 - lv * 0.4),
    toughRobberChance: Math.max(0, (lv - 5) * 0.1), // 2-hit robbers from level 6
    maxWanderingPages: 2 + Math.floor(lv / 4),
    pageInterval: 4,
    maxFood: 3 + Math.floor(lv / 4),
    foodInterval: 2.5,
    maxWolves: lv < WOLVES_FROM_LEVEL ? 0 : Math.min(1 + Math.floor((lv - WOLVES_FROM_LEVEL) / 3), 4), // 1 .. 4
    wolfInterval: Math.max(6, 16 - lv),
    firstWolf: Math.max(8, 20 - lv),
  };
}

/** @param {number} foodTarget */
export function parTime(foodTarget) {
  return CFG.parBase + CFG.parPerFood * foodTarget;
}
