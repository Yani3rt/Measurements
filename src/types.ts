export type Sex = 'female' | 'male';

export type MeasurementView = 'front' | 'back';

export type Unit = 'cm' | 'in';

export type MeasurementKey =
  | 'hatSize'
  | 'neck'
  | 'shoulderCircumference'
  | 'bust'
  | 'underBust'
  | 'waist'
  | 'rise'
  | 'thigh'
  | 'hips'
  | 'knee'
  | 'shoulder'
  | 'sleeveLength'
  | 'back'
  | 'torso'
  | 'outseam'
  | 'inseam';

export type Measurements = Record<MeasurementKey, number>;

export interface Profile {
  id: string;
  name: string;
  sex: Sex;
  heightCm: number;
  createdAt: string;
  updatedAt: string;
  measurements: Measurements;
}
