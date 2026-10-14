"""Scenario oracle: validate every declared expectation; failures return exit 1."""
import argparse
import json
import sys
from pathlib import Path

from engine.core import KnowledgeAssistant
from engine.filter import AccessFilter

ROOT = Path(__file__).resolve().parent
SCENARIO_SUITES = {"public": ROOT / "tests/test_cases.json",
                  "private": ROOT / "tests/private_test_cases.json",
                  "detailed": ROOT / "tests/detailed_test_cases.json"}
EXPECTED_KEYS = {
    "status", "days", "notice_days", "primary_doc", "inherited_docs",
    "should_exclude", "refusal", "no_leakage", "should_not_mention",
    "should_not_claim", "required_clauses", "answer_contains", "answer_not_contains",
    "query_date", "claim_keys", "claim_units", "empty_graph", "graph_closed",
}


def evaluate_expected(result, expected):
    """Return mismatches without deriving expected values from the implementation."""
    unknown = set(expected) - EXPECTED_KEYS
    if unknown or not expected:
        raise ValueError(f"Unsupported or empty expectations: {sorted(unknown)}")
    failures = []
    answer = result["answer"]
    public = json.dumps(result, ensure_ascii=False, sort_keys=True)
    claims = {claim["key"]: claim for claim in result.get("claims", [])}
    sources = {f"{c['doc_id']} {c['version']}" for c in result["citations"]}
    for field, key in (("days", "entitlement"), ("notice_days", "notice_period")):
        if field in expected and claims.get(key, {}).get("value") != expected[field]:
            failures.append(f"{field}: expected {expected[field]}")
    if "status" in expected and result.get("status") != expected["status"]:
        failures.append(f"status: expected {expected['status']}")
    if expected.get("refusal") and answer != AccessFilter.NEUTRAL_REFUSAL_MESSAGE:
        failures.append("neutral refusal differs")
    if expected.get("no_leakage") and (result["citations"] or result.get("claims")):
        failures.append("refusal contains claims/citations")
    required = ([expected["primary_doc"]] if "primary_doc" in expected else [])
    required += expected.get("inherited_docs", [])
    failures += [f"missing source: {source}" for source in required if source not in sources]
    forbidden = expected.get("should_exclude", []) + expected.get("should_not_mention", [])
    failures += [f"forbidden content: {value}" for value in forbidden if value in public]
    for value in expected.get("required_clauses", []):
        if value not in claims:
            failures.append(f"missing clause: {value}")
    negatives = expected.get("answer_not_contains", [])
    if "should_not_claim" in expected:
        negatives = negatives + [expected["should_not_claim"]]
    failures += [f"forbidden answer: {value}" for value in negatives if value in answer]
    failures += [f"missing answer: {value}" for value in expected.get("answer_contains", []) if value not in answer]
    return failures + evaluate_structure(result, expected, claims)


def evaluate_structure(result, expected, claims):
    """Check temporal, typed-claim and graph invariants for private scenarios."""
    failures = []
    if "query_date" in expected and result.get("query_date") != expected["query_date"]:
        failures.append(f"query_date: expected {expected['query_date']}")
    if "claim_keys" in expected and set(claims) != set(expected["claim_keys"]):
        failures.append(f"claim_keys: expected {expected['claim_keys']}")
    for key, unit in expected.get("claim_units", {}).items():
        if claims.get(key, {}).get("unit") != unit:
            failures.append(f"{key} unit: expected {unit}")
    graph = result.get("graph", {})
    nodes, edges = graph.get("nodes", []), graph.get("edges", [])
    if expected.get("empty_graph") and (nodes or edges):
        failures.append("graph must be empty")
    if expected.get("graph_closed"):
        node_ids = {node["id"] for node in nodes}
        if len(node_ids) != len(nodes):
            failures.append("duplicate graph node IDs")
        if any(edge["source"] not in node_ids or edge["target"] not in node_ids for edge in edges):
            failures.append("graph contains dangling edges")
    return failures


def run_all_tests(cases_path=ROOT / "tests/test_cases.json", query_date="2026-10-13", database_file=None):
    assistant = KnowledgeAssistant(database_file=database_file)
    cases = json.loads(Path(cases_path).read_text(encoding="utf-8"))
    results = []
    for case in cases:
        actual = assistant.answer_query(case["persona"], case["query"], case.get("date", query_date))
        errors = evaluate_expected(actual, case["expected"])
        results.append({"id": case["id"], "passed": not errors, "errors": errors, "actual": actual})
    return results


def run_all_suites(database_file=None):
    return {name: run_all_tests(path, database_file=database_file) for name, path in SCENARIO_SUITES.items()}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, default=ROOT / "tests/test_cases.json")
    parser.add_argument("--date", default="2026-10-13", help="Fixture date; individual case date overrides this")
    parser.add_argument("--report", type=Path, help="Optional JSON evidence output")
    parser.add_argument("--db", type=Path, help="Test an actual SQLite database instead of the fixed JSON fixture")
    args = parser.parse_args(argv)
    try:
        results = run_all_tests(args.cases, args.date, args.db)
    except (ValueError, OSError, KeyError) as error:
        print(f"Scenario configuration error: {error}", file=sys.stderr)
        return 2
    for result in results:
        print(f"{result['id']}: {'PASS' if result['passed'] else 'FAIL'} {result['errors']}")
    print(f"{sum(r['passed'] for r in results)}/{len(results)} scenarios passed")
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0 if results and all(r["passed"] for r in results) else 1


if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
