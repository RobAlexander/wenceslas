// Entry point: canvas setup, main loop and the flow between screens and nights.

import { W, H, CFG, NIGHTS, WOLVES_FROM, ARCHERS_FROM, parTime } from './config.js';
import { makeRng } from './rng.js';
import { loadSprites, PAL } from './sprites.js';
import { World } from './world.js';
import { createInput } from './input.js';
import { createTouch } from './touch.js';
import { createGamepad } from './gamepad.js';
import { createAudio } from './audio.js';
import { makeGround, makeSnow, updateSnow, drawWorld, drawHud, drawCrosshair, drawPanel } from './render.js';
import { drawText } from './font.js';
import { scores } from './highscores.js';
import { createScreens } from './screens.js';
import { createConsole } from './devconsole.js';
import { context2d, makeCanvas } from './canvas.js';

/** @typedef {import('./screens.js').ScreenName} ScreenName */
/** @typedef {import('./screens.js').ScreenData} ScreenData */
/** @typedef {import('./screens.js').RunResult} RunResult */
/** @typedef {import('./screens.js').NightSummary} NightSummary */
/** @typedef {import('./world.js').GameInput} GameInput */
/** @typedef {ScreenName | 'play'} GameState */

/**
 * @typedef {object} Game
 * @property {GameState} state
 * @property {import('./screens.js').Screen<any> | null} screen  the active screen; null while playing
 * @property {number} night
 * @property {boolean} hard
 * @property {number} score        banked at the end of each night
 * @property {number} kingHp       carried from night to night
 * @property {World} world         the current night (kept, frozen, behind overlay screens)
 * @property {HTMLCanvasElement} ground
 * @property {number} stateT       time in the current state
 * @property {number} banner       time left on the start-of-night banner
 * @property {boolean} god         dev console: Wenceslas takes no damage
 * @property {boolean} cheated     dev console used during this run: shows "DEV" in the corner (it can still score)
 * @property {string[]} events     drained each frame, for sound
 * @property {ReturnType<typeof createInput>} input
 * @property {ReturnType<typeof createAudio>} audio
 * @property {import('./devconsole.js').DevConsole} [console]
 */

// The game draws into a hidden 640x360 buffer (ctx). Each frame the buffer is
// copied to the visible canvas, enlarged by a whole number so pixels stay square.
// The browser then shrinks that slightly to fill the window ("sharp bilinear"
// scaling), which looks crisp at any window size and is exact at whole-number fits.
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
const screenCtx = context2d(canvas);
const { canvas: buffer, ctx } = makeCanvas(W, H);
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

// F toggles fullscreen (not while typing a high score name). Ignored if the browser refuses.
function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.()?.catch?.(() => {});
  } catch { /* not allowed here */ }
}
// First tap on a touch device: go fullscreen and lock to landscape where the browser allows it.
function enterFullscreen() {
  try {
    if (document.fullscreenElement) return;
    document.documentElement.requestFullscreen?.()
      ?.then?.(() => globalThis.screen?.orientation?.lock?.('landscape')?.catch?.(() => {}))
      ?.catch?.(() => {});
  } catch { /* not allowed here */ }
}

// A phone held upright: the page shows a "rotate your device" notice, and play pauses.
const portraitTouch = () => innerHeight > innerWidth && !!globalThis.matchMedia?.('(pointer: coarse)').matches;

addEventListener('keydown', (e) => {
  const plain = !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && game.state !== 'nameEntry' && !input.st.blocked;
  const acts = input.actionsFor(e.code);
  if (acts.includes('fullscreen') && plain) toggleFullscreen();
  if (acts.includes('mute') && plain) audio.toggleMute();
});

// Test hooks, all optional and ignored in normal play:
//   ?seed=123      repeatable layouts
//   ?night=5       start straight into that night
//   ?screen=NAME   show one screen: title, howto, paused, nightEnd, gameover, ending, nameEntry, highscores
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
// Sound starts at the first key press or click: browsers don't allow it before that.
const audio = createAudio();

/** @type {string[]} */
const events = [];

// A night's world and its ground texture.
/** @param {number} n @param {boolean} hard @param {number} kingHp @param {boolean} god */
function makeNight(n, hard, kingHp, god) {
  const world = new World({ night: n, hard, rng, events, kingHp });
  world.king.god = god;
  return { world, ground: makeGround(rng) };
}

// The first night is made straight away, so there is always a world to draw behind the menus.
const first = makeNight(firstNight, false, CFG.kingMaxHp, false);

