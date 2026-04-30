import {measurementDefinitionsByKey} from './measurements';
import {formatMeasurement, stripTrailingZeroes} from './utils';
import type {MeasurementKey, Unit} from './types';

export type TimelineHistoryEntry = {
  changedAt: string;
  eventType: 'insert' | 'update' | 'delete';
  previousValueCm: number | null;
  valueCm: number | null;
};

export type TimelineHistories = Partial<Record<MeasurementKey, TimelineHistoryEntry[]>>;

export type TimelineSummaryItem = {
  changedAt: string;
  deltaCm: number | null;
  deltaLabel: string;
  eventType: TimelineHistoryEntry['eventType'];
  latestValueCm: number | null;
  latestValueLabel: string;
  measurementKey: MeasurementKey;
  measurementLabel: string;
  previousValueCm: number | null;
  previousValueLabel: string | null;
};

export type TimelineSummary = {
  changedCount: number;
  items: TimelineSummaryItem[];
  latestChange: TimelineSummaryItem | null;
};

export function formatDelta(deltaCm: number | null, unit: Unit) {
  if (deltaCm === null) {
    return 'New entry';
  }

  if (deltaCm === 0) {
    return 'No change';
  }

  const value = unit === 'cm' ? deltaCm : deltaCm / 2.54;
  const sign = value > 0 ? '+' : '';
  return `${sign}${stripTrailingZeroes(value)} ${unit}`;
}

export function buildTimelineSummary(histories: TimelineHistories, unit: Unit): TimelineSummary {
  const items = Object.entries(histories).flatMap(([rawKey, entries]) => {
    const measurementKey = rawKey as MeasurementKey;
    const latestEntry = entries?.at(-1);

    if (!latestEntry) {
      return [];
    }

    const deltaCm =
      latestEntry.valueCm === null || latestEntry.previousValueCm === null
        ? null
        : Number((latestEntry.valueCm - latestEntry.previousValueCm).toFixed(2));

    return [{
      changedAt: latestEntry.changedAt,
      deltaCm,
      deltaLabel: formatDelta(deltaCm, unit),
      eventType: latestEntry.eventType,
      latestValueCm: latestEntry.valueCm,
      latestValueLabel:
        latestEntry.valueCm === null ? 'Removed value' : formatMeasurement(latestEntry.valueCm, unit),
      measurementKey,
      measurementLabel: measurementDefinitionsByKey[measurementKey]?.label ?? measurementKey,
      previousValueCm: latestEntry.previousValueCm,
      previousValueLabel:
        latestEntry.previousValueCm === null
          ? null
          : formatMeasurement(latestEntry.previousValueCm, unit),
    } satisfies TimelineSummaryItem];
  }).sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());

  return {
    changedCount: items.length,
    items,
    latestChange: items[0] ?? null,
  };
}
