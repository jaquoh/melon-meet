# Melon Meet Go-Live Checklist

This checklist is meant for the first public beta launch on Cloudflare.

## 1. Platform Setup

- Create the production Cloudflare D1 database.
- Replace the placeholder `database_id` in `/Users/jbot/IdeaProjects/melon-meet/wrangler.jsonc`.
- Apply remote migrations with `npm run db:migrate:remote`.
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
