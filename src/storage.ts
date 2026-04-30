import {createEmptyMeasurements, measurementDefinitionsByKey} from './measurements';
import type {MeasurementKey, Measurements, Profile, Sex} from './types';

type ProfilePayload = {
  heightCm: number;
  name: string;
  sex: Sex;
};

export type ProfileCachePayload = {
  cachedAt: string;
  sessionKey: string;
  userId: string;
  profiles: Profile[];
};

type ProfileCacheStorage = Pick<Storage, 'getItem' | 'key' | 'length' | 'removeItem' | 'setItem'>;

type SupabaseClient = ReturnType<(typeof import('./supabase'))['getSupabaseBrowserClient']>;

export const PROFILE_CACHE_VERSION = 1;
export const PROFILE_CACHE_PREFIX = `the-atelier:v${PROFILE_CACHE_VERSION}:profiles`;

type TimestampValue = string | Date;

type ProfileRow = {
  created_at: TimestampValue;
  height_cm: number | string;
  id: string;
  name: string;
  sex: Sex;
  updated_at: TimestampValue;
  user_id: string | null;
};

type MeasurementRow = {
  measurement_key: MeasurementKey;
  profile_id: string;
  value_cm: number | string;
};

type ProfileHeightHistoryRow = {
  changed_at: TimestampValue;
  event_type: 'insert' | 'update';
  height_cm: number | string;
  previous_height_cm: number | string | null;
};

type MeasurementHistoryRow = {
  changed_at: TimestampValue;
  event_type: 'insert' | 'update' | 'delete';
  measurement_key: MeasurementKey;
  previous_value_cm: number | string | null;
  value_cm: number | string | null;
};

type MeasurementHistoryEntryRow = Omit<MeasurementHistoryRow, 'measurement_key'>;

export type ProfileHeightHistoryEntry = {
  changedAt: string;
  eventType: 'insert' | 'update';
  heightCm: number;
  previousHeightCm: number | null;
};

export type ProfileHeightHistoryResponse = {
  profileId: string;
  entries: ProfileHeightHistoryEntry[];
};

export type MeasurementHistoryEntry = {
  changedAt: string;
  eventType: 'insert' | 'update' | 'delete';
  previousValueCm: number | null;
  valueCm: number | null;
};

export type MeasurementHistoryResponse = {
  profileId: string;
  measurementKey: MeasurementKey;
  measurementLabel: string;
  entries: MeasurementHistoryEntry[];
};

export type ProfileTimelineResponse = {
  profileId: string;
  heightHistory: ProfileHeightHistoryResponse;
  measurementHistories: Partial<Record<MeasurementKey, MeasurementHistoryEntry[]>>;
};

const SERVICE_UNAVAILABLE_MESSAGE =
  'Supabase is unavailable right now. Check your connection and try again.';

function getProfileCacheUserPrefix(userId: string) {
  return `${PROFILE_CACHE_PREFIX}:${encodeURIComponent(userId)}:`;
}

function getLegacyProfileCacheKey(userId: string) {
  return `${PROFILE_CACHE_PREFIX}:${userId}`;
}

export function getProfileCacheKey(userId: string, sessionKey: string) {
  return `${getProfileCacheUserPrefix(userId)}${encodeURIComponent(sessionKey)}`;
}

export function serializeProfileCachePayload(payload: ProfileCachePayload) {
  return JSON.stringify(payload);
}

function isProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<Profile>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    (candidate.sex === 'female' || candidate.sex === 'male') &&
    typeof candidate.heightCm === 'number' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    !!candidate.measurements &&
    typeof candidate.measurements === 'object'
  );
}

export function validateProfileCachePayload(
  payload: unknown,
  userId: string,
  sessionKey: string,
): ProfileCachePayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as Partial<ProfileCachePayload>;

  if (
    candidate.userId !== userId ||
    candidate.sessionKey !== sessionKey ||
    typeof candidate.cachedAt !== 'string' ||
    !Array.isArray(candidate.profiles) ||
    !candidate.profiles.every(isProfile)
  ) {
    return null;
  }

  return candidate as ProfileCachePayload;
}

function safeGetItem(storage: ProfileCacheStorage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(storage: ProfileCacheStorage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // Cache writes are best effort. Ignore quota, privacy, or unavailable-storage failures.
  }
}

function safeRemoveItem(storage: ProfileCacheStorage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Cache cleanup is best effort. Ignore unavailable-storage failures.
  }
}

