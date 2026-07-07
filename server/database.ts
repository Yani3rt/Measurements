import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createEmptyMeasurements, measurementDefinitionsByKey} from '../src/measurements.ts';
import type {MeasurementKey, Measurements, Profile, Sex} from '../src/types.ts';

export type ProfileInput = {
  heightCm: number;
  name: string;
  sex: Sex;
};

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

type ProfileHeightHistoryRow = {
  changed_at: string;
  event_type: 'insert' | 'update';
  height_cm: number;
  previous_height_cm: number | null;
};

type MeasurementHistoryRow = {
  changed_at: string;
  event_type: 'insert' | 'update' | 'delete';
  previous_value_cm: number | null;
  value_cm: number | null;
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

const dataDirectory = path.resolve(process.cwd(), 'data');
export const databasePath = path.join(dataDirectory, 'the-atelier.sqlite');

mkdirSync(dataDirectory, {recursive: true});

const database = new DatabaseSync(databasePath);

function runTransaction<T>(callback: () => T) {
  database.exec('BEGIN IMMEDIATE');

  try {
    const result = callback();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

database.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 48),
    sex TEXT NOT NULL CHECK (sex IN ('female', 'male')),
    height_cm REAL NOT NULL CHECK (height_cm BETWEEN 80 AND 260),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS measurements (
    profile_id TEXT NOT NULL,
    measurement_key TEXT NOT NULL CHECK (measurement_key IN (
      'hatSize',
      'neck',
      'shoulderCircumference',
      'bust',
      'underBust',
      'waist',
      'rise',
      'thigh',
      'hips',
      'knee',
      'shoulder',
      'sleeveLength',
      'back',
      'torso',
      'outseam',
      'inseam'
    )),
    value_cm REAL NOT NULL CHECK (value_cm BETWEEN 0 AND 400),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (profile_id, measurement_key),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS profile_height_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('insert', 'update')),
    previous_height_cm REAL,
    height_cm REAL NOT NULL CHECK (height_cm BETWEEN 80 AND 260),
    changed_at TEXT NOT NULL,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS measurement_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT NOT NULL,
    measurement_key TEXT NOT NULL CHECK (measurement_key IN (
      'hatSize',
      'neck',
      'shoulderCircumference',
      'bust',
      'underBust',
      'waist',
      'rise',
      'thigh',
      'hips',
      'knee',
      'shoulder',
      'sleeveLength',
      'back',
      'torso',
      'outseam',
      'inseam'
    )),
    event_type TEXT NOT NULL CHECK (event_type IN ('insert', 'update', 'delete')),
    previous_value_cm REAL,
    value_cm REAL,
    changed_at TEXT NOT NULL,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_measurements_profile_id ON measurements(profile_id);
  CREATE INDEX IF NOT EXISTS idx_profile_height_history_profile_changed_at
    ON profile_height_history(profile_id, changed_at ASC, id ASC);
  CREATE INDEX IF NOT EXISTS idx_measurement_history_profile_measurement_changed_at
    ON measurement_history(profile_id, measurement_key, changed_at ASC, id ASC);
`);

function columnExists(tableName: string, columnName: string) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as {name: string}[];
  return columns.some((column) => column.name === columnName);
}

function addColumnIfMissing(tableName: string, columnName: string, definition: string) {
  if (columnExists(tableName, columnName)) {
    return;
  }

  database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

addColumnIfMissing('profiles', 'updated_at', 'TEXT');
addColumnIfMissing('profiles', 'created_at', 'TEXT');
addColumnIfMissing('measurements', 'created_at', 'TEXT');
addColumnIfMissing('measurements', 'updated_at', 'TEXT');

database.exec(`
  UPDATE profiles
  SET created_at = COALESCE(created_at, datetime('now')),
      updated_at = COALESCE(updated_at, created_at, datetime('now'));

  UPDATE measurements
  SET created_at = COALESCE(created_at, datetime('now')),
      updated_at = COALESCE(updated_at, created_at, datetime('now'));
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

function getProfileMeasurements(profileId: string) {
  const measurementRows = database
    .prepare(
      `
        SELECT profile_id, measurement_key, value_cm
        FROM measurements
        WHERE profile_id = ?
      `,
    )
    .all(profileId) as MeasurementRow[];

  return buildMeasurementMap(measurementRows).get(profileId) ?? createEmptyMeasurements();
}

export function listProfiles() {
  const profileRows = database
    .prepare(
      `
        SELECT id, name, sex, height_cm, created_at, COALESCE(updated_at, created_at) AS updated_at
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
        SELECT id, name, sex, height_cm, created_at, COALESCE(updated_at, created_at) AS updated_at
        FROM profiles
        WHERE id = ?
      `,
    )
    .get(profileId) as ProfileRow | undefined;

  if (!profileRow) {
    return null;
  }

  return mapProfile(profileRow, getProfileMeasurements(profileId));
}

export function createProfile(profileId: string, input: ProfileInput) {
  const now = new Date().toISOString();
  const create = () => runTransaction(() => {
    database
      .prepare(
        `
          INSERT INTO profiles (id, name, sex, height_cm, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(profileId, input.name, input.sex, input.heightCm, now, now);

    database
      .prepare(
        `
          INSERT INTO profile_height_history (profile_id, event_type, previous_height_cm, height_cm, changed_at)
          VALUES (?, 'insert', NULL, ?, ?)
        `,
      )
      .run(profileId, input.heightCm, now);
  });

  create();
  return getProfile(profileId);
}

export function updateProfile(profileId: string, input: ProfileInput) {
  const now = new Date().toISOString();
  const update = () => runTransaction(() => {
    const current = database
      .prepare('SELECT height_cm FROM profiles WHERE id = ?')
      .get(profileId) as {height_cm: number} | undefined;

    if (!current) {
      return false;
    }

    database
      .prepare(
        `
          UPDATE profiles
          SET name = ?, sex = ?, height_cm = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .run(input.name, input.sex, input.heightCm, now, profileId);

    if (current.height_cm !== input.heightCm) {
      database
        .prepare(
          `
            INSERT INTO profile_height_history (profile_id, event_type, previous_height_cm, height_cm, changed_at)
            VALUES (?, 'update', ?, ?, ?)
          `,
        )
        .run(profileId, current.height_cm, input.heightCm, now);
    }

    return true;
  });

  if (!update()) {
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
  const save = () => runTransaction(() => {
    const profile = getProfile(profileId);

    if (!profile) {
      return false;
    }

    const current = database
      .prepare(
        `
          SELECT value_cm
          FROM measurements
          WHERE profile_id = ? AND measurement_key = ?
        `,
      )
      .get(profileId, measurementKey) as {value_cm: number} | undefined;

    database
      .prepare(
        `
          INSERT INTO measurements (profile_id, measurement_key, value_cm, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(profile_id, measurement_key)
          DO UPDATE SET value_cm = excluded.value_cm, updated_at = excluded.updated_at
        `,
      )
      .run(profileId, measurementKey, valueCm, now, now);

    database
      .prepare(
        `
          INSERT INTO measurement_history (profile_id, measurement_key, event_type, previous_value_cm, value_cm, changed_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        profileId,
        measurementKey,
        current ? 'update' : 'insert',
        current?.value_cm ?? null,
        valueCm,
        now,
      );

    database
      .prepare('UPDATE profiles SET updated_at = ? WHERE id = ?')
      .run(now, profileId);

    return true;
  });

  if (!save()) {
    return null;
  }

  return getProfile(profileId);
}

export function getProfileHeightHistory(profileId: string) {
  const rows = database
    .prepare(
      `
        SELECT event_type, previous_height_cm, height_cm, changed_at
        FROM profile_height_history
        WHERE profile_id = ?
        ORDER BY datetime(changed_at) ASC, id ASC
      `,
    )
    .all(profileId) as ProfileHeightHistoryRow[];

  return rows.map((row) => ({
    changedAt: row.changed_at,
    eventType: row.event_type,
    heightCm: row.height_cm,
    previousHeightCm: row.previous_height_cm,
  })) satisfies ProfileHeightHistoryEntry[];
}

export function getMeasurementHistory(profileId: string, measurementKey: MeasurementKey) {
  const rows = database
    .prepare(
      `
        SELECT event_type, previous_value_cm, value_cm, changed_at
        FROM measurement_history
        WHERE profile_id = ? AND measurement_key = ?
        ORDER BY datetime(changed_at) ASC, id ASC
      `,
    )
    .all(profileId, measurementKey) as MeasurementHistoryRow[];

  return rows.map((row) => ({
    changedAt: row.changed_at,
    eventType: row.event_type,
    previousValueCm: row.previous_value_cm,
    valueCm: row.value_cm,
  })) satisfies MeasurementHistoryEntry[];
}
