# Melon Meet Analytics and Cookie-Consent Decision

Last updated: 2026-07-01

Purpose: lock the launch-era decision for analytics, non-essential tracking, and cookie-consent handling.

Status: accepted launch operations rule for the first public beta.

How to use this file:

- Treat this as the source of truth for whether analytics is allowed before launch.
- Keep the privacy page, launch docs, and deployment checklist aligned with this decision.
- If non-essential analytics, marketing scripts, or additional client-side tracking are added, update this file first and then update product copy and implementation together.

Related files:

- [legal-compliance-draft.md](/Users/jbot/IdeaProjects/melon-meet/docs/legal-compliance-draft.md)
- [processor-subprocessor-inventory.md](/Users/jbot/IdeaProjects/melon-meet/docs/processor-subprocessor-inventory.md)
- [public-launch-implementation-roadmap.md](/Users/jbot/IdeaProjects/melon-meet/docs/public-launch-implementation-roadmap.md)

## Launch Decision

- Melon Meet will not add non-essential analytics or marketing tracking before the first public beta.
- The launch product may use only:
  - the strictly necessary authentication cookie for signed-in sessions
  - local browser storage for theme and language preferences
  - security and anti-abuse mechanisms already required to operate the service, such as Turnstile and server-side logging
- Because no non-essential analytics or advertising stack is part of the launch product, Melon Meet will not introduce a separate cookie banner or full consent-management platform for the first public beta.

## Why This Is The Launch Rule

- It keeps the launch privacy posture simple and easier to explain accurately.
- It avoids adding a consent-management project as a side quest before the product is operationally ready.
- It matches the current codebase, which does not implement an analytics provider today.
- It reduces the chance of shipping tracking that is only partially disclosed or only partially consent-gated.

## What Is Allowed Without Reopening This Decision

- The signed-in session cookie needed to authenticate users.
- Theme and locale preferences stored locally in the browser.
- Server-side operational, audit, moderation, and security logging already needed to run the service.
- Turnstile signup bot protection when configured.
- Default remote map/style loading described in the processor inventory.

## What Is Not Allowed Before Reopening This Decision

- Third-party product analytics scripts.
- Marketing pixels.
- Session-replay tooling.
- Heatmaps.
- A/B testing or experimentation platforms that track users beyond strictly necessary service operation.
- Ad-tech or remarketing scripts.

## Reopen Conditions

Revisit this decision before broad launch if any of the following is proposed:

- product analytics
- marketing analytics
- attribution tracking
- cookie-based experimentation
- consent-dependent client-side monitoring tools

If reopened, do all of the following in the same workstream:

- choose the provider
- update [processor-subprocessor-inventory.md](/Users/jbot/IdeaProjects/melon-meet/docs/processor-subprocessor-inventory.md)
- update public privacy copy
- decide whether a consent banner or fuller CMP is required
- implement consent-aware loading rather than unconditional script loading

## Public-Facing Summary

The launch privacy/cookie position should stay simple:

- Melon Meet uses a strictly necessary authentication cookie for signed-in sessions.
- Melon Meet stores theme and language preferences in local browser storage.
- Melon Meet does not currently use a separate analytics or advertising stack.
- If non-essential analytics is introduced later, the privacy and consent approach must be updated before rollout.
