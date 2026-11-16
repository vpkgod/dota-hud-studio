// Архив VPK версии 1 одним файлом: дерево имён, за ним содержимое.
import { concat, crc32, u16, u32, utf8 } from './bytes.js';

const SIGNATURE = 0x55aa1234;
const IN_DIR_FILE = 0x7fff;
const END_OF_ENTRY = 0xffff;
const text = (value) => concat([utf8(value), new Uint8Array(1)]);

function split(path) {
  const slash = path.lastIndexOf('/');
  const dot = path.lastIndexOf('.');
  if (dot <= slash + 1 || /[^\x20-\x7e]/.test(path)) throw new Error(`Неподходящее имя файла: ${path}`);
  return { ext: path.slice(dot + 1), dir: slash < 0 ? ' ' : path.slice(0, slash), name: path.slice(slash + 1, dot) };
}

/** files: [{ path, data: Uint8Array }] → Uint8Array готового pakNN_dir.vpk. */
export function packVpk(files) {
  const tree = new Map();
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : 1));
  let offset = 0;
  for (const file of sorted) {
    const { ext, dir, name } = split(file.path);
    if (!tree.has(ext)) tree.set(ext, new Map());
    const dirs = tree.get(ext);
    if (!dirs.has(dir)) dirs.set(dir, []);
    dirs.get(dir).push(concat([text(name), u32(crc32(file.data)), u16(0), u16(IN_DIR_FILE),
      u32(offset), u32(file.data.length), u16(END_OF_ENTRY)]));
    offset += file.data.length;
  }
  const parts = [];
  for (const [ext, dirs] of tree) {
    parts.push(text(ext));
    for (const [dir, entries] of dirs) parts.push(text(dir), ...entries, new Uint8Array(1));
    parts.push(new Uint8Array(1));
  }
  parts.push(new Uint8Array(1));
  const treeBytes = concat(parts);
  return concat([u32(SIGNATURE), u32(1), u32(treeBytes.length), treeBytes, ...sorted.map((f) => f.data)]);
}
