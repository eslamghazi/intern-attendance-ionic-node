// Reading a backup file somebody uploaded.
//
// Everything here arrives from outside — a file picked in a browser — and the
// accounts in it become accounts that can do anything. So the parser is the
// boundary, and these are the shapes it has to refuse rather than half-insert.
import { describe, expect, it } from 'vitest';
import {
  parseSuperadminBackup,
  SUPERADMIN_BACKUP_KIND,
  SUPERADMIN_BACKUP_VERSION,
} from './superadminBackup.js';
import type { JsonValue } from '../../common/json.types.js';

const account = (over: Record<string, JsonValue> = {}) => ({
  full_name: 'Super Admin',
  national_id: '30110281500753',
  phone: null,
  email: null,
  avatar_url: null,
  password_hash: '$2a$10$abcdefghijklmnopqrstuv',
  is_active: true,
  ...over,
});

const file = (over: Record<string, JsonValue> = {}): JsonValue => ({
  kind: SUPERADMIN_BACKUP_KIND,
  version: SUPERADMIN_BACKUP_VERSION,
  taken_at: '2026-09-12T05:00:00.000Z',
  accounts: [account()],
  ...over,
});

/** The refusal reason, or '' when it parsed. */
const why = (value: JsonValue) => {
  const r = parseSuperadminBackup(value);
  return r.ok ? '' : r.why;
};

describe('parseSuperadminBackup', () => {
  it('reads a file this system wrote', () => {
    const r = parseSuperadminBackup(file());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.accounts).toHaveLength(1);
    expect(r.accounts[0]).toMatchObject({
      nationalId: '30110281500753',
      fullName: 'Super Admin',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
      isActive: true,
    });
  });

  it('defaults is_active when the file omits it', () => {
    const r = parseSuperadminBackup(file({ accounts: [account({ is_active: null })] }));
    expect(r.ok && r.accounts[0]!.isActive).toBe(true);
  });

  describe('refuses what is not one of ours', () => {
    it('a file of another kind — named, so the fix is obvious', () => {
      expect(why(file({ kind: 'something/else' }))).toMatch(/not a superadmin backup/);
    });

    it('a file with no kind at all', () => {
      expect(why({ version: 1, accounts: [account()] })).toMatch(/not a superadmin backup/);
    });

    it('anything that is not an object', () => {
      expect(why('a string')).toMatch(/not a JSON object/);
      expect(why([account()])).toMatch(/not a JSON object/);
      expect(why(null)).toMatch(/not a JSON object/);
    });

    it('a NEWER version, because this server cannot know what changed', () => {
      expect(why(file({ version: SUPERADMIN_BACKUP_VERSION + 1 }))).toMatch(/use a newer server/);
    });

    it('but accepts an older one', () => {
      expect(parseSuperadminBackup(file({ version: 1 })).ok).toBe(true);
    });
  });

  describe('refuses an account it could only half-insert', () => {
    it('with no national id', () => {
      expect(why(file({ accounts: [account({ national_id: null })] }))).toMatch(/no national_id/);
    });

    it('with no name', () => {
      expect(why(file({ accounts: [account({ full_name: null })] }))).toMatch(/no full_name/);
    });

    it('with no password hash', () => {
      // Restored without one, the account exists and nobody can sign in as it —
      // which looks like a successful restore and is not one.
      expect(why(file({ accounts: [account({ password_hash: null })] }))).toMatch(
        /no password_hash/,
      );
    });

    it('and says WHICH account, by position and by id', () => {
      const two = file({ accounts: [account(), account({ national_id: '29001011234567', full_name: null })] });
      expect(why(two)).toMatch(/account 2 \(29001011234567\)/);
    });
  });

  describe('refuses a file that cannot be applied coherently', () => {
    it('with no accounts list', () => {
      expect(why(file({ accounts: null }))).toMatch(/no accounts list/);
    });

    it('with an empty list — nothing to restore is not a restore', () => {
      expect(why(file({ accounts: [] }))).toMatch(/empty/);
    });

    it('listing the same person twice', () => {
      // Applied in order, the second would silently win. Refusing says so.
      expect(why(file({ accounts: [account(), account()] }))).toMatch(/twice/);
    });
  });
});
