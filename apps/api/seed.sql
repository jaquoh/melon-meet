INSERT OR REPLACE INTO venues (
  id,
  name,
  address,
  description,
  pricing,
  latitude,
  longitude,
  booking_url,
  opening_hours_text,
  source_url,
  hero_image_url,
  created_at
) VALUES
  (
    'venue-beachmitte',
    'BeachMitte',
    'Caroline-Michaelis-Str. 8, 10115 Berlin',
    'Large central beach volleyball venue near Nordbahnhof with many outdoor courts.',
    'paid',
    52.5360,
    13.3924,
    'https://beachmitte.de/beachvolleyball/beachvolleyball-berlin/',
    'Daily 09:00-22:00',
    'https://beachmitte.de/beachvolleyball/beachvolleyball-berlin/',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
    '2026-04-03T00:00:00.000Z'
  ),
  (
    'venue-beach61',
    'Beach61',
    'Park am Gleisdreieck, 10963 Berlin',
    'Busy beach volleyball spot in Gleisdreieck with a social after-game atmosphere.',
    'paid',
    52.4988,
    13.3740,
    'https://www.beach61.de/',
    'Daily 10:00-22:00',
    'https://www.tip-berlin.de/lifestyle/sport/beachvolleyball-felder-berlin/',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80',
    '2026-04-03T00:00:00.000Z'
  ),
  (
    'venue-east61',
    'East61',
    'Wilhelm-Kabus-Str. 42, 10829 Berlin',
    'South-west Berlin courts for casual games, club sessions, and training blocks.',
    'paid',
    52.4818,
    13.3669,
    NULL,
    'Varies by court booking',
    'https://berlin-beachvolleyball.de/beachvolleyball-berlin/',
    'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1600&q=80',
    '2026-04-03T00:00:00.000Z'
  ),
  (
    'venue-beachzone',
    'BeachZone Lichtenberg',
    'Allee der Kosmonauten 190, 12683 Berlin',
    'Lichtenberg beach volleyball location with outdoor courts and bookable time slots.',
    'paid',
    52.5409,
    13.5702,
    'https://beach-zone.de/',
    'Daily 09:00-23:00',
    'https://beach-zone.de/',
    'https://images.unsplash.com/photo-1521334884684-d80222895322?auto=format&fit=crop&w=1600&q=80',
    '2026-04-03T00:00:00.000Z'
  ),
  (
    'venue-volkspark-friedrichshain',
    'Volkspark Friedrichshain Sandbox',
    'Paul-Heyse-Str. 1, 10407 Berlin',
    'Free public sand courts inside Volkspark Friedrichshain. Bring your own setup.',
    'free',
    52.5297,
    13.4415,
    NULL,
    'Public outdoor courts',
    'https://berlin-beachvolleyball.de/en/volkspark-friedrichshain-6-courts-free-but-only-with-your-own-equipment/',
    'https://images.unsplash.com/photo-1501959915551-4e8f83a1f0b5?auto=format&fit=crop&w=1600&q=80',
    '2026-04-03T00:00:00.000Z'
  ),
  (
    'venue-monbijoupark',
    'Monbijoupark Courts',
    'Monbijouplatz, 10178 Berlin',
    'Popular free city courts with a scenic Mitte backdrop and quick pick-up games.',
    'free',
    52.5233,
    13.3994,
    NULL,
    'Open park access',
    'https://www.tip-berlin.de/lifestyle/sport/beachvolleyball-felder-berlin/',
    'https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=1600&q=80',
    '2026-04-03T00:00:00.000Z'
  ),
  (
    'venue-strandbad-tegel',
    'Strandbad Tegel',
    'Schwarzer Weg 95, 13505 Berlin',
    'Beach volleyball courts inside the lakeside bath complex with seasonal entry.',
    'paid',
    52.5864,
    13.2531,
    NULL,
    'Seasonal opening hours',
    'https://parkinspector.de/parks/Beachen/Strandbad-Tegeler-See/187',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
    '2026-04-03T00:00:00.000Z'
  );

INSERT OR REPLACE INTO users (
  id,
  email,
  password_hash,
  display_name,
  bio,
  home_area,
  avatar_url,
  is_profile_public,
  show_email_publicly,
  created_at,
  updated_at
) VALUES (
  '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
  'demo@melonmeet.local',
  'pbkdf2$210000$Q3-MvetF2mKTwrmSDqSQRg$xwqyjaDE65Ko4B3SySaWG4W7Vi8HH2RSVmFFAfXgoLQ',
  'Melon Demo',
  'Weekend organiser for beach volleyball and mixed outdoor game sessions.',
  'Berlin Mitte',
  NULL,
  1,
  0,
  '2026-04-03T00:00:00.000Z',
  '2026-04-03T00:00:00.000Z'
);

