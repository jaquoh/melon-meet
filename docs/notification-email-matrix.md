# Melon Meet Notification Email Matrix

Last updated: 2026-05-11

Purpose: define the minimum launch-safe notification email set without letting notifications turn into an unbounded product project.

Status: planning document. This matrix defines what we should implement next; it does not mean every email below is already live.

## Guiding Rules

Keep the system simple:

- send only for meaningful state changes, not every click
- prefer one clear email per event over digest logic for launch
- use the same sender for all transactional notifications unless there is a strong reason not to
- avoid branching per locale or per user setting in v1 unless already supported
- if an event can fire repeatedly in a short time, dedupe it with a short cooldown instead of building a complex preference center

Default delivery rules:

- send immediately for security, moderation, and account-risk events
- send immediately for session cancellations
- send immediately for membership requests and member-left events
- send immediately for session/group creation events
- send immediately for pinboard updates in v1, but only to directly affected attendees or group members

Default sender rules:

- from: `Melon Meet <noreply@mail.melonmeet.com>`
- reply-to: `hello@melonmeet.com`

## Event Matrix

### Admin / operator alerts

| Event | Recipients | When to send | Notes |
|---|---|---|---|
| Reported content created | `MODERATION_REVIEWER_EMAILS` and `MODERATION_ADMIN_EMAILS` | immediately | one email per report |

### Moderation and account emails to users

| Event | Recipients | When to send | Notes |
|---|---|---|---|
| Account suspended | suspended user | immediately | explain that access has been removed and point to `hello@melonmeet.com` |
| User profile was reported | profile owner | immediately | acknowledgment only, no reporter identity |
| Group post was reported | post author | immediately | acknowledgment only |
| Session post was reported | post author | immediately | acknowledgment only |
| Group they own was reported | group owner | immediately | acknowledgment only |
| Session they own was reported | session owner | immediately | acknowledgment only |
| Report received | reporter | immediately | thank-you and expectation-setting |
| Report reviewed with result | reporter | when report moves to `action_taken` or `closed_no_action` | short result, no sensitive internal detail |

### Session owner emails

| Event | Recipients | When to send | Notes |
|---|---|---|---|
| Spot claimed | session owner | immediately | include claimer name if already visible in product |
| Spot claimed and session became full | session owner | immediately | combine with the claim event if both happen together |
| Spot released | session owner | immediately | one email per release |

### Session attendee emails

| Event | Recipients | When to send | Notes |
|---|---|---|---|
| Session changed | all current attendees except actor | immediately | only for meaningful content/time/location changes |
| Session cancelled | all current attendees except actor | immediately | high priority |
| Session pinboard update | all current attendees except author | immediately | simple v1 rule; consider cooldown later if noisy |

### Group member emails

| Event | Recipients | When to send | Notes |
|---|---|---|---|
| New session added to group | all current group members except actor | immediately | only for first creation |
| New session series added to group | all current group members except actor | immediately | series-level creation, not every generated occurrence |
| Group deleted or archived | all current group members except actor | immediately | explain that the group is no longer active |

### Group owner/admin emails

| Event | Recipients | When to send | Notes |
|---|---|---|---|
| Membership join request | group owners and admins | immediately | one email per request |
| Member left group | group owners and admins | immediately | requires the leave-group flow |

## Easy Rule Set

To avoid forgetting edge cases, use these rules:

1. If the event changes account access or moderation state, email immediately.
2. If the event changes a session someone already joined, email attendees immediately.
3. If the event changes who is in a group, email group owners/admins immediately.
4. If the event creates a new play opportunity in a group, email group members immediately.
5. If the event is just an internal moderation note or assignment change, do not email users.

## Deduping Rules

Keep deduping simple in v1:

- no dedupe for suspension, cancellation, report-received, or report-result emails
- no dedupe for join requests or member-left emails
- for repeated pinboard updates, allow a short per-session cooldown if volume becomes noisy
- for repeated content-report emails to a target owner, at most one email per target per open report thread

## Out Of Scope For V1

Do not add these before launch unless they become necessary:

- full notification preferences UI
- daily or weekly digests
- per-channel opt-in rules
- batched moderation summaries
- locale-specific template branching beyond the existing app language system
- advanced anti-spam notification suppression logic

## Dependencies

This matrix depends on:

- Resend-based transactional email already being available
- the leave-group flow existing for member-left notifications
- moderation queue and admin actions existing
- audit logging capturing the key state changes that trigger mail

## Recommended Build Order

1. Admin/operator report-alert emails
2. Reporter confirmation and result emails
3. Session cancellation and attendee change emails
4. Membership request and member-left emails
5. Group/session creation and pinboard update emails
