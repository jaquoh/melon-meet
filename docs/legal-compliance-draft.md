# Melon Meet Legal Compliance Draft

Last updated: 2026-05-11

Purpose: turn Phase 5 into concrete, app-specific legal copy inputs without relying on generic privacy-policy generators.

Status: working draft, not legal advice, and not a substitute for lawyer review.

## Why this draft exists

The current legal pages are directionally useful, but they still have a few risky mismatches:

- they treat core account processing as consent-driven, even though the product behavior fits contract performance and legitimate interests better
- they do not describe the current processors and third-country transfers clearly enough
- they do not explain the actual security and moderation data handling now in the codebase
- they do not yet mention the competent Berlin supervisory authority

This draft keeps the rule set simple:

- say only what the product actually does today
- use contract performance for core account/community features
- use legitimate interests for security, moderation, and abuse prevention
- mention consent only where consent is genuinely the right basis
- avoid promising fixed retention periods that are not implemented

## Product facts from the repo

These are the facts the legal text should match today:

- account signup uses email and password
- passwords are hashed, not stored in plain text
- signup uses Cloudflare Turnstile bot protection when configured
- email verification is required before normal participation features
- transactional account emails are sent through Resend
- the app runs on Cloudflare Workers with Cloudflare D1
- the app stores an authentication cookie for signed-in sessions
- the frontend stores theme and locale preferences in browser storage
- the app stores profile data, group data, session data, claims, posts, friend connections, reports, moderation notes, and audit/security records
- the app supports moderation reports and admin enforcement actions
- account deletion immediately removes access and starts a 30-day deletion-pending window
- no analytics stack is implemented right now
- no marketing newsletter flow is implemented right now
- email open/click tracking is not used in the current Resend integration

Relevant local implementation points:

- session cookie handling: [auth.ts](/Users/jbot/IdeaProjects/melon-meet/apps/api/src/lib/auth.ts)
- transactional email sending: [email.ts](/Users/jbot/IdeaProjects/melon-meet/apps/api/src/lib/email.ts)
- account lifecycle behavior: [account-lifecycle-spec.md](/Users/jbot/IdeaProjects/melon-meet/docs/account-lifecycle-spec.md)
- monitoring and alerts: [monitoring.ts](/Users/jbot/IdeaProjects/melon-meet/apps/api/src/lib/monitoring.ts)
- security logging: [security-log.ts](/Users/jbot/IdeaProjects/melon-meet/apps/api/src/lib/security-log.ts)
- audit logging: [audit-log.ts](/Users/jbot/IdeaProjects/melon-meet/apps/api/src/lib/audit-log.ts)

## Official source anchors

These are the official or primary sources this draft is based on:

