// Очистка значений: в CSS попадает только то, что прошло проверку. Повторяет hudstudio/values.py.
const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const IMAGE_ID = /^[0-9a-f]{16}$/;
const FITS = ['stretch', 'cover', 'contain', 'original'];
const TINT_MODES = ['keep', 'flood'];

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const isHex = (value) => typeof value === 'string' && HEX.test(value);
const isImageId = (value) => typeof value === 'string' && IMAGE_ID.test(value);
// Python округляет половины к чётному: повторяем, чтобы обе стороны давали одно и то же.
const roundHalfEven = (value) => {
  const floor = Math.floor(value);
  const rest = value - floor;
  if (rest !== 0.5) return Math.round(value);
  return floor % 2 === 0 ? floor : floor + 1;
};

const color = (raw, control) => (isHex(raw) ? raw : control.default);
const num = (raw, control) => (isNumber(raw) ? clamp(raw, control.min, control.max) : control.default);
const toggle = (raw, control) => (typeof raw === 'boolean' ? raw : control.default);

function offset(raw, control) {
  if (!isObject(raw) || !isNumber(raw.x) || !isNumber(raw.y)) return control.default;
  const place = (n) => roundHalfEven(clamp(n, control.min, control.max));
  return { x: place(raw.x), y: place(raw.y) };
}

function fill(raw, control) {
  if (!isObject(raw) || !['v', 'h'].includes(raw.dir)) return control.default;
  const { stops } = raw;
  if (!Array.isArray(stops) || stops.length < 2 || stops.length > 4) return control.default;
  if (!stops.every((s) => isObject(s) && isNumber(s.p) && isHex(s.c))) return control.default;
  const clean = stops.map((s) => ({ p: clamp(s.p, 0, 1), c: s.c })).sort((a, b) => a.p - b.p);
  clean[0] = { ...clean[0], p: 0 };
  clean[clean.length - 1] = { ...clean[clean.length - 1], p: 1 };
  return { dir: raw.dir, stops: clean };
}

/** Настройки перекраски. null значит, что картинка не перекрашена. */
function tint(raw) {
  if (!isObject(raw) || !TINT_MODES.includes(raw.mode)) return null;
  if (!isNumber(raw.strength) || !isNumber(raw.bright)) return null;
  const cleanFill = fill(raw.fill, { default: null });
  if (cleanFill === null) return null;
  return { fill: cleanFill, mode: raw.mode, strength: clamp(raw.strength, 0, 100), bright: clamp(raw.bright, -100, 100) };
}

function image(raw) {
  if (!isObject(raw) || !isImageId(raw.id)) return null;
  const clean = {
    id: raw.id,
    fit: FITS.includes(raw.fit) ? raw.fit : 'stretch',
    opacity: isNumber(raw.opacity) ? clamp(raw.opacity, 0, 1) : 1,
  };
  const cleanTint = tint(raw.tint);
  if (cleanTint === null) return clean;
  return { ...clean, tint: cleanTint, base: isImageId(raw.base) ? raw.base : null };
}

const VIDEO_FITS = ['cover', 'contain', 'stretch'];
const MAX_VIDEO_SIDE = 4096;

/** Видео: { id, fit, w, h }; w×h — размер самого видео, нужен для «заполнить» и «вписать». */
function video(raw) {
  if (!isObject(raw) || !isImageId(raw.id)) return null;
  const side = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_VIDEO_SIDE;
  if (!side(raw.w) || !side(raw.h)) return { id: raw.id, fit: 'stretch', w: 0, h: 0 };
  return { id: raw.id, fit: VIDEO_FITS.includes(raw.fit) ? raw.fit : 'cover', w: raw.w, h: raw.h };
}

function shadow(raw, control) {
  const valid = isObject(raw) && typeof raw.on === 'boolean' && isNumber(raw.w) && isHex(raw.c);
  if (!valid) return control.default;
  return { on: raw.on, c: raw.c, w: roundHalfEven(clamp(raw.w, 1, 8)) };
}

const CLEANERS = { color, num, toggle, offset, image, video, fill, outline: shadow, glow: shadow };

/** Новый объект со всеми настройками каталога; плохое значение → значение по умолчанию. */
export function sanitize(controls, raw) {
  const source = isObject(raw) ? raw : {};
  const result = {};
  for (const control of controls) {
    result[control.id] = Object.hasOwn(source, control.id)
      ? CLEANERS[control.type](source[control.id], control)
      : control.default;
  }
  return result;
}

/** id всех файлов (картинок и видео), которые нужны проекту: и готовых, и исходников перекраски. */
export function imageIds(values) {
  const ids = new Set();
  for (const value of Object.values(values)) {
    if (isObject(value) && isImageId(value.id)) ids.add(value.id);
    if (isObject(value) && isImageId(value.base)) ids.add(value.base);
  }
  return ids;
}
