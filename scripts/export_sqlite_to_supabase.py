"""Export existing SQLite appota.db directly into Supabase-compatible seed.sql and verify migration."""
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SQLITE_DB = ROOT / "data/appota.db"
OUTPUT_SEED = ROOT / "supabase/seed.sql"

TABLES_ORDER = [
    "dataset_info",
    "source_hashes",
    "migration_decisions",
    "organization",
    "personas",
    "documents",
    "clauses",
    "lifecycle_events",
    "supersedes"
]

JSON_COLUMNS = {
    "organization": {"query_aliases_json": "query_aliases"},
    "documents": {
        "allowed_roles_json": "allowed_roles",
        "applies_to_json": "applies_to",
        "audience_roles_json": "audience_roles"
    },
    "clauses": {"review_flags_json": "review_flags"}
}

BOOLEAN_COLUMNS = {
    "dataset_info": {"activation_allowed": True},
    "documents": {"deny_on_missing": True},
    "clauses": {"is_floor": True}
}

def escape_sql_val(val, col_name, table_name):
    if val is None:
        return "NULL"
    # Check if boolean
    if table_name in BOOLEAN_COLUMNS and col_name in BOOLEAN_COLUMNS[table_name]:
        return "TRUE" if val in (1, True, "1") else "FALSE"
    # Check if JSON
    if table_name in JSON_COLUMNS and col_name in JSON_COLUMNS[table_name]:
        try:
            # Parse and serialize cleanly
            parsed = json.loads(val) if isinstance(val, str) else val
            cleaned_json = json.dumps(parsed, ensure_ascii=False).replace("'", "''")
            return f"'{cleaned_json}'::jsonb"
        except Exception:
            cleaned = str(val).replace("'", "''")
            return f"'{cleaned}'::jsonb"
    if isinstance(val, (int, float)):
        return str(val)
    # Default string / date
    escaped = str(val).replace("'", "''")
    return f"'{escaped}'"

def generate_seed():
    if not SQLITE_DB.exists():
        raise FileNotFoundError(f"Database {SQLITE_DB} not found.")

    conn = sqlite3.connect(SQLITE_DB)
    conn.row_factory = sqlite3.Row
    lines = [
        "-- ==============================================================================",
        "-- Appota Knowledge V2 - Supabase Seed Data",
        "-- Auto-generated from SQLite database",
        "-- ==============================================================================",
        "",
        "BEGIN;",
        ""
    ]

    for table in TABLES_ORDER:
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM {table}")
        rows = cursor.fetchall()
        if not rows:
            continue

        cols = [desc[0] for desc in cursor.description]
        # Target columns mapping (e.g. rename _json to jsonb name)
        target_cols = []
        for c in cols:
            if table in JSON_COLUMNS and c in JSON_COLUMNS[table]:
                target_cols.append(JSON_COLUMNS[table][c])
            else:
                target_cols.append(c)

        lines.append(f"-- Table: {table} ({len(rows)} rows)")
        for row in rows:
            val_strs = [
                escape_sql_val(row[col], col, table)
                for col in cols
            ]
            cols_joined = ", ".join(target_cols)
            vals_joined = ", ".join(val_strs)
            lines.append(f"INSERT INTO {table} ({cols_joined}) VALUES ({vals_joined}) ON CONFLICT DO NOTHING;")
        lines.append("")

    lines.append("COMMIT;")
    lines.append("")

    OUTPUT_SEED.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_SEED.write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] Generated {OUTPUT_SEED} successfully ({len(lines)} lines)")

if __name__ == "__main__":
    generate_seed()
