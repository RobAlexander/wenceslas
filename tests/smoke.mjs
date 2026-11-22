// Headless smoke test: runs many nights of simulated play with a stub
// canvas, to catch runtime errors in the logic and drawing code.
// Run with: npm run smoke
const noop = () => {};
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => ((t[k] = v), true) });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };

const { World } = await import('../js/world.js');
const { loadSprites } = await import('../js/sprites.js');
const { makeRng } = await import('../js/rng.js');
const { makeGround, makeSnow, drawWorld, drawHud } = await import('../js/render.js');

const spr = loadSprites();
let completed = 0, deaths = 0, kills = 0, recruits = 0, pickups = 0, stolen = 0, shots = 0;
for (let seed = 1; seed <= 24; seed++) {
  const rng = makeRng(seed);
  const night = ((seed - 1) % 12) + 1;
  const events = [];
  const w = new World({ night, hard: seed > 12, rng, events });
  const ground = makeGround(rng), snow = makeSnow(rng);
  // A crude bot: recruit pages, then food, then deliver; swing at nearby robbers.
  for (let i = 0; i < 60 * 240 && !w.done && !w.dead; i++) {
    const k = w.king;
    const near = (list) => list.reduce((b, e) => (!b || Math.hypot(e.x - k.x, e.y - k.y) < Math.hypot(b.x - k.x, b.y - k.y) ? e : b), null);
    let goal;
    const wander = w.pages.filter((p) => p.state === 'wander' && p.entered);
    const empty = w.line.some((p) => !p.food);
    const carrying = w.line.some((p) => p.food);
    const boss = w.boss;
    if (boss && boss.state === 'rest') goal = boss;   // he is dizzy: go and hit him
    else if (boss) {
      // dodge: wait to the side of where the roll will go, about half way along it, ready to run in when he stops
      const side = Math.sign((k.x - boss.x) * -boss.dy + (k.y - boss.y) * boss.dx) || 1;
      goal = { x: boss.x + boss.dx * 130 - boss.dy * side * 60, y: boss.y + boss.dy * 130 + boss.dx * side * 60 };
    }
    else if (w.line.length < 3 && wander.length) goal = near(wander);
    else if (empty && w.foods.length) goal = near(w.foods);
    else if (carrying) goal = w.oldMan;
    else goal = near(wander) || w.oldMan;
    let dx = goal.x - k.x, dy = goal.y - k.y;
    {
      // sidestep any snowball that is about to hit
      const d0 = Math.hypot(dx, dy) || 1;
      dx /= d0; dy /= d0;
      for (const a of w.arrows) {
        if (!a.snow) continue;
        const sp = Math.hypot(a.vx, a.vy) || 1, ux = a.vx / sp, uy = a.vy / sp;
        const rx = k.x - a.x, ry = k.y - a.y;
        const along = rx * ux + ry * uy, perp = -rx * uy + ry * ux;
        if (along < 0 || along > 90 || Math.abs(perp) > 16) continue;
        const side = perp >= 0 ? 1 : -1;
        dx += -uy * side * 3; dy += ux * side * 3;
      }
    }
    const d = Math.hypot(dx, dy) || 1;
    const rob = near(w.foes());
    const swing = rob && Math.hypot(rob.x - k.x, rob.y - k.y) < 30;
    w.update(1 / 60, { mx: dx / d, my: dy / d, ax: rob ? rob.x : goal.x, ay: rob ? rob.y - 6 : goal.y, swing });
    if (i % 10 === 0) { drawWorld(ctx, w, spr, ground, snow, i / 60); drawHud(ctx, w, spr, 0); }
    for (const e of events) {
      if (e === 'kill') kills++; else if (e === 'recruit') recruits++; else if (e === 'pickup') pickups++; else if (e === 'wolfSteal') stolen++; else if (e === 'arrowShoot') shots++;
    }
    events.length = 0;
    for (const e of [k, ...w.pages, ...w.foes(), ...w.arrows]) {
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) throw new Error('NaN position, seed ' + seed);
    }
  }
  if (w.done) completed++;
  if (w.dead) deaths++;
  console.log(`seed ${seed} night ${night}${seed > 12 ? ' hard' : ''}: ${w.done ? 'done' : w.dead ? 'dead' : 'timeout'} in ${w.time.toFixed(1)}s, delivered ${w.delivered}/${w.p.foodTarget}, kills ${w.kills}, hp ${w.king.hp}`);
}
console.log({ completed, deaths, kills, recruits, pickups, stolen, shots });
