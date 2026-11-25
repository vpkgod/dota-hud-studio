"""Достаёт из pak01_dir.vpk оригинальный CSS и картинки: для превью и для сборки."""

import re
import shutil
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .tools import run_tool
from .config import Config
from .pak import VIEW_DIR, reader_args

HERO = "juggernaut"
TEAM_HEROES = ["axe", "lina", "pudge", "crystal_maiden", "sniper", "tusk", "mirana", "invoker", "phantom_assassin"]
SPELLS = ["juggernaut_blade_fury", "juggernaut_healing_ward", "juggernaut_blade_dance", "juggernaut_omni_slash"]
ITEMS = ["blink", "bfury", "black_king_bar", "butterfly", "tango", "ward_observer", "gem", "tpscroll",
         "desolator", "manta", "satanic", "skadi", "monkey_king_bar", "heart", "assault", "aegis",
         "ultimate_scepter", "sange", "yasha", "kaya", "phase_boots", "power_treads", "magic_wand", "bracer",
         "boots", "gloves", "belt_of_strength", "ring_of_health", "void_stone", "broadsword"]
DIRS = ["panorama/styles/hud/", "panorama/styles/dota_ui_shop_item", "panorama/layout/hud/",
        "panorama/layout/dota_ui_shop_item", "panorama/images/hud/reborn/", "panorama/images/hud/hudv2_",
        "panorama/images/hud/facets/innate_"]
