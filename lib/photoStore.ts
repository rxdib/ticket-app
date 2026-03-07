// Store module-level pour passer la photo de la home vers /add
let pendingPhoto: File | null = null;

export function setPendingPhoto(file: File) {
  pendingPhoto = file;
}

export function getPendingPhoto(): File | null {
  return pendingPhoto;
}

export function clearPendingPhoto() {
  pendingPhoto = null;
}
