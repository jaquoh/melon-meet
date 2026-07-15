ALTER TABLE users ADD COLUMN notification_moderation_and_account_emails INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notification_group_membership_request_emails INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notification_group_member_leave_emails INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notification_session_cancellation_emails INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notification_session_spot_claim_emails INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notification_session_spot_release_emails INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notification_session_spot_filled_emails INTEGER NOT NULL DEFAULT 1;
