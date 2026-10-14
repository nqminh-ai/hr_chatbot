"""Deterministic leave-policy assistant on a validated mock knowledge snapshot."""
from pathlib import Path

from engine.filter import AccessFilter
from engine.generator import GroundedSynthesizer
from engine.hierarchy import HierarchyResolver
from engine.identity import IdentityService
from engine.knowledge_graph import project_graph
from engine.metadata import load_snapshot, snapshot_from_bytes
from engine.models import Intent, MetadataError, PolicyConflict
from engine.semantic_matcher import SemanticMatcher
from engine.snapshot import BusinessClock, DEFAULT_DATA, DEFAULT_SCHEMA, fingerprint
from engine.timeline import select_versions
from engine.trace import make_trace
from engine.storage import runtime_data_bytes

MESSAGES = {
    "refused": AccessFilter.NEUTRAL_REFUSAL_MESSAGE,
    "needs_clarification": "Vui lòng làm rõ câu hỏi nghỉ phép và một thời điểm tra cứu duy nhất.",
    "out_of_scope": "Hiện hệ thống chỉ hỗ trợ chính sách nghỉ phép. Vui lòng hỏi trong phạm vi này.",
    "invalid_request": "Yêu cầu hoặc ngày tra cứu không hợp lệ.",
    "conflict": "Chính sách trong phạm vi của bạn cần được làm rõ trước khi áp dụng. Vui lòng liên hệ HR.",
    "system_error": "Dữ liệu chính sách chưa sẵn sàng. Vui lòng liên hệ người quản trị.",
    "insufficient_evidence": "Chưa có căn cứ trong dữ liệu hiện tại cho nội dung nghỉ phép này. Vui lòng liên hệ HR để làm rõ.",
}


class KnowledgeAssistant:
    def __init__(self, snapshot=None, data_file=DEFAULT_DATA, schema_file=DEFAULT_SCHEMA, clock=None, database_file=None):
        self.data_file, self.schema_file = Path(data_file), Path(schema_file)
        self.database_file = Path(database_file) if database_file is not None else None
        self.managed = snapshot is None
        self.clock = clock or BusinessClock()
        if snapshot is None and self.database_file is not None:
            snapshot = snapshot_from_bytes(runtime_data_bytes(self.database_file), self.schema_file.read_bytes())
        self._set_snapshot(snapshot or load_snapshot(self.data_file, self.schema_file))

    def _set_snapshot(self, snapshot):
        self.snapshot = snapshot
        self.identity_service = IdentityService(snapshot)
        self.hierarchy_resolver = HierarchyResolver(snapshot)

    def refresh(self):
        if self.managed:
            try:
                data = runtime_data_bytes(self.database_file) if self.database_file is not None else self.data_file.read_bytes()
                schema = self.schema_file.read_bytes()
            except OSError as error:
                raise MetadataError("Dataset unavailable") from error
            if fingerprint(data, schema) != self.snapshot.snapshot_id:
                self._set_snapshot(snapshot_from_bytes(data, schema))

    def _documents(self, profile, day, intent):
        scopes = self.snapshot.scope_path(profile)
        readable = AccessFilter.filter_documents(self.snapshot.documents, profile, scopes)
        if (intent.draft or any(scope not in scopes for scope in intent.target_scopes)
                or (intent.target_company and intent.target_company != profile["company"])):
            return ()
        if intent.confidential:
            readable = tuple(doc for doc in readable if doc.classification == "Confidential")
        if intent.target_policy:
            readable = tuple(doc for doc in readable if doc.policy_id == intent.target_policy)
        if intent.target_version:
            readable = tuple(doc for doc in readable if doc.version.casefold() == intent.target_version)
        selected = select_versions(readable, day)
        if selected and (intent.confidential or intent.target_policy):
            floors = tuple(doc for doc in self.snapshot.documents
                           if any(c.is_floor for c in doc.clauses)
                           and AccessFilter.can_read(doc, profile, scopes)
                           and AccessFilter.applies_to_role(doc, profile)
                           and all(doc.scope_id in scopes[scopes.index(target.scope_id) + 1:] for target in selected))
            selected = tuple({doc.doc_uid: doc for doc in selected + select_versions(floors, day)}.values())
        return selected

    def _result(self, status, day, profile=None, synthesis=None, graph=None):
        synthesis = synthesis or {"answer": MESSAGES[status], "claims": [], "citations": []}
        trace = make_trace(self.snapshot.snapshot_id, day, synthesis["claims"], status)
        return {**synthesis, "status": status, "success": status == "answered", "user": profile,
                "query_date": day.isoformat(), "snapshot_id": self.snapshot.snapshot_id,
                "trace_id": trace["trace_id"], "trace": trace,
                "graph": graph or {"snapshot_id": self.snapshot.snapshot_id, "nodes": [], "edges": []}}

    def answer_query(self, user_id, query, query_date=None, history=None):
        day = self.clock.today()
        try:
            self.refresh()
            day = self.clock.parse(query_date) if query_date is not None else day
        except (MetadataError, ValueError) as error:
            status = "system_error" if isinstance(error, MetadataError) else "invalid_request"
            return self._result(status, day)
        if self.managed:
            # Each request retains one immutable snapshot even if another thread reloads.
            request = KnowledgeAssistant(snapshot=self.snapshot, clock=self.clock)
            return request.answer_query(user_id, query, day, history=history)
        profile = self.identity_service.get_user_profile(user_id)
        if profile is None:
            return self._result("refused", day)
        intent = SemanticMatcher.with_history(query, day, self.clock.today(), self.snapshot.scope_patterns, history or [])
        day = intent.requested_date or day
        if intent.status != "route":
            return self._result(intent.status, day, profile)
        return self._answer(profile, day, intent)

    def _answer(self, profile, day, intent):
        try:
            docs = self._documents(profile, day, intent)
            resolved = self.hierarchy_resolver.resolve_clauses(docs, profile)
            synthesis = GroundedSynthesizer.synthesize_answer(profile, resolved, intent)
            keys = {claim["key"] for claim in synthesis["claims"]}
            used = {key: claim for key, claim in resolved.items() if key in keys}
            graph = project_graph(self.snapshot, profile, docs, used)
            return self._result(synthesis["status"], day, profile, synthesis, graph)
        except PolicyConflict:
            return self._result("conflict", day, profile)

    def public_view(self, user_id, query_date=None):
        """Use the answer path for the initial graph, ensuring identical filtering."""
        return self.answer_query(user_id, "Quy định nghỉ phép của tôi như thế nào?", query_date)
