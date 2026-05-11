import { createApp, finalizePendingAccountDeletions } from "./app";
import { reportOperationalError } from "./lib/monitoring";
import type { AppBindings } from "./types/env";

const app = createApp();

export default {
  async fetch(
    request: Request,
    env: AppBindings,
  ) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api")) {
        return await app.fetch(request, env);
      }

      return await env.ASSETS.fetch(request);
    } catch (error) {
      await reportOperationalError(env, error, {
        method: request.method,
        path: url.pathname,
        source: "worker",
        status: 500,
      });
      return new Response(JSON.stringify({ error: "Unexpected server error." }), {
        headers: {
          "content-type": "application/json",
        },
        status: 500,
      });
    }
  },
  scheduled(
    controller: ScheduledController,
    env: Pick<AppBindings, "ALERT_WEBHOOK_URL" | "APP_NAME" | "DB" | "ENVIRONMENT_NAME">,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(
      finalizePendingAccountDeletions(env.DB)
        .then((count) => {
          if (count > 0) {
            console.info(`Finalized ${count} pending account deletion(s).`);
          }
        })
        .catch(async (error) => {
          await reportOperationalError(env, error, {
            extra: {
              cron: controller.cron,
            },
            source: "scheduled",
            status: 500,
          });
          throw error;
        }),
    );
  },
};
