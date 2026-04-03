import { createApp } from "./app";

const app = createApp();

export default {
  fetch(request: Request, env: { ASSETS: Fetcher }) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api")) {
      return app.fetch(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
