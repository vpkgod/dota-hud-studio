// Элементы управления одной настройкой. Каждый виджет сам хранит своё значение:
// change(новое) вызывается при правке человеком, sync(значение) — когда значение пришло извне
// (отмена, сброс, открытая версия). Правка никогда не перестраивает соседние настройки.
import { same } from './build/cssgen.js';
import { openColorPop } from './colorpop.js';
import { button, h, icon } from './dom.js';
import { t } from './i18n.js';

const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const cssGradient = (fill) => `linear-gradient(${fill.dir === 'v' ? 'to bottom' : 'to right'},${fill.stops.map((s) => `${s.c} ${s.p * 100}%`).join(',')})`;

/** Образец цвета и поле с кодом. set(цвет) обновляет оба без вызова onChange. */
function colorField(value, onChange, label) {
  let current = value;
  const face = h('i');
  const hex = h('input', { class: 'hex', value, spellcheck: false, maxLength: 9, 'aria-label': t('{label}: код цвета', { label }) });
  const paint = () => { face.style.background = current; if (document.activeElement !== hex) hex.value = current; };
  const pick = (next) => { current = next; paint(); onChange(next); };
  const swatch = button('swatch', '', () => openColorPop(swatch, current, pick), { title: t('Выбрать цвет'), 'aria-label': label });
  swatch.append(face);
  hex.addEventListener('change', () => {
    const text = hex.value.trim();
    if (HEX.test(text)) pick(text); else hex.value = current;
  });
  paint();
  return { node: h('span', { class: 'color-field' }, swatch, hex), set(next) { current = next; paint(); } };
}

/** Ползунок и поле с числом. */
function numberField({ min, max, step = 1, unit = '' }, value, onChange, label) {
  const range = h('input', { type: 'range', min, max, step, value, 'aria-label': label });
  const box = h('input', { type: 'number', class: 'numbox', min, max, step, value, 'aria-label': t('{label}: число', { label }) });
  const apply = (raw, source) => {
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n)) return;
    const clean = Math.min(max, Math.max(min, n));
    if (source !== range) range.value = clean;
    if (source !== box || clean !== n) box.value = clean;
    onChange(clean);
  };
  range.addEventListener('input', () => apply(range.value, range));
  box.addEventListener('change', () => apply(box.value, box));
  const node = h('span', { class: 'num-field' }, range, box, unit ? h('span', { class: 'unit', text: unit }) : null);
  return { node, set(next) { range.value = next; if (document.activeElement !== box) box.value = next; } };
}

function switchField(checked, onChange, label) {
  const box = h('input', { type: 'checkbox', checked, 'aria-label': label });
  const text = h('span', { class: 'switch-text' });
  const paint = () => { text.textContent = box.checked ? t('Да') : t('Нет'); };
  box.addEventListener('change', () => { paint(); onChange(box.checked); });
  paint();
  return { node: h('label', { class: 'switch' }, box, h('i'), text), set(next) { box.checked = next; paint(); } };
}

function segmented(options, current, onPick, label) {
  let active = current;
  const buttons = options.map(([id, text]) => button('', text, () => { set(id); onPick(id); }, { 'aria-pressed': 'false' }));
  function set(id) {
    active = id;
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i][0] === active)));
  }
  set(current);
  return { node: h('span', { class: 'seg', role: 'group', 'aria-label': label }, buttons), set };
}

function colorWidget(control, value, change) {
  const field = colorField(value, change, control.label);
  return { node: field.node, sync: field.set };
}

function numWidget(control, value, change) {
  const field = numberField(control, value, change, control.label);
  return { node: field.node, sync: field.set };
}

function toggleWidget(control, value, change) {
  const field = switchField(value, change, control.label);
  return { node: field.node, sync: field.set };
}

/** Обводка текста и свечение: выключатель, цвет и толщина всегда на месте. */
function shadowWidget(control, value, change) {
  let current = value;
  const emit = (patch) => { current = { ...current, ...patch }; paint(); change(current); };
  const on = switchField(value.on, (next) => emit({ on: next }), control.label);
  const color = colorField(value.c, (c) => emit({ c }), t('{label}: цвет', { label: control.label }));
  const width = numberField({ min: 1, max: 8, unit: 'px' }, value.w, (w) => emit({ w }), t('{label}: толщина', { label: control.label }));
  const details = h('span', { class: 'shadow-details' }, color.node, width.node);
  const paint = () => details.classList.toggle('is-off', !current.on);
  paint();
  return {
    node: h('div', { class: 'stack' }, on.node, details),
    sync(next) { current = next; on.set(next.on); color.set(next.c); width.set(next.w); paint(); },
  };
}

