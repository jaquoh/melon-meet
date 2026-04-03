import { format } from "date-fns";
import { allRows, runStatement } from "../lib/db";
import { combineLocalDateTime, horizonDate, shiftDateByWeeks } from "../lib/time";

export interface MeetingSeriesRow {
  id: string;
  group_id: string;
  owner_user_id: string;
  title: string;
  description: string | null;
  activity_label: string | null;
  venue_id: string | null;
  location_name: string;
  location_address: string;
  latitude: number;
  longitude: number;
  pricing: "free" | "paid";
  capacity: number;
  timezone: string;
  weekday: number;
  start_time_local: string;
  duration_minutes: number;
  start_date: string;
  until_date: string | null;
  status: "active" | "cancelled";
}

async function upsertOccurrence(
  db: D1Database,
  series: MeetingSeriesRow,
  occurrenceDate: string,
) {
  const startsAt = combineLocalDateTime(
    occurrenceDate,
    series.start_time_local,
    series.timezone,
  ).toISOString();
  const endsAt = new Date(
    new Date(startsAt).getTime() + series.duration_minutes * 60_000,
  ).toISOString();
  const createdAt = new Date().toISOString();

  await runStatement(
    db,
    `INSERT INTO meetings (
       id,
       group_id,
       owner_user_id,
       series_id,
       title,
       description,
       activity_label,
       venue_id,
       location_name,
       location_address,
       latitude,
       longitude,
       pricing,
       capacity,
       starts_at,
       ends_at,
       occurrence_date,
       status,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
     ON CONFLICT(series_id, occurrence_date) DO UPDATE SET
       group_id = excluded.group_id,
       owner_user_id = excluded.owner_user_id,
       title = excluded.title,
       description = excluded.description,
       activity_label = excluded.activity_label,
       venue_id = excluded.venue_id,
       location_name = excluded.location_name,
       location_address = excluded.location_address,
       latitude = excluded.latitude,
       longitude = excluded.longitude,
       pricing = excluded.pricing,
       capacity = excluded.capacity,
       starts_at = excluded.starts_at,
       ends_at = excluded.ends_at,
       updated_at = excluded.updated_at`,
    crypto.randomUUID(),
    series.group_id,
    series.owner_user_id,
    series.id,
    series.title,
    series.description,
    series.activity_label,
    series.venue_id,
    series.location_name,
    series.location_address,
    series.latitude,
    series.longitude,
    series.pricing,
    series.capacity,
    startsAt,
    endsAt,
    occurrenceDate,
    createdAt,
    createdAt,
  );
}

export async function ensureSeriesCoverage(
  db: D1Database,
  options?: { fromDate?: string; horizon?: string; seriesId?: string },
) {
  const fromDate = options?.fromDate ?? format(new Date(), "yyyy-MM-dd");
  const untilHorizon = options?.horizon ?? horizonDate();
  const seriesRows = await allRows<MeetingSeriesRow>(
    db,
    `SELECT *
     FROM meeting_series
     WHERE status = 'active'
       AND (? IS NULL OR id = ?)`,
    options?.seriesId ?? null,
    options?.seriesId ?? null,
  );

  for (const series of seriesRows) {
    const finalDate = series.until_date && series.until_date < untilHorizon
      ? series.until_date
      : untilHorizon;

    if (finalDate < fromDate) {
      continue;
    }

    let cursor = series.start_date;
    while (cursor < fromDate) {
      cursor = shiftDateByWeeks(cursor, 1);
    }

    while (cursor <= finalDate) {
      await upsertOccurrence(db, series, cursor);
      cursor = shiftDateByWeeks(cursor, 1);
    }

    if (series.until_date) {
      await runStatement(
        db,
        "DELETE FROM meetings WHERE series_id = ? AND occurrence_date > ?",
        series.id,
        series.until_date,
      );
    }
  }
}
