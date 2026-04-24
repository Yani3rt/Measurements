import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
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
    visibleRadius: 5,
  },
  in: {
    defaultFocus: 8.5,
    domainMax: 104,
    minorStep: 0.125,
    pixelsPerUnit: 60,
    visibleRadius: 5,
  },
} as const;
const easeOutQuint = [0.22, 1, 0.36, 1] as const;

export function MeasurementRuler({
  hasRecordedValue,
  onEditSelectedMeasurement,
  selectedLabel,
  unit,
  valueCm,
}: MeasurementRulerProps) {
  const config = scaleConfig[unit];
  const prefersReducedMotion = useReducedMotion();
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
      : 'Add'
    : 'Select one';
  const mobileBadgeValue = selectedLabel ? badgeValue : 'Select';
  const rulerTransition = prefersReducedMotion
    ? {duration: 0.01}
    : {type: 'spring', stiffness: 140, damping: 24, mass: 0.8};
  const badgeTransition = prefersReducedMotion
    ? {duration: 0.01}
    : {duration: 0.26, ease: easeOutQuint};
  const hasSelection = Boolean(selectedLabel);

  return (
    <div className="pointer-events-none relative w-full overflow-hidden pb-9 pt-2 md:pb-11 md:pt-3">
      <div
        className={`pointer-events-none absolute left-1/2 top-[17px] h-3 w-3 -translate-x-1/2 rotate-45 rounded-[0.24rem] md:top-[19px] md:h-3.5 md:w-3.5 md:rounded-[0.28rem] ${
          hasSelection
            ? 'bg-guidance shadow-[0_10px_20px_-12px_rgba(46,111,115,0.78)]'
            : 'bg-secondary shadow-[0_10px_20px_-12px_rgba(115,91,36,0.82)]'
        }`}
      />
      <div
        className={`pointer-events-none absolute bottom-0 left-1/2 top-[42px] w-px -translate-x-1/2 md:top-[46px] ${
          hasSelection
            ? 'bg-[linear-gradient(180deg,rgba(46,111,115,0.68),rgba(46,111,115,0.08))]'
            : 'bg-[linear-gradient(180deg,rgba(115,91,36,0.65),rgba(115,91,36,0.08))]'
        }`}
      />

      <div className="relative h-[4.5rem] overflow-hidden sm:h-[5rem] md:h-24">
        <motion.div
          animate={{x: -focusValue * config.pixelsPerUnit}}
          className="absolute inset-y-0 left-1/2"
          transition={rulerTransition}
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
                  className="absolute top-2 flex -translate-x-1/2 flex-col items-center sm:top-2.5 md:top-3"
                  key={mark}
                  style={{
                    left: `${mark * config.pixelsPerUnit}px`,
                  }}
                >
                  <span
                    className={`w-px rounded-full ${
                      isMajor
                        ? 'h-8 bg-primary/40 sm:h-9 md:h-11'
                        : isMedium
                          ? 'h-6 bg-primary/28 sm:h-7 md:h-8'
                          : 'h-4 bg-primary/18 sm:h-4.5 md:h-5'
                    }`}
                  />
                  {isMajor && isInVisibleRange ? (
                    <span className="mt-1.5 font-headline text-[0.7rem] font-semibold tracking-[0.08em] text-primary/58 [font-variant-numeric:lining-nums_tabular-nums] sm:text-[0.76rem] md:mt-2 md:text-[0.9rem]">
                      {Math.round(mark)}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      <motion.button
        className={`pointer-events-auto absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full px-3 py-1.5 text-center md:bottom-3 md:px-4 md:py-2 ${
          hasSelection
            ? 'bg-primary ring-1 ring-guidance/45 shadow-[0_18px_32px_-20px_rgba(36,88,92,0.45)]'
            : 'bg-primary shadow-[0_16px_30px_-22px_rgba(3,25,46,0.8)]'
        }`}
        disabled={!selectedLabel}
        initial={false}
        onClick={() => onEditSelectedMeasurement?.()}
        transition={badgeTransition}
        type="button"
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: prefersReducedMotion ? 0 : -4}}
            initial={{opacity: 0, y: prefersReducedMotion ? 0 : 6}}
            key={`${selectedLabel ?? 'empty'}-${badgeValue}`}
            transition={badgeTransition}
          >
            <p className="type-label hidden text-white/60 md:block">
              {selectedLabel ?? 'Selected measurement'}
            </p>
            <p className="type-metric-sm mt-0 text-white md:mt-1">
              <span
                className={`md:hidden ${
                  selectedLabel ? '' : 'text-[1.2rem] leading-[1] tracking-[-0.01em]'
                }`}
              >
                {mobileBadgeValue}
              </span>
              <span className="hidden md:inline">{badgeValue}</span>
            </p>
          </motion.div>
        </AnimatePresence>
      </motion.button>
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
