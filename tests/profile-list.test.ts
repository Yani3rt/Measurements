import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  removeProfileFromList,
  replaceProfileInList,
} from '../src/storage';
import {createEmptyMeasurements} from '../src/measurements';
import type {Profile} from '../src/types';

const profile: Profile = {
  createdAt: '2026-01-01T00:00:00.000Z',
  heightCm: 172,
  id: 'profile-1',
  measurements: createEmptyMeasurements(),
  name: 'Ada',
  sex: 'female',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('profile list helpers', () => {
  it('prepends a created profile into the list without mutating the previous list', () => {
    const createdProfile = {
      ...profile,
      id: 'profile-2',
      name: 'Grace',
    } satisfies Profile;
    const current = [profile];

    const next = replaceProfileInList(current, createdProfile, {insert: 'prepend'});

    assert.deepEqual(next, [createdProfile, profile]);
    assert.deepEqual(current, [profile]);
  });

  it('appends a created profile when requested', () => {
    const createdProfile = {
      ...profile,
      id: 'profile-2',
      name: 'Grace',
    } satisfies Profile;

    assert.deepEqual(
      replaceProfileInList([profile], createdProfile, {insert: 'append'}),
      [profile, createdProfile],
    );
  });

  it('replaces an existing profile with the confirmed server profile', () => {
    const updatedProfile = {
      ...profile,
      heightCm: 173,
      name: 'Ada Lovelace',
    } satisfies Profile;

    assert.deepEqual(replaceProfileInList([profile], updatedProfile), [updatedProfile]);
  });

  it('removes a deleted profile from the list', () => {
    const nextProfile = {
      ...profile,
      id: 'profile-2',
      name: 'Grace',
    } satisfies Profile;

    assert.deepEqual(removeProfileFromList([profile, nextProfile], profile.id), [nextProfile]);
  });
});
