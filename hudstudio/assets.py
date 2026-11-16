"""Достаёт из pak01_dir.vpk оригинальный CSS и картинки: для превью и для сборки."""

import re
import shutil
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .tools import run_tool
from .config import Config

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
    "panorama/images/hud/pip_",
    "panorama/images/control_icons/brackets_png",
    "materials/vgui/hud/minimap_creepcamp_psd", "materials/vgui/hud/minimap_herocircle_psd",
]
_REBORN = "panorama/images/hud/reborn/"
_HUD = "panorama/images/hud/"
_ICONS = "panorama/images/control_icons/24px/"
_ATTR = "panorama/images/primary_attribute_icons/mini_primary_attribute_icon_"
# Картинки игры, из которых превью собирает части худа, не имеющие своих настроек.
PREVIEW_UI = {
    "attrPips": _HUD + "attributes_pips_background_7_png.png",
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
    # Мини-карта: значок лагеря и кольцо-стрелка под героем (их имена без хвоста-хэша, см. _plain_names).
    "mmCamp": "materials/vgui/hud/minimap_creepcamp_psd.png", "mmHeroRing": "materials/vgui/hud/minimap_herocircle_psd.png",
}
# Меняется, когда программе нужны новые файлы игры: кэш тогда распаковывается заново.
CACHE_VERSION = "6"
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
        self._run([self._cfg.decompiler, "-i", str(self._cfg.pak01), "-f", prefix, "-o", str(dest), "-d"])

    def _extract_overview(self, dest: Path) -> None:
        _, listing = self._run([self._cfg.decompiler, "-i", str(self._cfg.pak01), "--vpk_list"])
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
        """Картинки из materials/ лежат с хэшем в имени (minimap_creepcamp_psd_72d26740.png): копия без него."""
        folder = root / "materials/vgui/hud"
        for path in folder.glob("*.png") if folder.is_dir() else []:
            plain = HASHED.sub(r"\1.png", path.name)
            if plain != path.name:
                shutil.copyfile(path, folder / plain)

    def _prune(self, keep: Path) -> None:
        for path in self._cfg.cache.iterdir():
            if path.is_dir() and path != keep:
                shutil.rmtree(path)

    def prepare(self) -> None:
        """Распаковка один раз на версию игры: после обновления Dota всё берётся заново."""
        try:
            root = self.root
            marker = root / ".done"
            if not (marker.is_file() and marker.read_text("utf8") == CACHE_VERSION):
                self._set("working", "Распаковываю файлы Dota 2 (один раз, примерно 30 секунд)…")
                root.mkdir(parents=True, exist_ok=True)
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