INSERT OR REPLACE INTO app_groups (
  id,
  owner_user_id,
  name,
  slug,
  description,
  visibility,
  activity_label,
  messenger_url,
  hero_image_url,
  created_at,
  updated_at
) VALUES
  (
    'f4c53ec1-3794-45f7-b6af-9a4f226e3bfd',
    '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
    'Berlin Sunset Volley',
    'berlin-sunset-volley',
    'Open beach volleyball meetups around central Berlin courts with a friendly drop-in vibe.',
    'public',
    'Beach volleyball',
    'https://t.me/melonmeet_sunset',
    'https://images.unsplash.com/photo-1508615070457-7baeba4003ab?auto=format&fit=crop&w=1600&q=80',
    '2026-04-03T00:00:00.000Z',
    '2026-04-03T00:00:00.000Z'
  ),
  (
    '8f96eb6d-918a-4f72-a50c-476fdc8c8325',
    '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
    'Morning Sand Crew',
    'morning-sand-crew',
    'Private early-morning crew that rotates through quieter Berlin sand courts.',
    'private',
    'Beach volleyball',
    'https://chat.whatsapp.com/example-morning-sand',
    'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1600&q=80',
    '2026-04-03T00:00:00.000Z',
    '2026-04-03T00:00:00.000Z'
  ),
  (
    '61c8cf46-c3fe-4d42-8fab-5fd1e6b15731',
    '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
    'Open City Sand Sessions',
    'open-city-sand-sessions',
    'Public pick-up group for weekday evening sessions across free and paid Berlin courts.',
    'public',
    'Mixed play',
    'https://t.me/melonmeet_open_city',
    'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1600&q=80',
    '2026-04-03T00:00:00.000Z',
    '2026-04-03T00:00:00.000Z'
  );

INSERT OR REPLACE INTO app_group_members (
  id,
  group_id,
  user_id,
  role,
  created_at
) VALUES
  (
    'd6bf1a5f-4185-4dd8-a6a4-df72462c1b85',
    'f4c53ec1-3794-45f7-b6af-9a4f226e3bfd',
    '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
    'owner',
    '2026-04-03T00:00:00.000Z'
  ),
  (
    '13477945-bb69-44aa-bd0b-149c21a6bd23',
    '8f96eb6d-918a-4f72-a50c-476fdc8c8325',
    '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
    'owner',
    '2026-04-03T00:00:00.000Z'
  ),
  (
    'e89760d3-62c6-495b-b7f3-ea6fcb80b2a2',
    '61c8cf46-c3fe-4d42-8fab-5fd1e6b15731',
    '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
    'owner',
    '2026-04-03T00:00:00.000Z'
  );

INSERT OR REPLACE INTO group_posts (
  id,
  group_id,
  author_user_id,
  content,
  created_at
) VALUES
  (
    'b95b0558-7e8f-48f1-95e7-8773f1b6335a',
    'f4c53ec1-3794-45f7-b6af-9a4f226e3bfd',
    '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
    'Demo group is ready. Feel free to sign in with demo@melonmeet.local / demo12345 and explore the flows.',
    '2026-04-03T00:00:00.000Z'
  ),
  (
    'f8941d82-12b8-4db8-b5b8-dce25fb16306',
    '61c8cf46-c3fe-4d42-8fab-5fd1e6b15731',
    '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
    'Added a second public mock group so the timeline stays lively even before you join anything.',
    '2026-04-03T00:00:00.000Z'
  );

INSERT OR REPLACE INTO meeting_series (
  id,
  group_id,
  owner_user_id,
  short_name,
  title,
  description,
  activity_label,
  hero_image_url,
  venue_id,
  location_name,
  location_address,
  latitude,
  longitude,
  pricing,
  cost_per_person,
  capacity,
  timezone,
  weekday,
  start_time_local,
  duration_minutes,
  start_date,
  until_date,
  status,
  created_at,
  updated_at
) VALUES (
  '327968c9-f264-4f16-83b9-a6759c3f4a83',
  'f4c53ec1-3794-45f7-b6af-9a4f226e3bfd',
  '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
  'Sunset Rally',
  'Sunset Rally at BeachMitte',
  'Weekly after-work beach volleyball session for intermediate players who want steady games and a social hang afterwards.',
  'Beach volleyball',
  'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1600&q=80',
  'venue-beachmitte',
  'BeachMitte',
  'Caroline-Michaelis-Str. 8, 10115 Berlin',
  52.5360,
  13.3924,
  'paid',
  8,
  16,
  'Europe/Berlin',
  4,
  '18:30',
  90,
  '2026-04-10',
  NULL,
  'active',
  '2026-04-03T00:00:00.000Z',
  '2026-04-03T00:00:00.000Z'
);

