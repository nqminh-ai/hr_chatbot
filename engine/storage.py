"""SQLite repository: atomic imports, consistent reads, validation and backups."""
import hashlib
import json
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from engine.metadata import snapshot_from_bytes
from engine.models import MetadataError
from engine.snapshot import DEFAULT_SCHEMA, ROOT
from engine.tabular import TABLES, columns, from_tables, to_tables

DEFAULT_DATABASE = ROOT / "data/appota.db"
SQL_SCHEMA = ROOT / "database/schema.sql"
MIGRATION_1_TO_2 = ROOT / "database/migrations/002_governance_activation_gate.sql"
DATABASE_VERSION = 2


def canonical_bytes(raw):
    return json.dumps(raw, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def dataset_sha(raw):
    return hashlib.sha256(canonical_bytes(raw)).hexdigest()


def connect_database(path, readonly=False, create=False):
    path = Path(path).resolve()
    mode = "ro" if readonly else "rwc" if create else "rw"
    connection = sqlite3.connect(path.as_uri() + f"?mode={mode}", uri=True, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 10000")
    return connection


def ensure_version(connection):
    if connection.execute("PRAGMA user_version").fetchone()[0] != DATABASE_VERSION:
        raise MetadataError("Unsupported SQLite schema version; use the matching migration")


def fetch_tables(connection):
    # Names and columns are static application constants; values use bound parameters.
    return {table: [dict(row) for row in connection.execute(f"SELECT {', '.join(columns(table))} FROM {table}")]
            for table in TABLES}


def insert_tables(connection, tables):
    for table in TABLES:
        names = columns(table)
        connection.executemany(f"INSERT INTO {table} ({', '.join(names)}) VALUES ({', '.join('?' for _ in names)})",
                               [[row[name] for name in names] for row in tables[table]])


def validate_tables(tables):
    """Stage in memory so duplicate/FK/orphan/SQL constraints precede runtime checks."""
    try:
        with closing(sqlite3.connect(":memory:")) as connection:
            connection.row_factory = sqlite3.Row
            connection.executescript(SQL_SCHEMA.read_text(encoding="utf-8"))
            with connection:
                connection.execute("PRAGMA defer_foreign_keys = ON")
                insert_tables(connection, tables)
            raw = from_tables(fetch_tables(connection))
            snapshot_from_bytes(canonical_bytes(raw), DEFAULT_SCHEMA.read_bytes())
            return raw
    except (sqlite3.Error, ValueError, TypeError, KeyError, OverflowError) as error:
        raise MetadataError(f"Invalid database/CSV data: {error}") from error


def read_dataset(path=DEFAULT_DATABASE):
    try:
        with closing(connect_database(path, readonly=True)) as connection:
            ensure_version(connection)
            connection.execute("BEGIN")
            if connection.execute("PRAGMA foreign_key_check").fetchone():
                raise MetadataError("Database contains orphan references")
            raw = from_tables(fetch_tables(connection))
            connection.commit()
        snapshot_from_bytes(canonical_bytes(raw), DEFAULT_SCHEMA.read_bytes())
        return raw
    except (sqlite3.Error, OSError, ValueError, TypeError, KeyError) as error:
        raise MetadataError(f"Cannot load validated SQLite dataset: {error}") from error


def runtime_data_bytes(path=DEFAULT_DATABASE):
    return canonical_bytes(read_dataset(path))


def backup_database(path=DEFAULT_DATABASE, destination=None, expected_version=DATABASE_VERSION):
    path = Path(path).resolve()
    destination = Path(destination) if destination else path.parent / "backups" / f"appota-{datetime.now(timezone.utc):%Y%m%dT%H%M%S}-{uuid4().hex[:8]}.db"
    destination = destination.resolve()
    if destination == path or destination.exists():
        raise FileExistsError("Backup destination must be a new path, different from the live database")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect_database(path, readonly=True)) as source:
        if source.execute("PRAGMA user_version").fetchone()[0] != expected_version:
            raise MetadataError(f"Cannot back up unexpected SQLite schema version; expected {expected_version}")
        with closing(sqlite3.connect(destination)) as target:
            source.backup(target)
    return destination


def migrate_database(path=DEFAULT_DATABASE):
    """Migrate a v1 database after validating the transformed dataset and creating a backup."""
    path = Path(path).resolve()
    with closing(connect_database(path)) as connection:
        current = connection.execute("PRAGMA user_version").fetchone()[0]
        if current == DATABASE_VERSION:
            return {"migrated": False, "database": str(path), "schema_version": current, "backup": None}
        if current != 1:
            raise MetadataError(f"No migration path from SQLite schema version {current}")
        candidate = from_tables(fetch_tables(connection))
        if candidate["artifact_kind"] == "mock_runtime":
            candidate["activation_allowed"] = False
        snapshot_from_bytes(canonical_bytes(candidate), DEFAULT_SCHEMA.read_bytes(), allow_inactive_mock=True)
    backup = backup_database(path, expected_version=1)
    try:
        with closing(connect_database(path)) as connection:
            connection.executescript(MIGRATION_1_TO_2.read_text(encoding="utf-8"))
    except Exception:
        raise
    raw = read_dataset(path)
    return {"migrated": True, "database": str(path), "schema_version": DATABASE_VERSION,
            "dataset_sha256": dataset_sha(raw), "backup": str(backup)}


def replace_dataset(path, raw, actor="local-user", operation="import"):
    """Validate first; replace all nine data tables or roll back everything."""
    snapshot_from_bytes(canonical_bytes(raw), DEFAULT_SCHEMA.read_bytes())
    tables = to_tables(raw)
    validated = validate_tables(tables)
    if canonical_bytes(validated) != canonical_bytes(raw):
        raise MetadataError("Database conversion would change the dataset, possibly numeric precision")
    with closing(connect_database(path)) as connection:
        ensure_version(connection)
        try:
            connection.execute("BEGIN IMMEDIATE")
            previous = from_tables(fetch_tables(connection)) if connection.execute("SELECT 1 FROM dataset_info").fetchone() else None
            backup = backup_database(path) if previous is not None else None
            connection.execute("PRAGMA defer_foreign_keys = ON")
            for table in reversed(TABLES):
                connection.execute(f"DELETE FROM {table}")
            insert_tables(connection, tables)
            connection.execute("INSERT INTO import_log (imported_at, actor, operation, previous_sha256, dataset_sha256, document_count, clause_count, backup_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                               (datetime.now(timezone.utc).isoformat(), actor, operation,
                                dataset_sha(previous) if previous else None, dataset_sha(validated),
                                len(raw["documents"]), len(tables["clauses"]), str(backup) if backup else None))
            connection.commit()
        except Exception:
            connection.rollback()
            raise
    return {"dataset_sha256": dataset_sha(validated), "backup": str(backup) if backup else None}


