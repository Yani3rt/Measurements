import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {buildTimelineSummary, formatDelta} from '../src/timeline';
import type {MeasurementHistoryEntry} from '../src/storage';

describe('timeline helpers', () => {
  it('summarizes measurement histories with latest value, previous value, delta, and recency order', () => {
    const histories = {
      waist: [
        {changedAt: '2026-01-01T10:00:00.000Z', eventType: 'insert', previousValueCm: null, valueCm: 70},
        {changedAt: '2026-02-01T10:00:00.000Z', eventType: 'update', previousValueCm: 70, valueCm: 72.5},
      ],
      hips: [
        {changedAt: '2026-03-01T10:00:00.000Z', eventType: 'insert', previousValueCm: null, valueCm: 94},
      ],
    } as Partial<Record<string, MeasurementHistoryEntry[]>>;

    const summary = buildTimelineSummary(histories, 'cm');

    assert.equal(summary.changedCount, 2);
    assert.equal(summary.latestChange?.measurementKey, 'hips');
    assert.equal(summary.items[0].measurementKey, 'hips');
    assert.equal(summary.items[1].measurementKey, 'waist');
    assert.equal(summary.items[1].latestValueLabel, '72.5 cm');
    assert.equal(summary.items[1].previousValueLabel, '70 cm');
    assert.equal(summary.items[1].deltaLabel, '+2.5 cm');
  });

  it('formats positive, negative, and zero deltas in the selected unit', () => {
    assert.equal(formatDelta(2.54, 'in'), '+1 in');
    assert.equal(formatDelta(-5, 'cm'), '-5 cm');
    assert.equal(formatDelta(0, 'cm'), 'No change');
  });
});
