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
GLYPH = "hud/dota_hud_glyph.css"
RADAR = "dota_hud_radar_button.css"
ROSHAN = "dota_hud_roshan_timer.css"
TORMENTOR = "dota_hud_tormentor_timer.css"

REBORN_IMG = "panorama/images/hud/reborn/"
HUD_IMG = "panorama/images/hud/"
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


def image(cid, label, targets, preview, fit="100% 100%", game_sized=True):
    """game_sized=False — у панели в игре размер фона не задан (#QuickBuyRows): картинка «как в игре»
    встала бы своим размером посередине, поэтому для неё пишем размер, как в превью."""
    control = {"id": cid, "label": label, "type": "image", "default": None, "emit": targets,
               "preview": preview, "preview_fit": fit, "originals": [preview] if preview else []}
    return control if game_sized else {**control, "game_sized": False}


def texture(cid, label, game_paths, hint=""):
    """Подмена самого файла игры: для панелей, картинка которых задана не через CSS."""
    return {"id": cid, "label": label, "type": "image", "default": None, "emit": [], "replace": list(game_paths),
            "originals": [f"{path}.png" for path in game_paths], "preview": f"{game_paths[0]}.png", "preview_fit": "contain", "fixed": True, "hint": hint}


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




# Тени по краям фона способностей стоят на месте и лежат поверх всего (z-index 800), ловят мышь.
# Если сдвинуть способности, инвентарь или портрет, тень оказывается на ячейках и мешает перетаскивать
# предметы — тогда прячем её (visibility: collapse убирает и перехват мыши).
HIDE_INSET = (emit(REBORN, ".AbilityInsetShadowLeft", ".AbilityInsetShadowRight", raw=["visibility: collapse"]),)
ROW_HINT = "Игра не рисует блок, унесённый целиком за край ряда способностей: оставьте хотя бы край на ряду."
# Ряд способностей обрезает то, что вынесли за его края. Слоя с отдельной отрисовкой в нём нет, поэтому
# noclip здесь безопасен (в отличие от #center_block, где он прячет круглые слоты) — проверено в игре.
ROW_NOCLIP = (emit(REBORN, "#AbilitiesAndStatBranch", "#AbilitiesAndStatBranch .LeftRightFlow", raw=["overflow: noclip"]),)
# Ветка талантов (#StatBranchDrawer) в игре сдвигается влево у героев с большим числом способностей:
# у них больше margin-right при выравнивании по центру. Сдвинутую ветку держим на одном месте экрана:
# поправка (margin_k − 395) / 2 для каждого класса. Сверено в игре: у Кез (SixAbilities) ветка левее на 42.
DRAWER_CLASSES = (("FiveAbilities", 430), ("SixAbilities", 480), ("SevenAbilities", 510),
                  ("EightAbilities", 506), ("NineAbilities", 564))
DRAWER_KEEP = tuple(emit(REBORN, f".{name} #StatBranchDrawer", sum=["tree.offset"], dx=(margin - 395) / 2)
                    for name, margin in DRAWER_CLASSES)
# Свечение «можно взять талант» и подсказка клавиши стоят в игре на месте кнопки талантов, но вне полосы
# способностей: двигаем их на сумму сдвигов полосы и самой кнопки.
TALENT_HINT = (emit(REBORN, "#level_stats_frame", "#StatBranchHotkey", sum=["ab.offset", "talent.offset"]),)


def sub(title, *items):
    """Подраздел на панели справа. items — настройки или списки настроек."""
    flat = []
    for item in items:
        flat.extend(item if isinstance(item, list) else [item])
    return [{**control, "sub": title} for control in flat]


def block(prefix, selector, scale=True, file=REBORN, lo=40, hi=200, also=(), anchor=None, carry=(), in_row=False):
    """Общие настройки блока: размер, положение, видимость, показ.

    also — панели, которые в игре лежат отдельно, но на экране составляют один блок с этой
    (цифры урона и брони — не часть портрета). Родителям overflow: noclip не пишем:
    он ломает слой с круглыми слотами (require-composition-layer) — проверено в игре.
    anchor — у какого края нижней панели блок стоит в игре: {"side", "margin", "width"}. Ширина панели
    зависит от числа способностей героя, поэтому блок, унесённый за середину, привязываем к другому краю.
    in_row — блок стоит в ряду способностей (кнопка талантов, врождённая, аганим). ui-scale меняет его
    место в ряду и раздвигает всю нижнюю панель — увеличиваем через pre-transform-scale2d (только вид),
    а ряд не обрезаем, чтобы унесённый за его край блок был виден (проверено в игре).
    carry — панели, которые в игре стоят отдельно, но должны ехать вместе с блоком; у каждой "sum" —
    чьи сдвиги складываются (подсказка «возьми талант» едет и за способностями, и за кнопкой талантов).
    """
    target = emit(file, selector, *also)
    if anchor and scale:  # игра уменьшает блок к его краю, превью — к точке origin: сдвиг это учитывает
        anchor = {**anchor, "scale": f"{prefix}.scale"}
    if anchor:
        anchor = {**anchor, "offset": f"{prefix}.offset"}
    # Ведомые панели (имя героя, значок тира) встают туда же относительно блока, где стояли в игре.
    carry = [{**t, "lead": anchor} if "own" in t else t for t in carry]
    controls = []
    if scale:
        followers = [t for t in carry if "lead" in t]
        if in_row:
            carry = (*carry, *ROW_NOCLIP)
            controls.append(num(f"{prefix}.scale", "Размер блока", 100, lo, hi,
                                [{**target, "prop": "pre-transform-scale2d"}, *ROW_NOCLIP], unit="", div=100))
        else:
            controls.append(num(f"{prefix}.scale", "Размер блока", 100, lo, hi,
                                [{**target, "prop": "ui-scale"}, *followers], unit="%"))
    controls.append({"id": f"{prefix}.offset", "label": "Положение на экране", "type": "offset",
                     "default": {"x": 0, "y": 0}, "min": -1400, "max": 1400,
                     **({"hint": ROW_HINT} if in_row else {}),
                     "emit": [{**target, "prop": "transform", **({"anchor": anchor} if anchor else {})},
                              *carry]})
    controls.append(num(f"{prefix}.opacity", "Видимость", 100, 0, 100,
                        [{**target, "prop": "opacity"}], unit="", div=100))
    controls.append(toggle(f"{prefix}.show", "Показывать", target))
    return controls
