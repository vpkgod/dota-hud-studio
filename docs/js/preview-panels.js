// Окна поверх игры в превью: ветка талантов и таблица по Tab.
import { game, img } from './preview-shop.js';
import { t } from './i18n.js';

// Таланты Juggernaut, как на скриншоте игры. chosen — какая сторона взята; у строки 25 очко ещё не потрачено.
const TALENTS = [
  { level: 25, left: t('40% вампиризма от Blade Dance'), right: t('+1 сек. действия Omnislash'), chosen: null },
  { level: 20, left: t('+120 к урону в секунду от Blade Fury'), right: t('+15% к критическому урону от Blade Dance'), chosen: 'left' },
  { level: 15, left: t('Blade Fury ускоряет передвижение на 45'), right: t('−15 сек. перезарядки Omnislash'), chosen: 'right' },
  { level: 10, left: t('−1 сек. для получения одного эффекта Bladeform'), right: t('−12 сек. перезарядки Healing Ward'), chosen: 'left' },
];
const STAT_PIPS = 7;

/** Строка ветки (BranchPair): подсветка доступного выбора, два таланта по 190×47 и уровень между ними. */
function talentRow(talent, index) {
  const active = !talent.chosen;
  const side = (name) => {
    const text = talent[name];
    if (active) return `<b class="tree-talent ${name}" data-c="tree.label">${text}</b>`;
    const isChosen = talent.chosen === name;
    return `<b class="tree-talent ${name} ${isChosen ? 'is-chosen' : 'is-locked'}" data-c="${isChosen ? 'tree.chosen' : 'tree.disabled'}">${text}</b>`;
  };
  return `
    <div class="tree-row ${active ? 'is-active' : ''}" style="--row:${index}">
      ${active ? `<i class="tree-glow both" data-c="tree.selectBoth">${img('tree.selectBoth')}</i>
        <i class="tree-glow left" data-c="tree.selectLeft">${img('tree.selectLeft')}</i>
        <i class="tree-glow right" data-c="tree.selectRight">${img('tree.selectRight')}</i>` : ''}
      ${side('left')}${side('right')}
    </div>`;
}

const levelBadge = (talent, index) => `
  <i class="tree-level ${talent.chosen ? '' : 'is-active'}" style="--row:${index}" data-c="tree.levelBg">${img('tree.levelBg')}
    <b class="mono" data-c="tree.level">${talent.level}</b></i>`;

/**
 * Ветка талантов (dota_hud_stat_branch.xml). В игре у неё два вида:
 * наведение на кнопку талантов — подсказка «Древо талантов» со своим фоном и без мигания;
 * клик по кнопке — закреплённая ветка «Выберите талант», доступный выбор мигает.
 */
export function treePanel() {
  const pips = Array.from({ length: STAT_PIPS }, () => '<i class="on"></i>').join('');
  return `
    <div class="tree" data-b="tree" data-tab="tree">
      <div class="tree-center">
        <i class="tree-bg pinned" data-c="tree.bg">${img('tree.bg')}</i>
        <i class="tree-bg tip" data-c="tree.bgTip">${img('tree.bgTip')}</i>
        <b class="tree-title pinned" data-c="tree.title">${t('Выберите талант')}</b>
        <b class="tree-title tip" data-c="tree.title">${t('Древо талантов')}</b>
        ${TALENTS.map(talentRow).join('')}
        ${TALENTS.map(levelBadge).join('')}
      </div>
      <div class="tree-stat" data-c="tree.stat">${img('tree.stat')}
        <span>${t('+2 ко всем атрибутам')}</span>
        <span class="tree-stat-pips">${pips}</span>
      </div>
    </div>`;
}

const prettyHero = (path) => path.match(/npc_dota_hero_(.+)_png\.png$/)[1].replace(/_/g, ' ');

// Цвета слотов игроков (HeroSlot0..9Color в dotastyles.css).
const SLOT_COLORS = ['#3375ff', '#66ffbf', '#bf00bf', '#f3f00b', '#ff6b00', '#fe86c2', '#a1b447', '#65d9f7', '#008321', '#a46900'];
// Строки таблицы: уровень, золото, убийства, смерти, помощь. Первая — твой герой (уровень и золото как в худе).
const PLAYERS = [
  [26, 4312, 12, 3, 9], [23, 2753, 5, 6, 14], [21, 1866, 4, 7, 11], [24, 3979, 9, 4, 8], [19, 912, 1, 8, 17],
  [25, 0, 10, 5, 7], [22, 0, 6, 9, 10], [20, 0, 3, 6, 12], [24, 0, 11, 7, 5], [18, 0, 2, 9, 13],
];

