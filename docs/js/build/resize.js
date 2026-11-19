// Смена размера картинки без canvas (работает и в тестах). Каждый новый пиксель — среднее тех,
// что попали под него, с весом по площади. Цвет считается с учётом прозрачности: прозрачный
// край не темнит рисунок.

function weights(from, to) {
  const scale = from / to;
  return Array.from({ length: to }, (_, i) => {
    const start = i * scale;
    const end = Math.min(from, start + scale);
    const parts = [];
    for (let s = Math.floor(start); s < end; s += 1) {
      const w = Math.min(end, s + 1) - Math.max(start, s);
      if (w > 1e-9) parts.push([s, w]);
    }
    return parts;
  });
}

/** RGBA w×h → RGBA width×height. При том же размере возвращает исходный массив. */
export function resizeRgba(rgba, w, h, width, height) {
  if (w === width && h === height) return rgba;
  const xs = weights(w, width);
  const ys = weights(h, height);
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0; let g = 0; let b = 0; let a = 0; let area = 0;
      for (const [sy, wy] of ys[y]) {
        for (const [sx, wx] of xs[x]) {
          const weight = wx * wy;
          const i = (sy * w + sx) * 4;
          const alpha = rgba[i + 3] * weight;
          r += rgba[i] * alpha; g += rgba[i + 1] * alpha; b += rgba[i + 2] * alpha;
          a += alpha; area += weight;
        }
      }
      const o = (y * width + x) * 4;
      if (a > 0) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
      out[o + 3] = Math.round(a / area);
    }
  }
  return out;
}
