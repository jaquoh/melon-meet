# Melon Meet Go-Live Checklist

Last updated: 2026-07-15

This checklist is meant for the first public beta launch on Cloudflare.

For the actual small-cohort rollout procedure, use [invite-only-cohort-launch-runbook.md](/Users/jbot/IdeaProjects/melon-meet/docs/invite-only-cohort-launch-runbook.md).

## 1. Platform Setup

- Verify the staging and production Cloudflare D1 databases exist and still match the IDs configured in `/Users/jbot/IdeaProjects/melon-meet/wrangler.jsonc`.
- Review `/Users/jbot/IdeaProjects/melon-meet/docs/environment-separation.md`.
- Review `/Users/jbot/IdeaProjects/melon-meet/docs/production-deploy-runbook.md`.
- Configure required Wrangler secrets and vars for the target environments:
  - `RESEND_API_KEY`
  - `TURNSTILE_SECRET`
  - `TURNSTILE_SITE_KEY`
  - `ALERT_WEBHOOK_URL` if used
  - moderation operator allowlists
- Confirm Cloudflare auth is available for non-interactive remote commands:
  - `CLOUDFLARE_API_TOKEN` in CI or other headless environments
  - or an interactive Wrangler login on a local operator machine
- Apply staging migrations with `npm run db:migrate:staging`.
- Seed staging with `npm run db:seed:staging`.
- Deploy staging with `npm run deploy:staging`.
- Apply remote migrations with `npm run db:migrate:remote`.
- Seed production-safe venue data with `npm run db:seed:remote`.
- Only seed full demo/sample content if you explicitly want it, using `npm run db:seed:remote:demo`.
- Confirm the app is deployed with `npm run deploy`.
- Verify deep links like `/map`, `/groups`, and `/sessions/<id>` work in production.

## 2. Product Readiness

- Review privacy, terms, and impressum copy against the actual retention, support, and processor model.
- Confirm the support inbox owner and user data request process are ready before invite-only launch.
- Confirm the current processor inventory still matches the deployed setup, especially map-style and alerting providers.
- Make sure support/help contact paths are visible in-product as well as on the legal pages.
- Confirm there is no production-facing demo or sample-account messaging you do not want public users to see.
- Seed or curate a small set of real venues and starter groups for the first cohort.
- Confirm the account settings and verified-email experience are understandable enough for beta users.

## 3. Security and Abuse Controls

- Confirm auth rate limiting is working after migration `0006_auth_rate_limits.sql`.
- Confirm moderation/report flows and operator actions work for profiles, groups, sessions, posts, and invite misuse.
- Confirm operational logging, error monitoring, and audit logging are visible to operators.
- Review and follow the D1 recovery runbook in [/Users/jbot/IdeaProjects/melon-meet/docs/d1-backup-restore-runbook.md](/Users/jbot/IdeaProjects/melon-meet/docs/d1-backup-restore-runbook.md).
- Review account deletion and content-removal behavior with real user scenarios.
- Decide the support and moderation owner rotation for the first invite-only cohort.

## 4. Quality Gates

- Run `npm run quality:gate:staging`.
- Run `npm run quality:gate:production`.
- Run `npm run smoke:staging`.
- Run `npm run smoke:production`.
- Configure `SMOKE_EMAIL_STAGING` / `SMOKE_PASSWORD_STAGING` and `SMOKE_EMAIL_PRODUCTION` / `SMOKE_PASSWORD_PRODUCTION` if you want authenticated deployed checks.
- Test the main user journeys in a deployed environment:
  - sign up
  - verify email
  - log in
  - create group
  - create meeting
  - claim and unclaim a spot
  - join a public group
  - request private-group access
  - delete account
  - open deep links directly

## 5. Launch Operations

- Set up a support inbox and use it in legal/support copy.
- Keep non-essential analytics out of the first public beta unless the consent/privacy approach is reopened and implemented properly first.
- Prepare a short private beta invite list first, then expand once retention and stability look healthy.
- Run the first launch as invite-only, then review support load, abuse rate, and failure rate before any broader public announcement.
