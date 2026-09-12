// The two ends of one list.
//
// A grant is stored by the server and acted on by the client, so the page names
// live in both projects: GRANTABLE_PAGES + SUPERADMIN_PAGES here, ADMIN_PAGES in
// server/src/config/constants.ts. The server VALIDATES against its copy — a page
// this app knows and the server does not comes back as a 400 on save, and one
// the server knows and this app does not is a grant nobody can ever use.
//
// Neither failure shows up until somebody tries to save a grant, so the lists
// are compared here instead. Reading the server's file rather than importing it
// is deliberate: these are two separate builds, and a test is the only place
// they are allowed to meet.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADMIN_PERMISSIONS,
  GRANTABLE_PAGES,
  OPS,
  PAGE_OPS,
  SUPERADMIN_PAGES,
  effectivePermissions,
} from './permissions';

const SERVER_CONSTANTS = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../server/src/config/constants.ts',
);

/** Pull `export const NAME = [ 'a', 'b' ] as const;` out of the server's source. */
function serverList(name: string): string[] {
  const source = readFileSync(SERVER_CONSTANTS, 'utf8');
  const match = new RegExp(`export const ${name} = \\[([^\\]]*)\\] as const;`).exec(source);
  if (!match) throw new Error(`${name} not found in ${SERVER_CONSTANTS}`);
  return [...match[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

/** Pull `page: ['a', 'b'],` lines out of the server's PAGE_OPS block. */
function serverPageOps(): Record<string, string[]> {
  const source = readFileSync(SERVER_CONSTANTS, 'utf8');
  const block = /export const PAGE_OPS = \{([\s\S]*?)\} as const/.exec(source);
  if (!block) throw new Error(`PAGE_OPS not found in ${SERVER_CONSTANTS}`);
  const out: Record<string, string[]> = {};
  for (const m of block[1]!.matchAll(/^\s*(\w+): \[([^\]]*)\],/gm)) {
    out[m[1]!] = [...m[2]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!);
  }
  return out;
}

describe('admin permissions agree with the server', () => {
  it('names the same pages, in the same order', () => {
    expect([...GRANTABLE_PAGES, ...SUPERADMIN_PAGES]).toEqual(serverList('ADMIN_PAGES'));
  });

  it('names the same operations', () => {
    expect([...OPS]).toEqual(serverList('ADMIN_OPS'));
  });

  it('offers on each page exactly the operations the server will honour', () => {
    // The server's table also covers the two superadmin-only pages, which the
    // editor never shows; the grantable ones must match entry for entry, or a
    // chip in the editor grants something the guard refuses (or vice versa).
    const server = serverPageOps();
    for (const page of GRANTABLE_PAGES) {
      expect(PAGE_OPS[page], `PAGE_OPS.${page}`).toEqual(server[page]);
    }
  });
});

describe('what an admin has before anyone grants anything', () => {
  it('is nothing — not every page', () => {
    expect(DEFAULT_ADMIN_PERMISSIONS.pages).toEqual([]);
    const eff = effectivePermissions('admin', null);
    expect(eff.pages.size).toBe(0);
    expect(eff.opsFor('members').size).toBe(0);
  });

  it('a superadmin holds every page regardless', () => {
    const eff = effectivePermissions('superadmin', null);
    expect(eff.pages.size).toBe(GRANTABLE_PAGES.length + SUPERADMIN_PAGES.length);
  });
});