def initialize_database(path, raw):
    path = Path(path)
    if path.exists():
        read_dataset(path)
        return {"created": False, "database": str(path.resolve())}
    snapshot_from_bytes(canonical_bytes(raw), DEFAULT_SCHEMA.read_bytes())
    validate_tables(to_tables(raw))
    path.parent.mkdir(parents=True, exist_ok=True)
    # Publish only after schema + seed commit; never expose a partially initialized DB.
    staged = path.parent / f".appota-init-{uuid4().hex}.db"
    try:
        with closing(connect_database(staged, create=True)) as connection:
            connection.executescript(SQL_SCHEMA.read_text(encoding="utf-8"))
        result = replace_dataset(staged, raw, operation="initialize")
        if os.name == "nt":
            os.rename(staged, path)  # Windows rename fails if the target already exists.
        else:
            os.link(staged, path)  # Atomic, exclusive publication on POSIX.
    finally:
        staged.unlink(missing_ok=True)
    return {"created": True, "database": str(path.resolve()), **result}


def database_status(path=DEFAULT_DATABASE):
    raw = read_dataset(path)
    with closing(connect_database(path, readonly=True)) as connection:
        counts = {table: connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0] for table in TABLES}
        revision = connection.execute("SELECT max(revision) FROM import_log").fetchone()[0]
    return {"database": str(Path(path).resolve()), "schema_version": DATABASE_VERSION,
            "dataset_sha256": dataset_sha(raw), "counts": counts, "last_import_revision": revision}
