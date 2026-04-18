# Melon Meet

Map-first meetup organizer for beach volleyball and other outdoor games, built for cheap deployment on Cloudflare.

## Stack

- `apps/web`: Vite + React + TypeScript + Tailwind CSS + Preline UI
- `apps/api`: Hono on Cloudflare Workers
- `packages/shared`: shared schemas and TypeScript types
- Cloudflare D1 for users, groups, meetings, claims, posts, and seeded venues
- MapLibre for the Berlin-first map experience

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create and migrate the local D1 database:

```bash
npm run db:migrate:local
npm run db:seed:local
```

3. Start the API Worker and the Vite frontend together:

```bash
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies `/api` requests to Wrangler on `http://localhost:8787`.

## Demo seed

After seeding, you can sign in with:

- Email: `demo@melonmeet.local`
- Password: `demo12345`

The seed includes:

- Berlin beach volleyball venues
- One public group
- One private group
- One public one-time meeting
- One recurring public meeting series

## Useful commands

```bash
npm run typecheck
npm test
npm run build
npm run db:migrate:remote
npm run db:seed:remote
npm run deploy
```

## Deployment notes

- Replace the placeholder `database_id` in [wrangler.jsonc](/Users/jbot/IdeaProjects/melon-meet/wrangler.jsonc:14) with your real D1 database ID before deploying.
- Run `npm run db:migrate:remote` before the first production deploy.
- If you want the demo content in a remote database, run `npm run db:seed:remote` after migrations.
- `wrangler.jsonc` is configured for SPA route fallback so BrowserRouter deep links keep working in production.
- If you want a custom map style, define `VITE_MAP_STYLE_URL` for the frontend build.
- Work through the launch checklist in [docs/go-live-checklist.md](/Users/jbot/IdeaProjects/melon-meet/docs/go-live-checklist.md).
