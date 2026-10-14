"""As-of selection is independent of list ordering and current lifecycle labels."""
from collections import defaultdict

from engine.models import PolicyConflict


def was_approved(document, day):
    approved = any(e.event == "approved" and e.at <= day for e in document.events)
    revoked = any(e.event == "revoked" and e.at <= day for e in document.events)
    return approved and not revoked


def is_effective(document, day):
    return (was_approved(document, day) and document.valid_from <= day
            and (document.valid_to is None or day < document.valid_to))


def select_versions(documents, day):
    groups = defaultdict(list)
    for document in documents:
        if any(e.event == "approved" for e in document.events):
            groups[(document.policy_id, document.scope_id, document.audience_roles)].append(document)
    selected = []
    for versions in groups.values():
        active = [doc for doc in versions if is_effective(doc, day)]
        if len(active) > 1:
            raise PolicyConflict("Overlapping visible policy versions")
        previous = any(doc.valid_to and doc.valid_to <= day for doc in versions)
        future = any(doc.valid_from > day for doc in versions)
        if not active and previous and future:
            raise PolicyConflict("Gap between visible policy versions")
        selected.extend(active)
    return tuple(sorted(selected, key=lambda doc: doc.doc_uid))
