// Drawing. Everything is drawn at 640x360 and scaled up by CSS.

import { W, H, HUD_H, CFG } from './config.js';
import { PAL, disc } from './sprites.js';
import { drawText, textWidth } from './font.js';
import { makeCanvas } from './canvas.js';

/** @typedef {import('./rng.js').Rng} Rng */
/** @typedef {import('./world.js').World} World */
/** @typedef {import('./world.js').King} King */
/** @typedef {import('./world.js').Page} Page */
/** @typedef {import('./world.js').Robber} Robber */
/** @typedef {import('./world.js').Wolf} Wolf */
/** @typedef {import('./world.js').Archer} Archer */
/** @typedef {import('./world.js').Arrow} Arrow */
/** @typedef {import('./world.js').MaryBoss} MaryBoss */
/** @typedef {import('./world.js').Boss} Boss */
/** @typedef {import('./world.js').Frosty} Frosty */
/** @typedef {import('./world.js').OldMan} OldMan */
/** @typedef {import('./world.js').Obstacle} Obstacle */
/** @typedef {ReturnType<typeof import('./sprites.js').loadSprites>} Sprites */
/** @typedef {Sprites['king']} CharSprite  a character with walk frames (king, page, robber, wolf) */

/**
 * A snowflake. Far flakes are drawn under everything, near ones over it.
 * @typedef {{ x: number, y: number, near: boolean, vy: number, ph: number, amp: number }} Flake
 */

/** @param {Rng} rng */
export function makeGround(rng) {
  const { canvas: c, ctx: x } = makeCanvas(W, H);
  x.fillStyle = '#8ea2c4';
  x.fillRect(0, 0, W, H);
  // soft drifts
  for (let i = 0; i < 40; i++) {
    const cx = rng.range(0, W), cy = rng.range(0, H), rw = rng.int(20, 70), rh = rng.int(4, 10);
    x.fillStyle = rng() < 0.6 ? '#9db1d2' : '#8297bb';
    for (let j = -rh; j <= rh; j++) {
      const hw = Math.round(rw * Math.sqrt(1 - (j * j) / (rh * rh)));
      x.fillRect(Math.round(cx - hw), Math.round(cy + j), hw * 2, 1);
    }
  }
  // speckles
  for (let i = 0; i < 1400; i++) {
    x.fillStyle = rng() < 0.5 ? '#a9bddb' : '#7d91b4';
    x.fillRect(rng.int(0, W - 1), rng.int(0, H - 1), 1, 1);
  }
  return c;
}

/** @param {Rng} rng */
export function makeSnow(rng) {
  /** @type {Flake[]} */
  const flakes = [];
  for (let i = 0; i < 160; i++) {
    const near = rng() < 0.3;
    flakes.push({
      x: rng.range(0, W), y: rng.range(0, H), near,
      vy: near ? rng.range(22, 34) : rng.range(9, 16),
      ph: rng.range(0, 6.28), amp: rng.range(4, 12),
    });
  }
  return flakes;
}

