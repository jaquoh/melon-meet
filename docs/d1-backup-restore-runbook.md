# Melon Meet D1 Backup and Restore Runbook

Last updated: 2026-05-11

Purpose: define the production backup, export, and restore process for the Cloudflare D1 database used by Melon Meet.

Scope:

- production D1 only
- operator runbook, not app code
- covers both short-term recovery and longer-term archive expectations

## Current Cloudflare Model

As of 2026-05-11, Cloudflare D1 uses two different recovery models depending on the database storage subsystem:

- modern D1 databases use **Time Travel** for point-in-time restore
- legacy `alpha` D1 databases use **snapshot backups**

Melon Meet should treat **Time Travel as the primary restore path** unless `wrangler d1 info` shows `version: alpha`.

## Required Checks

Before launch, verify which D1 storage model production uses:

```bash
npx wrangler d1 info DB --config wrangler.jsonc
```

What to look for:

- if the output shows a modern storage version, use the **Time Travel** procedure below
- if the output shows `version: alpha`, use the **legacy snapshot** procedure below and plan to migrate away from that setup

## Recovery Targets

Melon Meet should use this practical recovery model:

- short-term operational recovery: Cloudflare D1 Time Travel
- medium-term operator export: manual SQL export after important releases or risky schema changes
- long-term retention beyond D1 Time Travel window: not yet automated in this repo

## Retention Policy

Until a longer-term archival workflow exists, the agreed baseline is:

- rely on Cloudflare D1 Time Travel for the platform retention window
- on Workers Paid, Time Travel supports restore up to 30 days in the past
- on Workers Free, Time Travel supports restore up to 7 days in the past
- keep a manual SQL export before risky production operations such as irreversible schema or content changes

Melon Meet production should be treated as requiring the **30-day Time Travel window**, which implies using a paid Workers setup before broad launch.

## Standard Backup Procedure

There is no manual “backup now” step for modern D1 Time Travel. Instead:

1. Confirm the database is healthy.
2. Export a SQL snapshot before risky production changes.
3. Store that export outside the local machine used to create it.

Recommended pre-change export command:

```bash
npx wrangler d1 export DB --remote --output=./backups/d1-$(date +%Y%m%d-%H%M%S).sql --config wrangler.jsonc
```

Operator notes:

- exports block other database requests while running, so do them during low-traffic periods
- exports are operational safety copies, not the primary restore path
- do not commit production exports into Git

## Standard Restore Procedure: Modern D1

Use this when production is on the current D1 storage subsystem.

### Step 1: Pause and assess

Before restoring:

1. Stop any active deploy or migration work.
2. Identify the incident type:
   - bad migration
   - destructive write/query
   - corrupted or unintended app behavior
3. Decide the target restore time as precisely as possible.

### Step 2: Capture current state references

Record the current bookmark before restoring:

```bash
npx wrangler d1 time-travel info DB --config wrangler.jsonc
```

Save:

- current bookmark
- incident timestamp
- intended restore target timestamp

This matters because Cloudflare documents that a restore can be undone by restoring back to the prior bookmark.

### Step 3: Restore to the chosen point in time

Preferred restore form:

```bash
npx wrangler d1 time-travel restore DB --timestamp=2026-05-11T13:45:00Z --config wrangler.jsonc
```

If you already have an exact bookmark:

```bash
npx wrangler d1 time-travel restore DB --bookmark=<bookmark> --config wrangler.jsonc
```

### Step 4: Validate immediately after restore

Run:

```bash
npx wrangler d1 execute DB --remote --command "SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name;" --config wrangler.jsonc
```

Then perform product smoke checks:

- production `/api/health`
- login
- sign up
- list groups
- list meetings
- one write flow only if safe

### Step 5: Record the incident

Document:

- who ran the restore
- when it happened
- which timestamp or bookmark was used
- why the restore was needed
- what validation was performed

## Standard Restore Procedure: Legacy Alpha D1

Use this only if `wrangler d1 info` shows `version: alpha`.

List backups:

```bash
npx wrangler d1 backup list DB --config wrangler.jsonc
```

Optional local download:

```bash
npx wrangler d1 backup download DB <backup-id> --config wrangler.jsonc
```

Restore:

```bash
npx wrangler d1 backup restore DB <backup-id> --config wrangler.jsonc
```

Important:

- legacy restore overwrites the live database in place
- tables or rows missing from the selected backup will be lost from the restored live state
- this is not the preferred long-term setup for Melon Meet

## Import / Rebuild Procedure from SQL Export

This is the fallback path when you must rebuild from an exported SQL file instead of using Time Travel.

Notes:

- D1 imports SQL, not raw `.sqlite3` files
- restoring from SQL is slower and more manual than Time Travel
- use this mainly for controlled rebuilds, testing, or longer-term archive recovery

Command pattern:

```bash
npx wrangler d1 execute DB --remote --file=./backups/<export-file>.sql --config wrangler.jsonc
```

This should be treated as a deliberate maintenance operation, not the default emergency restore path.

## When to Use Which Recovery Path

- accidental bad write within the retention window: use **Time Travel**
- bad migration within the retention window: use **Time Travel**
- need a portable copy for analysis or archive: use **SQL export**
- database is still on alpha storage: use **legacy backup commands**

## Before Broad Public Launch

Minimum operational standard:

1. Verify production is on the modern D1 storage subsystem.
2. Confirm operators can run `time-travel info` and `time-travel restore`.
3. Perform one non-production restore drill and record the result.
4. Decide where manual SQL exports are stored and who has access.

## Sources

- Cloudflare D1 Time Travel: https://developers.cloudflare.com/d1/reference/time-travel/
- Cloudflare D1 Wrangler commands: https://developers.cloudflare.com/d1/wrangler-commands/
- Cloudflare D1 import/export: https://developers.cloudflare.com/d1/best-practices/import-export-data/
- Cloudflare legacy D1 backups: https://developers.cloudflare.com/d1/reference/backups/
- Cloudflare example for exporting D1 to R2 with Workflows: https://developers.cloudflare.com/workflows/examples/backup-d1/
