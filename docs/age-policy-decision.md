# Melon Meet Age Policy Decision

Last updated: 2026-07-01

Purpose: define the launch-era age policy and how it is enforced in the product.

Status: accepted launch operations and product rule for the first public beta.

How to use this file:

- Treat this as the source of truth for the current age-policy rule.
- Keep the signup flow, terms copy, and launch/security docs aligned with this decision.
- If Melon Meet later moves to a birthdate-based or parental-consent model, update this file before changing product copy or implementation.

Related files:

- [public-launch-security-plan.md](/Users/jbot/IdeaProjects/melon-meet/docs/public-launch-security-plan.md)
- [account-lifecycle-spec.md](/Users/jbot/IdeaProjects/melon-meet/docs/account-lifecycle-spec.md)
- [apps/web/src/pages/InfoPage.tsx](/Users/jbot/IdeaProjects/melon-meet/apps/web/src/pages/InfoPage.tsx)

## Launch Decision

- Melon Meet keeps the `16+` minimum-age rule stated in the Terms.
- For the first public beta, signup enforces this through an explicit self-attestation checkbox.
- Melon Meet does not collect date of birth for the first public beta.

## Why This Is The Launch Rule

- It closes the mismatch between the Terms and the actual signup flow.
- It keeps the launch experience simple without introducing date-of-birth storage or age-verification tooling.
- It avoids collecting more sensitive personal data than is necessary for the launch product.

## Product Rule

- A user cannot complete signup unless they confirm that they are at least 16 years old.
- This is enforced in both the client flow and the validated signup payload.
- The rule is an eligibility gate, not a proof-of-age system.

## What This Does Not Do

- It does not verify a user’s true age.
- It does not support parental-consent flows.
- It does not create a stronger identity or safety guarantee.

## Reopen Conditions

Revisit this decision if any of the following becomes important:

- the product expands toward minors or school use cases
- counsel requires stronger age handling
- a regulator, incident, or trust/safety review shows self-attestation is insufficient

## Public-Facing Summary

The public launch rule should stay simple:

- users must be at least 16 years old to create an account
- signup requires an explicit age confirmation
- Melon Meet does not currently collect date of birth for the first public beta
