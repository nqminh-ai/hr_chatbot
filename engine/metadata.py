"""Fail-closed schema and semantic validation before compiling a mock snapshot."""
import json
import math
from datetime import date
from pathlib import Path, PurePosixPath

from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import SchemaError

from engine.models import Clause, LifecycleEvent, MetadataError, PolicyVersion, TypedValue
from engine.semantic_matcher import compile_scope_patterns
from engine.snapshot import (
    DEFAULT_DATA, DEFAULT_SCHEMA, KnowledgeSnapshot, ancestor_path, fingerprint, freeze,
)

LEVELS = ("Group", "Company", "Department", "Team")
VALUE_UNITS = {"entitlement": {"annual_paid_days", "not_applicable"},
               "notice_period": {"business_days", "calendar_days", "unspecified_days"}}


def unique_index(records, key):
    index = {item[key]: item for item in records}
    if len(index) != len(records):
        raise MetadataError(f"Duplicate {key}")
    return index


def validate_organization(units, personas):
    roots = [unit for unit in units.values() if unit["parent"] is None]
    if len(roots) != 1 or roots[0]["level"] != "Group":
        raise MetadataError("Organization needs one Group root")
    for unit in units.values():
        ancestor_path(units, unit["id"])
        if unit["parent"] is not None:
            parent = units[unit["parent"]]
            if LEVELS.index(parent["level"]) + 1 != LEVELS.index(unit["level"]):
                raise MetadataError("Invalid parent level")
    for profile in personas.values():
        path = ancestor_path(units, profile["team"] or profile["department"])
        for field, level in (("company", "Company"), ("department", "Department"), ("team", "Team")):
            unit_id = profile[field]
            if unit_id is not None and (unit_id not in path or units[unit_id]["level"] != level):
                raise MetadataError("Inconsistent persona organization chain")


def validate_lifecycle(document):
    lifecycle = document["lifecycle"]
    start = date.fromisoformat(lifecycle["valid_from"])
    end = date.fromisoformat(lifecycle["valid_to"]) if lifecycle["valid_to"] else None
    if end and end <= start:
        raise MetadataError("Non-positive validity interval")
    events = lifecycle["events"]
    dates = [date.fromisoformat(event["at"]) for event in events]
    if dates != sorted(dates):
        raise MetadataError("Unordered lifecycle events")
    allowed = {None: {"drafted", "approved"}, "drafted": {"approved"},
               "approved": {"superseded", "revoked"}, "superseded": set(), "revoked": set()}
    previous = None
    for event in events:
        if event["event"] not in allowed[previous]:
            raise MetadataError("Invalid lifecycle transition")
        previous = event["event"]
        if previous == "approved" and date.fromisoformat(event["at"]) > start:
            raise MetadataError("Approval after effective date")
    states = {"drafted": "Draft", "approved": "Approved", "superseded": "Superseded", "revoked": "Revoked"}
    if states[previous] != lifecycle["state"]:
        raise MetadataError("State differs from final lifecycle event")
    if previous == "superseded" and (not end or dates[-1] != end):
        raise MetadataError("Superseded version needs explicit end date")


def validate_clause(clause, document):
    if clause["clause_id"] != document["doc_uid"] + "#" + clause["key"]:
        raise MetadataError("Clause identity differs from document/key")
    value = clause["typed_value"]
    if value["kind"] == "number" and not math.isfinite(value["value"]):
        raise MetadataError("Numeric clause must be finite")
    units = VALUE_UNITS.get(clause["key"], {"not_applicable"})
    if value["unit"] not in units:
        raise MetadataError("Clause has incompatible unit")
    numeric = clause["key"] in VALUE_UNITS
    if numeric and value["kind"] not in {"number", "unlimited"}:
        raise MetadataError("Numeric clause cannot be enum")
    if value["kind"] == "unlimited" and clause["key"] != "entitlement":
        raise MetadataError("Only entitlement supports unlimited")
    if not numeric and value["kind"] != "enum":
        raise MetadataError("Categorical clause must be enum")
    if clause["is_floor"] and (value["kind"] != "number" or value["unit"] == "unspecified_days"):
        raise MetadataError("Floor needs a numeric value with a known unit")
    if not clause["is_floor"] and clause["comparison"] != "none":
        raise MetadataError("Non-floor cannot declare floor comparison")
    source = clause["source_ref"]
    if source["path"] != document["provenance"]["source_path"]:
        raise MetadataError("Clause source differs from document source")
    if not document["provenance"]["line_start"] <= source["line"] <= document["provenance"]["line_end"]:
        raise MetadataError("Clause source line outside document")


