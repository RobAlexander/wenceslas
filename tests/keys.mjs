// Key bindings (js/keys.js) and how input.js uses them. Run with: node tests/keys.mjs
import assert from 'node:assert/strict';
import { ACTIONS, MAX_KEYS, RESERVED, DEFAULT_BINDINGS, defaultBindings, cleanBindings, bindKey, keyName } from '../js/keys.js';

// ---- the defaults are valid
{
  const seen = new Map();
  for (const { id } of ACTIONS) {
    const list = DEFAULT_BINDINGS[id];
    assert.equal(list.length, MAX_KEYS, id + ' has a fixed number of slots');
    for (const code of list) {
      if (!code) continue;
      assert.ok(!RESERVED.includes(code), code + ' is reserved');
      assert.ok(!seen.has(code), `${code} is on both ${seen.get(code)} and ${id}`);
      seen.set(code, id);
    }
  }
  assert.deepEqual(cleanBindings(DEFAULT_BINDINGS), DEFAULT_BINDINGS, 'cleaning the defaults changes nothing');
  assert.deepEqual(cleanBindings(null), DEFAULT_BINDINGS);
  assert.notEqual(defaultBindings(), DEFAULT_BINDINGS, 'a fresh copy');
  // arrows swing in four directions, the keypad in eight; WASD moves
  assert.deepEqual(DEFAULT_BINDINGS.up, ['KeyW', '', '']);
  for (const [id, arrow] of [['atkN', 'ArrowUp'], ['atkS', 'ArrowDown'], ['atkW', 'ArrowLeft'], ['atkE', 'ArrowRight']]) {
    assert.ok(DEFAULT_BINDINGS[id].includes(arrow), id + ' on ' + arrow);
  }
  const pad = ['Numpad7', 'Numpad8', 'Numpad9', 'Numpad4', 'Numpad6', 'Numpad1', 'Numpad2', 'Numpad3'];
  const ids = ['atkNW', 'atkN', 'atkNE', 'atkW', 'atkE', 'atkSW', 'atkS', 'atkSE'];
  ids.forEach((id, i) => assert.ok(DEFAULT_BINDINGS[id].includes(pad[i]), id + ' on ' + pad[i]));
}

// ---- cleanBindings copes with anything
{
  for (const junk of [undefined, 5, 'x', [], [1, 2], { up: 5 }, { up: 'KeyW' }, { up: [null, {}, 7] }]) {
    const b = cleanBindings(junk);
    assert.deepEqual(Object.keys(b), ACTIONS.map((a) => a.id), 'every function is there');
    for (const list of Object.values(b)) assert.equal(list.length, MAX_KEYS);
  }
  const b = cleanBindings({ up: ['KeyZ', 'KeyZ', 'Escape', 'KeyX', 'KeyQ'], swing: ['KeyZ', 'Backquote', ''] });
  assert.deepEqual(b.up, ['KeyZ', '', ''], 'a repeat and a reserved key are dropped');
  assert.deepEqual(cleanBindings({ up: ['KeyZ', 'KeyX', 'KeyC', 'KeyQ'] }).up, ['KeyZ', 'KeyX', 'KeyC'], 'only three are kept');
  assert.deepEqual(b.swing, ['', '', ''], 'a key already on an earlier function is dropped');
  assert.deepEqual(b.down, DEFAULT_BINDINGS.down, 'a missing function gets its defaults');
  // a default that another function has taken is not given back
  const c = cleanBindings({ swing: ['KeyW', '', ''] });
  assert.deepEqual(c.swing, ['KeyW', '', ''] );
  assert.deepEqual(c.up, ['', '', ''], 'W is now the swing key, so up has lost its default');
  // an explicitly empty function stays empty
  assert.deepEqual(cleanBindings({ pause: ['', '', ''] }).pause, ['', '', '']);
  assert.deepEqual(cleanBindings(JSON.parse(JSON.stringify(c))), c, 'cleaning is stable');
}

