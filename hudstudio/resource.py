"""Чтение собранных файлов Source 2 (*_c): нужны блоки, а не их расшифровка."""

import struct


def blocks(data: bytes) -> dict:
    """{имя блока: байты}. Формат: заголовок, таблица блоков со смещениями от своего поля."""
    _, _, _, block_offset, count = struct.unpack_from("<IHHII", data, 0)
    found = {}
    pos = 8 + block_offset
    for _ in range(count):
        name = data[pos:pos + 4].decode("ascii")
        offset, size = struct.unpack_from("<II", data, pos + 4)
        start = pos + 4 + offset
        found[name] = data[start:start + size]
        pos += 12
    return found


def panorama_text(data: bytes) -> str:
    """Текст стиля из vcss_c в том виде, в каком его читает игра."""
    body = blocks(data)["DATA"]
    names = struct.unpack_from("<H", body, 4)[0]
    pos = 6
    for _ in range(names):
        pos = body.index(b"\0", pos) + 9  # имя, ноль и два числа по 4 байта
    return body[pos:].decode("utf8")
