// Central registry of React-Query keys so every page/cache invalidation
// refers to the same key. Management (full-row) queries get a distinct
// suffix so they never collide with the lightweight `id,name` option
// queries that share the same namespace (prefix-invalidation still
// refreshes both, e.g. invalidate(['branches']) hits ['branches','manage']).
// Root key segments (defined once) so both the specific-key builders and the
// prefix invalidations below reference the same string — never a magic literal.
const K = {
  rosterView: 'roster-view',
  monthlyAttendance: 'monthly-attendance',
  institutions: 'institutions',
} as const;

export const qk = {
  branchOptions: ['branches'] as const,
  branches: ['branches', 'manage'] as const,
  groupOptions: ['groups'] as const,
  groups: ['groups', 'manage'] as const,
  shiftOptions: ['shifts'] as const,
  shifts: ['shifts', 'manage'] as const,
  departmentOptions: ['departments'] as const,
  departments: ['departments', 'manage'] as const,
  memberDepartments: (year: number, month: number) => ['member-departments', year, month] as const,
  institutions: [K.institutions] as const,

  members: ['members'] as const,
  membersCount: ['members', 'count'] as const,
  rosterView: (
    branchId: string,
    year: number,
    month: number,
    page: number,
    search: string,
    field: string,
    departmentId = '',
  ) => [K.rosterView, branchId, year, month, page, search, field, departmentId] as const,
  rosterViewAll: [K.rosterView] as const, // prefix: invalidates every roster-view page
  rosterTotals: (
    branchId: string,
    year: number,
    month: number,
    search: string,
    field: string,
    departmentId?: string,
  ) => [K.rosterView, 'totals', branchId, year, month, search, field, departmentId] as const,

  admins: ['admins'] as const,
  assignments: ['assignments'] as const,

  settings: ['settings'] as const,
  branding: ['branding'] as const,

  review: (date: string, branchId: string) => ['review', date, branchId] as const,
  monthlyAttendance: (
    branchId: string,
    year: number,
    month: number,
    page: number,
    search: string,
    field: string,
    departmentId = '',
  ) => [K.monthlyAttendance, branchId, year, month, page, search, field, departmentId] as const,
  monthlyAttendanceAll: [K.monthlyAttendance] as const, // prefix: invalidates every page
  report: (from: string, to: string, branchId: string, groupId: string) =>
    ['report', from, to, branchId, groupId] as const,
  attendanceToday: (date: string) => ['attendance-today', date] as const,
  monthStats: (
    year: number,
    month: number,
    day: number | null,
    branchId: string,
    groupId: string,
    shiftId: string,
    departmentId: string,
  ) => ['month-stats', year, month, day, branchId, groupId, shiftId, departmentId] as const,
  memberToday: (memberId?: string) => ['today', memberId] as const,
  memberHistory: (memberId?: string) => ['history', memberId] as const,
};

export interface Option {
  id: string;
  name: string;
}
