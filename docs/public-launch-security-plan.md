# Melon Meet Public Launch Security and Readiness Plan

Last updated: 2026-05-09

Purpose: turn the current private-beta style app into something safe enough to publish publicly, with real account creation, real group/session management, and a clear path to operate it responsibly.

Important note: this is a product/security/operations plan based on the current codebase. It is not legal advice. Before broad public launch, legal copy and GDPR posture should be reviewed by a qualified lawyer for Germany/EU.

## Current State Snapshot

What already exists in the app today:

- Email/password signup and login exist.
- Passwords are hashed with PBKDF2 and sessions use `HttpOnly`, `Secure`, `SameSite=Lax` cookies.
- Basic auth rate limiting exists for signup and login.
- Basic security headers exist: `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy`.
- Public/private groups, invite links, sessions, claims, and profile visibility already exist.
- Privacy, terms, and impressum pages exist in the UI.

What is clearly not public-launch ready yet:

- No email verification, password reset, password change, email change, or session management.
- No reporting/moderation/admin tooling.
- No general abuse protection beyond auth rate limiting.
- No monitoring, alerting, audit trail, backup/restore process, or incident response process.
- Legal copy is still placeholder-level and does not fully match current product behavior.
- Account deletion and data retention behavior are not aligned with the privacy text.
- External image and messenger URLs are user-controlled with little trust/safety control.
- There is no staged deployment/security review workflow documented for production.

## Priority 0: Must Fix Before Public Signup

- [ ] Add email verification before an account becomes fully active.
  Why: prevents throwaway/fake accounts, reduces abuse, and is required for reliable account recovery.

- [ ] Add forgot-password and secure password reset by email with single-use, short-lived tokens.
  Why: public users will get locked out quickly without this.

- [ ] Add change-password flow for logged-in users.
  Why: public launch without password rotation is not acceptable.

- [ ] Add change-email flow with verification of the new address.
  Why: email is the account identifier and must be manageable safely.

- [ ] Add account deletion that matches the privacy policy.
  Required behavior:
  - soft-delete first
  - revoke all active sessions immediately
  - define what is deleted vs anonymized
  - document retention window
  Why: current code hard-deletes immediately while the privacy page says deletion/anonymization happens within 30 days.

- [ ] Add per-route abuse protection beyond login/signup.
  Minimum coverage:
  - group creation
  - meeting creation/editing
  - posts/comments
  - membership requests
  - invite-link creation
  - friend requests
  Why: otherwise the app is easy to spam once someone has one account.

- [ ] Add CSRF protection or strict origin checking for all state-changing authenticated requests.
  Minimum acceptable options:
  - CSRF token pattern, or
  - server-side `Origin` / `Referer` validation for same-site writes
  Why: `SameSite=Lax` helps, but explicit request-origin validation is still the safer public setup.

- [x] Add bot/spam defense to signup.
  Recommended:
  - Turnstile or equivalent challenge after suspicious activity
  - tighter IP/device/email heuristics
  Why: public signup will get scripted abuse.

- [ ] Remove demo account messaging and all public demo credentials from production UX.
  Why: it undermines trust and invites accidental misuse in a live environment.

- [ ] Replace placeholder legal and support details everywhere.
  Must include:
  - real support email
  - real controller/contact details
  - final impressum
  - final privacy contact path
  Why: public EU launch without this is not acceptable.

## Priority 1: Security Hardening Before Broad Announcement

- [x] Add production logging, error monitoring, and alerting.
  Minimum:
  - Worker exceptions
  - failed auth spikes
  - suspicious signup volume
  - D1 errors
  - deploy failures
  Suggested tools: Sentry, Cloudflare logs, uptime monitoring, alert routing.

- [x] Create a production backup and restore plan for D1.
  Must define:
  - backup frequency
  - retention
  - restore test owner
  - restore drill cadence
  Why: without restore confidence, user trust is fragile.

- [ ] Introduce environment separation and release discipline.
  Required:
  - local / staging / production separation
  - separate D1 databases
  - staging deploy before prod
  - documented rollback procedure
  - production-only config review before each deploy

- [x] Review and tighten all user-supplied URL fields.
  Current risky fields:
  - profile avatar URL
  - group hero image URL
  - meeting hero image URL
  - messenger URL
  Risks:
  - tracking pixels
  - malicious redirects
  - phishing
  - browser privacy leaks
  Actions:
  - allow only `https`
  - block dangerous schemes
  - optionally proxy images through controlled storage
  - add URL validation and normalization

- [x] Add content length, posting frequency, and duplicate-content controls.
  Why: this reduces spam and low-effort abuse even from verified accounts.

- [ ] Add moderation/reporting for profiles, groups, sessions, posts, and private-group invite abuse.
  Minimum workflow:
  - report action in UI
  - admin queue
  - status tracking
  - hide/suspend/remove actions
  - user notice templates

- [ ] Add admin/operator capabilities.
  Minimum:
  - suspend user
  - disable group
  - cancel/remove session
  - revoke invite links
  - remove posts
  - review abuse history

- [ ] Add audit logging for sensitive actions.
  Track:
  - signup
  - login failures
  - password reset
  - email change
  - account deletion
  - role changes
  - invite-link creation
  - moderation actions
  Why: this matters for both security and dispute handling.

- [ ] Review authorization edge cases with dedicated tests.
  Focus on:
  - private-group access
  - role escalation
  - session edit/delete permissions
  - invite-link acceptance
  - archived group/session behavior

- [ ] Add stronger security headers.
  Add or evaluate:
  - `Content-Security-Policy`
  - `Strict-Transport-Security`
  - tighter `Permissions-Policy`
  - `Cross-Origin-Resource-Policy` where appropriate

## Priority 2: Trust, Privacy, and Compliance Work

