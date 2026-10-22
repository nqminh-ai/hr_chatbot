BEGIN IMMEDIATE;

CREATE TABLE dataset_info_v2 (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    schema_version TEXT NOT NULL CHECK (schema_version = '2.0'),
    artifact_kind TEXT NOT NULL CHECK (artifact_kind IN ('mock_runtime', 'policy_runtime')),
    activation_allowed INTEGER NOT NULL CHECK (activation_allowed IN (0, 1)),
    created_on TEXT NOT NULL,
    timezone TEXT NOT NULL CHECK (timezone = 'Asia/Ho_Chi_Minh'),
    sample_id TEXT NOT NULL CHECK (length(sample_id) > 0)
) STRICT;

INSERT INTO dataset_info_v2
SELECT singleton, schema_version, artifact_kind,
       CASE WHEN artifact_kind = 'mock_runtime' THEN 0 ELSE activation_allowed END,
       created_on, timezone, sample_id
FROM dataset_info;

DROP TABLE dataset_info;
ALTER TABLE dataset_info_v2 RENAME TO dataset_info;
PRAGMA user_version = 2;

COMMIT;
