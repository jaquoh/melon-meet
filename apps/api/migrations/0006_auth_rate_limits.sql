CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key_hash TEXT NOT NULL,
  scope TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TEXT NOT NULL,
  PRIMARY KEY (key_hash, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_scope_bucket
  ON auth_rate_limits(scope, bucket_start);
