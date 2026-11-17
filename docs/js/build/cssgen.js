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

// Ширина нижней панели у героя с четырьмя способностями (как в превью): 219 слева + кнопки + 302 справа.
const CENTER_WIDTH = 940;
const CENTER_PER_ABILITY = 4;

export const centerWidth = (values) => CENTER_WIDTH + CENTER_PER_ABILITY * (('ab.size' in values ? values['ab.size'] : 64) - 64);

/** Где блок виден в превью: левый край, ширина после размера, ближе ли к левому краю, ширина панели. */
function place(anchor, value, values) {
  const width = centerWidth(values);
  const size = anchor.width;
  const scaled = size * (anchor.scale && anchor.scale in values ? values[anchor.scale] : 100) / 100;
  let left = anchor.side === 'left' ? anchor.margin + value.x : width - (anchor.margin - value.x) - size;
  left = left + (size - scaled) * (anchor.origin ?? 0.5);
  return { left, scaled, onLeft: left + scaled / 2 <= width / 2, width };
}

// Сдвиг блока так, чтобы в игре он встал туда же, где в превью. Блок, унесённый за середину нижней
// панели, привязываем к другому её краю: панель шире у героев с большим числом способностей.
// Уменьшенный (ui-scale) блок игра прижимает к своему краю, а превью сжимает к точке origin.
function offset(target, value, values) {
  const { anchor } = target;
  const y = `translateY( ${value.y}px )`;
  if (!anchor) return [`transform: translateX( ${value.x}px ) ${y}`];
  const { left, scaled, onLeft, width } = place(anchor, value, values);
  if (anchor.margins) { // слой с отдельной отрисовкой (круглые слоты) пропадает от transform
    const down = `margin-bottom: ${number(-value.y)}px`;
    if (onLeft) return ['horizontal-align: left', 'margin-right: 0px', `margin-left: ${number(left)}px`, down];
    return ['horizontal-align: right', 'margin-left: 0px', `margin-right: ${number(width - left - scaled)}px`, down];
  }
  if (anchor.side === 'left' && onLeft) return [`transform: translateX( ${number(left - anchor.margin)}px ) ${y}`];
  if (anchor.side === 'right' && !onLeft) return [`transform: translateX( ${number(left + scaled - width + anchor.margin)}px ) ${y}`];
  if (onLeft) return ['horizontal-align: left', 'margin-right: 0px', `margin-left: ${number(left)}px`, `transform: translateX( 0px ) ${y}`];
  return ['horizontal-align: right', 'margin-left: 0px', `margin-right: ${number(width - left - scaled)}px`, `transform: translateX( 0px ) ${y}`];
}

// Ведомая панель (у левого края) сдвигается и сжимается вместе с ведущим блоком, вокруг той же точки,
// что и в превью. Игра сжимает панель к её левому и нижнему краю, отступы не трогает — поправляем сдвигом.
function follow(target, values) {
  const { lead, own } = target;
  const value = lead.offset in values ? values[lead.offset] : { x: 0, y: 0 };
  const { left, onLeft, width } = place(lead, value, values);
  const ratio = (lead.scale && lead.scale in values ? values[lead.scale] : 100) / 100;
  const home = lead.side === 'left' ? lead.margin : width - lead.margin - lead.width;
  const ownLeft = left + (own.margin - home) * ratio;
  const y = `translateY( ${number(value.y + own.bottom * (1 - ratio) + (own.dy || 0))}px )`;
  const dx = own.dx || 0; // свой сдвиг панели в игре: наш transform его заменяет, поэтому добавляем
  const decls = ratio === 1 ? [] : [`ui-scale: ${number(ratio * 100)}%`];
  if (onLeft) return [...decls, `transform: translateX( ${number(ownLeft - own.margin + dx)}px ) ${y}`];
  return [...decls, 'horizontal-align: right', 'margin-left: 0px',
    `margin-right: ${number(width - ownLeft - own.width * ratio)}px`, `transform: translateX( ${number(dx)}px ) ${y}`];
}

function summed(target, values) {
  const moves = target.sum.map((id) => (id in values ? values[id] : { x: 0, y: 0 }));
  return { x: moves.reduce((a, m) => a + m.x, 0), y: moves.reduce((a, m) => a + m.y, 0) };
}

function declarations(control, target, value, values = {}) {
  if (target.lead) return follow(target, values);
  switch (control.type) {
    case 'fill': return [`${target.prop}: ${panoramaFill(value)}`];
    case 'color': return [`${target.prop}: ${value}`, ...(target.extra || [])];
    // Те же сочетания размытия и силы, что в CSS игры: 1px/3, 3px/4, 6px/6.
    case 'outline': return value.on ? [`text-shadow: 0px 0px ${value.w}px ${number(3 + (value.w - 1) * 0.6)} ${value.c}`] : [];
    case 'glow': return value.on ? [`box-shadow: ${value.c} 0px 0px ${value.w * 2}px ${value.w}px`] : [];
    case 'num': return [`${target.prop}: ${number((value + (target.delta || 0)) / control.div)}${control.unit}`];
    case 'toggle': return value ? [] : [target.off];
    case 'offset': return offset(target, target.sum ? summed(target, values) : value, values);
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
      const old = rules.get(key) || [];
      let fresh = declarations(control, target, value, values);
      // Общее правило пишем один раз, сколько бы блоков его ни просили.
      if (target.sum || target.lead) fresh = fresh.filter((d) => !old.includes(d));
      rules.set(key, [...old, ...fresh]);
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
