// Game logic for a single night. No drawing, no DOM.

import { W, H, HUD_H, CFG, nightParams, frostyStats } from './config.js';
import { FOOD_KINDS } from './sprites.js';

/** @typedef {import('./rng.js').Rng} Rng */
/** @typedef {{ x: number, y: number }} Point */

/**
 * What the player is doing this step, from input.js.
 * @typedef {object} GameInput
 * @property {number} mx          move vector (length up to 1)
 * @property {number} my
 * @property {boolean} swing
 * @property {boolean} [autoAim]  a touch tap: turn toward the nearest enemy first
 * @property {number} [ax]        aim point (mouse)...
 * @property {number} [ay]
 * @property {number} [aimAngle]  ...or aim direction (touch, gamepad)
 */

/**
 * @typedef {object} King
 * @property {number} id
 * @property {number} x
 * @property {number} y
 * @property {number} r
 * @property {number} hp
 * @property {number} aim        radians
 * @property {number} swingT     time left in the current swing
 * @property {number} swingAngle
 * @property {number} cd         swing cooldown left
 * @property {number} inv        invulnerability left
 * @property {number} walkT
 * @property {boolean} moving
 * @property {number} kbx        knockback velocity
 * @property {number} kby
 * @property {number} face       1 right, -1 left
 * @property {Set<number>} hit   ids already struck by the current swing
 * @property {boolean} [god]     dev console: takes no damage
 */

/**
 * @typedef {object} Page
 * @property {number} id
 * @property {number} x
 * @property {number} y
 * @property {number} r
 * @property {number} hp
 * @property {'wander' | 'follow'} state
 * @property {Point} target      where a wandering page is heading
 * @property {number} wanderT
 * @property {string | null} food
 * @property {number} vx
 * @property {number} vy
 * @property {number} inv
 * @property {number} flash
 * @property {number} walkT
 * @property {number} face
 * @property {number} side       which way to go round obstacles
 * @property {boolean} entered   has come onto the screen
 */

/**
 * @typedef {object} Robber
 * @property {number} id
 * @property {'robber'} kind
 * @property {number} x
 * @property {number} y
 * @property {number} r
 * @property {number} hp
 * @property {number} maxHp
 * @property {King | Page | null} target
 * @property {number} retarget
 * @property {number} windup     telegraph time left before a blow
 * @property {number} atkCd
 * @property {number} stun
 * @property {number} flash
 * @property {number} kbx
 * @property {number} kby
 * @property {number} walkT
 * @property {number} face
 * @property {number} side
 */

/** @typedef {'circle' | 'hunt' | 'crouch' | 'leap' | 'recover' | 'flee'} WolfState */

/**
 * @typedef {object} Wolf
 * @property {number} id
 * @property {'wolf'} kind
 * @property {number} x
 * @property {number} y
 * @property {number} r
 * @property {number} hp
 * @property {number} maxHp
 * @property {WolfState} state
 * @property {number} t          time left in a timed state (crouch, leap, recover)
 * @property {Page | null} target
 * @property {number} retarget
 * @property {number} vx         leap velocity
 * @property {number} vy
 * @property {number} z          height in the air while leaping
 * @property {string | null} food
 * @property {Point | null} exit where it's running to with stolen food
 * @property {number} stun
 * @property {number} flash
 * @property {number} kbx
 * @property {number} kby
 * @property {number} walkT
 * @property {number} face
 * @property {number} side
 * @property {boolean} entered
 * @property {number} orbit      angle round Wenceslas while circling
 * @property {number} dir        1 or -1: which way it circles
 * @property {number} phase      offsets the wobble of its circle
 */

/** @typedef {'move' | 'draw'} ArcherState  move: walk or stand (also while cooling down); draw: bow drawn, rooted */

/**
 * @typedef {object} Archer
 * @property {number} id
 * @property {'archer'} kind
 * @property {number} x
 * @property {number} y
 * @property {number} r
 * @property {number} hp
 * @property {number} maxHp
 * @property {ArcherState} state
 * @property {number} t          time left drawing the bow
 * @property {number} cd         time left before it may draw again
 * @property {number} aim        radians, toward Wenceslas while drawing (for the sprite)
 * @property {number} stun
 * @property {number} flash
 * @property {number} kbx
 * @property {number} kby
 * @property {number} walkT
 * @property {number} face
 * @property {number} side
 * @property {boolean} entered   has come onto the screen
 */

/** @typedef {'rise' | 'split' | 'move'} MaryState  rise: the ice block comes up; split: it opens; move: she walks and throws */

/**
 * Mary: an ice block rises out of the ground, splits open, and she follows Wenceslas slowly,
 * throwing snowballs. She can't be hurt until she is out (state 'move').
 * @typedef {object} Mary
 * @property {number} id
 * @property {'mary'} kind
 * @property {number} x
 * @property {number} y
 * @property {number} r
 * @property {number} hp
 * @property {number} maxHp
 * @property {MaryState} state
 * @property {number} t          time left in 'rise' or 'split'
 * @property {number} windup     time left holding a snowball up before throwing it
 * @property {number} cd         time left before she may start another throw
 * @property {number} aim        radians, toward Wenceslas while she holds a snowball up
 * @property {number} stun
 * @property {number} flash
 * @property {number} kbx
 * @property {number} kby
 * @property {number} walkT
 * @property {number} face
 * @property {number} side
 */

/** @typedef {'arrive' | 'aim' | 'roll' | 'rest' | 'dying'} FrostyState  arrive: lumbers in; aim: telegraph; roll: a straight rush; rest: dizzy, the only time he can be hurt; dying: bursting into snowballs */

/**
 * Frosty, the boss of the third night and every third night after it.
 * @typedef {object} Frosty
 * @property {number} id
 * @property {'frosty'} kind
 * @property {number} x
 * @property {number} y
 * @property {number} r
 * @property {number} hp
 * @property {number} maxHp
 * @property {FrostyState} state
 * @property {number} t          time left in 'aim', 'rest' or 'dying'
 * @property {number} dx         where he is facing or rolling, a unit vector
 * @property {number} dy
 * @property {boolean} locked    'aim': has stopped tracking Wenceslas
 * @property {number} rolled     'roll': distance covered so far
 * @property {boolean} crashed   'rest': he got here by hitting scenery
 * @property {number} burst     'dying': how many of the big bursts have gone off
 * @property {number} spin       how far the ball has turned, for drawing
 * @property {number} flash
 * @property {number} walkT
 * @property {number} face
 * @property {{ rollSpeed: number, rest: number, telegraph: number }} stats
 */

/**
 * An arrow in flight, or a snowball (snow: true). x, y are on the ground plane; it is drawn raised, at body height.
 * @typedef {{ id: number, x: number, y: number, vx: number, vy: number, angle: number, life: number, snow?: boolean }} Arrow
 */

/** @typedef {Robber | Wolf | Archer | Mary | Frosty} Foe */

/**
 * @typedef {{ kind: 'tree', x: number, y: number, r: number, size: number, variant: number }
 *   | { kind: 'rock', x: number, y: number, r: number, size: number }
 *   | { kind: 'wall', x: number, y: number, w: number, h: number, size: number }} Obstacle
 */

/** @typedef {{ id: number, x: number, y: number, kind: string, delay: number, pop: number, t: number }} Food */
/** @typedef {{ x: number, y: number, r: number, bob: number }} OldMan */
/** @typedef {{ x: number, y: number, vx: number, vy: number, life: number, color: string }} Particle */
/** @typedef {{ x: number, y: number, text: string, color: string, life: number }} FloatText */
/** A snowball thrown up when Frosty bursts. x, y: on the ground; z: height; big: the larger kind. Only for show.
 * @typedef {{ x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, bounces: number, big: boolean }} Clod */

