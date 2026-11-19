// Сборка мода целиком: стили игры + наши правила, картинки и архив pakNN_dir.vpk.
import { generateCompact, imageGamePath, imagesUsed, replacedTextures } from './cssgen.js';
import { decodePng } from './png.js';
import { resizeRgba } from './resize.js';
import { compileStyle, compileTexture } from './resource.js';
import { packVpk } from './vpk.js';

export const MIN_SLOT = 2;
export const MAX_SLOT = 99;

export const validSlot = (slot) => Number.isInteger(slot) && slot >= MIN_SLOT && slot <= MAX_SLOT;
export const vpkName = (slot) => `pak${String(slot).padStart(2, '0')}_dir.vpk`;

export class BuildError extends Error {}

/**
 * loadStyle(имя) → текст оригинального стиля игры; loadPng(id) → Uint8Array с PNG.
 * sizes — { путь PNG игры: [ширина, высота] }: подменённый файл игры встаёт в размер оригинала.
 * Возвращает { name, bytes, files: [{ path, size }] }.
 */
export async function buildMod({ controls, values, slot, loadStyle, loadPng, sizes = {} }) {
  if (!validSlot(slot)) throw new BuildError(`Номер файла должен быть от ${MIN_SLOT} до ${MAX_SLOT}.`);
  const rules = generateCompact(controls, values);
  const replaced = replacedTextures(controls, values);
  if (!Object.keys(rules).length && !Object.keys(replaced).length) {
    throw new BuildError('Пока ничего не изменено — собирать нечего.');
  }
  const files = [];
  for (const [name, text] of Object.entries(rules)) {
    const original = await loadStyle(name);
    files.push({ path: `panorama/styles/${name.replace(/\.css$/, '.vcss_c')}`, data: compileStyle(original + text) });
  }
  const decoded = new Map();
  async function pixels(id) {
    if (!decoded.has(id)) {
      const png = await loadPng(id);
      if (!png) throw new BuildError('Одна из картинок не найдена. Загрузи её заново.');
      try {
        decoded.set(id, await decodePng(png));
      } catch {
        throw new BuildError('Одна из картинок повреждена или слишком большая. Загрузи её заново.');
      }
    }
    return decoded.get(id);
  }
  async function texture(id, size) {
    const { width, height, rgba } = await pixels(id);
    const [w, h] = size || [width, height];
    try {
      return compileTexture(resizeRgba(rgba, width, height, w, h), w, h);
    } catch {
      throw new BuildError('Одна из картинок повреждена или слишком большая. Загрузи её заново.');
    }
  }
  for (const id of [...imagesUsed(controls, values)].sort()) {
    files.push({ path: `${imageGamePath(id)}.vtex_c`, data: await texture(id) });
  }
  for (const [path, id] of Object.entries(replaced).sort()) {
    files.push({ path: `${path}.vtex_c`, data: await texture(id, sizes[`${path}.png`]) });
  }
  const bytes = packVpk(files);
  return { name: vpkName(slot), bytes, files: files.map((f) => ({ path: f.path, size: f.data.length })) };
}
