import express from 'express';
import {
  createProfile,
  deleteProfile,
  getProfile,
  listProfiles,
  saveMeasurement,
  updateProfile,
} from './database.ts';
import {measurementDefinitionsByKey} from '../src/measurements.ts';
import type {MeasurementKey, Sex} from '../src/types.ts';
import {
  MAX_HEIGHT_CM,
  MAX_MEASUREMENT_CM,
  MAX_PROFILE_NAME_LENGTH,
  MIN_HEIGHT_CM,
} from '../src/validation.ts';

const app = express();
const host = '127.0.0.1';
const port = Number(process.env.PORT ?? 3001);

app.use(express.json());

function sendError(
  response: express.Response,
  status: number,
  message: string,
) {
  response.status(status).json({message});
}

function isValidSex(value: unknown): value is Sex {
  return value === 'female' || value === 'male';
}

function validateProfileInput(body: unknown) {
  if (!body || typeof body !== 'object') {
    return 'Profile details are required.';
  }

  const {heightCm, name, sex} = body as {
    heightCm?: unknown;
    name?: unknown;
    sex?: unknown;
  };

  const trimmedName = typeof name === 'string' ? name.trim() : '';

  if (!trimmedName) {
    return 'Profile name is required.';
  }

  if (trimmedName.length > MAX_PROFILE_NAME_LENGTH) {
    return `Profile name must be ${MAX_PROFILE_NAME_LENGTH} characters or fewer.`;
  }

  if (!isValidSex(sex)) {
    return 'Sex must be female or male.';
  }

  if (typeof heightCm !== 'number' || !Number.isFinite(heightCm)) {
    return 'Height must be a valid number.';
  }

  if (heightCm < MIN_HEIGHT_CM || heightCm > MAX_HEIGHT_CM) {
    return `Height must be between ${MIN_HEIGHT_CM} and ${MAX_HEIGHT_CM} cm.`;
  }

  return null;
}

function validateMeasurementValue(body: unknown) {
  if (!body || typeof body !== 'object') {
    return 'Measurement value is required.';
  }

  const {valueCm} = body as {valueCm?: unknown};

  if (typeof valueCm !== 'number' || !Number.isFinite(valueCm)) {
    return 'Measurement must be a valid number.';
  }

  if (valueCm < 0 || valueCm > MAX_MEASUREMENT_CM) {
    return `Measurement must be between 0 and ${MAX_MEASUREMENT_CM} cm.`;
  }

  return null;
}

app.get('/api/profiles', (_request, response) => {
  response.json({profiles: listProfiles()});
});

app.post('/api/profiles', (request, response) => {
  const validationError = validateProfileInput(request.body);

  if (validationError) {
    return sendError(response, 400, validationError);
  }

  const {heightCm, name, sex} = request.body as {
    heightCm: number;
    name: string;
    sex: Sex;
  };

  const profileId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `profile-${Math.random().toString(36).slice(2, 10)}`;

  try {
    const profile = createProfile(profileId, {
      heightCm,
      name: name.trim(),
      sex,
    });

    response.status(201).json({profile});
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to create profile.';
    sendError(response, 500, message);
  }
});

app.put('/api/profiles/:profileId', (request, response) => {
  const validationError = validateProfileInput(request.body);

  if (validationError) {
    return sendError(response, 400, validationError);
  }

  const {profileId} = request.params;
  const {heightCm, name, sex} = request.body as {
    heightCm: number;
    name: string;
    sex: Sex;
  };

  const profile = updateProfile(profileId, {
    heightCm,
    name: name.trim(),
    sex,
  });

  if (!profile) {
    return sendError(response, 404, 'Profile not found.');
  }

  response.json({profile});
});

app.delete('/api/profiles/:profileId', (request, response) => {
  const deleted = deleteProfile(request.params.profileId);

  if (!deleted) {
    return sendError(response, 404, 'Profile not found.');
  }

  response.json({deletedProfileId: request.params.profileId});
});

app.put('/api/profiles/:profileId/measurements/:measurementKey', (request, response) => {
  const {measurementKey, profileId} = request.params;
  const validationError = validateMeasurementValue(request.body);

  if (validationError) {
    return sendError(response, 400, validationError);
  }

  if (!(measurementKey in measurementDefinitionsByKey)) {
    return sendError(response, 404, 'Measurement not found.');
  }

  const profile = getProfile(profileId);

  if (!profile) {
    return sendError(response, 404, 'Profile not found.');
  }

  const {valueCm} = request.body as {valueCm: number};
  const updatedProfile = saveMeasurement(profileId, measurementKey as MeasurementKey, valueCm);

  response.json({profile: updatedProfile});
});

app.listen(port, host, () => {
  console.log(`The Atelier data service is running on http://${host}:${port}`);
});
