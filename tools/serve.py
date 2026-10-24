"""Le wiki en local, comme en ligne.

En ligne, Netlify sert le site et va chercher tout « assets/... » dans le depot
GitHub des assets (_redirects). Ici, meme chose sur le disque : les pages
viennent du dossier du wiki, et « /assets/... » du dossier des assets
(tools/paths.py).

Rien n'est garde en cache par le navigateur : une page, un script ou une image
modifies se voient au rechargement suivant.

Usage :  python tools/serve.py [port]        (8123 par defaut)
         puis http://localhost:8123/
"""

import os
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths  # noqa: E402


class Handler(SimpleHTTPRequestHandler):
    extensions_map = dict(SimpleHTTPRequestHandler.extensions_map, **{
        ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".webm": "video/webm", ".gltf": "model/gltf+json",
        ".json": "application/json", ".js": "text/javascript", ".mjs": "text/javascript",
        ".css": "text/css", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".woff2": "font/woff2",
    })

    def translate_path(self, path):
        raw = path.split("?", 1)[0].split("#", 1)[0]
        root = paths.WIKI
        if raw == "/assets" or raw.startswith("/assets/"):
            root, path = paths.ASSETS, path[len("/assets"):] or "/"
        previous, self.directory = self.directory, root
        try:
            return super().translate_path(path)
        finally:
            self.directory = previous

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Seules les erreurs serveur (les 404 sont normales : le site cherche ses images).
        if args and str(args[1] if len(args) > 1 else "").startswith(("5",)):
            super().log_message(fmt, *args)


def start(port=0):
    """Demarre le serveur dans un fil a part. Renvoie (serveur, port)."""
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=paths.WIKI))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, server.server_address[1]


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    server = ThreadingHTTPServer(("0.0.0.0", port), partial(Handler, directory=paths.WIKI))
    print("wiki : http://localhost:%d/   (assets : %s)" % (port, paths.ASSETS), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