// ---- bindKey
{
  const d = defaultBindings();
  const r = bindKey(d, 'up', 1, 'KeyI');
  assert.deepEqual(r.bindings.up, ['KeyW', 'KeyI', '']);
  assert.equal(r.lost, null);
  assert.deepEqual(d.up, ['KeyW', '', ''], 'the original is not changed');
  const steal = bindKey(d, 'up', 0, 'ArrowUp');
  assert.deepEqual(steal.bindings.up, ['ArrowUp', '', '']);
  assert.deepEqual(steal.bindings.atkN, ['', 'Numpad8', ''], 'taken off the function that had it');
  assert.equal(steal.lost, 'SWING UP');
  // moving a key to another slot of the same function loses nothing
  const same = bindKey(d, 'atkN', 2, 'ArrowUp');
  assert.deepEqual(same.bindings.atkN, ['', 'Numpad8', 'ArrowUp']);
  assert.equal(same.lost, null);
  // clearing
  assert.deepEqual(bindKey(d, 'swing', 1, '').bindings.swing, ['Space', '', 'Numpad0']);
  // reserved
  assert.equal(bindKey(d, 'up', 0, 'Escape'), null);
  assert.equal(bindKey(d, 'up', 0, 'Backquote'), null);
  // a result is always clean
  assert.deepEqual(cleanBindings(steal.bindings), steal.bindings);
}

