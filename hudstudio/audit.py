"""Проверка по файлам игры: где превью может разойтись с Dota.

Ищет два вида ошибок, которые уже встречались:
1. Соседи блока. Сайт двигает панель, а рядом в игре стоит отдельная панель, которая на экране выглядит
   частью блока (цифры урона у портрета, значок тира, подсказка таланта). Она останется на месте.
2. Цвет под картинкой. Настройка делает картинку прозрачной, а у панели в игре есть ещё и цвет фона
   (#inventory_items: #211) — панель остаётся тёмной.

Запуск: python3 -m hudstudio.audit  (нужен кэш игры в cache/, его создаёт export).
"""
import re
import xml.etree.ElementTree as ET
from pathlib import Path

from . import catalog
from .config import load_config

CENTER_WIDTH = 940  # ширина нижней панели у героя с 4 способностями, как в превью
SCREEN = (1920, 1080)
MIN_OVERLAP = 0.25  # доля площади меньшей панели, начиная с которой соседей считаем «одним блоком»
BASE_PREFIXES = ("", ".Reborn ")
# Панели, которые и в игре, и в превью остаются на месте, когда двигают блок: это общий фон и украшения
# нижней панели, у них свои настройки. XP-круг скина относится к значку уровня, а не к портрету.
KNOWN_STATIC = {"center_bg", "left_flare", "right_flare", "RecommendedUpgradeOverlay", "HUDSkinXPBackground"}


def _latest(cache: Path) -> Path:
    roots = sorted(p.parent for p in cache.glob("*/panorama/styles"))  # только кэш игры, не снимки проверки
    if not roots:
        raise SystemExit("Нет кэша игры: сначала python3 -m hudstudio.export")
    return roots[-1]


def _rules(styles: Path) -> list:
    """[(селектор, {свойство: значение})] из всех стилей худа, по порядку."""
    out = []
    for path in sorted(styles.rglob("*.css")):
        text = re.sub(r"/\*.*?\*/", "", path.read_text("utf8", "replace"), flags=re.S)
        for sel, body in re.findall(r"([^{}@]+)\{([^{}]*)\}", text):
            decls = {}
            for part in body.split(";"):
                name, _, value = part.partition(":")
                if value:
                    decls[name.strip()] = value.strip()
            for one in sel.split(","):
                out.append((" ".join(one.split()), decls, path.name))
    return out


def _base_style(rules, pid: str) -> dict:
    """Свойства панели в обычном состоянии: правила «#id» и «.Reborn #id», последнее побеждает."""
    style = {}
    for sel, decls, _ in rules:
        if sel in {f"{p}#{pid}" for p in BASE_PREFIXES}:
            style.update(decls)
    return style


def _px(value, whole):
    if not value:
        return None
    value = value.split()[0]
    if value.endswith("px"):
        try:
            return float(value[:-2])
        except ValueError:
            return None
    if value.endswith("%"):
        return whole * float(value[:-1]) / 100
    return None


def _box(style: dict, parent: tuple):
    """Прямоугольник панели внутри родителя (x, y, ширина, высота) или None, если размер не задан числом."""
    pw, ph = parent
    w, h = _px(style.get("width"), pw), _px(style.get("height"), ph)
    if w is None or h is None:
        return None
    margin = lambda side: _px(style.get(f"margin-{side}"), pw) or 0
    align_x, align_y = style.get("horizontal-align", "left"), style.get("vertical-align", "top")
    x = {"right": pw - w - margin("right"), "center": (pw - w) / 2}.get(align_x, margin("left"))
    y = {"bottom": ph - h - margin("bottom"), "center": (ph - h) / 2, "middle": (ph - h) / 2}.get(align_y, margin("top"))
    return (x, y, w, h)


def _overlap(a, b) -> float:
    dx = min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0])
    dy = min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1])
    if dx <= 0 or dy <= 0:
        return 0.0
    return dx * dy / min(a[2] * a[3], b[2] * b[3])


def _layouts(layout_root: Path) -> dict:
    """{id панели: (элемент, родитель, файл)} по всем layout худа."""
    found = {}
    for path in sorted(layout_root.rglob("*.xml")):
        try:
            tree = ET.parse(path)
        except ET.ParseError:
            continue
        parents = {child: parent for parent in tree.iter() for child in parent}
        for node in tree.iter():
            pid = node.get("id")
            if pid and pid not in found:
                found[pid] = (node, parents.get(node), path.name)
    return found


