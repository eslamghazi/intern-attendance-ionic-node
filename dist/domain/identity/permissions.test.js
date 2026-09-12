import { describe, expect, it } from 'vitest';
import { grantAllows, grantedOps, grantedPages } from './permissions.js';
describe('an admin nobody has configured', () => {
    it('may open nothing', () => {
        expect(grantedPages(null).size).toBe(0);
        expect(grantedPages(undefined).size).toBe(0);
        expect(grantAllows(null, 'dashboard')).toBe(false);
    });
    it('may do nothing on a page they cannot open', () => {
        expect(grantedOps(null, 'members').size).toBe(0);
        expect(grantAllows({ pages: [] }, 'members', 'edit')).toBe(false);
    });
});
describe('a page grant', () => {
    const grant = { pages: ['members', 'review'] };
    it('opens the page and implies reading', () => {
        expect(grantAllows(grant, 'members')).toBe(true);
        expect(grantAllows(grant, 'review')).toBe(true);
    });
    it('does not open a page that was not granted', () => {
        expect(grantAllows(grant, 'audit')).toBe(false);
    });
    it('allows no operation until one is granted', () => {
        expect(grantAllows(grant, 'members', 'edit')).toBe(false);
        expect(grantAllows(grant, 'members', 'delete')).toBe(false);
    });
});
describe('per-page operations', () => {
    const grant = {
        pages: ['members', 'dashboard'],
        pageOps: { members: ['edit'], dashboard: ['export'] },
    };
    it('allow exactly what was named', () => {
        expect(grantAllows(grant, 'members', 'edit')).toBe(true);
        expect(grantAllows(grant, 'members', 'delete')).toBe(false);
        expect(grantAllows(grant, 'dashboard', 'export')).toBe(true);
    });
    it('cannot grant an operation the page does not have', () => {
        // The dashboard only exports; a stored "delete" on it is noise, not a right.
        const odd = { pages: ['dashboard'], pageOps: { dashboard: ['delete', 'export'] } };
        expect([...grantedOps(odd, 'dashboard')]).toEqual(['export']);
        expect(grantAllows(odd, 'dashboard', 'delete')).toBe(false);
    });
    it('win over the page-wide list', () => {
        const both = {
            pages: ['members'],
            ops: ['create', 'edit', 'delete', 'export'],
            pageOps: { members: ['edit'] },
        };
        expect([...grantedOps(both, 'members')]).toEqual(['edit']);
    });
});
describe('the older page-wide list', () => {
    const grant = { pages: ['members', 'audit'], ops: ['edit', 'export'] };
    it('applies on every granted page, clipped to what each page has', () => {
        expect([...grantedOps(grant, 'members')].sort()).toEqual(['edit', 'export']);
        // audit has no "edit"
        expect([...grantedOps(grant, 'audit')]).toEqual(['export']);
    });
});
describe('a route that accepts any of several', () => {
    it('is satisfied by holding either page', () => {
        expect(grantAllows({ pages: ['groups'] }, ['branches', 'groups'])).toBe(true);
        expect(grantAllows({ pages: ['branches'] }, ['branches', 'groups'])).toBe(true);
        expect(grantAllows({ pages: ['members'] }, ['branches', 'groups'])).toBe(false);
    });
    it('is satisfied by either operation — an upsert is create or edit', () => {
        const creator = { pages: ['departments'], pageOps: { departments: ['create'] } };
        const editor = { pages: ['departments'], pageOps: { departments: ['edit'] } };
        const reader = { pages: ['departments'] };
        expect(grantAllows(creator, 'departments', ['create', 'edit'])).toBe(true);
        expect(grantAllows(editor, 'departments', ['create', 'edit'])).toBe(true);
        expect(grantAllows(reader, 'departments', ['create', 'edit'])).toBe(false);
    });
    it('checks the operation on a page that is actually held', () => {
        // Holds groups with no ops, and branches with edit: the pair must pass on
        // branches, not fail because groups was looked at first.
        const grant = {
            pages: ['groups', 'branches'],
            pageOps: { groups: [], branches: ['edit'] },
        };
        expect(grantAllows(grant, ['groups', 'branches'], 'edit')).toBe(true);
    });
});
//# sourceMappingURL=permissions.test.js.map