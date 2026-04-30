# Profile Sharing Design

## Goal

Add profile sharing to The Atelier so a user can share the current state of a measurement profile with another user. The recipient imports the shared data as a new profile in their own account/session.

The feature supports two user-facing sharing outputs from one shared snapshot architecture:

1. Downloadable profile file.
2. Public, unguessable, 24-hour temporary import link.

## Non-goals

- Do not implement live account-to-account sharing.
- Do not support collaborative editing.
- Do not transfer profile ownership.
- Do not import or expose historical measurement data.
- Do not include original database IDs, owner IDs, auth metadata, or history rows in shared data.

## Product behavior

When a profile is selected, the app exposes a **Share Profile** action. It opens a modal or sheet with two options:

- **Download profile file**: exports a portable JSON snapshot that another user can upload through **Import Profile**.
- **Create 24-hour import link**: stores the same snapshot behind a public unguessable token and gives the user a copyable link.

The recipient always previews the shared profile before importing. Confirming import always creates a new profile. The first version does not replace, merge, or update existing profiles.

Shared data includes only:

- profile name
- height
- sex
- current measurement values
- unit/schema metadata needed to interpret the measurements

Shared data excludes:

- profile history
- height history
- original owner/user ID
- original profile ID
- measurement row IDs
- auth metadata

## Snapshot format

Both file sharing and temporary links use one reusable snapshot format.

```ts
type ProfileShareSnapshotV1 = {
  kind: 'atelier.profile-share';
  version: 1;
  exportedAt: string;
  sourceApp: 'the-atelier';
  profile: {
    name: string;
    height: number | null;
    sex: 'male' | 'female' | 'unspecified' | string;
  };
  measurements: Record<string, number | null>;
  units: 'cm' | 'in';
};
```

Snapshot utilities should be responsible for:

- building snapshots from the selected profile's current state
- validating imported snapshots
- rejecting unsupported versions
- rejecting invalid measurement keys
- stripping any unexpected identity/history fields
- normalizing valid snapshots before save

## Temporary link persistence

Temporary links need a Supabase-backed store for snapshots. A first table shape:

```sql
create table profile_share_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  snapshot jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  imported_count integer not null default 0,
  revoked_at timestamptz
);
```

The URL contains the raw random token. The database stores only a hash of that token, so leaked rows are not directly usable as import links.

Links expire after **24 hours**.

Prefer narrow RPC/function access for resolving a token rather than broad anonymous table reads. The resolver should return the snapshot only when the token is valid, unexpired, and not revoked.

## File export flow

1. User selects a profile.
2. User chooses **Share Profile** → **Download profile file**.
3. App builds `ProfileShareSnapshotV1` from current profile state.
4. App validates that only current profile data is included.
5. Browser downloads a JSON file, for example `atelier-profile-sofia-2026-04-30.json`.
6. Recipient opens their own app session.
7. Recipient chooses **Import Profile** and selects the JSON file.
8. App validates `kind`, `version`, profile fields, and measurement keys.
9. App shows an import preview.
10. Recipient confirms.
11. App creates a new profile with current measurements only.

## Temporary link flow

1. User selects a profile.
2. User chooses **Share Profile** → **Create 24-hour import link**.
3. App builds the same `ProfileShareSnapshotV1`.
4. App generates a cryptographically random token.
5. App saves the snapshot with token hash, creator user ID, and `expires_at = now + 24 hours`.
6. App shows a copyable URL such as `/import-profile?token=...`.
7. Recipient opens the link.
8. App resolves the token and fetches the snapshot only if valid, unexpired, and not revoked.
9. Recipient previews the profile.
10. Recipient confirms import.
11. App creates a new profile in the recipient's account/session.
12. App increments `imported_count` after successful import.

## UX and errors

### Entry points

- **Share Profile** appears when a profile is selected.
- **Import Profile** appears near profile management controls and supports selecting a JSON file.
- Temporary import links open directly to an import preview route.

### Preview content

The import preview shows:

- profile name
- height
- sex
- measurement count
- compact measurement summary
- message: “This creates a new profile. History is not included.”

Primary action: **Import as new profile**.

### File import errors

- invalid file type
- invalid JSON
- unsupported snapshot version
- missing required fields
- unknown measurement keys
- empty profile name
- Supabase/network save failure

### Temporary link errors

- invalid link
- expired link
- revoked link
- snapshot unavailable
- user not signed in, if import requires auth
- import failed after preview

## Security guardrails

- Never export or import original IDs or owner IDs.
- Never include history tables in snapshots.
- Store only token hashes for temporary links.
- Expire links after 24 hours.
- Validate imported snapshots before saving.
- Use RLS and/or narrow RPCs so public token lookup cannot enumerate share rows.
- Treat imported JSON as untrusted input.

## Testing plan

### Unit tests

- builds a valid snapshot from a profile
- excludes profile ID, owner ID, and history
- validates supported `kind` and `version`
- rejects invalid JSON
- rejects unsupported versions
- rejects invalid measurement keys
- normalizes imported data before save

### Import/storage tests

- imported profile always creates a new profile
- imported current measurements are saved
- imported height, sex, and name are saved
- historical rows are not imported
- duplicate names are handled predictably by the chosen UX

### Temporary-link tests

- creates share row with `expires_at = created_at + 24 hours`
- stores token hash, not raw token
- rejects expired links
- rejects revoked links
- increments `imported_count` after successful import
- rejects invalid token format

### Manual QA

1. Create a profile with measurements and history.
2. Export and import via file.
3. Confirm imported profile has current values but no timeline history.
4. Create a temporary link.
5. Open link in another signed-in account/session.
6. Import as a new profile.
7. Confirm expiration behavior after 24 hours or via a test override.

## Implementation phases

1. Add snapshot builder/validator utilities and unit tests.
2. Add file export/import UI and import-as-new-profile save path.
3. Add temporary share-link migration and Supabase access path.
4. Add temporary link creation UI and import preview route.
5. Add expiration/revocation handling and final QA polish.
