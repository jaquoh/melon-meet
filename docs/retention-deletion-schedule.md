# Melon Meet Retention and Deletion Schedule

Last updated: 2026-07-01

Purpose: define the concrete launch-era retention and deletion rules that operations, legal copy, and product behavior should follow.

Status: accepted launch operations rule for the first public beta.

How to use this file:

- Treat this as the source of truth for retention and deletion timing.
- Do not publish or promise narrower timelines elsewhere unless this file is updated too.
- If implementation changes, update this file, the public privacy copy, and the launch docs in the same change.

Related files:

- [account-lifecycle-spec.md](/Users/jbot/IdeaProjects/melon-meet/docs/account-lifecycle-spec.md)
- [legal-compliance-draft.md](/Users/jbot/IdeaProjects/melon-meet/docs/legal-compliance-draft.md)
- [public-launch-implementation-roadmap.md](/Users/jbot/IdeaProjects/melon-meet/docs/public-launch-implementation-roadmap.md)

## Core Rules

- Keep active account and community data only while the account remains active and the service needs that data to operate.
- Revoke access immediately when a deletion request, suspension, or credential-reset event requires it.
- Prefer immediate scrubbing of personal identifiers plus delayed final cleanup over instant hard-delete.
- Keep safety, moderation, and audit evidence long enough to investigate abuse and operate responsibly.

## Launch Retention Schedule

### Verification and recovery tokens

- Email verification tokens:
  - expire after 24 hours
  - become unusable immediately after successful use
  - are deleted immediately if the related account enters deletion-pending
- Email change tokens:
  - expire after 24 hours
  - become unusable immediately after successful use
  - are deleted immediately if the related account enters deletion-pending
- Password reset tokens:
  - expire after 1 hour
  - become unusable immediately after successful use
  - are deleted immediately if the related account enters deletion-pending

### Authentication sessions

- Each successful login creates a session with a maximum lifetime of 30 days.
- Sessions are revoked immediately on:
  - logout of the current session
  - log out other devices
  - password reset
  - account deletion request
  - account suspension
- Other sessions are revoked immediately on:
  - password change
  - email change completion

### Active account and profile data

- Account identity, profile, membership, group, session, claim, post, and related community records are retained while the account is active and the service still needs them.
- No additional fixed maximum account-age retention period is set for active users in the first public beta.

### Account deletion timeline

- At deletion request time:
  - revoke all sessions immediately
  - change the account state to `deletion-pending`
  - scrub login and profile identifiers from the user record
  - delete verification, reset, and email-change tokens
  - delete friend connections
  - delete meeting claims
  - delete membership requests created by the user
  - remove non-owner group memberships tied to the user
- During the deletion-pending window:
  - the account stays inaccessible
  - no self-service restore path is offered
  - the retention window lasts 30 days from `deletion_requested_at`
- At or after 30 days:
  - delete invite links created by the user
  - delete meetings and meeting series owned by the user
  - delete groups owned by the user
  - mark the user record as deleted with `deleted_at`
  - keep the already-scrubbed user row only as an anonymized tombstone for historical references and internal consistency unless a later migration removes the need for that pattern

### Public content after deletion request

- The launch rule is to remove direct account/profile identifiers immediately.
- Historical authored content that still references the scrubbed user record may remain only in anonymized form.
- Owned groups, owned sessions, and owned invite links are removed when the 30-day deletion window completes.

### Moderation, audit, and security records

- Moderation reports and moderation notes:
  - retain for 12 months after closure by default
  - retain longer if an active investigation, repeat-abuse pattern, or legal obligation requires it
- Audit log events for sensitive account/admin actions:
  - retain for 12 months from the event by default
  - retain longer if tied to an active incident or legal obligation
- Security-event and operational incident logs:
  - retain for 90 days by default in routine operations
  - preserve longer when needed for abuse investigation, incident response, or legal obligations

## Operational Review Rules

- Review this schedule before broad public announcement if analytics, new processors, or user data export are added.
- Re-review moderation, audit, and security retention periods after the first public-beta quarter using real support and abuse volume.
- If a legal hold or incident investigation applies, preserve affected records until the hold is cleared even if the default period has elapsed.

## Current Implementation Anchors

- Token TTLs and deletion-pending retention window are implemented in [apps/api/src/app.ts](/Users/jbot/IdeaProjects/melon-meet/apps/api/src/app.ts).
- Session lifetime and revocation behavior are implemented in [apps/api/src/lib/auth.ts](/Users/jbot/IdeaProjects/melon-meet/apps/api/src/lib/auth.ts).
- Final deletion-pending cleanup runs from the scheduled handler in [apps/api/src/index.ts](/Users/jbot/IdeaProjects/melon-meet/apps/api/src/index.ts).