const TAU = Math.PI * 2;
/** @param {number} v @param {number} a @param {number} b */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** @param {Point} a @param {Point} b */
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/** @param {number} a @param {number} b */
function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
/** @param {Point} e */
const onScreen = (e, m = 0) => e.x > -m && e.x < W + m && e.y > HUD_H - m && e.y < H + m;

// Distance from point to obstacle surface, plus the outward normal.
/** @param {Obstacle} o @param {number} x @param {number} y */
function obsQuery(o, x, y) {
  if (o.kind === 'wall') {
    const hx = o.w / 2, hy = o.h / 2;
    const cx = clamp(x, o.x - hx, o.x + hx);
    const cy = clamp(y, o.y - hy, o.y + hy);
    const dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d === 0) {
      const px = hx - Math.abs(x - o.x), py = hy - Math.abs(y - o.y);
      if (px < py) return { d: -px, nx: Math.sign(x - o.x) || 1, ny: 0 };
      return { d: -py, nx: 0, ny: Math.sign(y - o.y) || 1 };
    }
    return { d, nx: dx / d, ny: dy / d };
  }
  const dx = x - o.x, dy = y - o.y;
  const l = Math.hypot(dx, dy) || 0.001;
  return { d: l - o.r, nx: dx / l, ny: dy / l };
}

let nextId = 1;

export class World {
  /**
   * @param {object} opts
   * @param {number} opts.night
   * @param {boolean} opts.hard
   * @param {Rng} opts.rng
   * @param {string[]} opts.events  receives event names (for sound and tests)
   * @param {number} [opts.kingHp]  health carried over from the last night
   */
  constructor({ night, hard, rng, events, kingHp }) {
    this.night = night;
    this.hard = hard;
    this.rng = rng;
    this.events = events;
    this.p = nightParams(night);
    this.speedMul = hard ? CFG.hardSpeedMul : 1;

    this.time = 0;
    this.delivered = 0;
    this.kills = 0;
    this.done = false;
    this.dead = false;

    /** @type {Obstacle[]} */
    this.obstacles = [];
    /** @type {Page[]} every page, wandering or following */
    this.pages = [];
    /** @type {Page[]} following pages, front first */
    this.line = [];
    /** @type {Robber[]} */
    this.robbers = [];
    /** @type {Wolf[]} */
    this.wolves = [];
    /** @type {Archer[]} */
    this.archers = [];
    /** @type {Mary[]} */
    this.maries = [];
    /** @type {Frosty | null} */
    this.boss = null;
    this.bossStarted = false;   // the boss fight has begun (or is over): nothing else spawns
    this.bossIntro = 0;         // seconds left to show the "boss arrives" banner
    this.bonus = 0;             // points on top of food and kills (a boss)
    /** @type {Arrow[]} arrows and snowballs */
    this.arrows = [];
    /** @type {Food[]} */
    this.foods = [];
    /** @type {Particle[]} */
    this.particles = [];
    /** @type {FloatText[]} */
    this.texts = [];
    /** @type {Clod[]} */
    this.shower = [];
    this.victory = false;   // the boss is dying: nothing can hurt Wenceslas now

    /** @type {King} */
    this.king = {
      id: nextId++, x: W / 2, y: H / 2 + 30, r: 4, hp: kingHp ?? CFG.kingMaxHp,
      aim: 0, swingT: 0, swingAngle: 0, cd: 0, inv: 0, walkT: 0, moving: false,
      kbx: 0, kby: 0, face: 1, hit: new Set(),
    };
    /** @type {Point[]} the king's recent path, newest first; pages follow it */
    this.trail = [{ x: this.king.x, y: this.king.y }];

    this.oldMan = this.placeOldMan();
    this.placeObstacles();

    this.pageTimer = 1.5;
    this.foodTimer = 1;
    this.robberTimer = this.p.firstRobber;
    this.wolfTimer = this.p.firstWolf;
    this.archerTimer = this.p.firstArcher;
    /** @type {number | null} seconds until Mary rises; Infinity if she isn't coming tonight; null until decided */
    this.maryTimer = null;
    this.deliverTimer = 0;

    for (let i = 0; i < 2; i++) this.spawnFood();
    this.spawnPage(true);
  }

  /** @param {string} name */
  emit(name) { this.events.push(name); }

  // ---------- level layout ----------

  // The old man: somewhere well away from the starting spot.
  /** @returns {OldMan} */
  placeOldMan() {
    const { rng, king } = this;
    let x = 0, y = 0;
    for (let i = 0; i < 200; i++) {
      x = rng.range(40, W - 40); y = rng.range(HUD_H + 30, H - 24);
      if (Math.hypot(x - king.x, y - king.y) > 170) break;
    }
    return { x, y, r: 5, bob: 0 };
  }

  placeObstacles() {
    const { rng } = this;
    /** @type {Obstacle['kind'][]} */
    const want = [];
    const nT = rng.int(3, 5), nR = rng.int(2, 3), nW = rng.int(1, 2);
    for (let i = 0; i < nT; i++) want.push('tree');
    for (let i = 0; i < nR; i++) want.push('rock');
    for (let i = 0; i < nW; i++) want.push('wall');
    for (const kind of want) {
      for (let tries = 0; tries < 60; tries++) {
        const x = rng.range(30, W - 30), y = rng.range(HUD_H + 34, H - 18);
        /** @type {Obstacle} */
        let o;
        if (kind === 'tree') o = { kind, x, y, r: 5, size: 12, variant: rng.int(0, 1) };
        else if (kind === 'rock') o = { kind, x, y, r: 7, size: 9 };
        else {
          const horiz = rng() < 0.6;
          const w = horiz ? rng.int(4, 7) * 8 : 8;
          const h = horiz ? 6 : rng.int(4, 6) * 8;
          o = { kind, x, y, w, h, size: Math.max(w, h) / 2 };
        }
        if (this.layoutFree(o)) { this.obstacles.push(o); break; }
      }
    }
  }

  /** @param {Obstacle} o */
  layoutFree(o) {
    if (Math.hypot(o.x - this.king.x, o.y - this.king.y) < o.size + 40) return false;
    if (Math.hypot(o.x - this.oldMan.x, o.y - this.oldMan.y) < o.size + 34) return false;
    for (const p of this.obstacles) {
      if (Math.hypot(o.x - p.x, o.y - p.y) < o.size + p.size + 26) return false;
    }
    return true;
  }

  freeSpot(margin = 20, clearance = 10) {
    for (let i = 0; i < 80; i++) {
      const x = this.rng.range(margin, W - margin), y = this.rng.range(HUD_H + margin, H - margin);
      if (this.obstacles.every((o) => obsQuery(o, x, y).d > clearance)) return { x, y };
    }
    return { x: W / 2, y: H / 2 };
  }

  /** @returns {Point} */
  edgeSpawn() {
    const side = this.rng.int(0, 3), m = 12;
    if (side === 0) return { x: -m, y: this.rng.range(HUD_H + 20, H - 20) };
    if (side === 1) return { x: W + m, y: this.rng.range(HUD_H + 20, H - 20) };
    if (side === 2) return { x: this.rng.range(20, W - 20), y: HUD_H - m };
    return { x: this.rng.range(20, W - 20), y: H + m };
  }

  // A spot just off the edge, preferably well away from the king.
  edgeSpawnAway() {
    let pos = this.edgeSpawn();
    for (let i = 1; i < 10 && dist(pos, this.king) <= 140; i++) pos = this.edgeSpawn();
    return pos;
  }

  // ---------- spawning ----------

  spawnPage(nearby = false) {
    let pos;
    if (nearby) {
      const a = this.rng.range(0, TAU);
      pos = { x: this.king.x + Math.cos(a) * 60, y: clamp(this.king.y + Math.sin(a) * 40, HUD_H + 20, H - 20) };
    } else pos = this.edgeSpawn();
    const target = this.freeSpot(40);
    this.pages.push({
      id: nextId++, x: pos.x, y: pos.y, r: 4, hp: CFG.pageMaxHp, state: 'wander',
      target, wanderT: this.rng.range(2, 4), food: null, vx: 0, vy: 0, inv: 0, flash: 0,
      walkT: 0, face: 1, side: this.rng() < 0.5 ? 1 : -1, entered: nearby,
    });
  }

