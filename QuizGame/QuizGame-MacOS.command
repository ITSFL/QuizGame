#!/bin/bash
# Copyright 2026 by Florian Lohkamp
# Lizenz: GNU GPL v3, siehe LIZENZ_DE_GNU_GPL_v3.md im Projektordner
# Startet einen lokalen HTTP-Server für das QuizGame (Ordner "game/") unter macOS.
# Per Doppelklick im Finder ausführbar (.command-Dateien öffnen ein Terminal).
# Notwendig, weil Chrome das Laden der Kartendecks per fetch() blockiert,
# wenn die Seite direkt als Datei (file://) geöffnet wird.
#
# Verwendung: Doppelklick, oder ./start-server.command [Port]
# Danach im Browser aufrufen: http://localhost:<Port>

PORT="${1:-8000}"
cd "$(dirname "$0")" || exit 1

# Wartet kurz, bis der Server läuft, und öffnet dann den Standard-Browser.
(sleep 1; open "http://localhost:$PORT") &

if command -v python3 >/dev/null 2>&1; then
  python3 server.py "$PORT"
elif command -v python >/dev/null 2>&1; then
  python server.py "$PORT"
else
  echo "Python wurde nicht gefunden. Bitte Python von https://python.org installieren."
  read -p "Taste drücken zum Beenden..."
fi
