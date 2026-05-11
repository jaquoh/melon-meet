import type { ViewerSummary } from "../../../../packages/shared/src";

export interface AppBindings {
  ALERT_WEBHOOK_URL?: string;
  ASSETS: Fetcher;
  APP_NAME: string;
  DB: D1Database;
  DEFAULT_TIMEZONE: string;
  EMAIL_FROM_ADDRESS: string;
  EMAIL_REPLY_TO_ADDRESS: string;
  ENVIRONMENT_NAME?: string;
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
}

export interface AppVariables {
  requestId: string;
  sessionId: string | null;
  viewer: ViewerSummary | null;
}

export type AppEnv = {
  Bindings: AppBindings;
  Variables: AppVariables;
};
