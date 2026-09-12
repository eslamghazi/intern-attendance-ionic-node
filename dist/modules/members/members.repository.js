var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { GenericRepository } from '../../infrastructure/database/generic.repository.js';
import { members, profiles, memberDirectory, groups, institutions } from '../../infrastructure/database/schema/index.js';
import { eq, inArray, count, and, like, isNotNull, or } from 'drizzle-orm';
import { composeMemberCode, memberCodePrefix, memberCodeSerial, reissueNeeded, } from '../../domain/member/code.js';
import { parseNationalId } from '../../domain/identity/nationalId.js';
import { directoryWhere, filteredMemberIds, filteredProfileIds } from '../../domain/member/filter.js';
import { notFound } from '../../common/errors.js';
import { Role } from '../../common/enums/index.js';
/**
 * Is this a unique-constraint violation, whatever wrapped it?
 *
 * Drizzle does not rethrow the driver's error: it throws its own with the real
 * one on `.cause`, so a check on `err.code` alone silently never matches.
 */
function isUniqueViolation(err) {
    let current = err;
    for (let depth = 0; current && depth < 5; depth++) {
        if (current.code === '23505')
            return true;
        current = current.cause;
    }
    return false;
}
import { DIRECTORY_COLUMNS, LOOKUP_COLUMNS, MEMBER_PAGE_COLUMNS, } from './members.columns.js';
let MembersRepository = class MembersRepository extends GenericRepository {
    constructor() {
        super(members, members.id);
    }
    async getFrozenAt(profileId) {
        const rows = await this.db
            .select({ frozen_at: members.frozenAt })
            .from(members)
            .where(eq(members.profileId, profileId))
            .limit(1);
        const value = rows[0]?.frozen_at;
        return value ? new Date(value) : null;
    }
    async updateColumns(table, id, patch) {
        const tableSchema = table === 'profiles' ? profiles : members;
        const rows = await this.db
            .update(tableSchema)
            .set(patch)
            .where(eq(tableSchema.id, id))
            .returning({ id: tableSchema.id });
        if (!rows.length)
            throw notFound();
    }
    async upsertMember(callerId, input) {
        const nid = input.national_id;
        if (!parseNationalId(nid).valid) {
            return { national_id: nid, ok: false, error: 'invalid_national_id' };
        }
        if (!input.full_name)
            return { national_id: nid, ok: false, error: 'missing_name' };
        const existingRows = await this.db
            .select({ id: profiles.id, role: profiles.role })
            .from(profiles)
            .where(eq(profiles.nationalId, nid))
            .limit(1);
        const existing = existingRows[0];
        if (existing) {
            if (existing.role !== Role.MEMBER) {
                return { national_id: nid, ok: false, error: 'national_id_belongs_to_staff' };
            }
            await this.db
                .update(profiles)
                .set({
                fullName: input.full_name,
                phone: input.phone ?? null,
                email: input.email ?? null,
            })
                .where(eq(profiles.id, existing.id));
            const updated = await this.db
                .update(members)
                .set({
                groupId: input.group_id,
                branchId: input.branch_id,
            })
                .where(eq(members.profileId, existing.id))
                .returning({ id: members.id });
            // The new group may be a different cohort. Was a BEFORE UPDATE
            // trigger; see ensureMemberCode.
            if (updated[0])
                await this.ensureMemberCode(updated[0].id);
            return { national_id: nid, ok: true, updated: true };
        }
        const createdRows = await this.db
            .insert(profiles)
            .values({
            role: Role.MEMBER,
            fullName: input.full_name,
            nationalId: nid,
            phone: input.phone ?? null,
            email: input.email ?? null,
            createdBy: callerId,
        })
            .returning({ id: profiles.id });
        const createdProfile = createdRows[0];
        const inserted = await this.db
            .insert(members)
            .values({
            profileId: createdProfile.id,
            groupId: input.group_id,
            branchId: input.branch_id,
        })
            .returning({ id: members.id });
        // Was a BEFORE INSERT trigger; see ensureMemberCode.
        if (inserted[0])
            await this.ensureMemberCode(inserted[0].id);
        return { national_id: nid, ok: true };
    }
    /**
     * The cohort a group belongs to: its academic year and institution code.
     *
     * `coalesce(institutions.code, groups.institution_code, 0)` in the trigger
     * this replaces. Resolved in TypeScript rather than as a SQL expression, so
     * the query stays something Drizzle fully describes.
     */
    async cohortOf(groupId) {
        if (!groupId)
            return null;
        const rows = await this.db
            .select({
            year: groups.year,
            institutionCode: institutions.code,
            groupInstitutionCode: groups.institutionCode,
        })
            .from(groups)
            .leftJoin(institutions, eq(institutions.id, groups.institutionId))
            .where(eq(groups.id, groupId))
            .limit(1);
        const r = rows[0];
        if (!r)
            return null;
        return {
            year: r.year ?? null,
            institutionCode: r.institutionCode ?? r.groupInstitutionCode ?? 0,
        };
    }
    /**
     * The next free serial in a cohort.
     *
     * Reads the codes rather than asking the database for `max()`: a cohort is a
     * few hundred rows, this runs only when a code is actually being issued, and
     * it keeps the query inside what the ORM models.
     */
    async nextSerial(prefix) {
        const rows = await this.db
            .select({ code: members.memberCode })
            .from(members)
            .where(and(isNotNull(members.memberCode), like(members.memberCode, `${prefix}%`)));
        let highest = 0;
        for (const row of rows) {
            const serial = memberCodeSerial(row.code);
            if (serial !== null && serial > highest)
                highest = serial;
        }
        return highest + 1;
    }
    /**
     * Give this member the code their cohort says they should have.
     *
     * Called at every site that writes `group_id` — the create, the update of an
     * existing member, and the bulk group change. A cohort change is what makes a
     * code wrong, so those three sites are the complete list; see domain/member/
     * code.ts for why this is not a database trigger.
     *
     * CONCURRENCY
     *
     * A lock would stop two concurrent inserts reading
     * the same `max()`. Here the partial unique index `members_member_code_key`
     * does the refusing and the loser retries.
     *
     * The retry needs a SAVEPOINT, not a bare try/catch: a unique violation puts
     * the whole Postgres transaction into a failed state, and every later
     * statement in it would be refused with `current transaction is aborted`.
     * `this.db.transaction()` inside an open transaction issues a savepoint, so
     * only the failed attempt is rolled back.
     */
    async ensureMemberCode(memberId) {
        const rows = await this.db
            .select({ code: members.memberCode, groupId: members.groupId })
            .from(members)
            .where(eq(members.id, memberId))
            .limit(1);
        const current = rows[0];
        if (!current)
            return null;
        const cohort = await this.cohortOf(current.groupId);
        if (!reissueNeeded(current.code, cohort))
            return current.code ?? null;
        const year = cohort.year;
        const institutionCode = cohort.institutionCode;
        const prefix = memberCodePrefix(year, institutionCode);
        // Five is generous: a collision needs two members created in the same
        // cohort in the same instant, and each retry re-reads the high-water mark.
        for (let attempt = 0; attempt < 5; attempt++) {
            const code = composeMemberCode(year, institutionCode, await this.nextSerial(prefix));
            try {
                await this.db.transaction(async (tx) => {
                    await tx.update(members).set({ memberCode: code }).where(eq(members.id, memberId));
                });
                return code;
            }
            catch (err) {
                if (!isUniqueViolation(err) || attempt === 4)
                    throw err;
            }
        }
        return null;
    }
    /** Reissue codes for several members — the bulk group change. */
    async ensureMemberCodes(memberIds) {
        for (const id of memberIds)
            await this.ensureMemberCode(id);
    }
    async getNationalIds() {
        const rows = await this.db
            .select({ national_id: profiles.nationalId })
            .from(profiles)
            .where(and(eq(profiles.role, Role.MEMBER), isNotNull(profiles.nationalId)))
            .orderBy(profiles.id);
        return rows.map((r) => r.national_id);
    }
    /**
     * EVERY member the filters match, in one go — for an export.
     *
     * No limit and no offset, which is the whole point: an export means "all of
     * it", and a paged export is a client stitching pages together and hoping
     * nothing was inserted between two of them.
     *
     * Same predicate and same ordering as the paged read above, so the file and
     * the grid can never disagree about what the filter meant.
     */
    /**
     * One member, by an identifier somebody already holds.
     *
     * EXACT MATCH ONLY, and that is the security property. A prefix or a
     * contains-search would turn this into a way to enumerate the faculty one
     * keystroke at a time; requiring the whole code or the whole national id means
     * the caller had to know it already, which is the difference between a lookup
     * and a directory.
     */
    async findByIdentifier(identifier) {
        const value = identifier.trim();
        if (!value)
            return null;
        const rows = await this.db
            .select(LOOKUP_COLUMNS)
            .from(memberDirectory)
            .where(or(eq(memberDirectory.memberCode, value), eq(memberDirectory.nationalId, value)))
            .limit(1);
        return rows[0] ?? null;
    }
    async getMembersForExport(filters) {
        const rows = await this.db
            .select({
            member_code: memberDirectory.memberCode,
            national_id: memberDirectory.nationalId,
            full_name: memberDirectory.fullName,
            phone: memberDirectory.phone,
            email: memberDirectory.email,
            group_name: memberDirectory.groupName,
            branch_name: memberDirectory.branchName,
            is_active: memberDirectory.isActive,
        })
            .from(memberDirectory)
            .where(directoryWhere(filters))
            .orderBy(memberDirectory.fullName, memberDirectory.memberId);
        return rows;
    }
    async getMembersDirectory(filters, limit, offset) {
        const rows = await this.db
            .select(DIRECTORY_COLUMNS)
            .from(memberDirectory)
            .where(directoryWhere(filters))
            .orderBy(memberDirectory.fullName, memberDirectory.memberId)
            .limit(limit)
            .offset(offset);
        return {
            // A NARROWING cast, not an assertion of a type nobody checked. `rows` is
            // DirectorySelection — computed from the DIRECTORY_COLUMNS above — and
            // DirectoryRow is that same type with DIRECTORY_NOT_NULL un-nulled, so the
            // compiler verifies the two are the same row, with the same fields, of the
            // same types. It used to be `as unknown as DirectoryRow[]`, which checks
            // nothing and would have been just as content with another table's row.
            // What the cast still asserts — that those columns are never null — is the
            // view's own SQL, quoted beside the list in members.columns.ts.
            rows: rows,
            total: await this.countDirectory(filters),
        };
    }
    /**
     * How many members match, ignoring the page.
     *
     * Was `count(*) over ()` riding along on every row of the page. Besides being
     * a window function no query builder models, it returned 0 for any page past
     * the end — a page with no rows carries no window value — so "page 9 of 3"
     * reported an empty result set rather than an out-of-range page.
     */
    async countDirectory(filters) {
        const rows = await this.db
            .select({ n: count() })
            .from(memberDirectory)
            .where(directoryWhere(filters));
        return Number(rows[0]?.n ?? 0);
    }
    async getMembersPage(filters, limit, offset) {
        const rows = await this.db
            .select(MEMBER_PAGE_COLUMNS)
            .from(memberDirectory)
            .where(directoryWhere(filters))
            .orderBy(memberDirectory.fullName, memberDirectory.memberId)
            .limit(limit)
            .offset(offset);
        return {
            // Narrowing, for the reason given in getMembersDirectory.
            items: rows,
            total: await this.countDirectory(filters),
        };
    }
    /**
     * The counters on the strip above the members grid.
     *
     * Was one query using three `count(*) filter (where …)` aggregates. A filtered
     * aggregate has no query-builder form in Drizzle — it is the one thing here
     * that genuinely only exists in SQL — so it is four counts instead, each with
     * its own predicate. They run on the caller's single connection, one after
     * another, over a filtered view that is a few thousand rows at most.
     */
    async getFlagStats(filters) {
        const base = directoryWhere(filters);
        const countWhere = async (extra) => {
            const rows = await this.db
                .select({ n: count() })
                .from(memberDirectory)
                .where(extra ? and(base, extra) : base);
            return Number(rows[0]?.n ?? 0);
        };
        return {
            total: await countWhere(),
            bypass_face: await countWhere(eq(memberDirectory.bypassFace, true)),
            bypass_location: await countWhere(eq(memberDirectory.bypassLocation, true)),
            frozen: await countWhere(isNotNull(memberDirectory.frozenAt)),
        };
    }
    async getCountActive() {
        const rows = await this.db
            .select({ count: count() })
            .from(members)
            .where(eq(members.isActive, true));
        return { count: rows[0].count };
    }
    async getMemberIdByProfileId(profileId) {
        const rows = await this.db
            .select({ id: members.id })
            .from(members)
            .where(eq(members.profileId, profileId))
            .limit(1);
        return rows[0]?.id ?? null;
    }
    async deleteProfile(profileId) {
        const rows = await this.db
            .delete(profiles)
            .where(eq(profiles.id, profileId))
            .returning({ id: profiles.id });
        if (!rows[0])
            throw notFound();
    }
    async bulkUpdateMembers(filters, patch) {
        if (!Object.keys(patch).length)
            return { affected: 0 };
        // Convert filtered ids to a subquery using sql expression
        const idsToUpdate = filteredMemberIds(filters);
        const rows = await this.db
            .update(members)
            .set(patch)
            .where(inArray(members.id, idsToUpdate))
            .returning({ id: members.id });
        // Only a group change can move someone to another cohort. Testing the
        // patch first keeps the common bulk edits — a flag, a frozen clock —
        // from reading every affected member's code for nothing.
        if ('groupId' in patch) {
            await this.ensureMemberCodes(rows.map((r) => r.id));
        }
        return { affected: rows.length };
    }
    async bulkDeleteProfiles(filters) {
        const idsToDelete = filteredProfileIds(filters);
        const rows = await this.db
            .delete(profiles)
            .where(inArray(profiles.id, idsToDelete))
            .returning({ id: profiles.id });
        return { affected: rows.length };
    }
};
MembersRepository = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], MembersRepository);
export { MembersRepository };
//# sourceMappingURL=members.repository.js.map