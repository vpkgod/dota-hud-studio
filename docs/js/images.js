// Картинки пользователя хранятся в самом браузере (IndexedDB). Имя картинки — начало её SHA-256.
import { sha256Hex } from './build/bytes.js';

const DB_NAME = 'hudstudio';
const STORE = 'images';
const MAX_IMAGE_SIDE = 2048;
const ID_LENGTH = 16;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run(db, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Любая картинка → PNG не больше 2048 по большей стороне. */
export async function fileToPng(file) {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('png'))), 'image/png');
  });
}

/**
 * Хранилище картинок. Если IndexedDB недоступна (например, в приватном окне),
 * картинки живут до закрытия вкладки: durable() скажет об этом.
 */
export async function createImageStore() {
  const records = new Map(); // id → { blob, tint, url }
  let db = null;
  try {
    db = await openDb();
    const saved = await run(db, 'readonly', (store) => store.getAll());
    saved.forEach((r) => records.set(r.id, { blob: r.blob, tint: r.tint, url: URL.createObjectURL(r.blob) }));
  } catch {
    db = null;
  }

  async function add(blob, { tint = false } = {}) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const id = (await sha256Hex(bytes)).slice(0, ID_LENGTH);
    if (records.has(id)) return id;
    records.set(id, { blob, tint, url: URL.createObjectURL(blob) });
    if (db) {
      try { await run(db, 'readwrite', (store) => store.put({ id, blob, tint })); } catch { /* останется в памяти */ }
    }
    return id;
  }

  async function remove(id) {
    const record = records.get(id);
    if (!record) return;
    URL.revokeObjectURL(record.url);
    records.delete(id);
    if (db) {
      try { await run(db, 'readwrite', (store) => store.delete(id)); } catch { /* уже нет */ }
    }
  }

  return {
    add,
    remove,
    durable: () => db !== null,
    has: (id) => records.has(id),
    url: (id) => records.get(id)?.url || '',
    blob: (id) => records.get(id)?.blob || null,
    /** Картинки, которые загрузил человек (без промежуточных результатов перекраски). */
    uploads: () => [...records].filter(([, r]) => !r.tint).map(([id]) => id),
    async bytes(id) {
      const record = records.get(id);
      return record ? new Uint8Array(await record.blob.arrayBuffer()) : null;
    },
    /** Убирает результаты перекраски, на которые больше ничего не ссылается. */
    async pruneTints(keepIds) {
      const stale = [...records].filter(([id, r]) => r.tint && !keepIds.has(id)).map(([id]) => id);
      for (const id of stale) await remove(id);
      return stale.length;
    },
  };
}
