// Drawing. Everything is drawn at 640x360 and scaled up by CSS.

import { W, H, HUD_H, CFG } from './config.js';
import { PAL } from './sprites.js';
import { drawText, textWidth } from './font.js';

export function makeGround(rng) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
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

export function makeSnow(rng) {
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

export function updateSnow(flakes, dt, t) {
  for (const f of flakes) {
    f.y += f.vy * dt;
    f.x += Math.sin(t * 0.8 + f.ph) * f.amp * dt + 3 * dt;
    if (f.y > H + 2) { f.y = -2; }
    if (f.x > W + 2) f.x -= W + 4;
  }
}

function drawSnow(ctx, flakes, nearLayer) {
  for (const f of flakes) {
    if (f.near !== nearLayer) continue;
    ctx.fillStyle = f.near ? '#f4f4f4' : '#d5e0ee';
    const s = f.near ? 2 : 1;
    ctx.fillRect(Math.round(f.x), Math.round(f.y), s, s);
  }
}

function blitChar(ctx, spr, e, opts = {}) {
  const moving = opts.moving ?? true;
  const fi = moving ? Math.floor(e.walkT * 8) % 2 : 0;
  const fr = spr.frames[fi];
  const white = opts.flash;
  const img = e.face < 0 ? (white ? fr.whiteFlipped : fr.flipped) : white ? fr.white : fr.normal;
  const bob = moving && fi === 1 ? 1 : 0;
  ctx.drawImage(img, Math.round(e.x - spr.w / 2), Math.round(e.y - spr.h + 1 - bob));
}

function shadow(ctx, x, y, w = 7) {
  ctx.fillStyle = 'rgba(41,54,111,0.35)';
  ctx.fillRect(Math.round(x - w / 2), Math.round(y), w, 2);
}

// Pixel line (Bresenham), so lines stay crisp.
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

function drawSwingArc(ctx, k) {
  if (k.swingT <= 0) return;
  const t = 1 - k.swingT / CFG.swingDuration;
  const px = k.x, py = k.y - 8;
  const start = k.swingAngle - CFG.swingHalfArc;
  const end = start + 2 * CFG.swingHalfArc * t;
  const outer = CFG.swingRange;
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

function drawPage(ctx, spr, pg) {
  if (pg.inv > 0 && Math.floor(pg.inv * 20) % 2) return;
  blitChar(ctx, spr.page, pg, { moving: Math.hypot(pg.vx, pg.vy) > 4, flash: pg.flash > 0 });
  if (pg.food) {
    const f = spr.food[pg.food];
    ctx.drawImage(f.img, Math.round(pg.x - f.w / 2), Math.round(pg.y - 13 - f.h));
  }
}

function drawOldMan(ctx, spr, om, highlight, t) {
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

export function drawWorld(ctx, world, spr, ground, snow, t) {
  ctx.drawImage(ground, 0, 0);
  drawSnow(ctx, snow, false);

  const carrying = world.line.some((p) => p.food);
  drawOldMan(ctx, spr, world.oldMan, carrying, t);

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

export function drawHud(ctx, world, spr, score) {
  ctx.fillStyle = 'rgba(26,28,44,0.65)';
  ctx.fillRect(0, 0, W, HUD_H - 2);

  drawText(ctx, 'NIGHT ' + world.night + (world.hard ? ' (HARD)' : ''), 4, 3, PAL.w);

  // health bar
  const k = world.king;
  const bx = 80, by = 3;
  drawText(ctx, 'HP', bx, by, PAL.n);
  const segs = CFG.kingMaxHp;
  for (let i = 0; i < segs; i++) {
    ctx.fillStyle = PAL.k;
    ctx.fillRect(bx + 12 + i * 5, by - 1, 5, 7);
    ctx.fillStyle = i < k.hp ? (k.hp <= 3 ? PAL.o : PAL.r) : PAL.D;
    ctx.fillRect(bx + 13 + i * 5, by, 3, 5);
  }

  // food progress
  const fs = spr.food.bread;
  const txt = world.delivered + '/' + world.p.foodTarget;
  const cx = W / 2;
  ctx.drawImage(fs.img, cx - textWidth(txt) / 2 - fs.w - 3, 3);
  drawText(ctx, txt, cx, 3, PAL.y, { align: 'center' });

  // pages
  const pgTxt = 'PAGES ' + world.line.length;
  drawText(ctx, pgTxt, cx + 40, 3, PAL.l);

  drawText(ctx, String(score).padStart(6, '0'), W - 4, 3, PAL.w, { align: 'right' });
}

export function drawCrosshair(ctx, x, y) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = PAL.k;
  ctx.fillRect(x - 4, y, 3, 1); ctx.fillRect(x + 2, y, 3, 1);
  ctx.fillRect(x, y - 4, 1, 3); ctx.fillRect(x, y + 2, 1, 3);
  ctx.fillStyle = PAL.w;
  ctx.fillRect(x - 3, y, 2, 1); ctx.fillRect(x + 2, y, 2, 1);
  ctx.fillRect(x, y - 3, 1, 2); ctx.fillRect(x, y + 2, 1, 2);
}

// Simple centred panel used by the placeholder screens in this first build.
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
    const [text, color, scale] = Array.isArray(l) ? l : [l, PAL.w, 1];
    drawText(ctx, text, W / 2, y + 9 + i * lh, color, { align: 'center', scale: scale || 1 });
  });
}
