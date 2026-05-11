# Melon Meet Minimum Moderation Model

Last updated: 2026-05-11

Purpose: define the minimum moderation and operator model needed before a broader public launch.

Scope:

- abusive or unsafe user behavior
- unsafe or policy-violating content
- invite abuse and spam
- operator actions and expectations

This is the minimum v1 model. It is intentionally small and operationally realistic.

## Goals

The moderation model should let Melon Meet:

- receive reports about unsafe behavior or content
- review those reports in one place
- take clear operator actions quickly
- keep a record of what action was taken and why
- avoid over-promising advanced trust/safety systems that do not exist yet

## What Can Be Reported

The minimum reportable object types are:

- user profile
- group
- meeting/session
- group post
- meeting post
- private-group invite abuse

“Invite abuse” covers cases such as:

- private invite links being shared publicly
- repeated spam invites
- an invite link being used to funnel users into unsafe or misleading groups

## Report Reasons

Use a small fixed set of reasons in v1:

- spam
- harassment or abusive behavior
- hate, threats, or violent content
- sexual or explicit content
- misleading, scam, or phishing behavior
- unsafe event or real-world safety concern
- impersonation
- underage or inappropriate participation concern
- other

Each report should allow:

- one structured reason
- an optional short free-text note

## Minimum Operator Roles

v1 only needs two operational roles:

- `support reviewer`
- `admin`

### Support reviewer

Can:

- read incoming reports
- change report status
- add internal notes
- escalate to admin

Cannot:

- suspend accounts
- remove posts
- disable groups
- revoke invite links

### Admin

Can do everything a support reviewer can, plus:

- suspend user accounts
- disable or archive groups
- cancel or archive meetings
- revoke invite links
- remove posts

## Report Lifecycle

Each report should move through this simple state model:

- `open`
- `triaged`
- `action_taken`
- `closed_no_action`

Optional internal metadata per report:

- created at
- reporter user id, if logged in
- target object type
- target object id
- selected reason
- reporter note
- internal notes
- assignee
- final resolution

## Enforcement Levels

Use the lightest effective action first unless the risk is high.

### Level 0: no action

Use when:

- report is unsupported
- content is allowed
- issue is already resolved

Outcome:

- report closed with explanation

### Level 1: content cleanup

Use when:

- one post is spammy or abusive
- one invite link is being misused
- one session/group entry needs to be disabled

Outcome examples:

- remove post
- revoke invite link
- cancel/archive session

### Level 2: container-level restriction

Use when:

- the group itself is abusive or scammy
- repeated problems come from the same group/session context

Outcome examples:

- archive/disable group
- cancel/archive multiple sessions from that group

### Level 3: account enforcement

Use when:

- user is a repeated spammer
- serious harassment or threat pattern exists
- scam/phishing behavior is confirmed
- account itself should no longer access the service

Outcome:

- set account to suspended
- revoke all sessions
- block future login

This already matches the account lifecycle rules documented in [account-lifecycle-spec.md](/Users/jbot/IdeaProjects/melon-meet/docs/account-lifecycle-spec.md).

## How Existing Product States Map to Moderation

### User suspension

Moderation meaning:

- account cannot log in
- all active sessions are revoked
- existing content handling is decided separately

v1 default:

- do not automatically hard-delete user-authored content on suspension
- review/remove specific posts or groups separately when needed

### Group disablement

Current product-fit action:

- archive the group

Practical effect:

- group stops behaving like an active public object
- related moderation follow-up can include revoking invite links and canceling active sessions

### Session disablement

Current product-fit action:

- cancel and/or archive the meeting

### Invite abuse response

Current product-fit action:

- revoke the invite link
- if abuse continues, disable the group or suspend the owner account

## Default Decision Guide

### Spam

First response:

- remove spam post or revoke spam invite

Escalate to suspension when:

- behavior repeats after cleanup
- multiple objects are being spammed
- account is clearly automated or malicious

### Harassment or abusive behavior

First response:

- remove abusive content
- cancel unsafe session if needed

Escalate to suspension when:

- behavior is repeated
- target safety is at risk
- threats or intimidation are involved

### Scam, phishing, impersonation

Default response:

- remove misleading content
- disable group/session/invite if involved
- suspend account when confidence is high

### Real-world safety concern

Default response:

- prioritize fast review
- disable the affected session or group if needed
- suspend involved accounts when the risk is credible

## Service-Level Expectations

Minimum response targets for v1:

- high-risk safety or threat reports: same day when seen
- obvious spam/phishing: within 24 hours
- lower-risk disputes or unclear cases: within a few days

This is an operator goal, not a guaranteed SLA.

## What Users Should Be Told

Minimum user-facing promises should stay narrow:

- users can report unsafe or abusive content/behavior
- Melon Meet may remove content, revoke invites, suspend accounts, or cancel groups/sessions to protect the community
- not every report leads to visible action

Avoid promising:

- real-time moderation
- perfect fraud detection
- full appeal tooling in v1

## Out of Scope for v1

Do not block launch on:

- advanced reputation scoring
- automated classifier pipelines
- user-facing strike systems
- full appeals workflow
- nuanced region-specific moderation playbooks
- large moderator team tooling

## Implementation Order

The next implementation slices after this policy are:

1. add report actions in the UI
2. add a report review queue
3. add operator/admin actions
4. add audit logging for moderation actions
5. add dedicated moderation authorization tests
