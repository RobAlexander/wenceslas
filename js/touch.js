// Twin-stick touch controls.
//   Left half of the screen:  floating joystick (the base appears where the thumb lands).
//   Right half of the screen: drag to aim, release to swing; a quick tap swings at the nearest robber.
// Outside gameplay, every tap becomes a click, so menus work unchanged.
// Nothing is drawn, and no listener does anything, until a touch has actually happened.

import { W, H, HUD_H } from './config.js';
import { PAL } from './sprites.js';
import { drawText } from './font.js';

const STICK_R = 48;     // joystick radius, in CSS pixels
const DEADZONE = 0.15;
const DRAG_PX = 10;     // movement that turns a touch into an aim drag
const TAP_MS = 250;     // a touch shorter than this, without a drag, is a tap
const HOLD_S = 0.4;     // the aim direction stays this long after the finger lifts

// The pause button is drawn small but its hit area is a comfortable thumb size.
const PAUSE_HIT = { x: W - 56, y: 0, w: 56, h: 48 };
const PAUSE_BOX = { x: W - 26, y: HUD_H + 3, w: 22, h: 16 };

const inRect = (r, p) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

// opts: { isPlaying(): bool, onFirstTap(): void }
export function createTouch(input, canvas, { isPlaying, onFirstTap }) {
  const t = { seen: false, stick: null, aim: null };
  let now = 0, holdUntil = 0, firstDone = false;

  const rect = () => canvas.getBoundingClientRect();
  const toGame = (cx, cy) => {
    const r = rect();
    return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
  };

  function applyStick() {
    const s = t.stick;
    const dx = s.x - s.bx, dy = s.y - s.by, len = Math.hypot(dx, dy);
    if (len > STICK_R) {                 // dragged past the edge: the base follows the thumb
      s.bx += (dx / len) * (len - STICK_R);
      s.by += (dy / len) * (len - STICK_R);
    }
    const m = Math.min(1, len / STICK_R);              // 0..1 stick deflection
    if (m < DEADZONE) { input.setStick('touch', 0, 0); return; }
    const strength = (m - DEADZONE) / (1 - DEADZONE);  // rescaled so it starts from 0 at the deadzone edge
    input.setStick('touch', (dx / len) * strength, (dy / len) * strength);
  }

  function onDown(e) {
    if (e.pointerType !== 'touch') return;
    e.preventDefault?.();
    t.seen = true;
    input.setDevice('touch');
    const g = toGame(e.clientX, e.clientY);
    if (!isPlaying()) { input.pushClick(g.x, g.y); return; }   // menus: a tap is a click
    if (inRect(PAUSE_HIT, g)) { input.requestPause(); return; }
    if (e.clientX < innerWidth / 2) {
      if (!t.stick) {
        t.stick = { id: e.pointerId, bx: e.clientX, by: e.clientY, x: e.clientX, y: e.clientY };
        applyStick();
      }
    } else if (!t.aim) {
      t.aim = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, t0: e.timeStamp, dragging: false, angle: 0 };
      holdUntil = 0;
    }
  }

  function onMove(e) {
    if (e.pointerType !== 'touch') return;
    const s = t.stick, a = t.aim;
    if (s && e.pointerId === s.id) {
      s.x = e.clientX; s.y = e.clientY;
      applyStick();
    } else if (a && e.pointerId === a.id) {
      a.x = e.clientX; a.y = e.clientY;
      if (!a.dragging && Math.hypot(a.x - a.sx, a.y - a.sy) > DRAG_PX) a.dragging = true;
      if (a.dragging) {
        a.angle = Math.atan2(a.y - a.sy, a.x - a.sx);
        input.setAim('touch', a.angle);
      }
    }
  }

  function onUp(e, cancelled) {
    if (e.pointerType !== 'touch') return;
    const s = t.stick, a = t.aim;
    if (s && e.pointerId === s.id) {
      t.stick = null;
      input.setStick('touch', 0, 0);
    }
    if (a && e.pointerId === a.id) {
      t.aim = null;
      if (cancelled) input.setAim('touch', null);
      else if (isPlaying()) {
        if (a.dragging) {                 // aimed, then let go: swing that way
          input.setAim('touch', a.angle);
          holdUntil = now + HOLD_S;
          input.pressSwing(false);
        } else if (e.timeStamp - a.t0 <= TAP_MS) {   // quick tap: swing at the nearest robber
          input.pressSwing(true);
        }
      }
    }
    // Fullscreen needs a "real" tap, and pointerup counts where pointerdown may not.
    if (!cancelled && !firstDone) { firstDone = true; onFirstTap?.(); }
  }

  addEventListener('pointerdown', onDown, { passive: false });
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', (e) => onUp(e, false));
  addEventListener('pointercancel', (e) => onUp(e, true));

  // ---------- drawing ----------

  // Dotted ring and disc, each with a dark edge so they stay visible on light snow.
  function ring(ctx, cx, cy, r, color) {
    const n = Math.max(24, Math.round(r * 3));
    for (let i = 0; i < n; i += 2) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
      ctx.fillStyle = 'rgba(26,28,44,0.55)';
      ctx.fillRect(x, y + 1, 2, 2);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  function disc(ctx, cx, cy, r, color) {
    for (const [rad, col] of [[r + 1, 'rgba(26,28,44,0.45)'], [r, color]]) {
      ctx.fillStyle = col;
      for (let y = -rad; y <= rad; y++) {
        const hw = Math.round(Math.sqrt(rad * rad - y * y));
        ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
      }
    }
  }

  return {
    seen: () => t.seen,

    // Called once per update with the game clock (seconds).
    update(clock) {
      now = clock;
      if (!t.aim && holdUntil && now >= holdUntil) {
        input.setAim('touch', null);
        holdUntil = 0;
      }
    },

    draw(ctx, world) {
      if (!t.seen || !isPlaying()) return;
      const r = rect();
      const k = W / r.width;            // game pixels per CSS pixel

      // pause button
      const p = PAUSE_BOX;
      ctx.fillStyle = 'rgba(26,28,44,0.6)';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = PAL.w;
      ctx.fillRect(p.x + 7, p.y + 4, 3, 8);
      ctx.fillRect(p.x + 12, p.y + 4, 3, 8);

      const s = t.stick, a = t.aim;
      if (s) {
        const b = toGame(s.bx, s.by), n = toGame(s.x, s.y);
        ring(ctx, b.x, b.y, STICK_R * k, PAL.w);
        disc(ctx, n.x, n.y, 6, 'rgba(244,244,244,0.8)');
      }
      if (a) {
        const b = toGame(a.sx, a.sy), n = toGame(a.x, a.y);
        ring(ctx, b.x, b.y, 14 * k, PAL.y);
        if (a.dragging) disc(ctx, n.x, n.y, 4, 'rgba(255,205,117,0.9)');
      }
      // Faint hints during the first moments of night one, until a finger is down.
      if (!s && !a && world.night === 1 && world.time < 20) {
        ring(ctx, 90, H - 70, 38, PAL.w);
        drawText(ctx, 'MOVE', 90, H - 73, PAL.w, { align: 'center' });
        ring(ctx, W - 90, H - 70, 38, PAL.y);
        drawText(ctx, 'AIM, RELEASE', W - 90, H - 80, PAL.y, { align: 'center' });
        drawText(ctx, 'OR TAP TO SWING', W - 90, H - 70, PAL.y, { align: 'center' });
      }
    },
  };
}
