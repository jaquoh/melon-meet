# Melon Meet User Data Request Process

Last updated: 2026-07-01

Purpose: define how Melon Meet handles user data requests for the first public beta without requiring a full support system or self-service export tooling.

Status: accepted launch operations rule for the first public beta.

How to use this file:

- Treat this as the source of truth for data-subject request intake and handling.
- Keep this aligned with the privacy page, launch docs, and any future support tooling.
- If the support inbox, owner, or response timings change, update this file and the public privacy copy together.

Related files:

- [retention-deletion-schedule.md](/Users/jbot/IdeaProjects/melon-meet/docs/retention-deletion-schedule.md)
- [legal-compliance-draft.md](/Users/jbot/IdeaProjects/melon-meet/docs/legal-compliance-draft.md)
- [public-launch-implementation-roadmap.md](/Users/jbot/IdeaProjects/melon-meet/docs/public-launch-implementation-roadmap.md)

## Scope

This process covers:

- access requests
- correction requests
- deletion requests made through support
- objection or restriction requests
- export requests

This process does not replace:

- the in-product self-service delete-account flow
- ordinary product-support questions that do not involve personal-data rights
- legal review for unusual or disputed cases

## Intake Path

- Primary intake inbox: `hello@melonmeet.com`
- Launch owner: Jacob Otto
- Backup owner for continuity during launch: any explicitly assigned operations/moderation admin with inbox access

Required intake rule:

- all privacy or data-rights requests received in any other channel should be forwarded into `hello@melonmeet.com` before handling continues

## Request Types We Support

- Access:
  - what personal data we hold
  - what categories and purposes apply
- Correction:
  - inaccurate account or profile information
- Deletion:
  - account erasure requests
  - follow the retention and deletion rules in [retention-deletion-schedule.md](/Users/jbot/IdeaProjects/melon-meet/docs/retention-deletion-schedule.md)
- Objection or restriction:
  - requests tied to disputed accuracy, moderation, or other processing concerns
- Export:
  - a portable copy of the requester’s core account and community data that is reasonably available in the current system

## Response Timing

- Acknowledge receipt within 5 business days.
- Provide a substantive response within 30 calendar days of a verified request.
- If the request is unusually complex, respond within the initial 30 days to explain the delay and extend by up to 60 additional calendar days where legally justified.

## Identity Verification Rule

- For requests sent from the email address already associated with the account, treat the request as provisionally verified unless there is a reason to doubt identity.
- For requests sent from a different address or with account-access uncertainty:
  - ask the requester to reply from the account email if possible, or
  - ask for enough information to identify the account safely without collecting unnecessary new data
- Do not disclose exported data or account-specific details until identity is reasonably verified.

## Handling Steps

### 1. Log the request

- Record:
  - request date
  - requester email
  - request type
  - verification status
  - owner
  - due date
  - resolution date
- For the first public beta, a simple operator-maintained log outside the repo is acceptable.

### 2. Classify the request

- Decide whether it is:
  - access
  - correction
  - deletion
  - objection/restriction
  - export
  - ordinary support rather than a data-rights request

### 3. Verify identity

- Apply the verification rule above before sharing account-specific data.

### 4. Execute the request

- Access:
  - prepare a plain-language summary of the categories, purposes, processors, and retention model
  - include account-specific data that is reasonably retrievable
- Correction:
  - if the user can fix it in-product, point them to the self-service path
  - if the issue cannot be self-served, correct it manually where appropriate
- Deletion:
  - if the user still has account access, prefer the in-product delete-account flow
  - if the user cannot access the account, perform the deletion flow manually after verification
  - explain the immediate loss of access and the 30-day deletion-pending window
- Objection/restriction:
  - review what processing is actually being challenged
  - escalate unusual, high-risk, or legally uncertain cases before responding definitively
- Export:
  - assemble a reasonable export of currently available core user data
  - for launch, a manual export is acceptable

### 5. Respond and close

- Send the result from `hello@melonmeet.com`.
- Note what was done, when it was completed, and any remaining limitation or follow-up.
- Update the request log with the resolution date and outcome.

## Launch-Era Export Scope

Until a self-service export exists, the minimum manual export should include what is reasonably retrievable for the verified user:

- account email and verification state
- profile fields
- group memberships and membership requests
- groups owned by the user
- sessions and session series owned by the user
- session claims
- friend connections
- posts authored by the user where reasonably retrievable

Launch limitation:

- the export may be assembled manually from current application data and database records
- no special machine-readable schema beyond a reasonable JSON or CSV bundle is required for the first public beta

## Deletion Request Rule

- Self-service account deletion inside the product remains the preferred path for users who can still sign in.
- Support-handled deletion is the fallback when the user cannot access the account or when the request arrives as a privacy-rights request.
- Support must not promise immediate irreversible erasure; the current model is immediate access removal plus a 30-day deletion-pending window.

## Escalation Rules

Escalate before completing the request if:

- identity cannot be verified safely
- the request concerns another person’s data
- the requester disputes moderation, suspension, or abuse findings in a way that may affect legal response wording
- the request may conflict with fraud prevention, abuse investigation, or legal-retention needs
- the request appears excessive, repetitive, or unclear

## Public-Facing Summary

The privacy page should continue to direct users to `hello@melonmeet.com` for data-rights requests.

The public promise for launch should stay simple:

- users can contact `hello@melonmeet.com` to exercise access, correction, deletion, objection, restriction, and portability rights where applicable
- requests are handled through a verified support process
- deletion requests follow the published 30-day deletion-pending model
