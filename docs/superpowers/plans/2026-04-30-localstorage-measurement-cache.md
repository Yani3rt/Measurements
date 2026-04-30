# LocalStorage Measurement Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve perceived loading speed by caching profile measurement data locally without ever treating stale measurement numbers as confirmed current.

**Architecture:** Keep Supabase/Postgres as the source of truth and add a browser-only cache at the existing `src/storage.ts` persistence seam. Cache entries are scoped to the authenticated Supabase user and a per-login session cache key; app data is cleared on sign-in/user changes and sign-out, and cache writes only happen after successful Supabase reads/writes.

**Tech Stack:** React 19, Vite, TypeScript, Supabase JS, browser `localStorage`, Node `tsx --test`.

---

## File Structure

- Modify: `/Users/yani/Dev/Medidas/the-atelier/src/storage.ts`
  - Add localStorage cache types/helpers.
  - Add cache clearing APIs.
  - Add optional cache-hydrated profile loading.
  - Update cache after confirmed create/update/delete/save operations.
- Modify: `/Users/yani/Dev/Medidas/the-atelier/src/App.tsx`
  - Clear app cache on auth user/login transitions and sign-out.
  - Hydrate from cache only when safe, then revalidate from Supabase.
- Create: `/Users/yani/Dev/Medidas/the-atelier/tests/profile-cache.test.ts`
  - Unit test cache serialization, user/session scoping, stale rejection, write-after-server behavior.
- Optional later migration/RPC: Supabase cache fingerprint endpoint.
  - Not required for first implementation. Start with current server-returned profile `updatedAt` plus full refresh after login.

---

## Implementation Checklist

### Task 1: Add cache model and pure cache helpers

**Files:**
- Modify: `/Users/yani/Dev/Medidas/the-atelier/src/storage.ts`
- Create: `/Users/yani/Dev/Medidas/the-atelier/tests/profile-cache.test.ts`

- [ ] Add exported or testable pure helpers for cache keys, cache validation, and serialization.

Suggested cache shape:

```ts
type ProfileCachePayload = {
  cachedAt: string;
  sessionKey: string;
  userId: string;
  profiles: Profile[];
};

const PROFILE_CACHE_VERSION = 1;
const PROFILE_CACHE_PREFIX = `the-atelier:v${PROFILE_CACHE_VERSION}:profiles`;
```

- [ ] Key cache by `userId` and `sessionKey`, not a global key.

```ts
function getProfileCacheKey(userId: string) {
  return `${PROFILE_CACHE_PREFIX}:${userId}`;
}
```

- [ ] Validate before using cache:

```ts
function isValidProfileCachePayload(
  value: unknown,
  userId: string,
  sessionKey: string,
): value is ProfileCachePayload {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as ProfileCachePayload).userId === userId &&
      (value as ProfileCachePayload).sessionKey === sessionKey &&
      typeof (value as ProfileCachePayload).cachedAt === 'string' &&
      Array.isArray((value as ProfileCachePayload).profiles),
  );
}
```

- [ ] Write tests for:
  - matching user/session accepts cache
  - different user rejects cache
  - different session rejects cache
  - malformed JSON rejects cache and removes it

- [ ] Run:

```bash
pnpm test
pnpm run lint
```

Expected: tests pass and TypeScript reports no errors.

---

### Task 2: Add app cache clearing APIs

**Files:**
- Modify: `/Users/yani/Dev/Medidas/the-atelier/src/storage.ts`
- Test: `/Users/yani/Dev/Medidas/the-atelier/tests/profile-cache.test.ts`

- [ ] Add `clearProfileCacheForUser(userId: string)`.
- [ ] Add `clearAllAtelierLocalCache()` that removes only keys beginning with `the-atelier:`.
- [ ] Do not call `localStorage.clear()` because that may delete unrelated browser data.

Implementation intent:

```ts
export function clearAllAtelierLocalCache() {
  if (typeof localStorage === 'undefined') return;

  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith('the-atelier:')) {
      localStorage.removeItem(key);
    }
  }
}
```

- [ ] Test that non-Atelier keys survive.
- [ ] Run `pnpm test` and `pnpm run lint`.

---

### Task 3: Load cached profiles only as a same-session acceleration path

**Files:**
- Modify: `/Users/yani/Dev/Medidas/the-atelier/src/storage.ts`
- Modify: `/Users/yani/Dev/Medidas/the-atelier/src/App.tsx`

- [ ] Add a storage API that returns cached profiles for current user/session if valid.

Example API:

```ts
export async function loadCachedProfiles(sessionKey: string) {
  const {userId} = await getAuthenticatedSupabaseContext();
  return readCachedProfiles(userId, sessionKey);
}
```