def validate_documents(documents, units, source_hashes):
    index = unique_index(documents, "doc_uid")
    all_clauses = []
    for document in documents:
        if document["doc_uid"] != document["policy_id"] + "@" + document["version"]:
            raise MetadataError("Document identity differs from policy/version")
        scope = document["scope"]
        if scope["unit_id"] not in units or units[scope["unit_id"]]["level"] != scope["level"]:
            raise MetadataError("Unknown scope or scope level mismatch")
        provenance = document["provenance"]
        path = PurePosixPath(provenance["source_path"])
        if path.is_absolute() or ".." in path.parts or ":" in str(path):
            raise MetadataError("Source path must stay relative")
        if source_hashes.get(str(path)) != provenance["sha256"]:
            raise MetadataError("Source fingerprint mismatch")
        validate_lifecycle(document)
        unique_index(document["clauses"], "key")
        for clause in document["clauses"]:
            validate_clause(clause, document)
            all_clauses.append(clause)
        for previous in document["supersedes"]:
            if previous not in index or previous == document["doc_uid"]:
                raise MetadataError("Unknown/self supersedes reference")
            old = index[previous]
            if (old["policy_id"], old["scope"]) != (document["policy_id"], document["scope"]):
                raise MetadataError("Supersedes crosses policy/scope")
            if old["lifecycle"]["valid_from"] >= document["lifecycle"]["valid_from"]:
                raise MetadataError("Supersedes must point backwards in time")
    unique_index(all_clauses, "clause_id")


def compile_document(raw):
    lifecycle, access = raw["lifecycle"], raw["access"]
    clauses = tuple(Clause(c["clause_id"], c["key"], c["text_source"],
                           TypedValue(**c["typed_value"]), c["is_floor"], freeze(c["source_ref"]))
                    for c in raw["clauses"])
    return PolicyVersion(
        raw["doc_uid"], raw["policy_id"], raw["version"], raw["title"], raw["topic"],
        raw["scope"]["unit_id"], raw["scope"]["level"], lifecycle["state"],
        date.fromisoformat(lifecycle["valid_from"]),
        date.fromisoformat(lifecycle["valid_to"]) if lifecycle["valid_to"] else None,
        tuple(LifecycleEvent(e["event"], date.fromisoformat(e["at"])) for e in lifecycle["events"]),
        access["classification"], tuple(access["allowed_roles"]), tuple(access["applies_to"]),
        tuple(access["audience_roles"]), clauses, freeze(raw),
    )


def snapshot_from_bytes(data_bytes, schema_bytes):
    try:
        raw, schema = json.loads(data_bytes), json.loads(schema_bytes)
        Draft202012Validator.check_schema(schema)
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        errors = list(validator.iter_errors(raw))
        if errors:
            location = "/".join(str(part) for part in errors[0].absolute_path)
            raise MetadataError(f"Schema violation at {location}: {errors[0].validator}")
        units = unique_index(raw["organization"], "id")
        personas = unique_index(raw["personas"], "user_id")
        if any(key != key.casefold().strip() for key in personas):
            raise MetadataError("Persona IDs must be canonical lowercase")
        validate_organization(units, personas)
        validate_documents(raw["documents"], units, raw["source_sha256"])
        documents = tuple(compile_document(doc) for doc in raw["documents"])
        return KnowledgeSnapshot(fingerprint(data_bytes, schema_bytes), documents,
                                 freeze(units), freeze(personas), freeze(raw), compile_scope_patterns(units))
    except (json.JSONDecodeError, UnicodeDecodeError, SchemaError, KeyError, TypeError) as error:
        raise MetadataError("Malformed metadata structure") from error


def load_snapshot(data_file=DEFAULT_DATA, schema_file=DEFAULT_SCHEMA):
    try:
        return snapshot_from_bytes(Path(data_file).read_bytes(), Path(schema_file).read_bytes())
    except OSError as error:
        raise MetadataError("Cannot read dataset/schema") from error
