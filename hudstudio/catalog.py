"""Каталог настроек: единый источник и для живого превью, и для CSS игры.

file — путь внутри panorama/styles; sel — селекторы, скопированные из оригинального
CSS Dota 2 (при совпадении силы селектора наше правило побеждает, потому что дописано в конец).
Значения по умолчанию равны оригинальным: что не менялось, в мод не попадает.
Сами настройки лежат в cat_hud.py, cat_shop.py и cat_world.py.
"""

from . import cat_hud, cat_panels, cat_shop, cat_world


# Короткие пояснения к настройкам, где название само не объясняет, что изменится.
HINTS = {
    "fx.hue": "Сдвигает все цвета сразу.",
    "fx.sat": "0 делает худ чёрно-белым.",
    "hp.fill": "Один цвет или плавный переход из нескольких.",
    "hp.labelOutline": "Делает цифры заметнее на любом фоне.",
    "ab.bg": "Подойдёт широкая картинка.",
    "innate.icon": "Заменится у всех героев.",
    "minimap.scanOff": "Так кнопка выглядит, пока скан перезаряжается. В превью видна при наведении на эту настройку.",
    "minimap.glyphOff": "Так кнопка выглядит, пока глиф перезаряжается. В превью видна при наведении на эту настройку.",
    "shop.column": "Только у широкого вида магазина, где «Основные» и «Улучшения» стоят рядом. В обычном магазине с вкладками их нет.",
    "shop.tab": "«Основные», «Улучшения», «Нейтральные» над предметами.",
    "tree.bg": "Ветка, открытая кликом по кнопке талантов («Выберите талант»).",
    "tree.bgTip": "Ветка, которая появляется при наведении мыши на кнопку талантов («Древо талантов»).",
    "board.bg": "Таблица открывается по клавише Tab.",
    "inv.bg": "Лежит за всеми предметами.",
    "shop.bgAll": "Панели внутри станут прозрачными, чтобы её было видно.",
    "buffs.offset": "Или просто перетащи их мышью.",
    "top.hpRadiant": "В игре полоски героев видны, пока зажат Alt. В превью они появляются при наведении на эту настройку.",
    "hp.fillCb": "Режим цветовой слепоты включается в настройках Dota. Игра тогда красит полоску своим цветом поверх обычного — и у врагов тоже. В превью включается в «Вид».",
    "top.hpRadiantCb": "Режим цветовой слепоты включается в настройках Dota. Полоски Сил Тьмы в нём не меняются. В превью включается в «Вид».",
    "top.hpDire": "В игре полоски героев видны, пока зажат Alt. В превью они появляются при наведении на эту настройку.",
    "ab.size": "У героев с врождённой способностью кнопок пять, и игра делает их на 6 меньше этого числа.",
    "aghs.scepterOn": "Виден, когда у героя есть аганим. В превью появляется при наведении на эту настройку.",
    "aghs.shardOn": "Виден, когда у героя есть осколок. В превью появляется при наведении на эту настройку.",
    "tree.pip10": "Загорается на кнопке талантов рядом со способностями, когда талант выбран.",
}

# Крупные разделы меню слева. Порядок здесь равен порядку на сайте.
AREAS = [
    {"id": "common", "title": "Общее"},
    {"id": "bottom", "title": "Нижняя панель"},
    {"id": "screen", "title": "Края экрана"},
    {"id": "windows", "title": "Окна поверх игры"},
]

# Порядок разделов в меню: сначала по крупным разделам, внутри — как на экране.
GROUP_ORDER = ["global", "bars", "ab", "talents", "inv", "por",
               "top", "minimap", "buffs", "launch", "shop", "tree", "board"]

# Эти настройки работают только в игре: в превью нет такого состояния.
GAME_ONLY = {"ab.noMana", "shop.searchText", "tree.description", "board.ultCd", "board.ultMana",
             "shop.column", "shop.columnSize", "shop.columnOutline"}


def _with_hint(control):
    hint = control.get("hint") or HINTS.get(control["id"], "")
    return {**control, "hint": hint, "game_only": control["id"] in GAME_ONLY}


def groups():
    listed = {group["id"]: {**group, "controls": [_with_hint(c) for c in group["controls"]]} for group in _groups()}
    return [listed[group_id] for group_id in GROUP_ORDER]


def _groups():
    return [
        {"id": "global", "area": "common", "title": "Весь худ", "about": "Цвет и размер сразу всего интерфейса.",
         "controls": cat_world.overall()},
        {"id": "bars", "area": "bottom", "title": "Здоровье и мана", "about": "Полоски, градиенты, скругление и цифры.",
         "controls": cat_hud.bars()},
        {"id": "ab", "area": "bottom", "title": "Способности", "about": "Кнопки, перезарядка, цена маны и клавиши.",
         "controls": cat_hud.abilities()},
        {"id": "talents", "area": "bottom", "title": "Врождённая и таланты", "about": "Иконка врождённой, таланты, аганим.",
         "controls": cat_hud.talents()},
        {"id": "tree", "area": "windows", "title": "Ветка талантов", "about": "Окно с талантами, которое открывается кнопкой слева от способностей.",
         "scene": "tree", "controls": cat_panels.talent_tree()},
        {"id": "inv", "area": "bottom", "title": "Инвентарь", "about": "Фон, слоты, заряды, телепорт и нейтральный предмет.",
         "controls": cat_hud.inventory()},
        {"id": "por", "area": "bottom", "title": "Портрет", "about": "Портрет, уровень, имя героя и характеристики.",
         "controls": cat_hud.portrait()},
        {"id": "minimap", "area": "screen", "title": "Мини-карта", "about": "Размер, рамка, глиф и скан.",
         "controls": cat_world.minimap()},
        {"id": "shop", "area": "windows", "title": "Магазин", "about": "Окно магазина, которое открывается в игре.",
         "scene": "shop", "controls": cat_shop.opened()},
        {"id": "launch", "area": "screen", "title": "Золото и быстрая покупка", "about": "Панель справа внизу.",
         "controls": cat_shop.launcher()},
        {"id": "top", "area": "screen", "title": "Верхняя панель", "about": "Часы, счёт и портреты игроков.",
         "controls": cat_world.topbar()},
        {"id": "board", "area": "windows", "title": "Таблица (Tab)", "about": "Таблица с убийствами, смертями и золотом.",
         "scene": "board", "controls": cat_panels.scoreboard()},
        {"id": "buffs", "area": "screen", "title": "Баффы", "about": "Значки эффектов над панелью.",
         "controls": cat_world.buffs()},
    ]


def controls():
    return {c["id"]: c for g in groups() for c in g["controls"]}


def defaults():
    return {cid: c["default"] for cid, c in controls().items()}
