// Сборка мода целиком: стили игры + наши правила, картинки и архив pakNN_dir.vpk.
import { generateCompact, imageGamePath, imagesUsed, layoutsUsed, replacedTextures, videosUsed } from './cssgen.js';
import { decodePng } from './png.js';
import { resizeRgba } from './resize.js';
import { compileStyle, compileTexture } from './resource.js';
import { packVpk } from './vpk.js';

export const MIN_SLOT = 2;
export const MAX_SLOT = 99;

export const validSlot = (slot) => Number.isInteger(slot) && slot >= MIN_SLOT && slot <= MAX_SLOT;
export const vpkName = (slot) => `pak${String(slot).padStart(2, '0')}_dir.vpk`;

export class BuildError extends Error {}

// Самое большое видео, которое кладём в мод: Panorama грузит его целиком при входе в игру.
export const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const WEBM_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];
const isWebm = (bytes) => bytes && bytes.length > 4 && WEBM_MAGIC.every((b, i) => bytes[i] === b);

/**
 * loadStyle(имя) → текст оригинального стиля игры; loadPng(id) → Uint8Array с PNG.
 * sizes — { путь PNG игры: [ширина, высота] }: подменённый файл игры встаёт в размер оригинала.
 * loadVideo(id) → Uint8Array с webm; loadLayout(путь без расширения) → готовый vxml_c (его собирает
 * python3 -m hudstudio.layout: в браузере разметку не скомпилировать).
 * Возвращает { name, bytes, files: [{ path, size }] }.
 */
export async function buildMod({ controls, values, slot, loadStyle, loadPng, loadVideo, loadLayout, sizes = {} }) {
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
  for (const [path, id] of Object.entries(videosUsed(controls, values)).sort()) {
    const data = await loadVideo(id);
    if (!isWebm(data)) throw new BuildError('Видео не найдено или повреждено. Загрузи его заново.');
    if (data.length > MAX_VIDEO_BYTES) throw new BuildError('Видео больше 30 МБ: возьми покороче или поменьше.');
    files.push({ path, data });
  }
  for (const path of layoutsUsed(controls, values)) {
    files.push({ path: `${path}.vxml_c`, data: await loadLayout(path) });
  }
  const bytes = packVpk(files);
  return { name: vpkName(slot), bytes, files: files.map((f) => ({ path: f.path, size: f.data.length })) };
}
