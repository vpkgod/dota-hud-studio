// Язык сайта: русский (исходный текст) или английский (словарь lang/en.js).
// Ключ словаря — сама русская строка, поэтому без перевода показывается русский текст, а не пустота.
import EN from './lang/en.js';

export const LANGS = ['ru', 'en'];
const PREFS_KEY = 'hudstudio.prefs.v1';
const RU_FAMILY = ['ru', 'uk', 'be', 'kk', 'ky', 'uz', 'tg', 'hy', 'az', 'ka'];
const DICTS = { ru: null, en: EN };

function savedLang() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(PREFS_KEY) || '{}').lang;
  } catch {
    return undefined;
  }
}

/** Порядок: ?lang= в адресе → выбор человека → язык браузера. Вне браузера (тесты) — русский. */
export function detectLang({ search = '', saved, languages = [] } = {}) {
  const fromUrl = new URLSearchParams(search).get('lang');
  if (LANGS.includes(fromUrl)) return fromUrl;
  if (LANGS.includes(saved)) return saved;
  if (!languages.length) return 'ru';
  const first = String(languages[0]).toLowerCase().split('-')[0];
  return RU_FAMILY.includes(first) ? 'ru' : 'en';
}

const inBrowser = typeof document !== 'undefined';
export const lang = inBrowser
  ? detectLang({ search: location.search, saved: savedLang(), languages: navigator.languages || [navigator.language] })
  : 'ru';
const dict = DICTS[lang];

/** t('Готово: {n}', { n: 3 }) → строка на языке сайта с подставленными значениями. */
export function t(text, vars) {
  const out = (dict && dict[text]) || text;
  return vars ? out.replace(/\{(\w+)\}/g, (all, key) => (key in vars ? String(vars[key]) : all)) : out;
}

/** Склонение по числу: русские три формы; в английском — одна или много. */
export function plural(n, one, few, many) {
  if (lang === 'en') return t(n === 1 ? one : many);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Сменить язык: запомнить выбор и перезагрузить страницу (проект хранится в браузере и не теряется). */
export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...prefs, lang: next }));
  } catch { /* без хранилища язык держится только через адрес */ }
  const url = new URL(location.href);
  url.searchParams.set('lang', next);
  location.replace(url.href);
}

const ATTRS = ['title', 'aria-label', 'placeholder', 'content'];
const CYRILLIC = /[а-яё]/i;

/** Перевести статичную разметку: текст элементов и подписи в атрибутах. Пробелы по краям сохраняются. */
export function translateDom(root) {
  if (!dict) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const raw = node.nodeValue;
    const key = raw.trim();
    if (key && CYRILLIC.test(key) && dict[key]) node.nodeValue = raw.replace(key, dict[key]);
  }
  root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(',')).forEach((el) => {
    ATTRS.forEach((a) => {
      const value = el.getAttribute(a);
      if (value && CYRILLIC.test(value) && dict[value]) el.setAttribute(a, dict[value]);
    });
  });
}

/** Заголовок страницы, язык документа и переключатель RU / EN. */
export function setupPage() {
  document.documentElement.lang = lang;
  document.title = t(document.title);
  translateDom(document.head);
  translateDom(document.body);
  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.lang === lang));
    button.addEventListener('click', () => setLang(button.dataset.lang));
  });
}

const CATALOG_TEXT = ['title', 'about', 'label', 'sub', 'hint'];
const pick = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, CATALOG_TEXT.includes(k) && typeof v === 'string' ? t(v) : v]));

/** Каталог настроек на языке сайта. Возвращает новый объект, исходный не меняется. */
export function translateCatalog(data) {
  if (!dict) return data;
  const shop = data.preview?.shop;
  const titled = (list) => (list || []).map((s) => ({ ...s, title: t(s.title) }));
  return {
    ...data,
    areas: data.areas.map(pick),
    groups: data.groups.map((g) => ({ ...pick(g), controls: g.controls.map(pick) })),
    preview: shop
      ? { ...data.preview, shop: { ...shop, basics: titled(shop.basics), upgrades: titled(shop.upgrades), guide: titled(shop.guide) } }
      : data.preview,
  };
}
