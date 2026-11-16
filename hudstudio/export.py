"""Готовит данные сайта: каталог настроек, стили игры и картинки превью.

Запуск: python3 -m hudstudio.export. Повторять после каждого обновления Dota 2.
"""

import json
import shutil
import sys
import tempfile
from pathlib import Path

from . import catalog, resource
from .assets import Assets, preview_manifest
from .config import Config, load_config
from .tools import run_tool

STYLE_DIR = "panorama/styles/"


def style_files() -> list:
    return sorted({target["file"] for control in catalog.controls().values() for target in control["emit"]})


def preview_images() -> list:
    manifest = preview_manifest()
    listed = [manifest["hero"], *manifest["team"], *manifest["icons"], *manifest["spells"], *manifest["items"], manifest["overview"],
              manifest["innate"], manifest["gold"], manifest["treeIcon"], manifest["ultReady"], *manifest["ui"].values()]
    previews = [c["preview"] for c in catalog.controls().values() if c["type"] == "image" and c["preview"]]
    return sorted({*listed, *previews})


def _dump_raw(cfg: Config, paths: list, dest: Path, run) -> None:
    """Достаёт файлы из pak01 как есть, без расшифровки."""
    code, log = run([cfg.decompiler, "-i", str(cfg.pak01), "-f", ",".join(paths), "-o", str(dest)])
    missing = [p for p in paths if not (dest / p).is_file()]
    if missing:
        raise FileNotFoundError(f"В pak01_dir.vpk нет файлов: {', '.join(missing)}\n{log}")


def _game_version(cfg: Config) -> dict:
    info = {}
    try:
        for line in (cfg.game_dir / "steam.inf").read_text("utf8").splitlines():
            key, _, value = line.partition("=")
            info[key.strip()] = value.strip()
    except OSError:
        pass
    return {"build": info.get("ClientVersion", ""), "date": info.get("VersionDate", "")}


def _write_styles(raw: Path, site: Path) -> None:
    target_root = site / "gamecss"
    shutil.rmtree(target_root, ignore_errors=True)
    for name in style_files():
        compiled = raw / STYLE_DIR / Path(name).with_suffix(".vcss_c")
        target = target_root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(resource.panorama_text(compiled.read_bytes()), "utf8")


def _write_images(cache_root: Path, site: Path) -> None:
    target_root = site / "game"
    shutil.rmtree(target_root, ignore_errors=True)
    for rel in preview_images():
        source = cache_root / rel
        if not source.is_file():
            raise FileNotFoundError(f"В кэше игры нет картинки {rel}")
        target = target_root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)


def _write_catalog(cfg: Config, site: Path) -> None:
    data = {"areas": catalog.AREAS, "groups": catalog.groups(), "preview": preview_manifest(),
            "styles": style_files(), "game": _game_version(cfg)}
    target = site / "data/catalog.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), "utf8")


def export(cfg: Config, run=run_tool) -> None:
    assets = Assets(cfg, run)
    assets.prepare()
    if assets.status["state"] != "ready":
        raise RuntimeError(assets.status["message"])
    site = cfg.site_dir
    styles = style_files()
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp)
        _dump_raw(cfg, [f"{STYLE_DIR}{Path(name).with_suffix('.vcss_c')}" for name in styles], raw, run)
        _write_styles(raw, site)
    _write_images(assets.root, site)
    _write_catalog(cfg, site)


def main() -> None:
    cfg = load_config()
    try:
        export(cfg)
    except (OSError, ValueError, RuntimeError) as exc:
        sys.exit(f"Не получилось подготовить сайт: {exc}")
    print(f"Готово: данные сайта обновлены в {cfg.site_dir}")


if __name__ == "__main__":
    main()