  /** @param {Point} [at] @param {string} [kind] */
  spawnFood(at, kind, delay = 0) {
    const pos = at || this.freeSpot(24, 8);
    this.foods.push({
      id: nextId++, x: pos.x, y: pos.y, kind: kind || this.rng.pick(FOOD_KINDS),
      delay, pop: at ? 0 : 0.3, t: this.rng.range(0, TAU),
    });
  }

  spawnRobber() {
    const pos = this.edgeSpawnAway();
    const hp = this.rng() < this.p.toughRobberChance ? 2 : 1;
    this.robbers.push({
      id: nextId++, kind: 'robber', x: pos.x, y: pos.y, r: 4, hp, maxHp: hp, target: null, retarget: 0,
      windup: 0, atkCd: 0.5, stun: 0, flash: 0, kbx: 0, kby: 0, walkT: 0, face: 1,
      side: this.rng() < 0.5 ? 1 : -1,
    });
  }

  spawnWolf() {
    const pos = this.edgeSpawnAway();
    /** @type {Wolf} */
    const wf = {
      id: nextId++, kind: 'wolf', x: pos.x, y: pos.y, r: 4, hp: 1, maxHp: 1,
      state: 'circle', t: 0, target: null, retarget: 0, vx: 0, vy: 0, z: 0, food: null, exit: null,
      stun: 0, flash: 0, kbx: 0, kby: 0, walkT: 0, face: 1, side: this.rng() < 0.5 ? 1 : -1,
      entered: false, orbit: 0, dir: this.rng() < 0.5 ? 1 : -1, phase: this.rng.range(0, TAU),
    };
    this.startCircling(wf);
    this.wolves.push(wf);
    this.emit('wolf');
  }

  spawnArcher() {
    const pos = this.edgeSpawnAway();
    this.archers.push({
      id: nextId++, kind: 'archer', x: pos.x, y: pos.y, r: 4, hp: 1, maxHp: 1,
      state: 'move', t: 0, cd: this.rng.range(0.5, 1.2), aim: 0,
      stun: 0, flash: 0, kbx: 0, kby: 0, walkT: 0, face: 1, side: this.rng() < 0.5 ? 1 : -1,
      entered: false,
    });
    this.emit('archer');
  }

  // Mary's ice block rises somewhere on screen, well away from Wenceslas.
  spawnMary() {
    let pos = this.freeSpot(30, 14);
    for (let i = 0; i < 20 && dist(pos, this.king) < CFG.maryAppearDistance; i++) pos = this.freeSpot(30, 14);
    this.maries.push({
      id: nextId++, kind: 'mary', x: pos.x, y: pos.y, r: 5, hp: CFG.maryHp, maxHp: CFG.maryHp,
      state: 'rise', t: CFG.maryRise, windup: 0, cd: this.rng.range(0.4, 1), aim: 0,
      stun: 0, flash: 0, kbx: 0, kby: 0, walkT: 0, face: 1, side: this.rng() < 0.5 ? 1 : -1,
    });
    this.emit('maryRise');
  }

  // Frosty lumbers in from the edge of the screen. On a night with no boss of its own (the dev
  // console) he is the first, easiest one.
  spawnFrosty() {
    const pos = this.edgeSpawnAway();
    const stats = frostyStats(this.p.bossNo || 1);
    const a = Math.atan2(this.king.y - pos.y, this.king.x - pos.x);
    this.boss = {
      id: nextId++, kind: 'frosty', x: pos.x, y: pos.y, r: CFG.frostyRadius, hp: stats.hp, maxHp: stats.hp,
      state: 'arrive', t: 0, dx: Math.cos(a), dy: Math.sin(a), locked: false, rolled: 0, crashed: false, burst: 0,
      spin: 0, flash: 0, walkT: 0, face: Math.cos(a) < 0 ? -1 : 1, stats,
    };
    this.bossStarted = true;
    this.bossIntro = 2.5;
    this.emit('bossStart');
  }

  // Every enemy the sword can hit. Mary can't be hit while she is still inside her ice, and Frosty
  // only while he rests.
  /** @returns {Foe[]} */
  foes() {
    /** @type {Foe[]} */
    const foes = [...this.robbers, ...this.wolves, ...this.archers, ...this.maries.filter((m) => m.state === 'move')];
    if (this.boss && this.boss.state === 'rest') foes.push(this.boss);
    return foes;
  }

  // ---------- update ----------

  /** @param {number} dt @param {GameInput} inp */
  update(dt, inp) {
    this.updateFx(dt);
    if (this.done || this.dead) { this.arrows.length = 0; return; }
    if (!this.victory) this.time += dt;   // the clock stops when the boss falls
    this.updateKing(dt, inp);
    this.updateTrail();
    this.updatePages(dt);
    this.updateRobbers(dt);
    this.updateWolves(dt);
    this.updateArchers(dt);
    this.updateMaries(dt);
    this.updateFrosty(dt);
    this.updateArrows(dt);
    this.updateFood(dt);
    this.updateDelivery(dt);
    this.updateSpawning(dt);
  }

  /** @param {number} dt @param {GameInput} inp */
  updateKing(dt, inp) {
    const k = this.king;
    const ml = Math.hypot(inp.mx, inp.my);
    const mx = ml > 1 ? inp.mx / ml : inp.mx, my = ml > 1 ? inp.my / ml : inp.my;
    k.x += (mx * CFG.kingSpeed + k.kbx) * dt;
    k.y += (my * CFG.kingSpeed + k.kby) * dt;
    const decay = Math.exp(-12 * dt);
    k.kbx *= decay; k.kby *= decay;
    k.moving = ml > 0.1;
    if (k.moving) k.walkT += dt;
    k.x = clamp(k.x, 6, W - 6);
    k.y = clamp(k.y, HUD_H + 14, H - 3);
    this.collide(k);

    if (inp.aimAngle != null) k.aim = inp.aimAngle;
    else if (inp.ax != null && inp.ay != null) k.aim = Math.atan2(inp.ay - (k.y - 8), inp.ax - k.x);
    k.face = Math.cos(k.aim) < 0 ? -1 : 1;

    k.cd -= dt;
    k.inv -= dt;
    if (inp.swing && k.cd <= 0) {
      if (inp.autoAim) this.snapAim();
      k.swingT = CFG.swingDuration;
      k.cd = CFG.swingCooldown;
      k.swingAngle = k.aim;
      k.hit = new Set();
      this.emit('swing');
    }
    if (k.swingT > 0) {
      k.swingT -= dt;
      this.swordHits();
    }
  }

  // Turn toward the nearest robber in range. Used by quick taps on touch screens;
  // with nothing in range the king swings the way he's already facing.
  snapAim() {
    const k = this.king;
    const py = k.y - 8;
    let best = null, bd = CFG.autoAimRange;
    for (const rob of this.foes()) {
      const d = Math.hypot(rob.x - k.x, rob.y - 6 - py);
      if (d < bd) { bd = d; best = rob; }
    }
    if (!best) return;
    k.aim = Math.atan2(best.y - 6 - py, best.x - k.x);
    k.face = Math.cos(k.aim) < 0 ? -1 : 1;
  }

