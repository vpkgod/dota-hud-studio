"""Кирпичики каталога настроек. Селекторы и значения задаются в cat_*.py."""

HEALTH = "hud/dota_hud_health_mana.css"
ABILITY = "hud/dota_hud_ability_panel.css"
INVENTORY = "hud/dota_hud_inventory.css"
QUICKBUY = "hud/dota_hud_quick_buy.css"
TOPBAR = "hud/dota_hud_top_bar.css"
REBORN = "hud/hud_reborn.css"
SHOP = "hud/dota_hud_shop.css"
XP = "hud/dota_hud_xp.css"
INNATE = "hud/dota_hud_innate_display.css"
AGHS = "hud/dota_hud_aghs_status_display.css"
UNITNAME = "hud/dota_hud_unit_name.css"
STATS = "hud/dota_hud_stats_region.css"
BUFF = "hud/dota_hud_buff.css"
ITEMBUILD = "hud/dota_hud_item_build.css"
SHOPITEM = "dota_ui_shop_item.css"
STATBRANCH = "hud/dota_hud_stat_branch.css"
SCOREBOARD = "hud/dota_hud_scoreboard.css"

REBORN_IMG = "panorama/images/hud/reborn/"
FACETS_IMG = "panorama/images/hud/facets/"

NO_SHADOW = {"on": False, "c": "#000000", "w": 2}
PREVIEW_TEXT_SHADOW = "0 1px 3px #000"


def grad(*parts, direction="v"):
    """grad('#a', (.2, '#b'), '#c') → заливка: крайние цвета на 0 и 1, в кортежах — средние."""
    stops = [{"p": 0, "c": parts[0]}]
    stops += [{"p": p, "c": c} for p, c in parts[1:-1]]
    stops.append({"p": 1, "c": parts[-1]})
    return {"dir": direction, "stops": stops}


def emit(file, *selectors, **extra):
    return {"file": file, "sel": list(selectors), **extra}


def fill(cid, label, default, target):
    return {"id": cid, "label": label, "type": "fill", "default": default,
            "emit": [{**target, "prop": "background-color"}]}


def color(cid, label, default, target, prop="color"):
    return {"id": cid, "label": label, "type": "color", "default": default,
            "emit": [{**target, "prop": prop}]}


def num(cid, label, default, lo, hi, targets, unit="px", step=1, div=1):
    """targets — список emit(..., prop=...), необязательный delta прибавляется к значению."""
    return {"id": cid, "label": label, "type": "num", "default": default, "min": lo, "max": hi,
            "step": step, "unit": unit, "div": div, "emit": targets}


def toggle(cid, label, target, off="visibility: collapse", default=True):
    return {"id": cid, "label": label, "type": "toggle", "default": default,
            "emit": [{**target, "off": off}]}


def image(cid, label, targets, preview, fit="100% 100%"):
    return {"id": cid, "label": label, "type": "image", "default": None, "emit": targets,
            "preview": preview, "preview_fit": fit}


def texture(cid, label, game_paths, hint=""):
    """Подмена самого файла игры: для панелей, картинка которых задана не через CSS."""
    return {"id": cid, "label": label, "type": "image", "default": None, "emit": [], "replace": list(game_paths),
            "preview": f"{game_paths[0]}.png", "preview_fit": "contain", "fixed": True, "hint": hint}


def outline(cid, label, target, preview_off=PREVIEW_TEXT_SHADOW):
    return {"id": cid, "label": label, "type": "outline", "default": NO_SHADOW,
            "emit": [{**target, "prop": "text-shadow"}], "preview_off": preview_off}


def glow(cid, label, target):
    return {"id": cid, "label": label, "type": "glow", "default": NO_SHADOW,
            "emit": [{**target, "prop": "box-shadow"}]}


def text(cid, target, default_color, default_size, lo=8, hi=48):
    """Цвет, размер и обводка цифр: id, idSize, idOutline."""
    return [color(cid, "Цвет", default_color, target),
            num(f"{cid}Size", "Размер", default_size, lo, hi, [{**target, "prop": "font-size"}]),
            outline(f"{cid}Outline", "Обводка", target)]


def sub(title, *items):
    """Подраздел на панели справа. items — настройки или списки настроек."""
    flat = []
    for item in items:
        flat.extend(item if isinstance(item, list) else [item])
    return [{**control, "sub": title} for control in flat]


def block(prefix, selector, scale=True, file=REBORN, lo=40, hi=200):
    """Общие настройки блока: размер, положение, видимость, показ."""
    target = emit(file, selector)
    controls = []
    if scale:
        controls.append(num(f"{prefix}.scale", "Размер блока", 100, lo, hi,
                            [{**target, "prop": "ui-scale"}], unit="%"))
    controls.append({"id": f"{prefix}.offset", "label": "Положение на экране", "type": "offset",
                     "default": {"x": 0, "y": 0}, "min": -1400, "max": 1400,
                     "emit": [{**target, "prop": "transform"}]})
    controls.append(num(f"{prefix}.opacity", "Видимость", 100, 0, 100,
                        [{**target, "prop": "opacity"}], unit="", div=100))
    controls.append(toggle(f"{prefix}.show", "Показывать", target))
    return controls
