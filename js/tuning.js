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
  boss: {
    everyNights: 3,            // every this-many nights ends with a boss fight (3, 6, 9, 12)
    order: [0, 1, 2, 3],       // which boss on each boss night, in turn, starting again after the last: 0 Frosty, 1 Mary,
                               // 2 Prince Boleslaus, 3 St Nicholas. [0, 1, 2, 3] gives each once, St Nicholas last.
  },
};


// ============================================================================
//  3. CFG: speeds, health, damage and timings
// ============================================================================

export const CFG = {
  // ---- Wenceslas ----
  kingSpeed: 85,
  kingMaxHp: 5,
  kingInvuln: 0.8,          // seconds he can't be hurt again after a hit
  hpRestoreBetweenNights: 1,   // health points given back after each night (never above his maximum)

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

  // ---- Mary, the second boss ----
  // Her ice block rises out of the ground and splits, and she cycles: warning lines (aim), one of three
  // attacks (a shotgun blast of snowballs, a spiral while she spins, a ring that bursts outward), then a rest,
  // which is the only time she can be hurt. She trudges toward Wenceslas while she rests. When she is beaten
  // she is frozen back into a block, which sinks into the ground. Each later appearance is a little tougher.
  maryHp: 12,               // sword hits to kill her, the first time
  maryHpStep: 1,            // more health each later time
  maryRadius: 9,            // how big she is, for the sword
  maryRise: 2.4,            // seconds her ice block takes to rise (she can't be hurt yet)
  marySplit: 1.3,           // seconds it takes to split open (still can't be hurt). Her arrival stinger is 5.3 s: rise + split + the
                            // first warning (maryTelegraph) is meant to come out about as long, so the boss theme starts as she first attacks.
  maryTelegraph: 1.0,       // seconds the warning lines show before an attack
  maryTelegraphStep: 0.05,  // shorter by this much each later time
  maryLockTime: 0.3,        // the blast stops following Wenceslas this long before it fires
  maryRest: 1.8,            // seconds she rests after an attack: the time to hit her
  maryRestStep: 0.1,        // shorter by this much each later time
  marySpeed: 26,            // trudging toward Wenceslas while she rests. Keep this well under kingSpeed (85).
  maryStopDistance: 55,     // she stops walking this close to him
  // the blast: a wide fan of snowballs, fired as a volley or two
  maryBlastBalls: 9,        // snowballs in a volley
  maryBlastSpread: 0.55,    // radians either side of the aim: the fan is twice this wide (0.55 is about 63 degrees each way)
  maryBlastSpeed: 150,
  maryBlastVolleys: 2,
  maryVolleyGap: 0.4,       // seconds between volleys
  // the spiral: she stands and spins, firing a snowball every interval from each arm
  marySpiralTime: 2.0,      // seconds she spins
  marySpiralSpin: 4.2,      // radians a second
  marySpiralInterval: 0.07,
  marySpiralArms: 2,
  marySpiralSpeed: 115,
  // the ring: snowballs in every direction at once, in waves
  maryRingBalls: 16,
  maryRingWaves: 2,         // each wave is turned half a gap from the one before, so you must move to the gaps
  maryRingGap: 0.55,        // seconds between waves
  maryRingSpeed: 105,
  maryBallSpeedStep: 8,     // all her snowballs are faster by this much each later time
  maryDeathFreeze: 0.9,     // seconds the ice grows over her when she falls
  maryDeathHold: 0.6,       // seconds she is held frozen
  maryDeathSink: 1.5,       // seconds the block takes to sink into the ground; then the night ends
  snowballLife: 3.5,        // most seconds a snowball flies
  snowballDamage: 1,

  // ---- Prince Boleslaus of Bohemia, the third boss ----
  // He walks at Wenceslas, and can be hit whenever he is on foot. He swings his sword (a long, heavy telegraph:
  // dart in, hit him, dart out), or rolls at you like Frosty, or rarely charges with a lance, faster than the
  // roll. Only the roll and the charge cannot be hit. Three guards (robbers) stay close to him.
  boleslausHp: 16,          // sword hits to kill him
  boleslausHpStep: 1,       // more health each later time
  boleslausRadius: 10,      // how big he is, for the sword
  boleslausWalkSpeed: 62,   // walking at Wenceslas, and in from the edge. Keep this under kingSpeed (85) so you can duck out.
  boleslausThinkMin: 0.5,   // how long he walks on between one attack and deciding the next
  boleslausThinkMax: 1.1,
  boleslausFarDistance: 130, // farther away than this he rolls or charges instead of walking up to swing
  // the sword
  boleslausWindup: 1.2,     // seconds with the sword raised (the telegraph; the fan on the ground shows where it will fall)
  boleslausLockTime: 0.35,  // he stops tracking Wenceslas this long before the blow, so a late sidestep works
  boleslausSwing: 0.18,     // the blow itself
  boleslausRecover: 0.9,    // seconds after a blow before he does anything
  boleslausReach: 80,       // how far the blow reaches from him. Keep it past Wenceslas's own reach (swingRange 60 plus his
                            // size) so that being near enough to hit him means being near enough to be hit: you must duck out.
  boleslausArc: 0.9,        // radians either side of where he aims (0.9 is a fan about 100 degrees wide)
  boleslausSwordDamage: 2,
  // the roll, like Frosty's
  boleslausRollTelegraph: 0.9,
  boleslausRollSpeed: 190,
  boleslausRollDistance: 280,
  boleslausRollDamage: 2,   // (a page has 2 health, so it dies)
  boleslausRollRest: 1.6,   // winded after a roll
  // the lance charge
  boleslausChargeChance: 0.15, // the share of his long-range attacks that are a charge: rare
  boleslausChargeTelegraph: 1.3,
  boleslausChargeSpeed: 330, // faster than the roll
  boleslausChargeDistance: 520,
  boleslausChargeDamage: 3,
  boleslausChargeRest: 2.0, // winded after a charge
  boleslausCrashBonus: 0.5, // extra rest if he crashes into scenery or the edge of the screen
  // his guards: robbers (the same club, speed and hit points) that stay by him until Wenceslas gets close
  boleslausGuards: 3,
  boleslausPostRadius: 48,  // how far from him they loiter
  boleslausGuardAggro: 70,  // they go for Wenceslas when he is this close to them or to Boleslaus
  // when he falls: stagger, kneel, topple, lie still, then the night ends
  boleslausDeathStagger: 0.8,
  boleslausDeathKneel: 0.6,
  boleslausDeathFall: 0.5,
  boleslausDeathLie: 0.7,

  // ---- St Nicholas, the fourth and final boss ----
  // He appears, then drifts at a distance and can be hit whenever he is there. Every so often he raises the dead
  // (skeletons, which are robbers, and ghosts, which warn and then launch at Wenceslas) or calls down an ice
  // barrage on about half the field (it strikes twice). If Wenceslas stays close to him too long, a ring of
  // warning signs forms round him and lightning strikes everything inside it.
  nicholasHp: 20,           // sword hits to kill him
  nicholasHpStep: 1,        // more health each later time
  nicholasRadius: 12,       // how big he is, for the sword
  nicholasAppear: 3.5,      // seconds he takes to appear, in a golden light (he can't be hit yet). His arrival stinger is 5.7 s:
                            // this plus his first think (nicholasThinkMin to Max) comes out about as long, so the theme starts as he first acts.
  nicholasWalkSpeed: 30,    // drifting to keep his distance. Keep this well under kingSpeed (85).
  nicholasKeepNear: 90,     // he backs away when Wenceslas is closer than this...
  nicholasKeepFar: 150,     // ...and drifts closer when he is farther than this
  nicholasThinkMin: 1.2,    // seconds he drifts between one cast and the next
  nicholasThinkMax: 2.0,
  // raising the dead
  nicholasRaiseCast: 1.0,   // seconds of casting, with circles on the ground where the dead will rise
  nicholasSkeletons: 3,     // raised each time
  nicholasGhosts: 2,
  nicholasMaxSkeletons: 6,  // he won't raise the dead while that would take either past its limit
  nicholasMaxGhosts: 3,
  nicholasRise: 0.8,        // seconds a skeleton takes to climb out of the ground (it can't be hit or act yet)
  nicholasRaiseRadiusMin: 55,  // skeletons rise this far from him, at least...
  nicholasRaiseRadiusMax: 115, // ...and at most
  ghostWarn: 0.9,           // seconds a ghost shakes and glares (the warning) before it launches
  ghostLock: 0.3,           // it stops following Wenceslas this long before it launches, so a sidestep works
  ghostSpeed: 250,          // the launch: fast. Over twice kingSpeed.
  ghostDamage: 2,           // (it flattens a page too)
  ghostRadius: 6,           // how big it is, for touching Wenceslas and pages
  ghostRange: 900,          // the farthest a ghost flies before it fades
  // the ice barrage
  nicholasIceCast: 0.8,     // seconds of casting before the zones show
  nicholasIceCols: 8,       // the field is a grid this many cells across...
  nicholasIceRows: 4,       // ...and this many down
  nicholasIceShare: 0.5,    // the share of cells that are zones, for a scatter (a checkerboard or alternate columns is exactly half)
  nicholasIceWarn: 1.2,     // seconds the zones warn before they first strike
  nicholasIceGap: 1.0,      // seconds between the two strikes. Longer than kingInvuln, so staying in a zone for both costs two hits.
  nicholasIceLinger: 0.4,   // seconds the zones stay after the second strike
  nicholasIceDamage: 1,     // each strike
  // lightning for staying too close
  nicholasCloseRadius: 70,  // Wenceslas this close to him fills the closeness timer...
  nicholasCloseTime: 3.0,   // ...and at this many seconds the lightning comes
  nicholasCloseDrain: 1.5,  // the timer empties this many times faster than it fills when Wenceslas is not close
  nicholasThunderRadius: 95, // the ring of warning signs, and the lightning inside it
  nicholasThunderWarn: 1.3,
  nicholasThunderDamage: 2,
  nicholasThunderCooldown: 5.0, // before it can come again
  nicholasDeathTime: 3.2,   // seconds he takes to rise into the light and fade, before the night ends

  // ---- Bosses ----
  // Frosty, a giant snowman, ends every boss night. After the last food is delivered he lumbers in, then
  // repeats: aim (telegraph) -> roll in a straight line -> rest (dizzy: the only time he can be hurt).
  // Each later boss night he is a little tougher, by the amounts below.
  frostyHp: 10,             // sword hits to kill him, on the first boss night
  frostyHpStep: 1,          // more health on each later boss night
  frostyRadius: 13,         // how big he is, for touching Wenceslas, pages and scenery
  frostyWalkSpeed: 45,      // lumbering in from the edge of the screen
  frostyTelegraph: 1.0,     // seconds he leans back and shakes before a roll
  frostyTelegraphStep: 0.05,   // shorter by this much on each later boss night
  frostyLockTime: 0.3,      // he stops tracking Wenceslas this long before the roll starts, so a sidestep works
  frostyRollSpeed: 210,     // faster than Wenceslas (85): you dodge it, you can't outrun it
  frostyRollSpeedStep: 10,  // faster by this much on each later boss night
  frostyRollDistance: 300,  // how far a roll goes if nothing stops it
  frostyRest: 1.25,         // seconds dizzy after a roll: room for 2 or 3 sword swings
  frostyRestStep: 0.1,      // shorter by this much on each later boss night
  frostyCrashBonus: 0.5,    // extra dizzy time if he crashes into a tree, rock or wall
  frostyDeathTime: 3.0,     // seconds he spends bursting into snowballs when he dies, before the night ends
  frostyDamage: 2,          // rolling over Wenceslas. (A page has 2 health, so it dies.)

  // ---- Hard mode ----
  hardSpeedMul: 1.35,       // enemies are this many times faster

  // ---- Scoring ----
  pointsFood: 100,          // per item delivered
  pointsKill: 25,           // per enemy killed
  pointsBoss: 200,          // extra for killing a boss
  parBase: 30,              // a night's par time is parBase + parPerFood * (food needed), in seconds
  parPerFood: 10,
  parBoss: 30,              // extra par time on a boss night, for the fight
  pointsPerSecondUnderPar: 10, // the time bonus
  hardPointsMul: 2,         // hard mode doubles all points
};