function offsetWidget(control, value, change) {
  let current = value;
  const axis = (key, label) => {
    const box = h('input', { type: 'number', class: 'numbox', min: control.min, max: control.max, step: 1, value: value[key], 'aria-label': label });
    box.addEventListener('change', () => {
      const n = Number(box.value);
      if (box.value === '' || !Number.isFinite(n)) { box.value = current[key]; return; }
      const clean = Math.round(Math.min(control.max, Math.max(control.min, n)));
      box.value = clean;
      current = { ...current, [key]: clean };
      change(current);
    });
    return { box, node: h('label', { class: 'axis' }, h('span', { text: label }), box, h('span', { class: 'unit', text: 'px' })) };
  };
  const x = axis('x', t('Вправо'));
  const y = axis('y', t('Вниз'));
  return {
    node: h('div', { class: 'stack' }, h('span', { class: 'offset-fields' }, x.node, y.node),
      h('small', { class: 'row-hint', text: t('Проще перетащить сам блок мышью в превью. Стрелки на клавиатуре двигают точно.') })),
    sync(next) { current = next; x.box.value = next.x; y.box.value = next.y; },
  };
}

const isSolid = (fill) => fill.stops.every((s) => s.c === fill.stops[0].c);
const MAX_STOPS = 4;

/** Заливка: один цвет или переход из 2–4 цветов. */
export function fillWidget(control, value, change) {
  let current = value;
  let mode = isSolid(value) ? 'solid' : 'grad';
  const node = h('div', { class: 'fill' });
  const bar = h('div', { class: 'fill-bar' });
  const paintBar = () => { bar.style.background = cssGradient(current); };
  const emit = (next, rebuild) => { current = next; change(next); if (rebuild) render(); else paintBar(); };
  const setStops = (stops, rebuild = false) => emit({ dir: current.dir, stops }, rebuild);

  function stopRow(index) {
    const stop = current.stops[index];
    const replace = (patch) => setStops(current.stops.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    const color = colorField(stop.c, (c) => replace({ c }), t('Цвет {n}', { n: index + 1 }));
    const middle = index > 0 && index < current.stops.length - 1;
    if (!middle) return h('div', { class: 'stop' }, color.node, h('span', { class: 'stop-edge', text: index === 0 ? t('начало') : t('конец') }));
    const pos = h('input', { type: 'range', min: 1, max: 99, value: Math.round(stop.p * 100), title: t('Где начинается этот цвет'), 'aria-label': t('Где начинается этот цвет') });
    pos.addEventListener('input', () => replace({ p: Number(pos.value) / 100 }));
    const remove = button('link', t('убрать'), () => setStops(current.stops.filter((_, i) => i !== index), true));
    return h('div', { class: 'stop' }, color.node, pos, remove);
  }

  function render() {
    const modes = segmented([['solid', t('Один цвет')], ['grad', t('Переход')]], mode, (next) => {
      mode = next;
      const first = current.stops[0].c;
      const last = current.stops[current.stops.length - 1].c;
      if (next === 'solid') setStops([{ p: 0, c: first }, { p: 1, c: first }], true);
      else setStops([{ p: 0, c: first }, { p: 1, c: last === first ? '#000000' : last }], true);
    }, t('Вид заливки'));
    const parts = [h('div', { class: 'fill-head' }, bar, modes.node)];
    if (mode === 'solid') {
      const color = colorField(current.stops[0].c, (c) => setStops([{ p: 0, c }, { p: 1, c }]), control.label);
      parts.push(color.node);
    } else {
      const direction = segmented([['v', t('Сверху вниз')], ['h', t('Слева направо')]], current.dir,
        (dir) => emit({ dir, stops: current.stops }, false), t('Направление'));
      parts.push(direction.node, ...current.stops.map((_, i) => stopRow(i)));
      if (current.stops.length < MAX_STOPS) {
        parts.push(button('link', t('+ добавить цвет'), () => {
          const end = current.stops.length - 1;
          const inserted = { p: (current.stops[end - 1].p + 1) / 2, c: current.stops[end].c };
          setStops([...current.stops.slice(0, end), inserted, current.stops[end]], true);
        }));
      }
    }
    paintBar();
    node.replaceChildren(...parts);
  }

  render();
  return { node, sync(next) { current = next; mode = isSolid(next) ? 'solid' : 'grad'; render(); } };
}

const STRONG_RED = '#e53935';
export const DEFAULT_TINT = {
  fill: { dir: 'v', stops: [{ p: 0, c: STRONG_RED }, { p: 1, c: STRONG_RED }] }, mode: 'keep', strength: 100, bright: 0,
};
const TINT_DELAY_MS = 120;
const FITS = [['stretch', t('Растянуть')], ['cover', t('Заполнить')], ['contain', t('Вписать')]];

/**
 * Картинка: своя вместо оригинала, как её вписать, прозрачность и перекраска.
 * tools: upload(file) → id | null, uploads() → [id], imageUrl(id), tint(control, value, tint, done), untinted(value),
 * originalSize(путь) → [ширина, высота] | null.
 */
function imageWidget(control, value, change, tools) {
  let current = value;
  const node = h('div', { class: 'image' });
  const emit = (next) => { current = next; change(next); render(); };
  const sourceUrl = () => {
    if (current) return tools.imageUrl(current.id);
    return control.preview ? `game/${control.preview}` : '';
  };
  const placed = (id) => ({ id, fit: current && current.fit !== 'original' ? current.fit : 'stretch', opacity: current ? current.opacity : 1 });

  async function pick(file) {
    if (!file) return;
    const id = await tools.upload(file);
    if (id) emit(placed(id));
  }

  function chooseFile() {
    const input = h('input', { type: 'file', accept: 'image/*' });
    input.addEventListener('change', () => pick(input.files[0]));
    input.click();
  }

  function thumb() {
    const url = sourceUrl();
    const box = button('thumb', '', chooseFile, { title: t('Нажми или перетащи сюда картинку'), 'aria-label': t('{label}: выбрать картинку', { label: control.label }) });
    if (url) box.style.backgroundImage = `url("${url}")`;
    else box.append(h('span', { text: t('нет картинки') }));
    box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('over'); });
    box.addEventListener('dragleave', () => box.classList.remove('over'));
    box.addEventListener('drop', (e) => { e.preventDefault(); box.classList.remove('over'); pick(e.dataTransfer.files[0]); });
    return box;
  }

  function gallery() {
    const ids = tools.uploads();
    if (!ids.length) return null;
    return h('div', { class: 'gallery' }, h('small', { text: t('Уже загруженные:') }), ids.map((id) => {
      const active = current && (current.id === id || current.base === id);
      const item = button(active ? 'on' : '', '', () => emit(placed(id)), { title: t('Поставить эту картинку'), 'aria-label': t('Поставить эту картинку') });
      item.style.backgroundImage = `url("${tools.imageUrl(id)}")`;
      return item;
    }));
  }

  function tintEditor() {
    if (!current?.tint) return null;
    const draft = { ...current.tint };
    let timer;
    const update = (patch) => {
      Object.assign(draft, patch);
      clearTimeout(timer);
      const from = current;
      timer = setTimeout(() => tools.tint(control, from, { ...draft }, (next) => {
        current = next;
        change(next);
        node.querySelector('.thumb').style.backgroundImage = `url("${tools.imageUrl(next.id)}")`;
      }), TINT_DELAY_MS);
    };
    const fill = fillWidget({ label: t('Цвет картинки') }, draft.fill, (next) => update({ fill: next }));
    const mode = segmented([['keep', t('Сохранить рисунок')], ['flood', t('Залить целиком')]], draft.mode, (next) => update({ mode: next }), t('Способ перекраски'));
    const strength = numberField({ min: 0, max: 100, unit: '%' }, draft.strength, (n) => update({ strength: n }), t('Сила цвета'));
    const bright = numberField({ min: -100, max: 100 }, draft.bright, (n) => update({ bright: n }), t('Светлее или темнее'));
    return h('div', { class: 'tint' },
      h('div', { class: 'tint-title' }, h('b', { text: t('Перекраска') }), button('link', t('убрать перекраску'), () => emit(tools.untinted(current)))),
      fill.node, mode.node,
      h('div', { class: 'pair' },
        h('label', { class: 'mini' }, h('span', { text: t('Сила цвета') }), strength.node),
        h('label', { class: 'mini' }, h('span', { text: t('Светлее / темнее') }), bright.node)));
  }

  /** Оригинал из игры в родном размере: чтобы нарисовать свою картинку по нему и загрузить обратно. */
  function originals() {
    const paths = control.originals || [];
    if (!paths.length) return null;
    const several = paths.length > 1;
    const links = paths.map((path) => {
      const size = tools.originalSize(path);
      const text = size ? `${size[0]}×${size[1]}` : t('оригинал');
      const link = h('a', { class: 'original', href: `game/${path}`, download: path.split('/').pop(),
        title: t('Скачать картинку игры в её настоящем размере'), 'aria-label': t('{label}: скачать оригинал {size}', { label: control.label, size: text }) },
      icon('download'), h('span', { text: several ? text : t('Скачать оригинал, {size}', { size: text }) }));
      return link;
    });
    const parts = [several ? h('span', { text: t('Скачать оригинал:') }) : null, ...links];
    return h('div', { class: 'originals' }, parts);
  }

  /** Подмена файла игры встаёт в размер оригинала: человеку говорим об этом, если размеры разные. */
  function sizeNote() {
    if (!current || !control.replace) return null;
    const sizes = (control.originals || []).map(tools.originalSize).filter(Boolean);
    if (!sizes.length) return null;
    const note = h('small', { class: 'size-note' });
    const probe = new Image();
    probe.onload = () => {
      const fits = sizes.every(([w, hgt]) => w === probe.naturalWidth && hgt === probe.naturalHeight);
      note.textContent = fits ? t('Размер совпадает с оригиналом.')
        : t('Твоя картинка {mine}. При сборке она станет {size}, как в игре.', {
          mine: `${probe.naturalWidth}×${probe.naturalHeight}`, size: sizes.map(([w, hgt]) => `${w}×${hgt}`).join(t(' и ')) });
    };
    probe.src = tools.imageUrl(current.id);
    return note;
  }

  function render() {
    const canTint = (current || control.preview) && !current?.tint;
    const actions = h('div', { class: 'image-actions' },
      button('ghost', current ? t('Заменить') : t('Загрузить свою'), chooseFile),
      canTint ? button('ghost', t('Перекрасить'), () => tools.tint(control, current, DEFAULT_TINT, emit), { title: t('Задать картинке свой цвет, сохранив её рисунок') }) : null,
      current ? button('link', t('вернуть оригинал'), () => emit(null)) : null);
    const side = [actions, originals(), sizeNote()].filter(Boolean);
    const tuning = [];
    if (current && !control.fixed && current.fit !== 'original') {
      tuning.push(segmented(FITS, current.fit, (fit) => { current = { ...current, fit }; change(current); }, t('Как вписать картинку')).node);
    }
    if (current && !control.fixed) {
      const opacity = numberField({ min: 0, max: 100, unit: '%' }, Math.round(current.opacity * 100),
        (n) => { current = { ...current, opacity: n / 100 }; change(current); }, t('Видимость картинки'));
      tuning.push(h('label', { class: 'mini' }, h('span', { text: t('Видимость') }), opacity.node));
    }
    if (tuning.length) side.push(...tuning);
    const picked = gallery();
    if (picked) side.push(picked);
    const parts = [h('div', { class: 'image-top' }, thumb(), h('div', { class: 'stack' }, side)), tintEditor()];
    node.replaceChildren(...parts.filter(Boolean));
  }

  render();
  return { node, sync(next) { current = next; render(); } };
}

