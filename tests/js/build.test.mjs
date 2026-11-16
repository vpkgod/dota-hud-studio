// Файлы, которые собирает сайт, сверяются с тем, что выдал настоящий resourcecompiler Valve.
import assert from 'node:assert/strict';
import test from 'node:test';

import { crc32 } from '../../docs/js/build/bytes.js';
import { BuildError, buildMod, vpkName } from '../../docs/js/build/mod.js';
import { decodePng } from '../../docs/js/build/png.js';
import { compileStyle, compileTexture } from '../../docs/js/build/resource.js';
import { packVpk } from '../../docs/js/build/vpk.js';
import { blocks, controls, read } from './helpers.mjs';

const text = (bytes) => new TextDecoder().decode(bytes);

test('crc32 считает как zlib', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('PNG читается точно: пиксели равны тем, что компилятор положил в vtex_c', async () => {
  const { width, height, rgba } = await decodePng(read('tests/fixtures/tiny.png'));
  const compiled = read('tests/fixtures/tiny.vtex_c');
  assert.deepEqual([width, height], [3, 5]);
  assert.deepEqual(rgba, compiled.subarray(blocks(compiled).fileSize));
});

test('картинка: заголовок данных и пиксели совпадают с компилятором', async () => {
  const { width, height, rgba } = await decodePng(read('tests/fixtures/tiny.png'));
  const ours = compileTexture(rgba, width, height);
  const theirs = read('tests/fixtures/tiny.vtex_c');
  const a = blocks(ours);
  const b = blocks(theirs);
  assert.equal(a.version, b.version);
  assert.equal(a.DATA.length, b.DATA.length);
  // 52 байта: версия, флаги, средний цвет, размеры, формат и описание запасной картинки.
  assert.deepEqual(a.DATA.subarray(0, 4), b.DATA.subarray(0, 4));
  assert.deepEqual(a.DATA.subarray(20, 52), b.DATA.subarray(20, 52));
  // Средний цвет компилятор считает по своей таблице: расхождение в третьем знаке на вид не влияет.
  const floats = (data) => [0, 1, 2, 3].map((i) => new DataView(data.buffer, data.byteOffset).getFloat32(4 + i * 4, true));
  floats(a.DATA).forEach((value, i) => assert.ok(Math.abs(value - floats(b.DATA)[i]) < 0.01));
  assert.deepEqual(ours.subarray(a.fileSize), theirs.subarray(b.fileSize));
  assert.equal(ours.length, a.fileSize + width * height * 4);
});

test('картинка неверного размера отклоняется', () => {
  assert.throws(() => compileTexture(new Uint8Array(8), 3, 5));
  assert.throws(() => compileTexture(new Uint8Array(0), 0, 0));
});

test('стиль: текст в блоке данных совпадает с компилятором, контрольная сумма верна', () => {
  const source = text(read('tests/fixtures/minified.css'));
  const ours = blocks(compileStyle(source));
  const theirs = blocks(read('tests/fixtures/minified.vcss_c'));
  assert.equal(ours.version, theirs.version);
  // Байты 0–3 — контрольная сумма. Компилятор пишет туда сумму исходника, старые файлы — сумму текста.
  assert.deepEqual(ours.DATA.subarray(4), theirs.DATA.subarray(4));
  assert.equal(new DataView(ours.DATA.buffer, ours.DATA.byteOffset).getUint32(0, true), crc32(ours.DATA.subarray(6)));
});

test('раскладка как у старых файлов игры: REDI сразу за таблицей, DATA по границе 16 байт', () => {
  const file = compileStyle('.A{color: red;}');
  const found = blocks(file);
  assert.equal(found.fileSize, file.length);
  assert.equal(found.REDI.byteOffset, 40);
  assert.equal(found.DATA.byteOffset % 16, 0);
});

function unpackVpk(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(0, true), 0x55aa1234);
  assert.equal(view.getUint32(4, true), 1);
  const dataStart = 12 + view.getUint32(8, true);
  let pos = 12;
  const word = () => { const end = bytes.indexOf(0, pos); const s = text(bytes.subarray(pos, end)); pos = end + 1; return s; };
  const files = {};
  for (let ext = word(); ext; ext = word()) {
    for (let dir = word(); dir; dir = word()) {
      for (let name = word(); name; name = word()) {
        const crc = view.getUint32(pos, true);
        const offset = view.getUint32(pos + 8, true);
        const length = view.getUint32(pos + 12, true);
        assert.equal(view.getUint16(pos + 6, true), 0x7fff);
        assert.equal(view.getUint16(pos + 16, true), 0xffff);
        pos += 18;
        const data = bytes.subarray(dataStart + offset, dataStart + offset + length);
        assert.equal(crc32(data), crc);
        files[`${dir}/${name}.${ext}`] = data;
      }
    }
  }
  return files;
}

