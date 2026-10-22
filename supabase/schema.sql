-- ==============================================================================
-- Appota Knowledge V2 - Supabase PostgreSQL Schema
-- Migration from SQLite to PostgreSQL with JSONB and RLS Support
-- ==============================================================================

-- Fresh database only (PostgreSQL 15+). Existing databases use migrations/.
-- No implicit reset: existing tables cause CREATE to fail without deleting data.
BEGIN;

-- 1. Dataset Info
CREATE TABLE dataset_info (
    singleton INT PRIMARY KEY CHECK (singleton = 1),
    schema_version TEXT NOT NULL CHECK (schema_version = '2.0'),
    artifact_kind TEXT NOT NULL CHECK (artifact_kind IN ('mock_runtime', 'policy_runtime')),
    activation_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    created_on DATE NOT NULL DEFAULT CURRENT_DATE,
    timezone TEXT NOT NULL CHECK (timezone = 'Asia/Ho_Chi_Minh'),
    sample_id TEXT NOT NULL CHECK (length(sample_id) > 0)
);

-- 2. Source Hashes
CREATE TABLE source_hashes (
    source_path TEXT PRIMARY KEY,
    sha256 TEXT NOT NULL CHECK (length(sha256) = 64)
);

-- 3. Migration Decisions
CREATE TABLE migration_decisions (
    id TEXT PRIMARY KEY,
    position INT NOT NULL UNIQUE CHECK (position >= 0),
    status TEXT NOT NULL CHECK (status IN ('unresolved', 'confirmed')),
    description TEXT NOT NULL,
    owner TEXT,
    evidence TEXT
);

-- 4. Organization Structure
CREATE TABLE organization (
    id TEXT PRIMARY KEY,
    position INT NOT NULL UNIQUE CHECK (position >= 0),
    name TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('Group', 'Company', 'Department', 'Team')),
    parent TEXT REFERENCES organization(id) DEFERRABLE INITIALLY DEFERRED,
    query_aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
    CHECK (parent IS NULL OR parent <> id)
);

-- 5. Personas (Nhân sự & Vai trò)
CREATE TABLE personas (
    user_id TEXT PRIMARY KEY,
    position INT NOT NULL UNIQUE CHECK (position >= 0),
    name TEXT NOT NULL,
    company TEXT NOT NULL REFERENCES organization(id),
    department TEXT NOT NULL REFERENCES organization(id),
    team TEXT REFERENCES organization(id),
    role TEXT NOT NULL,
    contract_type TEXT NOT NULL,
    description TEXT NOT NULL
);

-- 6. Documents (Văn bản chính sách)
CREATE TABLE documents (
    doc_uid TEXT PRIMARY KEY,
    position INT NOT NULL UNIQUE CHECK (position >= 0),
    policy_id TEXT NOT NULL,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    scope_id TEXT NOT NULL REFERENCES organization(id),
    scope_level TEXT NOT NULL CHECK (scope_level IN ('Group', 'Company', 'Department', 'Team')),
    lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('Draft', 'Approved', 'Superseded', 'Revoked')),
    valid_from DATE NOT NULL,
    valid_to DATE,
    history_evidence TEXT NOT NULL CHECK (history_evidence IN ('mock_fixture', 'authoritative_record')),
    classification TEXT NOT NULL CHECK (classification IN ('Public', 'Internal', 'Confidential')),
    allowed_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
    applies_to JSONB NOT NULL DEFAULT '[]'::jsonb,
    audience_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
    deny_on_missing BOOLEAN NOT NULL DEFAULT TRUE,
    owner_id TEXT NOT NULL,
    review_due DATE,
    review_state TEXT NOT NULL CHECK (review_state IN ('needs_owner_review', 'approved')),
    source_path TEXT NOT NULL REFERENCES source_hashes(source_path),
    line_start INT NOT NULL CHECK (line_start > 0),
    line_end INT NOT NULL CHECK (line_end >= line_start),
    source_sha256 TEXT NOT NULL CHECK (length(source_sha256) = 64),
    source_type TEXT NOT NULL CHECK (source_type IN ('mock_json', 'authoritative_json')),
    UNIQUE (policy_id, version),
    CHECK (doc_uid = policy_id || '@' || version),
    CHECK (valid_to IS NULL OR valid_to > valid_from)
);

-- 7. Clauses (Từng điều khoản trích dẫn)
CREATE TABLE clauses (
    clause_id TEXT PRIMARY KEY,
    doc_uid TEXT NOT NULL REFERENCES documents(doc_uid) ON DELETE CASCADE,
    position INT NOT NULL CHECK (position >= 0),
    clause_key TEXT NOT NULL CHECK (clause_key IN ('entitlement', 'notice_period', 'approver', 'blackout_period', 'contingency')),
    label TEXT NOT NULL,
    text_source TEXT NOT NULL,
    value_kind TEXT NOT NULL CHECK (value_kind IN ('number', 'enum', 'unlimited')),
    value_number NUMERIC,
    value_text TEXT,
    unit TEXT NOT NULL CHECK (unit IN ('annual_paid_days', 'business_days', 'calendar_days', 'unspecified_days', 'not_applicable')),
    render_template TEXT NOT NULL,
    is_floor BOOLEAN NOT NULL DEFAULT FALSE,
    comparison TEXT NOT NULL CHECK (comparison IN ('none', 'minimum')),
    source_path TEXT NOT NULL REFERENCES source_hashes(source_path),
    source_line INT NOT NULL CHECK (source_line > 0),
    json_pointer TEXT NOT NULL,
    review_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    UNIQUE (doc_uid, clause_key),
    UNIQUE (doc_uid, position),
    CHECK (clause_id = doc_uid || '#' || clause_key),
    CHECK ((value_kind = 'number' AND value_number IS NOT NULL AND value_number >= 0 AND value_text IS NULL)
        OR (value_kind = 'enum' AND value_number IS NULL AND value_text IS NOT NULL AND length(value_text) > 0)
        OR (value_kind = 'unlimited' AND value_number IS NULL AND value_text IS NULL)),
    CHECK ((NOT is_floor AND comparison = 'none') OR (is_floor AND comparison = 'minimum' AND value_kind = 'number' AND unit <> 'unspecified_days'))
);

