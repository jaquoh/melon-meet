import type { AppBindings } from "../types/env";

type MonitoringBindings = Pick<AppBindings, "ALERT_WEBHOOK_URL" | "APP_NAME" | "ENVIRONMENT_NAME">;

type MonitoringSource = "request" | "scheduled" | "worker";

type ErrorContext = {
  extra?: Record<string, unknown>;
  method?: string;
  path?: string;
  requestId?: string;
  sessionId?: string | null;
  source: MonitoringSource;
  status?: number;
  userId?: string | null;
};

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "Unknown error";
}

function errorStack(error: unknown) {
  return error instanceof Error ? error.stack ?? null : null;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function monitoringEvent(bindings: MonitoringBindings, error: unknown, context: ErrorContext) {
  return {
    app: bindings.APP_NAME,
    environment: bindings.ENVIRONMENT_NAME ?? "unknown",
    extra: context.extra ?? null,
    message: errorMessage(error),
    method: context.method ?? null,
    path: context.path ?? null,
    requestId: context.requestId ?? null,
    sessionId: context.sessionId ?? null,
    source: context.source,
    stack: errorStack(error),
    status: context.status ?? null,
    timestamp: new Date().toISOString(),
    userId: context.userId ?? null,
  };
}

async function sendAlertWebhook(bindings: MonitoringBindings, event: ReturnType<typeof monitoringEvent>) {
  if (!bindings.ALERT_WEBHOOK_URL) {
    return;
  }

  const summary = `[${event.app}][${event.environment}] ${event.source} error: ${event.message}`;
  const response = await fetch(bindings.ALERT_WEBHOOK_URL, {
    body: JSON.stringify({
      event,
      text: truncate(summary, 280),
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = truncate(await response.text(), 1000);
    console.error("Alert webhook delivery failed", {
      body,
      status: response.status,
      statusText: response.statusText,
    });
  }
}

export async function reportOperationalError(bindings: MonitoringBindings, error: unknown, context: ErrorContext) {
  const event = monitoringEvent(bindings, error, context);
  console.error("Operational error", event);

  try {
    await sendAlertWebhook(bindings, event);
  } catch (alertError) {
    console.error("Operational alert dispatch failed", {
      alertError: errorMessage(alertError),
      requestId: context.requestId ?? null,
      source: context.source,
    });
  }
}
