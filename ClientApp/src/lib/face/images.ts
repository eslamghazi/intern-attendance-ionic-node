import { apiFetch } from '../api/http';
import { FILE_KINDS, EXPORT_URL_TTL_SECONDS, SIGNED_URL_TTL_SECONDS, type FileKind } from '../config';
import { downloadBlob } from '../download';

/** Blob -> bare base64, chunked so a large image can't blow the argument limit. */
async function blobToBytes(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buf.length; i += 0x8000) {
    binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Fetch a (blob:/capacitor:/http) URL and return its bytes as a Blob. */
export async function urlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  return await res.blob();
}

/** Read a Blob as a base64 data URL, for sending an image to the API. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Upload one image to a private kind, returning the path it landed on. */
async function upload(kind: FileKind, path: string, blob: Blob): Promise<string> {
  await apiFetch(`/storage/${kind}`, {
    method: 'POST',
    body: {
      path,
      content_base64: await blobToBytes(blob),
      content_type: 'image/jpeg',
    },
  });
  return path;
}

/** Upload the enrolled reference photo to the private `faces` kind. */
export function uploadReference(uid: string, blob: Blob): Promise<string> {
  return upload(FILE_KINDS.faces, `${uid}/reference.jpg`, blob);
}

/** Upload a per-event probe photo to the private `probes` kind. */
export function uploadProbe(
  uid: string,
  blob: Blob,
  dateLabel: string,
  type: 'check_in' | 'check_out',
): Promise<string> {
  return upload(FILE_KINDS.probes, `${uid}/${dateLabel}-${type}.jpg`, blob);
}

/** Create a short-lived signed URL for an admin to view a private image. */
export async function signedUrl(
  kind: FileKind,
  path: string,
  expiresIn = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  try {
    const { url } = await apiFetch<{ url: string }>(
      `/storage/${kind}/url?path=${encodeURIComponent(path)}&expires_in=${expiresIn}`,
    );
    return url ?? null;
  } catch {
    return null;
  }
}

/** Sign MANY private images in one round trip — the admin galleries would
 *  otherwise fire one request per thumbnail. Returns a path -> url map; a path
 *  that could not be signed (deleted file, or one this caller may not see) is
 *  simply absent. */
export async function signedUrls(
  kind: FileKind,
  paths: string[],
  expiresIn = SIGNED_URL_TTL_SECONDS,
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return new Map();
  const map = await apiFetch<Record<string, string>>(`/storage/${kind}/urls`, {
    method: 'POST',
    body: { paths: unique, expires_in: expiresIn },
  });
  return new Map(Object.entries(map ?? {}));
}

/**
 * Delete private images: the FILES from storage, and then the columns that
 * pointed at them (face_templates.photo_path, attendance.*_probe_path) so no
 * row is left referencing something that is gone.
 *
 * The face EMBEDDING is deliberately untouched — removing a stored photo must
 * not un-enroll the member. Clearing the columns goes through the
 * clear_image_paths function because neither table is client-writable.
 *
 * Chunked: the storage API takes a list, but a thousand-path request is a
 * thousand-path failure if anything goes wrong. Returns how many FILES the
 * server confirmed removing.
 */
export async function removeImages(kind: FileKind, paths: string[]): Promise<number> {
  const unique = [...new Set(paths.filter(Boolean))];
  let removed = 0;
  // Still chunked: a thousand-path request is a thousand-path failure if
  // anything goes wrong. The API drops the files and their references together,
  // so a run that dies halfway leaves nothing referencing a missing file.
  for (let i = 0; i < unique.length; i += 100) {
    const res = await apiFetch<{ removed: number }>(`/storage/${kind}`, {
      method: 'DELETE',
      body: { paths: unique.slice(i, i + 100) },
    });
    removed += res?.removed ?? 0;
  }
  return removed;
}

/** File name for a stored image, from its storage path (ASCII + unique). */
const baseName = (path: string) => path.split('/').pop() || 'image.jpg';

/** Strip anything a file system would refuse in a folder name. */
const safeName = (name: string) =>
  (name || 'member').replace(/[\\:*?"<>|/]+/g, '_').trim();

/** Fetch stored images as blobs. Signed fresh with a long TTL first: the view's
 *  2-minute URLs can expire halfway through a large export. */
async function fetchStored(
  kind: FileKind,
  paths: string[],
): Promise<{ path: string; blob: Blob }[]> {
  const urls = await signedUrls(kind, paths, EXPORT_URL_TTL_SECONDS);
  const out: { path: string; blob: Blob }[] = [];
  // A few at a time — a hundred parallel fetches is how you get throttled.
  const POOL = 6;
  const queue = [...urls.entries()];
  await Promise.all(
    Array.from({ length: Math.min(POOL, queue.length) }, async () => {
      for (;;) {
        const next = queue.shift();
        if (!next) return;
        const [path, url] = next;
        try {
          const res = await fetch(url);
          if (res.ok) out.push({ path, blob: await res.blob() });
        } catch {
          /* skip the ones that fail; the rest of the export still lands */
        }
      }
    }),
  );
  return out;
}

/** Save ONE stored image to the device. */
export async function downloadImage(kind: FileKind, path: string, filename?: string): Promise<void> {
  const [got] = await fetchStored(kind, [path]);
  if (!got) throw new Error('image_unavailable');
  downloadBlob(got.blob, filename || baseName(path));
}

/** Save MANY stored images as one zip, foldered per member so a bulk export
 *  stays navigable. Returns how many files made it in. */
export async function downloadImagesZip(
  kind: FileKind,
  items: { path: string; folder?: string }[],
  zipName: string,
): Promise<number> {
  const blobs = await fetchStored(
    kind,
    items.map((i) => i.path),
  );
  if (!blobs.length) return 0;
  const folderOf = new Map(items.map((i) => [i.path, i.folder]));
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const { path, blob } of blobs) {
    const folder = folderOf.get(path);
    zip.file(folder ? `${safeName(folder)}/${baseName(path)}` : baseName(path), blob);
  }
  downloadBlob(await zip.generateAsync({ type: 'blob' }), zipName);
  return blobs.length;
}
