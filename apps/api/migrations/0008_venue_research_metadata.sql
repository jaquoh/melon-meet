ALTER TABLE venues ADD COLUMN website_url TEXT;
ALTER TABLE venues ADD COLUMN google_maps_url TEXT;
ALTER TABLE venues ADD COLUMN court_count_total INTEGER;
ALTER TABLE venues ADD COLUMN indoor_court_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE venues ADD COLUMN outdoor_court_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE venues ADD COLUMN access_type TEXT NOT NULL DEFAULT 'public' CHECK(access_type IN ('public', 'bookable', 'membership', 'entry_fee', 'mixed'));
ALTER TABLE venues ADD COLUMN environment TEXT NOT NULL DEFAULT 'outdoor' CHECK(environment IN ('indoor', 'outdoor', 'indoor_outdoor'));
ALTER TABLE venues ADD COLUMN seasonality_text TEXT;
ALTER TABLE venues ADD COLUMN amenities_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE venues ADD COLUMN image_gallery_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE venues ADD COLUMN source_urls_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE venues ADD COLUMN duplicate_notes TEXT;
ALTER TABLE venues ADD COLUMN researched_at TEXT;

CREATE INDEX IF NOT EXISTS idx_venues_access_type ON venues(access_type);
CREATE INDEX IF NOT EXISTS idx_venues_environment ON venues(environment);
