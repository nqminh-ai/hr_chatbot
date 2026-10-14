"""Lossless flat tables / CSV interchange for the validated runtime dataset."""
import csv
import json
from pathlib import Path

from engine.models import MetadataError

# Column type declarations drive strict CSV parsing and parameterized SQL inserts.
TABLES = {
    "dataset_info": "singleton:i schema_version artifact_kind activation_allowed:b created_on timezone sample_id",
    "source_hashes": "source_path sha256",
    "migration_decisions": "id position:i status description owner evidence",
    "organization": "id position:i name level parent query_aliases_json",
    "personas": "user_id position:i name company department team role contract_type description",
    "documents": "doc_uid position:i policy_id version title topic scope_id scope_level lifecycle_state valid_from valid_to history_evidence classification allowed_roles_json applies_to_json audience_roles_json deny_on_missing:b owner_id review_due review_state source_path line_start:i line_end:i source_sha256 source_type",
    "clauses": "clause_id doc_uid position:i clause_key label text_source value_kind value_number:n value_text unit render_template is_floor:b comparison source_path source_line:i json_pointer review_flags_json",
    "lifecycle_events": "doc_uid position:i event event_date evidence_type",
    "supersedes": "doc_uid previous_uid position:i",
}
NULLABLE = {
    "migration_decisions": {"owner", "evidence"}, "organization": {"parent"},
    "personas": {"team"}, "documents": {"valid_to", "review_due"},
    "clauses": {"value_number", "value_text"},
}
NULL = r"\N"


def columns(table):
    return [part.split(":")[0] for part in TABLES[table].split()]


