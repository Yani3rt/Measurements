import {motion} from 'motion/react';
import {Activity, CalendarClock, Ruler, TrendingUp, X} from 'lucide-react';
import {useMemo, useRef} from 'react';
import {measurementDefinitions} from './measurements';
import {buildTimelineSummary} from './timeline';
import {formatMeasurement, stripTrailingZeroes} from './utils';
import {useDialogAccessibility} from './useDialogAccessibility';
import type {ProfileTimelineResponse} from './storage';
import type {Profile, Unit} from './types';

type TimelineStatus = 'idle' | 'loading' | 'ready' | 'error';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getHeightDeltaLabel(timeline: ProfileTimelineResponse | null) {
  const latestHeight = timeline?.heightHistory.entries.at(-1);

  if (!latestHeight || latestHeight.previousHeightCm === null) {
    return 'Baseline height recorded';
  }

  const delta = latestHeight.heightCm - latestHeight.previousHeightCm;
  if (delta === 0) {
    return 'No height change';
  }

  return `${delta > 0 ? '+' : ''}${stripTrailingZeroes(delta)} cm since previous entry`;
}

export function FittingTimeline({
  error,
  onClose,
  onRetry,
  profile,
  status,
  timeline,
  unit,
}: {
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  profile: Profile;
  status: TimelineStatus;
  timeline: ProfileTimelineResponse | null;
  unit: Unit;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useDialogAccessibility({onClose, ref: dialogRef});

  const summary = useMemo(
    () => buildTimelineSummary(timeline?.measurementHistories ?? {}, unit),
    [timeline, unit],
  );
  const completionCount = measurementDefinitions.filter(
    (definition) => profile.measurements[definition.key] > 0,
  ).length;
  const heightEntries = timeline?.heightHistory.entries ?? [];

  return (
    <motion.div
      animate={{opacity: 1}}
      className="fixed inset-0 z-40 bg-primary/24 backdrop-blur-[10px]"
      exit={{opacity: 0}}
      initial={{opacity: 0}}
    >
      <div className="flex min-h-full justify-end">
        <motion.aside
          ref={dialogRef}
          aria-labelledby="fitting-timeline-title"
          aria-modal="true"
          animate={{x: 0}}
          className="flex h-screen w-full max-w-3xl flex-col overflow-hidden bg-background shadow-[0_30px_80px_-34px_rgba(3,25,46,0.5)] ring-1 ring-outline-variant/12"
          exit={{x: '100%'}}
          initial={{x: '100%'}}
          role="dialog"
          tabIndex={-1}
          transition={{duration: 0.28, ease: [0.22, 1, 0.36, 1]}}
        >
          <div className="border-b border-outline-variant/10 p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="type-overline text-secondary">Fitting timeline</p>
                <h2 className="type-section-title text-primary" id="fitting-timeline-title">
                  {profile.name}’s growth ledger
                </h2>
                <p className="type-note mt-2 text-on-surface-variant">
                  A profile-wide view of recent body measurements, height archive entries, and fitting deltas.
                </p>
              </div>
              <button
                aria-label="Close fitting timeline"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-primary"
                onClick={onClose}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 md:p-6">
            {status === 'loading' ? (
              <div className="space-y-4">
                <div className="h-36 rounded-[1.8rem] bg-surface-container-low" />
                {Array.from({length: 5}).map((_, index) => (
                  <div className="h-20 rounded-[1.4rem] bg-surface-container-low" key={index} />
                ))}
              </div>
            ) : status === 'error' ? (
              <div className="rounded-[1.6rem] bg-secondary-container/28 p-5 text-secondary">
                <p className="type-overline">Timeline unavailable</p>
                <p className="type-note mt-2">{error}</p>
                <button
                  className="type-button mt-4 rounded-full bg-primary px-4 py-3 text-white"
                  onClick={onRetry}
                  type="button"
                >
                  Retry timeline
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <section className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.6rem] bg-primary p-5 text-white">
                    <CalendarClock className="text-secondary-container" size={24} />
                    <p className="type-overline mt-5 text-white/58">Latest change</p>
                    <p className="type-ui mt-2 text-white">
                      {summary.latestChange
                        ? summary.latestChange.measurementLabel
                        : 'No measurement history yet'}
                    </p>
                    <p className="type-note mt-1 text-white/70">
                      {summary.latestChange
                        ? formatDateTime(summary.latestChange.changedAt)
                        : 'Save a measurement to start the archive.'}
                    </p>
                  </div>
                  <div className="rounded-[1.6rem] bg-white/72 p-5 ring-1 ring-outline-variant/10">
                    <Activity className="text-guidance" size={24} />
                    <p className="type-overline mt-5 text-on-surface-variant">Changed measures</p>
                    <p className="type-metric-sm mt-2 text-primary">{summary.changedCount}</p>
                    <p className="type-note mt-1 text-on-surface-variant">Measurements with at least one recorded change.</p>
                  </div>
                  <div className="rounded-[1.6rem] bg-secondary-container/34 p-5 text-secondary">
                    <Ruler size={24} />
                    <p className="type-overline mt-5">Completion</p>
                    <p className="type-metric-sm mt-2">{completionCount}/{measurementDefinitions.length}</p>
                    <p className="type-note mt-1">Current ledger values filled.</p>
                  </div>
                </section>

                <section className="rounded-[1.8rem] bg-surface-container-low/78 p-4 md:p-5">
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="type-overline text-on-surface-variant">Measurement changes</p>
                      <h3 className="type-section-title text-primary">Recent deltas</h3>
                    </div>
                    <div className="type-button rounded-full bg-white/70 px-3 py-1 text-secondary">
                      Displaying {unit}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {summary.items.length > 0 ? summary.items.map((item) => (
                      <div
                        className="rounded-[1.35rem] bg-white/78 p-4 ring-1 ring-outline-variant/10"
                        key={item.measurementKey}
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="type-ui text-primary">{item.measurementLabel}</p>
                            <p className="type-note mt-1 text-on-surface-variant">
                              {item.previousValueLabel
                                ? `${item.previousValueLabel} → ${item.latestValueLabel}`
                                : item.latestValueLabel}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 md:justify-end">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-container-high">
                              <div
                                className="h-full rounded-full bg-guidance"
                                style={{
                                  width: `${Math.min(100, Math.max(12, Math.abs(item.deltaCm ?? 1) * 12))}%`,
                                }}
                              />
                            </div>
                            <div className="min-w-24 text-right">
                              <p className="type-button text-secondary">{item.deltaLabel}</p>
                              <p className="type-label mt-1 text-on-surface-variant">{formatDateTime(item.changedAt)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-[1.35rem] bg-white/72 p-4 ring-1 ring-outline-variant/10">
                        <p className="type-note text-on-surface-variant">
                          No measurement history yet. Save a few measurements to reveal trend cards here.
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-[1.8rem] bg-white/70 p-5 ring-1 ring-outline-variant/10">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="mt-1 shrink-0 text-guidance" size={22} />
                    <div>
                      <p className="type-overline text-on-surface-variant">Height archive</p>
                      <p className="type-note mt-2 text-primary">
                        {heightEntries.length > 0
                          ? `${heightEntries.length} height ${heightEntries.length === 1 ? 'entry' : 'entries'} recorded. Latest: ${formatMeasurement(heightEntries.at(-1)?.heightCm ?? profile.heightCm, 'cm')}. ${getHeightDeltaLabel(timeline)}`
                          : `Current profile height: ${stripTrailingZeroes(profile.heightCm)} cm.`}
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </motion.aside>
      </div>
    </motion.div>
  );
}
