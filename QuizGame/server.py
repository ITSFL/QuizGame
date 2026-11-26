#!/usr/bin/env python3
# Copyright 2026 by Florian Lohkamp
# Lizenz: GNU GPL v3, siehe LIZENZ_DE_GNU_GPL_v3.md im Projektordner
"""QuizGame-Server: liefert game/ statisch aus und stellt die Deck-API unter /api/decks bereit."""
import json
import os
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

ROOT = os.path.dirname(os.path.abspath(__file__))
GAME_DIR = os.path.join(ROOT, 'game')
DECKS_DIR = os.path.join(GAME_DIR, 'data', 'decks')
PROTECTED_FILES = {'default.json'}
FILE_NAME_RE = re.compile(r'^[a-z0-9_-]+\.json$')
API_PREFIX = '/api/decks/'
MAX_BODY_BYTES = 1_000_000


def list_decks():
    decks = []
    for name in sorted(os.listdir(DECKS_DIR)):
        if not FILE_NAME_RE.match(name):
            continue
        try:
            with open(os.path.join(DECKS_DIR, name), encoding='utf-8') as f:
                quiz = json.load(f).get('quiz', {})
        except (OSError, ValueError, AttributeError):
            continue
        decks.append({
            'file': name,
            'url': f'./data/decks/{name}',
            'id': quiz.get('id', ''),
            'title': quiz.get('title', name),
            'protected': name in PROTECTED_FILES,
        })
    return decks


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=GAME_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_GET(self):
        if self.path.split('?')[0] == '/api/decks':
            self.send_json(200, list_decks())
            return
        super().do_GET()

    def do_POST(self):
        name = self.deck_file_name()
        if name is None:
            return
        length = int(self.headers.get('Content-Length', 0))
        if length > MAX_BODY_BYTES:
            self.send_json(413, {'error': 'Deck ist zu groß'})
            return
        try:
            data = json.loads(self.rfile.read(length).decode('utf-8'))
        except ValueError:
            self.send_json(400, {'error': 'Ungültiges JSON'})
            return

        target = os.path.join(DECKS_DIR, name)
        tmp = target + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, target)
        self.send_json(200, {'ok': True, 'file': name})

    def do_DELETE(self):
        name = self.deck_file_name()
        if name is None:
            return
        if name in PROTECTED_FILES:
            self.send_json(403, {'error': 'Standard-Deck kann nicht gelöscht werden'})
            return
        target = os.path.join(DECKS_DIR, name)
        if not os.path.isfile(target):
            self.send_json(404, {'error': 'Deck nicht gefunden'})
            return
        os.remove(target)
        self.send_json(200, {'ok': True})

    def deck_file_name(self):
        path = self.path.split('?')[0]
        if not path.startswith(API_PREFIX):
            self.send_json(404, {'error': 'Nicht gefunden'})
            return None
        name = unquote(path[len(API_PREFIX):])
        if not FILE_NAME_RE.match(name):
            self.send_json(400, {'error': 'Ungültiger Dateiname'})
            return None
        return name

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.makedirs(DECKS_DIR, exist_ok=True)
    server = ThreadingHTTPServer(('', port), Handler)
    print(f'QuizGame-Server läuft auf http://localhost:{port}')
    server.serve_forever()


if __name__ == '__main__':
    main()
