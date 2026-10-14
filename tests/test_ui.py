"""Real Streamlit script/protobuf checks through AppTest; no external server."""
import json
import unittest
from datetime import date
from pathlib import Path

from streamlit.testing.v1 import AppTest

ROOT = Path(__file__).resolve().parent.parent


class UITests(unittest.TestCase):
    def setUp(self):
        from unittest.mock import patch
        clock = patch("engine.snapshot.BusinessClock.today", return_value=date(2026, 10, 13))
        clock.start()
        self.addCleanup(clock.stop)
        # UI regressions use a fixed isolated fixture, never the user's editable DB.
        fixture = patch("engine.storage.runtime_data_bytes", return_value=(ROOT / "data/knowledge.json").read_bytes())
        fixture.start()
        self.addCleanup(fixture.stop)

    def start(self):
        app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=15).run()
        self.assertFalse(app.exception)
        return app

    def rendered(self, app):
        kinds = ("markdown", "caption", "info", "warning", "json", "iframe", "selectbox")
        return "\n".join(str(element.proto) for kind in kinds for element in app.get(kind))

    def test_ui_graph_export_regression(self):
        app = self.start()
        self.assertNotIn("POL-A-LV-EXEC", self.rendered(app))
        self.assertNotIn("POL-B-LV", self.rendered(app))
        app.selectbox(key="persona").select("hung").run()
        self.assertFalse(app.exception)
        self.assertIn("POL-B-LV", self.rendered(app))
        self.assertNotIn("POL-A-LV@v2.0", self.rendered(app))

    def test_persona_change_clears_previous_answer(self):
        app = self.start()
        app.text_input(key="query").set_value("Quy định nghỉ phép?")
        app.button[0].click().run()
        self.assertIn("14 ngày", app.session_state["answer_result"]["answer"])
        app.selectbox(key="persona").select("nam").run()
        self.assertNotIn("answer_result", app.session_state)
        self.assertNotIn("14 ngày", self.rendered(app))
        self.assertNotIn("POL-A-LV v2.0", self.rendered(app))

    def test_download_receives_only_authorized_bytes(self):
        from unittest.mock import patch
        import streamlit
        with patch.object(streamlit, "download_button") as download:
            app = self.start()
        exported = download.call_args.args[1]
        self.assertNotIn("POL-A-LV-EXEC", exported)
        self.assertNotIn("POL-B-LV", exported)
        self.assertTrue(json.loads(exported)["nodes"])

    def test_date_change_clears_previous_answer(self):
        app = self.start()
        app.button[0].click().run()
        app.date_input(key="business_date").set_value(date(2026, 1, 15)).run()
        self.assertNotIn("answer_result", app.session_state)
        self.assertIn("POL-A-LV v1.0", self.rendered(app))
        self.assertFalse(app.exception)

    def test_snapshot_change_invalidates_ui_context(self):
        from unittest.mock import patch
        from engine.metadata import snapshot_from_bytes
        from engine.snapshot import DEFAULT_DATA, DEFAULT_SCHEMA
        app = self.start()
        app.button[0].click().run()
        raw = json.loads(DEFAULT_DATA.read_bytes())
        for doc in raw["documents"]:
            if doc["doc_uid"] == "POL-A-LV@v2.0":
                doc["clauses"][0]["typed_value"]["value"] = 15
        snapshot = snapshot_from_bytes(json.dumps(raw).encode(), DEFAULT_SCHEMA.read_bytes())
        with patch("engine.metadata.snapshot_from_bytes", return_value=snapshot):
            # A distinct raw content key forces the cached loader to call the validator.
            with patch("engine.storage.runtime_data_bytes", return_value=json.dumps(raw).encode()):
                app.run()
        self.assertNotIn("answer_result", app.session_state)
        self.assertIn("15 ngày", self.rendered(app))
        self.assertFalse(app.exception)


if __name__ == "__main__":
    unittest.main()
