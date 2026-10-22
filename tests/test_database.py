"""Database integration tests use temporary DB/CSV; never mutate the user's DB."""
import copy
import csv
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from engine.core import KnowledgeAssistant
from engine.models import MetadataError
from engine.snapshot import DEFAULT_DATA
from engine.storage import (
    backup_database, connect_database, database_status, initialize_database,
    migrate_database, read_dataset, replace_dataset, validate_tables,
)
from engine.tabular import read_csv_tables, to_tables, write_csv_tables

DAY = "2026-10-13"
QUERY = "Quy định nghỉ phép của tôi như thế nào?"


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="appota-db-test-")
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        self.db = self.folder / "knowledge.db"
        self.raw = json.loads(DEFAULT_DATA.read_bytes())
        initialize_database(self.db, self.raw)

    def update_days(self, raw, days):
        doc = next(d for d in raw["documents"] if d["doc_uid"] == "POL-A-LV@v2.0")
        next(c for c in doc["clauses"] if c["key"] == "entitlement")["typed_value"]["value"] = days

    def sql(self, sql, params=()):
        with closing(connect_database(self.db)) as connection, connection:
            connection.execute(sql, params)

    def answer(self, persona="lan"):
        return KnowledgeAssistant(database_file=self.db).answer_query(persona, QUERY, DAY)

    def test_seed_roundtrip_preserves_every_metadata_field(self):
        self.assertEqual(read_dataset(self.db), self.raw)
        self.assertEqual(database_status(self.db)["counts"]["clauses"], 16)

    def test_v1_migration_backs_up_and_deactivates_mock(self):
        self.sql("UPDATE dataset_info SET activation_allowed = 1")
        self.sql("PRAGMA user_version = 1")
        result = migrate_database(self.db)
        self.assertTrue(result["migrated"])
        self.assertTrue(Path(result["backup"]).exists())
        self.assertFalse(read_dataset(self.db)["activation_allowed"])
        self.assertFalse(migrate_database(self.db)["migrated"])

    def test_json_and_database_answer_graph_parity(self):
        fixture = KnowledgeAssistant()
        for persona in ("lan", "hung", "mai", "nam", "unknown"):
            with self.subTest(persona=persona):
                expected, actual = fixture.answer_query(persona, QUERY, DAY), self.answer(persona)
                for key in ("status", "answer", "claims", "citations", "query_date"):
                    self.assertEqual(actual[key], expected[key])
                for key in ("nodes", "edges"):
                    self.assertEqual(actual["graph"][key], expected["graph"][key])

    def test_init_does_not_reset_edited_database(self):
        changed = copy.deepcopy(self.raw)
        self.update_days(changed, 15)
        replace_dataset(self.db, changed)
        self.assertFalse(initialize_database(self.db, self.raw)["created"])
        self.assertEqual(read_dataset(self.db), changed)

    def test_csv_roundtrip_unicode_null_empty_and_literal_null_marker(self):
        raw = copy.deepcopy(self.raw)
        raw["migration_decisions"][0].update(owner="", evidence=r"\N")
        raw["organization"][0]["name"] = 'Tập đoàn, "Alpha"\nDòng hai'
        paths = write_csv_tables(self.folder / "csv", to_tables(raw))
        self.assertEqual(len(paths), 9)
        self.assertTrue(paths[0].read_bytes().startswith(b"\xef\xbb\xbf"))
        self.assertEqual(validate_tables(read_csv_tables(self.folder / "csv")), raw)

    def test_csv_existing_files_not_silently_overwritten(self):
        write_csv_tables(self.folder / "csv", to_tables(self.raw))
        with self.assertRaises(FileExistsError):
            write_csv_tables(self.folder / "csv", to_tables(self.raw))

    def test_invalid_csv_header_and_boolean_rejected(self):
        folder = self.folder / "csv"
        write_csv_tables(folder, to_tables(self.raw))
        path = folder / "dataset_info.csv"
        original = path.read_text(encoding="utf-8-sig")
        path.write_text(original.replace('"singleton"', '"wrong"'), encoding="utf-8-sig")
        with self.assertRaises(MetadataError):
            read_csv_tables(folder)
        path.write_text(original.replace('"1","2.0","mock_runtime","0"', '"1","2.0","mock_runtime","true"'), encoding="utf-8-sig")
        with self.assertRaises(MetadataError):
            read_csv_tables(folder)

    def test_duplicate_and_orphan_csv_rows_rejected(self):
        for table in ("documents", "lifecycle_events"):
            tables = to_tables(self.raw)
            row = copy.deepcopy(tables[table][0])
            if table == "lifecycle_events":
                row["doc_uid"] = "missing@v1.0"
            tables[table].append(row)
            with self.subTest(table=table), self.assertRaises(MetadataError):
                validate_tables(tables)

    def test_invalid_business_rules_rejected_without_live_write(self):
        before = self.db.read_bytes()
        invalid = copy.deepcopy(self.raw)
        invalid["personas"][0]["company"] = "CTY_B"
        with self.assertRaises(MetadataError):
            replace_dataset(self.db, invalid)
        self.assertEqual(self.db.read_bytes(), before)
        self.assertEqual(database_status(self.db)["last_import_revision"], 1)

    def test_import_backup_old_data_and_revision(self):
        changed = copy.deepcopy(self.raw)
        self.update_days(changed, 15)
        result = replace_dataset(self.db, changed, actor="test-owner", operation="import-csv")
        self.assertEqual(read_dataset(Path(result["backup"])), self.raw)
        self.assertEqual(read_dataset(self.db), changed)
        with closing(connect_database(self.db, readonly=True)) as connection:
            log = connection.execute("SELECT * FROM import_log WHERE revision = 2").fetchone()
        self.assertEqual(log["actor"], "test-owner")
        self.assertNotEqual(log["previous_sha256"], log["dataset_sha256"])

    def test_write_failure_rolls_back_data_and_import_log(self):
        from engine.storage import insert_tables as original_insert
        changed = copy.deepcopy(self.raw)
        self.update_days(changed, 15)
        def fail_live_write(connection, tables):
            if connection.execute("PRAGMA database_list").fetchone()[2]:
                raise sqlite3.OperationalError("simulated write failure")
            return original_insert(connection, tables)
        with patch("engine.storage.insert_tables", side_effect=fail_live_write):
            with self.assertRaises(sqlite3.OperationalError):
                replace_dataset(self.db, changed)
        self.assertEqual(read_dataset(self.db), self.raw)
        self.assertEqual(database_status(self.db)["last_import_revision"], 1)

    def test_foreign_keys_enabled_on_write_connections(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.sql("UPDATE personas SET company = ? WHERE user_id = ?", ("unknown", "lan"))
        self.assertEqual(read_dataset(self.db), self.raw)

    def test_direct_sql_edit_invalidates_managed_snapshot_and_graph(self):
        assistant = KnowledgeAssistant(database_file=self.db)
        old = assistant.answer_query("lan", QUERY, DAY)
        self.sql("UPDATE clauses SET value_number = ? WHERE clause_id = ?", (15, "POL-A-LV@v2.0#entitlement"))
        new = assistant.answer_query("lan", QUERY, DAY)
        self.assertIn("15 ngày", new["answer"])
        self.assertNotEqual(new["snapshot_id"], old["snapshot_id"])
        self.assertEqual(new["graph"]["snapshot_id"], new["snapshot_id"])

    def test_semantically_invalid_sql_update_fails_closed(self):
        assistant = KnowledgeAssistant(database_file=self.db)
        self.sql("UPDATE personas SET company = 'CTY_B' WHERE user_id = 'lan'")
        result = assistant.answer_query("lan", QUERY, DAY)
        self.assertEqual(result["status"], "system_error")
        self.assertEqual(result["claims"], [])
        self.assertEqual(result["graph"]["nodes"], [])

    def test_unsupported_database_version_never_falls_back_or_reseeds(self):
        self.sql("PRAGMA user_version = 99")
        before = self.db.read_bytes()
        for action in (read_dataset, lambda path: initialize_database(path, self.raw)):
            with self.assertRaises(MetadataError):
                action(self.db)
        self.assertEqual(self.db.read_bytes(), before)

    def test_missing_database_read_does_not_create_empty_file(self):
        missing = self.folder / "missing.db"
        with self.assertRaises(MetadataError):
            read_dataset(missing)
        self.assertFalse(missing.exists())

    def test_sql_text_is_bound_data_not_executable_sql(self):
        changed = copy.deepcopy(self.raw)
        changed["documents"][0]["title"] = "x'); DROP TABLE documents; --"
        replace_dataset(self.db, changed)
        self.assertEqual(read_dataset(self.db), changed)

    def test_backup_never_overwrites_live_database_or_existing_backup(self):
        with self.assertRaises(FileExistsError):
            backup_database(self.db, self.db)
        backup = backup_database(self.db)
        self.assertEqual(read_dataset(backup), self.raw)
        with self.assertRaises(FileExistsError):
            backup_database(self.db, backup)

    def test_csv_numeric_edit_is_used_by_the_database_assistant(self):
        folder = self.folder / "csv"
        write_csv_tables(folder, to_tables(self.raw))
        path = folder / "clauses.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            rows, names = list(reader), reader.fieldnames
        for row in rows:
            if row["clause_id"] == "POL-A-LV@v2.0#entitlement":
                row["value_number"] = "15"
        with path.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=names)
            writer.writeheader()
            writer.writerows(rows)
        replace_dataset(self.db, validate_tables(read_csv_tables(folder)))
        self.assertIn("15 ngày", self.answer()["answer"])

    def test_ui_uses_sqlite_and_resets_result_on_sql_change(self):
        from streamlit.testing.v1 import AppTest
        from engine.storage import runtime_data_bytes
        with patch("engine.storage.runtime_data_bytes", side_effect=lambda: runtime_data_bytes(self.db)):
            app = AppTest.from_file(str(DEFAULT_DATA.parent.parent / "app.py"), default_timeout=15).run()
            self.assertFalse(app.exception)
            app.button[0].click().run()
            self.assertIn("14 ngày", app.session_state["answer_result"]["answer"])
            self.sql("UPDATE clauses SET value_number = 15 WHERE clause_id = 'POL-A-LV@v2.0#entitlement'")
            app.run()
            self.assertNotIn("answer_result", app.session_state)
            rendered = "\n".join(element.value for element in app.markdown)
            self.assertIn("15 ngày", rendered)
            self.assertFalse(app.exception)

    def test_ui_invalid_database_shows_generic_error_and_stops(self):
        from streamlit.testing.v1 import AppTest
        from engine.storage import runtime_data_bytes
        self.sql("UPDATE personas SET company = 'CTY_B' WHERE user_id = 'lan'")
        with patch("engine.storage.runtime_data_bytes", side_effect=lambda: runtime_data_bytes(self.db)):
            app = AppTest.from_file(str(DEFAULT_DATA.parent.parent / "app.py"), default_timeout=15).run()
        self.assertFalse(app.exception)
        self.assertIn("chưa sẵn sàng", app.error[0].value)
        self.assertEqual(len(app.selectbox), 0)
        self.assertEqual(len(app.get("iframe")), 0)


if __name__ == "__main__":
    unittest.main()
