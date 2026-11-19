// Точка входа: соединяет меню, панель настроек, превью, сохранение и скачивание.
import { imageIds, sanitize } from './build/values.js';
import { isColorPopOpen } from './colorpop.js';
import { debounce } from './dom.js';
import { createExporter } from './exporter.js';
import { createImageStore, fileToPng } from './images.js';
import { startMotion } from './motion.js';
import { createNav } from './nav.js';
import { createPanel } from './panel.js';
import { applyValues, renderStage, setBars } from './preview.js';
import { exportProject, readProject } from './project-file.js';
import { createView, wireStage } from './stage.js';
import { loadPrefs, loadProject, savePrefs, saveProject } from './storage.js';
import { createStore } from './store.js';
import { createTinter } from './tint.js';
import { createVersions } from './versions.js';
import { setupPage, t, translateCatalog } from './i18n.js';

const $ = (id) => document.getElementById(id);
const DEFAULT_NAME = t('Мой худ');
const DEFAULT_NAMES = ['Мой худ', 'My HUD']; // i18n-ok: имя по умолчанию на обоих языках
const SAVE_DELAY_MS = 300;
const PANEL_MIN = 380;
const PANEL_MAX = 820;
// Какой блок приближать в превью, когда раздел выбран в меню.
const PART_BLOCK = {
  bars: '.bars', ab: '.abilities', talents: '.abilities', inv: '.inv', por: '.por',
  minimap: '.mm-block', shop: '.shop', launch: '.launch', top: '.topbar', buffs: '.buffs',
  tree: '.tree', board: '.board',
};
const SCENES = ['game', 'shop', 'tree', 'board'];

function toast(message) {
  const node = $('toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, 5000);
}

function createPrefs() {
  let prefs = loadPrefs();
  return {
    get: () => prefs,
    set(patch) { prefs = { ...prefs, ...patch }; savePrefs(prefs); },
  };
}

function wirePopover(button, popover) {
  const close = () => { popover.hidden = true; button.setAttribute('aria-expanded', 'false'); };
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = popover.hidden;
    document.querySelectorAll('.popover').forEach((p) => { p.hidden = true; });
    popover.hidden = !willOpen;
    button.setAttribute('aria-expanded', String(willOpen));
  });
  popover.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', close);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  return close;
}

function wireTheme(prefs) {
  const apply = (theme) => {
    if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme;
  };
  apply(prefs.get().theme);
  $('themeBtn').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    apply(next);
    prefs.set({ theme: next });
  });
}

function wireSplitter(prefs, onResize) {
  const root = document.documentElement;
  const setWidth = (width) => root.style.setProperty('--panel-w', `${Math.round(Math.min(PANEL_MAX, Math.max(PANEL_MIN, width)))}px`);
  if (prefs.get().panelWidth) setWidth(prefs.get().panelWidth);
  const splitter = $('splitter');
  let drag = null;
  splitter.addEventListener('pointerdown', (event) => {
    drag = { x: event.clientX, width: $('panel').getBoundingClientRect().width };
    splitter.setPointerCapture(event.pointerId);
    splitter.classList.add('dragging');
  });
  splitter.addEventListener('pointermove', (event) => {
    if (!drag) return;
    setWidth(drag.width + event.clientX - drag.x);
    onResize();
  });
  const stop = () => {
    if (!drag) return;
    drag = null;
    splitter.classList.remove('dragging');
    prefs.set({ panelWidth: Math.round($('panel').getBoundingClientRect().width) });
  };
  splitter.addEventListener('pointerup', stop);
  splitter.addEventListener('pointercancel', stop);
  splitter.addEventListener('dblclick', () => { root.style.removeProperty('--panel-w'); prefs.set({ panelWidth: null }); onResize(); });
}

async function loadCatalog() {
  const response = await fetch('data/catalog.json');
  if (!response.ok) throw new Error(`catalog ${response.status}`);
  return response.json();
}

