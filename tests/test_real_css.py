"""Каждый селектор каталога должен существовать в настоящем CSS текущей версии Dota."""
import re
import unittest
from pathlib import Path

from hudstudio import catalog, layout
from hudstudio.config import load_config


# Панели, которые движок создаёт сам, поэтому в layout-файлах их нет.
CREATED_BY_GAME_CODE = {"CircularXPProgress_FG", "CircularXPProgressBlur_FG", "PlaceholderText"}
# Панели, которые добавляет наша разметка худа (hudstudio/layout.py), а не игра.
OUR_PANELS = {layout.VIDEO_ID}


def latest_styles():
    cache = load_config().cache
    roots = sorted(cache.glob("*/panorama/styles")) if cache.is_dir() else []
    return roots[-1] if roots else None


@unittest.skipIf(latest_styles() is None, "кэш файлов игры ещё не создан")
class RealCssTest(unittest.TestCase):
    def test_selector_tokens_exist_in_target_file(self):
        styles, missing = latest_styles(), []
        # Класс без своих стилей тоже годится, если панель с ним есть в layout игры (.LeftRightFlow).
        xml = "".join(p.read_text("utf8", "replace") for p in (styles.parent / "layout").rglob("*.xml"))
        layout_classes = {f".{c}" for attr in re.findall(r'\bclass="([^"]+)"', xml) for c in attr.split()}
        for cid, control in catalog.controls().items():
            for target in control["emit"]:
                text = (styles / target["file"]).read_text("utf8")
                for selector in target["sel"]:
                    for token in re.findall(r"[#.][A-Za-z_][\w-]*", selector):
                        if token not in text and token not in layout_classes and token[1:] not in OUR_PANELS:
                            missing.append((cid, target["file"], token))
        self.assertEqual(missing, [])

    def test_ids_exist_in_game_layouts(self):
        """Панель должна существовать: CSS может упоминать #id, которого в игре давно нет."""
        root = latest_styles().parent / "layout"
        xml = "".join(p.read_text("utf8", "replace") for p in root.rglob("*.xml"))
        ids = set(re.findall(r'\bid="([^"]+)"', xml))
        missing = []
        for cid, control in catalog.controls().items():
            for target in control["emit"]:
                for selector in target["sel"]:
                    missing += [(cid, t) for t in re.findall(r"#([A-Za-z_][\w-]*)", selector)
                                if t not in ids and t not in CREATED_BY_GAME_CODE and t not in OUR_PANELS]
        self.assertEqual(missing, [])

    def test_every_image_preview_exists(self):
        """Без исходного файла оригинальную картинку нельзя показать и перекрасить."""
        root = latest_styles().parent.parent
        missing = [c["id"] for c in catalog.controls().values()
                   if c["type"] == "image" and c["preview"] and not (root / c["preview"]).is_file()]
        self.assertEqual(missing, [])

    def test_replaced_textures_exist_in_game(self):
        root = latest_styles().parent.parent
        for control in catalog.controls().values():
            for path in control.get("replace", []):
                self.assertTrue((root / f"{path}.png").is_file(), path)

    def test_every_property_is_used_by_the_game(self):
        """Компилятор Valve пропускает выдуманные свойства, поэтому сверяем с CSS игры."""
        styles = latest_styles()
        text = "".join(p.read_text("utf8") for p in styles.rglob("*.css"))
        props = {t["prop"] for c in catalog.controls().values() for t in c["emit"] if "prop" in t}
        props |= {"text-shadow", "box-shadow", "background-img-opacity", "background-size", "background-position", "background-repeat", "background-image"}
        missing = sorted(p for p in props if f"{p}:" not in text)
        self.assertEqual(missing, [])

    def test_numeric_defaults_match_game(self):
        styles = latest_styles()
        text = (styles / "hud/hud_reborn.css").read_text("utf8")
        self.assertIn("width: 244px", text)
        health = (styles / "hud/dota_hud_health_mana.css").read_text("utf8")
        self.assertIn("#425d25", health)
