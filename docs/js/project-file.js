// Сохранение проекта в файл и открытие из файла. Картинки лежат внутри файла.
import { imageIds, sanitize } from './build/values.js';

const FORMAT = 'hudstudio-1';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const safeFileName = (name) => (name.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').slice(0, 60) || 'my-hud');

export async function exportProject({ name, values }, images) {
  const packed = {};
  const tints = [];
  for (const id of imageIds(values)) {
    const blob = images.blob(id);
    if (!blob) continue;
    packed[id] = await blobToDataUrl(blob);
    if (Object.values(values).some((v) => v && v.tint && v.id === id)) tints.push(id);
  }
  const data = { format: FORMAT, name, values, images: packed, tints };
  downloadBlob(`${safeFileName(name)}.hudstudio.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
}

/** { name, values } или ошибка, если файл не подходит. Картинки из файла попадают в хранилище. */
export async function readProject(file, controls, images) {
  const parsed = JSON.parse(await file.text());
  if (!parsed || parsed.format !== FORMAT || typeof parsed.values !== 'object') throw new Error('format');
  const tints = new Set(Array.isArray(parsed.tints) ? parsed.tints : []);
  for (const [id, url] of Object.entries(parsed.images || {})) {
    if (typeof url !== 'string' || !url.startsWith('data:image/png;base64,')) continue;
    await images.add(await (await fetch(url)).blob(), { tint: tints.has(id) });
  }
  const values = sanitize(controls, parsed.values);
  // Ссылки на картинки, которых в файле не оказалось, убираем: иначе сборка споткнётся.
  for (const control of controls) {
    const value = values[control.id];
    if (control.type === 'image' && value && !images.has(value.id)) values[control.id] = null;
  }
  return { name: typeof parsed.name === 'string' ? parsed.name.slice(0, 60) : '', values };
}
