// Menu and overlay screens: title, pause, end of night, game over, ending,
// initials entry and the high score table.
//
// Each screen is an object with:
//   overlay          true if the frozen/running game is drawn underneath it
//   enter(data)      called when the screen becomes active
//   update(dt)       reads input through env.input
//   draw(ctx)
//
// env (provided by main.js): { input, events, spr, scores, snow, backdrop, go, actions }
// Sound hooks: screens push 'menuMove' and 'menuSelect' into env.events.

import { W, H } from './config.js';
import { PAL } from './sprites.js';
import { drawText, textWidth } from './font.js';
import { drawSnow } from './render.js';

const DIM = 'rgba(26,28,44,0.6)';
const hit = (r, p) => p && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function fmtTime(s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ':' + String(r).padStart(2, '0');
}

// ---------- small drawing helpers ----------

// 7-pixel triangle pointing up, down, left or right, centred on (cx, cy).
function tri(ctx, cx, cy, dir, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    if (dir === 'up') ctx.fillRect(cx - i, cy - 2 + i, 2 * i + 1, 1);
    else if (dir === 'down') ctx.fillRect(cx - (3 - i), cy - 2 + i, 7 - 2 * i, 1);
    else if (dir === 'right') ctx.fillRect(cx - 2 + i, cy - (3 - i), 1, 7 - 2 * i);
    else ctx.fillRect(cx + 2 - i, cy - (3 - i), 1, 7 - 2 * i);
  }
}

function box(ctx, x, y, w, h, fill = 'rgba(26,28,44,0.88)', edge = PAL.y) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = edge;
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
}

function dim(ctx) {
  ctx.fillStyle = DIM;
  ctx.fillRect(0, 0, W, H);
}

function backdrop(ctx, env, dimmed = true) {
  ctx.drawImage(env.backdrop, 0, 0);
  drawSnow(ctx, env.snow, false);
  if (dimmed) dim(ctx);
  drawSnow(ctx, env.snow, true);
}

// Title with a hard drop shadow.
function bigText(ctx, str, y, color, scale, shadowColor = PAL.k) {
  drawText(ctx, str, W / 2 + scale / 2 + 1, y + scale / 2 + 1, shadowColor, { scale, align: 'center', shadow: false });
  drawText(ctx, str, W / 2, y, color, { scale, align: 'center', shadow: false });
}

// Small centred text on a dark strip, so it stays legible on any backdrop.
function caption(ctx, str, y, color = PAL.w) {
  const w = textWidth(str) + 10;
  ctx.fillStyle = 'rgba(26,28,44,0.78)';
  ctx.fillRect(Math.round(W / 2 - w / 2), y - 3, w, 11);
  drawText(ctx, str, W / 2, y, color, { align: 'center', shadow: false });
}

function blink(t, rate = 2) { return Math.floor(t * rate) % 2 === 0; }

// ---------- vertical menu ----------

class Menu {
  constructor(env, labels, { y, scale = 2, lh = 20 }) {
    this.env = env;
    this.labels = labels;
    this.y = y;
    this.scale = scale;
    this.lh = lh;
    this.sel = 0;
    this.lastMouse = null;
  }

  rect(i) {
    const w = textWidth(this.labels[i], this.scale) + 36;
    return { x: W / 2 - w / 2, y: this.y + i * this.lh - 4, w, h: 5 * this.scale + 8 };
  }

  move(d) {
    this.sel = (this.sel + d + this.labels.length) % this.labels.length;
    this.env.events.push('menuMove');
  }

