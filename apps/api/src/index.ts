import { createApp, finalizePendingAccountDeletions } from "./app";

const app = createApp();

export default {
  fetch(request: Request, env: { ASSETS: Fetcher }) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api")) {
      return app.fetch(request, env);
    }

    return env.ASSETS.fetch(request);
  },
  scheduled(_controller: ScheduledController, env: { DB: D1Database }, ctx: ExecutionContext) {
    ctx.waitUntil(
      finalizePendingAccountDeletions(env.DB).then((count) => {
        if (count > 0) {
          console.info(`Finalized ${count} pending account deletion(s).`);
        }
      }),
    );
  },
};
