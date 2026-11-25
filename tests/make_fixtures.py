"""Пишет tests/js/parity.json: случайные настройки и то, что из них делает Python.

Тест на JS (tests/js/parity.test.mjs) проверяет, что сайт выдаёт то же самое.
"""
import json
import random
from pathlib import Path

from hudstudio import catalog, cssgen, values

CASES = 60
COLORS = ["#ff0000", "#00FF0080", "#123456", "red", "#12345", 7, None]
IDS = ["0123456789abcdef", "fedcba9876543210", "nope", ""]


def _fill(rng):
    count = rng.choice([1, 2, 2, 3, 4, 5])
    same = rng.random() < 0.2
    first = rng.choice(COLORS[:3])
    stops = [{"p": rng.choice([0, 0.25, 0.5, 0.3333, 1, 1.5, -1]), "c": first if same else rng.choice(COLORS[:4])}
             for _ in range(count)]
    return {"dir": rng.choice(["v", "h", "x"]), "stops": stops}


def _image(rng):
    value = {"id": rng.choice(IDS), "fit": rng.choice(["stretch", "cover", "contain", "original", "weird"]),
             "opacity": rng.choice([1, 0.5, 0.3333, 2, "x"])}
    if rng.random() < 0.4:
        value["tint"] = {"fill": _fill(rng), "mode": rng.choice(["keep", "flood", "x"]),
                         "strength": rng.choice([50, 150, "x"]), "bright": rng.choice([0, -200, 30])}
        value["base"] = rng.choice(IDS + [None])
    return value


def _shadow(rng):
    return {"on": rng.choice([True, False, "yes"]), "c": rng.choice(COLORS), "w": rng.choice([1, 2.5, 3.5, 4, 20, 0])}


def _random_value(control, rng):
    kind = control["type"]
    if rng.random() < 0.08:
        return rng.choice([None, "junk", 12, [], {}])
    if kind == "color":
        return rng.choice(COLORS)
    if kind == "num":
        span = control["max"] - control["min"]
        return rng.choice([control["min"] + rng.random() * span, control["min"] + rng.randrange(0, int(span) + 1),
                           control["max"] + 5, control["min"] - 5, True])
    if kind == "toggle":
        return rng.choice([True, False, 1])
    if kind == "offset":
        return {"x": rng.choice([0, 12.5, -13.5, 3000, "a"]), "y": rng.choice([0, 7, -2000, 0.5])}
    if kind == "fill":
        return _fill(rng)
    if kind == "image":
        return _image(rng)
    if kind == "video":
        return {"id": rng.choice(IDS), "fit": rng.choice(["cover", "contain", "stretch", "x"]),
                "w": rng.choice([736, 1280, 320, 159, 0, 5000, 12.5, True]), "h": rng.choice([736, 720, 145, 406, 1, -3])}
    return _shadow(rng)


def make_cases(seed=7):
    rng = random.Random(seed)
    controls = list(catalog.controls().values())
    cases = []
    for _ in range(CASES):
        share = rng.choice([0.05, 0.3, 1])
        raw = {c["id"]: _random_value(c, rng) for c in controls if rng.random() < share}
        clean = values.sanitize(raw)
        cases.append({"raw": raw, "clean": clean, "css": cssgen.generate(clean),
                      "images": sorted(cssgen.images_used(clean)), "replaced": cssgen.replaced_textures(clean),
                      "videos": cssgen.videos_used(clean)})
    return cases


def main():
    target = Path(__file__).resolve().parent / "js/parity.json"
    target.write_text(json.dumps(make_cases(), ensure_ascii=False), "utf8")
    print(f"Записано случаев: {CASES}")


if __name__ == "__main__":
    main()
