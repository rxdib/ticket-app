import { Dropbox } from 'dropbox';
import type { Ticket } from './types';

function getDropboxClient(): Dropbox {
  return new Dropbox({
    clientId: process.env.DROPBOX_APP_KEY!,
    clientSecret: process.env.DROPBOX_APP_SECRET!,
    refreshToken: process.env.DROPBOX_REFRESH_TOKEN!,
  });
}

function getYearPath(year: number): string {
  return `/Tickets/${year}`;
}

export async function readTicketsJson(year: number): Promise<Ticket[]> {
  const dbx = getDropboxClient();
  const path = `${getYearPath(year)}/tickets.json`;
  try {
    const response = await dbx.filesDownload({ path }) as unknown as { result: { fileBlob: Blob } };
    const buffer = Buffer.from(await response.result.fileBlob.arrayBuffer());
    return JSON.parse(buffer.toString('utf-8'));
  } catch (err: unknown) {
    if ((err as { status?: number })?.status === 409) return [];
    throw err;
  }
}

export async function writeTicketsJson(year: number, tickets: Ticket[]): Promise<void> {
  const dbx = getDropboxClient();
  const path = `${getYearPath(year)}/tickets.json`;
  await dbx.filesUpload({
    path,
    contents: JSON.stringify(tickets, null, 2),
    mode: { '.tag': 'overwrite' },
  });
}

export async function uploadPhoto(year: number, filename: string, buffer: Buffer): Promise<void> {
  const dbx = getDropboxClient();
  await dbx.filesUpload({
    path: `${getYearPath(year)}/photos/${filename}`,
    contents: buffer,
    mode: { '.tag': 'overwrite' },
  });
}

export async function deletePhoto(year: number, filename: string): Promise<void> {
  const dbx = getDropboxClient();
  try {
    await dbx.filesDeleteV2({ path: `${getYearPath(year)}/photos/${filename}` });
  } catch {
    // Ignorer si le fichier n'existe pas
  }
}

export async function getPhotoUrl(year: number, filename: string): Promise<string> {
  const dbx = getDropboxClient();
  const response = await dbx.filesGetTemporaryLink({
    path: `${getYearPath(year)}/photos/${filename}`,
  });
  return response.result.link;
}

export async function uploadExcel(year: number, buffer: Buffer): Promise<void> {
  const dbx = getDropboxClient();
  await dbx.filesUpload({
    path: `${getYearPath(year)}/${year}.xlsx`,
    contents: buffer,
    mode: { '.tag': 'overwrite' },
  });
}