// ---- keyName: readable, and only characters the font has
{
  assert.equal(keyName('KeyW'), 'W');
  assert.equal(keyName('Digit4'), '4');
  assert.equal(keyName('Numpad8'), 'NUM 8');
  assert.equal(keyName('NumpadAdd'), 'NUM +');
  assert.equal(keyName('ArrowUp'), 'UP');
  assert.equal(keyName('Space'), 'SPACE');
  assert.equal(keyName('ShiftLeft'), 'L SHIFT');
  assert.equal(keyName('F5'), 'F5');
  assert.equal(keyName(''), '---');
  const font = /^[A-Z0-9:/\-.!+',?()=><_*[\]`~"; ]+$/;
  for (const code of ['KeyA', 'Digit0', 'Numpad0', 'NumpadEnter', 'NumpadDecimal', 'Backslash', 'IntlBackslash', 'Minus', 'Equal', 'BracketLeft',
    'Quote', 'Comma', 'Slash', 'Backquote', 'F12', 'PageUp', 'ControlRight', 'AudioVolumeUp', 'Unidentified', 'IntlRo']) {
    const n = keyName(code);
    assert.ok(font.test(n) && n.length <= 9, code + ' -> ' + n);
  }
  for (const { id } of ACTIONS) for (const code of DEFAULT_BINDINGS[id]) if (code) assert.notEqual(keyName(code), '?', code);
}

// ---- input.js with a fake window
{
  const handlers = {};
  globalThis.addEventListener = (type, fn) => { (handlers[type] ||= []).push(fn); };
  const { createInput } = await import('../js/input.js');
  const canvas = { addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 360 }) };
  const fire = (type, e = {}) => (handlers[type] || []).forEach((fn) => fn({ preventDefault() {}, ...e }));
  const down = (code, e = {}) => fire('keydown', { code, repeat: false, ...e });
  const up = (code) => fire('keyup', { code });
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' vs ' + b);
  const fresh = () => { const i = createInput(canvas); i.tick(1); return i; };

  // WASD moves; the arrow keys do not
  let input = fresh();
  down('KeyD'); down('KeyW');
  let g = input.gameplay(0);
  assert.deepEqual([g.mx, g.my], [1, -1]);
  assert.equal(g.swing, false);
  up('KeyD'); up('KeyW');
  down('ArrowLeft'); down('ArrowDown');
  g = input.gameplay(0);
  assert.deepEqual([g.mx, g.my], [0, 0], 'the arrow keys no longer walk');
  up('ArrowLeft'); up('ArrowDown');

  // arrows swing in the four directions, the keypad in the eight
  const aim = (code) => { input = fresh(); down(code); const s = input.gameplay(0); up(code); return s; };
  for (const [code, a] of [['ArrowUp', -Math.PI / 2], ['ArrowDown', Math.PI / 2], ['ArrowLeft', Math.PI], ['ArrowRight', 0],
    ['Numpad8', -Math.PI / 2], ['Numpad2', Math.PI / 2], ['Numpad4', Math.PI], ['Numpad6', 0],
    ['Numpad7', -3 * Math.PI / 4], ['Numpad9', -Math.PI / 4], ['Numpad1', 3 * Math.PI / 4], ['Numpad3', Math.PI / 4]]) {
    const s = aim(code);
    assert.equal(s.swing, true, code + ' swings');
    near(s.aimAngle, a);
    assert.equal(s.ax, undefined);
  }
  // two held together point between them
  input = fresh(); down('ArrowUp'); down('ArrowRight');
  near(input.gameplay(0).aimAngle, -Math.PI / 4);
  up('ArrowUp'); up('ArrowRight');
  // opposite keys cancel, and then there is nothing to aim or swing
  input = fresh(); down('ArrowUp'); down('ArrowDown');
  assert.equal(input.gameplay(0).aimAngle, undefined);
  up('ArrowUp'); up('ArrowDown');

  // holding a swing key keeps swinging, each time the cooldown ends; letting go stops it
  input = fresh(); down('ArrowRight');
  assert.equal(input.gameplay(0).swing, true);
  input.tick(2);
  assert.equal(input.gameplay(0.3).swing, false, 'not during the cooldown');
  assert.equal(input.gameplay(0).swing, true, 'and again when it has ended');
  up('ArrowRight');
  input.tick(3);
  const rest = input.gameplay(0);
  assert.equal(rest.swing, false);
  near(rest.aimAngle, 0);                       // the sword stays where it was (the mouse takes over when it moves)

  // a pressed swing key counts if it arrives a moment before the cooldown ends
  input = fresh(); down('ArrowUp'); up('ArrowUp');
  assert.equal(input.gameplay(0.05).swing, false);
  assert.equal(input.gameplay(0).swing, true, 'buffered');

  // the swing key swings where it was aimed, without turning the sword
  input = fresh(); down('Space');
  g = input.gameplay(0);
  assert.equal(g.swing, true);
  assert.equal(g.aimAngle, undefined);
  up('Space');

  // pause: Escape always, and P by default
  input = fresh(); down('KeyP'); assert.equal(input.takePause(), true); up('KeyP');
  down('Escape'); assert.equal(input.takePause(), true); up('Escape');

  // actionsFor tells main.js which key is mute and fullscreen
  assert.deepEqual(input.actionsFor('KeyM'), ['mute']);
  assert.deepEqual(input.actionsFor('KeyF'), ['fullscreen']);
  assert.deepEqual(input.actionsFor('KeyQ'), []);

  // rebinding takes effect at once, and the old keys stop working
  input = fresh();
  let b = bindKey(defaultBindings(), 'up', 1, 'KeyI').bindings;
  b = bindKey(b, 'pause', 0, 'KeyO').bindings;
  b = bindKey(b, 'atkE', 0, 'KeyL').bindings;
  input.setBindings(b);
  down('KeyI'); assert.deepEqual([input.gameplay(0).mx, input.gameplay(0).my], [0, -1]); up('KeyI');
  down('KeyP'); assert.equal(input.takePause(), false, 'P no longer pauses'); up('KeyP');
  down('KeyO'); assert.equal(input.takePause(), true); up('KeyO');
  down('KeyL'); near(input.gameplay(0).aimAngle, 0); assert.equal(input.gameplay(0).swing, true); up('KeyL');
  b = bindKey(b, 'up', 0, '').bindings;
  input.setBindings(b);
  down('KeyW'); assert.equal(input.gameplay(0).my, 0, 'a cleared key does nothing'); up('KeyW');
  // the blur of the window lets go of everything
  down('KeyI'); fire('blur'); assert.equal(input.gameplay(0).my, 0);

  // pointer mode follows the cursor again once the swing key is released
  input = fresh(); input.setMouseAim('pointer');
  input.st.mouse.x = 500; input.st.mouse.y = 100;
  assert.equal(input.gameplay(0).ax, 500);
  down('ArrowDown'); g = input.gameplay(0);
  assert.equal(g.ax, undefined); near(g.aimAngle, Math.PI / 2);
  up('ArrowDown'); assert.equal(input.gameplay(0).ax, 500);
}

console.log('keys ok');