  // keys: key codes already taken from the input. Returns the chosen index, or -1.
  update(keys) {
    const { input, events } = this.env;
    let choice = -1;
    for (const k of keys) {
      if (k === 'ArrowUp' || k === 'KeyW') this.move(-1);
      else if (k === 'ArrowDown' || k === 'KeyS') this.move(1);
      else if (k === 'Enter' || k === 'Space') choice = this.sel;
    }
    // The mouse only moves the highlight when it actually moves, so the
    // keyboard still works with the pointer resting over the menu.
    const m = input.st.mouse;
    if (input.st.mouseSeen && (!this.lastMouse || m.x !== this.lastMouse.x || m.y !== this.lastMouse.y)) {
      this.lastMouse = { x: m.x, y: m.y };
      for (let i = 0; i < this.labels.length; i++) {
        if (hit(this.rect(i), m) && i !== this.sel) { this.sel = i; events.push('menuMove'); }
      }
    }
    const click = input.takeClick();
    if (click) {
      for (let i = 0; i < this.labels.length; i++) {
        if (hit(this.rect(i), click)) { this.sel = i; choice = i; }
      }
    }
    if (choice >= 0) events.push('menuSelect');
    return choice;
  }

  draw(ctx, t = 0) {
    this.labels.forEach((label, i) => {
      const y = this.y + i * this.lh;
      const on = i === this.sel;
      drawText(ctx, label, W / 2, y, on ? PAL.y : PAL.w, { scale: this.scale, align: 'center' });
      if (on) {
        const half = textWidth(label, this.scale) / 2 + 12 + (blink(t, 3) ? 0 : 1);
        const cy = y + (5 * this.scale) / 2;
        tri(ctx, Math.round(W / 2 - half), Math.round(cy), 'right', PAL.y);
        tri(ctx, Math.round(W / 2 + half), Math.round(cy), 'left', PAL.y);
      }
    });
  }
}

// ---------- title ----------

const TITLE_TREES = [[40, 250, 0], [95, 205, 1], [150, 262, 0], [480, 258, 1], [540, 208, 0], [600, 252, 1], [30, 160, 1], [610, 150, 0]];

function titleScreen(env) {
  const s = { overlay: false, t: 0 };
  let menu, actions;

  s.enter = () => {
    s.t = 0;
    const items = [['START', () => env.actions.newGame(false)]];
    if (env.scores.hardUnlocked()) items.push(['HARD MODE', () => env.actions.newGame(true)]);
    items.push(['HIGH SCORES', () => env.go('highscores', { highlight: 0 })]);
    actions = items.map((i) => i[1]);
    menu = new Menu(env, items.map((i) => i[0]), { y: 150 });
  };

  s.update = (dt) => {
    s.t += dt;
    const keys = env.input.takeKeys();
    const c = menu.update(keys);
    if (c >= 0) actions[c]();
  };

  s.draw = (ctx) => {
    ctx.drawImage(env.backdrop, 0, 0);
    drawSnow(ctx, env.snow, false);
    for (const [x, y, v] of TITLE_TREES) {
      const tr = env.spr.trees[v];
      ctx.fillStyle = 'rgba(41,54,111,0.35)';
      ctx.fillRect(x - 6, y - 1, 13, 2);
      ctx.drawImage(tr.img, x - 8, y - tr.h + 1);
    }
    bigText(ctx, 'WENCESLAS', 36, PAL.y, 6, PAL.r);
    drawText(ctx, 'A WINTER NIGHT\'S ERRAND', W / 2, 92, PAL.w, { scale: 2, align: 'center' });
    menu.draw(ctx, s.t);

    caption(ctx, 'WASD OR ARROWS AND ENTER, OR USE THE MOUSE', 262);

    // The king leads a line of pages across the bottom of the screen.
    const speed = 34, span = W + 150;
    const kx = ((s.t * speed) % span) - 40;
    const fi = Math.floor(s.t * 6) % 2;
    const base = 336;
    const put = (spr, x, y) => ctx.drawImage(spr.frames[fi].normal, Math.round(x - spr.w / 2), Math.round(y - spr.h + 1 - fi));
    for (let i = 4; i >= 1; i--) {
      const x = kx - i * 14, y = base + Math.sin(s.t * 3 + i) * 1.5;
      put(env.spr.page, x, y);
      if (i % 2) {
        const f = env.spr.food.bread;
        ctx.drawImage(f.img, Math.round(x - f.w / 2), Math.round(y - 13 - f.h));
      }
    }
    put(env.spr.king, kx, base);
    drawSnow(ctx, env.snow, true);
  };
  return s;
}

