"""Проверка по файлам игры: превью не должно расходиться с Dota из-за соседних панелей и цвета под картинкой."""
import unittest

from hudstudio import audit
from hudstudio.config import load_config


def _root():
    try:
        return audit._latest(load_config().cache)
    except SystemExit:
        return None


@unittest.skipIf(_root() is None, "кэш файлов игры ещё не создан")
class AuditTest(unittest.TestCase):
    def setUp(self):
        root = _root()
        self.rules = audit._rules(root / "styles")
        self.panels = audit._layouts(root / "layout")

    def test_no_static_neighbours_of_moved_blocks(self):
        """Всё, что стоит на месте двигаемого блока, должно двигаться вместе с ним (carry)."""
        self.assertEqual(audit.neighbours(self.rules, self.panels, audit._moved_ids()), [])

    def test_no_colour_hidden_under_images(self):
        """Если у панели в игре есть цвет фона, рядом с картинкой нужна настройка этого цвета."""
        self.assertEqual(audit.colour_under_image(self.rules), [])
