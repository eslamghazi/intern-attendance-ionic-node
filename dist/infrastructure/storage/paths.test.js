import { describe, it, expect } from 'vitest';
import { avatarPath, facePath, probePath, slug } from './paths.js';
describe('slug', () => {
    it('lower-cases and joins words with a single dash', () => {
        expect(slug('El Mabarra Hospital')).toBe('el-mabarra-hospital');
        expect(slug('Ward  A')).toBe('ward-a');
    });
    it('keeps Arabic, which is the project first language', () => {
        expect(slug('مستشفى المبرة')).toBe('مستشفى-المبرة');
    });
    it('strips accents rather than dropping the word', () => {
        expect(slug('Hôpital Général')).toBe('hopital-general');
    });
    it('cannot produce a separator or a traversal', () => {
        expect(slug('../../etc/passwd')).toBe('etc-passwd');
        expect(slug('a/b\\c')).toBe('a-b-c');
        expect(slug('..')).toBe('unknown');
    });
    it('never returns an empty segment', () => {
        expect(slug('')).toBe('unknown');
        expect(slug(null)).toBe('unknown');
        expect(slug(undefined, 'no-branch')).toBe('no-branch');
        expect(slug('!!!', 'no-shift')).toBe('no-shift');
    });
    it('trims leading and trailing dashes', () => {
        expect(slug('  -St. Mary\'s-  ')).toBe('st-mary-s');
    });
    it('bounds the length, so no segment can overflow a filesystem limit', () => {
        expect(slug('x'.repeat(300)).length).toBe(60);
    });
});
describe('facePath', () => {
    const parts = {
        groupYear: 2026,
        branchName: 'El Mabarra Hospital',
        groupName: 'Nursing A',
        memberCode: '2026010001',
    };
    it('nests year / branch / group / member and ends in a fixed name', () => {
        expect(facePath(parts)).toBe('year-2026/branch-el-mabarra-hospital/group-nursing-a/member-2026010001/face.jpg');
    });
    it('uses a fixed file name so re-enrolling REPLACES the photo', () => {
        // Two enrolments for the same member must not leave two files, one of
        // which nothing points at.
        const a = facePath(parts);
        const b = facePath({ ...parts, branchName: 'El Mabarra Hospital' });
        expect(a).toBe(b);
        expect(a.endsWith('/face.jpg')).toBe(true);
    });
    it('names the gap instead of collapsing it, when something is missing', () => {
        expect(facePath({ groupYear: null, branchName: null, groupName: null, memberCode: null })).toBe('year-no-group/branch-no-branch/group-no-group/member-unknown-member/face.jpg');
    });
    it('is safe against a hostile branch name', () => {
        const p = facePath({ ...parts, branchName: '../../../etc' });
        expect(p.split('/')).toHaveLength(5);
        expect(p).not.toContain('..');
    });
});
describe('probePath', () => {
    const parts = {
        date: '2026-09-11',
        branchName: 'El Mabarra Hospital',
        memberCode: '2026010001',
        shiftName: 'Morning Shift',
        type: 'check_in',
        at: new Date(Date.UTC(2026, 8, 11, 7, 58)),
    };
    it('nests year / month / day / branch / member', () => {
        expect(probePath(parts)).toBe('year-2026/2026-09/2026-09-11/branch-el-mabarra-hospital/member-2026010001/check-in__07-58__morning-shift.jpg');
    });
    it('distinguishes check-out, and keeps the pair in one directory', () => {
        const out = probePath({ ...parts, type: 'check_out', at: new Date(Date.UTC(2026, 8, 11, 15, 4)) });
        expect(out).toContain('check-out__15-04__morning-shift.jpg');
        // Same directory as the check-in, so a day's pair sits together.
        expect(out.split('/').slice(0, -1)).toEqual(probePath(parts).split('/').slice(0, -1));
    });
    it('sorts by time within the day, because the time leads the file name', () => {
        const early = probePath({ ...parts, at: new Date(Date.UTC(2026, 8, 11, 7, 5)) });
        const late = probePath({ ...parts, at: new Date(Date.UTC(2026, 8, 11, 17, 5)) });
        const name = (p) => p.split('/').pop().replace(/^check-(in|out)__/, '');
        expect(name(early) < name(late)).toBe(true);
    });
    it('pads hours and minutes, so names sort lexically', () => {
        expect(probePath({ ...parts, at: new Date(Date.UTC(2026, 8, 11, 7, 5)) })).toContain('__07-05__');
    });
    it('never uses a colon — Windows treats it as a stream separator', () => {
        expect(probePath(parts)).not.toContain(':');
    });
    it('names the month and year from the ATTENDANCE date, not the upload clock', () => {
        // A capture uploaded after midnight still belongs to its shift's date.
        const p = probePath({ ...parts, date: '2026-01-31', at: new Date(Date.UTC(2026, 1, 1, 0, 30)) });
        expect(p.startsWith('year-2026/2026-01/2026-01-31/')).toBe(true);
    });
    it('does not fabricate a date it was not given', () => {
        const p = probePath({ ...parts, date: 'not-a-date' });
        expect(p.startsWith('year-unknown-year/unknown-month/not-a-date/')).toBe(true);
    });
    it('replaces the unreadable shift UUID the old scheme used', () => {
        const p = probePath({ ...parts, shiftName: null });
        expect(p).toContain('__no-shift.jpg');
        expect(p).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
    });
});
describe('avatarPath', () => {
    it('stays flat and keyed by profile id', () => {
        expect(avatarPath('11111111-2222-3333-4444-555555555555')).toBe('11111111-2222-3333-4444-555555555555.jpg');
    });
    it('sanitises the extension', () => {
        expect(avatarPath('abc', 'png')).toBe('abc.png');
        expect(avatarPath('abc', '../sh')).toBe('abc.sh');
        expect(avatarPath('abc', '')).toBe('abc.jpg');
    });
});
//# sourceMappingURL=paths.test.js.map