ALTER TABLE meetings ADD COLUMN cost_per_person REAL;
ALTER TABLE meeting_series ADD COLUMN cost_per_person REAL;

UPDATE meetings
SET cost_per_person = CASE id
  WHEN '5db32cc0-7662-4a04-8b3e-c1435f2d640f' THEN 10
  ELSE cost_per_person
END
WHERE pricing = 'paid';

UPDATE meeting_series
SET cost_per_person = 8
WHERE pricing = 'paid';
