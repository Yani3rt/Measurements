import {measurementDefinitions} from './measurements';
import type {MeasurementKey, Profile, Unit} from './types';

export function cmToInches(valueCm: number) {
  return valueCm / 2.54;
}

export function inchesToCm(valueInches: number) {
  return valueInches * 2.54;
}

export function formatMeasurement(valueCm: number, unit: Unit) {
  const converted = unit === 'cm' ? valueCm : cmToInches(valueCm);
  return `${stripTrailingZeroes(converted)} ${unit}`;
}

export function normalizeMeasurementInput(value: number, unit: Unit) {
  return unit === 'cm' ? value : inchesToCm(value);
}

export function stripTrailingZeroes(value: number) {
  return Number(value.toFixed(1)).toString();
}

export function getCompletionSummary(profile: Profile) {
  const filled = measurementDefinitions.filter(
    (definition) => profile.measurements[definition.key] > 0,
  ).length;

  return `${filled} of ${measurementDefinitions.length} filled`;
}

export function getMeasurementValue(profile: Profile, key: MeasurementKey, unit: Unit) {
  const valueCm = profile.measurements[key];
  return unit === 'cm' ? valueCm : cmToInches(valueCm);
}
