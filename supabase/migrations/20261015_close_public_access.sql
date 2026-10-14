-- Non-destructive: keeps corpus, chat rows and service_role access intact.
-- Apply as the database owner after reviewing grants/policies and taking a backup.
BEGIN;

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
AS $health$ SELECT EXISTS (SELECT 1 FROM public.dataset_info WHERE singleton = 1) $health$;
REVOKE ALL ON FUNCTION public.knowledge_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.knowledge_health() TO anon, authenticated;

COMMIT;
