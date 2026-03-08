/**
 * Module-level store to share a pending save promise between /add and /
 * so the home page can show a "saving..." indicator and refresh when done.
 */

let savePromise: Promise<void> | null = null;

export function setSavePromise(p: Promise<void>): void {
  savePromise = p;
}

/** Returns the pending promise (and clears it) so only one consumer uses it. */
export function takeSavePromise(): Promise<void> | null {
  const p = savePromise;
  savePromise = null;
  return p;
}
