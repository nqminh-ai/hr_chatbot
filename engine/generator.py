"""Render effective typed claims with one source mapping per clause."""
from engine.filter import AccessFilter
from engine.snapshot import plain

LABELS = {"entitlement": "Chế độ ngày nghỉ", "notice_period": "Thời hạn báo trước",
          "approver": "Thẩm quyền phê duyệt", "blackout_period": "Thời gian cấm nghỉ",
          "contingency": "Phương án trực thay thế"}


def citation(document, clause):
    return {"doc_id": document.policy_id, "doc_uid": document.doc_uid,
            "version": document.version, "scope_level": document.scope_level,
            "title": document.title, "clause": clause.key, "clause_id": clause.clause_id,
            "text_source": clause.text,
            "valid_from": document.valid_from.isoformat(),
            "valid_to": document.valid_to.isoformat() if document.valid_to else None,
            "source_ref": plain(clause.source_ref)}


def render_clause(clause):
    typed = clause.typed_value
    if typed.kind != "number":
        return clause.text
    if clause.key == "entitlement":
        return f"Được hưởng {typed.value:g} ngày phép năm có hưởng lương."
    units = {"business_days": "ngày làm việc", "calendar_days": "ngày lịch",
             "unspecified_days": "ngày (nguồn chưa xác định ngày làm việc hay ngày lịch)"}
    return f"Thông báo trước tối thiểu {typed.value:g} {units[typed.unit]}."


def public_claim(claim):
    clause = claim.clause
    return {"key": claim.key, "value": clause.typed_value.value, "kind": clause.typed_value.kind,
            "unit": clause.typed_value.unit, "text": render_clause(clause),
            "floor_applied": claim.floor_applied, "source": citation(claim.source, clause)}


class GroundedSynthesizer:
    @staticmethod
    def synthesize_answer(profile, resolved, intent):
        selected = [resolved[key] for key in LABELS if key in resolved and (not intent.keys or key in intent.keys)]
        if not selected:
            return {"answer": AccessFilter.NEUTRAL_REFUSAL_MESSAGE,
                    "status": "refused", "claims": [], "citations": []}
        claims = [public_claim(claim) for claim in selected]
        lines = [f"Xin chào **{profile['name']}**, quy định nghỉ phép áp dụng tại ngày tra cứu:"]
        for claim in claims:
            source = claim["source"]
            lines.append(f"- **{LABELS[claim['key']]}**: {claim['text']} "
                         f"[{source['doc_id']} {source['version']} | {source['clause']}]")
            if claim["floor_applied"]:
                lines.append("  Giá trị cấp dưới được thay bằng sàn bắt buộc; nguồn trên là nguồn sàn.")
        status = "answered"
        if intent.missing_backup:
            status = "insufficient_evidence"
            lines.append("Chưa có căn cứ để cho phép nghỉ khi không có người trực thay. "
                         "Vui lòng liên hệ HR/Quản lý để làm rõ; hệ thống không xác nhận quyền xin ngoại lệ.")
        return {"answer": "\n".join(lines), "status": status, "claims": claims,
                "citations": [claim["source"] for claim in claims]}
