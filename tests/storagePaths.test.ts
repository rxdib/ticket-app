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

test('buildPhotoFilename uses yyyy-mm-dd_amount when unique', () => {
  assert.equal(buildPhotoFilename('2026-03-07', 7.90, []), '2026-03-07_7.90.jpg');
});

test('buildPhotoFilename appends an increment when the same file already exists', () => {
  assert.equal(
    buildPhotoFilename('2026-03-07', 7.90, ['2026-03-07_7.90.jpg']),
    '2026-03-07_7.90-2.jpg',
  );
});
