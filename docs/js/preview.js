// Живое превью: разметка худа 1920×1080 и перевод настроек в CSS-переменные.
import { boardPanel, treePanel } from './preview-panels.js';
import { game, iconImg, img, shopPanel } from './preview-shop.js';

const varName = (id) => id.replace(/\./g, '-');
const FIT = { stretch: '100% 100%', cover: 'cover', contain: 'contain' };

// Как в cssgen: картинка на весь магазин делает эти панели прозрачными.
const CLEARED_BY_WHOLE_SHOP = ['shop.color', 'shop.searchRow', 'shop.combines', 'shop.pinned', 'shop.pinnedImg'];
const OUTLINE_DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];

function cssFill(fill) {
  const direction = fill.dir === 'v' ? 'to bottom' : 'to right';
  const stops = fill.stops.map((s) => `${s.c} ${s.p * 100}%`).join(',');
  return `linear-gradient(${direction},${stops})`;
}

function imageVars(control, value, imageUrl) {
  const v = varName(control.id);
  if (value) {
    return { [`--${v}`]: `url("${imageUrl(value.id)}")`, [`--${v}-size`]: FIT[value.fit] || control.preview_fit, [`--${v}-op`]: value.opacity };
  }
  const source = control.preview ? `url("${game(control.preview)}")` : 'none';
  return { [`--${v}`]: source, [`--${v}-size`]: control.preview_fit, [`--${v}-op`]: 1 };
}

function outlineCss(value, off) {
  if (!value.on) return off;
  return OUTLINE_DIRECTIONS.map(([x, y]) => `${x * value.w}px ${y * value.w}px ${value.w / 2}px ${value.c}`).join(',');
}

function controlVars(control, value, imageUrl) {
  const v = varName(control.id);
  switch (control.type) {
    case 'fill': return { [`--${v}`]: cssFill(value) };
    case 'color': return { [`--${v}`]: value };
    case 'num': return { [`--${v}`]: control.unit === '%' || control.div !== 1 ? value / (control.div === 1 ? 100 : control.div) : `${value}${control.unit}` };
    case 'toggle': return { [`--${v}`]: value ? 'block' : 'none', [`--${v}-vis`]: value ? 'visible' : 'hidden' };
    case 'offset': return { [`--${v}`]: `translate(${value.x}px,${value.y}px)` };
    case 'image': return imageVars(control, value, imageUrl);
    case 'outline': return { [`--${v}`]: outlineCss(value, control.preview_off) };
    case 'glow': return { [`--${v}`]: value.on ? `0 0 ${value.w * 2}px ${value.w}px ${value.c}` : 'none' };
    default: return {};
  }
}

function clearCoveredShopPanels(stage, catalog, values) {
  if (!values['shop.bgAll']) return;
  for (const control of catalog) {
    if (CLEARED_BY_WHOLE_SHOP.includes(control.id) && JSON.stringify(values[control.id]) === JSON.stringify(control.default)) {
      stage.style.setProperty(`--${varName(control.id)}`, control.type === 'image' ? 'none' : 'transparent');
    }
  }
}

/** imageUrl(id) → адрес загруженной картинки для показа в превью. */
export function applyValues(stage, catalog, values, imageUrl) {
  for (const control of catalog) {
    for (const [name, value] of Object.entries(controlVars(control, values[control.id], imageUrl))) {
      stage.style.setProperty(name, value);
    }
  }
  clearCoveredShopPanels(stage, catalog, values);
  showChosenTalentColor(stage, catalog, values);
  hideInsetShadows(stage, values);
  requestAnimationFrame(() => cullOutsideRow(stage));
}

