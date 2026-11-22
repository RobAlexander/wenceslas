// Pixel-art sprites, defined as text so they're easy to edit.
// Palette is based on Sweetie 16, plus a skin tone and two browns.

import { makeCanvas } from './canvas.js';

export const PAL = {
  k: '#1a1c2c', P: '#5d275d', r: '#b13e53', o: '#ef7d57', y: '#ffcd75',
  l: '#a7f070', g: '#38b764', G: '#257179', d: '#29366f', B: '#3b5dc9',
  c: '#41a6f6', C: '#73eff7', w: '#f4f4f4', n: '#94b0c2', N: '#566c86',
  D: '#333c57', s: '#f2c39a', b: '#8a5a3c', m: '#5b3a29',
};

const LEGS = [
  ['..N...N..', '..k...k..'],
  ['...N.N...', '..k...k..'],
];

const KING = [
  '..y.y.y..',
  '..yyyyy..',
  '..sssss..',
  '..sksks..',
  '..swwws..',
  '...www...',
  '.rwwwwwr.',
  'rrrryrrrr',
  'srrryrrrs',
  '.rrryrrr.',
  '.rrryrrr.',
  '.ryyyyyr.',
];

const PAGE = [
  '...GGG...',
  '..GGGGG..',
  '..sssss..',
  '..sksks..',
  '..sssss..',
  '..ggggg..',
  '.gggyggg.',
  'sggggyggs',
  '..ggggg..',
  '..bbbbb..',
];

const ROBBER = [
  '...PPP...',
  '..PPPPP..',
  '..PsssP..',
  '..kkkkk..',
  '..PsssP..',
  '..PPPPP..',
  '.PPPPPPP.',
  'sPPPbPPPs',
  '.PPPbPPP.',
  '.PPPPPPP.',
];

// A hooded archer: brown hood and cloak with an orange quiver strap, and a green feather.
const ARCHER = [
  '...mmm.l.',
  '..mmmmm..',
  '..msssm..',
  '..mkskm..',
  '..msssm..',
  '..bbbbb..',
  '.bbbobbb.',
  'sbbbobbbs',
  '.bbbobbb.',
  '.bbbbbbb.',
];

// Mary: a red Santa suit that fits close, with white fur at the collar and hat, a black belt with
// a gold buckle, long fair hair, and black boots.
const MARY = [
  '...rrrw..',
  '..rrrrr..',
  '..wwwww..',
  '.ysssssy.',
  '.ysksksy.',
  '..ssrss..',
  '...sss...',
  '..wwwww..',
  '.rrrrrrr.',
  '.rrrwrrr.',
  '..rrwrr..',
  '.kkkykkk.',
  '..rrrrr..',
];
const MARY_LEGS = [
  ['..r...r..', '..k...k..'],
  ['...r.r...', '..k...k..'],
];

const OLD_MAN = [
  '.........',
  '...bbb...',
  '..bbbbb..',
  '..bsssb..',
  '..sksks..',
  '..wwwww..',
  '..swwws..',
  '.bbbbbbbm',
  '.bbmbbbbm',
  'sbbmbbbsm',
  '.bbbbbbbm',
  '..bbbbb.m',
  '..k...k.m',
];

// Side-on wolf, facing right, with two running frames.
const WOLF_BODY = [
  '..........N.N',
  'N........NDND',
  '.N.......DyDD',
  '..NDDDDDDDDDk',
  '..DDNNNNNDD..',
  '..DnnnnnnD...',
];
const WOLF_LEGS = [
  ['..D.D...D.D..', '..k.k...k.k..'],
  ['.D...D.D...D.', 'k.....k.....k'],
];

export const FOOD_KINDS = /** @type {const} */ (['bread', 'meat', 'wine']);
/** @typedef {typeof FOOD_KINDS[number]} FoodKind */
/** @type {Record<FoodKind, string[]>} */
const FOOD = {
  bread: ['.bbbbb.', 'byoyoyb', 'bbbbbbb', '.bbbbb.'],
  meat: ['..rrr..', '.rrorr.', '.rrrr..', '..ww...', '...ww..'],
  wine: ['..k..', '.PPP.', 'PPrPP', 'PPPPP', '.PPP.'],
};

const PARTRIDGE = [
  '..bb.....',
  '.bkbb....',
  'obbbbb...',
  '..bnnbbb.',
  '..nnnnbbb',
  '...nnnbb.',
  '....o.o..',
];

// One pixel per character, coloured from PAL ('.' and ' ' are transparent).
// tint draws every pixel in that colour instead (for the white hit flash).
/** @param {string[]} rows @param {string} [tint] */
function build(rows, tint) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const { canvas: c, ctx: x } = makeCanvas(w, h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch === '.' || ch === ' ') continue;
      x.fillStyle = tint || PAL[/** @type {keyof typeof PAL} */ (ch)] || '#ff00ff';   // magenta: unknown letter
      x.fillRect(i, j, 1, 1);
    }
  }
  return c;
}

/** @param {HTMLCanvasElement} src  @returns {HTMLCanvasElement} mirrored left to right */
function flip(src) {
  const { canvas: c, ctx: x } = makeCanvas(src.width, src.height);
  x.translate(src.width, 0);
  x.scale(-1, 1);
  x.drawImage(src, 0, 0);
  return c;
}

// A character sprite has two walk frames, each in normal, flipped and
// white (hit flash) versions.
/** @param {string[]} body @param {string[][]} [legFrames] one set of leg rows per walk frame */
function character(body, legFrames = LEGS) {
  const frames = legFrames.map((legs) => {
    const rows = [...body, ...legs];
    const normal = build(rows);
    const white = build(rows, '#ffffff');
    return { normal, flipped: flip(normal), white, whiteFlipped: flip(white) };
  });
  return { frames, w: frames[0].normal.width, h: frames[0].normal.height };
}

