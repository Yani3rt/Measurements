import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {ArrowRightLeft} from 'lucide-react';
import frontAsset from '../front.svg';
import backAsset from '../back.svg';
import {MeasurementRuler} from './MeasurementRuler';
import type {MeasurementKey, MeasurementView, Profile, Unit} from './types';

type PlateCallout = {
  key: MeasurementKey;
  labelLines: string[];
  box: {x: number; y: number; width: number; height: number};
  side: 'left' | 'right';
  anchor: {x: number; y: number};
  pathD: string;
  uppercase?: boolean;
};

const ink = '#20384a';
const inkSoft = '#6b7c8d';
const measureLineIdle = 'rgba(152, 122, 67, 0.72)';
const measureLineMeasured = 'rgba(139, 107, 40, 0.84)';
const measureLineSelected = '#2e6f73';
const leaderLineIdle = 'rgba(58, 76, 92, 0.48)';
const leaderLineMeasured = 'rgba(58, 76, 92, 0.6)';
const leaderLineSelected = 'rgba(46, 111, 115, 0.82)';
const gold = '#8b6b28';
const guidance = '#2e6f73';
const guidanceSoft = '#d7e8e6';
const paper = '#fbfaf6';
const mist = '#eef0ee';
const calloutBoxHeight = 36;
const easeOutQuint = [0.22, 1, 0.36, 1] as const;

function createCalloutBox(x: number, y: number, labelLines: string[]) {
  const longestLineLength = Math.max(...labelLines.map((line) => line.length));
  const width = Math.max(68, Math.round(38 + longestLineLength * 8));

  return {x, y, width, height: calloutBoxHeight};
}

const frontCallouts: PlateCallout[] = [
  {key: 'hatSize', labelLines: ['Hat'], box: createCalloutBox(421, 84, ['Hat']), side: 'right', anchor: {x: 318, y: 133}, pathD: 'M242 133 C254 105 306 105 318 133'},
  {key: 'neck', labelLines: ['Neck'], box: createCalloutBox(421, 153, ['Neck']), side: 'right', anchor: {x: 298, y: 213}, pathD: 'M262 213 C271 221 289 221 298 213'},
  {key: 'shoulderCircumference', labelLines: ['Shoulder'], box: createCalloutBox(26, 151, ['Shoulder']), side: 'left', anchor: {x: 210, y: 247}, pathD: 'M210 247 C240 239 320 239 350 247'},
  {key: 'bust', labelLines: ['Bust'], box: createCalloutBox(26, 232, ['Bust']), side: 'left', anchor: {x: 236, y: 274}, pathD: 'M236 274 C256 268 304 268 324 274'},
  {key: 'underBust', labelLines: ['U-Bust'], box: createCalloutBox(421, 219, ['U-Bust']), side: 'right', anchor: {x: 320, y: 288}, pathD: 'M240 288 C260 292 300 292 320 288'},
  {key: 'waist', labelLines: ['Waist'], box: createCalloutBox(26, 288, ['Waist']), side: 'left', anchor: {x: 244, y: 333}, pathD: 'M244 333 C260 337 300 337 316 333'},
  {key: 'rise', labelLines: ['Rise'], box: createCalloutBox(26, 344, ['Rise']), side: 'left', anchor: {x: 280, y: 387}, pathD: 'M280 338 L280 420'},
  {key: 'thigh', labelLines: ['Thigh'], box: createCalloutBox(26, 400, ['Thigh']), side: 'left', anchor: {x: 224, y: 445}, pathD: 'M224 445 C236 443 256 443 270 445'},
  {key: 'hips', labelLines: ['Hips'], box: createCalloutBox(421, 306, ['Hips']), side: 'right', anchor: {x: 336, y: 392}, pathD: 'M224 392 L336 392'},
  {key: 'knee', labelLines: ['Knee'], box: createCalloutBox(421, 385, ['Knee']), side: 'right', anchor: {x: 307, y: 440}, pathD: 'M307 337 L307 541'},
];

