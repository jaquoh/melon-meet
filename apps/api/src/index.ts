import { createApp, finalizePendingAccountDeletions } from "./app";
import { reportOperationalError } from "./lib/monitoring";
import type { AppBindings } from "./types/env";

const app = createApp();

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://tiles.openfreemap.org https://challenges.cloudflare.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src https://challenges.cloudflare.com",
  "img-src 'self' data: blob: https:",
  "object-src 'none'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

export function withSecurityHeaders(response: Response) {
  const securedResponse = new Response(response.body, response);
  securedResponse.headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  securedResponse.headers.set("Permissions-Policy", "geolocation=(self)");
  securedResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  securedResponse.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  securedResponse.headers.set("X-Content-Type-Options", "nosniff");
  securedResponse.headers.set("X-Frame-Options", "DENY");
  return securedResponse;
}

export default {
  async fetch(
    request: Request,
    env: AppBindings,
  ) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api")) {
        return withSecurityHeaders(await app.fetch(request, env));
      }

      return withSecurityHeaders(await env.ASSETS.fetch(request));
    } catch (error) {
      await reportOperationalError(env, error, {
        method: request.method,
        path: url.pathname,
        source: "worker",
        status: 500,
      });
      return withSecurityHeaders(new Response(JSON.stringify({ error: "Unexpected server error." }), {
        headers: {
          "content-type": "application/json",
        },
        status: 500,
      }));
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
