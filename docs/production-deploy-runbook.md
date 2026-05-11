# Melon Meet Production Deploy and Rollback Runbook

Last updated: 2026-05-11

Purpose: define the safest repeatable deploy and rollback procedure for the production Worker and D1 database.

Related docs:

- [environment-separation.md](/Users/jbot/IdeaProjects/melon-meet/docs/environment-separation.md)
- [d1-backup-restore-runbook.md](/Users/jbot/IdeaProjects/melon-meet/docs/d1-backup-restore-runbook.md)

## Core Rules

1. Deploy to staging before production.
2. Apply production D1 migrations before the production app deploy when the release includes schema changes.
3. Treat Worker rollback and D1 restore as separate actions.
4. Never assume rolling back the Worker also rolls back database state.

## Preconditions

Before a production deploy:

- staging environment exists and is usable
- production secrets are configured
- production D1 database ID is correct in [wrangler.jsonc](/Users/jbot/IdeaProjects/melon-meet/wrangler.jsonc)
- staging deploy has already been smoke-checked
- any risky DB change has a recent export or falls within D1 Time Travel recovery tolerance

## Standard Release Flow

### 1. Validate locally

Run:

```bash
npm run typecheck
npm test
npm run build
```

### 2. Deploy staging

Run:

```bash
npm run db:migrate:staging
npm run deploy:staging
```

If staging needs fresh venue data:

```bash
npm run db:seed:staging
```

### 3. Smoke-test staging

Minimum staging checks:

- `/api/health`
- sign up
- verify email
- login
- create group
- create meeting
- load map

Do not continue to production until staging looks healthy.

### 4. Prepare production release

If the release includes DB changes:

```bash
npm run db:migrate:remote
```

If production venue data must be refreshed:

```bash
npm run db:seed:remote
```

### 5. Deploy production Worker

Run:

```bash
npm run deploy
```

### 6. Smoke-test production

Minimum production checks:

- `/api/health`
- login
- map load
- groups list
- meetings list
- one safe authenticated write if appropriate

### 7. Record the release

Record:

- deploy time
- git commit or release identifier
- whether migrations were applied
- who deployed
- any follow-up monitoring notes

## Worker Rollback Procedure

Use this when:

- the newly deployed Worker code is broken
- the issue is in Worker code/config, not data
- the target previous Worker version is known good

### Inspect recent versions and deployments

List recent versions:

```bash
npx wrangler versions list --config wrangler.jsonc
```

List recent deployments:

```bash
npx wrangler deployments list --config wrangler.jsonc
```

### Roll back production

Fast path, roll back to the previous version:

```bash
npx wrangler rollback --config wrangler.jsonc --message "Rollback production to previous stable version"
```

Explicit path, roll back to a chosen version ID:

```bash
npx wrangler rollback <VERSION_ID> --config wrangler.jsonc --message "Rollback production to known good version"
```

### Validate after rollback

Check:

- `/api/health`
- core page loads
- auth flow
- any route touched by the broken release

## Staging Rollback Procedure

Use the same pattern against staging:

```bash
npx wrangler versions list --env staging --config wrangler.jsonc
npx wrangler deployments list --env staging --config wrangler.jsonc
npx wrangler rollback --env staging --config wrangler.jsonc --message "Rollback staging"
```

## Database Rollback Procedure

Use this when:

- a migration was wrong
- bad writes corrupted live data
- the app code rollback alone does not fix the incident

For D1 recovery, follow:

- [d1-backup-restore-runbook.md](/Users/jbot/IdeaProjects/melon-meet/docs/d1-backup-restore-runbook.md)

Important:

- Worker rollback does **not** restore old D1 contents
- D1 Time Travel or SQL restore must be run separately
- if both code and data are bad, handle the DB restore first or in a tightly coordinated order based on the incident

## Incident Decision Guide

- broken frontend/backend code after deploy, no data corruption: Worker rollback
- bad migration or destructive data issue: D1 restore process
- both code and data changed and are bad: coordinate Worker rollback plus D1 restore
- issue only visible in staging: rollback staging only

## Notes on Cloudflare Versions

As of 2026-05-11:

- `wrangler deploy` creates and deploys a new Worker version immediately
- `wrangler rollback` creates a new deployment that points traffic back to an older Worker version
- Wrangler can list recent versions with `wrangler versions list`
- Wrangler can list recent deployments with `wrangler deployments list`
- Worker versions do not include state changes for D1

## Before Broad Public Launch

Minimum standard:

1. Operators can deploy staging.
2. Operators can deploy production.
3. Operators can run `wrangler rollback`.
4. Operators know when to switch from Worker rollback to D1 restore.
5. This runbook is reviewed once after the first real staging release.

## Sources

- [Cloudflare Workers versions and deployments](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/)
- [Cloudflare Workers rollbacks](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/)
- [Wrangler Workers commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
