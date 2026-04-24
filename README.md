# The Atelier

The Atelier is a Vite + React measurement reference app for managing family clothing measurements. It lets you create profiles, switch between front and back body views, select measurement points on a technical diagram, and edit values with an integrated ruler and a local Express data service backed by Postgres.

## Features

- Create, edit, and delete family profiles
- Store height, sex, and measurement data per profile
- Track historical changes for profile heights and saved measurements in Postgres
- Switch between front and back measurement views
- Edit measurements in `cm` or `in`
- Persist data in a Supabase/Postgres database
- Sign in with Google via Supabase Auth

## Run locally

```bash
pnpm install
cp .env.example .env
pnpm dev
```

`pnpm dev` starts both the Vite app and the local Express data service.

- App: `http://localhost:3000`
- API: `http://localhost:3101`

Before starting the server, set `DATABASE_URL` in `.env` to your Supabase Postgres connection string.
Also set:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`VITE_*` values are used by the browser app. The non-`VITE_*` values are used by the Express API to verify every bearer token before serving `/api/*`.

## Google Auth setup

1. In Supabase dashboard, enable **Auth > Providers > Google**
2. In Google Cloud, create the OAuth client for your local and production app URLs
3. Add your local callback/redirect URL in Supabase Auth settings
4. Add the environment variables above to `.env`
5. Run the profile ownership migration:

```bash
# apply the new SQL in Supabase
supabase/migrations/202604220002_add_profile_ownership.sql
```

Recommended for the current Express backend:

- use the Supabase Postgres connection string intended for persistent server clients
- keep the frontend talking to the local `/api` routes for now

Database schema lives in:

- `supabase/migrations/202604220001_initial_profiles_measurements.sql`

## Available scripts

```bash
pnpm dev
pnpm dev:client
pnpm dev:server
pnpm server
pnpm build
pnpm preview
pnpm lint
```

## Notes

- The local data service is required; the UI will block if the API is offline
- The current migration path keeps Express as the API layer while moving persistence to Supabase Postgres
- All `/api` routes now require a valid Supabase access token
- There is currently no `test` script in `package.json`
