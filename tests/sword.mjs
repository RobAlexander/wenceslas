// The sword's real reach (CFG.swingRange) is separate from how far the arc is drawn
// (CFG.swingDrawnRadius), so the blow can reach further than it looks.
// Run with: node tests/sword.mjs
import assert from 'node:assert/strict';
import { World } from '../js/world.js';
import { makeRng } from '../js/rng.js';
import { CFG } from '../js/config.js';

// A robber at distance d from the king's hand (he aims east), tough enough to survive one hit.
function swingAt(d, { dx = 1 } = {}) {
  const w = new World({ night: 6, hard: false, rng: makeRng(1), events: [] });
  Object.assign(w.p, { maxRobbers: 0, maxWolves: 0, maxArchers: 0, maxFood: 0, maxWanderingPages: 0 });
  w.pages = []; w.line = []; w.obstacles = []; w.foods = [];
  w.king.x = 320; w.king.y = 200; w.trail = [{ x: 320, y: 200 }];
  w.spawnRobber();
  const rob = w.robbers[0];
  rob.hp = rob.maxHp = 2;
  const handY = w.king.y - 8;                       // the blow is measured from his chest
  rob.x = 320 + dx * d; rob.y = handY + 6;          // so the robber's body is level with it
  w.update(1 / 60, { mx: 0, my: 0, ax: 600, ay: handY, swing: true });
  return rob.hp < 2;
}

const edge = CFG.swingRange + 4 + 2;                // reach + the robber's radius + 2 of slack

assert.ok(CFG.swingRange > 0 && CFG.swingDrawnRadius > 0);

// in reach: hit, all the way out to swingRange
assert.equal(swingAt(10), true, 'close in');
assert.equal(swingAt(CFG.swingRange - 1), true, 'just inside the real reach');
// out of reach: not hit
assert.equal(swingAt(edge + 10), false, 'beyond the real reach');
assert.equal(swingAt(edge + 60), false, 'well beyond');
// the blow goes where he aims, not behind him
assert.equal(swingAt(20, { dx: -1 }), false, 'behind him');

// the point of keeping the drawn arc separate: when the reach is longer than the arc is drawn,
// a robber past the drawn arc but within the real reach still gets hit
if (CFG.swingRange > CFG.swingDrawnRadius + 6) {
  const between = (CFG.swingRange + CFG.swingDrawnRadius) / 2;
  assert.ok(between > CFG.swingDrawnRadius);
  assert.equal(swingAt(between), true, 'hit beyond the drawn arc');
}

console.log('sword: all tests passed');
