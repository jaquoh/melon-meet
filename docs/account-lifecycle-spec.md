# Melon Meet Account Lifecycle Spec

Last updated: 2026-05-09

Purpose: define how a user account is created, verified, recovered, changed, suspended, and deleted so implementation stays consistent across backend, frontend, legal copy, and support.

Status: working product decision document for first public launch.

## Scope

This spec covers:

- signup
- email verification
- login
- password reset
- password change
- email change
- session revocation
- account suspension
- account deletion

This spec does not cover:

- moderation queue UX details
- analytics
- advanced trust/reputation systems

## Core Principles

- Email is the primary account identifier.
- An account should not become fully usable before the email address is verified.
- Users must be able to recover access without manual support in normal cases.
- Sensitive account actions must revoke older sessions when appropriate.
- Deletion behavior must match public policy text exactly.
- Public launch should prefer simple, predictable flows over feature-rich account management.

## Account States

Use these states for the first public launch:

### 1. Pending Verification

Meaning:

- account record exists
- email is not yet verified
- user may have a session
- account cannot use community write actions

Allowed:

- verify email
- request a new verification email
- log in
- log out
- delete account
- request password reset

Blocked:

- create group
- create session
- join group
- accept invite
- post
- send friend request
- claim session spot
- edit public-facing profile beyond minimal onboarding if we decide to allow that

### 2. Active

Meaning:

- email is verified
- account is in good standing
- normal product access is allowed

Allowed:

- full product access based on role and visibility rules

### 3. Suspended

Meaning:

- account is blocked by operator action
- login may be blocked, or existing sessions revoked
- content handling follows moderation policy

Allowed:

- log in only if we intentionally want a “suspended” notice screen
- otherwise no normal product actions

Launch decision:

- for v1, suspend accounts by revoking all sessions and blocking new logins

### 4. Deletion Pending

Meaning:

- user requested account deletion
- account is immediately inaccessible
- grace/retention timer is running

Allowed:

- no normal access
- support/manual restoration only if we later choose to offer it

Launch decision:

- do not offer self-service restore during the pending-deletion window

### 5. Deleted / Anonymized

Meaning:

- account is no longer usable
- personal identifiers are removed or anonymized according to retention rules

## Canonical Lifecycle

### Signup

Flow:

1. user submits email + password
2. system creates account in `Pending Verification`
3. system creates verification token
4. system sends verification email
5. system may create a limited session
6. UI shows “verify your email to continue”

Rules:

- email must be unique
- email is normalized to lowercase
- password must meet current minimum policy
- signup should be rate-limited and bot-protected

### Email Verification

Flow:

1. user opens verification link
2. token is checked for validity, age, and single use
3. account moves from `Pending Verification` to `Active`
4. all required onboarding gates are cleared

Rules:

- verification tokens must expire
- verification tokens must be single use
- resend flow must exist
- only the newest token needs to be valid if that simplifies implementation

### Login

Flow:

1. user submits email + password
2. credentials are checked
3. account state is checked
4. session is created only if login is allowed

Rules by state:

- `Pending Verification`: allow login, but limit access and push user to verify
- `Active`: allow normal login
- `Suspended`: deny login
- `Deletion Pending`: deny login
- `Deleted / Anonymized`: deny login

### Password Reset

Flow:

1. user enters email on forgot-password screen
2. system always responds with a neutral success message
3. if account exists and is eligible, send reset email
4. user opens reset link
5. user sets new password
6. existing sessions are revoked
7. user is redirected to login or signed in freshly

Rules:

- reset tokens must be single use
- reset tokens must expire quickly
- request endpoint must not reveal whether an email exists
- password reset should revoke all prior sessions

### Password Change

Flow:

1. logged-in user enters current password
2. user enters new password
3. system verifies current password
4. system stores new password hash
5. system revokes other sessions

Launch decision:

- keep current session alive
- revoke all other sessions

### Email Change

Flow:

1. logged-in user enters new email and current password
2. system creates pending email change
3. system sends verification link to new email
4. user verifies new email
5. account email is updated
6. all other sessions are revoked

Rules:

- new email must be unique
- old email remains active until new email is verified
- user should get a notification on the old email about the change

### Session Management

Minimum launch behavior:

- every successful login creates a new session
- user can log out current session
- password reset revokes all sessions
- account deletion revokes all sessions
- suspension revokes all sessions
- email change completion revokes all other sessions
- password change revokes all other sessions

Preferred launch UX:

- show a simple “log out other devices” action in account settings

### Account Suspension

Flow:

1. operator suspends account
2. all active sessions are revoked
3. future logins are blocked
4. user sees a generic support path if they try to log in

Rules:

- suspension reason should be stored internally
- whether user-generated content stays visible is a moderation decision, not an auth decision

### Account Deletion

Launch model:

- user-initiated deletion moves account to `Deletion Pending` immediately
- all sessions are revoked immediately
- account becomes inaccessible immediately
- personal data is purged or anonymized within 30 days

Why this model:

- it matches the current privacy wording direction better than instant hard-delete
- it gives room for operational cleanup
- it reduces risk of partial/orphaned cleanup across related tables

Required policy decision:

- profile and auth identity should be removed
- authored community content should either be deleted or anonymized consistently

Recommended launch rule:

- delete authentication and profile identifiers
- anonymize authored posts where keeping thread continuity matters
- remove private memberships and claims tied to the user
- delete groups, sessions, and invite links still owned by the account when the retention window completes

## Token Types Needed

For launch, support these token classes:

- email verification token
- password reset token
- email change verification token

Rules for all:

- hashed at rest if practical
- single use
- expiry timestamp
- created-at timestamp
- linked to user id

## Minimum UI Surfaces Needed

- signup success / verify-email screen
- resend verification action
- forgot-password screen
- reset-password screen
- account settings screen
- change-password form
- change-email form
- delete-account confirmation flow
- suspended-account message

## Minimum Backend Flags / Data We Need

At a product level, the system needs to know:

- whether email is verified
- current account state
- when deletion was requested
- when account was deleted/anonymized
- whether a suspension is active

Implementation shape can vary, but these concepts must exist.

## Public Policy Alignment

The legal pages and support copy must match these decisions:

- unverified accounts are limited until email verification
- password resets revoke old sessions
- suspended accounts cannot use the service
- deletion removes access immediately
- deletion/anonymization completes within the published retention window

## Decisions Locked For Now

- Email is the primary identity key.
- Public accounts require email verification.
- Unverified users may log in, but cannot use normal participation features.
- Password reset must not reveal account existence.
- Password reset revokes all sessions.
- Password change keeps the current session and revokes other sessions.
- Email change requires verification of the new email before switching.
- Account deletion is immediate loss of access plus delayed purge/anonymization.
- Suspended accounts are blocked from login in v1.

## Open Questions

These do not block the spec, but should be answered before implementation reaches those points:

- Should unverified users be allowed to edit profile basics before verification?
- Should we keep anonymized placeholder names for deleted users’ past posts?
- Should we offer a short manual recovery window for deletion-pending accounts?
- Should suspicious logins trigger email notifications in v1 or later?