- [ ] Keep `loadProfiles()` as the confirmed Supabase read.
- [ ] In `App.tsx`, generate a `sessionKey` when a new signed-in session/user is observed.
- [ ] On signed-in hydration:
  1. Try valid same-session cache.
  2. If present, render it quickly with a loading/revalidating state.
  3. Always call `loadProfiles()` afterward.
  4. Replace state and cache with the confirmed Supabase result.
  5. If Supabase fails, do not silently present cache as current; show the existing offline/service error.

Acceptance rule: cached numbers may speed the transition, but the UI must still make a Supabase pass before treating data as fully ready.

- [ ] Run `pnpm run lint`.

---

### Task 4: Update cache after every successful profile mutation

**Files:**
- Modify: `/Users/yani/Dev/Medidas/the-atelier/src/storage.ts`
- Modify: `/Users/yani/Dev/Medidas/the-atelier/src/App.tsx`

- [ ] After `createProfile` succeeds, append/prepend the returned server profile to cache.
- [ ] After `updateProfile` succeeds, replace that profile in cache with the returned server profile.
- [ ] After `deleteProfile` succeeds, remove the deleted profile from cache.
- [ ] Cache writes must happen only after the Supabase operation returns successfully.

Preferred App-level helper:

```ts
function replaceProfilesFromServer(nextProfiles: Profile[]) {
  setProfiles(nextProfiles);
  writeProfilesCacheForCurrentSession(nextProfiles);
}
```

If keeping cache writes inside `storage.ts`, pass the `sessionKey` explicitly from `App.tsx` so writes stay scoped to the current login.

- [ ] Run `pnpm run lint`.

---

### Task 5: Update cache after every successful measurement edit

**Files:**
- Modify: `/Users/yani/Dev/Medidas/the-atelier/src/App.tsx`
- Possibly modify: `/Users/yani/Dev/Medidas/the-atelier/src/storage.ts`

- [ ] In `handleSaveMeasurement`, keep the current behavior: call `saveStoredMeasurement` first.
- [ ] Use only the returned `updatedProfile` to update state and cache.
- [ ] Never write the locally typed `valueCm` directly into cache before Supabase confirms.

Acceptance rule: if Supabase rejects the edit, React state and localStorage must both keep the previous confirmed number.

- [ ] Add or update tests where practical for the pure cache update function.
- [ ] Run `pnpm test` and `pnpm run lint`.

---

### Task 6: Clear app cache on login/user transitions and sign-out

**Files:**
- Modify: `/Users/yani/Dev/Medidas/the-atelier/src/App.tsx`
- Use: `/Users/yani/Dev/Medidas/the-atelier/src/storage.ts`

- [ ] Track the previous authenticated Supabase user id in a ref.
- [ ] On `SIGNED_IN` or any auth callback where the user id changes, call `clearAllAtelierLocalCache()` before hydrating profile data.
- [ ] On sign-out success, call `clearAllAtelierLocalCache()`.
- [ ] In the existing `authStatus !== 'signed_in'` cleanup effect, also clear app cache as a defensive measure.

Acceptance rule: after logging in as a new user, no profile or measurement cache from the previous user can be read.

- [ ] Run `pnpm run lint`.

---

### Task 7: Optional performance improvement without new dependencies

**Files:**
- Modify: `/Users/yani/Dev/Medidas/the-atelier/src/storage.ts`

- [ ] Reduce duplicate reads after mutations where safe:
  - `saveMeasurement` currently upserts, then calls `loadProfileById`.
  - Keep this if needed for correctness/history timestamps.
  - If optimizing, use Supabase `select` after upsert only if it returns the full confirmed row shape needed by the app.
- [ ] Do not add production dependencies.
- [ ] If a cache fingerprint is needed later, prefer a small Supabase SQL RPC over an npm package.

- [ ] Run `pnpm run build` after changes.

---

### Task 8: Final verification

**Files:**
- All changed files.

- [ ] Run the full verification set:

```bash
pnpm test
pnpm run lint
pnpm run build
```

- [ ] Manual verification in browser:
  - Sign in.
  - Confirm cache key appears under `the-atelier:`.
  - Edit a measurement.
  - Reload and confirm the shown number matches the server-confirmed edit.
  - Sign out and confirm `the-atelier:` localStorage keys are gone.
  - Sign in again and confirm app cache starts fresh.

- [ ] Commit only after tests and manual checks pass.

Suggested commit message:

```bash
git add src/storage.ts src/App.tsx tests/profile-cache.test.ts docs/superpowers/plans/2026-04-30-localstorage-measurement-cache.md
git commit -m "plan: add local measurement cache checklist"
```

---

## Self-Review

- Spec coverage: covers localStorage caching, no stale measurement truth, cache clearing on new login/sign-out, cache updates after measurement edits, and optional no-dependency performance improvements.
- Placeholder scan: no TBD/TODO placeholders; optional future RPC is explicitly non-blocking.
- Type consistency: cache terms consistently use `Profile`, `userId`, `sessionKey`, and `the-atelier:` localStorage prefix.
