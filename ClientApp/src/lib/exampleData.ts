// Single source of truth for the illustrative "example row" shown in every
// downloadable template / export when there is no real data to display. Change a
// sample value once here and it updates across members import/export + roster.
export const EXAMPLE = {
  memberCode: '20261001',
  nationalId: '30110281500753',
  fullName: 'طالب مثال — Example',
  phone: '01000000000',
  email: 'name@example.com',
  /** Fallback names used only when no real group/branch/department exists yet. */
  groupName: 'دفعة مثال',
  branchName: 'مستشفى مثال',
  departmentName: 'قسم مثال',
} as const;
