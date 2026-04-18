# Venue Content Plan

Use this plan when expanding the venue database beyond the initial Berlin seed.

## Goals

- Keep production venue updates incremental and reviewable.
- Separate trusted venue imports from user-suggested venue leads.
- Avoid adding scraped or licensed data unless we have permission to use it.

## Near-Term Venue Updates

- Add a dedicated production venue seed/update SQL file for real venues only.
- Keep demo users, demo groups, and demo sessions out of production seeds.
- Prefer explicit fields for each venue:
  - name
  - address
  - description
  - pricing
  - latitude
  - longitude
  - booking URL
  - opening hours note
  - source URL
  - hero image URL
- Include a source URL for every imported venue so changes can be reviewed later.

## Future User Suggestions

The low-priority UI path should be:

- Add a "Suggest venue" button on the venues panel.
- Collect venue name, address, notes, optional source URL, and submitter contact/user id.
- Store suggestions in a separate `venue_suggestions` table with `pending`, `approved`, and `rejected` states.
- Keep suggestions out of the public map until approved.
- Add a small admin/review endpoint or script to promote approved suggestions into `venues`.

## Useful Sources to Review Manually

- Official venue websites.
- Public park or city sport facility pages.
- Community-maintained venue lists where reuse is allowed.
- Existing group organiser recommendations.

## Launch Recommendation

For public beta, ship with a clean curated venue set first. Add user suggestions only after the core deployed app is stable and there is a clear moderation process.