  swordHits() {
    const k = this.king;
    const px = k.x, py = k.y - 8;
    /** @param {{ id: number, x: number, y: number, r: number }} rob  @returns {{ nx: number, ny: number } | null} */
    const reach = (rob) => {
      if (k.hit.has(rob.id)) return null;
      const dx = rob.x - px, dy = rob.y - 6 - py;
      const d = Math.hypot(dx, dy);
      if (d > CFG.swingRange + rob.r + 2) return null;
      const slack = d > 0 ? Math.atan2(rob.r + 2, d) : Math.PI;
      if (Math.abs(angDiff(Math.atan2(dy, dx), k.swingAngle)) > CFG.swingHalfArc + slack) return null;
      return { nx: dx / (d || 1), ny: dy / (d || 1) };
    };
    for (const rob of this.foes()) {
      const hit = reach(rob);
      if (!hit) continue;
      k.hit.add(rob.id);
      this.hitFoe(rob, hit.nx, hit.ny);
    }
    // Frosty shrugs off blows while he is not dizzy: a puff of snow, no damage.
    const b = this.boss;
    if (b && b.state !== 'rest' && b.state !== 'dying' && reach(b)) {
      k.hit.add(b.id);
      this.puff(b.x, b.y - 14, ['#f4f4f4', '#94b0c2'], 3);
    }
  }

  // A sword hit on a robber, a wolf, an archer or Mary. (nx, ny): direction of the blow.
  /** @param {Foe} foe @param {number} nx @param {number} ny */
  hitFoe(foe, nx, ny) {
    if (foe.kind === 'frosty') {
      // he is too big to knock back, and stays dizzy where he is
      foe.hp -= 1;
      foe.flash = 0.12;
      this.emit('hit');
      if (foe.hp <= 0) this.killFrosty(foe);
      else this.puff(foe.x, foe.y - 16, ['#f4f4f4', '#94b0c2'], 6);
      return;
    }
    foe.hp -= 1;
    foe.flash = 0.12;
    foe.stun = 0.3;
    foe.kbx = nx * CFG.swingKnockback;
    foe.kby = ny * CFG.swingKnockback;
    if (foe.kind === 'wolf') {
      // knocked out of a crouch or a leap
      foe.z = 0;
      if (foe.state !== 'flee') this.startCircling(foe);
    } else if (foe.kind === 'archer') {
      // a hit spoils the shot, and it doesn't go straight back to drawing
      foe.state = 'move';
      foe.cd = Math.max(foe.cd, CFG.archerCooldown * 0.5);
    } else if (foe.kind === 'mary') {
      // a hit spoils the throw
      foe.windup = 0;
      foe.cd = Math.max(foe.cd, CFG.maryCooldown * 0.5);
    } else foe.windup = 0;
    this.emit('hit');
    if (foe.hp <= 0) {
      if (foe.kind === 'wolf') this.wolves.splice(this.wolves.indexOf(foe), 1);
      else if (foe.kind === 'archer') this.archers.splice(this.archers.indexOf(foe), 1);
      else if (foe.kind === 'mary') this.maries.splice(this.maries.indexOf(foe), 1);
      else this.robbers.splice(this.robbers.indexOf(foe), 1);
      this.kills++;
      this.emit('kill');
      const colors = foe.kind === 'wolf' ? ['#566c86', '#f4f4f4', '#333c57']
        : foe.kind === 'archer' ? ['#257179', '#38b764', '#f4f4f4']
        : foe.kind === 'mary' ? ['#b13e53', '#f4f4f4', '#73eff7']
        : ['#5d275d', '#f4f4f4', '#333c57'];
      this.puff(foe.x, foe.y - 6, colors, 14);
      this.floatText(foe.x, foe.y - 16, '+' + CFG.pointsKill * this.pointsMul(), '#f4f4f4');
      if (foe.kind === 'wolf' && foe.food) {
        // a wolf killed while running off drops what it stole
        this.spawnFood({ x: clamp(foe.x, 8, W - 8), y: clamp(foe.y, HUD_H + 10, H - 6) }, foe.food, CFG.dropPickupDelay);
        this.emit('foodDrop');
      }
    } else {
      this.puff(foe.x, foe.y - 6, ['#f4f4f4'], 4);
    }
  }

  pointsMul() { return this.hard ? CFG.hardPointsMul : 1; }

  updateTrail() {
    const k = this.king, t = this.trail;
    if (Math.hypot(k.x - t[0].x, k.y - t[0].y) >= 3) t.unshift({ x: k.x, y: k.y });
    const maxPts = Math.ceil(((this.line.length + 2) * CFG.pageSpacing) / 3) + 8;
    if (t.length > maxPts) t.length = maxPts;
  }

  // Point a given distance back along the king's path.
  /** @param {number} d @returns {Point} */
  trailPoint(d) {
    let px = this.king.x, py = this.king.y, acc = 0;
    for (const t of this.trail) {
      const dx = t.x - px, dy = t.y - py, l = Math.hypot(dx, dy);
      if (l > 0 && acc + l >= d) {
        const f = (d - acc) / l;
        return { x: px + dx * f, y: py + dy * f };
      }
      acc += l; px = t.x; py = t.y;
    }
    return { x: px, y: py };
  }

  /** @param {number} dt */
  updatePages(dt) {
    const k = this.king;
    for (const pg of this.pages) {
      pg.inv -= dt;
      pg.flash -= dt;
      let tx, ty, speed;
      if (pg.state === 'wander') {
        pg.wanderT -= dt;
        if (pg.wanderT <= 0 || dist(pg, pg.target) < 4) {
          pg.target = this.freeSpot(30);
          pg.wanderT = this.rng.range(2.5, 5);
        }
        tx = pg.target.x; ty = pg.target.y; speed = CFG.pageWanderSpeed;
        if (dist(pg, k) < CFG.recruitRadius + k.r) {
          pg.state = 'follow';
          this.line.push(pg);
          this.emit('recruit');
          this.puff(pg.x, pg.y - 8, ['#ffcd75', '#f4f4f4'], 6);
        }
      } else {
        const idx = this.line.indexOf(pg);
        const tp = this.trailPoint((idx + 1) * CFG.pageSpacing);
        tx = tp.x; ty = tp.y;
        const d = Math.hypot(tx - pg.x, ty - pg.y);
        speed = Math.min(CFG.pageFollowSpeed * (d > 40 ? 1.5 : 1), d * 7);
      }
      const dx = tx - pg.x, dy = ty - pg.y, d = Math.hypot(dx, dy);
      let vx = 0, vy = 0;
      if (d > 0.5) {
        const s = this.steer(pg, dx / d, dy / d);
        vx = s.x * speed; vy = s.y * speed;
      }
      // soft, slightly lagging motion: this is what makes the line less rigid than Snake
      const soft = 1 - Math.exp(-10 * dt);
      pg.vx += (vx - pg.vx) * soft;
      pg.vy += (vy - pg.vy) * soft;
      pg.x += pg.vx * dt;
      pg.y += pg.vy * dt;
      const sp = Math.hypot(pg.vx, pg.vy);
      if (sp > 4) { pg.walkT += dt; if (Math.abs(pg.vx) > 2) pg.face = pg.vx < 0 ? -1 : 1; }
      if (!pg.entered && onScreen(pg, -8)) pg.entered = true;
      if (pg.entered) {
        pg.x = clamp(pg.x, 5, W - 5);
        pg.y = clamp(pg.y, HUD_H + 12, H - 3);
      }
    }
    this.separate(this.pages, 6);
    for (const pg of this.pages) this.collide(pg);
  }

