"""Прогон в настоящей Dota: ставит пробный мод, запускает демо героя, снимает скриншот и всё убирает.

Запуск (нужны python-evdev, opencv, grim, Source2Viewer-CLI):
    python3 dota_session.py <mod.vpk | -> <скриншот.png> <герой>
Вместо мода «-» — снимок обычной игры без мода. Герой — внутреннее имя: juggernaut, kez...

Как управляем игрой (всё проверено на этой машине):
- сетевой консоли (-netconport) в Linux-версии нет, клавиши через X11 (xdotool, wtype) до игры не доходят;
- привязки клавиш из своего cfg игра стирает, когда загружает сохранённые клавиши игрока;
- зато доходит виртуальная мышь через /dev/uinput. Демо-режим запускается параметром
  +dota_launch_custom_game, на экране выбора скрипт находит карточку героя по картинке из файлов игры
  и кликает её, потом «Выбрать», а на стадии планирования — «Продолжить». Кнопка «Поменять героя» в демо без героя не работает,
  поэтому каждый герой — отдельный запуск игры.
"""
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import cv2
from evdev import AbsInfo, UInput, ecodes

GAME = Path.home() / ".local/share/Steam/steamapps/common/dota 2 beta/game"
LOG = GAME / "dota/console.log"
MOD_SLOT = GAME / "dota_russian/pak79_dir.vpk"  # слот, которого нет среди модов пользователя
PAK01 = GAME / "dota/pak01_dir.vpk"
CARDS = Path(__file__).resolve().parents[2] / "cache/ingame_cards"  # картинки карточек героев
OUTPUT = os.environ.get("HUDSTUDIO_OUTPUT", "HDMI-A-1")  # монитор для grim
SCREEN = (1920, 1080)
PICK_BUTTON = (1476, 824)  # «Выбрать» на экране выбора героя (1920×1080)
CONTINUE_BUTTON = (84, 810)  # «Продолжить» на стадии планирования
REST_POINT = (960, 330)  # куда убрать курсор: в мир, подальше от худа и краёв (у краёв камера едет)
SETTLE_MIN = 8  # после появления героя демо секунд на 10 затемняет экран — раньше не снимаем
SETTLE_MAX = 90
EMPTY_GAMEINFO = '"GameInfo"\n{\n\tgame "Dota 2"\n\tFileSystem\n\t{\n\t\tSearchPaths\n\t\t{\n\t\t}\n\t}\n}\n'


def log_text() -> str:
    return LOG.read_text("utf8", "replace") if LOG.is_file() else ""


def game_running() -> bool:
    return subprocess.run(["pgrep", "-x", "dota2"], capture_output=True).returncode == 0


def wait_log(needle: str, timeout: float) -> None:
    end = time.time() + timeout
    while time.time() < end:
        if needle in log_text():
            return
        time.sleep(1)
    raise TimeoutError(f"Не дождался в журнале игры: {needle}")


def grab(path: Path) -> None:
    subprocess.run(["grim", "-o", OUTPUT, str(path)], check=True)


def hero_card(hero: str) -> Path:
    """Картинка карточки героя из сетки выбора (panorama/images/heroes/selection)."""
    rel = f"panorama/images/heroes/selection/npc_dota_hero_{hero}_png"
    png = CARDS / f"{rel}.png"
    if not png.is_file():
        # pak01 после обновления 25.11.2026 Source2Viewer 21.1 не открывает: файл достаёт vpkeditcli.
        raw = CARDS / f"{rel}.vtex_c"
        raw.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["vpkeditcli", str(PAK01), "--extract", f"{rel}.vtex_c", "-o", str(raw), "--no-progress"],
                       capture_output=True, check=True, timeout=300)
        # Пустой gameinfo.gi: иначе Source2Viewer сам подгружает VPK игры и падает на них же.
        nogame = CARDS / "nogame/dota"
        nogame.mkdir(parents=True, exist_ok=True)
        (nogame / "gameinfo.gi").write_text(EMPTY_GAMEINFO, "utf8")
        subprocess.run([str(Path(__file__).resolve().parents[1] / "s2v.sh"), "-i", str(raw), "--game", str(nogame), "-o", str(png), "-d"],
                       capture_output=True, check=True, timeout=300)
    if not png.is_file():
        raise FileNotFoundError(f"Нет картинки героя {hero} в файлах игры")
    return png


