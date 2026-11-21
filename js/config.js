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
export const WOLVES_FROM = 3; // first night with wolves

// Per-night difficulty. n runs from 1 to 12.
/** @param {number} n */
export function nightParams(n) {
  return {
    foodTarget: 2 + n,                          // 3 .. 14
    maxRobbers: Math.min(1 + Math.floor(n * 0.75), 10),
    robberInterval: Math.max(1.6, 7 - n * 0.45),
    firstRobber: Math.max(2.5, 7 - n * 0.4),
    toughRobberChance: Math.max(0, (n - 5) * 0.1), // 2-hit robbers from night 6
    maxWanderingPages: 2 + Math.floor(n / 4),
    pageInterval: 4,
    maxFood: 3 + Math.floor(n / 4),
    foodInterval: 2.5,
    maxWolves: n < WOLVES_FROM ? 0 : Math.min(1 + Math.floor((n - WOLVES_FROM) / 3), 4), // 1 .. 4
    wolfInterval: Math.max(6, 16 - n),
    firstWolf: Math.max(8, 20 - n),
  };
}

/** @param {number} foodTarget */
export function parTime(foodTarget) {
  return CFG.parBase + CFG.parPerFood * foodTarget;
}
