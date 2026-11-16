// Окно магазина в превью. Устроено как #Main в layout/hud/dota_hud_shop.xml:
// сверху поиск и сетка предметов, снизу закреплённые предметы и сборка.
const varName = (id) => id.replace(/\./g, '-');

// Полный адрес: картинка подставляется через переменную CSS, а там путь считался бы от папки стилей.
export const game = (path) => new URL(`game/${path}`, document.baseURI).href;

export const img = (id) => {
  const v = varName(id);
  return `<i class="img" style="--i:var(--${v});--s:var(--${v}-size);--o:var(--${v}-op)"></i>`;
};

export const iconImg = (src, cls = '') => `<img class="${cls}" src="${game(src)}" alt="" draggable="false">`;

const BASICS = ['Расходники', 'Атрибуты', 'Снаряжение', 'Разное'];
const UPGRADES = ['Аксессуары', 'Поддержка', 'Магия', 'Броня', 'Оружие', 'Артефакты'];
const ROWS_IN_GROUP = 9;

function itemColumn(title, items, start) {
  const cells = Array.from({ length: ROWS_IN_GROUP }, (_, i) => items[(start + i * 3) % items.length]);
  return `
    <div class="shop-group">
      <b class="shop-group-title" data-c="shop.group">${title}</b>
      ${cells.map((src) => `<i class="shop-item" data-c="shop.itemW">${iconImg(src)}</i>`).join('')}
    </div>`;
}

function shopColumn(title, groups, items, offset) {
  return `
    <div class="shop-col">
      <b class="shop-col-title" data-c="shop.column">${title}</b>
      <div class="shop-groups">${groups.map((g, i) => itemColumn(g, items, offset + i * 2)).join('')}</div>
    </div>`;
}

function guide(items) {
  const rows = ['Начало', 'Ранняя игра', 'Середина'].map((name, r) => `
    <div class="guide-row"><small>${name}</small>
      <div>${items.slice(r * 3, r * 3 + 4).map((src) => iconImg(src)).join('')}</div>
    </div>`).join('');
  return `
    <div class="guide" data-c="shop.guideBg">${img('shop.guideBg')}
      <b class="guide-title" data-c="shop.guideTitle">Гайд на героя</b>
      ${rows}
    </div>`;
}

function strip(items) {
  return items.map((src) => iconImg(src)).join('');
}

export function shopPanel(items) {
  return `
    <div class="shop" data-b="shop" data-tab="shop">
      ${guide(items)}
      <div class="shop-main" data-c="shop.bgAll">${img('shop.bgAll')}
        <div class="shop-area" data-c="shop.color">
          <i class="shop-fill"></i>${img('shop.bg')}
          <div class="shop-search" data-c="shop.searchRow">
            <div class="shop-box" data-c="shop.searchBox"><span data-c="shop.placeholder">Поиск предметов…</span></div>
            <i class="shop-tool"></i><i class="shop-tool"></i><i class="shop-tool"></i>
          </div>
          <div class="shop-cols">
            ${shopColumn('Основные', BASICS, items, 0)}
            ${shopColumn('Улучшения', UPGRADES, items, 7)}
          </div>
        </div>
        <div class="shop-pinned" data-c="shop.pinned">${img('shop.pinnedImg')}${strip(items.slice(16, 22))}</div>
        <div class="shop-combines" data-c="shop.combines">${img('shop.combinesImg')}${strip(items.slice(2, 5))}</div>
      </div>
    </div>`;
}
