// ============================================================================
//  THE GAME'S TUNING KNOBS
//
//  Every number that changes how the game plays is in this one file. Edit a
//  number, save, and reload the page. Nothing else needs touching.
//
//  Units: distances are in pixels (the screen is 640 x 360), times are in
//  seconds, speeds are pixels per second, and "damage" is hit points.
//
//  After changing things, run   npm test   to check you haven't broken
//  anything. It will name the number that's wrong if something is out of range.
//  A few checks are about design intent, for example that archers stay slower
//  than Wenceslas so he can run them down. Change those on purpose, not by accident.
//
//  The file has three parts:
//    1. THE NIGHTS    how many there are, and how much food each one needs
//    2. THE CURVES    how enemies and supplies build up from night to night
//    3. CFG           the speeds, health, damage and timings of everything
// ============================================================================


// ============================================================================
//  1. THE NIGHTS
// ============================================================================

export const NIGHTS = 12;          // how many nights make a game. After the last, the partridge appears.

// Food the old man needs each night. The first night asks for `firstNight`, the last for
// `lastNight`, and the nights in between rise evenly, rounded to whole items.
export const FOOD_NEEDED = { firstNight: 5, lastNight: 8 };

// Night 1 plays like the curves' "level 3", night 2 like level 4, and so on: the level of a night
// is its number plus this. Raise it to make every night harder, lower it for gentler ones.
// (It only affects the curves in part 2, not the food needed above.)
export const NIGHT_OFFSET = 2;


// ============================================================================
//  2. THE CURVES
//
//  Most are written as "start" and "perLevel", meaning
//      value = start - shrinkPerLevel * level      (gaps and delays get shorter)
//  and then held between a `min` (or `max`) so they never go past it.
//  level = night number + NIGHT_OFFSET.
// ============================================================================

export const CURVES = {
  robbers: {
    atOnce:     { start: 1, perLevel: 0.75, max: 10 },        // most robbers on screen at once
    gap:        { start: 7, shrinkPerLevel: 0.45, min: 1.6 }, // seconds between new robbers
    firstDelay: { start: 7, shrinkPerLevel: 0.4,  min: 2.5 }, // seconds before the first one of the night
    toughAfterLevel: 5,        // robbers can take two hits from the level after this one...
    toughChancePerLevel: 0.1,  // ...and each level adds this much chance (0.1 = 10%)
  },
  pages: {
    wanderingBase: 2,          // pages looking for someone to follow, at the start
    levelsPerExtra: 4,         // one more page for every this-many levels
    gap: 4,                    // seconds between new pages arriving
  },
  foodOnGround: {
    base: 3,                   // food items lying about at once, at the start
    levelsPerExtra: 4,         // one more for every this-many levels
    gap: 2.5,                  // seconds between new food appearing
  },
  wolves: {
    firstNight: 1,             // the first night with wolves
    nightsPerExtra: 3,         // one more wolf at once for every this-many nights after that
    most: 4,                   // never more than this many at once
    gap:        { start: 16, shrinkPerLevel: 1, min: 6 },     // seconds between new wolves
    firstDelay: { start: 20, shrinkPerLevel: 1, min: 8 },     // seconds before the first wolf
  },
  archers: {
    firstNight: 3,             // the first night with archers
    nightsPerExtra: 3,         // one more archer at once for every this-many nights after that
    most: 3,                   // never more than this many at once
    gap:        { start: 20, shrinkPerLevel: 1, min: 8 },     // seconds between new archers
    firstDelay: { start: 24, shrinkPerLevel: 1, min: 9 },     // seconds before the first archer
  },
};


// ============================================================================
//  3. CFG: speeds, health, damage and timings
// ============================================================================

