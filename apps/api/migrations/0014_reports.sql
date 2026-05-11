CREATE TABLE IF NOT EXISTS content_reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('profile', 'group', 'meeting', 'group_post', 'meeting_post', 'invite_abuse')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK(reason IN (
    'spam',
    'harassment',
    'hate_or_threats',
    'sexual_content',
    'scam_or_phishing',
    'safety_concern',
    'impersonation',
    'underage_concern',
    'other'
  )),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'triaged', 'action_taken', 'closed_no_action')),
  internal_notes TEXT,
  resolution TEXT,
  assignee_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status_created_at ON content_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_target ON content_reports(target_type, target_id, status);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter ON content_reports(reporter_user_id, created_at DESC);
