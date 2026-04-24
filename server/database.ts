import postgres from 'postgres';
import {createEmptyMeasurements} from '../src/measurements.ts';
import type {MeasurementKey, Measurements, Profile, Sex} from '../src/types.ts';

export type ProfileInput = {
  heightCm: number;
  name: string;
  sex: Sex;
};

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
  previous_value_cm: number | string | null;
  value_cm: number | string | null;
};

export type ProfileHeightHistoryEntry = {
  changedAt: string;
  eventType: 'insert' | 'update';
  heightCm: number;
  previousHeightCm: number | null;
};

export type MeasurementHistoryEntry = {
  changedAt: string;
  eventType: 'insert' | 'update' | 'delete';
  previousValueCm: number | null;
  valueCm: number | null;
};

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required. Use the Supabase Postgres connection string before starting the data service.',
  );
}

const {hostname} = new URL(databaseUrl);
const usesLocalDatabase = hostname === '127.0.0.1' || hostname === 'localhost';

const sql = postgres(databaseUrl, {
  idle_timeout: 20,
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  prepare: false,
  ssl: usesLocalDatabase ? false : 'require',
});

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

async function loadMeasurements(profileIds: string[]) {
  if (profileIds.length === 0) {
    return [] as MeasurementRow[];
  }

  return sql<MeasurementRow[]>`
    SELECT profile_id, measurement_key, value_cm
    FROM public.measurements
    WHERE profile_id IN ${sql(profileIds)}
  `;
}

async function getProfileMeasurements(profileId: string) {
  const measurementRows = await loadMeasurements([profileId]);
  return buildMeasurementMap(measurementRows).get(profileId) ?? createEmptyMeasurements();
}

export async function listProfiles(userId: string) {
  const profileRows = await sql<ProfileRow[]>`
    SELECT id, name, sex, height_cm, created_at, updated_at, user_id
    FROM public.profiles
    WHERE user_id = ${userId}::uuid
    ORDER BY created_at DESC, id DESC
  `;

  const measurementRows = await loadMeasurements(profileRows.map((row) => row.id));
  const measurementsByProfile = buildMeasurementMap(measurementRows);

  return profileRows.map((row) =>
    mapProfile(row, measurementsByProfile.get(row.id) ?? createEmptyMeasurements()),
  );
}

export async function getProfile(profileId: string, userId: string) {
  const profileRows = await sql<ProfileRow[]>`
    SELECT id, name, sex, height_cm, created_at, updated_at, user_id
    FROM public.profiles
    WHERE id = ${profileId}::uuid
      AND user_id = ${userId}::uuid
  `;

  const profileRow = profileRows[0];

  if (!profileRow) {
    return null;
  }

  const measurements = await getProfileMeasurements(profileId);
  return mapProfile(profileRow, measurements);
}

export async function createProfile(profileId: string, userId: string, input: ProfileInput) {
  const profileRows = await sql<ProfileRow[]>`
    INSERT INTO public.profiles (id, user_id, name, sex, height_cm)
    VALUES (${profileId}::uuid, ${userId}::uuid, ${input.name}, ${input.sex}, ${input.heightCm})
    RETURNING id, name, sex, height_cm, created_at, updated_at, user_id
  `;

  const profileRow = profileRows[0];

  return mapProfile(profileRow, createEmptyMeasurements());
}

export async function updateProfile(profileId: string, userId: string, input: ProfileInput) {
  const profileRows = await sql<ProfileRow[]>`
    UPDATE public.profiles
    SET name = ${input.name}, sex = ${input.sex}, height_cm = ${input.heightCm}
    WHERE id = ${profileId}::uuid
      AND user_id = ${userId}::uuid
    RETURNING id, name, sex, height_cm, created_at, updated_at, user_id
  `;

  const profileRow = profileRows[0];

  if (!profileRow) {
    return null;
  }

  const measurements = await getProfileMeasurements(profileId);
  return mapProfile(profileRow, measurements);
}

export async function deleteProfile(profileId: string, userId: string) {
  const result = await sql`
    DELETE FROM public.profiles
    WHERE id = ${profileId}::uuid
      AND user_id = ${userId}::uuid
  `;

  return result.count > 0;
}

export async function saveMeasurement(
  profileId: string,
  userId: string,
  measurementKey: MeasurementKey,
  valueCm: number,
) {
  const profile = await getProfile(profileId, userId);

  if (!profile) {
    return null;
  }

  await sql`
    INSERT INTO public.measurements (profile_id, measurement_key, value_cm)
    VALUES (${profileId}::uuid, ${measurementKey}, ${valueCm})
    ON CONFLICT (profile_id, measurement_key)
    DO UPDATE SET value_cm = EXCLUDED.value_cm
  `;

  return getProfile(profileId, userId);
}

export async function getProfileHeightHistory(profileId: string, userId: string) {
  const rows = await sql<ProfileHeightHistoryRow[]>`
    SELECT history.event_type, history.previous_height_cm, history.height_cm, history.changed_at
    FROM public.profile_height_history AS history
    INNER JOIN public.profiles AS profile
      ON profile.id = history.profile_id
    WHERE history.profile_id = ${profileId}::uuid
      AND profile.user_id = ${userId}::uuid
    ORDER BY history.changed_at ASC, history.id ASC
  `;

  return rows.map((row) => ({
    changedAt: toIsoString(row.changed_at),
    eventType: row.event_type,
    heightCm: toNumber(row.height_cm),
    previousHeightCm: toNullableNumber(row.previous_height_cm),
  })) satisfies ProfileHeightHistoryEntry[];
}

export async function getMeasurementHistory(
  profileId: string,
  userId: string,
  measurementKey: MeasurementKey,
) {
  const rows = await sql<MeasurementHistoryRow[]>`
    SELECT history.event_type, history.previous_value_cm, history.value_cm, history.changed_at
    FROM public.measurement_history AS history
    INNER JOIN public.profiles AS profile
      ON profile.id = history.profile_id
    WHERE history.profile_id = ${profileId}::uuid
      AND history.measurement_key = ${measurementKey}
      AND profile.user_id = ${userId}::uuid
    ORDER BY history.changed_at ASC, history.id ASC
  `;

  return rows.map((row) => ({
    changedAt: toIsoString(row.changed_at),
    eventType: row.event_type,
    previousValueCm: toNullableNumber(row.previous_value_cm),
    valueCm: toNullableNumber(row.value_cm),
  })) satisfies MeasurementHistoryEntry[];
}
