#!/usr/bin/env bash
# Source2Viewer-CLI нужной версии: распаковка файлов Dota. Версия из nixpkgs (19.2) не читает файлы
# после обновления Dota 19.11.2026 (Unknown KVType 26). Официальная сборка скачивается один раз
# в tools/source2viewer/ (в git не попадает). ICU для распаковки не нужна — отключаем.
set -euo pipefail
VERSION=21.1
dir="$(cd "$(dirname "$0")" && pwd)/source2viewer"
bin="$dir/Source2Viewer-CLI"
if [[ ! -x "$bin" || "$(cat "$dir/VERSION" 2>/dev/null)" != "$VERSION" ]]; then
  echo "Скачиваю Source2Viewer-CLI $VERSION…" >&2
  rm -rf "$dir" && mkdir -p "$dir"
  curl -fsSL -o "$dir/cli.zip" "https://github.com/ValveResourceFormat/ValveResourceFormat/releases/download/$VERSION/cli-linux-x64.zip"
  unzip -oq "$dir/cli.zip" -d "$dir" && rm "$dir/cli.zip"
  chmod +x "$bin"
  echo "$VERSION" > "$dir/VERSION"
fi
export DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1
exec "$bin" "$@"
