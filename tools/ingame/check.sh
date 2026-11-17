#!/usr/bin/env bash
# Проверка в настоящей Dota: ./tools/ingame/check.sh <сценарий.json> [герой ...]   (по умолчанию juggernaut)
# Собирает мод из сценария, снимает превью сайта и игру (без мода и с модом) и сравнивает места блоков.
# Игра запускается сама и сама закрывается; мод кладётся в game/dota_russian/pak79_dir.vpk только на время прогона.
# Отчёт и скриншоты — в output/ingame/<сценарий>/.
set -euo pipefail
cd "$(dirname "$0")/../.."
scenario=$1; shift
heroes=("${@:-juggernaut}")
name=$(basename "$scenario" .json)
out=output/ingame/$name
base=cache/ingame_base
mkdir -p "$out" "$base"
build=$(python3 -c "import json;print(json.load(open('docs/data/catalog.json'))['game']['build'])")

py_game() { nix shell --impure --expr 'with import <nixpkgs> {}; python3.withPackages (p: [p.evdev p.opencv4])' -c python3 -I "$@"; }
py_cv() { nix shell --impure --expr 'with import <nixpkgs> {}; python3.withPackages (p: [p.opencv4])' -c python3 -I "$@"; }
py_web() {
  nix shell --impure --expr 'with import <nixpkgs> {}; [ (python3.withPackages (p: [p.playwright])) playwright-driver.browsers ]' \
    -c bash -c 'export PLAYWRIGHT_BROWSERS_PATH=$(nix eval --raw nixpkgs#playwright-driver.browsers.outPath 2>/dev/null); python3 -I "$@"' _ "$@"
}

echo "== сборка мода"
nix shell nixpkgs#nodejs_22 -c node tools/ingame/build_mod.mjs "$scenario" "$out/mod.vpk"

echo "== превью сайта"
(cd docs && exec python3 -m http.server 8779 >/dev/null 2>&1) & server=$!
trap 'kill $server 2>/dev/null' EXIT
sleep 1
echo '{}' > "$out/empty.json"
py_web tools/ingame/preview_shot.py "$out/empty.json" "$out/preview_base.png" "http://127.0.0.1:8779/?lang=ru"
py_web tools/ingame/preview_shot.py "$scenario" "$out/preview_mod.png" "http://127.0.0.1:8779/?lang=ru"

status=0
for hero in "${heroes[@]}"; do
  echo "== игра: $hero"
  shot_base=$base/${build}_$hero.png
  [ -f "$shot_base" ] || py_game tools/ingame/dota_session.py - "$shot_base" "$hero"
  py_game tools/ingame/dota_session.py "$out/mod.vpk" "$out/game_$hero.png" "$hero"
  if [ "$hero" != juggernaut ]; then
    echo "   превью показывает Джаггернаута: для $hero только скриншоты, смотреть глазами"
    continue
  fi
  echo "== сравнение: $hero"
  py_cv tools/ingame/compare.py "$shot_base" "$out/game_$hero.png" "$out/preview_base.png" "$out/preview_mod.png" \
    "$out/report_$hero.png" || status=1
done
exit $status
