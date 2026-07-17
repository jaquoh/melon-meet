import { describe, expect, it } from "vitest";

import { withSecurityHeaders } from "./index";

describe("worker response security headers", () => {
  it("protects static asset responses without changing their payload or status", async () => {
    const response = withSecurityHeaders(new Response("Melon Meet", {
      headers: { "content-type": "text/html" },
      status: 201,
    }));

    expect(response.status).toBe(201);
    await expect(response.text()).resolves.toBe("Melon Meet");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("strict-transport-security")).toBe("max-age=63072000; includeSubDomains");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });
});
