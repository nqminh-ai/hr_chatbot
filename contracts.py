"""Compare both engines against independent shared policy fixtures; no live providers."""
import inspect
from datetime import date
import json
import subprocess
from pathlib import Path

from engine.core import KnowledgeAssistant
from engine.snapshot import BusinessClock

ROOT = Path(__file__).resolve().parent


class ContractClock(BusinessClock):
    def today(self):
        return date(2026, 10, 14)


def canonical_python(result):
    return {"status": result["status"], "query_date": result["query_date"], "claims": {
        claim["key"]: {"value": claim["value"], "unit": claim["unit"],
                       "source": claim["source"]["doc_id"] + "@" + claim["source"]["version"]}
        for claim in result["claims"]}}


def contract_errors(actual, expected):
    return [key + " differs" for key in ("status", "query_date", "claims") if actual[key] != expected[key]]


def run_contracts():
    cases = json.loads((ROOT / "tests/policy_contracts.json").read_text(encoding="utf-8"))
    process = subprocess.run(["node", str(ROOT / "frontend/scripts/check-contracts.cjs"), "--json"],
                             capture_output=True, text=True, encoding="utf-8", timeout=30, cwd=ROOT)
    if process.returncode:
        raise ValueError("TypeScript contract runner failed: " + process.stderr)
    typescript = {item["id"]: item["actual"] for item in json.loads(process.stdout)}
    assistant = KnowledgeAssistant(clock=ContractClock())
    results = []
    supports_history = "history" in inspect.signature(assistant.answer_query).parameters
    for case in cases:
        kwargs = {"history": case.get("history", [])} if supports_history else {}
        actual = canonical_python(assistant.answer_query(case["persona"], case["query"], case["date"], **kwargs))
        ts_actual = typescript[case["id"]]
        errors = ["python: " + error for error in contract_errors(actual, case["expected"])]
        errors += ["typescript: " + error for error in contract_errors(ts_actual, case["expected"])]
        if actual != ts_actual:
            errors.append("engine parity differs")
        results.append({"id": case["id"], "passed": not errors, "errors": errors,
                        "python": actual, "typescript": ts_actual})
    return results
