"""Stateless Vercel API backed by the committed, validated demo JSON seed."""
import json
from functools import lru_cache
from http.server import BaseHTTPRequestHandler

from engine.core import KnowledgeAssistant
from engine.graph_view import graph_html
from engine.metadata import load_snapshot
from engine.models import MetadataError
from engine.snapshot import BusinessClock

MAX_BODY_BYTES = 16384
UNAVAILABLE = "Dữ liệu chính sách chưa sẵn sàng. Vui lòng thử lại sau."


@lru_cache(maxsize=1)
def get_assistant():
    # Each deployment has a fixed read-only seed. No SQLite or filesystem writes.
    return KnowledgeAssistant(snapshot=load_snapshot())


def bootstrap():
    assistant = get_assistant()
    personas = assistant.identity_service.list_users()
    for profile in personas.values():
        profile["scope_path"] = list(reversed(assistant.hierarchy_resolver.get_user_scope_path(profile)))
    return {"personas": personas, "date": assistant.clock.today().isoformat(),
            "snapshot_id": assistant.snapshot.snapshot_id}


def answer(payload):
    if not isinstance(payload, dict):
        raise ValueError("Yêu cầu phải là một JSON object.")
    persona, query, day = payload.get("persona"), payload.get("query"), payload.get("date")
    if not isinstance(persona, str) or not persona or len(persona) > 100:
        raise ValueError("Vui lòng chọn nhân sự hợp lệ.")
    if not isinstance(query, str) or not query.strip() or len(query) > 4000:
        raise ValueError("Câu hỏi phải có từ 1 đến 4.000 ký tự.")
    if day is not None:
        try:
            day = BusinessClock.parse(day)
        except ValueError:
            raise ValueError("Ngày tra cứu phải hợp lệ và có dạng YYYY-MM-DD.") from None
    result = get_assistant().answer_query(persona, query, day)
    # HTML and downloads are derived only from this request's authorized graph.
    return {"result": result, "graph_html": graph_html(result["graph"]) if result["graph"]["nodes"] else ""}


class handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        try:
            self.send_json(200, bootstrap())
        except (MetadataError, OSError):
            self.send_json(503, {"error": UNAVAILABLE})

    def do_POST(self):
        try:
            try:
                size = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                raise ValueError("Kích thước yêu cầu không hợp lệ.") from None
            if size > MAX_BODY_BYTES:
                self.send_json(413, {"error": "Yêu cầu quá lớn."})
                return
            if size <= 0:
                raise ValueError("Yêu cầu không có nội dung.")
            body = self.rfile.read(size)
            if self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "application/json":
                self.send_json(415, {"error": "Yêu cầu phải dùng application/json."})
                return
            try:
                payload = json.loads(body)
            except (ValueError, UnicodeDecodeError):
                raise ValueError("Nội dung JSON không hợp lệ.") from None
            self.send_json(200, answer(payload))
        except (MetadataError, OSError):
            self.send_json(503, {"error": UNAVAILABLE})
        except ValueError as error:
            self.send_json(400, {"error": str(error)})

    def log_message(self, format, *args):
        # Do not log queries or persona selections in this demo adapter.
        pass
