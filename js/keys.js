// Keyboard bindings: which keys do what in play. Each function can have up to MAX_KEYS keys, stored as
// KeyboardEvent.code values (the physical key, so the numeric keypad works with NumLock on or off).
// The menus are not here: they always use the arrow keys, W/S, Enter, Space and Escape, so no binding can lock
// anyone out of them. The editor (screens.js) works on these functions; input.js and main.js read them.

export const MAX_KEYS = 3;

// Keys that can't be bound: Escape is "go back" everywhere (and always pauses), Backquote opens the dev console.
export const RESERVED = ['Escape', 'Backquote'];

/** @typedef {Record<string, string[]>} Bindings  function id -> MAX_KEYS key codes, '' for an empty slot */

/** @type {{ id: string, label: string }[]} */
export const ACTIONS = [
  { id: 'up', label: 'MOVE UP' },
  { id: 'down', label: 'MOVE DOWN' },
  { id: 'left', label: 'MOVE LEFT' },
  { id: 'right', label: 'MOVE RIGHT' },
  { id: 'swing', label: 'SWING WHERE AIMED' },
  { id: 'atkN', label: 'SWING UP' },
  { id: 'atkS', label: 'SWING DOWN' },
  { id: 'atkW', label: 'SWING LEFT' },
  { id: 'atkE', label: 'SWING RIGHT' },
  { id: 'atkNW', label: 'SWING UP-LEFT' },
  { id: 'atkNE', label: 'SWING UP-RIGHT' },
  { id: 'atkSW', label: 'SWING DOWN-LEFT' },
  { id: 'atkSE', label: 'SWING DOWN-RIGHT' },
  { id: 'pause', label: 'PAUSE' },
  { id: 'mute', label: 'MUTE' },
  { id: 'fullscreen', label: 'FULLSCREEN' },
];

// Which way each move or swing function points: [x, y], y down.
/** @type {Record<string, [number, number]>} */
export const MOVE_DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
/** @type {Record<string, [number, number]>} */
export const ATTACK_DIRS = {
  atkN: [0, -1], atkS: [0, 1], atkW: [-1, 0], atkE: [1, 0],
  atkNW: [-1, -1], atkNE: [1, -1], atkSW: [-1, 1], atkSE: [1, 1],
};

// The arrow keys swing in the four directions; the numeric keypad swings in all eight (and 5 or 0 swings where
// aimed). WASD moves.
/** @type {Record<string, string[]>} */
const DEFAULTS = {
  up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
  swing: ['Space', 'Numpad5', 'Numpad0'],
  atkN: ['ArrowUp', 'Numpad8'], atkS: ['ArrowDown', 'Numpad2'], atkW: ['ArrowLeft', 'Numpad4'], atkE: ['ArrowRight', 'Numpad6'],
  atkNW: ['Numpad7'], atkNE: ['Numpad9'], atkSW: ['Numpad1'], atkSE: ['Numpad3'],
  pause: ['KeyP'], mute: ['KeyM'], fullscreen: ['KeyF'],
};

/** @param {string[]} keys */
const pad = (keys) => Array.from({ length: MAX_KEYS }, (_, i) => keys[i] ?? '');

/** @returns {Bindings} a fresh copy of the defaults */
export function defaultBindings() {
  return Object.fromEntries(ACTIONS.map(({ id }) => [id, pad(DEFAULTS[id])]));
}
export const DEFAULT_BINDINGS = defaultBindings();

// Anything (probably read back from storage, so possibly corrupt) -> valid bindings: every function present with
// MAX_KEYS slots, strings only, nothing reserved, and no key on two functions (the first keeps it). A function
// missing altogether gets its defaults, unless one of those keys has been taken by another function.
/** @param {unknown} raw @returns {Bindings} */
export function cleanBindings(raw) {
  const src = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  /** @type {Bindings} */
  const out = {};
  const used = new Set(RESERVED);
  /** @param {unknown[]} list */
  const take = (list) => pad(list.map((c) => {
    if (typeof c !== 'string' || !c || c.length > 24 || used.has(c)) return '';
    used.add(c);
    return c;
  }));
  for (const { id } of ACTIONS) if (Array.isArray(src[id])) out[id] = take(src[id].slice(0, MAX_KEYS));
  for (const { id } of ACTIONS) if (!out[id]) out[id] = take(DEFAULTS[id]);
  return out;
}

// Put a key (or '' to clear) in one slot of one function. A key is only ever on one function, so it is taken off
// whichever had it; that function's label comes back as `lost` (null if nothing lost it). Null if the key is reserved.
/** @param {Bindings} bindings @param {string} id @param {number} slot @param {string} code
 *  @returns {{ bindings: Bindings, lost: string | null } | null} */
export function bindKey(bindings, id, slot, code) {
  if (code && RESERVED.includes(code)) return null;
  /** @type {Bindings} */
  const next = {};
  /** @type {string | null} */
  let lost = null;
  for (const a of ACTIONS) {
    next[a.id] = bindings[a.id].map((c) => {
      if (code && c === code) { if (a.id !== id) lost = a.label; return ''; }
      return c;
    });
  }
  next[id][slot] = code;
  return { bindings: next, lost };
}

// The names of keys as drawn in the 3x5 font (see font.js): capitals, digits and a little punctuation.
/** @type {Record<string, string>} */
const NAMES = {
  Space: 'SPACE', Enter: 'ENTER', Tab: 'TAB', Backspace: 'BKSP', Delete: 'DEL', Insert: 'INS', Home: 'HOME', End: 'END',
  PageUp: 'PGUP', PageDown: 'PGDN', CapsLock: 'CAPS', ContextMenu: 'MENU',
  ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
  ShiftLeft: 'L SHIFT', ShiftRight: 'R SHIFT', ControlLeft: 'L CTRL', ControlRight: 'R CTRL', AltLeft: 'L ALT', AltRight: 'R ALT',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.',
  Slash: '/', Backslash: 'BSLASH', Backquote: '`', IntlBackslash: 'BSLASH',
  NumpadAdd: 'NUM +', NumpadSubtract: 'NUM -', NumpadMultiply: 'NUM *', NumpadDivide: 'NUM /', NumpadDecimal: 'NUM .',
  NumpadEnter: 'NUM ENTER', NumLock: 'NUMLOCK',
};

/** @param {string} code @returns {string} */
export function keyName(code) {
  if (!code) return '---';
  if (NAMES[code]) return NAMES[code];
  let m = /^Key([A-Z])$/.exec(code) || /^Digit(\d)$/.exec(code) || /^F(\d\d?)$/.exec(code);
  if (m) return code.startsWith('F') ? code : m[1];
  m = /^Numpad(\d)$/.exec(code);
  if (m) return 'NUM ' + m[1];
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9) || '?';
}
