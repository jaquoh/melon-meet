import { describe, expect, it } from "vitest";
import {
  combineLocalDateTime,
  durationMinutes,
  isoToLocalDate,
  isoToLocalTime,
  isoToWeekday,
  shiftDateByWeeks,
} from "./time";

describe("time helpers", () => {
  it("converts zoned local date time to utc", () => {
    const result = combineLocalDateTime("2026-07-08", "18:30", "Europe/Berlin");
    expect(result.toISOString()).toBe("2026-07-08T16:30:00.000Z");
  });

  it("derives local recurrence metadata from ISO values", () => {
    const startsAt = "2026-07-08T16:30:00.000Z";
    const endsAt = "2026-07-08T18:00:00.000Z";

    expect(isoToLocalDate(startsAt, "Europe/Berlin")).toBe("2026-07-08");
    expect(isoToLocalTime(startsAt, "Europe/Berlin")).toBe("18:30");
    expect(isoToWeekday(startsAt, "Europe/Berlin")).toBe(3);
    expect(durationMinutes(startsAt, endsAt)).toBe(90);
    expect(shiftDateByWeeks("2026-07-08", 2)).toBe("2026-07-22");
  });
});
