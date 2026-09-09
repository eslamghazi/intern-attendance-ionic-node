import { Injectable } from '@nestjs/common';
import { createReadStream, type ReadStream } from 'node:fs';
import { copyFile, mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../../env.js';
import { asCaller, asService, type DbContext, type JwtClaims } from '../../db/context.js';
import { eq, and, inArray } from 'drizzle-orm';
import { attachments } from '../../db/schema/index.js';
import { mayTouchAttachment } from '../../domain/access/attachment.js';
import type { Role } from '../../domain/identity/role.js';
import { forbidden, notFound } from '../../http/errors.js';
import { signedPath, verify } from './signing.js';

export enum FileCategory {
  FACE = 'faces',
  PROBE = 'probes',
  AVATAR = 'avatars',
  ATTENDANCE = 'attendance',
  DOCUMENT = 'documents',
}

const PUBLIC_CATEGORIES: ReadonlySet<string> = new Set<string>([FileCategory.AVATAR]);

export interface FileStream {
  stream: ReadStream;
  size: number;
  contentType: string;
}

export interface FileMetadata {
  byteSize: number;
  contentType: string;
  ownerId: string | null;
  updatedAt: string;
}

export interface UploadOptions {
  category: FileCategory;
  path: string;
  body: Buffer;
  contentType?: string;
  owner?: string | null;
  claims?: JwtClaims | null;
  tx?: DbContext;
}

@Injectable()
export class FileManager {
  private readonly rootDir = resolve(env.STORAGE_DIR);

  constructor() {}

  async ensureDirectories(): Promise<void> {
    for (const category of Object.values(FileCategory)) {
      await mkdir(join(this.rootDir, category), { recursive: true });
    }
  }

  isPublic(category: FileCategory): boolean {
    return PUBLIC_CATEGORIES.has(category);
  }

  private callerOf(claims: JwtClaims | null): { callerId: string; role: Role } | null {
    if (!claims?.sub) return null;
    return { callerId: claims.sub, role: claims.user_role as Role };
  }

  private locate(category: string, path: string): string {
    const full = resolve(join(this.rootDir, category, normalize(path)));
    const categoryRoot = resolve(join(this.rootDir, category));
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
          bucket: opts.category,
          path: opts.path,
          action: 'write',
          callerId: caller.callerId,
          role: caller.role,
        })
      ) {
        throw forbidden('that path is not yours to write');
      }
    }

    const write = async (tx: DbContext) => {
      await tx.insert(attachments).values({
        bucket: opts.category,
        path: opts.path,
        ownerId: opts.owner ?? null,
        byteSize: opts.body.length,
        contentType,
      }).onConflictDoUpdate({
        target: [attachments.bucket, attachments.path],
        set: {
          ownerId: opts.owner ?? null,
          byteSize: opts.body.length,
          contentType,
          updatedAt: new Date().toISOString(),
        },
      });
    };
    
    if (opts.tx) await write(opts.tx);
    else if (opts.claims !== undefined) await asCaller(opts.claims, write);
    else await asService(write);

    const target = this.locate(opts.category, opts.path);
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

  getUrl(category: FileCategory, path: string, ttl = env.STORAGE_URL_TTL): string {
    if (this.isPublic(category)) {
      return `${env.apiPublicPath}/storage/${category}/object?path=${encodeURIComponent(path)}`;
    }
    return `${env.apiPublicPath}${signedPath(category, path, ttl)}`;
  }

  async getSignedUrls(
    claims: JwtClaims | null,
    category: FileCategory,
    paths: string[],
    ttl = env.STORAGE_URL_TTL,
  ): Promise<Record<string, string>> {
    const wanted = [...new Set(paths.filter(Boolean))];
    if (!wanted.length) return {};

    const caller = this.callerOf(claims);
    const permitted = wanted.filter(
      (path) =>
        caller !== null &&
        mayTouchAttachment({
          bucket: category,
          path,
          action: 'read',
          callerId: caller.callerId,
          role: caller.role,
        }),
    );
    
    const askable = this.isPublic(category) ? wanted : permitted;
    if (!askable.length) return {};

    const visible = await asCaller(claims, async (tx) => {
      const rows = await tx.select({ path: attachments.path })
        .from(attachments)
        .where(and(eq(attachments.bucket, category), inArray(attachments.path, askable)));
      return rows;
    });

    const isPublic = this.isPublic(category);
    const out: Record<string, string> = {};
    for (const row of visible) {
      out[row.path] = isPublic
        ? `${env.apiPublicPath}/storage/${category}/object?path=${encodeURIComponent(row.path)}`
        : `${env.apiPublicPath}${signedPath(category, row.path, ttl)}`;
    }
    return out;
  }

  async getSignedUrl(
    claims: JwtClaims | null,
    category: FileCategory,
    path: string,
    ttl = env.STORAGE_URL_TTL,
  ): Promise<string> {
    const urls = await this.getSignedUrls(claims, category, [path], ttl);
    const url = urls[path];
    if (!url) throw notFound('object not found');
    return url;
  }

  async download(category: FileCategory, path: string): Promise<FileStream> {
    const target = this.locate(category, path);
    let size: number;
    try {
      size = (await stat(target)).size;
    } catch {
      throw notFound('object not found');
    }

    const row = await asService(async (tx) => {
      const rows = await tx.select({ contentType: attachments.contentType })
        .from(attachments)
        .where(and(eq(attachments.bucket, category), eq(attachments.path, path)))
        .limit(1);
      return rows[0] ?? null;
    });
    const contentType = row?.contentType ?? 'application/octet-stream';

    return { stream: createReadStream(target), size, contentType };
  }

  async getMetadata(category: FileCategory, path: string): Promise<FileMetadata | null> {
    const row = await asService(async (tx) => {
      const rows = await tx
        .select({
          byteSize: attachments.byteSize,
          contentType: attachments.contentType,
          ownerId: attachments.ownerId,
          updatedAt: attachments.updatedAt,
        })
        .from(attachments)
        .where(and(eq(attachments.bucket, category), eq(attachments.path, path)))
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

  async delete(category: FileCategory, paths: string[], tx?: DbContext): Promise<void> {
    const wanted = paths.filter(Boolean);
    if (!wanted.length) return;

    for (const path of wanted) {
      try {
        await unlink(this.locate(category, path));
      } catch {
        // Ignored
      }
    }

    const drop = (t: DbContext) => t.delete(attachments).where(and(eq(attachments.bucket, category), inArray(attachments.path, wanted)));
    if (tx) await drop(tx);
    else await asService(drop);
  }

  async copy(
    sourceCategory: FileCategory,
    sourcePath: string,
    targetCategory: FileCategory,
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
        bucket: targetCategory,
        path: targetPath,
        ownerId: metadata?.ownerId ?? null,
        byteSize: metadata?.byteSize ?? 0,
        contentType: metadata?.contentType ?? 'application/octet-stream',
      }).onConflictDoUpdate({
        target: [attachments.bucket, attachments.path],
        set: {
          ownerId: metadata?.ownerId ?? null,
          byteSize: metadata?.byteSize ?? 0,
          contentType: metadata?.contentType ?? 'application/octet-stream',
          updatedAt: new Date().toISOString(),
        },
      });
    };

    if (tx) await write(tx);
    else await asService(write);
  }

  async move(
    sourceCategory: FileCategory,
    sourcePath: string,
    targetCategory: FileCategory,
    targetPath: string,
    tx?: DbContext,
  ): Promise<void> {
    await this.copy(sourceCategory, sourcePath, targetCategory, targetPath, tx);
    await this.delete(sourceCategory, [sourcePath], tx);
  }

  async exists(category: FileCategory, path: string): Promise<boolean> {
    try {
      await stat(this.locate(category, path));
      return true;
    } catch {
      return false;
    }
  }

  verifySignature(category: FileCategory, path: string, expires: number, signature: string) {
    return verify(category, path, expires, signature);
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