def find_cards(shot: Path, card: Path, count: int = 6) -> list:
    """Лучшие места карточки героя на скриншоте (центры), от самого похожего. Масштаб подбираем."""
    import numpy as np
    image, template = cv2.imread(str(shot)), cv2.imread(str(card))
    found = []
    for width in range(36, 90, 2):
        height = round(width * template.shape[0] / template.shape[1])
        scaled = cv2.resize(template, (width, height), interpolation=cv2.INTER_AREA)
        result = cv2.matchTemplate(image, scaled, cv2.TM_CCOEFF_NORMED)
        for y, x in zip(*np.where(result > 0.45)):
            found.append((float(result[y, x]), x + width // 2, y + height // 2))
    found.sort(reverse=True)
    picked = []
    for score, x, y in found:  # соседние карточки стоят в 40+ px — ближе считаем тем же местом
        if all(abs(x - px) > 20 or abs(y - py) > 20 for _, px, py in picked):
            picked.append((score, int(x), int(y)))
        if len(picked) == count:
            break
    return picked


def hero_in_log(marker: str, after: int):
    """Имя героя из последней строки «marker … npc_dota_hero_X» после позиции after в журнале."""
    import re
    names = re.findall(marker + r"[^\n]*npc_dota_hero_(\w+)\(", log_text()[after:])
    return names[-1] if names else None


def wait_settled(shot: Path) -> None:
    """Ждёт, пока экран станет светлым и перестанет меняться (два кадра подряд почти одинаковые)."""
    start, previous = time.time(), None
    time.sleep(SETTLE_MIN)
    while time.time() - start < SETTLE_MAX:
        grab(shot)
        frame = cv2.cvtColor(cv2.imread(str(shot)), cv2.COLOR_BGR2GRAY)
        if frame.mean() > 20 and previous is not None and cv2.absdiff(frame, previous).mean() < 1.5:
            return
        previous = frame
        time.sleep(2)
    raise TimeoutError("Экран игры не успокоился: скриншот может быть неточным")


class Pointer:
    """Виртуальная мышь с абсолютными координатами экрана."""

    def __init__(self):
        caps = {ecodes.EV_KEY: [ecodes.BTN_LEFT],
                ecodes.EV_ABS: [(ecodes.ABS_X, AbsInfo(0, 0, SCREEN[0] - 1, 0, 0, 0)),
                                (ecodes.ABS_Y, AbsInfo(0, 0, SCREEN[1] - 1, 0, 0, 0))]}
        self.device = UInput(caps, name="hudstudio-test-pointer", input_props=[ecodes.INPUT_PROP_POINTER])
        time.sleep(1.5)  # система должна увидеть новое устройство

    def move(self, x: int, y: int) -> None:
        self.device.write(ecodes.EV_ABS, ecodes.ABS_X, x)
        self.device.write(ecodes.EV_ABS, ecodes.ABS_Y, y)
        self.device.syn()
        time.sleep(0.4)

    def click(self, x: int, y: int) -> None:
        self.move(x, y)
        self.device.write(ecodes.EV_KEY, ecodes.BTN_LEFT, 1)
        self.device.syn()
        time.sleep(0.2)
        self.device.write(ecodes.EV_KEY, ecodes.BTN_LEFT, 0)
        self.device.syn()
        time.sleep(0.8)

    def close(self) -> None:
        self.device.close()


def run(mod: Path | None, shot: Path, hero: str) -> None:
    if game_running():
        raise RuntimeError("Dota уже запущена: закройте её перед проверкой")
    if MOD_SLOT.exists():
        raise RuntimeError(f"{MOD_SLOT} уже существует: это не наш файл, не трогаю")
    card = hero_card(hero)
    pointer = None
    try:
        if mod:
            shutil.copyfile(mod, MOD_SLOT)
        LOG.write_text("", "utf8")
        subprocess.Popen(["steam", "-applaunch", "570", "-condebug",
                          "+dota_launch_custom_game", "hero_demo", "hero_demo_main"],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        wait_log("C:Gamerules: entering state 'DOTA_GAMERULES_STATE_HERO_SELECTION'", 300)
        time.sleep(4)  # сетка героев дорисовывается
        pointer = Pointer()
        picker = shot.with_name(shot.stem + "_выбор.png")
        grab(picker)
        for score, x, y in find_cards(picker, card):  # кликаем, пока игра не подсветит нужного героя
            mark = len(log_text())
            pointer.click(x, y)
            time.sleep(1.5)
            if hero_in_log("SetPossibleHeroSelection", mark) == hero:
                break
        else:
            raise RuntimeError(f"Не удалось выбрать героя {hero} на экране выбора")
        mark = len(log_text())
        pointer.click(*PICK_BUTTON)
        time.sleep(1.5)
        if hero_in_log("SetSelectedHero", mark) != hero:
            raise RuntimeError(f"Игра выбрала не того героя (нужен {hero})")
        wait_log("C:Gamerules: entering state 'DOTA_GAMERULES_STATE_STRATEGY_TIME'", 120)
        time.sleep(3)
        pointer.click(*CONTINUE_BUTTON)  # «Продолжить» на стадии планирования: не ждём её таймер
        wait_log("spawnedUnit is player's hero", 120)
        pointer.move(*REST_POINT)
        wait_settled(shot)
        click = os.environ.get("HUDSTUDIO_CLICK")  # «x,y»: после снимка кликнуть (открыть ветку талантов) и снять ещё раз
        if click:  # «hover:x,y» — только навести мышь (ветка талантов при наведении)
            hover = click.startswith("hover:")
            point = tuple(map(int, click.removeprefix("hover:").split(",")))
            if hover:
                pointer.move(*point)
            else:
                pointer.click(*point)
                pointer.move(*REST_POINT)
            time.sleep(2)
            grab(shot.with_name(shot.stem + "_клик.png"))
        picker.unlink(missing_ok=True)
        print(f"скриншот игры: {shot}")
    finally:
        if pointer:
            pointer.close()
        if game_running():
            subprocess.run(["pkill", "-TERM", "-x", "dota2"])
            for _ in range(60):
                if not game_running():
                    break
                time.sleep(1)
        MOD_SLOT.unlink(missing_ok=True)


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    mod = None if sys.argv[1] == "-" else Path(sys.argv[1])
    shot = Path(sys.argv[2])
    shot.parent.mkdir(parents=True, exist_ok=True)
    run(mod, shot, sys.argv[3])


if __name__ == "__main__":
    main()
