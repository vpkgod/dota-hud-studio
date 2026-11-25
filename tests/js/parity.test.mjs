// Сайт должен превращать настройки в CSS так же, как проверенный код на Python.
import assert from 'node:assert/strict';
import test from 'node:test';

import { generate, generateCompact, imagesUsed, replacedTextures, videosUsed } from '../../docs/js/build/cssgen.js';
import { sanitize } from '../../docs/js/build/values.js';
import { controls, readJson } from './helpers.mjs';

const cases = readJson('tests/js/parity.json');
const all = controls();

test('очистка значений совпадает с Python', () => {
  cases.forEach((c, i) => assert.deepEqual(sanitize(all, c.raw), c.clean, `случай ${i}`));
});

test('правила CSS совпадают с Python', () => {
  cases.forEach((c, i) => assert.deepEqual(generate(all, c.clean), c.css, `случай ${i}`));
});

test('списки картинок совпадают с Python', () => {
  cases.forEach((c, i) => {
    assert.deepEqual([...imagesUsed(all, c.clean)].sort(), c.images, `случай ${i}`);
    assert.deepEqual(replacedTextures(all, c.clean), c.replaced, `случай ${i}`);
    assert.deepEqual(videosUsed(all, c.clean), c.videos, `случай ${i}`);
  });
});

test('сжатый вид отличается от обычного только пробелами', () => {
  const squeeze = (text) => text.replace(/\n\{\n/g, '{').replace(/\t/g, '').replace(/;\n/g, ';').replace(/\}\n\n?/g, '}');
  cases.forEach((c, i) => {
    const pretty = generate(all, c.clean);
    const compact = generateCompact(all, c.clean);
    assert.deepEqual(Object.keys(compact), Object.keys(pretty), `случай ${i}`);
    for (const name of Object.keys(pretty)) assert.equal(compact[name], squeeze(pretty[name]), `случай ${i}, ${name}`);
  });
});
