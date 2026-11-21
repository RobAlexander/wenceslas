// Keyboard and mouse input. Touch and gamepad will live in their own
// modules and feed the same snapshot.

import { W, H, CFG } from './config.js';

const MOVE_KEYS = {
  KeyW: [0, -1], KeyA: [-1, 0], KeyS: [0, 1], KeyD: [1, 0],
  ArrowUp: [0, -1], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const keys = new Set();
  const st = {
    mouse: { x: W / 2, y: H / 2 },
    mouseSeen: false,
    swingAt: -Infinity,   // time of the last swing press, for buffering
    pause: false,
    confirm: false,
  };
  let now = 0;

  addEventListener('keydown', (e) => {
    if (MOVE_KEYS[e.code] || e.code === 'Space') e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyP') st.pause = true;
    if (e.code === 'Enter' || e.code === 'Space') st.confirm = true;
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  const toGame = (e) => {
    const r = canvas.getBoundingClientRect();
    st.mouse.x = ((e.clientX - r.left) / r.width) * W;
    st.mouse.y = ((e.clientY - r.top) / r.height) * H;
  };
  addEventListener('mousemove', (e) => { toGame(e); st.mouseSeen = true; });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    toGame(e);
    st.mouseSeen = true;
    st.swingAt = now;
    st.confirm = true;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    st,
    tick(t) { now = t; },
    // Snapshot for one fixed update step.
    gameplay(cooldownLeft) {
      let mx = 0, my = 0;
      for (const [code, v] of Object.entries(MOVE_KEYS)) {
        if (keys.has(code)) { mx += v[0]; my += v[1]; }
      }
      // A press counts if it arrives during the last moments of the cooldown.
      const buffered = now - st.swingAt <= CFG.swingBuffer + Math.max(0, cooldownLeft);
      const swing = buffered && cooldownLeft <= 0;
      if (swing) st.swingAt = -Infinity;
      return { mx, my, ax: st.mouse.x, ay: st.mouse.y, swing };
    },
    takePause() { const p = st.pause; st.pause = false; return p; },
    takeConfirm() { const c = st.confirm; st.confirm = false; return c; },
    clearPresses() { st.pause = false; st.confirm = false; st.swingAt = -Infinity; },
  };
}