  /** @param {number} dt */
  updateRobbers(dt) {
    const k = this.king;
    const decay = Math.exp(-10 * dt);
    for (const rob of [...this.robbers]) {
      rob.flash -= dt;
      rob.stun -= dt;
      rob.atkCd -= dt;
      rob.retarget -= dt;
      rob.x += rob.kbx * dt; rob.y += rob.kby * dt;
      rob.kbx *= decay; rob.kby *= decay;

      let tg = rob.target;
      if (rob.retarget <= 0 || !this.alive(tg)) {
        tg = rob.target = this.chooseTarget(rob);
        rob.retarget = 0.25;
      }
      if (rob.stun > 0) continue;
      const d = dist(rob, tg);
      const reach = rob.r + tg.r + 4;
      if (rob.windup > 0) {
        rob.windup -= dt;
        if (rob.windup <= 0) {
          rob.atkCd = CFG.robberAttackCooldown;
          if (d <= reach + 5) this.damage(tg, rob);
        }
        continue;
      }
      if (d <= reach) {
        if (rob.atkCd <= 0) rob.windup = CFG.robberWindup;
        rob.face = tg.x < rob.x ? -1 : 1;
        continue;
      }
      const s = this.steer(rob, (tg.x - rob.x) / d, (tg.y - rob.y) / d);
      const sp = CFG.robberSpeed * this.speedMul;
      rob.x += s.x * sp * dt;
      rob.y += s.y * sp * dt;
      rob.walkT += dt;
      if (Math.abs(s.x) > 0.1) rob.face = s.x < 0 ? -1 : 1;
    }
    this.separate(this.robbers, 7);
    for (const rob of this.robbers) this.collide(rob);
  }

  /** @param {King | Page | null} e @returns {e is King | Page} */
  alive(e) {
    return !!e && (e === this.king || this.pages.includes(/** @type {Page} */ (e)));
  }

  /** @param {Robber} rob @returns {King | Page} */
  chooseTarget(rob) {
    const k = this.king;
    if (dist(rob, k) < CFG.robberAggroRadius) return k;
    /** @type {Page | null} */
    let best = null, bd = Infinity;
    for (const pg of this.pages) {
      const d = dist(rob, pg);
      if (d < bd) { bd = d; best = pg; }
    }
    return best || k;
  }

  /** @param {King | Page} target @param {Point} from */
  damage(target, from, amount = CFG.robberDamage) {
    const nx = target.x - from.x, ny = target.y - from.y, l = Math.hypot(nx, ny) || 1;
    if (target === this.king) {
      const k = this.king;
      if (k.inv > 0 || k.god || this.victory) return;   // god: dev console cheat
      k.hp -= amount;
      k.inv = CFG.kingInvuln;
      k.kbx = (nx / l) * 120; k.kby = (ny / l) * 120;
      this.emit('hurt');
      this.puff(k.x, k.y - 8, ['#b13e53', '#f4f4f4'], 6);
      if (k.hp <= 0) {
        k.hp = 0;
        this.dead = true;
        this.emit('gameover');
      }
      return;
    }
    const pg = /** @type {Page} */ (target);
    if (pg.inv > 0) return;
    pg.hp -= amount;
    pg.inv = CFG.pageInvuln;
    pg.flash = 0.12;
    pg.vx += (nx / l) * 80; pg.vy += (ny / l) * 80;
    if (pg.hp <= 0) this.killPage(pg);
    else this.emit('pageHurt');
  }

  // ---------- wolves ----------
  //
  // States: circle (prowl round Wenceslas), hunt (run at a page carrying food),
  // crouch (telegraph), leap, recover (after a miss), flee (off the screen with the food).

  /** @param {Wolf} wf */
  startCircling(wf) {
    const k = this.king;
    wf.state = 'circle';
    wf.target = null;
    wf.orbit = Math.atan2((wf.y - k.y) / 0.7, wf.x - k.x); // pick up the circle where the wolf already is
  }

  /** @param {Wolf} wf @returns {Page | null} */
  nearestCarrier(wf) {
    /** @type {Page | null} */
    let best = null, bd = Infinity;
    for (const pg of this.line) {
      if (!pg.food) continue;
      const d = dist(wf, pg);
      if (d < bd) { bd = d; best = pg; }
    }
    return best;
  }

  /** @param {number} dt */
  updateWolves(dt) {
    const k = this.king;
    const decay = Math.exp(-10 * dt);
    /** @param {Page | null} pg @returns {pg is Page} a page in the line, carrying food */
    const has = (pg) => !!pg && !!pg.food && this.line.includes(pg);
    for (const wf of [...this.wolves]) {
      wf.flash -= dt;
      wf.stun -= dt;
      wf.retarget -= dt;
      wf.t -= dt;
      wf.x += wf.kbx * dt; wf.y += wf.kby * dt;
      wf.kbx *= decay; wf.kby *= decay;
      if (wf.stun > 0) continue;

      if (wf.state === 'leap') {
        const f = clamp(1 - wf.t / CFG.wolfLeapTime, 0, 1);
        wf.z = Math.sin(Math.PI * f) * 8;
        wf.x += wf.vx * dt; wf.y += wf.vy * dt;
        wf.walkT += dt;
        const pg = wf.target;
        if (has(pg) && dist(wf, pg) < wf.r + pg.r + 3) { this.steal(wf, pg); continue; }
        if (wf.t <= 0) { wf.z = 0; wf.state = 'recover'; wf.t = CFG.wolfRecover; }
        continue;
      }
      if (wf.state === 'recover') {
        if (wf.t <= 0) this.startCircling(wf);
        continue;
      }
      if (wf.state === 'crouch') {
        const pg = wf.target;
        if (!has(pg)) { this.startCircling(wf); continue; }
        wf.face = pg.x < wf.x ? -1 : 1;
        if (wf.t <= 0) {
          // aim a little ahead of a moving page
          const lead = CFG.wolfLeapTime * 0.5;
          const dx = pg.x + pg.vx * lead - wf.x, dy = pg.y + pg.vy * lead - wf.y;
          const d = Math.hypot(dx, dy) || 1;
          const v = (d + 6) / CFG.wolfLeapTime;
          wf.vx = (dx / d) * v; wf.vy = (dy / d) * v;
          wf.state = 'leap';
          wf.t = CFG.wolfLeapTime;
          this.emit('wolfLeap');
        }
        continue;
      }

      let tx, ty, speed;
      if (wf.state === 'flee') {
        wf.exit ??= this.nearestExit(wf);
        tx = wf.exit.x; ty = wf.exit.y; speed = CFG.wolfFleeSpeed;
        if (!onScreen(wf, 10)) {
          this.wolves.splice(this.wolves.indexOf(wf), 1);
          this.emit('wolfEscape');
          continue;
        }
      } else {
        if (wf.retarget <= 0) { wf.target = this.nearestCarrier(wf); wf.retarget = 0.25; }
        const pg = wf.target;
        if (has(pg)) {
          if (wf.entered && dist(wf, pg) < CFG.wolfLeapRange) {
            wf.state = 'crouch';
            wf.t = CFG.wolfCrouch;
            wf.face = pg.x < wf.x ? -1 : 1;
            continue;
          }
          wf.state = 'hunt';
          tx = pg.x; ty = pg.y; speed = CFG.wolfRunSpeed;
        } else {
          if (wf.state !== 'circle') this.startCircling(wf);
          // A loose, wobbling ring round Wenceslas, squashed to suit the top-down view.
          const rad = CFG.wolfCircleRadius + Math.sin(this.time * 0.9 + wf.phase) * 14 + Math.sin(this.time * 2.3 + wf.phase * 2) * 5;
          wf.orbit += (wf.dir * CFG.wolfCircleSpeed * 0.8 / rad) * dt;
          tx = clamp(k.x + Math.cos(wf.orbit) * rad, 10, W - 10);
          ty = clamp(k.y + Math.sin(wf.orbit) * rad * 0.7, HUD_H + 14, H - 6);
          const d = Math.hypot(tx - wf.x, ty - wf.y);
          speed = d > 40 ? CFG.wolfRunSpeed : Math.min(CFG.wolfCircleSpeed, d * 6);
        }
      }
      const dx = tx - wf.x, dy = ty - wf.y, d = Math.hypot(dx, dy);
      if (d > 0.5) {
        const s = this.steer(wf, dx / d, dy / d);
        const step = Math.min(speed * this.speedMul * dt, d);
        wf.x += s.x * step;
        wf.y += s.y * step;
        wf.walkT += dt;
        if (Math.abs(s.x) > 0.1) wf.face = s.x < 0 ? -1 : 1;
      }
      if (!wf.entered && onScreen(wf, -8)) wf.entered = true;
      if (wf.entered && wf.state !== 'flee') {
        wf.x = clamp(wf.x, 5, W - 5);
        wf.y = clamp(wf.y, HUD_H + 12, H - 3);
      }
    }
    this.separate(this.wolves, 8);
    for (const wf of this.wolves) if (wf.state !== 'leap') this.collide(wf);
  }

