import {motion} from 'motion/react';
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
const measureLineMuted = 'rgba(141, 112, 66, 0.54)';
const measureLineMeasured = 'rgba(139, 107, 40, 0.68)';
const lineMuted = 'rgba(44, 62, 78, 0.44)';
const lineStrong = 'rgba(44, 62, 78, 0.7)';
const gold = '#8b6b28';
const goldSoft = '#d9c189';
const paper = '#fbfaf6';
const mist = '#eef0ee';
const calloutBoxHeight = 36;

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
  onSelectMeasurement,
  profile,
  selectedMeasurement,
  selectedMeasurementLabel,
  selectedMeasurementValueCm,
  unit,
}: {
  currentView: MeasurementView;
  onEditSelectedMeasurement: () => void;
  onSelectMeasurement: (measurementKey: MeasurementKey) => void;
  profile: Profile;
  selectedMeasurement: MeasurementKey | null;
  selectedMeasurementLabel: string | null;
  selectedMeasurementValueCm: number | null;
  unit: Unit;
}) {
  const callouts = calloutsByView[currentView];
  const activeCallout = callouts.find((callout) => callout.key === selectedMeasurement) ?? null;

  return (
    <div className="relative overflow-hidden rounded-[2.35rem] border border-primary/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,246,239,0.95))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] sm:p-4">
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

        {activeCallout ? (
          <motion.path
            animate={{opacity: 1, pathLength: 1}}
            d={activeCallout.pathD}
            fill="none"
            initial={{opacity: 0, pathLength: 0}}
            stroke={gold}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3.5"
            transition={{duration: 0.35, ease: 'easeOut'}}
          />
        ) : null}

        {callouts.map((callout) => {
          const isSelected = selectedMeasurement === callout.key;
          const isMeasured = profile.measurements[callout.key] > 0;

          return (
            <g
              aria-label={callout.labelLines.join(' ')}
              key={callout.key}
              onClick={() => onSelectMeasurement(callout.key)}
              style={{cursor: 'pointer'}}
            >
              <path
                d={callout.pathD}
                fill="none"
                stroke={isSelected ? gold : isMeasured ? measureLineMeasured : measureLineMuted}
                strokeDasharray={isSelected ? undefined : '2 8'}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={isSelected ? 2.4 : 1.35}
              />
              <path
                d={buildLeaderPath(callout)}
                fill="none"
                stroke={isSelected ? gold : isMeasured ? 'rgba(139,107,40,0.58)' : lineStrong}
                strokeDasharray={isSelected ? undefined : '2 6'}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={isSelected ? 2.4 : 1.5}
              />
              <circle
                cx={callout.anchor.x}
                cy={callout.anchor.y}
                fill={isMeasured || isSelected ? gold : ink}
                r={isSelected ? 6.2 : 4.6}
                stroke={paper}
                strokeWidth="2.5"
              />

              <g transform={`translate(${callout.box.x} ${callout.box.y})`}>
                <rect
                  fill={isSelected ? ink : isMeasured ? 'rgba(245,233,201,0.95)' : 'rgba(255,255,255,0.84)'}
                  height={callout.box.height}
                  rx="18"
                  stroke={isSelected ? 'rgba(255,255,255,0.16)' : isMeasured ? 'rgba(139,107,40,0.18)' : 'rgba(32,56,74,0.09)'}
                  width={callout.box.width}
                />
                <circle cx="14" cy={callout.box.height / 2} fill={isMeasured || isSelected ? gold : 'rgba(32,56,74,0.24)'} r="4" />
                <text
                  fill={isSelected ? paper : isMeasured ? gold : ink}
                  fontFamily='"Hanken Grotesk", "Avenir Next", "Segoe UI", sans-serif'
                  fontSize="10.75"
                  fontWeight="700"
                  letterSpacing="0.16em"
                  x="26"
                  y={callout.labelLines.length === 1 ? callout.box.height / 2 + 4 : 17}
                >
                  {callout.labelLines.map((line, index) => (
                    <tspan dy={index === 0 ? 0 : 13} key={line} x="26">
                      {line.charAt(0).toUpperCase() + line.slice(1).toLowerCase()}
                    </tspan>
                  ))}
                </text>
              </g>

              <path d={callout.pathD} fill="none" pointerEvents="stroke" stroke="transparent" strokeLinecap="round" strokeLinejoin="round" strokeWidth="20" />
            </g>
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
