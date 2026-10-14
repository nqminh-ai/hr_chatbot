"""Immutable policy records and explicit public result states."""
from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from typing import Any, Mapping


class MetadataError(ValueError):
    """Maintainer-only diagnostic; never render this message in the public UI."""


class PolicyConflict(ValueError):
    """A visible policy cannot be resolved safely."""


class ResultStatus(StrEnum):
    ANSWERED = "answered"
    REFUSED = "refused"
    OUT_OF_SCOPE = "out_of_scope"
    NEEDS_CLARIFICATION = "needs_clarification"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    CONFLICT = "conflict"
    INVALID_REQUEST = "invalid_request"
    SYSTEM_ERROR = "system_error"


@dataclass(frozen=True)
class TypedValue:
    kind: str
    value: int | float | str | None
    unit: str


@dataclass(frozen=True)
class Clause:
    clause_id: str
    key: str
    text: str
    typed_value: TypedValue
    is_floor: bool
    source_ref: Mapping[str, Any]


@dataclass(frozen=True)
class LifecycleEvent:
    event: str
    at: date


@dataclass(frozen=True)
class PolicyVersion:
    doc_uid: str
    policy_id: str
    version: str
    title: str
    topic: str
    scope_id: str
    scope_level: str
    state: str
    valid_from: date
    valid_to: date | None
    events: tuple[LifecycleEvent, ...]
    classification: str
    allowed_roles: tuple[str, ...]
    contracts: tuple[str, ...]
    audience_roles: tuple[str, ...]
    clauses: tuple[Clause, ...]
    metadata: Mapping[str, Any]


@dataclass(frozen=True)
class ResolvedClaim:
    key: str
    clause: Clause
    source: PolicyVersion
    overridden: tuple[tuple[PolicyVersion, Clause], ...] = ()
    floor_applied: bool = False


@dataclass(frozen=True)
class Intent:
    status: str = "route"
    keys: tuple[str, ...] = ()
    confidential: bool = False
    draft: bool = False
    missing_backup: bool = False
    target_policy: str | None = None
    target_version: str | None = None
    target_company: str | None = None
    target_scopes: tuple[str, ...] = ()
    requested_date: date | None = None