def _moved_ids() -> dict:
    """{id панели: [настройки]} — всё, что сайт двигает или масштабирует."""
    moved = {}
    for cid, control in catalog.controls().items():
        if control["type"] != "offset" and not cid.endswith(".scale"):
            continue
        for target in control["emit"]:
            for sel in target["sel"]:
                for pid in re.findall(r"#([\w-]+)", sel.split()[-1]):
                    moved.setdefault(pid, []).append(cid)
    return moved


def neighbours(rules, panels, moved) -> list:
    """Панели-соседи, которые на экране накрывают двигаемый блок, но сами не двигаются."""
    report = []
    for pid, controls in sorted(moved.items()):
        if pid not in panels:
            continue
        node, parent, layout = panels[pid]
        if parent is None:
            continue
        size = (CENTER_WIDTH, 436) if parent.get("id") == "center_block" else SCREEN
        mine = _box(_base_style(rules, pid), size)
        if not mine:
            continue
        for sibling in parent:
            sid = sibling.get("id")
            candidates = [sibling]
            sstyle = _base_style(rules, sid) if sid else {}
            # Панель во весь родитель (#unitbadge) сама ничего не рисует: смотрим её детей.
            if sstyle.get("width") == "100%" and sstyle.get("height") == "100%":
                candidates = list(sibling)
            for cand in candidates:
                cid = cand.get("id")
                if not cid or cid == pid or cid in moved or cid in KNOWN_STATIC:
                    continue
                box = _box(_base_style(rules, cid), size)
                if box and _overlap(mine, box) >= MIN_OVERLAP:
                    report.append((pid, sorted(set(c.split(".")[0] for c in controls)), cid, layout,
                                   round(_overlap(mine, box), 2)))
    return report


def _transparent(value: str) -> bool:
    v = value.lower().replace(" ", "")
    colours = re.findall(r"#[0-9a-f]{3,8}\b", v)
    if v.startswith("gradient(") and colours:  # градиент прозрачен, если прозрачны все его цвета
        return all(_transparent(c) for c in colours)
    return v in {"none", "transparent"} or bool(re.fullmatch(r"#[0-9a-f]{6}00|#[0-9a-f]{3}0", v))


def colour_under_image(rules) -> list:
    """Настройки-картинки, у панели которых в игре ещё и непрозрачный цвет фона без своей настройки."""
    colour_targets = set()
    for control in catalog.controls().values():
        if control["type"] in ("color", "fill"):
            for target in control["emit"]:
                if target.get("prop") == "background-color" or "background-color" in " ".join(target.get("raw", [])):
                    colour_targets.update(re.findall(r"#[\w-]+", " ".join(target["sel"])))
    report = []
    for cid, control in catalog.controls().items():
        if control["type"] != "image" or not control["emit"]:
            continue
        for target in control["emit"]:
            if "raw" in target:  # готовое правило (фон магазина сам обнуляет цвет)
                continue
            for sel in target["sel"]:
                last = re.findall(r"#[\w-]+", sel.split()[-1])
                if not last or last[0] in colour_targets:
                    continue
                for game_sel, decls, file in rules:
                    colour = decls.get("background-color")
                    # Только обычное состояние: подсветки вроде .StashItemAvailable задуманы игрой.
                    base = game_sel in {f"{p}{last[0]}" for p in BASE_PREFIXES}
                    if colour and base and not _transparent(colour):
                        report.append((cid, game_sel, colour, file))
    return sorted(set(report))


def main() -> None:
    root = _latest(load_config().cache)
    rules = _rules(root / "styles")
    panels = _layouts(root / "layout")
    moved = _moved_ids()
    print("1. Соседи двигаемых блоков (стоят на том же месте, но не двигаются):")
    for pid, blocks, sid, layout, share in neighbours(rules, panels, moved):
        print(f"   #{pid} ({', '.join(blocks)}) накрывает #{sid} на {int(share * 100)}%  [{layout}]")
    print("\n2. Картинки, под которыми в игре есть свой цвет фона (прозрачная картинка не сделает панель прозрачной):")
    for cid, sel, colour, file in colour_under_image(rules):
        print(f"   {cid}: {sel} {{ background-color: {colour} }}  [{file}]")


if __name__ == "__main__":
    main()
