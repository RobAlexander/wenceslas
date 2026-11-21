// High scores and small persistent settings, kept in the browser's localStorage.
// Every access is wrapped in try/catch: storage can be missing, full, blocked
// (private windows) or hold corrupt data, and the game must still work.
// An in-memory copy keeps the table working for the rest of the session.

const SCORES_KEY = 'wenceslas.highscores.v1';
const HARD_KEY = 'wenceslas.hardUnlocked';
const INITIALS_KEY = 'wenceslas.initials';
export const MAX_SCORES = 10;

/** @typedef {{ initials: string, score: number, night: number, hard: boolean }} ScoreEntry */
/** @typedef {Pick<Storage, 'getItem' | 'setItem'>} StorageLike */

/** @param {any} e  anything, possibly corrupt, read back from storage @returns {ScoreEntry | null} */
function cleanEntry(e) {
  if (!e || typeof e !== 'object') return null;
  const initials = String(e.initials ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  const score = Number(e.score);
  if (!initials || !Number.isFinite(score) || score < 0) return null;
  const night = Math.max(1, Math.min(99, Math.floor(Number(e.night)) || 1));
  return { initials, score: Math.floor(score), night, hard: !!e.hard };
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
  let memInitials = null;

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
    return list.length < MAX_SCORES || score > list[list.length - 1].score;
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
    lastInitials() {
      const v = read(INITIALS_KEY) || memInitials;
      return v && /^[A-Z]{3}$/.test(v) ? v : 'AAA';
    },
    /** @param {string} v */
    setInitials(v) { memInitials = v; write(INITIALS_KEY, v); },
  };
}

export const scores = makeStore();
