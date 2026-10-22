-- Existing mock artifacts must not report production readiness.
-- Idempotent and non-destructive: policy/chat rows remain unchanged.
BEGIN;

UPDATE public.dataset_info
SET activation_allowed = FALSE
WHERE artifact_kind = 'mock_runtime';

ALTER TABLE public.dataset_info
  ALTER COLUMN activation_allowed SET DEFAULT FALSE;

ALTER TABLE public.dataset_info
  DROP CONSTRAINT IF EXISTS dataset_info_artifact_kind_check;
ALTER TABLE public.dataset_info
  ADD CONSTRAINT dataset_info_artifact_kind_check
  CHECK (artifact_kind IN ('mock_runtime', 'policy_runtime'));

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_history_evidence_check,
  DROP CONSTRAINT IF EXISTS documents_review_state_check,
  DROP CONSTRAINT IF EXISTS documents_source_type_check;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_history_evidence_check CHECK (history_evidence IN ('mock_fixture', 'authoritative_record')),
  ADD CONSTRAINT documents_review_state_check CHECK (review_state IN ('needs_owner_review', 'approved')),
  ADD CONSTRAINT documents_source_type_check CHECK (source_type IN ('mock_json', 'authoritative_json'));

ALTER TABLE public.lifecycle_events
  DROP CONSTRAINT IF EXISTS lifecycle_events_evidence_type_check;
ALTER TABLE public.lifecycle_events
  ADD CONSTRAINT lifecycle_events_evidence_type_check CHECK (evidence_type IN ('mock_fixture', 'authoritative_record'));

CREATE OR REPLACE FUNCTION public.knowledge_health()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $health$ SELECT EXISTS (
  SELECT 1 FROM public.dataset_info WHERE singleton = 1 AND activation_allowed
) $health$;
REVOKE ALL ON FUNCTION public.knowledge_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.knowledge_health() TO anon, authenticated;

COMMIT;
