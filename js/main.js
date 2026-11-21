// Entry point: canvas setup, main loop and the flow between screens and nights.

import { W, H, CFG, NIGHTS, parTime } from './config.js';
import { makeRng } from './rng.js';
import { loadSprites, PAL } from './sprites.js';
import { World } from './world.js';
import { createInput } from './input.js';
import { makeGround, makeSnow, updateSnow, drawWorld, drawHud, drawCrosshair, drawPanel } from './render.js';
import { drawText } from './font.js';
import { scores } from './highscores.js';
import { createScreens } from './screens.js';

// The game draws into a hidden 640x360 buffer (ctx). Each frame the buffer is
// copied to the visible canvas, enlarged by a whole number so pixels stay square.
// The browser then shrinks that slightly to fill the window ("sharp bilinear"
// scaling), which looks crisp at any window size and is exact at whole-number fits.
const canvas = document.getElementById('game');
const screenCtx = canvas.getContext('2d');
const buffer = document.createElement('canvas');
buffer.width = W;
buffer.height = H;
const ctx = buffer.getContext('2d');
ctx.imageSmoothingEnabled = false;

let upscale = 0;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(innerWidth / W, innerHeight / H); // CSS pixels per game pixel
  const k = Math.min(8, Math.max(1, Math.ceil(fit * dpr))); // whole-number upscale, in device pixels
  if (k !== upscale) {
    upscale = k;
    canvas.width = W * k;   // resizing a canvas also resets its context state
    canvas.height = H * k;
    screenCtx.imageSmoothingEnabled = false;
  }
  canvas.style.width = W * fit + 'px';
  canvas.style.height = H * fit + 'px';
}
addEventListener('resize', resize); // also fires on browser zoom and when moving between monitors
resize();

// F toggles fullscreen (not while typing initials). Ignored if the browser refuses.
function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.()?.catch?.(() => {});
  } catch { /* not allowed here */ }
}
addEventListener('keydown', (e) => {
  if (e.code === 'KeyF' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && game.state !== 'initials') toggleFullscreen();
});

// Test hooks, all optional and ignored in normal play:
//   ?seed=123      repeatable layouts
//   ?night=5       start straight into that night
//   ?screen=NAME   show one screen: title, paused, nightEnd, gameover, ending, initials, highscores
//   ?debug         show the seed
const params = new URLSearchParams(location.search);
const seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : (Math.random() * 2 ** 32) >>> 0;
const rng = makeRng(seed);
const fxRng = makeRng(seed ^ 0x9e3779b9); // cosmetic randomness, kept apart so layouts stay repeatable
const firstNight = Math.min(NIGHTS, Math.max(1, Number(params.get('night')) || 1));

const spr = loadSprites();
const input = createInput(canvas);
const snow = makeSnow(rng);
const backdrop = makeGround(fxRng);

const game = {
  state: 'title', // title | play | paused | nightEnd | gameover | ending | initials | highscores
  screen: null,
  night: firstNight,
  hard: false,
  score: 0,
  kingHp: CFG.kingMaxHp,
  world: null,
  ground: null,
  stateT: 0,
  banner: 0,
  events: [], // drained each frame; sound will hook in here
};
window.__wenceslas = game; // handy for debugging and automated tests

// ---------- flow ----------

function setState(name, data) {
  game.state = name;
  game.screen = screens[name] || null;
  game.stateT = 0;
  input.clearPresses();
  if (game.screen) game.screen.enter(data);
}

function prepareNight(n) {
  game.night = n;
  game.world = new World({ night: n, hard: game.hard, rng, events: game.events, kingHp: game.kingHp });
  game.ground = makeGround(rng);
}

function startNight(n) {
  prepareNight(n);
  game.banner = 2.5;
  setState('play');
}

const actions = {
  newGame(hard) {
    game.hard = hard;
    game.score = 0;
    game.kingHp = CFG.kingMaxHp;
    startNight(1);
  },
  resume() { setState('play'); },
  quitToTitle() { setState('title'); },
  nextNight() {
    if (game.night >= NIGHTS) { setState('ending', { score: game.score, night: game.night, hard: game.hard }); return; }
    // Pages are left behind between nights; Wenceslas recovers some health.
    const k = game.world.king;
    game.kingHp = Math.min(CFG.kingMaxHp, k.hp + Math.ceil(CFG.kingMaxHp * CFG.hpRestoreBetweenNights));
    startNight(game.night + 1);
  },
  // After a run ends (game over or the ending): initials if it made the table.
  finishRun(run) {
    if (scores.qualifies(run.score)) setState('initials', run);
    else setState('highscores', { highlight: 0 });
  },
};

