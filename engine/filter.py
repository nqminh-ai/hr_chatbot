"""Shared read/applicability policy for answers, projections and exports."""


class AccessFilter:
    NEUTRAL_REFUSAL_MESSAGE = (
        "Hệ thống không tìm thấy quy định phù hợp áp dụng cho phạm vi công việc của bạn. "
        "Vui lòng liên hệ bộ phận Nhân sự (HR) để được hướng dẫn chi tiết."
    )

    @staticmethod
    def can_read(document, profile, scope_path):
        if document.classification not in {"Internal", "Confidential"}:
            return False
        if document.classification == "Confidential" and not document.allowed_roles:
            return False
        role_allowed = not document.allowed_roles or profile["role"] in document.allowed_roles
        return (role_allowed and profile["contract_type"] in document.contracts
                and document.scope_id in scope_path)

    @staticmethod
    def applies_to_role(document, profile):
        return not document.audience_roles or profile["role"] in document.audience_roles

    @classmethod
    def filter_documents(cls, documents, profile, scope_path):
        return tuple(doc for doc in documents if cls.can_read(doc, profile, scope_path)
                     and cls.applies_to_role(doc, profile))
