import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../infrastructure/database/base.repository.js';
import { faceTemplates, attendance, attachments } from '../../infrastructure/database/schema/index.js';
import { and, count, eq, inArray, lt } from 'drizzle-orm';

import type { IStorageRepository } from './interfaces/storage.interface.js';

@Injectable()
export class StorageRepository extends BaseRepository implements IStorageRepository {
  async clearObjectPaths(paths: string[]) {
    await this.db
      .update(faceTemplates)
      .set({ photoPath: null })
      .where(inArray(faceTemplates.photoPath, paths));

    await this.db
      .update(attendance)
      .set({ checkInProbePath: null })
      .where(inArray(attendance.checkInProbePath, paths));

    await this.db
      .update(attendance)
      .set({ checkOutProbePath: null })
      .where(inArray(attendance.checkOutProbePath, paths));
  }

  /**
   * Probe images older than the cutoff, oldest first.
   *
   * Bounded: a first run on a deployment that has never pruned can face a year
   * of check-ins, and reading every path into memory to delete them is how a
   * maintenance job becomes the outage.
   */
  async probesOlderThan(cutoffIso: string, limit: number): Promise<string[]> {
    const rows = await this.db
      .select({ path: attachments.path })
      .from(attachments)
      .where(and(eq(attachments.kind, 'probes'), lt(attachments.createdAt, cutoffIso)))
      .orderBy(attachments.createdAt)
      .limit(limit);
    return rows.map((r) => r.path);
  }

  /** Every recorded path in one kind. For reconciliation against the disk. */
  async pathsInKind(kind: string): Promise<string[]> {
    const rows = await this.db
      .select({ path: attachments.path })
      .from(attachments)
      .where(eq(attachments.kind, kind));
    return rows.map((r) => r.path);
  }

  /** Rows whose file is gone. Reported, never deleted automatically. */
  async countRows(kind: string): Promise<number> {
    const rows = await this.db
      .select({ n: count() })
      .from(attachments)
      .where(eq(attachments.kind, kind));
    return Number(rows[0]?.n ?? 0);
  }
}
