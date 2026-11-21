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
  const rng = /** @type {Rng} */ (() => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
  rng.range = (lo, hi) => lo + rng() * (hi - lo);
  rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1)); // inclusive
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  return rng;
}
