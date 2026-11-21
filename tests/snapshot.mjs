// Renders a frame of mid-game play to PNG without a browser (uses node-canvas).
// Usage: node tests/snapshot.mjs out.png [seed] [night] [seconds]
import { createCanvas } from 'canvas';
import { writeFileSync } from 'node:fs';
globalThis.document = { createElement: () => createCanvas(1, 1) };
const { World } = await import('../js/world.js');
const { loadSprites } = await import('../js/sprites.js');
const { makeRng } = await import('../js/rng.js');
const { makeGround, makeSnow, updateSnow, drawWorld, drawHud, drawCrosshair } = await import('../js/render.js');

const [out = 'snap.png', seed = 3, night = 4, secs = 14] = process.argv.slice(2);
const rng = makeRng(+seed);
const w = new World({ night: +night, hard: false, rng, events: [] });
const spr = loadSprites(), ground = makeGround(rng), snow = makeSnow(rng);
let t = 0, rob;
for (let i = 0; i < 60 * secs; i++) {
  const k = w.king;
  const wander = w.pages.find((p) => p.state === 'wander' && p.entered);
  const goal = (w.line.length < 4 && wander) || (w.line.some((p) => !p.food) && w.foods[0]) || w.oldMan;
  const dx = goal.x - k.x, dy = goal.y - k.y, d = Math.hypot(dx, dy) || 1;
  rob = w.robbers[0];
  const swing = rob && Math.hypot(rob.x - k.x, rob.y - k.y) < 30;
  w.update(1 / 60, { mx: dx / d, my: dy / d, ax: rob ? rob.x : goal.x, ay: rob ? rob.y : goal.y, swing: swing || i === 60 * secs - 4 });
  updateSnow(snow, 1 / 60, (t += 1 / 60));
}
const c = createCanvas(640, 360), ctx = c.getContext('2d');
drawWorld(ctx, w, spr, ground, snow, t);
drawHud(ctx, w, spr, 1234);
drawCrosshair(ctx, w.king.x + 30, w.king.y - 20);
const big = createCanvas(1280, 720), bctx = big.getContext('2d');
bctx.imageSmoothingEnabled = false;
bctx.drawImage(c, 0, 0, 1280, 720);
writeFileSync(out, big.toBuffer('image/png'));
console.log('wrote', out);
