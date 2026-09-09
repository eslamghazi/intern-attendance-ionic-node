import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { StorageRepository } from './storage.repository.js';
import type { Caller } from '../../domain/identity/role.js';
import type { JwtClaims } from '../../db/context.js';
import {
  putObject,
  removeObjects,
  type Bucket,
} from '../../storage/objects.js';

@Injectable()
export class StorageService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly repo: StorageRepository,
  ) {}

  async uploadObject(caller: Caller, claims: JwtClaims, bucket: Bucket, path: string, bytes: Buffer, contentType: string) {
    return putObject({
      bucket,
      path,
      body: bytes,
      contentType,
      owner: caller.id,
      claims,
    });
  }

  async deleteObjects(bucket: Bucket, paths: string[]) {
    await removeObjects(bucket, paths);

    await this.uow.asService(async () => {
      await this.repo.clearObjectPaths(paths);
    });
  }
}
