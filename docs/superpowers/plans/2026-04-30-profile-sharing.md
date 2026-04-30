# Profile Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build profile sharing so users can export/import current profile snapshots by file and by public unguessable 24-hour links.

**Architecture:** Add a shared `ProfileShareSnapshotV1` utility layer used by both file and link flows. File import/export stays browser-local; temporary links persist snapshots in Supabase with hashed tokens and narrow RPC access. Import always creates a new profile and current measurements only.

**Tech Stack:** Vite, React 19, TypeScript, Supabase/Postgres/RLS, Node `tsx --test`, existing `pnpm` scripts.

---

## Reference design

Read `/Users/yani/Dev/Medidas/the-atelier/docs/plans/2026-04-30-profile-sharing-design.md` before starting.

## File map

- Create `/Users/yani/Dev/Medidas/the-atelier/src/profileShare.ts` — snapshot types, builder, parser, validator, filename helper, browser download helper.
- Create `/Users/yani/Dev/Medidas/the-atelier/tests/profile-share.test.ts` — unit tests for snapshot building/validation and ID/history exclusion.
- Modify `/Users/yani/Dev/Medidas/the-atelier/src/storage.ts` — add import-as-new-profile save helper, temporary link creation/resolution helpers, token hashing utilities.
- Create `/Users/yani/Dev/Medidas/the-atelier/tests/profile-share-storage.test.ts` — storage-level tests using mock Supabase clients where possible.
- Modify `/Users/yani/Dev/Medidas/the-atelier/src/App.tsx` — add Share Profile and Import Profile UI, import preview state, file handling, and temporary-link route handling.
- Create `/Users/yani/Dev/Medidas/the-atelier/supabase/migrations/202604300002_profile_share_links.sql` — `profile_share_links` table, indexes, RLS, and RPCs.
- Modify `/Users/yani/Dev/Medidas/the-atelier/README.md` — document export/import and migration.

---

### Task 1: Snapshot utility and tests

**Files:**
- Create: `/Users/yani/Dev/Medidas/the-atelier/src/profileShare.ts`
- Create: `/Users/yani/Dev/Medidas/the-atelier/tests/profile-share.test.ts`

- [ ] **Step 1: Write failing snapshot tests**

Create `/Users/yani/Dev/Medidas/the-atelier/tests/profile-share.test.ts`:

```ts
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {createEmptyMeasurements} from '../src/measurements';
import {
  PROFILE_SHARE_KIND,
  PROFILE_SHARE_VERSION,
  buildProfileShareSnapshot,
  parseProfileShareSnapshot,
  toProfileShareFilename,
} from '../src/profileShare';
import type {Profile} from '../src/types';

const profile: Profile = {
  createdAt: '2026-01-01T00:00:00.000Z',
  heightCm: 172,
  id: 'profile-1',
  measurements: {
    ...createEmptyMeasurements(),
    waist: 71,
    hips: 94,
  },
  name: 'Sofia Rivera',
  sex: 'female',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('profile share snapshots', () => {
  it('builds a versioned snapshot with current profile data only', () => {
    const snapshot = buildProfileShareSnapshot(profile, 'cm', '2026-04-30T12:00:00.000Z');

    assert.equal(snapshot.kind, PROFILE_SHARE_KIND);
    assert.equal(snapshot.version, PROFILE_SHARE_VERSION);
    assert.equal(snapshot.exportedAt, '2026-04-30T12:00:00.000Z');
    assert.deepEqual(snapshot.profile, {
      heightCm: 172,
      name: 'Sofia Rivera',
      sex: 'female',
    });
    assert.equal(snapshot.measurements.waist, 71);
    assert.equal(snapshot.measurements.hips, 94);
    assert.equal(snapshot.units, 'cm');
    assert.equal('id' in snapshot.profile, false);
    assert.equal('createdAt' in snapshot.profile, false);
    assert.equal('updatedAt' in snapshot.profile, false);
  });

  it('parses a valid snapshot and strips unexpected identity fields', () => {
    const parsed = parseProfileShareSnapshot({
      kind: 'atelier.profile-share',
      version: 1,
      exportedAt: '2026-04-30T12:00:00.000Z',
      sourceApp: 'the-atelier',
      profile: {
        id: 'should-not-survive',
        heightCm: 180,
        name: 'Imported',
        sex: 'male',
        userId: 'owner-1',
      },
      measurements: {
        waist: 82,
        neck: 39,
      },
      units: 'cm',
      history: [{measurementKey: 'waist'}],
    });

    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.deepEqual(parsed.snapshot.profile, {
        heightCm: 180,
        name: 'Imported',
        sex: 'male',
      });
      assert.equal(parsed.snapshot.measurements.waist, 82);
      assert.equal(parsed.snapshot.measurements.neck, 39);
      assert.equal(parsed.snapshot.measurements.hips, 0);
      assert.equal('history' in parsed.snapshot, false);
    }
  });

  it('rejects malformed snapshots', () => {
    assert.deepEqual(parseProfileShareSnapshot(null), {
      ok: false,
      error: 'Import file is not a valid profile share snapshot.',
    });
    assert.deepEqual(parseProfileShareSnapshot({kind: 'wrong'}), {
      ok: false,
      error: 'Import file is not an Atelier profile share file.',
    });
    assert.deepEqual(parseProfileShareSnapshot({kind: 'atelier.profile-share', version: 99}), {
      ok: false,
      error: 'This profile share version is not supported.',
    });
  });

  it('rejects unknown measurement keys and invalid values', () => {
    assert.equal(
      parseProfileShareSnapshot({
        kind: 'atelier.profile-share',
        version: 1,
        exportedAt: '2026-04-30T12:00:00.000Z',
        sourceApp: 'the-atelier',
        profile: {heightCm: 170, name: 'Bad', sex: 'female'},
        measurements: {unknownKey: 10},
        units: 'cm',
      }).ok,
      false,
    );

    assert.equal(
      parseProfileShareSnapshot({
        kind: 'atelier.profile-share',
        version: 1,
        exportedAt: '2026-04-30T12:00:00.000Z',
        sourceApp: 'the-atelier',
        profile: {heightCm: 170, name: 'Bad', sex: 'female'},
        measurements: {waist: 401},
        units: 'cm',
      }).ok,
      false,
    );
  });

  it('creates a safe filename from the profile name and date', () => {
    assert.equal(
      toProfileShareFilename('Sofia Rivera / Spring', '2026-04-30T12:00:00.000Z'),
      'atelier-profile-sofia-rivera-spring-2026-04-30.json',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- tests/profile-share.test.ts
```

