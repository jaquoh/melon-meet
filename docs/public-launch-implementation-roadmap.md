# Melon Meet Public Launch Implementation Roadmap

Last updated: 2026-05-09

Purpose: convert the public launch checklist into a focused execution plan that we can work through over multiple sessions without losing direction.

How to use this file:

- Treat each phase as a focus block.
- Do not start later phases before the current one is in a reasonably good state.
- Only split a checkbox into smaller tasks when we actively start implementing it.
- When something is done, check it off here and update the more detailed checklist if needed.

Related file:

- [public-launch-security-plan.md](/Users/jbot/IdeaProjects/melon-meet/docs/public-launch-security-plan.md)

## Working Rules

- One phase at a time.
- Finish the account/security foundation before moderation polish.
- Prefer small complete slices over half-built systems.
- If a task grows too big, split it into 3-5 sub-items max.
- Keep this roadmap stable; use session notes or PR descriptions for temporary details.

## Phase 1: Secure Accounts Foundation

Goal: users can safely create, recover, and control their accounts.

Done means:

- signup is not fully usable until email is verified
- users can reset password
- users can change password
- users can change email safely
- users can delete their account in a defined, policy-aligned way
- active sessions can be revoked when needed

Checklist:

- [x] Decide and document the account lifecycle.
- [x] Add email verification.
- [x] Add forgot-password and reset-password flow.
- [x] Add change-password flow.
- [x] Add change-email flow with verification.
- [x] Add account deletion flow and final deletion/anonymization rules.
- [x] Add session management basics.
- [x] Remove production demo-account exposure.

## Phase 2: Abuse and Request Protection

Goal: the app is harder to spam, script, or misuse.

Done means:

- high-risk write actions are rate-limited
- authenticated write requests are protected against cross-site abuse
- signup has bot resistance
- spammy user content is meaningfully constrained

Checklist:

- [x] Add route-level rate limits for write actions.
- [x] Add CSRF protection or strict origin validation for authenticated writes.
- [x] Add signup bot defense.
- [x] Add basic anti-spam limits for posts, invites, and requests.
- [x] Tighten validation and trust rules for user-supplied URLs.

## Phase 3: Operations and Production Safety

Goal: production is observable, recoverable, and deployable with confidence.

Done means:

- errors and suspicious activity are visible quickly
- production data can be restored
- staging and production are clearly separated
- deploys have a repeatable, low-risk process

Checklist:

- [x] Add error monitoring and alerting.
- [x] Add operational/security logging.
- [ ] Define backup and restore process for D1.
- [ ] Test restore once and document the result.
- [ ] Separate local, staging, and production environments clearly.
- [ ] Create a production deploy and rollback runbook.
- [ ] Add pre-deploy quality gates.
- [ ] Add production smoke tests for critical flows.

## Phase 4: Moderation and Admin Controls

Goal: we can respond when users abuse the platform or create unsafe situations.

Done means:

- users can report abusive content or behavior
- operators have a place to review reports
- operators can act on users, groups, sessions, posts, and invite misuse
- sensitive actions leave an audit trail

Checklist:

- [ ] Define the minimum moderation model.
- [ ] Add report actions in the UI.
- [ ] Add a report review queue for operators.
- [ ] Add admin actions for users, groups, sessions, posts, and invite links.
- [ ] Add audit logging for sensitive actions.
- [ ] Add dedicated authorization tests for moderation/admin paths.

## Phase 5: Legal, Privacy, and Compliance Alignment

Goal: the public-facing promises match actual product behavior.

Done means:

- legal pages contain real operator information
- privacy policy matches the real system
- policy acceptance is trackable
- core GDPR-style requests have an internal handling process

Checklist:

- [ ] Replace placeholder support and legal details.
- [ ] Align privacy policy with actual data handling.
- [ ] Align terms with real product behavior and safety positioning.
- [ ] Add versioned acceptance tracking for terms and privacy.
- [ ] Define the retention and deletion schedule.
- [ ] Define the user data request process.
- [ ] Document processors/subprocessors.
- [ ] Decide analytics/cookie consent approach before adding analytics.

## Phase 6: User Trust and Settings UX

Goal: users understand what is public, how their account works, and where to get help.

Done means:

- users have a clear settings area
- privacy and visibility choices are understandable
- destructive actions are confirmed clearly
- the product explains safety boundaries in the right places

Checklist:

- [ ] Build or finish the account settings area.
- [ ] Show verified-email state in the product.
- [ ] Add clear privacy and visibility explanations.
- [ ] Add destructive-action confirmations.
- [ ] Improve invite-link controls and clarity.
- [ ] Add in-product safety disclaimers where they matter.
- [ ] Add support/help contact visibility in the UI.

## Phase 7: Launch Readiness and Controlled Rollout

Goal: launch carefully, observe behavior, and expand only after the basics hold up.

Done means:

- critical flows work in staging and production
- launch owners know how to respond to issues
- the first release is controlled, not a blind broad announcement

Checklist:

- [ ] Run end-to-end smoke tests in staging.
- [ ] Run end-to-end smoke tests in production.
- [ ] Fix blockers found in smoke testing.
- [ ] Launch first to a small invite-only cohort.
- [ ] Review support load, abuse rate, and failure rate.
- [ ] Decide if the app is ready for a broader public announcement.

## Current Focus

Use this section to keep the team aligned between sessions.

Current phase:

- [ ] Phase 2: Abuse and Request Protection

Current session target:

- [x] Add operational/security logging.

Blocked by:

- [ ] Choose email provider and delivery approach.
- [ ] Choose deletion model: immediate anonymization vs delayed purge window.
- [ ] Choose CSRF strategy: token-based vs strict origin validation.

## Not In Scope For First Public Launch

These may be valuable, but they should not distract from launch safety:

- [ ] advanced reputation systems
- [ ] social growth mechanics
- [ ] deep analytics dashboards
- [ ] large-scale venue contribution workflows
- [ ] complex trust scoring
- [ ] major design refreshes unrelated to safety, trust, or launch readiness