# Мелочи для превью: таймеры и скан у мини-карты, значки курьера, атрибутов и защиты выкупа.
PREVIEW_EXTRAS = [
    "panorama/layout/dota_hud_roshan_timer", "panorama/layout/dota_hud_tormentor_timer", "panorama/layout/dota_hud_radar_button",
    "panorama/styles/dota_hud_roshan_timer", "panorama/styles/dota_hud_tormentor_timer", "panorama/styles/dota_hud_radar_button",
    "panorama/images/control_icons/24px/couriers", "panorama/images/control_icons/24px/speed_boost",
    "panorama/images/control_icons/24px/armor", "panorama/images/control_icons/24px/arrow_alt_right",
    "panorama/images/control_icons/24px/x_close",
    "panorama/images/primary_attribute_icons/mini_primary_attribute_icon_",
    "panorama/images/hud/attributes_pips", "panorama/images/hud/buyback_protection",
    "panorama/images/hud/tormentor_timer_icon", "panorama/images/hud/icon_roshan_psd", "panorama/images/hud_radar_png",
    "panorama/images/hud/pip_", "panorama/images/hud/portrait_hero_badge_frame_tier_",
    "panorama/images/control_icons/brackets_png",
    # Магазин: все иконки предметов и раскладка лавки по разделам.
    "panorama/images/items/", "scripts/shops.txt",
    "panorama/images/hud/shopborder_canpurchase_psd", "panorama/images/control_icons/icon_search_shadow_psd",
    "panorama/images/icon_star_shadow_hi_psd", "panorama/images/hud/shop_hud_layout_columns_png",
    "panorama/images/hud/team_items_toggle_png", "panorama/images/control_icons/edit_pencil_psd",
    "panorama/images/control_icons/24px/help", "panorama/images/hud/neutral_currency_icon_png",
    "materials/vgui/hud/minimap_herocircle_psd",
]
_REBORN = "panorama/images/hud/reborn/"
_HUD = "panorama/images/hud/"
_ICONS = "panorama/images/control_icons/24px/"
_ATTR = "panorama/images/primary_attribute_icons/mini_primary_attribute_icon_"
# Картинки игры, из которых превью собирает части худа, не имеющие своих настроек.
PREVIEW_UI = {
    "attrPipsMask": _HUD + "attributes_pips_mask_7_png.png",
    "heroBadge": _HUD + "portrait_hero_badge_frame_tier_3_psd.png",
    "pipOn": _HUD + "pip_on_png.png", "pipOff": _HUD + "pip_off_png.png",
    "iconDamage": _REBORN + "icon_damage_psd.png", "iconAttackSpeed": _REBORN + "icon_attack_speed_psd.png",
    "iconArmor": _REBORN + "icon_armor_psd.png", "iconMagicResist": _REBORN + "icon_magic_resist_psd.png",
    "iconSpeed": _REBORN + "icon_speed_psd.png",
    "attrStr": _ATTR + "strength_psd.png", "attrAgi": _ATTR + "agility_psd.png", "attrInt": _ATTR + "intelligence_psd.png",
    "sun": _REBORN + "icon_sun_psd.png",
    "roshanBg": _REBORN + "roshan_timer_bg_v2_png.png", "roshan": _REBORN + "roshan_timer_roshan_psd.png",
    "tormentorBg": _REBORN + "tormentor_timer_bg_v2_png.png", "tormentor": _HUD + "tormentor_timer_icon_radiant_png.png",
    "scan": _REBORN + "icon_scan_on_psd.png", "glyph": _REBORN + "icon_glyph_on_psd.png",
    "courier": _ICONS + "couriers.svg", "burst": _ICONS + "speed_boost.svg", "shield": _ICONS + "armor.svg",
    "deliver": _ICONS + "arrow_alt_right.svg", "clear": _ICONS + "x_close.svg",
    "buybackProtect": _HUD + "buyback_protection_off_png.png",
    "insetShadow": _REBORN + "ability_inset_shadow_psd.png",
    "backpack": _REBORN + "bg_backpack_psd.png",
    # Ветка талантов: фон при наведении на кнопку и кнопка атрибутов, которая мигает, когда есть очко.
    "treeTip": _REBORN + "statbranch_background_tooltip_psd.png",
    "treeStatSelect": _REBORN + "statbranch_stat_select_bg_psd.png",
    # Таблица по Tab: полоска цвета игрока, выкуп, значки внизу и кнопка «заглушить команду».
    "slotVignette": _REBORN + "scoreboard_playerslot_vignette_psd.png",
    "buyback": _REBORN + "scoreboard_buyback_psd.png",
    "teamMute": _REBORN + "icon_team_mute_psd.png",
    "coaches": _REBORN + "icon_coach_png.png", "combatLog": _REBORN + "icon_combat_log_psd.png",
    "sharedContent": _REBORN + "shared_content_rest_psd.png", "sharedUnits": _REBORN + "sharedunit_rest_png.png",
    "showItems": "panorama/images/control_icons/brackets_png.png",
    # Мини-карта: кольцо-стрелка под героем (их имена без хвоста-хэша, см. _plain_names).
    "mmHeroRing": "materials/vgui/hud/minimap_herocircle_psd.png",
    # Окно магазина: рамка «можно купить», значки строки поиска, гайд, тайник и вкладка нейтральных.
    "shopBorder": _HUD + "shopborder_canpurchase_psd.png", "shopSearch": "panorama/images/control_icons/icon_search_shadow_psd.png",
    "shopSuggest": _REBORN + "icon_suggest_item_psd.png", "shopStar": "panorama/images/icon_star_shadow_hi_psd.png",
    "shopColumns": _HUD + "shop_hud_layout_columns_png.png", "shopTeamItems": _HUD + "team_items_toggle_png.png",
    "guideToggle": _REBORN + "close_guide_btn_psd.png", "itemBuildBg": _REBORN + "bg_item_build_psd.png",
    "pencil": "panorama/images/control_icons/edit_pencil_psd.png", "help": _ICONS + "help.svg",
    "madstone": _HUD + "neutral_currency_icon_png.png",
}
# Меняется, когда программе нужны новые файлы игры: кэш тогда распаковывается заново.
CACHE_VERSION = "9"
# Разделы магазина из scripts/shops.txt — так, как они стоят на вкладках «Основные» и «Улучшения».
SHOP_SECTIONS = {
    "basics": [["consumables", "Расходники"], ["attributes", "Атрибуты"], ["weapons_armor", "Снаряжение"],
               ["misc", "Разное"], ["secretshop", "Потайная лавка"]],
    "upgrades": [["basics", "Аксессуары"], ["support", "Поддержка"], ["magics", "Магия"], ["defense", "Броня"],
                 ["weapons", "Оружие"], ["artifacts", "Вооружение"]],
}
# Стандартная сборка Juggernaut для гайда слева: [предмет, число на иконке].
GUIDE = [
    ["Начальные предметы", [["tango", 2], ["branches", 2], ["quelling_blade", 0], ["slippers", 0], ["circlet", 0], ["faerie_fire", 0], ["ward_observer", 0]]],
    ["Ранняя игра", [["wraith_band", 0], ["phase_boots", 0], ["magic_wand", 0]]],
    ["Середина игры", [["bfury", 0], ["manta", 0], ["sange_and_yasha", 0], ["diffusal_blade", 0]]],
    ["Поздняя игра", [["skadi", 0], ["butterfly", 0], ["abyssal_blade", 0], ["satanic", 0], ["aghanims_shard", 0]]],
    ["Популярные предметы", [["black_king_bar", 0], ["blink", 0], ["monkey_king_bar", 0], ["mjollnir", 0], ["basher", 0],
                             ["swift_blink", 0], ["disperser", 0], ["revenants_brooch", 0]]],
]
PINNED = [["tango", 2], ["clarity", 3], ["enchanted_mango", 3], ["ward_observer", 0], ["flask", 1], ["dust", 2]]
SHOP_FILE = "scripts/shops.txt"


