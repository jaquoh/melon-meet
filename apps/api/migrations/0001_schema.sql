PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  home_area TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS friend_connections (
  id TEXT PRIMARY KEY,
  requester_user_id TEXT NOT NULL,
  addressee_user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'accepted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (requester_user_id, addressee_user_id),
  FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (addressee_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_groups (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK(visibility IN ('public', 'private')),
  activity_label TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'member')),
  created_at TEXT NOT NULL,
  UNIQUE (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES app_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_invite_links (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (group_id) REFERENCES app_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_posts (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (group_id) REFERENCES app_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  description TEXT NOT NULL,
  pricing TEXT NOT NULL CHECK(pricing IN ('free', 'paid')),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  source_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meeting_series (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  activity_label TEXT,
  venue_id TEXT,
  location_name TEXT NOT NULL,
  location_address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  pricing TEXT NOT NULL CHECK(pricing IN ('free', 'paid')),
  capacity INTEGER NOT NULL,
  timezone TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  start_time_local TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  until_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (group_id) REFERENCES app_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  series_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  activity_label TEXT,
  venue_id TEXT,
  location_name TEXT NOT NULL,
  location_address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  pricing TEXT NOT NULL CHECK(pricing IN ('free', 'paid')),
  capacity INTEGER NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  occurrence_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (series_id, occurrence_date),
  FOREIGN KEY (group_id) REFERENCES app_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (series_id) REFERENCES meeting_series(id) ON DELETE CASCADE,
  FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS meeting_claims (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (meeting_id, user_id),
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS meeting_posts (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_friend_connections_users ON friend_connections(requester_user_id, addressee_user_id);
CREATE INDEX IF NOT EXISTS idx_app_group_members_group_user ON app_group_members(group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_group_id ON meetings(group_id);
CREATE INDEX IF NOT EXISTS idx_meetings_series_id ON meetings(series_id);
CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON meetings(starts_at);
CREATE INDEX IF NOT EXISTS idx_meeting_claims_meeting_id ON meeting_claims(meeting_id);
CREATE INDEX IF NOT EXISTS idx_venues_pricing ON venues(pricing);
