// What a stored file needs in order to be named.

export interface FacePathParts {
  /** The group's academic year, when the member has a group. */
  groupYear: number | string | null;
  branchName: string | null;
  groupName: string | null;
  /** The member code, or the national id when no code has been issued yet. */
  memberCode: string | null;
}

export interface ProbePathParts {
  /** `YYYY-MM-DD`, the attendance date — not the wall clock of the upload. */
  date: string;
  branchName: string | null;
  memberCode: string | null;
  shiftName: string | null;
  /** 'check_in' | 'check_out'. */
  type: string;
  /** When the capture was taken; used only for the `HH-MM` in the file name. */
  at?: Date;
}
