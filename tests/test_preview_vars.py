"""Каждая настройка должна что-то менять в живом превью."""
import unittest
from pathlib import Path

from hudstudio import catalog

WEB = Path(__file__).resolve().parent.parent / "docs"


class PreviewVarsTest(unittest.TestCase):
    def test_every_setting_reaches_the_preview(self):
        css = (WEB / "styles/preview.css").read_text("utf8")
        js = "".join(p.read_text("utf8") for p in (WEB / "js").glob("preview*.js"))
        missing = []
        for cid, control in catalog.controls().items():
            name = "--" + cid.replace(".", "-")
            found = (f"'{cid}'" in js or cid.endswith(".fillImg")) if control["type"] == "image" else f"var({name}" in css
            if not found and cid not in catalog.GAME_ONLY:
                missing.append(cid)
        self.assertEqual(missing, [])
