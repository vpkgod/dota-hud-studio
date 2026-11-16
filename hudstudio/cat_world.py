"""Настройки вне нижней панели: мини-карта, верхняя панель, баффы и весь худ целиком."""

from .cat_helpers import (BUFF, REBORN, REBORN_IMG, TOPBAR, block, color, emit, image, num, sub, text)

# В Dota есть настройка «крупная мини-карта»: её правила сильнее простого #minimap,
# поэтому размер пишем во все три варианта.
_MINIMAP_MODES = ("", ".MinimapExtraLarge ", ".MinimapExtraExtraLarge ")
_MINIMAP_SIDE_PANELS = ("#GlyphScanContainer", "#RoshanTimerContainer", "#TormentorTimerContainer")


def _minimap_size_targets():
    targets = []
    for mode in _MINIMAP_MODES:
        targets += [{**emit(REBORN, f"{mode}#minimap_block"), "prop": p} for p in ("width", "height")]
        targets += [{**emit(REBORN, f"{mode}#minimap"), "prop": p, "delta": 16} for p in ("width", "height")]
        targets += [{**emit(REBORN, f"{mode}{panel}"), "prop": "margin-left"} for panel in _MINIMAP_SIDE_PANELS]
    return targets


def minimap():
    return [
        *sub("Мини-карта",
             num("minimap.size", "Размер", 244, 140, 560, _minimap_size_targets()),
             num("minimap.radius", "Скругление углов", 0, 0, 120,
                 [{**emit(REBORN, "#minimap_block"), "prop": "border-radius"}]),
             image("minimap.bg", "Рамка", [emit(REBORN, "#minimap_block")], REBORN_IMG + "bg_minimap_psd.png", "contain")),
        *sub("Положение карты", block("minimap", "#minimap_block", scale=False)),
        *sub("Глиф и скан",
             image("minimap.glyph", "Картинка панели", [emit(REBORN, "#GlyphScanContainer")],
                   REBORN_IMG + "glyph_scan_bg_psd.png", "cover")),
        *sub("Положение глифа", block("glyph", "#GlyphScanContainer", scale=False)),
    ]


def _bar_color(cid, label, default, team):
    selector = f"#{team} .TopBarHealthBar .ProgressBarLeft"
    return color(cid, label, default, emit(TOPBAR, selector, extra=["background-image: none"]), "background-color")


def topbar():
    return [
        *sub("Фон",
             image("top.bg", "Фон команд", [emit(TOPBAR, ".TopBarBackground")], REBORN_IMG + "top_bar_team_bg_psd.png", "cover"),
             image("top.clock", "Фон часов", [emit(TOPBAR, "#TimeOfDayBG")], REBORN_IMG + "bg_timer_psd.png")),
        *sub("Время", text("top.time", emit(TOPBAR, "#GameTime"), "#ffffff", 14, hi=30)),
        *sub("Счёт", text("top.score", emit(TOPBAR, "#TopBarRadiantScore", "#TopBarDireScore"), "#ffffff", 22, hi=44)),
        *sub("Портреты игроков",
             num("top.heroW", "Ширина", 66, 40, 100,
                 [{**emit(TOPBAR, ".TopBarHeroImage"), "prop": "width"},
                  {**emit(TOPBAR, ".TopBarPlayerSlot"), "prop": "width"}]),
             num("top.radius", "Скругление", 0, 0, 18, [{**emit(TOPBAR, ".TopBarHeroImage"), "prop": "border-radius"}])),
        *sub("Полоски здоровья",
             _bar_color("top.hpRadiant", "Силы Света", "#339933", "TopBarRadiantTeam"),
             _bar_color("top.hpDire", "Силы Тьмы", "#993333", "TopBarDireTeam")),
        *sub("Положение", block("top", "DOTATopBar", file=TOPBAR)),
    ]


def buffs():
    return [
        *sub("Значки", num("buffs.size", "Размер", 40, 20, 80,
                           [{**emit(BUFF, "DOTABuff"), "prop": p} for p in ("width", "height")])),
        *sub("Положение", block("buffs", "#BuffContainer")),
    ]


def overall():
    def everywhere(prop):
        return [{**emit(REBORN, "#lower_hud", "#minimap_container"), "prop": prop},
                {**emit(TOPBAR, "DOTATopBar"), "prop": prop}]

    return [
        *sub("Цвет всего худа",
             num("fx.hue", "Сдвиг оттенка", 0, 0, 360, everywhere("hue-rotation"), unit="deg"),
             num("fx.sat", "Насыщенность", 100, 0, 250, everywhere("saturation"), unit="", div=100),
             num("fx.bright", "Яркость", 100, 30, 200, everywhere("brightness"), unit="", div=100),
             num("fx.contrast", "Контраст", 100, 30, 200, everywhere("contrast"), unit="", div=100)),
        *sub("Размер", num("low.scale", "Масштаб нижней панели", 100, 40, 160,
                           [{**emit(REBORN, "#center_with_stats"), "prop": "ui-scale"}], unit="%")),
    ]
