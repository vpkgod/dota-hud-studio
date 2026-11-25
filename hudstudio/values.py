"""Очистка значений с сайта: в CSS попадает только то, что прошло проверку."""

import math
import re

from . import catalog

HEX = re.compile(r"^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$")
IMAGE_ID = re.compile(r"^[0-9a-f]{16}$")
FITS = ("stretch", "cover", "contain", "original")
TINT_MODES = ("keep", "flood")


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _clamp(value, lo, hi):
    return max(lo, min(hi, value))


def _color(raw, control):
    return raw if isinstance(raw, str) and HEX.match(raw) else control["default"]


def _num(raw, control):
    if not _is_number(raw):
        return control["default"]
    return _clamp(raw, control["min"], control["max"])


def _toggle(raw, control):
    return raw if isinstance(raw, bool) else control["default"]


def _offset(raw, control):
    if not isinstance(raw, dict) or not (_is_number(raw.get("x")) and _is_number(raw.get("y"))):
        return control["default"]
    lo, hi = control["min"], control["max"]
    return {"x": round(_clamp(raw["x"], lo, hi)), "y": round(_clamp(raw["y"], lo, hi))}


def _image(raw, control):
    if not isinstance(raw, dict) or not (isinstance(raw.get("id"), str) and IMAGE_ID.match(raw["id"])):
        return None
    fit = raw.get("fit") if raw.get("fit") in FITS else "stretch"
    opacity = _clamp(raw["opacity"], 0, 1) if _is_number(raw.get("opacity")) else 1
    clean = {"id": raw["id"], "fit": fit, "opacity": opacity}
    tint = _tint(raw.get("tint"))
    if tint is None:
        return clean
    base = raw.get("base") if isinstance(raw.get("base"), str) and IMAGE_ID.match(raw["base"]) else None
    return {**clean, "tint": tint, "base": base}


VIDEO_FITS = ("cover", "contain", "stretch")
MAX_VIDEO_SIDE = 4096


def _video(raw, control):
    """{id, fit, w, h}: w×h — размер самого видео, нужен для «заполнить» и «вписать»."""
    if not isinstance(raw, dict) or not (isinstance(raw.get("id"), str) and IMAGE_ID.match(raw["id"])):
        return None
    w, h = raw.get("w"), raw.get("h")
    sized = all(isinstance(n, int) and not isinstance(n, bool) and 1 <= n <= MAX_VIDEO_SIDE for n in (w, h))
    fit = raw.get("fit") if raw.get("fit") in VIDEO_FITS else "cover"
    if not sized:
        return {"id": raw["id"], "fit": "stretch", "w": 0, "h": 0}
    return {"id": raw["id"], "fit": fit, "w": w, "h": h}


def _fill(raw, control):
    if not isinstance(raw, dict) or raw.get("dir") not in ("v", "h"):
        return control["default"]
    stops = raw.get("stops")
    if not isinstance(stops, list) or not 2 <= len(stops) <= 4:
        return control["default"]
    clean = []
    for stop in stops:
        if not (isinstance(stop, dict) and _is_number(stop.get("p"))
                and isinstance(stop.get("c"), str) and HEX.match(stop["c"])):
            return control["default"]
        clean.append({"p": _clamp(stop["p"], 0, 1), "c": stop["c"]})
    clean = sorted(clean, key=lambda s: s["p"])
    clean[0] = {**clean[0], "p": 0}
    clean[-1] = {**clean[-1], "p": 1}
    return {"dir": raw["dir"], "stops": clean}


def _tint(raw):
    """Настройки перекраски. None значит, что картинка не перекрашена."""
    if not isinstance(raw, dict) or raw.get("mode") not in TINT_MODES:
        return None
    if not (_is_number(raw.get("strength")) and _is_number(raw.get("bright"))):
        return None
    fill = _fill(raw.get("fill"), {"default": None})
    if fill is None:
        return None
    return {"fill": fill, "mode": raw["mode"], "strength": _clamp(raw["strength"], 0, 100),
            "bright": _clamp(raw["bright"], -100, 100)}


def _shadow(raw, control):
    valid = (isinstance(raw, dict) and isinstance(raw.get("on"), bool) and _is_number(raw.get("w"))
             and isinstance(raw.get("c"), str) and HEX.match(raw["c"]))
    if not valid:
        return control["default"]
    return {"on": raw["on"], "c": raw["c"], "w": round(_clamp(raw["w"], 1, 8))}


_CLEANERS = {"color": _color, "num": _num, "toggle": _toggle, "offset": _offset,
             "image": _image, "video": _video, "fill": _fill, "outline": _shadow, "glow": _shadow}


def sanitize(raw) -> dict:
    """Новый словарь со всеми настройками каталога; плохое значение → значение по умолчанию."""
    source = raw if isinstance(raw, dict) else {}
    result = {}
    for cid, control in catalog.controls().items():
        result[cid] = (_CLEANERS[control["type"]](source[cid], control)
                       if cid in source else control["default"])
    return result
