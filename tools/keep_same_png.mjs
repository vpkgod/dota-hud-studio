// После export: картинки, у которых пиксели не изменились, возвращаются из git как были.
// Новая версия распаковщика иначе сжимает PNG, и без этого каждое обновление меняло бы сотни файлов.
// Запуск из корня проекта: node tools/keep_same_png.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { decodePng } from '../docs/js/build/png.js';

const git = (...args) => execFileSync('git', args, { maxBuffer: 1e9 });
const changed = git('diff', '--name-only', '--', 'docs/game').toString().split('\n').filter((f) => f.endsWith('.png'));
const same = [];
for (const file of changed) {
  try {
    const before = await decodePng(new Uint8Array(git('show', `HEAD:${file}`)));
    const after = await decodePng(new Uint8Array(readFileSync(file)));
    if (before.width === after.width && before.height === after.height
      && Buffer.compare(Buffer.from(before.rgba), Buffer.from(after.rgba)) === 0) same.push(file);
  } catch { /* удалён или формат, который не читаем: оставляем как есть */ }
}
if (same.length) git('checkout', 'HEAD', '--', ...same);
console.log(`Картинок с теми же пикселями возвращено: ${same.length}; по-настоящему изменились: ${changed.length - same.length}`);