INSERT OR REPLACE INTO meetings (
  id,
  group_id,
  owner_user_id,
  series_id,
  short_name,
  title,
  description,
  activity_label,
  hero_image_url,
  venue_id,
  location_name,
  location_address,
  latitude,
  longitude,
  pricing,
  cost_per_person,
  capacity,
  starts_at,
  ends_at,
  occurrence_date,
  status,
  created_at,
  updated_at
) VALUES
  (
    '9ed4bd47-af0b-4f54-a061-7eb5af6fef87',
    'f4c53ec1-3794-45f7-b6af-9a4f226e3bfd',
    '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
    NULL,
    'Mitte Mixer',
    'Saturday Mixer at Monbijoupark',
    'Casual mixed-level pickup on the free city courts. Bring water and be ready to rotate in.',
    'Beach volleyball',
    'https://images.unsplash.com/photo-1508615070457-7baeba4003ab?auto=format&fit=crop&w=1600&q=80',
    'venue-monbijoupark',
    'Monbijoupark Courts',
    'Monbijouplatz, 10178 Berlin',
    52.5233,
    13.3994,
    'free',
    NULL,
    12,
    '2026-04-18T10:00:00.000Z',
    '2026-04-18T12:00:00.000Z',
    '2026-04-18',
    'active',
    '2026-04-03T00:00:00.000Z',
    '2026-04-03T00:00:00.000Z'
  ),
  (
    'f7c5fd75-4521-48c8-b794-61e1de7caad1',
    '8f96eb6d-918a-4f72-a50c-476fdc8c8325',
    '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
    NULL,
    'Dawn Drill',
    'Morning Sand Crew Training',
    'Invite-only early session focused on serve receive and transition reps.',
    'Beach volleyball',
    'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1600&q=80',
    'venue-east61',
    'East61',
    'Wilhelm-Kabus-Str. 42, 10829 Berlin',
    52.4818,
    13.3669,
    'paid',
    6,
    8,
    '2026-04-19T06:30:00.000Z',
    '2026-04-19T08:00:00.000Z',
    '2026-04-19',
    'active',
    '2026-04-03T00:00:00.000Z',
    '2026-04-03T00:00:00.000Z'
  ),
  (
    '4eb628df-dc51-49b4-b54d-2fcb85fef4ec',
    '61c8cf46-c3fe-4d42-8fab-5fd1e6b15731',
    '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
    NULL,
    'Park Rally',
    'Weekday Open Session in Friedrichshain',
    'Friendly public evening games on the free courts. Good for drop-ins and meeting new players.',
    'Mixed play',
    'https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=1600&q=80',
    'venue-volkspark-friedrichshain',
    'Volkspark Friedrichshain Sandbox',
    'Paul-Heyse-Str. 1, 10407 Berlin',
    52.5297,
    13.4415,
    'free',
    NULL,
    14,
    '2026-04-22T17:00:00.000Z',
    '2026-04-22T19:00:00.000Z',
    '2026-04-22',
    'active',
    '2026-04-03T00:00:00.000Z',
    '2026-04-03T00:00:00.000Z'
  ),
  (
    '5db32cc0-7662-4a04-8b3e-c1435f2d640f',
    'f4c53ec1-3794-45f7-b6af-9a4f226e3bfd',
    '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
    '327968c9-f264-4f16-83b9-a6759c3f4a83',
    'Sunset Rally',
    'Sunset Rally at BeachMitte',
    'Weekly after-work beach volleyball session for intermediate players who want steady games and a social hang afterwards.',
    'Beach volleyball',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80',
    'venue-beachmitte',
    'BeachMitte',
    'Caroline-Michaelis-Str. 8, 10115 Berlin',
    52.5360,
    13.3924,
    'paid',
    10,
    16,
    '2026-04-24T16:30:00.000Z',
    '2026-04-24T18:00:00.000Z',
    '2026-04-24',
    'active',
    '2026-04-03T00:00:00.000Z',
    '2026-04-03T00:00:00.000Z'
  );

INSERT OR REPLACE INTO meeting_claims (
  id,
  meeting_id,
  user_id,
  created_at
) VALUES
  (
    '9d7b79cf-6b93-4c7e-a416-1fd1f9a7f5f2',
    '9ed4bd47-af0b-4f54-a061-7eb5af6fef87',
    '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
    '2026-04-03T00:00:00.000Z'
  ),
  (
    '5307ac25-b155-4bd1-b799-8d340cce93e2',
    '5db32cc0-7662-4a04-8b3e-c1435f2d640f',
    '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
    '2026-04-03T00:00:00.000Z'
  );

INSERT OR REPLACE INTO meeting_posts (
  id,
  meeting_id,
  author_user_id,
  content,
  created_at
) VALUES
  (
    '0887c4b4-4dbc-4a52-90bb-31cf5b604c3d',
    '9ed4bd47-af0b-4f54-a061-7eb5af6fef87',
    '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
    'Weather looks good for Saturday. Bring a light layer in case it cools off after 11.',
    '2026-04-03T00:00:00.000Z'
  ),
  (
    'f54b95d0-0e87-4d34-b20e-6ff4bd8c3fd1',
    '5db32cc0-7662-4a04-8b3e-c1435f2d640f',
    '1fd5f6bf-6276-41d2-95da-56e255a5f4de',
    'Booked two courts. If you are running late, drop a note here so we can plan rotations.',
    '2026-04-03T00:00:00.000Z'
  );
