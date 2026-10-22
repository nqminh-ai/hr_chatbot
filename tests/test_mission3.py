"""Mission 3 acceptance tests for B5 source verification and core regressions."""
import copy
import json
import unittest

from engine.core import KnowledgeAssistant
from engine.metadata import snapshot_from_bytes
from engine.models import ResultStatus
from engine.snapshot import DEFAULT_DATA, DEFAULT_SCHEMA


DAY = "2026-10-13"


class Mission3Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.seed = json.loads(DEFAULT_DATA.read_bytes())
        cls.schema = DEFAULT_SCHEMA.read_bytes()

    def setUp(self):
        self.assistant = KnowledgeAssistant()

    def test_temporal_m3_01_approved_amendment_switches_at_effective_boundary(self):
        """A simulated approved amendment is inactive before, and active at, its boundary."""
        raw = copy.deepcopy(self.seed)
        current = next(
            document
            for document in raw["documents"]
            if document["doc_uid"] == "POL-A-LV@v2.0"
        )
        current["lifecycle"]["valid_to"] = "2026-11-01"

        amendment = copy.deepcopy(current)
        amendment.update(
            doc_uid="POL-A-LV@v3.0",
            version="v3.0",
            title="Quy chế nghỉ phép Công ty A (amendment mô phỏng)",
            supersedes=["POL-A-LV@v2.0"],
        )
        amendment["lifecycle"].update(
            valid_from="2026-11-01",
            valid_to=None,
            events=[
                {
                    "event": "approved",
                    "at": "2026-10-20",
                    "evidence_type": "mock_fixture",
                }
            ],
        )
        for clause in amendment["clauses"]:
            clause["clause_id"] = f"{amendment['doc_uid']}#{clause['key']}"
        entitlement = next(
            clause for clause in amendment["clauses"] if clause["key"] == "entitlement"
        )
        entitlement["typed_value"]["value"] = 16
        entitlement["text_source"] = "Nhân viên chính thức Công ty A được hưởng 16 ngày phép/năm."
        raw["documents"].append(amendment)

        assistant = KnowledgeAssistant(
            snapshot=snapshot_from_bytes(json.dumps(raw).encode(), self.schema)
        )
        before = assistant.answer_query("lan", "Tôi có bao nhiêu ngày phép?", "2026-10-31")
        after = assistant.answer_query("lan", "Tôi có bao nhiêu ngày phép?", "2026-11-01")

        self.assertEqual(before["status"], ResultStatus.ANSWERED)
        self.assertEqual(before["claims"][0]["value"], 14)
        self.assertEqual(before["claims"][0]["source"]["version"], "v2.0")
        self.assertEqual(after["status"], ResultStatus.ANSWERED)
        self.assertEqual(after["claims"][0]["value"], 16)
        self.assertEqual(after["claims"][0]["source"]["version"], "v3.0")

    def test_edg_m3_01_missing_backup_and_temporal_void_fail_closed(self):
        """Missing contingency evidence and a pre-policy date never produce approval."""
        no_backup = self.assistant.answer_query(
            "hung",
            "Tôi muốn nghỉ phép nhưng nhóm không có người trực thay thì sao?",
            DAY,
        )
        self.assertEqual(no_backup["status"], ResultStatus.INSUFFICIENT_EVIDENCE)
        self.assertIn("Chưa có căn cứ", no_backup["answer"])
        self.assertIn("contingency", {claim["key"] for claim in no_backup["claims"]})
        self.assertNotIn("được phê duyệt ngoại lệ", no_backup["answer"])

        temporal_void = self.assistant.answer_query(
            "lan", "Quy định nghỉ phép của tôi như thế nào?", "2010-01-01"
        )
        self.assertEqual(temporal_void["status"], ResultStatus.REFUSED)
        self.assertEqual(temporal_void["citations"], [])
        self.assertFalse(
            any(
                node["kind"] in {"policy", "document", "clause"}
                for node in temporal_void["graph"]["nodes"]
            )
        )

    def test_reg_m3_01_mission2_access_hierarchy_and_provenance(self):
        """Mission 2 access, hierarchy and provenance invariants remain intact."""
        contractor = self.assistant.answer_query(
            "nam", "Tôi được nghỉ phép mấy ngày?", DAY
        )
        self.assertEqual(contractor["status"], ResultStatus.REFUSED)
        self.assertEqual(contractor["citations"], [])
        self.assertEqual(contractor["trace"]["selected_clause_ids"], [])
        self.assertNotIn("POL-", json.dumps(contractor))

        hung = self.assistant.answer_query(
            "hung", "Quy định nghỉ phép của tôi như thế nào?", DAY
        )
        claims = {claim["key"]: claim for claim in hung["claims"]}
        self.assertEqual(hung["status"], ResultStatus.ANSWERED)
        self.assertEqual(claims["entitlement"]["value"], 12)
        self.assertEqual(claims["notice_period"]["value"], 10)
        self.assertEqual(claims["notice_period"]["unit"], "unspecified_days")
        self.assertEqual(
            set(hung["trace"]["selected_clause_ids"]),
            {citation["clause_id"] for citation in hung["citations"]},
        )
        self.assertNotIn("POL-A-LV", json.dumps(hung["graph"]))

    def test_cr_b5_01_every_claim_maps_to_exact_document_section_and_location(self):
        """B5: every conclusion maps to an exact document version, clause and locator."""
        result = self.assistant.answer_query(
            "lan", "Quy định nghỉ phép của tôi như thế nào?", "2026-01-15"
        )
        citations = {item["clause_id"]: item for item in result["citations"]}
        claim_sources = {claim["source"]["clause_id"] for claim in result["claims"]}
        graph_clause_ids = {
            node["id"].removeprefix("clause:")
            for node in result["graph"]["nodes"]
            if node["kind"] == "clause"
        }

        self.assertEqual(result["status"], ResultStatus.ANSWERED)
        self.assertEqual(set(citations), claim_sources)
        self.assertEqual(set(result["trace"]["selected_clause_ids"]), claim_sources)
        self.assertTrue(claim_sources.issubset(graph_clause_ids))
        self.assertTrue(all(item["text_source"] for item in citations.values()))
        self.assertTrue(all(item["source_ref"]["path"] for item in citations.values()))
        self.assertTrue(all(item["source_ref"]["line"] > 0 for item in citations.values()))
        self.assertTrue(all(item["source_ref"]["json_pointer"].startswith("/") for item in citations.values()))

        citation = citations["POL-A-LV@v1.0#entitlement"]

        self.assertEqual(citation["doc_uid"], f'{citation["doc_id"]}@{citation["version"]}')
        self.assertEqual(citation["clause_id"], f'{citation["doc_uid"]}#entitlement')
        self.assertEqual(citation["valid_from"], "2024-01-01")
        self.assertEqual(citation["valid_to"], "2026-03-01")
        self.assertTrue(citation["text_source"])
        self.assertEqual(citation["source_ref"]["path"], "data/documents.json")


if __name__ == "__main__":
    unittest.main()
