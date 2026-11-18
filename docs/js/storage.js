// Проект и его сохранённые версии лежат в localStorage этого браузера.
const PROJECT_KEY = 'hudstudio.project.v1';
const VERSIONS_KEY = 'hudstudio.versions.v1';
const PREFS_KEY = 'hudstudio.prefs.v1';
const COLORS_KEY = 'hudstudio.colors.v1';
export const MAX_VERSIONS = 30;
export const MAX_CUSTOM_COLORS = 16;

function read(key, fallback) {
  try {
    const text = window.localStorage.getItem(key);
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

/** true, если запись удалась. Ошибка значит, что хранилище выключено или переполнено. */
function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const loadProject = () => read(PROJECT_KEY, null);
export const saveProject = (project) => write(PROJECT_KEY, project);

export const loadPrefs = () => read(PREFS_KEY, {});
export const savePrefs = (prefs) => write(PREFS_KEY, prefs);

export function loadVersions() {
  const list = read(VERSIONS_KEY, []);
  return Array.isArray(list) ? list.filter((v) => v && typeof v.id === 'string' && v.values) : [];
}

/** Возвращает новый список или null, если сохранить не получилось. */
export function addVersion(versions, name, values) {
  const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, time: Date.now(), values };
  const next = [entry, ...versions].slice(0, MAX_VERSIONS);
  return write(VERSIONS_KEY, next) ? next : null;
}

export function removeVersion(versions, id) {
  const next = versions.filter((v) => v.id !== id);
  return write(VERSIONS_KEY, next) ? next : null;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Свои цвета, которые выбирали в последний раз. Новые - первыми. */
export function loadCustomColors() {
  const list = read(COLORS_KEY, []);
  return Array.isArray(list) ? list.filter((color) => typeof color === 'string' && HEX_COLOR.test(color)).slice(0, MAX_CUSTOM_COLORS) : [];
}

/** Добавляет цвет без повторов. Возвращает новый список или null, если сохранить не получилось. */
export function addCustomColor(colors, color) {
  if (!HEX_COLOR.test(color)) return colors;
  const normal = color.toLowerCase();
  const next = [normal, ...colors.filter((item) => item.toLowerCase() !== normal)].slice(0, MAX_CUSTOM_COLORS);
  return write(COLORS_KEY, next) ? next : null;
}
