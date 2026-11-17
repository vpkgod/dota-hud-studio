"""Настройки нижней панели: здоровье, способности, инвентарь, портрет.

Селекторы скопированы из оригинального CSS Dota 2; значения по умолчанию равны игре.
"""

from .cat_helpers import (ABILITY, AGHS, FACETS_IMG, HEALTH, HUD_IMG, INNATE, INVENTORY, REBORN, REBORN_IMG,
                          HIDE_INSET, STATBRANCH, STATS, TALENT_HINT, UNITNAME,
                          XP, block, color, emit, fill, glow, grad, image, num, outline, sub, text, texture, toggle)


def _bar_radius(cid, left, right):
    return num(cid, "Скругление углов", 3, 0, 24, [
        {**left, "prop": "border-radius"},
        {**right, "prop": "border-top-right-radius"},
        {**right, "prop": "border-bottom-right-radius"},
    ])


def bars():
    hp_left = emit(HEALTH, ".Reborn #HealthProgress .ProgressBarLeft")
    hp_right = emit(HEALTH, ".Reborn #HealthProgress .ProgressBarRight")
    mana_left = emit(HEALTH, ".Reborn #ManaProgress .ProgressBarLeft")
    mana_right = emit(HEALTH, ".Reborn #ManaProgress .ProgressBarRight")
    enemy_left = emit(HEALTH, ".Reborn .EnemyUnit #HealthProgress .ProgressBarLeft")
    enemy_right = emit(HEALTH, ".Reborn .EnemyUnit #HealthProgress .ProgressBarRight")
    hp_text = emit(HEALTH, ".Reborn #HealthLabel")
    mp_text = emit(HEALTH, ".Reborn #ManaLabel")
    hp_regen = emit(HEALTH, ".Reborn #HealthRegenLabel")
    mp_regen = emit(HEALTH, ".Reborn #ManaRegenLabel")
    return [
        *sub("Полоска здоровья",
             fill("hp.fill", "Цвет полоски", grad("#425d25", (.2, "#5BA539"), (.5, "#4D9030"), "#425d25"), hp_left),
             image("hp.fillImg", "Картинка на заливке", [hp_left], "", "cover", game_sized=False),
             fill("hp.track", "Цвет пустой части", grad("#17200d", (.2, "#222e13"), (.5, "#1e2911"), "#17200d"), hp_right),
             num("hp.height", "Высота", 26, 8, 60, [{**emit(HEALTH, ".Reborn #HealthContainer"), "prop": "height"}]),
             _bar_radius("hp.radius", hp_left, hp_right),
             glow("hp.glow", "Свечение", hp_left)),
        *sub("Цифры здоровья",
             text("hp.label", hp_text, "#ffffff", 18, hi=36),
             color("hp.regen", "Цвет регенерации", "#3ED038", hp_regen),
             outline("hp.regenOutline", "Обводка регенерации", hp_regen, "0 2px 4px #000")),
        *sub("Полоска маны",
             fill("mp.fill", "Цвет полоски", grad("#2b4287", (.2, "#4165ce"), (.5, "#4a73ea"), "#2b4287"), mana_left),
             image("mp.fillImg", "Картинка на заливке", [mana_left], "", "cover", game_sized=False),
             fill("mp.track", "Цвет пустой части", grad("#101932", (.2, "#172447"), (.5, "#162244"), "#101932"), mana_right),
             num("mp.height", "Высота", 26, 8, 60, [{**emit(HEALTH, ".Reborn #ManaContainer"), "prop": "height"}]),
             _bar_radius("mp.radius", mana_left, mana_right),
             glow("mp.glow", "Свечение", mana_left)),
        *sub("Цифры маны",
             text("mp.label", mp_text, "#ffffff", 18, hi=36),
             color("mp.regen", "Цвет регенерации", "#83C2FE", mp_regen),
             outline("mp.regenOutline", "Обводка регенерации", mp_regen, "0 2px 4px #000")),
        *sub("Полоска врага",
             fill("hp.enemy", "Цвет полоски", grad("#5D2E25", (.2, "#A54E39"), (.5, "#904030"), "#5D2C25"), enemy_left),
             fill("hp.enemyTrack", "Цвет пустой части", grad("#2D1713", (.2, "#391D18"), (.5, "#3C1E19"), "#2D1713"),
                  enemy_right)),
        *sub("Положение", block("bars", "#health_mana")),
    ]


