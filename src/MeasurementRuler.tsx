import {motion} from 'motion/react';
import {cmToInches, stripTrailingZeroes} from './utils';
import type {Unit} from './types';

type MeasurementRulerProps = {
  hasRecordedValue: boolean;
  onEditSelectedMeasurement?: () => void;
  selectedLabel: string | null;
  unit: Unit;
  valueCm: number | null;
};

const scaleConfig = {
  cm: {
    defaultFocus: 22,
    domainMax: 260,
    minorStep: 0.25,
    pixelsPerUnit: 46,
    visibleRadius: 3,
  },
  in: {
    defaultFocus: 8.5,
    domainMax: 104,
    minorStep: 0.125,
    pixelsPerUnit: 60,
    visibleRadius: 3,
  },
} as const;

export function MeasurementRuler({
  hasRecordedValue,
  onEditSelectedMeasurement,
  selectedLabel,
  unit,
  valueCm,
}: MeasurementRulerProps) {
  const config = scaleConfig[unit];
  const recordedValue = valueCm === null ? null : unit === 'cm' ? valueCm : cmToInches(valueCm);
  const focusValue =
    selectedLabel && hasRecordedValue && recordedValue !== null ? recordedValue : config.defaultFocus;
  const domainMax = Math.max(config.domainMax, Math.ceil(focusValue + config.visibleRadius + 6));
  const rangeStart = Math.max(0, Math.floor(focusValue) - config.visibleRadius);
  const rangeEnd = rangeStart + config.visibleRadius * 2;
  const marks = buildMarks(domainMax, config.minorStep);
  const badgeValue = selectedLabel
    ? hasRecordedValue && recordedValue !== null
      ? `${stripTrailingZeroes(recordedValue)} ${unit}`
      : 'Pending'
    : 'Select one';

  return (
    <div className="pointer-events-none relative w-full overflow-hidden pb-9 pt-2 md:pb-11 md:pt-3">
      <div className="pointer-events-none absolute left-1/2 top-[17px] h-3 w-3 -translate-x-1/2 rotate-45 rounded-[0.24rem] bg-secondary shadow-[0_10px_20px_-12px_rgba(115,91,36,0.82)] md:top-[19px] md:h-3.5 md:w-3.5 md:rounded-[0.28rem]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 top-[42px] w-px -translate-x-1/2 bg-[linear-gradient(180deg,rgba(115,91,36,0.65),rgba(115,91,36,0.08))] md:top-[46px]" />

      <div className="relative h-[4.5rem] overflow-hidden sm:h-[5rem] md:h-24">
        <motion.div
          animate={{x: -focusValue * config.pixelsPerUnit}}
          className="absolute inset-y-0 left-1/2"
          transition={{type: 'spring', stiffness: 140, damping: 24, mass: 0.8}}
        >
          <div
            className="relative h-full"
            style={{width: `${domainMax * config.pixelsPerUnit}px`}}
          >
            {marks.map((mark) => {
              const isMajor = isWhole(mark);
              const isMedium = !isMajor && isHalf(mark);
              const isInVisibleRange = mark >= rangeStart && mark <= rangeEnd;

              return (
                <div
                  className="absolute bottom-0"
                  key={mark}
                  style={{
                    left: `${mark * config.pixelsPerUnit}px`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  {isMajor && isInVisibleRange ? (
                    <span className="absolute left-1/2 top-0 -translate-x-1/2 font-body text-[1.2rem] font-light text-primary/72 sm:text-[1.45rem] md:text-[2rem]">
                      {Math.round(mark)}
                    </span>
                  ) : null}
                  <span
                    className={`absolute bottom-0 left-1/2 w-px -translate-x-1/2 rounded-full ${
                      isMajor
                        ? 'h-8 bg-primary/40 sm:h-9 md:h-11'
                        : isMedium
                          ? 'h-6 bg-primary/28 sm:h-7 md:h-8'
                          : 'h-4 bg-primary/18 sm:h-4.5 md:h-5'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      <button
        className="pointer-events-auto absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1.5 text-center shadow-[0_16px_30px_-22px_rgba(3,25,46,0.8)] md:bottom-3 md:px-4 md:py-2"
        disabled={!selectedLabel}
        onClick={onEditSelectedMeasurement}
        type="button"
      >
        <p className="font-body text-[0.52rem] uppercase tracking-[0.16em] text-white/60 md:text-[0.58rem] md:tracking-[0.18em]">
          {selectedLabel ?? 'Selected measurement'}
        </p>
        <p className="mt-0.5 font-headline text-lg text-white md:mt-1 md:text-xl">
          {badgeValue}
        </p>
      </button>
    </div>
  );
}

function buildMarks(domainMax: number, minorStep: number) {
  const marks: number[] = [];
  const count = Math.floor(domainMax / minorStep);

  for (let index = 0; index <= count; index += 1) {
    marks.push(Number((index * minorStep).toFixed(3)));
  }

  return marks;
}

function isWhole(value: number) {
  return Math.abs(value - Math.round(value)) < 0.0001;
}

function isHalf(value: number) {
  return Math.abs(value * 2 - Math.round(value * 2)) < 0.0001;
}
