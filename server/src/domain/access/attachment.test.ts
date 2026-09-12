import { describe, expect, it } from 'vitest';
import { folderOwner, mayTouchAttachment, pathOwner, type FileKind } from './attachment.js';
import { Role } from '../../common/enums/index.js';

const A = 'aaaaaaaa-0000-0000-0000-00000000000a';
const B = 'bbbbbbbb-0000-0000-0000-00000000000b';

const may = (
  kind: FileKind,
  path: string,
  action: 'read' | 'write' | 'delete',
  callerId: string,
  role: Role = Role.MEMBER,
) => mayTouchAttachment({ kind, path, action, callerId, role });

/**
 * The private kinds answer from `attachments.subject_id`, so the tests that
 * exercise them have to supply one — exactly as FileManager does after reading
 * the row. `owns` says "this file belongs to `subject`".
 */
const owns = (
  kind: FileKind,
  path: string,
  action: 'read' | 'write' | 'delete',
  callerId: string,
  subjectId: string | null,
  role: Role = Role.MEMBER,
) => mayTouchAttachment({ kind, path, action, callerId, role, subjectId });

describe('pathOwner', () => {
  // AVATARS ONLY. Every other kind records its owner in a column — see
  // FILE_KINDS.ownerFrom. This exists because `avatars/<profile-id>.<ext>` is
  // genuinely the whole layout for that one kind.
  it('reads the stem, which is the profile id', () => {
    expect(pathOwner(`${A}.jpg`)).toBe(A);
    expect(pathOwner(`${A}.png`)).toBe(A);
  });

  it('returns null when the path names nobody', () => {
    // The safe answer, and the one that matters: "no owner" must never read as
    // "everyone's".
    expect(pathOwner('avatar')).toBeNull();
    expect(pathOwner('.jpg')).toBeNull();
    expect(pathOwner('/leading.jpg')).toBeNull();
    expect(pathOwner('.hidden')).toBeNull();
  });
});

describe('faces and probes', () => {
  for (const kind of ['faces', 'probes'] as const) {
    it(`${kind}: a member reads their own and nobody else's`, () => {
      expect(owns(kind, 'any/path.jpg', 'read', A, A)).toBe(true);
      expect(owns(kind, 'any/path.jpg', 'read', A, B)).toBe(false);
    });

    it(`${kind}: staff read anyone's`, () => {
      expect(owns(kind, 'any/path.jpg', 'read', A, B, Role.ADMIN)).toBe(true);
      expect(owns(kind, 'any/path.jpg', 'read', A, B, Role.SUPERADMIN)).toBe(true);
    });

    it(`${kind}: a member writes only their own file`, () => {
      expect(owns(kind, 'any/path.jpg', 'write', A, A)).toBe(true);
      expect(owns(kind, 'any/path.jpg', 'write', A, B)).toBe(false);
    });

    it(`${kind}: staff do NOT get a client-supplied write`, () => {
      // Enrolling someone else's face goes through the privileged server-side
      // path, not through a path the caller chose.
      expect(owns(kind, 'any/path.jpg', 'write', A, B, Role.ADMIN)).toBe(false);
    });

    it(`${kind}: only staff delete`, () => {
      expect(owns(kind, 'any/path.jpg', 'delete', A, A)).toBe(false);
      expect(owns(kind, 'any/path.jpg', 'delete', A, A, Role.ADMIN)).toBe(true);
    });

    it(`${kind}: a row that names nobody belongs to nobody`, () => {
      // The path is not consulted for these kinds, so a null subject is the
      // end of it — there is no second guess from the folder name.
      expect(owns(kind, 'x.jpg', 'read', A, null)).toBe(false);
      expect(owns(kind, 'x.jpg', 'write', A, null)).toBe(false);
      // …and staff still reach it, which is what makes an orphaned file
      // recoverable rather than lost.
      expect(owns(kind, 'x.jpg', 'read', A, null, Role.ADMIN)).toBe(true);
    });
  }
});

