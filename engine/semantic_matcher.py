"""Bounded lexical routing for leave policy, not a general language model."""
import re
import unicodedata
from datetime import date

from engine.models import Intent

SLOTS = {
    "notice_period": ("bao truoc", "thong bao", "dang ky lich"),
    "approver": ("duyet", "phe duyet"),
    "blackout_period": ("release", "cam nghi"),
    "contingency": ("truc", "thay the", "nguoi thay"),
}
UNSUPPORTED = ("bao luu", "chuyen ngay phep", "cong don", "carryover", "carry over",
               "ban ngay phep", "mua ngay phep", "nghi om", "thai san", "tham nien")


def normalize(text):
    text = unicodedata.normalize("NFKD", text.casefold().replace("đ", "d"))
    return " ".join("".join(c for c in text if not unicodedata.combining(c)).split())


def contains(text, phrases):
    return any(re.search(r"(?<!\w)" + re.escape(p) + r"(?!\w)", text) for p in phrases)


def temporal_date(text, base):
    exact = re.findall(r"\b\d{4}-\d{2}-\d{2}\b", text)
    if exact:
        if len(set(exact)) != 1:
            raise ValueError("Multiple dates need clarification")
        return date.fromisoformat(exact[0])
    years = set(re.findall(r"\b20\d{2}\b", text))
    relative = base.year + 1 if "nam sau" in text else base.year - 1 if "nam truoc" in text else None
    if len(years) > 1 or (years and relative and int(next(iter(years))) != relative):
        raise ValueError("Ambiguous year")
    year = int(next(iter(years))) if years else relative
    return date(year, 1, 1) if year else None


def compile_scope_patterns(units):
    """Compile unit aliases once per snapshot, avoiding the regex-cache size limit."""
    patterns = []
    prefix = r"\b(?:quy dinh|chinh sach|nghi phep|tai lieu)(?: (?:nghi phep|cua|tai|cho))* "
    for key, unit in (units or {}).items():
        aliases = tuple(normalize(alias) for alias in unit.get("query_aliases", ()))
        alternatives = [r"(?<!\w)" + re.escape(normalize(key)) + r"(?!\w)"]
        alternatives += [prefix + re.escape(alias) + r"(?!\w)" for alias in aliases]
        patterns.append((key, re.compile("|".join(alternatives))))
    return tuple(patterns)


def requested_scopes(text, patterns):
    return tuple(key for key, pattern in patterns if pattern.search(text))


class SemanticMatcher:
    @staticmethod
    def analyze_intent(query, base_date, scope_patterns=()):
        if not isinstance(query, str) or len(query) > 4000:
            return Intent(status="invalid_request")
        text = normalize(query)
        if not text:
            return Intent(status="needs_clarification")
        topic = contains(text, ("nghi phep", "ngay phep", "phep nam", "annual leave", "don nghi"))
        topic = topic or bool(re.search(r"\bnghi (?:bao nhieu|may) ngay\b", text))
        if not topic:
            return Intent(status="out_of_scope")
        if contains(text, UNSUPPORTED):
            return Intent(status="insufficient_evidence")
        if contains(text, ("luong cua toi", "muc luong")):
            return Intent(status="needs_clarification")
        try:
            requested_date = temporal_date(text, base_date)
        except ValueError:
            return Intent(status="needs_clarification")
        keys = tuple(key for key, phrases in SLOTS.items() if contains(text, phrases))
        if not keys and contains(text, ("bao nhieu", "may ngay", "so ngay", "che do")):
            keys = ("entitlement",)
        policy = re.search(r"\b(?:POL|GUD|DRF)-[A-Z0-9-]+\b", query, re.I)
        version = re.search(r"\bv\d+\.\d+\b", query, re.I)
        if version and not policy:
            return Intent(status="needs_clarification")
        company = re.search(r"\b(?:cong ty|cty)\s+([ab])\b", text)
        missing = bool(re.search(r"khong.*(?:ai|nguoi).*(?:truc|thay)", text))
        return Intent(
            keys=() if missing else keys,
            confidential=contains(text, ("confidential", "tai lieu mat", "cap lanh dao", "chinh sach lanh dao", "nghi phep lanh dao", "executive", "board", "ban giam doc")),
            draft=contains(text, ("du thao", "draft")), missing_backup=missing,
            target_policy=policy[0].upper() if policy else None,
            target_version=version[0].lower() if version else None,
            target_company="CTY_" + company[1].upper() if company else None,
            target_scopes=requested_scopes(text, scope_patterns),
            requested_date=requested_date,
        )
