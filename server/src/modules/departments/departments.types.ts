// What the departments module accepts.

export interface PutDepartmentPayload {
  id?: string;
  name: string;
  branch_id: string | null;
}

export interface PutMemberDepartmentPayload {
  member_id: string;
  year: number;
  month: number;
  department_id: string | null;
}
