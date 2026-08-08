# Hazy — a memory for the URLs you save

Save links, search your own reading, ask questions about it, and catch up
later. Built with Next.js (App Router, TypeScript), any Postgres database +
Drizzle, Clerk auth, and OpenRouter for AI-assisted answers. A Flutter
mobile client is planned next, against the same `/api/v1/*` HTTP API this
web app already uses.

## Stack & why

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router), TypeScript | |
| Database | **Any Postgres**, via Drizzle ORM + the plain `postgres` driver | Neon, Supabase, RDS, a local Docker/Postgres.app instance — whatever `DATABASE_URL` points at. Neon's free tier is the easiest zero-cost start |
| Auth | [Clerk](https://clerk.com) | Free Hobby tier — see **Auth fallback** below |
| AI | [OpenRouter](https://openrouter.ai), free `:free` models | Free-model lineup rotates; see `.env.example` |
| i18n | `next-intl`, English + Japanese | `/en/...` and `/ja/...` routes |
| Search | Postgres full-text search (no AI required) | Works even with zero API keys configured |

### Database: works with any Postgres, not just Neon

`src/db/index.ts` connects with the plain `postgres` (postgres.js) driver
over a standard TCP connection string — the same code path works against
Neon, Supabase, Amazon RDS, a local Docker container, or Postgres.app.
SSL is handled automatically (`src/db/connection-options.ts`): a managed
provider's connection string already carries `?sslmode=require` and that's
respected as-is; a bare `localhost` string gets SSL disabled so local dev
needs no extra config. Nothing here is Neon-specific — swap `DATABASE_URL`
for any Postgres 14+ connection string and it works.

One tradeoff worth knowing: this trades away Neon's HTTP-based serverless
driver (which avoids TCP connection-limit issues in edge/serverless
deployments) for portability. If you deploy to a serverless platform at
real scale, either point `DATABASE_URL` at your provider's *pooled*
connection string (Neon and Supabase both offer one, e.g. via PgBouncer)
or keep `max` low in `src/db/index.ts` (currently 5).

### Auth: what if Clerk stops being usable?

Clerk's free/Hobby tier covers unlimited email + social sign-in up to a
generous MAU allowance — enough for this project — but gates custom
domains, enterprise SSO/SAML, and higher-volume transactional SMS behind
paid plans (check Clerk's current pricing page, it changes). If Clerk ever
becomes unusable, the documented fallback is **Auth.js (NextAuth v5) +
`@auth/drizzle-adapter`** against the same Neon database — fully
self-hosted, no extra cost, at the price of hand-building sign-in/up UI
instead of Clerk's hosted components. This isn't implemented, just planned
for if it's ever needed.

## Setup

The app boots with **no keys at all** and shows a "Setup required" screen
listing what's missing — nothing crashes. Add services one at a time:

1. **Copy the env file**

   ```bash
   cp .env.example .env.local
   ```

2. **Database (any Postgres, free options available)** — easiest free
   path: [neon.tech](https://neon.tech) → create a project → copy the
   connection string → paste into `DATABASE_URL`. Any other Postgres
   (Supabase, RDS, local Docker) works the same way — just paste its
   connection string instead. Then:

   ```bash
   npm run db:setup   # drizzle-kit push + the search_vector trigger
   ```

3. **Clerk (auth, free)** — [clerk.com](https://clerk.com) → create an
   app → API Keys page → copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and
   `CLERK_SECRET_KEY` into `.env.local`. Sign-in/sign-up work as soon as
   these are set.

   Optional: for the Clerk → database user-sync webhook, add an endpoint
   in the Clerk dashboard pointing at `/api/v1/webhooks/clerk` (you'll
   need a public URL in dev, e.g. `ngrok http 3000`), then copy the
   signing secret into `CLERK_WEBHOOK_SIGNING_SECRET`. This is optional —
   the app also upserts your user record on first sign-in even without
   the webhook.

4. **OpenRouter (AI answers, free)** — [openrouter.ai](https://openrouter.ai)
   → create a key (no card required for `:free`-suffixed models) → set
   `OPENROUTER_API_KEY`. The free-model lineup rotates; check
   [openrouter.ai/models?max_price=0](https://openrouter.ai/models?max_price=0)
   and update `OPENROUTER_MODEL_ID` if the default has been retired.
   **Without this key, search still works** (plain keyword search over
   your saved URLs) — only the AI-synthesized "Ask" answers fall back to
   a plain "here's what matched" response.

5. **Run it**

   ```bash
   npm install
   npm run dev
   ```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / run |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:push` | Push the schema straight to `DATABASE_URL` (dev workflow) |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:trigger` | (Re-)apply the `search_vector` trigger — see below |
| `npm run db:setup` | `db:push` + `db:trigger` in one go |

## Why there's a manual SQL trigger

`saved_urls.search_vector` (a Postgres `tsvector`, GIN-indexed) powers
full-text search. Drizzle manages the column and index declared in
`src/db/schema.ts`, but keeping it *populated* on insert/update is a
trigger — that's not something `drizzle-kit push` expresses, so it lives
in `src/db/sql/search-vector-trigger.sql` and is applied via
`npm run db:trigger`. Re-run it any time you reset the database.

## API shape (for the future Flutter client)

Every read/write the web app needs lives under `/api/v1/**` as plain JSON
Route Handlers — never Next.js Server Actions — specifically so a native
Flutter client can consume the same endpoints later without any backend
rework. Responses are `{ data }` on success or `{ error: { code, message,
details? } }` on failure. See `src/types/api.ts` for the shared response
shapes and `src/app/api/v1/**` for the handlers.

## Project structure

```
src/
  app/[locale]/            # pages (en/ja), (auth) and (app) route groups
  app/api/v1/               # the JSON API — see above
  components/                # UI, grouped by feature
  db/schema.ts               # Drizzle schema (single source of truth)
  lib/                       # env, auth, metadata fetch, search, AI, etc.
  i18n/, messages/           # next-intl config + en.json/ja.json
  types/api.ts                # shared API contract types
```

## Not yet built

- Flutter mobile app (next, against the existing `/api/v1/*` API)
- Background/async metadata fetching (current save flow fetches inline,
  ~8s timeout — fine at this scale, would move to a queue at larger scale)
- Push/email notifications for the read-later digest (the preference
  toggles exist and persist; nothing sends yet)
