"""Окна, которые открываются поверх игры: ветка талантов и таблица по Tab.

Селекторы взяты из dota_hud_stat_branch.css и dota_hud_scoreboard.css.
"""

from .cat_helpers import (REBORN, REBORN_IMG, SCOREBOARD, STATBRANCH, block, color, emit, fill, grad, image, num,
                          outline, sub, text, texture)

# .ScoreboardClosed задаёт анимацию закрытия: правила блока действуют только на открытую таблицу.
_OPEN_BOARD = "DOTAScoreboard:not(.ScoreboardClosed)"


def talent_tree():
    label = emit(STATBRANCH, ".StatBonusLabel")
    level = emit(STATBRANCH, ".ReqLabel")
    # Заголовков два: «Выберите талант» у открытой кликом ветки и «Древо талантов» у подсказки при наведении.
    title = emit(STATBRANCH, "#BranchTitle", "#TooltipBranchTitle")
    return [
        *sub("Фон",
             image("tree.bg", "Фон ветки", [emit(STATBRANCH, ".StatBranchCenter")],
                   REBORN_IMG + "statbranch_background_psd.png", "420px 270px"),
             # При наведении на кнопку талантов игра рисует ветку другим фоном (.ShowStatBranchAsTooltip).
             image("tree.bgTip", "Фон при наведении", [emit(STATBRANCH, ".ShowStatBranchAsTooltip .StatBranchCenter")],
                   REBORN_IMG + "statbranch_background_tooltip_psd.png", "420px 270px"),
             image("tree.description", "Фон описаний", [emit(STATBRANCH, ".BranchDescription")],
                   REBORN_IMG + "statbranch_background_description_psd.png"),
             image("tree.stat", "Кнопка атрибутов", [emit(STATBRANCH, "#StatUpgradeOption")],
                   REBORN_IMG + "statbranch_stat_background_psd.png"),
             color("tree.statColor", "Цвет под кнопкой атрибутов", "#222222", emit(STATBRANCH, "#StatUpgradeOption"),
                   "background-color")),
        *sub("Текст талантов",
             text("tree.label", label, "#e1e1e1", 15, hi=28),
             color("tree.disabled", "Цвет недоступных", "#676E70", emit(STATBRANCH, ".BranchChoice.Disabled .StatBonusLabel")),
             color("tree.chosen", "Цвет выбранных", "#E7D29188", emit(STATBRANCH, ".BranchChoice.BranchChosen.Disabled Label"))),
        *sub("Заголовок",
             color("tree.title", "Цвет", "#e1e1e1", title),
             outline("tree.titleOutline", "Обводка", title)),
        *sub("Уровни",
             text("tree.level", level, "#E7D291", 20, hi=36),
             image("tree.levelBg", "Значок под уровнем", [emit(STATBRANCH, ".LevelBG")],
                   REBORN_IMG + "statbranch_levelbg_psd.png", "80% 80%")),
        *sub("Подсветка выбора",
             texture("tree.selectBoth", "Доступны оба", [REBORN_IMG + "statbranch_select_bg_psd"]),
             texture("tree.selectLeft", "Доступен левый", [REBORN_IMG + "statbranch_left_select_bg_psd"]),
             texture("tree.selectRight", "Доступен правый", [REBORN_IMG + "statbranch_right_select_bg_psd"])),
        *sub("Метки на кнопке талантов",
             texture("tree.pip10", "10 уровень", [REBORN_IMG + "statbranch_button_pip10_psd"]),
             texture("tree.pip15", "15 уровень", [REBORN_IMG + "statbranch_button_pip15_psd"]),
             texture("tree.pip20", "20 уровень", [REBORN_IMG + "statbranch_button_pip20_psd"]),
             texture("tree.pip25", "25 уровень", [REBORN_IMG + "statbranch_button_pip25_psd"])),
        *sub("Положение", block("tree", "#StatBranchDrawer", file=REBORN)),
    ]


