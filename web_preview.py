"""Preview the Vercel static UI and Python handler together on localhost."""
import argparse
import mimetypes
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from api.index import handler

PUBLIC = Path(__file__).resolve().parent / "public"
ASSETS = {"/": "index.html", "/index.html": "index.html", "/app.js": "app.js",
          "/styles.css": "styles.css", "/favicon.svg": "favicon.svg"}


class PreviewHandler(handler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path in {"/api", "/api/"}:
            return super().do_GET()
        if path not in ASSETS:
            self.send_json(404, {"error": "Không tìm thấy trang."})
            return
        asset = PUBLIC / ASSETS[path]
        body = asset.read_bytes()
        self.send_response(200)
        content_type = mimetypes.guess_type(asset.name)[0] or "application/octet-stream"
        self.send_header("Content-Type", content_type + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if urlsplit(self.path).path not in {"/api", "/api/"}:
            return self.send_json(404, {"error": "Không tìm thấy trang."})
        return super().do_POST()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), PreviewHandler)
    print(f"Preview: http://127.0.0.1:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
