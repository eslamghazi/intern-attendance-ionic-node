// The member code: how it is shaped, and when it changes.
//
// A code is printed on rosters and read off them for a whole academic year, so
// two rules matter more than anything else here: it must never repeat, and it
// must never silently point at a different person later.
//
//   2026 01 0001
//   └─┬┘ └┬┘ └─┬┘
//     │   │    └── serial within that year+institution, at least 4 digits
//     │   └─────── institution code, always 2 digits
//     └─────────── the group's academic year, always 4 digits
//
// WHY IT IS NOT A DATABASE TRIGGER
//
// A trigger would hold this rule whatever wrote the row, which is a genuine
// guarantee and the strongest argument for one. The price is a hand-written SQL
// object that Drizzle can neither generate nor diff, sitting beside a schema
// that is otherwise entirely generated from the models — so it drifts silently
// and nothing reports it.
//
// The rule is applied in the repository instead, at the three sites that write
// the column: the create, the update, and the bulk group change. The trade is
// the same one made for authorization — the database stops being a second
// opinion, so the application has to be right, and the tests are what make that
// credible.
//
// What replaces the trigger's serialisation is the partial unique index
// `members_member_code_key`. Two concurrent inserts can still read the same
// max() — the index refuses the loser, and the caller retries. See
// MembersRepository.
/** Zero-padded `YYYYII` — the part of a code that identifies the cohort. */
export function memberCodePrefix(year, institutionCode) {
    return String(year).padStart(4, '0') + String(institutionCode).padStart(2, '0');
}
/**
 * A full code.
 *
 * The serial is padded to at least four digits and simply gets longer beyond
 * 9999 rather than wrapping or truncating — a cohort of ten thousand is not
 * expected, but silently reusing 0001 would be much worse than an 11-character
 * code.
 */
export function composeMemberCode(year, institutionCode, serial) {
    const width = Math.max(4, String(serial).length);
    return memberCodePrefix(year, institutionCode) + String(serial).padStart(width, '0');
}
/**
 * The serial out of a code, or null if there is not one.
 *
 * Mirrors `nullif(substring(member_code from 7), '')::bigint` — everything from
 * the seventh character on. A code that is only a prefix has no serial.
 */
export function memberCodeSerial(code) {
    if (!code || code.length <= 6)
        return null;
    const tail = code.slice(6);
    if (!/^\d+$/.test(tail))
        return null;
    const n = Number(tail);
    return Number.isSafeInteger(n) ? n : null;
}
/**
 * Does this code already belong to that cohort?
 *
 * The trigger's "already carries a code for this year+institution: keep it"
 * branch. A member moved between groups within the same cohort keeps the code
 * that is already printed on this year's rosters; one moved to a different
 * cohort is reissued.
 */
export function codeMatchesCohort(code, year, institutionCode) {
    return Boolean(code) && code.slice(0, 6) === memberCodePrefix(year, institutionCode);
}
/**
 * The code this member should have, given the one they hold and the cohort they
 * are now in — or null to mean "leave it alone".
 *
 * `nextSerial` is only consulted when a new code is actually needed, so the
 * caller can skip the query that computes it in the common case.
 */
export function reissueNeeded(currentCode, cohort) {
    // No group, or a group with no academic year: no code at all, and an existing
    // one is left untouched rather than cleared. Matches `if v_year is null then
    // return new`.
    if (!cohort || cohort.year === null)
        return false;
    return !codeMatchesCohort(currentCode, cohort.year, cohort.institutionCode);
}
//# sourceMappingURL=code.js.map