describe('avatars', () => {
  it('are readable by anyone — the kind is public', () => {
    expect(may('avatars', `${B}.jpg`, 'read', A)).toBe(true);
  });

  it('are written by their owner or by staff', () => {
    expect(may('avatars', `${A}.jpg`, 'write', A)).toBe(true);
    expect(may('avatars', `${B}.jpg`, 'write', A)).toBe(false);
    expect(may('avatars', `${B}.jpg`, 'write', A, Role.ADMIN)).toBe(true);
  });

  it('are deleted by their owner or by staff', () => {
    expect(may('avatars', `${A}.jpg`, 'delete', A)).toBe(true);
    expect(may('avatars', `${B}.jpg`, 'delete', A)).toBe(false);
    expect(may('avatars', `${B}.jpg`, 'delete', A, Role.ADMIN)).toBe(true);
  });

  it('with an unownable name cannot be written by a member', () => {
    expect(may('avatars', 'avatar', 'write', A)).toBe(false);
  });
});

describe('the rule a member cannot talk their way around', () => {
  it('a prefix that merely starts with the caller id is not the caller', () => {
    // Still true for avatars, which ARE keyed by the path.
    expect(may('avatars', `${A}extra.jpg`, 'write', A)).toBe(false);
  });

  it('the path cannot claim ownership for a private kind', () => {
    // A caller who chooses the path could otherwise name themselves in it. For
    // faces and probes the path is organisation for humans; the row decides.
    expect(owns('faces', `${A}/nested/deep/face.jpg`, 'write', A, B)).toBe(false);
    expect(owns('faces', `${B}/nested/deep/face.jpg`, 'write', A, A)).toBe(true);
  });
});

describe('the recorded subject decides, not the path', () => {
  // attachments.subject_id records who a file is ABOUT. Before it existed this
  // was parsed out of the path on the assumption that faces looked like
  // `<profile-id>/<file>` — which nothing ever wrote. The real paths began with
  // a group year, so the parse returned "2026" and matched nobody: members
  // could not reach their own face or probe images at all.
  //
  // The layout is organised for a human now (see infrastructure/storage/paths.ts)
  // and says nothing about ownership, so these are the cases that matter.
  const withSubject = (
    kind: FileKind,
    path: string,
    action: 'read' | 'write' | 'delete',
    callerId: string,
    subjectId: string | null,
    role: Role = Role.MEMBER,
  ) => mayTouchAttachment({ kind, path, action, callerId, role, subjectId });

  const DESCRIPTIVE = 'year-2026/branch-el-mabarra/group-nursing-a/member-2026010001/face.jpg';

  it('lets a member read their own file under a path that does not name them', () => {
    expect(withSubject('faces', DESCRIPTIVE, 'read', A, A)).toBe(true);
  });

  it('refuses another member the same file', () => {
    expect(withSubject('faces', DESCRIPTIVE, 'read', B, A)).toBe(false);
  });

  it('consults NO path parse for a foldered kind — the column or nothing', () => {
    // The storage tree is organised to be read by a person, so a path segment
    // is a branch or a year, never an identity. With no recorded subject the
    // answer is no, and the path is not consulted to find a second opinion.
    expect(may('faces', DESCRIPTIVE, 'read', A)).toBe(false);
  });

  it('staff still read anything', () => {
    expect(withSubject('faces', DESCRIPTIVE, 'read', B, A, Role.ADMIN)).toBe(true);
  });

  it('a null subject denies, and the path is not consulted', () => {
    // A row that records "this belongs to nobody" must NOT be re-interpreted by
    // parsing the path — that is how a deliberate null becomes an accidental
    // match, and the path is the one thing a caller can choose.
    expect(withSubject('faces', `${A}/face.jpg`, 'read', A, null)).toBe(false);
    expect(may('faces', `${A}/face.jpg`, 'read', A)).toBe(false);
  });

  it('a probe is still evidence: its subject may not overwrite it', () => {
    expect(withSubject('probes', DESCRIPTIVE, 'write', A, A)).toBe(true);
    expect(withSubject('probes', DESCRIPTIVE, 'delete', A, A)).toBe(false);
    expect(withSubject('probes', DESCRIPTIVE, 'delete', A, A, Role.ADMIN)).toBe(true);
  });

  it('avatars keep the flat scheme and ignore a subject they never had', () => {
    expect(may('avatars', `${A}.jpg`, 'read', B)).toBe(true);
    expect(may('avatars', `${A}.jpg`, 'write', A)).toBe(true);
    expect(may('avatars', `${B}.jpg`, 'write', A)).toBe(false);
  });
});