/** @param {string[]} rows */
function single(rows) {
  const img = build(rows);
  return { img, flipped: flip(img), w: img.width, h: img.height };
}

/** @param {number} variant  0: three tiers, 1: four */
function makeTree(variant) {
  const tiers = variant ? 4 : 3;
  const w = 17;
  const h = tiers * 6 + 6;
  const { canvas: c, ctx: x } = makeCanvas(w, h);
  const cx = 8;
  // trunk
  x.fillStyle = PAL.m;
  x.fillRect(cx - 1, h - 5, 3, 5);
  for (let t = 0; t < tiers; t++) {
    const top = t * 5;
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      const half = Math.min(8, Math.floor(1 + r * (2 + t) / 3));
      const y = top + r;
      if (y >= h - 4) break;
      x.fillStyle = PAL.G;
      x.fillRect(cx - half, y, half * 2 + 1, 1);
      x.fillStyle = PAL.g;
      x.fillRect(cx - half, y, Math.max(1, half - 1), 1);
      // snow along the upper edge of each tier
      if (r < 2 || r === rows - 1) {
        x.fillStyle = PAL.w;
        if (r < 2) x.fillRect(cx - half, y, half * 2 + 1, 1);
        else x.fillRect(cx - half, y, 2, 1);
      }
    }
  }
  return { img: c, w, h };
}

// A filled pixel circle, centred on (cx, cy).
/** @param {CanvasRenderingContext2D} x @param {number} cx @param {number} cy @param {number} r @param {string} color */
export function disc(x, cx, cy, r, color) {
  x.fillStyle = color;
  for (let dy = -Math.floor(r); dy <= Math.floor(r); dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    x.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

// Frosty, standing: three snowballs with a top hat, coal eyes and buttons, a carrot nose, stick arms
// and a red scarf. 29 pixels wide, 41 tall, with his feet on the bottom row.
function makeFrosty() {
  const w = 29, h = 41, cx = 14;
  const { canvas: c, ctx: x } = makeCanvas(w, h);
  // arms first, so the body goes over their ends
  x.fillStyle = PAL.m;
  for (let i = 0; i < 8; i++) { x.fillRect(7 - i, 24 - i, 1, 1); x.fillRect(21 + i, 24 - i, 1, 1); }
  x.fillRect(0, 13, 1, 3); x.fillRect(2, 14, 1, 2); x.fillRect(28, 13, 1, 3); x.fillRect(26, 14, 1, 2);   // twigs
  // the three balls: a shaded rim, then the white, then a glint
  for (const [by, r] of /** @type {[number, number][]} */ ([[31, 10], [20, 7.5], [10, 5.5]])) {
    disc(x, cx, by, r + 1, PAL.N);
    disc(x, cx - 1, by - 1, r, PAL.w);
    disc(x, cx + 2, by + 2, r - 3, '#e4ecf6');
  }
  // face
  x.fillStyle = PAL.k;
  x.fillRect(cx - 3, 8, 2, 2); x.fillRect(cx + 2, 8, 2, 2);                                  // coal eyes
  for (const mx of [-3, -1, 1, 3]) x.fillRect(cx + mx, 13 + (Math.abs(mx) === 3 ? -1 : 0), 1, 1);   // a coal smile
  x.fillStyle = PAL.o;
  x.fillRect(cx, 10, 6, 2); x.fillStyle = '#d95a2b'; x.fillRect(cx + 3, 11, 3, 1);          // the carrot, pointing right
  // scarf
  x.fillStyle = PAL.r;
  x.fillRect(cx - 6, 15, 13, 2); x.fillRect(cx + 3, 17, 3, 6);
  x.fillStyle = PAL.w; x.fillRect(cx + 3, 19, 3, 1);
  // buttons
  x.fillStyle = PAL.k;
  for (const by of [22, 26, 30]) x.fillRect(cx - 1, by, 2, 2);
  // top hat
  x.fillStyle = PAL.k;
  x.fillRect(cx - 5, 3, 11, 1);                       // the brim
  x.fillRect(cx - 3, -0, 7, 3);                       // the crown
  x.fillStyle = PAL.r; x.fillRect(cx - 3, 2, 7, 1);   // the band
  // an all-white copy, for the flash when he is hit
  const { canvas: wc, ctx: wx } = makeCanvas(w, h);
  wx.drawImage(c, 0, 0);
  wx.globalCompositeOperation = 'source-in';
  wx.fillStyle = '#ffffff';
  wx.fillRect(0, 0, w, h);
  return { img: c, white: wc, w, h };
}

function makeRock() {
  const rows = [
    '...wwwww....',
    '..wwwwwwww..',
    '.wnnwwwnnww.',
    '.nnnnnnnnnN.',
    'NnnnnnnnNNNN',
    'NNnnnnNNNNND',
    'DNNNNNNNNNDD',
    '.DDDDDDDDDD.',
  ];
  return single(rows);
}

export function loadSprites() {
  return {
    king: character(KING),
    page: character(PAGE),
    robber: character(ROBBER),
    archer: character(ARCHER),
    mary: character(MARY, MARY_LEGS),
    wolf: character(WOLF_BODY, WOLF_LEGS),
    oldMan: single(OLD_MAN),
    partridge: single(PARTRIDGE),
    food: Object.fromEntries(FOOD_KINDS.map((k) => [k, single(FOOD[k])])),
    trees: [makeTree(0), makeTree(1)],
    rock: makeRock(),
    frosty: makeFrosty(),
  };
}
