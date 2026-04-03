import type { ViewerSummary } from "../../../../packages/shared/src";

export interface AppBindings {
  ASSETS: Fetcher;
  APP_NAME: string;
  DB: D1Database;
  DEFAULT_TIMEZONE: string;
}

export interface AppVariables {
  sessionId: string | null;
  viewer: ViewerSummary | null;
}

export type AppEnv = {
  Bindings: AppBindings;
  Variables: AppVariables;
};
