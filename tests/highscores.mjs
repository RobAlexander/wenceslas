// Unit tests for the high score store. Run with: node tests/highscores.mjs
import assert from 'node:assert/strict';
import { makeStore, cleanName, MAX_SCORES, MAX_NAME, NAME_CHARS } from '../js/highscores.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}
const entry = (name, score, extra = {}) => ({ name, score, night: 3, hard: false, ...extra });

// ordering, ranks, persistence
{
  const st = fakeStorage();
  const s = makeStore(() => st);
  assert.deepEqual(s.load(), []);
  assert.equal(s.insert(entry('AAA', 100)), 1);
  assert.equal(s.insert(entry('BBB', 300)), 1);
  assert.equal(s.insert(entry('CCC', 200)), 2);
  assert.deepEqual(s.load().map((e) => e.name), ['BBB', 'CCC', 'AAA']);
  // a fresh store reads the same data back
  assert.deepEqual(makeStore(() => st).load().map((e) => e.score), [300, 200, 100]);
}
// ties: the older entry stays above the newer one
{
  const s = makeStore(() => fakeStorage());
  s.insert(entry('OLD', 500));
  assert.equal(s.insert(entry('NEW', 500)), 2);
}
// top-10 cut-off and qualifies()
{
  const s = makeStore(() => fakeStorage());
  assert.equal(s.qualifies(0), false);
  assert.equal(s.qualifies(1), true);
  for (let i = 1; i <= MAX_SCORES; i++) s.insert(entry('AAA', i * 100));
  assert.equal(s.load().length, MAX_SCORES);
  assert.equal(s.qualifies(100), false);  // equal to the lowest: doesn't qualify
  assert.equal(s.qualifies(101), true);
  assert.equal(s.insert(entry('LOW', 50)), 0);
  assert.equal(s.load().length, MAX_SCORES);
  assert.equal(s.insert(entry('TOP', 5000)), 1);
  assert.equal(s.load().length, MAX_SCORES);
  assert.equal(s.load().at(-1).score, 200); // the 100 was pushed out
}
// corrupt or odd stored data
{
  for (const bad of ['not json', '{"a":1}', 'null', '[1,"x",{"name":"","score":5}]']) {
    const s = makeStore(() => fakeStorage({ 'wenceslas.highscores.v1': bad }));
    assert.deepEqual(s.load(), [], bad);
    assert.equal(s.insert(entry('OK', 10)), 1);
  }
  const s = makeStore(() => fakeStorage({ 'wenceslas.highscores.v1': JSON.stringify([{ name: 'abc9!', score: '40', night: 2 }]) }));
  assert.deepEqual(s.load(), [{ name: 'ABC9', score: 40, night: 2, hard: false }]);  // upper-cased, '!' dropped, the digit kept
}
// storage that throws on every call: the session still works from memory
{
  const boom = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const s = makeStore(() => boom);
  assert.equal(s.insert(entry('AAA', 10)), 1);
  assert.equal(s.insert(entry('BBB', 20)), 1);
  assert.deepEqual(s.load().map((e) => e.name), ['BBB', 'AAA']);
  assert.equal(s.hardUnlocked(), false);
  s.unlockHard();
  assert.equal(s.hardUnlocked(), true);
  assert.equal(s.lastName(), 'AAA');
  s.setName('XYZ');
  assert.equal(s.lastName(), 'XYZ');
}
// no storage object at all
{
  const s = makeStore(() => undefined);
  assert.equal(s.insert(entry('AAA', 10)), 1);
  assert.equal(s.load().length, 1);
}
// settings persist
{
  const st = fakeStorage();
  const a = makeStore(() => st);
  assert.equal(a.hardUnlocked(), false);
  a.unlockHard();
  a.setName('ROBERTA');
  const b = makeStore(() => st);
  assert.equal(b.hardUnlocked(), true);
  assert.equal(b.lastName(), 'ROBERTA');
  st.data['wenceslas.initials'] = 'bad value';
  assert.equal(makeStore(() => st).lastName(), 'AAA');
}
// bad entries are refused
{
  const s = makeStore(() => fakeStorage());
  assert.equal(s.insert({ name: '', score: 10 }), 0);
  assert.equal(s.insert({ name: '   ', score: 10 }), 0, 'spaces are not a name');
  assert.equal(s.insert({ name: 'AAA', score: NaN }), 0);
  assert.equal(s.insert(null), 0);
  assert.deepEqual(s.load(), []);
}
// names: up to MAX_NAME characters, from NAME_CHARS only
{
  assert.equal(MAX_NAME, 8);
  assert.equal(cleanName('rob'), 'ROB');
  assert.equal(cleanName('Sir Ignatius'), 'SIR IGNA', 'cut to 8 characters');
  assert.equal(cleanName('  ROB  '), 'ROB', 'no leading or trailing spaces');
  assert.equal(cleanName('A B'), 'A B', 'inner spaces stay');
  assert.equal(cleanName('J.R-7'), 'J.R-7');
  assert.equal(cleanName('R<O>B!\n'), 'ROB', 'other characters are dropped');
  assert.equal(cleanName('   '), '');
  assert.equal(cleanName(null), '');
  assert.equal(cleanName(undefined), '');
  assert.ok(NAME_CHARS.startsWith(' ') && [...NAME_CHARS].every((c) => cleanName('A' + c + 'A').length >= 2), 'every offered character is accepted');
  const s = makeStore(() => fakeStorage());
  assert.equal(s.insert(entry('Long Name Here', 10)), 1);
  assert.equal(s.load()[0].name, 'LONG NAM', 'a long name is cut, not refused');
}
// scores saved by older versions (3-letter `initials`) still load, and a name wins if both exist
{
  const old = JSON.stringify([{ initials: 'ROB', score: 900, night: 5, hard: true }, { initials: 'OLD', name: 'NEWER', score: 100, night: 1 }]);
  const s = makeStore(() => fakeStorage({ 'wenceslas.highscores.v1': old }));
  assert.deepEqual(s.load(), [{ name: 'ROB', score: 900, night: 5, hard: true }, { name: 'NEWER', score: 100, night: 1, hard: false }]);
}
console.log('highscores: all tests passed');
