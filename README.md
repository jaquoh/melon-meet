# Melon Meet

Map-first meetup organizer for beach volleyball and other outdoor games, built for cheap deployment on Cloudflare.

## Stack

- `apps/web`: Vite + React + TypeScript + Tailwind CSS + Preline UI
- `apps/api`: Hono on Cloudflare Workers
- `packages/shared`: shared schemas and TypeScript types
- Cloudflare D1 for users, groups, meetings, claims, posts, and seeded venues
- MapLibre for the Berlin-first map experience

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create and migrate the local D1 database:

```bash
npm run db:migrate:local
npm run db:seed:local
```

If you have pulled new migrations or your local D1 state has drifted, rebuild it from scratch with:

```bash
npm run db:reset:local
```

3. Start the API Worker and the Vite frontend together:

```bash
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies `/api` requests to Wrangler on `http://localhost:8787`.

## Demo seed

After seeding, you can sign in with:

- Email: `demo@melonmeet.local`
- Password: `demo12345`

The seed includes:

- Berlin beach volleyball venues
- One public group
- One private group
- One public one-time meeting
- One recurring public meeting series

## Useful commands

```bash
npm run typecheck
npm test
npm run build
npm run quality:gate
npm run quality:gate:staging
npm run db:migrate:staging
npm run db:seed:staging
npm run deploy:staging
npm run smoke:staging
npm run db:migrate:remote
npm run db:seed:remote
npm run db:seed:remote:demo
npm run transit:generate
npm run deploy
npm run smoke:production
```

## Transactional email

Melon Meet sends account emails through Resend for:

- email verification
- password reset
- email change confirmation

Configured sender values live in [wrangler.jsonc](/Users/jbot/IdeaProjects/melon-meet/wrangler.jsonc:19):

- `EMAIL_FROM_ADDRESS`: `Melon Meet <noreply@mail.melonmeet.com>`
- `EMAIL_REPLY_TO_ADDRESS`: `hello@melonmeet.com`

Add the Resend API key as a Wrangler secret:

```bash
npx wrangler secret put RESEND_API_KEY --config wrangler.jsonc
```

Local behavior:

- on `localhost`, if `RESEND_API_KEY` is missing, the API keeps returning the local dev verification/reset URLs instead of sending email
- on deployed environments, missing `RESEND_API_KEY` causes account-email actions to fail until the secret is configured

## Signup bot defense

Public signup now supports Cloudflare Turnstile.

Configure the site key as a Wrangler var and the secret as a Wrangler secret:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY --config wrangler.jsonc
```

Add `TURNSTILE_SITE_KEY` to the `vars` section in [wrangler.jsonc](/Users/jbot/IdeaProjects/melon-meet/wrangler.jsonc:17).

Behavior:

- on deployed environments, signup requires a valid Turnstile token when Turnstile is configured
- on `localhost`, signup still works without Turnstile so local development stays simple

## Error monitoring

The API now emits structured Worker error logs with a request ID and can forward unhandled request errors plus cron failures to an ops webhook.

Configure the optional alert webhook as a Wrangler secret:

```bash
npx wrangler secret put ALERT_WEBHOOK_URL --config wrangler.jsonc
```

The default deployment config sets `ENVIRONMENT_NAME=production` in [wrangler.jsonc](/Users/jbot/IdeaProjects/melon-meet/wrangler.jsonc:17). If you add staging later, give that environment its own value so alerts clearly show where failures came from.

## Operational security logs

The API also emits structured security-event logs for the launch-critical flows:

- auth rate-limit blocks
- write-action rate-limit blocks
- blocked cross-site writes
- Turnstile signup failures
- signup and login success/failure
- password reset and password change events
- email verification and email change events
- logout, session revocation, invite-link creation, membership requests, and account deletion requests

These logs are written to the Worker log stream with request IDs, environment, path, user/session context, and masked email addresses where relevant.

## Deployment notes

- Replace the production `database_id` in [wrangler.jsonc](/Users/jbot/IdeaProjects/melon-meet/wrangler.jsonc:14) with your real production D1 database ID before deploying.
- Replace `REPLACE_WITH_STAGING_D1_DATABASE_ID` in [wrangler.jsonc](/Users/jbot/IdeaProjects/melon-meet/wrangler.jsonc:31) before using staging.
- `npm run quality:gate:production` runs the current pre-deploy checks for production.
- `npm run quality:gate:staging` runs the current pre-deploy checks for staging.
- `npm run smoke:staging` runs deployed smoke checks against `SMOKE_BASE_URL_STAGING` or `SMOKE_BASE_URL`.
- `npm run smoke:production` runs deployed smoke checks against `SMOKE_BASE_URL_PRODUCTION` or `SMOKE_BASE_URL`.
- Set `SMOKE_EMAIL_STAGING` / `SMOKE_PASSWORD_STAGING` or `SMOKE_EMAIL_PRODUCTION` / `SMOKE_PASSWORD_PRODUCTION` if you want the authenticated portion of the smoke checks.
- Run `npm run db:migrate:remote` before the first production deploy.
- Run `npm run db:migrate:staging` before the first staging deploy that needs the remote schema.
- `npm run db:seed:remote` is production-safe and inserts only venue data.
- `npm run db:seed:staging` seeds the staging remote database with venue data only.
- If you want the full demo content in a remote database, run `npm run db:seed:remote:demo` after migrations.
- If you want full demo content in staging, run `npm run db:seed:staging:demo` after migrations.
- If local auth, venues, or meetings look out of sync after pulling changes, run `npm run db:reset:local`.
- If remote migration or seed commands fail with Cloudflare authorization errors, re-authenticate Wrangler and confirm the configured account can access the D1 database.
- For production D1 recovery steps, use [docs/d1-backup-restore-runbook.md](/Users/jbot/IdeaProjects/melon-meet/docs/d1-backup-restore-runbook.md).
- For environment boundaries and the recommended release path, use [docs/environment-separation.md](/Users/jbot/IdeaProjects/melon-meet/docs/environment-separation.md).
- For production deploy and rollback steps, use [docs/production-deploy-runbook.md](/Users/jbot/IdeaProjects/melon-meet/docs/production-deploy-runbook.md).
- For the current trust-and-safety baseline, use [docs/minimum-moderation-model.md](/Users/jbot/IdeaProjects/melon-meet/docs/minimum-moderation-model.md).
- `wrangler.jsonc` is configured for SPA route fallback so BrowserRouter deep links keep working in production.
- If you want a custom map style, define `VITE_MAP_STYLE_URL` and `VITE_MAP_STYLE_URL_DARK` for the frontend build. The default style uses OpenFreeMap so local and production deploys work without a tile API key.
- Work through the launch checklist in [docs/go-live-checklist.md](/Users/jbot/IdeaProjects/melon-meet/docs/go-live-checklist.md).
- Use [docs/venue-content-plan.md](/Users/jbot/IdeaProjects/melon-meet/docs/venue-content-plan.md) when expanding real venue data or adding user venue suggestions.
- Use [docs/transit-overlay.md](/Users/jbot/IdeaProjects/melon-meet/docs/transit-overlay.md) to generate the optional Berlin U-Bahn/S-Bahn overlay for local testing.
