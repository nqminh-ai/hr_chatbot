"""Traverse the organization graph and resolve typed clauses with provenance."""
from dataclasses import replace

from engine.models import PolicyConflict, ResolvedClaim


def _enforce_floor(claim, floor):
    current, minimum = claim.clause.typed_value, floor.clause.typed_value
    if current.kind == "unlimited":
        return claim
    if current.kind != "number" or current.unit != minimum.unit:
        raise PolicyConflict("Incompatible floor units/types")
    if current.value >= minimum.value:
        return claim
    # Replace the complete effective clause, including text, value, units and source.
    trail = tuple((doc, clause) for doc, clause in claim.overridden + ((claim.source, claim.clause),)
                  if clause.clause_id != floor.clause.clause_id)
    return replace(floor, overridden=trail, floor_applied=True)


class HierarchyResolver:
    def __init__(self, snapshot):
        self.snapshot = snapshot

    def get_user_scope_path(self, profile):
        return list(self.snapshot.scope_path(profile))

    def resolve_clauses(self, documents, profile):
        scopes = self.snapshot.scope_path(profile)
        if any(doc.scope_id not in scopes for doc in documents):
            raise PolicyConflict("Document outside validated scope")
        docs = sorted(documents, key=lambda d: (-scopes.index(d.scope_id), d.doc_uid))
        resolved, floors, at_level = {}, {}, set()
        for doc in docs:
            for clause in doc.clauses:
                collision = (doc.scope_id, clause.key)
                if collision in at_level:
                    raise PolicyConflict("Ambiguous clauses at the same scope")
                at_level.add(collision)
                previous = resolved.get(clause.key)
                trail = previous.overridden + ((previous.source, previous.clause),) if previous else ()
                claim = ResolvedClaim(clause.key, clause, doc, trail)
                resolved[clause.key] = claim
                if clause.is_floor:
                    floors.setdefault(clause.key, []).append(claim)
        for key, constraints in floors.items():
            for floor in constraints:
                resolved[key] = _enforce_floor(resolved[key], floor)
        return resolved
