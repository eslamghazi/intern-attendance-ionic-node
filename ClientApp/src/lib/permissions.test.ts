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
import { GRANTABLE_PAGES, OPS, SUPERADMIN_PAGES } from './permissions';

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

describe('admin permissions agree with the server', () => {
  it('names the same pages, in the same order', () => {
    expect([...GRANTABLE_PAGES, ...SUPERADMIN_PAGES]).toEqual(serverList('ADMIN_PAGES'));
  });

  it('names the same operations', () => {
    expect([...OPS]).toEqual(serverList('ADMIN_OPS'));
  });
});