const screens = createScreens({
  input, events: game.events, spr, scores, snow, backdrop, go: setState, actions,
});

function nightSummary(w) {
  const mul = w.hard ? CFG.hardPointsMul : 1;
  const par = parTime(w.p.foodTarget);
  const under = Math.max(0, Math.floor(par - w.time));
  return {
    food: w.delivered * CFG.pointsFood * mul,
    foodCount: w.delivered,
    kills: w.kills * CFG.pointsKill * mul,
    killCount: w.kills,
    time: w.time,
    par,
    bonus: under * CFG.pointsPerSecondUnderPar * mul,
  };
}

function liveScore() {
  const w = game.world;
  if (game.state !== 'play' && game.state !== 'paused') return game.score;
  const mul = w.hard ? CFG.hardPointsMul : 1;
  return game.score + (w.delivered * CFG.pointsFood + w.kills * CFG.pointsKill) * mul;
}

// ---------- loop ----------

const STEP = 1 / 60;
const IDLE = { mx: 0, my: 0, swing: false };
let acc = 0, last = performance.now() / 1000, clock = 0;

function update(dt) {
  clock += dt;
  input.tick(clock);
  updateSnow(snow, dt, clock);
  game.stateT += dt;
  const w = game.world;

  if (game.state === 'play') {
    if (input.takePause()) { setState('paused'); return; }
    input.takeConfirm(); input.takeKeys(); input.takeClick(); // not used while playing
    game.banner -= dt;
    w.update(dt, input.gameplay(w.king.cd));
    if (w.done) {
      const summary = nightSummary(w);
      game.score += summary.food + summary.kills + summary.bonus;
      setState('nightEnd', { summary, night: game.night, score: game.score });
    } else if (w.dead) {
      setState('gameover', { score: game.score + liveEarned(w), night: game.night, hard: game.hard });
    }
    return;
  }
  // Let particles and floating text settle behind the overlays.
  if (game.state === 'nightEnd' || game.state === 'gameover') w.update(dt, IDLE);
  game.screen.update(dt);
}

// Points earned so far this night (a night that ends in defeat still counts).
function liveEarned(w) {
  const mul = w.hard ? CFG.hardPointsMul : 1;
  return (w.delivered * CFG.pointsFood + w.kills * CFG.pointsKill) * mul;
}

function draw() {
  const w = game.world;
  const s = game.screen;
  if (!s || s.overlay) {
    drawWorld(ctx, w, spr, game.ground, snow, clock);
    drawHud(ctx, w, spr, liveScore());
  }
  if (game.state === 'play' && game.banner > 0) {
    drawPanel(ctx, [
      ['NIGHT ' + game.night, PAL.y, 2],
      null,
      'DELIVER ' + w.p.foodTarget + ' FOOD TO THE OLD MAN',
    ]);
  }
  if (s) s.draw(ctx);
  if (input.st.mouseSeen) drawCrosshair(ctx, input.st.mouse.x, input.st.mouse.y);
  if (params.has('debug')) drawText(ctx, 'SEED ' + seed, 4, H - 8, PAL.n);
}

function frame() {
  const now = performance.now() / 1000;
  acc += Math.min(0.25, now - last);
  last = now;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    update(STEP);
    acc -= STEP;
    steps++;
  }
  if (steps === 5) acc = 0;
  game.events.length = 0;
  draw();
  screenCtx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
  requestAnimationFrame(frame);
}

// Pause automatically if the window loses focus.
addEventListener('blur', () => { if (game.state === 'play') setState('paused'); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'play') setState('paused');
});

// ---------- start ----------

prepareNight(firstNight);
const demo = {
  title: () => setState('title'),
  paused: () => setState('paused'),
  highscores: () => setState('highscores', { highlight: 0 }),
  initials: () => setState('initials', { score: 4200, night: 7, hard: false }),
  ending: () => setState('ending', { score: 15800, night: 12, hard: false }),
  gameover: () => setState('gameover', { score: 3200, night: 5, hard: false }),
  nightEnd: () => setState('nightEnd', {
    summary: { food: 400, foodCount: 4, kills: 100, killCount: 4, time: 52, par: 70, bonus: 180 },
    night: 3, score: 2400,
  }),
};
const wanted = params.get('screen');
if (params.has('night')) startNight(firstNight);
else if (wanted && demo[wanted]) demo[wanted]();
else setState('title');

requestAnimationFrame(frame);
