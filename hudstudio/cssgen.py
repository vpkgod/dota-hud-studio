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


def _declarations(control, target, value) -> list[str]:
    kind = control["type"]
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
        return [f"transform: translateX( {value['x']}px ) translateY( {value['y']}px )"]
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
            rules[key] = [*rules.get(key, []), *_declarations(control, target, value)]
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