/** @param {Flake[]} flakes @param {number} dt @param {number} t */
export function updateSnow(flakes, dt, t) {
  for (const f of flakes) {
    f.y += f.vy * dt;
    f.x += Math.sin(t * 0.8 + f.ph) * f.amp * dt + 3 * dt;
    if (f.y > H + 2) { f.y = -2; }
    if (f.x > W + 2) f.x -= W + 4;
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {Flake[]} flakes @param {boolean} nearLayer */
export function drawSnow(ctx, flakes, nearLayer) {
  for (const f of flakes) {
    if (f.near !== nearLayer) continue;
    ctx.fillStyle = f.near ? '#f4f4f4' : '#d5e0ee';
    const s = f.near ? 2 : 1;
    ctx.fillRect(Math.round(f.x), Math.round(f.y), s, s);
  }
}

/**
 * A character at its feet position, facing left or right, animated by walkT.
 * @param {CanvasRenderingContext2D} ctx
 * @param {CharSprite} spr
 * @param {{ x: number, y: number, walkT: number, face: number }} e
 * @param {{ moving?: boolean, flash?: boolean }} [opts]  flash: draw all white (just hit)
 */
function blitChar(ctx, spr, e, opts = {}) {
  const moving = opts.moving ?? true;
  const fi = moving ? Math.floor(e.walkT * 8) % 2 : 0;
  const fr = spr.frames[fi];
  const white = opts.flash;
  const img = e.face < 0 ? (white ? fr.whiteFlipped : fr.flipped) : white ? fr.white : fr.normal;
  const bob = moving && fi === 1 ? 1 : 0;
  ctx.drawImage(img, Math.round(e.x - spr.w / 2), Math.round(e.y - spr.h + 1 - bob));
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y */
function shadow(ctx, x, y, w = 7) {
  ctx.fillStyle = 'rgba(41,54,111,0.35)';
  ctx.fillRect(Math.round(x - w / 2), Math.round(y), w, 2);
}

// Pixel line (Bresenham), so lines stay crisp.
/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {string} color
 */
function line(ctx, x0, y0, x1, y1, color) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = color;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {King} k */
function drawSword(ctx, k) {
  const px = k.x, py = k.y - 8;
  let a = k.aim;
  if (k.swingT > 0) {
    const t = 1 - k.swingT / CFG.swingDuration;
    a = k.swingAngle - CFG.swingHalfArc + 2 * CFG.swingHalfArc * t;
  }
  const c = Math.cos(a), s = Math.sin(a);
  const hx = px + c * 4, hy = py + s * 4;
  line(ctx, hx, hy, hx + c * 11, hy + s * 11, PAL.w);
  line(ctx, hx - s * 2, hy + c * 2, hx + s * 2, hy - c * 2, PAL.y); // crossguard
}

/** @param {CanvasRenderingContext2D} ctx @param {King} k */
function drawSwingArc(ctx, k) {
  if (k.swingT <= 0) return;
  const t = 1 - k.swingT / CFG.swingDuration;
  const px = k.x, py = k.y - 8;
  const start = k.swingAngle - CFG.swingHalfArc;
  const end = start + 2 * CFG.swingHalfArc * t;
  const outer = CFG.swingDrawnRadius;   // how far the arc is drawn; the blow itself reaches CFG.swingRange
  for (let r = outer - 5; r <= outer; r += 1) {
    const step = 0.8 / r;
    for (let a = start; a <= end; a += step) {
      // thin bright edge, dithered tail
      const along = (a - start) / (end - start + 0.001);
      const edge = r >= outer - 1;
      if (!edge && (along < 0.5 || (r + Math.round(a * r)) & 1)) continue;
      ctx.fillStyle = edge ? PAL.w : '#cfdcee';
      ctx.fillRect(Math.round(px + Math.cos(a) * r), Math.round(py + Math.sin(a) * r), 1, 1);
    }
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {Extract<Obstacle, { kind: 'wall' }>} o */
function drawWall(ctx, o) {
  const x = Math.round(o.x - o.w / 2), y = Math.round(o.y - o.h / 2), lift = 7;
  // top surface: stones under a layer of snow, with a dark rim
  ctx.fillStyle = PAL.D;
  ctx.fillRect(x - 1, y - lift - 1, o.w + 2, o.h + lift + 2);
  ctx.fillStyle = PAL.n;
  ctx.fillRect(x, y - lift, o.w, o.h);
  ctx.fillStyle = PAL.N;
  for (let j = 2; j < o.h; j += 4) {
    for (let i = (j >> 2) % 2 ? 1 : 4; i < o.w - 1; i += 6) ctx.fillRect(x + i, y - lift + j, 2, 1);
  }
  ctx.fillStyle = PAL.w;
  ctx.fillRect(x, y - lift, o.w, Math.min(2, o.h));
  if (o.h > o.w) {
    for (let j = 2; j < o.h - 2; j += 1) if ((j * 7) % 5 < 3) ctx.fillRect(x + 2 + ((j >> 2) & 1), y - lift + j, 3, 1);
  }
  // front face: bricks
  const fy = y + o.h - lift;
  ctx.fillStyle = PAL.N;
  ctx.fillRect(x, fy, o.w, lift);
  ctx.fillStyle = PAL.D;
  ctx.fillRect(x, fy + 3, o.w, 1);
  ctx.fillRect(x, fy + lift - 1, o.w, 1);
  for (let bx = x + 3; bx < x + o.w; bx += 6) ctx.fillRect(bx, fy, 1, 3);
  for (let bx = x + 6; bx < x + o.w; bx += 6) ctx.fillRect(bx, fy + 4, 1, 2);
}

/** @param {CanvasRenderingContext2D} ctx @param {Sprites} spr @param {Robber} rob */
function drawRobber(ctx, spr, rob) {
  const moving = rob.windup <= 0 && rob.stun <= 0;
  blitChar(ctx, spr.robber, rob, { moving, flash: rob.flash > 0 });
  // club
  const hx = rob.x + rob.face * 4, hy = rob.y - 6;
  if (rob.windup > 0) {
    line(ctx, hx, hy, hx + rob.face * 2, hy - 9, PAL.m);
    ctx.fillStyle = PAL.r;
    ctx.fillRect(Math.round(rob.x) - 1, Math.round(rob.y - 21), 2, 3); // "!" telegraph
    ctx.fillRect(Math.round(rob.x) - 1, Math.round(rob.y - 17), 2, 1);
  } else {
    line(ctx, hx, hy, hx + rob.face * 5, hy + 3, PAL.m);
  }
  if (rob.maxHp > 1 && rob.hp < rob.maxHp) {
    ctx.fillStyle = PAL.r;
    ctx.fillRect(Math.round(rob.x - 3), Math.round(rob.y - 18), 6, 1);
  }
}

// The archer, with their bow: carried at their side, or drawn toward Wenceslas with an arrow nocked
// and a red "!" (the telegraph) while they take aim.
/** @param {CanvasRenderingContext2D} ctx @param {Sprites} spr @param {Archer} ar */
function drawArcher(ctx, spr, ar) {
  const drawing = ar.state === 'draw';
  blitChar(ctx, spr.archer, ar, { moving: !drawing && ar.stun <= 0, flash: ar.flash > 0 });
  const cx = ar.x, cy = ar.y - 8;
  if (drawing) {
    const c = Math.cos(ar.aim), s = Math.sin(ar.aim);
    const bx = cx + c * 8, by = cy + s * 8;                         // the middle of the bow
    const px = -s, py = c;                                          // along the bow, across the aim
    line(ctx, bx + px * 5, by + py * 5, bx + c * 2, by + s * 2, PAL.b);   // limbs bow toward the target
    line(ctx, bx + c * 2, by + s * 2, bx - px * 5, by - py * 5, PAL.b);
    line(ctx, bx + px * 5, by + py * 5, cx + c * 3, cy + s * 3, PAL.w);   // string drawn back to the chest
    line(ctx, cx + c * 3, cy + s * 3, bx - px * 5, by - py * 5, PAL.w);
    line(ctx, cx + c * 3, cy + s * 3, bx + c * 5, by + s * 5, PAL.n);     // the nocked arrow
    ctx.fillStyle = PAL.r;
    ctx.fillRect(Math.round(ar.x) - 1, Math.round(ar.y - 21), 2, 3);      // "!" telegraph
    ctx.fillRect(Math.round(ar.x) - 1, Math.round(ar.y - 17), 2, 1);
  } else {
    const hx = ar.x + ar.face * 5;
    line(ctx, hx, cy - 4, hx + ar.face, cy, PAL.b);                  // the bow, carried upright
    line(ctx, hx + ar.face, cy, hx, cy + 4, PAL.b);
    line(ctx, hx, cy - 4, hx, cy + 4, PAL.w);
  }
}

// Half of Mary's ice block: x0 is its left edge, y the ground, h its height.
/** @param {CanvasRenderingContext2D} ctx @param {number} x0 @param {number} y @param {number} w @param {number} h @param {boolean} left */
function iceHalf(ctx, x0, y, w, h, left) {
  if (h < 1) return;
  const top = Math.round(y - h);
  ctx.fillStyle = PAL.c;
  ctx.fillRect(x0, top, w, h);
  ctx.fillStyle = PAL.C;
  ctx.fillRect(x0, top, w, Math.min(2, h));                       // the lit top
  ctx.fillStyle = PAL.w;
  ctx.fillRect(x0 + (left ? 1 : w - 2), top + 3, 1, Math.max(0, h - 9));   // a glint
  ctx.fillStyle = PAL.B;
  ctx.fillRect(x0 + (left ? 0 : w - 1), top, 1, h);               // the outer edge
  ctx.fillRect(x0, Math.round(y) - Math.min(2, h), w, Math.min(2, h));      // the shaded foot
}

// How far apart the halves of a splitting block are, and how tall (they sink as they part).
/** @param {number} h @param {number} open  more than 0.4 @param {number} [w]  the block's width @returns {{ gap: number, hh: number }} */
function icePartsAt(h, open, w = 14) {
  const f = (open - 0.4) / 0.6;                                   // 0 to 1 as the halves part
  return { gap: Math.round(f * 12 * (w / 14)), hh: Math.round(h * (1 - 0.85 * f)) };
}

// Mary's ice block, standing at (x, y), h tall and w wide. open runs 0 to 1 as it splits: first a crack
// runs down it, then the halves slide apart and sink.
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} h @param {number} open @param {number} [w] */
function drawIceBlock(ctx, x, y, h, open, w = 14) {
  const half = w / 2, cx = Math.round(x), by = Math.round(y);
  if (open <= 0.4) {
    iceHalf(ctx, cx - half, by, half, h, true);
    iceHalf(ctx, cx, by, half, h, false);
    if (open > 0) {
      // a jagged crack, growing down from the top
      const len = Math.round(h * Math.min(1, open / 0.4));
      ctx.fillStyle = PAL.d;
      for (let i = 0; i < len; i++) ctx.fillRect(cx - 1 + (((i >> 1) & 1) ? 1 : 0), by - h + i, 1, 1);
    }
    return;
  }
  const { gap, hh } = icePartsAt(h, open, w);
  iceHalf(ctx, cx - half - gap, by, half, hh, true);
  iceHalf(ctx, cx + gap, by, half, hh, false);
}

// Dotted warning lines on the ground, from (x, y) along an angle: they turn from red to orange and bolder
// when the attack has locked in.
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} angle @param {number} from @param {number} to @param {boolean} locked */
function warnLine(ctx, x, y, angle, from, to, locked) {
  const c = Math.cos(angle), s = Math.sin(angle), size = locked ? 3 : 2;
  ctx.fillStyle = locked ? PAL.o : PAL.r;
  for (let d = from; d < to; d += 9) ctx.fillRect(Math.round(x + c * d), Math.round(y - 3 + s * d), size, size);
}

// Three little stars circling a head: whoever it is, they can be hit now.
/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} top @param {number} time */
function drawDizzyStars(ctx, cx, top, time) {
  for (let i = 0; i < 3; i++) {
    const a = time * 5 + i * 2.094;
    const sx = Math.round(cx + Math.cos(a) * 11), sy = Math.round(top - 1 + Math.sin(a) * 3);
    ctx.fillStyle = PAL.y;
    ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3);
  }
}

// Mary the boss is her sprite at twice the size. Her ice block (rise, split) is bigger too.
const MARY_BLOCK_W = 26, MARY_BLOCK_H = 38;

/** @param {CanvasRenderingContext2D} ctx @param {Sprites} spr @param {MaryBoss} b @param {{ moving?: boolean, flash?: boolean, dx?: number }} [opts] */
function blitMary(ctx, spr, b, opts = {}) {
  const f = spr.mary, fi = opts.moving ? Math.floor(b.walkT * 8) % 2 : 0, fr = f.frames[fi];
  const img = b.face < 0 ? (opts.flash ? fr.whiteFlipped : fr.flipped) : opts.flash ? fr.white : fr.normal;
  const bob = opts.moving && fi === 1 ? 2 : 0;
  ctx.drawImage(img, Math.round(b.x + (opts.dx || 0) - f.w), Math.round(b.y - f.h * 2 + 2 - bob), f.w * 2, f.h * 2);
}

// Mary. Rising and splitting she is only her ice. Then: the warning lines for her next attack (and a
// snowball held up), the attack, and the rest in which she trudges after Wenceslas, winded, with stars
// round her head: the time to hit her. Beaten, she is frozen in a block that sinks into the ground.
/** @param {CanvasRenderingContext2D} ctx @param {Sprites} spr @param {MaryBoss} b @param {number} time */
function drawMary(ctx, spr, b, time) {
  const f = spr.mary, top = Math.round(b.y - f.h * 2);
  if (b.state === 'rise') {
    const p = 1 - b.t / CFG.maryRise;
    drawIceBlock(ctx, b.x + (Math.floor(b.t * 30) % 2), b.y, Math.round(MARY_BLOCK_H * p), 0, MARY_BLOCK_W);   // it trembles as it comes up
    return;
  }
  if (b.state === 'split') {
    const p = 1 - b.t / CFG.marySplit;
    if (p > 0.4) {
      const { gap, hh } = icePartsAt(MARY_BLOCK_H, p, MARY_BLOCK_W);
      ctx.fillStyle = PAL.D;
      ctx.fillRect(Math.round(b.x) - gap, Math.round(b.y) - hh, gap * 2, hh);   // the dark opening between the halves
    }
    if (p > 0.6) blitMary(ctx, spr, b);                                         // she is seen once the halves are wide enough apart
    drawIceBlock(ctx, b.x, b.y, MARY_BLOCK_H, p, MARY_BLOCK_W);                 // the halves go in front of her
    return;
  }
  if (b.state === 'dying') {
    const freeze = CFG.maryDeathFreeze, hold = CFG.maryDeathHold, sink = CFG.maryDeathSink;
    const e = freeze + hold + sink - b.t;                                       // seconds since she fell
    const q = e < freeze + hold ? 0 : Math.min(1, (e - freeze - hold) / sink);  // how far the block has sunk, 0 to 1
    ctx.save();
    ctx.beginPath();
    ctx.rect(Math.round(b.x) - 40, Math.round(b.y) - 80, 80, 82);              // nothing shows below the ground
    ctx.clip();
    ctx.translate(0, Math.round(q * (MARY_BLOCK_H + 4)));
    blitMary(ctx, spr, b);
    ctx.globalAlpha = 0.78;
    drawIceBlock(ctx, b.x, b.y, e < freeze ? Math.round((MARY_BLOCK_H * e) / freeze) : MARY_BLOCK_H, 0, MARY_BLOCK_W);
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  if (b.state === 'aim') {
    // the warning lines
    const locked = b.attack === 'blast' ? b.locked : b.t < CFG.maryLockTime;
    if (b.attack === 'blast') {
      const a = Math.atan2(b.dy, b.dx);
      warnLine(ctx, b.x, b.y, a - CFG.maryBlastSpread, 16, 190, locked);
      warnLine(ctx, b.x, b.y, a + CFG.maryBlastSpread, 16, 190, locked);
      if (!locked) warnLine(ctx, b.x, b.y, a, 30, 190, false);
    } else if (b.attack === 'spiral') {
      for (let arm = 0; arm < CFG.marySpiralArms; arm++) warnLine(ctx, b.x, b.y, b.angle + (arm * Math.PI * 2) / CFG.marySpiralArms, 16, 120, locked);
      // and an arc showing which way she will spin
      for (let i = 1; i <= 4; i++) {
        const a = b.angle + b.spin * i * 0.28, r = 36;
        ctx.fillStyle = locked ? PAL.o : PAL.r;
        ctx.fillRect(Math.round(b.x + Math.cos(a) * r), Math.round(b.y - 3 + Math.sin(a) * r), 2, 2);
      }
    } else {
      for (let i = 0; i < CFG.maryRingBalls; i++) warnLine(ctx, b.x, b.y, b.angle + (i * Math.PI * 2) / CFG.maryRingBalls, 22, 50, locked);
    }
  }
  // her: rocking from foot to foot while she rests; planted otherwise (with a small shake as she fires)
  const attacking = b.state === 'attack';
  blitMary(ctx, spr, b, { moving: b.state === 'rest', flash: b.flash > 0, dx: attacking ? Math.round(Math.sin(time * 90)) : 0 });
  if (b.state === 'aim') {
    drawSnowball(ctx, b.x + b.face * 8, top - 6 - (Math.floor(time * 8) % 2), true);   // a snowball held up
    ctx.fillStyle = PAL.r;
    ctx.fillRect(Math.round(b.x) - 1, top - 20, 3, 5);
    ctx.fillRect(Math.round(b.x) - 1, top - 14, 3, 2);                                   // "!" telegraph
  } else if (b.state === 'rest') drawDizzyStars(ctx, Math.round(b.x), top, time);
}

// Frosty. Standing (arriving, aiming, resting) he is the snowman; rolling he is a big ball with his
// face, scarf and hat turning round its edge. While he aims, a line on the ground shows where the roll
// will go (it brightens when it is locked in), and he crouches and shakes harder as it nears.
/** @param {CanvasRenderingContext2D} ctx @param {Sprites} spr @param {Frosty} b @param {number} time */
function drawFrosty(ctx, spr, b, time) {
  const cx = Math.round(b.x), by = Math.round(b.y), f = spr.frosty;
  if (b.state === 'aim') warnLine(ctx, b.x, b.y, Math.atan2(b.dy, b.dx), 14, CFG.frostyRollDistance, b.locked);
  if (b.state === 'roll') {
    const r = Math.round(b.r), cy = by - r;
    disc(ctx, cx, cy, r + 1, PAL.N);
    disc(ctx, cx - 1, cy - 1, r, PAL.w);
    disc(ctx, cx + 3, cy + 3, r - 4, '#e4ecf6');
    const turn = (b.dx < 0 ? -1 : 1) * b.spin;
    /** @type {[number, number, number, number, string][]} angle offset, radius, width, height, colour */
    const bits = [[0, 7, 3, 3, PAL.k], [2.1, 7, 3, 3, PAL.k], [4.2, 7, 3, 3, PAL.k], [1.0, 9, 6, 3, PAL.o], [3.1, 10, 8, 3, PAL.r], [5.2, 10, 6, 4, PAL.k]];
    for (const [off, rad, bw, bh, col] of bits) {
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(cx + Math.cos(turn + off) * rad - bw / 2), Math.round(cy + Math.sin(turn + off) * rad - bh / 2), bw, bh);
    }
    return;
  }
  if (b.state === 'dying') {
    // he shakes, flashing, and loses height from the top down as the snowballs fly off him
    const fall = 1 - Math.max(0, b.t) / CFG.frostyDeathTime;
    const vis = Math.round(f.h * (1 - fall));
    if (vis > 0) {
      const shake = Math.round(Math.sin(time * 80) * (1 + fall * 2));
      ctx.save();
      ctx.translate(cx + shake, 0);
      if (b.face < 0) ctx.scale(-1, 1);
      ctx.drawImage(Math.floor(time * 16) % 2 ? f.white : f.img, 0, f.h - vis, f.w, vis, Math.round(-f.w / 2), by - vis + 1, f.w, vis);
      ctx.restore();
    }
    return;
  }
  let x = cx, y = by, squash = 0;
  if (b.state === 'aim') {
    const near = 1 - b.t / b.stats.telegraph;                   // 0 to 1 as the roll nears
    x += Math.round(Math.sin(time * 70) * near * 2);
    squash = Math.round(near * 5);                              // crouching to push off
  } else if (b.state === 'arrive') y -= Math.floor(b.walkT * 4) % 2;   // a lumbering bob
  const img = b.flash > 0 ? f.white : f.img;
  ctx.save();
  ctx.translate(x, 0);
  if (b.face < 0) ctx.scale(-1, 1);
  ctx.drawImage(img, Math.round(-f.w / 2), y - f.h + 1 + squash, f.w, f.h - squash);
  ctx.restore();
  const top = y - f.h + 1 + squash;
  if (b.state === 'aim') {
    ctx.fillStyle = PAL.r;
    ctx.fillRect(cx - 1, top - 9, 3, 5);
    ctx.fillRect(cx - 1, top - 3, 3, 2);                        // "!" telegraph
  } else if (b.state === 'rest') drawDizzyStars(ctx, cx, top, time);
}

// A snowball: a white blob with a dark edge, so it shows on snow. `big` is the larger kind.
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y */
function drawSnowball(ctx, x, y, big = false) {
  const px = Math.round(x), py = Math.round(y);
  if (big) {
    disc(ctx, px, py, 3, PAL.N);
    disc(ctx, px, py, 2, PAL.w);
    return;
  }
  ctx.fillStyle = PAL.N;
  ctx.fillRect(px - 2, py - 1, 5, 3);
  ctx.fillRect(px - 1, py - 2, 3, 5);
  ctx.fillStyle = PAL.w;
  ctx.fillRect(px - 1, py - 1, 3, 3);
}

// An arrow in flight: drawn at body height, with a small shadow on the ground.
// (Snowballs are in the same list, and drawn as a ball.)
/** @param {CanvasRenderingContext2D} ctx @param {Arrow} a */
function drawArrow(ctx, a) {
  if (a.snow) { shadow(ctx, a.x, a.y, 3); drawSnowball(ctx, a.x, a.y - 6); return; }
  const c = Math.cos(a.angle), s = Math.sin(a.angle), y = a.y - 6;
  shadow(ctx, a.x, a.y, 3);
  line(ctx, a.x - c * 7, y - s * 7, a.x, y, PAL.m);                  // shaft: dark, so it shows on snow
  ctx.fillStyle = PAL.r;
  ctx.fillRect(Math.round(a.x - c * 7), Math.round(y - s * 7), 1, 1);   // fletching
  ctx.fillStyle = PAL.k;
  ctx.fillRect(Math.round(a.x + c), Math.round(y + s), 1, 1);          // head
  ctx.fillRect(Math.round(a.x), Math.round(y), 1, 1);
}

/** @param {CanvasRenderingContext2D} ctx @param {Sprites} spr @param {Wolf} wf */
function drawWolf(ctx, spr, wf) {
  const crouch = wf.state === 'crouch';
  const lift = Math.round(wf.z || 0) - (crouch ? 1 : 0);   // in the air when leaping, low when crouching
  const moving = !crouch && wf.state !== 'recover' && wf.stun <= 0;
  blitChar(ctx, spr.wolf, { x: wf.x, y: wf.y - lift, walkT: wf.walkT, face: wf.face }, { moving, flash: wf.flash > 0 });
  if (wf.food) {
    // carried in the jaws
    const f = spr.food[wf.food];
    ctx.drawImage(f.img, Math.round(wf.x + wf.face * 6 - f.w / 2), Math.round(wf.y - lift - 6 - f.h / 2));
  }
  if (crouch) {
    ctx.fillStyle = PAL.r;
    ctx.fillRect(Math.round(wf.x) - 1, Math.round(wf.y - 16), 2, 3); // "!" telegraph, as for robbers
    ctx.fillRect(Math.round(wf.x) - 1, Math.round(wf.y - 12), 2, 1);
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {Sprites} spr @param {Page} pg */
function drawPage(ctx, spr, pg) {
  if (pg.inv > 0 && Math.floor(pg.inv * 20) % 2) return;
  blitChar(ctx, spr.page, pg, { moving: Math.hypot(pg.vx, pg.vy) > 4, flash: pg.flash > 0 });
  if (pg.food) {
    const f = spr.food[pg.food];
    ctx.drawImage(f.img, Math.round(pg.x - f.w / 2), Math.round(pg.y - 13 - f.h));
  }
}

// The dotted delivery ring round the old man; yellow while anyone carries food.
/** @param {CanvasRenderingContext2D} ctx @param {OldMan} om @param {boolean} highlight @param {number} t */
function drawDeliveryRing(ctx, om, highlight, t) {
  // delivery ring, dotted
  const r = CFG.deliverRadius;
  const n = 36;
  for (let i = 0; i < n; i++) {
    if ((i + Math.floor(t * 6)) % 3 === 0) continue;
    const a = (i / n) * Math.PI * 2;
    ctx.fillStyle = highlight ? PAL.y : 'rgba(244,244,244,0.5)';
    ctx.fillRect(Math.round(om.x + Math.cos(a) * r), Math.round(om.y + Math.sin(a) * r * 0.6), 1, 1);
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {Sprites} spr @param {OldMan} om */
function drawOldManSprite(ctx, spr, om) {
  const s = spr.oldMan;
  shadow(ctx, om.x, om.y - 1, 9);
  ctx.drawImage(s.img, Math.round(om.x - s.w / 2), Math.round(om.y - s.h + 1));
  // bundle of sticks beside him ("gathering winter fuel")
  ctx.fillStyle = PAL.m;
  ctx.fillRect(Math.round(om.x - 10), Math.round(om.y - 3), 6, 2);
  ctx.fillStyle = PAL.b;
  ctx.fillRect(Math.round(om.x - 10), Math.round(om.y - 4), 6, 1);
  // bobbing marker
  const by = Math.round(om.y - s.h - 6 + Math.sin(om.bob * 4) * 1.5);
  ctx.fillStyle = PAL.y;
  ctx.fillRect(Math.round(om.x) - 2, by, 5, 1);
  ctx.fillRect(Math.round(om.x) - 1, by + 1, 3, 1);
  ctx.fillRect(Math.round(om.x), by + 2, 1, 1);
}

/**
 * @param {CanvasRenderingContext2D} ctx @param {World} world @param {Sprites} spr
 * @param {HTMLCanvasElement} ground @param {Flake[]} snow @param {number} t  clock, for animation
 */
export function drawWorld(ctx, world, spr, ground, snow, t) {
  ctx.drawImage(ground, 0, 0);
  drawSnow(ctx, snow, false);

  const carrying = world.line.some((p) => p.food);
  drawDeliveryRing(ctx, world.oldMan, carrying, t);

  // food on the ground
  for (const f of world.foods) {
    const s = spr.food[f.kind];
    const pop = f.pop > 0 ? Math.round(f.pop * 20) : 0;
    const glint = f.delay > 0 && Math.floor(f.delay * 12) % 2;
    if (glint) continue;
    shadow(ctx, f.x, f.y, 6);
    ctx.drawImage(s.img, Math.round(f.x - s.w / 2), Math.round(f.y - s.h - pop + Math.sin(f.t * 3) * 0.6));
  }

  // y-sorted scene
  /** @type {{ y: number, draw: () => void }[]} drawn back to front */
  const items = [];
  for (const o of world.obstacles) {
    const y = o.kind === 'wall' ? o.y + o.h / 2 : o.y;
    items.push({ y, draw: () => drawObstacle(ctx, spr, o) });
  }
  items.push({ y: world.oldMan.y, draw: () => drawOldManSprite(ctx, spr, world.oldMan) });
  for (const pg of world.pages) {
    items.push({ y: pg.y, draw: () => { shadow(ctx, pg.x, pg.y - 1); drawPage(ctx, spr, pg); } });
  }
  for (const rob of world.robbers) {
    items.push({ y: rob.y, draw: () => { shadow(ctx, rob.x, rob.y - 1); drawRobber(ctx, spr, rob); } });
  }
  for (const wf of world.wolves) {
    items.push({ y: wf.y, draw: () => { shadow(ctx, wf.x, wf.y - 1, 11); drawWolf(ctx, spr, wf); } });
  }
  for (const ar of world.archers) {
    items.push({ y: ar.y, draw: () => { shadow(ctx, ar.x, ar.y - 1); drawArcher(ctx, spr, ar); } });
  }
  const boss = world.boss;
  if (boss) {
    items.push({
      y: boss.y,
      draw: () => {
        if (boss.kind === 'mary') {
          const dug = boss.state === 'rise' || boss.state === 'split';
          shadow(ctx, boss.x, boss.y - 1, dug ? 30 : 17);
          drawMary(ctx, spr, boss, world.time);
        } else {
          shadow(ctx, boss.x, boss.y - 1, boss.state === 'roll' ? 24 : 20);
          drawFrosty(ctx, spr, boss, world.time);
        }
      },
    });
  }
  for (const c of world.shower) {
    items.push({
      y: c.y,
      draw: () => {
        if (c.life < 0.4 && Math.floor(c.life * 20) % 2) return;   // blinks out at the end
        shadow(ctx, c.x, c.y, c.big ? 5 : 3);
        drawSnowball(ctx, c.x, c.y - c.z - 3, c.big);
      },
    });
  }
  for (const a of world.arrows) items.push({ y: a.y, draw: () => drawArrow(ctx, a) });
  const k = world.king;
  items.push({
    y: k.y,
    draw: () => {
      shadow(ctx, k.x, k.y - 1, 9);
      const blink = k.inv > 0 && Math.floor(k.inv * 20) % 2;
      const behind = Math.sin(k.swingT > 0 ? k.swingAngle : k.aim) < -0.3;
      if (behind) drawSword(ctx, k);
      if (!blink) blitChar(ctx, spr.king, k, { moving: k.moving });
      if (!behind) drawSword(ctx, k);
    },
  });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  drawSwingArc(ctx, k);

  for (const p of world.particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  }
  for (const tx of world.texts) {
    if (tx.life < 0.3 && Math.floor(tx.life * 20) % 2) continue;
    drawText(ctx, tx.text, tx.x, tx.y, tx.color, { align: 'center' });
  }
  drawSnow(ctx, snow, true);
}

/** @param {CanvasRenderingContext2D} ctx @param {Sprites} spr @param {Obstacle} o */
function drawObstacle(ctx, spr, o) {
  if (o.kind === 'tree') {
    const s = spr.trees[o.variant];
    shadow(ctx, o.x, o.y - 1, 13);
    ctx.drawImage(s.img, Math.round(o.x - 8), Math.round(o.y - s.h + 1));
  } else if (o.kind === 'rock') {
    const s = spr.rock;
    ctx.drawImage(s.img, Math.round(o.x - s.w / 2), Math.round(o.y - s.h + 3));
  } else drawWall(ctx, o);
}

// The status line, drawn straight over the ground at the top of the screen, in big text with a drop
// shadow so it reads on snow: the night, health, food delivered, pages in the line, and the score.
// While a boss is out, his health bar sits at the bottom.
/** @param {CanvasRenderingContext2D} ctx @param {World} world @param {Sprites} spr @param {number} score */
export function drawHud(ctx, world, spr, score) {
  const S = 2, ty = 2;
  const night = 'NIGHT ' + world.night + (world.hard ? ' (HARD)' : '');
  drawText(ctx, night, 6, ty, PAL.w, { scale: S });

  // health: one block for each point, shrinking if there are many
  const k = world.king;
  const hx = 6 + textWidth(night, S) + 16;
  drawText(ctx, 'HP', hx, ty, PAL.n, { scale: S });
  const pitch = Math.max(6, Math.min(12, Math.floor(70 / CFG.kingMaxHp)));
  const gx = hx + textWidth('HP', S) + 5;
  const low = k.hp <= Math.ceil(CFG.kingMaxHp / 3);
  for (let i = 0; i < CFG.kingMaxHp; i++) {
    ctx.fillStyle = PAL.k;
    ctx.fillRect(gx + i * pitch, ty - 1, pitch - 1, 12);
    ctx.fillStyle = i < k.hp ? (low ? PAL.o : PAL.r) : PAL.D;
    ctx.fillRect(gx + i * pitch + 1, ty, pitch - 3, 10);
    if (i < k.hp) { ctx.fillStyle = low ? PAL.y : '#e8707e'; ctx.fillRect(gx + i * pitch + 1, ty, pitch - 3, 2); }   // a lit top edge
  }

  // food delivered
  const fs = spr.food.bread;
  const txt = world.delivered + '/' + world.p.foodTarget;
  const cx = W / 2;
  const tw = textWidth(txt, S);
  ctx.drawImage(fs.img, Math.round(cx - tw / 2 - fs.w * 2 - 4), ty - 1, fs.w * 2, fs.h * 2);
  drawText(ctx, txt, cx, ty, PAL.y, { scale: S, align: 'center' });

  // pages in the line
  drawText(ctx, 'PAGES ' + world.line.length, cx + 70, ty, PAL.l, { scale: S });

  drawText(ctx, String(score).padStart(6, '0'), W - 6, ty, PAL.w, { scale: S, align: 'right' });

  const boss = world.boss;
  if (boss && boss.state !== 'dying') {
    const bw = 200, bx = Math.round((W - bw) / 2), by = H - 16;
    drawText(ctx, boss.kind.toUpperCase(), W / 2, by - 12, PAL.w, { align: 'center' });
    ctx.fillStyle = PAL.k;
    ctx.fillRect(bx - 1, by - 1, bw + 2, 10);
    ctx.fillStyle = PAL.D;
    ctx.fillRect(bx, by, bw, 8);
    ctx.fillStyle = boss.flash > 0 ? PAL.w : PAL.c;
    ctx.fillRect(bx, by, Math.round((bw * Math.max(0, boss.hp)) / boss.maxHp), 8);
    ctx.fillStyle = PAL.C;
    ctx.fillRect(bx, by, Math.round((bw * Math.max(0, boss.hp)) / boss.maxHp), 2);
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y */
export function drawCrosshair(ctx, x, y) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = PAL.k;
  ctx.fillRect(x - 4, y, 3, 1); ctx.fillRect(x + 2, y, 3, 1);
  ctx.fillRect(x, y - 4, 1, 3); ctx.fillRect(x, y + 2, 1, 3);
  ctx.fillStyle = PAL.w;
  ctx.fillRect(x - 3, y, 2, 1); ctx.fillRect(x + 2, y, 2, 1);
  ctx.fillRect(x, y - 3, 1, 2); ctx.fillRect(x, y + 2, 1, 2);
}

// A simple centred panel of text lines (the banner at the start of each night).
// Each line is plain text, [text, colour, scale], or null for a gap.
/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {(string | [string, string, number?] | null)[]} lines
 * @param {{ scale?: number, width?: number }} [opts]
 */
export function drawPanel(ctx, lines, opts = {}) {
  const lh = 10 * (opts.scale || 1);
  const h = lines.length * lh + 16;
  const w = opts.width || 260;
  const x = Math.round((W - w) / 2), y = Math.round((H - h) / 2);
  ctx.fillStyle = 'rgba(26,28,44,0.85)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAL.y;
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  lines.forEach((l, i) => {
    if (!l) return;
    const [text, color, scale] = typeof l === 'string' ? [l, PAL.w, 1] : l;
    drawText(ctx, text, W / 2, y + 9 + i * lh, color, { align: 'center', scale: scale || 1 });
  });
}
