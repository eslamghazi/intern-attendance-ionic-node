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
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { StorageRepository } from './storage.repository.js';
import { FileManager } from '../../infrastructure/storage/file-manager.service.js';
let StorageService = class StorageService {
    uow;
    repo;
    fileManager;
    constructor(uow, repo, fileManager) {
        this.uow = uow;
        this.repo = repo;
        this.fileManager = fileManager;
    }
    async uploadObject(caller, claims, category, path, bytes, contentType) {
        return this.fileManager.upload({
            category,
            path,
            body: bytes,
            contentType,
            owner: caller.id,
            claims,
        });
    }
    async deleteObjects(category, paths) {
        await this.fileManager.delete(category, paths);
        await this.uow.asService(async () => {
            await this.repo.clearObjectPaths(paths);
        });
    }
};
StorageService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService,
        StorageRepository,
        FileManager])
], StorageService);
export { StorageService };
//# sourceMappingURL=storage.service.js.map