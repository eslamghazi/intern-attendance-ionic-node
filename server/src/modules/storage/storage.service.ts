import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { StorageRepository } from './storage.repository.js';
import type { Caller } from '../../domain/identity/role.js';
import type { JwtClaims } from '../../db/context.js';
import { FileManager, FileCategory } from '../../infrastructure/storage/file-manager.service.js';

@Injectable()
export class StorageService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly repo: StorageRepository,
    private readonly fileManager: FileManager,
  ) {}

  async uploadObject(caller: Caller, claims: JwtClaims, category: FileCategory, path: string, bytes: Buffer, contentType: string) {
    return this.fileManager.upload({
      category,
      path,
      body: bytes,
      contentType,
      owner: caller.id,
      claims,
    });
  }

  async deleteObjects(category: FileCategory, paths: string[]) {
    await this.fileManager.delete(category, paths);

    await this.uow.asService(async () => {
      await this.repo.clearObjectPaths(paths);
    });
  }
}
