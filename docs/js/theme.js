// Цвета: стиль целого худа из одного выбранного цвета.
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function hexToHsl(hex) {
  const value = (i) => parseInt(hex.slice(i, i + 2), 16) / 255;
  const [r, g, b] = [value(1), value(3), value(5)];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}

export function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const part = (n) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return `#${part(0)}${part(8)}${part(4)}`;
}

const two = (a, b, dir = 'v') => ({ dir, stops: [{ p: 0, c: a }, { p: 1, c: b }] });
const three = (a, m, b, dir = 'v') => ({ dir, stops: [{ p: 0, c: a }, { p: 0.5, c: m }, { p: 1, c: b }] });
const MANA_HUE_SHIFT = 200;

/** Настройки целого худа из одного цвета. */
export function themeFromColor(hex, { radius = 6, thick = 2 } = {}) {
  const { h, s: rawS } = hexToHsl(hex);
  const s = clamp(rawS, 0.45, 0.95);
  const manaHue = (h + MANA_HUE_SHIFT) % 360;
  const dark = hsl(h, 0.45, 0.07);
  const darker = hsl(h, 0.45, 0.04);
  return {
    'hp.fill': three(hsl(h, s, 0.3), hsl(h, s, 0.52), hsl(h, s, 0.26)),
    'hp.track': two(hsl(h, 0.4, 0.1), hsl(h, 0.4, 0.06)),
    'mp.fill': three(hsl(manaHue, s, 0.3), hsl(manaHue, s, 0.55), hsl(manaHue, s, 0.26)),
    'mp.track': two(hsl(manaHue, 0.4, 0.1), hsl(manaHue, 0.4, 0.06)),
    'hp.radius': radius, 'mp.radius': radius, 'ab.radius': radius, 'inv.radius': Math.round(radius / 2),
    'hp.labelOutline': { on: true, c: dark, w: thick },
    'mp.labelOutline': { on: true, c: hsl(manaHue, 0.45, 0.07), w: thick },
    'hp.regen': hsl(h, 0.9, 0.8), 'mp.regen': hsl(manaHue, 0.9, 0.8),
    'launch.gold': hsl(h, 0.9, 0.72), 'por.level': hsl(h, 0.9, 0.78), 'por.xp': hsl(h, s, 0.6),
    'ab.bgColor': `${hsl(h, 0.5, 0.12)}88`,
    'shop.color': two(dark, darker), 'shop.searchRow': darker, 'shop.column': hsl(h, 0.85, 0.75),
    'shop.searchBorder': hsl(h, s, 0.4), 'top.time': hsl(h, 0.9, 0.85),
  };
}

export function randomTheme() {
  const hue = Math.floor(Math.random() * 360);
  const options = { radius: [0, 4, 8, 12][Math.floor(Math.random() * 4)], thick: 1 + Math.floor(Math.random() * 3) };
  return themeFromColor(hsl(hue, 0.75, 0.5), options);
}
