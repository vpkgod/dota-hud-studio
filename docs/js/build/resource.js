// Собранные файлы Source 2: стиль (vcss_c) и картинка (vtex_c).
// Раскладка как у файлов, которые игра грузит годами: блок сведений REDI и блок данных DATA,
// без карты исходника. Так собраны стили старых пользовательских игр и картинки самой Dota.
// Данные сверены с тем, что выдаёт resourcecompiler Valve: см. tests/js.
import { concat, crc32, f32, u16, u32, utf8 } from './bytes.js';

const HEADER_VERSION = 12;
const STYLE_VERSION = 3;
const TEXTURE_VERSION = 1;
const BLOCK_ALIGN = 16;
const FORMAT_RGBA8888 = 4;
const EXTRA_FALLBACK_BITS = 1;
const FALLBACK_SIDE = 32;
export const MAX_TEXTURE_SIDE = 4096;

// Сведения для инструментов Valve (из чего собран файл): десять пустых списков. Игре они не нужны.
const EDIT_INFO_LISTS = 10;
const emptyEditInfo = () => ({ name: 'REDI', data: new Uint8Array(EDIT_INFO_LISTS * 8) });

const pad = (length) => new Uint8Array((BLOCK_ALIGN - (length % BLOCK_ALIGN)) % BLOCK_ALIGN);

/**
 * Заголовок, таблица блоков и сами блоки. Первый блок идёт сразу за таблицей, следующие
 * выровнены по 16 байт. Размер в заголовке не включает хвост (пиксели).
 */
function container(version, blocks, tail = new Uint8Array(0)) {
  const tableEnd = 16 + blocks.length * 12;
  const table = [];
  const bodies = [];
  let pos = tableEnd;
  blocks.forEach(({ name, data }, index) => {
    const gap = index === 0 ? new Uint8Array(0) : pad(pos);
    bodies.push(gap);
    pos += gap.length;
    const fieldAt = 16 + index * 12 + 4;
    table.push(utf8(name), u32(pos - fieldAt), u32(data.length));
    bodies.push(data);
    pos += data.length;
  });
  return concat([u32(pos), u16(HEADER_VERSION), u16(version), u32(8), u32(blocks.length), ...table, ...bodies, tail]);
}

/** Текст стиля → vcss_c: контрольная сумма текста, пустой список имён и сам текст. */
export function compileStyle(text) {
  const bytes = utf8(text);
  const data = concat([u32(crc32(bytes)), u16(0), bytes]);
  return container(STYLE_VERSION, [emptyEditInfo(), { name: 'DATA', data }]);
}

const srgbToLinear = (() => {
  const table = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) {
    const c = i / 255;
    table[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  return table;
})();

/** Средний цвет картинки в линейном пространстве и средняя прозрачность. */
function reflectivity(rgba) {
  const sum = [0, 0, 0, 0];
  for (let i = 0; i < rgba.length; i += 4) {
    sum[0] += srgbToLinear[rgba[i]];
    sum[1] += srgbToLinear[rgba[i + 1]];
    sum[2] += srgbToLinear[rgba[i + 2]];
    sum[3] += rgba[i + 3] / 255;
  }
  const count = rgba.length / 4;
  return sum.map((value) => value / count);
}

/** Уменьшенная копия 32×32: каждый пиксель — среднее по своему участку исходника. */
function shrink(rgba, width, height) {
  const out = new Uint8Array(FALLBACK_SIDE * FALLBACK_SIDE * 4);
  for (let y = 0; y < FALLBACK_SIDE; y += 1) {
    const y0 = Math.floor((y * height) / FALLBACK_SIDE);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / FALLBACK_SIDE));
    for (let x = 0; x < FALLBACK_SIDE; x += 1) {
      const x0 = Math.floor((x * width) / FALLBACK_SIDE);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / FALLBACK_SIDE));
      const sum = [0, 0, 0, 0];
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const i = (sy * width + sx) * 4;
          for (let c = 0; c < 4; c += 1) sum[c] += rgba[i + c];
        }
      }
      const count = (y1 - y0) * (x1 - x0);
      const o = (y * FALLBACK_SIDE + x) * 4;
      for (let c = 0; c < 4; c += 1) out[o + c] = Math.round(sum[c] / count);
    }
  }
  return out;
}