-- 8. Lifecycle Events
CREATE TABLE lifecycle_events (
    doc_uid TEXT NOT NULL REFERENCES documents(doc_uid) ON DELETE CASCADE,
    position INT NOT NULL CHECK (position >= 0),
    event TEXT NOT NULL CHECK (event IN ('drafted', 'approved', 'superseded', 'revoked')),
    event_date DATE NOT NULL,
    evidence_type TEXT NOT NULL CHECK (evidence_type IN ('mock_fixture', 'authoritative_record')),
    PRIMARY KEY (doc_uid, position)
);

-- 9. Supersedes (Liên kết văn bản thay thế)
CREATE TABLE supersedes (
    doc_uid TEXT NOT NULL REFERENCES documents(doc_uid) ON DELETE CASCADE,
    previous_uid TEXT NOT NULL REFERENCES documents(doc_uid) ON DELETE CASCADE,
    position INT NOT NULL CHECK (position >= 0),
    PRIMARY KEY (doc_uid, previous_uid),
    UNIQUE (doc_uid, position),
    CHECK (doc_uid <> previous_uid)
);

-- 10. Chat Sessions & Messages (Dành cho Chatbot Vercel)
CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES personas(user_id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT 'Hội thoại mới',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    status TEXT DEFAULT 'ok',
    citations JSONB DEFAULT '[]'::jsonb,
    graph JSONB DEFAULT '{}'::jsonb,
    trace JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_documents_scope_dates ON documents(scope_id, valid_from, valid_to);
CREATE INDEX idx_documents_policy_dates ON documents(policy_id, valid_from, valid_to);
CREATE INDEX idx_documents_classification ON documents(classification);
CREATE INDEX idx_clauses_key ON clauses(clause_key);
CREATE INDEX idx_personas_scope ON personas(company, department, team);
CREATE INDEX idx_chat_messages_conv ON chat_messages(conversation_id, created_at);

-- Policy Inventory View
CREATE OR REPLACE VIEW policy_inventory AS
SELECT
    d.doc_uid,
    d.title,
    o.name AS scope_name,
    d.lifecycle_state,
    d.classification,
    d.valid_from,
    d.valid_to,
    d.owner_id,
    d.review_state,
    COUNT(c.clause_id) AS clause_count
FROM documents d
JOIN organization o ON o.id = d.scope_id
LEFT JOIN clauses c ON c.doc_uid = d.doc_uid
GROUP BY d.doc_uid, d.title, o.name, d.lifecycle_state, d.classification, d.valid_from, d.valid_to, d.owner_id, d.review_state;

-- Closed public access; same configuration as the existing-database migration.
-- Non-destructive: keeps corpus, chat rows and service_role access intact.
-- Apply as the database owner after reviewing grants/policies and taking a backup.

DROP POLICY IF EXISTS "Public read for organization" ON public.organization;
DROP POLICY IF EXISTS "Public read for personas" ON public.personas;
DROP POLICY IF EXISTS "Public read for documents" ON public.documents;
DROP POLICY IF EXISTS "Public read for clauses" ON public.clauses;
DROP POLICY IF EXISTS "Public read for dataset_info" ON public.dataset_info;
DROP POLICY IF EXISTS "Public full access to conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Public full access to messages" ON public.chat_messages;

DO $security$
DECLARE relation_name text; column_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'dataset_info', 'source_hashes', 'migration_decisions', 'organization',
    'personas', 'documents', 'clauses', 'lifecycle_events', 'supersedes',
    'chat_conversations', 'chat_messages'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', relation_name);
    FOR column_name IN SELECT a.attname FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = format('public.%I', relation_name)::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
    LOOP
      EXECUTE format('REVOKE SELECT (%I), INSERT (%I), UPDATE (%I), REFERENCES (%I) ON public.%I FROM PUBLIC, anon, authenticated',
        column_name, column_name, column_name, column_name, relation_name);
    END LOOP;
  END LOOP;
END $security$;

ALTER VIEW public.policy_inventory SET (security_invoker = true);
REVOKE ALL ON TABLE public.policy_inventory FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.knowledge_health()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $health$ SELECT EXISTS (SELECT 1 FROM public.dataset_info WHERE singleton = 1 AND activation_allowed) $health$;
REVOKE ALL ON FUNCTION public.knowledge_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.knowledge_health() TO anon, authenticated;

COMMIT;
