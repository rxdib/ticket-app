const YEAR_PLACEHOLDER = '{year}';

export const DESIRED_YEAR_PATH_TEMPLATE = '/ROBALEX SIGNALISATION/8. Calcul des Frais/{year}/Quittance';
export const LEGACY_YEAR_PATH_TEMPLATE = '/Tickets/{year}';

function normalizeTemplate(template: string): string {
  const trimmed = template.trim();
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

export function buildYearPathFromTemplate(template: string, year: number): string {
  const normalized = normalizeTemplate(template);

  if (!normalized.includes(YEAR_PLACEHOLDER)) {
    throw new Error(`Dropbox year path template must contain ${YEAR_PLACEHOLDER}.`);
  }

  return normalized.replaceAll(YEAR_PLACEHOLDER, String(year));
}

export function getConfiguredYearPathTemplate(): string {
  return process.env.DROPBOX_YEAR_PATH_TEMPLATE?.trim() || LEGACY_YEAR_PATH_TEMPLATE;
}

export function getYearPathCandidates(
  year: number,
  preferredTemplate = getConfiguredYearPathTemplate(),
): string[] {
  const preferred = buildYearPathFromTemplate(preferredTemplate, year);
  const legacy = buildYearPathFromTemplate(LEGACY_YEAR_PATH_TEMPLATE, year);

  return preferred === legacy ? [preferred] : [preferred, legacy];
}

function formatPhotoDate(date: string): string {
  const [year, month, day] = date.split('-');

  if (!year || !month || !day) {
    throw new Error(`Invalid ticket date: ${date}`);
  }

  return `${day}-${month}-${year}`;
}

function normalizeExtension(extension: string): string {
  return extension.replace(/^\./, '').toLowerCase() || 'jpg';
}

export function buildPhotoFilename(
  date: string,
  amount: number,
  existingFilenames: string[],
  extension = 'jpg',
): string {
  const baseName = `${formatPhotoDate(date)}_${amount.toFixed(2)}`;
  const safeExtension = normalizeExtension(extension);
  const existing = new Set(existingFilenames.map((filename) => filename.toLowerCase()));

  let index = 1;
  let candidate = `${baseName}.${safeExtension}`;

  while (existing.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${baseName}-${index}.${safeExtension}`;
  }

  return candidate;
}