// Блок ряда способностей (таланты, врождённая, аганим), унесённый целиком за край ряда, игра не рисует
// вовсе — даже с overflow: noclip. Проверено в игре: врождённая на +370 пропадает. Показываем так же.
function cullOutsideRow(stage) {
  const row = stage.querySelector('.center .abilities');
  if (!row) return;
  const r = row.getBoundingClientRect();
  row.querySelectorAll('.talent, .innate, .aghs').forEach((block) => {
    block.classList.remove('culled');
    const b = block.getBoundingClientRect();
    const touches = b.right > r.left && b.left < r.right && b.bottom > r.top && b.top < r.bottom;
    block.classList.toggle('culled', !touches);
  });
}

// Тени по краям фона способностей игра прячет (наше правило), когда сдвинуты способности, инвентарь
// или портрет: иначе тень ложится на ячейки и ловит мышь.
const INSET_MOVERS = ['ab.offset', 'inv.offset', 'por.offset'];
function hideInsetShadows(stage, values) {
  const moved = INSET_MOVERS.some((id) => values[id] && (values[id].x || values[id].y));
  stage.classList.toggle('inset-hidden', moved);
}

// Выбранные таланты игра рисует светлым #E7D291, а не цветом из своего правила (#E7D29188).
// Пока настройку не трогали, превью показывает как в игре; поменяли — показываем выбранный цвет.
function showChosenTalentColor(stage, catalog, values) {
  const control = catalog.find((c) => c.id === 'tree.chosen');
  if (!control) return;
  if (values[control.id] === control.default) stage.style.removeProperty('--tree-chosen-shown');
  else stage.style.setProperty('--tree-chosen-shown', values[control.id]);
}

const asset = (path) => new URL(path, document.baseURI).href;
// Цвета игроков Dota: по пять на команду, слева направо.
const RADIANT_COLORS = ['#3375ff', '#66ffbf', '#bf00bf', '#f3f00b', '#ff6b00'];
const DIRE_COLORS = ['#fe86c2', '#a1b447', '#65d9f7', '#008321', '#a46900'];
const ABILITY_LEVELS = [{ max: 4, have: 4 }, { max: 4, have: 4 }, { max: 4, have: 3 }, { max: 3, have: 2 }];

function levelPips({ max, have }) {
  return `<span class="ab-pips">${Array.from({ length: max }, (_, i) => `<i class="${i < have ? 'on' : ''}"></i>`).join('')}</span>`;
}

function abilityButtons(assets) {
  const keys = ['Q', 'W', '', 'R'];
  return assets.spells.map((src, i) => `
    <div class="ab-slot">
      <div class="ab-btn" data-c="ab.size">
        ${iconImg(src, 'ab-img')}
        <i class="ab-bevel" data-c="ab.bevelImg">${img('ab.bevelImg')}</i>
        <i class="ab-cd ${i === 1 ? 'show' : ''}" data-c="ab.cdColor" style="--cd-done:18%"></i>
        ${i === 1 ? '<b class="ab-cdtext" data-c="ab.cd">58</b>' : ''}
        ${keys[i] ? `<b class="hot" data-c="ab.hotkey">${keys[i]}</b>` : ''}
        <b class="ab-mana" data-c="ab.mana">${[110, 120, 0, 150][i] || ''}</b>
      </div>
      ${levelPips(ABILITY_LEVELS[i])}
    </div>`).join('');
}

function inventorySlots(items) {
  const keys = ['Z', 'X', 'C', 'V', 'B', 'N'];
  return keys.map((key, i) => `
    <div class="slot" data-c="inv.slotW">
      <i class="well" data-c="inv.well">${img('inv.well')}</i>
      ${i < 5 ? iconImg(items[i], 'item') : ''}
      ${i === 2 ? '<b class="charges" data-c="inv.charges">3</b>' : ''}
      ${i === 1 ? '<b class="itemcd" data-c="inv.cd">22</b>' : ''}
      <b class="hot small" data-c="ab.hotkey">${key}</b>
    </div>`).join('');
}

