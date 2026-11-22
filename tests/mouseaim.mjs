// Relative mouse aiming: nudgeAim turns mouse movement into a sword direction. Run with: node tests/mouseaim.mjs
import assert from 'node:assert/strict';
import { nudgeAim } from '../js/input.js';

const v = () => ({ x: 0, y: 0 });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' vs ' + b);

// jitter: too small a movement gives no direction
let a = v();
assert.equal(nudgeAim(a, 2, 1), null);
assert.equal(nudgeAim(a, 1, 1), null);

// enough movement: the direction of travel
a = v(); near(nudgeAim(a, 10, 0), 0);                    // east
a = v(); near(nudgeAim(a, 0, 10), Math.PI / 2);          // south (y is down)
a = v(); near(nudgeAim(a, -10, 0), Math.PI);             // west
a = v(); near(nudgeAim(a, 8, -8), -Math.PI / 4);         // north-east

// many small movements add up
a = v(); let r = null;
for (let i = 0; i < 5; i++) r = nudgeAim(a, 0, -2);
near(r, -Math.PI / 2);

// the vector is capped, so a long sweep east is undone quickly by a short movement west
a = v();
for (let i = 0; i < 100; i++) nudgeAim(a, 30, 0);
assert.ok(Math.hypot(a.x, a.y) <= 24 + 1e-9, 'capped');
r = nudgeAim(a, -30, 0);
near(Math.abs(r), Math.PI);                              // now pointing west

// no movement (a zero event) leaves the direction alone
a = v(); nudgeAim(a, 10, 0);
near(nudgeAim(a, 0, 0), 0);

console.log('mouseaim ok');