/** Кнопка талантов в таблице: та же, что у способностей, в масштабе 75% (#TalentTree { ui-scale: 75% }). */
const miniTalents = (local) => `
  <i class="sb-talent ${local ? 'is-local' : ''}">
    <i class="talent-layer" data-c="talent.bg">${img('talent.bg')}</i>
    <i class="talent-layer talent-tree" data-c="talent.tree">${img('talent.tree')}</i>
    ${local ? `<i class="talent-layer flip">${img('tree.pip10')}</i><i class="talent-layer">${img('tree.pip15')}</i><i class="talent-layer flip">${img('tree.pip20')}</i>` : ''}
  </i>`;

/** Строка игрока (dota_hud_scoreboard_player.xml): цвет слота, аватар, герой, имена, аганим, таланты, уровень, золото, У/С/П, ульта и жалобы. */
function playerRow(src, index, assets) {
  const local = index === 0;
  const enemy = index >= 5;
  const [level, gold, kills, deaths, assists] = PLAYERS[index];
  const { ui } = assets;
  return `
    <div class="sb-row ${local ? 'is-local' : ''} ${enemy ? 'is-enemy' : ''}" data-c="${local ? 'board.localRow' : 'board.row'}">
      <i class="sb-color" style="background-color:${SLOT_COLORS[index]};background-image:url('${game(ui.slotVignette)}')"></i>
      <i class="sb-avatar"></i>
      <img class="sb-hero" src="${game(src)}" alt="" draggable="false" data-c="board.imageW">
      <span class="sb-names">
        <b class="sb-player" data-c="board.player">${t('Игрок {n}', { n: index + 1 })}</b>
        <small class="sb-heroname" data-c="board.hero">${prettyHero(src)}</small>
      </span>
      <i class="sb-aghs"><i class="sb-aghs-s">${img('aghs.scepter')}</i><i class="sb-aghs-h">${img('aghs.shard')}</i></i>
      ${miniTalents(local)}
      <span class="sb-level"><i></i><b class="mono">${level}</b></span>
      <span class="sb-gold-cell">
        ${enemy ? '' : `<i class="sb-buyback" style="background-image:url('${game(ui.buyback)}')"></i><b class="sb-gold mono" data-c="board.gold">${gold}</b>`}
      </span>
      <b class="sb-kda kills" data-c="board.kda">${kills}</b>
      <b class="sb-kda" data-c="board.kda">${deaths}</b>
      <b class="sb-kda" data-c="board.kda">${assists}</b>
      <span class="sb-ult">${enemy ? '' : `<i data-c="board.ultReady">${img('board.ultReady')}</i>`}</span>
      <span class="sb-report"></span>
    </div>`;
}

/** Шапка команды: счёт, название (titleFont), подписи колонок — только у Света, — и «Жалобы» с кнопкой заглушить всех. */
function header(side, score, assets) {
  const radiant = side === 'radiant';
  const columns = radiant ? `
      <span class="sb-sub lvl" data-c="board.header">${t('ур.')}</span>
      <span class="sb-sub gold" data-c="board.header">${t('золото')}</span>
      <span class="sb-sub kda first" data-c="board.header">${t('у')}</span>
      <span class="sb-sub kda" data-c="board.header">${t('с')}</span>
      <span class="sb-sub kda" data-c="board.header">${t('п')}</span>
      <span class="sb-sub ult" data-c="board.header">${t('ульт')}</span>` : '<span class="sb-sub-gap"></span>';
  return `
    <div class="sb-head ${side}">
      <b class="sb-score" data-c="board.score">${score}</b>
      <b class="sb-team" data-c="board.team">${radiant ? t('Свет') : t('Тьма')}</b>
      ${columns}
      <span class="sb-report head">
        <span class="sb-report-text"><b>${t('Жалобы')}</b><small>${radiant ? t('Силы Света') : t('Силы Тьмы')}</small></span>
        <img src="${game(assets.ui.teamMute)}" alt="" draggable="false">
      </span>
    </div>`;
}

export function boardPanel(assets) {
  const heroes = [assets.hero, ...assets.team].slice(0, 10);
  const rows = (from) => heroes.slice(from, from + 5).map((src, i) => playerRow(src, from + i, assets)).join('');
  const { ui } = assets;
  const icon = (src, cls) => `<img class="${cls}" src="${game(src)}" alt="" draggable="false">`;
  return `
    <div class="board" data-b="board" data-tab="board">
      <div class="board-back" data-c="board.bg"><i class="board-tint" data-c="board.color"></i>${img('board.bg')}</div>
      <div class="board-body">
        ${header('radiant', 21, assets)}
        <div class="sb-team-rows">${rows(0)}</div>
        ${header('dire', 18, assets)}
        <div class="sb-team-rows">${rows(5)}</div>
        <div class="sb-buttons">
          ${icon(ui.coaches, 'small')}${icon(ui.combatLog, 'small')}${icon(ui.sharedContent, '')}${icon(ui.sharedUnits, '')}${icon(ui.showItems, '')}
        </div>
      </div>
    </div>`;
}
