# Melon Meet Go-Live Checklist

This checklist is meant for the first public beta launch on Cloudflare.

## 1. Platform Setup

- Create the staging Cloudflare D1 database.
- Create the production Cloudflare D1 database.
- Replace the staging and production database placeholders in `/Users/jbot/IdeaProjects/melon-meet/wrangler.jsonc`.
- Review `/Users/jbot/IdeaProjects/melon-meet/docs/environment-separation.md`.
- Review `/Users/jbot/IdeaProjects/melon-meet/docs/production-deploy-runbook.md`.
- Apply staging migrations with `npm run db:migrate:staging`.
- Seed staging with `npm run db:seed:staging`.
- Deploy staging with `npm run deploy:staging`.
- Apply remote migrations with `npm run db:migrate:remote`.
- Seed production-safe venue data with `npm run db:seed:remote`.
- Only seed full demo/sample content if you explicitly want it, using `npm run db:seed:remote:demo`.
- Confirm the app is deployed with `npm run deploy`.
- Verify deep links like `/map`, `/groups`, and `/sessions/<id>` work in production.

## 2. Product Readiness

- Replace placeholder contact details in `/Users/jbot/IdeaProjects/melon-meet/apps/web/src/pages/InfoPage.tsx`.
- Review privacy, terms, and impressum copy with real operator details.
- Decide whether to keep or remove the demo-account messaging before public launch.
- Seed or curate a small set of real venues and starter groups for the first cohort.

## 3. Security and Abuse Controls

- Confirm auth rate limiting is working after migration `0006_auth_rate_limits.sql`.
- Add a moderation/report flow for groups, meetings, and posts.
- Add basic operational logging and error monitoring for Worker exceptions.
- Review and follow the D1 recovery runbook in [/Users/jbot/IdeaProjects/melon-meet/docs/d1-backup-restore-runbook.md](/Users/jbot/IdeaProjects/melon-meet/docs/d1-backup-restore-runbook.md).
- Review account deletion and content-removal behavior with real user scenarios.

## 4. Quality Gates

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Test the main user journeys in a deployed environment:
  - sign up
  - log in
  - create group
  - create meeting
  - claim and unclaim a spot
  - join a public group
  - open deep links directly

## 5. Launch Operations

- Set up a support inbox and use it in legal/support copy.
- Add product analytics and error monitoring before broad announcement.
- Prepare a short private beta invite list first, then expand once retention and stability look healthy.