def scoreboard():
    kda = emit(SCOREBOARD, "DOTAScoreboardPlayer .KDAColumn Label", "DOTAScoreboardPlayer.LocalPlayer .KDAColumn Label")
    score = emit(SCOREBOARD, "#RadiantScoreLabel", "#DireScoreLabel")
    team = emit(SCOREBOARD, "#RadiantTeamLabel", "#DireTeamLabel")
    player = emit(SCOREBOARD, ".PlayerNameLabel", ".LocalPlayer .PlayerNameLabel")
    hero = emit(SCOREBOARD, ".HeroNameLabel", ".LocalPlayer .HeroNameLabel")
    hero_image = emit(SCOREBOARD, ".ScoreboardHeroImage")
    return [
        *sub("Фон",
             image("board.bg", "Картинка фона", [emit(SCOREBOARD, "#Background")], REBORN_IMG + "bg_scoreboard_psd.png", "cover"),
             color("board.color", "Цвет фона", "#000000da", emit(SCOREBOARD, "#Background"), "background-color")),
        *sub("Строки игроков",
             color("board.row", "Цвет строк", "#111920bb", emit(SCOREBOARD, "DOTAScoreboardPlayer"), "background-color"),
             fill("board.localRow", "Твоя строка", grad("#373C3B", (.4, "#505959"), (.6, "#505959"), "#2F3535"),
                  emit(SCOREBOARD, "DOTAScoreboardPlayer.LocalPlayer"))),
        *sub("Счёт и команды",
             color("board.score", "Цвет счёта", "#ffffff", score),
             num("board.scoreSize", "Размер счёта", 30, 14, 56, [{**score, "prop": "font-size"}]),
             outline("board.scoreOutline", "Обводка счёта", score, "0 0 6px #000"),
             color("board.team", "Цвет названий команд", "#ffffff", team),
             num("board.teamSize", "Размер названий", 18, 10, 36, [{**team, "prop": "font-size"}]),
             outline("board.teamOutline", "Обводка названий", team, "0 0 6px #000")),
        *sub("Убийства и смерти",
             color("board.kda", "Цвет", "#acacac", kda),
             num("board.kdaSize", "Размер", 18, 10, 34, [{**kda, "prop": "font-size"}]),
             outline("board.kdaOutline", "Обводка", kda, "none")),
        *sub("Заголовки столбцов",
             color("board.header", "Цвет", "#afd2e3", emit(SCOREBOARD, ".SubheaderDesc")),
             num("board.headerSize", "Размер", 15, 9, 26, [{**emit(SCOREBOARD, ".SubheaderDesc"), "prop": "font-size"}])),
        *sub("Имена",
             color("board.player", "Цвет имён игроков", "#DAE2E5", player),
             num("board.playerSize", "Размер имён игроков", 19, 10, 32, [{**player, "prop": "font-size"}]),
             color("board.hero", "Цвет имён героев", "#8B989E", hero),
             num("board.heroSize", "Размер имён героев", 14, 9, 26, [{**hero, "prop": "font-size"}])),
        *sub("Золото",
             color("board.gold", "Цвет", "#ffcc33", emit(SCOREBOARD, ".ScoreboardGold")),
             num("board.goldSize", "Размер", 18, 10, 30, [{**emit(SCOREBOARD, ".ScoreboardGold"), "prop": "font-size"}])),
        *sub("Портреты героев",
             num("board.imageW", "Ширина", 88, 40, 140, [{**hero_image, "prop": "width"}]),
             num("board.imageH", "Высота", 54, 24, 66, [{**hero_image, "prop": "height"}]),
             num("board.imageRadius", "Круглые углы", 0, 0, 27, [{**hero_image, "prop": "border-radius"}])),
        *sub("Значки ультимейта",
             image("board.ultReady", "Готов", [emit(SCOREBOARD, ".UltReady #UltIcon")], REBORN_IMG + "ult_ready_psd.png", "contain"),
             image("board.ultCd", "Перезарядка", [emit(SCOREBOARD, ".UltOnCooldown #UltIcon")], REBORN_IMG + "ult_cooldown_psd.png", "contain"),
             image("board.ultMana", "Нет маны", [emit(SCOREBOARD, ".UltReadyNoMana #UltIcon")], REBORN_IMG + "ult_no_mana_psd.png", "contain")),
        *sub("Положение", block("board", _OPEN_BOARD, file=SCOREBOARD)),
    ]
