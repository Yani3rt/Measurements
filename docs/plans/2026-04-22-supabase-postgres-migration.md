# Supabase Postgres Migration — Phase 1

## Decision

Start the database migration immediately by introducing a Supabase/Postgres schema while keeping the existing Express backend as the application API for now.

## What this phase does

- creates a Supabase migration folder in the repo
- defines the initial Postgres schema for `profiles` and `measurements`
- prepares measurement history support now so future historical views do not require a destructive schema rewrite
- prepares profile height history support now so future height charts do not require a destructive schema rewrite
- keeps the current frontend contract unchanged

## Schema decisions

### 1. Keep tables close to the existing app model

We preserve the current app concepts:

- `profiles`
- `measurements`

This keeps the backend migration narrow and avoids unnecessary UI churn.

### 2. Switch timestamps to Postgres-native types

Use `timestamptz` instead of string timestamps.

- `profiles.created_at`
- `profiles.updated_at`
- `measurements.created_at`
- `measurements.updated_at`

### 3. Do not pre-seed zero-value measurement rows in Postgres

The current SQLite implementation inserts all measurement rows at profile creation time.
That is not required by the frontend, because the client already hydrates missing keys to zero in `/Users/yani/Dev/Medidas/the-atelier/src/storage.ts`.

For Postgres, prefer sparse measurement rows:

- create a `profile`
- only create a `measurement` row when the user actually records a value

Benefits:

- `measurements.created_at` truly means "this measurement was first added"
- less write amplification at profile creation
- easier historical reasoning
- less clutter in the database

### 4. Add history support now

Add append-only history tables plus triggers:

- `measurement_history`
- `profile_height_history`

They record:

- measurement insert / update / delete
- profile height insert / update

This gives us a safe future path for:

- timeline UI
- audit trail
- "show me what changed"
- profile measurement history charts
- profile height history charts

## What still needs to happen next

### Express backend migration

The next backend step is to replace the SQLite implementation in `/Users/yani/Dev/Medidas/the-atelier/server/database.ts` with a Postgres-backed implementation while keeping `/api` routes unchanged.

### Expected behavior changes

- `createProfile()` should stop inserting 16 zero-value measurement rows
- `getProfile()` / `listProfiles()` should continue returning sparse measurement sets, letting the frontend hydrate defaults
- `saveMeasurement()` should upsert into `measurements`
- profile `updated_at` should bump whenever profile metadata or a measurement changes

### Future auth phase

When Google Auth is introduced later, add ownership columns and RLS in a follow-up migration rather than mixing auth concerns into this first database cutover.

## Notes on history fields

The current SQLite schema already has:

- `profiles.created_at`
- `profiles.updated_at`
- `measurements.updated_at`

What it does **not** have is `measurements.created_at`, so today we cannot reliably answer "when was this measurement first added?" after that row has been updated.

The Postgres migration fixes that by adding:

- `measurements.created_at`
- `measurement_history.changed_at`
- `profile_height_history.changed_at`
