import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reportOperationalError } from "./monitoring";

const baseBindings = {
  APP_NAME: "Melon Meet",
  ASSETS: {} as Fetcher,
  DB: {} as D1Database,
  DEFAULT_TIMEZONE: "Europe/Berlin",
  EMAIL_FROM_ADDRESS: "Melon Meet <noreply@mail.melonmeet.com>",
  EMAIL_REPLY_TO_ADDRESS: "hello@melonmeet.com",
  ENVIRONMENT_NAME: "test",
};

describe("operational monitoring", () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  it("sends a webhook alert when configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock as typeof fetch;

    await reportOperationalError(
      {
        ...baseBindings,
        ALERT_WEBHOOK_URL: "https://hooks.example.test/ops",
      },
      new Error("boom"),
      {
        method: "POST",
        path: "/api/auth/signup",
        requestId: "req-123",
        source: "request",
        status: 500,
        userId: "user-123",
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://hooks.example.test/ops");
    expect(console.error).toHaveBeenCalled();
  });

  it("does not throw if webhook delivery fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;

    await expect(
      reportOperationalError(
        {
          ...baseBindings,
          ALERT_WEBHOOK_URL: "https://hooks.example.test/ops",
        },
        new Error("boom"),
        {
          source: "scheduled",
          status: 500,
        },
      ),
    ).resolves.toBeUndefined();
  });
});
