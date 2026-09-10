// Who may touch which stored file.
//
// These rules existed ONLY as the eleven policies on public.attachments. That
// was proven the hard way: with RLS switched off, the end-to-end suite showed
// one student uploading into another's folder and fetching a signed URL for
// another student's FACE TEMPLATE. The API had no opinion at all — it asked the
// database and passed the answer on.
//
// So the rules are written here, in the same terms the policies use, and the
// policies become the second opinion rather than the only one.
//
// WHERE THE OWNER OF A FILE IS WRITTEN
//
// In the path, not in a column. `attachments.owner_id` records who UPLOADED a
// file, and for an enrolment photo that is usually an ADMIN acting for someone
// else — while the person the photo is OF is named by the path. A member has to
// be able to see their own face template, so access follows the path.
//
//   faces/<profile-id>/<file>      a folder per member
//   probes/<profile-id>/<file>     same
//   avatars/<profile-id>.<ext>     flat, one file per member
//
// The two layouts are historical and not worth unifying: changing either would
// orphan every file already on disk.
import { isStaff } from '../identity/role.js';
/**
 * The profile a path belongs to, or null when the path names nobody.
 *
 * Null is the safe answer and it is load-bearing: a `faces` path with no folder
 * would otherwise have no owner to compare against, and "no owner" must never
 * read as "everyone's". Mirrors public.attachment_folder() and the
 * `split_part(path, '.', 1)` the avatar policies use.
 */
export function pathOwner(bucket, path) {
    if (bucket === 'avatars') {
        const dot = path.indexOf('.');
        return dot > 0 ? path.slice(0, dot) : null;
    }
    const slash = path.indexOf('/');
    return slash > 0 ? path.slice(0, slash) : null;
}
/**
 * May this caller do this to this file?
 *
 * Stated as one table rather than a chain of ifs, because the differences
 * between the buckets are the whole content:
 *
 *              read              write             delete
 *   faces      own or staff      own only          staff only
 *   probes     own or staff      own only          staff only
 *   avatars    anyone            own or staff      own or staff
 *
 * `probes` has no update row because a probe is EVIDENCE — the capture taken at
 * a check-in — and rewriting one after the fact is the single thing nobody
 * should be able to do. It is covered here by write meaning insert only; the
 * route never issues an update to that bucket.
 *
 * Avatars are readable by anyone because that bucket is public: a profile
 * picture appears beside a name in lists a signed-out caller already sees.
 */
export function mayTouchAttachment(req) {
    const owner = pathOwner(req.bucket, req.path);
    const isOwn = owner !== null && owner === req.callerId;
    const staff = isStaff(req.role);
    if (req.bucket === 'avatars') {
        return req.action === 'read' ? true : isOwn || staff;
    }
    // faces and probes: private, one folder per member.
    switch (req.action) {
        case 'read':
            return isOwn || staff;
        case 'write':
            // Staff do NOT get a write here. An admin enrolling someone else's face
            // goes through the privileged server-side path (putObject without a
            // caller context), which is deliberate and audited — not through a
            // client-supplied path.
            return isOwn;
        case 'delete':
            return staff;
    }
}
//# sourceMappingURL=attachment.js.map