var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository.js';
import { faceTemplates, attendance } from '../../db/schema/index.js';
import { inArray } from 'drizzle-orm';
let StorageRepository = class StorageRepository extends BaseRepository {
    async clearObjectPaths(paths) {
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
};
StorageRepository = __decorate([
    Injectable()
], StorageRepository);
export { StorageRepository };
//# sourceMappingURL=storage.repository.js.map