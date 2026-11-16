// Окошко выбора цвета: готовые цвета, любой цвет и прозрачность простым ползунком.
const PALETTE = ['#ffffff', '#c9ced8', '#6c7486', '#000000', '#ff4d4d', '#c8102e', '#ff8a3c', '#ffcc33',
  '#7ddc3a', '#2f9e44', '#1fd6a6', '#22c7f0', '#4165ce', '#7a5cff', '#c04dff', '#ff4fb5'];

let node = null;
let state = null;
let afterClose = () => {};

function splitHex(hex) {
  return { rgb: hex.slice(0, 7).toLowerCase(), alpha: hex.length === 9 ? parseInt(hex.slice(7), 16) : 255 };
}

const joinHex = (rgb, alpha) => (alpha >= 255 ? rgb : rgb + Math.round(alpha).toString(16).padStart(2, '0'));

function emit() {
  const value = joinHex(state.rgb, state.alpha);
  node.querySelector('.hex').value = value;
  state.onChange(value);
}

function build() {
  node = document.createElement('div');
  node.className = 'color-pop';
  node.hidden = true;
  node.setAttribute('role', 'dialog');
  node.setAttribute('aria-label', 'Выбор цвета');
  node.innerHTML = `
    <div class="pop-palette"></div>
    <label class="pop-line">Любой цвет <input class="native" type="color"></label>
    <label class="pop-line">Прозрачность <input class="alpha" type="range" min="0" max="255"></label>
    <label class="pop-line">Код цвета <input class="hex" spellcheck="false"></label>
    <button type="button" class="pop-done">Готово</button>`;
  node.querySelector('.pop-palette').append(...PALETTE.map((color) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.style.background = color;
    button.setAttribute('aria-label', color);
    button.addEventListener('click', () => { state.rgb = color; syncFields(); emit(); });
    return button;
  }));
  node.querySelector('.native').addEventListener('input', (e) => { state.rgb = e.target.value; emit(); });
  node.querySelector('.alpha').addEventListener('input', (e) => { state.alpha = 255 - Number(e.target.value); emit(); });
  node.querySelector('.hex').addEventListener('change', (e) => {
    const text = e.target.value.trim();
    if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(text)) { e.target.value = joinHex(state.rgb, state.alpha); return; }
    Object.assign(state, splitHex(text));
    syncFields();
    state.onChange(text);
  });
  node.querySelector('.pop-done').addEventListener('click', closeColorPop);
  document.body.append(node);
  document.addEventListener('pointerdown', (e) => {
    if (state && !node.contains(e.target)) closeColorPop();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state) closeColorPop(); });
}

function syncFields() {
  node.querySelector('.native').value = state.rgb;
  node.querySelector('.alpha').value = 255 - state.alpha;
  node.querySelector('.hex').value = joinHex(state.rgb, state.alpha);
}

export function closeColorPop() {
  if (node) node.hidden = true;
  state = null;
  afterClose();
}

export function onColorPopClose(callback) {
  afterClose = callback;
}

export function isColorPopOpen() {
  return state !== null;
}

export function openColorPop(anchor, value, onChange) {
  if (!node) build();
  state = { ...splitHex(value), onChange };
  syncFields();
  node.hidden = false;
  const box = anchor.getBoundingClientRect();
  const left = Math.min(window.innerWidth - node.offsetWidth - 8, Math.max(8, box.left));
  const below = box.bottom + 6;
  const top = below + node.offsetHeight > window.innerHeight - 8 ? Math.max(8, box.top - node.offsetHeight - 6) : below;
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
}
