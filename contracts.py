"""Compare both engines against independent shared policy fixtures; no live providers."""
import copy
import inspect
from datetime import date
import json
import subprocess
from pathlib import Path

from engine.core import KnowledgeAssistant
from engine.metadata import snapshot_from_bytes
from engine.snapshot import BusinessClock, DEFAULT_DATA, DEFAULT_SCHEMA

ROOT = Path(__file__).resolve().parent


class ContractClock(BusinessClock):
    def today(self):
        return date(2026, 10, 14)


def canonical_python(result):
    return {"status": result["status"], "query_date": result["query_date"], "claims": {
        claim["key"]: {"value": claim["value"], "unit": claim["unit"],
                       "source": claim["source"]["doc_id"] + "@" + claim["source"]["version"]}
        for claim in result["claims"]}, "citations": {
        citation["clause_id"]: {
            "doc_uid": citation["doc_uid"],
            "valid_from": citation["valid_from"],
            "valid_to": citation["valid_to"],
            "scope_level": citation["scope_level"],
            "text_source": citation["text_source"],
            "source_ref": citation["source_ref"],
        }
        for citation in result.get("citations", [])}}


def contract_errors(actual, expected):
    return [key + " differs" for key in ("status", "query_date", "claims") if actual[key] != expected[key]]


def parity_errors(python_result, typescript_result):
    return [] if python_result == typescript_result else ["engine parity differs"]


def fixture_snapshot(case, base_data, schema_bytes):
    fixture = case.get("fixture")
    if not fixture:
        return None
    data = copy.deepcopy(base_data)
    documents = [doc for doc in data["documents"] if doc["policy_id"] == fixture["policy_id"]]
    if not documents:
        raise ValueError("Unknown fixture policy: " + fixture["policy_id"])
    for document in documents:
        version = document["version"]
        if version in fixture.get("audience_roles_by_version", {}):
            document["access"]["audience_roles"] = fixture["audience_roles_by_version"][version]
        if version in fixture.get("valid_to_by_version", {}):
            document["lifecycle"]["valid_to"] = fixture["valid_to_by_version"][version]
        if version in fixture.get("last_event_at_by_version", {}):
            document["lifecycle"]["events"][-1]["at"] = fixture["last_event_at_by_version"][version]
    return snapshot_from_bytes(json.dumps(data, ensure_ascii=False).encode("utf-8"), schema_bytes,
                               allow_inactive_mock=True)


def run_contracts():
    cases = json.loads((ROOT / "tests/policy_contracts.json").read_text(encoding="utf-8"))
    process = subprocess.run(["node", str(ROOT / "frontend/scripts/check-contracts.cjs"), "--json"],
                             capture_output=True, text=True, encoding="utf-8", timeout=30, cwd=ROOT)
    if process.returncode:
        raise ValueError("TypeScript contract runner failed: " + process.stderr)
    typescript = {item["id"]: item["actual"] for item in json.loads(process.stdout)}
    base_data = json.loads(DEFAULT_DATA.read_text(encoding="utf-8"))
    schema_bytes = DEFAULT_SCHEMA.read_bytes()
    assistant = KnowledgeAssistant(clock=ContractClock())
    results = []
    supports_history = "history" in inspect.signature(assistant.answer_query).parameters
    for case in cases:
        snapshot = fixture_snapshot(case, base_data, schema_bytes)
        case_assistant = KnowledgeAssistant(snapshot=snapshot, clock=ContractClock()) if snapshot else assistant
        kwargs = {"history": case.get("history", [])} if supports_history else {}
        actual = canonical_python(case_assistant.answer_query(case["persona"], case["query"], case["date"], **kwargs))
        ts_actual = typescript[case["id"]]
        errors = ["python: " + error for error in contract_errors(actual, case["expected"])]
        errors += ["typescript: " + error for error in contract_errors(ts_actual, case["expected"])]
        errors += parity_errors(actual, ts_actual)
        results.append({"id": case["id"], "passed": not errors, "errors": errors,
                        "python": actual, "typescript": ts_actual})
    return results