export const CFG = {
  // ---- Wenceslas ----
  kingSpeed: 85,
  kingMaxHp: 10,
  kingInvuln: 0.8,          // seconds he can't be hurt again after a hit
  hpRestoreBetweenNights: 0.5, // fraction of his health given back after each night (0.5 = half)

  // ---- The sword ----
  swingCooldown: 0.4,       // seconds between swings
  swingDuration: 0.14,      // how long a swing lasts
  swingRange: 60,           // how far a blow REALLY reaches from his hand
  swingDrawnRadius: 30,     // how far the arc is DRAWN. Keep it smaller than swingRange and the sword hits
                            // further than it looks. Set it equal to swingRange for an honest arc.
  swingHalfArc: 1.25,       // radians either side of where he aims (1.25 is about 70 degrees)
  swingBuffer: 0.12,        // a click this close to the end of the cooldown is remembered
  swingKnockback: 170,      // how hard a hit pushes an enemy back
  autoAimRange: 90,         // a touch tap turns the sword toward the nearest enemy this close

  // ---- Pages ----
  pageMaxHp: 2,
  pageWanderSpeed: 22,      // while looking for someone to follow
  pageFollowSpeed: 115,     // keep this above kingSpeed or the line can't keep up
  pageSpacing: 13,          // distance between people in the line
  pageInvuln: 0.5,          // seconds a page can't be hurt again after a hit
  recruitRadius: 12,        // how close he has to get to recruit a page

  // ---- Food ----
  pickupRadius: 11,         // how close he or a page has to get to pick it up
  deliverRadius: 24,        // how close he has to get to the old man to hand it over
  deliverInterval: 0.18,    // seconds between each item handed over
  dropPickupDelay: 0.6,     // food dropped by a dead page or wolf can't be picked up for this long

  // ---- Robbers (club) ----
  robberSpeed: 50,
  robberAggroRadius: 55,    // they switch from the pages to Wenceslas when he's this close
  robberWindup: 0.35,       // the red "!" warning before a blow lands
  robberAttackCooldown: 1.0,
  robberDamage: 1,

  // ---- Wolves: they come for food, not for people ----
  wolfRunSpeed: 150,        // closing in on a page, or arriving from the edge
  wolfCircleSpeed: 95,      // prowling round Wenceslas while nobody carries food
  wolfFleeSpeed: 125,       // running off with stolen food
  wolfCircleRadius: 62,     // how far from him they prowl
  wolfLeapRange: 34,        // they crouch this close to the page they're after
  wolfCrouch: 0.3,          // warning before the leap
  wolfLeapTime: 0.28,
  wolfRecover: 0.45,        // pause after a leap that misses
  wolfBite: 1,              // damage to the page they steal from

  // ---- Archers: they keep their distance and shoot at Wenceslas only ----
  archerSpeed: 40,          // walking up to shooting range
  archerRetreatSpeed: 34,   // backing away when he gets close. Keep this well under kingSpeed (85) so he can run them down.
  archerRange: 150,         // they walk toward him until this close, then shoot
  archerKeepAway: 70,       // they back away when he is closer than this
  archerDraw: 0.8,          // bow drawn (the warning, and they can't move) before each shot
  archerCooldown: 2.2,      // between one shot and starting the next draw
  archerSpread: 0.22,       // random aiming error, radians either side. Bigger is less accurate.
                            // About +-33 pixels at 150 pixels range; 0 would be a perfect shot.
  arrowSpeed: 190,
  arrowLife: 2.5,           // most seconds an arrow flies
  arrowDamage: 1,
  arrowTreeBlock: 2,        // pixels beyond a tree's trunk at which it stops an arrow

  // ---- Hard mode ----
  hardSpeedMul: 1.35,       // enemies are this many times faster

  // ---- Scoring ----
  pointsFood: 100,          // per item delivered
  pointsKill: 25,           // per enemy killed
  parBase: 30,              // a night's par time is parBase + parPerFood * (food needed), in seconds
  parPerFood: 10,
  pointsPerSecondUnderPar: 10, // the time bonus
  hardPointsMul: 2,         // hard mode doubles all points
};
