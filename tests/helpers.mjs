// Small things the tests share.

/**
 * A page holding some food, for a test that needs one in the king's line. A full Page, so that if the game's Page
 * type gains a field, the type check (npm run typecheck) points here, once, instead of at every test.
 * @param {string} [food]
 * @returns {import('../js/world.js').Page}
 */
export function pageHolding(food = 'bread') {
  return {
    id: -1, x: 0, y: 0, r: 4, hp: 2, state: 'follow', target: { x: 0, y: 0 }, wanderT: 0, food,
    vx: 0, vy: 0, inv: 0, flash: 0, walkT: 0, face: 1, side: 1, entered: true,
  };
}
