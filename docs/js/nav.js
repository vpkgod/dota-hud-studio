// Меню слева: крупные разделы, внутри них части худа со счётчиками изменений.
import { button, h, icon } from './dom.js';

// Иконка каждого раздела; у открытого раздела она залитая.
const ICONS = {
  global: 'palette', bars: 'favorite', ab: 'bolt', talents: 'stars', inv: 'backpack', por: 'face',
  top: 'groups', minimap: 'map', buffs: 'shield', launch: 'paid', shop: 'storefront', tree: 'account_tree',
  board: 'scoreboard', __changes: 'edit_note',
};

export function createNav({ root, areas, groups, onGroup, onChanges, onSearch }) {
  const items = new Map();
  const search = h('input', { type: 'search', class: 'nav-search', placeholder: 'Найти настройку', 'aria-label': 'Поиск настроек' });
  search.addEventListener('input', () => onSearch(search.value.trim()));

  function item(id, title, onclick) {
    const count = h('b', { class: 'badge', hidden: true });
    const node = button('nav-item', '', onclick);
    const name = ICONS[id];
    const mark = name ? h('i', { class: 'nav-icon' }, icon(name, 'line'), icon(`${name}-fill`, 'solid')) : null;
    node.append(...[mark, h('span', { class: 'nav-text', text: title }), count].filter(Boolean));
    items.set(id, { node, count });
    return node;
  }

  const list = areas.map((area) => h('div', { class: 'nav-area' },
    h('h2', { text: area.title }),
    groups.filter((g) => g.area === area.id).map((g) => item(g.id, g.title, () => onGroup(g.id)))));
  const changes = item('__changes', 'Изменения', onChanges);
  changes.classList.add('nav-changes');

  root.replaceChildren(search, h('div', { class: 'nav-list' }, list), h('div', { class: 'nav-foot' }, h('h2', { text: 'Проект' }), changes));

  return {
    /** counts: { idРаздела: числоИзменений }, total — всего. */
    setCounts(counts, total) {
      items.forEach(({ count }, id) => {
        const n = id === '__changes' ? total : counts[id] || 0;
        count.textContent = String(n);
        count.hidden = !n;
      });
    },
    setActive(view) {
      const activeId = view.kind === 'group' ? view.id : view.kind === 'changes' ? '__changes' : null;
      items.forEach(({ node }, id) => {
        if (id === activeId) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current');
      });
      if (view.kind !== 'search') search.value = '';
    },
    focusSearch: () => search.focus(),
  };
}
