// What the access rules are asked about.
import type { FileAction, FileKind } from '../../config/constants.js';
import type { Role } from '../identity/role.js';

/** One row of admin_assignments. Either column may be null. */
export interface Assignment {
  branchId: string | null;
  groupId: string | null;
}

/** The branch and group a record belongs to. Either may be unknown. */
export interface Unit {
  branchId: string | null;
  groupId: string | null;
}

export type Scope =
  /** Everything: a superadmin, or an admin nobody has narrowed down. */
  | { kind: 'all' }
  /** Only these branches and groups. */
  | { kind: 'assigned'; branchIds: readonly string[]; groupIds: readonly string[] }
  /** Nothing. Members reach their own data by other means, never through this. */
  | { kind: 'none' };

export interface AttachmentRequest {
  kind: FileKind;
  path: string;
  action: FileAction;
  /** The signed-in profile id. */
  callerId: string;
  role: Role;
  /**
   * Who the file is about, from `attachments.subject_id`.
   *
   * Required for every kind whose owner comes from the subject. Null means the
   * row names nobody, and the answer is no — there is no second guess at it
   * from the path.
   */
  subjectId?: string | null;
}
