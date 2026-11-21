// Gamepad support. Kept separate and simple, and it only talks to the input module.
// It hasn't been tried on real hardware, so it sticks to the standard layout:
//   In play:   left stick / d-pad move, right stick aims, RT / RB / A swing, Start pauses.
//   In menus:  d-pad or left stick navigate (with repeat), A = Enter, B = Escape,
//              Start = Enter (Escape on the pause menu, so it resumes).

const DEAD_MOVE = 0.2;   // left stick deadzone
const AIM_MIN = 0.35;    // right stick must be pushed this far to aim
const NAV = 0.6;         // left stick threshold for menu navigation
const REPEAT_FIRST = 0.4, REPEAT = 0.12;   // seconds

const BTN = { A: 0, B: 1, RB: 5, RT: 7, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

// Radial deadzone: below `dead` is zero, and the rest is rescaled to run from 0 to 1.
function radial(x, y, dead) {
  const m = Math.hypot(x, y);
  if (m < dead) return [0, 0];
  const s = Math.min(1, (m - dead) / (1 - dead)) / m;
  return [x * s, y * s];
}

// getPads is injectable so the module can be tested without a browser.
export function createGamepad(input, getPads = () => globalThis.navigator?.getGamepads?.() ?? []) {
  let prev = {};            // button name -> was down at the last update
  const hold = {};          // menu direction -> seconds until it repeats
  let hadPad = false;

  const down = (pad, i) => {
    const b = pad.buttons?.[i];
    return !!b && (b.pressed || b.value > 0.5);
  };

  return {
    // state: the game's current state name ('play', 'paused', 'title', ...)
    update(dt, state) {
      const pad = Array.from(getPads()).find((p) => p && p.connected !== false);
      if (!pad) {
        if (hadPad) { input.setStick('pad', 0, 0); input.setAim('pad', null); }
        hadPad = false;
        prev = {};
        return;
      }
      hadPad = true;

      const axis = (i) => pad.axes?.[i] || 0;
      const now = {};
      for (const [name, i] of Object.entries(BTN)) now[name] = down(pad, i);
      const edge = (name) => now[name] && !prev[name];
      const [lx, ly] = radial(axis(0), axis(1), DEAD_MOVE);

      if (lx || ly || Math.hypot(axis(2), axis(3)) > AIM_MIN || Object.keys(now).some(edge)) input.setDevice('pad');

      if (state === 'play') {
        for (const k in hold) delete hold[k];
        input.setStick('pad', lx + (now.RIGHT ? 1 : 0) - (now.LEFT ? 1 : 0), ly + (now.DOWN ? 1 : 0) - (now.UP ? 1 : 0));
        input.setAim('pad', Math.hypot(axis(2), axis(3)) > AIM_MIN ? Math.atan2(axis(3), axis(2)) : null);
        if (edge('RT') || edge('RB') || edge('A')) input.pressSwing(false);
        if (edge('START')) input.requestPause();
      } else {
        input.setStick('pad', 0, 0);
        input.setAim('pad', null);
        const dirs = {
          ArrowUp: now.UP || axis(1) < -NAV,
          ArrowDown: now.DOWN || axis(1) > NAV,
          ArrowLeft: now.LEFT || axis(0) < -NAV,
          ArrowRight: now.RIGHT || axis(0) > NAV,
        };
        for (const [key, on] of Object.entries(dirs)) {
          if (!on) { delete hold[key]; continue; }
          if (hold[key] === undefined) { input.pushKey(key); hold[key] = REPEAT_FIRST; }
          else if ((hold[key] -= dt) <= 0) { input.pushKey(key); hold[key] = REPEAT; }
        }
        if (edge('A')) input.pushKey('Enter');
        if (edge('B')) input.pushKey('Escape');
        if (edge('START')) input.pushKey(state === 'paused' ? 'Escape' : 'Enter');
      }
      prev = now;
    },
  };
}
