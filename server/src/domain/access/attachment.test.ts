import { describe, expect, it } from 'vitest';
import { mayTouchAttachment, pathOwner, type AttachmentBucket } from './attachment.js';
import { Role } from '../../common/enums/index.js';

const A = 'aaaaaaaa-0000-0000-0000-00000000000a';
const B = 'bbbbbbbb-0000-0000-0000-00000000000b';

const may = (
  bucket: AttachmentBucket,
  path: string,
  action: 'read' | 'write' | 'delete',
  callerId: string,
  role: Role = Role.MEMBER,
) => mayTouchAttachment({ bucket, path, action, callerId, role });

describe('pathOwner', () => {
  it('reads the folder for the foldered buckets', () => {
    expect(pathOwner('faces', `${A}/face.jpg`)).toBe(A);
    expect(pathOwner('probes', `${A}/2026-09-01/in.jpg`)).toBe(A);
  });

  it('reads the stem for avatars, which are flat', () => {
    expect(pathOwner('avatars', `${A}.jpg`)).toBe(A);
  });

  it('returns null when the path names nobody', () => {
    // The safe answer, and the one that matters: "no owner" must never read as
    // "everyone's".
    expect(pathOwner('faces', 'face.jpg')).toBeNull();
    expect(pathOwner('avatars', 'avatar')).toBeNull();
    expect(pathOwner('faces', '/leading.jpg')).toBeNull();
    expect(pathOwner('avatars', '.hidden')).toBeNull();
  });
});

describe('faces and probes', () => {
  for (const bucket of ['faces', 'probes'] as const) {
    it(`${bucket}: a member reads their own and nobody else's`, () => {
      expect(may(bucket, `${A}/x.jpg`, 'read', A)).toBe(true);
      expect(may(bucket, `${B}/x.jpg`, 'read', A)).toBe(false);
    });

    it(`${bucket}: staff read anyone's`, () => {
      expect(may(bucket, `${B}/x.jpg`, 'read', A, Role.ADMIN)).toBe(true);
      expect(may(bucket, `${B}/x.jpg`, 'read', A, Role.SUPERADMIN)).toBe(true);
    });

    it(`${bucket}: a member writes only into their own folder`, () => {
      expect(may(bucket, `${A}/x.jpg`, 'write', A)).toBe(true);
      expect(may(bucket, `${B}/x.jpg`, 'write', A)).toBe(false);
    });

    it(`${bucket}: staff do NOT get a client-supplied write`, () => {
      // Enrolling someone else's face goes through the privileged server-side
      // path, not through a path the caller chose.
      expect(may(bucket, `${B}/x.jpg`, 'write', A, Role.ADMIN)).toBe(false);
    });

    it(`${bucket}: only staff delete`, () => {
      expect(may(bucket, `${A}/x.jpg`, 'delete', A)).toBe(false);
      expect(may(bucket, `${A}/x.jpg`, 'delete', A, Role.ADMIN)).toBe(true);
    });

    it(`${bucket}: a path with no folder is refused for everything private`, () => {
      expect(may(bucket, 'x.jpg', 'read', A)).toBe(false);
      expect(may(bucket, 'x.jpg', 'write', A)).toBe(false);
    });
  }
});

describe('avatars', () => {
  it('are readable by anyone — the bucket is public', () => {
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
    // `<A>extra/face.jpg` must not pass as A's folder.
    expect(may('faces', `${A}extra/face.jpg`, 'write', A)).toBe(false);
  });

  it('a nested path still belongs to its first folder', () => {
    expect(may('faces', `${A}/nested/deep/face.jpg`, 'write', A)).toBe(true);
    expect(may('faces', `${B}/nested/deep/face.jpg`, 'write', A)).toBe(false);
  });
});
