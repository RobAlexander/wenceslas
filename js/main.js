// Entry point: canvas setup, main loop and the flow between nights.

import { W, H, CFG, NIGHTS, parTime } from './config.js';
import { makeRng } from './rng.js';
import { loadSprites, PAL } from './sprites.js';
import { World } from './world.js';
import { createInput } from './input.js';
import { makeGround, makeSnow, updateSnow, drawWorld, drawHud, drawCrosshair, drawPanel } from './render.js';
import { drawText } from './font.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;
ctx.imageSmoothingEnabled = false;

// Largest whole-number scale that fits, in device pixels, so pixels stay even.
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min((innerWidth * dpr) / W, (innerHeight * dpr) / H);
  const scale = fit >= 1 ? Math.floor(fit) / dpr : fit / dpr;
  canvas.style.width = W * scale + 'px';
  canvas.style.height = H * scale + 'px';
}
addEventListener('resize', resize);
resize();

// Test hooks: ?seed=123&night=5. They do nothing unless given.
const params = new URLSearchParams(location.search);
const seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : (Math.random() * 2 ** 32) >>> 0;
const rng = makeRng(seed);
const firstNight = Math.min(NIGHTS, Math.max(1, Number(params.get('night')) || 1));

const spr = loadSprites();
const input = createInput(canvas);
const snow = makeSnow(rng);

const game = {
  state: 'play', // play | paused | nightEnd | gameover | ending
  night: firstNight,
  hard: false,
  score: 0,
  kingHp: CFG.kingMaxHp,
  world: null,
  ground: null,
  stateT: 0,
  banner: 0,
  summary: null,
  events: [], // drained each frame; sound will hook in here
};
window.__wenceslas = game; // handy for debugging and automated tests

function startNight(n) {
  game.night = n;
  game.world = new World({ night: n, hard: game.hard, rng, events: game.events, kingHp: game.kingHp });
  game.ground = makeGround(rng);
  game.state = 'play';
  game.banner = 2.5;
  input.clearPresses();
}

function newGame(hard) {
  game.hard = hard;
  game.score = 0;
  game.kingHp = CFG.kingMaxHp;
  startNight(1);
}

function nightSummary(w) {
  const mul = w.hard ? CFG.hardPointsMul : 1;
  const par = parTime(w.p.foodTarget);
  const under = Math.max(0, Math.floor(par - w.time));
  return {
    food: w.delivered * CFG.pointsFood * mul,
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

const STEP = 1 / 60;
let acc = 0, last = performance.now() / 1000, clock = 0;

function update(dt) {
  clock += dt;
  input.tick(clock);
  updateSnow(snow, dt, clock);
  game.stateT += dt;
  const w = game.world;

  if (game.state === 'play') {
    if (input.takePause()) { game.state = 'paused'; return; }
    input.takeConfirm();
    game.banner -= dt;
    w.update(dt, input.gameplay(w.king.cd));
    if (w.done) {
      game.summary = nightSummary(w);
      game.score += game.summary.food + game.summary.kills + game.summary.bonus;
      game.state = 'nightEnd';
      game.stateT = 0;
    } else if (w.dead) {
      game.state = 'gameover';
      game.stateT = 0;
    }
  } else if (game.state === 'paused') {
    if (input.takePause() || input.takeConfirm()) { game.state = 'play'; input.clearPresses(); }
  } else {
    w.update(dt, { mx: 0, my: 0, swing: false }); // let particles settle
    input.takePause();
    const ready = game.stateT > 1;
    if (input.takeConfirm() && ready) {
      if (game.state === 'nightEnd') {
        if (game.night >= NIGHTS) { game.state = 'ending'; game.stateT = 0; }
        else {
          const k = w.king;
          game.kingHp = Math.min(CFG.kingMaxHp, k.hp + Math.ceil(CFG.kingMaxHp * CFG.hpRestoreBetweenNights));
          startNight(game.night + 1);
        }
      } else if (game.state === 'gameover') newGame(false);
      else if (game.state === 'ending') newGame(true);
    }
  }
}

function fmtTime(s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ':' + String(r).padStart(2, '0');
}

function draw() {
  const w = game.world;
  drawWorld(ctx, w, spr, game.ground, snow, clock);
  drawHud(ctx, w, spr, liveScore());

  if (game.state === 'play' && game.banner > 0) {
    drawPanel(ctx, [
      ['NIGHT ' + game.night, PAL.y, 2],
      null,
      'DELIVER ' + w.p.foodTarget + ' FOOD TO THE OLD MAN',
    ]);
  } else if (game.state === 'paused') {
    drawPanel(ctx, [['PAUSED', PAL.y, 2], null, 'PRESS ESC OR CLICK TO RESUME']);
  } else if (game.state === 'nightEnd') {
    const s = game.summary;
    drawPanel(ctx, [
      ['NIGHT ' + game.night + ' COMPLETE', PAL.y, 2],
      null,
      'FOOD DELIVERED  ' + s.food,
      'ROBBERS (' + s.killCount + ')  ' + s.kills,
      'TIME ' + fmtTime(s.time) + ' PAR ' + fmtTime(s.par) + '  ' + s.bonus,
      null,
      ['SCORE  ' + game.score, PAL.l],
      null,
      game.stateT > 1 ? ['CLICK OR ENTER TO CONTINUE', PAL.n] : '',
    ], { width: 300 });
  } else if (game.state === 'gameover') {
    drawPanel(ctx, [
      ['GAME OVER', PAL.r, 2], null, 'SCORE ' + game.score, null,
      game.stateT > 1 ? ['CLICK OR ENTER TO TRY AGAIN', PAL.n] : '',
    ]);
  } else if (game.state === 'ending') {
    const p = spr.partridge;
    drawPanel(ctx, [
      ['A PARTRIDGE!', PAL.y, 2], null, null, null,
      'YOU HAVE SEEN THE OLD MAN THROUGH TWELVE NIGHTS',
      'SCORE ' + game.score, null,
      game.stateT > 1 ? ['CLICK OR ENTER FOR HARD MODE', PAL.n] : '',
    ], { width: 320 });
    ctx.drawImage(p.img, Math.round(W / 2 - p.w), Math.round(H / 2 - 24), p.w * 2, p.h * 2);
  }

  if (input.st.mouseSeen && game.state === 'play') drawCrosshair(ctx, input.st.mouse.x, input.st.mouse.y);
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
  requestAnimationFrame(frame);
}

// Pause automatically if the window loses focus.
addEventListener('blur', () => { if (game.state === 'play') game.state = 'paused'; });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'play') game.state = 'paused';
});

startNight(firstNight);
requestAnimationFrame(frame);
