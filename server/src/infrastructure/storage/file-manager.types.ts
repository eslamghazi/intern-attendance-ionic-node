// The shapes the file manager takes and returns.
import type { ReadStream } from 'node:fs';
import type { DbContext, JwtClaims } from '../database/context.js';
import type { FileKind } from '../../config/constants.js';

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
  kind: FileKind;
  path: string;
  body: Buffer;
  contentType?: string;
  /** Who uploaded it. */
  owner?: string | null;
  /**
   * Who the file is ABOUT — the member a face or probe belongs to. Decides
   * access from here on; see domain/access/attachment.ts. Defaults to `owner`,
   * which is right whenever someone uploads their own file.
   */
  subject?: string | null;
  claims?: JwtClaims | null;
  tx?: DbContext;
}
