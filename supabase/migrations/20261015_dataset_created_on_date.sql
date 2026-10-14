-- Dataset creation is a business calendar day, matching SQLite/JSON metadata.
BEGIN;
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
    AND table_name = 'dataset_info' AND column_name = 'created_on' AND data_type = 'timestamp with time zone') THEN
    ALTER TABLE public.dataset_info ALTER COLUMN created_on DROP DEFAULT;
    ALTER TABLE public.dataset_info ALTER COLUMN created_on TYPE date
      USING (created_on AT TIME ZONE timezone)::date;
    ALTER TABLE public.dataset_info ALTER COLUMN created_on SET DEFAULT CURRENT_DATE;
  END IF;
END $migration$;
COMMIT;