def abilities():
    center = emit(REBORN, "#center_bg", ".Reborn.CustomHUDSkin #center_bg", ".UnitDead #center_bg")
    size_targets = [
        {**emit(ABILITY, ".Reborn #ButtonSize"), "prop": prop} for prop in ("width", "height")
    ] + [
        {**emit(ABILITY, ".Reborn .auto_castable #ButtonSize"), "prop": prop, "delta": -6}
        for prop in ("width", "height")
    ]
    # У героев с пятью и шестью кнопками (а врождённая тоже считается) игра делает кнопки на 6 меньше.
    many = (".Reborn .FiveAbilities #abilities", ".Reborn .SixAbilities #abilities")
    size_targets += [
        {**emit(ABILITY, *(f"{mode} #ButtonSize" for mode in many)), "prop": prop, "delta": -6}
        for prop in ("width", "height")
    ] + [
        {**emit(ABILITY, *(f"{mode} .auto_castable #ButtonSize" for mode in many)), "prop": prop, "delta": -16}
        for prop in ("width", "height")
    ]
    bevel = emit(ABILITY, ".Reborn #AbilityBevel")
    cooldown = emit(ABILITY, "#CooldownTimer")
    mana_cost = emit(ABILITY, "#ManaCost")
    return [
        *sub("Панель",
             image("ab.bg", "Картинка панели", [center], REBORN_IMG + "ability_bg_psd.png"),
             color("ab.bgColor", "Цвет под панелью", "#1620346c", emit(REBORN, "#center_bg"), "background-color")),
        *sub("Кнопки",
             num("ab.size", "Размер", 64, 32, 120, size_targets),
             num("ab.radius", "Скругление иконок", 0, 0, 40,
                 [{**emit(ABILITY, "#AbilityImage"), "prop": "border-radius"}]),
             toggle("ab.bevel", "Рамка вокруг иконок", bevel),
             image("ab.bevelImg", "Своя рамка", [bevel], REBORN_IMG + "ability_bevel_psd.png", "contain")),
        *sub("Перезарядка",
             color("ab.cdColor", "Затемнение", "#000000dd", emit(ABILITY, "#CooldownOverlay"), "background-color"),
             text("ab.cd", cooldown, "#ffffff", 28, hi=48),
             color("ab.noMana", "Цвет, когда нет маны", "#1569be",
                   emit(ABILITY, ".insufficient_mana #AbilityImage"), "wash-color")),
        *sub("Цена и клавиши",
             text("ab.mana", mana_cost, "#57b7ff", 14, hi=28),
             color("ab.hotkeyBg", "Фон клавиши", "#212726", emit(ABILITY, ".Reborn #Hotkey"), "background-color"),
             color("ab.hotkey", "Цвет буквы клавиши", "#ffffff", emit(ABILITY, ".Reborn #HotkeyText"))),
        *sub("Тень по краям фона",
             image("ab.inset", "Тень у краёв", [emit(REBORN, ".AbilityInsetShadowLeft", ".AbilityInsetShadowRight")],
                   REBORN_IMG + "ability_inset_shadow_psd.png")),
        *sub("Метки уровней под кнопками",
             fill("ab.pipOn", "Взятые уровни", grad("#E7D291", "#887845"), emit(ABILITY, ".Reborn .active_level.LevelPanel")),
             fill("ab.pipOff", "Пустые уровни", grad("#111111", "#000000"), emit(ABILITY, ".Reborn .LevelPanel"))),
        *sub("Положение", block("ab", "#AbilitiesAndStatBranch",
                                   carry=(*TALENT_HINT, *HIDE_INSET,
                                          emit(REBORN, "#HUDSkinAbilityContainerBG", sum=["ab.offset"])))),
    ]


