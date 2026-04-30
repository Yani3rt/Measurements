import assert from 'node:assert/strict';
import {beforeEach, describe, it} from 'node:test';
import {
  clearAllAtelierLocalCache,
  clearProfileCacheForUser,
  getProfileCacheKey,
  readProfileCache,
  replaceProfileInCacheList,
  removeProfileFromCacheList,
  serializeProfileCachePayload,
  writeProfileCache,
} from '../src/storage';
import {createEmptyMeasurements} from '../src/measurements';
import type {Profile} from '../src/types';

type MemoryStorage = Pick<Storage, 'getItem' | 'key' | 'length' | 'removeItem' | 'setItem'> & {
  entries(): Record<string, string>;
};

function createMemoryStorage(): MemoryStorage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    entries() {
      return Object.fromEntries(values.entries());
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function createThrowingStorage(): MemoryStorage {
  const throwStorageError = () => {
    throw new Error('storage unavailable');
  };

  return {
    get length() {
      throwStorageError();
      return 0;
    },
    entries() {
      return {};
    },
    getItem() {
      throwStorageError();
    },
    key() {
      throwStorageError();
    },
    removeItem() {
      throwStorageError();
    },
    setItem() {
      throwStorageError();
    },
  };
}

const profile: Profile = {
  createdAt: '2026-01-01T00:00:00.000Z',
  heightCm: 172,
  id: 'profile-1',
  measurements: createEmptyMeasurements(),
  name: 'Ada',
  sex: 'female',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('profile cache helpers', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('accepts cache for a matching user and session', () => {
    storage.setItem(
      getProfileCacheKey('user-1', 'session-1'),
      serializeProfileCachePayload({
        cachedAt: '2026-04-30T12:00:00.000Z',
        profiles: [profile],
        sessionKey: 'session-1',
        userId: 'user-1',
      }),
    );

    assert.deepEqual(readProfileCache(storage, 'user-1', 'session-1'), [profile]);
  });

  it('rejects cache for a different user', () => {
    storage.setItem(
      getProfileCacheKey('user-2', 'session-1'),
      serializeProfileCachePayload({
        cachedAt: '2026-04-30T12:00:00.000Z',
        profiles: [profile],
        sessionKey: 'session-1',
        userId: 'user-2',
      }),
    );

    assert.equal(readProfileCache(storage, 'user-1', 'session-1'), null);
  });

  it('rejects cache for a different session', () => {
    storage.setItem(
      getProfileCacheKey('user-1', 'session-1'),
      serializeProfileCachePayload({
        cachedAt: '2026-04-30T12:00:00.000Z',
        profiles: [profile],
        sessionKey: 'session-1',
        userId: 'user-1',
      }),
    );

    assert.equal(readProfileCache(storage, 'user-1', 'session-2'), null);
  });

  it('stores separate cache entries for different sessions from the same user', () => {
    const nextProfile = {
      ...profile,
      id: 'profile-2',
      name: 'Grace',
    } satisfies Profile;

    writeProfileCache(storage, 'user-1', 'session-1', [profile], '2026-04-30T12:00:00.000Z');
    writeProfileCache(storage, 'user-1', 'session-2', [nextProfile], '2026-04-30T12:01:00.000Z');

    assert.deepEqual(readProfileCache(storage, 'user-1', 'session-1'), [profile]);
    assert.deepEqual(readProfileCache(storage, 'user-1', 'session-2'), [nextProfile]);
    assert.notEqual(getProfileCacheKey('user-1', 'session-1'), getProfileCacheKey('user-1', 'session-2'));
  });

  it('rejects malformed JSON and removes it', () => {
    const key = getProfileCacheKey('user-1', 'session-1');
    storage.setItem(key, '{bad json');

    assert.equal(readProfileCache(storage, 'user-1', 'session-1'), null);
    assert.equal(storage.getItem(key), null);
  });

  it('rejects invalid profile arrays and removes the cache entry', () => {
    const key = getProfileCacheKey('user-1', 'session-1');
    storage.setItem(
      key,
      JSON.stringify({
        cachedAt: '2026-04-30T12:00:00.000Z',
        profiles: ['not a profile'],
        sessionKey: 'session-1',
        userId: 'user-1',
      }),
    );

    assert.equal(readProfileCache(storage, 'user-1', 'session-1'), null);
    assert.equal(storage.getItem(key), null);
  });


  it('prepends a created profile into the cache list without mutating the previous list', () => {
    const createdProfile = {
      ...profile,
      id: 'profile-2',
      name: 'Grace',
    } satisfies Profile;
    const current = [profile];

    const next = replaceProfileInCacheList(current, createdProfile, {insert: 'prepend'});

    assert.deepEqual(next, [createdProfile, profile]);
    assert.deepEqual(current, [profile]);
  });

  it('replaces an existing profile in the cache list with the confirmed server profile', () => {
    const updatedProfile = {
      ...profile,
      heightCm: 173,
      name: 'Ada Lovelace',
    } satisfies Profile;

    assert.deepEqual(replaceProfileInCacheList([profile], updatedProfile), [updatedProfile]);
  });

  it('removes a deleted profile from the cache list', () => {
    const nextProfile = {
      ...profile,
      id: 'profile-2',
      name: 'Grace',
    } satisfies Profile;

    assert.deepEqual(removeProfileFromCacheList([profile, nextProfile], profile.id), [nextProfile]);
  });

  it('treats throwing storage as a cache miss instead of an app failure', () => {
    const throwingStorage = createThrowingStorage();

    assert.doesNotThrow(() => {
      assert.equal(readProfileCache(throwingStorage, 'user-1', 'session-1'), null);
    });
    assert.doesNotThrow(() => {
      writeProfileCache(throwingStorage, 'user-1', 'session-1', [profile]);
    });
    assert.doesNotThrow(() => {
      clearProfileCacheForUser('user-1', throwingStorage);
    });
    assert.doesNotThrow(() => {
      clearAllAtelierLocalCache(throwingStorage);
    });
  });

  it('ignores unavailable browser localStorage access', () => {
    const previousWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        get localStorage() {
          throw new Error('localStorage unavailable');
        },
      },
    });

    try {
      assert.doesNotThrow(() => {
        clearAllAtelierLocalCache();
      });
      assert.doesNotThrow(() => {
        clearProfileCacheForUser('user-1');
      });
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: previousWindow,
      });
    }
  });

  it('clears only Atelier local cache keys', () => {
    storage.setItem(getProfileCacheKey('user-1', 'session-1'), 'cached profile');
    storage.setItem('the-atelier:preferences', 'cached preferences');
    storage.setItem('not-the-atelier:profiles', 'other app');
    storage.setItem('unrelated', 'survives');

    clearAllAtelierLocalCache(storage);

    assert.deepEqual(storage.entries(), {
      'not-the-atelier:profiles': 'other app',
      unrelated: 'survives',
    });
  });

  it('clears profile cache for one user', () => {
    storage.setItem(getProfileCacheKey('user-1', 'session-1'), 'cached profile 1');
    storage.setItem(getProfileCacheKey('user-1', 'session-2'), 'cached profile 2');
    storage.setItem(getProfileCacheKey('user-2', 'session-1'), 'cached profile 3');

    clearProfileCacheForUser('user-1', storage);

    assert.equal(storage.getItem(getProfileCacheKey('user-1', 'session-1')), null);
    assert.equal(storage.getItem(getProfileCacheKey('user-1', 'session-2')), null);
    assert.equal(storage.getItem(getProfileCacheKey('user-2', 'session-1')), 'cached profile 3');
  });
});
