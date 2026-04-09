import type {MeasurementKey, MeasurementView, Measurements} from './types';

type HotspotTone = 'primary' | 'secondary';

export interface MeasurementDefinition {
  key: MeasurementKey;
  label: string;
  view: MeasurementView;
  guide: string;
  tone: HotspotTone;
  align: 'left' | 'center' | 'right';
  position: {
    top: string;
    left: string;
  };
}

export const measurementDefinitions: MeasurementDefinition[] = [
  {
    key: 'hatSize',
    label: 'Hat size',
    view: 'front',
    guide: 'Measure around the fullest part of the head.',
    tone: 'secondary',
    align: 'left',
    position: {top: '8%', left: '73%'},
  },
  {
    key: 'neck',
    label: 'Neck',
    view: 'front',
    guide: 'Wrap around the base of the neck.',
    tone: 'primary',
    align: 'right',
    position: {top: '19%', left: '18%'},
  },
  {
    key: 'shoulderCircumference',
    label: 'Shoulder circumference',
    view: 'front',
    guide: 'Measure around the shoulder line at the upper torso.',
    tone: 'primary',
    align: 'left',
    position: {top: '27%', left: '8%'},
  },
  {
    key: 'bust',
    label: 'Bust',
    view: 'front',
    guide: 'Measure around the fullest part of the chest.',
    tone: 'primary',
    align: 'right',
    position: {top: '36%', left: '18%'},
  },
  {
    key: 'underBust',
    label: 'Under bust',
    view: 'front',
    guide: 'Measure directly under the bust line.',
    tone: 'secondary',
    align: 'left',
    position: {top: '43%', left: '70%'},
  },
  {
    key: 'waist',
    label: 'Waist',
    view: 'front',
    guide: 'Measure around the natural waist.',
    tone: 'primary',
    align: 'right',
    position: {top: '49%', left: '19%'},
  },
  {
    key: 'rise',
    label: 'Rise',
    view: 'front',
    guide: 'Measure from waist to crotch along the front.',
    tone: 'primary',
    align: 'right',
    position: {top: '58%', left: '22%'},
  },
  {
    key: 'thigh',
    label: 'Thigh',
    view: 'front',
    guide: 'Measure around the widest part of the thigh.',
    tone: 'primary',
    align: 'right',
    position: {top: '68%', left: '15%'},
  },
  {
    key: 'hips',
    label: 'Hips',
    view: 'front',
    guide: 'Measure around the fullest part of the hips.',
    tone: 'primary',
    align: 'left',
    position: {top: '58%', left: '73%'},
  },
  {
    key: 'knee',
    label: 'Knee',
    view: 'front',
    guide: 'Measure around the knee while standing straight.',
    tone: 'secondary',
    align: 'left',
    position: {top: '77%', left: '63%'},
  },
  {
    key: 'shoulder',
    label: 'Shoulder',
    view: 'back',
    guide: 'Measure straight across the back shoulder points.',
    tone: 'primary',
    align: 'left',
    position: {top: '25%', left: '10%'},
  },
  {
    key: 'sleeveLength',
    label: 'Sleeve length',
    view: 'back',
    guide: 'Measure from shoulder point to wrist.',
    tone: 'primary',
    align: 'left',
    position: {top: '39%', left: '73%'},
  },
  {
    key: 'back',
    label: 'Back',
    view: 'back',
    guide: 'Measure across the back width.',
    tone: 'primary',
    align: 'right',
    position: {top: '35%', left: '18%'},
  },
  {
    key: 'torso',
    label: 'Torso',
    view: 'back',
    guide: 'Measure vertically from shoulder through torso.',
    tone: 'secondary',
    align: 'left',
    position: {top: '51%', left: '72%'},
  },
  {
    key: 'outseam',
    label: 'Outseam',
    view: 'back',
    guide: 'Measure from waist to ankle along the outside leg.',
    tone: 'primary',
    align: 'left',
    position: {top: '70%', left: '75%'},
  },
  {
    key: 'inseam',
    label: 'Inseam',
    view: 'back',
    guide: 'Measure from crotch to ankle along the inside leg.',
    tone: 'primary',
    align: 'right',
    position: {top: '73%', left: '20%'},
  },
];

export const measurementDefinitionsByKey = Object.fromEntries(
  measurementDefinitions.map((definition) => [definition.key, definition]),
) as Record<MeasurementKey, MeasurementDefinition>;

export const measurementKeysByView: Record<MeasurementView, MeasurementKey[]> = {
  front: measurementDefinitions.filter((item) => item.view === 'front').map((item) => item.key),
  back: measurementDefinitions.filter((item) => item.view === 'back').map((item) => item.key),
};

export function createEmptyMeasurements(): Measurements {
  return {
    hatSize: 0,
    neck: 0,
    shoulderCircumference: 0,
    bust: 0,
    underBust: 0,
    waist: 0,
    rise: 0,
    thigh: 0,
    hips: 0,
    knee: 0,
    shoulder: 0,
    sleeveLength: 0,
    back: 0,
    torso: 0,
    outseam: 0,
    inseam: 0,
  };
}
