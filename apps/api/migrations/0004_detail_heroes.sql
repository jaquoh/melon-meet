ALTER TABLE app_groups ADD COLUMN hero_image_url TEXT;
ALTER TABLE venues ADD COLUMN hero_image_url TEXT;
ALTER TABLE meetings ADD COLUMN hero_image_url TEXT;
ALTER TABLE meeting_series ADD COLUMN hero_image_url TEXT;

UPDATE app_groups
SET hero_image_url = CASE id
  WHEN 'f4c53ec1-3794-45f7-b6af-9a4f226e3bfd' THEN 'https://images.unsplash.com/photo-1508615070457-7baeba4003ab?auto=format&fit=crop&w=1600&q=80'
  WHEN '8f96eb6d-918a-4f72-a50c-476fdc8c8325' THEN 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1600&q=80'
  WHEN '61c8cf46-c3fe-4d42-8fab-5fd1e6b15731' THEN 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1600&q=80'
  ELSE hero_image_url
END
WHERE id IN (
  'f4c53ec1-3794-45f7-b6af-9a4f226e3bfd',
  '8f96eb6d-918a-4f72-a50c-476fdc8c8325',
  '61c8cf46-c3fe-4d42-8fab-5fd1e6b15731'
);

UPDATE venues
SET hero_image_url = CASE id
  WHEN 'venue-beachmitte' THEN 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80'
  WHEN 'venue-beach61' THEN 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80'
  WHEN 'venue-east61' THEN 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1600&q=80'
  WHEN 'venue-beachzone' THEN 'https://images.unsplash.com/photo-1521334884684-d80222895322?auto=format&fit=crop&w=1600&q=80'
  WHEN 'venue-volkspark-friedrichshain' THEN 'https://images.unsplash.com/photo-1501959915551-4e8f83a1f0b5?auto=format&fit=crop&w=1600&q=80'
  WHEN 'venue-monbijoupark' THEN 'https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=1600&q=80'
  WHEN 'venue-strandbad-tegel' THEN 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80'
  ELSE hero_image_url
END
WHERE id LIKE 'venue-%';

UPDATE meeting_series
SET hero_image_url = CASE id
  WHEN '327968c9-f264-4f16-83b9-a6759c3f4a83' THEN 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1600&q=80'
  ELSE hero_image_url
END
WHERE id = '327968c9-f264-4f16-83b9-a6759c3f4a83';

UPDATE meetings
SET hero_image_url = CASE id
  WHEN '9ed4bd47-af0b-4f54-a061-7eb5af6fef87' THEN 'https://images.unsplash.com/photo-1508615070457-7baeba4003ab?auto=format&fit=crop&w=1600&q=80'
  WHEN 'f7c5fd75-4521-48c8-b794-61e1de7caad1' THEN 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1600&q=80'
  WHEN '4eb628df-dc51-49b4-b54d-2fcb85fef4ec' THEN 'https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=1600&q=80'
  WHEN '5db32cc0-7662-4a04-8b3e-c1435f2d640f' THEN 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80'
  ELSE hero_image_url
END
WHERE id IN (
  '9ed4bd47-af0b-4f54-a061-7eb5af6fef87',
  'f7c5fd75-4521-48c8-b794-61e1de7caad1',
  '4eb628df-dc51-49b4-b54d-2fcb85fef4ec',
  '5db32cc0-7662-4a04-8b3e-c1435f2d640f'
);
