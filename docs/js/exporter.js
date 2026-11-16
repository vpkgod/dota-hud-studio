// Окно «Скачать худ»: сборка файла мода в браузере и понятная инструкция, куда его положить.
import { generate } from './build/cssgen.js';
import { BuildError, MAX_SLOT, MIN_SLOT, buildMod, validSlot, vpkName } from './build/mod.js';
import { button, h, plural, icon, iconButton } from './dom.js';
import { downloadBlob } from './project-file.js';

const DEFAULT_SLOT = 80;
const LANGUAGES = [
  ['russian', 'Русский'], ['ukrainian', 'Украинский'], ['english', 'English'], ['schinese', '简体中文'],
  ['koreana', '한국어'], ['spanish', 'Español'], ['brazilian', 'Português (Brasil)'], ['german', 'Deutsch'],
  ['french', 'Français'], ['polish', 'Polski'], ['turkish', 'Türkçe'],
];
const sizeText = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} КБ` : `${(bytes / 1024 / 1024).toFixed(1)} МБ`);

export function createExporter({ dialog, store, controls, images, game, prefs, changedCount }) {
  const styleCache = new Map();

  async function loadStyle(name) {
    if (!styleCache.has(name)) {
      const response = await fetch(`gamecss/${name}`);
      if (!response.ok) throw new BuildError(`Не удалось загрузить стиль игры ${name}. Проверь интернет и попробуй ещё раз.`);
      styleCache.set(name, await response.text());
    }
    return styleCache.get(name);
  }

  function render() {
    const count = changedCount();
    const saved = prefs.get();
    const slot = h('input', { type: 'number', class: 'numbox', min: MIN_SLOT, max: MAX_SLOT, value: saved.slot || DEFAULT_SLOT, 'aria-label': 'Номер файла' });
    const language = h('select', { 'aria-label': 'Язык игры' }, LANGUAGES.map(([id, title]) => h('option', { value: id, text: title, selected: id === (saved.language || 'russian') })));
    const fileName = h('code');
    const folders = [h('code'), h('code')];
    const status = h('p', { class: 'status', role: 'status' });
    const result = h('div', { class: 'result', hidden: true });
    const go = button('primary big', '', build, { disabled: !count });

    function paintNames() {
      const n = Number(slot.value);
      const name = validSlot(n) ? vpkName(n) : 'pak??_dir.vpk';
      fileName.textContent = name;
      go.textContent = `Собрать и скачать ${name}`;
      folders.forEach((node) => { node.textContent = `game/dota_${language.value}`; });
      prefs.set({ slot: validSlot(n) ? n : DEFAULT_SLOT, language: language.value });
    }
    slot.addEventListener('input', paintNames);
    language.addEventListener('change', paintNames);

    async function build() {
      const n = Number(slot.value);
      go.disabled = true;
      status.className = 'status';
      status.textContent = 'Собираю худ…';
      try {
        const mod = await buildMod({ controls, values: store.get(), slot: n, loadStyle, loadPng: images.bytes });
        downloadBlob(mod.name, new Blob([mod.bytes], { type: 'application/octet-stream' }));
        status.className = 'status good';
        status.textContent = `Готово: ${mod.name}, ${sizeText(mod.bytes.length)}. Файл ушёл в папку загрузок.`;
        result.hidden = false;
        result.replaceChildren(h('details', {}, h('summary', { text: `Что внутри файла (${mod.files.length})` }),
          h('ul', { class: 'files' }, mod.files.map((f) => h('li', {}, h('code', { text: f.path }), ` ${sizeText(f.size)}`)))));
      } catch (error) {
        status.className = 'status bad';
        status.textContent = error instanceof BuildError ? error.message : 'Не получилось собрать худ. Обнови страницу и попробуй ещё раз.';
        if (!(error instanceof BuildError)) console.error(error);
      } finally {
        go.disabled = !changedCount();
      }
    }

    const css = h('pre', { class: 'code', hidden: true });
    const showCss = button('link', 'показать правила CSS, которые получились', () => {
      css.hidden = !css.hidden;
      const files = Object.entries(generate(controls, store.get()));
      css.textContent = files.length ? files.map(([name, text]) => `/* ${name} */\n${text}`).join('\n') : 'Пока ничего не изменено.';
    });

    dialog.replaceChildren(
      h('header', { class: 'dialog-head' }, h('h2', { text: 'Скачать худ' }), iconButton('close', 'Закрыть', () => dialog.close())),
      h('div', { class: 'dialog-body' },
        h('p', { class: 'lead', text: count
          ? `В худе ${count} ${plural(count, 'изменённая настройка', 'изменённые настройки', 'изменённых настроек')}. Сайт соберёт один файл прямо в браузере: ничего никуда не отправляется.`
          : 'Пока ничего не изменено, поэтому собирать нечего. Закрой окно и измени что-нибудь в худе.' }),
        h('div', { class: 'form' },
          h('label', {}, h('span', { text: 'Язык твоей Dota 2' }), language),
          h('label', {}, h('span', { text: 'Номер файла' }), slot),
          h('p', { class: 'note' }, 'Игра читает файлы из папки своего языка: ', folders[0],
            '. Номер нужен, чтобы имя не совпало с другим модом: если в папке уже лежит файл с таким номером, выбери другой.')),
        go, status, result,
        h('section', { class: 'steps' },
          h('h3', {}, h('i', { class: 'marker' }, icon('download')), 'Как поставить'),
          h('ol', {},
            h('li', { text: 'В Steam нажми правой кнопкой на Dota 2 → «Управление» → «Просмотреть локальные файлы».' }),
            h('li', {}, 'Открой папку ', folders[1], '. Если её нет, создай.'),
            h('li', {}, 'Положи туда скачанный файл ', fileName, '. Имя менять нельзя.'),
            h('li', { text: 'Перезапусти Dota 2.' })),
          h('p', { class: 'note', text: 'Убрать худ: удали этот файл и перезапусти игру. Оригинальные файлы Dota не меняются.' }),
          h('p', { class: 'note', text: `Худ собран на файлах Dota сборки ${game.build || '?'} (${game.date || 'дата неизвестна'}). После крупного обновления игры собери его заново, иначе часть интерфейса может выглядеть по-старому. Проверено на русской Dota; с английским языком игра может не читать папку языка.` })),
        showCss, css));
    paintNames();
  }

  return {
    open() {
      render();
      if (!dialog.open) dialog.showModal();
    },
  };
}
