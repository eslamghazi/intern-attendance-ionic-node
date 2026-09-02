// Profile lifecycle (called by the member after onboarding steps).
import { apiFetch } from './http';
import { BUCKETS } from '../config';

export async function markEnrolled(): Promise<void> {
  await apiFetch('/profile/mark-enrolled', { method: 'POST' });
}

export async function markPasswordChanged(): Promise<void> {
  await apiFetch('/profile/mark-password-changed', { method: 'POST' });
}

/** A member edits their OWN profile (name/phone/email/national id/avatar).
 *  Guarded server-side so they can't change role/permissions. */
export async function updateMyProfile(input: {
  full_name: string;
  phone?: string | null;
  email?: string | null;
  national_id: string;
  avatar_url?: string | null;
}): Promise<void> {
  await apiFetch('/profile/me', { method: 'PATCH', body: input });
}

/** Center-crop + shrink an image to a small square JPEG so avatars stay tiny. */
async function shrinkAvatar(file: Blob, size = 256, quality = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    });
    const side = Math.min(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    return blob ?? file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Blob -> bare base64, which is what the upload endpoint takes. */
async function toBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  // Chunked: spreading a multi-megabyte array into String.fromCharCode blows
  // the argument limit on some engines.
  for (let i = 0; i < buf.length; i += 0x8000) {
    binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Upload a profile photo to the public `avatars` bucket and return its URL.
 *  Path is "<profileId>.jpg" so the storage policy ties it to the owner (or an
 *  admin). The image is shrunk to a small square first to keep storage low. */
export async function uploadAvatar(profileId: string, file: Blob): Promise<string> {
  const path = `${profileId}.jpg`;
  await apiFetch(`/storage/${BUCKETS.avatars}`, {
    method: 'POST',
    body: {
      path,
      content_base64: await toBase64(await shrinkAvatar(file)),
      content_type: 'image/jpeg',
    },
  });
  const { url } = await apiFetch<{ url: string }>(
    `/storage/${BUCKETS.avatars}/url?path=${encodeURIComponent(path)}`,
  );
  return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`; // cache-bust after re-upload
}