function teamSide(heroes, side, score, colors) {
  const bar = side === 'radiant' ? 'top.hpRadiant' : 'top.hpDire';
  const players = heroes.map((src, i) => `
    <div class="tb-slot">
      <span class="tb-face">
        <i class="tb-color" style="background-color:${colors[i]}"></i>
        ${iconImg(src, 'tb-hero')}<i class="tb-shade"></i>
      </span>
      <i class="tb-ult ${i % 2 ? 'ready' : ''}"></i>
      <i class="tb-hp" data-c="${bar}"><i style="width:${[100, 72, 88, 41, 96][i]}%"></i></i>
      <i class="tb-mp"><i style="width:${[80, 100, 35, 64, 90][i]}%"></i></i>
    </div>`).join('');
  const scoreCell = `<b class="tb-score" data-c="top.score">${score}</b>`;
  return `
    <div class="tb-team ${side}" data-c="top.bg">
      <i class="tb-bg">${img('top.bg')}</i>
      ${side === 'radiant' ? players + scoreCell : scoreCell + players}
    </div>`;
}

function topBar(assets) {
  const left = assets.team.slice(0, 5);
  const right = assets.team.slice(4, 9).concat(assets.team[0]).slice(0, 5);
  return `
    <div class="topbar" data-b="top" data-tab="top">
      ${teamSide(left, 'radiant', 21, RADIANT_COLORS)}
      <div class="clock" data-c="top.clock">${img('top.clock')}
        <img class="tb-daynight" src="${game(assets.ui.sun)}" alt="" draggable="false">
        <b data-c="top.time">27:43</b>
      </div>
      ${teamSide(right, 'dire', 18, DIRE_COLORS)}
    </div>`;
}

// Мини-карта как в игре: пиксельная карта, туман войны вне обзора Света, постройки квадратами
// и пиксельные портреты героев на кольце-стрелке (лагерей игра на мини-карте не рисует). Места сняты со скриншота игры, в % карты.
const MAP_BUILDINGS = [
  [47.4, 15], [68.6, 16.4], [73, 20.1], [78.1, 21.5], [79.6, 20.1], [76.6, 23.7], [73, 26.6], [84.7, 30.3], [62.5, 36.9], [84.7, 46.8], [83.9, 62],
].map(([x, y]) => [x, y, 'd']).concat([
  [10.9, 54.1], [10.2, 68.2], [30.7, 65.8], [16.1, 74.1], [19.7, 72.6], [16.8, 78.5], [13.9, 77], [46, 85],
].map(([x, y]) => [x, y, 'r']));
// [x, y, номер героя в assets.icons, сторона, куда смотрит стрелка]
const MAP_HEROES = [[11.7, 29.6, 8, 'enemy', 100], [45.3, 70.4, 6, 'enemy', 120]];

function mapUnit([x, y, hero, side, turn], icons, ring) {
  return `
    <span class="mm-unit ${side}" style="left:${x}%;top:${y}%;--turn:${turn}deg">
      <i class="mm-ring" style="-webkit-mask-image:url('${ring}');mask-image:url('${ring}')"></i>
      <img src="${game(icons[hero])}" alt="" draggable="false">
    </span>`;
}

function timerButton(kind, bgId, icon) {
  return `
    <div class="mm-timer ${kind}" data-c="${bgId}">${img(bgId)}
      <span><img src="${game(icon)}" alt="" draggable="false"><i></i></span>
    </div>`;
}

