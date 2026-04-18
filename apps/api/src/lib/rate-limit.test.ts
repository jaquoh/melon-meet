import { describe, expect, it } from "vitest";
import { floorToRateLimitWindow, retryAfterSeconds } from "./rate-limit";

describe("rate limit helpers", () => {
  it("floors timestamps into the active rate limit bucket", () => {
    const now = new Date("2026-04-18T16:23:41.000Z");
    const bucket = floorToRateLimitWindow(now, 10 * 60 * 1000);
    expect(bucket.toISOString()).toBe("2026-04-18T16:20:00.000Z");
  });

  it("computes retry-after from the current window", () => {
    const now = new Date("2026-04-18T16:23:41.000Z");
    const bucket = new Date("2026-04-18T16:20:00.000Z");
    expect(retryAfterSeconds(now, bucket, 10 * 60 * 1000)).toBe(379);
  });
});