def packed(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def document_row(doc, position):
    lifecycle, access = doc["lifecycle"], doc["access"]
    row = {key: doc[key] for key in ("doc_uid", "policy_id", "version", "title", "topic")}
    row.update(position=position, scope_id=doc["scope"]["unit_id"], scope_level=doc["scope"]["level"],
               lifecycle_state=lifecycle["state"], valid_from=lifecycle["valid_from"],
               valid_to=lifecycle["valid_to"], history_evidence=lifecycle["history_evidence"],
               classification=access["classification"], deny_on_missing=int(access["deny_on_missing"]))
    row.update({key + "_json": packed(access[key]) for key in ("allowed_roles", "applies_to", "audience_roles")})
    row.update(doc["governance"])
    row.update({("source_sha256" if key == "sha256" else key): value for key, value in doc["provenance"].items()})
    return row


def clause_row(doc_uid, clause, position):
    typed, source = clause["typed_value"], clause["source_ref"]
    row = {key: clause[key] for key in ("clause_id", "label", "text_source", "render_template", "comparison")}
    row.update(doc_uid=doc_uid, position=position, clause_key=clause["key"], value_kind=typed["kind"],
               value_number=typed["value"] if typed["kind"] == "number" else None,
               value_text=typed["value"] if typed["kind"] == "enum" else None,
               unit=typed["unit"], is_floor=int(clause["is_floor"]), source_path=source["path"],
               source_line=source["line"], json_pointer=source["json_pointer"],
               review_flags_json=packed(clause["review_flags"]))
    return row


def to_tables(raw):
    tables = {table: [] for table in TABLES}
    tables["dataset_info"] = [{"singleton": 1, **{key: raw[key] for key in columns("dataset_info")[1:]}}]
    tables["dataset_info"][0]["activation_allowed"] = int(raw["activation_allowed"])
    tables["source_hashes"] = [{"source_path": key, "sha256": value} for key, value in raw["source_sha256"].items()]
    for table in ("migration_decisions", "organization", "personas"):
        for position, record in enumerate(raw[table]):
            row = {"position": position, **record}
            if table == "organization":
                row["query_aliases_json"] = packed(row.pop("query_aliases"))
            tables[table].append(row)
    for position, doc in enumerate(raw["documents"]):
        tables["documents"].append(document_row(doc, position))
        tables["clauses"].extend(clause_row(doc["doc_uid"], c, p) for p, c in enumerate(doc["clauses"]))
        tables["lifecycle_events"].extend({"doc_uid": doc["doc_uid"], "position": p,
                                         "event": e["event"], "event_date": e["at"], "evidence_type": e["evidence_type"]}
                                        for p, e in enumerate(doc["lifecycle"]["events"]))
        tables["supersedes"].extend({"doc_uid": doc["doc_uid"], "previous_uid": uid, "position": p}
                                   for p, uid in enumerate(doc["supersedes"]))
    return tables


def ordered(rows):
    return sorted(rows, key=lambda row: row["position"])


def clause_from_row(row):
    value = row["value_number"] if row["value_kind"] == "number" else row["value_text"]
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return {"clause_id": row["clause_id"], "key": row["clause_key"], "label": row["label"],
            "text_source": row["text_source"], "render_template": row["render_template"],
            "comparison": row["comparison"], "is_floor": bool(row["is_floor"]),
            "typed_value": {"kind": row["value_kind"], "value": value, "unit": row["unit"]},
            "source_ref": {"path": row["source_path"], "line": row["source_line"], "json_pointer": row["json_pointer"]},
            "review_flags": json.loads(row["review_flags_json"])}


def document_from_row(row, tables):
    uid = row["doc_uid"]
    events = ordered(tables["lifecycle_events"])
    doc = {key: row[key] for key in ("doc_uid", "policy_id", "version", "title", "topic")}
    doc.update(scope={"unit_id": row["scope_id"], "level": row["scope_level"]},
               lifecycle={"state": row["lifecycle_state"], "valid_from": row["valid_from"],
                          "valid_to": row["valid_to"], "history_evidence": row["history_evidence"],
                          "events": [{"event": e["event"], "at": e["event_date"], "evidence_type": e["evidence_type"]} for e in events]},
               access={"classification": row["classification"], "deny_on_missing": bool(row["deny_on_missing"]),
                       **{key: json.loads(row[key + "_json"]) for key in ("allowed_roles", "applies_to", "audience_roles")}},
               governance={key: row[key] for key in ("owner_id", "review_due", "review_state")},
               provenance={"sha256": row["source_sha256"], **{key: row[key] for key in ("source_path", "line_start", "line_end", "source_type")}},
               supersedes=[e["previous_uid"] for e in ordered(tables["supersedes"])],
               clauses=[clause_from_row(c) for c in ordered(tables["clauses"])])
    return doc


def from_tables(tables):
    if len(tables["dataset_info"]) != 1:
        raise MetadataError("Exactly one dataset_info row is required")
    raw = {key: value for key, value in tables["dataset_info"][0].items() if key != "singleton"}
    raw["activation_allowed"] = bool(raw["activation_allowed"])
    raw["source_sha256"] = {row["source_path"]: row["sha256"] for row in tables["source_hashes"]}
    for table in ("migration_decisions", "organization", "personas"):
        raw[table] = [{key: value for key, value in row.items() if key != "position"} for row in ordered(tables[table])]
    for unit in raw["organization"]:
        unit["query_aliases"] = json.loads(unit.pop("query_aliases_json"))
    # Group children once, rather than rescanning every child table per document.
    grouped = {name: {} for name in ("lifecycle_events", "supersedes", "clauses")}
    for name, index in grouped.items():
        for row in tables[name]:
            index.setdefault(row["doc_uid"], []).append(row)
    raw["documents"] = [document_from_row(row, {name: index.get(row["doc_uid"], []) for name, index in grouped.items()})
                        for row in ordered(tables["documents"])]
    return raw


def parse_cell(table, column, kind, value):
    if value == NULL:
        if column not in NULLABLE.get(table, set()):
            raise ValueError(f"{column} cannot be NULL")
        return None
    if kind == "text" and value.startswith("\\\\"):
        return value[1:]
    if kind == "b":
        if value not in {"0", "1"}:
            raise ValueError(f"{column} must be 0 or 1")
        return int(value)
    if kind == "i":
        return int(value)
    if kind == "n":
        return int(value) if value.lstrip("+-").isdigit() else float(value)
    return value


def read_csv_tables(folder):
    tables = {}
    for table, spec in TABLES.items():
        path = Path(folder) / f"{table}.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle, strict=True)
            if reader.fieldnames != columns(table):
                raise MetadataError(f"{path.name}: header must exactly match {columns(table)}")
            rows = []
            for line, row in enumerate(reader, 2):
                try:
                    if None in row or any(value is None for value in row.values()):
                        raise ValueError("Wrong column count")
                    rows.append({part.split(":")[0]: parse_cell(table, part.split(":")[0],
                                 part.split(":")[1] if ":" in part else "text", row[part.split(":")[0]])
                                 for part in spec.split()})
                except (ValueError, TypeError) as error:
                    raise MetadataError(f"{path.name}:{line}: {error}") from error
            tables[table] = rows
    return tables


def write_csv_tables(folder, tables, overwrite=False):
    folder = Path(folder)
    paths = [folder / f"{table}.csv" for table in TABLES]
    if not overwrite and any(path.exists() for path in paths):
        raise FileExistsError("CSV already exists; choose a new folder or explicitly use --overwrite")
    folder.mkdir(parents=True, exist_ok=True)
    for table, path in zip(TABLES, paths):
        with path.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=columns(table), quoting=csv.QUOTE_ALL)
            writer.writeheader()
            writer.writerows({key: csv_value(value) for key, value in row.items()} for row in tables[table])
    return paths


def csv_value(value):
    if value is None:
        return NULL
    if isinstance(value, str) and value.startswith("\\"):
        return "\\" + value
    return value