  // The wolf takes the page's food, bites the page, and runs for the nearest edge.
  /** @param {Wolf} wf @param {Page} pg */
  steal(wf, pg) {
    wf.food = pg.food;
    pg.food = null;               // taken first, so a page that dies of the bite drops nothing
    this.emit('wolfSteal');
    this.puff(pg.x, pg.y - 12, ['#ffcd75', '#f4f4f4'], 6);
    this.floatText(pg.x, pg.y - 22, 'STOLEN!', '#b13e53');
    this.damage(pg, wf, CFG.wolfBite);
    wf.state = 'flee';
    wf.z = 0;
    wf.target = null;
    wf.exit = this.nearestExit(wf);
  }

  // A point just past the nearest edge of the screen.
  /** @param {Point} e @returns {Point} */
  nearestExit(e) {
    const m = 24;
    const exits = [
      { d: e.x, x: -m, y: e.y },
      { d: W - e.x, x: W + m, y: e.y },
      { d: e.y - HUD_H, x: e.x, y: HUD_H - m },
      { d: H - e.y, x: e.x, y: H + m },
    ];
    const best = exits.reduce((a, b) => (b.d < a.d ? b : a));
    return { x: best.x, y: best.y };
  }

  // ---------- archers ----------
  //
  // Archers look only at Wenceslas. While cooling down they walk into range, back away if
  // he is close (slower than he walks, so he can run them down), or stand. When the cooldown
  // is up and he is in range they plant their feet and draw their bow (the telegraph), then
  // loose one inaccurate arrow at where he is at that moment.

  /** @param {number} dt */
  updateArchers(dt) {
    const k = this.king;
    const decay = Math.exp(-10 * dt);
    for (const ar of [...this.archers]) {
      ar.flash -= dt;
      ar.stun -= dt;
      ar.cd -= dt;
      ar.x += ar.kbx * dt; ar.y += ar.kby * dt;
      ar.kbx *= decay; ar.kby *= decay;
      if (ar.stun > 0) continue;
      if (!ar.entered && onScreen(ar, -8)) ar.entered = true;

      const d = dist(ar, k);
      if (ar.state === 'draw') {
        ar.t -= dt;
        ar.aim = Math.atan2(k.y - ar.y, k.x - ar.x);
        ar.face = k.x < ar.x ? -1 : 1;
        if (ar.t <= 0) {
          this.loose(ar);
          ar.state = 'move';
          ar.cd = CFG.archerCooldown;
        }
        continue;
      }
      if (ar.entered && ar.cd <= 0 && d <= CFG.archerRange) {
        ar.state = 'draw';
        ar.t = CFG.archerDraw;
        continue;
      }

      // Walk in if far (or still off the screen), back away if close, otherwise stand.
      const toward = (!ar.entered || d > CFG.archerRange) ? 1 : d < CFG.archerKeepAway ? -1 : 0;
      if (toward !== 0 && d > 0.5) {
        const s = this.steer(ar, (toward * (k.x - ar.x)) / d, (toward * (k.y - ar.y)) / d);
        const sp = (toward > 0 ? CFG.archerSpeed : CFG.archerRetreatSpeed) * this.speedMul;
        ar.x += s.x * sp * dt;
        ar.y += s.y * sp * dt;
        ar.walkT += dt;
        if (Math.abs(s.x) > 0.1) ar.face = s.x < 0 ? -1 : 1;
      }
      if (ar.entered) {
        ar.x = clamp(ar.x, 5, W - 5);
        ar.y = clamp(ar.y, HUD_H + 12, H - 3);
      }
    }
    this.separate(this.archers, 8);
    for (const ar of this.archers) this.collide(ar);
  }

  // One arrow, aimed at Wenceslas where he stands now, with a random error.
  /** @param {Archer} ar */
  loose(ar) {
    const k = this.king;
    const a = Math.atan2(k.y - ar.y, k.x - ar.x) + this.rng.range(-CFG.archerSpread, CFG.archerSpread);
    const c = Math.cos(a), s = Math.sin(a);
    this.arrows.push({
      id: nextId++, x: ar.x + c * 6, y: ar.y + s * 6,
      vx: c * CFG.arrowSpeed, vy: s * CFG.arrowSpeed, angle: a, life: CFG.arrowLife,
    });
    this.emit('arrowShoot');
  }

  // ---------- Mary ----------
  //
  // An ice block rises out of the ground ('rise'), splits open ('split'), and Mary walks after
  // Wenceslas, slowly. Whenever he is in range she holds a snowball up for a moment (the
  // telegraph) and throws it at where he is then. Snowballs are arrows that are slower and white:
  // see updateArrows. A hit spoils the throw, and it takes three hits to kill her.

  /** @param {number} dt */
  updateMaries(dt) {
    const k = this.king;
    const decay = Math.exp(-10 * dt);
    for (const m of [...this.maries]) {
      m.flash -= dt;
      m.stun -= dt;
      m.cd -= dt;
      m.x += m.kbx * dt; m.y += m.kby * dt;
      m.kbx *= decay; m.kby *= decay;
      if (m.state === 'rise' || m.state === 'split') {
        m.t -= dt;
        if (m.t <= 0) {
          if (m.state === 'rise') {
            m.state = 'split';
            m.t = CFG.marySplit;
            this.puff(m.x, m.y - 8, ['#73eff7', '#f4f4f4', '#41a6f6'], 10);   // the crack
          } else {
            m.state = 'move';
            this.puff(m.x, m.y - 8, ['#73eff7', '#f4f4f4', '#41a6f6'], 18);   // the halves fall away
          }
        }
        continue;
      }
      if (m.stun > 0) continue;

      const d = dist(m, k);
      m.face = k.x < m.x ? -1 : 1;
      if (m.windup > 0) {
        m.windup -= dt;
        m.aim = Math.atan2(k.y - m.y, k.x - m.x);
        if (m.windup <= 0) { this.throwSnowball(m); m.cd = CFG.maryCooldown; }
      } else if (m.cd <= 0 && d <= CFG.maryRange) {
        m.windup = CFG.maryWindup;
      }

      // She keeps walking while she throws, until she is close.
      if (d > CFG.maryStopDistance) {
        const s = this.steer(m, (k.x - m.x) / d, (k.y - m.y) / d);
        const sp = CFG.marySpeed * this.speedMul;
        m.x += s.x * sp * dt;
        m.y += s.y * sp * dt;
        m.walkT += dt;
        if (Math.abs(s.x) > 0.1) m.face = s.x < 0 ? -1 : 1;
      }
      m.x = clamp(m.x, 5, W - 5);
      m.y = clamp(m.y, HUD_H + 12, H - 3);
    }
    this.separate(this.maries, 8);
    for (const m of this.maries) this.collide(m);
  }

  // One snowball, aimed at Wenceslas where he stands now, with a random error.
  /** @param {Mary} m */
  throwSnowball(m) {
    const k = this.king;
    const a = Math.atan2(k.y - m.y, k.x - m.x) + this.rng.range(-CFG.marySpread, CFG.marySpread);
    const c = Math.cos(a), s = Math.sin(a);
    this.arrows.push({
      id: nextId++, x: m.x + c * 6, y: m.y + s * 6,
      vx: c * CFG.snowballSpeed, vy: s * CFG.snowballSpeed, angle: a, life: CFG.snowballLife, snow: true,
    });
    this.emit('arrowShoot');
  }

