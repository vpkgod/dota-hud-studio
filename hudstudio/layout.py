"""Готовая разметка худа с видео за портретом: сайт кладёт её в мод, если человек выбрал видео.

Стиль сайт собирает сам, а разметку (vxml_c) в браузере не собрать: её компилирует resourcecompiler
Valve под wine. Разметка — копия hud_reborn.xml ТЕКУЩЕЙ версии игры плюс одна MoviePanel, поэтому
после каждого обновления Dota её надо собрать заново (это делает ./update.sh).

Запуск: python3 -m hudstudio.layout
"""

import json
import re
import shutil
import sys
from pathlib import Path

from . import catalog
from .assets import Assets
from .config import Config, load_config
from .tools import run_tool

SOURCE = "panorama/layout/hud/hud_reborn.xml"
SITE_FILE = "layout/hud_reborn.vxml_c"
SITE_META = "layout/source.json"
ADDON = "hudstudio_layout"
BACKER = '<Panel id="PortraitBacker" hittest="false" />'
VIDEO_ID = "CustomPortraitVideo"


def video_control() -> dict:
    return catalog.controls()["por.video"]


def patch(xml: str, video_path: str) -> str:
    """Вставляет MoviePanel в #PortraitBacker. Остальная разметка остаётся как в игре."""
    text = re.sub(r"^<!--.*?-->\s*\n", "", xml)  # строка-комментарий декомпилятора
    if text.count(BACKER) != 1:
        raise ValueError(f"В hud_reborn.xml нет ровно одного {BACKER}: Valve поменяли портрет, нужна ручная правка")
    if VIDEO_ID in text:
        raise ValueError("В разметке игры уже есть панель с видео — это не оригинал игры")
    panel = (f'<Panel id="PortraitBacker" hittest="false">\n'
             f'\t\t\t\t\t\t\t\t<MoviePanel id="{VIDEO_ID}" src="s2r://{video_path}" repeat="true" autoplay="onload" />\n'
             f'\t\t\t\t\t\t\t</Panel>')
    return text.replace(BACKER, panel)


def _dota_root(cfg: Config) -> Path:
    # game/dota → корень Dota. Настоящий путь: resourcecompiler не узнаёт свою папку через ссылку (~/Dota2_Folder)
    return cfg.game_dir.parent.parent.resolve()


def _compile(cfg: Config, xml: str, run) -> bytes:
    root = _dota_root(cfg)
    compiler = root / "game/bin/win64/resourcecompiler.exe"
    if not compiler.is_file():
        raise FileNotFoundError(f"Нет {compiler} (Workshop Tools)")
    source = root / "content/dota_addons" / ADDON / SOURCE
    output = root / "game/dota_addons" / ADDON / Path(SOURCE).with_suffix(".vxml_c")
    source.parent.mkdir(parents=True, exist_ok=True)
    source.write_text(xml, "utf8")
    output.unlink(missing_ok=True)
    code, log = run(["wine", "resourcecompiler.exe", "-i", str(source), "-game", "dota", "-nop4", "-f"],
                    cwd=compiler.parent, timeout=600)
    if "OK: 1 compiled, 0 failed" not in log or not output.is_file():
        raise RuntimeError(f"resourcecompiler не собрал разметку (код {code}):\n{log[-2000:]}")
    return output.read_bytes()


def _check(cfg: Config, compiled: Path, expected: str, run) -> None:
    """Собранный файл распаковываем обратно: он должен совпасть с исходником по панелям."""
    code, log = run([cfg.decompiler, "-i", str(compiled), "-b", "DATA"])
    text = log.split('--- Data for block "DATA" ---', 1)[-1]
    want = re.findall(r'<(\w+)[^>]*\bid="([^"]+)"', expected)
    got = re.findall(r'<(\w+)[^>]*\bid="([^"]+)"', text)
    if code != 0 or not got or got != want:
        raise RuntimeError(f"Собранная разметка не совпала с исходником (панелей {len(got)} из {len(want)})")


def build(cfg: Config, run=run_tool) -> Path:
    assets = Assets(cfg, run)
    assets.prepare()
    if assets.status["state"] != "ready":
        raise RuntimeError(assets.status["message"])
    xml = patch((assets.root / SOURCE).read_text("utf8"), video_control()["game_path"])
    compiled = _compile(cfg, xml, run)
    target = cfg.site_dir / SITE_FILE
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(compiled)
    _check(cfg, target, xml, run)
    meta = {"cache": assets.root.name, "panels": len(re.findall(r'\bid="', xml))}
    (cfg.site_dir / SITE_META).write_text(json.dumps(meta), "utf8")
    shutil.rmtree(_dota_root(cfg) / "game/dota_addons" / ADDON, ignore_errors=True)
    return target


def main() -> None:
    cfg = load_config()
    try:
        target = build(cfg)
    except (OSError, ValueError, RuntimeError) as exc:
        sys.exit(f"Не получилось собрать разметку с видео: {exc}")
    print(f"Готово: {target}")


if __name__ == "__main__":
    main()
