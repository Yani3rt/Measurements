import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createEmptyMeasurements, measurementDefinitionsByKey} from '../src/measurements.ts';
import type {MeasurementKey, Measurements, Profile, Sex} from '../src/types.ts';

type ProfileRow = {
  created_at: string;
  height_cm: number;
  id: string;
  name: string;
  sex: Sex;
  updated_at: string;
};

type MeasurementRow = {
  measurement_key: MeasurementKey;
  profile_id: string;
  value_cm: number;
};

export type ProfileInput = {
  heightCm: number;
  name: string;
  sex: Sex;
};

const dataDirectory = path.resolve(process.cwd(), 'data');
export const databasePath = path.join(dataDirectory, 'the-atelier.sqlite');

mkdirSync(dataDirectory, {recursive: true});

const database = new DatabaseSync(databasePath);

database.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sex TEXT NOT NULL CHECK (sex IN ('female', 'male')),
    height_cm REAL NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS measurements (
    profile_id TEXT NOT NULL,
    measurement_key TEXT NOT NULL,
    value_cm REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (profile_id, measurement_key),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_measurements_profile_id ON measurements(profile_id);
`);

function mapProfile(row: ProfileRow, measurements: Measurements): Profile {
  return {
    createdAt: row.created_at,
    heightCm: row.height_cm,
    id: row.id,
    measurements,
    name: row.name,
    sex: row.sex,
    updatedAt: row.updated_at,
  };
}

function buildMeasurementMap(rows: MeasurementRow[]) {
  const profiles = new Map<string, Measurements>();

  for (const row of rows) {
    const current = profiles.get(row.profile_id) ?? createEmptyMeasurements();
    current[row.measurement_key] = row.value_cm;
    profiles.set(row.profile_id, current);
  }

  return profiles;
}

export function listProfiles() {
  const profileRows = database
    .prepare(
      `
        SELECT id, name, sex, height_cm, created_at, updated_at
        FROM profiles
        ORDER BY datetime(created_at) DESC, id DESC
      `,
    )
    .all() as ProfileRow[];

  const measurementRows = database
    .prepare(
      `
        SELECT profile_id, measurement_key, value_cm
        FROM measurements
      `,
    )
    .all() as MeasurementRow[];

  const measurementsByProfile = buildMeasurementMap(measurementRows);

  return profileRows.map((row) =>
    mapProfile(row, measurementsByProfile.get(row.id) ?? createEmptyMeasurements()),
  );
}

export function getProfile(profileId: string) {
  const profileRow = database
    .prepare(
      `
        SELECT id, name, sex, height_cm, created_at, updated_at
        FROM profiles
        WHERE id = ?
      `,
    )
    .get(profileId) as ProfileRow | undefined;

  if (!profileRow) {
    return null;
  }

  const measurementRows = database
    .prepare(
      `
        SELECT profile_id, measurement_key, value_cm
        FROM measurements
        WHERE profile_id = ?
      `,
    )
    .all(profileId) as MeasurementRow[];

  const measurements = buildMeasurementMap(measurementRows).get(profileId) ?? createEmptyMeasurements();

  return mapProfile(profileRow, measurements);
}

export function createProfile(profileId: string, input: ProfileInput) {
  const now = new Date().toISOString();

  database
    .prepare(
      `
        INSERT INTO profiles (id, name, sex, height_cm, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run(profileId, input.name, input.sex, input.heightCm, now, now);

  const insertMeasurement = database.prepare(
    `
      INSERT INTO measurements (profile_id, measurement_key, value_cm, updated_at)
      VALUES (?, ?, 0, ?)
    `,
  );

  for (const measurementKey of Object.keys(measurementDefinitionsByKey) as MeasurementKey[]) {
    insertMeasurement.run(profileId, measurementKey, now);
  }

  return getProfile(profileId);
}

export function updateProfile(profileId: string, input: ProfileInput) {
  const now = new Date().toISOString();
  const result = database
    .prepare(
      `
        UPDATE profiles
        SET name = ?, sex = ?, height_cm = ?, updated_at = ?
        WHERE id = ?
      `,
    )
    .run(input.name, input.sex, input.heightCm, now, profileId);

  if (result.changes === 0) {
    return null;
  }

  return getProfile(profileId);
}

export function deleteProfile(profileId: string) {
  const result = database
    .prepare(
      `
        DELETE FROM profiles
        WHERE id = ?
      `,
    )
    .run(profileId);

  return result.changes > 0;
}

export function saveMeasurement(profileId: string, measurementKey: MeasurementKey, valueCm: number) {
  const now = new Date().toISOString();
  const profile = getProfile(profileId);

  if (!profile) {
    return null;
  }

  database
    .prepare(
      `
        INSERT INTO measurements (profile_id, measurement_key, value_cm, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(profile_id, measurement_key)
        DO UPDATE SET value_cm = excluded.value_cm, updated_at = excluded.updated_at
      `,
    )
    .run(profileId, measurementKey, valueCm, now);

  database
    .prepare(
      `
        UPDATE profiles
        SET updated_at = ?
        WHERE id = ?
      `,
    )
    .run(now, profileId);

  return getProfile(profileId);
}