async function start() {
  const prefs = createPrefs();
  wireTheme(prefs);
  let data;
  try {
    data = translateCatalog(await loadCatalog());
  } catch {
    $('panel').textContent = t('Не удалось загрузить настройки. Обнови страницу.');
    return;
  }
  const { groups, areas } = data;
  const all = groups.flatMap((g) => g.controls);
  const byId = Object.fromEntries(all.map((c) => [c.id, c]));
  const groupsById = Object.fromEntries(groups.map((g) => [g.id, g]));
  const groupOf = Object.fromEntries(groups.flatMap((g) => g.controls.map((c) => [c.id, g.id])));
  const defaults = Object.fromEntries(all.map((c) => [c.id, c.default]));
  const imageControls = all.filter((c) => c.type === 'image');
  const images = await createImageStore();

  /** Значения из файла, версии или хранилища → безопасные значения без ссылок на пропавшие картинки. */
  function cleanValues(raw) {
    const values = sanitize(all, raw);
    imageControls.forEach((c) => { if (values[c.id] && !images.has(values[c.id].id)) values[c.id] = null; });
    return values;
  }

  const saved = loadProject();
  const store = createStore(cleanValues(saved?.values), defaults);
  // Имя по умолчанию показываем на языке сайта, своё имя человека не трогаем.
  let projectName = typeof saved?.name === 'string' && saved.name && !DEFAULT_NAMES.includes(saved.name) ? saved.name : DEFAULT_NAME;
  $('projectName').value = projectName;

  const stage = $('stage');
  renderStage(stage, data.preview);
  let comparing = false;
  let sceneByHand = 'game';

  const refreshStage = () => {
    applyValues(stage, all, comparing ? defaults : store.get(), images.url);
    setBars(stage, Number($('pvHp').value), Number($('pvMp').value));
  };

  function setScene(scene, byHand) {
    if (byHand) sceneByHand = scene;
    SCENES.forEach((name) => {
      if (name !== 'game') stage.classList.toggle(`${name}-open`, name === scene);
      $(`scene-${name}`).setAttribute('aria-pressed', String(name === scene));
    });
    $('treeModes').hidden = scene !== 'tree';
    $('shopTabs').hidden = scene !== 'shop';
  }

  // У ветки талантов в игре два вида: подсказка при наведении на кнопку и закреплённая кликом.
  function setTreeMode(tip) {
    stage.classList.toggle('tree-tip', tip);
    $('treeTip').setAttribute('aria-pressed', String(tip));
    $('treePin').setAttribute('aria-pressed', String(!tip));
  }
  // Вкладки магазина: «Основные», «Улучшения», «Нейтральные».
  const SHOP_TABS = ['basics', 'upgrades', 'neutrals'];
  SHOP_TABS.forEach((tab) => $(`shopTab-${tab}`).addEventListener('click', () => {
    SHOP_TABS.forEach((t) => {
      stage.classList.toggle(`shop-tab-${t}`, t === tab && t !== 'basics');
      $(`shopTab-${t}`).setAttribute('aria-pressed', String(t === tab));
    });
  }));
  $('treeTip').addEventListener('click', () => setTreeMode(true));
  $('treePin').addEventListener('click', () => setTreeMode(false));

  const view = createView($('stageWrap'), stage, () => Number($('pvRatio').value), (zoom) => {
    $('zoomLabel').textContent = `${Math.round(zoom * 100)}%`;
  });

  async function upload(file) {
    try {
      const id = await images.add(await fileToPng(file));
      if (!images.durable()) toast(t('Картинка добавлена, но этот браузер не даёт её сохранить: после закрытия вкладки она пропадёт. Сохрани проект в файл.'));
      return id;
    } catch {
      toast(t('Эту картинку не получилось открыть. Подойдут PNG, JPG и WebP.'));
      return null;
    }
  }

  const tinter = createTinter({ store, controls: imageControls, images, toast });

  // Стиль меняет цвета и формы, но оставляет загруженные картинки.
  function applyTheme(values) {
    const current = store.get();
    const next = { ...defaults, ...values };
    imageControls.forEach((c) => { next[c.id] = current[c.id]; });
    store.replace(next);
  }

  function hint(controlId) {
    stage.querySelectorAll('.hint').forEach((n) => n.classList.remove('hint'));
    // Полоски героев сверху в игре видны только с зажатым Alt: показываем их, пока настройка под курсором.
    stage.classList.toggle('alt-peek', Boolean(controlId) && controlId.startsWith('top.hp'));
    // То же с аганимом: значки «есть скипетр» и «есть осколок» видны, пока их настройка под курсором.
    stage.classList.toggle('aghs-peek', controlId === 'aghs.scepterOn' || controlId === 'aghs.shardOn');
    // Фон подсказки виден только при наведении на кнопку талантов; подсветка одной стороны — когда доступна только она.
    stage.classList.toggle('tree-tip-peek', controlId === 'tree.bgTip');
    stage.classList.toggle('scan-off', controlId === 'minimap.scanOff');
    stage.classList.toggle('glyph-off', controlId === 'minimap.glyphOff');
    stage.classList.toggle('glow-left', controlId === 'tree.selectLeft');
    stage.classList.toggle('glow-right', controlId === 'tree.selectRight');
    if (!controlId) return;
    stage.querySelectorAll(`[data-c="${CSS.escape(controlId)}"]`).forEach((n) => n.classList.add('hint'));
  }

  const nav = createNav({
    root: $('nav'), areas, groups,
    onGroup: (id) => {
      panel.showGroup(id);
      const element = PART_BLOCK[id] && stage.querySelector(PART_BLOCK[id]);
      requestAnimationFrame(() => { if (element) view.focusOn(element); else view.reset(); });
    },
    onChanges: () => panel.showChanges(),
    onSearch: (query) => { if (query) panel.showSearch(query); else panel.showGroup(lastGroup); },
  });

  let lastGroup = groups[0].id;
  const panel = createPanel({
    root: $('panel'), store, areas, groups,
    tools: {
      upload, uploads: images.uploads, imageUrl: images.url, applyTheme, originalSize: (path) => data.sizes?.[path] || null,
      tint: tinter.tintOne, untinted: tinter.untinted, tintAll: tinter.tintAll, untintAll: tinter.untintAll,
    },
    onHover: hint,
    onView: (current) => {
      nav.setActive(current);
      if (current.kind === 'group') {
        lastGroup = current.id;
        setScene(groupsById[current.id].scene || sceneByHand, false);
      }
    },
  });

  const marks = wireStage({
    wrap: $('stageWrap'), stage, tip: $('stageTip'), view, store, byId, groupsById, groupOf,
    onPick: (groupId, controlId) => panel.showGroup(groupId, controlId),
  });

  function paintCounts() {
    const counts = Object.fromEntries(groups.map((g) => [g.id, panel.changedIn(g)]));
    const total = panel.changedCount();
    nav.setCounts(counts, total);
    $('downloadCount').textContent = total ? String(total) : '';
    $('downloadCount').hidden = !total;
    $('undo').disabled = !store.canUndo();
    $('redo').disabled = !store.canRedo();
  }

  const saveState = $('saveState');
  function save() {
    const ok = saveProject({ name: projectName, values: store.get() });
    saveState.dataset.state = ok ? 'saved' : 'failed';
    saveState.textContent = ok ? t('Сохранено в этом браузере') : t('Не сохраняется: хранилище браузера выключено');
    saveState.title = ok
      ? t('Работа сохраняется сама после каждой правки. Чтобы перенести худ на другой компьютер, сохрани проект в файл.')
      : t('Сохрани проект в файл через меню «Файл», иначе после закрытия вкладки он пропадёт.');
  }
  const saveLater = debounce(save, SAVE_DELAY_MS);

  let pressing = false;
  $('panel').addEventListener('pointerdown', () => { pressing = true; });
  window.addEventListener('pointerup', () => {
    if (!pressing) return;
    pressing = false;
    panel.refresh({ pressing: isColorPopOpen() });
  });

  store.subscribe(() => {
    refreshStage();
    panel.refresh({ pressing: pressing || isColorPopOpen() });
    paintCounts();
    saveState.dataset.state = 'saving';
    saveState.textContent = t('Сохраняю…');
    saveLater();
  });

  // Верхняя строка: название, отмена, версии, файл, скачивание.
  $('projectName').addEventListener('input', () => {
    projectName = $('projectName').value.slice(0, 60) || DEFAULT_NAME;
    saveLater();
  });
  $('undo').addEventListener('click', store.undo);
  $('redo').addEventListener('click', store.redo);
  document.addEventListener('keydown', (event) => {
    const typing = event.target.matches('input:not([type=range]):not([type=checkbox]),textarea,select');
    if (event.key === '/' && !typing) { event.preventDefault(); nav.focusSearch(); return; }
    if (!(event.ctrlKey || event.metaKey) || typing) return;
    const key = event.key.toLowerCase();
    if (key === 'z') { event.preventDefault(); if (event.shiftKey) store.redo(); else store.undo(); }
    if (key === 'y') { event.preventDefault(); store.redo(); }
  });

  const versions = createVersions({
    dialog: $('versionsDialog'), store, controls: all, toast,
    apply: (values) => store.replace(cleanValues(values)),
  });
  $('versionsBtn').addEventListener('click', versions.open);

  const closeFileMenu = wirePopover($('fileBtn'), $('fileMenu'));
  $('exportFile').addEventListener('click', async () => {
    closeFileMenu();
    await exportProject({ name: projectName, values: store.get() }, images);
  });
  $('importFile').addEventListener('click', () => { closeFileMenu(); $('importInput').click(); });
  $('importInput').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const project = await readProject(file, all, images);
      store.replace(project.values);
      if (project.name) { projectName = project.name; $('projectName').value = projectName; }
      toast(t('Проект открыт. Прошлый худ можно вернуть кнопкой «Отменить».'));
    } catch {
      toast(t('Этот файл не подходит. Нужен файл, сохранённый в HUD Studio.'));
    }
  });
  $('resetAll').addEventListener('click', () => {
    closeFileMenu();
    if (window.confirm(t('Вернуть весь худ к обычному виду Dota? Это можно будет отменить кнопкой «Отменить».'))) store.replace({ ...defaults });
  });

  const exporter = createExporter({
    dialog: $('downloadDialog'), store, controls: all, images, game: data.game || {}, sizes: data.sizes || {}, prefs,
    changedCount: panel.changedCount,
  });
  $('downloadBtn').addEventListener('click', exporter.open);
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  });

  // Строка над превью: сцена, сравнение, масштаб, вид.
  SCENES.forEach((scene) => $(`scene-${scene}`).addEventListener('click', () => setScene(scene, true)));
  wirePopover($('viewBtn'), $('viewMenu'));
  $('pvEnemy').addEventListener('change', (e) => stage.classList.toggle('enemy', e.target.checked));
  $('pvAlt').addEventListener('change', (e) => stage.classList.toggle('alt-held', e.target.checked));
  $('pvAghs').addEventListener('change', (e) => stage.classList.toggle('aghs-on', e.target.checked));
  $('pvNoItems').addEventListener('change', (e) => stage.classList.toggle('no-items', e.target.checked));
  $('pvHp').addEventListener('input', refreshStage);
  $('pvMp').addEventListener('input', refreshStage);
  $('pvRatio').addEventListener('change', () => view.refit());
  $('pvBg').addEventListener('click', () => $('pvBgFile').click());
  $('pvBgFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    stage.style.setProperty('--world', `url("${URL.createObjectURL(file)}")`);
    stage.classList.add('custom-world');
  });
  const center = () => [$('stageWrap').clientWidth / 2, $('stageWrap').clientHeight / 2];
  $('zoomIn').addEventListener('click', () => view.zoomAt(...center(), 1.4));
  $('zoomOut').addEventListener('click', () => view.zoomAt(...center(), 1 / 1.4));
  $('zoomFit').addEventListener('click', () => view.reset());
  const compare = $('compare');
  const setCompare = (on) => { comparing = on; compare.setAttribute('aria-pressed', String(on)); refreshStage(); };
  compare.addEventListener('pointerdown', () => setCompare(true));
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => compare.addEventListener(type, () => { if (comparing) setCompare(false); }));

  wireSplitter(prefs, () => view.refit());
  new ResizeObserver(() => view.refit()).observe($('stageWrap'));

  // Результаты перекраски, на которые не ссылается ни проект, ни сохранённые версии, больше не нужны.
  const keep = new Set([...imageIds(store.get()), ...versions.all().flatMap((v) => [...imageIds(v.values)])]);
  images.pruneTints(keep);

  panel.showGroup(lastGroup);
  nav.setActive(panel.view());
  setScene('game', true);
  view.refit();
  refreshStage();
  paintCounts();
  save();
  marks.highlight(null);
  document.body.classList.add('ready');
}

setupPage();
startMotion();
start();