function safeCollectStorageKeys(storage: ProfileCacheStorage) {
  try {
    const keys: string[] = [];

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (key) {
        keys.push(key);
      }
    }

    return keys;
  } catch {
    return [];
  }
}

export function readProfileCache(
  storage: ProfileCacheStorage,
  userId: string,
  sessionKey: string,
) {
  const cacheKey = getProfileCacheKey(userId, sessionKey);
  const serialized = safeGetItem(storage, cacheKey);

  if (!serialized) {
    return null;
  }

  try {
    const payload = validateProfileCachePayload(JSON.parse(serialized), userId, sessionKey);

    if (!payload) {
      safeRemoveItem(storage, cacheKey);
      return null;
    }

    return payload?.profiles ?? null;
  } catch {
    safeRemoveItem(storage, cacheKey);
    return null;
  }
}

export function writeProfileCache(
  storage: ProfileCacheStorage,
  userId: string,
  sessionKey: string,
  profiles: Profile[],
  cachedAt = new Date().toISOString(),
) {
  safeSetItem(
    storage,
    getProfileCacheKey(userId, sessionKey),
    serializeProfileCachePayload({
      cachedAt,
      profiles,
      sessionKey,
      userId,
    }),
  );
}

export function replaceProfileInCacheList(
  profiles: Profile[],
  serverProfile: Profile,
  options: {insert?: 'append' | 'prepend'} = {},
) {
  const existingIndex = profiles.findIndex((profile) => profile.id === serverProfile.id);

  if (existingIndex !== -1) {
    return profiles.map((profile) =>
      profile.id === serverProfile.id ? serverProfile : profile,
    );
  }

  return options.insert === 'append'
    ? [...profiles, serverProfile]
    : [serverProfile, ...profiles];
}

export function removeProfileFromCacheList(profiles: Profile[], profileId: string) {
  return profiles.filter((profile) => profile.id !== profileId);
}

export async function loadCachedProfiles(sessionKey: string) {
  const storage = getBrowserLocalStorage();

  if (!storage) {
    return null;
  }

  try {
    const {userId} = await getAuthenticatedSupabaseContext();
    return readProfileCache(storage, userId, sessionKey);
  } catch {
    return null;
  }
}

function getBrowserLocalStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function clearProfileCacheForUser(
  userId: string,
  storage: ProfileCacheStorage | null = getBrowserLocalStorage(),
) {
  if (!storage) {
    return;
  }

  const userCachePrefix = getProfileCacheUserPrefix(userId);
  const legacyUserCacheKey = getLegacyProfileCacheKey(userId);
  const keysToRemove = safeCollectStorageKeys(storage).filter(
    (key) => key.startsWith(userCachePrefix) || key === legacyUserCacheKey,
  );

  for (const key of keysToRemove) {
    safeRemoveItem(storage, key);
  }
}

export function clearAllAtelierLocalCache(
  storage: ProfileCacheStorage | null = getBrowserLocalStorage(),
) {
  if (!storage) {
    return;
  }

  const keysToRemove = safeCollectStorageKeys(storage).filter((key) => key.startsWith('the-atelier:'));

  for (const key of keysToRemove) {
    safeRemoveItem(storage, key);
  }
}

function toIsoString(value: TimestampValue) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: number | string) {
  return typeof value === 'number' ? value : Number(value);
}

function toNullableNumber(value: number | string | null) {
  return value === null ? null : toNumber(value);
}

function mapProfile(row: ProfileRow, measurements: Measurements): Profile {
  return {
    createdAt: toIsoString(row.created_at),
    heightCm: toNumber(row.height_cm),
    id: row.id,
    measurements,
    name: row.name,
    sex: row.sex,
    updatedAt: toIsoString(row.updated_at),
  };
}

function buildMeasurementMap(rows: MeasurementRow[]) {
  const profiles = new Map<string, Measurements>();

  for (const row of rows) {
    const current = profiles.get(row.profile_id) ?? createEmptyMeasurements();
    current[row.measurement_key] = toNumber(row.value_cm);
    profiles.set(row.profile_id, current);
  }

  return profiles;
}

function normalizeSupabaseError(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as {message?: unknown}).message === 'string'
  ) {
    return new Error((error as {message: string}).message);
  }

  if (error instanceof Error && error.message) {
    if (error.name === 'TypeError') {
      return new Error(SERVICE_UNAVAILABLE_MESSAGE);
    }

    return error;
  }

  return new Error(SERVICE_UNAVAILABLE_MESSAGE);
}

