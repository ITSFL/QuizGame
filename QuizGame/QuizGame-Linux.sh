#!/bin/bash
# Copyright 2026 by Florian Lohkamp
# Lizenz: GNU GPL v3, siehe LIZENZ_DE_GNU_GPL_v3.md im Projektordner
# Startet einen lokalen HTTP-Server für das QuizGame (Ordner "game/") unter Linux
# (und macOS/Git-Bash, siehe auch start-server.command / start-server.bat).
# Notwendig, weil Chrome das Laden der Kartendecks per fetch() blockiert,
# wenn die Seite direkt als Datei (file://) geöffnet wird.
#
# Verwendung: ./start-server.sh [Port]
# Danach im Browser aufrufen: http://localhost:<Port>

PORT="${1:-8000}"
cd "$(dirname "$0")" || exit 1

# Wartet kurz, bis der Server läuft, und öffnet dann den Standard-Browser.
(
  sleep 1
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:$PORT"
  elif command -v open >/dev/null 2>&1; then
    open "http://localhost:$PORT"
  fi
) &

python3 server.py "$PORT"
