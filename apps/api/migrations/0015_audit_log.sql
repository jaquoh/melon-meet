CREATE TABLE IF NOT EXISTS audit_log_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_events_created_at ON audit_log_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_events_actor_user_id ON audit_log_events(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_events_target ON audit_log_events(target_type, target_id, created_at DESC);