- GDPR Article 13 information duties: [EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/art_13/oj/eng)
- GDPR lawful bases: [EUR-Lex Article 6](https://eur-lex.europa.eu/eli/reg/2016/679/art_6/oj/eng)
- DDG provider notice duties: [§ 5 DDG](https://www.gesetze-im-internet.de/ddg/BJNR0950B0024.html)
- device storage / cookie consent exception for strictly necessary storage: [§ 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html)
- DPO threshold for private bodies in Germany: [§ 38 BDSG](https://www.gesetze-im-internet.de/bdsg_2018/__38.html)
- BfDI note that controllers must provide Articles 13 and 14 information: [BfDI Informationspflichten](https://www.bfdi.bund.de/DE/Buerger/Inhalte/Allgemein/Datenschutz/Informationspflichten.html)
- controller/processor distinction: [EDPB Guidelines 07/2020](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-072020-concepts-controller-and-processor-gdpr_en)
- Berlin supervisory authority contact: [Berliner Beauftragte für Datenschutz und Informationsfreiheit](https://www.datenschutz-berlin.de/ueber-uns/kontakt/)
- Cloudflare Turnstile privacy addendum: [Cloudflare Turnstile Privacy Addendum](https://www.cloudflare.com/en-au/turnstile-privacy-policy/)
- Cloudflare DPA: [Cloudflare Customer DPA](https://www.cloudflare.com/es-la/cloudflare-customer-dpa/)
- Resend DPA: [Resend DPA](https://resend.com/legal/dpa)

## Recommended simple legal-basis model

Use this model unless counsel tells us otherwise:

- `Art. 6(1)(b) GDPR`:
  account signup, login, session management, profile management, group membership handling, session participation flows, user-generated content necessary to run the service, and transactional account emails
- `Art. 6(1)(f) GDPR`:
  security logs, rate limiting, bot protection, moderation/report handling, account suspension, audit logging, abuse investigations, and service integrity
- `Art. 6(1)(c) GDPR`:
  processing needed to comply with legal obligations, if and when they apply
- `Consent`:
  only for genuinely optional processing, if introduced later

Important correction:

- the current public privacy copy should stop saying that normal account creation is based on consent
- the signup checkbox can still serve as acknowledgement of terms/privacy, but the legal basis for the underlying account processing should not be described as consent

## Recommended processor/subprocessor disclosures

The public privacy text should clearly name at least these service providers:

- `Cloudflare`
  for application hosting, asset delivery, D1 database infrastructure, and Turnstile signup bot protection
- `Resend`
  for transactional email delivery

Recommended simple wording:

- Cloudflare processes infrastructure and security-related data on our behalf. For Turnstile, Cloudflare also processes technical signals used to distinguish human visitors from bots.
- Resend processes recipient addresses and message content needed to deliver transactional emails such as verification, password reset, and email-change messages.

Recommended transfer wording:

- both Cloudflare and Resend may process personal data outside the EU/EEA
- say that transfers are based on the provider’s contractual safeguards and applicable transfer mechanisms
- do not promise EU-only hosting unless you have actually configured and verified it

## Recommended privacy notice structure

The privacy page should contain, at minimum:

1. Controller identity and contact details.
2. If applicable, DPO contact details.
3. Categories of personal data processed.
4. Purposes and legal bases, grouped by feature.
5. Recipients / processors.
6. International transfers and safeguards.
7. Retention logic.
8. Data-subject rights.
9. Right to complain to the Berlin supervisory authority.
10. Device storage / strictly necessary cookie note.
11. Whether automated decision-making under Art. 22 occurs.

## Draft privacy copy inputs

This is not polished marketing copy. It is the safest product-matching content direction for the public page.

### 1. Controller

- Controller: Melon Meet, Jacob Otto, Halskestr. 6, 12167 Berlin, Germany.
- Contact: hello@melonmeet.com.

### 2. Data categories

- Account data: email address, password hash, email verification state.
- Profile data: display name, avatar URL, bio, home area, playing level, profile visibility settings, email visibility settings.
- Community data: groups, memberships, membership requests, sessions, session series, spot claims, posts, friend requests/connections, invite links.
- Security and operational data: authentication sessions, token records, request metadata, IP address, user agent or browser-related metadata where logged by security or abuse prevention systems, rate-limit entries, moderation reports, moderation notes, audit log entries, operational error events.
- Communication data: transactional email recipient address, subject, and message content required to send account-related emails.
- Device preference data: theme and locale preferences stored in browser storage.

### 3. Purposes and legal bases

- We process account, profile, group, session, and participation data to provide the service you request and to perform the user contract under Art. 6(1)(b) GDPR.
- We process security, anti-abuse, moderation, and audit data to protect the platform, other users, and our systems under Art. 6(1)(f) GDPR.
- We may process data where necessary to comply with legal obligations under Art. 6(1)(c) GDPR.

### 4. Recipients

- Cloudflare for hosting, infrastructure, bot protection, and related security processing.
- Resend for transactional email delivery.
- Other users, but only to the extent your chosen profile, group, or session visibility makes content visible to them.

### 5. International transfers

- Some of our processors may process personal data in countries outside the EU/EEA, including the United States.
- Where this happens, we rely on the provider’s data processing terms and transfer safeguards.

### 6. Retention

Keep this simple and true:

- active account and community data: kept while the account is active and as long as needed to operate the service
- verification and reset tokens: short-lived and deleted or invalidated after use or expiry
- session records: retained while the session remains active or until revoked/expired
- moderation, audit, and security records: retained for as long as reasonably needed to investigate abuse, enforce platform rules, secure the service, and meet legal obligations
- deletion requests: access is removed immediately and the account enters a deletion-pending state; personal data is deleted or anonymized within 30 days under the current lifecycle model

### 7. Rights

List at least:

- access
- rectification
- erasure
- restriction
- objection
- data portability where applicable
- right to complain to a supervisory authority

Suggested authority line for the Berlin-based operator:

- You also have the right to lodge a complaint with the Berliner Beauftragte für Datenschutz und Informationsfreiheit, Alt-Moabit 59-61, 10555 Berlin, Germany, `mailbox@datenschutz-berlin.de`.

### 8. Cookies / device storage

Current safe position:

- the service uses a strictly necessary authentication cookie for signed-in sessions
- the frontend also stores theme and language preferences in browser storage
- because there is no analytics or advertising stack today, do not add a cookie banner unless you later introduce non-essential storage/access

Important caution:

- this point should still be lawyer-reviewed, but the current technical setup appears to fit the `strictly necessary` exception in `§ 25(2)(2) TDDDG`

### 9. Automated decision-making

Safe wording:

- We do not use solely automated decision-making that produces legal effects or similarly significant effects on users within the meaning of Art. 22 GDPR.
- We do use technical anti-bot checks during signup and automated security measures such as rate limiting.

## Draft terms copy inputs

Recommended simple terms structure:

1. Scope and operator.
2. Eligibility.
3. Account responsibilities.
4. Acceptable use.
5. Public/private visibility and user responsibility for content.
6. Moderation and enforcement.
7. Groups, sessions, and organiser responsibility.
8. No guarantee of attendance, availability, or venue accuracy.
9. Sports/activity safety disclaimer.
10. Suspension, deletion, and termination.
11. Liability carve-outs aligned to German law.
12. Contact.

Key points the terms should add or tighten:

- explain that some profiles, groups, sessions, and posts may be public depending on user settings and product design
- explain that organisers are responsible for the accuracy of the details they publish
- explain that Melon Meet is a coordination platform, not the operator of the underlying sports venues or events
- explain that reports can lead to review, content removal, invite revocation, cancellation, archival, or account suspension
- avoid a blanket US-style “as is, no liability whatsoever” line; keep a shorter, Germany-compatible limitation text and get legal review

## Impressum adjustments

Current impressum is close, but should be cleaned up:

- keep the `§ 5 DDG` provider details
- keep the `§ 18 Abs. 2 MStV` responsible-for-content line if editorial content is published
- remove “VAT ID: Not provided.” unless you actually have one or want to say that no VAT ID exists
- “Telephone: Not provided.” can be replaced with a simpler contact line focused on email

## What should not be published yet

Do not publish text that says:

- account processing is based on consent
- data is hosted only in Germany or only in the EU
- all data is deleted immediately on account deletion
- there are no international transfers
- there are no processors
- there are no logs
- moderation is manual-only
- there is a DPO unless one is actually required and appointed

## Recommended repo follow-up order

1. Update the public privacy page with the legal-basis correction and processor disclosures.
2. Update the public terms page so moderation, suspension, and platform-role language matches the product.
3. Tighten the impressum wording.
4. Add versioned acceptance tracking before relying operationally on the signup checkbox.
5. Add a separate processor/subprocessor page if the public privacy page starts getting too dense.

