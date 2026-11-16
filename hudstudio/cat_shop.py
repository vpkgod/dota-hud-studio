"""Настройки открытого магазина, золота и быстрой покупки.

Вид магазина снят с layout/hud/dota_hud_shop.xml: панель #Main шириной 800 (класс ShopV2),
сверху поиск и сетка предметов, снизу закреплённые предметы и сборка предмета.
"""

from .cat_helpers import (ITEMBUILD, QUICKBUY, REBORN, REBORN_IMG, SHOP, SHOPITEM, block, color, emit, fill,
                          grad, image, num, outline, sub, text)

# Эти панели непрозрачные: без очистки картинка на весь магазин под ними не видна.
_COVERING_PANELS = ("#HeightLimiterContainer", "#SearchAndButtonsContainer", "#GridShopHeaders", "#ItemCombines")


def _clear(selector, *declarations):
    return emit(SHOP, selector, raw=list(declarations))


def _whole_shop_targets():
    clear = [_clear(s, "background-color: none") for s in _COVERING_PANELS]
    return [emit(SHOP, "#Main"), *clear, _clear("#PinnedItems", "background-color: none", "background-image: none")]


def opened():
    # У вкладок «Основные» и «Улучшения» свои правила сильнее общего (42 и 38 при обычных 40): пишем и в них.
    item = [{**emit(SHOP, ".ShopItemsRows DOTAShopItem"), "prop": "width"},
            {**emit(SHOP, "#GridBasicItems DOTAShopItem"), "prop": "width", "delta": 2},
            {**emit(SHOP, "#GridUpgradeItems.ShopItemsRows #ShopItemsContainer DOTAShopItem"), "prop": "width", "delta": -2},
            {**emit(SHOP, ".ShopItemRowContainer"), "prop": "width", "delta": 12}]
    search_box = emit(SHOP, "#SearchBox", "#SearchTextEntry")
    placeholder = emit(SHOP, "DOTAHUDShopTextEntry #PlaceholderText")
    return [
        *sub("Фон магазина",
             image("shop.bgAll", "Картинка на весь магазин", _whole_shop_targets(), "", "cover"),
             image("shop.bg", "Картинка за предметами", [emit(SHOP, "#HeightLimiterContainer")], "", "cover"),
             fill("shop.color", "Цвет за предметами", grad("#1e1f22", "#070708"), emit(SHOP, "#HeightLimiterContainer"))),
        *sub("Строка поиска",
             color("shop.searchRow", "Фон строки", "#000000", emit(SHOP, "#SearchAndButtonsContainer"), "background-color"),
             color("shop.searchBox", "Фон поля", "#000000", search_box, "background-color"),
             color("shop.searchBorder", "Рамка поля", "#3d464c", emit(SHOP, "#SearchBox"), "border-color"),
             color("shop.searchText", "Цвет текста", "#ffffff", emit(SHOP, "DOTAHUDShopTextEntry")),
             color("shop.placeholder", "Цвет подсказки", "#57646d", placeholder)),
        *sub("Предметы",
             num("shop.itemW", "Размер иконок", 40, 28, 64, item),
             num("shop.itemRadius", "Скругление иконок", 0, 0, 16,
                 [{**emit(SHOPITEM, "DOTAShopItem #ItemImage"), "prop": "border-radius"}])),
        *sub("Вкладки", text("shop.tab", emit(SHOP, "#GridMainTabs Label"), "#ffffff", 13, hi=28)),
        # .ItemContainerLabel есть только у широкого магазина без вкладок (обе колонки рядом).
        *sub("Заголовки широкого магазина", text("shop.column", emit(SHOP, ".ItemContainerLabel"), "#ffffff", 20, hi=36)),
        *sub("Названия групп",
             color("shop.group", "Цвет", "#ffffff", emit(SHOP, "#ShopItemsHeader")),
             num("shop.groupSize", "Размер", 14, 8, 28, [{**emit(SHOP, "#ShopItemsHeader"), "prop": "font-size"}]),
             outline("shop.groupOutline", "Обводка", emit(SHOP, "#ShopItemsHeader"), "0 2px 6px #000")),
        *sub("Закреплённые предметы",
             image("shop.pinnedImg", "Картинка", [emit(SHOP, "#PinnedItems")],
                   REBORN_IMG + "bg_pinned_items_psd.png", "cover"),
             fill("shop.pinned", "Цвет", grad("#1c2027", "#010101"), emit(SHOP, "#PinnedItems"))),
        *sub("Сборка предмета",
             image("shop.combinesImg", "Картинка", [emit(SHOP, "#ItemCombines")], "", "cover"),
             color("shop.combines", "Цвет", "#1c262fb2", emit(SHOP, "#ItemCombines"), "background-color")),
        *sub("Гайд слева",
             image("shop.guideBg", "Картинка", [emit(ITEMBUILD, "#ItemBuildBackground")],
                   REBORN_IMG + "bg_shop_guide_psd.png", "cover"),
             color("shop.guideTitle", "Цвет названия", "#d3d3d3", emit(ITEMBUILD, ".BuildTitle"))),
        *sub("Положение", block("shop", "#shop")),
    ]


def launcher():
    button = emit(QUICKBUY, ".Reborn #ShopButton", ".Reborn .ShopInRange #ShopButton")
    gold = emit(QUICKBUY, ".ShopButtonValueLabel")
    return [
        *sub("Быстрая покупка",
             image("launch.quick", "Фон", [emit(QUICKBUY, ".Reborn #QuickBuyRows")], REBORN_IMG + "quickbuy_bg_psd.png"),
             color("quick.color", "Цвет под картинкой", "#252627ac", emit(QUICKBUY, "#QuickBuyRows"), "background-color")),
        *sub("Положение быстрой покупки", block("quick", "#QuickBuyRows", file=QUICKBUY)),
        *sub("Панель золота",
             image("launch.bg", "Картинка", [emit(REBORN, "#shop_launcher_bg")], REBORN_IMG + "courier_gold_bg_262_psd.png")),
        *sub("Цифры золота",
             text("launch.gold", gold, "#ffcc33", 22, lo=10, hi=40),
             image("launch.goldIcon", "Иконка монеты", [emit(QUICKBUY, "#GoldIcon")],
                   REBORN_IMG + "gold_small_psd.png", "contain")),
        *sub("Кнопка магазина",
             image("launch.button", "Картинка", [button], REBORN_IMG + "shop_launcher_button_psd.png"),
             num("launch.buttonW", "Ширина", 100, 50, 200, [{**emit(QUICKBUY, "#ShopButton"), "prop": "width"}]),
             num("launch.buttonH", "Высота", 36, 20, 80, [{**emit(QUICKBUY, ".Reborn #ShopButton"), "prop": "height"}])),
        *sub("Положение всего блока", block("launch", "#shop_launcher_block")),
    ]
