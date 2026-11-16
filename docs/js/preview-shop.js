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

const itemSrc = (name) => `panorama/images/items/${name}_png.png`;
const NEUTRAL_TIERS = [['1-й разряд', '0:00+'], ['2-й разряд', '15:00+'], ['3-й разряд', '25:00+'], ['4-й разряд', '35:00+'], ['5-й разряд', '60:00+']];
const MADSTONE_TEXT = [
  'Убейте всех нейтральных крипов в одном лагере, чтобы получить 2 безумруда для себя и 1 для случайного союзника (за лагеря древних крипов даётся 3 безумруда себе и 2 — случайным союзникам).',
  'Зарабатывайте безумруды, чтобы создавать нейтральные предметы:<br>— На предмет 1-го разряда нужно 6 безумрудов.<br>— На предметы остальных разрядов нужно по 10 безумрудов.',
  'Достигнув лимита текущего разряда, продолжайте зарабатывать безумруды для союзников.',
];

/** Предмет магазина (DOTAShopItem): иконка, золотая рамка «можно купить» и число в углу. */
function shopItem(name, border, count = 0) {
  return `<i class="shop-item" data-c="shop.itemW">${iconImg(itemSrc(name))}<i class="shop-can" style="background-image:url('${border}')"></i>${count ? `<b>${count}</b>` : ''}</i>`;
}

/** Раздел лавки: заголовок (#ShopItemsHeader) и предметы по четыре в ряд. */
function section({ title, items }, border) {
  return `
    <div class="shop-section">
      <b class="shop-group-title" data-c="shop.group">${title}</b>
      <div class="shop-grid">${items.map((name) => shopItem(name, border)).join('')}</div>
    </div>`;
}

/** Вкладка «Основные» или «Улучшения»: разделы в две колонки, как в игре (чётные слева, нечётные справа). */
function itemsTab(name, sections, border) {
  const column = (odd) => sections.filter((_, i) => i % 2 === odd).map((s) => section(s, border)).join('');
  return `<div class="shop-tab-body ${name}"><div class="shop-col">${column(0)}</div><div class="shop-col">${column(1)}</div></div>`;
}

function neutralTab(ui, hero) {
  const tiers = NEUTRAL_TIERS.map(([title, time], i) => `<span class="tier t${i + 1}"><b>${title}</b><small class="mono">${time}</small></span>`).join('');
  const dots = NEUTRAL_TIERS.map((_, i) => `<i class="dot t${i + 1}"></i>`).join('');
  return `
    <div class="shop-tab-body neutrals">
      <b class="neutral-title">Прогресс команды</b>
      <div class="neutral-tiers">${tiers}</div>
      <div class="neutral-line"><img src="${game(hero)}" alt="" draggable="false"><span>${dots}</span></div>
      <span class="neutral-all">Все нейтральные предметы</span>
      <div class="madstone-head"><img src="${game(ui.madstone)}" alt="" draggable="false"><b>Безумруды</b><i></i>
        <span class="help" style="-webkit-mask-image:url('${game(ui.help)}');mask-image:url('${game(ui.help)}')"></span></div>
      ${MADSTONE_TEXT.map((text) => `<p class="madstone-text">${text}</p>`).join('')}
    </div>`;
}

/** Гайд слева (dota_hud_item_build): «Все сборки», название сборки и разделы с предметами. */
function guide(shop, ui, border) {
  const categories = (shop.guide || []).map(({ title, items }) => `
    <div class="guide-cat"><b>${title}</b>
      <div class="guide-items">${items.map(([name, count]) => shopItem(name, border, count)).join('')}</div>
    </div>`).join('');
  return `
    <div class="guide" data-c="shop.guideBg">${img('shop.guideBg')}
      <span class="guide-browse">Все сборки</span>
      <i class="guide-toggle" style="background-image:url('${game(ui.guideToggle)}'),url('${game(ui.itemBuildBg)}')"></i>
      <div class="guide-head"><b class="guide-title" data-c="shop.guideTitle">Стандартные предметы</b>
        <i class="guide-pencil" style="background-image:url('${game(ui.pencil)}')"></i></div>
      ${categories}
    </div>`;
}

const iconBox = (src, cls = '') => `<i class="shop-tool ${cls}" style="background-image:url('${game(src)}')"></i>`;

/**
 * Окно магазина по dota_hud_shop.xml: гайд слева, строка поиска с кнопками, вкладки «Основные / Улучшения /
 * Нейтральные», разделы лавки из scripts/shops.txt, «Командные предметы», закреплённые предметы и сборка внизу.
 */
export function shopPanel(assets) {
  const { ui } = assets;
  const shop = assets.shop || {};
  const border = game(ui.shopBorder);
  const pinned = (shop.pinned || []).map(([name, count]) => shopItem(name, border, count)).join('');
  return `
    <div class="shop" data-b="shop" data-tab="shop">
      ${guide(shop, ui, border)}
      <div class="shop-main" data-c="shop.bgAll">${img('shop.bgAll')}
        <div class="shop-search" data-c="shop.searchRow">
          <div class="shop-box" data-c="shop.searchBox">
            <i class="shop-search-icon" style="background-image:url('${game(ui.shopSearch)}')"></i>
            <span data-c="shop.placeholder">Поиск</span>
          </div>
          ${iconBox(ui.shopSuggest, 'plain')}${iconBox(ui.shopStar, 'plain')}${iconBox(ui.shopColumns)}${iconBox(ui.shopTeamItems)}
          <i class="shop-buyback" style="background-image:url('${game(ui.buybackProtect)}')"></i>
        </div>
        <div class="shop-area" data-c="shop.color">
          <i class="shop-fill"></i>${img('shop.bg')}
          <div class="shop-tabs">
            <span class="shop-tab t-basics" data-c="shop.tab">Основные</span>
            <span class="shop-tab t-upgrades" data-c="shop.tab">Улучшения</span>
            <span class="shop-tab t-neutrals" data-c="shop.tab">Нейтральные</span>
          </div>
          <div class="shop-content">
            ${itemsTab('basics', shop.basics || [], border)}
            ${itemsTab('upgrades', shop.upgrades || [], border)}
            ${neutralTab(ui, assets.icons[0])}
            <span class="shop-hint"><i style="-webkit-mask-image:url('${game(ui.help)}');mask-image:url('${game(ui.help)}')"></i>Ctrl + ПКМ по предмету — больше опций</span>
          </div>
          <div class="team-items"><b>Командные предметы</b>
            <span><i style="-webkit-mask-image:url('${game(ui.help)}');mask-image:url('${game(ui.help)}')"></i>Подробнее</span></div>
        </div>
        <div class="shop-pinned" data-c="shop.pinned">${img('shop.pinnedImg')}
          <b>Закреплённые предметы</b><div class="pinned-row">${pinned}<i class="pinned-empty"></i></div>
        </div>
        <div class="shop-combines" data-c="shop.combines">${img('shop.combinesImg')}</div>
      </div>
    </div>
    <div class="stash">
      <span class="stash-grab">Взять всё</span><b class="stash-title">Тайник</b>
      <div class="stash-slots">${'<i></i>'.repeat(6)}</div>
    </div>`;
}
