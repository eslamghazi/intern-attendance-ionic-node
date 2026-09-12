// What the departments module accepts.

export interface PutDepartmentPayload {
  id?: string;
  name: string;
  /** The hospital it belongs to — every department has one. */
  branch_id: string;
}

export interface PutMemberDepartmentPayload {
  member_id: string;
  year: number;
  month: number;
  department_id: string | null;
}
