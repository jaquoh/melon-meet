# Melon Meet Public Launch Punch List

Last updated: 2026-07-15

Purpose: keep the next launch steps short, current, and execution-focused.

How to use this file:

- Treat this as the operator punch list, not the full strategy.
- Only keep items here that still block the first public beta or the first broadened rollout decision.
- When an item is finished, update the deeper source docs if they need to stay aligned.

Related files:

- [public-launch-implementation-roadmap.md](/Users/jbot/IdeaProjects/melon-meet/docs/public-launch-implementation-roadmap.md)
- [go-live-checklist.md](/Users/jbot/IdeaProjects/melon-meet/docs/go-live-checklist.md)
- [public-launch-security-plan.md](/Users/jbot/IdeaProjects/melon-meet/docs/public-launch-security-plan.md)

## Current Status

- Foundation work is largely in place: accounts, abuse protection, ops safety, moderation tooling, audit logging, policy acceptance tracking, staging/prod quality gates, and deployed smoke scripts.
- The remaining work is mostly legal/compliance completion, user-trust UX, and actual rollout execution.
- The first public beta should be treated as an invite-only launch until staging and production smoke checks are complete and support/moderation ownership is clear.

## Launch-Blocking Punch List

### 1. Finalize legal and compliance operations

- [x] Lock the retention and deletion schedule that matches the account lifecycle and privacy copy.
- [x] Define the user data request process:
  - owner
  - intake path
  - response SLA
  - export/deletion handling steps
- [x] Document current processors/subprocessors and the data they handle.
- [x] Decide the analytics and cookie-consent approach before any non-essential tracking is added.
- [x] Enforce the 16+ eligibility rule in signup without introducing date-of-birth collection.

### 2. Finish the minimum launch trust UX

- [x] Build or finish the account settings surface for launch-critical account actions.
- [x] Show verified-email state clearly in-product.
- [x] Add destructive-action confirmations for account deletion and other high-risk actions.
  Current scope: account deletion flow
- [x] Add privacy and visibility explanations where users make public/private choices.
- [x] Make support/help contact paths visible in the signed-in product, not only the legal pages.
- [x] Add in-product safety and responsibility explanations where sign-up, joining, and hosting decisions happen.

### 3. Ship the minimum notification layer

- [x] Send admin alert emails for reported content.
- [x] Send the minimum user account/moderation emails:
  - account suspended
  - report received
  - report reviewed
- [ ] Send the minimum session/group lifecycle emails that reduce operational confusion during beta.
  Current scope live:
  - membership join request
  - member left group
  - new session added to group
  - new session series added to group
  - session changed
  - session cancelled
  - session pinboard update
  - session owner: spot claimed
  - session owner: session became full
  - session owner: spot released
  - group archived
- [x] Add account-level notification email switches for live optional notification categories.
  Current scope live:
  - moderation/account result emails
  - group membership request emails
  - group member leave emails
  - group archived emails
  - group new session emails
  - session changed emails
  - session cancelled emails
  - session pinboard update emails
  - session owner spot claim/full/release emails

### 4. Prepare the real launch environment

- [ ] Verify staging and production Cloudflare resources, Wrangler config, and required secrets.
- Current repo audit on 2026-07-15:
  - production and staging D1 IDs are present in `wrangler.jsonc`
  - production moderation allowlists are set
  - staging moderation allowlists are still empty
  - remote Wrangler commands still need working Cloudflare auth, such as `CLOUDFLARE_API_TOKEN` in non-interactive runs
- [ ] Configure moderation operator allowlists, support inbox ownership, and smoke-test credentials.
- [ ] Curate the initial venue/group/session dataset for the first cohort.
- [x] Decide whether any local/demo messaging still appears in production-facing copy and remove it if so.
  - app audit on 2026-07-15 found no public demo-account messaging left in production UX; only dev-conditional reset/verify shortcuts remained, and those labels were softened

### 5. Run the rollout sequence

- [ ] Run `npm run quality:gate:staging`.
- [ ] Run `npm run deploy:staging`.
- [ ] Run `npm run smoke:staging`.
- [ ] Fix staging blockers before touching production.
- [ ] Run the production deploy path and `npm run smoke:production`.
- [ ] Launch to a small invite-only cohort first.
- [ ] Review support load, abuse rate, and failure rate before any broader public announcement.

## Beyond First Public Beta

- [ ] Block/mute features between users.
- [ ] More detailed safety reporting categories.
- [ ] Safer invite-link controls such as expiry, limited-use, and join attribution.
- [ ] Better operator-facing launch health metrics.
- [ ] Data export UX if requests become frequent.
