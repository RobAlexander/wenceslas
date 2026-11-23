// Small seedable random number generator (mulberry32).

/**
 * @typedef {(() => number) & {
 *   range: (lo: number, hi: number) => number,
 *   int: (lo: number, hi: number) => number,
 *   pick: <T>(arr: readonly T[]) => T,
 * }} Rng
 */

/** @param {number} seed @returns {Rng} */
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /** @param {number} lo @param {number} hi */
  const range = (lo, hi) => lo + next() * (hi - lo);
  /** @param {number} lo @param {number} hi */
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)); // inclusive
  // arr must not be empty (and must not hold undefined, which would read as a miss)
  /** @type {Rng['pick']} */
  const pick = (arr) => {
    const v = arr[Math.floor(next() * arr.length)];
    if (v === undefined) throw new RangeError('pick from an empty array');
    return v;
  };
  // Object.assign, not a cast, so the compiler checks that every part of Rng is there.
  return Object.assign(next, { range, int, pick });
}
