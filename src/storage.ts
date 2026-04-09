import {createEmptyMeasurements} from './measurements';
import type {Profile} from './types';

const STORAGE_KEY = 'the-atelier-family-profiles';

function canUseStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const key = '__atelier_probe__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function loadProfiles() {
  if (!canUseStorage()) {
    return {profiles: [] as Profile[], storageAvailable: false};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {profiles: [] as Profile[], storageAvailable: true};
    }

    const parsed = JSON.parse(raw) as Profile[];
    const profiles = parsed
      .filter((profile) => profile && typeof profile.id === 'string')
      .map((profile) => ({
        ...profile,
        measurements: {
          ...createEmptyMeasurements(),
          ...profile.measurements,
        },
      }));

    return {profiles, storageAvailable: true};
  } catch {
    return {profiles: [] as Profile[], storageAvailable: false};
  }
}

export function saveProfiles(profiles: Profile[]) {
  if (!canUseStorage()) {
    return false;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    return true;
  } catch {
    return false;
  }
}
