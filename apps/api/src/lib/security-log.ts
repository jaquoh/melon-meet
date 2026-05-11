import type { Context } from "hono";

import type { AppEnv } from "../types/env";

type SecuritySeverity = "info" | "warn";

function loggerForSeverity(severity: SecuritySeverity) {
  return severity === "warn" ? console.warn : console.info;
}

export function maskEmailAddress(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const [localPart, domain = ""] = normalizedEmail.split("@");
  const visibleLocal = localPart.length <= 2 ? `${localPart.slice(0, 1)}*` : `${localPart.slice(0, 2)}***`;
  return domain ? `${visibleLocal}@${domain}` : visibleLocal;
}

export function logSecurityEvent(
  c: Context<AppEnv>,
  event: string,
  severity: SecuritySeverity,
  extra: Record<string, unknown> = {},
) {
  loggerForSeverity(severity)("Security event", {
    clientAddress: c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ?? "unknown-ip",
    environment: c.env.ENVIRONMENT_NAME ?? "unknown",
    event,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    requestId: c.get("requestId"),
    sessionId: c.get("sessionId"),
    timestamp: new Date().toISOString(),
    userId: c.get("viewer")?.id ?? null,
    ...extra,
  });
}
