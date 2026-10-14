-- Read-only catalog assertions. Run as the owner AFTER the migration.
DO $verify$
DECLARE role_name text; relation_name text; relation_oid oid;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH relation_name IN ARRAY ARRAY[
      'dataset_info', 'source_hashes', 'migration_decisions', 'organization',
      'personas', 'documents', 'clauses', 'lifecycle_events', 'supersedes',
      'chat_conversations', 'chat_messages', 'policy_inventory'
    ] LOOP
      relation_oid := format('public.%I', relation_name)::regclass;
      IF has_table_privilege(role_name, relation_oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege(role_name, relation_oid, 'SELECT,INSERT,UPDATE,REFERENCES') THEN
        RAISE EXCEPTION 'Unexpected public grant: %.%', role_name, relation_name;
      END IF;
      IF relation_name <> 'policy_inventory' AND NOT
        (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = relation_oid) THEN
        RAISE EXCEPTION 'RLS disabled: %', relation_name;
      END IF;
    END LOOP;
    IF NOT has_function_privilege(role_name, 'public.knowledge_health()', 'EXECUTE') THEN
      RAISE EXCEPTION 'Health RPC unavailable: %', role_name;
    END IF;
  END LOOP;
  IF NOT (SELECT 'security_invoker=true' = ANY(reloptions) FROM pg_catalog.pg_class
    WHERE oid = 'public.policy_inventory'::regclass) THEN
    RAISE EXCEPTION 'Inventory view must use caller permissions';
  END IF;
  IF NOT (SELECT prosecdef AND 'search_path=pg_catalog' = ANY(proconfig)
    FROM pg_catalog.pg_proc WHERE oid = 'public.knowledge_health()'::regprocedure) THEN
    RAISE EXCEPTION 'Health RPC configuration is unsafe';
  END IF;
END $verify$;

SELECT public.knowledge_health() AS dataset_ready;