const backCallouts: PlateCallout[] = [
  {key: 'shoulder', labelLines: ['Shoulder'], box: createCalloutBox(26, 150, ['Shoulder']), side: 'left', anchor: {x: 219, y: 216}, pathD: 'M219 216 C232 208 328 208 341 216'},
  {key: 'back', labelLines: ['Back'], box: createCalloutBox(26, 212, ['Back']), side: 'left', anchor: {x: 231, y: 248}, pathD: 'M231 248 C247 244 313 244 329 248'},
  {key: 'sleeveLength', labelLines: ['SLEEVE'], box: createCalloutBox(421, 212, ['SLEEVE']), side: 'right', anchor: {x: 391, y: 402}, pathD: 'M363 210 C381 248 391 304 391 402', uppercase: false},
  {key: 'torso', labelLines: ['Torso'], box: createCalloutBox(421, 150, ['Torso']), side: 'right', anchor: {x: 281, y: 256}, pathD: 'M281 195 L281 317'},
  {key: 'outseam', labelLines: ['Outseam'], box: createCalloutBox(421, 450, ['Outseam']), side: 'right', anchor: {x: 349, y: 473}, pathD: 'M349 343 L349 711'},
  {key: 'inseam', labelLines: ['Inseam'], box: createCalloutBox(26, 450, ['Inseam']), side: 'left', anchor: {x: 280, y: 462}, pathD: 'M280 415 L280 705'},
];

const calloutsByView: Record<MeasurementView, PlateCallout[]> = {
  front: frontCallouts,
  back: backCallouts,
};

