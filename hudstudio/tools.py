"""Запуск внешних программ (Source2Viewer-CLI) с понятной ошибкой вместо исключения."""

import subprocess

_NOISE = ("fixme:", "err:virtual", "err:ole", "warn:")


def run_tool(cmd, cwd=None, timeout=300):
    try:
        proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, errors="replace", timeout=timeout)
    except FileNotFoundError:
        return 127, f"Программа не найдена: {cmd[0]}"
    except subprocess.TimeoutExpired:
        return 124, f"Слишком долго (>{timeout} с): {cmd[0]}"
    lines = [ln for ln in (proc.stdout + proc.stderr).splitlines() if not any(n in ln for n in _NOISE)]
    return proc.returncode, "\n".join(lines).strip()
