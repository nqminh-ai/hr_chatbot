"""Oracle mutation controls, CLI exit contracts and reproducibility checks."""
import copy
import importlib.metadata
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from engine.core import KnowledgeAssistant
from run_tests import evaluate_expected, run_all_tests

ROOT = Path(__file__).resolve().parent.parent


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.cases = json.loads((ROOT / "tests/test_cases.json").read_text(encoding="utf-8"))

    def test_changed_expected_fails(self):
        result = KnowledgeAssistant().answer_query("lan", self.cases[0]["query"], "2026-10-13")
        self.assertEqual(evaluate_expected(result, self.cases[0]["expected"]), [])
        wrong = copy.deepcopy(self.cases[0]["expected"])
        wrong["notice_days"] = 99
        self.assertTrue(evaluate_expected(result, wrong))

    def test_tc07_uses_actual_response(self):
        case = self.cases[-1]
        result = KnowledgeAssistant().answer_query(case["persona"], case["query"], "2026-10-13")
        self.assertFalse(evaluate_expected(result, case["expected"]))
        result["status"] = "answered"
        self.assertTrue(evaluate_expected(result, case["expected"]))

    def test_deleted_required_clause_fails(self):
        case = self.cases[1]
        result = KnowledgeAssistant().answer_query("hung", case["query"], "2026-10-13")
        for key in ("blackout_period", "contingency"):
            bad = copy.deepcopy(result)
            bad["claims"] = [c for c in bad["claims"] if c["key"] != key]
            self.assertTrue(evaluate_expected(bad, case["expected"]))

    def test_missing_citation_fails(self):
        case = self.cases[1]
        result = KnowledgeAssistant().answer_query("hung", case["query"], "2026-10-13")
        result["citations"] = []
        self.assertTrue(evaluate_expected(result, case["expected"]))

    def test_unknown_expectation_rejected(self):
        with self.assertRaises(ValueError):
            evaluate_expected({"answer": "", "citations": []}, {"ideal": "anything"})

    def test_private_oracle_detects_date_slots_units_and_graph_mutations(self):
        result = KnowledgeAssistant().answer_query("hung", "Nghỉ phép báo trước bao lâu?", "2026-10-13")
        expected = {
            "query_date": "2026-10-13", "claim_keys": ["notice_period"],
            "claim_units": {"notice_period": "unspecified_days"}, "graph_closed": True,
        }
        self.assertEqual(evaluate_expected(result, expected), [])
        mutations = [
            {**expected, "query_date": "2027-01-01"},
            {**expected, "claim_keys": ["entitlement"]},
            {**expected, "claim_units": {"notice_period": "business_days"}},
            {"empty_graph": True},
        ]
        for wrong in mutations:
            with self.subTest(expected=wrong):
                self.assertTrue(evaluate_expected(result, wrong))
        bad = copy.deepcopy(result)
        bad["graph"]["edges"].append({"source": "missing-node", "target": "also-missing"})
        self.assertTrue(evaluate_expected(bad, {"graph_closed": True}))
        bad = copy.deepcopy(result)
        bad["graph"]["nodes"].append(copy.deepcopy(bad["graph"]["nodes"][0]))
        self.assertTrue(evaluate_expected(bad, {"graph_closed": True}))

    def test_individual_scenario_date_overrides_cli_fixture(self):
        case = {
            "id": "DATE-OVERRIDE", "persona": "lan", "query": "Quy định nghỉ phép?",
            "date": "2026-02-27", "expected": {"days": 12, "query_date": "2026-02-27"},
        }
        with tempfile.TemporaryDirectory(prefix="appota-private-date-") as folder:
            path = Path(folder) / "cases.json"
            path.write_text(json.dumps([case]), encoding="utf-8")
            results = run_all_tests(path, query_date="2026-10-13")
        self.assertTrue(results[0]["passed"], results[0]["errors"])

    def test_runner_failure_nonzero(self):
        with tempfile.TemporaryDirectory(prefix="appota-oracle-") as folder:
            path = Path(folder) / "cases.json"
            self.cases[0]["expected"]["days"] = 999
            path.write_text(json.dumps(self.cases), encoding="utf-8")
            run = subprocess.run([sys.executable, "-B", str(ROOT / "run_tests.py"), "--cases", str(path)],
                                 capture_output=True, timeout=20)
            self.assertEqual(run.returncode, 1, run.stderr.decode(errors="replace"))

    def test_smoke_checks_invariants(self):
        run = subprocess.run([sys.executable, "-B", str(ROOT / "smoke_test.py")],
                             capture_output=True, timeout=20)
        self.assertEqual(run.returncode, 0, run.stderr.decode(errors="replace"))
        import smoke_test
        with patch.object(KnowledgeAssistant, "answer_query", return_value={"status": "refused"}):
            with self.assertRaises(AssertionError):
                smoke_test.main()

    def test_scenarios_all_pass(self):
        self.assertTrue(all(case["passed"] for case in run_all_tests()))

    def test_deterministic_snapshot_result(self):
        first = KnowledgeAssistant().answer_query("hung", "Quy định nghỉ phép?", "2026-10-13")
        second = KnowledgeAssistant().answer_query("hung", "Quy định nghỉ phép?", "2026-10-13")
        self.assertEqual(first, second)

    def test_locked_environment_matches_installed(self):
        if sys.platform != "win32":
            self.skipTest("requirements.lock is the verified Windows/CPython 3.14.5 lock")
        for line in (ROOT / "requirements.lock").read_text().splitlines():
            if not line or line.startswith("#"):
                continue
            package, version = line.split()[0].split("==")
            self.assertEqual(importlib.metadata.version(package), version)

    def test_clean_environment_install(self):
        executable = ROOT / ".venv/Scripts/python.exe"
        if not executable.exists():
            self.skipTest("Provision the isolated .venv before checking clean installation")
        code = "import sys,site; assert sys.prefix != sys.base_prefix; assert not site.ENABLE_USER_SITE"
        isolated = subprocess.run([str(executable), "-B", "-c", code], capture_output=True, timeout=10)
        self.assertEqual(isolated.returncode, 0)
        deps = subprocess.run([str(executable), "-m", "pip", "check"], capture_output=True, timeout=20)
        self.assertEqual(deps.returncode, 0, deps.stdout.decode(errors="replace"))

    def test_claims_match_implementation(self):
        for path in (ROOT / "app.py", ROOT / "engine/generator.py", ROOT / "engine/semantic_matcher.py"):
            source = path.read_text(encoding="utf-8")
            self.assertNotIn("100%", source)
            self.assertNotIn("miễn nhiễm", source)


if __name__ == "__main__":
    unittest.main()
