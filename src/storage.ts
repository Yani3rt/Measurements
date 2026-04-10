import {createEmptyMeasurements} from './measurements';
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
