import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../..', import.meta.url));
export const read = (rel) => new Uint8Array(readFileSync(root + rel));
export const readJson = (rel) => JSON.parse(readFileSync(root + rel, 'utf8'));
export const controls = () => readJson('docs/data/catalog.json').groups.flatMap((g) => g.controls);

/** { имя блока: байты } из собранного файла Source 2. */
export function blocks(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(12, true);
  const found = { fileSize: view.getUint32(0, true), version: view.getUint16(6, true) };
  for (let i = 0; i < count; i += 1) {
    const pos = 16 + i * 12;
    const name = String.fromCharCode(...bytes.subarray(pos, pos + 4));
    const start = pos + 4 + view.getUint32(pos + 4, true);
    found[name] = bytes.subarray(start, start + view.getUint32(pos + 8, true));
  }
  return found;
}
