import type {Sex, Unit} from './types';

export const MAX_PROFILE_NAME_LENGTH = 48;
export const MIN_HEIGHT_CM = 80;
export const MAX_HEIGHT_CM = 260;
export const MAX_MEASUREMENT_CM = 400;
export const MAX_MEASUREMENT_IN = 160;

export function getMeasurementMax(unit: Unit) {
  return unit === 'cm' ? MAX_MEASUREMENT_CM : MAX_MEASUREMENT_IN;
}

export function isValidSex(value: unknown): value is Sex {
  return value === 'female' || value === 'male';
}

export function isValidProfileId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function validateProfileInput(body: unknown) {
  if (!body || typeof body !== 'object') {
    return 'Profile details are required.';
  }

  const {heightCm, name, sex} = body as {
    heightCm?: unknown;
    name?: unknown;
    sex?: unknown;
  };

  const trimmedName = typeof name === 'string' ? name.trim() : '';

  if (!trimmedName) {
    return 'Profile name is required.';
  }

  if (trimmedName.length > MAX_PROFILE_NAME_LENGTH) {
    return `Profile name must be ${MAX_PROFILE_NAME_LENGTH} characters or fewer.`;
  }

  if (!isValidSex(sex)) {
    return 'Sex must be female or male.';
  }

  if (typeof heightCm !== 'number' || !Number.isFinite(heightCm)) {
    return 'Height must be a valid number.';
  }

  if (heightCm < MIN_HEIGHT_CM || heightCm > MAX_HEIGHT_CM) {
    return `Height must be between ${MIN_HEIGHT_CM} and ${MAX_HEIGHT_CM} cm.`;
  }

  return null;
}

export function validateMeasurementValue(body: unknown) {
  if (!body || typeof body !== 'object') {
    return 'Measurement value is required.';
  }

  const {valueCm} = body as {valueCm?: unknown};

  if (typeof valueCm !== 'number' || !Number.isFinite(valueCm)) {
    return 'Measurement must be a valid number.';
  }

  if (valueCm < 0 || valueCm > MAX_MEASUREMENT_CM) {
    return `Measurement must be between 0 and ${MAX_MEASUREMENT_CM} cm.`;
  }

  return null;
}
