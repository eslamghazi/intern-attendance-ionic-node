// Where a stored file goes, and what it is called.
import type { FacePathParts, ProbePathParts } from './paths.types.js';
export type { FacePathParts, ProbePathParts } from './paths.types.js';
//
// ONE PLACE, so that the shape of the tree is a thing you can read and test
// rather than a template string inside whichever service happens to upload.
//
// WHAT THE LAYOUT IS FOR
//
// Someone will open this directory over SFTP at some point, usually because a
// student is disputing an attendance record and somebody wants to see the
// photo. The tree has to answer "the capture for member 2026010001 on the 11th"
// by looking, not by querying. That is the whole design brief.
//
//   storage-data/
//     faces/
//       year-2026/
//         branch-el-mabarra-hospital/
//           group-nursing-a/
//             member-2026010001/
//               face.jpg
//     probes/
//       year-2026/
//         2026-09/
//           2026-09-11/
//             branch-el-mabarra-hospital/
//               member-2026010001/
//                 check-in__07-58__morning-shift.jpg
//                 check-out__15-04__morning-shift.jpg
//     avatars/
//       <profile-id>.jpg
//
// WHY PROBES NEST BY YEAR / MONTH / DAY
//
// One per check-in and one per check-out, for every member, every day. The old
// layout put them all under `<year>/<member-code>/`, which is one directory per
// member growing without limit — and a year directory holding a directory per
// member. A date tree keeps every leaf small, makes "delete last spring" a
// directory operation, and is the order anyone actually looks in.
//
// So: no raw UUIDs in a name — a shift appears by its key, a member by their
// code — nothing repeated that the parent directory already says, and the
// branch and group present, because "which branch is this?" is the first
// question anyone browsing has.
//
// WHY AVATARS ARE NOT IN THE TREE
//
// `avatars/<profile-id>.<ext>` is flat and stays flat: it is the public kind,
// one file per person, replaced in place, and the profile id is the only stable
// key a staff account (which has no member code, branch or group) has.
//
// EVERY SEGMENT IS SLUGGED. A branch called "مستشفى المبرة" or "St. Mary's"
// must not become a path separator, a traversal, or a name that breaks on a
// case-insensitive filesystem.

/**
 * A path segment that is safe on every filesystem and readable by a human.
 *
 * Non-ASCII is transliterated where a sensible mapping exists and dropped
 * otherwise, which means an Arabic branch name becomes its letters rather than
 * a row of percent escapes — and, when nothing survives, the caller's fallback
 * is used rather than an empty segment.
 *
 * Lower-cased on purpose: macOS and Windows are case-insensitive, so `Ward-A`
 * and `ward-a` are the same directory there and two different ones on Linux.
 * Deciding that here means the same input always produces the same path.
 */
export function slug(input: string | null | undefined, fallback = 'unknown'): string {
  const s = String(input ?? '')
    .normalize('NFKD')
    // Strip combining marks left by the decomposition above.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Anything that is not a plain letter, digit or Arabic letter becomes a
    // separator. Arabic is kept as-is: it is the project's first language, and
    // a transliteration nobody agrees on is worse than the original.
    .replace(/[^a-z0-9ء-ي]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || fallback;
}

/** `2026-09-11` → `2026-09`. Returns null for anything that is not a date. */
function monthOf(date: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : null;
}

/** `2026-09-11` → `2026`. */
function yearOf(date: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 4) : null;
}

/**
 * The enrolment photo for one member.
 *
 * Always `face.jpg` inside the member's own directory rather than
 * `<code>.jpg` beside its siblings: re-enrolling REPLACES the photo, and a
 * fixed name means the replacement overwrites rather than accumulating a second
 * file nothing points at.
 */
export function facePath(p: FacePathParts): string {
  return [
    `year-${slug(p.groupYear ? String(p.groupYear) : null, 'no-group')}`,
    `branch-${slug(p.branchName, 'no-branch')}`,
    `group-${slug(p.groupName, 'no-group')}`,
    `member-${slug(p.memberCode, 'unknown-member')}`,
    'face.jpg',
  ].join('/');
}

/**
 * One check-in or check-out capture.
 *
 * The time is in the FILE NAME rather than the directory, so a member's two
 * captures for a day sit together and sort by when they happened. It uses `-`
 * between hours and minutes because `:` is not a legal filename character on
 * Windows and silently becomes a stream separator.
 *
 * A member can legitimately produce two captures of the same type on one day —
 * a check-out after a corrected check-in — so the minute is part of the name
 * and not decoration. Two within the same minute would collide; that is
 * deliberate, because the second is a retry of the first and the newer capture
 * is the one worth keeping.
 */
export function probePath(p: ProbePathParts): string {
  const year = yearOf(p.date) ?? 'unknown-year';
  const month = monthOf(p.date) ?? 'unknown-month';
  const at = p.at ?? new Date();
  const hh = String(at.getUTCHours()).padStart(2, '0');
  const mm = String(at.getUTCMinutes()).padStart(2, '0');
  const kind = p.type === 'check_out' ? 'check-out' : 'check-in';

  return [
    `year-${year}`,
    month,
    p.date,
    `branch-${slug(p.branchName, 'no-branch')}`,
    `member-${slug(p.memberCode, 'unknown-member')}`,
    `${kind}__${hh}-${mm}__${slug(p.shiftName, 'no-shift')}.jpg`,
  ].join('/');
}

/** The public profile picture. Flat, keyed by profile id — see the header. */
export function avatarPath(profileId: string, ext = 'jpg'): string {
  return `${profileId}.${ext.replace(/[^a-z0-9]/gi, '') || 'jpg'}`;
}