// ---------- pause ----------

function pauseScreen(env) {
  const s = { overlay: true, t: 0 };
  let menu;
  s.enter = () => {
    s.t = 0;
    menu = new Menu(env, ['RESUME', 'QUIT TO TITLE'], { y: 150 });
  };
  s.update = (dt) => {
    s.t += dt;
    const keys = env.input.takeKeys();
    if (keys.includes('Escape') || keys.includes('KeyP')) { env.events.push('menuSelect'); env.actions.resume(); return; }
    const c = menu.update(keys);
    if (c === 0) env.actions.resume();
    else if (c === 1) env.actions.quitToTitle();
  };
  s.draw = (ctx) => {
    dim(ctx);
    box(ctx, W / 2 - 110, 86, 220, 120);
    drawText(ctx, 'PAUSED', W / 2, 100, PAL.y, { scale: 3, align: 'center' });
    menu.draw(ctx, s.t);
    drawText(ctx, 'ESC TO RESUME', W / 2, 192, PAL.n, { align: 'center' });
  };
  return s;
}

// ---------- end of night ----------

function nightEndScreen(env) {
  const s = { overlay: true, t: 0, data: null };
  const STEP = 0.6, COUNT = 0.45, ROWS = 5, LOCK = 0.5;
  const END = (ROWS - 1) * STEP + COUNT;

  const rows = () => {
    const { summary: m, score } = s.data;
    const total = m.food + m.kills + m.bonus;
    return [
      { label: 'FOOD (' + m.foodCount + ')', value: m.food },
      { label: 'ROBBERS (' + m.killCount + ')', value: m.kills },
      { label: 'TIME ' + fmtTime(m.time) + ' / PAR ' + fmtTime(m.par), value: m.bonus },
      { label: 'NIGHT TOTAL', value: total, color: PAL.y, rule: true },
      { label: 'SCORE', value: score, color: PAL.l },
    ];
  };

  s.enter = (d) => { s.data = d; s.t = 0; };
  s.done = () => s.t >= END;
  s.update = (dt) => {
    s.t += dt;
    const pressed = env.input.takeKeys().length > 0 || env.input.takeClick();
    if (!pressed || s.t < LOCK) return;
    if (!s.done()) { s.t = END; return; }            // first press: skip the count-up
    env.events.push('menuSelect');
    env.actions.nextNight();                         // second press: continue
  };
  s.draw = (ctx) => {
    dim(ctx);
    const w = 340, h = 158, x = (W - w) / 2, y = (H - h) / 2;
    box(ctx, x, y, w, h);
    const last = s.data.night >= 12;
    drawText(ctx, last ? 'FINAL NIGHT COMPLETE' : 'NIGHT ' + s.data.night + ' COMPLETE', W / 2, y + 12, PAL.y, { scale: 2, align: 'center' });
    rows().forEach((r, i) => {
      const at = i * STEP;
      if (s.t < at) return;
      const f = clamp((s.t - at) / COUNT, 0, 1);
      const ry = y + 40 + i * 17 + (r.rule ? 3 : 0);
      if (r.rule) { ctx.fillStyle = PAL.N; ctx.fillRect(x + 16, ry - 5, w - 32, 1); }
      const col = r.color || PAL.w;
      drawText(ctx, r.label, x + 16, ry, col, { scale: 2 });
      drawText(ctx, String(Math.floor(r.value * f)), x + w - 16, ry, col, { scale: 2, align: 'right' });
    });
    if (s.t >= LOCK) {
      const msg = s.done() ? 'PRESS ENTER OR CLICK TO CONTINUE' : 'PRESS ANY KEY TO SKIP';
      if (!s.done() || blink(s.t, 2)) drawText(ctx, msg, W / 2, y + h - 14, PAL.n, { align: 'center' });
    }
  };
  return s;
}

// ---------- game over ----------

