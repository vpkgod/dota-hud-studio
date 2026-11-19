// Своя картинка вместо файла игры встаёт в размер оригинала.
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMod } from '../../docs/js/build/mod.js';
import { resizeRgba } from '../../docs/js/build/resize.js';
import { blocks, controls, read } from './helpers.mjs';

const solid = (w, h, rgba) => new Uint8Array(w * h * 4).map((_, i) => rgba[i % 4]);

test('тот же размер — пиксели не меняются', () => {
  const src = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(resizeRgba(src, 2, 1, 2, 1), src);
});

test('уменьшение усредняет пиксели, сплошной цвет остаётся тем же', () => {
  assert.deepEqual(resizeRgba(solid(6, 4, [10, 200, 30, 255]), 6, 4, 3, 2), solid(3, 2, [10, 200, 30, 255]));
  const halves = new Uint8Array([0, 0, 0, 255, 200, 100, 50, 255]);
  assert.deepEqual([...resizeRgba(halves, 2, 1, 1, 1)], [100, 50, 25, 255]);
});

test('прозрачные пиксели не пачкают цвет соседей', () => {
  const src = new Uint8Array([255, 0, 0, 255, 0, 0, 255, 0]);
  assert.deepEqual([...resizeRgba(src, 2, 1, 1, 1)], [255, 0, 0, 128]);
});

test('увеличение и неровные доли работают', () => {
  const out = resizeRgba(solid(3, 3, [9, 9, 9, 255]), 3, 3, 7, 5);
  assert.equal(out.length, 7 * 5 * 4);
  assert.deepEqual(out, solid(7, 5, [9, 9, 9, 255]));
});

test('сборка: врождённая встаёт в размеры обоих файлов игры', async () => {
  const sizes = {
    'panorama/images/hud/facets/innate_icon_png.png': [72, 72],
    'panorama/images/hud/facets/innate_icon_large_png.png': [104, 104],
  };
  const result = await buildMod({
    controls: controls(), values: { 'innate.icon': { id: 'f'.repeat(16), fit: 'stretch', opacity: 1 } }, slot: 80, sizes,
    loadStyle: async () => '', loadPng: async () => read('tests/fixtures/tiny.png'),
  });
  const sizeOf = (path) => result.files.find((f) => f.path === path).size;
  const small = sizeOf('panorama/images/hud/facets/innate_icon_png.vtex_c');
  const large = sizeOf('panorama/images/hud/facets/innate_icon_large_png.vtex_c');
  assert.equal(large - small, (104 * 104 - 72 * 72) * 4);
});
