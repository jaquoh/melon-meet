ALTER TABLE users ADD COLUMN image_urls_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE app_groups ADD COLUMN image_urls_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE meetings ADD COLUMN image_urls_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE meeting_series ADD COLUMN image_urls_json TEXT NOT NULL DEFAULT '[]';

UPDATE users
SET image_urls_json = json_array(avatar_url)
WHERE avatar_url IS NOT NULL AND trim(avatar_url) != '';

UPDATE app_groups
SET image_urls_json = json_array(hero_image_url)
WHERE hero_image_url IS NOT NULL AND trim(hero_image_url) != '';

UPDATE meetings
SET image_urls_json = json_array(hero_image_url)
WHERE hero_image_url IS NOT NULL AND trim(hero_image_url) != '';

UPDATE meeting_series
SET image_urls_json = json_array(hero_image_url)
WHERE hero_image_url IS NOT NULL AND trim(hero_image_url) != '';
