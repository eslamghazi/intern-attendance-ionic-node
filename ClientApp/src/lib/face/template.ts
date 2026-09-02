import { apiFetch } from '../api/http';

/** Encode a JS number[] into pgvector's literal string form. */
export function vecToString(v: number[]): string {
  return `[${v.join(',')}]`;
}

/** Decode a pgvector value (string "[...]" or array) into number[]. */
export function parseVec(value: unknown): number[] {
  if (Array.isArray(value)) return value as number[];
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as number[];
    } catch {
      return [];
    }
  }
  return [];
}

export async function getEnrolledEmbedding(memberId: string): Promise<number[] | null> {
  const { embedding } = await apiFetch<{ embedding: unknown }>(`/face/templates/${memberId}`);
  if (embedding == null) return null;
  return parseVec(embedding);
}

export async function saveEnrolledEmbedding(
  memberId: string,
  embedding: number[],
  photoPath: string | null,
  quality: number | null,
): Promise<void> {
  await apiFetch(`/face/templates/${memberId}`, {
    method: 'PUT',
    body: {
      embedding: vecToString(embedding),
      photo_path: photoPath,
      quality_score: quality,
    },
  });
}

/** The stored enrollment photo of each given member (admins only, per RLS).
 *  `photo_path` is null when the photo was never stored — enrollment keeps the
 *  embedding regardless, and image storage is an admin setting. */
export async function listFacePhotos(
  memberIds: string[],
): Promise<{ member_id: string; photo_path: string | null; created_at: string }[]> {
  if (!memberIds.length) return [];
  return apiFetch('/face/templates/photos', { method: 'POST', body: { member_ids: memberIds } });
}

/** Every stored enrollment-photo path (admins only, per RLS). */
export function listAllFacePhotoPaths(): Promise<string[]> {
  return apiFetch('/face/templates/photo-paths');
}
