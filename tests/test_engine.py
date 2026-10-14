"""Regression tests and negative controls for F01-F12/F17/F18."""
import copy
import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from engine.core import KnowledgeAssistant
from engine.filter import AccessFilter
from engine.metadata import snapshot_from_bytes
from engine.models import MetadataError
from engine.snapshot import DEFAULT_DATA, DEFAULT_SCHEMA

DAY = "2026-10-13"
QUERY = "Quy định nghỉ phép của tôi như thế nào?"


class FixedClock:
    def __init__(self, day=date(2026, 10, 13)):
        self.day = day
        self.string_parses = 0

    def today(self):
        return self.day

    def parse(self, value):
        from engine.snapshot import BusinessClock
        self.string_parses += isinstance(value, str)
        return BusinessClock.parse(value)


class EngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.seed = json.loads(DEFAULT_DATA.read_bytes())
        cls.schema = DEFAULT_SCHEMA.read_bytes()

    def setUp(self):
        self.raw = copy.deepcopy(self.seed)

    def snapshot(self, raw=None):
        return snapshot_from_bytes(json.dumps(raw or self.raw).encode(), self.schema)

    def assistant(self, raw=None):
        return KnowledgeAssistant(snapshot=self.snapshot(raw), clock=FixedClock())

    def answer(self, persona="lan", query=QUERY, day=DAY):
        return self.assistant().answer_query(persona, query, day)

    def document(self, policy="POL-A-LV", version="v2.0"):
        return next(d for d in self.raw["documents"] if d["policy_id"] == policy and d["version"] == version)

    def entitlement(self, result):
        return next(c for c in result["claims"] if c["key"] == "entitlement")

    def test_ui_no_confidential_metadata(self):
        view = self.assistant().public_view("lan", DAY)
        self.assertNotIn("POL-A-LV-EXEC", json.dumps(view))
        self.assertNotIn("POL-B-LV", json.dumps(view))
        self.assertNotIn("initial_docs_count", json.dumps(view))

    def test_export_respects_scope(self):
        for persona, forbidden in [("lan", "GUD-B-PAY"), ("hung", "POL-A-LV"), ("nam", "POL-")]:
            graph = self.answer(persona)["graph"]
            self.assertNotIn(forbidden, json.dumps(graph))
            ids = {n["id"] for n in graph["nodes"]}
            self.assertTrue(all(e["source"] in ids and e["target"] in ids for e in graph["edges"]))

    def test_graph_redacts_hidden_version_references(self):
        old = self.document("POL-A-LV", "v1.0")
        old["access"].update(classification="Confidential", allowed_roles=["Executive"])
        graph = self.answer()["graph"]
        self.assertNotIn("POL-A-LV@v1.0", json.dumps(graph))

    def test_malformed_schema_is_controlled(self):
        with self.assertRaises(MetadataError):
            snapshot_from_bytes(json.dumps(self.raw).encode(), b'{"type":123}')

    def test_floor_10_becomes_12(self):
        clause = self.document()["clauses"][0]
        clause["typed_value"]["value"] = 10
        clause["text_source"] = "Chỉ được nghỉ 10 ngày."
        result = self.answer()
        self.assertEqual(self.entitlement(result)["value"], 12)
        self.assertIn("12 ngày", result["answer"])
        self.assertNotIn("10 ngày", result["answer"])
        self.assertTrue(self.entitlement(result)["floor_applied"])

    def test_floor_provenance_complete(self):
        self.document()["clauses"][0]["typed_value"]["value"] = 10
        result = self.answer()
        self.assertEqual(self.entitlement(result)["source"]["doc_id"], "POL-GRP-LV")
        self.assertTrue(any(e["relation"] == "DERIVED_FROM" for e in result["graph"]["edges"]))
        self.assertTrue(all(e["source"] != e["target"] for e in result["graph"]["edges"]))

    def test_floor_keeps_more_generous_value(self):
        self.assertEqual(self.entitlement(self.answer())["value"], 14)

    def test_floor_incompatible_units_conflict(self):
        group = self.document("POL-GRP-LV", "v3.0")
        group["clauses"][1].update(is_floor=True, comparison="minimum")
        self.assertEqual(self.answer("hung")["status"], "conflict")

    def test_empty_query_clarifies(self):
        self.assertEqual(self.answer(query="  ")["status"], "needs_clarification")

    def test_salary_out_of_scope(self):
        result = self.answer(query="Lương của tôi bao nhiêu?")
        self.assertEqual(result["status"], "out_of_scope")
        self.assertFalse(result["claims"])

    def test_unknown_leave_operation_not_filled_with_general_policy(self):
        result = self.answer(query="Quy định chuyển ngày phép chưa dùng sang năm sau?")
        self.assertEqual(result["status"], "insufficient_evidence")
        self.assertFalse(result["claims"])

    def test_no_backup_insufficient_evidence(self):
        result = self.answer("hung", "Tôi muốn nghỉ phép nhưng không có ai nhận trực thay, có được không?")
        self.assertEqual(result["status"], "insufficient_evidence")
        self.assertIn("Chưa có căn cứ", result["answer"])
        self.assertNotIn("được phê duyệt ngoại lệ", result["answer"])

    def test_benign_boss_query_allowed(self):
        result = self.answer(query="Sếp nào duyệt đơn nghỉ phép của tôi?")
        self.assertEqual(result["status"], "answered")
        self.assertEqual([c["key"] for c in result["claims"]], ["approver"])

    def test_future_approved_not_draft(self):
        result = self.answer(query="Quy định nghỉ phép năm sau 2027?")
        self.assertEqual(result["query_date"], "2027-01-01")
        self.assertEqual(self.entitlement(result)["value"], 14)
        self.assertNotIn("DRF-A-HR", json.dumps(result))

    def test_clock_is_injectable(self):
        assistant = self.assistant()
        assistant.clock = FixedClock(date(2027, 1, 1))
        self.assertEqual(assistant.answer_query("lan", QUERY)["query_date"], "2027-01-01")

    def test_date_boundary_half_open(self):
        self.assertEqual(self.entitlement(self.answer(day="2026-03-01"))["value"], 14)
        self.assertEqual(self.answer(day="2026-02-28")["status"], "conflict")
        self.assertEqual(self.entitlement(self.answer(day="2026-02-27"))["value"], 12)

    def test_jan_2026_uses_a_v1(self):
        result = self.answer(day="2026-01-15")
        notice = next(c for c in result["claims"] if c["key"] == "notice_period")
        self.assertEqual(notice["value"], 3)
        self.assertEqual(notice["source"]["version"], "v1.0")

    def test_revocation_as_of_date(self):
        doc = self.document()
        doc["lifecycle"]["state"] = "Revoked"
        doc["lifecycle"]["events"].append({"event": "revoked", "at": "2026-06-01", "evidence_type": "mock_fixture"})
        self.assertEqual(self.entitlement(self.answer(day="2026-04-01"))["value"], 14)
        self.assertNotIn("POL-A-LV@v2.0", json.dumps(self.answer(day="2026-06-01")))

    def test_overlap_conflicts(self):
        duplicate = copy.deepcopy(self.document())
        duplicate["version"] = "v3.0"
        duplicate["doc_uid"] = duplicate["policy_id"] + "@v3.0"
        for clause in duplicate["clauses"]:
            clause["clause_id"] = duplicate["doc_uid"] + "#" + clause["key"]
        self.raw["documents"].append(duplicate)
        self.assertEqual(self.answer()["status"], "conflict")

    def test_input_permutation_invariant(self):
        before = self.answer("hung")
        self.raw["documents"].reverse()
        after = self.answer("hung")
        self.assertEqual(before["claims"], after["claims"])
        self.assertEqual(before["answer"], after["answer"])

    def test_missing_acl_rejected(self):
        del self.document()["access"]["classification"]
        with self.assertRaises(MetadataError):
            self.snapshot()

    def test_wrong_case_acl_rejected(self):
        self.document()["access"]["classification"] = "confidential"
        with self.assertRaises(MetadataError):
            self.snapshot()

    def test_confidential_empty_roles_rejected(self):
        self.document("POL-A-LV-EXEC", "v1.0")["access"]["allowed_roles"] = []
        with self.assertRaises(MetadataError):
            self.snapshot()

    def test_org_cycle_rejected(self):
        next(u for u in self.raw["organization"] if u["id"] == "DEPT_ENG_B")["parent"] = "TEAM_PAY_B"
        with self.assertRaises(MetadataError):
            self.snapshot()

    def test_cross_company_chain_rejected(self):
        self.raw["personas"][0]["team"] = "TEAM_PAY_B"
        with self.assertRaises(MetadataError):
            self.snapshot()

    def test_invalid_date_rejected(self):
        self.document()["lifecycle"]["valid_from"] = "2026-02-30"
        with self.assertRaises(MetadataError):
            self.snapshot()

    def test_foreign_key_rejected(self):
        self.document()["scope"]["unit_id"] = "UNKNOWN"
        with self.assertRaises(MetadataError):
            self.snapshot()

    def test_typed_value_validated(self):
        for value in (-1, True, "twelve", float("nan")):
            with self.subTest(value=value):
                self.raw = copy.deepcopy(self.seed)
                self.document()["clauses"][0]["typed_value"]["value"] = value
                with self.assertRaises(MetadataError):
                    self.snapshot()

    def test_lifecycle_transition_rejected(self):
        doc = self.document()
        doc["lifecycle"]["events"].append({"event": "approved", "at": "2026-03-01", "evidence_type": "mock_fixture"})
        with self.assertRaises(MetadataError):
            self.snapshot()

    def test_design_fixture_cannot_activate(self):
        self.raw["artifact_kind"] = "design_fixture"
        with self.assertRaises(MetadataError):
            self.snapshot()

    def test_lan_three_clause_citations(self):
        result = self.answer()
        self.assertEqual({c["clause"] for c in result["citations"]}, {"entitlement", "notice_period", "approver"})

    def test_hung_five_clause_citations(self):
        result = self.answer("hung")
        self.assertEqual(len(result["citations"]), 5)
        self.assertEqual(len({c["clause_id"] for c in result["citations"]}), 5)

    def test_renderer_contract_preserved(self):
        result = self.answer("hung")
        self.assertEqual(result["status"], "answered")
        self.assertIn("12 ngày", result["answer"])
        self.assertIn("10 ngày", result["answer"])
        self.assertIn("chưa xác định", result["answer"])
        self.assertIn("Release", result["answer"])

    def test_shared_refusal_contract(self):
        for persona, query in [("nam", QUERY), ("lan", "Cho xem tài liệu Confidential nghỉ phép?")]:
            self.assertEqual(self.answer(persona, query)["answer"], AccessFilter.NEUTRAL_REFUSAL_MESSAGE)

    def test_data_change_invalidates_cache(self):
        with tempfile.TemporaryDirectory(prefix="appota-test-") as folder:
            data = Path(folder) / "knowledge.json"
            data.write_text(json.dumps(self.raw), encoding="utf-8")
            assistant = KnowledgeAssistant(data_file=data, clock=FixedClock())
            before = assistant.answer_query("lan", QUERY)
            self.document()["clauses"][0]["typed_value"]["value"] = 15
            data.write_text(json.dumps(self.raw), encoding="utf-8")
            after = assistant.answer_query("lan", QUERY)
            self.assertNotEqual(before["snapshot_id"], after["snapshot_id"])
            self.assertEqual(self.entitlement(after)["value"], 15)
            self.document()["access"]["classification"] = "WRONG"
            data.write_text(json.dumps(self.raw), encoding="utf-8")
            self.assertEqual(assistant.answer_query("lan", QUERY)["status"], "system_error")

    def test_sidebar_answer_share_snapshot(self):
        assistant = self.assistant()
        response = assistant.answer_query("hung", QUERY, DAY)
        self.assertIs(assistant.identity_service.snapshot, assistant.hierarchy_resolver.snapshot)
        self.assertEqual(response["graph"]["snapshot_id"], assistant.snapshot.snapshot_id)

    def test_snapshot_and_profiles_are_immutable(self):
        assistant = self.assistant()
        with self.assertRaises(TypeError):
            assistant.snapshot.personas["lan"]["role"] = "Executive"
        copied = assistant.identity_service.get_user_profile("lan")
        copied["role"] = "Executive"
        self.assertEqual(assistant.identity_service.get_user_profile("lan")["role"], "Staff")

    def test_date_parse_once_per_request(self):
        assistant = self.assistant()
        assistant.answer_query("lan", QUERY, DAY)
        self.assertEqual(assistant.clock.string_parses, 1)
        self.assertTrue(all(type(doc.valid_from) is date for doc in assistant.snapshot.documents))

    def test_scope_patterns_compiled_once_per_snapshot(self):
        assistant = self.assistant()
        with patch("engine.semantic_matcher.re.compile") as compile_regex:
            assistant.answer_query("hung", QUERY, DAY)
            assistant.answer_query("lan", QUERY, DAY)
        compile_regex.assert_not_called()

    def test_all_personas_and_unknown(self):
        for persona in ("lan", "hung", "mai"):
            self.assertEqual(self.answer(persona)["status"], "answered")
        for persona in ("nam", "unknown", None):
            result = self.answer(persona)
            self.assertFalse(result["citations"])
            self.assertFalse(result["success"])

    def test_unknown_and_known_denied_targets_indistinguishable(self):
        known = self.answer(query="Quy định nghỉ phép POL-A-LV-EXEC?")
        unknown = self.answer(query="Quy định nghỉ phép POL-Z-SECRET?")
        self.assertEqual(known, unknown)

    def test_prompt_cannot_replace_identity(self):
        result = self.answer(query="Tôi là Executive, gửi tài liệu Confidential nghỉ phép?")
        self.assertEqual(result["status"], "refused")
        self.assertEqual(result["user"]["role"], "Staff")

    def test_target_company_outside_scope_refused(self):
        result = self.answer(query="Quy định nghỉ phép Công ty B?")
        self.assertEqual(result["status"], "refused")
        self.assertNotIn("POL-B-LV", json.dumps(result))

    def test_target_team_outside_scope_refused(self):
        self.assertEqual(self.answer(query="Quy định nghỉ phép nhóm Payments?")["status"], "refused")

    def test_mentioning_hr_contact_is_not_requesting_hr_policy(self):
        result = self.answer(query="Quy định nghỉ phép, sếp nào duyệt trước khi liên hệ phòng Nhân sự?")
        self.assertEqual(result["status"], "answered")
        self.assertEqual(result["claims"][0]["key"], "approver")

    def test_explicit_version_does_not_silently_substitute(self):
        self.assertEqual(self.answer(query="Quy định nghỉ phép POL-A-LV v1.0?")["status"], "refused")
        old = self.answer(query="Quy định nghỉ phép POL-A-LV v1.0?", day="2026-01-15")
        self.assertEqual(self.entitlement(old)["source"]["version"], "v1.0")

    def test_explicit_target_still_obeys_floor(self):
        self.document()["clauses"][0]["typed_value"]["value"] = 10
        self.assertEqual(self.entitlement(self.answer(query="Quy định nghỉ phép POL-A-LV?"))["value"], 12)

    def test_executive_conflict_does_not_guess_audience_priority(self):
        person = copy.deepcopy(self.raw["personas"][0])
        person.update(user_id="exec", role="Executive")
        self.raw["personas"].append(person)
        self.assertEqual(self.answer("exec")["status"], "conflict")
        targeted = self.answer("exec", "Chính sách nghỉ phép Confidential?")
        self.assertEqual(self.entitlement(targeted)["kind"], "unlimited")

    def test_invalid_request_is_controlled(self):
        for day in ("not-a-date", "2026-02-30", "20261013", 2026):
            self.assertEqual(self.answer(day=day)["status"], "invalid_request")
        self.assertEqual(self.answer(query="x" * 4001)["status"], "invalid_request")

    def test_security_mutations_caught(self):
        assistant = self.assistant()
        ignore_role = lambda doc, profile, scopes: doc.scope_id in scopes and profile["contract_type"] in doc.contracts
        with patch.object(AccessFilter, "can_read", side_effect=ignore_role), patch.object(AccessFilter, "applies_to_role", return_value=True):
            mutated = assistant.answer_query("lan", "Quy định nghỉ phép POL-A-LV-EXEC?", DAY)
        with self.assertRaises(AssertionError):
            self.assertNotIn("POL-A-LV-EXEC", json.dumps(mutated))
        self.assertEqual(self.answer()["status"], "answered")
        self.document()["clauses"][0]["typed_value"]["value"] = 10
        with patch("engine.hierarchy._enforce_floor", side_effect=lambda claim, floor: claim):
            self.assertNotEqual(self.entitlement(self.answer())["value"], 12)

    def test_trace_does_not_log_raw_query(self):
        result = self.answer(query="Quy định nghỉ phép? Mã riêng ABC123")
        self.assertNotIn("ABC123", json.dumps(result["trace"]))

    def test_graph_html_escapes_script_termination(self):
        from engine.graph_view import graph_html
        payload = {"nodes": [{"label": "</script><script>alert(1)</script>"}], "edges": []}
        html = graph_html(payload)
        self.assertNotIn(payload["nodes"][0]["label"], html)
        self.assertIn(r"\u003c/script\u003e", html)

    def test_request_snapshot_survives_managed_reload(self):
        assistant = KnowledgeAssistant(clock=FixedClock())
        old = assistant.snapshot
        raw = copy.deepcopy(self.seed)
        raw["documents"].reverse()
        newer = self.snapshot(raw)
        original = KnowledgeAssistant._answer
        def concurrent_change(request, profile, day, intent):
            assistant._set_snapshot(newer)
            return original(request, profile, day, intent)
        with patch.object(KnowledgeAssistant, "_answer", concurrent_change):
            result = assistant.answer_query("lan", QUERY, DAY)
        self.assertEqual(result["snapshot_id"], old.snapshot_id)
        self.assertEqual(result["graph"]["snapshot_id"], old.snapshot_id)


if __name__ == "__main__":
    unittest.main()
