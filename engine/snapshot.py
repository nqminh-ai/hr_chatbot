"""One immutable, content-addressed dataset shared by identity, answers and graphs."""
import hashlib
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from types import MappingProxyType
from typing import Any, Mapping
from zoneinfo import ZoneInfo

from engine.models import MetadataError, PolicyVersion

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA = ROOT / "data/knowledge.json"
DEFAULT_SCHEMA = ROOT / "schemas/knowledge_runtime_v2.schema.json"


def freeze(value):
    if isinstance(value, dict):
        return MappingProxyType({key: freeze(item) for key, item in value.items()})
    if isinstance(value, list):
        return tuple(freeze(item) for item in value)
    return value


def plain(value):
    if isinstance(value, Mapping):
        return {key: plain(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [plain(item) for item in value]
    return value


def fingerprint(data_bytes, schema_bytes):
    return hashlib.sha256(data_bytes + b"\x00" + schema_bytes).hexdigest()


def ancestor_path(units, start):
    path = []
    while start is not None:
        if start not in units or start in path:
            raise MetadataError("Unknown unit or organization cycle")
        path.append(start)
        start = units[start]["parent"]
    return tuple(path)


class BusinessClock:
    def today(self):
        return datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date()

    @staticmethod
    def parse(value):
        if type(value) is date:
            return value
        if not isinstance(value, str) or len(value) != 10 or value[4] != "-" or value[7] != "-":
            raise ValueError("Expected YYYY-MM-DD")
        return date.fromisoformat(value)


@dataclass(frozen=True)
class KnowledgeSnapshot:
    snapshot_id: str
    documents: tuple[PolicyVersion, ...]
    units: Mapping[str, Any]
    personas: Mapping[str, Any]
    metadata: Mapping[str, Any]
    scope_patterns: tuple[tuple[str, Any], ...]

    def scope_path(self, profile):
        leaf = profile["team"] or profile["department"] or profile["company"]
        return ancestor_path(self.units, leaf)