const to565 = (r, g, b) => ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
const from565 = (c) => [((c >> 11) * 255) / 31, (((c >> 5) & 63) * 255) / 63, ((c & 31) * 255) / 31];

function nearest(options, distance) {
  let best = 0;
  for (let i = 1; i < options.length; i += 1) if (distance(options[i]) < distance(options[best])) best = i;
  return best;
}

/** Один блок 4×4 в формате DXT5: 8 байт прозрачности и 8 байт цвета. */
function dxt5Block(pixels) {
  const alphas = pixels.map((p) => p[3]);
  const a0 = Math.max(...alphas);
  const a1 = Math.min(...alphas);
  const alphaSteps = a0 === a1 ? [a0] : [a0, a1, ...[1, 2, 3, 4, 5, 6].map((i) => ((7 - i) * a0 + i * a1) / 7)];
  let alphaBits = 0n;
  alphas.forEach((a, i) => { alphaBits |= BigInt(nearest(alphaSteps, (s) => Math.abs(s - a))) << BigInt(3 * i); });

  const light = (p) => p[0] * 2 + p[1] * 5 + p[2];
  const bright = pixels.reduce((a, b) => (light(b) > light(a) ? b : a));
  const dark = pixels.reduce((a, b) => (light(b) < light(a) ? b : a));
  const c0 = to565(...bright);
  const c1 = to565(...dark);
  const e0 = from565(c0);
  const e1 = from565(c1);
  const mix = (a, b, k) => a.map((v, i) => v * (1 - k) + b[i] * k);
  const colors = c0 === c1 ? [e0] : [e0, e1, mix(e0, e1, 1 / 3), mix(e0, e1, 2 / 3)];
  let colorBits = 0;
  pixels.forEach((p, i) => {
    const index = nearest(colors, (c) => (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2);
    colorBits = (colorBits | (index << (2 * i))) >>> 0;
  });

  const out = new Uint8Array(16);
  out[0] = a0;
  out[1] = a1;
  for (let i = 0; i < 6; i += 1) out[2 + i] = Number((alphaBits >> BigInt(8 * i)) & 255n);
  out.set(u16(c0), 8);
  out.set(u16(c1), 10);
  out.set(u32(colorBits), 12);
  return out;
}

function fallbackBits(rgba, width, height) {
  const small = shrink(rgba, width, height);
  const blocks = [];
  for (let by = 0; by < FALLBACK_SIDE; by += 4) {
    for (let bx = 0; bx < FALLBACK_SIDE; bx += 4) {
      const pixels = [];
      for (let y = 0; y < 4; y += 1) {
        for (let x = 0; x < 4; x += 1) {
          const i = ((by + y) * FALLBACK_SIDE + bx + x) * 4;
          pixels.push([small[i], small[i + 1], small[i + 2], small[i + 3]]);
        }
      }
      blocks.push(dxt5Block(pixels));
    }
  }
  return concat(blocks);
}

/** Пиксели RGBA (сверху вниз, без умножения на прозрачность) → vtex_c без сжатия и мипов. */
export function compileTexture(rgba, width, height) {
  const sizeOk = Number.isInteger(width) && Number.isInteger(height)
    && width > 0 && height > 0 && width <= MAX_TEXTURE_SIDE && height <= MAX_TEXTURE_SIDE;
  if (!sizeOk || rgba.length !== width * height * 4) throw new Error('Неверный размер картинки');
  const fallback = fallbackBits(rgba, width, height);
  const data = concat([
    u16(1), u16(0), ...reflectivity(rgba).map(f32),
    u16(width), u16(height), u16(1), new Uint8Array([FORMAT_RGBA8888, 1]), u32(0),
    u32(8), u32(1),
    u32(EXTRA_FALLBACK_BITS), u32(8), u32(fallback.length), fallback,
  ]);
  return container(TEXTURE_VERSION, [emptyEditInfo(), { name: 'DATA', data }], rgba);
}
