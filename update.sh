#!/usr/bin/env bash
# После обновления Dota 2: берёт свежие файлы игры в docs/ и прогоняет все проверки.
set -euo pipefail
cd "$(dirname "$0")"
python3 -m hudstudio.export
python3 -m unittest discover -s tests -t .
./tests/run_js.sh
echo "Готово. Осталось отправить изменения на GitHub: git add -A && git commit -m 'chore: файлы новой версии Dota' && git push"
