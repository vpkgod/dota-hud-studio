// Окно «Версии»: именованные сохранения проекта, к которым можно вернуться.
import { same } from './build/cssgen.js';
import { button, h, plural, iconButton } from './dom.js';
import { MAX_VERSIONS, addVersion, loadVersions, removeVersion } from './storage.js';
import { lang, t } from './i18n.js';

const timeText = (time) => new Date(time).toLocaleString(lang === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** apply(values) открывает версию в редакторе (с проверкой значений). */
export function createVersions({ dialog, store, controls, apply, toast }) {
  let versions = loadVersions();
  const changedIn = (values) => controls.filter((c) => c.id in values && !same(values[c.id], c.default)).length;

  function render() {
    const name = h('input', { class: 'text', placeholder: t('Например: красный, до правки магазина'), maxLength: 60, 'aria-label': t('Название версии') });
    const save = () => {
      const next = addVersion(versions, name.value.trim() || t('Версия от {time}', { time: timeText(Date.now()) }), store.get());
      if (!next) { toast(t('Не получилось сохранить версию: хранилище браузера заполнено или выключено.')); return; }
      versions = next;
      render();
    };
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });

    const list = versions.length
      ? h('ul', { class: 'versions' }, versions.map((version) => {
        const count = changedIn(version.values);
        const isCurrent = same(version.values, store.get());
        return h('li', { class: isCurrent ? 'current' : '' },
          h('div', {}, h('b', { text: version.name }),
            h('small', { text: `${timeText(version.time)} · ${count} ${plural(count, t('изменение'), t('изменения'), t('изменений'))}${isCurrent ? t(' · открыта сейчас') : ''}` })),
          button('ghost', t('Открыть'), () => {
            apply(version.values);
            toast(t('Открыта версия «{name}». Вернуться назад можно кнопкой «Отменить».', { name: version.name }));
            dialog.close();
          }, { disabled: isCurrent }),
          button('link', t('удалить'), () => {
            if (!window.confirm(t('Удалить версию «{name}»?', { name: version.name }))) return;
            versions = removeVersion(versions, version.id) || versions;
            render();
          }));
      }))
      : h('p', { class: 'note', text: t('Сохранённых версий пока нет.') });

    dialog.replaceChildren(
      h('header', { class: 'dialog-head' }, h('h2', { text: t('Версии') }), iconButton('close', t('Закрыть'), () => dialog.close())),
      h('div', { class: 'dialog-body' },
        h('p', { class: 'lead', text: t('Текущая работа сохраняется сама. Версия — это снимок худа, к которому можно вернуться: удобно перед большой переделкой.') }),
        h('div', { class: 'form-line' }, name, button('primary', t('Сохранить версию'), save)),
        list,
        h('p', { class: 'note', text: t('Версии лежат в этом браузере, не больше {max}. Чтобы перенести худ на другой компьютер, сохрани проект в файл (меню «Файл»).', { max: MAX_VERSIONS }) })));
  }

  return {
    open() { render(); if (!dialog.open) dialog.showModal(); },
    all: () => versions,
  };
}
