# Melon Meet Dev and Deploy Commands

Last updated: 2026-07-01

Purpose: keep the everyday local-start and deploy commands in one place for returning to the project quickly.

Related docs:

- [environment-separation.md](/Users/jbot/IdeaProjects/melon-meet/docs/environment-separation.md)
- [production-deploy-runbook.md](/Users/jbot/IdeaProjects/melon-meet/docs/production-deploy-runbook.md)
- [go-live-checklist.md](/Users/jbot/IdeaProjects/melon-meet/docs/go-live-checklist.md)

## Local Setup

Install dependencies:

```bash
npm install
```

Create and seed the local database:

```bash
npm run db:migrate:local
npm run db:seed:local
```

If local D1 state drifted and you want a clean reset:

```bash
npm run db:reset:local
```

## Start The Local App

Run frontend and API together:

```bash
npm run dev
```

Useful local URLs:

- frontend: `http://localhost:5173`
- API worker: `http://localhost:8787`

Local demo account after `db:seed:local`:

- email: `demo@melonmeet.local`
- password: `demo12345`

## Useful Local Checks

```bash
npm run typecheck
npm test
npm run build
npm run quality:gate
```

## Staging Setup

Before first staging deploy:

- make sure the staging D1 database ID is correct in [wrangler.jsonc](/Users/jbot/IdeaProjects/melon-meet/wrangler.jsonc)
- configure staging secrets:
  - `RESEND_API_KEY`
  - `TURNSTILE_SECRET_KEY`
  - `ALERT_WEBHOOK_URL` if used
- configure staging vars such as `TURNSTILE_SITE_KEY`

Example secret commands:

```bash
npx wrangler secret put RESEND_API_KEY --env staging --config wrangler.jsonc
npx wrangler secret put TURNSTILE_SECRET_KEY --env staging --config wrangler.jsonc
npx wrangler secret put ALERT_WEBHOOK_URL --env staging --config wrangler.jsonc
```

## Deploy To Staging

Standard staging flow:

```bash
npm run db:migrate:staging
npm run quality:gate:staging
npm run deploy:staging
npm run smoke:staging
```

If staging needs venue seed data:

```bash
npm run db:seed:staging
```

If you intentionally want full demo content in staging:

```bash
npm run db:seed:staging:demo
```

## Production Setup

Before first production deploy:

- make sure the production D1 database ID is correct in [wrangler.jsonc](/Users/jbot/IdeaProjects/melon-meet/wrangler.jsonc)
- configure production secrets:
  - `RESEND_API_KEY`
  - `TURNSTILE_SECRET_KEY`
  - `ALERT_WEBHOOK_URL` if used
- configure production vars such as `TURNSTILE_SITE_KEY`

Example secret commands:

```bash
npx wrangler secret put RESEND_API_KEY --config wrangler.jsonc
npx wrangler secret put TURNSTILE_SECRET_KEY --config wrangler.jsonc
npx wrangler secret put ALERT_WEBHOOK_URL --config wrangler.jsonc
```

## Deploy To Production

Recommended production flow:

```bash
npm run quality:gate:production
npm run db:migrate:remote
npm run db:seed:remote
npm run deploy
npm run smoke:production
```

Notes:

- `npm run db:seed:remote` is production-safe venue-only seed data
- do not run `npm run db:seed:remote:demo` in real production unless you intentionally want demo content
- if the release has no DB changes, you may skip `npm run db:migrate:remote`
- if the release does not need venue updates, you may skip `npm run db:seed:remote`

## Smoke Test Env Vars

If you want authenticated deployed smoke checks, set:

```bash
export SMOKE_EMAIL_STAGING="..."
export SMOKE_PASSWORD_STAGING="..."
export SMOKE_EMAIL_PRODUCTION="..."
export SMOKE_PASSWORD_PRODUCTION="..."
```

Base URLs can also be configured if needed:

```bash
export SMOKE_BASE_URL_STAGING="https://..."
export SMOKE_BASE_URL_PRODUCTION="https://..."
```

## Rollback Commands

Inspect recent Worker versions:

```bash
npx wrangler versions list --config wrangler.jsonc
npx wrangler deployments list --config wrangler.jsonc
```

Rollback production to previous version:

```bash
npx wrangler rollback --config wrangler.jsonc --message "Rollback production to previous stable version"
```

Rollback production to a chosen version:

```bash
npx wrangler rollback <VERSION_ID> --config wrangler.jsonc --message "Rollback production to known good version"
```

Staging rollback:

```bash
npx wrangler versions list --env staging --config wrangler.jsonc
npx wrangler deployments list --env staging --config wrangler.jsonc
npx wrangler rollback --env staging --config wrangler.jsonc --message "Rollback staging"
```

## Handy One-Liners

Start local app after pulling latest code:

```bash
npm install
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Standard staging release:

```bash
npm run db:migrate:staging
npm run quality:gate:staging
npm run deploy:staging
npm run smoke:staging
```

Standard production release:

```bash
npm run quality:gate:production
npm run db:migrate:remote
npm run deploy
npm run smoke:production
```
