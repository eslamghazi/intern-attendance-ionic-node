// Face matching.
//
// The system does VERIFICATION, not identification: the member is already known
// from their sign-in or their QR, and the only question is whether the face in
// front of the camera is theirs. So each check-in compares a probe against ONE
// enrolled template, selected by `member_id`. A dot product over 512 floats.
//
// WHY IT IS HERE AND NOT IN THE DATABASE
//
// Two reasons, and the second is the one that decides it.
//
// It is cheap: 512 multiply-adds, on a row the request was already reading —
// measured at well under a microsecond. Asking Postgres instead means a vector
// extension, and every vector extension is a SUPERUSER install. That is the
// difference between "an ordinary role and an empty database" and "ask an
// operator to prepare the server first", paid on every deployment, forever.
//
// And it is a RULE, so it needs tests. Here it is covered against zero vectors,
// mismatched lengths, float32 rounding and symmetry, all without a database
// running. That is what caught the NaN case below.
//
// IF IDENTIFICATION IS EVER WANTED — "who is this?" across every template, or
// "is anyone enrolled twice?" — the arithmetic stops being the cost and the
// scan does. That is the point to reach for pgvector and an HNSW index, and it
// is a different feature with a different shape, not a tweak to this file.
import { EMBEDDING_DIM } from '../../config/constants.js';
export { EMBEDDING_DIM };
/** A finite-valued embedding of exactly the expected length. */
export function isEmbedding(value) {
    return (Array.isArray(value) &&
        value.length === EMBEDDING_DIM &&
        value.every((n) => typeof n === 'number' && Number.isFinite(n)));
}
/**
 * Cosine similarity of two embeddings, or null if they cannot be compared.
 *
 * Divides by both magnitudes rather than taking a bare dot product. The client
 * normalises its vectors, which makes the two identical — but "the caller
 * normalised it" is an assumption that fails SILENTLY: an un-normalised vector
 * yields a slightly low score, which reads as the member's face not matching.
 *
 * NULL, NEVER A GUESS. A length mismatch (a template written by an older model)
 * or a zero-magnitude vector leaves cosine mathematically undefined. Returning
 * null rather than NaN keeps the undefined case from travelling through
 * arithmetic and arriving somewhere as a number. Every caller treats null as
 * "cannot verify" and refuses — see attendance.service.ts.
 *
 * The result is in [-1, 1] and app_settings.face_match_threshold is compared
 * against it directly.
 */
export function cosineSimilarity(a, b) {
    if (a.length !== b.length || a.length === 0)
        return null;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        const x = a[i];
        const y = b[i];
        dot += x * y;
        normA += x * x;
        normB += y * y;
    }
    if (!Number.isFinite(dot) || normA === 0 || normB === 0)
        return null;
    const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    if (!Number.isFinite(similarity))
        return null;
    // Floating-point error can put an identical pair a few ulps past 1, which
    // then reads as "more similar than possible" in a log or a report.
    return Math.min(1, Math.max(-1, similarity));
}
//# sourceMappingURL=similarity.js.map