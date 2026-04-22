# History Endpoints Design

## Goal

Add backend read endpoints that expose profile height history and per-measurement history so future charts and timelines can consume stable API responses without reshaping raw database rows in the frontend.

## Approved API

### Height history

`GET /api/profiles/:profileId/height-history`

Response:

```json
{
  "profileId": "uuid",
  "entries": [
    {
      "eventType": "insert",
      "previousHeightCm": null,
      "heightCm": 168,
      "changedAt": "2026-04-22T18:30:00.000Z"
    }
  ]
}
```

### Measurement history

`GET /api/profiles/:profileId/measurements/:measurementKey/history`

Response:

```json
{
  "profileId": "uuid",
  "measurementKey": "waist",
  "measurementLabel": "Waist",
  "entries": [
    {
      "eventType": "insert",
      "previousValueCm": null,
      "valueCm": 72,
      "changedAt": "2026-04-22T18:31:00.000Z"
    }
  ]
}
```

## Data shape decisions

- Include lightweight metadata in the response so the frontend can chart directly later.
- Return `entries` in ascending chronological order: `changed_at asc, id asc`.
- Return empty arrays when a valid profile exists but no history rows exist yet.
- Return `404` for missing profiles.
- Return `404` for invalid measurement keys.
- Return `400` for malformed UUID profile IDs.

## Architecture

### Repository layer

Add two Postgres-backed read functions to `server/database.ts`:

- `getProfileHeightHistory(profileId)`
- `getMeasurementHistory(profileId, measurementKey)`

These query:

- `public.profile_height_history`
- `public.measurement_history`

and map Postgres rows into JSON-safe API objects.

### Route layer

Add two Express route handlers to `server/index.ts`.

They should:

- validate `profileId`
- validate `measurementKey` where applicable
- confirm the profile exists via `getProfile(profileId)`
- return the approved response shape
- preserve the current error handling style used by the rest of the API

## Why this design

This keeps the backend contract stable and chart-friendly while avoiding any frontend assumptions about database column names, timestamp formatting, or measurement labels.

## Verification

- create a profile and confirm `height-history` returns one insert event
- edit height and confirm a second update event exists
- save a measurement and confirm a measurement history insert exists
- update the same measurement and confirm an update event exists
- confirm empty histories return `entries: []`
- confirm invalid IDs and invalid measurement keys return the expected errors
