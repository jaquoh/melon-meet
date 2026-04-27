# UI Layout Assumptions

This file records current layout assumptions for the Melon Meet web app so future UI work can stay consistent.

## Main Workspace Grid

The desktop main view is built from a structured grid of cells:

- `brand`:
  Logo / home cell.
- `top`:
  Middle top header cell.
- `actions`:
  Top-right header area, which contains:
  language button cell, dark mode button cell, sign-in or account button cell.
- `center`:
  Main discovery cell, showing either map or list.
- `right`:
  Right-side info / detail cell for the selected venue, group, session, or profile.
- `legal`:
  Bottom legal links cell.
- `mode-overlay-controls`:
  Bottom segmented navigation area for `Venues`, `Groups`, `Sessions`.

These cells should feel like one coherent surface system with shared translucency and border language.

## Mobile Workspace Structure

Mobile uses a different layout, but it should still read as the same cell system:

- `mobiletop`:
  Combined mobile header row.
- `top`:
  Mobile top controls area.
- `center`:
  Main map / list content.
- `legal`:
  Legal links row.
- `mode-overlay-controls`:
  Bottom segmented navigation area.

The mobile header is composed from:

- mobile brand / logo side
- mobile actions side
- language button cell
- dark mode button cell
- sign-in or account button cell

Even when the DOM structure differs from desktop, these parts should use the same shared surface rules unless there is a deliberate exception.

## Surface / Translucency Rule

For the main workspace view:

- use one shared translucency token for primary grid cells and button-cells
- desktop, mobile, and ultra-narrow mobile should all inherit from that same token
- do not tune the header, center, and side cells independently unless there is a clear reason

Current intent:

- top header cells define the target translucency level
- the rest of the workspace cells should visually match that tone
- background art should remain visible, but slightly subdued for readability

## Practical Guidance

- when adjusting workspace translucency, prefer changing the shared token first
- if a cell looks different, check for a local `background` override before changing the token
- if mobile looks darker than desktop, check mobile-specific overrides like:
  `workspace-mobile-inline`, `workspace-mobile-brand`, `workspace-mobile-inline__actions`, and detail/mobile top wrappers
