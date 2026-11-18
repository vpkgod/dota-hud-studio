// Свои цвета: без повторов, новые первыми и не больше лимита.
import assert from 'node:assert/strict';
import test from 'node:test';

import { MAX_CUSTOM_COLORS, addCustomColor, loadCustomColors } from '../../docs/js/storage.js';

function memoryStorage() {
  const data = new Map();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test('свои цвета сохраняются без повторов, новые первыми', () => {
  globalThis.window = { localStorage: memoryStorage() };
  assert.deepEqual(loadCustomColors(), []);

  let colors = addCustomColor([], '#AABBCC');
  colors = addCustomColor(colors, '#123456');
  colors = addCustomColor(colors, '#aabbcc');
  assert.deepEqual(colors, ['#aabbcc', '#123456']);
  assert.deepEqual(loadCustomColors(), ['#aabbcc', '#123456']);
});

test('в списке свои цвета, только корректные и не больше лимита', () => {
  const storage = memoryStorage();
  storage.setItem('hudstudio.colors.v1', JSON.stringify(['#abcdef', 'red', '#12345678', ...Array(MAX_CUSTOM_COLORS).fill('#000000')]));
  globalThis.window = { localStorage: storage };

  const colors = loadCustomColors();
  assert.equal(colors.length, MAX_CUSTOM_COLORS);
  assert.equal(colors[0], '#abcdef');
  assert.ok(colors.every((color) => /^#[0-9a-f]{6}$/i.test(color)));
});

test('если хранилище переполнено, список не меняется', () => {
  globalThis.window = { localStorage: { getItem: () => null, setItem: () => { throw new Error('full'); } } };
  assert.equal(addCustomColor([], '#abcdef'), null);
});
