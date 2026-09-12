// What a bulk roster change is made of.

export type BulkMode = 'add' | 'remove' | 'replace';

export interface Slot {
  memberId: string;
  date: string;
  shiftId: string;
}

export interface BulkPlan {
  /** Existing assignments to delete. */
  remove: (existing: Slot) => boolean;
  /** True when (member, date) should receive the shift. */
  insert: (memberId: string, date: string, hadShift: boolean) => boolean;
  /** Assign the month's department to the affected members. */
  assignDepartment: boolean;
}