function gameOverScreen(env) {
  const s = { overlay: true, t: 0, data: null };
  s.enter = (d) => { s.data = d; s.t = 0; };
  s.update = (dt) => {
    s.t += dt;
    const pressed = env.input.takeKeys().length > 0 || env.input.takeClick();
    if (pressed && s.t > 1) { env.events.push('menuSelect'); env.actions.finishRun(s.data); }
  };
  s.draw = (ctx) => {
    dim(ctx);
    box(ctx, W / 2 - 130, 96, 260, 150);
    bigText(ctx, 'GAME OVER', 112, PAL.r, 4, PAL.k);
    drawText(ctx, 'YOU REACHED NIGHT ' + s.data.night, W / 2, 158, PAL.w, { scale: 2, align: 'center' });
    drawText(ctx, 'SCORE ' + s.data.score, W / 2, 182, PAL.y, { scale: 2, align: 'center' });
    if (s.t > 1 && blink(s.t, 2)) drawText(ctx, 'PRESS ENTER OR CLICK', W / 2, 222, PAL.n, { align: 'center' });
  };
  return s;
}

// ---------- ending ----------

// A bare winter pear tree with a few pears, drawn once at 1x and scaled up 3x.
function makePearTree() {
  const c = document.createElement('canvas');
  c.width = 40;
  c.height = 44;
  const x = c.getContext('2d');
  const line = (x0, y0, x1, y1, color, dy = 0, every = 1) => {
    const dx = Math.abs(x1 - x0), sy0 = y0 < y1 ? 1 : -1, dyy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1;
    let err = dx + dyy, n = 0;
    x.fillStyle = color;
    for (;;) {
      if (n++ % every === 0) x.fillRect(x0, y0 + dy, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dyy) { err += dyy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy0; }
    }
  };
  const branches = [
    [20, 30, 11, 21], [20, 28, 29, 19], [20, 24, 14, 12], [20, 24, 26, 10], [20, 22, 20, 5],
    [11, 21, 6, 15], [11, 21, 12, 13], [29, 19, 34, 13], [29, 19, 27, 11], [14, 12, 10, 7],
    [26, 10, 31, 6], [14, 12, 17, 8],
  ];
  for (let i = 0; i < 3; i++) line(19 + i, 43, 19 + i, 26, PAL.m);        // trunk, 3px wide
  for (const b of branches) line(...b, PAL.m);
  for (const b of branches) line(...b, PAL.w, -1, 2);                      // snow along the tops
  x.fillStyle = PAL.w;
  x.fillRect(19, 25, 3, 1);
  // pears, each with a leaf
  for (const [px, py] of [[10, 9], [31, 8], [17, 10], [34, 15], [6, 17], [27, 13], [12, 15]]) {
    x.fillStyle = PAL.y; x.fillRect(px, py, 2, 3);
    x.fillStyle = PAL.l; x.fillRect(px + 1, py - 1, 2, 1);
  }
  return c;
}


