# Melon Meet Invite-Only Cohort Launch Runbook

Last updated: 2026-07-17

Purpose: run the first invite-only cohort launch with a short, practical checklist instead of relying on memory.

Related docs:

- [public-launch-punch-list.md](/Users/jbot/IdeaProjects/melon-meet/docs/public-launch-punch-list.md)
- [go-live-checklist.md](/Users/jbot/IdeaProjects/melon-meet/docs/go-live-checklist.md)
- [production-deploy-runbook.md](/Users/jbot/IdeaProjects/melon-meet/docs/production-deploy-runbook.md)
- [d1-backup-restore-runbook.md](/Users/jbot/IdeaProjects/melon-meet/docs/d1-backup-restore-runbook.md)

## Current Baseline

As of 2026-07-17:

- staging deploy works and passed anonymous plus authenticated smoke checks after the security-header release
- production deploy works and passed anonymous smoke checks after the security-header release
- production URL is `https://melon-meet.jacobspostfach.workers.dev`
- staging URL is `https://melon-meet-staging.jacobspostfach.workers.dev`
- private-group invite generation and acceptance are live
- moderation allowlists are configured in production and staging

Still open before a real cohort launch:

- configure Turnstile in staging and production so signup is available
- configure staging email delivery
- configure authenticated production smoke credentials
- confirm the support inbox owner and moderation owner rotation
- create the first real groups and sessions; production currently has 57 venues but no groups or scheduled meetings

## Cohort Definition

Keep the first cohort intentionally small.

Recommended starting shape:

- 10-30 invited users total
- 2-5 known organizers who will actually create or host sessions
- 1 clear owner for support and moderation during the first week
- 1 backup operator who can deploy or roll back if needed

Do not expand beyond the first cohort until the first review window is complete.

## Preflight Checklist

Complete these before sending any invite links:

- [ ] Confirm signup works with Turnstile and verification email delivery in staging, then production.
- [ ] Confirm production smoke credentials exist and run `npm run smoke:production` with authenticated checks.
- [ ] Confirm support inbox ownership is explicit:
  - owner name
  - inbox address
  - expected response window
- [ ] Confirm moderation owner rotation is explicit:
  - primary operator
  - backup operator
  - how reports will be checked during the first week
- [ ] Confirm the curated production dataset is acceptable for first users:
  - real venues look intentional
  - starter groups are the ones you want people to discover
  - no accidental demo or internal-only sessions are visible
- [ ] Confirm invite-only participants know this is a beta:
  - small launch
  - feedback is welcome
  - issues should be reported to the support path
- [ ] Confirm rollback readiness:
  - operator can run `wrangler rollback`
  - operator knows where the D1 restore runbook is

## Launch-Day Commands

Run or verify these before cohort invites go out:

```bash
npm run quality:gate:production
npm run smoke:production
```

If production content needs a final venue refresh:

```bash
npm run db:seed:remote
```

If a code change is still pending before launch:

```bash
npm run deploy
npm run smoke:production
```

## Invite Send Checklist

When the system is healthy, send invites in one small wave.

- [ ] Generate the first private-group invite links only for the groups you want in the cohort.
- [ ] Send those links to the selected users, not a broader list.
- [ ] Include a short beta message:
  - what Melon Meet is for
  - that the launch is invite-only
  - where to report issues
  - that email verification is required before participation
- [ ] Avoid sending all possible invites at once.

Recommended first wave:

- 5-10 people on day 1
- another 5-10 only after the first check-in window is calm

## First-Hour Monitoring

Check these in the first hour after invites go out:

- [ ] `GET /api/health` still returns `200`
- [ ] no new deploy-time errors are appearing in Worker logs
- [ ] no obvious auth failures or invite-accept failures are spiking
- [ ] at least one invite recipient can:
  - open the app
  - verify email
  - accept an invite
  - view the group
- [ ] moderation queue is reachable for the configured operator
- [ ] support path is receiving messages if a tester uses it

If anything breaks, pause the next invite wave before more people are added.

## First-Week Review

Do one short review after the first real cohort activity.

Review questions:

- Did invited users successfully sign up and verify email?
- Did invite links work without confusion?
- Were there support requests that point to unclear product copy?
- Were there abuse reports or moderation actions that exposed workflow gaps?
- Did any notification emails create confusion or fail to arrive?
- Are groups, sessions, and venues clean enough to show to a wider audience?

## Hold / Expand / Roll Back

Expand only if:

- no blocking auth or invite issues appeared
- support load stayed manageable
- moderation flow worked when needed
- no data-loss or account-safety issues appeared

Hold and investigate if:

- users are confused about verification, invites, or visibility
- support requests cluster around one broken flow
- staging or production smoke becomes flaky

Roll back or pause the cohort immediately if:

- production error rate jumps sharply
- invite acceptance fails for real users
- account or session data looks corrupted
- a security or moderation failure appears

## Rollback Path

For Worker-code rollback:

```bash
npx wrangler versions list --config wrangler.jsonc
npx wrangler deployments list --config wrangler.jsonc
npx wrangler rollback --config wrangler.jsonc --message "Rollback production after cohort launch issue"
```

For DB recovery:

- follow [d1-backup-restore-runbook.md](/Users/jbot/IdeaProjects/melon-meet/docs/d1-backup-restore-runbook.md)

Important:

- Worker rollback does not restore database state
- if the issue is data-related, do not treat rollback as sufficient

## Exit Criteria For Broader Launch

Do not broaden access until these are true:

- [ ] authenticated production smoke checks are passing
- [ ] support and moderation ownership feel sustainable
- [ ] first invite-only cohort completed without major incident
- [ ] no major trust, auth, or invite-flow blockers remain
- [ ] you have a clear yes/no decision on whether to expand