Expected: FAIL because `/Users/yani/Dev/Medidas/the-atelier/src/profileShare.ts` does not exist.

- [ ] **Step 3: Implement snapshot utilities**

Create `/Users/yani/Dev/Medidas/the-atelier/src/profileShare.ts`:

```ts
import {createEmptyMeasurements, measurementDefinitionsByKey} from './measurements';
import {getMeasurementMax, MAX_HEIGHT_CM, MAX_PROFILE_NAME_LENGTH, MIN_HEIGHT_CM} from './validation';
import type {MeasurementKey, Measurements, Profile, Sex, Unit} from './types';

export const PROFILE_SHARE_KIND = 'atelier.profile-share' as const;
export const PROFILE_SHARE_VERSION = 1 as const;

export type ProfileShareSnapshotV1 = {
  kind: typeof PROFILE_SHARE_KIND;
  version: typeof PROFILE_SHARE_VERSION;
  exportedAt: string;
  sourceApp: 'the-atelier';
  profile: {
    name: string;
    heightCm: number;
    sex: Sex;
  };
  measurements: Measurements;
  units: Unit;
};

export type ProfileShareParseResult =
  | {ok: true; snapshot: ProfileShareSnapshotV1}
  | {ok: false; error: string};

const measurementKeys = Object.keys(measurementDefinitionsByKey) as MeasurementKey[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isSex(value: unknown): value is Sex {
  return value === 'female' || value === 'male';
}

function isUnit(value: unknown): value is Unit {
  return value === 'cm' || value === 'in';
}

function isValidNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeProfileName(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_PROFILE_NAME_LENGTH) : '';
}

function parseMeasurements(value: unknown): {ok: true; measurements: Measurements} | {ok: false; error: string} {
  if (!isRecord(value)) {
    return {ok: false, error: 'Import file is missing measurements.'};
  }

  const measurements = createEmptyMeasurements();

  for (const key of Object.keys(value)) {
    if (!(key in measurementDefinitionsByKey)) {
      return {ok: false, error: `Import file contains an unknown measurement: ${key}.`};
    }

    const measurementKey = key as MeasurementKey;
    const measurementValue = value[measurementKey];

    if (!isValidNumber(measurementValue)) {
      return {ok: false, error: `Import file contains an invalid value for ${measurementKey}.`};
    }

    if (measurementValue < 0 || measurementValue > getMeasurementMax(measurementKey)) {
      return {ok: false, error: `Import file contains an out-of-range value for ${measurementKey}.`};
    }

    measurements[measurementKey] = measurementValue;
  }

  return {ok: true, measurements};
}

export function buildProfileShareSnapshot(
  profile: Profile,
  units: Unit,
  exportedAt = new Date().toISOString(),
): ProfileShareSnapshotV1 {
  return {
    kind: PROFILE_SHARE_KIND,
    version: PROFILE_SHARE_VERSION,
    exportedAt,
    sourceApp: 'the-atelier',
    profile: {
      heightCm: profile.heightCm,
      name: profile.name.trim(),
      sex: profile.sex,
    },
    measurements: {...profile.measurements},
    units,
  };
}

export function parseProfileShareSnapshot(value: unknown): ProfileShareParseResult {
  if (!isRecord(value)) {
    return {ok: false, error: 'Import file is not a valid profile share snapshot.'};
  }

  if (value.kind !== PROFILE_SHARE_KIND) {
    return {ok: false, error: 'Import file is not an Atelier profile share file.'};
  }

  if (value.version !== PROFILE_SHARE_VERSION) {
    return {ok: false, error: 'This profile share version is not supported.'};
  }

  if (typeof value.exportedAt !== 'string' || Number.isNaN(Date.parse(value.exportedAt))) {
    return {ok: false, error: 'Import file has an invalid export date.'};
  }

  if (value.sourceApp !== 'the-atelier') {
    return {ok: false, error: 'Import file source is not supported.'};
  }

  if (!isRecord(value.profile)) {
    return {ok: false, error: 'Import file is missing profile data.'};
  }

  const name = normalizeProfileName(value.profile.name);
  const heightCm = value.profile.heightCm;
  const sex = value.profile.sex;

  if (!name) {
    return {ok: false, error: 'Import file is missing a profile name.'};
  }

  if (!isValidNumber(heightCm) || heightCm < MIN_HEIGHT_CM || heightCm > MAX_HEIGHT_CM) {
    return {ok: false, error: 'Import file contains an invalid height.'};
  }

  if (!isSex(sex)) {
    return {ok: false, error: 'Import file contains an invalid sex value.'};
  }

  if (!isUnit(value.units)) {
    return {ok: false, error: 'Import file contains an invalid unit.'};
  }

  const parsedMeasurements = parseMeasurements(value.measurements);

  if (!parsedMeasurements.ok) {
    return parsedMeasurements;
  }

  return {
    ok: true,
    snapshot: {
      kind: PROFILE_SHARE_KIND,
      version: PROFILE_SHARE_VERSION,
      exportedAt: value.exportedAt,
      sourceApp: 'the-atelier',
      profile: {heightCm, name, sex},
      measurements: parsedMeasurements.measurements,
      units: value.units,
    },
  };
}

export function parseProfileShareJson(serialized: string): ProfileShareParseResult {
  try {
    return parseProfileShareSnapshot(JSON.parse(serialized));
  } catch {
    return {ok: false, error: 'Import file is not valid JSON.'};
  }
}

export function toProfileShareFilename(profileName: string, exportedAt = new Date().toISOString()) {
  const safeName = profileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'profile';
  const date = exportedAt.slice(0, 10);

  return `atelier-profile-${safeName}-${date}.json`;
}

export function serializeProfileShareSnapshot(snapshot: ProfileShareSnapshotV1) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function downloadProfileShareSnapshot(snapshot: ProfileShareSnapshotV1) {
  const blob = new Blob([serializeProfileShareSnapshot(snapshot)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = toProfileShareFilename(snapshot.profile.name, snapshot.exportedAt);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
pnpm test -- tests/profile-share.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run full validation**

Run:

```bash
pnpm test
pnpm lint
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/profileShare.ts tests/profile-share.test.ts
git commit -m "feat: add profile share snapshots"
```

---

### Task 2: Import-as-new-profile storage helper

**Files:**
- Modify: `/Users/yani/Dev/Medidas/the-atelier/src/storage.ts`
- Create: `/Users/yani/Dev/Medidas/the-atelier/tests/profile-share-storage.test.ts`

- [ ] **Step 1: Add storage test for helper shape**

Create `/Users/yani/Dev/Medidas/the-atelier/tests/profile-share-storage.test.ts`:

```ts
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {createEmptyMeasurements} from '../src/measurements';
import {buildImportedProfilePayload} from '../src/storage';
import type {ProfileShareSnapshotV1} from '../src/profileShare';