function minimap(assets) {
  const { ui } = assets;
  const ring = game(ui.mmHeroRing);
  const buildings = MAP_BUILDINGS.map(([x, y, team]) => `<i class="mm-mark ${team}" style="left:${x}%;top:${y}%"></i>`).join('');
  return `
    <div class="mm-block" data-b="minimap" data-tab="minimap">
      <div class="mm" data-c="minimap.bg">
        ${img('minimap.bg')}
        <i class="mm-map" data-src="${game(assets.overview)}">
          <i class="mm-fog"></i>${buildings}
          ${MAP_HEROES.map((unit) => mapUnit(unit, assets.icons, ring)).join('')}
          <span class="mm-unit self" style="left:14%;top:84%;--turn:300deg">
            <i class="mm-ring" style="-webkit-mask-image:url('${ring}');mask-image:url('${ring}')"></i>
            <img src="${game(assets.icons[0])}" alt="" draggable="false">
          </span>
        </i>
      </div>
    </div>
    <div class="mm-side">
      ${timerButton('roshan', 'minimap.roshanBg', ui.roshan)}
      ${timerButton('tormentor', 'minimap.tormentorBg', ui.tormentor)}
    </div>
    <div class="glyph" data-b="glyph" data-tab="minimap" data-c="minimap.glyph">${img('minimap.glyph')}
      <span class="mm-round scan"><i class="on" data-c="minimap.scan">${img('minimap.scan')}</i><i class="off" data-c="minimap.scanOff">${img('minimap.scanOff')}</i><b>2</b></span>
      <span class="mm-round fort"><i class="on" data-c="minimap.glyphBtn">${img('minimap.glyphBtn')}</i><i class="off" data-c="minimap.glyphOff">${img('minimap.glyphOff')}</i></span>
    </div>`;
}

// В игре мини-карта нарисована крупными пикселями: уменьшаем карту на холсте и растягиваем без сглаживания.
// У картинки обзора пустые поля по 6% с каждой стороны, их срезаем.
const MAP_PIXELS = 132;
const MAP_MARGIN = 0.06;
function pixelateMap(stage) {
  const node = stage.querySelector('.mm-map');
  if (!node) return;
  const source = new Image();
  source.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = MAP_PIXELS;
    canvas.height = MAP_PIXELS;
    const edge = source.width * MAP_MARGIN;
    const side = source.width - edge * 2;
    canvas.getContext('2d').drawImage(source, edge, edge, side, side, 0, 0, MAP_PIXELS, MAP_PIXELS);
    node.style.backgroundImage = `url("${canvas.toDataURL()}")`;
  };
  source.src = node.dataset.src;
}

function buffRow(assets) {
  const buff = (src, kind, count) => `
    <i class="buff ${kind}" data-c="buffs.size"><img src="${game(src)}" alt="" draggable="false">${count ? `<b>${count}</b>` : ''}</i>`;
  return `
    <div class="buffs" data-b="buffs" data-tab="buffs">
      ${buff(assets.items[14], 'bad', 0)}${buff(assets.spells[1], 'good', 10)}${buff(assets.items[12], 'good', 0)}
    </div>`;
}

function bar(kind, fill, track, label, regen, regenText, textId) {
  return `
    <div class="bar ${kind}" data-c="${fill}">
      <i class="bar-l">${img(`${kind}.fillImg`)}</i><i class="bar-r" data-c="${track}"></i>
      <b class="bar-val mono" data-c="${label}" id="${textId}"></b><em class="regen" data-c="${regen}">${regenText}</em>
    </div>`;
}

function statRows(ui) {
  const rows = [['215', ui.iconDamage, '+104', 'up'], ['363', ui.iconAttackSpeed], ['32', ui.iconArmor, '-5', 'down'],
    ['31%', ui.iconMagicResist], ['335', ui.iconSpeed]];
  return rows.map(([value, icon, bonus, kind]) => `
    <span><b>${value}</b>${bonus ? `<em class="${kind}">${bonus}</em>` : ''}<img src="${game(icon)}" alt="" draggable="false"></span>`).join('');
}

function attributes(ui) {
  const cells = [['92', ui.attrStr], ['193', ui.attrAgi], ['62', ui.attrInt]];
  return cells.map(([value, icon]) => `<span><b>${value}</b><img src="${game(icon)}" alt="" draggable="false"></span>`).join('');
}

