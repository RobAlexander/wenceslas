// Pixel-art sprites, defined as text so they're easy to edit.
// Palette is based on Sweetie 16, plus a skin tone and two browns.

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

export const FOOD_KINDS = ['bread', 'meat', 'wine'];
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

function build(rows, tint) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch === '.' || ch === ' ') continue;
      x.fillStyle = tint || PAL[ch] || '#ff00ff';
      x.fillRect(i, j, 1, 1);
    }
  }
  return c;
}

function flip(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const x = c.getContext('2d');
  x.translate(src.width, 0);
  x.scale(-1, 1);
  x.drawImage(src, 0, 0);
  return c;
}

// A character sprite has two walk frames, each in normal, flipped and
// white (hit flash) versions.
function character(body) {
  const frames = LEGS.map((legs) => {
    const rows = [...body, ...legs];
    const normal = build(rows);
    const white = build(rows, '#ffffff');
    return { normal, flipped: flip(normal), white, whiteFlipped: flip(white) };
  });
  return { frames, w: frames[0].normal.width, h: frames[0].normal.height };
}

function single(rows) {
  const img = build(rows);
  return { img, flipped: flip(img), w: img.width, h: img.height };
}

function makeTree(variant) {
  const tiers = variant ? 4 : 3;
  const w = 17;
  const h = tiers * 6 + 6;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
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
    oldMan: single(OLD_MAN),
    partridge: single(PARTRIDGE),
    food: Object.fromEntries(FOOD_KINDS.map((k) => [k, single(FOOD[k])])),
    trees: [makeTree(0), makeTree(1)],
    rock: makeRock(),
  };
}
