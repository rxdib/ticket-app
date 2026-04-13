import { Dropbox } from 'dropbox';
import type { Ticket } from './types';
import { getYearPathCandidates } from './storagePaths';

type DownloadResponse = {
  result: {
    fileBinary?: Buffer;
    fileBlob?: Blob;
  };
};

/** Retourne "MM" depuis un nom de fichier "YYYY-MM-DD_..." */
function monthSubfolder(filename: string): string {
  return filename.slice(5, 7); // ex: "2026-01-05_7.90.jpg" → "01"
}

/** Chemin relatif d'une photo dans le dossier annuel */
function photoRelPath(filename: string): string {
  return `photos/${monthSubfolder(filename)}/${filename}`;
}

function getDropboxClient(): Dropbox {
  return new Dropbox({
    clientId: process.env.DROPBOX_APP_KEY!,
    clientSecret: process.env.DROPBOX_APP_SECRET!,
    refreshToken: process.env.DROPBOX_REFRESH_TOKEN!,
    fetch: fetch,
  });
}

function getErrorStatus(err: unknown): number | undefined {
  return (err as { status?: number })?.status;
}

function getErrorSummary(err: unknown): string {
  const error = err as {
    error?: { error_summary?: string };
    message?: string;
  };

  return error.error?.error_summary ?? error.message ?? '';
}

function isNotFoundError(err: unknown): boolean {
  const status = getErrorStatus(err);
  const summary = getErrorSummary(err);

  return (
    status === 404 ||
    summary.includes('path/not_found') ||
    summary.includes('not_found')
  );
}

function isFolderConflictError(err: unknown): boolean {
  const summary = getErrorSummary(err);
  return summary.includes('path/conflict/folder') || summary.includes('path/conflict');
}

async function ensureFolderExists(dbx: Dropbox, folderPath: string): Promise<void> {
  const parts = folderPath.split('/').filter(Boolean);
  let currentPath = '';

  for (const part of parts) {
    currentPath += `/${part}`;

    try {
      await dbx.filesCreateFolderV2({ path: currentPath });
    } catch (err: unknown) {
      if (isFolderConflictError(err)) {
        continue;
      }

      throw err;
    }
  }
}

async function decodeDownload(response: DownloadResponse): Promise<string | null> {
  const { fileBinary, fileBlob } = response.result;

  if (fileBinary) {
    return fileBinary.toString('utf-8');
  }

  if (fileBlob) {
    return fileBlob.text();
  }

  return null;
}

async function pathExists(dbx: Dropbox, path: string): Promise<boolean> {
  try {
    await dbx.filesGetMetadata({ path });
    return true;
  } catch (err: unknown) {
    if (isNotFoundError(err)) {
      return false;
    }

    throw err;
  }
}

async function getWritableYearPaths(_dbx: Dropbox, year: number): Promise<string[]> {
  // Toujours écrire dans le chemin préféré (le dossier sera créé si besoin).
  // La lecture reste multi-chemins pour garder accès aux anciennes données.
  return [getYearPathCandidates(year)[0]];
}

async function uploadToCandidatePaths(
  year: number,
  relativePath: string,
  contents: string | Buffer,
): Promise<void> {
  const dbx = getDropboxClient();
  const writablePaths = await getWritableYearPaths(dbx, year);
  let successCount = 0;
  let lastError: unknown = null;

  for (const yearPath of writablePaths) {
    const fullPath = `${yearPath}/${relativePath}`;
    const folderPath = fullPath.slice(0, fullPath.lastIndexOf('/'));

    try {
      await ensureFolderExists(dbx, folderPath);
      await dbx.filesUpload({
        path: fullPath,
        contents,
        mode: { '.tag': 'overwrite' },
      });
      successCount += 1;
    } catch (err: unknown) {
      lastError = err;
    }
  }

  if (successCount === 0 && lastError) {
    throw lastError;
  }
}

export async function readTicketsJson(year: number): Promise<Ticket[]> {
  const dbx = getDropboxClient();
  const ticketsById = new Map<string, Ticket>();
  let lastError: unknown = null;

  for (const yearPath of getYearPathCandidates(year)) {
    try {
      const response = (await dbx.filesDownload({
        path: `${yearPath}/tickets.json`,
      })) as unknown as DownloadResponse;
      const text = await decodeDownload(response);

      if (!text) {
        continue;
      }

      const tickets = JSON.parse(text) as Ticket[];
      for (const ticket of tickets) {
        if (!ticketsById.has(ticket.id)) {
          ticketsById.set(ticket.id, ticket);
        }
      }
    } catch (err: unknown) {
      if (isNotFoundError(err)) {
        continue;
      }

      lastError = err;
    }
  }

  if (ticketsById.size > 0) {
    return [...ticketsById.values()];
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}

export async function writeTicketsJson(year: number, tickets: Ticket[]): Promise<void> {
  await uploadToCandidatePaths(year, 'tickets.json', JSON.stringify(tickets, null, 2));
}

export async function uploadPhoto(year: number, filename: string, buffer: Buffer): Promise<void> {
  await uploadToCandidatePaths(year, photoRelPath(filename), buffer);
}

export async function deletePhoto(year: number, filename: string): Promise<void> {
  const dbx = getDropboxClient();
  let deletedSomewhere = false;
  let lastError: unknown = null;

  for (const yearPath of getYearPathCandidates(year)) {
    try {
      await dbx.filesDeleteV2({ path: `${yearPath}/${photoRelPath(filename)}` });
      deletedSomewhere = true;
    } catch (err: unknown) {
      if (isNotFoundError(err)) {
        deletedSomewhere = true;
        continue;
      }

      lastError = err;
    }
  }

  if (!deletedSomewhere && lastError) {
    throw lastError;
  }
}

export async function getPhotoUrl(year: number, filename: string): Promise<string> {
  const dbx = getDropboxClient();
  let lastError: unknown = null;

  for (const yearPath of getYearPathCandidates(year)) {
    try {
      const response = await dbx.filesGetTemporaryLink({
        path: `${yearPath}/${photoRelPath(filename)}`,
      });
      return response.result.link;
    } catch (err: unknown) {
      if (isNotFoundError(err)) {
        continue;
      }

      lastError = err;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(`Photo not found: ${filename}`);
}

export async function uploadExcel(year: number, buffer: Buffer): Promise<void> {
  await uploadToCandidatePaths(year, `${year}.xlsx`, buffer);
}
