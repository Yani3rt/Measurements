# The Atelier

The Atelier is a Vite + React measurement reference app for managing family clothing measurements. It lets you create profiles, switch between front and back body views, select measurement points on a technical diagram, and edit values with an integrated ruler while talking directly to Supabase for auth, storage, and history.

## Features

- Create, edit, and delete family profiles
- Store height, sex, and measurement data per profile
- Track historical changes for profile heights and saved measurements in Postgres
- Review a profile-wide fitting timeline with latest measurement deltas
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

`pnpm dev` starts the Vite app.

- App: `http://localhost:3000`

Before starting the app, set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The browser app talks directly to Supabase, so the `VITE_*` values must be available to Vite.

## Google Auth setup

1. In Supabase dashboard, enable **Auth > Providers > Google**
2. In Google Cloud, create the OAuth client for your local and production app URLs
3. Add your local and production redirect URLs in Supabase Auth settings
4. Add the environment variables above to `.env`
5. Run the profile ownership migration and the direct-client RLS migration:

```bash
# apply the new SQL in Supabase
supabase/migrations/202604220002_add_profile_ownership.sql
supabase/migrations/202604300001_enable_direct_client_rls.sql
```

Database schema lives in:

- `supabase/migrations/202604220001_initial_profiles_measurements.sql`

## Available scripts

```bash
pnpm dev
pnpm build
pnpm preview
pnpm lint
pnpm test
```

## Notes

- The UI depends on a reachable Supabase project and valid `VITE_SUPABASE_*` keys
- Direct browser access relies on Row Level Security policies in Supabase
- `pnpm test` runs the lightweight Node/TypeScript test suite
