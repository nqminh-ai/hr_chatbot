"""Bounded lexical routing for leave policy, not a general language model."""
import re
import json
import unicodedata
from datetime import date
from dataclasses import replace
from pathlib import Path

from engine.models import Intent

RULES = json.loads((Path(__file__).resolve().parent.parent / "data/intent_rules.json").read_text(encoding="utf-8"))
SLOTS = RULES["slots"]
UNSUPPORTED = RULES["unsupported"]


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
    if year:
        raise ValueError("Year-only question needs an explicit date")
    return None


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
        topic = contains(text, RULES["topics"])
        topic = topic or bool(re.search(r"\bnghi (?:bao nhieu|may) ngay\b", text))
        topic = topic or any(contains(text, phrases) for key, phrases in SLOTS.items() if key != "entitlement")
        topic = topic or bool(re.search(r"\b(?:pol|gud|drf)-[a-z0-9-]+\b", text))
        topic = topic or contains(text, UNSUPPORTED)
        if contains(text, RULES["out_of_scope"]):
            return Intent(status="out_of_scope")
        if not topic:
            return Intent(status="out_of_scope")
        if contains(text, UNSUPPORTED):
            return Intent(status="insufficient_evidence")
        if contains(text, ("luong cua toi", "muc luong")):
            return Intent(status="needs_clarification")
        if contains(text, ("du thao", "draft")):
            return Intent(draft=True)
        try:
            requested_date = temporal_date(text, base_date)
        except ValueError:
            return Intent(status="needs_clarification")
        keys = tuple(key for key, phrases in SLOTS.items() if contains(text, phrases))
        if "notice_period" in keys:
            keys = tuple(key for key in keys if key != "entitlement")
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

    @classmethod
    def with_history(cls, query, day, today, patterns, history=()):
        target = version = None
        keys = ()
        for turn in (history or [])[-20:]:
            if not isinstance(turn, dict) or turn.get("sender") != "user" or not isinstance(turn.get("content"), str):
                continue
            prior = cls.analyze_intent(turn["content"], day, patterns)
            text = normalize(turn["content"])
            if contains(text, RULES["current_date"]):
                day = today
            elif prior.requested_date:
                day = prior.requested_date
            if prior.target_policy:
                target, version = prior.target_policy, prior.target_version
            if prior.keys:
                keys = prior.keys
            elif prior.status == "route" and contains(text, RULES["topics"]):
                keys = tuple(SLOTS)
        intent = cls.analyze_intent(query, day, patterns)
        if not isinstance(query, str):
            return intent
        text = normalize(query)
        if contains(text, RULES["current_date"]):
            intent = replace(intent, requested_date=today)
        inherited_keys = keys if contains(text, RULES["summary"]) else ()
        if intent.status == "out_of_scope" and inherited_keys:
            intent = replace(intent, status="route", keys=inherited_keys)
        return replace(intent, requested_date=intent.requested_date or day,
                       target_policy=intent.target_policy or target,
                       target_version=intent.target_version or (version if not intent.target_policy else None),
                       keys=intent.keys or inherited_keys)
