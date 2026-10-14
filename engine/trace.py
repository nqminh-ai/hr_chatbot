"""Public trace contains only already-authorized selected clause identities."""
import hashlib
import json


def make_trace(snapshot_id, day, claims, status):
    payload = {"snapshot_id": snapshot_id, "query_date": day.isoformat(), "status": status,
               "selected_clause_ids": [claim["source"]["clause_id"] for claim in claims],
               "floor_decisions": [claim["source"]["clause_id"] for claim in claims if claim["floor_applied"]]}
    payload["trace_id"] = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:20]
    return payload