function endingScreen(env) {
  const s = { overlay: false, t: 0, data: null, tree: null };
  s.enter = (d) => {
    s.data = d;
    s.t = 0;
    s.tree = s.tree || makePearTree();
    env.scores.unlockHard();
  };
  s.update = (dt) => {
    s.t += dt;
    const pressed = env.input.takeKeys().length > 0 || env.input.takeClick();
    if (pressed && s.t > 1.5) { env.events.push('menuSelect'); env.actions.finishRun(s.data); }
  };
  s.draw = (ctx) => {
    backdrop(ctx, env, false);
    const tx = Math.round(W / 2 - 60), ty = 130, base = ty + 44 * 3;
    ctx.fillStyle = 'rgba(41,54,111,0.35)';
    ctx.fillRect(W / 2 - 22, base - 2, 44, 4);
    ctx.drawImage(s.tree, tx, ty, 120, 132);

    // The partridge flutters down from above and settles on the top branch.
    const p = env.spr.partridge;
    const landX = tx + 20 * 3 - (p.w * 3) / 2, landY = ty + 5 * 3 - p.h * 3 + 4;
    const fall = clamp(1 - s.t / 1.6, 0, 1);
    const y = landY - fall * fall * 150 + (fall > 0 ? Math.sin(s.t * 18) * 3 : 0);
    ctx.drawImage(p.img, Math.round(landX + fall * 50), Math.round(y), p.w * 3, p.h * 3);

    bigText(ctx, 'A PARTRIDGE', 24, PAL.y, 4, PAL.r);
    drawText(ctx, 'IN A PEAR TREE', W / 2, 62, PAL.w, { scale: 3, align: 'center' });
    drawText(ctx, 'THE OLD MAN IS WARM AND FED.', W / 2, 282, PAL.w, { scale: 2, align: 'center' });
    drawText(ctx, 'FINAL SCORE ' + s.data.score, W / 2, 304, PAL.l, { scale: 2, align: 'center' });
    if (!s.data.hard) caption(ctx, 'HARD MODE UNLOCKED!', 324, PAL.y);
    if (s.t > 1.5 && blink(s.t, 2)) caption(ctx, 'PRESS ENTER OR CLICK', 341);
    drawSnow(ctx, env.snow, true);
  };
  return s;
}

// ---------- initials entry ----------

function initialsScreen(env) {
  const s = { overlay: false, t: 0, data: null, letters: [0, 0, 0], pos: 0 };
  const SLOT_Y = 168, SLOT_DX = 40;
  const slotX = (i) => W / 2 + (i - 1) * SLOT_DX;
  const upRect = (i) => ({ x: slotX(i) - 14, y: SLOT_Y - 34, w: 28, h: 22 });
  const downRect = (i) => ({ x: slotX(i) - 14, y: SLOT_Y + 28, w: 28, h: 22 });
  const slotRect = (i) => ({ x: slotX(i) - 14, y: SLOT_Y - 10, w: 28, h: 38 });
  const okRect = { x: W / 2 - 34, y: 240, w: 68, h: 24 };

  const bump = (i, d) => { s.letters[i] = (s.letters[i] + d + 26) % 26; env.events.push('menuMove'); };
  const confirm = () => {
    const initials = s.letters.map((n) => String.fromCharCode(65 + n)).join('');
    env.scores.setInitials(initials);
    const rank = env.scores.insert({ initials, score: s.data.score, night: s.data.night, hard: s.data.hard });
    env.events.push('menuSelect');
    env.go('highscores', { highlight: rank });
  };

  s.enter = (d) => {
    s.data = d;
    s.t = 0;
    s.pos = 0;
    s.letters = [...env.scores.lastInitials()].map((c) => c.charCodeAt(0) - 65);
  };

  s.update = (dt) => {
    s.t += dt;
    for (const k of env.input.takeKeys()) {
      if (k === 'ArrowUp') bump(s.pos, 1);
      else if (k === 'ArrowDown') bump(s.pos, -1);
      else if (k === 'ArrowLeft' || k === 'Backspace') { s.pos = Math.max(0, s.pos - 1); env.events.push('menuMove'); }
      else if (k === 'ArrowRight') { s.pos = Math.min(2, s.pos + 1); env.events.push('menuMove'); }
      else if (k === 'Enter') { confirm(); return; }
      else if (/^Key[A-Z]$/.test(k)) {
        s.letters[s.pos] = k.charCodeAt(3) - 65;
        s.pos = Math.min(2, s.pos + 1);
        env.events.push('menuMove');
      }
    }
    const c = env.input.takeClick();
    if (!c) return;
    if (hit(okRect, c)) { confirm(); return; }
    for (let i = 0; i < 3; i++) {
      if (hit(upRect(i), c)) { s.pos = i; bump(i, 1); }
      else if (hit(downRect(i), c)) { s.pos = i; bump(i, -1); }
      else if (hit(slotRect(i), c)) { s.pos = i; env.events.push('menuMove'); }
    }
  };

  s.draw = (ctx) => {
    backdrop(ctx, env);
    bigText(ctx, 'NEW HIGH SCORE!', 34, PAL.y, 4, PAL.r);
    drawText(ctx, 'SCORE ' + s.data.score, W / 2, 84, PAL.w, { scale: 2, align: 'center' });
    drawText(ctx, 'ENTER YOUR INITIALS', W / 2, 114, PAL.n, { align: 'center' });
    for (let i = 0; i < 3; i++) {
      const on = i === s.pos;
      const x = slotX(i);
      tri(ctx, x, SLOT_Y - 22, 'up', on ? PAL.y : PAL.n);
      tri(ctx, x, SLOT_Y + 40, 'down', on ? PAL.y : PAL.n);
      drawText(ctx, String.fromCharCode(65 + s.letters[i]), x, SLOT_Y, on ? PAL.y : PAL.w, { scale: 4, align: 'center' });
      if (!on || blink(s.t, 3)) {
        ctx.fillStyle = on ? PAL.y : PAL.n;
        ctx.fillRect(x - 10, SLOT_Y + 26, 20, 2);
      }
    }
    box(ctx, okRect.x, okRect.y, okRect.w, okRect.h, 'rgba(26,28,44,0.9)', PAL.w);
    drawText(ctx, 'OK', W / 2, okRect.y + 6, PAL.y, { scale: 2, align: 'center' });
    drawText(ctx, 'TYPE LETTERS, OR USE THE ARROW KEYS', W / 2, 290, PAL.n, { align: 'center' });
    drawText(ctx, 'ENTER TO CONFIRM', W / 2, 302, PAL.n, { align: 'center' });
  };
  return s;
}

