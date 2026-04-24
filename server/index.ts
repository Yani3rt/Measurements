import 'dotenv/config';
import express from 'express';
import {
  createProfile,
  deleteProfile,
  getMeasurementHistory,
  getProfile,
  getProfileHeightHistory,
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
import {requireAuthenticatedUser} from './auth.ts';

const app = express();
const host = '127.0.0.1';
const port = Number(process.env.DATA_SERVICE_PORT ?? 3101);

app.use(express.json());
app.use('/api', requireAuthenticatedUser);

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

function isValidProfileId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
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

app.get('/api/profiles', async (_request, response) => {
  try {
    response.json({profiles: await listProfiles(_request.authUser!.id)});
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load profiles.';
    sendError(response, 500, message);
  }
});

app.post('/api/profiles', async (request, response) => {
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
    const profile = await createProfile(profileId, request.authUser!.id, {
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

app.put('/api/profiles/:profileId', async (request, response) => {
  const validationError = validateProfileInput(request.body);

  if (validationError) {
    return sendError(response, 400, validationError);
  }

  const {profileId} = request.params;

  if (!isValidProfileId(profileId)) {
    return sendError(response, 400, 'Profile ID is invalid.');
  }

  const {heightCm, name, sex} = request.body as {
    heightCm: number;
    name: string;
    sex: Sex;
  };

  try {
    const profile = await updateProfile(profileId, request.authUser!.id, {
      heightCm,
      name: name.trim(),
      sex,
    });

    if (!profile) {
      return sendError(response, 404, 'Profile not found.');
    }

    response.json({profile});
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to update profile.';
    sendError(response, 500, message);
  }
});

app.delete('/api/profiles/:profileId', async (request, response) => {
  const {profileId} = request.params;

  if (!isValidProfileId(profileId)) {
    return sendError(response, 400, 'Profile ID is invalid.');
  }

  try {
    const deleted = await deleteProfile(profileId, request.authUser!.id);

    if (!deleted) {
      return sendError(response, 404, 'Profile not found.');
    }

    response.json({deletedProfileId: profileId});
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to delete profile.';
    sendError(response, 500, message);
  }
});

app.put('/api/profiles/:profileId/measurements/:measurementKey', async (request, response) => {
  const {measurementKey, profileId} = request.params;
  const validationError = validateMeasurementValue(request.body);

  if (validationError) {
    return sendError(response, 400, validationError);
  }

  if (!isValidProfileId(profileId)) {
    return sendError(response, 400, 'Profile ID is invalid.');
  }

  if (!(measurementKey in measurementDefinitionsByKey)) {
    return sendError(response, 404, 'Measurement not found.');
  }

  try {
    const profile = await getProfile(profileId, request.authUser!.id);

    if (!profile) {
      return sendError(response, 404, 'Profile not found.');
    }

    const {valueCm} = request.body as {valueCm: number};
    const updatedProfile = await saveMeasurement(
      profileId,
      request.authUser!.id,
      measurementKey as MeasurementKey,
      valueCm,
    );

    response.json({profile: updatedProfile});
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to save measurement.';
    sendError(response, 500, message);
  }
});

app.get('/api/profiles/:profileId/height-history', async (request, response) => {
  const {profileId} = request.params;

  if (!isValidProfileId(profileId)) {
    return sendError(response, 400, 'Profile ID is invalid.');
  }

  try {
    const profile = await getProfile(profileId, request.authUser!.id);

    if (!profile) {
      return sendError(response, 404, 'Profile not found.');
    }

    const entries = await getProfileHeightHistory(profileId, request.authUser!.id);

    response.json({
      entries,
      profileId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load profile height history.';
    sendError(response, 500, message);
  }
});

app.get('/api/profiles/:profileId/measurements/:measurementKey/history', async (request, response) => {
  const {measurementKey, profileId} = request.params;

  if (!isValidProfileId(profileId)) {
    return sendError(response, 400, 'Profile ID is invalid.');
  }

  if (!(measurementKey in measurementDefinitionsByKey)) {
    return sendError(response, 404, 'Measurement not found.');
  }

  try {
    const profile = await getProfile(profileId, request.authUser!.id);

    if (!profile) {
      return sendError(response, 404, 'Profile not found.');
    }

    const entries = await getMeasurementHistory(
      profileId,
      request.authUser!.id,
      measurementKey as MeasurementKey,
    );

    response.json({
      entries,
      measurementKey,
      measurementLabel: measurementDefinitionsByKey[measurementKey as MeasurementKey].label,
      profileId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load measurement history.';
    sendError(response, 500, message);
  }
});

app.listen(port, host, () => {
  console.log(`The Atelier data service is running on http://${host}:${port}`);
});
