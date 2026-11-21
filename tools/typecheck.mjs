// Type-checks js/ with TypeScript (settings in tsconfig.json, which is strict).
//
// Every file must pass the strict check, except the files in LEGACY: those were written
// before type checking was added, and so far only pass the non-strict check. The list
// only shrinks:
//   - any strict error in a file not on the list fails, so new files are strict from the start;
//   - a non-strict error anywhere fails, so legacy files can't get worse;
//   - a legacy file that has become strict-clean fails until it's taken off the list.
//
// Run with: npm run typecheck

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const LEGACY = [
  'js/audio.js',
  'js/gamepad.js',
  'js/input.js',
  'js/main.js',
  'js/music.js',
  'js/render.js',
  'js/screens.js',
  'js/sprites.js',
  'js/touch.js',
  'js/world.js',
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');

// Runs tsc and groups its errors by file. Each error keeps its continuation lines.
function check(extraArgs) {
  let out = '';
  try {
    out = execFileSync(process.execPath, [tsc, '-p', root, '--pretty', 'false', ...extraArgs], { cwd: root, encoding: 'utf8' });
  } catch (e) {
    const err = /** @type {{ stdout?: string, status?: number }} */ (e);
    if (err.status !== 1 && err.status !== 2) throw e;      // tsc itself failed to run
    out = err.stdout ?? '';
  }
  /** @type {Map<string, string[]>} */
  const byFile = new Map();
  /** @type {string[] | null} */
  let current = null;
  for (const line of out.split('\n')) {
    const m = /^(.+?)\(\d+,\d+\): error /.exec(line);
    if (m) {
      const file = m[1].replace(/\\/g, '/');
      if (!byFile.has(file)) byFile.set(file, []);
      current = /** @type {string[]} */ (byFile.get(file));
      current.push(line);
    } else if (line.startsWith(' ') && current) {
      current[current.length - 1] += '\n' + line;
    } else if (line.trim()) {
      // An error with no file (a config problem, say): report it as its own group.
      if (!byFile.has('(general)')) byFile.set('(general)', []);
      /** @type {string[]} */ (byFile.get('(general)')).push(line);
      current = null;
    }
  }
  return byFile;
}

const problems = [];

for (const f of LEGACY) if (!existsSync(join(root, f))) problems.push(`${f} is listed in LEGACY but doesn't exist.`);

const loose = check(['--strict', 'false']);
for (const [, errors] of loose) problems.push(...errors);

const strict = check([]);
for (const [file, errors] of strict) {
  if (!LEGACY.includes(file)) problems.push(...errors);
}
for (const f of LEGACY) {
  if (existsSync(join(root, f)) && !strict.has(f)) {
    problems.push(`${f} now passes the strict check: take it off the LEGACY list in tools/typecheck.mjs.`);
  }
}

const remaining = LEGACY.filter((f) => strict.has(f)).map((f) => `${f.replace('js/', '')} ${strict.get(f)?.length}`);
if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\ntypecheck: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`typecheck: passed. Not yet strict: ${remaining.join(', ')}`);
