"""Разметка худа с видео за портретом: вставка панели и свежесть готового файла на сайте."""
import json
import re
import unittest
from pathlib import Path

from hudstudio import layout, pak
from hudstudio.config import load_config

SITE = Path(__file__).resolve().parent.parent / "docs"
GAME_XML = """<!-- xml reconstructed by Source 2 Viewer -->
<root>
\t\t\t\t\t\t<Panel id="PortraitGroup">
\t\t\t\t\t\t\t<Panel id="PortraitBacker" hittest="false" />
\t\t\t\t\t\t\t<Panel id="PortraitBackerColor" hittest="false" />
\t\t\t\t\t\t</Panel>
</root>
"""


class PatchTest(unittest.TestCase):
    def test_video_goes_inside_the_portrait_backer(self):
        out = layout.patch(GAME_XML, "panorama/videos/hudstudio/portrait.webm")
        self.assertNotIn("<!--", out)
        self.assertIn('<Panel id="PortraitBacker" hittest="false">\n\t\t\t\t\t\t\t\t<MoviePanel id="CustomPortraitVideo" '
                      'src="s2r://panorama/videos/hudstudio/portrait.webm" repeat="true" autoplay="onload" />', out)
        self.assertEqual(re.findall(r'id="(\w+)"', out), ["PortraitGroup", "PortraitBacker", "CustomPortraitVideo", "PortraitBackerColor"])

    def test_changed_portrait_is_refused(self):
        with self.assertRaises(ValueError):
            layout.patch(GAME_XML.replace('hittest="false" />', 'hittest="true" />', 1), "x.webm")
        with self.assertRaises(ValueError):
            layout.patch(layout.patch(GAME_XML, "x.webm").replace(">\n\t\t\t\t\t\t\t\t<Movie", " />\n<Movie", 1), "x.webm")

    def test_video_path_comes_from_the_catalog(self):
        self.assertEqual(layout.video_control()["game_path"], "panorama/videos/hudstudio/portrait.webm")


class SignatureTest(unittest.TestCase):
    def test_signature_section_is_dropped(self):
        tree, md5, other, sig = b"T" * 5, b"M" * 3, b"O" * 2, b"S" * 20
        data = pak.HEADER.pack(pak.VPK_MAGIC, 2, len(tree), 0, len(md5), len(other), len(sig)) + tree + md5 + other + sig
        out = pak.without_signature(data)
        self.assertEqual(out, pak.HEADER.pack(pak.VPK_MAGIC, 2, 5, 0, 3, 2, 0) + tree + md5 + other)
        with self.assertRaises(ValueError):
            pak.without_signature(data + b"x")


def latest_cache():
    cache = load_config().cache
    found = sorted(p for p in cache.glob("*/panorama/layout/hud/hud_reborn.xml")) if cache.is_dir() else []
    return found[-1] if found else None


@unittest.skipIf(latest_cache() is None, "кэш файлов игры ещё не создан")
class FreshLayoutTest(unittest.TestCase):
    def test_site_layout_was_built_from_current_game(self):
        """После обновления Dota: python3 -m hudstudio.layout (его вызывает ./update.sh)."""
        source = latest_cache()
        meta = json.loads((SITE / layout.SITE_META).read_text("utf8"))
        self.assertEqual(meta["cache"], source.parents[3].name)
        xml = layout.patch(source.read_text("utf8"), layout.video_control()["game_path"])
        self.assertEqual(meta["panels"], len(re.findall(r'\bid="', xml)))
        self.assertTrue((SITE / layout.SITE_FILE).is_file())
