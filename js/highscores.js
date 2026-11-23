// High scores and small persistent settings, kept in the browser's localStorage.
// Every access is wrapped in try/catch: storage can be missing, full, blocked
// (private windows) or hold corrupt data, and the game must still work.
// An in-memory copy keeps the table working for the rest of the session.

import { cleanBindings } from './keys.js';

const SCORES_KEY = 'wenceslas.highscores.v1';
const KEYS_KEY = 'wenceslas.keys.v1';
const HARD_KEY = 'wenceslas.hardUnlocked';
const AIM_KEY = 'wenceslas.mouseAim';
const NAME_KEY = 'wenceslas.initials';   // the key predates longer names; it still holds the last name used
export const MAX_SCORES = 10;

// A player's name on the table: up to MAX_NAME of these characters. Initials were once all there was,
// so entries saved by older versions have an `initials` field instead of `name`; both are read.
export const MAX_NAME = 8;
export const NAME_CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.';   // a space first: an empty slot

/** @typedef {{ name: string, score: number, night: number, hard: boolean }} ScoreEntry */
/** @typedef {Pick<Storage, 'getItem' | 'setItem'>} StorageLike */
/** @typedef {'move' | 'pointer'} MouseAim */

// Anything -> a valid name: upper case, only NAME_CHARS, no leading or trailing spaces, at most MAX_NAME.
// An empty result means there was no usable name.
/** @param {unknown} v */
export function cleanName(v) {
  const kept = [...String(v ?? '').toUpperCase()].filter((c) => NAME_CHARS.includes(c)).join('');
  return kept.trim().slice(0, MAX_NAME).trim();
}

/** @param {unknown} raw  anything, possibly corrupt, read back from storage @returns {ScoreEntry | null} */
function cleanEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const e = /** @type {Record<string, unknown>} */ (raw);
  const name = cleanName(e.name ?? e.initials);
  const score = Number(e.score);
  if (!name || !Number.isFinite(score) || score < 0) return null;
  const night = Math.max(1, Math.min(99, Math.floor(Number(e.night)) || 1));
  return { name, score: Math.floor(score), night, hard: !!e.hard };
}

/** @param {() => StorageLike | null | undefined} [getStorage] */
export function makeStore(getStorage = () => globalThis.localStorage) {
  /** @param {string} key */
  const read = (key) => {
    try { return getStorage()?.getItem(key) ?? null; } catch { return null; }
  };
  /** @param {string} key @param {string} value */
  const write = (key, value) => {
    try {
      const s = getStorage();
      if (!s) return false;
      s.setItem(key, value);
      return true;
    } catch { return false; }
  };

  /** @type {ScoreEntry[]} */
  let mem = [];
  let memHard = false;
  /** @type {string | null} */
  let memName = null;
  /** @type {MouseAim | null} */
  let memAim = null;
  /** @type {import('./keys.js').Bindings | null} */
  let memKeys = null;

  function load() {
    const raw = read(SCORES_KEY);
    if (raw != null) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          mem = parsed.map(cleanEntry).filter((e) => e !== null).sort((a, b) => b.score - a.score).slice(0, MAX_SCORES);
        }
      } catch { /* corrupt data: keep what we have in memory */ }
    }
    return mem.map((e) => ({ ...e }));
  }

  /** @param {number} score */
  function qualifies(score) {
    if (!(score > 0)) return false;
    const list = load();
    const lowest = list[list.length - 1];
    return list.length < MAX_SCORES || (lowest !== undefined && score > lowest.score);
  }

  // Returns the new entry's rank (1-based), or 0 if it didn't make the table.
  /** @param {ScoreEntry} entry */
  function insert(entry) {
    const e = cleanEntry(entry);
    if (!e) return 0;
    const list = load();
    list.push(e);
    // Array.prototype.sort is stable, so on a tie the older entry stays higher.
    list.sort((a, b) => b.score - a.score);
    const rank = list.indexOf(e) + 1;
    mem = list.slice(0, MAX_SCORES);
    write(SCORES_KEY, JSON.stringify(mem));
    return rank <= MAX_SCORES ? rank : 0;
  }

  return {
    load,
    qualifies,
    insert,
    hardUnlocked: () => memHard || read(HARD_KEY) === '1',
    unlockHard() { memHard = true; write(HARD_KEY, '1'); },
    // How the mouse aims the sword: 'move' (mouse motion points it) unless 'pointer' (at the cursor) was chosen.
    /** @returns {MouseAim} */
    mouseAim() { return (memAim ?? read(AIM_KEY)) === 'pointer' ? 'pointer' : 'move'; },
    /** @param {MouseAim} v */
    setMouseAim(v) { memAim = v === 'pointer' ? 'pointer' : 'move'; write(AIM_KEY, memAim); },
    // The keyboard bindings (see keys.js): what was saved, cleaned up, or the defaults.
    keyBindings() {
      if (memKeys) return cleanBindings(memKeys);
      let raw = null;
      try { raw = JSON.parse(read(KEYS_KEY) ?? 'null'); } catch { /* corrupt: use the defaults */ }
      return cleanBindings(raw);
    },
    /** @param {import('./keys.js').Bindings} b */
    setKeyBindings(b) { memKeys = cleanBindings(b); write(KEYS_KEY, JSON.stringify(memKeys)); },
    // The name used last, to offer again; AAA before there is one.
    lastName() {
      const v = read(NAME_KEY) || memName;
      return v && cleanName(v) === v ? v : 'AAA';
    },
    /** @param {string} v */
    setName(v) { memName = cleanName(v); write(NAME_KEY, memName); },
  };
}

export const scores = makeStore();
