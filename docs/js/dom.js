// Короткая запись для создания элементов страницы.
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'data') Object.assign(node.dataset, value);
    else if (key === 'style') Object.assign(node.style, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key in node && key !== 'list') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

export const button = (cls, text, onclick, props = {}) => h('button', { type: 'button', class: cls, text, onclick, ...props });

export function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

export const plural = (n, one, few, many) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

const SVG = 'http://www.w3.org/2000/svg';
/** Иконка из набора Material Symbols (img/icons.svg). */
export function icon(name, cls = '') {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', cls ? `ic ${cls}` : 'ic');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG, 'use');
  use.setAttribute('href', `img/icons.svg#i-${name}`);
  svg.append(use);
  return svg;
}

/** Кнопка из одной иконки; подпись — для экранного диктора и подсказки. */
export function iconButton(name, label, onclick, cls = 'icon') {
  const node = button(cls, '', onclick, { 'aria-label': label, title: label });
  node.append(icon(name));
  return node;
}
