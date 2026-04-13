import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPhotoFilename,
  buildYearPathFromTemplate,
  DESIRED_YEAR_PATH_TEMPLATE,
  getYearPathCandidates,
} from '../lib/storagePaths.ts';

test('buildYearPathFromTemplate injects the year into the quittance path', () => {
  assert.equal(
    buildYearPathFromTemplate(DESIRED_YEAR_PATH_TEMPLATE, 2026),
    '/ROBALEX SIGNALISATION/8. Calcul des Frais/2026/Quittance',
  );
});

test('getYearPathCandidates prefers the quittance path and keeps the legacy fallback', () => {
  assert.deepEqual(getYearPathCandidates(2026, DESIRED_YEAR_PATH_TEMPLATE), [
    '/ROBALEX SIGNALISATION/8. Calcul des Frais/2026/Quittance',
    '/Tickets/2026',
  ]);
});

test('buildPhotoFilename uses dd-mm-yyyy when the date is unique', () => {
  assert.equal(buildPhotoFilename('2026-03-07', []), '07-03-2026.jpg');
});

test('buildPhotoFilename appends an increment when the same day already exists', () => {
  assert.equal(
    buildPhotoFilename('2026-03-07', ['07-03-2026.jpg', '07-03-2026-2.jpg']),
    '07-03-2026-3.jpg',
  );
});

