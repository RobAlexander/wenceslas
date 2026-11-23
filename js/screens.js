// Menu and overlay screens: title, how to play, pause, end of night, game over,
// ending, high score name entry and the high score table.
//
// Each screen is an object (see the Screen type below) with:
//   overlay          true if the frozen/running game is drawn underneath it
//   enter(data)      called when the screen becomes active
//   update(dt)       reads input through env.input
//   draw(ctx)
//
// env (provided by main.js) is a ScreenEnv. Sound hooks: screens push 'menuMove'
// and 'menuSelect' into env.events.

import { W, H, CFG, NIGHTS } from './config.js';
import { PAL } from './sprites.js';
import { drawText, textWidth } from './font.js';
import { drawSnow } from './render.js';
import { makeCanvas } from './canvas.js';
import { MAX_NAME, NAME_CHARS, cleanName } from './highscores.js';
import { ACTIONS, MAX_KEYS, defaultBindings, bindKey, keyName } from './keys.js';

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ x: number, y: number, w: number, h: number }} Rect */
/** @typedef {ReturnType<typeof import('./sprites.js').loadSprites>} Sprites */
/** @typedef {ReturnType<typeof import('./highscores.js').makeStore>} Scores */
/** @typedef {ReturnType<typeof import('./render.js').makeSnow>} Snow */

/**
 * The part of input.js the screens use.
 * @typedef {object} ScreenInput
 * @property {{ lastDevice: string, mouse: Point, mouseSeen: boolean }} st
 * @property {() => string[]} takeKeys    key codes pressed since the last call
 * @property {() => Point | null} takeClick
 */

/**
 * @typedef {object} NightSummary
 * @property {number} food       points
 * @property {number} foodCount
 * @property {number} kills      points
 * @property {number} killCount
 * @property {number} time       seconds taken
 * @property {number} par
 * @property {number} bonus      points
 */
/** @typedef {{ summary: NightSummary, night: number, score: number }} NightEndData */
/** @typedef {{ score: number, night: number, hard: boolean }} RunResult */
/** @typedef {{ highlight: number }} HighScoresData  highlight: rank to flash, or 0 */

/**
 * What each screen's enter() receives.
 * @typedef {object} ScreenData
 * @property {void} title
 * @property {void} howto
 * @property {void} paused
 * @property {NightEndData} nightEnd
 * @property {RunResult} gameover
 * @property {RunResult} ending
 * @property {RunResult} nameEntry
 * @property {HighScoresData | void} highscores
 */
/** @typedef {keyof ScreenData} ScreenName */

/**
 * @template D
 * @typedef {object} Screen
 * @property {boolean} overlay
 * @property {(data: D) => void} enter
 * @property {(dt: number) => void} update
 * @property {(ctx: CanvasRenderingContext2D) => void} draw
 */

/**
 * @typedef {object} Actions
 * @property {(hard: boolean) => void} newGame
 * @property {() => void} resume
 * @property {() => void} quitToTitle
 * @property {() => void} nextNight
 * @property {(run: RunResult) => void} finishRun   after game over or the ending
 * @property {(mode: 'move' | 'pointer') => void} setMouseAim   saved between sessions
 * @property {(bindings: import('./keys.js').Bindings) => void} setKeyBindings   saved between sessions
 */

/**
 * @typedef {object} ScreenEnv
 * @property {ScreenInput} input
 * @property {string[]} events
 * @property {Sprites} spr
 * @property {Scores} scores
 * @property {Snow} snow
 * @property {HTMLCanvasElement} backdrop
 * @property {<K extends ScreenName>(name: K, data?: ScreenData[K]) => void} go
 * @property {Actions} actions
 */

const DIM = 'rgba(26,28,44,0.6)';
/** @param {Rect} r @param {Point | null} p */
const hit = (r, p) => !!p && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
/** @param {number} v @param {number} a @param {number} b */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** @param {number} s seconds */
export function fmtTime(s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ':' + String(r).padStart(2, '0');
}

// ---------- small drawing helpers ----------

// 7-pixel triangle pointing up, down, left or right, centred on (cx, cy).
/**
 * @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy
 * @param {'up' | 'down' | 'left' | 'right'} dir @param {string} color
 */
function tri(ctx, cx, cy, dir, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    if (dir === 'up') ctx.fillRect(cx - i, cy - 2 + i, 2 * i + 1, 1);
    else if (dir === 'down') ctx.fillRect(cx - (3 - i), cy - 2 + i, 7 - 2 * i, 1);
    else if (dir === 'right') ctx.fillRect(cx - 2 + i, cy - (3 - i), 1, 7 - 2 * i);
    else ctx.fillRect(cx + 2 - i, cy - (3 - i), 1, 7 - 2 * i);
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} w @param {number} h */
function box(ctx, x, y, w, h, fill = 'rgba(26,28,44,0.88)', edge = PAL.y) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = edge;
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
}

/** @param {CanvasRenderingContext2D} ctx */
function dim(ctx) {
  ctx.fillStyle = DIM;
  ctx.fillRect(0, 0, W, H);
}

/** @param {CanvasRenderingContext2D} ctx @param {ScreenEnv} env */
function backdrop(ctx, env, dimmed = true) {
  ctx.drawImage(env.backdrop, 0, 0);
  drawSnow(ctx, env.snow, false);
  if (dimmed) dim(ctx);
  drawSnow(ctx, env.snow, true);
}

// Title with a hard drop shadow.
/**
 * @param {CanvasRenderingContext2D} ctx @param {string} str @param {number} y
 * @param {string} color @param {number} scale
 */
function bigText(ctx, str, y, color, scale, shadowColor = PAL.k) {
  drawText(ctx, str, W / 2 + scale / 2 + 1, y + scale / 2 + 1, shadowColor, { scale, align: 'center', shadow: false });
  drawText(ctx, str, W / 2, y, color, { scale, align: 'center', shadow: false });
}