def item_image(name: str) -> str:
    return f"panorama/images/items/{name}_png.png"


def shop_layout(root: Path) -> dict:
    """Разделы магазина с предметами, у которых в кэше есть картинка. Без shops.txt — пусто."""
    path = root / SHOP_FILE
    if not path.is_file():
        return {}
    text = path.read_text("utf8", errors="replace")
    blocks = {name: re.findall(r'"item"\s+"item_(\w+)"', body)
              for name, body in re.findall(r'^\t"(\w+)"[^\n]*\n\t\{(.*?)^\t\}', text, flags=re.S | re.M)}
    have = lambda name: (root / item_image(name)).is_file()
    tabs = {tab: [{"title": title, "items": [i for i in blocks.get(key, []) if have(i)]} for key, title in sections]
            for tab, sections in SHOP_SECTIONS.items()}
    guide = [{"title": title, "items": [[i, n] for i, n in items if have(i)]} for title, items in GUIDE]
    return {**tabs, "guide": guide, "pinned": [[i, n] for i, n in PINNED if have(i)]}


def shop_images(layout: dict) -> list:
    names = {i for tab in ("basics", "upgrades") for section in layout.get(tab, []) for i in section["items"]}
    names |= {i for section in layout.get("guide", []) for i, _ in section["items"]}
    names |= {i for i, _ in layout.get("pinned", [])}
    return sorted(item_image(n) for n in names)


HASHED = re.compile(r"^(.+_psd)_[0-9a-f]{5,8}\.png$")
OVERVIEW = re.compile(r"materials/overviews/dota_(\d+)_psd\S*\.vtex_c")


def _prefixes() -> list:
    heroes = [f"panorama/images/heroes/npc_dota_hero_{h}_png" for h in [HERO, *TEAM_HEROES]]
    spells = [f"panorama/images/spellicons/{s}_png" for s in SPELLS]
    icons = [f"panorama/images/heroes/icons/npc_dota_hero_{h}_png" for h in [HERO, *TEAM_HEROES]]
    items = [f"panorama/images/items/{i}_png" for i in ITEMS]
    return [*DIRS, *PREVIEW_EXTRAS, *heroes, *icons, *spells, *items]