async function loadSupabaseModule() {
  return import('./supabase');
}

async function getAuthenticatedSupabaseContext() {
  const {getSupabaseBrowserClient, isSupabaseAuthConfigured} = await loadSupabaseModule();

  if (!isSupabaseAuthConfigured) {
    throw new Error(
      'Supabase Auth is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }

  const supabase = getSupabaseBrowserClient();
  const {
    data: {session},
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token || !session.user?.id) {
    throw new Error('Sign in with Google to access profile data.');
  }

  return {
    supabase,
    userId: session.user.id,
  };
}

async function loadMeasurements(
  supabase: SupabaseClient,
  profileIds: string[],
) {
  if (profileIds.length === 0) {
    return [] as MeasurementRow[];
  }

  const {data, error} = await supabase
    .from('measurements')
    .select('profile_id, measurement_key, value_cm')
    .in('profile_id', profileIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as MeasurementRow[];
}

async function loadProfileById(
  supabase: SupabaseClient,
  profileId: string,
) {
  const {data, error} = await supabase
    .from('profiles')
    .select('id, name, sex, height_cm, created_at, updated_at, user_id')
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const measurementRows = await loadMeasurements(supabase, [profileId]);
  const measurements = buildMeasurementMap(measurementRows).get(profileId) ?? createEmptyMeasurements();

  return mapProfile(data as ProfileRow, measurements);
}

export async function loadProfiles() {
  try {
    const {supabase} = await getAuthenticatedSupabaseContext();
    const {data, error} = await supabase
      .from('profiles')
      .select('id, name, sex, height_cm, created_at, updated_at, user_id')
      .order('created_at', {ascending: false})
      .order('id', {ascending: false});

    if (error) {
      throw error;
    }

    const profileRows = (data ?? []) as ProfileRow[];
    const measurementRows = await loadMeasurements(supabase, profileRows.map((row) => row.id));
    const measurementsByProfile = buildMeasurementMap(measurementRows);

    return profileRows.map((row) =>
      mapProfile(row, measurementsByProfile.get(row.id) ?? createEmptyMeasurements()),
    );
  } catch (error) {
    throw normalizeSupabaseError(error);
  }
}

export async function createProfile(payload: ProfilePayload) {
  try {
    const {supabase, userId} = await getAuthenticatedSupabaseContext();
    const {data, error} = await supabase
      .from('profiles')
      .insert({
        height_cm: payload.heightCm,
        name: payload.name.trim(),
        sex: payload.sex,
        user_id: userId,
      })
      .select('id, name, sex, height_cm, created_at, updated_at, user_id')
      .single();

    if (error) {
      throw error;
    }

    return mapProfile(data as ProfileRow, createEmptyMeasurements());
  } catch (error) {
    throw normalizeSupabaseError(error);
  }
}

export async function updateProfile(profileId: string, payload: ProfilePayload) {
  try {
    const {supabase} = await getAuthenticatedSupabaseContext();
    const {data, error} = await supabase
      .from('profiles')
      .update({
        height_cm: payload.heightCm,
        name: payload.name.trim(),
        sex: payload.sex,
      })
      .eq('id', profileId)
      .select('id, name, sex, height_cm, created_at, updated_at, user_id')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Profile not found.');
    }

    const profile = await loadProfileById(supabase, profileId);

    if (!profile) {
      throw new Error('Profile not found.');
    }

    return profile;
  } catch (error) {
    throw normalizeSupabaseError(error);
  }
}

export async function deleteProfile(profileId: string) {
  try {
    const {supabase} = await getAuthenticatedSupabaseContext();
    const {error} = await supabase
      .from('profiles')
      .delete()
      .eq('id', profileId);

    if (error) {
      throw error;
    }
  } catch (error) {
    throw normalizeSupabaseError(error);
  }
}

export async function saveMeasurement(
  profileId: string,
  measurementKey: MeasurementKey,
  valueCm: number,
) {
  try {
    const {supabase} = await getAuthenticatedSupabaseContext();
    const {error} = await supabase
      .from('measurements')
      .upsert(
        {
          profile_id: profileId,
          measurement_key: measurementKey,
          value_cm: valueCm,
        },
        {onConflict: 'profile_id,measurement_key'},
      );

    if (error) {
      throw error;
    }

    const profile = await loadProfileById(supabase, profileId);

    if (!profile) {
      throw new Error('Profile not found.');
    }

    return profile;
  } catch (error) {
    throw normalizeSupabaseError(error);
  }
}

export async function loadProfileTimeline(profileId: string) {
  try {
    const {supabase} = await getAuthenticatedSupabaseContext();
    const [heightHistoryResponse, measurementHistoryResponse] = await Promise.all([
      supabase
        .from('profile_height_history')
        .select('id, changed_at, event_type, height_cm, previous_height_cm')
        .eq('profile_id', profileId)
        .order('changed_at', {ascending: true})
        .order('id', {ascending: true}),
      supabase
        .from('measurement_history')
        .select('id, profile_id, measurement_key, changed_at, event_type, previous_value_cm, value_cm')
        .eq('profile_id', profileId)
        .order('measurement_key', {ascending: true})
        .order('changed_at', {ascending: true})
        .order('id', {ascending: true}),
    ]);

    if (heightHistoryResponse.error) {
      throw heightHistoryResponse.error;
    }

    if (measurementHistoryResponse.error) {
      throw measurementHistoryResponse.error;
    }

    const heightEntries = ((heightHistoryResponse.data ?? []) as ProfileHeightHistoryRow[]).map((row) => ({
      changedAt: toIsoString(row.changed_at),
      eventType: row.event_type,
      heightCm: toNumber(row.height_cm),
      previousHeightCm: toNullableNumber(row.previous_height_cm),
    })) satisfies ProfileHeightHistoryEntry[];

    const measurementHistories = ((measurementHistoryResponse.data ?? []) as MeasurementHistoryRow[]).reduce(
      (histories, row) => {
        const entries = histories[row.measurement_key] ?? [];
        entries.push({
          changedAt: toIsoString(row.changed_at),
          eventType: row.event_type,
          previousValueCm: toNullableNumber(row.previous_value_cm),
          valueCm: toNullableNumber(row.value_cm),
        });
        histories[row.measurement_key] = entries;
        return histories;
      },
      {} as Partial<Record<MeasurementKey, MeasurementHistoryEntry[]>>,
    );

    return {
      heightHistory: {
        entries: heightEntries,
        profileId,
      },
      measurementHistories,
      profileId,
    } satisfies ProfileTimelineResponse;
  } catch (error) {
    throw normalizeSupabaseError(error);
  }
}

export async function loadProfileHeightHistory(profileId: string) {
  try {
    const {supabase} = await getAuthenticatedSupabaseContext();
    const {data, error} = await supabase
      .from('profile_height_history')
      .select('id, changed_at, event_type, height_cm, previous_height_cm')
      .eq('profile_id', profileId)
      .order('changed_at', {ascending: true})
      .order('id', {ascending: true});

    if (error) {
      throw error;
    }

    const entries = ((data ?? []) as ProfileHeightHistoryRow[]).map((row) => ({
      changedAt: toIsoString(row.changed_at),
      eventType: row.event_type,
      heightCm: toNumber(row.height_cm),
      previousHeightCm: toNullableNumber(row.previous_height_cm),
    })) satisfies ProfileHeightHistoryEntry[];

    return {
      entries,
      profileId,
    } satisfies ProfileHeightHistoryResponse;
  } catch (error) {
    throw normalizeSupabaseError(error);
  }
}

export async function loadMeasurementHistory(
  profileId: string,
  measurementKey: MeasurementKey,
) {
  try {
    const {supabase} = await getAuthenticatedSupabaseContext();
    const {data, error} = await supabase
      .from('measurement_history')
      .select('id, changed_at, event_type, previous_value_cm, value_cm')
      .eq('profile_id', profileId)
      .eq('measurement_key', measurementKey)
      .order('changed_at', {ascending: true})
      .order('id', {ascending: true});

    if (error) {
      throw error;
    }

    const entries = ((data ?? []) as MeasurementHistoryEntryRow[]).map((row) => ({
      changedAt: toIsoString(row.changed_at),
      eventType: row.event_type,
      previousValueCm: toNullableNumber(row.previous_value_cm),
      valueCm: toNullableNumber(row.value_cm),
    })) satisfies MeasurementHistoryEntry[];

    return {
      entries,
      measurementKey,
      measurementLabel: measurementDefinitionsByKey[measurementKey].label,
      profileId,
    } satisfies MeasurementHistoryResponse;
  } catch (error) {
    throw normalizeSupabaseError(error);
  }
}
