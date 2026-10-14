-- Appota local database v1. Business metadata remains runtime schema v2.
PRAGMA foreign_keys = ON;
CREATE TABLE dataset_info (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    schema_version TEXT NOT NULL CHECK (schema_version = '2.0'),
    artifact_kind TEXT NOT NULL CHECK (artifact_kind = 'mock_runtime'),
    activation_allowed INTEGER NOT NULL CHECK (activation_allowed = 1),
    created_on TEXT NOT NULL,
    timezone TEXT NOT NULL CHECK (timezone = 'Asia/Ho_Chi_Minh'),
    sample_id TEXT NOT NULL CHECK (length(sample_id) > 0)
) STRICT;
CREATE TABLE source_hashes (
    source_path TEXT PRIMARY KEY,
    sha256 TEXT NOT NULL CHECK (length(sha256) = 64)
) STRICT;
CREATE TABLE migration_decisions (
    id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE CHECK (position >= 0),
    status TEXT NOT NULL CHECK (status IN ('unresolved', 'confirmed')),
    description TEXT NOT NULL, owner TEXT, evidence TEXT
) STRICT;
CREATE TABLE organization (
    id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE CHECK (position >= 0),
    name TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('Group', 'Company', 'Department', 'Team')),
    parent TEXT REFERENCES organization(id) DEFERRABLE INITIALLY DEFERRED,
    query_aliases_json TEXT NOT NULL CHECK (json_valid(query_aliases_json) AND json_type(query_aliases_json) = 'array'),
    CHECK (parent IS NULL OR parent <> id)
) STRICT;
CREATE TABLE personas (
    user_id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE CHECK (position >= 0),
    name TEXT NOT NULL,
    company TEXT NOT NULL REFERENCES organization(id),
    department TEXT NOT NULL REFERENCES organization(id),
    team TEXT REFERENCES organization(id),
    role TEXT NOT NULL, contract_type TEXT NOT NULL, description TEXT NOT NULL
) STRICT;
CREATE TABLE documents (
    doc_uid TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE CHECK (position >= 0),
    policy_id TEXT NOT NULL, version TEXT NOT NULL, title TEXT NOT NULL, topic TEXT NOT NULL,
    scope_id TEXT NOT NULL REFERENCES organization(id),
    scope_level TEXT NOT NULL CHECK (scope_level IN ('Group', 'Company', 'Department', 'Team')),
    lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('Draft', 'Approved', 'Superseded', 'Revoked')),
    valid_from TEXT NOT NULL, valid_to TEXT, history_evidence TEXT NOT NULL,
    classification TEXT NOT NULL CHECK (classification IN ('Public', 'Internal', 'Confidential')),
    allowed_roles_json TEXT NOT NULL CHECK (json_valid(allowed_roles_json) AND json_type(allowed_roles_json) = 'array'),
    applies_to_json TEXT NOT NULL CHECK (json_valid(applies_to_json) AND json_type(applies_to_json) = 'array'),
    audience_roles_json TEXT NOT NULL CHECK (json_valid(audience_roles_json) AND json_type(audience_roles_json) = 'array'),
    deny_on_missing INTEGER NOT NULL CHECK (deny_on_missing = 1),
    owner_id TEXT NOT NULL, review_due TEXT, review_state TEXT NOT NULL,
    source_path TEXT NOT NULL REFERENCES source_hashes(source_path),
    line_start INTEGER NOT NULL CHECK (line_start > 0),
    line_end INTEGER NOT NULL CHECK (line_end >= line_start),
    source_sha256 TEXT NOT NULL CHECK (length(source_sha256) = 64), source_type TEXT NOT NULL,
    UNIQUE (policy_id, version),
    CHECK (doc_uid = policy_id || '@' || version),
    CHECK (valid_to IS NULL OR valid_to > valid_from)
) STRICT;
CREATE TABLE clauses (
    clause_id TEXT PRIMARY KEY,
    doc_uid TEXT NOT NULL REFERENCES documents(doc_uid),
    position INTEGER NOT NULL CHECK (position >= 0),
    clause_key TEXT NOT NULL CHECK (clause_key IN ('entitlement', 'notice_period', 'approver', 'blackout_period', 'contingency')),
    label TEXT NOT NULL, text_source TEXT NOT NULL,
    value_kind TEXT NOT NULL CHECK (value_kind IN ('number', 'enum', 'unlimited')),
    value_number REAL, value_text TEXT,
    unit TEXT NOT NULL CHECK (unit IN ('annual_paid_days', 'business_days', 'calendar_days', 'unspecified_days', 'not_applicable')),
    render_template TEXT NOT NULL,
    is_floor INTEGER NOT NULL CHECK (is_floor IN (0, 1)),
    comparison TEXT NOT NULL CHECK (comparison IN ('none', 'minimum')),
    source_path TEXT NOT NULL REFERENCES source_hashes(source_path),
    source_line INTEGER NOT NULL CHECK (source_line > 0), json_pointer TEXT NOT NULL,
    review_flags_json TEXT NOT NULL CHECK (json_valid(review_flags_json) AND json_type(review_flags_json) = 'array'),
    UNIQUE (doc_uid, clause_key), UNIQUE (doc_uid, position),
    CHECK (clause_id = doc_uid || '#' || clause_key),
    CHECK ((value_kind = 'number' AND value_number IS NOT NULL AND value_number >= 0 AND value_text IS NULL)
        OR (value_kind = 'enum' AND value_number IS NULL AND value_text IS NOT NULL AND length(value_text) > 0)
        OR (value_kind = 'unlimited' AND value_number IS NULL AND value_text IS NULL)),
    CHECK ((is_floor = 0 AND comparison = 'none') OR (is_floor = 1 AND comparison = 'minimum' AND value_kind = 'number' AND unit <> 'unspecified_days'))
) STRICT;
CREATE TABLE lifecycle_events (
    doc_uid TEXT NOT NULL REFERENCES documents(doc_uid),
    position INTEGER NOT NULL CHECK (position >= 0),
    event TEXT NOT NULL CHECK (event IN ('drafted', 'approved', 'superseded', 'revoked')),
    event_date TEXT NOT NULL, evidence_type TEXT NOT NULL,
    PRIMARY KEY (doc_uid, position)
) STRICT;
CREATE TABLE supersedes (
    doc_uid TEXT NOT NULL REFERENCES documents(doc_uid),
    previous_uid TEXT NOT NULL REFERENCES documents(doc_uid),
    position INTEGER NOT NULL CHECK (position >= 0),
    PRIMARY KEY (doc_uid, previous_uid), UNIQUE (doc_uid, position),
    CHECK (doc_uid <> previous_uid)
) STRICT;
CREATE TABLE import_log (
    revision INTEGER PRIMARY KEY AUTOINCREMENT,
    imported_at TEXT NOT NULL, actor TEXT NOT NULL, operation TEXT NOT NULL,
    previous_sha256 TEXT, dataset_sha256 TEXT NOT NULL,
    document_count INTEGER NOT NULL, clause_count INTEGER NOT NULL, backup_path TEXT
) STRICT;
CREATE INDEX idx_documents_scope_dates ON documents(scope_id, valid_from, valid_to);
CREATE INDEX idx_documents_policy_dates ON documents(policy_id, valid_from, valid_to);
CREATE INDEX idx_documents_classification ON documents(classification);
CREATE INDEX idx_clauses_key ON clauses(clause_key);
CREATE INDEX idx_personas_scope ON personas(company, department, team);
CREATE VIEW policy_inventory AS
SELECT d.doc_uid, d.title, o.name AS scope_name, d.lifecycle_state, d.classification,
       d.valid_from, d.valid_to, d.owner_id, d.review_state, count(c.clause_id) AS clause_count
FROM documents d JOIN organization o ON o.id = d.scope_id
LEFT JOIN clauses c ON c.doc_uid = d.doc_uid GROUP BY d.doc_uid;
PRAGMA user_version = 1;
