// Who may touch which stored file.
//
// The files this guards are BIOMETRIC: face templates and the probe images taken
// at every check-in. Getting it wrong means one member fetching a signed URL for
// another member's face — so the rule is a pure function with tests, not a
// condition buried in whichever query happens to reach the row.
//
// THE RULE IS A TABLE, AND THE TABLE IS THE CODE
//
// FILE_ACCESS in config/constants.ts says who may read, write and delete each
// kind. This file answers one question about the caller — are they the owner, or
// staff — and looks the rest up. A new kind of file is a row there, and there is
// nowhere else it could be forgotten.
import { FILE_ACCESS, FILE_KINDS, } from '../../config/constants.js';
import { isStaff } from '../identity/role.js';
/**
 * The profile an avatar path belongs to, or null when it names nobody.
 *
 * ONLY for the kinds whose `ownerFrom` is `'path'` — which is avatars, where the
 * path genuinely is `<profile-id>.<ext>`. Every other kind records its owner in
 * a column, because deriving ownership by parsing a path couples an access
 * decision to a directory layout: reorganise the tree for readability and the
 * parse quietly stops matching anyone.
 *
 * Null is the safe answer and it is load-bearing — "names nobody" must never
 * read as "everyone's".
 */
export function folderOwner(path) {
    const slash = path.indexOf('/');
    // 'face.jpg' has no folder and '/x.jpg' has an empty one. Neither names
    // anybody, and null is what stops "names nobody" reading as "everybody's".
    if (slash <= 0)
        return null;
    return path.slice(0, slash);
}
export function pathOwner(path) {
    // Avatars are FLAT. A slash means this is not an avatar path, and guessing an
    // owner out of one anyway is how `/leading.jpg` becomes the owner `/leading`.
    if (path.includes('/'))
        return null;
    const dot = path.indexOf('.');
    return dot > 0 ? path.slice(0, dot) : null;
}
/** Does this caller satisfy the rule? */
function allows(rule, isOwn, staff) {
    switch (rule) {
        case 'anyone':
            return true;
        case 'own':
            return isOwn;
        case 'staff':
            return staff;
        case 'own-or-staff':
            return isOwn || staff;
    }
}
/**
 * May this caller do this to this file?
 *
 *              read           write          delete
 *   faces      own or staff   own only       staff only
 *   probes     own or staff   own only       staff only
 *   avatars    anyone         own or staff   own or staff
 *
 * Two of those cells are the ones worth reading twice. Staff have NO write to
 * `faces` or `probes`: an admin enrolling somebody else's face goes through the
 * privileged server-side path, which is audited, rather than through a
 * client-supplied path. And a probe is EVIDENCE — the capture taken at the
 * moment of a check-in — so nothing may overwrite one after the fact.
 */
export function mayTouchAttachment(req) {
    const kind = FILE_KINDS[req.kind];
    if (!kind)
        return false;
    // WHERE THE OWNER COMES FROM, AND WHY THE FALLBACK MATTERS
    //
    // A subject-owned kind normally learns its subject from the attachments row —
    // which the server wrote and a caller cannot influence. When there is no row
    // to consult, as on a first upload, the only evidence of who a file is about
    // is the path, whose first segment is the member's id by convention.
    //
    // Falling back to the PATH rather than to the caller is the whole point. The
    // upload check used to be handed `subjectId: caller.id`, so `isOwn` compared
    // the caller against themselves and was true for every path ever submitted: a
    // member could write a face image into anybody's folder, over anybody's
    // enrolment. A check that cannot fail is not a check.
    // A READ answers from the recorded subject and nothing else. A row saying
    // "this belongs to nobody" must not be re-interpreted by parsing a path the
    // caller chose — that is how a deliberate null becomes an accidental match.
    //
    // A WRITE is the one case with no row to consult: the file does not exist
    // yet. There the path is the only evidence of who it is about, and its first
    // segment is the member's id by convention, so that is what is checked
    // against the caller.
    //
    // The fallback is the whole fix. This check used to be handed
    // `subjectId: caller.id` on every upload, so `isOwn` compared the caller
    // against themselves: true for every path any member ever submitted. A member
    // could write a face image into anybody's folder, over anybody's enrolment.
    // The fallback is for SUBJECT-owned kinds only. Avatars derive their owner
    // from the path already and are flat by definition, so letting a folder name
    // an owner there would newly permit `<id>/anything.jpg` — a layout that kind
    // does not have.
    const owner = kind.ownerFrom === 'path'
        ? pathOwner(req.path)
        : req.subjectId ?? (req.action === 'write' ? folderOwner(req.path) : null);
    const isOwn = owner !== null && owner === req.callerId;
    return allows(FILE_ACCESS[req.kind][req.action], isOwn, isStaff(req.role));
}
//# sourceMappingURL=attachment.js.map