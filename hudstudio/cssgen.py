"""Превращает настройки в правила Panorama CSS. Менять чистые значения здесь не нужно."""

from . import catalog

HEADER = "\n\n/* === Dota HUD Studio === */\n"
FIT_CSS = {"stretch": "100% 100%", "cover": "cover", "contain": "contain"}


def image_game_path(image_id: str) -> str:
    return f"panorama/images/hudstudio/u{image_id}"


def _number(value) -> str:
    text = f"{value:.4f}".rstrip("0").rstrip(".")
    return text if text else "0"


def panorama_fill(fill: dict) -> str:
    stops = fill["stops"]
    if len({s["c"].lower() for s in stops}) == 1:
        return stops[0]["c"]
    end = "0% 100%" if fill["dir"] == "v" else "100% 0%"
    middle = "".join(f"color-stop( {_number(s['p'])}, {s['c']} ), " for s in stops[1:-1])
    return f"gradient( linear, 0% 0%, {end}, from( {stops[0]['c']} ), {middle}to( {stops[-1]['c']} ) )"


def _num_value(control, target, value) -> str:
    adjusted = value + target.get("delta", 0)
    return f"{_number(adjusted / control['div'])}{control['unit']}"


def _image_decls(value) -> list[str]:
    decls = [f'background-image: url("s2r://{image_game_path(value["id"])}.vtex")']
    if value["fit"] != "original":  # перекрашенный оригинал лежит так же, как задумано в игре
        decls += [f"background-size: {FIT_CSS[value['fit']]}",
                  "background-position: 50% 50%",
                  "background-repeat: no-repeat"]
    if value["opacity"] < 1:
        decls.append(f"background-img-opacity: {_number(value['opacity'])}")
    return decls


def _outline(value) -> str:
    """Те же сочетания размытия и силы, что в CSS игры: 1px/3, 3px/4, 6px/6."""
    strength = 3 + (value["w"] - 1) * 0.6
    return f"text-shadow: 0px 0px {value['w']}px {_number(strength)} {value['c']}"


def _glow(value) -> str:
    return f"box-shadow: {value['c']} 0px 0px {value['w'] * 2}px {value['w']}px"


# Ширина нижней панели у героя с четырьмя способностями (как в превью): 219 слева + кнопки + 302 справа.
CENTER_WIDTH = 940
CENTER_PER_ABILITY = 4


def center_width(values: dict) -> int:
    return CENTER_WIDTH + CENTER_PER_ABILITY * (values.get("ab.size", 64) - 64)


def _summed(target, values: dict) -> dict:
    moves = [values.get(cid, {"x": 0, "y": 0}) for cid in target["sum"]]
    return {"x": sum(m["x"] for m in moves), "y": sum(m["y"] for m in moves)}


def _place(anchor, value, values: dict):
    """Где блок виден в превью: (левый край, ширина после размера, ближе к левому краю?, ширина панели)."""
    width = center_width(values)
    size = anchor["width"]
    scaled = size * values.get(anchor.get("scale"), 100) / 100
    if anchor["side"] == "left":
        left = anchor["margin"] + value["x"]
    else:
        left = width - (anchor["margin"] - value["x"]) - size
    left = left + (size - scaled) * anchor.get("origin", 0.5)
    return left, scaled, left + scaled / 2 <= width / 2, width


def _offset(target, value, values: dict) -> list[str]:
    """Сдвиг блока так, чтобы в игре он встал туда же, где в превью.

    Блок, унесённый за середину нижней панели, привязываем к другому её краю: панель шире у героев
    с большим числом способностей, и сдвиг от старого края увёл бы блок под соседей. Уменьшенный
    (ui-scale) блок игра прижимает к своему краю, а превью сжимает к точке origin — это тоже учтено.
    """
    anchor = target.get("anchor")
    if not anchor:
        return [f"transform: translateX( {value['x']}px ) translateY( {value['y']}px )"]
    left, scaled, on_left, width = _place(anchor, value, values)
    if anchor.get("margins"):  # слой с отдельной отрисовкой (круглые слоты) пропадает от transform
        down = f"margin-bottom: {_number(-value['y'])}px"
        if on_left:
            return ["horizontal-align: left", "margin-right: 0px", f"margin-left: {_number(left)}px", down]
        return ["horizontal-align: right", "margin-left: 0px", f"margin-right: {_number(width - left - scaled)}px", down]
    y = f"translateY( {value['y']}px )"
    if anchor["side"] == "left" and on_left:
        return [f"transform: translateX( {_number(left - anchor['margin'])}px ) {y}"]
    if anchor["side"] == "right" and not on_left:
        return [f"transform: translateX( {_number(left + scaled - width + anchor['margin'])}px ) {y}"]
    if on_left:
        return ["horizontal-align: left", "margin-right: 0px", f"margin-left: {_number(left)}px",
                f"transform: translateX( 0px ) {y}"]
    return ["horizontal-align: right", "margin-left: 0px", f"margin-right: {_number(width - left - scaled)}px",
            f"transform: translateX( 0px ) {y}"]


