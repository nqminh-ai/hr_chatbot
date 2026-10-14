import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from engine.models import MetadataError
from engine.provenance import verify_provenance
from engine.snapshot import DEFAULT_DATA, ROOT
from engine.storage import initialize_database
from scripts.export_sqlite_to_supabase import escape_sql_val, generate_seed, seed_sql


class ExportProvenanceTests(unittest.TestCase):
    def setUp(self):
        self.raw = json.loads(DEFAULT_DATA.read_bytes())

    def test_real_sources_and_mock_transformations_are_distinguished(self):
        report = verify_provenance(self.raw)
        self.assertEqual(report['clauses'], 16)
        self.assertFalse(report['mock_transformations'][0]['owner_confirmed'])

    def test_typed_value_tampering_is_detected(self):
        self.raw['documents'][2]['clauses'][0]['typed_value']['value'] = 99
        with self.assertRaises(MetadataError):
            verify_provenance(self.raw)

    def test_actual_byte_changes_rejected_even_when_declared_hashes_agree(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in self.raw['source_sha256']:
                target = root / name; target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((ROOT / name).read_bytes() + b' ')
            with self.assertRaises(MetadataError):
                verify_provenance(self.raw, root)

    def test_text_pointer_and_path_tampering_rejected(self):
        for kind in ('text', 'pointer', 'path', 'unit', 'line'):
            raw = copy.deepcopy(self.raw)
            clause = raw['documents'][2]['clauses'][0]
            if kind == 'text': clause['text_source'] = 'fake'
            if kind == 'pointer': clause['source_ref']['json_pointer'] = '/1/clauses/entitlement'
            if kind == 'path': raw['source_sha256']['../outside'] = hashlib.sha256(b'').hexdigest()
            if kind == 'unit': clause['typed_value']['unit'] = 'calendar_days'
            if kind == 'line': clause['source_ref']['line'] += 1
            with self.subTest(kind=kind), self.assertRaises(MetadataError):
                verify_provenance(raw)

    def test_export_failure_preserves_existing_output(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'seed.sql'; output.write_text('previous')
            with self.assertRaises(MetadataError):
                generate_seed(Path(folder) / 'missing.db', output)
            self.assertEqual(output.read_text(), 'previous')

    def test_export_uses_one_validated_read_and_explicit_conflict_mode(self):
        with tempfile.TemporaryDirectory() as folder:
            db, output = Path(folder) / 'a.db', Path(folder) / 'seed.sql'
            initialize_database(db, self.raw)
            from scripts.export_sqlite_to_supabase import read_dataset
            with patch('scripts.export_sqlite_to_supabase.read_dataset', wraps=read_dataset) as read:
                report = generate_seed(db, output)
                self.assertEqual(read.call_count, 1)
            self.assertFalse(report['readback_verified'])
            self.assertNotIn('ON CONFLICT', output.read_text(encoding='utf-8'))
            self.assertIn('DO UPDATE SET', seed_sql(self.raw, 'upsert'))
            self.assertNotIn('DO NOTHING', seed_sql(self.raw, 'upsert'))

    def test_invalid_json_booleans_and_nonfinite_numbers_fail_export(self):
        for value, column, table in [('broken', 'query_aliases_json', 'organization'),
                                     ('NaN', 'review_flags_json', 'clauses'),
                                     ('yes', 'is_floor', 'clauses'), (2, 'is_floor', 'clauses'),
                                     (float('nan'), 'value_number', 'clauses')]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                escape_sql_val(value, column, table)