export function TechnicalMeasurementPlate({
  currentView,
  onEditSelectedMeasurement,
  onSetCurrentView,
  onToggleUnit,
  onSelectMeasurement,
  profile,
  selectedMeasurement,
  selectedMeasurementLabel,
  selectedMeasurementValueCm,
  unit,
}: {
  currentView: MeasurementView;
  onEditSelectedMeasurement: () => void;
  onSetCurrentView: (view: MeasurementView) => void;
  onToggleUnit: () => void;
  onSelectMeasurement: (measurementKey: MeasurementKey) => void;
  profile: Profile;
  selectedMeasurement: MeasurementKey | null;
  selectedMeasurementLabel: string | null;
  selectedMeasurementValueCm: number | null;
  unit: Unit;
}) {
  const callouts = calloutsByView[currentView];
  const activeCallout = callouts.find((callout) => callout.key === selectedMeasurement) ?? null;
  const prefersReducedMotion = useReducedMotion();
  const stateTransition = prefersReducedMotion
    ? {duration: 0.01}
    : {duration: 0.26, ease: easeOutQuint};
  const drawTransition = prefersReducedMotion
    ? {duration: 0.01}
    : {duration: 0.34, ease: easeOutQuint};
  const settleTransition = prefersReducedMotion
    ? {duration: 0.01}
    : {type: 'spring', stiffness: 310, damping: 28, mass: 0.72};

  return (
    <div className="relative overflow-hidden rounded-[2.35rem] border border-primary/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,246,239,0.95))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] sm:p-4">
      <div className="absolute left-4 top-4 z-20 sm:left-6 sm:top-5">
        <div className="inline-flex rounded-full bg-white/92 p-1 shadow-[0_14px_32px_-24px_rgba(3,25,46,0.38)] ring-1 ring-outline-variant/10 backdrop-blur-sm">
          {([
            {label: 'Front', value: 'front'},
            {label: 'Back', value: 'back'},
          ] as const).map((option) => (
            <button
              key={option.value}
              className={`type-button rounded-full px-4 py-2 transition-all ${
                option.value === currentView
                  ? 'bg-primary text-white shadow-[0_10px_18px_-14px_rgba(3,25,46,0.72)]'
                  : 'text-primary/68'
              }`}
              onClick={() => onSetCurrentView(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-5">
        <button
          aria-label={`Switch units to ${unit === 'cm' ? 'in' : 'cm'}`}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/92 text-primary shadow-[0_14px_32px_-24px_rgba(3,25,46,0.38)] ring-1 ring-outline-variant/10 backdrop-blur-sm transition-all hover:bg-white"
          onClick={onToggleUnit}
          type="button"
        >
          <ArrowRightLeft size={14} />
        </button>
      </div>
      <div className="absolute inset-x-4 top-3 z-10 sm:inset-x-6 sm:top-4">
        <MeasurementRuler
          hasRecordedValue={selectedMeasurementValueCm !== null && selectedMeasurementValueCm > 0}
          onEditSelectedMeasurement={onEditSelectedMeasurement}
          selectedLabel={selectedMeasurementLabel}
          unit={unit}
          valueCm={selectedMeasurementValueCm}
        />
      </div>
      <div className="pt-[5.5rem] sm:pt-[6rem] md:pt-[5.25rem] lg:pt-[4.5rem]">
        <svg
          aria-label={`${currentView} measurement diagram for ${profile.name}`}
          className="block h-auto w-full"
          role="img"
          viewBox="0 0 560 760"
        >
        <defs>
          <linearGradient id="plate-wash" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={paper} />
            <stop offset="100%" stopColor={mist} />
          </linearGradient>
          <pattern height="28" id="plate-grid" patternUnits="userSpaceOnUse" width="28">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(32,56,74,0.065)" strokeWidth="1" />
          </pattern>
          <filter id="plate-glow">
            <feGaussianBlur result="coloredBlur" stdDeviation="5" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect fill="url(#plate-wash)" height="760" rx="32" width="560" />
        <rect fill="url(#plate-grid)" height="760" opacity="0.7" width="560" />
        <path d="M28 120 C112 54 214 28 340 36 C452 42 516 78 532 132" fill="none" opacity="0.32" stroke="rgba(139,107,40,0.28)" strokeWidth="1.5" />
        <path d="M38 680 C142 720 262 734 394 712 C462 700 504 682 526 660" fill="none" opacity="0.18" stroke="rgba(32,56,74,0.16)" strokeWidth="1.5" />

        <g opacity="0.9">
          <path d="M280 136 L280 710" fill="none" stroke="rgba(32,56,74,0.12)" strokeDasharray="4 8" strokeWidth="1.5" />
          <path d="M136 238 L424 238" fill="none" stroke="rgba(32,56,74,0.08)" strokeDasharray="4 8" strokeWidth="1" />
          <path d="M144 490 L416 490" fill="none" stroke="rgba(32,56,74,0.08)" strokeDasharray="4 8" strokeWidth="1" />
          <circle cx="280" cy="238" fill="rgba(139,107,40,0.18)" r="3.5" />
          <circle cx="280" cy="490" fill="rgba(139,107,40,0.18)" r="3.5" />
        </g>

        {currentView === 'front' ? <FrontFigure /> : <BackFigure />}

        <AnimatePresence initial={false} mode="wait">
          {activeCallout ? (
            <motion.path
              animate={{opacity: 1, pathLength: 1}}
              d={activeCallout.pathD}
              exit={{opacity: 0}}
              fill="none"
              initial={{opacity: 0, pathLength: 0}}
              key={`active-line-${activeCallout.key}`}
              stroke={gold}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3.5"
              style={{
                filter: 'drop-shadow(0 0 8px rgba(46,111,115,0.16))',
              }}
              transition={drawTransition}
            />
          ) : null}
        </AnimatePresence>

        {activeCallout ? (
          <motion.circle
            animate={
              prefersReducedMotion
                ? {opacity: 0.14, r: 10}
                : {opacity: [0.05, 0.22, 0.05], r: [8, 15, 8]}
            }
            cx={activeCallout.anchor.x}
            cy={activeCallout.anchor.y}
            fill={guidanceSoft}
            initial={{opacity: 0, r: 6}}
            key={`active-pulse-${activeCallout.key}`}
            transition={
              prefersReducedMotion
                ? {duration: 0.01}
                : {
                    duration: 1.65,
                    ease: easeOutQuint,
                    repeat: Infinity,
                    repeatType: 'loop',
                  }
            }
          />
        ) : null}

        {callouts.map((callout) => {
          const isSelected = selectedMeasurement === callout.key;
          const isMeasured = profile.measurements[callout.key] > 0;
          const chipLift = isSelected && !prefersReducedMotion ? -2.5 : 0;

          return (
            <motion.g
              aria-label={callout.labelLines.join(' ')}
              initial={false}
              key={callout.key}
              onClick={() => onSelectMeasurement(callout.key)}
              style={{cursor: 'pointer'}}
            >
              <motion.path
                animate={{
                  opacity: isSelected ? 1 : isMeasured ? 0.96 : 0.88,
                  stroke: isSelected
                    ? measureLineSelected
                    : isMeasured
                      ? measureLineMeasured
                      : measureLineIdle,
                  strokeWidth: isSelected ? 3.1 : isMeasured ? 2.3 : 2.05,
                }}
                d={callout.pathD}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  filter: isSelected
                    ? 'drop-shadow(0 0 6px rgba(46,111,115,0.12))'
                    : undefined,
                }}
                transition={stateTransition}
              />
              <motion.path
                animate={{
                  opacity: isSelected ? 0.94 : isMeasured ? 0.8 : 0.72,
                  stroke: isSelected
                    ? leaderLineSelected
                    : isMeasured
                      ? leaderLineMeasured
                      : leaderLineIdle,
                  strokeWidth: isSelected ? 2 : 1.55,
                }}
                d={buildLeaderPath(callout)}
                fill="none"
                strokeDasharray={isSelected ? '2 7' : '2 6'}
                strokeLinecap="round"
                strokeLinejoin="round"
                transition={stateTransition}
              />
              <motion.circle
                animate={{
                  fill: isSelected ? guidance : isMeasured ? gold : ink,
                  opacity: isSelected ? 1 : isMeasured ? 0.94 : 0.88,
                  r: isSelected ? 6.2 : 4.6,
                }}
                cx={callout.anchor.x}
                cy={callout.anchor.y}
                stroke={paper}
                strokeWidth="2.5"
                transition={settleTransition}
              />

              <g transform={`translate(${callout.box.x} ${callout.box.y})`}>
                <motion.g animate={{y: chipLift}} transition={settleTransition}>
                  <motion.rect
                    animate={{
                      fill: isSelected
                        ? ink
                        : isMeasured
                          ? 'rgba(245,233,201,0.95)'
                          : 'rgba(255,255,255,0.84)',
                      opacity: isSelected ? 1 : 0.96,
                      stroke: isSelected
                        ? 'rgba(215,232,230,0.82)'
                        : isMeasured
                          ? 'rgba(139,107,40,0.18)'
                          : 'rgba(32,56,74,0.09)',
                    }}
                    height={callout.box.height}
                    rx="18"
                    style={{
                      filter: isSelected
                        ? 'drop-shadow(0 10px 24px rgba(46,111,115,0.18))'
                        : undefined,
                    }}
                    transition={settleTransition}
                    width={callout.box.width}
                  />
                  <motion.circle
                    animate={{
                      fill: isSelected ? guidance : isMeasured ? gold : 'rgba(32,56,74,0.24)',
                    }}
                    cx="14"
                    cy={callout.box.height / 2}
                    r="4"
                    transition={settleTransition}
                  />
                  <motion.text
                    animate={{
                      fill: isSelected ? paper : isMeasured ? gold : ink,
                    }}
                    fontFamily='"Hanken Grotesk", "Avenir Next", "Segoe UI", sans-serif'
                    fontSize="10.75"
                    fontWeight="700"
                    letterSpacing="0.16em"
                    transition={settleTransition}
                    x="26"
                    y={callout.labelLines.length === 1 ? callout.box.height / 2 + 4 : 17}
                  >
                    {callout.labelLines.map((line, index) => (
                      <tspan dy={index === 0 ? 0 : 13} key={line} x="26">
                        {line.charAt(0).toUpperCase() + line.slice(1).toLowerCase()}
                      </tspan>
                    ))}
                  </motion.text>
                </motion.g>
              </g>

              <path d={callout.pathD} fill="none" pointerEvents="stroke" stroke="transparent" strokeLinecap="round" strokeLinejoin="round" strokeWidth="20" />
            </motion.g>
          );
        })}

        <g opacity="0.4">
          <text fill={gold} fontFamily='"Hanken Grotesk", "Avenir Next", "Segoe UI", sans-serif' fontSize="10.5" fontWeight="700" letterSpacing="0.28em" x="34" y="734">
            HOUSEHOLD ARCHIVE
          </text>
          <text fill={inkSoft} fontFamily='"Hanken Grotesk", "Avenir Next", "Segoe UI", sans-serif' fontSize="10.5" fontWeight="700" letterSpacing="0.28em" textAnchor="end" x="526" y="734">
            MEASUREMENT REFERENCE
          </text>
        </g>
        </svg>
      </div>
    </div>
  );
}

function buildLeaderPath(callout: PlateCallout) {
  const startX = callout.side === 'left' ? callout.box.x + callout.box.width : callout.box.x;
  const startY = callout.box.y + callout.box.height / 2;
  const midX =
    callout.side === 'left'
      ? Math.min(callout.anchor.x - 18, startX + 44)
      : Math.max(callout.anchor.x + 18, startX - 44);

  return `M${startX} ${startY} L${midX} ${startY} L${callout.anchor.x} ${callout.anchor.y}`;
}

function FrontFigure() {
  return (
    <g>
      <image
        height="943"
        href={frontAsset}
        opacity="0.95"
        preserveAspectRatio="xMidYMid slice"
        style={{mixBlendMode: 'multiply'}}
        width="462"
        x="49"
        y="-44"
      />
    </g>
  );
}

function BackFigure() {
  return (
    <g>
      <image
        height="941"
        href={backAsset}
        opacity="0.95"
        preserveAspectRatio="xMidYMid slice"
        style={{mixBlendMode: 'multiply'}}
        width="470"
        x="45"
        y="-68"
      />
    </g>
  );
}
