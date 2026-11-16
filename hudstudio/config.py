"""Пути и настройки. Любой путь можно заменить переменной окружения."""

import os
from dataclasses import dataclass
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Config:
    game_dir: Path     # game/dota, где лежит pak01_dir.vpk
    data_dir: Path     # кэш файлов игры: только внутри проекта
    site_dir: Path     # готовый сайт, который публикуется на GitHub Pages
    decompiler: str

    @property
    def pak01(self) -> Path:
        return self.game_dir / "pak01_dir.vpk"

    @property
    def cache(self) -> Path:
        return self.data_dir / "cache"


def load_config() -> Config:
    env = os.environ.get
    dota = Path(env("HUDSTUDIO_DOTA", str(Path.home() / "Dota2_Folder")))
    return Config(
        game_dir=dota / "game/dota",
        data_dir=Path(env("HUDSTUDIO_DATA", str(PROJECT_DIR))),
        site_dir=Path(env("HUDSTUDIO_SITE", str(PROJECT_DIR / "docs"))),
        decompiler=env("HUDSTUDIO_DECOMPILER", "Source2Viewer-CLI"),
    )
