"""HTTP, authorization and deployment-package checks for the Vercel adapter."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

from api.index import MAX_BODY_BYTES, handler
from engine.models import MetadataError

ROOT = Path(__file__).resolve().parent.parent


class WebAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def request(self, method="GET", payload=None, body=None, content_type="application/json"):
        connection = HTTPConnection("127.0.0.1", self.server.server_port, timeout=10)
        if body is None and payload is not None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        connection.request(method, "/api", body=body, headers={"Content-Type": content_type})
        response = connection.getresponse()
        status, headers = response.status, dict(response.getheaders())
        data = json.loads(response.read())
        connection.close()
        return status, headers, data

    def test_bootstrap_exposes_demo_profiles_without_policy_corpus(self):
        status, headers, data = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertEqual(set(data), {"personas", "date", "snapshot_id"})
        self.assertIn("lan", data["personas"])
        self.assertTrue(data["personas"]["lan"]["scope_path"])
        self.assertNotIn("documents", data)

    def test_answer_and_embedded_graph_share_authorized_projection(self):
        status, _, data = self.request("POST", {"persona": "lan", "date": "2026-10-14",
                                               "query": "Tôi được nghỉ phép bao nhiêu ngày?"})
        self.assertEqual(status, 200)
        result = data["result"]
        self.assertEqual(result["status"], "answered")
        self.assertEqual(result["claims"][0]["value"], 14)
        self.assertEqual(result["graph"]["snapshot_id"], result["snapshot_id"])
        self.assertNotIn("POL-A-LV-EXEC", json.dumps(data))
        self.assertNotIn("POL-B-LV", json.dumps(data))
        self.assertIn('<script id="payload"', data["graph_html"])

    def test_refused_personas_receive_no_policy_nodes_or_citations(self):
        for persona in ("nam", "missing"):
            with self.subTest(persona=persona):
                status, _, data = self.request("POST", {"persona": persona, "query": "Quy định nghỉ phép?"})
                self.assertEqual(status, 200)
                self.assertEqual(data["result"]["status"], "refused")
                self.assertEqual(data["result"]["citations"], [])
                self.assertEqual(data["result"]["claims"], [])
                self.assertTrue(all(node["kind"] in {"unit", "persona"}
                                    for node in data["result"]["graph"]["nodes"]))
                if persona == "missing":
                    self.assertEqual(data["result"]["graph"]["nodes"], [])
                    self.assertEqual(data["graph_html"], "")

    def test_bad_input_is_rejected_at_http_boundary(self):
        cases = [[], {}, {"persona": [], "query": "nghỉ phép"},
                 {"persona": "lan", "query": 42}, {"persona": "lan", "query": " "},
                 {"persona": "lan", "query": "x" * 4001},
                 {"persona": "lan", "query": "nghỉ phép", "date": "2026-02-30"},
                 {"persona": "lan", "query": "nghỉ phép", "date": {}}]
        for payload in cases:
            with self.subTest(payload=repr(payload)[:60]):
                status, _, data = self.request("POST", payload)
                self.assertEqual(status, 400)
                self.assertEqual(set(data), {"error"})

    def test_malformed_body_and_content_type(self):
        self.assertEqual(self.request("POST", body=b'{"persona":')[0], 400)
        self.assertEqual(self.request("POST", body=b'\xff')[0], 400)
        self.assertEqual(self.request("POST", body=b'{}', content_type="text/plain")[0], 415)

    def test_oversized_body_is_rejected(self):
        self.assertEqual(self.request("POST", body=b'x' * (MAX_BODY_BYTES + 1))[0], 413)

    def test_dataset_failure_returns_neutral_error(self):
        with patch("api.index.get_assistant", side_effect=MetadataError("private diagnostics")):
            for method, payload in [("GET", None), ("POST", {"persona": "lan", "query": "nghỉ phép"})]:
                status, _, data = self.request(method, payload)
                self.assertEqual(status, 503)
                self.assertNotIn("private diagnostics", json.dumps(data))

    def test_engine_runs_from_minimal_bundle_without_database_or_streamlit(self):
        with tempfile.TemporaryDirectory() as folder:
            bundle = Path(folder)
            for name in ("engine", "api"):
                shutil.copytree(ROOT / name, bundle / name, ignore=shutil.ignore_patterns("__pycache__"))
            (bundle / "data").mkdir()
            (bundle / "schemas").mkdir()
            shutil.copy2(ROOT / "data/knowledge.json", bundle / "data/knowledge.json")
            shutil.copy2(ROOT / "schemas/knowledge_runtime_v2.schema.json", bundle / "schemas/knowledge_runtime_v2.schema.json")
            code = ("import sys; from api.index import bootstrap, answer; "
                    "assert bootstrap()['personas']; "
                    "r=answer({'persona':'lan','query':'Tôi được nghỉ phép bao nhiêu ngày?','date':'2026-10-14'}); "
                    "assert r['result']['claims'][0]['value']==14; "
                    "assert 'streamlit' not in sys.modules")
            environment = dict(os.environ)
            environment.pop("PYTHONPATH", None)
            run = subprocess.run([sys.executable, "-B", "-c", code], cwd=bundle,
                                 env=environment, capture_output=True, timeout=15)
            self.assertEqual(run.returncode, 0, run.stderr.decode(errors="replace"))


if __name__ == "__main__":
    unittest.main()