def preview_manifest() -> dict:
    """Какие картинки показывать в превью. Пути — внутри /game/."""
    return {
        "hero": f"panorama/images/heroes/npc_dota_hero_{HERO}_png.png",
        "team": [f"panorama/images/heroes/npc_dota_hero_{h}_png.png" for h in TEAM_HEROES],
        # Пиксельные портреты 32×32: так герои выглядят на мини-карте.
        "icons": [f"panorama/images/heroes/icons/npc_dota_hero_{h}_png.png" for h in [HERO, *TEAM_HEROES]],
        "spells": [f"panorama/images/spellicons/{s}_png.png" for s in SPELLS],
        "items": [f"panorama/images/items/{i}_png.png" for i in ITEMS],
        "overview": "overview.png",
        "innate": "panorama/images/hud/facets/innate_icon_png.png",
        "gold": "panorama/images/hud/reborn/gold_small_psd.png",
        "treeIcon": "panorama/images/hud/reborn/statbranch_select_bg_psd.png",
        "ultReady": "panorama/images/hud/reborn/ult_ready_psd.png",
        "ui": dict(PREVIEW_UI),
    }


class Assets:
    def __init__(self, cfg: Config, run=run_tool):
        self._cfg, self._run = cfg, run
        self._state = {"state": "idle", "message": ""}
        self._lock = threading.Lock()

    @property
    def status(self) -> dict:
        with self._lock:
            return dict(self._state)

    @property
    def root(self) -> Path:
        return self._cfg.cache / str(int(self._cfg.pak01.stat().st_mtime))

    def _set(self, state: str, message: str) -> None:
        with self._lock:
            self._state = {"state": state, "message": message}

    def _extract(self, prefix: str, dest: Path) -> None:
        self._run([self._cfg.decompiler, *self._pak, "-f", prefix, "-o", str(dest), "-d"])

    def _extract_overview(self, dest: Path) -> None:
        _, listing = self._run([self._cfg.decompiler, *self._pak, "--vpk_list"])
        found = [(int(m.group(1)), m.group(0)) for m in OVERVIEW.finditer(listing)]
        if not found:
            return
        name = max(found)[1]
        self._extract(name, dest)
        png = dest / Path(name.replace(".vtex_c", ".png"))
        if png.is_file():
            shutil.copyfile(png, dest / "overview.png")

    @staticmethod
    def _plain_names(root: Path) -> None:
        """Картинки из materials/ лежат с хэшем в имени (minimap_herocircle_psd_9c6f9996.png): копия без него."""
        folder = root / "materials/vgui/hud"
        for path in folder.glob("*.png") if folder.is_dir() else []:
            plain = HASHED.sub(r"\1.png", path.name)
            if plain != path.name:
                shutil.copyfile(path, folder / plain)

    def _prune(self, keep: Path) -> None:
        for path in self._cfg.cache.iterdir():
            if path.is_dir() and path != keep and path.name != VIEW_DIR:
                shutil.rmtree(path)

    def prepare(self) -> None:
        """Распаковка один раз на версию игры: после обновления Dota всё берётся заново."""
        try:
            root = self.root
            marker = root / ".done"
            if not (marker.is_file() and marker.read_text("utf8") == CACHE_VERSION):
                self._set("working", "Распаковываю файлы Dota 2 (один раз, примерно 30 секунд)…")
                root.mkdir(parents=True, exist_ok=True)
                self._pak = reader_args(self._cfg)  # один раз до потоков: копия pak01 создаётся здесь
                with ThreadPoolExecutor(max_workers=4) as pool:
                    list(pool.map(lambda p: self._extract(p, root), _prefixes()))
                self._extract_overview(root)
                self._plain_names(root)
                if not (root / "panorama/styles/hud/hud_reborn.css").is_file():
                    raise FileNotFoundError("Не удалось достать CSS худа из pak01_dir.vpk")
                marker.write_text(CACHE_VERSION, "utf8")
                self._prune(root)
            self._set("ready", "")
        except (OSError, ValueError) as exc:
            self._set("error", str(exc))

    def start(self) -> None:
        threading.Thread(target=self.prepare, daemon=True).start()

    def game_file(self, rel: str) -> Path | None:
        """Безопасно превращает путь из адреса в файл кэша, только PNG."""
        try:
            root = self.root.resolve()
            path = (root / rel).resolve()
        except (OSError, ValueError):
            return None
        return path if path.is_relative_to(root) and path.suffix == ".png" and path.is_file() else None