test('архив VPK раскрывается обратно в те же файлы', () => {
  const files = [
    { path: 'panorama/styles/hud/b.vcss_c', data: new Uint8Array([1, 2, 3]) },
    { path: 'panorama/images/x/a.vtex_c', data: new Uint8Array([9, 8]) },
    { path: 'panorama/styles/hud/a.vcss_c', data: new Uint8Array([]) },
  ];
  const unpacked = unpackVpk(packVpk(files));
  assert.deepEqual(Object.keys(unpacked).sort(), files.map((f) => f.path).sort());
  files.forEach((f) => assert.deepEqual(unpacked[f.path], f.data));
});

test('архив не принимает имена с чужими символами', () => {
  assert.throws(() => packVpk([{ path: 'panorama/файл.vcss_c', data: new Uint8Array(1) }]));
  assert.throws(() => packVpk([{ path: 'noext', data: new Uint8Array(1) }]));
});

test('сборка мода: стиль игры плюс наши правила, картинка и подмена текстуры', async () => {
  const all = controls();
  const id = '0123456789abcdef';
  const picture = { id, fit: 'cover', opacity: 1 };
  const values = { 'hp.label': '#ff0000', 'ab.bg': picture, 'innate.icon': picture };
  const asked = [];
  const result = await buildMod({
    controls: all, values, slot: 7,
    loadStyle: async (name) => `/*${name}*/`,
    loadPng: async (pngId) => { asked.push(pngId); return read('tests/fixtures/tiny.png'); },
  });
  assert.equal(result.name, 'pak07_dir.vpk');
  assert.deepEqual(asked, [id]);
  const unpacked = unpackVpk(result.bytes);
  const style = text(blocks(unpacked['panorama/styles/hud/dota_hud_health_mana.vcss_c']).DATA.subarray(6));
  assert.equal(style, '/*hud/dota_hud_health_mana.css*/.Reborn #HealthLabel{color: #ff0000;}');
  assert.ok(unpacked[`panorama/images/hudstudio/u${id}.vtex_c`]);
  assert.ok(unpacked['panorama/images/hud/facets/innate_icon_png.vtex_c']);
  assert.deepEqual(result.files.map((f) => f.path).sort(), Object.keys(unpacked).sort());
});

test('сборка без изменений и с плохим номером файла объясняет, что не так', async () => {
  const base = { controls: controls(), loadStyle: async () => '', loadPng: async () => null };
  await assert.rejects(buildMod({ ...base, values: {}, slot: 80 }), BuildError);
  await assert.rejects(buildMod({ ...base, values: { 'hp.label': '#ff0000' }, slot: 1 }), BuildError);
  await assert.rejects(buildMod({ ...base, values: { 'ab.bg': { id: 'a'.repeat(16), fit: 'cover', opacity: 1 } }, slot: 80 }), BuildError);
  await assert.rejects(buildMod({ ...base, loadPng: async () => new Uint8Array([1, 2, 3]), values: { 'ab.bg': { id: 'a'.repeat(16), fit: 'cover', opacity: 1 } }, slot: 80 }), BuildError);
  assert.equal(vpkName(80), 'pak80_dir.vpk');
});
