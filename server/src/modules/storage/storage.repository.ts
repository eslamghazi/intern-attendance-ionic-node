import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository.js';
import { faceTemplates, attendance } from '../../db/schema/index.js';
import { inArray } from 'drizzle-orm';

@Injectable()
export class StorageRepository extends BaseRepository {
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
}
