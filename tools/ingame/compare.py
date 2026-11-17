"""Сравнение игры с превью: встал ли каждый блок худа в игре туда же, куда на сайте.

Запуск (нужен opencv):
    python3 compare.py <игра_без_мода.png> <игра_с_модом.png> <превью_без.png> <превью_с.png> <отчёт.png>
Рядом с каждым снимком превью лежит .json с прямоугольниками блоков (его пишет preview_shot.py).

Как считаем. Превью без настроек совпадает с игрой без мода (проверено: ±2 px), поэтому место блока
в обычной игре берём из превью. Блок вырезаем из скриншота игры без мода — так содержимое всегда своё,
игровое (3D-портрет, мини-карта демо), — и ищем его на скриншоте игры с модом рядом с тем местом,
где он стоит в превью с настройками. Если блок уменьшен, образец уменьшаем так же.
Найденное место минус место в превью — расхождение; больше TOLERANCE — ошибка.
"""
import json
import sys

import cv2

SEARCH = 90  # насколько далеко от места в превью искать блок в игре, px
TOLERANCE = 4  # допустимое расхождение, px
MIN_SCORE = 0.55  # ниже — совпадение слабое: блок полупрозрачный или на другом фоне
WEAK_SCORE = 0.35  # ниже — блок в игре не найден (спрятан, не нарисован или выглядит иначе)


def rects(path):
    return json.load(open(path.rsplit(".", 1)[0] + ".json", encoding="utf8"))


def inside(rect, image):
    x, y, w, h = rect
    height, width = image.shape[:2]
    return x >= 0 and y >= 0 and x + w <= width and y + h <= height and w > 8 and h > 8


def edges(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return cv2.GaussianBlur(cv2.Canny(gray, 60, 160), (3, 3), 0)


def locate(image, template, x, y):
    """Лучшее место образца в окне вокруг (x, y): (x, y, похожесть)."""
    h, w = template.shape[:2]
    height, width = image.shape[:2]
    x0, y0 = max(0, x - SEARCH), max(0, y - SEARCH)
    x1, y1 = min(width, x + w + SEARCH), min(height, y + h + SEARCH)
    area = image[y0:y1, x0:x1]
    if area.shape[0] < h or area.shape[1] < w:
        return None
    _, score, _, (bx, by) = cv2.minMaxLoc(cv2.matchTemplate(area, template, cv2.TM_CCOEFF_NORMED))
    return bx + x0, by + y0, float(score)


INSET = 0.12  # отрезаем края блока: при сдвиге вокруг него другой фон (панель → трава)


def compare(game_base, game_mod, base_rects, mod_rects):
    """[(блок, расхождение по x, по y, похожесть, прямоугольник в превью)]."""
    height, width = game_mod.shape[:2]
    rows = []
    for name, before in base_rects.items():
        after = mod_rects.get(name)
        if before and not after:
            print(f"· {name}: на сайте спрятан (так же, как в игре) — не сравниваем")
            continue
        if not before or not after or not inside(before, game_base):
            continue
        x, y, w, h = before
        template = game_base[y:y + h, x:x + w]
        ratio = after[2] / w  # блок уменьшен или увеличен — превью это уже показывает
        if abs(ratio - 1) > 0.01:
            template = cv2.resize(template, (max(8, after[2]), max(8, after[3])), interpolation=cv2.INTER_AREA)
        th, tw = template.shape[:2]
        # Середина блока: без краёв, и только то, что после сдвига осталось на экране.
        left, top = round(tw * INSET), round(th * INSET)
        right = min(tw - round(tw * INSET), width - after[0])
        bottom = min(th - round(th * INSET), height - after[1])
        left, top = max(left, -after[0]), max(top, -after[1])
        if right - left < 8 or bottom - top < 8:
            continue
        part = template[top:bottom, left:right]
        found = locate(game_mod, part, after[0] + left, after[1] + top)
        if not found or found[2] < MIN_SCORE:  # полупрозрачный блок на другом фоне: ищем ещё и по контурам
            by_edges = locate(edges(game_mod), edges(part), after[0] + left, after[1] + top)
            if by_edges and (not found or by_edges[2] > found[2]):
                found = by_edges
        if not found or found[2] < WEAK_SCORE:
            rows.append((name, None, None, found[2] if found else 0.0, after))
            continue
        rows.append((name, found[0] - left - after[0], found[1] - top - after[1], found[2], after))
    return rows


def main() -> None:
    game_base_path, game_mod_path, prev_base_path, prev_mod_path, out_path = sys.argv[1:6]
    game_base, game_mod = cv2.imread(game_base_path), cv2.imread(game_mod_path)
    rows = compare(game_base, game_mod, rects(prev_base_path), rects(prev_mod_path))
    picture = game_mod.copy()
    bad = 0
    for name, dx, dy, score, (x, y, w, h) in rows:
        cv2.rectangle(picture, (x, y), (x + w, y + h), (80, 220, 80), 2)  # зелёное — где блок в превью
        if dx is None:
            bad += 1
            print(f"✗ {name}: в игре не найден там, где он на сайте (похожесть {score:.2f})")
            continue
        cv2.rectangle(picture, (x + dx, y + dy), (x + dx + w, y + dy + h), (60, 60, 255), 2)  # красное — в игре
        ok = abs(dx) <= TOLERANCE and abs(dy) <= TOLERANCE
        bad += not ok
        weak = " — совпадение слабое, проверьте глазами" if score < MIN_SCORE else ""
        print(f"{'✓' if ok else '✗'} {name}: в игре {dx:+d}, {dy:+d} px от места на сайте (похожесть {score:.2f}){weak}")
    cv2.imwrite(out_path, picture)
    print(f"\nрасхождений: {bad}. Картинка: {out_path} (зелёное — сайт, красное — игра)")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