/** @type {Game} */
const game = {
  state: 'title',
  screen: null,
  night: firstNight,
  hard: false,
  score: 0,
  kingHp: CFG.kingMaxHp,
  world: first.world,
  ground: first.ground,
  stateT: 0,
  banner: 0,
  god: false,
  cheated: false,
  events,
  input,
  audio,
};
/** @type {any} */ (window).__wenceslas = game; // handy for debugging and automated tests

for (const type of ['pointerdown', 'keydown', 'touchend']) addEventListener(type, () => audio.unlock(), { passive: true });

const touch = createTouch(input, canvas, { isPlaying: () => game.state === 'play', onFirstTap: enterFullscreen });
const pad = createGamepad(input);
input.setMouseAim(scores.mouseAim());
input.setBindings(scores.keyBindings());

// ---------- flow ----------

// Every change of state: clears pending presses and tells the music.
/** @param {GameState} name */
function enterState(name) {
  const prev = game.state;
  game.state = name;
  game.screen = null;
  game.stateT = 0;
  input.clearPresses();
  audio.onState(name, prev);
}

// Show a screen (a menu or an overlay), entering it with that screen's data.
/**
 * @template {ScreenName} K
 * @param {K} name
 * @param {ScreenData[K]} [data]
 */
function setState(name, data) {
  enterState(name);
  game.screen = screens[name];
  game.screen.enter(data);
}

// Back to the game itself (no screen).
function enterPlay() { enterState('play'); }

/** @param {number} n */
function startNight(n) {
  game.night = n;
  ({ world: game.world, ground: game.ground } = makeNight(n, game.hard, game.kingHp, game.god));
  game.banner = 2.5;
  audio.setNight(n);
  enterPlay();
}

const actions = {
  /** @param {boolean} hard */
  newGame(hard, night = 1) {
    game.hard = hard;
    game.score = 0;
    game.kingHp = CFG.kingMaxHp;
    game.cheated = game.god;
    startNight(night);
  },
  resume() { enterPlay(); },
  /** @param {'move' | 'pointer'} mode */
  setMouseAim(mode) { scores.setMouseAim(mode); input.setMouseAim(mode); },
  /** @param {import('./keys.js').Bindings} b */
  setKeyBindings(b) { scores.setKeyBindings(b); input.setBindings(scores.keyBindings()); },
  quitToTitle() { setState('title'); },
  nextNight() {
    if (game.night >= NIGHTS) { setState('ending', { score: game.score, night: game.night, hard: game.hard }); return; }
    // Pages are left behind between nights; Wenceslas recovers some health.
    const k = game.world.king;
    game.kingHp = Math.min(CFG.kingMaxHp, k.hp + CFG.hpRestoreBetweenNights);
    startNight(game.night + 1);
  },
  // After a run ends (game over or the ending): name entry if it made the table.
  /** @param {RunResult} run */
  finishRun(run) {
    if (scores.qualifies(run.score)) setState('nameEntry', run);
    else setState('highscores', { highlight: 0 });
  },
};

const screens = createScreens({
  input, events: game.events, spr, scores, snow, backdrop, go: setState, actions,
});

// ---------- dev console (the ` key) ----------

