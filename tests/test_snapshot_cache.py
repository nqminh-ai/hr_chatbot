import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from engine.metadata import compile_document, snapshot_from_bytes
from engine.models import MetadataError
from engine.snapshot import DEFAULT_DATA, DEFAULT_SCHEMA
from engine.storage import canonical_bytes, connect_database, initialize_database, runtime_data_bytes


class SnapshotCacheTests(unittest.TestCase):
    def setUp(self):
        snapshot_from_bytes.cache_clear()
        self.raw = json.loads(DEFAULT_DATA.read_bytes())
        self.schema = DEFAULT_SCHEMA.read_bytes()

    def tearDown(self):
        snapshot_from_bytes.cache_clear()

    def test_shared_validation_compiles_once_for_identical_bytes(self):
        with patch('engine.metadata.compile_document', wraps=compile_document) as compile:
            data = canonical_bytes(self.raw)
            first = snapshot_from_bytes(data, self.schema)
            self.assertIs(snapshot_from_bytes(data, self.schema), first)
            self.assertEqual(compile.call_count, len(self.raw['documents']))

    def test_schema_bytes_participate_in_cache_key_and_validate_again(self):
        data = canonical_bytes(self.raw)
        snapshot_from_bytes(data, self.schema)
        schema = json.loads(self.schema)
        schema['properties']['sample_id'] = {'const': 'not-the-fixture'}
        with self.assertRaises(MetadataError):
            snapshot_from_bytes(data, json.dumps(schema).encode())

    def test_sql_edit_without_revision_invalidates_compiled_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            db = Path(folder) / 'a.db'; initialize_database(db, self.raw)
            snapshot_from_bytes.cache_clear()
            with patch('engine.metadata.compile_document', wraps=compile_document) as compile:
                first = snapshot_from_bytes(runtime_data_bytes(db), self.schema)
                self.assertEqual(compile.call_count, len(self.raw['documents']))
                self.assertIs(snapshot_from_bytes(runtime_data_bytes(db), self.schema), first)
                self.assertEqual(compile.call_count, len(self.raw['documents']))
                connection = connect_database(db)
                try:
                    with connection:
                        connection.execute("UPDATE clauses SET value_number=15 WHERE clause_id='POL-A-LV@v2.0#entitlement'")
                finally:
                    connection.close()
                second = snapshot_from_bytes(runtime_data_bytes(db), self.schema)
                self.assertNotEqual(second.snapshot_id, first.snapshot_id)
                self.assertEqual(compile.call_count, 2 * len(self.raw['documents']))
                clause = next(d for d in second.documents if d.doc_uid == 'POL-A-LV@v2.0').clauses[0]
                self.assertEqual(clause.typed_value.value, 15)