def _follow(target, values: dict) -> list[str]:
    """Ведомая панель (у левого края) сдвигается и сжимается вместе с ведущим блоком, вокруг той же точки,
    что и в превью. Игра сжимает панель к её левому и нижнему краю, отступы не трогает — поправляем сдвигом."""
    lead, own = target["lead"], target["own"]
    value = values.get(lead["offset"], {"x": 0, "y": 0})
    left, _, on_left, width = _place(lead, value, values)
    ratio = values.get(lead.get("scale"), 100) / 100
    home = lead["margin"] if lead["side"] == "left" else width - lead["margin"] - lead["width"]
    own_left = left + (own["margin"] - home) * ratio
    y = f"translateY( {_number(value['y'] + own['bottom'] * (1 - ratio))}px )"
    decls = [] if ratio == 1 else [f"ui-scale: {_number(ratio * 100)}%"]
    if on_left:
        return [*decls, f"transform: translateX( {_number(own_left - own['margin'])}px ) {y}"]
    return [*decls, "horizontal-align: right", "margin-left: 0px",
            f"margin-right: {_number(width - own_left - own['width'] * ratio)}px", f"transform: translateX( 0px ) {y}"]


def _declarations(control, target, value, values=None) -> list[str]:
    values = values or {}
    kind = control["type"]
    if "lead" in target:
        return _follow(target, values)
    if kind == "fill":
        return [f"{target['prop']}: {panorama_fill(value)}"]
    if kind == "color":
        return [f"{target['prop']}: {value}", *target.get("extra", [])]
    if kind == "outline":
        return [_outline(value)] if value["on"] else []
    if kind == "glow":
        return [_glow(value)] if value["on"] else []
    if kind == "num":
        return [f"{target['prop']}: {_num_value(control, target, value)}"]
    if kind == "toggle":
        return [target["off"]] if not value else []
    if kind == "offset":
        if "sum" in target:
            return _offset(target, _summed(target, values), values)
        return _offset(target, value, values)
    if kind == "image":
        if not value:
            return []
        return target["raw"] if "raw" in target else _image_decls(value)
    raise ValueError(f"Неизвестный тип настройки: {kind}")


def _collect(values: dict) -> dict:
    """{файл: {(селекторы): [объявления]}} — порядок совпадает с каталогом."""
    files: dict = {}
    for cid, control in catalog.controls().items():
        value = values.get(cid, control["default"])
        if value == control["default"]:
            continue
        for target in control["emit"]:
            key = tuple(target["sel"])
            rules = files.setdefault(target["file"], {})
            old = rules.get(key, [])
            new = _declarations(control, target, value, values)
            if "sum" in target or "lead" in target:  # общее правило пишем один раз, сколько бы блоков его ни просили
                new = [d for d in new if d not in old]
            rules[key] = [*old, *new]
    return files


def _render(rules: dict) -> str:
    blocks = []
    for selectors, decls in rules.items():
        if decls:
            body = "".join(f"\t{d};\n" for d in decls)
            blocks.append(f"{','.join(selectors)}\n{{\n{body}}}\n")
    return "\n".join(blocks)


def generate(values: dict) -> dict:
    """{файл: текст правил}. Только изменённые настройки; пустых файлов нет."""
    rendered = {name: _render(rules) for name, rules in _collect(values).items()}
    return {name: text for name, text in rendered.items() if text}


def images_used(values: dict) -> set:
    """Картинки, на которые ссылается CSS. Подмена файлов игры считается отдельно."""
    return {value["id"] for cid, control in catalog.controls().items()
            if control["type"] == "image" and control["emit"] and (value := values.get(cid))}


def replaced_textures(values: dict) -> dict:
    """{путь текстуры игры без расширения: id картинки}."""
    return {path: value["id"] for cid, control in catalog.controls().items()
            if control.get("replace") and (value := values.get(cid)) for path in control["replace"]}