const WIDGETS = {
  color: colorWidget, fill: fillWidget, num: numWidget, toggle: toggleWidget,
  offset: offsetWidget, image: imageWidget, outline: shadowWidget, glow: shadowWidget,
};

/**
 * Строка одной настройки: название слева, управление справа, отметка «изменено» и возврат.
 * Возвращает { node, id, sync(значение) }.
 */
export function createRow(control, { value, change, tools, crumb, onHover }) {
  let seen = value;
  const mark = () => {
    const changed = !same(seen, control.default);
    node.classList.toggle('changed', changed);
    reset.hidden = !changed;
  };
  const widget = WIDGETS[control.type](control, value, (next) => { seen = next; mark(); change(next); }, tools);
  const reset = button('row-reset', '', () => { seen = control.default; widget.sync(seen); mark(); change(seen); },
    { title: t('Вернуть как в игре'), 'aria-label': t('Вернуть как в игре: {label}', { label: control.label }) });
  reset.append(icon('replay'));
  const label = h('div', { class: 'row-label' },
    crumb ? h('span', { class: 'crumb', text: crumb }) : null,
    h('span', { class: 'row-name', text: control.label }),
    control.hint ? h('small', { class: 'row-hint', text: control.hint }) : null,
    control.game_only ? h('span', { class: 'tag', text: t('видно только в игре'), title: t('В превью этого состояния нет: результат будет виден в самой Dota.') }) : null);
  const node = h('div', { class: `row type-${control.type}`, data: { id: control.id } }, label, h('div', { class: 'row-body' }, widget.node), reset);
  if (onHover) {
    node.addEventListener('pointerenter', () => onHover(control.id));
    node.addEventListener('pointerleave', () => onHover(null));
  }
  mark();
  return {
    node,
    id: control.id,
    sync(next) {
      if (!same(next, seen)) { seen = next; widget.sync(next); }
      mark();
    },
  };
}
