// Окно «Скачать худ»: сборка файла мода в браузере и понятная инструкция, куда его положить.
import { generate } from './build/cssgen.js';
import { BuildError, MAX_SLOT, MIN_SLOT, buildMod, validSlot, vpkName } from './build/mod.js';
import { button, h, icon, iconButton } from './dom.js';
import { lang, plural, t } from './i18n.js';
import { downloadBlob } from './project-file.js';

const DEFAULT_SLOT = 80;
const LANGUAGES = [
  ['russian', t('Русский')], ['ukrainian', t('Украинский')], ['english', 'English'], ['schinese', '简体中文'],
  ['koreana', '한국어'], ['spanish', 'Español'], ['brazilian', 'Português (Brasil)'], ['german', 'Deutsch'],
  ['french', 'Français'], ['polish', 'Polski'], ['turkish', 'Türkçe'],
];
const sizeText = (bytes) => (bytes < 1024 * 1024 ? t('{n} КБ', { n: Math.max(1, Math.round(bytes / 1024)) }) : t('{n} МБ', { n: (bytes / 1024 / 1024).toFixed(1) }));

export function createExporter({ dialog, store, controls, images, game, sizes = {}, prefs, changedCount }) {
  const styleCache = new Map();

  async function loadLayout(path) {
    // Готовую разметку собирает python3 -m hudstudio.layout и кладёт в docs/layout/.
    const response = await fetch(`layout/${path.split('/').pop()}.vxml_c`);
    if (!response.ok) throw new BuildError(t('Не удалось загрузить разметку худа для видео. Проверь интернет и попробуй ещё раз.'));
    return new Uint8Array(await response.arrayBuffer());
  }

  async function loadStyle(name) {
    if (!styleCache.has(name)) {
      const response = await fetch(`gamecss/${name}`);
      if (!response.ok) throw new BuildError(t('Не удалось загрузить стиль игры {name}. Проверь интернет и попробуй ещё раз.', { name }));
      styleCache.set(name, await response.text());
    }
    return styleCache.get(name);
  }

  function render() {
    const count = changedCount();
    const hasVideo = controls.some((c) => c.type === 'video' && store.get()[c.id]);
    const saved = prefs.get();
    const slot = h('input', { type: 'number', class: 'numbox', min: MIN_SLOT, max: MAX_SLOT, value: saved.slot || DEFAULT_SLOT, 'aria-label': t('Номер файла') });
    const language = h('select', { 'aria-label': t('Язык игры') }, LANGUAGES.map(([id, title]) => h('option', { value: id, text: title, selected: id === (saved.language || (lang === 'en' ? 'english' : 'russian')) })));
    const fileName = h('code');
    const folders = [h('code'), h('code')];
    const launch = h('code');
    const status = h('p', { class: 'status', role: 'status' });
    const result = h('div', { class: 'result', hidden: true });
    const go = button('primary big', '', build, { disabled: !count });

    function paintNames() {
      const n = Number(slot.value);
      const name = validSlot(n) ? vpkName(n) : 'pak??_dir.vpk';
      fileName.textContent = name;
      go.textContent = t('Собрать и скачать {name}', { name });
      folders.forEach((node) => { node.textContent = `game/dota_${language.value}`; });
      launch.textContent = `-language ${language.value}`;
      prefs.set({ slot: validSlot(n) ? n : DEFAULT_SLOT, language: language.value });
    }
    slot.addEventListener('input', paintNames);
    language.addEventListener('change', paintNames);

    async function build() {
      const n = Number(slot.value);
      go.disabled = true;
      status.className = 'status';
      status.textContent = t('Собираю худ…');
      try {
        const mod = await buildMod({ controls, values: store.get(), slot: n, loadStyle, loadPng: images.bytes, loadVideo: images.bytes, loadLayout, sizes });
        downloadBlob(mod.name, new Blob([mod.bytes], { type: 'application/octet-stream' }));
        status.className = 'status good';
        status.textContent = t('Готово: {name}, {size}. Файл ушёл в папку загрузок.', { name: mod.name, size: sizeText(mod.bytes.length) });
        result.hidden = false;
        result.replaceChildren(h('details', {}, h('summary', { text: t('Что внутри файла ({n})', { n: mod.files.length }) }),
          h('ul', { class: 'files' }, mod.files.map((f) => h('li', {}, h('code', { text: f.path }), ` ${sizeText(f.size)}`)))));
      } catch (error) {
        status.className = 'status bad';
        status.textContent = error instanceof BuildError ? t(error.message) : t('Не получилось собрать худ. Обнови страницу и попробуй ещё раз.');
        if (!(error instanceof BuildError)) console.error(error);
      } finally {
        go.disabled = !changedCount();
      }
    }

    const css = h('pre', { class: 'code', hidden: true });
    const showCss = button('link', t('показать правила CSS, которые получились'), () => {
      css.hidden = !css.hidden;
      const files = Object.entries(generate(controls, store.get()));
      css.textContent = files.length ? files.map(([name, text]) => `/* ${name} */\n${text}`).join('\n') : t('Пока ничего не изменено.');
    });

    dialog.replaceChildren(
      h('header', { class: 'dialog-head' }, h('h2', { text: t('Скачать худ') }), iconButton('close', t('Закрыть'), () => dialog.close())),
      h('div', { class: 'dialog-body' },
        h('p', { class: 'lead', text: count
          ? t('В худе {count}. Сайт соберёт один файл прямо в браузере: ничего никуда не отправляется.', { count: `${count} ${plural(count, t('изменённая настройка'), t('изменённые настройки'), t('изменённых настроек'))}` })
          : t('Пока ничего не изменено, поэтому собирать нечего. Закрой окно и измени что-нибудь в худе.') }),
        h('div', { class: 'form' },
          h('label', {}, h('span', { text: t('Язык твоей Dota 2') }), language),
          h('label', {}, h('span', { text: t('Номер файла') }), slot),
          h('p', { class: 'note' }, t('Игра читает файлы из папки своего языка: '), folders[0],
            t('. Номер нужен, чтобы имя не совпало с другим модом: если в папке уже лежит файл с таким номером, выбери другой.'))),
        go, status, result,
        h('section', { class: 'steps' },
          h('h3', {}, h('i', { class: 'marker' }, icon('download')), t('Как поставить')),
          h('ol', {},
            h('li', { text: t('В Steam нажми правой кнопкой на Dota 2 → «Управление» → «Просмотреть локальные файлы».') }),
            h('li', {}, t('Открой папку '), folders[1], t('. Если её нет, создай.')),
            h('li', {}, t('Положи туда скачанный файл '), fileName, t('. Имя менять нельзя.')),
            h('li', { text: t('Перезапусти Dota 2.') })),
          h('p', { class: 'note' }, t('Худ не появился? Игра подключает папку языка, только когда запущена с этим языком. В Steam: Dota 2 → «Свойства» → «Параметры запуска», допиши '), launch, t(' и перезапусти игру.')),
          h('p', { class: 'note', text: t('Убрать худ: удали этот файл и перезапусти игру. Оригинальные файлы Dota не меняются.') }),
          h('p', { class: 'note', text: t('Худ собран на файлах Dota сборки {build} ({date}). После крупного обновления игры собери его заново, иначе часть интерфейса может выглядеть по-старому.', { build: game.build || '?', date: game.date || t('дата неизвестна') }) }),
          hasVideo ? h('p', { class: 'note', text: t('С видео в портрете мод заменяет весь нижний худ игры. Если после обновления Dota худ сломался, удали файл и собери его заново, когда сайт обновится.') }) : null),
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
