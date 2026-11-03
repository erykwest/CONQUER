#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then PYTHON=python3
elif command -v python >/dev/null 2>&1; then PYTHON=python
else echo "Python 3 non disponibile" >&2; exit 1; fi
(sleep 2; if command -v xdg-open >/dev/null 2>&1; then xdg-open 'http://127.0.0.1:4173/?renderer=canvas2d' >/dev/null 2>&1
elif command -v open >/dev/null 2>&1; then open 'http://127.0.0.1:4173/?renderer=canvas2d'; fi) &
echo 'CONQUER urban locale: http://127.0.0.1:4173/?renderer=canvas2d'
exec "$PYTHON" -m http.server 4173 --bind 127.0.0.1
