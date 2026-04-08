ALTER TABLE users ADD COLUMN is_profile_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN show_email_publicly INTEGER NOT NULL DEFAULT 0;

ALTER TABLE app_groups ADD COLUMN messenger_url TEXT;
ALTER TABLE app_groups ADD COLUMN archived_at TEXT;

ALTER TABLE venues ADD COLUMN booking_url TEXT;
ALTER TABLE venues ADD COLUMN opening_hours_text TEXT;

ALTER TABLE meeting_series ADD COLUMN short_name TEXT NOT NULL DEFAULT 'Session';
ALTER TABLE meeting_series ADD COLUMN archived_at TEXT;

ALTER TABLE meetings ADD COLUMN short_name TEXT NOT NULL DEFAULT 'Session';
ALTER TABLE meetings ADD COLUMN archived_at TEXT;

CREATE TABLE IF NOT EXISTS group_membership_requests (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  requester_user_id TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (group_id, requester_user_id),
  FOREIGN KEY (group_id) REFERENCES app_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_app_groups_archived_at ON app_groups(archived_at);
CREATE INDEX IF NOT EXISTS idx_meetings_archived_at ON meetings(archived_at);
CREATE INDEX IF NOT EXISTS idx_group_membership_requests_group_id ON group_membership_requests(group_id, status);
