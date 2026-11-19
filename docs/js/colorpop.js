// Окошко выбора цвета: готовые цвета, свои цвета, любой цвет и прозрачность простым ползунком.
import { t } from './i18n.js';
import { addCustomColor, loadCustomColors } from './storage.js';
const PALETTE = ['#ffffff', '#c9ced8', '#6c7486', '#000000', '#ff4d4d', '#c8102e', '#ff8a3c', '#ffcc33',
  '#7ddc3a', '#2f9e44', '#1fd6a6', '#22c7f0', '#4165ce', '#7a5cff', '#c04dff', '#ff4fb5'];

let node = null;
let state = null;
let custom = [];
let customWrap = null;
let customRow = null;
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

function pick(color) {
  state.rgb = color;
  state.dirty = true;
  syncFields();
  emit();
}

function swatch(color) {
  const button = document.createElement('button');
  button.type = 'button';
  button.style.background = color;
  button.setAttribute('aria-label', color);
  button.addEventListener('click', () => pick(color));
  return button;
}

function remember(color) {
  const rgb = color.slice(0, 7).toLowerCase();
  if (PALETTE.includes(rgb) || custom.includes(rgb)) return;
  const next = addCustomColor(custom, rgb);
  if (!next) return;
  custom = next;
  renderCustom();
}

function renderCustom() {
  if (!customWrap) return;
  customRow.replaceChildren(...custom.map(swatch));
  customWrap.hidden = custom.length === 0;
}

function build() {
  node = document.createElement('div');
  node.className = 'color-pop';
  node.hidden = true;
  node.setAttribute('role', 'dialog');
  node.setAttribute('aria-label', t('Выбор цвета'));
  node.innerHTML = `
    <div class="pop-palette"></div>
    <div class="pop-custom" hidden>
      <span class="pop-caption">${t('Мои цвета')}</span>
      <div class="pop-palette"></div>
    </div>
    <label class="pop-line">${t('Любой цвет')} <input class="native" type="color"></label>
    <label class="pop-line">${t('Прозрачность')} <input class="alpha" type="range" min="0" max="255"></label>
    <label class="pop-line">${t('Код цвета')} <input class="hex" spellcheck="false"></label>
    <button type="button" class="pop-done">${t('Готово')}</button>`;
  node.querySelector('.pop-palette').append(...PALETTE.map(swatch));
  customWrap = node.querySelector('.pop-custom');
  customRow = customWrap.querySelector('.pop-palette');
  renderCustom();
  node.querySelector('.native').addEventListener('input', (e) => pick(e.target.value));
  node.querySelector('.native').addEventListener('change', (e) => remember(e.target.value));
  node.querySelector('.alpha').addEventListener('input', (e) => { state.alpha = 255 - Number(e.target.value); emit(); });
  node.querySelector('.hex').addEventListener('change', (e) => {
    const text = e.target.value.trim();
    if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(text)) { e.target.value = joinHex(state.rgb, state.alpha); return; }
    Object.assign(state, splitHex(text));
    state.dirty = true;
    syncFields();
    state.onChange(text);
    remember(text);
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
  if (state?.dirty) remember(state.rgb);
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
  custom = loadCustomColors();
  renderCustom();
  state = { ...splitHex(value), onChange, dirty: false };
  syncFields();
  node.hidden = false;
  const box = anchor.getBoundingClientRect();
  const left = Math.min(window.innerWidth - node.offsetWidth - 8, Math.max(8, box.left));
  const below = box.bottom + 6;
  const top = below + node.offsetHeight > window.innerHeight - 8 ? Math.max(8, box.top - node.offsetHeight - 6) : below;
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
}
