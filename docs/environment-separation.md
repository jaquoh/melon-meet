# Melon Meet Environment Separation

Last updated: 2026-05-11

Purpose: keep local, staging, and production clearly separate for deploys, database changes, and operational debugging.

## Environments

### Local

Used for:

- daily development
- local schema checks
- restore drills
- safe demo data experiments

Characteristics:

- uses Wrangler local D1 state
- started with `npm run dev`
- can be reset with `npm run db:reset:local`
- can use full demo seed data

Commands:

```bash
npm run dev
npm run db:migrate:local
npm run db:seed:local
npm run db:reset:local
```

### Staging

Used for:

- pre-production deploy verification
- remote migration rehearsal
- smoke tests before production
- safe testing of email, auth, and critical flows against a real deployed Worker

Characteristics:

- uses Wrangler environment `staging`
- deploys to Worker name `melon-meet-staging`
- must use its own D1 database
- should use its own secrets for Resend, Turnstile, and alerting

Commands:

```bash
npm run db:migrate:staging
npm run db:seed:staging
npm run db:seed:staging:demo
npm run deploy:staging
```

Required config:

- replace `REPLACE_WITH_STAGING_D1_DATABASE_ID` in [wrangler.jsonc](/Users/jbot/IdeaProjects/melon-meet/wrangler.jsonc:31)
- add staging secrets with `wrangler secret put ... --env staging`

Recommended staging secrets:

- `RESEND_API_KEY`
- `TURNSTILE_SECRET_KEY`
- `ALERT_WEBHOOK_URL`

Recommended staging vars review:

- `TURNSTILE_SITE_KEY`
- sender addresses if they differ from production

### Production

Used for:

- real user traffic
- launch operations
- production monitoring and recovery

Characteristics:

- default Wrangler environment
- deploys to Worker name `melon-meet`
- uses the production D1 database
- should never receive demo seed data unless intentionally doing a controlled internal-only environment

Commands:

```bash
npm run db:migrate:remote
npm run db:seed:remote
npm run deploy
```

## Rules

1. Never point staging and production at the same D1 database.
2. Run remote migration first in staging, then production.
3. Run deployed smoke tests in staging before production deploys.
4. Keep staging and production secrets separate even when they currently use the same vendor.
5. Do not seed demo users/groups/sessions into production.

## Minimum Setup Before Public Launch

1. Create a dedicated staging D1 database.
2. Replace the staging database placeholder in [wrangler.jsonc](/Users/jbot/IdeaProjects/melon-meet/wrangler.jsonc:31).
3. Configure staging secrets:
   - `RESEND_API_KEY`
   - `TURNSTILE_SECRET_KEY`
   - `ALERT_WEBHOOK_URL`
4. Configure staging `TURNSTILE_SITE_KEY`.
5. Deploy staging once with `npm run deploy:staging`.
6. Run staging migrations and seed only the data you actually want there.

## Recommended Release Path

1. Develop and test locally.
2. Deploy to staging with `npm run deploy:staging`.
3. Run staging smoke checks.
4. Apply production migration.
5. Deploy production with `npm run deploy`.
6. Run production smoke checks.
