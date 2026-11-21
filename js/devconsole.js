// Developer console, opened and closed with the ` key (the one with ~ on it, below Esc).
// Type a command and press Enter; HELP lists them. Up and Down recall earlier commands.
// While it's open the game is frozen and every key goes to the console.
//
// The commands themselves are supplied by main.js, which owns the game state:
//   commands = { name: { args: 'N', help: '...', close: bool, run(args) -> string | string[] | void } }
// A command that throws prints its message as an error.

import { W } from './config.js';
import { PAL } from './sprites.js';
import { drawText } from './font.js';

const SHOWN = 14;          // log lines visible
const LH = 9;              // line height
const MAX_INPUT = 70;
const BOX_H = SHOWN * LH + 32;

/**
 * @typedef {object} Command
 * @property {string} help
 * @property {string} [args]     shown by HELP, e.g. 'N (HARD)'
 * @property {boolean} [close]   close the console after it runs
 * @property {(args: string[]) => string | string[] | void} run
 */

/**
 * @typedef {object} DevConsole
 * @property {boolean} open
 * @property {string} line       what is being typed
 * @property {string[]} log
 * @property {string[]} history  earlier commands, newest first
 * @property {number} hist       position in history while recalling, or -1
 * @property {(...lines: (string | string[])[]) => void} print
 * @property {(on?: boolean) => void} toggle
 * @property {(text: string) => void} run
 * @property {(ctx: CanvasRenderingContext2D, t: number) => void} draw
 */

/**
 * @param {{ input: { block(on: boolean): void }, commands: Record<string, Command> }} opts
 * @returns {DevConsole}
 */
export function createConsole({ input, commands }) {
  /** @type {DevConsole} */
  const c = { open: false, line: '', log: [], history: [], hist: -1, print, toggle, run, draw };

  /** @type {DevConsole['print']} */
  function print(...lines) {
    for (const l of lines.flat()) c.log.push(String(l));
    if (c.log.length > 200) c.log.splice(0, c.log.length - 200);
  }

  /** @type {DevConsole['toggle']} */
  function toggle(on = !c.open) {
    c.open = on;
    c.line = '';
    c.hist = -1;
    input.block(on);
  }

  commands.help = {
    help: 'LIST THE COMMANDS',
    run: () => Object.entries(commands).map(([name, cmd]) => (name + (cmd.args ? ' ' + cmd.args : '')).padEnd(22) + cmd.help),
  };
  commands.clear = { help: 'CLEAR THIS LOG', run: () => { c.log.length = 0; } };

  /** @type {DevConsole['run']} */
  function run(text) {
    const [name, ...args] = text.trim().toLowerCase().split(/\s+/);
    if (!name) return;
    c.print('> ' + text.trim());
    if (c.history[0] !== text) c.history.unshift(text);
    if (c.history.length > 30) c.history.pop();
    const cmd = commands[name];
    if (!cmd) { c.print('UNKNOWN COMMAND ' + name + '. TRY HELP.'); return; }
    try {
      const out = cmd.run(args);
      if (out) c.print(out);
      if (cmd.close) c.toggle(false);
    } catch (e) {
      c.print('ERROR: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') {
      e.preventDefault?.();
      if (!e.repeat) c.toggle();
      return;
    }
    if (!c.open || e.ctrlKey || e.metaKey || e.altKey) return;
    let handled = true;
    if (e.code === 'Escape') c.toggle(false);
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') { const t = c.line; c.line = ''; c.hist = -1; c.run(t); }
    else if (e.code === 'Backspace') c.line = c.line.slice(0, -1);
    else if (e.code === 'ArrowUp' && c.history.length) {
      c.hist = Math.min(c.hist + 1, c.history.length - 1);
      c.line = c.history[c.hist];
    } else if (e.code === 'ArrowDown') {
      c.hist = Math.max(c.hist - 1, -1);
      c.line = c.hist < 0 ? '' : c.history[c.hist];
    } else if (e.key?.length === 1) { if (c.line.length < MAX_INPUT) c.line += e.key; }
    else handled = false;
    if (handled) e.preventDefault?.();
  });

  /** @type {DevConsole['draw']} */
  function draw(ctx, t) {
    if (!c.open) return;
    ctx.fillStyle = 'rgba(26,28,44,0.9)';
    ctx.fillRect(0, 0, W, BOX_H);
    ctx.fillStyle = PAL.y;
    ctx.fillRect(0, BOX_H, W, 1);
    drawText(ctx, 'DEV CONSOLE   HELP LISTS COMMANDS   ` OR ESC CLOSES', W - 6, 4, PAL.N, { align: 'right', shadow: false });
    const shown = c.log.slice(-SHOWN);
    shown.forEach((l, i) => {
      const y = BOX_H - 20 - (shown.length - i) * LH;
      drawText(ctx, l, 6, y, l.startsWith('> ') ? PAL.n : l.startsWith('ERROR') || l.startsWith('UNKNOWN') ? PAL.o : PAL.w, { shadow: false });
    });
    const cursor = Math.floor(t * 2.5) % 2 ? '' : '_';
    drawText(ctx, '> ' + c.line + cursor, 6, BOX_H - 12, PAL.y, { shadow: false });
  }

  return c;
}
