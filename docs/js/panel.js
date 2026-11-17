// Панель настроек: один раздел целиком, список изменений или результаты поиска.
// Страница строится один раз при входе; при правках обновляются только затронутые строки и счётчики.
import { same } from './build/cssgen.js';
import { button, h, icon, plural } from './dom.js';
import { randomTheme, themeFromColor } from './theme.js';
import { DEFAULT_TINT, createRow, fillWidget } from './widgets.js';
import { t } from './i18n.js';

const THEME_COLORS = ['#e53935', '#ff8a3c', '#f4c653', '#58c322', '#1fd6a6', '#22a7f0', '#7a5cff'];
const settingsWord = (n) => `${n} ${plural(n, t('настройка'), t('настройки'), t('настроек'))}`;

export function createPanel({ root, store, areas, groups, tools, onHover, onView }) {
  const all = groups.flatMap((g) => g.controls);
  const groupById = Object.fromEntries(groups.map((g) => [g.id, g]));
  const groupOf = Object.fromEntries(groups.flatMap((g) => g.controls.map((c) => [c.id, g])));
  const areaTitle = Object.fromEntries(areas.map((a) => [a.id, a.title]));
  const isChanged = (control) => !same(store.get()[control.id], control.default);
  const collapsed = new Set();
  let view = { kind: 'none' };
  let rows = new Map();
  let counters = [];       // функции, обновляющие счётчики и кнопки сброса на странице
  let listedChanges = '';  // какие настройки показаны на странице «Изменения»
  let bulkFill = DEFAULT_TINT.fill;

  const body = h('div', { class: 'panel-body' });
  root.replaceChildren(body);

  function row(control, crumb) {
    const made = createRow(control, {
      value: store.get()[control.id], tools, crumb, onHover,
      change: (next) => store.set(control.id, next),
    });
    rows.set(control.id, made);
    return made.node;
  }

  function resetControls(controls) {
    const next = { ...store.get() };
    controls.forEach((c) => { next[c.id] = c.default; });
    store.replace(next);
  }

  /** Счётчик изменений и кнопка сброса для набора настроек. */
  function changeTools(controls, resetLabel) {
    const count = h('span', { class: 'count' });
    const reset = button('link', resetLabel, () => resetControls(controls));
    const update = () => {
      const n = controls.filter(isChanged).length;
      count.textContent = n ? t('изменено: {n}', { n }) : '';
      count.hidden = !n;
      reset.hidden = !n;
    };
    counters.push(update);
    update();
    return [count, reset];
  }

  function section(key, title, controls, content) {
    const isOpen = !collapsed.has(key);
    const toggle = button('sub-toggle', '', () => {
      if (collapsed.has(key)) collapsed.delete(key); else collapsed.add(key);
      node.classList.toggle('closed', collapsed.has(key));
      toggle.setAttribute('aria-expanded', String(!collapsed.has(key)));
    }, { 'aria-expanded': String(isOpen) });
    toggle.append(h('i', { class: 'marker' }, icon('expand_more')), h('span', { text: title }));
    const head = h('header', { class: 'sub-head' }, toggle, controls ? changeTools(controls, t('сбросить')) : null);
    const node = h('section', { class: `sub${isOpen ? '' : ' closed'}`, data: { sub: title } }, head, h('div', { class: 'sub-body' }, content));
    return node;
  }

  /** Быстрые действия раздела «Весь худ»: перекраска худа и всех картинок одним цветом. */
  function quickStart() {
    const custom = h('input', { type: 'color', value: '#22a7f0', 'aria-label': t('Любой цвет') });
    let timer;
    custom.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => tools.applyTheme(themeFromColor(custom.value)), 80);
    });
    const colors = h('div', { class: 'theme-colors' },
      THEME_COLORS.map((color) => button('', '', () => tools.applyTheme(themeFromColor(color)),
        { style: { background: color }, 'aria-label': t('Перекрасить худ: {color}', { color }) })),
      h('label', { class: 'custom', title: t('Любой цвет') }, custom),
      button('ghost', t('Случайный стиль'), () => tools.applyTheme(randomTheme())));
    const bulk = fillWidget({ label: t('Цвет всех картинок') }, bulkFill, (fill) => { bulkFill = fill; });
    return [
      section('quick.color', t('Весь худ в одном цвете'), null, [
        h('p', { class: 'note', text: t('Полоски, цифры и фон магазина подстроятся под выбранный цвет.') }),
        colors,
      ]),
      section('quick.images', t('Все картинки худа одним цветом'), null, [
        h('p', { class: 'note', text: t('Перекрашивает сразу все картинки: рамки, фоны, кнопки. Рисунок сохраняется.') }),
        bulk.node,
        h('div', { class: 'button-row' },
          button('ghost', t('Перекрасить все картинки'), () => tools.tintAll({ ...DEFAULT_TINT, fill: bulkFill })),
          button('link', t('убрать перекраску со всех'), tools.untintAll)),
      ]),
    ];
  }

  function subNames(group) {
    const names = [];
    group.controls.forEach((c) => { if (!names.includes(c.sub)) names.push(c.sub); });
    return names;
  }

  function renderGroup(group) {
    const names = subNames(group);
    const jump = (name) => {
      collapsed.delete(`${group.id}/${name}`);
      const target = body.querySelector(`.sub[data-sub="${CSS.escape(name)}"]`);
      if (!target) return;
      target.classList.remove('closed');
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    const chips = names.length > 2
      ? h('nav', { class: 'chips', 'aria-label': t('Части раздела') }, names.map((name) => {
        const controls = group.controls.filter((c) => c.sub === name);
        const chip = button('chip', name, () => jump(name));
        counters.push(() => chip.classList.toggle('has-changes', controls.some(isChanged)));
        return chip;
      }))
      : null;
    const head = h('header', { class: 'page-head' },
      h('p', { class: 'crumbs', text: `${areaTitle[group.area]} / ${group.title}` }),
      h('div', { class: 'title-row' }, h('h1', { text: group.title }), changeTools(group.controls, t('сбросить весь раздел'))),
      h('p', { class: 'lead', text: group.about }),
      chips);
    const subs = names.map((name) => {
      const controls = group.controls.filter((c) => c.sub === name);
      return section(`${group.id}/${name}`, name, controls, controls.map((c) => row(c)));
    });
    return [head, ...(group.id === 'global' ? quickStart() : []), ...subs];
  }

  function renderChanges() {
    const changed = all.filter(isChanged);
    listedChanges = changed.map((c) => c.id).join();
    const head = h('header', { class: 'page-head' },
      h('p', { class: 'crumbs', text: t('Проект / Изменения') }),
      h('div', { class: 'title-row' }, h('h1', { text: t('Изменения') }),
        changed.length ? button('link', t('сбросить всё'), () => {
          if (window.confirm(t('Вернуть весь худ к обычному виду Dota? Это можно будет отменить кнопкой «Отменить».'))) resetControls(all);
        }) : null),
      h('p', { class: 'lead', text: changed.length
        ? t('В мод попадёт только то, что перечислено здесь: {count}. Всё остальное останется как в обычной Dota.', { count: settingsWord(changed.length) })
        : t('Пока всё как в обычной Dota. Выбери раздел слева или нажми на часть худа в превью.') }));
    const parts = groups.filter((g) => g.controls.some(isChanged)).map((group) => {
      const controls = group.controls.filter(isChanged);
      const open = button('link', t('открыть раздел'), () => show({ kind: 'group', id: group.id }));
      const node = section(`changes/${group.id}`, group.title, controls, controls.map((c) => row(c, c.sub)));
      node.querySelector('.sub-head').append(open);
      return node;
    });
    return [head, ...parts];
  }

  function renderSearch(query) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const found = all.filter((c) => {
      const text = `${groupOf[c.id].title} ${c.sub} ${c.label} ${c.hint || ''}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
    const head = h('header', { class: 'page-head' },
      h('p', { class: 'crumbs', text: t('Поиск') }),
      h('div', { class: 'title-row' }, h('h1', { text: found.length ? t('Нашлось: {n}', { n: found.length }) : t('Ничего не нашлось') })),
      h('p', { class: 'lead', text: found.length ? t('По запросу «{query}». Настройки можно менять прямо здесь.', { query }) : t('Попробуй другое слово, например «цвет», «обводка» или «картинка».') }));
    const parts = groups.filter((g) => found.some((c) => groupOf[c.id] === g)).map((group) => {
      const controls = found.filter((c) => groupOf[c.id] === group);
      const open = button('link', t('открыть раздел'), () => show({ kind: 'group', id: group.id }));
      const node = section(`search/${group.id}`, group.title, null, controls.map((c) => row(c, c.sub)));
      node.querySelector('.sub-head').append(open);
      return node;
    });
    return [head, ...parts];
  }

  function render() {
    rows = new Map();
    counters = [];
    let nodes;
    if (view.kind === 'changes') nodes = renderChanges();
    else if (view.kind === 'search') nodes = renderSearch(view.query);
    else nodes = renderGroup(groupById[view.id]);
    body.replaceChildren(...nodes);
  }

  function show(next, { keepScroll = false } = {}) {
    view = next;
    const top = root.scrollTop;
    render();
    root.scrollTop = keepScroll ? top : 0;
    if (!keepScroll) {
      body.classList.remove('enter');
      void body.offsetWidth;
      body.classList.add('enter');
    }
    onView(view);
  }

  function flash(controlId) {
    const made = rows.get(controlId);
    if (!made) return;
    const sub = made.node.closest('.sub');
    if (sub && sub.classList.contains('closed')) {
      sub.classList.remove('closed');
      collapsed.forEach((key) => { if (key.endsWith(`/${sub.dataset.sub}`)) collapsed.delete(key); });
    }
    made.node.scrollIntoView({ block: 'center' });
    made.node.classList.remove('flash');
    void made.node.offsetWidth;
    made.node.classList.add('flash');
  }

  /** Вызывается при любом изменении проекта. */
  function refresh({ pressing }) {
    const values = store.get();
    rows.forEach((made, id) => made.sync(values[id]));
    counters.forEach((update) => update());
    if (view.kind === 'changes' && !pressing) {
      const now = all.filter(isChanged).map((c) => c.id).join();
      if (now !== listedChanges) show(view, { keepScroll: true });
    }
  }

  return {
    refresh,
    view: () => view,
    showGroup(id, controlId) {
      if (view.kind !== 'group' || view.id !== id) show({ kind: 'group', id });
      if (controlId) flash(controlId);
    },
    showChanges: () => show({ kind: 'changes' }),
    showSearch: (query) => show({ kind: 'search', query }),
    changedCount: () => all.filter(isChanged).length,
    changedIn: (group) => group.controls.filter(isChanged).length,
  };
}
