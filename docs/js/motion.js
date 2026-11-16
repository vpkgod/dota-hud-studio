// Отклик интерфейса в духе Material 3: волна от точки нажатия на кнопке и закрашенная часть ползунка.
// Только оформление: на данные худа не влияет.

const RIPPLE_SCALE = 2.2;

function ripple(event) {
  const target = event.target.closest('button');
  if (!target || target.disabled || target.closest('.stage')) return;
  const box = target.getBoundingClientRect();
  target.style.setProperty('--rx', `${event.clientX - box.left}px`);
  target.style.setProperty('--ry', `${event.clientY - box.top}px`);
  target.style.setProperty('--rs', `${Math.max(box.width, box.height) * RIPPLE_SCALE}px`);
  target.classList.remove('rippling');
  void target.offsetWidth;
  target.classList.add('rippling');
}

/** Доля заполнения ползунка в переменную --fill (Chromium сам её не рисует). */
export function paintRange(input) {
  if (!(input instanceof HTMLInputElement) || input.type !== 'range') return;
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const share = max > min ? (Number(input.value) - min) / (max - min) : 0;
  input.style.setProperty('--fill', `${Math.min(100, Math.max(0, share * 100))}%`);
}

/** Значение ползунка меняется и из кода (сброс, отмена) — ловим и такие записи. */
function watchRangeValues() {
  const proto = HTMLInputElement.prototype;
  const own = Object.getOwnPropertyDescriptor(proto, 'value');
  if (!own || !own.set) return;
  Object.defineProperty(proto, 'value', {
    ...own,
    set(next) {
      own.set.call(this, next);
      if (this.type === 'range') paintRange(this);
    },
  });
}

export function startMotion() {
  document.addEventListener('pointerdown', ripple, { passive: true });
  document.addEventListener('animationend', (event) => {
    if (event.animationName === 'ripple') event.target.classList.remove('rippling');
  });
  watchRangeValues();
  document.addEventListener('input', (event) => paintRange(event.target), true);
  const paintAll = (root) => root.querySelectorAll?.('input[type=range]').forEach(paintRange);
  paintAll(document);
  new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach((n) => {
    if (n.nodeType !== 1) return;
    paintRange(n);
    paintAll(n);
  }))).observe(document.body, { childList: true, subtree: true });
}
