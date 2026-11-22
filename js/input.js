// Input hub. Keyboard and mouse are handled here; touch (touch.js) and gamepad
// (gamepad.js) feed the same snapshot through the small API at the bottom.
//
// gameplay() merges everything into { mx, my, swing, autoAim, ax/ay | aimAngle }
// for World.updateKing(). Menus read takeKeys() and takeClick(); touch taps become
// clicks and gamepad buttons become key presses, so every screen works with all three.

import { W, H, CFG } from './config.js';

/** @typedef {import('./world.js').GameInput} GameInput */
/** @typedef {{ x: number, y: number }} Point */
/** @typedef {'mouse' | 'touch' | 'pad'} Device */
/** @typedef {'touch' | 'pad'} StickSource  devices that push stick and aim values in */

/** @type {Record<string, [number, number]>} */
const MOVE_KEYS = {
  KeyW: [0, -1], KeyA: [-1, 0], KeyS: [0, 1], KeyD: [1, 0],
  ArrowUp: [0, -1], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowRight: [1, 0],
};

// Keys that keep firing while held down, when read through takeKeys().
const REPEATABLE = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace']);

/** @param {PointerEvent} e */
const mouseLike = (e) => e.pointerType === 'mouse' || e.pointerType === 'pen';

/** @typedef {'move' | 'pointer'} MouseAim  'move': mouse motion points the sword; 'pointer': it points at the cursor */

// Relative aiming. Mouse movement is added to a small vector whose length is capped, so the
// sword turns round after a short movement the other way, however far the mouse went before.
// Movement shorter than AIM_MIN (jitter) gives no direction yet.
const AIM_CAP = 24;
const AIM_MIN = 6;

/**
 * Add a mouse movement to the aim vector (changed in place).
 * @param {Point} v  @param {number} dx  @param {number} dy
 * @returns {number | null}  the aim angle in radians, or null if the vector is still too short
 */
export function nudgeAim(v, dx, dy) {
  v.x += dx;
  v.y += dy;
  const len = Math.hypot(v.x, v.y);
  if (len > AIM_CAP) { v.x *= AIM_CAP / len; v.y *= AIM_CAP / len; }
  return Math.min(len, AIM_CAP) >= AIM_MIN ? Math.atan2(v.y, v.x) : null;
}

