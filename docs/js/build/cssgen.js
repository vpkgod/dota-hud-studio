// Превращает настройки в правила Panorama CSS. Повторяет hudstudio/cssgen.py: их сверяет тест.
export const FIT_CSS = { stretch: '100% 100%', cover: 'cover', contain: 'contain' };

export const imageGamePath = (id) => `panorama/images/hudstudio/u${id}`;

export function same(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => same(a[key], b[key]));
}

function number(value) {
  const text = value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return text === '' || text === '-0' ? '0' : text;
}

export function panoramaFill(fill) {
  const { stops } = fill;
  if (new Set(stops.map((s) => s.c.toLowerCase())).size === 1) return stops[0].c;
  const end = fill.dir === 'v' ? '0% 100%' : '100% 0%';
  const middle = stops.slice(1, -1).map((s) => `color-stop( ${number(s.p)}, ${s.c} ), `).join('');
  return `gradient( linear, 0% 0%, ${end}, from( ${stops[0].c} ), ${middle}to( ${stops[stops.length - 1].c} ) )`;
}

function imageDecls(value) {
  const decls = [`background-image: url("s2r://${imageGamePath(value.id)}.vtex")`];
  if (value.fit !== 'original') {
    decls.push(`background-size: ${FIT_CSS[value.fit]}`, 'background-position: 50% 50%', 'background-repeat: no-repeat');
  }
  if (value.opacity < 1) decls.push(`background-img-opacity: ${number(value.opacity)}`);
  return decls;
}

function declarations(control, target, value) {
  switch (control.type) {
    case 'fill': return [`${target.prop}: ${panoramaFill(value)}`];
    case 'color': return [`${target.prop}: ${value}`, ...(target.extra || [])];
    // Те же сочетания размытия и силы, что в CSS игры: 1px/3, 3px/4, 6px/6.
    case 'outline': return value.on ? [`text-shadow: 0px 0px ${value.w}px ${number(3 + (value.w - 1) * 0.6)} ${value.c}`] : [];
    case 'glow': return value.on ? [`box-shadow: ${value.c} 0px 0px ${value.w * 2}px ${value.w}px`] : [];
    case 'num': return [`${target.prop}: ${number((value + (target.delta || 0)) / control.div)}${control.unit}`];
    case 'toggle': return value ? [] : [target.off];
    case 'offset': return [`transform: translateX( ${value.x}px ) translateY( ${value.y}px )`];
    case 'image':
      if (!value) return [];
      return target.raw ? target.raw : imageDecls(value);
    default: throw new Error(`Неизвестный тип настройки: ${control.type}`);
  }
}

/** Map(файл → Map(селекторы → объявления)); порядок совпадает с каталогом. */
function collect(controls, values) {
  const files = new Map();
  for (const control of controls) {
    const value = control.id in values ? values[control.id] : control.default;
    if (same(value, control.default)) continue;
    for (const target of control.emit) {
      if (!files.has(target.file)) files.set(target.file, new Map());
      const rules = files.get(target.file);
      const key = target.sel.join(',');
      rules.set(key, [...(rules.get(key) || []), ...declarations(control, target, value)]);
    }
  }
  return files;
}

function render(rules, block) {
  return [...rules].filter(([, decls]) => decls.length).map(([selectors, decls]) => block(selectors, decls));
}

const pretty = (selectors, decls) => `${selectors}\n{\n${decls.map((d) => `\t${d};\n`).join('')}}\n`;
const compact = (selectors, decls) => `${selectors}{${decls.map((d) => `${d};`).join('')}}`;

function generateWith(controls, values, block, joiner) {
  const out = {};
  for (const [name, rules] of collect(controls, values)) {
    const text = render(rules, block).join(joiner);
    if (text) out[name] = text;
  }
  return out;
}

/** { файл: текст правил } для чтения человеком. Только изменённые настройки. */
export const generate = (controls, values) => generateWith(controls, values, pretty, '\n');

/** То же в сжатом виде, как хранит игра: это дописывается в конец её стиля. */
export const generateCompact = (controls, values) => generateWith(controls, values, compact, '');

/** id картинок, на которые ссылается CSS. Подмена файлов игры считается отдельно. */
export function imagesUsed(controls, values) {
  return new Set(controls.filter((c) => c.type === 'image' && c.emit.length && values[c.id]).map((c) => values[c.id].id));
}

/** { путь текстуры игры без расширения: id картинки }. */
export function replacedTextures(controls, values) {
  const out = {};
  for (const control of controls) {
    if (control.replace && values[control.id]) control.replace.forEach((path) => { out[path] = values[control.id].id; });
  }
  return out;
}
