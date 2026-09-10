var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../../env.js';
import { asCaller, asService } from '../../db/context.js';
import { eq, and, inArray } from 'drizzle-orm';
import { attachments } from '../../db/schema/index.js';
import { mayTouchAttachment } from '../../domain/access/attachment.js';
import { forbidden, notFound } from '../../http/errors.js';
import { signedPath, verify } from './signing.js';
export var FileCategory;
(function (FileCategory) {
    FileCategory["FACE"] = "faces";
    FileCategory["PROBE"] = "probes";
    FileCategory["AVATAR"] = "avatars";
    FileCategory["ATTENDANCE"] = "attendance";
    FileCategory["DOCUMENT"] = "documents";
})(FileCategory || (FileCategory = {}));
const PUBLIC_CATEGORIES = new Set([FileCategory.AVATAR]);
let FileManager = class FileManager {
    rootDir = resolve(env.STORAGE_DIR);
    constructor() { }
    async ensureDirectories() {
        for (const category of Object.values(FileCategory)) {
            await mkdir(join(this.rootDir, category), { recursive: true });
        }
    }
    isPublic(category) {
        return PUBLIC_CATEGORIES.has(category);
    }
    callerOf(claims) {
        if (!claims?.sub)
            return null;
        return { callerId: claims.sub, role: claims.user_role };
    }
    locate(category, path) {
        const full = resolve(join(this.rootDir, category, normalize(path)));
        const categoryRoot = resolve(join(this.rootDir, category));
        if (full !== categoryRoot && !full.startsWith(categoryRoot + sep)) {
            throw notFound('object not found');
        }
        return full;
    }
    async upload(opts) {
        const contentType = opts.contentType ?? 'application/octet-stream';
        if (opts.claims !== undefined) {
            const caller = this.callerOf(opts.claims);
            if (!caller ||
                !mayTouchAttachment({
                    bucket: opts.category,
                    path: opts.path,
                    action: 'write',
                    callerId: caller.callerId,
                    role: caller.role,
                })) {
                throw forbidden('that path is not yours to write');
            }
        }
        const write = async (tx) => {
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
        if (opts.tx)
            await write(opts.tx);
        else if (opts.claims !== undefined)
            await asCaller(opts.claims, write);
        else
            await asService(write);
        const target = this.locate(opts.category, opts.path);
        await mkdir(dirname(target), { recursive: true });
        const tmp = `${target}.${randomUUID()}.tmp`;
        try {
            await writeFile(tmp, opts.body);
            await rename(tmp, target);
        }
        catch (err) {
            await unlink(tmp).catch(() => { });
            throw err;
        }
        return { path: opts.path };
    }
    getUrl(category, path, ttl = env.STORAGE_URL_TTL) {
        if (this.isPublic(category)) {
            return `${env.apiPublicPath}/storage/${category}/object?path=${encodeURIComponent(path)}`;
        }
        return `${env.apiPublicPath}${signedPath(category, path, ttl)}`;
    }
    async getSignedUrls(claims, category, paths, ttl = env.STORAGE_URL_TTL) {
        const wanted = [...new Set(paths.filter(Boolean))];
        if (!wanted.length)
            return {};
        const caller = this.callerOf(claims);
        const permitted = wanted.filter((path) => caller !== null &&
            mayTouchAttachment({
                bucket: category,
                path,
                action: 'read',
                callerId: caller.callerId,
                role: caller.role,
            }));
        const askable = this.isPublic(category) ? wanted : permitted;
        if (!askable.length)
            return {};
        const visible = await asCaller(claims, async (tx) => {
            const rows = await tx.select({ path: attachments.path })
                .from(attachments)
                .where(and(eq(attachments.bucket, category), inArray(attachments.path, askable)));
            return rows;
        });
        const isPublic = this.isPublic(category);
        const out = {};
        for (const row of visible) {
            out[row.path] = isPublic
                ? `${env.apiPublicPath}/storage/${category}/object?path=${encodeURIComponent(row.path)}`
                : `${env.apiPublicPath}${signedPath(category, row.path, ttl)}`;
        }
        return out;
    }
    async getSignedUrl(claims, category, path, ttl = env.STORAGE_URL_TTL) {
        const urls = await this.getSignedUrls(claims, category, [path], ttl);
        const url = urls[path];
        if (!url)
            throw notFound('object not found');
        return url;
    }
    async download(category, path) {
        const target = this.locate(category, path);
        let size;
        try {
            size = (await stat(target)).size;
        }
        catch {
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
    async getMetadata(category, path) {
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
        if (!row)
            return null;
        return {
            byteSize: row.byteSize,
            contentType: row.contentType,
            ownerId: row.ownerId,
            updatedAt: row.updatedAt,
        };
    }
    async delete(category, paths, tx) {
        const wanted = paths.filter(Boolean);
        if (!wanted.length)
            return;
        for (const path of wanted) {
            try {
                await unlink(this.locate(category, path));
            }
            catch {
                // Ignored
            }
        }
        const drop = (t) => t.delete(attachments).where(and(eq(attachments.bucket, category), inArray(attachments.path, wanted)));
        if (tx)
            await drop(tx);
        else
            await asService(drop);
    }
    async copy(sourceCategory, sourcePath, targetCategory, targetPath, tx) {
        const sourceTarget = this.locate(sourceCategory, sourcePath);
        const destinationTarget = this.locate(targetCategory, targetPath);
        await mkdir(dirname(destinationTarget), { recursive: true });
        await copyFile(sourceTarget, destinationTarget);
        const metadata = await this.getMetadata(sourceCategory, sourcePath);
        const write = async (t) => {
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
        if (tx)
            await write(tx);
        else
            await asService(write);
    }
    async move(sourceCategory, sourcePath, targetCategory, targetPath, tx) {
        await this.copy(sourceCategory, sourcePath, targetCategory, targetPath, tx);
        await this.delete(sourceCategory, [sourcePath], tx);
    }
    async exists(category, path) {
        try {
            await stat(this.locate(category, path));
            return true;
        }
        catch {
            return false;
        }
    }
    verifySignature(category, path, expires, signature) {
        return verify(category, path, expires, signature);
    }
    decodeBase64Image(input) {
        const b64 = (input || '').split(',').pop() ?? '';
        if (!b64)
            return null;
        try {
            const buf = Buffer.from(b64, 'base64');
            return buf.length ? buf : null;
        }
        catch {
            return null;
        }
    }
};
FileManager = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], FileManager);
export { FileManager };
//# sourceMappingURL=file-manager.service.js.map