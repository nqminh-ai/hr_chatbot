"""Local administrator CLI for SQLite and validated CSV import/export."""
import argparse
import json
import sqlite3
import sys
from pathlib import Path

from engine.models import MetadataError
from engine.snapshot import DEFAULT_DATA, ROOT
from engine.storage import (
    DEFAULT_DATABASE, backup_database, database_status, initialize_database,
    migrate_database, read_dataset, replace_dataset, validate_tables,
)
from engine.tabular import read_csv_tables, to_tables, write_csv_tables


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--db", type=Path, default=DEFAULT_DATABASE)
    commands = result.add_subparsers(dest="command", required=True)
    init = commands.add_parser("init", help="Seed a new DB; never reset an existing DB")
    init.add_argument("--from-json", type=Path, default=DEFAULT_DATA)
    commands.add_parser("status", help="Validate database and show inventory")
    commands.add_parser("validate", help="Validate SQL relations and runtime business rules")
    commands.add_parser("migrate", help="Back up and migrate an older SQLite schema")
    for name in ("check-csv", "import-csv", "export-csv"):
        command = commands.add_parser(name)
        command.add_argument("--dir", type=Path, default=ROOT / "data/csv")
        if name == "import-csv":
            command.add_argument("--actor", default="local-user")
        if name == "export-csv":
            command.add_argument("--overwrite", action="store_true")
    backup = commands.add_parser("backup")
    backup.add_argument("--out", type=Path)
    return result


def execute(args):
    if args.command == "init":
        return initialize_database(args.db, json.loads(args.from_json.read_text(encoding="utf-8")))
    if args.command == "status":
        return database_status(args.db)
    if args.command == "validate":
        read_dataset(args.db)
        return {"valid": True, "database": str(args.db.resolve())}
    if args.command == "migrate":
        return migrate_database(args.db)
    if args.command in {"check-csv", "import-csv"}:
        raw = validate_tables(read_csv_tables(args.dir))
        if args.command == "check-csv":
            return {"valid": True, "documents": len(raw["documents"]), "csv_dir": str(args.dir.resolve())}
        return replace_dataset(args.db, raw, actor=args.actor, operation="import-csv")
    if args.command == "export-csv":
        paths = write_csv_tables(args.dir, to_tables(read_dataset(args.db)), overwrite=args.overwrite)
        return {"exported": [str(path.resolve()) for path in paths]}
    return {"backup": str(backup_database(args.db, args.out))}


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        print(json.dumps(execute(args), ensure_ascii=False, indent=2))
        return 0
    except (MetadataError, sqlite3.Error, OSError, ValueError, KeyError, TypeError) as error:
        print(f"Database operation failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