// A whole-number command argument in [lo, hi]; what names it in the error.
/** @param {string | undefined} s @param {number} lo @param {number} hi @param {string} what */
const int = (s, lo, hi, what) => {
  const n = Number(s);
  if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(what + ' MUST BE ' + lo + ' TO ' + hi);
  return n;
};
const inPlay = () => {
  if (game.state !== 'play' && game.state !== 'paused') throw new Error('ONLY DURING A NIGHT');
  game.cheated = true;
  return game.world;
};
/** @type {Record<string, (w: World) => void>} */
const SPAWN = {
  robber: (w) => w.spawnRobber(), wolf: (w) => w.spawnWolf(), archer: (w) => w.spawnArcher(), mary: (w) => { if (!w.boss) w.spawnMary(); }, frosty: (w) => { if (!w.boss) w.spawnFrosty(); },
  boleslaus: (w) => { if (!w.boss) w.spawnBoleslaus(); },
  nicholas: (w) => { if (!w.boss) w.spawnNicholas(); },
  page: (w) => w.spawnPage(), food: (w) => w.spawnFood(),
};
const devConsole = createConsole({
  input,
  commands: {
    night: {
      args: 'N (HARD)', help: 'START A RUN ON NIGHT N (1-' + NIGHTS + ')', close: true,
      run: ([n, mode]) => {
        const night = int(n, 1, NIGHTS, 'NIGHT');
        actions.newGame(mode === 'hard', night);
        game.cheated = true;
        return 'NIGHT ' + night + (game.hard ? ' (HARD)' : '');
      },
    },
    win: {
      help: 'DELIVER THE REST OF THE FOOD AND END THE NIGHT', close: true,
      run: () => {
        const w = inPlay();
        w.delivered = w.p.foodTarget; w.done = true; w.emit('nightComplete');
        if (game.state === 'paused') enterPlay();
      },
    },
    spawn: {
      args: 'KIND (COUNT)', help: 'ADD ROBBER, WOLF, ARCHER, MARY, FROSTY, BOLESLAUS, NICHOLAS, PAGE OR FOOD',
      run: ([kind, count = '1']) => {
        if (!SPAWN[kind]) throw new Error('KIND IS ONE OF ' + Object.keys(SPAWN).join(', '));
        const w = inPlay(), n = int(count, 1, 20, 'COUNT');
        for (let i = 0; i < n; i++) SPAWN[kind](w);
        return 'ADDED ' + n + ' ' + kind.toUpperCase();
      },
    },
    kill: {
      help: 'REMOVE EVERY ENEMY AND ARROW (NO POINTS)',
      run: () => {
        const w = inPlay(), n = w.foes().length;
        w.robbers.length = 0; w.wolves.length = 0; w.archers.length = 0; w.ghosts.length = 0; w.arrows.length = 0;
        return 'REMOVED ' + n;
      },
    },
    hp: {
      args: 'N', help: "SET WENCESLAS'S HEALTH",
      run: ([n]) => { inPlay().king.hp = int(n, 1, CFG.kingMaxHp, 'HP'); return 'HP ' + n; },
    },
    god: {
      help: 'TOGGLE: WENCESLAS TAKES NO DAMAGE',
      run: () => {
        game.god = !game.god;
        if (game.god) game.cheated = true;
        game.world.king.god = game.god;
        return 'GOD MODE ' + (game.god ? 'ON' : 'OFF');
      },
    },
    screen: {
      args: 'NAME', help: 'SHOW A SCREEN, AS ?SCREEN= DOES', close: true,
      run: ([name]) => {
        if (!demo[name]) throw new Error('NAME IS ONE OF ' + Object.keys(demo).join(', '));
        demo[name]();
      },
    },
    mouseaim: {
      args: '(MOVE|CURSOR)', help: 'MOUSE AIM: MOVE POINTS THE SWORD THE WAY THE MOUSE MOVES; NO ARGUMENT TOGGLES',
      run: ([mode]) => {
        if (mode && mode !== 'move' && mode !== 'cursor') throw new Error('MODE IS MOVE OR CURSOR');
        const next = mode ? (mode === 'move' ? 'move' : 'pointer') : input.st.mouseAim === 'move' ? 'pointer' : 'move';
        actions.setMouseAim(next);
        return 'MOUSE AIM ' + (next === 'move' ? 'MOVE' : 'CURSOR');
      },
    },
    seed: { help: 'SHOW THE RANDOM SEED', run: () => 'SEED ' + seed },
  },
});
devConsole.print('TYPE HELP FOR A LIST OF COMMANDS.');
game.console = devConsole;

/** @param {World} w @returns {NightSummary} */
function nightSummary(w) {
  const mul = w.hard ? CFG.hardPointsMul : 1;
  const par = parTime(w.p.foodTarget, w.p.bossNo);
  const under = Math.max(0, Math.floor(par - w.time));
  return {
    food: w.delivered * CFG.pointsFood * mul,
    foodCount: w.delivered,
    kills: (w.kills * CFG.pointsKill + w.bonus) * mul,
    killCount: w.kills,
    time: w.time,
    par,
    bonus: under * CFG.pointsPerSecondUnderPar * mul,
  };
}

// The score shown in the HUD: banked points plus what this night has earned so far.
function liveScore() {
  if (game.state !== 'play' && game.state !== 'paused') return game.score;
  return game.score + liveEarned(game.world);
}

// ---------- loop ----------

const STEP = 1 / 60;
/** @type {GameInput} */
const IDLE = { mx: 0, my: 0, swing: false };
let acc = 0, last = performance.now() / 1000, clock = 0;

