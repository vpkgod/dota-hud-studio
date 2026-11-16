#!/usr/bin/env bash
# Тесты сборщика сайта. Node берётся через nix, если его нет в системе.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m tests.make_fixtures
if command -v node >/dev/null; then
  exec node --test "tests/js/*.test.mjs"
fi
exec nix shell nixpkgs#nodejs_22 -c node --test "tests/js/*.test.mjs"
