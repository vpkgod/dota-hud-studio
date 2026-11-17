// Английская версия сайта: у каждой русской строки есть перевод, а русский текст в коде стоит только внутри t().
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { detectLang, plural, t } from '../../docs/js/i18n.js';
import EN from '../../docs/js/lang/en.js';

const CYRILLIC = /[а-яё]/i;
const JS_DIR = 'docs/js';
const jsFiles = readdirSync(JS_DIR).filter((f) => f.endsWith('.js') && f !== 'i18n.js').map((f) => `${JS_DIR}/${f}`);
const read = (path) => readFileSync(path, 'utf8');
// Строка с пометкой i18n-ok намеренно хранит русский текст (например, имя проекта по умолчанию на обоих языках).
const stripComments = (code) => code.replace(/^.*i18n-ok.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

function htmlStrings() {
  const html = read('docs/index.html');
  const texts = [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1].trim());
  const attrs = [...html.matchAll(/\s(?:title|aria-label|placeholder|content)="([^"]*)"/g)].map((m) => m[1]);
  return [...texts, ...attrs].filter((s) => s && CYRILLIC.test(s));
}

function codeStrings() {
  return jsFiles.flatMap((f) => [...read(f).matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'")));
}

function buildErrors() {
  return [...read('docs/js/build/mod.js').matchAll(/BuildError\([`']([^`']*)[`']\)/g)]
    .map((m) => m[1].replace('${MIN_SLOT}', '2').replace('${MAX_SLOT}', '99'));
}

function catalogStrings() {
  const data = JSON.parse(read('docs/data/catalog.json'));
  const out = data.areas.map((a) => a.title);
  data.groups.forEach((g) => {
    out.push(g.title, g.about);
    g.controls.forEach((c) => out.push(c.label, c.sub, c.hint));
  });
  const shop = data.preview.shop || {};
  ['basics', 'upgrades', 'guide'].forEach((k) => (shop[k] || []).forEach((s) => out.push(s.title)));
  return out.filter((s) => typeof s === 'string' && CYRILLIC.test(s));
}

const missing = (list) => [...new Set(list)].filter((s) => !(s in EN));

test('у текста страницы есть перевод', () => assert.deepEqual(missing(htmlStrings()), []));
test('у строк из кода есть перевод', () => assert.deepEqual(missing([...codeStrings(), ...buildErrors()]), []));
test('у каталога настроек есть перевод', () => assert.deepEqual(missing(catalogStrings()), []));

test('русский текст в коде стоит только внутри t()', () => {
  const leaks = jsFiles.flatMap((f) => stripComments(read(f)).split('\n')
    .map((line, i) => [i + 1, line.replace(/\bt\('(?:[^'\\]|\\.)*'/g, '')])
    .filter(([, line]) => CYRILLIC.test(line) && !/throw new Error\(/.test(line))
    .map(([n, line]) => `${f}:${n}: ${line.trim()}`));
  assert.deepEqual(leaks, []);
});

test('подстановки {имя} в переводе те же, что в оригинале', () => {
  const names = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const bad = Object.entries(EN).filter(([ru, en]) => names(ru).join() !== names(en).join()).map(([ru]) => ru);
  assert.deepEqual(bad, []);
});

test('в переводе нет русских букв и пустых строк', () => {
  const bad = Object.entries(EN).filter(([, en]) => !en.trim() || CYRILLIC.test(en)).map(([ru]) => ru);
  assert.deepEqual(bad, []);
});

test('язык: адрес важнее выбора, выбор важнее браузера', () => {
  assert.equal(detectLang({ search: '?lang=en', saved: 'ru', languages: ['ru-RU'] }), 'en');
  assert.equal(detectLang({ search: '?lang=xx', saved: 'en', languages: ['ru-RU'] }), 'en');
  assert.equal(detectLang({ languages: ['uk-UA'] }), 'ru');
  assert.equal(detectLang({ languages: ['de-DE', 'ru'] }), 'en');
  assert.equal(detectLang({}), 'ru');
});

test('вне браузера сайт остаётся русским', () => {
  assert.equal(t('Скачать худ'), 'Скачать худ');
  assert.equal(t('Нашлось: {n}', { n: 3 }), 'Нашлось: 3');
  assert.equal(plural(1, 'настройка', 'настройки', 'настроек'), 'настройка');
  assert.equal(plural(3, 'настройка', 'настройки', 'настроек'), 'настройки');
  assert.equal(plural(11, 'настройка', 'настройки', 'настроек'), 'настроек');
});
