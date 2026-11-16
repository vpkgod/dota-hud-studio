#!/usr/bin/env bash
# Открывает сайт на этом компьютере. Адрес: http://127.0.0.1:8770
set -euo pipefail
cd "$(dirname "$0")"
port="${HUDSTUDIO_PORT:-8770}"
(sleep 1; xdg-open "http://127.0.0.1:${port}/" >/dev/null 2>&1 || true) &
exec python3 -m http.server "$port" --bind 127.0.0.1 --directory docs