  // ---------- Frosty ----------
  //
  // The boss of every third night. When the last food is delivered he lumbers in from the edge
  // of the screen ('arrive'), then repeats: lean back and shake (the telegraph, 'aim'), roll in a
  // straight line ('roll'), and sit dizzy ('rest'). He can only be hurt while he rests, which is
  // time for two or three swings. During the telegraph he follows Wenceslas, but he stops
  // tracking a moment before the roll, so a sidestep at the last second works. A roll that
  // reaches Wenceslas hurts him, and flattens any page it goes through; a roll that ends in a
  // tree, rock or wall leaves Frosty dizzy for longer.

  /** @param {Frosty} b */
  startAim(b) {
    b.state = 'aim';
    b.t = b.stats.telegraph;
    b.locked = false;
    this.emit('frostyWarn');
  }

  // impact: the roll ended in a crash (into scenery or the edge of the screen), not just at the end of its distance.
  /** @param {Frosty} b @param {boolean} crashed @param {boolean} [impact] */
  startRest(b, crashed, impact = crashed) {
    b.state = 'rest';
    b.t = b.stats.rest + (crashed ? CFG.frostyCrashBonus : 0);
    b.crashed = crashed;
    this.puff(b.x, b.y - 8, ['#f4f4f4', '#94b0c2'], crashed ? 16 : 8);
    if (impact) this.emit('frostyCrash');
  }

  /** @param {number} dt */
  updateFrosty(dt) {
    if (this.bossIntro > 0) this.bossIntro -= dt;
    const b = this.boss;
    if (!b) return;
    const k = this.king;
    b.flash -= dt;
    if (b.state === 'dying') { this.updateDying(b, dt); return; }

    if (b.state === 'arrive') {
      b.t += dt;
      const d = dist(b, k) || 1;
      const s = this.steer(b, (k.x - b.x) / d, (k.y - b.y) / d);
      const sp = CFG.frostyWalkSpeed * this.speedMul;
      b.x += s.x * sp * dt;
      b.y += s.y * sp * dt;
      b.walkT += dt;
      if (Math.abs(s.x) > 0.1) b.face = s.x < 0 ? -1 : 1;
      const inside = b.x > 40 && b.x < W - 40 && b.y > HUD_H + 40 && b.y < H - 30;
      if (inside || b.t > 8) this.startAim(b);   // (or he is stuck behind something: begin anyway)
      return;
    }

    if (b.state === 'aim') {
      b.t -= dt;
      if (!b.locked) {
        const d = dist(b, k) || 1;
        b.dx = (k.x - b.x) / d;
        b.dy = (k.y - b.y) / d;
        b.face = b.dx < 0 ? -1 : 1;
        if (b.t <= CFG.frostyLockTime) b.locked = true;
      }
      if (b.t <= 0) { b.state = 'roll'; b.rolled = 0; this.emit('frostyRoll'); }
    } else if (b.state === 'roll') {
      const step = b.stats.rollSpeed * this.speedMul * dt;
      b.x += b.dx * step;
      b.y += b.dy * step;
      b.rolled += step;
      b.spin += step / b.r;
      if (this.rng() < 0.6) this.puff(b.x - b.dx * b.r, b.y - 3, ['#f4f4f4', '#94b0c2'], 1);   // a trail of snow
      // whoever he rolls over
      if (dist(b, k) < b.r + k.r) this.damage(k, b, CFG.frostyDamage);
      for (const pg of [...this.pages]) if (dist(b, pg) < b.r + pg.r) this.damage(pg, b, CFG.frostyDamage);
      // scenery stops him, and he is left reeling
      let crashed = false;
      for (const o of this.obstacles) {
        const q = obsQuery(o, b.x, b.y);
        const reach = b.r * 0.6;
        if (q.d < reach) { b.x += q.nx * (reach - q.d); b.y += q.ny * (reach - q.d); crashed = true; }
      }
      const x = clamp(b.x, b.r, W - b.r), y = clamp(b.y, HUD_H + 14, H - 3);
      const edge = x !== b.x || y !== b.y;
      b.x = x; b.y = y;
      if (crashed || edge || b.rolled >= CFG.frostyRollDistance) this.startRest(b, crashed, crashed || edge);
    } else {
      b.t -= dt;
      if (b.t <= 0) this.startAim(b);
    }
    if (b.state !== 'roll') {
      b.x = clamp(b.x, b.r, W - b.r);
      b.y = clamp(b.y, HUD_H + 14, H - 3);
    }
  }

  // Frosty is beaten: he starts to burst apart (see updateFrosty); the night is won when he has. The
  // points are his at once, and nothing can hurt Wenceslas while it happens.
  /** @param {Frosty} b */
  killFrosty(b) {
    b.state = 'dying';
    b.t = CFG.frostyDeathTime;
    b.burst = 0;
    this.victory = true;
    this.arrows.length = 0;
    this.kills++;
    this.bonus += CFG.pointsBoss;
    this.emit('kill');
    this.floatText(b.x, b.y - 46, '+' + (CFG.pointsKill + CFG.pointsBoss) * this.pointsMul(), '#ffcd75');
    this.throwClods(b, 28, 1, 60, 150);
  }