// Small centred text on a dark strip, so it stays legible on any backdrop.
/** @param {CanvasRenderingContext2D} ctx @param {string} str @param {number} y */
function caption(ctx, str, y, color = PAL.w) {
  const w = textWidth(str) + 10;
  ctx.fillStyle = 'rgba(26,28,44,0.78)';
  ctx.fillRect(Math.round(W / 2 - w / 2), y - 3, w, 11);
  drawText(ctx, str, W / 2, y, color, { align: 'center', shadow: false });
}

// Prompt wording: touch players are told to tap, not to press Enter.
/** @param {ScreenEnv} env @param {string} keyboard @param {string} touch */
const say = (env, keyboard, touch) => (env.input.st.lastDevice === 'touch' ? touch : keyboard);

/** @param {number} t */
function blink(t, rate = 2) { return Math.floor(t * rate) % 2 === 0; }

// Split text into lines of at most n characters, at spaces.
/** @param {string} str @param {number} n */
function wrap(str, n) {
  /** @type {string[]} */
  const lines = [];
  let cur = '';
  for (const word of str.split(' ')) {
    if (cur && cur.length + 1 + word.length > n) { lines.push(cur); cur = word; }
    else cur = cur ? cur + ' ' + word : word;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Any key or click this frame (both are consumed).
/** @param {ScreenEnv} env */
function anyPress(env) {
  const keys = env.input.takeKeys();
  const click = env.input.takeClick();
  return keys.length > 0 || !!click;
}

// Enter, Space, Escape or a click this frame: "go back" on the information screens.
/** @param {ScreenEnv} env */
function backPress(env) {
  const keys = env.input.takeKeys();
  const click = env.input.takeClick();
  return keys.some((k) => k === 'Enter' || k === 'Space' || k === 'Escape') || !!click;
}

// ---------- vertical menu ----------

class Menu {
  /**
   * @param {ScreenEnv} env
   * @param {string[]} labels
   * @param {{ y: number, scale?: number, lh?: number }} opts
   */
  constructor(env, labels, { y, scale = 2, lh = 20 }) {
    this.env = env;
    this.labels = labels;
    this.y = y;
    this.scale = scale;
    this.lh = lh;
    this.sel = 0;
    /** @type {Point | null} */
    this.lastMouse = null;
  }

  /** @param {number} i @returns {Rect} */
  rect(i) {
    const w = textWidth(this.labels[i], this.scale) + 36;
    return { x: W / 2 - w / 2, y: this.y + i * this.lh - 4, w, h: 5 * this.scale + 8 };
  }

  /** @param {number} d */
  move(d) {
    this.sel = (this.sel + d + this.labels.length) % this.labels.length;
    this.env.events.push('menuMove');
  }

  // keys: key codes already taken from the input. Returns the chosen index, or -1.
  /** @param {string[]} keys */
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

  /** @param {CanvasRenderingContext2D} ctx */
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

// ---------- key bindings ----------

const KEY_ROW_Y = 32, KEY_ROW_H = 13;          // the first row, and the spacing
const KEY_LABEL_X = 130;
const KEY_SLOT_X = [290, 366, 442], KEY_SLOT_W = 70;   // each key slot's left edge, and its width

// The key bindings editor: one row per function with MAX_KEYS slots, then RESET and BACK. It covers the whole
// screen, and is shown by the options list (so it is part of the same screen as that, like the options themselves).
/** @param {ScreenEnv} env */
function keysPanel(env) {
  let bindings = env.scores.keyBindings();
  const RESET = ACTIONS.length, BACK = RESET + 1, rows = BACK + 1;
  let row = 0, slot = 0, t = 0;
  let listening = false;
  let note = '';
  /** @type {Point | null} */
  let lastMouse = null;

  /** @param {number} r */
  const rowY = (r) => KEY_ROW_Y + r * KEY_ROW_H;
  /** @param {number} r @param {number} s @returns {Rect} */
  const slotRect = (r, s) => ({ x: KEY_SLOT_X[s] - 3, y: rowY(r) - 3, w: KEY_SLOT_W, h: 11 });
  /** @param {number} r @returns {Rect} */
  const rowRect = (r) => ({ x: KEY_LABEL_X - 6, y: rowY(r) - 3, w: 340, h: 11 });
  /** @param {import('./keys.js').Bindings} b */
  const save = (b) => { bindings = b; env.actions.setKeyBindings(b); };

  const panel = {
    active: false,
    open() {
      this.active = true;
      bindings = env.scores.keyBindings();
      row = 0; slot = 0; t = 0; listening = false; note = '';
      lastMouse = null;
    },
    /** @param {string} code */
    press(code) {
      const { events } = env;
      if (listening) {
        if (code === 'Escape') { listening = false; note = ''; events.push('menuSelect'); return; }
        const id = ACTIONS[row].id;
        const done = bindKey(bindings, id, slot, code);
        if (!done) { note = keyName(code) + ' CANNOT BE USED'; return; }   // still listening
        save(done.bindings);
        listening = false;
        note = done.lost ? keyName(code) + ' WAS ' + done.lost + ': NOW ' + ACTIONS[row].label : keyName(code) + ' SET';
        events.push('menuSelect');
        return;
      }
      if (code === 'Escape') { events.push('menuSelect'); this.active = false; return; }
      const move = (/** @type {number} */ d) => { row = (row + d + rows) % rows; events.push('menuMove'); };
      const slide = (/** @type {number} */ d) => { if (row < RESET) { slot = (slot + d + MAX_KEYS) % MAX_KEYS; events.push('menuMove'); } };
      if (code === 'ArrowUp' || code === 'KeyW') move(-1);
      else if (code === 'ArrowDown' || code === 'KeyS') move(1);
      else if (code === 'ArrowLeft' || code === 'KeyA') slide(-1);
      else if (code === 'ArrowRight' || code === 'KeyD') slide(1);
      else if ((code === 'Backspace' || code === 'Delete') && row < RESET) {
        const done = bindKey(bindings, ACTIONS[row].id, slot, '');
        if (done) { save(done.bindings); note = 'CLEARED'; events.push('menuSelect'); }
      } else if (code === 'Enter' || code === 'Space') this.choose();
    },
    // Act on the highlighted row: start listening for a key, reset, or go back.
    choose() {
      env.events.push('menuSelect');
      if (row < RESET) { listening = true; note = ''; }
      else if (row === RESET) { save(defaultBindings()); note = 'BACK TO THE USUAL KEYS'; }
      else this.active = false;
    },
    // keys: the key codes taken this frame.
    /** @param {string[]} keys */
    update(keys) {
      for (const k of keys) { if (!this.active) break; this.press(k); }
      if (!this.active) return;
      const { input } = env;
      const m = input.st.mouse;
      if (!listening && input.st.mouseSeen && (!lastMouse || m.x !== lastMouse.x || m.y !== lastMouse.y)) {
        lastMouse = { x: m.x, y: m.y };
        for (let r = 0; r < rows; r++) {
          if (!hit(rowRect(r), m)) continue;
          if (r !== row) { row = r; env.events.push('menuMove'); }
          if (r < RESET) for (let s = 0; s < MAX_KEYS; s++) if (hit(slotRect(r, s), m)) slot = s;
        }
      }
      const click = input.takeClick();
      if (click) {
        if (listening) { listening = false; note = ''; return; }   // a click elsewhere gives up waiting
        for (let r = 0; r < rows; r++) {
          if (!hit(rowRect(r), click)) continue;
          row = r;
          if (r < RESET) {
            const s = [0, 1, 2].find((i) => hit(slotRect(r, i), click));
            if (s === undefined) continue;
            slot = s;
          }
          this.choose();
        }
      }
    },
    /** @param {CanvasRenderingContext2D} ctx @param {number} dt */
    draw(ctx, dt) {
      t += dt;
      ctx.fillStyle = 'rgba(26,28,44,0.97)';
      ctx.fillRect(0, 0, W, H);
      drawText(ctx, 'KEYS', W / 2, 6, PAL.y, { scale: 2, align: 'center' });
      for (let s = 0; s < MAX_KEYS; s++) drawText(ctx, 'KEY ' + (s + 1), KEY_SLOT_X[s], 21, PAL.N, { shadow: false });
      for (let r = 0; r < rows; r++) {
        const y = rowY(r), on = r === row;
        const label = r < RESET ? ACTIONS[r].label : r === RESET ? 'RESET TO USUAL KEYS' : 'BACK';
        drawText(ctx, label, KEY_LABEL_X, y, on ? PAL.y : PAL.w, { shadow: false });
        if (on && r >= RESET) tri(ctx, KEY_LABEL_X - 10, y + 2, 'right', PAL.y);
        if (r >= RESET) continue;
        for (let s = 0; s < MAX_KEYS; s++) {
          const here = on && s === slot, waiting = here && listening;
          if (here) {
            const rc = slotRect(r, s);
            ctx.fillStyle = waiting ? 'rgba(255,205,117,0.30)' : 'rgba(244,244,244,0.16)';
            ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
          }
          const code = bindings[ACTIONS[r].id][s];
          if (waiting) { if (blink(t, 3)) drawText(ctx, 'PRESS A KEY', KEY_SLOT_X[s], y, PAL.y, { shadow: false }); }
          else drawText(ctx, keyName(code), KEY_SLOT_X[s], y, code ? (here ? PAL.y : PAL.w) : PAL.N, { shadow: false });
        }
      }
      const y0 = rowY(rows - 1) + 20;
      caption(ctx, say(env,
        listening ? 'PRESS THE KEY YOU WANT    ESC TO CANCEL' : 'ENTER TO CHANGE A KEY    BACKSPACE TO CLEAR    ESC TO GO BACK',
        'THESE ARE KEYBOARD KEYS    TAP BACK TO RETURN'), y0, PAL.n);
      if (note) caption(ctx, note, y0 + 14, PAL.y);
    },
  };
  return panel;
}

// ---------- options ----------

// The options list, shown by the title and pause screens in place of their own menu.
// (It is part of those screens rather than a screen of its own, so the game state and music don't change.)
/** @param {ScreenEnv} env */
function optionsPanel(env) {
  const labels = () => ['MOUSE AIM: ' + (env.scores.mouseAim() === 'move' ? 'MOVE' : 'CURSOR'), 'KEYS', 'BACK'];
  const menu = new Menu(env, labels(), { y: 150 });
  const keysList = keysPanel(env);
  return {
    active: false,
    // true while the keys editor is open: it covers the whole screen, so the screens leave their own things out
    get full() { return keysList.active; },
    /** @param {number} y  where the list starts */
    open(y) {
      this.active = true;
      menu.y = y;
      menu.sel = 0;
      menu.labels = labels();
    },
    // keys: the key codes taken this frame.
    /** @param {string[]} keys */
    update(keys) {
      if (keysList.active) { keysList.update(keys); return; }
      if (keys.includes('Escape')) { env.events.push('menuSelect'); this.active = false; return; }
      const c = menu.update(keys);
      if (c === 0) {
        env.actions.setMouseAim(env.scores.mouseAim() === 'move' ? 'pointer' : 'move');
        menu.labels = labels();
      } else if (c === 1) keysList.open();
      else if (c === 2) this.active = false;
    },
    /** @param {CanvasRenderingContext2D} ctx @param {number} t */
    draw(ctx, t) {
      if (keysList.active) { keysList.draw(ctx, 1 / 60); return; }
      menu.draw(ctx, t);
      const move = env.scores.mouseAim() === 'move';
      caption(ctx, move ? 'MOVE THE MOUSE TO POINT THE SWORD' : 'THE SWORD POINTS AT THE CURSOR', menu.y + 56, PAL.n);
      caption(ctx, 'MOVE MODE WORKS MORE RELIABLY IN FULLSCREEN (PRESS F)', menu.y + 70, PAL.y);
    },
  };
}

// ---------- title ----------

/** @type {[number, number, number][]} x, y, tree variant */
const TITLE_TREES = [[40, 250, 0], [95, 205, 1], [150, 262, 0], [480, 258, 1], [540, 208, 0], [600, 252, 1], [30, 160, 1], [610, 150, 0]];

/** @param {ScreenEnv} env @returns {Screen<void>} */
function titleScreen(env) {
  let t = 0;
  /** @type {[string, () => void][]} */
  let items = [];
  let menu = new Menu(env, [], { y: 150 });
  const options = optionsPanel(env);

  function enter() {
    t = 0;
    options.active = false;
    items = [['START', () => env.actions.newGame(false)]];
    if (env.scores.hardUnlocked()) items.push(['HARD MODE', () => env.actions.newGame(true)]);
    items.push(['OPTIONS', () => options.open(150)]);
    items.push(['HOW TO PLAY', () => env.go('howto')]);
    items.push(['HIGH SCORES', () => env.go('highscores', { highlight: 0 })]);
    menu = new Menu(env, items.map((i) => i[0]), { y: 150 });
  }

  /** @param {number} dt */
  function update(dt) {
    t += dt;
    if (options.active) { options.update(env.input.takeKeys()); return; }
    const c = menu.update(env.input.takeKeys());
    if (c >= 0) items[c][1]();
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    ctx.drawImage(env.backdrop, 0, 0);
    if (options.full) { options.draw(ctx, t); return; }   // the keys editor takes the whole screen
    drawSnow(ctx, env.snow, false);
    for (const [x, y, v] of TITLE_TREES) {
      const tr = env.spr.trees[v];
      ctx.fillStyle = 'rgba(41,54,111,0.35)';
      ctx.fillRect(x - 6, y - 1, 13, 2);
      ctx.drawImage(tr.img, x - 8, y - tr.h + 1);
    }
    bigText(ctx, 'WENCESLAS', 36, PAL.y, 6, PAL.r);
    if (options.active) options.draw(ctx, t);
    else menu.draw(ctx, t);

    caption(ctx, say(env, 'WASD OR ARROWS AND ENTER, OR USE THE MOUSE', 'TAP A BUTTON'), options.active ? 290 : 262);

    // The king leads a line of pages across the bottom of the screen.
    const speed = 34, span = W + 150;
    const kx = ((t * speed) % span) - 40;
    const fi = Math.floor(t * 6) % 2;
    const base = 336;
    /** @param {Sprites['king']} spr @param {number} x @param {number} y */
    const put = (spr, x, y) => ctx.drawImage(spr.frames[fi].normal, Math.round(x - spr.w / 2), Math.round(y - spr.h + 1 - fi));
    for (let i = 4; i >= 1; i--) {
      const x = kx - i * 14, y = base + Math.sin(t * 3 + i) * 1.5;
      put(env.spr.page, x, y);
      if (i % 2) {
        const f = env.spr.food.bread;
        ctx.drawImage(f.img, Math.round(x - f.w / 2), Math.round(y - 13 - f.h));
      }
    }
    put(env.spr.king, kx, base);
    drawSnow(ctx, env.snow, true);
  }

  return { overlay: false, enter, update, draw };
}

// ---------- how to play ----------

const RULES = [
  'DELIVER FOOD TO THE OLD MAN. EACH NIGHT NEEDS A SET AMOUNT, AND THERE ARE ' + NIGHTS + ' NIGHTS.',
  '1. WALK INTO PAGES TO RECRUIT THEM. THEY FOLLOW YOU IN A LINE.',
  '2. WALK OVER FOOD. A PAGE WITH EMPTY HANDS PICKS IT UP.',
  '3. LEAD YOUR LINE TO THE OLD MAN TO HAND THE FOOD OVER.',
  '4. GUARD YOUR PAGES WITH YOUR SWORD. FINISH QUICKLY FOR A TIME BONUS.',
];

/** @type {Record<string, string>} keyed by input.st.lastDevice (the mouse and keyboard text is made from the key bindings) */
const CONTROLS = {
  touch: 'LEFT THUMB MOVES. RIGHT THUMB AIMS, LIFT IT TO SWING. TAP TO SWING AT THE NEAREST ENEMY.',
  pad: 'LEFT STICK MOVES, RIGHT STICK AIMS, RT, RB OR A SWINGS. START PAUSES.',
};

// The lines of controls text for the how to play screen, from the device in use and (for the keyboard) the bindings.
/** @param {ScreenEnv} env @returns {string[]} */
function controlLines(env) {
  const device = env.input.st.lastDevice;
  if (device !== 'mouse') return [CONTROLS[device] || ''];
  const b = env.scores.keyBindings();
  /** @param {string[]} ids @param {string} [sep] */
  const first = (ids, sep = ' ') => ids.map((id) => { const c = b[id].find(Boolean); return c ? keyName(c) : '?'; }).join(sep);
  const diagonals = ['atkNW', 'atkNE', 'atkSW', 'atkSE'].some((id) => b[id].some(Boolean));
  return [
    first(['up', 'left', 'down', 'right']) + ' TO MOVE, MOUSE TO AIM, CLICK TO SWING.',
    first(['atkN', 'atkS', 'atkW', 'atkE'], '/') + ' SWING THE SWORD THAT WAY' + (diagonals ? ', AND SO DO THE DIAGONAL KEYS.' : '.'),
    'ESC OR ' + first(['pause']) + ' PAUSES, ' + first(['mute']) + ' MUTES, ' + first(['fullscreen']) + ' GOES FULLSCREEN. KEYS CAN BE CHANGED IN OPTIONS.',
  ];
}

// The sprite key: [sprites, name, colour, description]. Drawn in two columns.
/** @param {Sprites} spr @returns {Array<[HTMLCanvasElement[], string, string, string]>} */
const legend = (spr) => [
  [[spr.king.frames[0].normal], 'WENCESLAS', PAL.y,
    "THAT'S YOU. " + CFG.kingMaxHp + ' HEALTH: IF IT RUNS OUT, THE GAME IS OVER.'],
  [[spr.page.frames[0].normal], 'PAGE', PAL.l,
    'WALK INTO ONE TO RECRUIT THEM. EACH CARRIES ONE FOOD AND DIES AFTER ' + CFG.pageMaxHp + ' HITS.'],
  [[spr.food.bread.img, spr.food.meat.img, spr.food.wine.img], 'FOOD', PAL.y,
    'BREAD, MEAT AND WINE. A PAGE THAT DIES DROPS THEIR FOOD, SO YOU CAN PICK IT UP AGAIN.'],
  [[spr.oldMan.img], 'THE OLD MAN', PAL.w,
    'FOLLOW THE YELLOW ARROW, AND STEP INSIDE HIS RING TO HAND OVER THE FOOD.'],
  [[spr.robber.frames[0].normal], 'ROBBER', PAL.o,
    'GOES FOR YOUR PAGES, OR FOR YOU IF YOU GET CLOSE. A RED ! MEANS A BLOW IS COMING.'],
  [[spr.archer.frames[0].normal], 'ARCHER', PAL.o,
    'KEEP THEIR DISTANCE AND SHOOT ONLY AT YOU, BADLY. ARROWS CAN HIT PAGES, BUT TREES STOP THEM. THEY ARE SLOW: RUN THEM DOWN.'],
  [[spr.wolf.frames[0].normal], 'WOLF', PAL.n,
    'LEAPS AT A PAGE WITH FOOD, BITES THEM AND RUNS OFF WITH THE FOOD. KILL IT TO GET THE FOOD BACK.'],
  [[spr.trees[0].img, spr.rock.img], 'TREES, ROCKS, WALLS', PAL.n,
    'THEY BLOCK THE WAY, FOR YOU AND YOUR ENEMIES ALIKE.'],
];

/** @param {ScreenEnv} env @returns {Screen<void>} */
function howToScreen(env) {
  let t = 0;

  function enter() { t = 0; }

  /** @param {number} dt */
  function update(dt) {
    t += dt;
    if (backPress(env) && t > 0.3) { env.events.push('menuSelect'); env.go('title'); }
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    backdrop(ctx, env);
    bigText(ctx, 'HOW TO PLAY', 12, PAL.y, 4, PAL.r);
    RULES.forEach((r, i) => drawText(ctx, r, 52, 46 + i * 10, i ? PAL.w : PAL.y));

    legend(env.spr).forEach(([imgs, name, color, text], i) => {
      const col = i < 4 ? 0 : 1, row = i < 4 ? i : i - 4;
      const x = 34 + col * 300, y = 112 + row * 46;
      // Sprites at 2x (scenery at 1x, as it's already large), centred in a slot, feet on a common line.
      const sc = imgs[0].height < 20 ? 2 : 1;
      const gap = 3;
      const total = imgs.reduce((a, im) => a + im.width * sc, 0) + gap * (imgs.length - 1);
      let ix = x + 22 - total / 2;
      for (const im of imgs) {
        ctx.drawImage(im, Math.round(ix), Math.round(y + 30 - im.height * sc), im.width * sc, im.height * sc);
        ix += im.width * sc + gap;
      }
      drawText(ctx, name, x + 52, y, color, { scale: 2 });
      wrap(text, 54).forEach((ln, j) => drawText(ctx, ln, x + 52, y + 14 + j * 9, PAL.w));
    });

    const lines = controlLines(env);
    lines.forEach((ln, i) => caption(ctx, ln, 312 - (lines.length - 1 - i) * 12, PAL.y));
    if (blink(t, 2)) caption(ctx, say(env, 'PRESS ENTER OR CLICK TO RETURN', 'TAP TO RETURN'), 336, PAL.n);
  }

  return { overlay: false, enter, update, draw };
}

// ---------- pause ----------

/** @param {ScreenEnv} env @returns {Screen<void>} */
function pauseScreen(env) {
  let t = 0;
  const labels = ['RESUME', 'OPTIONS', 'QUIT TO TITLE'];
  let menu = new Menu(env, labels, { y: 130 });
  const options = optionsPanel(env);

  function enter() {
    t = 0;
    options.active = false;
    menu = new Menu(env, labels, { y: 130 });
  }

  /** @param {number} dt */
  function update(dt) {
    t += dt;
    const keys = env.input.takeKeys();
    if (options.active) { options.update(keys); return; }
    if (keys.includes('Escape') || keys.some((k) => env.scores.keyBindings().pause.includes(k))) { env.events.push('menuSelect'); env.actions.resume(); return; }
    const c = menu.update(keys);
    if (c === 0) env.actions.resume();
    else if (c === 1) options.open(130);
    else if (c === 2) env.actions.quitToTitle();
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    if (options.full) { options.draw(ctx, t); return; }   // the keys editor takes the whole screen
    dim(ctx);
    box(ctx, W / 2 - 150, 86, 300, 140);
    drawText(ctx, options.active ? 'OPTIONS' : 'PAUSED', W / 2, 100, PAL.y, { scale: 3, align: 'center' });
    if (options.active) options.draw(ctx, t);
    else menu.draw(ctx, t);
    drawText(ctx, say(env, options.active ? 'ESC TO GO BACK    M TO MUTE' : 'ESC TO RESUME    M TO MUTE', options.active ? 'TAP BACK TO RETURN' : 'TAP RESUME TO CONTINUE'), W / 2, 212, PAL.n, { align: 'center' });
  }

  return { overlay: true, enter, update, draw };
}

// ---------- end of night ----------

/** @param {ScreenEnv} env @returns {Screen<NightEndData> & { done(): boolean }} */
function nightEndScreen(env) {
  const STEP = 0.6, COUNT = 0.45, ROWS = 5, LOCK = 0.5;
  const END = (ROWS - 1) * STEP + COUNT;
  let t = 0;
  /** @type {NightEndData} */
  let data = { summary: { food: 0, foodCount: 0, kills: 0, killCount: 0, time: 0, par: 0, bonus: 0 }, night: 1, score: 0 };

  /** @returns {{ label: string, value: number, color?: string, rule?: boolean }[]} */
  function rows() {
    const { summary: m, score } = data;
    const total = m.food + m.kills + m.bonus;
    return [
      { label: 'FOOD (' + m.foodCount + ')', value: m.food },
      { label: 'ENEMIES (' + m.killCount + ')', value: m.kills },
      { label: 'TIME ' + fmtTime(m.time) + ' / PAR ' + fmtTime(m.par), value: m.bonus },
      { label: 'NIGHT TOTAL', value: total, color: PAL.y, rule: true },
      { label: 'SCORE', value: score, color: PAL.l },
    ];
  }

  /** @param {NightEndData} d */
  function enter(d) { data = d; t = 0; }

  // The count-up has finished.
  function done() { return t >= END; }

  /** @param {number} dt */
  function update(dt) {
    t += dt;
    if (!anyPress(env) || t < LOCK) return;
    if (!done()) { t = END; return; }                // first press: skip the count-up
    env.events.push('menuSelect');
    env.actions.nextNight();                         // second press: continue
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    dim(ctx);
    const w = 340, h = 158, x = (W - w) / 2, y = (H - h) / 2;
    box(ctx, x, y, w, h);
    const last = data.night >= NIGHTS;
    drawText(ctx, last ? 'FINAL NIGHT COMPLETE' : 'NIGHT ' + data.night + ' COMPLETE', W / 2, y + 12, PAL.y, { scale: 2, align: 'center' });
    rows().forEach((r, i) => {
      const at = i * STEP;
      if (t < at) return;
      const f = clamp((t - at) / COUNT, 0, 1);
      const ry = y + 40 + i * 17 + (r.rule ? 3 : 0);
      if (r.rule) { ctx.fillStyle = PAL.N; ctx.fillRect(x + 16, ry - 5, w - 32, 1); }
      const col = r.color || PAL.w;
      drawText(ctx, r.label, x + 16, ry, col, { scale: 2 });
      drawText(ctx, String(Math.floor(r.value * f)), x + w - 16, ry, col, { scale: 2, align: 'right' });
    });
    if (t >= LOCK) {
      const msg = done() ? say(env, 'PRESS ENTER OR CLICK TO CONTINUE', 'TAP TO CONTINUE') : say(env, 'PRESS ANY KEY TO SKIP', 'TAP TO SKIP');
      if (!done() || blink(t, 2)) drawText(ctx, msg, W / 2, y + h - 14, PAL.n, { align: 'center' });
    }
  }

  return { overlay: true, enter, update, draw, done };
}

// ---------- game over ----------

/** @type {RunResult} shown only if a screen is drawn before it's entered */
const NO_RUN = { score: 0, night: 1, hard: false };

// A death with a score that makes the table says so, and then leads on to name entry.
/** @param {ScreenEnv} env @returns {Screen<RunResult> & { invited(): boolean }} */
function gameOverScreen(env) {
  let t = 0;
  let data = NO_RUN;
  let invited = false;   // this score makes the high score table

  /** @param {RunResult} d */
  function enter(d) { data = d; t = 0; invited = env.scores.qualifies(d.score); }

  /** @param {number} dt */
  function update(dt) {
    t += dt;
    if (anyPress(env) && t > 1) { env.events.push('menuSelect'); env.actions.finishRun(data); }
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    dim(ctx);
    box(ctx, W / 2 - 130, 96, 260, 150);
    bigText(ctx, 'GAME OVER', 112, PAL.r, 4, PAL.k);
    drawText(ctx, 'YOU REACHED NIGHT ' + data.night, W / 2, 158, PAL.w, { scale: 2, align: 'center' });
    drawText(ctx, 'SCORE ' + data.score, W / 2, 180, PAL.y, { scale: 2, align: 'center' });
    if (invited) drawText(ctx, 'NEW HIGH SCORE!', W / 2, 200, blink(t, 3) ? PAL.l : PAL.y, { scale: 2, align: 'center' });
    if (t > 1 && blink(t, 2)) {
      const msg = invited ? say(env, 'PRESS ENTER TO ENTER YOUR NAME', 'TAP TO ENTER YOUR NAME') : say(env, 'PRESS ENTER OR CLICK', 'TAP TO CONTINUE');
      drawText(ctx, msg, W / 2, 226, PAL.n, { align: 'center' });
    }
  }

  return { overlay: true, enter, update, draw, invited: () => invited };
}

// ---------- ending ----------

// A bare winter pear tree with a few pears, drawn once at 1x and scaled up 3x.
function makePearTree() {
  const { canvas: c, ctx: x } = makeCanvas(40, 44);
  /**
   * @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {string} color
   * @param {number} [dy] offset every pixel vertically
   * @param {number} [every] plot only every nth pixel
   */
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
  /** @type {[number, number, number, number][]} */
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

/** @param {ScreenEnv} env @returns {Screen<RunResult>} */
function endingScreen(env) {
  let t = 0;
  let data = NO_RUN;
  let called = false;
  /** @type {HTMLCanvasElement | null} made on first use */
  let tree = null;

  /** @param {RunResult} d */
  function enter(d) {
    data = d;
    t = 0;
    called = false;
    tree ??= makePearTree();
    env.scores.unlockHard();
  }

  /** @param {number} dt */
  function update(dt) {
    t += dt;
    if (!called && t > 1.0) { called = true; env.events.push('partridge'); }   // as it lands in the tree
    if (anyPress(env) && t > 1.5) { env.events.push('menuSelect'); env.actions.finishRun(data); }
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    backdrop(ctx, env, false);
    const tx = Math.round(W / 2 - 60), ty = 130, base = ty + 44 * 3;
    ctx.fillStyle = 'rgba(41,54,111,0.35)';
    ctx.fillRect(W / 2 - 22, base - 2, 44, 4);
    if (tree) ctx.drawImage(tree, tx, ty, 120, 132);

    // The partridge flutters down from above and settles on the top branch.
    const p = env.spr.partridge;
    const landX = tx + 20 * 3 - (p.w * 3) / 2, landY = ty + 5 * 3 - p.h * 3 + 4;
    const fall = clamp(1 - t / 1.6, 0, 1);
    const y = landY - fall * fall * 150 + (fall > 0 ? Math.sin(t * 18) * 3 : 0);
    ctx.drawImage(p.img, Math.round(landX + fall * 50), Math.round(y), p.w * 3, p.h * 3);

    bigText(ctx, 'A PARTRIDGE', 24, PAL.y, 4, PAL.r);
    drawText(ctx, 'IN A PEAR TREE', W / 2, 62, PAL.w, { scale: 3, align: 'center' });
    drawText(ctx, 'THE OLD MAN IS WARM AND FED.', W / 2, 282, PAL.w, { scale: 2, align: 'center' });
    drawText(ctx, 'FINAL SCORE ' + data.score, W / 2, 304, PAL.l, { scale: 2, align: 'center' });
    if (!data.hard) caption(ctx, 'HARD MODE UNLOCKED!', 324, PAL.y);
    if (t > 1.5 && blink(t, 2)) caption(ctx, say(env, 'PRESS ENTER OR CLICK', 'TAP TO CONTINUE'), 341);
    drawSnow(ctx, env.snow, true);
  }

  return { overlay: false, enter, update, draw };
}

// ---------- high score name entry ----------

// A name of up to MAX_NAME characters. Each slot holds one of NAME_CHARS (a space is an empty slot),
// changed by typing or with the up and down arrows, so touch and gamepad can use it too.
// The name from last time is offered; typing the first character replaces all of it.

/** @param {string} code a key code @returns {string | null} the character that key types, if any */
function charForKey(code) {
  const m = /^(?:Key([A-Z])|Digit(\d)|Numpad(\d))$/.exec(code);
  if (m) return m[1] ?? m[2] ?? m[3];
  return code === 'Space' ? ' ' : code === 'Minus' || code === 'NumpadSubtract' ? '-' : code === 'Period' || code === 'NumpadDecimal' ? '.' : null;
}

/** @param {ScreenEnv} env @returns {Screen<RunResult> & { name(): string }} */
function nameEntryScreen(env) {
  const SLOT_Y = 168, SLOT_DX = 40;
  /** @param {number} i */
  const slotX = (i) => W / 2 + (i - (MAX_NAME - 1) / 2) * SLOT_DX;
  /** @param {number} i @returns {Rect} */
  const upRect = (i) => ({ x: slotX(i) - 14, y: SLOT_Y - 34, w: 28, h: 22 });
  /** @param {number} i @returns {Rect} */
  const downRect = (i) => ({ x: slotX(i) - 14, y: SLOT_Y + 28, w: 28, h: 22 });
  /** @param {number} i @returns {Rect} */
  const slotRect = (i) => ({ x: slotX(i) - 14, y: SLOT_Y - 10, w: 28, h: 38 });
  const okRect = { x: W / 2 - 34, y: 240, w: 68, h: 24 };

  let t = 0;
  let data = NO_RUN;
  let pos = 0;        // the slot being edited
  let fresh = true;   // nothing has been edited yet: the first typed character starts a new name
  /** @type {number[]} each slot's character, as an index into NAME_CHARS (0 is a space) */
  let slots = new Array(MAX_NAME).fill(0);

  // The name so far, as it would be saved ('' if every slot is empty).
  function name() { return cleanName(slots.map((i) => NAME_CHARS[i]).join('')); }

  /** @param {number} i @param {number} d */
  function bump(i, d) {
    fresh = false;
    slots[i] = (slots[i] + d + NAME_CHARS.length) % NAME_CHARS.length;
    env.events.push('menuMove');
  }

  /** @param {string} ch */
  function type(ch) {
    if (fresh) slots.fill(0);
    fresh = false;
    slots[pos] = NAME_CHARS.indexOf(ch);
    pos = Math.min(MAX_NAME - 1, pos + 1);
    env.events.push('menuMove');
  }

  function backspace() {
    if (fresh) slots.fill(0);                         // wipe the offered name
    else {
      if (pos > 0 && slots[pos] === 0) pos--;
      slots[pos] = 0;
    }
    if (fresh) pos = 0;
    fresh = false;
    env.events.push('menuMove');
  }

  function confirm() {
    const n = name();
    if (!n) return;                                   // there has to be a name
    env.scores.setName(n);
    const rank = env.scores.insert({ name: n, score: data.score, night: data.night, hard: data.hard });
    env.events.push('menuSelect');
    env.go('highscores', { highlight: rank });
  }

  /** @param {RunResult} d */
  function enter(d) {
    data = d;
    t = 0;
    pos = 0;
    fresh = true;
    slots = [...env.scores.lastName().padEnd(MAX_NAME, ' ')].map((c) => Math.max(0, NAME_CHARS.indexOf(c)));
  }

  /** @param {number} dt */
  function update(dt) {
    t += dt;
    for (const k of env.input.takeKeys()) {
      const ch = charForKey(k);
      if (k === 'ArrowUp') bump(pos, 1);
      else if (k === 'ArrowDown') bump(pos, -1);
      else if (k === 'ArrowLeft') { fresh = false; pos = Math.max(0, pos - 1); env.events.push('menuMove'); }
      else if (k === 'ArrowRight') { fresh = false; pos = Math.min(MAX_NAME - 1, pos + 1); env.events.push('menuMove'); }
      else if (k === 'Backspace') backspace();
      else if (k === 'Enter') { confirm(); return; }
      else if (ch !== null) type(ch);
    }
    const c = env.input.takeClick();
    if (!c) return;
    if (hit(okRect, c)) { confirm(); return; }
    for (let i = 0; i < MAX_NAME; i++) {
      if (hit(upRect(i), c)) { pos = i; bump(i, 1); }
      else if (hit(downRect(i), c)) { pos = i; bump(i, -1); }
      else if (hit(slotRect(i), c)) { fresh = false; pos = i; env.events.push('menuMove'); }
    }
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    backdrop(ctx, env);
    bigText(ctx, 'NEW HIGH SCORE!', 34, PAL.y, 4, PAL.r);
    drawText(ctx, 'SCORE ' + data.score, W / 2, 84, PAL.w, { scale: 2, align: 'center' });
    drawText(ctx, 'ENTER YOUR NAME', W / 2, 114, PAL.n, { align: 'center' });
    for (let i = 0; i < MAX_NAME; i++) {
      const on = i === pos;
      const x = slotX(i);
      tri(ctx, x, SLOT_Y - 22, 'up', on ? PAL.y : PAL.n);
      tri(ctx, x, SLOT_Y + 40, 'down', on ? PAL.y : PAL.n);
      drawText(ctx, NAME_CHARS[slots[i]], x, SLOT_Y, on ? PAL.y : PAL.w, { scale: 4, align: 'center' });
      if (!on || blink(t, 3)) {
        ctx.fillStyle = on ? PAL.y : PAL.n;
        ctx.fillRect(x - 10, SLOT_Y + 26, 20, 2);
      }
    }
    const ok = name() !== '';
    box(ctx, okRect.x, okRect.y, okRect.w, okRect.h, 'rgba(26,28,44,0.9)', ok ? PAL.w : PAL.N);
    drawText(ctx, 'OK', W / 2, okRect.y + 6, ok ? PAL.y : PAL.N, { scale: 2, align: 'center' });
    drawText(ctx, say(env, 'TYPE YOUR NAME (UP TO ' + MAX_NAME + ' CHARACTERS), OR USE THE ARROW KEYS', 'TAP THE ARROWS TO CHANGE A LETTER'), W / 2, 290, PAL.n, { align: 'center' });
    drawText(ctx, say(env, 'ENTER TO CONFIRM', 'THEN TAP OK'), W / 2, 302, PAL.n, { align: 'center' });
  }

  return { overlay: false, enter, update, draw, name };
}

// ---------- high score table ----------

/** @param {ScreenEnv} env @returns {Screen<HighScoresData | void>} */
function highScoresScreen(env) {
  let t = 0;
  let highlight = 0;
  /** @type {ReturnType<Scores['load']>} */
  let list = [];

  /** @param {HighScoresData | void} d */
  function enter(d) {
    t = 0;
    highlight = d ? d.highlight : 0;
    list = env.scores.load();
  }

  /** @param {number} dt */
  function update(dt) {
    t += dt;
    if (backPress(env) && t > 0.3) { env.events.push('menuSelect'); env.go('title'); }
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    backdrop(ctx, env);
    bigText(ctx, 'HIGH SCORES', 18, PAL.y, 4, PAL.r);
    for (let i = 0; i < 10; i++) {
      const y = 66 + i * 21;
      const e = list[i];
      const lit = highlight === i + 1 && blink(t, 4);
      const col = lit ? PAL.w : highlight === i + 1 ? PAL.y : PAL.l;
      drawText(ctx, String(i + 1) + '.', 190, y, e ? PAL.n : PAL.N, { scale: 2, align: 'right' });
      if (!e) { drawText(ctx, '---', 208, y, PAL.N, { scale: 2 }); continue; }
      drawText(ctx, e.name, 208, y, col, { scale: 2 });
      drawText(ctx, String(e.score), 400, y, col, { scale: 2, align: 'right' });
      drawText(ctx, 'NIGHT ' + e.night, 420, y + 3, PAL.n);
      if (e.hard) drawText(ctx, 'HARD', 476, y + 3, PAL.o);
    }
    if (!list.length) drawText(ctx, 'NO SCORES YET. GO AND FEED THE OLD MAN!', W / 2, 330, PAL.n, { align: 'center' });
    else if (blink(t, 2)) drawText(ctx, say(env, 'PRESS ENTER OR CLICK TO RETURN', 'TAP TO RETURN'), W / 2, 340, PAL.n, { align: 'center' });
  }

  return { overlay: false, enter, update, draw };
}

/** @param {ScreenEnv} env */
export function createScreens(env) {
  return {
    title: titleScreen(env),
    howto: howToScreen(env),
    paused: pauseScreen(env),
    nightEnd: nightEndScreen(env),
    gameover: gameOverScreen(env),
    ending: endingScreen(env),
    nameEntry: nameEntryScreen(env),
    highscores: highScoresScreen(env),
  };
}
