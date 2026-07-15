ALTER TABLE users ADD COLUMN notification_group_new_session_emails INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notification_session_change_emails INTEGER NOT NULL DEFAULT 1;
