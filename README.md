<!--
Copyright 2026 by Florian Lohkamp
Lizenz: GNU GPL v3, siehe LIZENZ_DE_GNU_GPL_v3.md im Projektordner
-->
# QuizGame

Quizspiel für Teams, das lokal über einen kleinen Python-Server läuft.

## Systemanforderungen

### Software

| Komponente | Anforderung |
|---|---|
| Python | Python 3.7 oder neuer (nur Standardbibliothek, keine `pip`-Pakete nötig) |
| Browser | Aktuelle Version von Chrome, Edge, Firefox oder Safari (ES6+, `async`/`await`, `replaceChildren()`) |
| JavaScript | Muss im Browser aktiviert sein |
| Node.js | Nicht erforderlich |

### Betriebssystem

- Linux (`QuizGame-Linux.sh`)
- macOS (`QuizGame-MacOS.command`)
- Windows 11 (`QuizGame-Win.bat`, mit `py` oder `python` im `PATH`)

### Hardware

Keine besonderen Anforderungen. Jeder Rechner, auf dem Python und ein moderner Browser laufen, reicht aus.

### Netzwerk

- Für den Betrieb ist keine Internetverbindung nötig. Bootstrap liegt lokal in `game/lib/`.
- Der Server läuft auf `http://localhost:8000` (Port als Argument änderbar, z. B. `python3 server.py 9000`).
- Das Spiel darf nicht per `file://` geöffnet werden, es muss über den Server laufen.

## Starten

1. Passendes Start-Skript im Projektordner ausführen.
2. Im Browser `http://localhost:8000` öffnen.

Der Adminbereich speichert Decks in `game/data/decks/`. Das Standard-Deck `default.json` ist geschützt und kann nicht gelöscht werden.
