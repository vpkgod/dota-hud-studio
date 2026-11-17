// Перекраска картинок на месте: пиксели считаются здесь, в игру уходит готовый PNG.
import { t } from './i18n.js';

const SHADE_POINT = 0.8;   // до этой яркости оттенок темнеет, выше уходит в блик
const HIGHLIGHT_LIMIT = 0.6;
const LOUDEST_SHARE = 0.01; // яркими считаем верхний 1% пикселей: одинокие блики не сбивают расчёт
const MIN_VISIBLE_ALPHA = 16;

function hexRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function gradientTable(fill) {
  const table = new Uint8ClampedArray(256 * 3);
  const stops = fill.stops.map((s) => ({ p: s.p, rgb: hexRgb(s.c) }));
  for (let i = 0; i < 256; i += 1) {
    const t = i / 255;
    const right = Math.max(1, stops.findIndex((s) => s.p >= t));
    const a = stops[right - 1];
    const b = stops[right];
    const k = b.p === a.p ? 0 : Math.min(1, Math.max(0, (t - a.p) / (b.p - a.p)));
    for (let c = 0; c < 3; c += 1) table[i * 3 + c] = a.rgb[c] + (b.rgb[c] - a.rgb[c]) * k;
  }
  return table;
}

const lightness = (d, i) => (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;

function brightestLevel(data) {
  const histogram = new Uint32Array(256);
  let visible = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] >= MIN_VISIBLE_ALPHA) {
      histogram[Math.round(lightness(data, i) * 255)] += 1;
      visible += 1;
    }
  }
  let seen = 0;
  for (let level = 255; level > 0; level -= 1) {
    seen += histogram[level];
    if (seen > visible * LOUDEST_SHARE) return Math.max(level / 255, 0.05);
  }
  return 1;
}

function shaded(channel, light) {
  if (light < SHADE_POINT) return channel * (light / SHADE_POINT);
  return channel + (255 - channel) * ((light - SHADE_POINT) / (1 - SHADE_POINT)) * HIGHLIGHT_LIMIT;
}

/** Новый массив пикселей: светотень исходника остаётся, цвет берётся из заливки. */
function recolor(source, width, height, tint) {
  const output = new Uint8ClampedArray(source);
  const table = gradientTable(tint.fill);
  const top = brightestLevel(source);
  const lift = tint.bright >= 0 ? 1 + tint.bright / 50 : 1 + tint.bright / 100;
  const power = tint.strength / 100;
  const flood = tint.mode === 'flood';
  const vertical = tint.fill.dir === 'v';
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const along = vertical ? y / Math.max(1, height - 1) : x / Math.max(1, width - 1);
      const t = Math.round(along * 255) * 3;
      const light = Math.min(1, (lightness(source, i) / top) * lift);
      for (let c = 0; c < 3; c += 1) {
        const color = flood ? table[t + c] * Math.min(1, lift) : shaded(table[t + c], light);
        output[i + c] = source[i + c] + (color - source[i + c]) * power;
      }
    }
  }
  return output;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

let cached = { url: null, width: 0, height: 0, pixels: null };

async function sourcePixels(url) {
  if (cached.url === url) return cached;
  const image = await loadImage(url);
  const canvas = Object.assign(document.createElement('canvas'), { width: image.naturalWidth, height: image.naturalHeight });
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  cached = { url, width: canvas.width, height: canvas.height, pixels: data };
  return cached;
}

async function bake(url, tint) {
  const { width, height, pixels } = await sourcePixels(url);
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  canvas.getContext('2d').putImageData(new ImageData(recolor(pixels, width, height, tint), width, height), 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function sourceOf(control, value, images) {
  const base = value?.tint ? value.base : value?.id;
  return { base: base || null, url: base ? images.url(base) : `game/${control.preview}` };
}

async function tintedValue(control, value, tint, images) {
  const { base, url } = sourceOf(control, value, images);
  const id = await images.add(await bake(url, tint), { tint: true });
  return { id, fit: value?.fit ?? 'original', opacity: value?.opacity ?? 1, tint, base };
}

function untinted(value) {
  if (!value?.base) return null;
  return { id: value.base, fit: value.fit === 'original' ? 'stretch' : value.fit, opacity: value.opacity };
}

/** controls — настройки-картинки каталога; images — хранилище картинок браузера. */
export function createTinter({ store, controls, images, toast }) {
  const attempts = new Map();
  const failed = t('Эту картинку не получилось перекрасить. Попробуй другую.');

  async function tintOne(control, value, tint, change) {
    const attempt = (attempts.get(control.id) || 0) + 1;
    attempts.set(control.id, attempt);
    try {
      const next = await tintedValue(control, value, tint, images);
      if (attempts.get(control.id) === attempt) change(next);
    } catch {
      toast(failed);
    }
  }

  async function tintAll(tint) {
    const current = store.get();
    const targets = controls.filter((c) => current[c.id] || c.preview);
    const next = { ...current };
    let done = 0;
    let skipped = 0;
    for (const control of targets) {
      toast(t('Перекрашиваю картинки: {n} из {total}', { n: done + skipped + 1, total: targets.length }));
      try {
        next[control.id] = await tintedValue(control, current[control.id], tint, images);
        done += 1;
      } catch {
        skipped += 1;
      }
    }
    store.replace(next);
    toast(skipped ? t('Готово: {done}. Не получилось: {skipped}.', { done, skipped }) : t('Готово, перекрашено картинок: {done}.', { done }));
  }

  function untintAll() {
    const current = store.get();
    const next = { ...current };
    controls.filter((c) => current[c.id]?.tint).forEach((c) => { next[c.id] = untinted(current[c.id]); });
    store.replace(next);
  }

  return { tintOne, untinted, tintAll, untintAll };
}
