// Проект и его сохранённые версии лежат в localStorage этого браузера.
const PROJECT_KEY = 'hudstudio.project.v1';
const VERSIONS_KEY = 'hudstudio.versions.v1';
const PREFS_KEY = 'hudstudio.prefs.v1';
export const MAX_VERSIONS = 30;

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