/** Кнопка талантов: круг, дерево, загоревшиеся ветки выбранных талантов и дуга атрибутов. */
function talentButton(ui) {
  return `
    <div class="talent" data-b="talent" data-tab="talents">
      <i class="talent-pips-arc" data-c="talent.pipsBg">${img('talent.pipsBg')}</i>
      <i class="talent-pips-fill" data-c="talent.pips" style="--mask:url('${game(ui.attrPipsMask)}')"></i>
      <i class="talent-layer" data-c="talent.bg">${img('talent.bg')}</i>
      <i class="talent-layer talent-tree" data-c="talent.tree">${img('talent.tree')}</i>
      <i class="talent-layer flip" data-tab="tree" data-c="tree.pip10">${img('tree.pip10')}</i>
      <i class="talent-layer" data-tab="tree" data-c="tree.pip15">${img('tree.pip15')}</i>
      <i class="talent-layer flip" data-tab="tree" data-c="tree.pip20">${img('tree.pip20')}</i>
      <i class="talent-layer dim" data-tab="tree" data-c="tree.pip25">${img('tree.pip25')}</i>
    </div>`;
}

function centerPanel(assets) {
  const { ui } = assets;
  return `
    <div class="center">
      <div class="flare-l" data-tab="por" data-c="por.left">${img('por.left')}</div>
      <div class="center-bg" data-tab="ab" data-c="ab.bg"><i class="tint"></i>${img('ab.bg')}</div>
      <i class="inset-shadow left" data-tab="ab" data-c="ab.inset">${img('ab.inset')}</i>
      <i class="inset-shadow right" data-tab="ab" data-c="ab.inset">${img('ab.inset')}</i>
      <div class="por" data-b="por" data-tab="por">
        <div class="por-back" data-c="por.bg">${img('por.bg')}</div>
        <img class="por-hero" src="${asset('img/portrait.jpg')}" alt="" draggable="false">
        <i class="por-fade"></i>
        <div class="stats" data-c="stats.label">${statRows(ui)}</div>
        <div class="attrs">${attributes(ui)}</div>
      </div>
      <div class="level" data-tab="por" data-c="por.level"><i class="xp-glow"></i><i class="xp-ring" data-c="por.xp"></i><b class="mono">26</b></div>
      <div class="unit-name" data-tab="por" data-c="unit.name">Juggernaut</div>
      <i class="por-badge" data-tab="por" style="background-image:url('${game(ui.heroBadge)}')"></i>

      <div class="bars" data-b="bars" data-tab="bars">
        ${bar('hp', 'hp.fill', 'hp.track', 'hp.label', 'hp.regen', '+14.2', 'hpText')}
        ${bar('mp', 'mp.fill', 'mp.track', 'mp.label', 'mp.regen', '+6.8', 'mpText')}
      </div>

      <div class="abilities" data-b="ab" data-tab="ab">
        ${talentButton(ui)}
        <div class="innate" data-b="innate" data-tab="talents">
          <i class="innate-frame" data-c="innate.frame">${img('innate.frame')}</i>
          <i class="innate-icon" data-c="innate.icon">${img('innate.icon')}</i>
        </div>
        ${abilityButtons(assets)}
        <div class="aghs" data-b="aghs" data-tab="talents">
          <i class="aghs-s off" data-c="aghs.scepter">${img('aghs.scepter')}</i>
          <i class="aghs-s on" data-c="aghs.scepterOn">${img('aghs.scepterOn')}</i>
          <i class="aghs-h off" data-c="aghs.shard">${img('aghs.shard')}</i>
          <i class="aghs-h on" data-c="aghs.shardOn">${img('aghs.shardOn')}</i>
        </div>
      </div>

      <div class="inv" data-b="inv" data-tab="inv">
        <div class="inv-items" data-c="inv.bg">${img('inv.bg')}</div>
        <div class="inv-over" data-c="inv.image">${img('inv.image')}</div>
        <div class="inv-grid">${inventorySlots(assets.items)}</div>
        <div class="backpack">${assets.items.slice(15, 18).map((src, i) => `
          <div class="pack" data-c="inv.packSlot">${img('inv.packSlot')}<i class="pack-shade"></i>${i < 2 ? iconImg(src, 'item') : ''}</div>`).join('')}</div>
      </div>

      <div class="flare-r" data-tab="por" data-c="por.right">${img('por.right')}</div>
      <div class="rounds" data-b="round" data-tab="inv">
        <div class="madstone"><b>3</b><small>/10</small></div>
        <div class="round neutral" data-c="inv.neutral">${img('inv.neutral')}${iconImg(assets.items[6], 'round-item')}</div>
        <div class="round tp" data-c="inv.tp">${img('inv.tp')}${iconImg(assets.items[7], 'round-item')}
          <b class="hot small" data-c="ab.hotkey">T</b><b class="round-count">2</b></div>
      </div>
    </div>`;
}

