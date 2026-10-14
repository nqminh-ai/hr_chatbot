"""Small executable smoke assertions; a failure exits nonzero."""
from engine.core import KnowledgeAssistant


def main():
    assistant = KnowledgeAssistant()
    lan = assistant.answer_query("lan", "Quy định nghỉ phép của tôi như thế nào?", "2026-10-13")
    assert lan["status"] == "answered"
    assert next(c for c in lan["claims"] if c["key"] == "entitlement")["value"] == 14
    assert "POL-A-LV-EXEC" not in str(lan)
    assert assistant.answer_query("nam", "Quy định nghỉ phép?", "2026-10-13")["status"] == "refused"
    assert assistant.answer_query("missing", "Quy định nghỉ phép?", "2026-10-13")["citations"] == []
    assert lan["graph"]["snapshot_id"] == lan["snapshot_id"]
    print("Smoke assertions passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
