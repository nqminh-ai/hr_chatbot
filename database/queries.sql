-- Run with a SQLite client connected to data/appota.db.
-- These queries are for the local administrator, not employee-facing APIs.
PRAGMA foreign_keys = ON;

-- Document inventory, including drafts and Confidential mock metadata.
SELECT * FROM policy_inventory ORDER BY scope_name, doc_uid;

-- Typed values and units; an unknown-day unit remains unspecified_days.
SELECT d.policy_id, d.version, c.clause_key, c.value_kind,
       c.value_number, c.value_text, c.unit, c.is_floor
FROM clauses c JOIN documents d USING (doc_uid)
ORDER BY d.position, c.position;

-- Import history and the backup made before each replacement.
SELECT revision, imported_at, actor, operation, dataset_sha256, backup_path
FROM import_log ORDER BY revision DESC;

-- Items waiting for owner decisions.
SELECT id, description, owner, evidence FROM migration_decisions
WHERE status = 'unresolved' ORDER BY position;

-- Diagnostic only: approved versions whose half-open validity covers this date.
-- Actual answers also check approval/revocation events, identity, ACL, scope and floors.
SELECT doc_uid, valid_from, valid_to FROM documents
WHERE lifecycle_state = 'Approved' AND valid_from <= '2026-10-13'
  AND (valid_to IS NULL OR '2026-10-13' < valid_to);

-- Example local mock edit (commented out; prefer validated CSV import for audit/backup).
-- BEGIN IMMEDIATE;
-- UPDATE clauses SET value_number = 15
-- WHERE clause_id = 'POL-A-LV@v2.0#entitlement';
-- COMMIT;
-- Afterwards: python manage_database.py validate
