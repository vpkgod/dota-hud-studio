// Окно «Версии»: именованные сохранения проекта, к которым можно вернуться.
import { same } from './build/cssgen.js';
import { button, h, plural, iconButton } from './dom.js';
import { MAX_VERSIONS, addVersion, loadVersions, removeVersion } from './storage.js';

const timeText = (time) => new Date(time).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** apply(values) открывает версию в редакторе (с проверкой значений). */
export function createVersions({ dialog, store, controls, apply, toast }) {
  let versions = loadVersions();
  const changedIn = (values) => controls.filter((c) => c.id in values && !same(values[c.id], c.default)).length;

  function render() {
    const name = h('input', { class: 'text', placeholder: 'Например: красный, до правки магазина', maxLength: 60, 'aria-label': 'Название версии' });
    const save = () => {
      const next = addVersion(versions, name.value.trim() || `Версия от ${timeText(Date.now())}`, store.get());
      if (!next) { toast('Не получилось сохранить версию: хранилище браузера заполнено или выключено.'); return; }
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
            h('small', { text: `${timeText(version.time)} · ${count} ${plural(count, 'изменение', 'изменения', 'изменений')}${isCurrent ? ' · открыта сейчас' : ''}` })),
          button('ghost', 'Открыть', () => {
            apply(version.values);
            toast(`Открыта версия «${version.name}». Вернуться назад можно кнопкой «Отменить».`);
            dialog.close();
          }, { disabled: isCurrent }),
          button('link', 'удалить', () => {
            if (!window.confirm(`Удалить версию «${version.name}»?`)) return;
            versions = removeVersion(versions, version.id) || versions;
            render();
          }));
      }))
      : h('p', { class: 'note', text: 'Сохранённых версий пока нет.' });

    dialog.replaceChildren(
      h('header', { class: 'dialog-head' }, h('h2', { text: 'Версии' }), iconButton('close', 'Закрыть', () => dialog.close())),
      h('div', { class: 'dialog-body' },
        h('p', { class: 'lead', text: 'Текущая работа сохраняется сама. Версия — это снимок худа, к которому можно вернуться: удобно перед большой переделкой.' }),
        h('div', { class: 'form-line' }, name, button('primary', 'Сохранить версию', save)),
        list,
        h('p', { class: 'note', text: `Версии лежат в этом браузере, не больше ${MAX_VERSIONS}. Чтобы перенести худ на другой компьютер, сохрани проект в файл (меню «Файл»).` })));
  }

  return {
    open() { render(); if (!dialog.open) dialog.showModal(); },
    all: () => versions,
  };
}
