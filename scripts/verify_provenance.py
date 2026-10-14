"""Verify seed provenance without printing policy/persona contents."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from engine.metadata import load_snapshot
from engine.provenance import verify_provenance
from engine.snapshot import plain

if __name__ == '__main__':
    try:
        print(json.dumps(verify_provenance(plain(load_snapshot().metadata)), indent=2))
    except (OSError, ValueError, RuntimeError) as error:
        print(f'Provenance verification failed: {error}', file=sys.stderr)
        raise SystemExit(2)
