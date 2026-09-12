import { apiFetch } from '../api/http';
import type { JsonValue } from '../json.types';

/** Encode a JS number[] into the `[0.1,0.2,...]` string the enrolment API takes. */
export function vecToString(v: number[]): string {
  return `[${v.join(',')}]`;
}

/**
 * Decode an embedding into number[].
 *
 * The API sends an array — the column is `real[]`. The string branch is for the
 * shape it USED to send, when the column was a pgvector and came back as the
 * text '[0.1,0.2,…]'; a client is not always newer than the server it talks to.
 */
export function parseVec(value: JsonValue): number[] {
  if (Array.isArray(value)) return value.filter((n): n is number => typeof n === 'number');
  if (typeof value === 'string') {
    try {
      return parseVec(JSON.parse(value) as JsonValue);
    } catch {
      return [];
    }
  }
  return [];
}

export async function getEnrolledEmbedding(memberId: string): Promise<number[] | null> {
  const { embedding } = await apiFetch<{ embedding: JsonValue }>(`/face/templates/${memberId}`);
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

/** The stored enrollment photo of each given member. STAFF ONLY — enforced by
 *  @Roles on the route; the database applies no access rules of its own.
 *  `photo_path` is null when the photo was never stored — enrollment keeps the
 *  embedding regardless, and image storage is an admin setting. */
export async function listFacePhotos(
  memberIds: string[],
): Promise<{ member_id: string; photo_path: string | null; created_at: string }[]> {
  if (!memberIds.length) return [];
  return apiFetch('/face/templates/photos', { method: 'POST', body: { member_ids: memberIds } });
}

/** Every stored enrollment-photo path. Staff only, enforced by @Roles on the
 *  route. */
export function listAllFacePhotoPaths(): Promise<string[]> {
  return apiFetch('/face/templates/photo-paths');
}