def talents():
    return [
        *sub("Врождённая способность",
             texture("innate.icon", "Иконка", [FACETS_IMG + "innate_icon_png", FACETS_IMG + "innate_icon_large_png"],
                     "Заменит иконку у всех героев."),
             texture("innate.frame", "Рамка под иконкой", [FACETS_IMG + "innate_frame_png"]),
             num("innate.size", "Размер иконки", 38, 20, 80,
                 [{**emit(INNATE, "#InnateIcon"), "prop": prop} for prop in ("width", "height")])),
        *sub("Положение врождённой", block("innate", ".RootInnateDisplay", file=INNATE, in_row=True)),
        *sub("Дерево талантов",
             texture("talent.bg", "Круг под деревом", [REBORN_IMG + "statbranch_button_bg_psd"]),
             texture("talent.tree", "Ствол и пустые листья дерева", [REBORN_IMG + "statbranch_button_bg_all_off_psd"],
                     "Серое дерево целиком, вместе со стволом. Выбранные таланты загораются поверх: "
                     "их листья — в разделе «Ветка талантов» (10, 15, 20, 25 уровень).")),
        *sub("Метки атрибутов под деревом",
             color("talent.pips", "Цвет взятых меток", "#E3CE8F",
                   emit(STATBRANCH, "#AttributePipsContainer #AttributePips"), "background-color"),
             image("talent.pipsBg", "Пустые метки", [emit(STATBRANCH, "#AttributePipsContainer")],
                   HUD_IMG + "attributes_pips_background_7_png.png")),
        *sub("Положение талантов", block("talent", "#StatBranch", carry=TALENT_HINT, in_row=True)),
        *sub("Аганим и осколок",
             image("aghs.scepter", "Скипетр, нет", [emit(AGHS, "#AghsStatusScepter")],
                   REBORN_IMG + "aghsstatus_scepter_psd.png", "contain"),
             image("aghs.scepterOn", "Скипетр, есть", [emit(AGHS, "#AghsStatusContainer.HasScepter #AghsStatusScepter")],
                   REBORN_IMG + "aghsstatus_scepter_on_psd.png", "contain"),
             image("aghs.shard", "Осколок, нет", [emit(AGHS, "#AghsStatusShard")],
                   REBORN_IMG + "aghsstatus_shard_psd.png", "contain"),
             image("aghs.shardOn", "Осколок, есть", [emit(AGHS, "#AghsStatusContainer.HasShard #AghsStatusShard")],
                   REBORN_IMG + "aghsstatus_shard_on_psd.png", "contain")),
        *sub("Положение аганима", block("aghs", "#AghsStatusContainer", file=AGHS, in_row=True)),
    ]


def inventory():
    slot = emit(ABILITY, ".Reborn .InventoryItem #ButtonSize")
    round_slots = emit(REBORN, "#inventory_tpscroll_slot", "#inventory_neutral_slot")
    return [
        *sub("Фон",
             image("inv.bg", "Задний фон инвентаря", [emit(INVENTORY, ".Reborn #inventory_items")],
                   REBORN_IMG + "inventory_bg_bg_psd.png"),
             color("inv.bgColor", "Цвет под фоном", "#221111", emit(INVENTORY, ".Reborn #inventory_items"),
                   "background-color"),
             image("inv.image", "Картинка инвентаря", [emit(INVENTORY, ".Reborn #InventoryBG")],
                   REBORN_IMG + "inventory_bg_psd.png")),
        *sub("Слоты",
             # Пассивки и предметы с повторным применением игра рисует своим правилом.
             image("inv.well", "Картинка пустого слота",
                   [slot, emit(ABILITY, ".Reborn .InventoryItem.can_cast_again #ButtonSize",
                               ".Reborn .InventoryItem.is_passive #ButtonSize")],
                   REBORN_IMG + "inventory_item_well_psd.png"),
             image("inv.packSlot", "Ячейка рюкзака",
                   [emit(ABILITY, ".Reborn #center_block .InventoryItem.BackpackSlot #ButtonSize")],
                   REBORN_IMG + "bg_backpack_psd.png"),
             toggle("inv.packShadow", "Тень в ячейках рюкзака",
                    emit(ABILITY, ".Reborn #center_block .InventoryItem.BackpackSlot #ButtonSize"), off="box-shadow: none"),
             color("inv.slotColor", "Цвет слота", "#1a1c1d88", slot, "background-color"),
             num("inv.slotW", "Ширина", 60, 30, 110, [{**slot, "prop": "width"}]),
             num("inv.slotH", "Высота", 45, 24, 90, [{**slot, "prop": "height"}]),
             num("inv.radius", "Скругление", 0, 0, 30,
                 [{**emit(ABILITY, ".InventoryItem #ItemImage"), "prop": "border-radius"},
                  {**slot, "prop": "border-radius"}])),
        *sub("Заряды на предметах", text("inv.charges", emit(ABILITY, "#ItemCharges"), "#ffffff", 16, hi=32)),
        *sub("Перезарядка предметов", text("inv.cd", emit(ABILITY, ".InventoryItem #CooldownTimer"), "#ffffff", 16, hi=36)),
        *sub("Телепорт и нейтральный слот",
             image("inv.tp", "Фон телепорта", [emit(REBORN, "#inventory_tpscroll_slot")],
                   REBORN_IMG + "bg_tp_slot_png.png"),
             image("inv.neutral", "Фон нейтрального", [emit(REBORN, "#inventory_neutral_slot")],
                   REBORN_IMG + "bg_neutral_slot_png.png"),
             color("inv.roundBorder", "Цвет рамки", "#55595d", round_slots, "border-color")),
        *sub("Положение круглых слотов", block("round", "#inventory_composition_layer_container",
                                                        anchor={"side": "right", "margin": 18, "width": 100, "origin": 0.5,
                                                                "margins": True})),
        *sub("Положение инвентаря", block("inv", "#inventory", carry=HIDE_INSET,
                                                anchor={"side": "right", "margin": 93, "width": 202, "origin": 1})),
    ]


