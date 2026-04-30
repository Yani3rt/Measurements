import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {isValidProfileId, validateMeasurementValue, validateProfileInput} from '../src/validation';

describe('server validation', () => {
  it('accepts standard Supabase UUID profile identifiers', () => {
    assert.equal(isValidProfileId('019db65d-c1bb-79c2-a25b-55cb27235d64'), true);
  });

  it('rejects malformed profile payloads and out-of-range measurements', () => {
    assert.equal(validateProfileInput({name: ' ', sex: 'female', heightCm: 170}), 'Profile name is required.');
    assert.equal(validateMeasurementValue({valueCm: 401}), 'Measurement must be between 0 and 400 cm.');
  });
});
