import {createEmptyMeasurements, measurementDefinitionsByKey} from './measurements';
import type {MeasurementKey, Profile, Sex} from './types';

type ProfilesResponse = {
  profiles: Profile[];
};

type ProfileResponse = {
  profile: Profile;
};

type ProfilePayload = {
  heightCm: number;
  name: string;
  sex: Sex;
};

type MeasurementPayload = {
  valueCm: number;
};

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
  'The local data service is unavailable. Start it with pnpm dev and try again.';

function hydrateProfiles(profiles: Profile[]) {
  return profiles
    .filter((profile) => profile && typeof profile.id === 'string')
    .map((profile) => ({
      ...profile,
      measurements: {
        ...createEmptyMeasurements(),
        ...profile.measurements,
      },
    }));
}

async function requestJson<T>(path: string, init?: RequestInit) {
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    const data = (await response.json().catch(() => null)) as {message?: string} | null;

    if (!response.ok) {
      throw new Error(data?.message || `Request failed with status ${response.status}.`);
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error && error.message) {
      if (error.name === 'TypeError') {
        throw new Error(SERVICE_UNAVAILABLE_MESSAGE);
      }
      throw error;
    }

    throw new Error(SERVICE_UNAVAILABLE_MESSAGE);
  }
}

export function replaceProfileInList(
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

export function removeProfileFromList(profiles: Profile[], profileId: string) {
  return profiles.filter((profile) => profile.id !== profileId);
}

export async function loadProfiles() {
  const data = await requestJson<ProfilesResponse>('/api/profiles');
  return hydrateProfiles(data.profiles);
}

export async function createProfile(payload: ProfilePayload) {
  const data = await requestJson<ProfileResponse>('/api/profiles', {
    body: JSON.stringify(payload),
    method: 'POST',
  });

  return hydrateProfiles([data.profile])[0];
}

export async function updateProfile(profileId: string, payload: ProfilePayload) {
  const data = await requestJson<ProfileResponse>(`/api/profiles/${profileId}`, {
    body: JSON.stringify(payload),
    method: 'PUT',
  });

  return hydrateProfiles([data.profile])[0];
}

export async function deleteProfile(profileId: string) {
  await requestJson<{deletedProfileId: string}>(`/api/profiles/${profileId}`, {
    method: 'DELETE',
  });
}

export async function saveMeasurement(
  profileId: string,
  measurementKey: MeasurementKey,
  valueCm: number,
) {
  const data = await requestJson<ProfileResponse>(
    `/api/profiles/${profileId}/measurements/${measurementKey}`,
    {
      body: JSON.stringify({valueCm} satisfies MeasurementPayload),
      method: 'PUT',
    },
  );

  return hydrateProfiles([data.profile])[0];
}

export async function loadProfileHeightHistory(profileId: string) {
  return requestJson<ProfileHeightHistoryResponse>(
    `/api/profiles/${profileId}/height-history`,
  );
}

export async function loadMeasurementHistory(
  profileId: string,
  measurementKey: MeasurementKey,
) {
  return requestJson<MeasurementHistoryResponse>(
    `/api/profiles/${profileId}/measurements/${measurementKey}/history`,
  );
}

export async function loadProfileTimeline(profileId: string) {
  const [heightHistory, measurementHistoryResponses] = await Promise.all([
    loadProfileHeightHistory(profileId),
    Promise.all(
      Object.keys(measurementDefinitionsByKey).map((measurementKey) =>
        loadMeasurementHistory(profileId, measurementKey as MeasurementKey),
      ),
    ),
  ]);

  const measurementHistories = measurementHistoryResponses.reduce(
    (histories, history) => {
      histories[history.measurementKey] = history.entries;
      return histories;
    },
    {} as Partial<Record<MeasurementKey, MeasurementHistoryEntry[]>>,
  );

  return {
    heightHistory,
    measurementHistories,
    profileId,
  } satisfies ProfileTimelineResponse;
}
