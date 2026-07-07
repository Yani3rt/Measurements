import http from 'node:http';
import {URL} from 'node:url';
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
  isValidProfileId,
  validateMeasurementValue,
  validateProfileInput,
} from '../src/validation.ts';

const host = '127.0.0.1';
const port = Number(process.env.DATA_SERVICE_PORT ?? 3101);

function sendJson(response: http.ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {'Content-Type': 'application/json'});
  response.end(JSON.stringify(body));
}

function sendError(response: http.ServerResponse, status: number, message: string) {
  sendJson(response, status, {message});
}

async function readJsonBody(request: http.IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();

  if (!rawBody) {
    return null;
  }

  return JSON.parse(rawBody) as unknown;
}

function createProfileId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `profile-${Math.random().toString(36).slice(2, 10)}`;
}

function getProfileIdFromPath(pathname: string, pattern: RegExp) {
  const match = pathname.match(pattern);
  return match?.groups?.profileId ?? null;
}

const server = http.createServer(async (request, response) => {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port}`}`);
  const {pathname} = url;

  try {
    if (method === 'GET' && pathname === '/api/profiles') {
      sendJson(response, 200, {profiles: listProfiles()});
      return;
    }

    if (method === 'POST' && pathname === '/api/profiles') {
      const body = await readJsonBody(request);
      const validationError = validateProfileInput(body);

      if (validationError) {
        sendError(response, 400, validationError);
        return;
      }

      const {heightCm, name, sex} = body as {heightCm: number; name: string; sex: Sex};
      const profile = createProfile(createProfileId(), {
        heightCm,
        name: name.trim(),
        sex,
      });

      sendJson(response, 201, {profile});
      return;
    }

    const profileMatch = pathname.match(/^\/api\/profiles\/(?<profileId>[^/]+)$/);

    if (profileMatch?.groups?.profileId && method === 'PUT') {
      const {profileId} = profileMatch.groups;

      if (!isValidProfileId(profileId)) {
        sendError(response, 400, 'Profile ID is invalid.');
        return;
      }

      const body = await readJsonBody(request);
      const validationError = validateProfileInput(body);

      if (validationError) {
        sendError(response, 400, validationError);
        return;
      }

      const {heightCm, name, sex} = body as {heightCm: number; name: string; sex: Sex};
      const profile = updateProfile(profileId, {
        heightCm,
        name: name.trim(),
        sex,
      });

      if (!profile) {
        sendError(response, 404, 'Profile not found.');
        return;
      }

      sendJson(response, 200, {profile});
      return;
    }

    if (profileMatch?.groups?.profileId && method === 'DELETE') {
      const {profileId} = profileMatch.groups;

      if (!isValidProfileId(profileId)) {
        sendError(response, 400, 'Profile ID is invalid.');
        return;
      }

      const deleted = deleteProfile(profileId);

      if (!deleted) {
        sendError(response, 404, 'Profile not found.');
        return;
      }

      sendJson(response, 200, {deletedProfileId: profileId});
      return;
    }

    const measurementMatch = pathname.match(
      /^\/api\/profiles\/(?<profileId>[^/]+)\/measurements\/(?<measurementKey>[^/]+)$/,
    );

    if (measurementMatch?.groups && method === 'PUT') {
      const {measurementKey, profileId} = measurementMatch.groups;

      if (!isValidProfileId(profileId)) {
        sendError(response, 400, 'Profile ID is invalid.');
        return;
      }

      if (!(measurementKey in measurementDefinitionsByKey)) {
        sendError(response, 404, 'Measurement not found.');
        return;
      }

      const body = await readJsonBody(request);
      const validationError = validateMeasurementValue(body);

      if (validationError) {
        sendError(response, 400, validationError);
        return;
      }

      const {valueCm} = body as {valueCm: number};
      const profile = saveMeasurement(profileId, measurementKey as MeasurementKey, valueCm);

      if (!profile) {
        sendError(response, 404, 'Profile not found.');
        return;
      }

      sendJson(response, 200, {profile});
      return;
    }

    const heightHistoryProfileId = getProfileIdFromPath(
      pathname,
      /^\/api\/profiles\/(?<profileId>[^/]+)\/height-history$/,
    );

    if (heightHistoryProfileId && method === 'GET') {
      if (!isValidProfileId(heightHistoryProfileId)) {
        sendError(response, 400, 'Profile ID is invalid.');
        return;
      }

      if (!getProfile(heightHistoryProfileId)) {
        sendError(response, 404, 'Profile not found.');
        return;
      }

      sendJson(response, 200, {
        entries: getProfileHeightHistory(heightHistoryProfileId),
        profileId: heightHistoryProfileId,
      });
      return;
    }

    const measurementHistoryMatch = pathname.match(
      /^\/api\/profiles\/(?<profileId>[^/]+)\/measurements\/(?<measurementKey>[^/]+)\/history$/,
    );

    if (measurementHistoryMatch?.groups && method === 'GET') {
      const {measurementKey, profileId} = measurementHistoryMatch.groups;

      if (!isValidProfileId(profileId)) {
        sendError(response, 400, 'Profile ID is invalid.');
        return;
      }

      if (!(measurementKey in measurementDefinitionsByKey)) {
        sendError(response, 404, 'Measurement not found.');
        return;
      }

      if (!getProfile(profileId)) {
        sendError(response, 404, 'Profile not found.');
        return;
      }

      sendJson(response, 200, {
        entries: getMeasurementHistory(profileId, measurementKey as MeasurementKey),
        measurementKey,
        measurementLabel: measurementDefinitionsByKey[measurementKey as MeasurementKey].label,
        profileId,
      });
      return;
    }

    sendError(response, 404, 'Endpoint not found.');
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : 'Unexpected server error.';
    sendError(response, 500, message);
  }
});

server.listen(port, host, () => {
  console.log(`The Atelier local data service is running on http://${host}:${port}`);
});