/** @param {number} dt */
function update(dt) {
  clock += dt;
  input.tick(clock);
  updateSnow(snow, dt, clock);
  if (devConsole.open) return;   // the game waits while the console is open
  game.stateT += dt;
  touch.update(clock);
  pad.update(dt, game.state);
  const w = game.world;

  if (game.state === 'play') {
    if (input.takePause() || portraitTouch()) { setState('paused'); return; }
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
  game.screen?.update(dt);
}

// Points earned so far this night (a night that ends in defeat still counts).
/** @param {World} w */
function liveEarned(w) {
  const mul = w.hard ? CFG.hardPointsMul : 1;
  return (w.delivered * CFG.pointsFood + w.kills * CFG.pointsKill + w.bonus) * mul;
}

function draw() {
  const w = game.world;
  const s = game.screen;
  if (!s || s.overlay) {
    drawWorld(ctx, w, spr, game.ground, snow, clock);
    drawHud(ctx, w, spr, liveScore());
  }
  if (game.state === 'play' && game.banner > 0) {
    /** @type {Parameters<typeof drawPanel>[1]} */
    const lines = [
      ['NIGHT ' + game.night, PAL.y, 2],
      null,
      'DELIVER ' + w.p.foodTarget + ' FOOD TO THE OLD MAN',
    ];
    if (game.night === WOLVES_FROM) lines.push(['BEWARE: WOLVES STEAL FOOD!', PAL.o]);
    if (game.night === ARCHERS_FROM) lines.push(['BEWARE: ARCHERS SHOOT AT YOU!', PAL.o]);
    drawPanel(ctx, lines);
  }
  if (game.state === 'play' && w.bossIntro > 0 && w.boss) {
    // a short banner when a boss arrives: who, and what to do about them
    drawPanel(ctx, w.boss.kind === 'mary'
      ? [['MARY!', PAL.o, 2], null, 'DODGE THE SNOWBALLS. HIT HER WHEN SHE RESTS.']
      : w.boss.kind === 'boleslaus'
        ? [['PRINCE BOLESLAUS!', PAL.o, 2], null, 'DUCK IN, HIT HIM, DUCK OUT.']
        : w.boss.kind === 'nicholas'
          ? [['ST NICHOLAS!', PAL.o, 2], null, 'THE DEAD RISE. WATCH THE GROUND.']
          : [['FROSTY!', PAL.o, 2], null, 'HE ROLLS. HIT HIM WHEN HE STOPS.']);
  }
  if (s) s.draw(ctx);
  touch.draw(ctx, w);
  const relative = input.st.lastDevice === 'mouse' && input.st.mouseAim === 'move' && game.state === 'play';
  document.body.classList.toggle('aiming', relative);
  if (input.st.lastDevice === 'mouse' && !relative) {
    if (input.st.mouseSeen) drawCrosshair(ctx, input.st.mouse.x, input.st.mouse.y);
  } else if (game.state === 'play') {
    // Touch, gamepad and relative mouse aiming have no pointer to show, so mark where the sword is aimed.
    const k = w.king;
    drawCrosshair(ctx, k.x + Math.cos(k.aim) * 34, k.y - 8 + Math.sin(k.aim) * 34);
  }
  if (params.has('debug')) drawText(ctx, 'SEED ' + seed, 4, H - 8, PAL.n);
  if (game.cheated && (game.state === 'play' || game.state === 'paused')) {
    drawText(ctx, 'DEV' + (game.god ? ' GOD' : ''), W - 4, H - 8, PAL.o, { align: 'right' });
  }
  devConsole.draw(ctx, clock);
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
  audio.handle(game.events);
  if (game.state === 'play') audio.setProgress(Math.min(1, game.world.delivered / game.world.p.foodTarget));
  const boss = game.world.boss;
  audio.setBoss((game.state === 'play' || game.state === 'paused') && boss && boss.state !== 'dying' ? boss.hp / boss.maxHp : null, boss ? boss.kind : 'frosty');
  game.events.length = 0;
  draw();
  screenCtx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
  requestAnimationFrame(frame);
}

// Pause automatically if the window loses focus.
addEventListener('blur', () => { if (game.state === 'play') setState('paused'); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'play') setState('paused');
  if (document.hidden) audio.suspend(); else audio.resume();
});

// ---------- start ----------

/** @type {Record<string, () => void>} */
const demo = {
  title: () => setState('title'),
  howto: () => setState('howto'),
  paused: () => setState('paused'),
  highscores: () => setState('highscores', { highlight: 0 }),
  nameEntry: () => setState('nameEntry', { score: 4200, night: 7, hard: false }),
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