# Имя героя и значок тира (Dota Plus) в игре — отдельные панели над портретом: едут за ним.
PORTRAIT_FOLLOWERS = (
    emit(REBORN, "#unitname", own={"margin": 52, "width": 159, "bottom": 145}),
    emit(REBORN, "#PortraitHeroBadgeOverlay", own={"margin": 29, "width": 182, "bottom": 105}),
    emit(REBORN, "#PortraitHeroBadge", own={"margin": 25, "width": 50, "bottom": 128}),
    # Портрет при выделении нескольких юнитов, значок предмета и кнопка «График смертей» (Dota Plus, у мёртвого).
    emit(REBORN, "#multiunit", own={"margin": 52, "width": 159, "bottom": 0}),
    emit(REBORN, "#econ_item", own={"margin": 85, "width": 97, "bottom": 35}),
    emit(REBORN, "#KillGraphButton", own={"margin": 52, "width": 159, "bottom": 145}),
    # Рамка портрета из скина худа: у неё в игре свой сдвиг translateX(-14px) translateY(25px).
    emit(REBORN, "#HUDSkinPortrait", own={"margin": 0, "width": 234, "bottom": 0, "dx": -14, "dy": 25}),
)


def portrait():
    level = emit(XP, "#LevelLabel")
    name = emit(UNITNAME, "#UnitNameLabel")
    stats = emit(STATS, ".StatRegionLabel")
    return [
        *sub("Картинки",
             image("por.bg", "Фон портрета", [emit(REBORN, "#PortraitBacker")], REBORN_IMG + "inventory_bg_psd.png"),
             image("por.left", "Левое крыло панели", [emit(REBORN, "#left_flare")],
                   REBORN_IMG + "side_flare_tall_psd.png"),
             image("por.right", "Правое крыло панели", [emit(REBORN, "#right_flare")],
                   REBORN_IMG + "right_flare_bg_psd.png")),
        *sub("Уровень",
             text("por.level", level, "#E7D291", 20, hi=40),
             color("por.xp", "Цвет кольца опыта", "#E7D291",
                   emit(XP, "#CircularXPProgressBlur_FG", "#CircularXPProgress_FG"), "border-color")),
        *sub("Имя героя", text("unit.name", name, "#ffffff", 14, hi=32)),
        *sub("Урон, броня, скорость", text("stats.label", stats, "#cccccc", 14, hi=28)),
        *sub("Положение", block("por", "#PortraitGroup", also=("#stats_container",),
                                   anchor={"side": "left", "margin": 52, "width": 159, "origin": 0.5},
                                   carry=(*PORTRAIT_FOLLOWERS, *HIDE_INSET))),
    ]
