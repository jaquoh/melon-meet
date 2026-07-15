ALTER TABLE venues ADD COLUMN updated_at TEXT;
ALTER TABLE venues ADD COLUMN archived_at TEXT;

CREATE INDEX IF NOT EXISTS idx_venues_archived_name ON venues(archived_at, name);