// ---------- high score table ----------

function highScoresScreen(env) {
  const s = { overlay: false, t: 0, highlight: 0, list: [] };
  s.enter = (d) => {
    s.t = 0;
    s.highlight = d?.highlight || 0;
    s.list = env.scores.load();
  };
  s.update = (dt) => {
    s.t += dt;
    const keys = env.input.takeKeys();
    const click = env.input.takeClick();
    const back = keys.some((k) => k === 'Enter' || k === 'Space' || k === 'Escape') || click;
    if (back && s.t > 0.3) { env.events.push('menuSelect'); env.go('title'); }
  };
  s.draw = (ctx) => {
    backdrop(ctx, env);
    bigText(ctx, 'HIGH SCORES', 18, PAL.y, 4, PAL.r);
    for (let i = 0; i < 10; i++) {
      const y = 66 + i * 21;
      const e = s.list[i];
      const lit = s.highlight === i + 1 && blink(s.t, 4);
      const col = lit ? PAL.w : s.highlight === i + 1 ? PAL.y : PAL.l;
      drawText(ctx, String(i + 1) + '.', 190, y, e ? PAL.n : PAL.N, { scale: 2, align: 'right' });
      if (!e) { drawText(ctx, '---', 208, y, PAL.N, { scale: 2 }); continue; }
      drawText(ctx, e.initials, 208, y, col, { scale: 2 });
      drawText(ctx, String(e.score), 400, y, col, { scale: 2, align: 'right' });
      drawText(ctx, 'NIGHT ' + e.night, 420, y + 3, PAL.n);
      if (e.hard) drawText(ctx, 'HARD', 476, y + 3, PAL.o);
    }
    if (!s.list.length) drawText(ctx, 'NO SCORES YET. GO AND FEED THE OLD MAN!', W / 2, 330, PAL.n, { align: 'center' });
    else if (blink(s.t, 2)) drawText(ctx, 'PRESS ENTER OR CLICK TO RETURN', W / 2, 340, PAL.n, { align: 'center' });
  };
  return s;
}

export function createScreens(env) {
  return {
    title: titleScreen(env),
    paused: pauseScreen(env),
    nightEnd: nightEndScreen(env),
    gameover: gameOverScreen(env),
    ending: endingScreen(env),
    initials: initialsScreen(env),
    highscores: highScoresScreen(env),
  };
}
