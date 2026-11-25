"""Как дать Source2Viewer-CLI прочитать pak01 игры.

С обновления Dota 25.11.2026 раздел подписи в VPK стал 20 байт нового вида, а Source2Viewer 21.1 читает
его по-старому и падает («Invalid public key size in the signature section»). Падает он и на чужих
VPK, которые подгружает по gameinfo.gi игры (game/Dota2SkinChanger, dota_russian, core).

Поэтому: в кэше лежит копия pak01_dir.vpk без раздела подписи (остальное побайтно то же, архивы
pak01_NNN.vpk — ссылки на файлы игры), а пути игры берутся из пустого gameinfo.gi.
"""

import struct
from pathlib import Path

from .config import Config

HEADER = struct.Struct("<7I")  # сигнатура, версия, дерево, данные, MD5 архивов, MD5 прочего, подпись
VPK_MAGIC = 0x55AA1234
EMPTY_GAMEINFO = '"GameInfo"\n{\n\tgame "Dota 2"\n\tFileSystem\n\t{\n\t\tSearchPaths\n\t\t{\n\t\t}\n\t}\n}\n'


def without_signature(data: bytes) -> bytes:
    """Тот же VPK v2, но без раздела подписи (он лежит последним)."""
    magic, version, *sizes = HEADER.unpack_from(data)
    if magic != VPK_MAGIC or version != 2:
        raise ValueError("pak01_dir.vpk — не VPK версии 2")
    signature = sizes[-1]
    if HEADER.size + sum(sizes) != len(data):
        raise ValueError("Размеры разделов pak01_dir.vpk не сходятся с размером файла")
    head = HEADER.pack(magic, version, *sizes[:-1], 0)
    return head + data[HEADER.size:len(data) - signature]


VIEW_DIR = "pakview"


def _view_dir(cfg: Config) -> Path:
    return cfg.cache / VIEW_DIR


def _needs_view(head: bytes) -> bool:
    if len(head) < HEADER.size:
        return False
    magic, version, *sizes = HEADER.unpack_from(head)
    return magic == VPK_MAGIC and version == 2 and sizes[-1] > 0


def reader_args(cfg: Config) -> list:
    """Аргументы Source2Viewer-CLI для чтения pak01: ['-i', копия, '--game', пустая игра].
    Файл без подписи (или не VPK — тогда ошибку покажет сам Source2Viewer) читается как есть."""
    with cfg.pak01.open("rb") as file:
        if not _needs_view(file.read(HEADER.size)):
            return ["-i", str(cfg.pak01)]
    view = _view_dir(cfg)
    stamp = str(int(cfg.pak01.stat().st_mtime))
    copy = view / "pak" / "pak01_dir.vpk"
    marker = view / "pak" / ".stamp"
    if not (copy.is_file() and marker.is_file() and marker.read_text("utf8") == stamp):
        copy.parent.mkdir(parents=True, exist_ok=True)
        for old in copy.parent.glob("pak01_*.vpk"):
            old.unlink()
        for chunk in sorted(cfg.pak01.parent.glob("pak01_[0-9][0-9][0-9].vpk")):
            (copy.parent / chunk.name).symlink_to(chunk)
        copy.write_bytes(without_signature(cfg.pak01.read_bytes()))
        marker.write_text(stamp, "utf8")
    game = view / "game" / "dota"
    game.mkdir(parents=True, exist_ok=True)
    (game / "gameinfo.gi").write_text(EMPTY_GAMEINFO, "utf8")
    return ["-i", str(copy), "--game", str(game)]
