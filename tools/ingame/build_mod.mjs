// Собирает мод из настроек тем же кодом, что и сайт: node build_mod.mjs <values.json> <out.vpk>
// Свои картинки (загруженные человеком) здесь не поддерживаются: проверка в игре — про расположение.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const [valuesPath, outPath] = process.argv.slice(2);
if (!valuesPath || !outPath) {
  console.error('Нужно: node build_mod.mjs <values.json> <out.vpk>');
  process.exit(2);
}

const { buildMod } = await import(`${root}docs/js/build/mod.js`);
const catalog = JSON.parse(readFileSync(`${root}docs/data/catalog.json`, 'utf8'));
const controls = catalog.groups.flatMap((g) => g.controls);
const { _extra: extra = {}, ...values } = JSON.parse(readFileSync(valuesPath, 'utf8'));
// _extra: { "hud/hud_reborn.css": "правила" } — дописать свои правила для диагностики (подсветить панели).

const mod = await buildMod({
  controls,
  values,
  slot: 79,
  loadStyle: async (name) => readFileSync(`${root}docs/gamecss/${name}`, 'utf8') + (extra[name] || ''),
  loadPng: async (id) => { throw new Error(`Своя картинка ${id}: в проверке в игре не поддерживается`); },
});
writeFileSync(outPath, mod.bytes);
console.log(`мод собран: ${outPath} (${mod.bytes.length} байт)`);