const snapshot: ProfileShareSnapshotV1 = {
  kind: 'atelier.profile-share',
  version: 1,
  exportedAt: '2026-04-30T12:00:00.000Z',
  sourceApp: 'the-atelier',
  profile: {
    heightCm: 168,
    name: 'Imported Sofia',
    sex: 'female',
  },
  measurements: {
    ...createEmptyMeasurements(),
    waist: 72,
    hips: 95,
  },
  units: 'cm',
};

describe('profile share storage helpers', () => {
  it('builds profile and measurement rows without source identity or history', () => {
    const payload = buildImportedProfilePayload(snapshot, 'user-1');

    assert.deepEqual(payload.profile, {
      height_cm: 168,
      name: 'Imported Sofia',
      sex: 'female',
      user_id: 'user-1',
    });
    assert.deepEqual(payload.measurements, [
      {measurement_key: 'waist', value_cm: 72},
      {measurement_key: 'hips', value_cm: 95},
    ]);
    assert.equal('id' in payload.profile, false);
    assert.equal('history' in payload, false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- tests/profile-share-storage.test.ts
```

Expected: FAIL because `buildImportedProfilePayload` is not exported.

- [ ] **Step 3: Add storage helpers**

In `/Users/yani/Dev/Medidas/the-atelier/src/storage.ts`, import the snapshot type:

```ts
import type {ProfileShareSnapshotV1} from './profileShare';
```

Add this helper near `ProfilePayload`:

```ts
export type ImportedProfilePayload = {
  profile: {
    height_cm: number;
    name: string;
    sex: Sex;
    user_id: string;
  };
  measurements: Array<{
    measurement_key: MeasurementKey;
    value_cm: number;
  }>;
};

export function buildImportedProfilePayload(
  snapshot: ProfileShareSnapshotV1,
  userId: string,
): ImportedProfilePayload {
  const measurements = (Object.entries(snapshot.measurements) as Array<[MeasurementKey, number]>)
    .filter(([, valueCm]) => valueCm > 0)
    .map(([measurementKey, valueCm]) => ({
      measurement_key: measurementKey,
      value_cm: valueCm,
    }));

  return {
    profile: {
      height_cm: snapshot.profile.heightCm,
      name: snapshot.profile.name.trim(),
      sex: snapshot.profile.sex,
      user_id: userId,
    },
    measurements,
  };
}
```

Add this async helper after `createProfile`:

```ts
export async function importProfileShareSnapshot(snapshot: ProfileShareSnapshotV1) {
  try {
    const {supabase, userId} = await getAuthenticatedSupabaseContext();
    const payload = buildImportedProfilePayload(snapshot, userId);
    const {data, error} = await supabase
      .from('profiles')
      .insert(payload.profile)
      .select('id, name, sex, height_cm, created_at, updated_at, user_id')
      .single();

    if (error) {
      throw error;
    }

    const profileRow = data as ProfileRow;

    if (payload.measurements.length > 0) {
      const {error: measurementsError} = await supabase.from('measurements').insert(
        payload.measurements.map((measurement) => ({
          profile_id: profileRow.id,
          ...measurement,
        })),
      );

      if (measurementsError) {
        throw measurementsError;
      }
    }

    const importedProfile = await loadProfileById(supabase, profileRow.id);

    if (!importedProfile) {
      throw new Error('Imported profile not found.');
    }

    return importedProfile;
  } catch (error) {
    throw normalizeSupabaseError(error);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test -- tests/profile-share-storage.test.ts
pnpm test
pnpm lint
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage.ts tests/profile-share-storage.test.ts
git commit -m "feat: import shared profiles as new profiles"
```

---

### Task 3: File export/import UI

**Files:**
- Modify: `/Users/yani/Dev/Medidas/the-atelier/src/App.tsx`

- [ ] **Step 1: Add imports**

In `/Users/yani/Dev/Medidas/the-atelier/src/App.tsx`, add icons:

```ts
import {
  Check,
  ChevronDown,
  Clock3,
  Download,
  FileUp,
  History,
  Link2,
  LoaderCircle,
  LogOut,
  PencilLine,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
```

Add profile share imports:

```ts
import {
  buildProfileShareSnapshot,
  downloadProfileShareSnapshot,
  parseProfileShareJson,
  type ProfileShareSnapshotV1,
} from './profileShare';
```

Add storage import:

```ts
  importProfileShareSnapshot,
```

inside the existing `./storage` import list.

- [ ] **Step 2: Add state**

Inside `App()`, near other modal/action state:

```ts
  const [isShareProfileOpen, setIsShareProfileOpen] = useState(false);
  const [importSnapshot, setImportSnapshot] = useState<ProfileShareSnapshotV1 | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImportingProfile, setIsImportingProfile] = useState(false);
  const fileImportInputRef = useRef<HTMLInputElement | null>(null);
```

- [ ] **Step 3: Add handlers**

Inside `App()`, before `return`, add:

```ts
  function handleDownloadProfileShare() {
    if (!selectedProfile) {
      return;
    }

    const snapshot = buildProfileShareSnapshot(selectedProfile, unit);
    downloadProfileShareSnapshot(snapshot);
    setIsShareProfileOpen(false);
  }

  function handleChooseImportFile() {
    setImportError(null);
    fileImportInputRef.current?.click();
  }

  async function handleImportFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.json')) {
      setImportError('Choose an Atelier profile JSON file.');
      return;
    }

    try {
      const parsed = parseProfileShareJson(await file.text());

      if (!parsed.ok) {
        setImportError(parsed.error);
        return;
      }

      setImportSnapshot(parsed.snapshot);
      setImportError(null);
    } catch (error) {
      setImportError(getErrorMessage(error, 'Unable to read import file.'));
    }
  }

  async function handleConfirmImportProfile() {
    if (!importSnapshot) {
      return;
    }

    setIsImportingProfile(true);
    setImportError(null);

    try {
      const importedProfile = await importProfileShareSnapshot(importSnapshot);
      const nextProfiles = replaceProfileInCacheList(profiles, importedProfile, {insert: 'prepend'});
      setProfiles(nextProfiles);
      setSelectedProfileId(importedProfile.id);
      setImportSnapshot(null);

      if (authenticatedUserIdRef.current && profileSessionKeyRef.current) {
        writeProfileCache(
          window.localStorage,
          authenticatedUserIdRef.current,
          profileSessionKeyRef.current,
          nextProfiles,
        );
      }
    } catch (error) {
      setImportError(getErrorMessage(error, 'Unable to import profile.'));
    } finally {
      setIsImportingProfile(false);
    }
  }
```

If TypeScript complains about `React.ChangeEvent` because only named imports are used, change the first import to:

```ts
import type {ChangeEvent, ReactNode} from 'react';
```

and use `ChangeEvent<HTMLInputElement>` in the handler.

- [ ] **Step 4: Add action buttons**

Find the profile management controls near the add/edit/delete/profile menu buttons. Add:

```tsx
<button
  className="action-button"
  disabled={!selectedProfile}
  onClick={() => setIsShareProfileOpen(true)}
  type="button"
>
  <Upload size={16} />
  Share Profile
</button>
<button className="action-button" onClick={handleChooseImportFile} type="button">
  <FileUp size={16} />
  Import Profile
</button>
<input
  accept="application/json,.json"
  className="sr-only"
  onChange={handleImportFileChange}
  ref={fileImportInputRef}
  type="file"
/>
```

Use the nearest existing button class if `action-button` is not present.

- [ ] **Step 5: Add share modal**

Near the existing modal JSX, add:

```tsx
<AnimatePresence>
  {isShareProfileOpen && selectedProfile ? (
    <motion.div className="modal-backdrop" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>
      <motion.section
        aria-labelledby="share-profile-title"
        className="modal-card"
        initial={{opacity: 0, y: 16}}
        animate={{opacity: 1, y: 0}}
        exit={{opacity: 0, y: 16}}
        role="dialog"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Share profile</p>
            <h2 id="share-profile-title">Share {selectedProfile.name}</h2>
          </div>
          <button aria-label="Close share profile" onClick={() => setIsShareProfileOpen(false)} type="button">
            <X size={18} />
          </button>
        </div>
        <p className="muted-copy">
          Share current measurements only. History and account details are never included.
        </p>
        <div className="share-actions">
          <button className="primary-action" onClick={handleDownloadProfileShare} type="button">
            <Download size={18} />
            Download profile file
          </button>
          <button className="secondary-action" disabled type="button" title="Temporary links are added in the next task">
            <Link2 size={18} />
            Create 24-hour import link
          </button>
        </div>
      </motion.section>
    </motion.div>
  ) : null}
</AnimatePresence>
```

- [ ] **Step 6: Add import preview modal**

Near the share modal, add:

```tsx
<AnimatePresence>
  {importSnapshot ? (
    <motion.div className="modal-backdrop" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>
      <motion.section
        aria-labelledby="import-profile-title"
        className="modal-card"
        initial={{opacity: 0, y: 16}}
        animate={{opacity: 1, y: 0}}
        exit={{opacity: 0, y: 16}}
        role="dialog"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Import profile</p>
            <h2 id="import-profile-title">{importSnapshot.profile.name}</h2>
          </div>
          <button aria-label="Cancel import" onClick={() => setImportSnapshot(null)} type="button">
            <X size={18} />
          </button>
        </div>
        <p className="muted-copy">This creates a new profile. History is not included.</p>
        <dl className="import-summary">
          <div><dt>Height</dt><dd>{importSnapshot.profile.heightCm} cm</dd></div>
          <div><dt>Sex</dt><dd>{importSnapshot.profile.sex}</dd></div>
          <div><dt>Measurements</dt><dd>{Object.values(importSnapshot.measurements).filter((value) => value > 0).length}</dd></div>
        </dl>
        {importError ? <p className="form-error">{importError}</p> : null}
        <div className="modal-actions">
          <button className="secondary-action" onClick={() => setImportSnapshot(null)} type="button">Cancel</button>
          <button className="primary-action" disabled={isImportingProfile} onClick={handleConfirmImportProfile} type="button">
            {isImportingProfile ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
            Import as new profile
          </button>
        </div>
      </motion.section>
    </motion.div>
  ) : null}
</AnimatePresence>
```

- [ ] **Step 7: Surface file errors**

Near the main profile action area or existing `actionError`, render:

```tsx
{importError && !importSnapshot ? <p className="form-error">{importError}</p> : null}
```

- [ ] **Step 8: Run validation**

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: all PASS. If CSS class names do not exist, reuse existing modal/button classes in `/Users/yani/Dev/Medidas/the-atelier/src/App.tsx` and `/Users/yani/Dev/Medidas/the-atelier/src/index.css` instead of adding a new visual system.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/index.css
git commit -m "feat: add file profile sharing UI"
```

---

### Task 4: Supabase temporary-link schema

**Files:**
- Create: `/Users/yani/Dev/Medidas/the-atelier/supabase/migrations/202604300002_profile_share_links.sql`
- Modify: `/Users/yani/Dev/Medidas/the-atelier/README.md`

- [ ] **Step 1: Create migration**

Create `/Users/yani/Dev/Medidas/the-atelier/supabase/migrations/202604300002_profile_share_links.sql`:

```sql
create extension if not exists pgcrypto;

create table if not exists public.profile_share_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  snapshot jsonb not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  imported_count integer not null default 0,
  revoked_at timestamptz,
  constraint profile_share_links_snapshot_object check (jsonb_typeof(snapshot) = 'object'),
  constraint profile_share_links_imported_count_nonnegative check (imported_count >= 0),
  constraint profile_share_links_expires_after_created check (expires_at > created_at)
);

create index if not exists profile_share_links_created_by_idx
  on public.profile_share_links (created_by, created_at desc);

create index if not exists profile_share_links_expires_at_idx
  on public.profile_share_links (expires_at);

alter table public.profile_share_links enable row level security;

create policy "Users can create their own profile share links"
  on public.profile_share_links
  for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "Users can view their own profile share links"
  on public.profile_share_links
  for select
  to authenticated
  using (created_by = auth.uid());

create policy "Users can revoke their own profile share links"
  on public.profile_share_links
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create or replace function public.resolve_profile_share_link(raw_token text)
returns table (snapshot jsonb, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  hashed_token text := encode(digest(raw_token, 'sha256'), 'hex');
begin
  return query
  select psl.snapshot, psl.expires_at
  from public.profile_share_links psl
  where psl.token_hash = hashed_token
    and psl.revoked_at is null
    and psl.expires_at > now()
  limit 1;
end;
$$;

create or replace function public.mark_profile_share_link_imported(raw_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hashed_token text := encode(digest(raw_token, 'sha256'), 'hex');
begin
  update public.profile_share_links
  set imported_count = imported_count + 1
  where token_hash = hashed_token
    and revoked_at is null
    and expires_at > now();
end;
$$;

grant execute on function public.resolve_profile_share_link(text) to authenticated;
grant execute on function public.mark_profile_share_link_imported(text) to authenticated;
```

- [ ] **Step 2: Update README migration list**

In `/Users/yani/Dev/Medidas/the-atelier/README.md`, add the migration path to the setup list:

```md
supabase/migrations/202604300002_profile_share_links.sql
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202604300002_profile_share_links.sql README.md
git commit -m "feat: add profile share link schema"
```

---

### Task 5: Temporary-link storage helpers and tests

**Files:**
- Modify: `/Users/yani/Dev/Medidas/the-atelier/src/storage.ts`
- Modify: `/Users/yani/Dev/Medidas/the-atelier/tests/profile-share-storage.test.ts`

- [ ] **Step 1: Add token helper tests**

Append to `/Users/yani/Dev/Medidas/the-atelier/tests/profile-share-storage.test.ts`:

```ts
import {
  createProfileShareToken,
  getProfileShareTokenHash,
  getProfileShareExpiry,
} from '../src/storage';

describe('profile share link token helpers', () => {
  it('creates unguessable url-safe tokens', () => {
    const token = createProfileShareToken(new Uint8Array([1, 2, 3, 250, 251, 252]));

    assert.equal(token, 'AQID-vv8');
    assert.match(createProfileShareToken(), /^[A-Za-z0-9_-]{43}$/);
  });

  it('hashes tokens without returning the raw token', async () => {
    const hash = await getProfileShareTokenHash('secret-token');

    assert.equal(hash.length, 64);
    assert.notEqual(hash, 'secret-token');
  });

  it('sets expiry to 24 hours after creation', () => {
    assert.equal(
      getProfileShareExpiry('2026-04-30T12:00:00.000Z'),
      '2026-05-01T12:00:00.000Z',
    );
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
pnpm test -- tests/profile-share-storage.test.ts
```

Expected: FAIL because token helpers are missing.

- [ ] **Step 3: Add token and link helpers**

In `/Users/yani/Dev/Medidas/the-atelier/src/storage.ts`, add after constants:

```ts
export const PROFILE_SHARE_LINK_TTL_HOURS = 24;
```

Add helper functions near other exported helpers:

```ts
function toBase64Url(bytes: Uint8Array) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function createProfileShareToken(bytes?: Uint8Array) {
  const tokenBytes = bytes ?? crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(tokenBytes);
}

export async function getProfileShareTokenHash(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function getProfileShareExpiry(createdAt = new Date().toISOString()) {
  const expiresAt = new Date(createdAt);
  expiresAt.setHours(expiresAt.getHours() + PROFILE_SHARE_LINK_TTL_HOURS);
  return expiresAt.toISOString();
}
```

Add async helpers near `importProfileShareSnapshot`:

```ts
export async function createProfileShareLink(snapshot: ProfileShareSnapshotV1) {
  try {
    const {supabase, userId} = await getAuthenticatedSupabaseContext();
    const token = createProfileShareToken();
    const tokenHash = await getProfileShareTokenHash(token);
    const expiresAt = getProfileShareExpiry();
    const {error} = await supabase.from('profile_share_links').insert({
      created_by: userId,
      expires_at: expiresAt,
      snapshot,
      token_hash: tokenHash,
    });

    if (error) {
      throw error;
    }

    return {expiresAt, token};
  } catch (error) {
    throw normalizeSupabaseError(error);
  }
}

export async function resolveProfileShareLink(token: string) {
  try {
    const {supabase} = await getAuthenticatedSupabaseContext();
    const {data, error} = await supabase.rpc('resolve_profile_share_link', {raw_token: token});

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : null;

    if (!row?.snapshot) {
      throw new Error('Profile share link is invalid or expired.');
    }

    return row.snapshot;
  } catch (error) {
    throw normalizeSupabaseError(error);
  }
}

export async function markProfileShareLinkImported(token: string) {
  try {
    const {supabase} = await getAuthenticatedSupabaseContext();
    const {error} = await supabase.rpc('mark_profile_share_link_imported', {raw_token: token});

    if (error) {
      throw error;
    }
  } catch (error) {
    throw normalizeSupabaseError(error);
  }
}
```

- [ ] **Step 4: Run validation**

```bash
pnpm test -- tests/profile-share-storage.test.ts
pnpm test
pnpm lint
```

Expected: all PASS. If Node test environment lacks `btoa` or `crypto.subtle`, import `webcrypto` from `node:crypto` in tests and assign minimal globals only inside the test file.

- [ ] **Step 5: Commit**

```bash
git add src/storage.ts tests/profile-share-storage.test.ts
git commit -m "feat: add profile share link helpers"
```

---

### Task 6: Temporary-link UI and import route handling

**Files:**
- Modify: `/Users/yani/Dev/Medidas/the-atelier/src/App.tsx`

- [ ] **Step 1: Add storage imports**

In `/Users/yani/Dev/Medidas/the-atelier/src/App.tsx`, add to the storage import list:

```ts
  createProfileShareLink,
  markProfileShareLinkImported,
  resolveProfileShareLink,
```

- [ ] **Step 2: Add state**

Inside `App()` near import/share state:

```ts
  const [shareLink, setShareLink] = useState<{url: string; expiresAt: string} | null>(null);
  const [shareLinkError, setShareLinkError] = useState<string | null>(null);
  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false);
  const [pendingShareToken, setPendingShareToken] = useState<string | null>(null);
```

- [ ] **Step 3: Add link creation handler**

Inside `App()` before `return`:

```ts
  async function handleCreateProfileShareLink() {
    if (!selectedProfile) {
      return;
    }

    setIsCreatingShareLink(true);
    setShareLinkError(null);

    try {
      const snapshot = buildProfileShareSnapshot(selectedProfile, unit);
      const result = await createProfileShareLink(snapshot);
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('importProfileToken', result.token);
      setShareLink({url: url.toString(), expiresAt: result.expiresAt});
    } catch (error) {
      setShareLinkError(getErrorMessage(error, 'Unable to create share link.'));
    } finally {
      setIsCreatingShareLink(false);
    }
  }

  async function handleCopyShareLink() {
    if (!shareLink) {
      return;
    }

    await navigator.clipboard.writeText(shareLink.url);
  }
```

- [ ] **Step 4: Resolve import token on load**

Inside `App()`, add this effect after auth/profile load effects are established:

```ts
  useEffect(() => {
    if (authStatus !== 'signed_in') {
      return;
    }

    const token = new URLSearchParams(window.location.search).get('importProfileToken');

    if (!token) {
      return;
    }

    let isCancelled = false;
    setPendingShareToken(token);
    setImportError(null);

    resolveProfileShareLink(token)
      .then((rawSnapshot) => {
        if (isCancelled) {
          return;
        }

        const parsed = parseProfileShareSnapshot(rawSnapshot);

        if (!parsed.ok) {
          setImportError(parsed.error);
          return;
        }

        setImportSnapshot(parsed.snapshot);
      })
      .catch((error) => {
        if (!isCancelled) {
          setImportError(getErrorMessage(error, 'Unable to open profile share link.'));
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [authStatus]);
```

Make sure `parseProfileShareSnapshot` is imported from `./profileShare`.

- [ ] **Step 5: Mark imported links after successful import**

In `handleConfirmImportProfile`, after `const importedProfile = await importProfileShareSnapshot(importSnapshot);`, add:

```ts
      if (pendingShareToken) {
        await markProfileShareLinkImported(pendingShareToken);
        setPendingShareToken(null);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
```

- [ ] **Step 6: Enable link button in share modal**

Replace the disabled temporary link button from Task 3 with:

```tsx
<button className="secondary-action" disabled={isCreatingShareLink} onClick={handleCreateProfileShareLink} type="button">
  {isCreatingShareLink ? <LoaderCircle className="spin" size={18} /> : <Link2 size={18} />}
  Create 24-hour import link
</button>
```

Add below it:

```tsx
{shareLink ? (
  <div className="share-link-result">
    <p>Link expires {formatDateTime(shareLink.expiresAt)}.</p>
    <input readOnly value={shareLink.url} />
    <button className="secondary-action" onClick={handleCopyShareLink} type="button">Copy link</button>
  </div>
) : null}
{shareLinkError ? <p className="form-error">{shareLinkError}</p> : null}
```

- [ ] **Step 7: Run validation and browser QA**

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: all PASS.

Manual QA:

```bash
pnpm dev
```

Then verify in browser:

1. Select a profile.
2. Create a 24-hour import link.
3. Copy link.
4. Open link in another signed-in browser/session.
5. Confirm preview appears.
6. Import as new profile.
7. Confirm the imported profile has current measurements and no timeline history.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/index.css
git commit -m "feat: add temporary profile import links"
```

---

### Task 7: Final docs and release verification

**Files:**
- Modify: `/Users/yani/Dev/Medidas/the-atelier/README.md`
- Modify as needed: `/Users/yani/Dev/Medidas/the-atelier/docs/plans/2026-04-30-profile-sharing-design.md`

- [ ] **Step 1: Update README feature list**

In `/Users/yani/Dev/Medidas/the-atelier/README.md`, add bullets:

```md
- Export and import current profile snapshots without sharing history
- Create 24-hour profile import links for quick profile transfer
```

- [ ] **Step 2: Update setup notes**

Ensure README includes:

```md
supabase/migrations/202604300002_profile_share_links.sql
```

and note:

```md
Temporary profile import links store current profile snapshots in `profile_share_links` and expire after 24 hours.
```

- [ ] **Step 3: Full verification**

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: all PASS.

- [ ] **Step 4: Final manual QA checklist**

Check:

- File export downloads valid JSON.
- File import previews profile before saving.
- File import creates a new profile.
- Imported profile has current measurements.
- Imported profile has no height or measurement timeline history.
- Temporary link creation displays a URL and expiry.
- Temporary link opens preview in another session.
- Expired/revoked/invalid token shows an error.
- Profile IDs and owner IDs never appear in downloaded JSON.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/plans/2026-04-30-profile-sharing-design.md
git commit -m "docs: document profile sharing"
```

---

## Self-review

- Spec coverage: snapshot format, file export/import, temporary public unguessable 24-hour links, no history, import-as-new-profile, UX preview, RLS/RPC security, and testing are covered.
- Placeholder scan: no `TBD`, `TODO`, or unspecified “handle edge cases” steps remain.
- Type consistency: plan consistently uses `ProfileShareSnapshotV1`, `Profile`, `Measurements`, `MeasurementKey`, `Unit`, and existing storage/profile patterns.