  // Throw snowballs out of Frosty: n of them, from about `height` pixels up, outward at speeds from lo to hi.
  /** @param {Frosty} b @param {number} n @param {number} fall  how far through the death he is (0 to 1) @param {number} lo @param {number} hi */
  throwClods(b, n, fall, lo, hi) {
    const top = Math.max(6, 40 * (1 - fall) + 6);   // he sheds from the top down, so the snowballs start lower and lower
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, TAU), sp = this.rng.range(lo, hi);
      this.shower.push({
        x: b.x + this.rng.range(-5, 5), y: b.y + this.rng.range(-3, 3), z: this.rng.range(4, top),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, vz: this.rng.range(90, 270),
        life: this.rng.range(1.6, 3.2), bounces: 0, big: this.rng() < 0.35,
      });
    }
  }

  // The last three seconds: he shakes and sheds snowballs from the top down, in bursts that each make
  // a sound, until nothing of him is left. Then the night ends.
  /** @param {Frosty} b @param {number} dt */
  updateDying(b, dt) {
    b.t -= dt;
    const fall = 1 - Math.max(0, b.t) / CFG.frostyDeathTime;
    this.throwClods(b, Math.round(this.rng.range(0, 2)), fall, 30, 110);   // a steady spray...
    if (this.rng() < 0.5) this.puff(b.x, b.y - 20 * (1 - fall) - 4, ['#f4f4f4', '#94b0c2'], 1);
    const bursts = [0.18, 0.4, 0.62, 0.82];                                 // ...and bigger bursts
    while (b.burst < bursts.length && fall >= bursts[b.burst]) {
      this.throwClods(b, 22, fall, 70, 190);
      this.emit('hit');
      b.burst++;
    }
    if (b.t <= 0) {
      this.throwClods(b, 70, 1, 90, 230);                                   // the end: everything goes
      this.puff(b.x, b.y - 10, ['#f4f4f4', '#94b0c2', '#ef7d57', '#1a1c2c'], 40);
      this.boss = null;
      this.done = true;
      this.emit('nightComplete');
    }
  }

  // Arrows (and snowballs) fly straight until they leave the screen, hit a tree, or hit Wenceslas
  // or a page (whichever they reach first: a page standing in the way takes it).
  /** @param {number} dt */
  updateArrows(dt) {
    for (const a of [...this.arrows]) {
      a.life -= dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      let gone = a.life <= 0 || a.x < -20 || a.x > W + 20 || a.y < HUD_H - 20 || a.y > H + 20;
      if (!gone) {
        // Trees stop arrows. Rocks and walls are low, so arrows fly over them.
        for (const o of this.obstacles) {
          if (o.kind === 'tree' && Math.hypot(a.x - o.x, a.y - o.y) < o.r + CFG.arrowTreeBlock) {
            this.puff(a.x, a.y - 6, ['#f4f4f4', '#8a5a3c'], 3);
            this.emit('arrowHit');
            gone = true;
            break;
          }
        }
      }
      if (!gone) {
        /** @type {King | Page | null} */
        let hit = null;
        let best = Infinity;
        for (const e of [this.king, ...this.pages]) {
          const d = dist(a, e);
          if (d < e.r + 2 && d < best) { best = d; hit = e; }
        }
        if (hit) {
          this.damage(hit, a, a.snow ? CFG.snowballDamage : CFG.arrowDamage);
          if (hit !== this.king) this.emit('arrowHit');   // the king's own hurt sound covers him
          gone = true;
        }
      }
      if (gone) this.arrows.splice(this.arrows.indexOf(a), 1);
    }
  }

  /** @param {Page} pg */
  killPage(pg) {
    this.pages.splice(this.pages.indexOf(pg), 1);
    const li = this.line.indexOf(pg);
    if (li >= 0) this.line.splice(li, 1);
    this.emit('pageDie');
    this.puff(pg.x, pg.y - 6, ['#38b764', '#f4f4f4', '#257179'], 12);
    if (pg.food) {
      this.spawnFood({ x: clamp(pg.x, 8, W - 8), y: clamp(pg.y, HUD_H + 10, H - 6) }, pg.food, CFG.dropPickupDelay);
      this.emit('foodDrop');
    }
  }

  /** @param {number} dt */
  updateFood(dt) {
    for (const f of [...this.foods]) {
      f.delay -= dt;
      f.pop -= dt;
      f.t += dt;
      if (f.delay > 0) continue;
      const empty = this.line.find((p) => !p.food);
      if (!empty) break;
      const near = [this.king, ...this.line].some((e) => dist(e, f) < CFG.pickupRadius);
      if (!near) continue;
      empty.food = f.kind;
      this.foods.splice(this.foods.indexOf(f), 1);
      this.emit('pickup');
      this.puff(f.x, f.y - 2, ['#ffcd75', '#f4f4f4'], 5);
    }
  }

  /** @param {number} dt */
  updateDelivery(dt) {
    const om = this.oldMan;
    om.bob += dt;
    if (this.bossStarted) return;   // the food is all in: it is the boss now
    if (dist(this.king, om) > CFG.deliverRadius) { this.deliverTimer = 0; return; }
    this.deliverTimer -= dt;
    if (this.deliverTimer > 0) return;
    const carrier = this.line.find((p) => p.food);
    if (!carrier) return;
    carrier.food = null;
    this.delivered++;
    this.deliverTimer = CFG.deliverInterval;
    this.emit('deliver');
    this.floatText(om.x, om.y - 22, '+' + CFG.pointsFood * this.pointsMul(), '#ffcd75');
    this.puff(om.x, om.y - 10, ['#ffcd75', '#f4f4f4'], 6);
    if (this.delivered >= this.p.foodTarget) {
      // A boss night is not over until the boss is.
      if (this.p.bossNo > 0) this.spawnFrosty();
      else { this.done = true; this.emit('nightComplete'); }
    }
  }

  /** @param {number} dt */
  updateSpawning(dt) {
    if (this.bossStarted) return;   // nothing new arrives during the boss fight
    const p = this.p;
    this.pageTimer -= dt;
    const wandering = this.pages.filter((x) => x.state === 'wander').length;
    if (this.pageTimer <= 0) {
      if (wandering < p.maxWanderingPages) this.spawnPage();
      // spawn faster when you have nobody, so the player is never stuck
      this.pageTimer = (this.pages.length === 0 ? 1.2 : p.pageInterval) * this.rng.range(0.7, 1.3);
    }
    this.foodTimer -= dt;
    if (this.foodTimer <= 0) {
      if (this.foods.length < p.maxFood) this.spawnFood();
      this.foodTimer = p.foodInterval * this.rng.range(0.7, 1.3);
    }
    this.robberTimer -= dt;
    if (this.robberTimer <= 0) {
      if (this.robbers.length < p.maxRobbers) this.spawnRobber();
      this.robberTimer = p.robberInterval * this.rng.range(0.7, 1.3);
    }
    if (p.maxWolves > 0) {
      this.wolfTimer -= dt;
      if (this.wolfTimer <= 0) {
        if (this.wolves.length < p.maxWolves) this.spawnWolf();
        this.wolfTimer = p.wolfInterval * this.rng.range(0.7, 1.3);
      }
    }
    // Mary: whether she comes tonight is decided once, at the start, and then she comes once.
    if (this.maryTimer === null) {
      this.maryTimer = this.rng() < p.maryChance ? this.rng.range(p.maryEarliest, p.maryLatest) : Infinity;
    } else if (this.maryTimer !== Infinity) {
      this.maryTimer -= dt;
      if (this.maryTimer <= 0) { this.spawnMary(); this.maryTimer = Infinity; }
    }
    if (p.maxArchers > 0) {
      this.archerTimer -= dt;
      if (this.archerTimer <= 0) {
        if (this.archers.length < p.maxArchers) this.spawnArcher();
        this.archerTimer = p.archerInterval * this.rng.range(0.7, 1.3);
      }
    }
  }

  // ---------- movement helpers ----------

  // Bend a desired direction around nearby obstacles.
  /** @param {{ x: number, y: number, r: number, side?: number }} e @param {number} dx @param {number} dy */
  steer(e, dx, dy) {
    let ax = dx, ay = dy;
    for (const o of this.obstacles) {
      const q = obsQuery(o, e.x, e.y);
      const range = e.r + 16;
      if (q.d > range) continue;
      if (dx * -q.nx + dy * -q.ny <= 0) continue; // moving away from it
      const w = (1 - Math.max(0, q.d) / range) * 1.6;
      const tx = -q.ny, ty = q.nx;
      let s = tx * dx + ty * dy;
      s = Math.abs(s) < 0.05 ? e.side || 1 : Math.sign(s);
      ax += q.nx * w * 0.4 + tx * s * w;
      ay += q.ny * w * 0.4 + ty * s * w;
    }
    const l = Math.hypot(ax, ay) || 1;
    return { x: ax / l, y: ay / l };
  }

  /** @param {{ x: number, y: number, r: number }} e */
  collide(e) {
    for (const o of this.obstacles) {
      const q = obsQuery(o, e.x, e.y);
      if (q.d < e.r) {
        const push = e.r - q.d;
        e.x += q.nx * push;
        e.y += q.ny * push;
      }
    }
  }

  /** @param {Point[]} list @param {number} minD */
  separate(list, minD) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d > 0 && d < minD) {
          const push = (minD - d) / 2;
          a.x -= (dx / d) * push; a.y -= (dy / d) * push;
          b.x += (dx / d) * push; b.y += (dy / d) * push;
        }
      }
    }
  }

  // ---------- effects ----------

  /** @param {number} x @param {number} y @param {string[]} colors @param {number} n */
  puff(x, y, colors, n) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, TAU), s = this.rng.range(15, 60);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20,
        life: this.rng.range(0.3, 0.6), color: this.rng.pick(colors),
      });
    }
  }

  /** @param {number} x @param {number} y @param {string} text @param {string} color */
  floatText(x, y, text, color) {
    this.texts.push({ x, y, text, color, life: 1 });
  }

  /** @param {number} dt */
  updateFx(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 60 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 14 * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const c of this.shower) {
      c.life -= dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      c.vz -= 420 * dt;
      if (c.z <= 0) {
        c.z = 0;
        if (c.vz < -70 && c.bounces < 2) { c.vz *= -0.38; c.vx *= 0.7; c.vy *= 0.7; c.bounces++; }   // bounce, then roll to a stop
        else { c.vz = 0; c.vx *= Math.exp(-7 * dt); c.vy *= Math.exp(-7 * dt); }
      }
    }
    this.shower = this.shower.filter((c) => c.life > 0);
  }
}
