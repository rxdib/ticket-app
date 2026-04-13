import assert from 'node:assert/strict';

import {
  buildPhotoFilename,
  buildYearPathFromTemplate,
  DESIRED_YEAR_PATH_TEMPLATE,
  getYearPathCandidates,
} from '../lib/storagePaths.ts';

assert.equal(
  buildYearPathFromTemplate(DESIRED_YEAR_PATH_TEMPLATE, 2026),
  '/ROBALEX SIGNALISATION/8. Calcul des Frais/2026/Quittance',
);

assert.deepEqual(getYearPathCandidates(2026, DESIRED_YEAR_PATH_TEMPLATE), [
  '/ROBALEX SIGNALISATION/8. Calcul des Frais/2026/Quittance',
  '/Tickets/2026',
]);

assert.equal(buildPhotoFilename('2026-03-07', []), '07-03-2026.jpg');

assert.equal(
  buildPhotoFilename('2026-03-07', ['07-03-2026.jpg', '07-03-2026-2.jpg']),
  '07-03-2026-3.jpg',
);

