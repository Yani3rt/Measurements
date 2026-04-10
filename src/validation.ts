import type {Unit} from './types';

export const MAX_PROFILE_NAME_LENGTH = 48;
export const MIN_HEIGHT_CM = 80;
export const MAX_HEIGHT_CM = 260;
export const MAX_MEASUREMENT_CM = 400;
export const MAX_MEASUREMENT_IN = 160;

export function getMeasurementMax(unit: Unit) {
  return unit === 'cm' ? MAX_MEASUREMENT_CM : MAX_MEASUREMENT_IN;
}
