"""Run regression/UI tests and scenarios, recording reproducible evidence."""
import hashlib
import io
import json
import platform
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

from run_tests import run_all_suites
from contracts import run_contracts

ROOT = Path(__file__).resolve().parent


def test_ids(suite):
    for test in suite:
        if isinstance(test, unittest.TestSuite):
            yield from test_ids(test)
        else:
            yield test.id()


def main():
    folder = ROOT / "docs/evidence"
    folder.mkdir(parents=True, exist_ok=True)
    suite = unittest.defaultTestLoader.discover(str(ROOT / "tests"), pattern="test_*.py")
    ids = list(test_ids(suite))
    stream = io.StringIO()
    start = perf_counter()
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
    suites = run_all_suites()
    suites["contracts"] = run_contracts()
    scenarios = [case for cases in suites.values() for case in cases]
    paths = sorted(ROOT.glob("engine/*.py")) + sorted(ROOT.glob("tests/*.py"))
    paths += sorted((ROOT / "api").glob("*.py")) + sorted((ROOT / "public").glob("*"))
    paths += [ROOT / name for name in ("vercel.json", "requirements-dev.txt", "web_preview.py")]
    paths += [ROOT / name for name in ("app.py", "run_tests.py", "smoke_test.py", "benchmark.py", "validate.py", "manage_database.py", "run_app.bat", "manage_database.bat", "run_private_tests.bat", "requirements.lock", "requirements.txt", ".python-version", "README.md", "docs/accuracy_rules_and_graph_architecture.md", "docs/database.md", "data/knowledge.json", "schemas/knowledge_runtime_v2.schema.json", "tests/test_cases.json", "tests/private_test_cases.json")]
    paths += sorted((ROOT / "database").glob("*.sql")) + sorted((ROOT / "data/csv").glob("*.csv"))
    paths += [ROOT / "contracts.py", ROOT / "tests/detailed_test_cases.json", ROOT / "tests/policy_contracts.json"]
    paths += sorted((ROOT / "frontend/src").rglob("*.ts")) + sorted((ROOT / "frontend/src").rglob("*.tsx"))
    paths += sorted((ROOT / "frontend/scripts").glob("*.cjs"))
    paths += sorted((ROOT / "frontend/tests").glob("*"))
    paths += sorted((ROOT / "scripts").glob("*.py")) + sorted((ROOT / "supabase").rglob("*.sql"))
    paths += [ROOT / name for name in (".gitattributes", "data/intent_rules.json", "frontend/package.json", "frontend/package-lock.json", "frontend/vitest.config.mts")]
    report = {"generated_at": datetime.now(timezone.utc).isoformat(), "python": platform.python_version(),
              "platform": platform.platform(), "isolated_venv": sys.prefix != sys.base_prefix,
              "elapsed_seconds": perf_counter() - start, "tests_run": result.testsRun,
              "test_ids": ids, "failures": [(str(t), detail) for t, detail in result.failures],
              "errors": [(str(t), detail) for t, detail in result.errors],
              "skipped": [(str(t), reason) for t, reason in result.skipped],
              "scenario_passed": sum(r["passed"] for r in scenarios), "scenario_total": len(scenarios),
              "scenario_suites": {name: {"passed": sum(case["passed"] for case in cases), "total": len(cases),
                                         "failed_ids": [case["id"] for case in cases if not case["passed"]]}
                                   for name, cases in suites.items()},
              "source_sha256": {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}
    (folder / "test_results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (folder / "unittest.log").write_text(stream.getvalue(), encoding="utf-8")
    (folder / "scenarios.json").write_text(json.dumps(scenarios, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for name, cases in suites.items():
        (folder / (name + "_test_results.json")).write_text(json.dumps(cases, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{name}: {sum(case['passed'] for case in cases)}/{len(cases)}; "
              f"failed={[case['id'] for case in cases if not case['passed']]}")
    print(f"{result.testsRun} tests; failures={len(result.failures)} errors={len(result.errors)}; "
          f"{report['scenario_passed']}/{len(scenarios)} scenarios; isolated_venv={report['isolated_venv']}")
    return 0 if result.wasSuccessful() and scenarios and all(r["passed"] for r in scenarios) else 1


if __name__ == "__main__":
    raise SystemExit(main())