- [ ] Make the privacy policy match actual system behavior exactly.
  Fix mismatches around:
  - deletion timing
  - logged metadata
  - analytics usage
  - third-party processors
  - retention periods

- [ ] Add versioned acceptance tracking for Terms and Privacy.
  Store:
  - accepted policy version
  - timestamp
  - account id
  Why: public services should be able to prove which policy version was accepted.

- [ ] Add a clear age policy and enforce it in signup if you keep the 16+ rule.
  Why: the terms mention age 16+, but the product does not enforce or record it.

- [ ] Document all processors/subprocessors and data flows.
  At minimum review:
  - Cloudflare Workers
  - Cloudflare D1
  - email provider
  - analytics provider
  - monitoring provider
  - image hosting if added

- [ ] Put a data subject request process in place.
  Support:
  - data access request
  - correction request
  - deletion request
  - objection request
  - export request
  Also define response SLA and owner.

- [ ] Add a simple user data export.
  Include:
  - profile
  - memberships
  - sessions created
  - claims
  - posts
  Why: it helps both GDPR posture and trust.

- [ ] Decide cookie/consent requirements before adding analytics.
  Rule:
  - strictly necessary auth/session cookies do not mean full CMP by default
  - non-essential analytics/marketing tools likely do
  Do not add tracking scripts casually.

- [ ] Add a real safety disclaimer in the product flow, not only buried in the terms.
  Good places:
  - account signup
  - session creation
  - session join/claim confirmation
  Cover:
  - participation at own risk
  - no guarantee of organiser identity or skill level
  - users arrange their own insurance, transport, and safety decisions

## Priority 3: Account and Session Management UX

- [ ] Build a proper account settings area.
  Include:
  - change email
  - change password
  - verified-email state
  - delete account
  - privacy controls
  - export data
  - active sessions / log out other devices

- [ ] Add email-based notifications for critical account events.
  Minimum:
  - verify email
  - password reset
  - email change confirmation
  - suspicious login or password change

- [ ] Add clear public/private visibility explanations in the UI.
  Important surfaces:
  - profile settings
  - group creation/edit
  - session creation/edit
  - invite links
  Why: users should not accidentally expose themselves or their group activity.

- [ ] Add destructive-action confirmations with explicit consequences.
  Needed for:
  - deleting account
  - deleting group
  - archiving/cancelling session
  - changing visibility from private to public

- [ ] Improve invite-link UX and controls.
  Add:
  - expiry dates
  - manual revoke
  - one-time or limited-use links
  - visibility into who joined via which link

- [ ] Add abuse-resistant onboarding copy.
  Make clear:
  - who can see what
  - what is public by default
  - what happens after signup
  - where to get help

## Priority 4: Deployment and Operations

- [ ] Create a production runbook.
  Include:
  - deploy steps
  - migration steps
  - rollback
  - incident contact
  - outage message process
  - abuse escalation process

- [ ] Add CI gates before deploy.
  Minimum:
  - typecheck
  - tests
  - build
  - migration validation
  - lint if added

- [ ] Add smoke tests for the critical user journeys in a deployed environment.
  Cover:
  - signup
  - verify email
  - login
  - create group
  - create session
  - join public group
  - request private-group access
  - claim/unclaim spot
  - delete account

- [ ] Add uptime monitoring and public status handling.
  At minimum:
  - health endpoint monitor
  - alert destination
  - maintenance/outage copy

- [ ] Review secrets and configuration handling.
  Even if production is simple today:
  - keep provider/API secrets out of repo
  - document required env vars
  - rotate credentials on a schedule

- [ ] Decide whether production should allow public venue edits immediately.
  If yes:
  - add moderation
  - version history
  - review queue
  If no:
  - keep venue curation operator-only at launch

## Priority 5: Product Trust and Safety Improvements Soon After Launch

- [ ] Add block/mute features between users.

- [ ] Add no-show / harassment / unsafe-behavior reporting categories.

- [ ] Add organiser reputation and trust signals carefully.
  Example:
  - profile completeness
  - verified email badge
  - account age
  - participation history
  Avoid public shaming mechanics.

- [ ] Add clearer session safety fields where relevant.
  Example:
  - skill expectation
  - bring-your-own-ball
  - paid booking details
  - exact meetup point
  - cancellation policy

- [ ] Add operator-facing metrics for launch health.
  Track:
  - signup conversion
  - verification rate
  - weekly active users
  - group creation
  - session creation
  - abuse reports
  - support volume

## Suggested Execution Order for the Next Days

- [ ] Day 1: finalize legal contact details, remove demo messaging, define public-launch scope, freeze new non-essential features.
- [ ] Day 1: decide email provider, verification flow, password reset flow, and account deletion model.
- [ ] Day 2: implement email verification, password reset, change password, change email, and session revocation.
- [ ] Day 2: add route-level rate limits, origin/CSRF protection, and signup bot defense.
- [ ] Day 3: add monitoring, alerts, backups, restore test, and production runbook.
- [ ] Day 3: add moderation/reporting primitives and minimal admin tools.
- [ ] Day 4: align privacy/terms with real behavior and add versioned consent tracking.
- [ ] Day 4: ship account settings UX, destructive-action confirmations, and visibility explanations.
- [ ] Day 5: run staging smoke tests, fix edge cases, then do a small invite-only beta before broad public announcement.

## Launch Decision Gate

Do not broadly announce the app until all of these are true:

- [ ] users can recover access without manual intervention
- [ ] abuse can be slowed, reported, and acted on
- [ ] production errors are visible to operators quickly
- [ ] legal pages are real and accurate
- [ ] deletion/retention behavior matches policy
- [ ] backups and rollback are tested
- [ ] staging and production critical flows have been smoke-tested
- [ ] there is a support contact users can actually reach
