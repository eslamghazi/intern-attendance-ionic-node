import { describe, expect, it } from 'vitest';
import { adminScope, coversRequestedFilter, coversUnit, type Scope } from './scope.js';
import { Role } from '../../common/enums/index.js';

const BRANCH_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const BRANCH_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const GROUP_1 = 'cccccccc-0000-0000-0000-000000000003';
const GROUP_2 = 'dddddddd-0000-0000-0000-000000000004';

describe('adminScope', () => {
  it('gives a superadmin everything, assignments or not', () => {
    expect(adminScope(Role.SUPERADMIN, [])).toEqual({ kind: 'all' });
    expect(adminScope(Role.SUPERADMIN, [{ branchId: BRANCH_A, groupId: null }])).toEqual({
      kind: 'all',
    });
  });

  it('gives an UNASSIGNED admin everything', () => {
    // Assignments narrow; they do not grant. Reading this the other way round
    // would lock out every admin who has none.
    expect(adminScope(Role.ADMIN, [])).toEqual({ kind: 'all' });
  });

  it('narrows an assigned admin to their branches and groups', () => {
    expect(
      adminScope(Role.ADMIN, [
        { branchId: BRANCH_A, groupId: null },
        { branchId: null, groupId: GROUP_1 },
      ]),
    ).toEqual({ kind: 'assigned', branchIds: [BRANCH_A], groupIds: [GROUP_1] });
  });

  it('keeps both halves of an assignment naming a branch AND a group', () => {
    expect(adminScope(Role.ADMIN, [{ branchId: BRANCH_A, groupId: GROUP_1 }])).toEqual({
      kind: 'assigned',
      branchIds: [BRANCH_A],
      groupIds: [GROUP_1],
    });
  });

  it('gives a member nothing', () => {
    expect(adminScope(Role.MEMBER, [])).toEqual({ kind: 'none' });
    expect(adminScope(Role.MEMBER, [{ branchId: BRANCH_A, groupId: null }])).toEqual({ kind: 'none' });
  });
});

describe('coversUnit', () => {
  const assigned: Scope = { kind: 'assigned', branchIds: [BRANCH_A], groupIds: [GROUP_1] };

  it('reaches a record in an assigned branch', () => {
    expect(coversUnit(assigned, { branchId: BRANCH_A, groupId: GROUP_2 })).toBe(true);
  });

  it('reaches a record in an assigned group whatever its branch', () => {
    // OR, not AND — matching admin_can_access().
    expect(coversUnit(assigned, { branchId: BRANCH_B, groupId: GROUP_1 })).toBe(true);
  });

  it('does not reach a record in neither', () => {
    expect(coversUnit(assigned, { branchId: BRANCH_B, groupId: GROUP_2 })).toBe(false);
  });

  it('never matches on a null branch or group', () => {
    // `null in (…)` is null in SQL, which a policy reads as false. A record
    // with no branch must not be reachable by every assigned admin.
    expect(coversUnit(assigned, { branchId: null, groupId: null })).toBe(false);
    expect(coversUnit(assigned, { branchId: null, groupId: GROUP_2 })).toBe(false);
  });

  it('lets an unrestricted scope through and a none scope never', () => {
    expect(coversUnit({ kind: 'all' }, { branchId: null, groupId: null })).toBe(true);
    expect(coversUnit({ kind: 'none' }, { branchId: BRANCH_A, groupId: GROUP_1 })).toBe(false);
  });
});

describe('coversRequestedFilter', () => {
  const assigned: Scope = { kind: 'assigned', branchIds: [BRANCH_A], groupIds: [GROUP_1] };

  it('refuses an assigned admin who asks for no filter at all', () => {
    // Otherwise omitting branch_id would be a way to ask for everyone.
    expect(coversRequestedFilter(assigned, { branchId: null, groupId: null })).toBe(false);
  });

  it('allows an unrestricted scope to ask for everything', () => {
    expect(coversRequestedFilter({ kind: 'all' }, { branchId: null, groupId: null })).toBe(true);
  });

  it('allows a filter inside the scope and refuses one outside it', () => {
    expect(coversRequestedFilter(assigned, { branchId: BRANCH_A, groupId: null })).toBe(true);
    expect(coversRequestedFilter(assigned, { branchId: BRANCH_B, groupId: null })).toBe(false);
  });

  it('allows a filter where only one of the two is in scope', () => {
    // Same OR as coversUnit: naming an assigned group is enough.
    expect(coversRequestedFilter(assigned, { branchId: BRANCH_B, groupId: GROUP_1 })).toBe(true);
  });
});
