import type { Caller } from '../../../domain/identity/role.js';
import type { JwtClaims } from '../../../db/context.js';
import type { FileCategory } from '../../../infrastructure/storage/file-manager.service.js';

import type { UploadObjectResponseDto } from '../dto/storage.dto.js';

export interface IStorageService {
  uploadObject(
    caller: Caller,
    claims: JwtClaims,
    category: FileCategory,
    path: string,
    bytes: Buffer,
    contentType: string,
  ): Promise<UploadObjectResponseDto>;
  deleteObjects(category: FileCategory, paths: string[]): Promise<void>;
}

export interface IStorageRepository {
  clearObjectPaths(paths: string[]): Promise<void>;
}
