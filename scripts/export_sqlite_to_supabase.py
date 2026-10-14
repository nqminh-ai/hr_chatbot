"""Generate validated PostgreSQL seed from one SQLite snapshot; never uploads data.

fresh: plain INSERTs, conflicts abort the transaction.
upsert: explicitly update matching primary keys; retains target-only rows.
Use verify_readback() after importing to compare all nine normalized tables.
"""
import argparse
import json
import math
import os
import re
import sys
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from engine.storage import DEFAULT_DATABASE, canonical_bytes, dataset_sha, read_dataset
from engine.tabular import TABLES, columns, from_tables, packed, to_tables

SQLITE_DB = DEFAULT_DATABASE
OUTPUT_SEED = ROOT / "supabase/seed.sql"
TABLES_ORDER = list(TABLES)
JSON_COLUMNS = {
    "organization": {"query_aliases_json": "query_aliases"},
    "documents": {name + "_json": name for name in ("allowed_roles", "applies_to", "audience_roles")},
    "clauses": {"review_flags_json": "review_flags"},
}
BOOLEAN_COLUMNS = {"dataset_info": {"activation_allowed"}, "documents": {"deny_on_missing"}, "clauses": {"is_floor"}}
PRIMARY_KEYS = {
    "dataset_info": ["singleton"], "source_hashes": ["source_path"], "migration_decisions": ["id"],
    "organization": ["id"], "personas": ["user_id"], "documents": ["doc_uid"], "clauses": ["clause_id"],
    "lifecycle_events": ["doc_uid", "position"], "supersedes": ["doc_uid", "previous_uid"],
}


def reject_constant(value):
    raise ValueError(f"Non-finite JSON value: {value}")


def escape_sql_val(value, column, table):
    if value is None:
        return "NULL"
    if column in BOOLEAN_COLUMNS.get(table, set()):
        if type(value) not in (bool, int) or value not in (0, 1):
            raise ValueError(f"Invalid boolean in {table}.{column}")
        return "TRUE" if value else "FALSE"
    if column in JSON_COLUMNS.get(table, {}):
        parsed = json.loads(value, parse_constant=reject_constant) if isinstance(value, str) else value
        return "'" + packed(parsed).replace("'", "''") + "'::jsonb"
    if isinstance(value, (int, float)):
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError("Non-finite SQL number")
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def atomic_write(path, content):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    staged = path.parent / f".{path.name}-{uuid4().hex}.tmp"
    try:
        staged.write_text(content, encoding="utf-8", newline="\n")
        os.replace(staged, path)
    finally:
        staged.unlink(missing_ok=True)


def seed_sql(raw, mode="fresh"):
    if mode not in {"fresh", "upsert"}:
        raise ValueError("Mode must be fresh or upsert")
    tables = to_tables(raw)
    lines = ["-- Appota Knowledge V2: validated SQLite snapshot", f"-- dataset_sha256: {dataset_sha(raw)}",
             f"-- mode: {mode}; upsert retains target-only rows", "BEGIN;", "SET LOCAL standard_conforming_strings = on;", ""]
    for table, rows in tables.items():
        names = columns(table)
        targets = [JSON_COLUMNS.get(table, {}).get(name, name) for name in names]
        suffix = ""
        if mode == "upsert":
            updates = [f"{name} = EXCLUDED.{name}" for name in targets if name not in PRIMARY_KEYS[table]]
            suffix = f" ON CONFLICT ({', '.join(PRIMARY_KEYS[table])}) DO UPDATE SET " + ", ".join(updates)
        lines.append(f"-- {table}: {len(rows)} rows")
        for row in rows:
            values = [escape_sql_val(row[name], name, table) for name in names]
            lines.append(f"INSERT INTO {table} ({', '.join(targets)}) VALUES ({', '.join(values)}){suffix};")
        lines.append("")
    return "\n".join([*lines, "COMMIT;", ""])


def normalize_postgres_tables(tables):
    normalized = {}
    for table in TABLES:
        rows = []
        for original in tables[table]:
            row = {}
            for column in columns(table):
                target = JSON_COLUMNS.get(table, {}).get(column, column)
                value = original[target]
                if column in JSON_COLUMNS.get(table, {}):
                    value = packed(value)
                elif column in BOOLEAN_COLUMNS.get(table, set()):
                    if type(value) is not bool:
                        raise ValueError("Read-back boolean has wrong type")
                    value = int(value)
                elif isinstance(value, Decimal):
                    if not value.is_finite():
                        raise ValueError("Read-back number is not finite")
                    value = int(value) if value == value.to_integral_value() else float(value)
                elif column == "value_number" and isinstance(value, str):
                    number = Decimal(value)
                    if not number.is_finite():
                        raise ValueError("Read-back number is not finite")
                    value = int(number) if number == number.to_integral_value() else float(number)
                elif hasattr(value, "isoformat"):
                    value = value.isoformat()[:10]
                elif column in {"valid_from", "valid_to", "event_date", "created_on", "review_due"} and isinstance(value, str):
                    # PGlite/JS Date serializes a PostgreSQL DATE as UTC midnight.
                    if re.fullmatch(r"\d{4}-\d{2}-\d{2}T00:00:00\.000Z", value):
                        value = value[:10]
                row[column] = value
            rows.append(row)
        normalized[table] = rows
    return normalized


def verify_readback(tables, expected):
    actual = from_tables(normalize_postgres_tables(tables))
    if canonical_bytes(actual) != canonical_bytes(expected):
        def difference(left, right, location=""):
            if isinstance(left, dict) and isinstance(right, dict):
                if left.keys() != right.keys():
                    return location + "/keys"
                for key in left:
                    if (found := difference(left[key], right[key], location + "/" + key)):
                        return found
            elif isinstance(left, list) and isinstance(right, list):
                if len(left) != len(right):
                    return location + "/length"
                for index, (a, b) in enumerate(zip(left, right)):
                    if (found := difference(a, b, location + "/" + str(index))):
                        return found
            elif canonical_bytes(left) != canonical_bytes(right):
                return location
            return None
        raise ValueError(f"PostgreSQL read-back differs at {difference(actual, expected)}")
    return {"verified": True, "dataset_sha256": dataset_sha(expected)}


def generate_seed(database=SQLITE_DB, output=OUTPUT_SEED, mode="fresh", manifest=None):
    raw = read_dataset(database)  # all nine tables are read in one read-only BEGIN transaction.
    rendered = seed_sql(raw, mode)
    atomic_write(output, rendered)
    if manifest:
        atomic_write(manifest, json.dumps(raw, ensure_ascii=False, indent=2) + "\n")
    return {"output": str(Path(output).resolve()), "mode": mode, "dataset_sha256": dataset_sha(raw),
            "counts": {table: len(rows) for table, rows in to_tables(raw).items()}, "readback_verified": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=SQLITE_DB)
    parser.add_argument("--out", type=Path, default=OUTPUT_SEED)
    parser.add_argument("--mode", choices=["fresh", "upsert"], default="fresh")
    parser.add_argument("--manifest", type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(generate_seed(args.db, args.out, args.mode, args.manifest), indent=2))
        return 0
    except (OSError, ValueError, RuntimeError) as error:
        print(f"Export failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
