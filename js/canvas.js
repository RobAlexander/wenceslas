// Small helpers for the offscreen canvases the game draws its sprites and backgrounds into.

// The 2D context of a canvas. Browsers only refuse one for a canvas that already has a
// different kind of context, which never happens here; this makes that certain.
/** @param {HTMLCanvasElement} c */
export function context2d(c) {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return ctx;
}

// A new canvas of the given size, with its 2D context.
/** @param {number} w @param {number} h */
export function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: context2d(canvas) };
}
