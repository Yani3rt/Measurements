# SQLite Persistence Design

## Goal

Replace browser-local profile storage with a required local data service backed by SQLite, while keeping the current React measurement workflow intact and leaving a clean upgrade path to a shared hosted database later.

## Approved Direction

Use a small Express API in front of a normalized SQLite database.

- The app will use one shared household dataset with no user accounts.
- The frontend will stop reading and writing `localStorage`.
- The local server will be required for the app to load and save data.
- The client will talk to `/api` endpoints and stay unaware of SQLite details.
- Measurement values will be stored canonically in centimeters.

## Architecture

### Server

Add a `server/` folder with three responsibilities:

- bootstrap the Express app
- initialize SQLite and run startup migrations
- expose profile and measurement endpoints

The local database file will live in the project so it is easy to inspect, back up, and eventually swap out for a hosted database adapter.

### Database

Use normalized tables:

- `profiles`
  - `id`
  - `name`
  - `sex`
  - `height_cm`
  - `created_at`
  - `updated_at`
- `measurements`
  - `profile_id`
  - `measurement_key`
  - `value_cm`
  - `updated_at`

This shape matches the app's current profile model while keeping measurements queryable and easy to migrate later.

### Frontend

Replace the current storage helper with an API-backed data layer that:

- loads profiles on startup
- persists profile create, update, and delete actions through HTTP
- persists measurement edits through HTTP
- keeps React state in sync from API responses rather than re-reading from browser storage

Vite will proxy `/api` to the local Express server during development so the browser still behaves like a single app.

## API Surface

Keep the first version intentionally small:

- `GET /api/profiles`
- `POST /api/profiles`
- `PUT /api/profiles/:id`
- `DELETE /api/profiles/:id`
- `PUT /api/profiles/:id/measurements/:key`

Each route will validate input, return JSON, and respond with the updated profile or profile list shape needed by the current UI.

## Error Handling

- If the API is unavailable on app load, the UI will show a blocking offline-service state instead of silently falling back.
- Failed writes will keep the current UI state intact and show a clear inline error.
- Invalid profile IDs or measurement keys will return structured `4xx` errors from the API.
- The frontend will not pretend a mutation succeeded until the server confirms it.

## Rollout Constraints

- No auth in this pass.
- No multi-user data partitioning in this pass.
- No browser `localStorage` fallback in this pass.
- No historical audit trail or sync engine in this pass.

## Verification

- TypeScript validation for client and server code
- production build for the frontend
- manual smoke checks for profile and measurement persistence through the API
- updated README instructions for running both the client and local server

## Success Criteria

- Profiles and measurements persist in SQLite across page reloads.
- The app requires the local server and communicates that clearly when it is down.
- The UI keeps the current interaction model with minimal visual disruption.
- The data access boundary is clean enough to swap SQLite for a hosted database later.
