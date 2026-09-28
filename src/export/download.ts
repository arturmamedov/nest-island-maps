/* Export is browser-only (handoff README §4): a download is an object URL
   clicked through a temporary <a download>. The URL is revoked a moment
   later rather than at once, because revoking it during the click can cancel
   the download in some browsers. */

const REVOKE_AFTER_MS = 1500;

/** Saves the blob under this file name. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}