function courierButton(icon, cls = '', extra = '') {
  return `<span class="courier-btn ${cls}"><i style="-webkit-mask-image:url('${game(icon)}');mask-image:url('${game(icon)}')"></i>${extra}</span>`;
}

function launcher(assets) {
  const { ui, items } = assets;
  // В быстрой покупке лежат части собираемых предметов: сапоги, перчатки и пояс, кольцо, камень и меч.
  const slot = (src) => `<i class="quick-slot">${iconImg(src)}</i>`;
  return `
    <div class="launch" data-b="launch" data-tab="launch">
      <div class="quick" data-b="quick" data-tab="launch" data-c="launch.quick"><i class="quick-tint" data-c="quick.color"></i>${img('launch.quick')}
        <div class="quick-row">${items.slice(24, 28).map(slot).join('')}</div>
        <div class="quick-row second">${items.slice(28, 30).map(slot).join('')}</div>
        <div class="quick-actions">
          <img class="quick-protect" src="${game(ui.buybackProtect)}" alt="" draggable="false">
          <span class="quick-clear"><i style="-webkit-mask-image:url('${game(ui.clear)}');mask-image:url('${game(ui.clear)}')"></i></span>
        </div>
        <div class="quick-sticky">${iconImg(items[7])}</div>
      </div>
      <div class="launch-bg" data-c="launch.bg">${img('launch.bg')}
        <div class="shop-btn" data-c="launch.button">${img('launch.button')}
          <b class="gold" data-c="launch.gold">4312</b>
          <i class="gold-icon" data-c="launch.goldIcon">${img('launch.goldIcon')}</i>
        </div>
        <div class="courier">
          ${courierButton(ui.courier, '', '<b class="courier-key">F2</b>')}
          ${courierButton(ui.burst, 'idle')}${courierButton(ui.shield, 'idle')}
          ${courierButton(ui.deliver, 'big', '<b class="courier-key">F3</b>')}
        </div>
      </div>
    </div>`;
}

export function renderStage(stage, assets) {
  stage.innerHTML = `
  <div class="world" style="background-image:url('${asset('img/world.jpg?v=3')}')"></div>
  <div class="hud">
    ${topBar(assets)}
    ${minimap(assets)}
    ${buffRow(assets)}
    ${centerPanel(assets)}
    ${launcher(assets)}
    ${shopPanel(assets)}
    ${treePanel()}
    ${boardPanel(assets)}
  </div>`;
  pixelateMap(stage);
}

export function setBars(stage, hp, mp) {
  stage.style.setProperty('--hp-pct', `${hp}%`);
  stage.style.setProperty('--mp-pct', `${mp}%`);
  stage.querySelector('#hpText').textContent = `${Math.round(24.0 * hp)} / 2400`;
  stage.querySelector('#mpText').textContent = `${Math.round(12.0 * mp)} / 1200`;
}
