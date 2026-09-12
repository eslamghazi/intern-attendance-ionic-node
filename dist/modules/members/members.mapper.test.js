// The patch a member edit turns into, and the statement Drizzle builds from it.
//
// These tests exist because of a bug that produced no error anywhere. The API
// speaks snake_case and the schema's TypeScript names are camelCase, and
// Drizzle's `.set()` DROPS a key it does not recognise rather than refusing it.
// So `set({ full_name: 'x', phone: '01' })` wrote the phone, ignored the name,
// and the route answered `{ ok: true }`. A bulk edit was worse: every key was
// dropped, leaving `update "members" set  where ...` — invalid SQL.
//
// The mapper is now the only way across, so the tests check both halves: that it
// translates, and that what it produces actually survives into the statement.
import { describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { MEMBER_FIELDS } from '../../config/constants.js';
import { members, profiles } from '../../infrastructure/database/schema/index.js';
import { MembersMapper } from './members.mapper.js';
const db = drizzle.mock();
/** The columns a patch actually reaches, read back off the generated SQL. */
function columnsWritten(table, patch) {
    const { sql } = db.update(table).set(patch).where(eq(table.id, 'x')).toSQL();
    const set = sql.slice(sql.indexOf(' set ') + 5, sql.indexOf(' where '));
    return [...set.matchAll(/"([a-z_]+)" = \$/g)].map((m) => m[1]);
}
const edit = {
    profile_id: 'p1',
    full_name: 'Ahmed Mohamed',
    national_id: '29801011234567',
    phone: '+201001234567',
    email: 'a@example.com',
};
describe('toMemberPatch', () => {
    it('translates every wire field to its schema name', () => {
        const patch = MembersMapper.toMemberPatch({
            group_id: 'g1',
            branch_id: 'b1',
            is_active: true,
            bypass_face: true,
            bypass_location: false,
            bypass_checkout_window: true,
            frozen_at: '2026-09-10',
            can_generate_qr: true,
            can_make_roster: false,
            can_reset_face: true,
        });
        expect(patch).toEqual({
            groupId: 'g1',
            branchId: 'b1',
            isActive: true,
            bypassFace: true,
            bypassLocation: false,
            bypassCheckoutWindow: true,
            frozenAt: '2026-09-10',
            canGenerateQr: true,
            canMakeRoster: false,
            canResetFace: true,
        });
    });
    it('carries every patchable field into the statement', () => {
        const all = Object.fromEntries(MEMBER_FIELDS.map((f) => [f, null]));
        const written = columnsWritten(members, MembersMapper.toMemberPatch(all));
        expect(written).toHaveLength(MEMBER_FIELDS.length);
        expect(written).toEqual(expect.arrayContaining([...MEMBER_FIELDS]));
    });
    it('omits absent fields instead of clearing them', () => {
        expect(MembersMapper.toMemberPatch({ is_active: false })).toEqual({ isActive: false });
    });
    it('keeps an explicit null — unfreezing is frozen_at: null', () => {
        const patch = MembersMapper.toMemberPatch({ frozen_at: null });
        expect(patch).toEqual({ frozenAt: null });
        expect(columnsWritten(members, patch)).toEqual(['frozen_at']);
    });
    it('is empty for an empty edit, so no statement is attempted', () => {
        expect(Object.keys(MembersMapper.toMemberPatch({}))).toHaveLength(0);
    });
});
describe('toProfilePatch', () => {
    it('writes the name and the national id — the two that were being dropped', () => {
        expect(columnsWritten(profiles, MembersMapper.toProfilePatch(edit))).toEqual(expect.arrayContaining(['full_name', 'national_id']));
    });
    it('stores an emptied phone or email as null, not as an empty string', () => {
        const patch = MembersMapper.toProfilePatch({ ...edit, phone: '', email: '' });
        expect(patch.phone).toBeNull();
        expect(patch.email).toBeNull();
    });
    it('leaves the avatar alone unless the edit mentions it', () => {
        expect('avatarUrl' in MembersMapper.toProfilePatch(edit)).toBe(false);
        expect(MembersMapper.toProfilePatch({ ...edit, avatar_url: null }).avatarUrl).toBeNull();
    });
});
//# sourceMappingURL=members.mapper.test.js.map