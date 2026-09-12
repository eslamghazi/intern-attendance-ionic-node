import { Injectable } from '@nestjs/common';
import { createReadStream, type ReadStream } from 'node:fs';
import { copyFile, mkdir, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import type { DbContext, JwtClaims } from '../database/context.js';
import { UnitOfWorkService } from '../database/unit-of-work.service.js';
import { eq, and, inArray } from 'drizzle-orm';
import { attachments } from '../database/schema/index.js';
import { mayTouchAttachment } from '../../domain/access/attachment.js';
import type { Role } from '../../domain/identity/role.js';
import { forbidden, notFound } from '../../common/errors.js';
import { signedPath, verify } from './signing.js';
import { FILE_KINDS, FILE_KIND_NAMES, type FileKind } from '../../config/constants.js';
import type { FileMetadata, FileStream, UploadOptions } from './file-manager.types.js';
export type { FileMetadata, FileStream, UploadOptions } from './file-manager.types.js';

// The kinds, and which of them a read must be signed for, are declared once in
// config/constants.ts. `attendance` and `documents` used to sit in an enum here
// alongside them: no code ever wrote either, the client never knew them, and the
// schema's CHECK rejected them — three sources of truth and two phantom values.
export type { FileKind };

@Injectable()
export class FileManager {
  private readonly rootDir = resolve(env.STORAGE_DIR);

  constructor(private readonly uow: UnitOfWorkService) {}

  /** One directory per kind, created on boot so an upload never races a mkdir. */
  async ensureDirectories(): Promise<void> {
    for (const kind of FILE_KIND_NAMES) {
      await mkdir(join(this.rootDir, kind), { recursive: true });
    }
  }

  /**
   * Can this kind be read without a signature?
   *
   * True for avatars only: a profile picture appears beside a name in lists a
   * signed-out caller already sees, and signing each one would mean a round trip
   * per face in a grid. Everything else here is biometric.
   */
  isPubliclyReadable(kind: FileKind): boolean {
    return !FILE_KINDS[kind].signedUrl;
  }

  private callerOf(claims: JwtClaims | null): { callerId: string; role: Role } | null {
    if (!claims?.sub) return null;
    return { callerId: claims.sub, role: claims.user_role as Role };
  }

  private locate(kind: string, path: string): string {
    const full = resolve(join(this.rootDir, kind, normalize(path)));
    const categoryRoot = resolve(join(this.rootDir, kind));
    if (full !== categoryRoot && !full.startsWith(categoryRoot + sep)) {
      throw notFound('object not found');
    }
    return full;
  }

  async upload(opts: UploadOptions): Promise<{ path: string }> {
    const contentType = opts.contentType ?? 'application/octet-stream';

    if (opts.claims !== undefined) {
      const caller = this.callerOf(opts.claims);
      if (
        !caller ||
        !mayTouchAttachment({
          kind: opts.kind,
          path: opts.path,
          action: 'write',
          callerId: caller.callerId,
          role: caller.role,
          // NOT `opts.owner`. The owner is whoever is uploading, so passing it
          // as the subject asked "is the caller the caller" — true always, for
          // every path. A client-driven write is judged on the path; `subject`
          // is only ever set by server-side code that computed the path itself,
          // and those callers pass no claims and do not reach this check.
          subjectId: opts.subject ?? null,
        })
      ) {
        throw forbidden('that path is not yours to write');
      }
    }

    // Who the file is about. Defaults to the uploader, which is right whenever
    // someone uploads their own; an admin enrolling a member passes the member.
    const subjectId = opts.subject !== undefined ? opts.subject : opts.owner ?? null;

    const write = async (tx: DbContext) => {
      await tx.insert(attachments).values({
        kind: opts.kind,
        path: opts.path,
        ownerId: opts.owner ?? null,
        subjectId,
        byteSize: opts.body.length,
        contentType,
      }).onConflictDoUpdate({
        target: [attachments.kind, attachments.path],
        set: {
          ownerId: opts.owner ?? null,
          subjectId,
          byteSize: opts.body.length,
          contentType,
          updatedAt: new Date().toISOString(),
        },
      });
    };
    
    // Join the caller's transaction when there is one, so the row and the file
    // land together.
    if (opts.tx) await write(opts.tx);
    else await this.uow.transaction(write);

    const target = this.locate(opts.kind, opts.path);
    await mkdir(dirname(target), { recursive: true });

    const tmp = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(tmp, opts.body);
      await rename(tmp, target);
    } catch (err) {
      await unlink(tmp).catch(() => {});
      throw err;
    }
    return { path: opts.path };
  }

  getUrl(kind: FileKind, path: string, ttl = env.STORAGE_URL_TTL): string {
    if (this.isPubliclyReadable(kind)) {
      return `${env.apiPublicPath}/storage/${kind}/object?path=${encodeURIComponent(path)}`;
    }
    return `${env.apiPublicPath}${signedPath(kind, path, ttl)}`;
  }

  async getSignedUrls(
    claims: JwtClaims | null,
    kind: FileKind,
    paths: string[],
    ttl = env.STORAGE_URL_TTL,
  ): Promise<Record<string, string>> {
    const wanted = [...new Set(paths.filter(Boolean))];
    if (!wanted.length) return {};

    const caller = this.callerOf(claims);

    // Read the rows FIRST, then decide. Access depends on `subject_id`, which
    // only the row knows — the old order filtered on a path parse that was
    // never right (see domain/access/attachment.ts) and then queried. Same one
    // query either way.
    const rows = await this.uow.transaction(async (tx) =>
      tx
        .select({ path: attachments.path, subjectId: attachments.subjectId })
        .from(attachments)
        .where(and(eq(attachments.kind, kind), inArray(attachments.path, wanted))),
    );

    const visible = this.isPubliclyReadable(kind)
      ? rows
      : rows.filter(
          (row) =>
            caller !== null &&
            mayTouchAttachment({
              kind: kind,
              path: row.path,
              action: 'read',
              callerId: caller.callerId,
              role: caller.role,
              // Undefined rather than null when unset: that is what selects
              // the avatar path rule in mayTouchAttachment.
              ...(row.subjectId !== null ? { subjectId: row.subjectId } : {}),
            }),
        );

    const isPubliclyReadable = this.isPubliclyReadable(kind);
    const out: Record<string, string> = {};
    for (const row of visible) {
      out[row.path] = isPubliclyReadable
        ? `${env.apiPublicPath}/storage/${kind}/object?path=${encodeURIComponent(row.path)}`
        : `${env.apiPublicPath}${signedPath(kind, row.path, ttl)}`;
    }
    return out;
  }

  async getSignedUrl(
    claims: JwtClaims | null,
    kind: FileKind,
    path: string,
    ttl = env.STORAGE_URL_TTL,
  ): Promise<string> {
    const urls = await this.getSignedUrls(claims, kind, [path], ttl);
    const url = urls[path];
    if (!url) throw notFound('object not found');
    return url;
  }

  async download(kind: FileKind, path: string): Promise<FileStream> {
    const target = this.locate(kind, path);
    let size: number;
    try {
      size = (await stat(target)).size;
    } catch {
      throw notFound('object not found');
    }

    const row = await this.uow.transaction(async (tx) => {
      const rows = await tx.select({ contentType: attachments.contentType })
        .from(attachments)
        .where(and(eq(attachments.kind, kind), eq(attachments.path, path)))
        .limit(1);
      return rows[0] ?? null;
    });
    const contentType = row?.contentType ?? 'application/octet-stream';

    return { stream: createReadStream(target), size, contentType };
  }

  async getMetadata(kind: FileKind, path: string): Promise<FileMetadata | null> {
    const row = await this.uow.transaction(async (tx) => {
      const rows = await tx
        .select({
          byteSize: attachments.byteSize,
          contentType: attachments.contentType,
          ownerId: attachments.ownerId,
          updatedAt: attachments.updatedAt,
        })
        .from(attachments)
        .where(and(eq(attachments.kind, kind), eq(attachments.path, path)))
        .limit(1);
      return rows[0] ?? null;
    });

    if (!row) return null;
    return {
      byteSize: row.byteSize,
      contentType: row.contentType,
      ownerId: row.ownerId,
      updatedAt: row.updatedAt,
    };
  }

  async delete(kind: FileKind, paths: string[], tx?: DbContext): Promise<void> {
    const wanted = paths.filter(Boolean);
    if (!wanted.length) return;

    for (const path of wanted) {
      try {
        await unlink(this.locate(kind, path));
      } catch {
        // Ignored
      }
    }

    const drop = (t: DbContext) => t.delete(attachments).where(and(eq(attachments.kind, kind), inArray(attachments.path, wanted)));
    if (tx) await drop(tx);
    else await this.uow.transaction(drop);
  }

  async copy(
    sourceCategory: FileKind,
    sourcePath: string,
    targetCategory: FileKind,
    targetPath: string,
    tx?: DbContext,
  ): Promise<void> {
    const sourceTarget = this.locate(sourceCategory, sourcePath);
    const destinationTarget = this.locate(targetCategory, targetPath);

    await mkdir(dirname(destinationTarget), { recursive: true });
    await copyFile(sourceTarget, destinationTarget);

    const metadata = await this.getMetadata(sourceCategory, sourcePath);
    const write = async (t: DbContext) => {
      await t.insert(attachments).values({
        kind: targetCategory,
        path: targetPath,
        ownerId: metadata?.ownerId ?? null,
        byteSize: metadata?.byteSize ?? 0,
        contentType: metadata?.contentType ?? 'application/octet-stream',
      }).onConflictDoUpdate({
        target: [attachments.kind, attachments.path],
        set: {
          ownerId: metadata?.ownerId ?? null,
          byteSize: metadata?.byteSize ?? 0,
          contentType: metadata?.contentType ?? 'application/octet-stream',
          updatedAt: new Date().toISOString(),
        },
      });
    };

    if (tx) await write(tx);
    else await this.uow.transaction(write);
  }

  async move(
    sourceCategory: FileKind,
    sourcePath: string,
    targetCategory: FileKind,
    targetPath: string,
    tx?: DbContext,
  ): Promise<void> {
    await this.copy(sourceCategory, sourcePath, targetCategory, targetPath, tx);
    await this.delete(sourceCategory, [sourcePath], tx);
  }

  /**
   * Every file actually on disk under one kind, as paths relative to that kind.
   *
   * For reconciliation only. Walks rather than globs so it needs no dependency,
   * and returns paths in the same shape `attachments.path` stores them — which
   * is the whole point: the two lists have to be comparable.
   */
  async listOnDisk(kind: FileKind): Promise<string[]> {
    const root = join(this.rootDir, kind);
    const out: string[] = [];

    const walk = async (dir: string, prefix: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return; // the kind directory may not exist yet
      }
      for (const entry of entries) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(join(dir, entry.name), rel);
        else if (entry.isFile()) out.push(rel);
      }
    };

    await walk(root, '');
    return out;
  }

  async exists(kind: FileKind, path: string): Promise<boolean> {
    try {
      await stat(this.locate(kind, path));
      return true;
    } catch {
      return false;
    }
  }

  verifySignature(kind: FileKind, path: string, expires: number, signature: string) {
    return verify(kind, path, expires, signature);
  }

  decodeBase64Image(input: string): Buffer | null {
    const b64 = (input || '').split(',').pop() ?? '';
    if (!b64) return null;
    try {
      const buf = Buffer.from(b64, 'base64');
      return buf.length ? buf : null;
    } catch {
      return null;
    }
  }
}
