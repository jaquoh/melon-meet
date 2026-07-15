ALTER TABLE users ADD COLUMN notification_group_archived_emails INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notification_session_pinboard_emails INTEGER NOT NULL DEFAULT 1;
