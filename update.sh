#!/usr/bin/env bash
# После обновления Dota 2: берёт свежие файлы игры в docs/ и прогоняет все проверки.
set -euo pipefail
cd "$(dirname "$0")"
python3 -m hudstudio.export
python3 -m hudstudio.layout   # разметка худа с видео за портретом (нужны Workshop Tools и wine)
if command -v node >/dev/null; then node tools/keep_same_png.mjs; else nix shell nixpkgs#nodejs_22 -c node tools/keep_same_png.mjs; fi
python3 -m unittest discover -s tests -t .
./tests/run_js.sh
echo "Готово. Осталось отправить изменения на GitHub: git add -A && git commit -m 'chore: файлы новой версии Dota' && git push"
