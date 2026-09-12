import type { Caller } from '../../../domain/identity/role.js';
import type { JwtClaims } from '../../../infrastructure/database/context.js';
import type { FileKind } from '../../../infrastructure/storage/file-manager.service.js';

import type { UploadObjectResponseDto } from '../dto/storage.dto.js';

export interface IStorageService {
  uploadObject(
    caller: Caller,
    claims: JwtClaims,
    kind: FileKind,
    path: string,
    bytes: Buffer,
    contentType: string,
  ): Promise<UploadObjectResponseDto>;
  deleteObjects(kind: FileKind, paths: string[]): Promise<void>;
}

export interface IStorageRepository {
  clearObjectPaths(paths: string[]): Promise<void>;
}
