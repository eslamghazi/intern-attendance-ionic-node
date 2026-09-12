import { describe, expect, it } from 'vitest';
import { STAFF_TYPES, staffTypeDefaults, staffTypeOf } from './staffTypes';
import { GRANTABLE_PAGES, PAGE_OPS } from './permissions';

describe('a type is a name for a grant', () => {
  it('a superadmin is a role, not a grant', () => {
    expect(staffTypeDefaults('superadmin')).toEqual({ role: 'superadmin', permissions: null });
  });

  it('every other type is an admin with a grant', () => {
    for (const type of STAFF_TYPES.filter((t) => t !== 'superadmin')) {
      expect(staffTypeDefaults(type).role).toBe('admin');
    }
  });

  it('a manager holds every page but the two that manage staff, with every operation', () => {
    const { permissions } = staffTypeDefaults('manager');
    const expected = GRANTABLE_PAGES.filter((p) => p !== 'admins' && p !== 'backup');
    expect([...(permissions?.pages ?? [])].sort()).toEqual([...expected].sort());
    for (const p of expected) expect(permissions?.pageOps?.[p]).toEqual(PAGE_OPS[p]);
  });

  it('no preset hands out the admins or backup page — those are granted on purpose', () => {
    for (const type of ['manager', 'supervisor', 'reviewer'] as const) {
      const pages = staffTypeDefaults(type).permissions?.pages ?? [];
      expect(pages).not.toContain('admins');
      expect(pages).not.toContain('backup');
    }
  });

  it('custom starts with nothing', () => {
    expect(staffTypeDefaults('custom').permissions).toEqual({ pages: [], pageOps: {} });
  });

  it('a preset never names an operation its page does not have', () => {
    for (const type of ['manager', 'supervisor', 'reviewer'] as const) {
      const { permissions } = staffTypeDefaults(type);
      for (const page of permissions?.pages ?? []) {
        for (const op of permissions?.pageOps?.[page] ?? []) {
          expect(PAGE_OPS[page as keyof typeof PAGE_OPS], `${type}.${page}.${op}`).toContain(op);
        }
      }
    }
  });
});

describe('an account shows the type its grant matches', () => {
  it('round-trips every preset', () => {
    for (const type of STAFF_TYPES) {
      const { role, permissions } = staffTypeDefaults(type);
      expect(staffTypeOf(role, permissions)).toBe(type);
    }
  });

  it('is custom once the grant no longer fits — one extra page is enough', () => {
    const { permissions } = staffTypeDefaults('supervisor');
    const widened = { ...permissions!, pages: [...permissions!.pages, 'audit' as const] };
    expect(staffTypeOf('admin', widened)).toBe('custom');
  });

  it('reads the grant, not the order it was written in', () => {
    const { permissions } = staffTypeDefaults('reviewer');
    const shuffled = { pages: [...permissions!.pages].reverse(), pageOps: permissions!.pageOps };
    expect(staffTypeOf('admin', shuffled)).toBe('reviewer');
  });

  it('an admin nobody configured is custom, not a preset', () => {
    expect(staffTypeOf('admin', null)).toBe('custom');
  });
});
