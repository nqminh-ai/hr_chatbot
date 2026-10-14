"""Negative controls for the shared oracle and complete suite selection."""
import copy
import unittest
from unittest.mock import patch

from contracts import canonical_python, contract_errors
from run_tests import SCENARIO_SUITES, run_all_suites


class ContractOracleTests(unittest.TestCase):
    def test_each_business_field_mutation_fails(self):
        expected = {"status": "answered", "query_date": "2026-10-14", "claims": {
            "entitlement": {"value": 14, "unit": "annual_paid_days", "source": "POL-A-LV@v2.0"}}}
        for field, value in (("status", "refused"), ("query_date", "2026-01-01"), ("claims", {})):
            actual = copy.deepcopy(expected)
            actual[field] = value
            self.assertTrue(contract_errors(actual, expected))
        for field, value in (("value", 99), ("unit", "calendar_days"), ("source", "OTHER@v1.0")):
            actual = copy.deepcopy(expected)
            actual["claims"]["entitlement"][field] = value
            self.assertTrue(contract_errors(actual, expected))

    def test_matching_engine_outputs_are_not_the_oracle(self):
        wrong = {"status": "answered", "query_date": "2026-01-01", "claims": {}}
        expected = {"status": "needs_clarification", "query_date": "2026-10-14", "claims": {}}
        self.assertTrue(contract_errors(wrong, expected))

    def test_suites_include_private_and_detailed(self):
        with patch("run_tests.run_all_tests", return_value=[{"passed": True}]) as run:
            results = run_all_suites()
        self.assertEqual(set(results), {"public", "private", "detailed"})
        self.assertEqual({call.args[0] for call in run.call_args_list}, set(SCENARIO_SUITES.values()))

    def test_projection_preserves_value_unit_and_source(self):
        actual = canonical_python({"status": "answered", "query_date": "2026-10-14", "claims": [{
            "key": "notice_period", "value": 10, "unit": "unspecified_days",
            "source": {"doc_id": "GUD-B-PAY-LV", "version": "v1.0"}}]})
        self.assertEqual(actual["claims"]["notice_period"], {
            "value": 10, "unit": "unspecified_days", "source": "GUD-B-PAY-LV@v1.0"})