describe('folderOwner', () => {
  it('reads the first segment, which is the member id', () => {
    expect(folderOwner(`${A}/reference.jpg`)).toBe(A);
    expect(folderOwner(`${A}/2026-09-10-check-in.jpg`)).toBe(A);
  });

  it('names nobody when there is no folder', () => {
    // 'face.jpg' at the root belongs to no member. Returning the whole string
    // would make it everybody's.
    expect(folderOwner('face.jpg')).toBeNull();
    expect(folderOwner('')).toBeNull();
  });

  it('names nobody when the folder is empty', () => {
    expect(folderOwner('/face.jpg')).toBeNull();
  });
});

describe('an upload with no subject on record', () => {
  // THE HOLE THIS CLOSES
  //
  // A first upload has no attachments row to read a subject from, so the
  // FileManager passed the caller's own id as the subject — which made `isOwn`
  // a comparison of the caller against themselves. It was true for every path
  // any member ever submitted, so a member could write a face image into
  // another member's folder and over their enrolment photo. The e2e storage
  // suite caught it; these keep it caught without a database.
  const upload = (path: string, callerId: string) =>
    mayTouchAttachment({ kind: 'faces', path, action: 'write', callerId, role: Role.MEMBER });

  it('lets a member write into their own folder', () => {
    expect(upload(`${A}/reference.jpg`, A)).toBe(true);
  });

  it('REFUSES a member writing into another member’s folder', () => {
    expect(upload(`${B}/reference.jpg`, A)).toBe(false);
  });

  it('REFUSES a path with no folder at all', () => {
    expect(upload('face.jpg', A)).toBe(false);
  });

  it('refuses probes the same way', () => {
    const probe = (path: string, callerId: string) =>
      mayTouchAttachment({ kind: 'probes', path, action: 'write', callerId, role: Role.MEMBER });
    expect(probe(`${A}/2026-09-10-check-in.jpg`, A)).toBe(true);
    expect(probe(`${B}/2026-09-10-check-in.jpg`, A)).toBe(false);
  });

  it('does not let staff write one either — enrolment goes through the server', () => {
    // FILE_ACCESS.faces.write is 'own', not 'own-or-staff', so an admin cannot
    // post somebody's face through the client-facing route. The privileged path
    // computes the path itself and carries no claims.
    expect(
      mayTouchAttachment({
        kind: 'faces',
        path: `${B}/reference.jpg`,
        action: 'write',
        callerId: A,
        role: Role.SUPERADMIN,
      }),
    ).toBe(false);
  });
});

describe('the write fallback does not reach avatars', () => {
  // Avatars are FLAT — `<profile-id>.<ext>` — and derive their owner from the
  // path already. The folder fallback exists for the kinds that normally learn
  // their subject from a row; applied here it would newly accept `<id>/x.jpg`,
  // a shape this kind does not have.
  it('still refuses a nested avatar path', () => {
    expect(may('avatars', `${A}/picture.jpg`, 'write', A)).toBe(false);
  });

  it('still accepts the flat one', () => {
    expect(may('avatars', `${A}.jpg`, 'write', A)).toBe(true);
  });
});
