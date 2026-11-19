"""Подготовка данных сайта: чтение файлов игры и запись каталога, стилей и картинок."""
import json
import struct
import tempfile
import unittest
import zlib
from pathlib import Path

from hudstudio import assets, catalog, export, resource
from hudstudio.config import Config


def compiled_style(text: str, names=()) -> bytes:
    """Собранный стиль в том виде, как он лежит в pak01: блок сведений и блок данных."""
    body = text.encode("utf8")
    listed = b"".join(name.encode("utf8") + b"\0" + struct.pack("<II", 1, 2) for name in names)
    data = struct.pack("<IH", zlib.crc32(body), len(names)) + listed + body
    info = b"\0" * 20
    table_end = 16 + 2 * 12
    data_at = table_end + len(info) + (-(table_end + len(info)) % 16)
    head = struct.pack("<IHHII", data_at + len(data), 12, 3, 8, 2)
    table = b"RED2" + struct.pack("<II", table_end - 20, len(info)) + b"DATA" + struct.pack("<II", data_at - 32, len(data))
    return head + table + info + b"\0" * (data_at - table_end - len(info)) + data


class ResourceTest(unittest.TestCase):
    def test_reads_blocks(self):
        found = resource.blocks(compiled_style(".A{color: red;}"))
        self.assertEqual(sorted(found), ["DATA", "RED2"])
        self.assertEqual(len(found["RED2"]), 20)

    def test_text_without_names(self):
        self.assertEqual(resource.panorama_text(compiled_style(".A{color: red;}")), ".A{color: red;}")

    def test_text_skips_referenced_names(self):
        raw = compiled_style("#B{width: 1px;}", names=("panorama/images/a_psd.vtex", "panorama/images/b_png.vtex"))
        self.assertEqual(resource.panorama_text(raw), "#B{width: 1px;}")


FAKE_PNG = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR" + struct.pack(">II", 72, 40)


class ExportTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        game = root / "dota/game/dota"
        game.mkdir(parents=True)
        (game / "pak01_dir.vpk").write_bytes(b"vpk")
        (game / "steam.inf").write_text("ClientVersion=1234\nVersionDate=Jan 01 2026\n", "utf8")
        self.cfg = Config(game_dir=game, data_dir=root / "data", site_dir=root / "site", decompiler="fake")
        self.cache = self.cfg.cache / str(int(self.cfg.pak01.stat().st_mtime))
        for rel in export.preview_images():
            path = self.cache / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(FAKE_PNG)
        (self.cache / "panorama/styles/hud").mkdir(parents=True, exist_ok=True)
        (self.cache / "panorama/styles/hud/hud_reborn.css").write_text("x", "utf8")
        (self.cache / ".done").write_text(assets.CACHE_VERSION, "utf8")

    def fake_run(self, cmd, cwd=None, timeout=300):
        """Вместо Source2Viewer: кладёт запрошенные файлы в папку назначения."""
        wanted = cmd[cmd.index("-f") + 1].split(",")
        dest = Path(cmd[cmd.index("-o") + 1])
        for rel in wanted:
            if rel in self.missing:
                continue
            target = dest / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(compiled_style(f"/*{rel}*/"))
        return 0, ""

    missing = ()

    def test_writes_everything_the_site_needs(self):
        export.export(self.cfg, run=self.fake_run)
        site = self.cfg.site_dir
        data = json.loads((site / "data/catalog.json").read_text("utf8"))
        self.assertEqual([g["id"] for g in data["groups"]], catalog.GROUP_ORDER)
        self.assertEqual(data["game"], {"build": "1234", "date": "Jan 01 2026"})
        self.assertEqual(data["styles"], export.style_files())
        for name in export.style_files():
            compiled = f"panorama/styles/{name[:-4]}.vcss_c"
            self.assertEqual((site / "gamecss" / name).read_text("utf8"), f"/*{compiled}*/")
        for rel in export.preview_images():
            self.assertTrue((site / "game" / rel).is_file(), rel)
        self.assertEqual(set(data["sizes"]), set(export.originals()))
        self.assertEqual(data["sizes"]["panorama/images/hud/facets/innate_icon_large_png.png"], [72, 40])

    def test_every_replaced_game_file_can_be_downloaded(self):
        for control in catalog.controls().values():
            if control.get("replace"):
                self.assertEqual(control["originals"], [f"{p}.png" for p in control["replace"]])
            elif control["type"] == "image":
                self.assertEqual(control["originals"], [control["preview"]] if control["preview"] else [])

    def test_every_setting_knows_its_style_file(self):
        files = set(export.style_files())
        self.assertTrue(files)
        for control in catalog.controls().values():
            for target in control["emit"]:
                self.assertIn(target["file"], files)

    def test_missing_game_style_is_reported(self):
        self.missing = (f"panorama/styles/{export.style_files()[0][:-4]}.vcss_c",)
        with self.assertRaises(FileNotFoundError):
            export.export(self.cfg, run=self.fake_run)

    def test_missing_preview_image_is_reported(self):
        (self.cache / export.preview_images()[0]).unlink()
        with self.assertRaises(FileNotFoundError):
            export.export(self.cfg, run=self.fake_run)


if __name__ == "__main__":
    unittest.main()