/** @param {HTMLCanvasElement} canvas */
export function createInput(canvas) {
  /** @type {Set<string>} key codes held down */
  const keys = new Set();
  const coarse = !!globalThis.matchMedia?.('(pointer: coarse)').matches;
  /**
   * @type {{ mouse: Point, mouseSeen: boolean, mouseAim: MouseAim, mouseAngle: number | null,
   *   lastDevice: Device, swingAt: number, autoAim: boolean,
   *   pause: boolean, confirm: boolean, blocked: boolean, keyQueue: string[], click: Point | null }}
   */
  const st = {
    mouse: { x: W / 2, y: H / 2 },
    mouseSeen: false,
    mouseAim: 'move',
    mouseAngle: null,     // 'move' mode: the direction the mouse has been moving, or null before any
    // Which device was used last decides where the sword aims and what is drawn:
    // 'mouse' | 'touch' | 'pad'. Touch-first devices start in 'touch'.
    lastDevice: coarse ? 'touch' : 'mouse',
    swingAt: -Infinity,   // time of the last swing press, for buffering
    autoAim: false,       // the buffered swing came from a tap: aim at the nearest robber
    pause: false,
    confirm: false,
    blocked: false, // the dev console has the keyboard
    keyQueue: [],   // key codes pressed since the last takeKeys(), for menus
    click: null,    // last click or tap position (game coordinates), for menus
  };
  // Stick and aim values pushed in by the touch and gamepad modules.
  /** @type {Record<StickSource, { mx: number, my: number, aim: number | null }>} aim: radians, or null for none */
  const src = { touch: { mx: 0, my: 0, aim: null }, pad: { mx: 0, my: 0, aim: null } };
  let now = 0;

  /** @param {string} code */
  const pushKey = (code) => { if (st.keyQueue.length < 32) st.keyQueue.push(code); };

  addEventListener('keydown', (e) => {
    if (st.blocked) return;
    if (MOVE_KEYS[e.code] || e.code === 'Space' || e.code === 'Backspace') e.preventDefault();
    keys.add(e.code);
    if (!e.repeat || REPEATABLE.has(e.code)) pushKey(e.code);
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyP') st.pause = true;
    if (e.code === 'Enter' || e.code === 'Space') st.confirm = true;
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // Pointer events, not mouse events: a tap on a phone also fires a delayed fake
  // "mousedown", which would otherwise swing a second time. Touch is handled in touch.js.
  /** @param {PointerEvent} e */
  const toGame = (e) => {
    const r = canvas.getBoundingClientRect();
    st.mouse.x = ((e.clientX - r.left) / r.width) * W;
    st.mouse.y = ((e.clientY - r.top) / r.height) * H;
  };
  // In 'move' mode the sword follows the direction of mouse movement, not the cursor position.
  // movementX/Y come with every ordinary pointer event, so no pointer lock (and no browser notice).
  const aimVec = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => {
    if (!mouseLike(e)) return;
    toGame(e);
    st.mouseSeen = true;
    st.lastDevice = 'mouse';
    if (st.mouseAim === 'move') {
      // A browser may coalesce moves: use them all when it says so, else the event itself.
      const parts = e.getCoalescedEvents?.() ?? [];
      for (const p of parts.length ? parts : [e]) {
        const a = nudgeAim(aimVec, p.movementX || 0, p.movementY || 0);
        if (a != null) st.mouseAngle = a;
      }
    }
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (!mouseLike(e) || e.button !== 0) return;
    toGame(e);
    st.mouseSeen = true;
    st.lastDevice = 'mouse';
    st.click = { x: st.mouse.x, y: st.mouse.y };
    st.swingAt = now;
    st.autoAim = false;
    st.confirm = true;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const api = {
    st,
    /** @param {number} t */
    tick(t) { now = t; },
    // The dev console takes the keyboard: drop held keys and pending presses either way.
    /** @param {boolean} on */
    block(on) { st.blocked = on; keys.clear(); api.clearPresses(); },

    // Snapshot for one fixed update step.
    /** @param {number} cooldownLeft  the king's swing cooldown @returns {GameInput} */
    gameplay(cooldownLeft) {
      let mx = 0, my = 0;
      for (const [code, v] of Object.entries(MOVE_KEYS)) {
        if (keys.has(code)) { mx += v[0]; my += v[1]; }
      }
      mx += src.touch.mx + src.pad.mx;
      my += src.touch.my + src.pad.my;
      // A press counts if it arrives during the last moments of the cooldown.
      const buffered = now - st.swingAt <= CFG.swingBuffer + Math.max(0, cooldownLeft);
      const swing = buffered && cooldownLeft <= 0;
      const autoAim = swing && st.autoAim;
      if (swing) { st.swingAt = -Infinity; st.autoAim = false; }

      /** @type {GameInput} */
      const snap = { mx, my, swing, autoAim };
      if (st.lastDevice === 'mouse') {
        if (st.mouseAim === 'pointer') {
          snap.ax = st.mouse.x;
          snap.ay = st.mouse.y;
        } else if (st.mouseAngle != null) snap.aimAngle = st.mouseAngle;   // else the world keeps the previous aim
      } else {
        // An aim stick or drag wins; otherwise face the way we're walking;
        // otherwise (neither) the world keeps the previous aim.
        const a = src[st.lastDevice].aim;
        if (a != null) snap.aimAngle = a;
        else if (Math.hypot(mx, my) > 0.2) snap.aimAngle = Math.atan2(my, mx);
      }
      return snap;
    },

    takePause() { const p = st.pause; st.pause = false; return p; },
    takeConfirm() { const c = st.confirm; st.confirm = false; return c; },
    // Menu input: key codes pressed since the last call, and the last click (or null).
    takeKeys() { const k = st.keyQueue; st.keyQueue = []; return k; },
    takeClick() { const c = st.click; st.click = null; return c; },
    clearPresses() {
      st.pause = false; st.confirm = false; st.swingAt = -Infinity; st.autoAim = false;
      st.keyQueue = []; st.click = null;
    },

    /** @param {MouseAim} mode */
    setMouseAim(mode) { st.mouseAim = mode; st.mouseAngle = null; aimVec.x = 0; aimVec.y = 0; },

    // ----- API for touch.js and gamepad.js -----
    /** @param {Device} d */
    setDevice(d) { st.lastDevice = d; },
    /** @param {StickSource} source @param {number} x @param {number} y */
    setStick(source, x, y) { src[source].mx = x; src[source].my = y; },
    /** @param {StickSource} source @param {number | null} angle  radians, or null for none */
    setAim(source, angle) { src[source].aim = angle; },
    pressSwing(autoAim = false) { st.swingAt = now; st.autoAim = autoAim; },
    pushKey,
    /** @param {number} x @param {number} y */
    pushClick(x, y) { st.click = { x, y }; },                  // game coordinates
    requestPause() { st.pause = true; },
  };
  return api;
}
