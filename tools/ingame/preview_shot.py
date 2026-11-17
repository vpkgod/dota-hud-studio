"""Снимок превью сайта ровно 1920×1080, пиксель в пиксель как экран игры.

Запуск (нужен playwright): python3 preview_shot.py <values.json> <out.png> [адрес сайта]
Сайт открывается в чистом браузере, настройки кладутся в его localStorage, у сцены убирается уменьшение под окно.
Инвентарь показывается пустым: у героя в демо-режиме предметов нет.
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

PROJECT_KEY = "hudstudio.project.v1"
# Блоки, которые сверяем с игрой: имя → селектор в превью.
BLOCKS = {
    "портрет": ".center .por", "способности": ".center .abilities", "полоски": ".center .bars",
    "инвентарь": ".center .inv", "круглые слоты": ".center .rounds", "кнопка талантов": ".center .talent", "врождённая": ".center .innate", "аганим": ".center .aghs",
    "мини-карта": ".mm-block", "верхняя панель": ".topbar", "магазин и золото": ".launch",
}
WIDTH, HEIGHT = 1920, 1080

UNSCALE = """() => {
  const stage = document.querySelector('.stage');
  const wrap = stage.parentElement;
  Object.assign(wrap.style, { position: 'fixed', left: '0', top: '0', width: '1920px', height: '1080px',
    zIndex: '99999', overflow: 'hidden', borderRadius: '0', margin: '0' });
  stage.style.transform = 'none';
  stage.classList.add('no-items');
  document.querySelectorAll('.stage-tip, .pv-hint').forEach((n) => n.remove());
  return stage.getBoundingClientRect().toJSON();
}"""


def main() -> None:
    values_path, out = sys.argv[1], sys.argv[2]
    url = sys.argv[3] if len(sys.argv) > 3 else "http://127.0.0.1:8770/?lang=ru"
    values = json.loads(open(values_path, encoding="utf8").read())
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(url)
        page.evaluate("([k, v]) => localStorage.setItem(k, JSON.stringify({ name: 'проверка', values: v }))",
                      [PROJECT_KEY, values])
        page.reload()
        page.wait_for_selector(".stage .center")
        page.wait_for_timeout(2500)  # шрифты и картинки
        if os.environ.get("HUDSTUDIO_SCENE") == "tree":  # ветка талантов, открытая кликом
            page.click("#scene-tree")
            page.click("#treePin")
            page.wait_for_timeout(500)
        box = page.evaluate(UNSCALE)
        page.wait_for_timeout(300)
        page.screenshot(path=out, clip={"x": box["x"], "y": box["y"], "width": WIDTH, "height": HEIGHT})
        rects = page.evaluate("""(blocks) => Object.fromEntries(Object.entries(blocks).map(([name, sel]) => {
          const el = document.querySelector(sel);
          if (!el || getComputedStyle(el).visibility === 'hidden') return [name, null];  // спрятан и на сайте
          const r = el.getBoundingClientRect();
          return [name, [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]];
        }))""", BLOCKS)
        with open(out.rsplit(".", 1)[0] + ".json", "w", encoding="utf8") as f:
            json.dump(rects, f, ensure_ascii=False, indent=1)
        browser.close()
    if errors:
        raise SystemExit("ошибки на странице: " + "; ".join(errors))
    print(f"превью: {out}")


if __name__ == "__main__":
    main()
