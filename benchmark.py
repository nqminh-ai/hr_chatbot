"""Measure warm-snapshot answer latency; never modifies the active dataset."""
import argparse
import copy
import json
import platform
import statistics
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

from engine.core import KnowledgeAssistant
from engine.metadata import snapshot_from_bytes
from engine.snapshot import DEFAULT_DATA, DEFAULT_SCHEMA
from engine.storage import canonical_bytes, initialize_database, runtime_data_bytes
from engine.tabular import from_tables, to_tables


def scaled_fixture(raw, extra_documents):
    raw = copy.deepcopy(raw)
    template = next(d for d in raw["documents"] if d["doc_uid"] == "POL-A-LV@v2.0")
    root = next(u["id"] for u in raw["organization"] if u["parent"] is None)
    for index in range(extra_documents):
        unit_id = f"SCALE_{index}"
        raw["organization"].append({"id": unit_id, "name": unit_id, "level": "Company", "parent": root, "query_aliases": []})
        doc = copy.deepcopy(template)
        doc["policy_id"] = f"POL-SCALE-{index}"
        doc["doc_uid"] = doc["policy_id"] + "@v2.0"
        doc["scope"]["unit_id"] = unit_id
        doc["supersedes"] = []
        for clause in doc["clauses"]:
            clause["clause_id"] = doc["doc_uid"] + "#" + clause["key"]
        raw["documents"].append(doc)
    return raw


def measure(raw, samples):
    snapshot_from_bytes.cache_clear()
    before = perf_counter()
    snapshot = snapshot_from_bytes(json.dumps(raw).encode(), DEFAULT_SCHEMA.read_bytes())
    build_ms = (perf_counter() - before) * 1000
    assistant = KnowledgeAssistant(snapshot=snapshot)
    durations = []
    for index in range(samples + 5):
        start = perf_counter()
        result = assistant.answer_query("hung", "Quy định nghỉ phép?", "2026-10-13")
        elapsed = (perf_counter() - start) * 1000
        if result["status"] != "answered" or len(result["citations"]) != 5:
            raise RuntimeError("Benchmark result lost its correctness contract")
        if index >= 5:
            durations.append(elapsed)
    ordered = sorted(durations)
    return {"documents": len(snapshot.documents), "samples": samples, "snapshot_build_ms": build_ms,
            "p50_ms": statistics.median(ordered), "p95_ms": ordered[min(len(ordered) - 1, int(len(ordered) * .95))],
            "max_ms": max(ordered), "snapshot_id": snapshot.snapshot_id}


def measure_storage(raw, scaled, samples):
    def timing(action):
        durations = []
        for _ in range(min(samples, 20)):
            start = perf_counter(); action(); durations.append((perf_counter() - start) * 1000)
        return {"p50_ms": statistics.median(durations), "max_ms": max(durations), "samples": len(durations)}
    tables = to_tables(scaled)
    reconstruction = timing(lambda: from_tables(tables))
    with tempfile.TemporaryDirectory(prefix="appota-benchmark-") as folder:
        db = Path(folder) / "benchmark.db"
        initialize_database(db, raw)
        data = runtime_data_bytes(db)
        schema = DEFAULT_SCHEMA.read_bytes()
        # Same business validator with caching disabled: local comparison baseline.
        uncached = timing(lambda: snapshot_from_bytes.__wrapped__(runtime_data_bytes(db), schema))
        snapshot_from_bytes(data, schema)
        cached = timing(lambda: snapshot_from_bytes(runtime_data_bytes(db), schema))
        if canonical_bytes(from_tables(tables)) != canonical_bytes(scaled):
            raise RuntimeError("Tabular reconstruction changed the dataset")
    return {"measurement": "consistent SQLite read + one validation; uncached baseline excludes previous duplicate caller validation",
            "reconstruction": reconstruction, "uncached_read": uncached, "cached_read": cached}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=int, default=100)
    parser.add_argument("--extra-documents", type=int, default=1000)
    parser.add_argument("--output", type=Path, default=Path("docs/evidence/benchmark.json"))
    args = parser.parse_args()
    if args.samples < 1 or not 0 <= args.extra_documents <= 10000:
        parser.error("Positive samples and 0..10000 extra documents required")
    raw = json.loads(DEFAULT_DATA.read_bytes())
    scaled = scaled_fixture(raw, args.extra_documents)
    report = {"measured_at": datetime.now(timezone.utc).isoformat(), "python": platform.python_version(),
              "platform": platform.platform(), "measurement": "warm immutable snapshot; includes routing/filter/resolve/render/graph, excludes reload I/O",
              "fixture": measure(raw, args.samples),
              "scaled": measure(scaled, args.samples), "storage": measure_storage(raw, scaled, args.samples)}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
